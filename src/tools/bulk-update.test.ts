import { describe, it, expect } from "vitest";
import { bulkUpdateWorklogs } from "./bulk-update.js";
import {
  createMockIssueResolver,
  createMockWorklogUpdater,
  createMockUserResolver,
} from "../__test-utils__/mock-client.js";

function makeFakeClient(overrides?: {
  issueResolver?: Partial<ReturnType<typeof createMockIssueResolver>>;
  worklogUpdater?: Partial<ReturnType<typeof createMockWorklogUpdater>>;
  userResolver?: Partial<ReturnType<typeof createMockUserResolver>>;
}) {
  return {
    ...createMockIssueResolver(overrides?.issueResolver),
    ...createMockWorklogUpdater(overrides?.worklogUpdater),
    ...createMockUserResolver(overrides?.userResolver),
  } as unknown as import("../tempo-client.js").TempoClient;
}

const singleEntry = { worklogId: "wl-1", issueKey: "PROJ-1234", hours: 4, date: "2026-03-01" };

describe("bulkUpdateWorklogs", () => {
  it("returns structured response with correct summary on full success", async () => {
    const client = makeFakeClient();
    const result = await bulkUpdateWorklogs(client, { worklogs: [singleEntry] });
    const data = JSON.parse((result.content[0] as { text: string }).text);
    expect(data.summary.total).toBe(1);
    expect(data.summary.succeeded).toBe(1);
    expect(data.summary.failed).toBe(0);
    expect(result.isError).toBe(false);
  });

  it("returns isError:false on partial success", async () => {
    const client = makeFakeClient({
      worklogUpdater: {
        updateWorklog: async (id: string) => {
          if (id === "wl-2") throw new Error("Update failed");
          return createMockWorklogUpdater().updateWorklog(id, {} as never);
        },
      },
    });
    const entries = [
      { worklogId: "wl-1", issueKey: "PROJ-1234", hours: 4, date: "2026-03-01" },
      { worklogId: "wl-2", issueKey: "PROJ-1234", hours: 4, date: "2026-03-02" },
    ];
    const result = await bulkUpdateWorklogs(client, { worklogs: entries });
    const data = JSON.parse((result.content[0] as { text: string }).text);
    expect(data.summary.succeeded).toBe(1);
    expect(data.summary.failed).toBe(1);
    expect(result.isError).toBe(false);
  });

  it("returns isError:true when all updates fail", async () => {
    const client = makeFakeClient({
      worklogUpdater: {
        updateWorklog: async () => { throw new Error("Forbidden"); },
      },
    });
    const result = await bulkUpdateWorklogs(client, { worklogs: [singleEntry] });
    const data = JSON.parse((result.content[0] as { text: string }).text);
    expect(data.summary.failed).toBe(1);
    expect(result.isError).toBe(true);
  });
});
