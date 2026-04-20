import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { TempoClient } from "../tempo-client.js";
import type { BulkUpdateWorklogsInput, BulkUpdateWorklogsJsonResponse } from "../types/index.js";
import { processUpdateBatch } from "../batch-processor.js";
import { buildToolResult, buildToolError } from "./tool-utils.js";

export async function bulkUpdateWorklogs(tempoClient: TempoClient, input: BulkUpdateWorklogsInput): Promise<CallToolResult> {
  try {
    const { worklogs, billable = true } = input;
    const report = await processUpdateBatch(tempoClient, worklogs, { billable });
    const response: BulkUpdateWorklogsJsonResponse = {
      results: report.entries.map((e) => ({
        worklogId: e.worklogId,
        date: e.date,
        issueKey: e.issueKey,
        hours: e.hours,
        status: e.status,
        ...(e.error && { error: e.error }),
      })),
      summary: report.summary,
    };
    const allFailed = report.summary.failed === report.summary.total;
    return { ...buildToolResult(response), isError: allFailed };
  } catch (error) {
    return buildToolError(`## Error in Bulk Worklog Update\n\n**Error:** ${error instanceof Error ? error.message : String(error)}\n\n**Entries to update:** ${input.worklogs.length}`);
  }
}
