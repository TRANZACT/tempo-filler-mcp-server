// MCP-specific type definitions for Tempo Filler server

import { z } from "zod";

// Zod schemas for input validation

// Get worklogs tool input schema
export const GetWorklogsInputSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Start date must be in YYYY-MM-DD format"),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "End date must be in YYYY-MM-DD format").optional(),
  issueKey: z.string().optional(),
});

// Post worklog tool input schema
export const PostWorklogInputSchema = z.object({
  issueKey: z.string().min(1, "Issue key is required"),
  hours: z.number().min(0.1, "Hours must be at least 0.1").max(24, "Hours cannot exceed 24"),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Start date must be in YYYY-MM-DD format"),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "End date must be in YYYY-MM-DD format").optional(),
  billable: z.boolean().optional(),
  description: z.string().optional(),
});

// Bulk worklog entry schema
export const BulkWorklogEntrySchema = z.object({
  issueKey: z.string().min(1, "Issue key is required"),
  hours: z.number().min(0.1, "Hours must be at least 0.1").max(24, "Hours cannot exceed 24"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"),
  description: z.string().optional(),
});

// Bulk post worklogs tool input schema
export const BulkPostWorklogsInputSchema = z.object({
  worklogs: z.array(BulkWorklogEntrySchema).min(1, "At least one worklog entry is required").max(100, "Maximum 100 entries per bulk operation"),
  billable: z.boolean().optional(),
});

// Delete worklog tool input schema
export const DeleteWorklogInputSchema = z.object({
  worklogId: z.string().min(1, "Worklog ID is required"),
});

// Update worklog tool input schema
export const UpdateWorklogInputSchema = z.object({
  worklogId: z.string().min(1, "Worklog ID is required"),
  issueKey: z.string().min(1, "Issue key is required"),
  hours: z.number().min(0.1, "Hours must be at least 0.1").max(24, "Hours cannot exceed 24"),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Start date must be in YYYY-MM-DD format"),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "End date must be in YYYY-MM-DD format").optional(),
  billable: z.boolean().optional(),
  description: z.string().optional(),
});

// Bulk delete worklogs tool input schema
export const BulkDeleteWorklogsInputSchema = z.object({
  worklogIds: z.array(z.string().min(1)).min(1, "At least one worklog ID is required").max(100, "Maximum 100 IDs per bulk operation"),
});

// Bulk update worklog entry schema
export const BulkUpdateWorklogEntrySchema = z.object({
  worklogId: z.string().min(1, "Worklog ID is required"),
  issueKey: z.string().min(1, "Issue key is required"),
  hours: z.number().min(0.1, "Hours must be at least 0.1").max(24, "Hours cannot exceed 24"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"),
  description: z.string().optional(),
});

// Bulk update worklogs tool input schema
export const BulkUpdateWorklogsInputSchema = z.object({
  worklogs: z.array(BulkUpdateWorklogEntrySchema).min(1, "At least one worklog entry is required").max(100, "Maximum 100 entries per bulk operation"),
  billable: z.boolean().optional(),
});

// Get schedule tool input schema
export const GetScheduleInputSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Start date must be in YYYY-MM-DD format"),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "End date must be in YYYY-MM-DD format").optional(),
});

// Type definitions derived from schemas
export type GetWorklogsInput = z.infer<typeof GetWorklogsInputSchema>;
export type PostWorklogInput = z.infer<typeof PostWorklogInputSchema>;
export type BulkWorklogEntry = z.infer<typeof BulkWorklogEntrySchema>;
export type BulkPostWorklogsInput = z.infer<typeof BulkPostWorklogsInputSchema>;
export type DeleteWorklogInput = z.infer<typeof DeleteWorklogInputSchema>;
export type UpdateWorklogInput = z.infer<typeof UpdateWorklogInputSchema>;
export type BulkDeleteWorklogsInput = z.infer<typeof BulkDeleteWorklogsInputSchema>;
export type BulkUpdateWorklogEntry = z.infer<typeof BulkUpdateWorklogEntrySchema>;
export type BulkUpdateWorklogsInput = z.infer<typeof BulkUpdateWorklogsInputSchema>;
export type GetScheduleInput = z.infer<typeof GetScheduleInputSchema>;

// Tool names as constants
export const TOOL_NAMES = {
  GET_WORKLOGS: "get_worklogs",
  POST_WORKLOG: "post_worklog",
  BULK_POST_WORKLOGS: "bulk_post_worklogs",
  DELETE_WORKLOG: "delete_worklog",
  UPDATE_WORKLOG: "update_worklog",
  BULK_DELETE_WORKLOGS: "bulk_delete_worklogs",
  BULK_UPDATE_WORKLOGS: "bulk_update_worklogs",
  GET_SCHEDULE: "get_schedule",
} as const;

// Single source of truth for tool metadata (name + description)
export const TOOL_REGISTRY: ReadonlyArray<{ name: string; description: string }> = [
  { name: TOOL_NAMES.GET_WORKLOGS, description: "Retrieve worklogs for authenticated user and date range" },
  { name: TOOL_NAMES.POST_WORKLOG, description: "Create a new worklog entry. For better results, consider using get_schedule first to verify working days and expected hours." },
  { name: TOOL_NAMES.BULK_POST_WORKLOGS, description: "Create multiple worklog entries from a structured format. RECOMMENDED: Use get_schedule first to identify working days." },
  { name: TOOL_NAMES.DELETE_WORKLOG, description: "Delete an existing worklog entry" },
  { name: TOOL_NAMES.UPDATE_WORKLOG, description: "Update an existing worklog entry (change hours, description, issue, or date)" },
  { name: TOOL_NAMES.BULK_DELETE_WORKLOGS, description: "Delete multiple worklog entries by their IDs. Use get_worklogs first to retrieve worklog IDs for a date range, then pass them here for efficient bulk deletion." },
  { name: TOOL_NAMES.BULK_UPDATE_WORKLOGS, description: "Update multiple existing worklog entries. Use get_worklogs first to retrieve current worklogs and their IDs." },
  { name: TOOL_NAMES.GET_SCHEDULE, description: "Retrieve work schedule for authenticated user and date range" },
] as const;

// Environment variable names
export const ENV_VARS = {
  TEMPO_BASE_URL: "TEMPO_BASE_URL",
  TEMPO_PAT: "TEMPO_PAT",
  TEMPO_DEFAULT_HOURS: "TEMPO_DEFAULT_HOURS",
} as const;

// Default configuration values
export const DEFAULTS = {
  HOURS_PER_DAY: 8,
  REQUEST_TIMEOUT: 30000, // 30 seconds
  ISSUE_CACHE_TTL: 300000, // 5 minutes
  MAX_BULK_ENTRIES: 100,
  MAX_CACHE_SIZE: 500,
  BATCH_CONCURRENCY: 5,
  BATCH_MAX_RETRIES: 3,
  BATCH_BASE_DELAY_MS: 1000,
  BATCH_INTER_DELAY_MS: 500,
} as const;
