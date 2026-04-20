import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import axios from "axios";
import { fakeConfig } from "./__test-utils__/fixtures.js";
import { DEFAULTS } from "./types/index.js";

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

describe("TempoClient.getIssueById LRU cache eviction", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("evicts the oldest entry instead of wiping the entire cache when at capacity", async () => {
    const { TempoClient } = await import("./tempo-client.js");
    const httpCallKeys: string[] = [];
    const mockGet = vi.fn(async (url: string) => {
      const key = url.split("/").pop()!;
      httpCallKeys.push(key);
      return { data: { id: "100", key, fields: { summary: `Issue ${key}` } } };
    });
    vi.spyOn(axios, "create").mockReturnValue({
      interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
      get: mockGet,
    } as unknown as ReturnType<typeof axios.create>);

    const client = new TempoClient(fakeConfig);

    // Fill cache to capacity (PROJ-0 is the oldest)
    for (let i = 0; i < DEFAULTS.MAX_CACHE_SIZE; i++) {
      await client.getIssueById(`PROJ-${i}`);
    }
    expect(client.getCachedIssueCount()).toBe(DEFAULTS.MAX_CACHE_SIZE);

    // One more unique key triggers LRU eviction
    await client.getIssueById("PROJ-NEW");
    expect(client.getCachedIssueCount()).toBe(DEFAULTS.MAX_CACHE_SIZE);

    // PROJ-0 (oldest) must have been evicted — a subsequent call must hit HTTP
    httpCallKeys.length = 0;
    await client.getIssueById("PROJ-0");
    expect(httpCallKeys).toContain("PROJ-0");

    // PROJ-499 (recent) must still be cached — no HTTP call needed
    httpCallKeys.length = 0;
    await client.getIssueById("PROJ-499");
    expect(httpCallKeys).not.toContain("PROJ-499");
  });
});
