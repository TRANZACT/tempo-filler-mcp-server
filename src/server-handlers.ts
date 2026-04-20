import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import type { TempoClient } from "./tempo-client.js";
import { TOOL_NAMES, TOOL_REGISTRY } from "./types/index.js";

function getToolDescription(name: string): string {
  return TOOL_REGISTRY.find((t) => t.name === name)!.description;
}
import {
  GetWorklogsInputSchema,
  PostWorklogInputSchema,
  BulkPostWorklogsInputSchema,
  DeleteWorklogInputSchema,
  UpdateWorklogInputSchema,
  BulkDeleteWorklogsInputSchema,
  BulkUpdateWorklogsInputSchema,
  GetScheduleInputSchema,
} from "./types/index.js";
import { getWorklogs, postWorklog, bulkPostWorklogs, deleteWorklog, updateWorklog, bulkDeleteWorklogs, bulkUpdateWorklogs, getSchedule } from "./tools/index.js";
import type { UiAssets } from "./server-core.js";

export function registerHandlers(server: Server, tempoClient: TempoClient, uiAssets: UiAssets): void {
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: TOOL_NAMES.GET_WORKLOGS,
        description: getToolDescription(TOOL_NAMES.GET_WORKLOGS),
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
        _meta: uiAssets.getWorklogsHtml
          ? { ui: { resourceUri: "ui://tempofiller/get-worklogs.html" } }
          : undefined,
      },
      {
        name: TOOL_NAMES.POST_WORKLOG,
        description: getToolDescription(TOOL_NAMES.POST_WORKLOG),
        inputSchema: {
          type: "object",
          properties: {
            issueKey: { type: "string", description: "JIRA issue key (e.g., PROJ-1234)" },
            hours: { type: "number", minimum: 0.1, maximum: 24, description: "Hours worked (decimal)" },
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
            billable: { type: "boolean", description: "Whether the time is billable (default: true)" },
            description: { type: "string", description: "Work description (optional)" },
          },
          required: ["issueKey", "hours", "startDate"],
        },
      },
      {
        name: TOOL_NAMES.BULK_POST_WORKLOGS,
        description: getToolDescription(TOOL_NAMES.BULK_POST_WORKLOGS),
        inputSchema: {
          type: "object",
          properties: {
            worklogs: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  issueKey: { type: "string", description: "JIRA issue key (e.g., PROJ-1234)" },
                  hours: { type: "number", minimum: 0.1, maximum: 24, description: "Hours worked (decimal)" },
                  date: {
                    type: "string",
                    pattern: "^\\d{4}-\\d{2}-\\d{2}$",
                    description: "Date in YYYY-MM-DD format",
                  },
                  description: { type: "string", description: "Work description (optional)" },
                },
                required: ["issueKey", "hours", "date"],
              },
              description: "Array of worklog entries to create",
            },
            billable: { type: "boolean", description: "Whether the time is billable for all entries (default: true)" },
          },
          required: ["worklogs"],
        },
      },
      {
        name: TOOL_NAMES.DELETE_WORKLOG,
        description: getToolDescription(TOOL_NAMES.DELETE_WORKLOG),
        inputSchema: {
          type: "object",
          properties: {
            worklogId: { type: "string", description: "Tempo worklog ID to delete" },
          },
          required: ["worklogId"],
        },
      },
      {
        name: TOOL_NAMES.UPDATE_WORKLOG,
        description: getToolDescription(TOOL_NAMES.UPDATE_WORKLOG),
        inputSchema: {
          type: "object",
          properties: {
            worklogId: { type: "string", description: "Tempo worklog ID to update" },
            issueKey: { type: "string", description: "JIRA issue key (e.g., PROJ-1234)" },
            hours: { type: "number", minimum: 0.1, maximum: 24, description: "Hours worked (decimal)" },
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
            billable: { type: "boolean", description: "Whether the time is billable (default: true)" },
            description: { type: "string", description: "Work description (optional)" },
          },
          required: ["worklogId", "issueKey", "hours", "startDate"],
        },
      },
      {
        name: TOOL_NAMES.BULK_DELETE_WORKLOGS,
        description: getToolDescription(TOOL_NAMES.BULK_DELETE_WORKLOGS),
        inputSchema: {
          type: "object",
          properties: {
            worklogIds: {
              type: "array",
              items: { type: "string" },
              minItems: 1,
              maxItems: 100,
              description: "Array of Tempo worklog IDs to delete",
            },
          },
          required: ["worklogIds"],
        },
      },
      {
        name: TOOL_NAMES.BULK_UPDATE_WORKLOGS,
        description: getToolDescription(TOOL_NAMES.BULK_UPDATE_WORKLOGS),
        inputSchema: {
          type: "object",
          properties: {
            worklogs: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  worklogId: { type: "string", description: "Tempo worklog ID to update" },
                  issueKey: { type: "string", description: "JIRA issue key (e.g., PROJ-1234)" },
                  hours: { type: "number", minimum: 0.1, maximum: 24, description: "Hours worked (decimal)" },
                  date: {
                    type: "string",
                    pattern: "^\\d{4}-\\d{2}-\\d{2}$",
                    description: "Date in YYYY-MM-DD format",
                  },
                  description: { type: "string", description: "Work description (optional)" },
                },
                required: ["worklogId", "issueKey", "hours", "date"],
              },
              description: "Array of worklog entries to update",
            },
            billable: { type: "boolean", description: "Whether the time is billable for all entries (default: true)" },
          },
          required: ["worklogs"],
        },
      },
      {
        name: TOOL_NAMES.GET_SCHEDULE,
        description: getToolDescription(TOOL_NAMES.GET_SCHEDULE),
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
        _meta: uiAssets.getScheduleHtml
          ? { ui: { resourceUri: "ui://tempofiller/get-schedule.html" } }
          : undefined,
      },
    ],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    switch (name) {
      case TOOL_NAMES.GET_WORKLOGS:
        return getWorklogs(tempoClient, GetWorklogsInputSchema.parse(args), uiAssets.getWorklogsHtml);
      case TOOL_NAMES.POST_WORKLOG:
        return postWorklog(tempoClient, PostWorklogInputSchema.parse(args));
      case TOOL_NAMES.BULK_POST_WORKLOGS:
        return bulkPostWorklogs(tempoClient, BulkPostWorklogsInputSchema.parse(args));
      case TOOL_NAMES.DELETE_WORKLOG:
        return deleteWorklog(tempoClient, DeleteWorklogInputSchema.parse(args));
      case TOOL_NAMES.UPDATE_WORKLOG:
        return updateWorklog(tempoClient, UpdateWorklogInputSchema.parse(args));
      case TOOL_NAMES.BULK_DELETE_WORKLOGS:
        return bulkDeleteWorklogs(tempoClient, BulkDeleteWorklogsInputSchema.parse(args));
      case TOOL_NAMES.BULK_UPDATE_WORKLOGS:
        return bulkUpdateWorklogs(tempoClient, BulkUpdateWorklogsInputSchema.parse(args));
      case TOOL_NAMES.GET_SCHEDULE:
        return getSchedule(tempoClient, GetScheduleInputSchema.parse(args), uiAssets.getScheduleHtml);
      default: {
        const _exhaustive: never = name as never;
        void _exhaustive;
        return { content: [{ type: "text" as const, text: `Unknown tool: ${name}` }], isError: true };
      }
    }
  });

  server.setRequestHandler(ListResourcesRequestSchema, async () => ({ resources: [] }));
  server.setRequestHandler(ReadResourceRequestSchema, async () => ({ contents: [] }));
  server.setRequestHandler(ListPromptsRequestSchema, async () => ({ prompts: [] }));
  server.setRequestHandler(GetPromptRequestSchema, async () => ({ messages: [] }));
}
