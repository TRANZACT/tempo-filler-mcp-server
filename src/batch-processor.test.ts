import { describe, it, expect, vi } from "vitest";
import { processWorklogBatch, executeChunked, processDeleteBatch, processUpdateBatch } from "./batch-processor.js";
import {
  createMockIssueResolver,
  createMockWorklogReader,
  createMockWorklogWriter,
  createMockWorklogDeleter,
  createMockWorklogUpdater,
  createMockUserResolver,
} from "./__test-utils__/mock-client.js";
import { fakeWorklogResponse } from "./__test-utils__/fixtures.js";
import type { BulkWorklogEntry, BulkUpdateWorklogEntry } from "./types/index.js";
import { TempoRateLimitError, TempoTimeoutError, TempoNotFoundError } from "./errors.js";

function makeClient(overrides?: {
  issueResolver?: Partial<ReturnType<typeof createMockIssueResolver>>;
  worklogReader?: Partial<ReturnType<typeof createMockWorklogReader>>;
  worklogWriter?: Partial<ReturnType<typeof createMockWorklogWriter>>;
  userResolver?: Partial<ReturnType<typeof createMockUserResolver>>;
}) {
  return {
    ...createMockIssueResolver(overrides?.issueResolver),
    ...createMockWorklogReader(overrides?.worklogReader),
    ...createMockWorklogWriter(overrides?.worklogWriter),
    ...createMockUserResolver(overrides?.userResolver),
  };
}

const singleEntry: BulkWorklogEntry = {
  issueKey: "PROJ-1234",
  hours: 8,
  date: "2026-03-01",
};

describe("processWorklogBatch", () => {
  it("succeeds for a single entry", async () => {
    const client = makeClient();
    const report = await processWorklogBatch(client, [singleEntry]);
    expect(report.summary.total).toBe(1);
    expect(report.summary.succeeded).toBe(1);
    expect(report.summary.failed).toBe(0);
    expect(report.summary.skipped).toBe(0);
  });

  it("marks entry as failed when issue resolution fails", async () => {
    const client = makeClient({
      issueResolver: { getIssueById: async () => { throw new Error("Issue not found"); } },
    });
    const report = await processWorklogBatch(client, [singleEntry]);
    expect(report.summary.failed).toBe(1);
    expect(report.entries[0].status).toBe("failed");
  });

  it("skips duplicate entries based on fingerprint", async () => {
    const existingWorklog = {
      ...fakeWorklogResponse,
      started: "2026-03-01T00:00:00.000",
      timeSpentSeconds: 28800,
      issue: { ...fakeWorklogResponse.issue, key: "PROJ-1234" },
      comment: "",
    };
    const client = makeClient({
      worklogReader: { getWorklogs: async () => [existingWorklog] },
    });
    const report = await processWorklogBatch(client, [singleEntry]);
    expect(report.summary.skipped).toBe(1);
    expect(report.entries[0].status).toBe("skipped");
  });

  it("processes multiple entries in chunks", async () => {
    const entries: BulkWorklogEntry[] = Array.from({ length: 7 }, (_, i) => ({
      issueKey: "PROJ-1234",
      hours: 1,
      date: `2026-03-${String(i + 1).padStart(2, "0")}`,
    }));
    const client = makeClient();
    const report = await processWorklogBatch(client, entries, undefined, {
      concurrencyLimit: 3,
      maxRetries: 1,
      baseDelayMs: 0,
      interBatchDelayMs: 0,
    });
    expect(report.summary.total).toBe(7);
    expect(report.summary.succeeded).toBe(7);
  });

  it("returns correct totalHours", async () => {
    const entries: BulkWorklogEntry[] = [
      { issueKey: "PROJ-1", hours: 4, date: "2026-03-01" },
      { issueKey: "PROJ-2", hours: 3.5, date: "2026-03-02" },
    ];
    const client = makeClient();
    const report = await processWorklogBatch(client, entries);
    expect(report.summary.totalHours).toBe(7.5);
  });

  it("proceeds without dedup when getWorklogs throws", async () => {
    const client = makeClient({
      worklogReader: { getWorklogs: async () => { throw new Error("API error"); } },
    });
    const report = await processWorklogBatch(client, [singleEntry]);
    expect(report.summary.succeeded).toBe(1);
  });
});

describe("executeChunked", () => {
  const NO_DELAY_CONFIG = { concurrencyLimit: 3, maxRetries: 1, baseDelayMs: 0, interBatchDelayMs: 0 };

  it("returns ok:true for all items when all operations succeed", async () => {
    const items = ["a", "b", "c"];
    const results = await executeChunked(items, async () => {}, NO_DELAY_CONFIG);
    expect(results).toHaveLength(3);
    expect(results.every((r) => r.ok)).toBe(true);
  });

  it("returns mixed ok/error results on partial failure", async () => {
    const items = ["ok", "fail", "ok"];
    const results = await executeChunked(
      items,
      async (item) => {
        if (item === "fail") throw new Error("item failed");
      },
      NO_DELAY_CONFIG
    );
    expect(results[0].ok).toBe(true);
    expect(results[1].ok).toBe(false);
    expect(results[2].ok).toBe(true);
  });

  it("respects chunk size and processes 7 items in 3+3+1 batches", async () => {
    const callOrder: number[] = [];
    const items = [1, 2, 3, 4, 5, 6, 7];
    let batchStart = 0;
    const operation = vi.fn(async (item: number) => {
      callOrder.push(item);
    });

    const config = { concurrencyLimit: 3, maxRetries: 1, baseDelayMs: 0, interBatchDelayMs: 0 };
    const results = await executeChunked(items, operation, config);

    expect(results).toHaveLength(7);
    expect(operation).toHaveBeenCalledTimes(7);
    // Items 1-3 called before 4-6, 4-6 before 7
    const firstChunk = callOrder.slice(0, 3).sort((a, b) => a - b);
    const secondChunk = callOrder.slice(3, 6).sort((a, b) => a - b);
    const thirdChunk = callOrder.slice(6);
    expect(firstChunk).toEqual([1, 2, 3]);
    expect(secondChunk).toEqual([4, 5, 6]);
    expect(thirdChunk).toEqual([7]);
    void batchStart;
  });

  it("retries on TempoRateLimitError and succeeds on retry", async () => {
    let attempt = 0;
    const results = await executeChunked(
      ["x"],
      async () => {
        attempt++;
        if (attempt === 1) throw new TempoRateLimitError("0");
      },
      { concurrencyLimit: 1, maxRetries: 2, baseDelayMs: 0, interBatchDelayMs: 0 }
    );
    expect(results[0].ok).toBe(true);
    expect(attempt).toBe(2);
  });

  it("retries on TempoTimeoutError and succeeds on retry", async () => {
    let attempt = 0;
    const results = await executeChunked(
      ["x"],
      async () => {
        attempt++;
        if (attempt === 1) throw new TempoTimeoutError("http://example.com");
      },
      { concurrencyLimit: 1, maxRetries: 2, baseDelayMs: 0, interBatchDelayMs: 0 }
    );
    expect(results[0].ok).toBe(true);
    expect(attempt).toBe(2);
  });

  it("gives up after maxRetries exhausted", async () => {
    const results = await executeChunked(
      ["x"],
      async () => { throw new TempoRateLimitError("0"); },
      { concurrencyLimit: 1, maxRetries: 2, baseDelayMs: 0, interBatchDelayMs: 0 }
    );
    expect(results[0].ok).toBe(false);
  });

  it("returns empty results for empty input", async () => {
    const results = await executeChunked([], async () => {}, NO_DELAY_CONFIG);
    expect(results).toHaveLength(0);
  });

  it("trips circuit breaker after consecutiveFailureLimit consecutive full-chunk failures", async () => {
    const called: string[] = [];
    const items = ["a", "b", "c", "d", "e", "f"];

    const results = await executeChunked(
      items,
      async (item) => {
        called.push(item);
        throw new Error("API down");
      },
      { concurrencyLimit: 2, maxRetries: 1, baseDelayMs: 0, interBatchDelayMs: 0, consecutiveFailureLimit: 2 }
    );

    // Chunks: [a,b], [c,d], [e,f]. First 2 chunks fully fail → limit reached → [e,f] aborted
    expect(results).toHaveLength(6);
    expect(called).toEqual(expect.arrayContaining(["a", "b", "c", "d"]));
    expect(called).not.toContain("e");
    expect(called).not.toContain("f");
    expect(results[0].ok).toBe(false);
    expect(results[2].ok).toBe(false);
    const abortedE = results[4] as { ok: false; error: string };
    const abortedF = results[5] as { ok: false; error: string };
    expect(abortedE.error).toMatch(/Circuit breaker/);
    expect(abortedF.error).toMatch(/Circuit breaker/);
  });

  it("resets circuit breaker counter when a chunk has at least one success", async () => {
    // Chunks: ["fail","fail"], ["ok","fail"], ["fail","fail"]
    // Counter after chunk1=1, after chunk2=0 (reset by "ok"), after chunk3=1 → never reaches limit of 2
    const called: string[] = [];
    const items = ["fail", "fail", "ok", "fail", "fail", "fail"];

    const results = await executeChunked(
      items,
      async (item) => {
        called.push(item);
        if (item === "fail") throw new Error("fail");
      },
      { concurrencyLimit: 2, maxRetries: 1, baseDelayMs: 0, interBatchDelayMs: 0, consecutiveFailureLimit: 2 }
    );

    expect(called).toHaveLength(6);
    expect(results).toHaveLength(6);
    expect(results[2].ok).toBe(true);
  });

  it("result array length equals input length including circuit-breaker aborted items", async () => {
    const items = Array.from({ length: 10 }, (_, i) => String(i));

    const results = await executeChunked(
      items,
      async () => { throw new Error("API down"); },
      { concurrencyLimit: 3, maxRetries: 1, baseDelayMs: 0, interBatchDelayMs: 0, consecutiveFailureLimit: 1 }
    );

    // Chunk [0,1,2] fails → circuit trips → [3..9] aborted
    expect(results).toHaveLength(10);
    expect(results.every((r) => !r.ok)).toBe(true);
    const aborted = results.slice(3) as Array<{ ok: false; error: string }>;
    expect(aborted.every((r) => r.error.includes("Circuit breaker"))).toBe(true);
  });
});

describe("processDeleteBatch", () => {
  const NO_DELAY_CONFIG = { concurrencyLimit: 5, maxRetries: 1, baseDelayMs: 0, interBatchDelayMs: 0 };

  it("succeeds for a single ID", async () => {
    const client = createMockWorklogDeleter();
    const report = await processDeleteBatch(client, ["wl-1"], NO_DELAY_CONFIG);
    expect(report.summary.total).toBe(1);
    expect(report.summary.succeeded).toBe(1);
    expect(report.summary.failed).toBe(0);
    expect(report.entries[0].status).toBe("succeeded");
  });

  it("processes multiple IDs in chunks", async () => {
    const client = createMockWorklogDeleter();
    const ids = Array.from({ length: 8 }, (_, i) => `wl-${i + 1}`);
    const report = await processDeleteBatch(client, ids, { concurrencyLimit: 3, maxRetries: 1, baseDelayMs: 0, interBatchDelayMs: 0 });
    expect(report.summary.total).toBe(8);
    expect(report.summary.succeeded).toBe(8);
  });

  it("handles partial failure with correct summary counts", async () => {
    const client = createMockWorklogDeleter({
      deleteWorklog: async (id: string) => {
        if (id === "wl-2") throw new Error("Not found");
      },
    });
    const report = await processDeleteBatch(client, ["wl-1", "wl-2", "wl-3"], NO_DELAY_CONFIG);
    expect(report.summary.succeeded).toBe(2);
    expect(report.summary.failed).toBe(1);
    const failedEntry = report.entries.find((e) => e.worklogId === "wl-2");
    expect(failedEntry?.status).toBe("failed");
    expect(failedEntry?.error).toBe("Not found");
  });

  it("treats TempoNotFoundError as success (idempotent: already-gone = deleted)", async () => {
    const client = createMockWorklogDeleter({
      deleteWorklog: async (id: string) => {
        if (id === "wl-1") throw new TempoNotFoundError(id);
      },
    });
    const report = await processDeleteBatch(client, ["wl-1", "wl-2"], NO_DELAY_CONFIG);
    expect(report.summary.succeeded).toBe(2);
    expect(report.summary.failed).toBe(0);
    expect(report.entries.find((e) => e.worklogId === "wl-1")?.status).toBe("succeeded");
  });

  it("deduplicates repeated IDs", async () => {
    const deleted: string[] = [];
    const client = createMockWorklogDeleter({
      deleteWorklog: async (id: string) => { deleted.push(id); },
    });
    const report = await processDeleteBatch(client, ["wl-1", "wl-1", "wl-2"], NO_DELAY_CONFIG);
    expect(report.summary.total).toBe(2);
    expect(deleted.filter((id) => id === "wl-1")).toHaveLength(1);
  });

  it("handles large batch of 50 IDs", async () => {
    const client = createMockWorklogDeleter();
    const ids = Array.from({ length: 50 }, (_, i) => `wl-${i + 1}`);
    const report = await processDeleteBatch(client, ids, NO_DELAY_CONFIG);
    expect(report.summary.total).toBe(50);
    expect(report.summary.succeeded).toBe(50);
  });
});

describe("processUpdateBatch", () => {
  const NO_DELAY_CONFIG = { concurrencyLimit: 5, maxRetries: 1, baseDelayMs: 0, interBatchDelayMs: 0 };

  function makeUpdateClient(overrides?: {
    issueResolver?: Partial<ReturnType<typeof createMockIssueResolver>>;
    worklogUpdater?: Partial<ReturnType<typeof createMockWorklogUpdater>>;
    userResolver?: Partial<ReturnType<typeof createMockUserResolver>>;
  }) {
    return {
      ...createMockIssueResolver(overrides?.issueResolver),
      ...createMockWorklogUpdater(overrides?.worklogUpdater),
      ...createMockUserResolver(overrides?.userResolver),
    };
  }

  const singleUpdateEntry: BulkUpdateWorklogEntry = {
    worklogId: "wl-1",
    issueKey: "PROJ-1234",
    hours: 4,
    date: "2026-03-01",
  };

  it("succeeds for a single entry", async () => {
    const client = makeUpdateClient();
    const report = await processUpdateBatch(client, [singleUpdateEntry], undefined, NO_DELAY_CONFIG);
    expect(report.summary.total).toBe(1);
    expect(report.summary.succeeded).toBe(1);
    expect(report.summary.failed).toBe(0);
    expect(report.entries[0].status).toBe("succeeded");
  });

  it("marks entry as failed when issue resolution fails", async () => {
    const client = makeUpdateClient({
      issueResolver: { getIssueById: async () => { throw new Error("Issue not found"); } },
    });
    const report = await processUpdateBatch(client, [singleUpdateEntry], undefined, NO_DELAY_CONFIG);
    expect(report.summary.failed).toBe(1);
    expect(report.entries[0].status).toBe("failed");
  });

  it("processes multiple entries in chunks", async () => {
    const client = makeUpdateClient();
    const entries: BulkUpdateWorklogEntry[] = Array.from({ length: 6 }, (_, i) => ({
      worklogId: `wl-${i + 1}`,
      issueKey: "PROJ-1234",
      hours: 2,
      date: `2026-03-${String(i + 1).padStart(2, "0")}`,
    }));
    const report = await processUpdateBatch(client, entries, undefined, { concurrencyLimit: 3, maxRetries: 1, baseDelayMs: 0, interBatchDelayMs: 0 });
    expect(report.summary.total).toBe(6);
    expect(report.summary.succeeded).toBe(6);
  });

  it("handles partial failure with correct summary counts", async () => {
    const client = makeUpdateClient({
      worklogUpdater: {
        updateWorklog: async (id: string) => {
          if (id === "wl-2") throw new Error("Update failed");
          return createMockWorklogUpdater().updateWorklog(id, {} as never);
        },
      },
    });
    const entries: BulkUpdateWorklogEntry[] = [
      { worklogId: "wl-1", issueKey: "PROJ-1234", hours: 4, date: "2026-03-01" },
      { worklogId: "wl-2", issueKey: "PROJ-1234", hours: 4, date: "2026-03-02" },
      { worklogId: "wl-3", issueKey: "PROJ-1234", hours: 4, date: "2026-03-03" },
    ];
    const report = await processUpdateBatch(client, entries, undefined, NO_DELAY_CONFIG);
    expect(report.summary.succeeded).toBe(2);
    expect(report.summary.failed).toBe(1);
  });
});
