export type BatchResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string; cause?: unknown };

export interface BatchConfig {
  concurrencyLimit: number;
  maxRetries: number;
  baseDelayMs: number;
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
