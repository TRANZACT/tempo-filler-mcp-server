import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { TempoClient } from "../tempo-client.js";
import type {
  GetWorklogsInput,
  TempoWorklogResponse,
  GetWorklogsJsonResponse,
  WorklogResponse,
  IssueAggregateResponse,
} from "../types/index.js";
import { buildToolResult, buildToolError, mapScheduleDays, secondsToHours } from "./tool-utils.js";

function mapWorklogResponse(response: TempoWorklogResponse): WorklogResponse {
  const datePart = response.started.split(/[T\s]/)[0];
  return {
    id: response.tempoWorklogId?.toString() ?? response.id ?? "unknown",
    issueKey: response.issue.key,
    issueSummary: response.issue.summary,
    date: datePart,
    hours: secondsToHours(response.timeSpentSeconds),
    comment: response.comment ?? "",
  };
}

function aggregateByIssue(worklogs: WorklogResponse[]): IssueAggregateResponse[] {
  const issueMap = new Map<string, { issueSummary: string; totalHours: number; entryCount: number }>();
  for (const wl of worklogs) {
    const existing = issueMap.get(wl.issueKey);
    if (existing) {
      existing.totalHours += wl.hours;
      existing.entryCount += 1;
    } else {
      issueMap.set(wl.issueKey, { issueSummary: wl.issueSummary, totalHours: wl.hours, entryCount: 1 });
    }
  }
  return Array.from(issueMap.entries()).map(([key, data]) => ({
    issueKey: key,
    issueSummary: data.issueSummary,
    totalHours: Math.round(data.totalHours * 100) / 100,
    entryCount: data.entryCount,
  }));
}

export async function getWorklogs(tempoClient: TempoClient, input: GetWorklogsInput, _uiHtml?: string): Promise<CallToolResult> {
  try {
    const { startDate, endDate, issueKey } = input;
    const actualEndDate = endDate ?? startDate;

    const [worklogResponses, scheduleResponses] = await Promise.all([
      tempoClient.getWorklogs({ from: startDate, to: actualEndDate, issueKey }),
      tempoClient.getSchedule({ startDate, endDate: actualEndDate }).catch(() => []),
    ]);

    const worklogs = worklogResponses.map(mapWorklogResponse);
    const byIssue = aggregateByIssue(worklogs);
    const totalHours = Math.round(worklogs.reduce((sum, wl) => sum + wl.hours, 0) * 100) / 100;

    const response: GetWorklogsJsonResponse = {
      startDate,
      endDate: actualEndDate,
      ...(issueKey && { issueFilter: issueKey }),
      worklogs,
      byIssue,
      summary: { totalHours, totalEntries: worklogs.length, uniqueIssues: byIssue.length },
      schedule: mapScheduleDays(scheduleResponses),
    };

    return { ...buildToolResult(response), structuredContent: response as unknown as Record<string, unknown> };
  } catch (error) {
    return buildToolError(`Error retrieving worklogs: ${error instanceof Error ? error.message : String(error)}`);
  }
}
