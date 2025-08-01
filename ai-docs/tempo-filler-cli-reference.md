# TempoFiller CLI (Legacy)

> **Note**: This was a CLI predecessor to the current MCP server. This documentation is maintained for historical reference only.

A command-line interface (CLI) tool that simplifies viewing, entering, and managing worklogs in Atlassian JIRA's Tempo plugin.

## Description

TempoFiller helps users log and manage their working hours against JIRA issues. The tool aims to reduce manual effort and improve the accuracy of time tracking by providing an efficient way to view existing worklogs and add new ones.

## Installation

Download the latest release from the [releases page](https://github.com/Tranzact/TempoFiller/releases) (replace with actual releases URL).

No installation needed - TempoFiller comes as a single executable file.

## Usage

```
tempo-filler [options]
```

### Options

- `-u <user>`: JIRA username (required in non-interactive mode)
- `-m <yyyy-MM>`: Specify the month for worklog retrieval (default: current month)
- `-w <worklogs>`: Worklogs in this format "1-15: PROJ-1111|PROJ-2222, 15: PROJ-3333, 16-30: PROJ-1111|PROJ-2222|PROJ-3333"
- `--confirm`: Skip confirmation prompt before posting worklogs
- `-h, --help`: Show help message and exit

### Example Usage

[start].\tempo-filler -u john.doe

[start].\tempo-filler -u john.doe -w "5-6: PROJ-1234, 9: PROJ-1234|PROJ-5678"



View worklogs for current month:
```
tempo-filler -u johndoe
```

View worklogs for specific month:
```
tempo-filler -u johndoe -m 2025-05
```

Add worklogs from a file:
```
tempo-filler -u johndoe -w "1-15: PROJ-1111|PROJ-2222, 15: PROJ-3333, 16-30: PROJ-1111|PROJ-2222|PROJ-3333"
```

## Worklog Input Format

The worklog input file uses a simple format to define which days to log work against which issues:
```
1-15: PROJ-1111|PROJ-2222, 15: PROJ-3333, 16-30: PROJ-1111|PROJ-2222|PROJ-3333
```

This example assigns work to:
- PROJ-1111 and PROJ-2222 for days 1-15
- PROJ-3333 for day 15
- PROJ-1111, PROJ-2222, and PROJ-3333 for days 16-30

When multiple issues are specified for the same day, the 8-hour workday is divided equally among them.

## Building from Source

To build from source:

1. Clone the repository
2. Build using .NET CLI:
   ```
   dotnet build
   ```
3. Publish self-contained executable:
   ```
   dotnet publish -c Release -r win-x64 -p:PublishSingleFile=true --self-contained
   ```

## License

[MIT License](LICENSE)
