import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { TempoClient } from "../tempo-client.js";
import { DeleteWorklogInput } from "../types/index.js";

/**
 * Delete worklog tool implementation
 * Removes an existing worklog entry by ID
 */
export async function deleteWorklog(
  tempoClient: TempoClient,
  input: DeleteWorklogInput
): Promise<CallToolResult> {
  try {
    const { worklogId } = input;

    // First, try to get the worklog details before deletion (for confirmation)
    let worklogDetails = '';
    try {
      // Note: We could get worklog details first, but the Tempo API might not have a direct endpoint
      // for getting a single worklog. In practice, this would require getting all worklogs and filtering.
      // For simplicity, we'll proceed with deletion and provide the ID in the confirmation.
      worklogDetails = `Worklog ID: ${worklogId}`;
    } catch (detailError) {
      // If we can't get details, that's okay - we'll still try to delete
      worklogDetails = `Worklog ID: ${worklogId} (details unavailable)`;
    }

    // Attempt to delete the worklog
    await tempoClient.deleteWorklog(worklogId);

    // Format success response
    let displayText = `## Worklog Deleted Successfully\n\n`;
    displayText += `The worklog has been permanently removed from Tempo.\n\n`;
    displayText += `**Details:**\n`;
    displayText += `- ${worklogDetails}\n`;
    displayText += `- Deleted at: ${new Date().toISOString()}\n\n`;
    displayText += `⚠️ **Note:** This action cannot be undone. The worklog and all associated time entries have been permanently removed from your timesheet.\n`;

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
      errorMessage = `Worklog with ID '${input.worklogId}' was not found. It may have already been deleted or the ID may be incorrect.`;
    } else if (errorMessage.includes('Authentication failed')) {
      errorMessage += `\n\nTip: Check your Personal Access Token (PAT) in the TEMPO_PAT environment variable.`;
    } else if (errorMessage.includes('Access forbidden')) {
      errorMessage += `\n\nTip: Make sure you have permission to delete this worklog. You can typically only delete your own worklogs.`;
    }
    
    return {
      content: [
        {
          type: "text",
          text: `## Error Deleting Worklog\n\n**Worklog ID:** ${input.worklogId}\n\n**Error:** ${errorMessage}\n\n**Troubleshooting:**\n- Verify the worklog ID is correct\n- Check that the worklog exists and belongs to you\n- Ensure you have proper permissions in Tempo\n- Confirm your authentication credentials are valid`
        }
      ],
      isError: true
    };
  }
}