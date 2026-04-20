import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { TempoClient } from "../tempo-client.js";
import type { UpdateWorklogInput, UpdateWorklogJsonResponse } from "../types/index.js";
import { buildToolResult, buildToolError, enhanceErrorMessage } from "./tool-utils.js";

const UPDATE_ERROR_HINTS = [
  { pattern: "not found", tip: "Verify the worklog ID is correct. Use get_worklogs to retrieve current worklog IDs." },
  { pattern: "Authentication failed", tip: "Check your Personal Access Token (PAT) in the TEMPO_PAT environment variable." },
  { pattern: "Access forbidden", tip: "You can typically only update your own worklogs." },
] as const;

export async function updateWorklog(tempoClient: TempoClient, input: UpdateWorklogInput): Promise<CallToolResult> {
  try {
    const { worklogId, issueKey, hours, startDate, endDate, billable = true, description } = input;
    const payload = await tempoClient.createWorklogPayload({ issueKey, hours, startDate, endDate, billable, description });
    const worklogResponse = await tempoClient.updateWorklog(worklogId, payload);
    const worklog = Array.isArray(worklogResponse) ? worklogResponse[0] : worklogResponse;
    if (!worklog) {
      throw new Error("No worklog returned from API");
    }
    const response: UpdateWorklogJsonResponse = {
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
    const msg = enhanceErrorMessage(error instanceof Error ? error.message : String(error), UPDATE_ERROR_HINTS);
    return buildToolError(`## Error Updating Worklog\n\n**Worklog ID:** ${input.worklogId}\n**Issue:** ${input.issueKey}\n**Hours:** ${input.hours}\n**Date:** ${input.startDate}\n\n**Error:** ${msg}`);
  }
}
