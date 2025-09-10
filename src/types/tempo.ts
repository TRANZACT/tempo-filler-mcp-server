// Tempo API type definitions based on actual API responses and C# notebook analysis

// JIRA Issue response structure
export interface JiraIssue {
  id: string;           // Numerical ID (as string)
  key: string;          // Issue key (e.g., "PROJ-1234")
  fields: {
    summary: string;
    project?: {
      key: string;
      name: string;
    };
    assignee?: {
      displayName: string;
      accountId: string;
    };
    status?: {
      name: string;
    };
    // Additional fields as needed
  };
}

// Tempo API response structure (actual from API)
export interface TempoWorklogResponse {
  id?: string;                    // Worklog ID (legacy)
  tempoWorklogId?: number;        // New Tempo worklog ID
  billableSeconds: number;        // Time in seconds (e.g., 14400 for 4 hours)
  timeSpentSeconds: number;       // Total time spent in seconds
  timeSpent: string;             // Human readable (e.g., "4h", "1d")
  comment?: string;              // Worklog comment
  location?: {                   // Location information
    name: string;
    id: number;
  };
  attributes: Record<string, any>; // Custom attributes
  issue: {
    id: number;                  // Numerical issue ID
    key: string;                 // Issue key (e.g., "PROJ-1234")
    summary: string;             // Issue title/description
    internalIssue: boolean;
    issueStatus: string;
    reporterKey: string;
    estimatedRemainingSeconds: number;
    components: any[];
    issueType: string;
    projectId: number;
    projectKey: string;
    iconUrl: string;
    versions: any[];
  };
  originId: number;              // Origin ID
  worker: string;                // Worker username
  updater: string;               // Updater username
  started: string;               // ISO datetime string (e.g., "2025-07-02 00:00:00.000")
  originTaskId: number;          // Original task ID
  dateCreated: string;           // Creation timestamp
  dateUpdated: string;           // Update timestamp
  remainingEstimate?: number;     // Remaining time estimate
  endDate?: string;              // End date for multi-day entries
}

// Processed worklog structure for MCP responses
export interface TempoWorklog {
  id: string;
  issueKey: string;
  issueSummary: string;
  timeSpentSeconds: number;
  billableSeconds: number;
  started: string;
  worker: string;
  attributes: Record<string, any>;
  timeSpent: string;        // Human readable format from API
  comment?: string;         // Worklog description/comment
}

// Tempo worklog creation payload
export interface TempoWorklogCreatePayload {
  attributes: Record<string, any>;
  billableSeconds: number;
  timeSpentSeconds: number;
  worker: string;               // Required - worker username or account ID
  started: string;              // Format: "YYYY-MM-DDTHH:mm:ss.SSS"
  originTaskId: string;         // Numerical JIRA issue ID
  remainingEstimate?: number | null;
  endDate: string;              // Format: "YYYY-MM-DDTHH:mm:ss.SSS"
  comment?: string;             // Worklog description/comment
}

// Error response from Tempo API
export interface TempoApiError {
  error?: string;
  message?: string;
  status?: number;
  timestamp?: string;
  path?: string;
}

// Get worklogs request parameters
export interface GetWorklogsParams {
  user: string;
  startDate: string;      // ISO date (YYYY-MM-DD)
  endDate?: string;       // ISO date, defaults to startDate
  issueKey?: string;      // Optional filter by specific issue
}

// Get worklogs response
export interface GetWorklogsResponse {
  worklogs: TempoWorklog[];
  totalHours: number;
}

// Post worklog request parameters
export interface PostWorklogParams {
  issueKey: string;       // e.g., "PROJ-1234" (will be resolved to numerical ID)
  hours: number;          // Hours worked (decimal)
  startDate: string;      // ISO date (YYYY-MM-DD)
  endDate?: string;       // ISO date, defaults to startDate
  worker?: string;        // Defaults to authenticated user
  billable?: boolean;     // Defaults to true
  description?: string;   // Work description
}

// Bulk post worklogs request parameters
export interface BulkPostWorklogsParams {
  worklogs: Array<{
    issueKey: string;       // e.g., "PROJ-1234"
    hours: number;          // Hours worked (decimal)
    date: string;           // ISO date (YYYY-MM-DD)
    description?: string;   // Optional work description
  }>;
  worker?: string;        // Defaults to authenticated user
  billable?: boolean;     // Defaults to true (applies to all entries)
}

// Bulk post worklogs response
export interface BulkPostWorklogsResponse {
  results: Array<{
    success: boolean;
    worklog?: TempoWorklog;
    error?: string;
    issueKey: string;
    date: string;
    hours: number;
  }>;
  summary: {
    totalEntries: number;
    successful: number;
    failed: number;
    totalHours: number;
  };
  dailyTotals: Record<string, Record<string, number>>; // date -> issueKey -> hours
}

// Delete worklog request parameters
export interface DeleteWorklogParams {
  worklogId: string;      // Tempo worklog ID
}

// Configuration for Tempo client
export interface TempoClientConfig {
  baseUrl: string;        // JIRA instance URL
  personalAccessToken: string; // PAT for authentication
  defaultHours?: number;  // Default hours per workday (8)
  timeout?: number;       // Request timeout in milliseconds
}

// Issue cache entry for performance optimization
export interface IssueCache {
  [issueKey: string]: {
    id: string;
    summary: string;
    cached: Date;
  };
}

// Recent issues for resource provider
export interface RecentIssue {
  key: string;
  summary: string;
  lastUsed: string;       // ISO datetime
  project?: string;
}