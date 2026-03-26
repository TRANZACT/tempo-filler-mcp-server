import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { TempoClient } from "../tempo-client.js";
import type { DeleteWorklogInput, DeleteWorklogJsonResponse } from "../types/index.js";
import { buildToolResult, buildToolError, enhanceErrorMessage } from "./tool-utils.js";

const DELETE_ERROR_HINTS = [
  { pattern: "not found", tip: "Verify the worklog ID is correct and it has not already been deleted." },
  { pattern: "Authentication failed", tip: "Check your Personal Access Token (PAT) in the TEMPO_PAT environment variable." },
  { pattern: "Access forbidden", tip: "You can typically only delete your own worklogs." },
] as const;

export async function deleteWorklog(tempoClient: TempoClient, input: DeleteWorklogInput): Promise<CallToolResult> {
  try {
    await tempoClient.deleteWorklog(input.worklogId);
    const response: DeleteWorklogJsonResponse = { success: true, deletedWorklogId: input.worklogId };
    return buildToolResult(response);
  } catch (error) {
    const msg = enhanceErrorMessage(error instanceof Error ? error.message : String(error), DELETE_ERROR_HINTS);
    return buildToolError(`## Error Deleting Worklog\n\n**Worklog ID:** ${input.worklogId}\n\n**Error:** ${msg}`);
  }
}
