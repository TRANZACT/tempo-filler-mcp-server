import { describe, it, expect } from "vitest";
import { updateWorklog } from "./update-worklog.js";
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

const validInput = {
  worklogId: "wl-1",
  issueKey: "PROJ-1234",
  hours: 4,
  startDate: "2026-03-01",
};

describe("updateWorklog", () => {
  it("returns success response with correct shape", async () => {
    const client = makeFakeClient();
    const result = await updateWorklog(client, validInput);
    const data = JSON.parse((result.content[0] as { text: string }).text);
    expect(data.success).toBe(true);
    expect(data.worklog.issueKey).toBe("PROJ-1234");
    expect(data.worklog.hours).toBe(4);
    expect(data.worklog.date).toBe("2026-03-01");
    expect(result.isError).toBeFalsy();
  });

  it("returns error result when worklog is not found (404 / not found message)", async () => {
    const client = makeFakeClient({
      worklogUpdater: {
        updateWorklog: async () => { throw new Error("Worklog wl-999 not found."); },
      },
    });
    const result = await updateWorklog(client, { ...validInput, worklogId: "wl-999" });
    expect(result.isError).toBe(true);
    const text = (result.content[0] as { text: string }).text;
    expect(text).toContain("wl-999");
  });

  it("returns error result on generic API failure", async () => {
    const client = makeFakeClient({
      worklogUpdater: {
        updateWorklog: async () => { throw new Error("Internal server error"); },
      },
    });
    const result = await updateWorklog(client, validInput);
    expect(result.isError).toBe(true);
    const text = (result.content[0] as { text: string }).text;
    expect(text).toContain("Internal server error");
  });
});
