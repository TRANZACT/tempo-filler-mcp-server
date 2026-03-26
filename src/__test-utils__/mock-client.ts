import type {
  IssueResolver,
  WorklogReader,
  WorklogWriter,
  WorklogDeleter,
  ScheduleReader,
  UserResolver,
} from "../types/index.js";
import type {
  JiraIssue,
  TempoWorklogResponse,
  TempoWorklogCreatePayload,
  TempoScheduleResponse,
  PostWorklogParams,
} from "../types/index.js";

export function createMockIssueResolver(overrides?: Partial<IssueResolver>): IssueResolver {
  return {
    getIssueById: async (_key: string): Promise<JiraIssue> => ({
      id: "100",
      key: _key,
      fields: { summary: "Mock issue" },
    }),
    ...overrides,
  };
}

export function createMockWorklogReader(overrides?: Partial<WorklogReader>): WorklogReader {
  return {
    getWorklogs: async (): Promise<TempoWorklogResponse[]> => [],
    ...overrides,
  };
}

export function createMockWorklogWriter(overrides?: Partial<WorklogWriter>): WorklogWriter {
  return {
    createWorklogPayload: async (params: PostWorklogParams): Promise<TempoWorklogCreatePayload> => ({
      attributes: {},
      billableSeconds: params.hours * 3600,
      timeSpentSeconds: params.hours * 3600,
      worker: "testuser",
      started: `${params.startDate}T00:00:00.000`,
      originTaskId: "100",
      endDate: `${params.endDate ?? params.startDate}T00:00:00.000`,
    }),
    createWorklog: async (_payload: TempoWorklogCreatePayload): Promise<TempoWorklogResponse> => ({
      id: "99",
      tempoWorklogId: 99,
      billableSeconds: 28800,
      timeSpentSeconds: 28800,
      timeSpent: "8h",
      attributes: {},
      issue: {
        id: 100,
        key: "PROJ-1234",
        summary: "Mock issue",
        internalIssue: false,
        issueStatus: "In Progress",
        reporterKey: "user1",
        estimatedRemainingSeconds: 0,
        components: [],
        issueType: "Story",
        projectId: 10,
        projectKey: "PROJ",
        iconUrl: "",
        versions: [],
      },
      originId: 1,
      worker: "testuser",
      updater: "testuser",
      started: "2026-03-01T00:00:00.000",
      originTaskId: 100,
      dateCreated: "2026-03-01T10:00:00.000",
      dateUpdated: "2026-03-01T10:00:00.000",
    }),
    ...overrides,
  };
}

export function createMockWorklogDeleter(overrides?: Partial<WorklogDeleter>): WorklogDeleter {
  return {
    deleteWorklog: async (): Promise<void> => {},
    ...overrides,
  };
}

export function createMockScheduleReader(overrides?: Partial<ScheduleReader>): ScheduleReader {
  return {
    getSchedule: async (): Promise<TempoScheduleResponse[]> => [],
    ...overrides,
  };
}

export function createMockUserResolver(overrides?: Partial<UserResolver>): UserResolver {
  return {
    getCurrentUser: async (): Promise<string> => "testuser",
    ...overrides,
  };
}
