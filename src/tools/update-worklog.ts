import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { TempoClient } from "../tempo-client.js";
import { UpdateWorklogInput, UpdateWorklogJsonResponse } from "../types/index.js";

/**
 * Update worklog tool implementation
 * Modifies an existing worklog entry (hours, startTime, description, etc.)
 */
export async function updateWorklog(
  tempoClient: TempoClient,
  input: UpdateWorklogInput
): Promise<CallToolResult> {
  try {
    const { worklogId, hours, startDate, startTime, description, billable } = input;

    const worklogResponse = await tempoClient.updateWorklog(worklogId, {
      hours,
      startDate,
      startTime,
      description,
      billable,
    });

    const worklog = Array.isArray(worklogResponse) ? worklogResponse[0] : worklogResponse;
    const datePart = worklog.started.split(/[T\s]/)[0];
    const timeMatch = worklog.started.match(/[T\s](\d{2}:\d{2})/);
    const resolvedStartTime = timeMatch ? timeMatch[1] : '00:00';

    const response: UpdateWorklogJsonResponse = {
      success: true,
      worklog: {
        id: String(worklog.tempoWorklogId || worklog.id),
        issueKey: worklog.issue.key,
        issueSummary: worklog.issue.summary,
        date: datePart,
        startTime: resolvedStartTime,
        hours: Math.round((worklog.timeSpentSeconds / 3600) * 100) / 100,
        comment: worklog.comment || ''
      }
    };

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(response)
        }
      ],
      isError: false
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    return {
      content: [
        {
          type: "text",
          text: `Error updating worklog ${input.worklogId}: ${errorMessage}`
        }
      ],
      isError: true
    };
  }
}
