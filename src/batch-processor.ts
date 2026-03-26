import type {
  IssueResolver,
  WorklogReader,
  WorklogWriter,
  UserResolver,
  BulkWorklogEntry,
} from "./types/index.js";
import type { BatchReport, BatchEntryResult, BatchConfig } from "./types/batch.js";
import { DEFAULT_BATCH_CONFIG } from "./types/batch.js";
import { TempoRateLimitError, TempoTimeoutError } from "./errors.js";

type BatchDependencies = IssueResolver & WorklogReader & WorklogWriter & UserResolver;

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
  const pending: Array<{ entry: BulkWorklogEntry; index: number }> = [];

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
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
    pending.push({ entry, index: i });
  }

  const chunks: Array<typeof pending> = [];
  for (let i = 0; i < pending.length; i += config.concurrencyLimit) {
    chunks.push(pending.slice(i, i + config.concurrencyLimit));
  }

  for (let ci = 0; ci < chunks.length; ci++) {
    if (ci > 0) await delay(config.interBatchDelayMs);
    const chunk = chunks[ci];
    const chunkResults = await Promise.allSettled(
      chunk.map(({ entry }) =>
        retryable(async () => {
          const payload = await client.createWorklogPayload({
            issueKey: entry.issueKey,
            hours: entry.hours,
            startDate: entry.date,
            endDate: entry.date,
            billable,
            description: entry.description,
          });
          return client.createWorklog(payload);
        }, config.maxRetries, config.baseDelayMs)
      )
    );

    for (let j = 0; j < chunk.length; j++) {
      const { entry } = chunk[j];
      const settled = chunkResults[j];
      if (settled.status === "fulfilled") {
        const wl = settled.value;
        results.push({
          date: entry.date,
          issueKey: entry.issueKey,
          hours: entry.hours,
          status: "succeeded",
          worklogId: String(wl.tempoWorklogId ?? wl.id ?? "unknown"),
        });
      } else {
        results.push({
          date: entry.date,
          issueKey: entry.issueKey,
          hours: entry.hours,
          status: "failed",
          error: settled.reason instanceof Error ? settled.reason.message : String(settled.reason),
        });
      }
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
