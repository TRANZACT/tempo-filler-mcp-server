export class TempoRateLimitError extends Error {
  readonly retryAfterSeconds: number;

  constructor(retryAfterHeader: string | undefined) {
    const seconds = retryAfterHeader ? parseInt(retryAfterHeader, 10) : 60;
    super(`Rate limit exceeded. Retry after ${seconds} seconds.`);
    this.name = "TempoRateLimitError";
    this.retryAfterSeconds = isNaN(seconds) ? 60 : seconds;
  }
}

export class TempoTimeoutError extends Error {
  readonly url: string;

  constructor(url: string) {
    super(`Request timed out: ${url}`);
    this.name = "TempoTimeoutError";
    this.url = url;
  }
}
