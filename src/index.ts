#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { SERVER_VERSION, createTempoClient, loadUiAssets } from "./server-core.js";
import { registerHandlers } from "./server-handlers.js";

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

const tempoClient = createTempoClient();
const uiAssets = loadUiAssets();

const server = new Server(
  { name: "tempofiller", version: SERVER_VERSION },
  {
    capabilities: { tools: {}, resources: {}, prompts: {} },
    instructions: SERVER_INSTRUCTIONS,
  }
);

registerHandlers(server, tempoClient, uiAssets);

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`Tempo Filler MCP Server v${SERVER_VERSION} started`);
}

process.on("uncaughtException", (error) => {
  console.error("Uncaught exception:", error);
  process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled rejection at:", promise, "reason:", reason);
  process.exit(1);
});

main().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
