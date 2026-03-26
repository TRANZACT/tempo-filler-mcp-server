import { describe, it, expect } from "vitest";
import { processWorklogBatch } from "./batch-processor.js";
import {
  createMockIssueResolver,
  createMockWorklogReader,
  createMockWorklogWriter,
  createMockUserResolver,
} from "./__test-utils__/mock-client.js";
import { fakeWorklogResponse } from "./__test-utils__/fixtures.js";
import type { BulkWorklogEntry } from "./types/index.js";

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
