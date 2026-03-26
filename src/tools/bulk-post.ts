import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { TempoClient } from "../tempo-client.js";
import type { BulkPostWorklogsInput, BulkPostWorklogsJsonResponse, BulkWorklogResultResponse } from "../types/index.js";
import { processWorklogBatch } from "../batch-processor.js";
import { buildToolResult, buildToolError } from "./tool-utils.js";

export async function bulkPostWorklogs(tempoClient: TempoClient, input: BulkPostWorklogsInput): Promise<CallToolResult> {
  try {
    const { worklogs, billable = true } = input;
    const report = await processWorklogBatch(tempoClient, worklogs, { billable });

    const results: BulkWorklogResultResponse[] = report.entries.map((entry) => ({
      date: entry.date,
      issueKey: entry.issueKey,
      hours: entry.hours,
      status: entry.status,
      ...(entry.worklogId && { worklogId: entry.worklogId }),
      ...(entry.error && { error: entry.error }),
      ...(entry.skipReason && { skipReason: entry.skipReason }),
    }));

    const response: BulkPostWorklogsJsonResponse = { results, summary: report.summary };
    const allFailed = report.summary.failed === report.summary.total && report.summary.skipped === 0;
    return { ...buildToolResult(response), isError: allFailed };
  } catch (error) {
    return buildToolError(`## Error in Bulk Worklog Creation\n\n**Error:** ${error instanceof Error ? error.message : String(error)}\n\n**Entries to process:** ${input.worklogs.length}`);
  }
}
