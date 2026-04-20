import axios, { AxiosInstance, AxiosResponse } from "axios";
import {
  JiraIssue,
  TempoWorklogResponse,
  TempoWorklogCreatePayload,
  TempoClientConfig,
  IssueCache,
  TempoApiError,
  TempoScheduleResponse,
  GetScheduleParams,
  JiraWorklogEntry,
  IssueResolver,
  WorklogReader,
  WorklogWriter,
  WorklogDeleter,
  ScheduleReader,
  UserResolver,
  PostWorklogParams,
} from "./types/index.js";
import { DEFAULTS } from "./types/index.js";

export class TempoClient implements IssueResolver, WorklogReader, WorklogWriter, WorklogDeleter, ScheduleReader, UserResolver {
  private axiosInstance: AxiosInstance;
  private issueCache: IssueCache = {};
  private config: TempoClientConfig;
  private currentUserPromise: Promise<string> | null = null;

  constructor(config: TempoClientConfig) {
    this.config = config;

    // Create axios instance with PAT authentication
    this.axiosInstance = axios.create({
      baseURL: config.baseUrl,
      timeout: config.timeout || 30000,
      headers: {
        'Authorization': `Bearer ${config.personalAccessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'TempoFiller-MCP/1.0.0'
      }
    });

    // Add request interceptor for debugging
    this.axiosInstance.interceptors.request.use(
      (config) => {
        console.error(`DEBUG: Making ${config.method?.toUpperCase()} request to ${config.baseURL}${config.url}`);
        if (config.data) {
          console.error(`DEBUG: Request body:`, JSON.stringify(config.data, null, 2));
        }
        return config;
      },
      (error) => {
        console.error(`DEBUG: Request error:`, error);
        return Promise.reject(error);
      }
    );

    // Add response interceptor for error handling
    this.axiosInstance.interceptors.response.use(
      (response) => {
        console.error(`DEBUG: Response ${response.status} from ${response.config.url}`);
        return response;
      },
      (error) => {
        if (axios.isAxiosError(error)) {
          console.error(`DEBUG: Response error ${error.response?.status} from ${error.config?.url}`);
          if (process.env.DEBUG) {
            console.error(`DEBUG: Error response:`, error.response?.data);
          }

          if (error.response?.status === 401) {
            throw new Error('Authentication failed. Please check your Personal Access Token.');
          }
          if (error.response?.status === 403) {
            throw new Error('Access forbidden. Please check your permissions in JIRA/Tempo.');
          }
          if (error.response?.status === 429) {
            throw new Error('Rate limit exceeded. Please try again later.');
          }

          const apiErrorMessage = (error.response?.data as TempoApiError | undefined)?.message;
          if (apiErrorMessage) {
            throw new Error(`Tempo API Error: ${apiErrorMessage}`, { cause: error });
          }

          throw error;
        } else {
          throw error;
        }
      }
    );
  }

  async getCurrentUser(): Promise<string> {
    if (!this.currentUserPromise) {
      this.currentUserPromise = this.fetchCurrentUser();
    }
    return this.currentUserPromise;
  }

  private async fetchCurrentUser(): Promise<string> {
    try {
      const response = await this.axiosInstance.get('/rest/api/latest/myself');
      const user: string = response.data.key;
      console.error(`🔐 AUTHENTICATED USER: ${user}`);
      if (!user) {
        throw new Error('Unable to determine current user from API response');
      }
      return user;
    } catch (error) {
      this.currentUserPromise = null; // Reset on failure so it can be retried
      throw new Error(`Failed to get current user: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
    }
  }

  async getIssueById(issueKey: string): Promise<JiraIssue> {
    // Check cache first
    const cached = this.issueCache[issueKey];
    if (cached && (Date.now() - cached.cached.getTime()) < DEFAULTS.ISSUE_CACHE_TTL) {
      return {
        id: cached.id,
        key: issueKey,
        fields: {
          summary: cached.summary
        }
      };
    }

    try {
      const response: AxiosResponse<JiraIssue> = await this.axiosInstance.get(
        `/rest/api/latest/issue/${issueKey}`
      );

      const issue = response.data;

      // Evict cache if at capacity
      if (Object.keys(this.issueCache).length >= DEFAULTS.MAX_CACHE_SIZE) {
        this.issueCache = {};
      }

      // Cache the result
      this.issueCache[issueKey] = {
        id: issue.id,
        summary: issue.fields.summary,
        cached: new Date()
      };

      return issue;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        throw new Error(`Issue ${issueKey} not found. Please check the issue key.`);
      }
      throw error;
    }
  }

  async getWorklogs(params: {
    from: string;
    to: string;
    issueKey?: string;
  }): Promise<TempoWorklogResponse[]> {
    if (!params.from || !params.to) {
      throw new Error("Date range (from/to) is required for worklog search");
    }

    const currentUser = await this.getCurrentUser();

    console.error(`🔍 WORKLOG SEARCH: Processing request for params:`, JSON.stringify(params));
    console.error(`👤 USER: Using authenticated user ${currentUser}`);

    try {
      if (params.issueKey) {
        console.error(`📋 ISSUE-SPECIFIC: Getting worklogs for issue ${params.issueKey}`);

        const issue = await this.getIssueById(params.issueKey);
        console.error(`✅ ISSUE RESOLVED: ${issue.key} - ${issue.fields.summary}`);

        const response = await this.axiosInstance.get(
          `/rest/api/latest/issue/${params.issueKey}/worklog`
        );

        console.error(`📊 JIRA RESPONSE: Found ${response.data?.worklogs?.length || 0} worklogs`);

        const jiraWorklogs: JiraWorklogEntry[] = response.data?.worklogs || [];

        const filteredWorklogs = jiraWorklogs.filter((worklog: JiraWorklogEntry) =>
          worklog.author?.name === currentUser ||
          worklog.author?.accountId === currentUser ||
          worklog.author?.emailAddress === currentUser
        );

        const convertedWorklogs = filteredWorklogs.map((worklog: JiraWorklogEntry) => ({
          id: worklog.id,
          timeSpentSeconds: worklog.timeSpentSeconds,
          billableSeconds: worklog.timeSpentSeconds,
          timeSpent: worklog.timeSpent,
          issue: {
            id: 0,
            key: params.issueKey!,
            summary: issue.fields.summary,
            internalIssue: false,
            issueStatus: "",
            reporterKey: "",
            estimatedRemainingSeconds: 0,
            components: [],
            issueType: "",
            projectId: 0,
            projectKey: "",
            iconUrl: "",
            versions: [],
          },
          started: worklog.started,
          worker: worklog.author?.name || worklog.author?.accountId || currentUser,
          updater: worklog.author?.name || worklog.author?.accountId || currentUser,
          originId: 0,
          originTaskId: 0,
          dateCreated: worklog.started,
          dateUpdated: worklog.started,
          attributes: {}
        }));

        console.error(`🎯 CONVERTED: Returning ${convertedWorklogs.length} worklogs for user ${currentUser}`);
        return convertedWorklogs;
      }

      console.error(`📅 DATE-BASED: Attempting Tempo search for date range`);

      const searchParams: { from: string; to: string; worker?: string[] } = {
        from: params.from,
        to: params.to
      };

      searchParams.worker = [currentUser];
      console.error(`👤 WORKER FILTER: Adding server-side worker filter for ${currentUser}`);
      console.error(`🔍 TEMPO SEARCH: Sending request with:`, JSON.stringify(searchParams));

      const response = await this.axiosInstance.post(
        `/rest/tempo-timesheets/4/worklogs/search`,
        searchParams
      );

      console.error(`📊 TEMPO RESPONSE: Received ${Array.isArray(response.data) ? response.data.length : 'non-array'} results`);

      const results = Array.isArray(response.data) ? response.data : [];
      return results;

    } catch (error) {
      console.error(`❌ ERROR in getWorklogs:`, error);
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        const url = error.config?.url;
        const method = error.config?.method?.toUpperCase();
        const responseData = error.response?.data;
        throw new Error(`Failed to retrieve worklogs: ${method} ${url} returned ${status}. ${(responseData as { message?: string } | undefined)?.message || JSON.stringify(responseData)}`, { cause: error });
      }
      throw new Error(`Failed to retrieve worklogs: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
    }
  }

  async getSchedule(params: GetScheduleParams): Promise<TempoScheduleResponse[]> {
    const currentUser = await this.getCurrentUser();

    console.error(`📅 SCHEDULE SEARCH: Processing request for params:`, JSON.stringify(params));
    console.error(`👤 USER: Using authenticated user ${currentUser}`);

    try {
      const { startDate, endDate } = params;
      const actualEndDate = endDate || startDate;

      const searchParams = {
        from: startDate,
        to: actualEndDate,
        userKeys: [currentUser]
      };

      console.error(`🔍 TEMPO SCHEDULE SEARCH: Sending request with:`, JSON.stringify(searchParams));

      const response = await this.axiosInstance.post(
        `/rest/tempo-core/2/user/schedule/search`,
        searchParams
      );

      console.error(`📊 TEMPO SCHEDULE RESPONSE: Received ${Array.isArray(response.data) ? response.data.length : 'non-array'} results`);

      const results = Array.isArray(response.data) ? response.data : [];
      return results;

    } catch (error) {
      console.error(`❌ ERROR in getSchedule:`, error);
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        const url = error.config?.url;
        const method = error.config?.method?.toUpperCase();
        const responseData = error.response?.data;
        throw new Error(`Failed to retrieve schedule: ${method} ${url} returned ${status}. ${(responseData as { message?: string } | undefined)?.message || JSON.stringify(responseData)}`, { cause: error });
      }
      throw new Error(`Failed to retrieve schedule: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
    }
  }

  async createWorklog(payload: TempoWorklogCreatePayload): Promise<TempoWorklogResponse> {
    try {
      const response: AxiosResponse<TempoWorklogResponse[]> = await this.axiosInstance.post(
        '/rest/tempo-timesheets/4/worklogs/',
        payload
      );

      const worklogs = response.data;
      if (!Array.isArray(worklogs) || worklogs.length === 0) {
        throw new Error('Unexpected response format from Tempo API');
      }

      return worklogs[0];
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.data) {
        const apiError = error.response.data as TempoApiError;
        throw new Error(`Failed to create worklog: ${apiError.message || error.message}`, { cause: error });
      }
      throw new Error(`Failed to create worklog: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
    }
  }

  async deleteWorklog(worklogId: string): Promise<void> {
    try {
      await this.axiosInstance.delete(`/rest/tempo-timesheets/4/worklogs/${worklogId}`);
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        throw new Error(`Worklog ${worklogId} not found.`, { cause: error });
      }
      throw new Error(`Failed to delete worklog: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
    }
  }

  hoursToSeconds(hours: number): number {
    return Math.round(hours * 3600);
  }

  secondsToHours(seconds: number): number {
    return Math.round((seconds / 3600) * 100) / 100;
  }

  async createWorklogPayload(params: PostWorklogParams): Promise<TempoWorklogCreatePayload> {
    const issue = await this.getIssueById(params.issueKey);
    const currentUser = await this.getCurrentUser();

    const timeInSeconds = this.hoursToSeconds(params.hours);
    const startDate = params.startDate;
    const endDate = params.endDate || params.startDate;

    const attributes: Record<string, unknown> = {};

    const payload: TempoWorklogCreatePayload = {
      attributes,
      billableSeconds: params.billable !== false ? timeInSeconds : 0,
      timeSpentSeconds: timeInSeconds,
      worker: currentUser,
      started: `${startDate}T00:00:00.000`,
      originTaskId: issue.id,
      remainingEstimate: null,
      endDate: `${endDate}T00:00:00.000`,
      comment: params.description || undefined
    };

    return payload;
  }

  clearIssueCache(): void {
    this.issueCache = {};
  }

  getCachedIssueCount(): number {
    return Object.keys(this.issueCache).length;
  }
}
