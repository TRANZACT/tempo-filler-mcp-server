import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { format, parseISO } from "date-fns";
import type { TempoScheduleResponse, ScheduleDayResponse } from "../types/index.js";

export function buildToolResult(response: object): CallToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(response) }],
    isError: false,
  };
}

export function buildToolError(message: string): CallToolResult {
  return {
    content: [{ type: "text", text: message }],
    isError: true,
  };
}

export interface ErrorHint {
  pattern: string;
  tip: string;
}

export function enhanceErrorMessage(message: string, hints: ReadonlyArray<ErrorHint>): string {
  for (const hint of hints) {
    if (message.includes(hint.pattern)) {
      return `${message}\n\nTip: ${hint.tip}`;
    }
  }
  return message;
}

export function secondsToHours(seconds: number): number {
  return Math.round((seconds / 3600) * 100) / 100;
}

export function mapScheduleDays(responses: TempoScheduleResponse[]): ScheduleDayResponse[] {
  if (!responses.length) return [];
  const { days } = responses[0].schedule;
  return days.map((day) => ({
    date: day.date,
    dayOfWeek: format(parseISO(day.date), "EEEE"),
    requiredHours: secondsToHours(day.requiredSeconds),
    isWorkingDay: day.type === "WORKING_DAY",
  }));
}

export function validateDateRange(startDate: string, endDate?: string): void {
  if (endDate && endDate < startDate) {
    throw new Error(`End date (${endDate}) cannot be before start date (${startDate})`);
  }
}
