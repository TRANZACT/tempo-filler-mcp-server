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
  worklogs: z.array(BulkWorklogEntrySchema).min(1, "At least one worklog entry is required"),
  billable: z.boolean().optional(),
});

// Delete worklog tool input schema
export const DeleteWorklogInputSchema = z.object({
  worklogId: z.string().min(1, "Worklog ID is required"),
});

// Get schedule tool input schema
export const GetScheduleInputSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Start date must be in YYYY-MM-DD format"),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "End date must be in YYYY-MM-DD format").optional(),
});

// Worklog summary prompt arguments schema
export const WorklogSummaryArgsSchema = z.object({
  username: z.string().min(1, "Username is required"),
  month: z.string().regex(/^\d{4}-\d{2}$/, "Month must be in YYYY-MM format"),
  includeAnalysis: z.boolean().optional(),
});

// Bulk entry helper prompt arguments schema
export const BulkEntryHelperArgsSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Start date must be in YYYY-MM-DD format"),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "End date must be in YYYY-MM-DD format"),
  projectKeys: z.array(z.string()).optional(),
  defaultHours: z.number().min(1).max(24).optional(),
});

// Type definitions derived from schemas
export type GetWorklogsInput = z.infer<typeof GetWorklogsInputSchema>;
export type PostWorklogInput = z.infer<typeof PostWorklogInputSchema>;
export type BulkWorklogEntry = z.infer<typeof BulkWorklogEntrySchema>;
export type BulkPostWorklogsInput = z.infer<typeof BulkPostWorklogsInputSchema>;
export type DeleteWorklogInput = z.infer<typeof DeleteWorklogInputSchema>;
export type GetScheduleInput = z.infer<typeof GetScheduleInputSchema>;
export type WorklogSummaryArgs = z.infer<typeof WorklogSummaryArgsSchema>;
export type BulkEntryHelperArgs = z.infer<typeof BulkEntryHelperArgsSchema>;

// Resource URI patterns
export const RESOURCE_PATTERNS = {
  USER_WORKLOGS: /^tempo:\/\/user\/([^\/]+)\/worklogs\/(\d{4}-\d{2})$/,
  RECENT_ISSUES: /^tempo:\/\/issues\/recent$/,
} as const;

// Tool names as constants
export const TOOL_NAMES = {
  GET_WORKLOGS: "get_worklogs",
  POST_WORKLOG: "post_worklog",
  BULK_POST_WORKLOGS: "bulk_post_worklogs",
  DELETE_WORKLOG: "delete_worklog",
  GET_SCHEDULE: "get_schedule",
} as const;

// Prompt names as constants
export const PROMPT_NAMES = {
  WORKLOG_SUMMARY: "worklog_summary",
  BULK_ENTRY_HELPER: "bulk_entry_helper",
} as const;

// Resource names as constants
export const RESOURCE_NAMES = {
  USER_WORKLOGS: "user_worklogs",
  RECENT_ISSUES: "recent_issues",
} as const;

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
} as const;