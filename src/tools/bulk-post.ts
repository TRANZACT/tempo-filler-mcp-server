import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { TempoClient } from "../tempo-client.js";
import { 
  BulkPostWorklogsInput, 
  BulkPostWorklogsResponse,
  BulkWorklogEntry 
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
      endDate: entry.date, // Single day entries
      billable,
      description: entry.description
    }));

    let displayText = `## Bulk Worklog Creation Started\n\n`;
    displayText += `Processing ${worklogs.length} worklog entries...\n\n`;

    // Use the Tempo client's batch creation method (implements Promise.all internally)
    const results = await tempoClient.createWorklogsBatch(worklogParams);

    // Analyze results
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    const totalHours = successful.reduce((sum, result) => {
      return sum + result.originalParams.hours;
    }, 0);

    // Build response object
    const response: BulkPostWorklogsResponse = {
      results: results.map(result => ({
        success: result.success,
        worklog: result.worklog ? {
          id: result.worklog.id || 'unknown',
          issueKey: result.worklog.issue.key,
          issueSummary: result.worklog.issue.summary,
          timeSpentSeconds: result.worklog.timeSpentSeconds,
          billableSeconds: result.worklog.billableSeconds,
          started: result.worklog.started,
          worker: result.worklog.worker,
          attributes: result.worklog.attributes || {},
          timeSpent: result.worklog.timeSpent
        } : undefined,
        error: result.error,
        issueKey: result.originalParams.issueKey,
        date: result.originalParams.startDate,
        hours: result.originalParams.hours
      })),
      summary: {
        totalEntries: worklogs.length,
        successful: successful.length,
        failed: failed.length,
        totalHours
      },
      dailyTotals: {}
    };

    // Calculate daily totals by issue (matching the C# pivot table pattern)
    const dailyTotals: Record<string, Record<string, number>> = {};
    
    successful.forEach(result => {
      const date = result.originalParams.startDate;
      const issueKey = result.originalParams.issueKey;
      const hours = result.originalParams.hours;
      
      if (!dailyTotals[date]) {
        dailyTotals[date] = {};
      }
      if (!dailyTotals[date][issueKey]) {
        dailyTotals[date][issueKey] = 0;
      }
      dailyTotals[date][issueKey] += hours;
    });

    response.dailyTotals = dailyTotals;

    // Format display text
    displayText += `## Results Summary\n\n`;
    displayText += `- **Total Entries:** ${response.summary.totalEntries}\n`;
    displayText += `- **Successful:** ${response.summary.successful}\n`;
    displayText += `- **Failed:** ${response.summary.failed}\n`;
    displayText += `- **Total Hours:** ${response.summary.totalHours}\n\n`;

    if (successful.length > 0) {
      displayText += `### ✅ Successful Entries (${successful.length})\n\n`;
      
      // Group by date for better readability
      const successByDate = successful.reduce((acc, result) => {
        const date = result.originalParams.startDate;
        if (!acc[date]) {
          acc[date] = [];
        }
        acc[date].push(result);
        return acc;
      }, {} as Record<string, typeof successful>);

      const sortedDates = Object.keys(successByDate).sort();
      
      for (const date of sortedDates) {
        const dayEntries = successByDate[date];
        const dayHours = dayEntries.reduce((sum, entry) => sum + entry.originalParams.hours, 0);
        
        displayText += `#### ${date} (${dayHours}h total)\n\n`;
        
        for (const result of dayEntries) {
          const { issueKey, hours, description } = result.originalParams;
          displayText += `- **${issueKey}**: ${hours}h`;
          if (result.worklog) {
            displayText += ` - ${result.worklog.issue.summary}`;
          }
          if (description) {
            displayText += `\n  *${description}*`;
          }
          displayText += `\n`;
        }
        displayText += `\n`;
      }
    }

    if (failed.length > 0) {
      displayText += `### ❌ Failed Entries (${failed.length})\n\n`;
      
      for (const result of failed) {
        const { issueKey, hours, startDate, description } = result.originalParams;
        displayText += `- **${issueKey}** (${startDate}, ${hours}h)`;
        if (description) {
          displayText += ` - *${description}*`;
        }
        displayText += `\n  **Error:** ${result.error}\n\n`;
      }
    }

    // Add daily totals table (matching C# pivot table format)
    if (Object.keys(dailyTotals).length > 0) {
      displayText += `### 📊 Daily Totals by Issue\n\n`;
      
      const allIssues = new Set<string>();
      Object.values(dailyTotals).forEach(dayData => {
        Object.keys(dayData).forEach(issue => allIssues.add(issue));
      });
      
      const sortedIssues = Array.from(allIssues).sort();
      const sortedDailyDates = Object.keys(dailyTotals).sort();
      
      // Create table header
      displayText += `| Date | ${sortedIssues.join(' | ')} | Total |\n`;
      displayText += `|------|${sortedIssues.map(() => '---').join('|')}|-------|\n`;
      
      // Add rows for each date
      for (const date of sortedDailyDates) {
        const dayData = dailyTotals[date];
        const rowValues = sortedIssues.map(issue => {
          const hours = dayData[issue] || 0;
          return hours > 0 ? `${hours}h` : '-';
        });
        const dayTotal = Object.values(dayData).reduce((sum, hours) => sum + hours, 0);
        displayText += `| ${date} | ${rowValues.join(' | ')} | **${dayTotal}h** |\n`;
      }
      
      // Add totals row
      const issueTotals = sortedIssues.map(issue => {
        const total = sortedDailyDates.reduce((sum, date) => {
          return sum + (dailyTotals[date][issue] || 0);
        }, 0);
        return total > 0 ? `**${total}h**` : '-';
      });
      displayText += `| **Total** | ${issueTotals.join(' | ')} | **${response.summary.totalHours}h** |\n`;
    }

    return {
      content: [
        {
          type: "text",
          text: displayText
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