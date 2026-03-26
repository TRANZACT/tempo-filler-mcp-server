import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { TempoClient } from "../tempo-client.js";
import type { GetScheduleInput, GetScheduleJsonResponse } from "../types/index.js";
import { buildToolResult, buildToolError, mapScheduleDays, secondsToHours, enhanceErrorMessage } from "./tool-utils.js";

const SCHEDULE_ERROR_HINTS = [
  { pattern: "Authentication failed", tip: "Check your Personal Access Token (PAT) in the TEMPO_PAT environment variable." },
  { pattern: "Access forbidden", tip: "Make sure you have permission to access schedule data in Tempo." },
  { pattern: "404", tip: "Verify that Tempo is properly installed and the Core API is enabled." },
  { pattern: "not found", tip: "Verify that Tempo is properly installed and the Core API is enabled." },
] as const;

function calculateScheduleSummary(days: ReturnType<typeof mapScheduleDays>, requiredSeconds: number) {
  const workingDays = days.filter((d) => d.isWorkingDay).length;
  const totalRequiredHours = secondsToHours(requiredSeconds);
  return {
    totalDays: days.length,
    workingDays,
    nonWorkingDays: days.length - workingDays,
    totalRequiredHours,
    averageDailyHours: workingDays > 0 ? Math.round((totalRequiredHours / workingDays) * 100) / 100 : 0,
  };
}

export async function getSchedule(tempoClient: TempoClient, input: GetScheduleInput, _uiHtml?: string): Promise<CallToolResult> {
  try {
    const { startDate, endDate } = input;
    const actualEndDate = endDate ?? startDate;

    const scheduleResponses = await tempoClient.getSchedule({ startDate, endDate: actualEndDate });
    if (!scheduleResponses.length) {
      return buildToolError("No schedule data found for the specified date range.");
    }

    const days = mapScheduleDays(scheduleResponses);
    const summary = calculateScheduleSummary(days, scheduleResponses[0].schedule.requiredSeconds);

    const response: GetScheduleJsonResponse = { startDate, endDate: actualEndDate, days, summary };
    return { ...buildToolResult(response), structuredContent: response as unknown as Record<string, unknown> };
  } catch (error) {
    const msg = enhanceErrorMessage(error instanceof Error ? error.message : String(error), SCHEDULE_ERROR_HINTS);
    return buildToolError(`## Error Retrieving Schedule\n\n**Date Range:** ${input.startDate}${input.endDate ? ` to ${input.endDate}` : ""}\n\n**Error:** ${msg}`);
  }
}
