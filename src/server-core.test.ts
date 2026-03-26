import { describe, it, expect } from "vitest";
import { createTempoClient, SERVER_VERSION } from "./server-core.js";

describe("createTempoClient", () => {
  it("throws when TEMPO_BASE_URL is missing", () => {
    expect(() => createTempoClient({ TEMPO_PAT: "token" })).toThrow("TEMPO_BASE_URL");
  });

  it("throws when TEMPO_PAT is missing", () => {
    expect(() => createTempoClient({ TEMPO_BASE_URL: "https://jira.example.com" })).toThrow("TEMPO_PAT");
  });

  it("creates client with valid env vars", () => {
    const client = createTempoClient({
      TEMPO_BASE_URL: "https://jira.example.com",
      TEMPO_PAT: "fake-token",
    });
    expect(client).toBeDefined();
  });
});

describe("SERVER_VERSION", () => {
  it("matches package.json version", async () => {
    const { readFileSync } = await import("fs");
    const pkg = JSON.parse(
      readFileSync(
        new URL("../package.json", import.meta.url),
        "utf-8"
      )
    );
    expect(SERVER_VERSION).toBe(pkg.version);
  });
});
