import { describe, it, expect } from "vitest";
import { TempoRateLimitError, TempoTimeoutError } from "./errors.js";

describe("TempoRateLimitError", () => {
  it("parses retry-after header", () => {
    const error = new TempoRateLimitError("30");
    expect(error.retryAfterSeconds).toBe(30);
    expect(error.name).toBe("TempoRateLimitError");
    expect(error).toBeInstanceOf(Error);
  });

  it("defaults to 60 seconds when header is undefined", () => {
    const error = new TempoRateLimitError(undefined);
    expect(error.retryAfterSeconds).toBe(60);
  });

  it("defaults to 60 seconds when header is not a number", () => {
    const error = new TempoRateLimitError("not-a-number");
    expect(error.retryAfterSeconds).toBe(60);
  });
});

describe("TempoTimeoutError", () => {
  it("captures the URL", () => {
    const error = new TempoTimeoutError("https://jira.example.com/api");
    expect(error.url).toBe("https://jira.example.com/api");
    expect(error.name).toBe("TempoTimeoutError");
    expect(error).toBeInstanceOf(Error);
  });
});
