import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { TempoClient } from "../tempo-client.js";
import { PostWorklogInput, PostWorklogJsonResponse } from "../types/index.js";

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
      startTime,
      endDate, 
      billable = true, 
      description 
    } = input;

    // Create the worklog payload using the Tempo client (automatically uses authenticated user)
    const payload = await tempoClient.createWorklogPayload({
      issueKey,
      hours,
      startDate,
      startTime,
      endDate,
      billable,
      description
    });

    // Create the worklog
    const worklogResponse = await tempoClient.createWorklog(payload);

    // Handle the response - API returns an array with a single worklog object
    const worklog = Array.isArray(worklogResponse) ? worklogResponse[0] : worklogResponse;

    // Return JSON response
    const response: PostWorklogJsonResponse = {
      success: true,
      worklog: {
        id: String(worklog.tempoWorklogId || worklog.id),
        issueKey,
        issueSummary: worklog.issue.summary,
        date: startDate,
        hours,
        comment: description || ''
      }
    };

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(response)
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