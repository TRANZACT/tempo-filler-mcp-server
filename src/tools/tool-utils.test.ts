import { describe, it, expect } from "vitest";
import { buildToolResult, buildToolError, enhanceErrorMessage, secondsToHours, validateDateRange } from "./tool-utils.js";

describe("buildToolResult", () => {
  it("wraps response as JSON text content", () => {
    const result = buildToolResult({ foo: "bar" });
    expect(result.isError).toBe(false);
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse((result.content[0] as { text: string }).text)).toEqual({ foo: "bar" });
  });
});

describe("buildToolError", () => {
  it("marks result as error with message", () => {
    const result = buildToolError("something went wrong");
    expect(result.isError).toBe(true);
    expect((result.content[0] as { text: string }).text).toBe("something went wrong");
  });
});

describe("enhanceErrorMessage", () => {
  it("appends tip when pattern matches", () => {
    const result = enhanceErrorMessage("Authentication failed", [{ pattern: "Authentication failed", tip: "Check your PAT." }]);
    expect(result).toContain("Check your PAT.");
  });

  it("returns original when no pattern matches", () => {
    const result = enhanceErrorMessage("Some other error", [{ pattern: "Authentication failed", tip: "Check your PAT." }]);
    expect(result).toBe("Some other error");
  });
});

describe("secondsToHours", () => {
  it("converts seconds to hours with 2 decimal precision", () => {
    expect(secondsToHours(3600)).toBe(1);
    expect(secondsToHours(5400)).toBe(1.5);
    expect(secondsToHours(28800)).toBe(8);
  });
});

describe("validateDateRange", () => {
  it("throws when endDate is before startDate", () => {
    expect(() => validateDateRange("2026-03-15", "2026-03-01")).toThrow();
  });

  it("does not throw when endDate equals startDate", () => {
    expect(() => validateDateRange("2026-03-01", "2026-03-01")).not.toThrow();
  });

  it("does not throw when endDate is after startDate", () => {
    expect(() => validateDateRange("2026-03-01", "2026-03-31")).not.toThrow();
  });

  it("does not throw when endDate is omitted", () => {
    expect(() => validateDateRange("2026-03-01")).not.toThrow();
  });
});
