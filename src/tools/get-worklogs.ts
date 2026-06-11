import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { format, parseISO } from "date-fns";
import { TempoClient } from "../tempo-client.js";
import {
  GetWorklogsInput,
  TempoWorklogResponse,
  TempoScheduleResponse,
  GetWorklogsJsonResponse,
  WorklogResponse,
  IssueAggregateResponse,
  ScheduleDayResponse
} from "../types/index.js";

/**
 * Get worklogs tool implementation
 * Retrieves worklogs for authenticated user and date range, with optional issue filtering
 */
export async function getWorklogs(
  tempoClient: TempoClient,
  input: GetWorklogsInput,
  uiHtml?: string
): Promise<CallToolResult> {
  try {
    const { startDate, endDate, issueKey } = input;
    
    // Use endDate or default to startDate
    const actualEndDate = endDate || startDate;
    
    // Fetch worklogs from Tempo API (automatically filters by authenticated user)
    const worklogResponses = await tempoClient.getWorklogs({
      from: startDate,
      to: actualEndDate,
      issueKey: issueKey
    });

    // Process and format the worklogs
    const worklogs: WorklogResponse[] = worklogResponses.map((response: TempoWorklogResponse) => {
      // Extract date part from datetime string (handles both "2025-09-12 00:00:00.000" and "2025-09-12T00:00:00.000")
      const datePart = response.started.split(/[T\s]/)[0];
      // Extract time part (HH:mm) from datetime string
      const timeMatch = response.started.match(/[T\s](\d{2}:\d{2})/);
      const startTime = timeMatch ? timeMatch[1] : '00:00';

      return {
        id: response.tempoWorklogId?.toString() || response.id || 'unknown',
        issueKey: response.issue.key,
        issueSummary: response.issue.summary,
        date: datePart,
        startTime,
        hours: Math.round((response.timeSpentSeconds / 3600) * 100) / 100,
        comment: response.comment || ''
      };
    });

    // Calculate total hours
    const totalHours = Math.round(worklogs.reduce((sum, worklog) => sum + worklog.hours, 0) * 100) / 100;

    // Group by issue for aggregation
    const issueMap = new Map<string, { issueSummary: string; totalHours: number; entryCount: number }>();
    for (const worklog of worklogs) {
      const existing = issueMap.get(worklog.issueKey);
      if (existing) {
        existing.totalHours += worklog.hours;
        existing.entryCount += 1;
      } else {
        issueMap.set(worklog.issueKey, {
          issueSummary: worklog.issueSummary,
          totalHours: worklog.hours,
          entryCount: 1
        });
      }
    }

    // Build byIssue aggregation
    const byIssue: IssueAggregateResponse[] = Array.from(issueMap.entries()).map(([key, data]) => ({
      issueKey: key,
      issueSummary: data.issueSummary,
      totalHours: Math.round(data.totalHours * 100) / 100,
      entryCount: data.entryCount
    }));

    // Fetch schedule data for coverage-aware UI coloring
    let scheduleDays: ScheduleDayResponse[] = [];
    try {
      const scheduleResponses = await tempoClient.getSchedule({
        startDate,
        endDate: actualEndDate
      });

      if (scheduleResponses && scheduleResponses.length > 0) {
        const scheduleResponse: TempoScheduleResponse = scheduleResponses[0];
        scheduleDays = scheduleResponse.schedule.days.map((day) => {
          const parsedDate = parseISO(day.date);
          const dayOfWeek = format(parsedDate, "EEEE");
          return {
            date: day.date,
            dayOfWeek,
            requiredHours: Math.round((day.requiredSeconds / 3600) * 100) / 100,
            isWorkingDay: day.type === "WORKING_DAY"
          };
        });
      }
    } catch {
      // Schedule fetch failed - continue without schedule data
      // UI will handle missing schedule gracefully
    }

    // Return JSON response
    const response: GetWorklogsJsonResponse = {
      startDate,
      endDate: actualEndDate,
      ...(issueKey && { issueFilter: issueKey }),
      worklogs,
      byIssue,
      summary: {
        totalHours,
        totalEntries: worklogs.length,
        uniqueIssues: issueMap.size
      },
      schedule: scheduleDays
    };

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(response)
        }
      ],
      structuredContent: response as unknown as Record<string, unknown>,
      isError: false
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    return {
      content: [
        {
          type: "text",
          text: `Error retrieving worklogs: ${errorMessage}`
        }
      ],
      isError: true
    };
  }
}