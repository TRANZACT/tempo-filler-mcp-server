import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { TempoClient } from "../tempo-client.js";
import {
  BulkPostWorklogsInput,
  BulkWorklogEntry,
  BulkPostWorklogsJsonResponse,
  BulkWorklogResultResponse
} from "../types/index.js";

/**
 * Bulk post worklogs tool implementation
 * Creates multiple worklog entries using concurrent processing (Promise.all)
 * Automatically uses the authenticated user as the worker
 * Similar to the C# Task.WhenAll pattern from the notebook
 */
export async function bulkPostWorklogs(
  tempoClient: TempoClient,
  input: BulkPostWorklogsInput
): Promise<CallToolResult> {
  try {
    const { worklogs, billable = true } = input;

    if (worklogs.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: "No worklog entries provided."
          }
        ],
        isError: true
      };
    }

    // Validate maximum entries (prevent overwhelming the API)
    if (worklogs.length > 100) {
      return {
        content: [
          {
            type: "text",
            text: "Too many worklog entries. Maximum 100 entries allowed per bulk operation."
          }
        ],
        isError: true
      };
    }

    // Convert bulk entries to the format expected by the Tempo client (worker auto-determined)
    const worklogParams = worklogs.map((entry: BulkWorklogEntry) => ({
      issueKey: entry.issueKey,
      hours: entry.hours,
      startDate: entry.date,
      startTime: entry.startTime,
      endDate: entry.date, // Single day entries
      billable,
      description: entry.description
    }));

    // Use the Tempo client's batch creation method (implements Promise.all internally)
    const results = await tempoClient.createWorklogsBatch(worklogParams);

    // Analyze results
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    const totalHours = successful.reduce((sum, result) => {
      return sum + result.originalParams.hours;
    }, 0);

    // Build JSON response
    const resultItems: BulkWorklogResultResponse[] = results.map(result => ({
      date: result.originalParams.startDate,
      issueKey: result.originalParams.issueKey,
      hours: result.originalParams.hours,
      success: result.success,
      ...(result.success && result.worklog && {
        worklogId: String(result.worklog.tempoWorklogId || result.worklog.id || 'unknown')
      }),
      ...(result.error && { error: result.error })
    }));

    const response: BulkPostWorklogsJsonResponse = {
      results: resultItems,
      summary: {
        total: worklogs.length,
        succeeded: successful.length,
        failed: failed.length,
        totalHours
      }
    };

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(response)
        }
      ],
      isError: failed.length === worklogs.length // Only error if ALL failed
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    return {
      content: [
        {
          type: "text",
          text: `## Error in Bulk Worklog Creation\n\n**Error:** ${errorMessage}\n\n**Entries to process:** ${input.worklogs.length}`
        }
      ],
      isError: true
    };
  }
}