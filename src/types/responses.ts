// JSON response types for MCP tools
// Per specs/json-tool-responses.md

// ============================================================================
// get_schedule Response Types
// ============================================================================

export interface ScheduleDayResponse {
  date: string;                // "2026-01-01" (ISO 8601)
  dayOfWeek: string;           // "Monday"
  requiredHours: number;       // 8 or 0
  isWorkingDay: boolean;
}

export interface ScheduleSummaryResponse {
  totalDays: number;
  workingDays: number;
  nonWorkingDays: number;
  totalRequiredHours: number;
  averageDailyHours: number;
}

export interface GetScheduleJsonResponse {
  startDate: string;           // "2026-01-01"
  endDate: string;             // "2026-01-31"
  days: ScheduleDayResponse[];
  summary: ScheduleSummaryResponse;
}

// ============================================================================
// get_worklogs Response Types
// ============================================================================

export interface WorklogResponse {
  id: string;
  issueKey: string;
  issueSummary: string;
  date: string;                // "2026-01-02" (ISO 8601)
  hours: number;               // decimal
  comment: string;
}

export interface IssueAggregateResponse {
  issueKey: string;
  issueSummary: string;
  totalHours: number;
  entryCount: number;
}

export interface WorklogSummaryResponse {
  totalHours: number;
  totalEntries: number;
  uniqueIssues: number;
}

export interface GetWorklogsJsonResponse {
  startDate: string;
  endDate: string;
  issueFilter?: string;        // If filtered by issue
  worklogs: WorklogResponse[];
  byIssue: IssueAggregateResponse[];
  summary: WorklogSummaryResponse;
  schedule: ScheduleDayResponse[];  // For coverage-aware UI coloring
}

// ============================================================================
// post_worklog Response Types
// ============================================================================

export interface PostWorklogJsonResponse {
  success: true;
  worklog: {
    id: string;
    issueKey: string;
    issueSummary: string;
    date: string;
    hours: number;
    comment: string;
  };
}

// ============================================================================
// bulk_post_worklogs Response Types
// ============================================================================

export interface BulkWorklogResultResponse {
  date: string;
  issueKey: string;
  hours: number;
  status: "succeeded" | "failed" | "skipped";
  worklogId?: string;          // Present if succeeded
  error?: string;              // Present if failed
  skipReason?: string;         // Present if skipped
}

export interface BulkPostSummaryResponse {
  total: number;
  succeeded: number;
  failed: number;
  skipped: number;
  totalHours: number;
}

export interface BulkPostWorklogsJsonResponse {
  results: BulkWorklogResultResponse[];
  summary: BulkPostSummaryResponse;
}

// ============================================================================
// delete_worklog Response Types
// ============================================================================

export interface DeleteWorklogJsonResponse {
  success: true;
  deletedWorklogId: string;
}

// ============================================================================
// update_worklog Response Types
// ============================================================================

export interface UpdateWorklogJsonResponse {
  success: true;
  worklog: {
    id: string;
    issueKey: string;
    issueSummary: string;
    date: string;
    hours: number;
    comment: string;
  };
}

// ============================================================================
// bulk_delete_worklogs Response Types
// ============================================================================

export interface BulkDeleteWorklogsJsonResponse {
  results: Array<{ worklogId: string; status: "succeeded" | "failed"; error?: string }>;
  summary: { total: number; succeeded: number; failed: number };
}

// ============================================================================
// bulk_update_worklogs Response Types
// ============================================================================

export interface BulkUpdateWorklogsJsonResponse {
  results: Array<{ worklogId: string; date: string; issueKey: string; hours: number; status: "succeeded" | "failed"; error?: string }>;
  summary: { total: number; succeeded: number; failed: number };
}
