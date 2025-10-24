# Product Specification: GET Schedule Tool

## Purpose & Scope

### Overview
The GET Schedule tool enables AI assistants to retrieve user work schedule information from Tempo, providing essential context for intelligent worklog management. This tool identifies working days, non-working days, and expected hours per day, enabling smart time entry workflows that respect organizational work schedules.

### Target Users
- **Primary**: AI assistants (Claude, GitHub Copilot) acting on behalf of users
- **End Users**: Knowledge workers who need to log time in Tempo according to their work schedules
- **Use Cases**: Time entry planning, bulk worklog creation, schedule-aware time tracking

### Intended Outcomes
- Enable intelligent worklog creation that respects work schedules
- Prevent users from accidentally logging time on non-working days
- Provide schedule context for accurate time entry planning
- Support automated bulk time filling based on actual work schedules

## Functionality

### Core Feature
Retrieve work schedule information for the authenticated user within a specified date range, showing:
- Working days vs non-working days
- Expected hours per working day
- Total working days and required hours for the period
- Schedule summary with clear date formatting

### User Interactions
Users interact through natural language requests to AI assistants:
- "What's my work schedule for October 2025?"
- "Show me working days this week"
- "How many hours should I log for this month?"
- "Check my schedule before filling my timesheet"

### Workflow Integration
The schedule tool integrates seamlessly with existing worklog tools:
1. **Pre-worklog Analysis**: Check schedule before creating time entries
2. **Smart Bulk Creation**: Use schedule data to create accurate bulk worklogs
3. **Time Planning**: Understand capacity and requirements for planning
4. **Schedule Validation**: Verify working patterns before time entry

### Response Format
- **Hybrid Date Display**: ISO dates with human-readable format (e.g., "2025-10-01 (Tuesday, October 1st, 2025)")
- **Clear Status Indicators**: Working days vs non-working days with expected hours
- **Period Summary**: Total working days, total required hours, average daily hours
- **Concise Presentation**: User-friendly markdown formatting consistent with other tools

## Requirements & Constraints

### Functional Requirements
- **FR1**: Retrieve schedule data for authenticated user within specified date range
- **FR2**: Display working days with expected hours and non-working days with zero hours
- **FR3**: Show period summary including total working days and required hours
- **FR4**: Use consistent date formatting matching existing `get_worklogs` tool
- **FR5**: Support date range queries (start date to end date)
- **FR6**: Provide clear visual distinction between working and non-working days

### Non-Functional Requirements
- **NFR1**: Response time under 3 seconds for typical monthly queries
- **NFR2**: Consistent error handling and user feedback
- **NFR3**: Secure authentication using existing PAT-based system
- **NFR4**: Integration with existing MCP tool architecture
- **NFR5**: Cross-platform compatibility (Windows, macOS, Linux)

### Technical Constraints
- **TC1**: Must use Tempo Core API v2 (`/rest/tempo-core/2/user/schedule/search`)
- **TC2**: Requires same authentication mechanism as existing tools (PAT)
- **TC3**: Must integrate with existing TempoClient architecture
- **TC4**: Input validation using Zod schemas consistent with other tools
- **TC5**: Error handling consistent with existing tool patterns

### Regulatory/Business Constraints
- **BC1**: User can only access their own schedule data
- **BC2**: Must respect organization's privacy and security policies
- **BC3**: Schedule data should not be cached due to potential changes
- **BC4**: Must handle different time zones and work pattern configurations

## Implementation Tasks

### High-Level Implementation Tasks
1. **API Integration**
   - Integrate Tempo Core API v2 schedule search endpoint
   - Add schedule-related types to existing type definitions
   - Implement schedule data retrieval in TempoClient

2. **Tool Development**
   - Create `get_schedule` tool following existing tool patterns
   - Implement input validation with Zod schemas
   - Add comprehensive error handling and user feedback

3. **Response Formatting**
   - Develop schedule display formatting with hybrid dates
   - Create working/non-working day indicators
   - Implement period summary calculations

4. **MCP Integration**
   - Register tool with MCP server
   - Add tool description and input schema
   - Ensure proper request/response handling

5. **Quality Assurance**
   - Test with various date ranges and work patterns
   - Validate error scenarios and edge cases
   - Ensure cross-platform compatibility

6. **Documentation**
   - Update README with new tool documentation
   - Add usage examples and configuration guidance
   - Update PROJECT_UNDERSTANDING.md with new capability

## Acceptance Criteria

### Core Functionality
- **AC1**: Tool successfully retrieves schedule data for valid date ranges
- **AC2**: Response clearly shows working vs non-working days with expected hours
- **AC3**: Date format matches existing `get_worklogs` tool (hybrid ISO + human-readable)
- **AC4**: Period summary accurately calculates total working days and hours
- **AC5**: Error handling provides clear, actionable feedback for common issues

### User Experience
- **AC6**: Natural language queries through AI assistants work intuitively
- **AC7**: Response format is readable and actionable for time planning
- **AC8**: Tool integrates smoothly with existing worklog creation workflows
- **AC9**: Response time is consistently under 3 seconds for monthly queries

### Technical Requirements
- **AC10**: Uses existing PAT authentication without requiring new credentials
- **AC11**: Follows MCP protocol standards and integrates with existing server
- **AC12**: Input validation prevents invalid requests and provides helpful errors
- **AC13**: Works consistently across Windows, macOS, and Linux platforms

### Quality Standards
- **AC14**: Code follows existing project patterns and TypeScript standards
- **AC15**: Error scenarios are handled gracefully with helpful user guidance
- **AC16**: Tool description and schema are clear for AI assistant integration
- **AC17**: No security vulnerabilities or credential exposure

## Usage Examples

### Basic Schedule Query
```
User Request: "What's my work schedule for October 2025?"
AI Assistant: [Uses get_schedule tool with date range 2025-10-01 to 2025-10-31]

Expected Response:
## Work Schedule (2025-10-01 to 2025-10-31)

**Period Summary:**
- Total Days: 31
- Working Days: 23
- Non-Working Days: 8
- Total Required Hours: 184h
- Average Daily Hours: 8h

**Schedule Details:**
• 2025-10-01 (Wednesday, October 1st, 2025): 8h (Working Day)
• 2025-10-02 (Thursday, October 2nd, 2025): 8h (Working Day)
• 2025-10-03 (Friday, October 3rd, 2025): 8h (Working Day)
• 2025-10-04 (Saturday, October 4th, 2025): - (Non-Working Day)
• 2025-10-05 (Sunday, October 5th, 2025): - (Non-Working Day)
[... continues for all days in range]
```

### Pre-Worklog Planning
```
User Request: "Check my schedule this week before I fill my timesheet"
AI Assistant: [Uses get_schedule tool, then provides planning guidance]

Expected Response:
Based on your schedule, you have 5 working days this week requiring 40 total hours:
- Monday through Friday: 8h each (Working Days)
- Saturday-Sunday: Non-working days

You can now proceed with bulk time entry for your working days.
```

### Integration with Bulk Worklog Creation
```
User Request: "Fill all my working days in November with 8 hours on PROJ-1234"
AI Assistant: [First uses get_schedule tool to identify working days, then uses bulk_post_worklogs]

Workflow:
1. Retrieve November schedule to identify 22 working days
2. Create bulk worklog entries only for working days
3. Skip non-working days automatically
4. Provide confirmation with schedule-aware summary
```

## Integration with Existing Project

### Alignment with Current Architecture
- **Authentication**: Uses existing PAT-based authentication system
- **Client Integration**: Extends TempoClient with schedule retrieval capabilities
- **Type System**: Adds schedule types to existing type definitions
- **Error Handling**: Follows established error handling patterns
- **Response Formatting**: Matches existing tool response formatting standards

### Compatibility with Existing Tools
- **get_worklogs**: Shares date formatting and display patterns
- **post_worklog**: Provides schedule validation before single entries
- **bulk_post_worklogs**: Enables schedule-aware bulk operations
- **delete_worklog**: Maintains consistency in tool behavior and responses

### Enhanced User Workflows
The schedule tool enables enhanced workflows:
1. **Schedule-First Planning**: Check schedule before any time entry
2. **Smart Bulk Creation**: Automatically exclude non-working days
3. **Capacity Planning**: Understand total hours required for periods
4. **Validation**: Prevent accidental time entry on non-working days

This specification ensures the GET Schedule tool integrates seamlessly with the existing TempoFiller MCP Server while providing valuable schedule intelligence for improved time tracking workflows.