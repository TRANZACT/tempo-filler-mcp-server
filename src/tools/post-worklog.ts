import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { TempoClient } from "../tempo-client.js";
import type { PostWorklogInput, PostWorklogJsonResponse } from "../types/index.js";
import { buildToolResult, buildToolError, enhanceErrorMessage } from "./tool-utils.js";

const POST_ERROR_HINTS = [
  { pattern: "not found", tip: "Make sure the issue key exists and you have access to it." },
  { pattern: "Authentication failed", tip: "Check your Personal Access Token (PAT) in the TEMPO_PAT environment variable." },
  { pattern: "Access forbidden", tip: "Make sure you have permission to log time to this issue." },
] as const;

export async function postWorklog(tempoClient: TempoClient, input: PostWorklogInput): Promise<CallToolResult> {
  try {
    const { issueKey, hours, startDate, endDate, billable = true, description } = input;
    const payload = await tempoClient.createWorklogPayload({ issueKey, hours, startDate, endDate, billable, description });
    const worklogResponse = await tempoClient.createWorklog(payload);
    const worklog = Array.isArray(worklogResponse) ? worklogResponse[0] : worklogResponse;
    if (!worklog) {
      throw new Error("No worklog returned from API");
    }
    const response: PostWorklogJsonResponse = {
      success: true,
      worklog: {
        id: String(worklog.tempoWorklogId ?? worklog.id),
        issueKey,
        issueSummary: worklog.issue.summary,
        date: startDate,
        hours,
        comment: description ?? "",
      },
    };
    return buildToolResult(response);
  } catch (error) {
    const msg = enhanceErrorMessage(error instanceof Error ? error.message : String(error), POST_ERROR_HINTS);
    return buildToolError(`## Error Creating Worklog\n\n**Issue:** ${input.issueKey}\n**Hours:** ${input.hours}\n**Date:** ${input.startDate}\n\n**Error:** ${msg}`);
  }
}
