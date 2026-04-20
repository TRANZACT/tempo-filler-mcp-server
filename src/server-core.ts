import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { TempoClient } from "./tempo-client.js";
import { ENV_VARS, DEFAULTS } from "./types/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

export const SERVER_VERSION = "2.0.2";

export interface UiAssets {
  getScheduleHtml: string | undefined;
  getWorklogsHtml: string | undefined;
}

/**
 * Constructs a fully configured `TempoClient` from environment variables.
 * @throws {Error} if `TEMPO_BASE_URL` or `TEMPO_PAT` are absent from `env`.
 */
export function createTempoClient(env: NodeJS.ProcessEnv = process.env): TempoClient {
  const baseUrl = env[ENV_VARS.TEMPO_BASE_URL];
  const pat = env[ENV_VARS.TEMPO_PAT];

  if (!baseUrl) throw new Error(`Missing required environment variable: ${ENV_VARS.TEMPO_BASE_URL}`);
  if (!pat) throw new Error(`Missing required environment variable: ${ENV_VARS.TEMPO_PAT}`);

  const defaultHoursRaw = env[ENV_VARS.TEMPO_DEFAULT_HOURS];
  const defaultHours = defaultHoursRaw ? parseFloat(defaultHoursRaw) : DEFAULTS.HOURS_PER_DAY;

  return new TempoClient({ baseUrl, personalAccessToken: pat, defaultHours, timeout: DEFAULTS.REQUEST_TIMEOUT });
}

export function loadUiAssets(): UiAssets {
  function tryReadHtml(filename: string): string | undefined {
    try {
      return readFileSync(resolve(__dirname, filename), "utf-8");
    } catch {
      return undefined;
    }
  }
  return {
    getScheduleHtml: tryReadHtml("ui/get-schedule.html"),
    getWorklogsHtml: tryReadHtml("ui/get-worklogs.html"),
  };
}
