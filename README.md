# Tempo Filler MCP Server

A Model Context Protocol (MCP) server for managing Tempo worklogs in JIRA. This server enables AI assistants to interact with Tempo's time tracking system, allowing for worklog retrieval, creation, bulk operations, and management.

## Table of Contents

- [Quick Start](#quick-start)
- [How This Was Built](#how-this-was-built)
- [Features](#features)
- [Installation](#installation)
- [Configuration](#configuration)
- [Usage with AI Assistants](#usage-with-ai-assistants)
- [Available Tools](#available-tools)
- [Example Interactions](#example-interactions)
- [Real-World Usage Examples](#real-world-usage-examples)
- [Development](#development)
- [Security](#security)
- [API Compatibility](#api-compatibility)
- [Troubleshooting](#troubleshooting)
- [License](#license)
- [Contributing](#contributing)

## Quick Start

**The fastest way to get started is with npx** - no installation required!

1. **Set up your environment variables**:

   ```bash
   export TEMPO_BASE_URL="https://your-jira-instance.com"
   export TEMPO_PAT="your-personal-access-token"
   ```

2. **Configure your AI assistant** to use the npx command:

   ```json
   {
     "mcpServers": {
       "tempo-filler": {
         "command": "npx",
         "args": ["@tranzact/tempo-filler-mcp-server"],
         "env": {
           "TEMPO_BASE_URL": "https://your-jira-instance.com",
           "TEMPO_PAT": "your-personal-access-token"
         }
       }
     }
   }
   ```

3. **That's it!** Your AI assistant can now manage your Tempo worklogs.

### Alternative: Local Installation

If you prefer to install locally or need to customize the code:

1. **Install globally**:

   ```bash
   npm install -g @tranzact/tempo-filler-mcp-server
   ```

2. **Or clone and build from source**:

   ```bash
   git clone https://github.com/TRANZACT/TempoFiller.git
   cd TempoFiller
   npm install && npm run build
   ```

3. **Configure your AI assistant** with local installation:

   ```json
   {
     "mcpServers": {
       "tempo-filler": {
         "command": "tempo-filler-mcp-server",
         "env": {
           "TEMPO_BASE_URL": "https://jira.company.com",
           "TEMPO_PAT": "your-personal-access-token"
         }
       }
     }
   }
   ```

4. **Test it**: Ask your AI assistant "Get my worklogs for this week"

## How This Was Built

This MCP server was built in just **3 hours** using AI-powered development tools, demonstrating the power of modern AI-assisted coding:

### Development Timeline

1. **Specification Phase**
   - Created the complete technical specification using **GitHub Copilot** with **Claude Sonnet 4**
   - Defined all API endpoints, data structures, and tool interfaces
   - Refined requirements through iterative conversation

2. **Implementation Phase**
   - Used **VS Code** with **Claude Code** to one-shot the entire implementation
   - Generated complete TypeScript codebase, tool implementations, and client logic
   - Implemented all core functionality in a single AI-assisted session

3. **Refinement Phase**
   - Switched back to **GitHub Copilot** with **Claude Sonnet 4** after hitting usage limits in **Claude Code**
   - Fixed API payload formatting and authentication issues
   - Debugged and polished the Tempo API integration

### Key Success Factors

- **Clear specification first**: Having a detailed spec enabled effective one-shot implementation
- **AI tool synergy**: Different AI tools excelled at different phases of development
- **Iterative refinement**: Quick feedback loops with AI assistants for debugging

This project showcases how AI-powered development can dramatically accelerate the creation of robust, production-ready tools.

## Features

- **Get Worklogs**: Retrieve worklogs for users with date range and issue filtering
- **Create Worklogs**: Add single worklog entries with automatic issue resolution
- **Bulk Operations**: Create multiple worklog entries efficiently using concurrent processing
- **Delete Worklogs**: Remove existing worklog entries
- **Resource Access**: Browse worklog data and recent issues
- **Prompt Templates**: Generate analysis prompts for worklog data

## Installation

### Prerequisites

- **Node.js** (version 16 or higher)
- A **JIRA instance** with **Tempo Timesheets** plugin installed
- **Personal Access Token** for your JIRA account

### NPX Usage (Recommended)

The easiest way to use the server is with npx - no installation required:

```bash
# Test that it works
npx @tranzact/tempo-filler-mcp-server --help
```

Just configure your AI assistant to use `npx @tranzact/tempo-filler-mcp-server` as the command.

### Global Installation

If you prefer to install globally:

```bash
npm install -g @tranzact/tempo-filler-mcp-server

# Verify installation
tempo-filler-mcp-server --help
```

### Development Setup (Source)

For development or customization:

1. **Clone the repository**:

   ```bash
   git clone https://github.com/TRANZACT/TempoFiller.git
   cd TempoFiller
   ```

2. **Install dependencies and build**:

   ```bash
   npm install && npm run build
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

### GitHub Copilot Configuration

Add to your MCP servers configuration (typically in VS Code settings):

```json
{
  "github.copilot.chat.mcp.servers": {
    "tempo-filler": {
      "command": "npx",
      "args": ["@tranzact/tempo-filler-mcp-server"],
      "env": {
        "TEMPO_BASE_URL": "https://your-jira-instance.com",
        "TEMPO_PAT": "your-personal-access-token"
      }
    }
  }
}
```

### Claude Desktop Configuration

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "tempo-filler": {
      "command": "npx", 
      "args": ["@tranzact/tempo-filler-mcp-server"],
      "env": {
        "TEMPO_BASE_URL": "https://your-jira-instance.com",
        "TEMPO_PAT": "your-personal-access-token"
      }
    }
  }
}
```

### Alternative: Local Installation

If you have the package installed globally or built from source:

```json
{
  "mcpServers": {
    "tempo-filler": {
      "command": "tempo-filler-mcp-server",
      "env": {
        "TEMPO_BASE_URL": "https://your-jira-instance.com",
        "TEMPO_PAT": "your-personal-access-token"
      }
    }
  }
}
```

### Or with Node.js directly (development):

```json
{
  "mcpServers": {
    "tempo-filler": {
      "command": "node", 
      "args": ["/full/path/to/tempo-filler-mcp-server/dist/index.js"],
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
2. **Find the full path** to your `dist/index.js` file:

   ```bash
   # Get the full path (use pwd on macOS/Linux, cd on Windows)
   pwd  # Should show something like /Users/yourname/tempo-filler-mcp-server
   ```

3. **Add configuration** to your AI assistant (use the full path + `/dist/index.js`)
4. **Restart** your AI assistant to load the MCP server
5. **Test the connection**: Ask "Get my worklogs for this week"

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

### NPX Issues (Recommended Installation)

**NPX command not found or fails:**

- Ensure you have Node.js 16+ installed: `node --version`
- Update npm: `npm install -g npm@latest`
- Try with explicit version: `npx @tranzact/tempo-filler-mcp-server@latest`
- Clear npx cache: `npx --yes @tranzact/tempo-filler-mcp-server`

**Server takes too long to start with npx:**

- The first run downloads the package, subsequent runs are faster
- Consider global installation for better performance: `npm install -g @tranzact/tempo-filler-mcp-server`

**Permission errors with npx:**

- On macOS/Linux, ensure user has write permissions to npm directories
- Try: `npm config set prefix ~/.npm-global` and add to PATH

### AI Assistant Integration Issues

**AI Assistant not loading the server:**

- Restart your AI assistant completely after adding the configuration
- Verify JSON syntax in configuration files
- Check that environment variables are set correctly
- For npx usage, ensure the command is exactly `npx` with args `["@tranzact/tempo-filler-mcp-server"]`

**Configuration Examples Not Working:**

- For Claude Desktop: Configuration file location varies by OS
  - Windows: `%APPDATA%/Claude/claude_desktop_config.json`
  - macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
  - Linux: `~/.config/claude/claude_desktop_config.json`

### Local Installation Issues

**Server not found / Path issues (local installation):**

- Use full absolute paths when configuring with `node` command
- Verify the file exists: `ls dist/index.js` (should show the file)
- For global installation, verify binary is in PATH: `which tempo-filler-mcp-server`

**Build failures:**

- Check Node.js version: `node --version` (should be 16+)
- Clear cache and retry: `npm cache clean --force && npm install && npm run build`
- Check for error messages in the build output
- Verify environment variables are set correctly

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
