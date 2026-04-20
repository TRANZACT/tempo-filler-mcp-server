import { describe, it, expect, vi, beforeEach } from "vitest";
import axios from "axios";
import { fakeConfig } from "./__test-utils__/fixtures.js";

describe("TempoClient security", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("does not log PAT token in request interceptor", async () => {
    const { TempoClient } = await import("./tempo-client.js");
    vi.spyOn(axios, "create").mockReturnValue({
      interceptors: {
        request: { use: vi.fn() },
        response: { use: vi.fn() },
      },
      get: vi.fn().mockResolvedValue({ data: { key: "testuser" } }),
    } as unknown as ReturnType<typeof axios.create>);

    new TempoClient(fakeConfig);

    const allCalls = (console.error as unknown as ReturnType<typeof vi.spyOn>).mock.calls;
    const hasPatInLogs = allCalls.some(call =>
      call.some(arg => typeof arg === "string" && arg.includes(fakeConfig.personalAccessToken))
    );
    expect(hasPatInLogs).toBe(false);
  });
});

describe("TempoClient.getWorklogs", () => {
  it("throws when from/to dates are missing", async () => {
    const { TempoClient } = await import("./tempo-client.js");
    const client = new TempoClient(fakeConfig);
    // @ts-expect-error testing missing params
    await expect(client.getWorklogs({})).rejects.toThrow("Date range");
  });
});
