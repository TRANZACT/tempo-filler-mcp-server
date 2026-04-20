import type {
  IssueResolver,
  WorklogReader,
  WorklogWriter,
  WorklogDeleter,
  WorklogUpdater,
  UserResolver,
  BulkWorklogEntry,
  BulkUpdateWorklogEntry,
} from "./types/index.js";
import type {
  BatchReport,
  BatchEntryResult,
  BatchConfig,
  BatchResult,
  DeleteBatchReport,
  DeleteEntryResult,
  UpdateBatchReport,
  UpdateEntryResult,
} from "./types/batch.js";
import { DEFAULT_BATCH_CONFIG } from "./types/batch.js";
import { TempoRateLimitError, TempoTimeoutError } from "./errors.js";

type BatchDependencies = IssueResolver & WorklogReader & WorklogWriter & UserResolver;
type UpdateDependencies = WorklogUpdater & IssueResolver & UserResolver;

function buildFingerprint(date: string, issueKey: string, seconds: number, comment: string): string {
  return `${date}|${issueKey}|${seconds}|${comment.trim().toLowerCase()}`;
}

async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function retryable<T>(
  fn: () => Promise<T>,
  maxRetries: number,
  baseDelayMs: number
): Promise<T> {
  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (error) {
      attempt++;
      const isRetryable = error instanceof TempoRateLimitError || error instanceof TempoTimeoutError;
      if (!isRetryable || attempt >= maxRetries) throw error;
      const waitMs = error instanceof TempoRateLimitError
        ? error.retryAfterSeconds * 1000
        : baseDelayMs * Math.pow(2, attempt - 1);
      await delay(waitMs);
    }
  }
}

/**
 * Generic chunked batch executor. Splits `items` into chunks of `config.concurrencyLimit`,
 * runs each chunk concurrently via `Promise.allSettled`, with each item wrapped in `retryable`.
 * Pauses `config.interBatchDelayMs` between chunks.
 *
 * Strategy Pattern: the `operation` function varies (create/update/delete) while the
 * chunking/retry algorithm stays fixed. This is the single authoritative implementation
 * of batch execution used by all bulk tools.
 */
export async function executeChunked<T>(
  items: readonly T[],
  operation: (item: T) => Promise<void>,
  config: BatchConfig = DEFAULT_BATCH_CONFIG
): Promise<BatchResult<void>[]> {
  const results: BatchResult<void>[] = [];
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += config.concurrencyLimit) {
    chunks.push(items.slice(i, i + config.concurrencyLimit) as T[]);
  }

  for (let ci = 0; ci < chunks.length; ci++) {
    if (ci > 0) await delay(config.interBatchDelayMs);
    const chunk = chunks[ci];
    const settled = await Promise.allSettled(
      chunk.map((item) =>
        retryable(() => operation(item), config.maxRetries, config.baseDelayMs)
      )
    );
    for (const result of settled) {
      if (result.status === "fulfilled") {
        results.push({ ok: true, value: undefined });
      } else {
        results.push({
          ok: false,
          error: result.reason instanceof Error ? result.reason.message : String(result.reason),
          cause: result.reason,
        });
      }
    }
  }

  return results;
}

/**
 * Processes a batch of worklog entries through a 4-phase pipeline:
 *
 * 1. **Issue resolution** — resolves all unique issue keys in parallel; entries whose
 *    key cannot be resolved are immediately marked as failed.
 * 2. **Pre-flight deduplication** — fetches existing worklogs for the date range and
 *    builds fingerprints (`date|issueKey|seconds|comment`); entries matching an
 *    existing fingerprint are skipped rather than posted.
 * 3. **Chunked execution** — delegates to `executeChunked` for concurrent posting with retry.
 * 4. **Report assembly** — aggregates per-entry results into a {@link BatchReport}.
 */
export async function processWorklogBatch(
  client: BatchDependencies,
  entries: readonly BulkWorklogEntry[],
  options?: { billable?: boolean },
  config: BatchConfig = DEFAULT_BATCH_CONFIG
): Promise<BatchReport> {
  const billable = options?.billable ?? true;

  // Phase 1: Resolve unique issue keys
  const uniqueKeys = [...new Set(entries.map((e) => e.issueKey))];
  const issueResults = new Map<string, { ok: boolean; id: string; summary: string; error?: string }>();
  await Promise.all(
    uniqueKeys.map(async (key) => {
      try {
        const issue = await client.getIssueById(key);
        issueResults.set(key, { ok: true, id: issue.id, summary: issue.fields.summary });
      } catch (error) {
        issueResults.set(key, {
          ok: false,
          id: "",
          summary: "",
          error: error instanceof Error ? error.message : String(error),
        });
      }
    })
  );

  // Phase 2: Pre-flight deduplication
  const fingerprints = new Set<string>();
  try {
    const dates = entries.map((e) => e.date).sort();
    const existing = await client.getWorklogs({ from: dates[0], to: dates[dates.length - 1] });
    for (const wl of existing) {
      const date = wl.started.split(/[T\s]/)[0];
      const fp = buildFingerprint(date, wl.issue.key, wl.timeSpentSeconds, wl.comment ?? "");
      fingerprints.add(fp);
    }
  } catch {
    console.error("Warning: pre-flight dedup failed, proceeding without deduplication");
  }

  // Phase 3: Chunked execution
  const results: BatchEntryResult[] = [];
  const pending: BulkWorklogEntry[] = [];

  for (const entry of entries) {
    const issueResult = issueResults.get(entry.issueKey);
    if (!issueResult?.ok) {
      results.push({
        date: entry.date,
        issueKey: entry.issueKey,
        hours: entry.hours,
        status: "failed",
        error: issueResult?.error ?? "Issue resolution failed",
      });
      continue;
    }
    const seconds = Math.round(entry.hours * 3600);
    const fp = buildFingerprint(entry.date, entry.issueKey, seconds, entry.description ?? "");
    if (fingerprints.has(fp)) {
      results.push({ date: entry.date, issueKey: entry.issueKey, hours: entry.hours, status: "skipped", skipReason: "Duplicate worklog detected" });
      continue;
    }
    pending.push(entry);
  }

  const createdWorklogs = new Map<BulkWorklogEntry, string>();
  const chunkResults = await executeChunked(
    pending,
    async (entry) => {
      const payload = await client.createWorklogPayload({
        issueKey: entry.issueKey,
        hours: entry.hours,
        startDate: entry.date,
        endDate: entry.date,
        billable,
        description: entry.description,
      });
      const wl = await client.createWorklog(payload);
      createdWorklogs.set(entry, String(wl.tempoWorklogId ?? wl.id ?? "unknown"));
    },
    config
  );

  for (let i = 0; i < pending.length; i++) {
    const entry = pending[i];
    const result = chunkResults[i];
    if (result.ok) {
      results.push({
        date: entry.date,
        issueKey: entry.issueKey,
        hours: entry.hours,
        status: "succeeded",
        worklogId: createdWorklogs.get(entry),
      });
    } else {
      results.push({
        date: entry.date,
        issueKey: entry.issueKey,
        hours: entry.hours,
        status: "failed",
        error: result.error,
      });
    }
  }

  // Phase 4: Report assembly
  const succeeded = results.filter((r) => r.status === "succeeded");
  const failed = results.filter((r) => r.status === "failed");
  const skipped = results.filter((r) => r.status === "skipped");
  const totalHours = succeeded.reduce((sum, r) => sum + r.hours, 0);

  return {
    entries: results,
    summary: {
      total: entries.length,
      succeeded: succeeded.length,
      failed: failed.length,
      skipped: skipped.length,
      totalHours: Math.round(totalHours * 100) / 100,
    },
  };
}

/**
 * Deletes a batch of worklogs by ID.
 * Deduplicates IDs before processing. Uses `executeChunked` for concurrent deletion with retry.
 * Depends only on `WorklogDeleter` (ISP).
 */
export async function processDeleteBatch(
  client: WorklogDeleter,
  worklogIds: readonly string[],
  config: BatchConfig = DEFAULT_BATCH_CONFIG
): Promise<DeleteBatchReport> {
  const uniqueIds = [...new Set(worklogIds)];
  const chunkResults = await executeChunked(
    uniqueIds,
    (id) => client.deleteWorklog(id),
    config
  );

  const entries: DeleteEntryResult[] = uniqueIds.map((worklogId, i) => {
    const result = chunkResults[i];
    return result.ok
      ? { worklogId, status: "succeeded" as const }
      : { worklogId, status: "failed" as const, error: result.error };
  });

  const succeeded = entries.filter((e) => e.status === "succeeded").length;
  return {
    entries,
    summary: { total: uniqueIds.length, succeeded, failed: uniqueIds.length - succeeded },
  };
}

/**
 * Updates a batch of worklogs.
 * Phase 1: resolves all unique issue keys in parallel.
 * Phase 2: delegates to `executeChunked` for concurrent updates with retry.
 * Depends on `WorklogUpdater & IssueResolver & UserResolver` (ISP).
 */
export async function processUpdateBatch(
  client: UpdateDependencies,
  entries: readonly BulkUpdateWorklogEntry[],
  options?: { billable?: boolean },
  config: BatchConfig = DEFAULT_BATCH_CONFIG
): Promise<UpdateBatchReport> {
  const billable = options?.billable ?? true;

  // Phase 1: Resolve unique issue keys
  const uniqueKeys = [...new Set(entries.map((e) => e.issueKey))];
  const issueResults = new Map<string, { ok: boolean; error?: string }>();
  await Promise.all(
    uniqueKeys.map(async (key) => {
      try {
        await client.getIssueById(key);
        issueResults.set(key, { ok: true });
      } catch (error) {
        issueResults.set(key, {
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    })
  );

  const valid: BulkUpdateWorklogEntry[] = [];
  const resultMap = new Map<BulkUpdateWorklogEntry, UpdateEntryResult>();

  for (const entry of entries) {
    const issueResult = issueResults.get(entry.issueKey);
    if (!issueResult?.ok) {
      resultMap.set(entry, {
        worklogId: entry.worklogId,
        date: entry.date,
        issueKey: entry.issueKey,
        hours: entry.hours,
        status: "failed",
        error: issueResult?.error ?? "Issue resolution failed",
      });
    } else {
      valid.push(entry);
    }
  }

  // Phase 2: Chunked execution
  const chunkResults = await executeChunked(
    valid,
    async (entry) => {
      const payload = await client.createWorklogPayload({
        issueKey: entry.issueKey,
        hours: entry.hours,
        startDate: entry.date,
        endDate: entry.date,
        billable,
        description: entry.description,
      });
      await client.updateWorklog(entry.worklogId, payload);
    },
    config
  );

  for (let i = 0; i < valid.length; i++) {
    const entry = valid[i];
    const result = chunkResults[i];
    resultMap.set(entry, {
      worklogId: entry.worklogId,
      date: entry.date,
      issueKey: entry.issueKey,
      hours: entry.hours,
      status: result.ok ? "succeeded" : "failed",
      ...(result.ok ? {} : { error: result.error }),
    });
  }

  const allResults = entries.map((e) => resultMap.get(e)!);
  const succeeded = allResults.filter((r) => r.status === "succeeded").length;

  return {
    entries: allResults,
    summary: { total: entries.length, succeeded, failed: entries.length - succeeded },
  };
}
