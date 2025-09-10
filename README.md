# ⏰ Tempo Filler MCP Server

[![NPM Version](https://img.shields.io/npm/v/%40tranzact%2Ftempo-filler-mcp-server?style=for-the-badge)](https://www.npmjs.com/package/@tranzact/tempo-filler-mcp-server) [![Install in VS Code](https://img.shields.io/badge/VS_Code-Install_tempo--filler-0098FF?style=for-the-badge&logo=visualstudiocode&logoColor=ffffff)](vscode:mcp/install?%7B%22name%22%3A%22tempo-filler%22%2C%22type%22%3A%22stdio%22%2C%22command%22%3A%22npx%22%2C%22args%22%3A%5B%22%40tranzact%2Ftempo-filler-mcp-server%22%5D%2C%22env%22%3A%7B%22TEMPO_BASE_URL%22%3A%22%24%7Binput%3Atempo_base_url%7D%22%2C%22TEMPO_PAT%22%3A%22%24%7Binput%3Atempo_pat%7D%22%7D%7D) [![Install in Claude Desktop](https://img.shields.io/badge/claude_desktop-install_tempo--filler-0098FF?style=for-the-badge&logo=claude&logoColor=ffffff)](https://github.com/TRANZACT/tempo-filler-mcp-server/releases/download/v1.0.1/bundle.dxt)

A Model Context Protocol (MCP) server for managing Tempo worklogs in JIRA. This server enables AI assistants to interact with Tempo's time tracking system, allowing for worklog retrieval, creation, bulk operations, and management.

## 🚀 Quick Start

### Install in VS Code

[![Install in VS Code](https://img.shields.io/badge/VS_Code-Install_tempo--filler-0098FF?style=for-the-badge&logo=visualstudiocode&logoColor=ffffff)](vscode:mcp/install?%7B%22name%22%3A%22tempo-filler%22%2C%22type%22%3A%22stdio%22%2C%22command%22%3A%22npx%22%2C%22args%22%3A%5B%22%40tranzact%2Ftempo-filler-mcp-server%22%5D%2C%22env%22%3A%7B%22TEMPO_BASE_URL%22%3A%22%24%7Binput%3Atempo_base_url%7D%22%2C%22TEMPO_PAT%22%3A%22%24%7Binput%3Atempo_pat%7D%22%7D%7D)

### Install in Claude Desktop

[![Install in Claude Desktop](https://img.shields.io/badge/claude_desktop-install_tempo--filler-0098FF?style=for-the-badge&logo=claude&logoColor=ffffff)](https://github.com/TRANZACT/tempo-filler-mcp-server/releases/download/v1.0.1/bundle.dxt)

1. Download the MCP bundle first
2. Then go to settings → extensions and drag the file there to install.
3. Fill up the Tempo Base URL and PAT in the environment variables section.
4. Don't forget to **enable it**.

### Install Manually on your favorite AI Assistant

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

## 🛠️ How This Was Built

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

## ✨ Features

- **Get Worklogs**: Retrieve worklogs for users with date range and issue filtering
- **Create Worklogs**: Add single worklog entries with automatic issue resolution
- **Bulk Operations**: Create multiple worklog entries efficiently using concurrent processing
- **Delete Worklogs**: Remove existing worklog entries
- **Resource Access**: Browse worklog data and recent issues
- **Prompt Templates**: Generate analysis prompts for worklog data

## 📦 Installation

### Prerequisites

- **Node.js** (version 16 or higher)
- A **JIRA instance** with **Tempo Timesheets** plugin installed
- **Personal Access Token** for your JIRA account

### NPX (Recommended)

The easiest way to use the server is with npx - no installation required:

```bash
npx @tranzact/tempo-filler-mcp-server
```

Just configure your AI assistant to use `npx @tranzact/tempo-filler-mcp-server` as the command.

### Development Setup (Source)

For development or customization:

1. **Clone the repository**:

   ```bash
   git clone https://github.com/TRANZACT/tempo-filler-mcp-server
   cd TempoFiller
   ```

2. **Install dependencies and build**:

   ```bash
   npm install && npm run build
   ```

## ⚙️ Configuration

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

## 🛠️ Available Tools

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

## 🌎 Real-World Usage Examples

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

## 🤖 Development

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

## License

ISC License - see package.json for details

## Contributing

Contributions are welcome! Please follow the existing code style and ensure all tools work correctly with real Tempo API endpoints.
