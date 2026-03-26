export type BatchResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string; cause?: unknown };

export interface BatchConfig {
  /** Maximum number of worklog POSTs to issue in parallel within one chunk. Default: 5. */
  concurrencyLimit: number;
  /** How many times to retry a single entry on rate-limit or timeout errors. Default: 3. */
  maxRetries: number;
  /** Base delay (ms) for exponential back-off between retries. Default: 1000. */
  baseDelayMs: number;
  /** Fixed pause (ms) between consecutive chunks to avoid bursting the API. Default: 500. */
  interBatchDelayMs: number;
}

export const DEFAULT_BATCH_CONFIG: BatchConfig = {
  concurrencyLimit: 5,
  maxRetries: 3,
  baseDelayMs: 1000,
  interBatchDelayMs: 500,
};

export type BatchEntryStatus = "succeeded" | "failed" | "skipped";

export interface BatchEntryResult {
  date: string;
  issueKey: string;
  hours: number;
  status: BatchEntryStatus;
  worklogId?: string;
  error?: string;
  skipReason?: string;
}

export interface BatchSummary {
  total: number;
  succeeded: number;
  failed: number;
  skipped: number;
  totalHours: number;
}

export interface BatchReport {
  entries: BatchEntryResult[];
  summary: BatchSummary;
}

export interface DeleteEntryResult {
  worklogId: string;
  status: "succeeded" | "failed";
  error?: string;
}

export interface DeleteBatchReport {
  entries: DeleteEntryResult[];
  summary: { total: number; succeeded: number; failed: number };
}

export interface UpdateEntryResult {
  worklogId: string;
  date: string;
  issueKey: string;
  hours: number;
  status: "succeeded" | "failed";
  error?: string;
}

export interface UpdateBatchReport {
  entries: UpdateEntryResult[];
  summary: { total: number; succeeded: number; failed: number };
}
