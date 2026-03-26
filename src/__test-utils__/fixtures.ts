import type { TempoClientConfig, TempoWorklogResponse, TempoScheduleResponse } from "../types/index.js";

export const fakeConfig: TempoClientConfig = {
  baseUrl: "https://jira.example.com",
  personalAccessToken: "fake-pat-token",
  defaultHours: 8,
  timeout: 5000,
};

export const fakeWorklogResponse: TempoWorklogResponse = {
  id: "12345",
  tempoWorklogId: 12345,
  billableSeconds: 28800,
  timeSpentSeconds: 28800,
  timeSpent: "8h",
  comment: "Test work",
  attributes: {},
  issue: {
    id: 100,
    key: "PROJ-1234",
    summary: "Test issue",
    internalIssue: false,
    issueStatus: "In Progress",
    reporterKey: "user1",
    estimatedRemainingSeconds: 0,
    components: [],
    issueType: "Story",
    projectId: 10,
    projectKey: "PROJ",
    iconUrl: "https://jira.example.com/icon.png",
    versions: [],
  },
  originId: 1,
  worker: "testuser",
  updater: "testuser",
  started: "2026-03-01T00:00:00.000",
  originTaskId: 100,
  dateCreated: "2026-03-01T10:00:00.000",
  dateUpdated: "2026-03-01T10:00:00.000",
};

export const fakeScheduleResponse: TempoScheduleResponse = {
  schedule: {
    numberOfWorkingDays: 1,
    requiredSeconds: 28800,
    days: [
      {
        date: "2026-03-01",
        requiredSeconds: 28800,
        type: "WORKING_DAY",
      },
    ],
  },
  user: {
    username: "testuser",
    displayName: "Test User",
    key: "testuser",
  },
};
