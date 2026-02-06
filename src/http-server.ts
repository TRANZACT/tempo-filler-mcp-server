#!/usr/bin/env node

import "dotenv/config";

/**
 * HTTP server version of TempoFiller MCP Server
 * Use this with basic-host or cloudflared for testing MCP Apps
 *
 * Usage:
 *   npm run build
 *   node dist/http-server.js
 *
 * Then point basic-host to http://localhost:3001/mcp
 */

import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import express from "express";
import cors from "cors";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
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

// Load UI HTML files
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let getScheduleUI: string = "";
let getWorklogsUI: string = "";

try {
  getScheduleUI = readFileSync(join(__dirname, "ui/get-schedule.html"), "utf-8");
  console.log(`Loaded get-schedule UI (${getScheduleUI.length} bytes)`);
} catch {
  console.error("Warning: get-schedule UI not found");
}

try {
  getWorklogsUI = readFileSync(join(__dirname, "ui/get-worklogs.html"), "utf-8");
  console.log(`Loaded get-worklogs UI (${getWorklogsUI.length} bytes)`);
} catch {
  console.error("Warning: get-worklogs UI not found");
}

// Environment configuration - supports both Cloud and Server/DC modes
const jiraBaseUrl = process.env[ENV_VARS.JIRA_BASE_URL] || process.env[ENV_VARS.ATLASSIAN_URL] || '';
const jiraEmail = process.env[ENV_VARS.JIRA_EMAIL] || process.env[ENV_VARS.ATLASSIAN_EMAIL] || '';
const jiraApiToken = process.env[ENV_VARS.JIRA_API_TOKEN] || process.env[ENV_VARS.ATLASSIAN_API_KEY] || '';
const tempoToken = process.env[ENV_VARS.TEMPO_TOKEN] || process.env[ENV_VARS.TEMPO_PAT] || '';
const tempoBaseUrl = process.env[ENV_VARS.TEMPO_BASE_URL] || '';

const isCloudMode = !!(jiraBaseUrl && jiraEmail && jiraApiToken && tempoToken);

const config = isCloudMode ? {
  jiraBaseUrl,
  jiraEmail,
  jiraApiToken,
  tempoBaseUrl: tempoBaseUrl || 'https://api.tempo.io',
  tempoToken,
  defaultHours: parseInt(process.env[ENV_VARS.TEMPO_DEFAULT_HOURS] || String(DEFAULTS.HOURS_PER_DAY)),
} : {
  baseUrl: tempoBaseUrl || '',
  personalAccessToken: tempoToken || '',
  defaultHours: parseInt(process.env[ENV_VARS.TEMPO_DEFAULT_HOURS] || String(DEFAULTS.HOURS_PER_DAY)),
};

if (!isCloudMode && (!config.baseUrl || !config.personalAccessToken)) {
  console.error("Error: Set TEMPO_BASE_URL + TEMPO_PAT (Server/DC) or JIRA_BASE_URL + JIRA_EMAIL + JIRA_API_TOKEN + TEMPO_TOKEN (Cloud)");
  process.exit(1);
}

const tempoClient = new TempoClient(config);

function createMCPServer(): Server {
  const server = new Server(
    { name: "tempofiller", version: "1.1.3" },
    { capabilities: { tools: {}, resources: {}, prompts: {} } }
  );

  // Tool definitions
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: TOOL_NAMES.GET_WORKLOGS,
        description: "Retrieve worklogs for authenticated user and date range",
        inputSchema: {
          type: "object",
          properties: {
            startDate: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$", description: "Start date in YYYY-MM-DD format" },
            endDate: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$", description: "End date in YYYY-MM-DD format (optional)" },
            issueKey: { type: "string", description: "Optional filter by issue key" },
          },
          required: ["startDate"],
        },
        _meta: getWorklogsUI ? { ui: { resourceUri: "ui://tempofiller/get-worklogs.html" } } : undefined,
      },
      {
        name: TOOL_NAMES.POST_WORKLOG,
        description: "Create a new worklog entry",
        inputSchema: {
          type: "object",
          properties: {
            issueKey: { type: "string", description: "JIRA issue key" },
            hours: { type: "number", minimum: 0.1, maximum: 24, description: "Hours worked" },
            startDate: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$", description: "Start date" },
            endDate: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$", description: "End date (optional)" },
            billable: { type: "boolean", description: "Billable (default: true)" },
            description: { type: "string", description: "Work description" },
          },
          required: ["issueKey", "hours", "startDate"],
        },
      },
      {
        name: TOOL_NAMES.BULK_POST_WORKLOGS,
        description: "Create multiple worklog entries",
        inputSchema: {
          type: "object",
          properties: {
            worklogs: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  issueKey: { type: "string" },
                  hours: { type: "number", minimum: 0.1, maximum: 24 },
                  date: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
                  description: { type: "string" },
                },
                required: ["issueKey", "hours", "date"],
              },
            },
            billable: { type: "boolean" },
          },
          required: ["worklogs"],
        },
      },
      {
        name: TOOL_NAMES.DELETE_WORKLOG,
        description: "Delete an existing worklog entry",
        inputSchema: {
          type: "object",
          properties: { worklogId: { type: "string", description: "Tempo worklog ID" } },
          required: ["worklogId"],
        },
      },
      {
        name: TOOL_NAMES.GET_SCHEDULE,
        description: "Retrieve work schedule for authenticated user and date range",
        inputSchema: {
          type: "object",
          properties: {
            startDate: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$", description: "Start date" },
            endDate: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$", description: "End date (optional)" },
          },
          required: ["startDate"],
        },
        _meta: getScheduleUI ? { ui: { resourceUri: "ui://tempofiller/get-schedule.html" } } : undefined,
      },
    ],
  }));

  // Tool execution
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    console.log(`[TOOL] ${name} called with:`, args);
    try {
      switch (name) {
        case TOOL_NAMES.GET_WORKLOGS:
          return await getWorklogs(tempoClient, GetWorklogsInputSchema.parse(args), getWorklogsUI || undefined);
        case TOOL_NAMES.POST_WORKLOG:
          return await postWorklog(tempoClient, PostWorklogInputSchema.parse(args));
        case TOOL_NAMES.BULK_POST_WORKLOGS:
          return await bulkPostWorklogs(tempoClient, BulkPostWorklogsInputSchema.parse(args));
        case TOOL_NAMES.DELETE_WORKLOG:
          return await deleteWorklog(tempoClient, DeleteWorklogInputSchema.parse(args));
        case TOOL_NAMES.GET_SCHEDULE:
          return await getSchedule(tempoClient, GetScheduleInputSchema.parse(args), getScheduleUI || undefined);
        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    } catch (error) {
      console.error(`[TOOL] ${name} error:`, error);
      return {
        content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
        isError: true,
      };
    }
  });

  // Resources
  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    const resources = [
      { uri: "tempo://issues/recent", name: "Recent Issues", description: "Recently used issue keys", mimeType: "application/json" },
    ];
    if (getScheduleUI) {
      resources.push({ uri: "ui://tempofiller/get-schedule.html", name: "Schedule Calendar UI", description: "Visual calendar", mimeType: "text/html;profile=mcp-app" });
    }
    if (getWorklogsUI) {
      resources.push({ uri: "ui://tempofiller/get-worklogs.html", name: "Worklogs Timesheet UI", description: "Visual timesheet", mimeType: "text/html;profile=mcp-app" });
    }
    return { resources };
  });

  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const { uri } = request.params;
    console.log(`[RESOURCE] Reading: ${uri}`);

    if (uri === "tempo://issues/recent") {
      return { contents: [{ uri, mimeType: "application/json", text: JSON.stringify({ issues: [] }) }] };
    }
    if (uri === "ui://tempofiller/get-schedule.html" && getScheduleUI) {
      console.log(`[RESOURCE] Returning get-schedule UI (${getScheduleUI.length} bytes)`);
      return { contents: [{ uri, mimeType: "text/html;profile=mcp-app", text: getScheduleUI }] };
    }
    if (uri === "ui://tempofiller/get-worklogs.html" && getWorklogsUI) {
      console.log(`[RESOURCE] Returning get-worklogs UI (${getWorklogsUI.length} bytes)`);
      return { contents: [{ uri, mimeType: "text/html;profile=mcp-app", text: getWorklogsUI }] };
    }
    throw new Error(`Unknown resource: ${uri}`);
  });

  // Prompts
  server.setRequestHandler(ListPromptsRequestSchema, async () => ({ prompts: [] }));
  server.setRequestHandler(GetPromptRequestSchema, async () => { throw new Error("Unknown prompt"); });

  return server;
}

// Create Express app
const app = express();
app.use(cors());
app.use(express.json());

// MCP endpoint - stateless mode (new server per request)
app.all("/mcp", async (req, res) => {
  console.log(`[HTTP] ${req.method} /mcp`);

  const server = createMCPServer();
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // Stateless mode
  });

  res.on("close", () => {
    transport.close().catch(() => {});
    server.close().catch(() => {});
  });

  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error("[HTTP] MCP error:", error);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: { code: -32603, message: "Internal server error" },
        id: null,
      });
    }
  }
});

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// Serve static files for testing (dist/ui and test directories)
// __dirname is dist/, so ".." gets us to project root
const projectRoot = join(__dirname, "..");
console.log("Project root:", projectRoot);
console.log("Test dir:", join(projectRoot, "test"));
app.use("/dist", express.static(__dirname));
app.use("/test", express.static(join(projectRoot, "test")));

// Direct route for test harness
app.get("/ui-test", (req, res) => {
  res.sendFile(join(projectRoot, "test", "ui-test-harness.html"));
});

const PORT = parseInt(process.env.PORT || "3001");
app.listen(PORT, () => {
  console.log(`TempoFiller HTTP MCP Server running on http://localhost:${PORT}`);
  console.log(`MCP endpoint: http://localhost:${PORT}/mcp`);
  console.log(`\nTest with basic-host:`);
  console.log(`  SERVERS='["http://localhost:${PORT}/mcp"]' npm start`);
});
