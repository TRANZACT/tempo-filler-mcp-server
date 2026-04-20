import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { TempoClient } from "../tempo-client.js";
import type {
  BulkPostWorklogsInput,
  BulkWorklogEntry,
  BulkPostWorklogsJsonResponse,
  BulkWorklogResultResponse,
} from "../types/index.js";
import { DEFAULTS } from "../types/index.js";

export async function bulkPostWorklogs(
  tempoClient: TempoClient,
  input: BulkPostWorklogsInput
): Promise<CallToolResult> {
  try {
    const { worklogs, billable = true } = input;

    const worklogParams = worklogs.map((entry: BulkWorklogEntry) => ({
      issueKey: entry.issueKey,
      hours: entry.hours,
      startDate: entry.date,
      endDate: entry.date,
      billable,
      description: entry.description,
    }));

    const results: Array<{
      success: boolean;
      worklog?: Awaited<ReturnType<TempoClient["createWorklog"]>>;
      error?: string;
      originalParams: (typeof worklogParams)[0];
    }> = [];

    for (const params of worklogParams) {
      try {
        const payload = await tempoClient.createWorklogPayload(params);
        const worklog = await tempoClient.createWorklog(payload);
        results.push({ success: true, worklog, originalParams: params });
      } catch (error) {
        results.push({
          success: false,
          error: error instanceof Error ? error.message : String(error),
          originalParams: params,
        });
      }
    }

    const successful = results.filter((r) => r.success);
    const failed = results.filter((r) => !r.success);
    const totalHours = successful.reduce((sum, result) => sum + result.originalParams.hours, 0);

    const resultItems: BulkWorklogResultResponse[] = results.map((result) => ({
      date: result.originalParams.startDate,
      issueKey: result.originalParams.issueKey,
      hours: result.originalParams.hours,
      status: result.success ? ("succeeded" as const) : ("failed" as const),
      ...(result.success && result.worklog && {
        worklogId: String(result.worklog.tempoWorklogId || result.worklog.id || "unknown"),
      }),
      ...(result.error && { error: result.error }),
    }));

    const response: BulkPostWorklogsJsonResponse = {
      results: resultItems,
      summary: {
        total: worklogs.length,
        succeeded: successful.length,
        failed: failed.length,
        skipped: 0,
        totalHours,
      },
    };

    return {
      content: [{ type: "text", text: JSON.stringify(response) }],
      isError: failed.length === worklogs.length,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: [
        {
          type: "text",
          text: `## Error in Bulk Worklog Creation\n\n**Error:** ${errorMessage}\n\n**Entries to process:** ${input.worklogs.length}`,
        },
      ],
      isError: true,
    };
  }
}
