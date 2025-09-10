import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { TempoClient } from "../tempo-client.js";
import { 
  GetWorklogsInput, 
  TempoWorklog, 
  GetWorklogsResponse,
  TempoWorklogResponse
} from "../types/index.js";

/**
 * Get worklogs tool implementation
 * Retrieves worklogs for authenticated user and date range, with optional issue filtering
 */
export async function getWorklogs(
  tempoClient: TempoClient,
  input: GetWorklogsInput
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
    const worklogs: TempoWorklog[] = worklogResponses.map((response: TempoWorklogResponse) => ({
      id: response.tempoWorklogId?.toString() || response.id || 'unknown',
      issueKey: response.issue.key,
      issueSummary: response.issue.summary,
      timeSpentSeconds: response.timeSpentSeconds,
      billableSeconds: response.billableSeconds,
      started: response.started,
      worker: response.worker,
      attributes: response.attributes || {},
      timeSpent: response.timeSpent,
      comment: response.comment || ''
    }));

    // Calculate total hours
    const totalSeconds = worklogs.reduce((sum, worklog) => sum + worklog.timeSpentSeconds, 0);
    const totalHours = Math.round((totalSeconds / 3600) * 100) / 100; // Round to 2 decimal places

    const result: GetWorklogsResponse = {
      worklogs,
      totalHours
    };

    // Format response for display - CONCISE VERSION
    let displayText = `## Your Worklogs (${startDate}`;
    if (endDate && endDate !== startDate) {
      displayText += ` to ${endDate}`;
    }
    displayText += `)\n\n`;

    if (issueKey) {
      displayText += `**Issue:** ${issueKey}\n\n`;
    }

    if (worklogs.length === 0) {
      displayText += "No worklogs found.\n";
    } else {
      displayText += `**Total:** ${totalHours}h (${worklogs.length} entries)\n\n`;

      // Group by issue for summary (more concise)
      const issueGroups = worklogs.reduce((acc, worklog) => {
        if (!acc[worklog.issueKey]) {
          acc[worklog.issueKey] = {
            totalSeconds: 0,
            entries: 0
          };
        }
        acc[worklog.issueKey].totalSeconds += worklog.timeSpentSeconds;
        acc[worklog.issueKey].entries += 1;
        return acc;
      }, {} as Record<string, { totalSeconds: number; entries: number }>);

      // Show summary by issue with issue summary
      for (const [key, data] of Object.entries(issueGroups)) {
        const hours = (data.totalSeconds / 3600).toFixed(1);
        // Get issue summary from first worklog with this key
        const sampleWorklog = worklogs.find(w => w.issueKey === key);
        const issueSummary = sampleWorklog?.issueSummary || '';
        displayText += `• **${key}** (${issueSummary}): ${hours}h (${data.entries} entries)\n`;
      }

      // Show recent entries (limit to 10 most recent)
      const recentWorklogs = worklogs
        .sort((a, b) => b.started.localeCompare(a.started))
        .slice(0, 10);

      if (recentWorklogs.length > 0) {
        displayText += `\n**Recent Entries:**\n`;
        for (const worklog of recentWorklogs) {
          const date = worklog.started.split('T')[0];
          const hours = (worklog.timeSpentSeconds / 3600).toFixed(1);
          let entryText = `• ${date}: **${worklog.issueKey}** (${worklog.issueSummary}) - ${hours}h - [ID: ${worklog.id}]`;
          if (worklog.comment && worklog.comment.trim()) {
            entryText += ` - "${worklog.comment}"`;
          }
          displayText += `${entryText}\n`;
        }
      }

      if (worklogs.length > 10) {
        displayText += `\n*Showing 10 most recent of ${worklogs.length} total entries*\n`;
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