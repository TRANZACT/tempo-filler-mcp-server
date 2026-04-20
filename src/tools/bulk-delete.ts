import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { TempoClient } from "../tempo-client.js";
import type { BulkDeleteWorklogsInput, BulkDeleteWorklogsJsonResponse } from "../types/index.js";
import { processDeleteBatch } from "../batch-processor.js";
import { buildToolResult, buildToolError } from "./tool-utils.js";

export async function bulkDeleteWorklogs(tempoClient: TempoClient, input: BulkDeleteWorklogsInput): Promise<CallToolResult> {
  try {
    const report = await processDeleteBatch(tempoClient, input.worklogIds);
    const response: BulkDeleteWorklogsJsonResponse = {
      results: report.entries.map((e) => ({
        worklogId: e.worklogId,
        status: e.status,
        ...(e.error && { error: e.error }),
      })),
      summary: report.summary,
    };
    const allFailed = report.summary.failed === report.summary.total;
    return { ...buildToolResult(response), isError: allFailed };
  } catch (error) {
    return buildToolError(`## Error in Bulk Worklog Deletion\n\n**Error:** ${error instanceof Error ? error.message : String(error)}\n\n**IDs to delete:** ${input.worklogIds.length}`);
  }
}
