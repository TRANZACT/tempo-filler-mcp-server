#!/usr/bin/env node

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

// Environment configuration
const config = {
  baseUrl: process.env[ENV_VARS.TEMPO_BASE_URL] || '',
  personalAccessToken: process.env[ENV_VARS.TEMPO_PAT] || '',
  defaultHours: parseInt(process.env[ENV_VARS.TEMPO_DEFAULT_HOURS] || String(DEFAULTS.HOURS_PER_DAY)),
};

// Debug logging
console.error(`Debug: ${ENV_VARS.TEMPO_BASE_URL} = ${config.baseUrl ? '[CONFIGURED]' : '[MISSING]'}`);
console.error(`Debug: ${ENV_VARS.TEMPO_PAT} = ${config.personalAccessToken ? '[CONFIGURED - length: ' + config.personalAccessToken.length + ']' : '[MISSING]'}`);
console.error(`Debug: ${ENV_VARS.TEMPO_DEFAULT_HOURS} = ${config.defaultHours}`);

// Validate required configuration
if (!config.baseUrl) {
  console.error(`Error: ${ENV_VARS.TEMPO_BASE_URL} environment variable is required`);
  process.exit(1);
}

if (!config.personalAccessToken) {
  console.error(`Error: ${ENV_VARS.TEMPO_PAT} environment variable is required`);
  process.exit(1);
}

// Initialize Tempo client
const tempoClient = new TempoClient(config);

// Create MCP server instance
const server = new Server(
  {
    name: "tempofiller",
    version: "1.1.0",
  },
  {
    capabilities: {
      tools: {},
      resources: {},
      prompts: {},
    },
  }
);

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
        return await getWorklogs(tempoClient, input);
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
        return await getSchedule(tempoClient, input);
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
  return {
    resources: [
      {
        uri: "tempo://issues/recent",
        name: "Recent Issues",
        description: "Recently used issue keys for quick reference",
        mimeType: "application/json",
      },
    ],
  };
});

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const { uri } = request.params;

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