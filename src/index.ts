#!/usr/bin/env node

import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import { TempoClient } from "./tempo-client.js";

// Load UI HTML files at module initialization
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let getScheduleUI: string = "";
let getWorklogsUI: string = "";

try {
  getScheduleUI = readFileSync(join(__dirname, "ui/get-schedule.html"), "utf-8");
} catch {
  console.error("Warning: get-schedule UI not found - UI features will be unavailable");
}

try {
  getWorklogsUI = readFileSync(join(__dirname, "ui/get-worklogs.html"), "utf-8");
} catch {
  console.error("Warning: get-worklogs UI not found - UI features will be unavailable");
}
import { getWorklogs, postWorklog, bulkPostWorklogs, deleteWorklog, getSchedule } from "./tools/index.js";
import {
  GetWorklogsInputSchema,
  PostWorklogInputSchema,
  BulkPostWorklogsInputSchema,
  DeleteWorklogInputSchema,
  GetScheduleInputSchema,
  TOOL_NAMES,
  ENV_VARS,
  DEFAULTS,
} from "./types/index.js";

// Environment configuration - supports both Cloud and Server/DC modes
// Cloud mode: separate Jira (Basic auth) and Tempo (Bearer auth) credentials
// Server/DC mode: single base URL + PAT (backward compatible)

// Resolve env vars with fallback names
const jiraBaseUrl = process.env[ENV_VARS.JIRA_BASE_URL] || process.env[ENV_VARS.ATLASSIAN_URL] || '';
const jiraEmail = process.env[ENV_VARS.JIRA_EMAIL] || process.env[ENV_VARS.ATLASSIAN_EMAIL] || '';
const jiraApiToken = process.env[ENV_VARS.JIRA_API_TOKEN] || process.env[ENV_VARS.ATLASSIAN_API_KEY] || '';
const tempoToken = process.env[ENV_VARS.TEMPO_TOKEN] || process.env[ENV_VARS.TEMPO_PAT] || '';
const tempoBaseUrl = process.env[ENV_VARS.TEMPO_BASE_URL] || '';

const isCloudMode = !!(jiraBaseUrl && jiraEmail && jiraApiToken && tempoToken);

const config = isCloudMode ? {
  // Cloud mode
  jiraBaseUrl,
  jiraEmail,
  jiraApiToken,
  tempoBaseUrl: tempoBaseUrl || 'https://api.tempo.io',
  tempoToken,
  defaultHours: parseInt(process.env[ENV_VARS.TEMPO_DEFAULT_HOURS] || String(DEFAULTS.HOURS_PER_DAY)),
} : {
  // Server/DC mode (backward compatible)
  baseUrl: tempoBaseUrl || process.env[ENV_VARS.TEMPO_BASE_URL] || '',
  personalAccessToken: tempoToken || process.env[ENV_VARS.TEMPO_PAT] || '',
  defaultHours: parseInt(process.env[ENV_VARS.TEMPO_DEFAULT_HOURS] || String(DEFAULTS.HOURS_PER_DAY)),
};

// Debug logging
if (isCloudMode) {
  console.error(`Mode: Cloud`);
  console.error(`  Jira URL: ${jiraBaseUrl ? '[CONFIGURED]' : '[MISSING]'}`);
  console.error(`  Jira Email: ${jiraEmail ? '[CONFIGURED]' : '[MISSING]'}`);
  console.error(`  Jira API Token: ${jiraApiToken ? '[CONFIGURED]' : '[MISSING]'}`);
  console.error(`  Tempo Token: ${tempoToken ? '[CONFIGURED]' : '[MISSING]'}`);
} else {
  console.error(`Mode: Server/DC`);
  console.error(`  Base URL: ${config.baseUrl ? '[CONFIGURED]' : '[MISSING]'}`);
  console.error(`  PAT: ${config.personalAccessToken ? '[CONFIGURED]' : '[MISSING]'}`);
}

// Validate required configuration
if (!isCloudMode) {
  if (!config.baseUrl) {
    console.error(`Error: Set TEMPO_BASE_URL (Server/DC) or JIRA_BASE_URL + JIRA_EMAIL + JIRA_API_TOKEN + TEMPO_TOKEN (Cloud)`);
    process.exit(1);
  }
  if (!config.personalAccessToken) {
    console.error(`Error: Set TEMPO_PAT (Server/DC) or TEMPO_TOKEN (Cloud)`);
    process.exit(1);
  }
}

// Initialize Tempo client
const tempoClient = new TempoClient(config);

// Server instructions for AI assistants
// Following MCP best practices: focus on workflows, constraints, and cross-tool relationships
// Avoid duplicating tool descriptions - those are in the tool definitions
const SERVER_INSTRUCTIONS = `Tempo Timesheets integration for JIRA worklog management. Use when users ask about time tracking, logging hours, filling timesheets, or checking work schedules.

WORKFLOW: Always get_schedule first → then create worklogs only on working days.

CONSTRAINTS:
- Dates: YYYY-MM-DD format
- Hours: 0.1-24 per entry, default 8h/day
- Bulk operations: max 100 entries
- Issue keys: PROJECT-NUMBER format (e.g., PROJ-1234)

TOOL RELATIONSHIPS:
- get_schedule + bulk_post_worklogs: Check working days, then fill only those days
- get_worklogs + delete_worklog: Review entries, then remove specific ones by ID
- get_schedule + get_worklogs: Compare required vs logged hours for coverage gaps
- post_worklog/bulk_post_worklogs/delete_worklog → get_worklogs: Always fetch worklogs after modifications so users see results visually`;

// Create MCP server instance
const server = new Server(
  {
    name: "tempofiller",
    version: "2.0.2",
  },
  {
    capabilities: {
      tools: {},
      resources: {},
      prompts: {},
    },
    instructions: SERVER_INSTRUCTIONS,
  }
);

// Debug: Log client capabilities when connection is established
server.oninitialized = () => {
  console.error("=== MCP Server Initialized ===");
  const caps = server.getClientCapabilities();
  console.error("Client Capabilities:", JSON.stringify(caps, null, 2));
  // Check for MCP Apps extension support (may be in experimental or a different field)
  const capsAny = caps as Record<string, unknown>;
  if (capsAny?.["io.modelcontextprotocol/ui"] || capsAny?.extensions) {
    console.error("✓ Client may support MCP Apps");
    console.error("Extensions field:", JSON.stringify(capsAny?.extensions, null, 2));
  } else {
    console.error("✗ No MCP Apps extension detected in capabilities");
  }
};

// Tool definitions and handlers
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: TOOL_NAMES.GET_WORKLOGS,
        description: "Retrieve worklogs for authenticated user and date range",
        inputSchema: {
          type: "object",
          properties: {
            startDate: {
              type: "string",
              pattern: "^\\d{4}-\\d{2}-\\d{2}$",
              description: "Start date in YYYY-MM-DD format",
            },
            endDate: {
              type: "string",
              pattern: "^\\d{4}-\\d{2}-\\d{2}$",
              description: "End date in YYYY-MM-DD format (optional, defaults to startDate)",
            },
            issueKey: {
              type: "string",
              description: "Optional filter by specific issue key (e.g., PROJ-1234)",
            },
          },
          required: ["startDate"],
        },
        _meta: getWorklogsUI ? {
          ui: { resourceUri: "ui://tempofiller/get-worklogs.html" },
        } : undefined,
      },
      {
        name: TOOL_NAMES.POST_WORKLOG,
        description: "Create a new worklog entry. For better results, consider using get_schedule first to verify working days and expected hours.",
        inputSchema: {
          type: "object",
          properties: {
            issueKey: {
              type: "string",
              description: "JIRA issue key (e.g., PROJ-1234)",
            },
            hours: {
              type: "number",
              minimum: 0.1,
              maximum: 24,
              description: "Hours worked (decimal)",
            },
            startDate: {
              type: "string",
              pattern: "^\\d{4}-\\d{2}-\\d{2}$",
              description: "Start date in YYYY-MM-DD format",
            },
            endDate: {
              type: "string",
              pattern: "^\\d{4}-\\d{2}-\\d{2}$",
              description: "End date in YYYY-MM-DD format (optional, defaults to startDate)",
            },
            billable: {
              type: "boolean",
              description: "Whether the time is billable (default: true)",
            },
            description: {
              type: "string",
              description: "Work description (optional)",
            },
          },
          required: ["issueKey", "hours", "startDate"],
        },
      },
      {
        name: TOOL_NAMES.BULK_POST_WORKLOGS,
        description: "Create multiple worklog entries from a structured format. RECOMMENDED: Use get_schedule first to identify working days and avoid logging time on non-working days.",
        inputSchema: {
          type: "object",
          properties: {
            worklogs: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  issueKey: {
                    type: "string",
                    description: "JIRA issue key (e.g., PROJ-1234)",
                  },
                  hours: {
                    type: "number",
                    minimum: 0.1,
                    maximum: 24,
                    description: "Hours worked (decimal)",
                  },
                  date: {
                    type: "string",
                    pattern: "^\\d{4}-\\d{2}-\\d{2}$",
                    description: "Date in YYYY-MM-DD format",
                  },
                  description: {
                    type: "string",
                    description: "Work description (optional)",
                  },
                },
                required: ["issueKey", "hours", "date"],
              },
              description: "Array of worklog entries to create",
            },
            billable: {
              type: "boolean",
              description: "Whether the time is billable for all entries (default: true)",
            },
          },
          required: ["worklogs"],
        },
      },
      {
        name: TOOL_NAMES.DELETE_WORKLOG,
        description: "Delete an existing worklog entry",
        inputSchema: {
          type: "object",
          properties: {
            worklogId: {
              type: "string",
              description: "Tempo worklog ID to delete",
            },
          },
          required: ["worklogId"],
        },
      },
      {
        name: TOOL_NAMES.GET_SCHEDULE,
        description: "Retrieve work schedule for authenticated user and date range",
        inputSchema: {
          type: "object",
          properties: {
            startDate: {
              type: "string",
              pattern: "^\\d{4}-\\d{2}-\\d{2}$",
              description: "Start date in YYYY-MM-DD format",
            },
            endDate: {
              type: "string",
              pattern: "^\\d{4}-\\d{2}-\\d{2}$",
              description: "End date in YYYY-MM-DD format (optional, defaults to startDate)",
            },
          },
          required: ["startDate"],
        },
        _meta: getScheduleUI ? {
          ui: { resourceUri: "ui://tempofiller/get-schedule.html" },
        } : undefined,
      },
    ],
  };
});

// Tool execution handler
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case TOOL_NAMES.GET_WORKLOGS: {
        const input = GetWorklogsInputSchema.parse(args);
        return await getWorklogs(tempoClient, input, getWorklogsUI || undefined);
      }

      case TOOL_NAMES.POST_WORKLOG: {
        const input = PostWorklogInputSchema.parse(args);
        return await postWorklog(tempoClient, input);
      }

      case TOOL_NAMES.BULK_POST_WORKLOGS: {
        const input = BulkPostWorklogsInputSchema.parse(args);
        return await bulkPostWorklogs(tempoClient, input);
      }

      case TOOL_NAMES.DELETE_WORKLOG: {
        const input = DeleteWorklogInputSchema.parse(args);
        return await deleteWorklog(tempoClient, input);
      }

      case TOOL_NAMES.GET_SCHEDULE: {
        const input = GetScheduleInputSchema.parse(args);
        return await getSchedule(tempoClient, input, getScheduleUI || undefined);
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: [
        {
          type: "text",
          text: `Error executing tool ${name}: ${errorMessage}`,
        },
      ],
      isError: true,
    };
  }
});

// Resource handlers (basic implementation)
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  const resources = [
    {
      uri: "tempo://issues/recent",
      name: "Recent Issues",
      description: "Recently used issue keys for quick reference",
      mimeType: "application/json",
    },
  ];

  // Add UI resources if available (MCP Apps extension)
  if (getScheduleUI) {
    resources.push({
      uri: "ui://tempofiller/get-schedule.html",
      name: "Schedule Calendar UI",
      description: "Visual calendar view for get_schedule tool results",
      mimeType: "text/html;profile=mcp-app",
    });
  }

  if (getWorklogsUI) {
    resources.push({
      uri: "ui://tempofiller/get-worklogs.html",
      name: "Worklogs Timesheet UI",
      description: "Visual timesheet grid for get_worklogs tool results",
      mimeType: "text/html;profile=mcp-app",
    });
  }

  return { resources };
});

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const { uri } = request.params;

  // Debug: Log all resource read requests
  console.error(`[DEBUG] Resource read request: ${uri}`);

  if (uri === "tempo://issues/recent") {
    // For now, return a simple placeholder
    const recentIssues = {
      issues: [
        { key: "PROJ-1234", summary: "Example issue", lastUsed: new Date().toISOString() },
      ],
    };

    return {
      contents: [
        {
          uri,
          mimeType: "application/json",
          text: JSON.stringify(recentIssues, null, 2),
        },
      ],
    };
  }

  // Handle UI resources - MCP Apps extension uses text/html;profile=mcp-app MIME type
  if (uri === "ui://tempofiller/get-schedule.html" && getScheduleUI) {
    console.error(`[DEBUG] Returning get-schedule UI (${getScheduleUI.length} bytes)`);
    return {
      contents: [
        {
          uri,
          mimeType: "text/html;profile=mcp-app",
          text: getScheduleUI,
        },
      ],
    };
  }

  if (uri === "ui://tempofiller/get-worklogs.html" && getWorklogsUI) {
    console.error(`[DEBUG] Returning get-worklogs UI (${getWorklogsUI.length} bytes)`);
    return {
      contents: [
        {
          uri,
          mimeType: "text/html;profile=mcp-app",
          text: getWorklogsUI,
        },
      ],
    };
  }

  throw new Error(`Unknown resource: ${uri}`);
});

// Prompt handlers (basic implementation)
server.setRequestHandler(ListPromptsRequestSchema, async () => {
  return {
    prompts: [
      {
        name: "worklog_summary",
        description: "Generate a prompt for analyzing worklog data",
        arguments: [
          {
            name: "username",
            description: "JIRA username",
            required: true,
          },
          {
            name: "month",
            description: "Month in YYYY-MM format",
            required: true,
          },
          {
            name: "includeAnalysis",
            description: "Include detailed analysis",
            required: false,
          },
        ],
      },
      {
        name: "schedule_aware_bulk_entry",
        description: "Guide AI assistants through schedule-first bulk worklog creation",
        arguments: [
          {
            name: "dateRange",
            description: "Date range in natural language (e.g., 'this month', 'October 2025')",
            required: true,
          },
          {
            name: "issueKey",
            description: "JIRA issue key for time entries",
            required: true,
          },
          {
            name: "hoursPerDay",
            description: "Hours per working day (default: 8)",
            required: false,
          },
        ],
      },
    ],
  };
});

server.setRequestHandler(GetPromptRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name === "worklog_summary") {
    const username = args?.username || "user";
    const month = args?.month || new Date().toISOString().slice(0, 7);

    return {
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Analyze the worklog data for ${username} in ${month}. Provide insights about:
- Total hours worked
- Distribution across projects
- Daily patterns
- Missing days or potential gaps`,
          },
        },
      ],
    };
  }

  if (name === "schedule_aware_bulk_entry") {
    const dateRange = args?.dateRange || "this month";
    const issueKey = args?.issueKey || "PROJ-XXXX";
    const hoursPerDay = args?.hoursPerDay || 8;

    return {
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `I need to create bulk worklog entries for ${dateRange} on ${issueKey}. Please follow this schedule-aware workflow:

1. FIRST: Use the get_schedule tool to check my work schedule for ${dateRange}
2. ANALYZE: Review the schedule results to identify:
   - Total working days
   - Non-working days to avoid
   - Expected hours per day
3. THEN: Use bulk_post_worklogs to create entries ONLY for working days
4. CONFIGURE: Use ${hoursPerDay} hours per working day (or match the schedule requirements)

This approach ensures accurate time entry without conflicts with non-working days, holidays, or weekends.

Start by checking my schedule for ${dateRange}.`,
          },
        },
      ],
    };
  }

  throw new Error(`Unknown prompt: ${name}`);
});

// Main function to start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  
  // Log to stderr (not stdout, which is used for MCP communication)
  console.error("Tempo Filler MCP Server started");
  console.error(`Base URL: ${config.baseUrl}`);
  console.error(`Default hours: ${config.defaultHours}`);
}

// Error handling
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start the server
main().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});