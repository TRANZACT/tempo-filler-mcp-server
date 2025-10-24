import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { format, parseISO } from "date-fns";
import { TempoClient } from "../tempo-client.js";
import {
  GetScheduleInput,
  GetScheduleResponse,
  ScheduleDay,
  TempoScheduleResponse
} from "../types/index.js";

/**
 * Get schedule tool implementation
 * Retrieves work schedule for authenticated user and date range
 * Shows working days, non-working days, and expected hours per day
 */
export async function getSchedule(
  tempoClient: TempoClient,
  input: GetScheduleInput
): Promise<CallToolResult> {
  try {
    const { startDate, endDate } = input;

    // Use endDate or default to startDate
    const actualEndDate = endDate || startDate;

    // Fetch schedule from Tempo API (automatically filters by authenticated user)
    const scheduleResponses = await tempoClient.getSchedule({
      startDate,
      endDate: actualEndDate
    });

    if (!scheduleResponses || scheduleResponses.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: "No schedule data found for the specified date range."
          }
        ],
        isError: true
      };
    }

    // Process the first schedule response (should contain the authenticated user's schedule)
    const scheduleResponse: TempoScheduleResponse = scheduleResponses[0];
    const { schedule } = scheduleResponse;

    // Process and format the schedule days
    const scheduleDays: ScheduleDay[] = schedule.days.map((day) => {
      // Extract date part and parse it
      const datePart = day.date;
      const parsedDate = parseISO(datePart);
      const humanReadableDate = format(parsedDate, "EEEE, MMMM do, yyyy");

      // Create hybrid format: ISO date + human-readable in parentheses
      const formattedDate = `${datePart} (${humanReadableDate})`;

      return {
        date: day.date,
        formattedDate,
        requiredHours: Math.round((day.requiredSeconds / 3600) * 100) / 100, // Round to 2 decimal places
        isWorkingDay: day.type === "WORKING_DAY",
        type: day.type === "WORKING_DAY" ? "Working Day" : "Non-Working Day"
      };
    });

    // Calculate summary statistics
    const totalDays = scheduleDays.length;
    const workingDays = scheduleDays.filter(day => day.isWorkingDay).length;
    const nonWorkingDays = totalDays - workingDays;
    const totalRequiredHours = Math.round((schedule.requiredSeconds / 3600) * 100) / 100;
    const averageDailyHours = workingDays > 0 ? Math.round((totalRequiredHours / workingDays) * 100) / 100 : 0;

    const result: GetScheduleResponse = {
      days: scheduleDays,
      summary: {
        totalDays,
        workingDays,
        nonWorkingDays,
        totalRequiredHours,
        averageDailyHours
      }
    };

    // Format response for display
    let displayText = `## Work Schedule (${startDate}`;
    if (endDate && endDate !== startDate) {
      displayText += ` to ${endDate}`;
    }
    displayText += `)\n\n`;

    // Period Summary
    displayText += `**Period Summary:**\n`;
    displayText += `- Total Days: ${result.summary.totalDays}\n`;
    displayText += `- Working Days: ${result.summary.workingDays}\n`;
    displayText += `- Non-Working Days: ${result.summary.nonWorkingDays}\n`;
    displayText += `- Total Required Hours: ${result.summary.totalRequiredHours}h\n`;
    if (result.summary.workingDays > 0) {
      displayText += `- Average Daily Hours: ${result.summary.averageDailyHours}h\n`;
    }
    displayText += `\n`;

    // Schedule Details
    if (scheduleDays.length > 0) {
      displayText += `**Schedule Details:**\n`;

      // Show all days (limit to reasonable amount for display)
      const displayLimit = 100; // Reasonable limit for display
      const daysToShow = scheduleDays.slice(0, displayLimit);

      for (const day of daysToShow) {
        if (day.isWorkingDay) {
          displayText += `• ${day.formattedDate}: ${day.requiredHours}h (${day.type})\n`;
        } else {
          displayText += `• ${day.formattedDate}: - (${day.type})\n`;
        }
      }

      if (scheduleDays.length > displayLimit) {
        displayText += `\n*Showing first ${displayLimit} of ${scheduleDays.length} total days*\n`;
        displayText += `*💡 Tip: Use a shorter date range for more detailed display*\n`;
      }
    }

    // Add helpful information for integration with other tools
    if (result.summary.workingDays > 0) {
      displayText += `\n**💡 Next Steps - Schedule-Aware Time Logging:**\n`;
      displayText += `- **Single Entry**: Use this schedule to verify working days before post_worklog\n`;
      displayText += `- **Bulk Entry**: Create bulk worklogs only for the ${result.summary.workingDays} working days shown above\n`;
      displayText += `- **Smart Planning**: Total capacity is ${result.summary.totalRequiredHours}h across ${result.summary.workingDays} working days\n`;
      displayText += `- **Avoid Errors**: Non-working days (${result.summary.nonWorkingDays} days) should not have time entries\n`;

      if (result.summary.totalRequiredHours > 0) {
        displayText += `\n**Example Bulk Entry**: "Fill all working days shown above with 8 hours on PROJ-1234"\n`;
      }
    }

    return {
      content: [
        {
          type: "text",
          text: displayText
        }
      ],
      isError: false
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Provide more helpful error messages for common issues
    let enhancedErrorMessage = errorMessage;
    if (errorMessage.includes('Authentication failed')) {
      enhancedErrorMessage += `\n\nTip: Check your Personal Access Token (PAT) in the TEMPO_PAT environment variable.`;
    } else if (errorMessage.includes('Access forbidden')) {
      enhancedErrorMessage += `\n\nTip: Make sure you have permission to access schedule data in Tempo.`;
    } else if (errorMessage.includes('404') || errorMessage.includes('not found')) {
      enhancedErrorMessage = `Schedule endpoint not found. This may indicate that Tempo Core API v2 is not available on your JIRA instance.\n\nTip: Verify that Tempo is properly installed and the Core API is enabled.`;
    }

    return {
      content: [
        {
          type: "text",
          text: `## Error Retrieving Schedule\n\n**Date Range:** ${input.startDate}${input.endDate ? ` to ${input.endDate}` : ''}\n\n**Error:** ${enhancedErrorMessage}`
        }
      ],
      isError: true
    };
  }
}