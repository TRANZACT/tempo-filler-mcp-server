# Spec: Tempo Filler MCP v1

This document specifies the implementation of a Model Context Protocol (MCP) server for interacting with Tempo (Atlassian JIRA's time tracking plugin). The server will provide AI assistants with the ability to retrieve and manage worklogs programmatically.

## Overview

The Tempo Filler MCP server will bridge AI applications (like Claude, GitHub Copilot, etc.) with the Tempo API, enabling:

- Retrieval of existing worklogs
- Creation of new worklog entries
- Worklog management and bulk operations
- Time tracking analysis and reporting

## Technical Architecture

### MCP Server Framework

- **Language**: TypeScript
- **SDK**: `@modelcontextprotocol/sdk` (latest version)
- **Transport**: stdio (primary), with optional HTTP support
- **Node.js**: v18+ required

### Authentication

The Tempo API uses Personal Access Token (PAT) authentication:

- Personal Access Token: Bearer token created in JIRA/Confluence user profile
- Base URL: Configurable JIRA instance URL (e.g., `https://jira.company.com`)
- Authentication Header: `Authorization: Bearer <token>`

PATs are more secure than username/password combinations and can be easily revoked if compromised. They require JIRA Core/Software 8.14+ or Confluence 7.9+.

**Note**: The current C# implementation uses Basic Authentication, but the MCP server should implement PAT authentication as the preferred method for better security.

## Core Components

### 1. Tools (Actions)

#### `get_worklogs`

Retrieve worklogs for a user and date range.

**Input Schema:**

```typescript
{
  user: string;           // JIRA username
  startDate: string;      // ISO date (YYYY-MM-DD)
  endDate?: string;       // ISO date, defaults to startDate
  issueKey?: string;      // Optional filter by specific issue
}
```

**Output:**

```typescript
{
  worklogs: Array<{
    id: string;
    issueKey: string;
    issueSummary: string;
    timeSpentSeconds: number;
    billableSeconds: number;
    started: string;        // ISO datetime (e.g., "2025-07-02 00:00:00.000")
    worker: string;
    attributes: object;
    timeSpent: string;      // Human readable format (e.g., "4h", "1d")
  }>;
  totalHours: number;
}
```

#### `post_worklog`

Create a new worklog entry.

**Input Schema:**

```typescript
{
  issueKey: string;       // e.g., "PROJ-1234" (will be resolved to numerical ID)
  hours: number;          // Hours worked (decimal)
  startDate: string;      // ISO date (YYYY-MM-DD)
  endDate?: string;       // ISO date, defaults to startDate
  worker?: string;        // Defaults to authenticated user
  billable?: boolean;     // Defaults to true
  description?: string;   // Work description
}
```

**Implementation Notes:**

- Must first fetch the JIRA issue details using the issueKey to get the numerical issue ID
- Use the numerical ID as `originTaskId` in the Tempo API call

#### `bulk_post_worklogs`

Create multiple worklog entries from a structured format.

**Input Schema:**

```typescript
{
  worklogs: Array<{
    issueKey: string;       // e.g., "PROJ-1234"
    hours: number;          // Hours worked (decimal)
    date: string;           // ISO date (YYYY-MM-DD)
    description?: string;   // Optional work description
  }>;
  worker?: string;        // Defaults to authenticated user
  billable?: boolean;     // Defaults to true (applies to all entries)
}
```

**Implementation Notes:**

- Process each worklog entry in the array
- Resolve each unique issue key to its numerical ID via JIRA API
- Create worklog entries using the numerical IDs
- Handle concurrent API calls efficiently (as shown in C# notebook with Task.WhenAll)
- Return aggregated results showing daily totals by issue

#### `delete_worklog`

Delete an existing worklog entry.

**Input Schema:**

```typescript
{
  worklogId: string;      // Tempo worklog ID
}
```

### 2. Resources (Data Access)

#### `tempo://user/{username}/worklogs/{month}`

Provides access to worklog data for a specific user and month.

**URI Template:** `tempo://user/{username}/worklogs/{month}`

- `username`: JIRA username
- `month`: YYYY-MM format

**Content:** JSON representation of all worklogs for the specified period.

#### `tempo://issues/recent`

Provides a list of recently used issue keys for quick reference.

**Content:** Array of issue objects with key and summary.

### 3. Prompts (Templates)

#### `worklog_summary`

Generates a prompt for analyzing worklog data.

**Arguments:**

```typescript
{
  username: string;
  month: string;
  includeAnalysis?: boolean;
}
```

**Generated Prompt:**

```
Analyze the worklog data for {username} in {month}. 
Provide insights about:
- Total hours worked
- Distribution across projects
- Daily patterns
- Missing days or potential gaps
```

#### `bulk_entry_helper`

Assists with creating bulk worklog entries.

**Arguments:**

```typescript
{
  startDate: string;      // ISO date (YYYY-MM-DD)
  endDate: string;        // ISO date (YYYY-MM-DD) 
  projectKeys?: string[]; // Suggested issue keys
  defaultHours?: number;  // Default hours per day (8)
}
```

**Generated Prompt:**

```
Help create bulk worklog entries for the period {startDate} to {endDate}.
Generate an array of worklog objects with:
- Issue keys from available projects: {projectKeys}
- Default hours per day: {defaultHours}
- Proper date distribution across the period
- Consider weekdays vs weekends
```

## Implementation Details

### Project Structure

```
tempo-filler-mcp/
├── src/
│   ├── index.ts           # Main server entry point
│   ├── server.ts          # MCP server setup
│   ├── tempo-client.ts    # Tempo API client
│   ├── tools/             # Tool implementations
│   │   ├── get-worklogs.ts
│   │   ├── post-worklog.ts
│   │   ├── bulk-post.ts
│   │   └── delete-worklog.ts
│   ├── resources/         # Resource handlers
│   │   ├── user-worklogs.ts
│   │   └── recent-issues.ts
│   ├── prompts/           # Prompt templates
│   │   ├── worklog-summary.ts
│   │   └── bulk-entry-helper.ts
│   └── types/            # TypeScript type definitions
│       ├── tempo.ts
│       └── mcp.ts
├── package.json
├── tsconfig.json
└── README.md
```

### Workflow Patterns

Based on the successful C# implementation, key patterns include:

1. **Bulk Operations**: Process multiple worklog entries concurrently using Promise.all()
2. **Issue Resolution**: Cache resolved issue IDs to avoid repeated API calls
3. **Date Handling**: Support both single dates and date ranges for flexible time entry
4. **Time Formats**: Accept decimal hours input, convert to seconds for API
5. **Result Aggregation**: Provide daily summaries and totals for analysis

### Dependencies

```json
{
  "@modelcontextprotocol/sdk": "^1.17.0",
  "zod": "^3.22.0",
  "axios": "^1.6.0",
  "date-fns": "^3.0.0"
}
```

### Type Definitions

Key TypeScript interfaces based on API responses:

```typescript
// JIRA Issue response structure
interface JiraIssue {
  id: string;           // Numerical ID (as string)
  key: string;          // Issue key (e.g., "PROJ-1234")
  fields: {
    summary: string;
    // ... other fields
  };
}

// Tempo API response structure (actual from API)
interface TempoWorklogResponse {
  billableSeconds: number;    // Time in seconds (e.g., 14400 for 4 hours)
  timeSpent: string;         // Human readable (e.g., "4h", "1d")
  issue: {
    summary: string;         // Issue title/description
    key: string;            // Issue key (e.g., "PROJ-1234")
  };
  started: string;          // ISO datetime string (e.g., "2025-07-02 00:00:00.000")
}

// Processed worklog structure for MCP responses
interface TempoWorklog {
  id: string;
  issueKey: string;
  issueSummary: string;
  timeSpentSeconds: number;
  billableSeconds: number;
  started: string;
  worker: string;
  attributes: object;
  timeSpent: string;        // Human readable format from API
}
```

### Configuration

The server will accept configuration through environment variables:

- `TEMPO_BASE_URL`: JIRA instance URL
- `TEMPO_PAT`: Personal Access Token for authentication
- `TEMPO_DEFAULT_HOURS`: Default hours per workday (8)

### Error Handling

- Implement proper error responses for authentication failures (401 Unauthorized)
- Handle API rate limiting gracefully
- Provide clear error messages for invalid input formats
- Handle PAT expiration scenarios
- Handle invalid or non-existent issue keys (404 Not Found from JIRA API)
- Implement retry logic for issue resolution failures
- Log errors for debugging while maintaining security
- Handle concurrent API calls and potential race conditions
- Validate issue existence before bulk operations

### Security Considerations

- Never log or expose PAT credentials
- Validate all input parameters
- Implement proper authentication checks using Bearer tokens
- Use secure credential storage patterns
- PATs can be easily revoked if compromised
- Consider implementing token expiration monitoring

## API Endpoints Reference

Based on the existing C# implementation, the server will interact with these Tempo endpoints using PAT authentication:

### Get Issue Details

```
GET /rest/api/latest/issue/{issueKey}
Authorization: Bearer <your-personal-access-token>
```

### Post Worklog

**Note**: The `originTaskId` requires the numerical JIRA issue ID, not the issue key. First fetch the issue details to get the ID.

```
POST /rest/tempo-timesheets/4/worklogs/
Content-Type: application/json
Authorization: Bearer <your-personal-access-token>

{
  "attributes": {},
  "billableSeconds": {timeInSeconds},
  "worker": "{username}",
  "started": "{startDate}T00:00:00.000",
  "timeSpentSeconds": {timeInSeconds},
  "originTaskId": "{issueId}",
  "remainingEstimate": null,
  "endDate": "{endDate}T00:00:00.000"
}
```

**Process Flow**:

1. GET `/rest/api/latest/issue/{issueKey}` to retrieve the numerical issue ID
2. POST to `/rest/tempo-timesheets/4/worklogs/` using the ID as `originTaskId`

### Get Worklogs

```
GET /rest/tempo-timesheets/4/worklogs/
Authorization: Bearer <your-personal-access-token>
```

**Response Structure** (based on actual API):

```json
[
  {
    "billableSeconds": 14400,
    "timeSpent": "4h",
    "issue": {
      "summary": "PTO",
      "key": "PROJ-1234"
    },
    "started": "2025-07-02 00:00:00.000"
  }
]
```

## Testing Strategy

### Unit Tests

- Test each tool implementation independently
- Mock Tempo API responses
- Validate input/output schemas

### Integration Tests

- Test with actual Tempo API (staging environment)
- Validate MCP protocol compliance
- Test PAT authentication flows and error handling
- Test PAT expiration scenarios

### MCP Client Testing

- Use GitHub Copilot for primary integration testing
- Test with MCP Inspector for debugging
- Validate tool discoverability and execution
- Test with Claude Desktop as secondary client for compatibility

## Usage Examples

### Configuration in GitHub Copilot

The MCP server will be configured in VS Code settings for GitHub Copilot integration:

```json
{
  "github.copilot.chat.mcp.servers": {
    "tempo-filler": {
      "command": "node",
      "args": ["dist/index.js"],
      "env": {
        "TEMPO_BASE_URL": "https://jira.company.com",
        "TEMPO_PAT": "your-personal-access-token"
      }
    }
  }
}
```

### Configuration in Claude Desktop (Alternative)

For testing and alternative usage:

```json
{
  "mcpServers": {
    "tempo-filler": {
      "command": "node",
      "args": ["dist/index.js"],
      "env": {
        "TEMPO_BASE_URL": "https://jira.company.com",
        "TEMPO_PAT": "your-personal-access-token"
      }
    }
  }
}
```

### AI Assistant Interactions

```
Human: "Show me my worklogs for this month"
GitHub Copilot: [Uses get_worklogs tool with current month]
Human: 'Post 8 hours to PROJ-1234 for today'
GitHub Copilot: [Uses post_worklog tool with specified parameters]

Human: 'Post 8 hours to PROJ-1234 for today'
GitHub Copilot: [Uses post_worklog tool with specified parameters]
Human: 'Fill my timesheet for this week - 4 hours PROJ-1111 and 4 hours PROJ-2222 each day'
GitHub Copilot: [Uses bulk_post_worklogs tool with array of worklog entries]
`

### Sample Tool Calls

#### Getting Worklogs
`json
{
  "tool": "get_worklogs",
  "arguments": {
    "user": "john.doe",
    "startDate": "2025-08-01",
    "endDate": "2025-08-31"
  }
}
`

#### Posting a Worklog
```json
{
  "tool": "post_worklog",
  "arguments": {
    "issueKey": "PROJ-1234",
    "hours": 8,
    "startDate": "2025-08-01",
    "worker": "john.doe"
  }
}
```

#### Bulk Posting Worklogs

```json
{
  "tool": "bulk_post_worklogs",
  "arguments": {
    "worklogs": [
      {
        "issueKey": "PROJ-1111",
        "hours": 4,
        "date": "2025-08-01",
        "description": "Morning development work"
      },
      {
        "issueKey": "PROJ-2222",
        "hours": 4,
        "date": "2025-08-01",
        "description": "Afternoon testing"
      },
      {
        "issueKey": "PROJ-1111",
        "hours": 8,
        "date": "2025-08-02"
      }
    ],
    "worker": "john.doe",
    "billable": true
  }
}
```

## Implementation Priority

### Phase 1: Core Functionality

1. Basic MCP server setup with stdio transport
2. Tempo API client with authentication
3. get_worklogs tool implementation
4. post_worklog tool implementation
5. Basic error handling and validation

### Phase 2: Advanced Features

1. Bulk_post_worklogs tool implementation
2. Resource providers for worklog data
3. Prompt templates for worklog analysis
4. delete_worklog tool implementation

### Phase 3: Enhancements

1. HTTP transport support
2. Advanced error handling and retry logic
3. Caching for frequently accessed data
4. Additional prompt templates
5. Performance optimizations

## Success Criteria

The MCP server implementation will be considered successful when:

1. **Functional Requirements:**
   - All specified tools work correctly with real Tempo API
   - Proper authentication and error handling
   - Bulk worklog operations work as expected
   - Resource providers return accurate data

2. **Integration Requirements:**
   - Successfully integrates with GitHub Copilot
   - Works with other MCP-compatible clients (Claude Desktop, etc.)
   - Passes MCP Inspector validation
   - Proper tool discovery and execution

3. **Quality Requirements:**
   - Comprehensive test coverage (>80%)
   - Type safety with no any types
   - Proper documentation and examples
   - Security best practices followed

## References

- **Tempo.dib**: C# Polyglot Notebook demonstrating Tempo API usage
- **tempo-filler-cli-reference.md**: Previous CLI implementation reference
- **MCP Specification**: [https://modelcontextprotocol.io/](https://modelcontextprotocol.io/)
- **MCP Node.js Server Quickstart**: [https://modelcontextprotocol.io/quickstart/server#node](https://modelcontextprotocol.io/quickstart/server#node)
- **TypeScript SDK**: [https://github.com/modelcontextprotocol/typescript-sdk](https://github.com/modelcontextprotocol/typescript-sdk)
- **Tempo API Documentation**: [https://apidocs.tempo.io/tempo-openapi.yaml](https://apidocs.tempo.io/tempo-openapi.yaml)
- **JIRA API Documentation**: [https://developer.atlassian.com/cloud/jira/platform/rest/v3/intro/](https://developer.atlassian.com/cloud/jira/platform/rest/v3/intro/)
