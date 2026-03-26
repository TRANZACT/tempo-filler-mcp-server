import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { TempoClient } from "../tempo-client.js";
import { DeleteWorklogInput, DeleteWorklogJsonResponse } from "../types/index.js";

export async function deleteWorklog(
  tempoClient: TempoClient,
  input: DeleteWorklogInput
): Promise<CallToolResult> {
  try {
    const { worklogId } = input;

    await tempoClient.deleteWorklog(worklogId);

    const response: DeleteWorklogJsonResponse = {
      success: true,
      deletedWorklogId: worklogId
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
