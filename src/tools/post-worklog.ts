import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { TempoClient } from "../tempo-client.js";
import { PostWorklogInput } from "../types/index.js";

/**
 * Post worklog tool implementation
 * Creates a new worklog entry with issue key resolution to numerical ID
 * Automatically uses the authenticated user as the worker
 */
export async function postWorklog(
  tempoClient: TempoClient,
  input: PostWorklogInput
): Promise<CallToolResult> {
  try {
    const { 
      issueKey, 
      hours, 
      startDate, 
      endDate, 
      billable = true, 
      description 
    } = input;

    // Create the worklog payload using the Tempo client (automatically uses authenticated user)
    const payload = await tempoClient.createWorklogPayload({
      issueKey,
      hours,
      startDate,
      endDate,
      billable,
      description
    });

    // Create the worklog
    const worklogResponse = await tempoClient.createWorklog(payload);

    // Handle the response - API returns an array with a single worklog object
    const worklog = Array.isArray(worklogResponse) ? worklogResponse[0] : worklogResponse;

    // Format success response
    const actualEndDate = endDate || startDate;
    const billableHours = billable ? hours : 0;
    
    let displayText = `## Worklog Created Successfully\n\n`;
    displayText += `**Issue:** ${issueKey} - ${worklog.issue.summary}\n`;
    displayText += `**Hours:** ${hours}h`;
    if (billableHours !== hours) {
      displayText += ` (${billableHours}h billable)`;
    }
    displayText += `\n`;
    displayText += `**Date:** ${startDate}`;
    if (actualEndDate !== startDate) {
      displayText += ` to ${actualEndDate}`;
    }
    displayText += `\n`;
    
    if (description) {
      displayText += `**Description:** ${description}\n`;
    }
    
    displayText += `**Worklog ID:** ${worklog.tempoWorklogId || worklog.id}\n`;
    displayText += `**Time Spent:** ${worklog.timeSpent}\n`;
    
    // Add some helpful information
    displayText += `\n### Details\n`;
    displayText += `- Created at: ${new Date().toISOString()}\n`;
    displayText += `- Total seconds: ${worklog.timeSpentSeconds}\n`;
    displayText += `- Billable seconds: ${worklog.billableSeconds}\n`;
    
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
    let errorMessage = error instanceof Error ? error.message : String(error);
    
    // Provide more helpful error messages for common issues
    if (errorMessage.includes('not found')) {
      errorMessage += `\n\nTip: Make sure the issue key '${input.issueKey}' exists and you have access to it.`;
    } else if (errorMessage.includes('Authentication failed')) {
      errorMessage += `\n\nTip: Check your Personal Access Token (PAT) in the TEMPO_PAT environment variable.`;
    } else if (errorMessage.includes('Access forbidden')) {
      errorMessage += `\n\nTip: Make sure you have permission to log time to this issue and that Tempo is properly configured.`;
    }
    
    return {
      content: [
        {
          type: "text",
          text: `## Error Creating Worklog\n\n**Issue:** ${input.issueKey}\n**Hours:** ${input.hours}\n**Date:** ${input.startDate}\n\n**Error:** ${errorMessage}`
        }
      ],
      isError: true
    };
  }
}