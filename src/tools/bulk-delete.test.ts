import { describe, it, expect } from "vitest";
import { bulkDeleteWorklogs } from "./bulk-delete.js";
import { createMockWorklogDeleter } from "../__test-utils__/mock-client.js";

function makeFakeClient(overrides?: Partial<ReturnType<typeof createMockWorklogDeleter>>) {
  return createMockWorklogDeleter(overrides) as unknown as import("../tempo-client.js").TempoClient;
}

describe("bulkDeleteWorklogs", () => {
  it("returns structured response with correct summary on full success", async () => {
    const client = makeFakeClient();
    const result = await bulkDeleteWorklogs(client, { worklogIds: ["wl-1", "wl-2", "wl-3"] });
    const data = JSON.parse((result.content[0] as { text: string }).text);
    expect(data.summary.total).toBe(3);
    expect(data.summary.succeeded).toBe(3);
    expect(data.summary.failed).toBe(0);
    expect(result.isError).toBe(false);
  });

  it("returns isError:false on partial success", async () => {
    const client = makeFakeClient({
      deleteWorklog: async (id: string) => {
        if (id === "wl-2") throw new Error("Not found");
      },
    });
    const result = await bulkDeleteWorklogs(client, { worklogIds: ["wl-1", "wl-2"] });
    const data = JSON.parse((result.content[0] as { text: string }).text);
    expect(data.summary.succeeded).toBe(1);
    expect(data.summary.failed).toBe(1);
    expect(result.isError).toBe(false);
  });

  it("returns isError:true when all deletions fail", async () => {
    const client = makeFakeClient({
      deleteWorklog: async () => { throw new Error("Forbidden"); },
    });
    const result = await bulkDeleteWorklogs(client, { worklogIds: ["wl-1", "wl-2"] });
    const data = JSON.parse((result.content[0] as { text: string }).text);
    expect(data.summary.failed).toBe(2);
    expect(result.isError).toBe(true);
  });
});
