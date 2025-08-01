# Tempo Filler MCP Server

A Model Context Protocol (MCP) server for managing Tempo worklogs in JIRA. This server enables AI assistants to interact with Tempo's time tracking system, allowing for worklog retrieval, creation, bulk operations, and management.

## Quick Start

1. **Build the server**:
   ```bash
   npm install && npm run build
   ```

2. **Configure your AI assistant** with:
   ```json
   {
     "servers": {
       "tempo-filler": {
         "type": "stdio",
         "command": "node", 
         "args": ["path/to/TempoFiller/dist/index.js"],
         "env": {
           "TEMPO_BASE_URL": "https://jira.company.com",
           "TEMPO_PAT": "your-personal-access-token"
         }
       }
     }
   }
   ```

3. **Test it**: Ask your AI assistant "Get my worklogs for this week"

## Features

- **Get Worklogs**: Retrieve worklogs for users with date range and issue filtering
- **Create Worklogs**: Add single worklog entries with automatic issue resolution
- **Bulk Operations**: Create multiple worklog entries efficiently using concurrent processing
- **Delete Worklogs**: Remove existing worklog entries
- **Resource Access**: Browse worklog data and recent issues
- **Prompt Templates**: Generate analysis prompts for worklog data

## Installation

1. **Clone or download this repository**
2. **Install dependencies**:
   ```bash
   npm install
   ```
3. **Build the server**:
   ```bash
   npm run build
   ```

## Configuration

The server requires environment variables for authentication and configuration:

### Required Environment Variables

- `TEMPO_BASE_URL`: Your JIRA instance URL (e.g., `https://jira.company.com`)
- `TEMPO_PAT`: Personal Access Token for authentication

### Optional Environment Variables

- `TEMPO_DEFAULT_HOURS`: Default hours per workday (default: 8)

### Creating a Personal Access Token (PAT)

1. Log into your JIRA instance
2. Go to **Profile** → **Personal Access Tokens**
3. Click **Create token**
4. Give it a name (e.g., "Tempo MCP Server")
5. Set appropriate permissions (read/write access to issues and worklogs)
6. Copy the token value for use in `TEMPO_PAT`

## Usage with AI Assistants

### GitHub Copilot Configuration (VS Code)

Add to your MCP servers configuration file (e.g., `mcp.json`):

```json
{
  "servers": {
    "tempo-filler": {
      "type": "stdio", 
      "command": "node",
      "args": [
        "D:\\path\\to\\TempoFiller\\dist\\index.js"
      ],
      "env": {
        "TEMPO_BASE_URL": "https://jira.company.com",
        "TEMPO_PAT": "your-personal-access-token-here"
      }
    }
  }
}
```

### Claude Desktop Configuration

Add to your Claude Desktop config file:

```json
{
  "mcpServers": {
    "tempo-filler": {
      "command": "node", 
      "args": ["path/to/TempoFiller/dist/index.js"],
      "env": {
        "TEMPO_BASE_URL": "https://jira.company.com",
        "TEMPO_PAT": "your-personal-access-token"
      }
    }
  }
}
```

### Setup Steps

1. **Build the server**: `npm run build`
2. **Add configuration** to your AI assistant
3. **Restart** your AI assistant to load the MCP server
4. **Test the connection**: Ask "Get my worklogs for this week"

### Authentication Setup

The server uses Personal Access Tokens (PAT) for secure authentication:

1. **Generate a PAT** in your JIRA instance:
   - Go to **Profile** → **Personal Access Tokens** 
   - Create token with **read/write permissions** for issues and worklogs
   - **Copy the token value** (you won't see it again)

2. **Set environment variables**:
   - `TEMPO_BASE_URL`: Your JIRA URL (e.g., `https://jira.company.com`)
   - `TEMPO_PAT`: Your personal access token

## Available Tools

### 1. `get_worklogs` - Retrieve Time Logs

Retrieve worklogs for a date range with optional filtering.

**Parameters:**
- `startDate` (string): Start date in YYYY-MM-DD format  
- `endDate` (string, optional): End date, defaults to startDate
- `issueKey` (string, optional): Filter by specific issue key

**Example Usage:**
```
"Get my July hours"
→ Returns: Total: 184h (23 entries)
          • PROJ-1234: 184.0h (23 entries)

"Show me my worklogs for PROJ-1234 in July"  
→ Filters results to specific issue
```

### 2. `post_worklog` - Log Single Entry

Create a new worklog entry for a specific issue and date.

**Parameters:**
- `issueKey` (string): JIRA issue key (e.g., "PROJ-1234")
- `hours` (number): Hours worked (decimal, 0.1-24)
- `startDate` (string): Date in YYYY-MM-DD format
- `endDate` (string, optional): End date for multi-day entries
- `billable` (boolean, optional): Whether time is billable (default: true)
- `description` (string, optional): Work description

**Example Usage:**
```
"Log 8 hours to PROJ-1234 for July 10th"
→ Returns: ✅ Worklog Created Successfully
          Issue: PROJ-1234 - Example Project Task
          Hours: 8h
          Date: 2025-07-10
          Worklog ID: 1211549
```

### 3. `bulk_post_worklogs` - Create Multiple Entries

Create multiple worklog entries efficiently with concurrent processing.

**Parameters:**
- `worklogs` (array): Array of worklog objects:
  - `issueKey` (string): JIRA issue key
  - `hours` (number): Hours worked  
  - `date` (string): Date in YYYY-MM-DD format
  - `description` (string, optional): Work description
- `billable` (boolean, optional): Whether time is billable for all entries

**Example Usage:**
```
"Post 8 hours a day every weekday from July 11 to 15 on PROJ-1234"
→ Returns: ✅ Bulk Worklog Creation Started
          Processing 3 worklog entries...
          ✅ Successful: 3
          ❌ Failed: 0
          📊 Total Hours: 24

"Fill all weekdays in July with 8 hours on PROJ-1234"
→ Creates 23 entries for all weekdays in the month
```

### 4. `delete_worklog` - Remove Entry

Delete an existing worklog entry by ID.

**Parameters:**
- `worklogId` (string): Tempo worklog ID to delete

**Example Usage:**
```
"Delete worklog with ID 1211547"
→ Removes the specified worklog entry
```

## Example Interactions

### Viewing Your Time Logs
```
"Get my July hours"
→ Returns a summary of all worklogs for July with totals by issue and date

"Show me my worklogs for July 2025"  
→ Uses get_worklogs to retrieve detailed worklog information

"What did I work on last week?"
→ Fetches worklogs for the previous week with issue breakdown
```

### Creating Single Worklog Entries
```
"Log 8 hours to PROJ-1234 for July 10th"
→ Creates a single worklog entry:
   ✅ Issue: PROJ-1234 - Example Project Task
   ✅ Hours: 8h (billable)
   ✅ Date: 2025-07-10
   ✅ Worklog ID: 1211549

"Post 6.5 hours on PROJ-123 for today with description 'Bug fixes and testing'"
→ Uses post_worklog with custom description
```

### Bulk Worklog Creation
```
"Post 8 hours a day every weekday from July 11 to 15 on PROJ-1234"
→ Creates 5 worklog entries (skips weekends):
   ✅ July 11 (Friday): 8h
   ✅ July 14 (Monday): 8h  
   ✅ July 15 (Tuesday): 8h
   Total: 24 hours across 3 weekdays

"Fill my timesheet for this week - 4 hours PROJ-1111 and 4 hours PROJ-2222 each day"
→ Uses bulk_post_worklogs with multiple issues per day

"Finish filling up the days until July 31st"
→ Automatically fills remaining weekdays in the month
```

### Advanced Bulk Operations
```
"Log time for the entire month of July:
- PROJ-1234: 8 hours every weekday  
- Skip weekends
- All time should be billable"
→ Creates 22 worklog entries for all weekdays in July

"Fill my Q2 timesheet with 8 hours daily split between:
- 60% on PROJ-1234 (development)
- 40% on PROJ-5678 (meetings)"
→ Calculates hours and creates entries for the quarter
```

### Worklog Management
```
"Delete worklog with ID 1211547"
→ Removes the specified worklog entry

"Show me a summary of my July hours by issue"
→ Groups worklogs by issue with totals and percentages
```

## Real-World Usage Examples

Based on successful implementation, here are practical scenarios:

### Daily Time Logging
```bash
# Using VS Code with GitHub Copilot:
User: "Log 8 hours on PROJ-1234 for today"
AI: ✅ Worklog Created Successfully
    Issue: PROJ-1234 - Example Project Task
    Hours: 8h
    Date: 2025-08-01
    Worklog ID: 1211550
    Time Spent: 1d
```

### Monthly Time Filling  
```bash
# Bulk operation for entire month:
User: "Fill all weekdays in July with 8 hours on PROJ-1234"
AI: ✅ Bulk Worklog Creation Started
    Processing 23 worklog entries...
    ✅ Successful: 23
    ❌ Failed: 0  
    📊 Total Hours: 184
```

### Time Tracking Analysis
```bash
# Monthly summary:
User: "Get my July hours"
AI: 📊 Total Hours: 184 hours (23 entries)
    
    Breakdown by issue:
    • PROJ-1234: 184.0h (23 entries)
    
    Daily pattern: 8 hours per weekday
    Completion: 100% (all weekdays filled)
```

## Development

### Project Structure

```
src/
├── index.ts              # Main MCP server entry point
├── tempo-client.ts       # Tempo API client with PAT auth
├── tools/                # Tool implementations
│   ├── get-worklogs.ts
│   ├── post-worklog.ts
│   ├── bulk-post.ts
│   └── delete-worklog.ts
└── types/                # TypeScript type definitions
    ├── tempo.ts
    ├── mcp.ts
    └── index.ts
```

### Build Commands

- `npm run build`: Compile TypeScript to JavaScript
- `npm run dev`: Build and run the server
- `npm run typecheck`: Type checking without compilation

### Testing

The server can be tested using the MCP Inspector or by integrating with compatible AI assistants.

## Security

- Personal Access Tokens are used for secure authentication
- No credentials are logged or exposed
- Input validation is performed on all parameters
- Rate limiting and error handling protect against API abuse

## API Compatibility

This server is compatible with:
- JIRA Core/Software 8.14+
- Tempo Timesheets 4.x
- Model Context Protocol specification

## Troubleshooting

### Authentication Issues
- Verify your Personal Access Token is valid and has proper permissions
- Check that your JIRA instance URL is correct
- Ensure Tempo is properly installed and configured in your JIRA instance

### Connection Issues
- Verify network connectivity to your JIRA instance
- Check firewall and proxy settings
- Confirm the JIRA instance is accessible from your environment

### Permission Issues
- Ensure your user account has permission to log time to the specified issues
- Verify Tempo is configured to allow time logging for your user
- Check project permissions in JIRA

## License

ISC License - see package.json for details

## Contributing

Contributions are welcome! Please follow the existing code style and ensure all tools work correctly with real Tempo API endpoints.