import axios, { AxiosInstance, AxiosResponse } from "axios";
import {
  JiraIssue,
  TempoWorklogResponse,
  TempoWorklogCreatePayload,
  TempoClientConfig,
  IssueCache,
  TempoApiError,
  TempoScheduleResponse,
  GetScheduleParams
} from "./types/index.js";

export class TempoClient {
  private jiraAxios: AxiosInstance;
  private tempoAxios: AxiosInstance;
  private issueCache: IssueCache = {};
  private config: TempoClientConfig;
  private currentUser: string | null = null; // accountId (Cloud) or key (Server/DC)
  private isCloud: boolean;

  constructor(config: TempoClientConfig) {
    this.config = config;
    this.isCloud = !!(config.jiraBaseUrl && config.jiraEmail && config.jiraApiToken && config.tempoToken);

    if (this.isCloud) {
      // Cloud mode: separate Jira (Basic auth) and Tempo (Bearer auth) instances
      const basicAuth = Buffer.from(`${config.jiraEmail}:${config.jiraApiToken}`).toString('base64');

      this.jiraAxios = axios.create({
        baseURL: config.jiraBaseUrl,
        timeout: config.timeout || 30000,
        headers: {
          'Authorization': `Basic ${basicAuth}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'User-Agent': 'TempoFiller-MCP/2.1.0'
        }
      });

      this.tempoAxios = axios.create({
        baseURL: config.tempoBaseUrl || 'https://api.tempo.io',
        timeout: config.timeout || 30000,
        headers: {
          'Authorization': `Bearer ${config.tempoToken}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'User-Agent': 'TempoFiller-MCP/2.1.0'
        }
      });

      console.error('TempoClient: Cloud mode (Jira Basic auth + Tempo Bearer auth)');
    } else {
      // Server/DC mode: single instance with PAT (backward compatible)
      if (!config.baseUrl || !config.personalAccessToken) {
        throw new Error(
          'Configuration error: Provide either Server/DC credentials (TEMPO_BASE_URL + TEMPO_PAT) ' +
          'or Cloud credentials (JIRA_BASE_URL + JIRA_EMAIL + JIRA_API_TOKEN + TEMPO_TOKEN)'
        );
      }

      this.jiraAxios = axios.create({
        baseURL: config.baseUrl,
        timeout: config.timeout || 30000,
        headers: {
          'Authorization': `Bearer ${config.personalAccessToken}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'User-Agent': 'TempoFiller-MCP/2.1.0'
        }
      });

      // Server/DC: Tempo API lives on the same host as Jira
      this.tempoAxios = this.jiraAxios;
      console.error('TempoClient: Server/DC mode (single Bearer PAT)');
    }

    // Add interceptors for logging and error handling
    this.addInterceptors(this.jiraAxios, 'JIRA');
    if (this.isCloud) {
      this.addInterceptors(this.tempoAxios, 'TEMPO');
    }
  }

  /**
   * Add request/response interceptors for logging and error handling
   */
  private addInterceptors(instance: AxiosInstance, label: string): void {
    instance.interceptors.request.use(
      (config) => {
        console.error(`[${label}] ${config.method?.toUpperCase()} ${config.baseURL}${config.url}`);
        return config;
      },
      (error) => {
        console.error(`[${label}] Request error:`, error.message);
        return Promise.reject(error);
      }
    );

    instance.interceptors.response.use(
      (response) => {
        console.error(`[${label}] ${response.status} ${response.config.url}`);
        return response;
      },
      (error) => {
        console.error(`[${label}] Error ${error.response?.status} ${error.config?.url}`);

        if (error.response?.status === 401) {
          throw new Error(`Authentication failed (${label}). Check your credentials.`);
        }
        if (error.response?.status === 403) {
          throw new Error(`Access forbidden (${label}). Check your permissions.`);
        }
        if (error.response?.status === 429) {
          throw new Error('Rate limit exceeded. Please try again later.');
        }

        const apiError: TempoApiError = error.response?.data;
        if (apiError?.message) {
          throw new Error(`${label} API Error: ${apiError.message}`);
        }

        throw error;
      }
    );
  }

  /**
   * Get the current authenticated user from JIRA
   * Cloud: returns accountId
   * Server/DC: returns user key
   */
  private async getCurrentUser(): Promise<string> {
    if (this.currentUser) {
      return this.currentUser;
    }

    try {
      const response = await this.jiraAxios.get('/rest/api/latest/myself');

      if (this.isCloud) {
        this.currentUser = response.data.accountId;
      } else {
        this.currentUser = response.data.key;
      }

      console.error(`Authenticated user: ${this.currentUser} (${this.isCloud ? 'Cloud' : 'Server/DC'})`);

      if (!this.currentUser) {
        throw new Error('Unable to determine current user from API response');
      }

      return this.currentUser;
    } catch (error) {
      throw new Error(`Failed to get current user: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get JIRA issue details by issue key or numeric ID
   * Implements caching to avoid repeated API calls
   * Jira REST API accepts both keys (GEN-7283) and numeric IDs (34744)
   */
  async getIssueById(issueKeyOrId: string): Promise<JiraIssue> {
    // Check cache first (by key or numeric ID)
    const cached = this.issueCache[issueKeyOrId];
    if (cached && (Date.now() - cached.cached.getTime()) < 300000) { // 5 minute cache
      return {
        id: cached.id,
        key: cached.key || issueKeyOrId,
        fields: {
          summary: cached.summary
        }
      };
    }

    try {
      const response: AxiosResponse<JiraIssue> = await this.jiraAxios.get(
        `/rest/api/latest/issue/${issueKeyOrId}`
      );

      const issue = response.data;

      // Cache by both key and numeric ID for future lookups
      const cacheEntry = {
        id: issue.id,
        key: issue.key,
        summary: issue.fields.summary,
        cached: new Date()
      };
      this.issueCache[issue.key] = cacheEntry;
      this.issueCache[String(issue.id)] = cacheEntry;
      // Also cache original lookup key if different
      if (issueKeyOrId !== issue.key && issueKeyOrId !== String(issue.id)) {
        this.issueCache[issueKeyOrId] = cacheEntry;
      }

      return issue;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        throw new Error(`Issue ${issueKeyOrId} not found. Please check the issue key.`);
      }
      throw error;
    }
  }

  /**
   * Get worklogs for authenticated user within a date range
   * Cloud: Uses Tempo REST API v4 (api.tempo.io)
   * Server/DC: Uses Tempo Server plugin API
   */
  async getWorklogs(params: {
    from?: string; // YYYY-MM-DD
    to?: string;   // YYYY-MM-DD
    issueKey?: string;
  }): Promise<TempoWorklogResponse[]> {
    const currentUser = await this.getCurrentUser();

    try {
      if (this.isCloud) {
        return await this.getWorklogsCloud(params, currentUser);
      } else {
        return await this.getWorklogsServerDC(params, currentUser);
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        const url = error.config?.url;
        const method = error.config?.method?.toUpperCase();
        const responseData = error.response?.data;
        throw new Error(`Failed to retrieve worklogs: ${method} ${url} returned ${status}. ${responseData?.message || JSON.stringify(responseData)}`);
      }
      throw new Error(`Failed to retrieve worklogs: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Cloud: Get worklogs via Tempo REST API v4
   */
  private async getWorklogsCloud(params: {
    from?: string;
    to?: string;
    issueKey?: string;
  }, currentUser: string): Promise<TempoWorklogResponse[]> {
    const from = params.from || new Date().toISOString().split('T')[0];
    const to = params.to || from;

    // Use the user-specific endpoint for efficiency
    const response = await this.tempoAxios.get(
      `/4/worklogs/user/${currentUser}`,
      { params: { from, to, limit: 1000 } }
    );

    // Cloud API returns paginated: { metadata: {...}, results: [...] }
    const cloudWorklogs: any[] = response.data.results || [];

    // Filter by issue if specified
    let filtered = cloudWorklogs;
    if (params.issueKey) {
      // Resolve issue key to ID for comparison
      const issue = await this.getIssueById(params.issueKey);
      const issueId = parseInt(issue.id);
      filtered = cloudWorklogs.filter((w: any) => w.issue?.id === issueId);
    }

    // Resolve issue IDs to keys/summaries via Jira (Cloud API only returns numeric IDs)
    const uniqueIssueIds = [...new Set(filtered.map((w: any) => String(w.issue?.id)).filter(Boolean))];
    const issueMap = new Map<string, { key: string; summary: string }>();

    for (const issueId of uniqueIssueIds) {
      try {
        const issue = await this.getIssueById(issueId);
        issueMap.set(issueId, { key: issue.key, summary: issue.fields.summary });
      } catch {
        // If lookup fails, continue without enrichment
      }
    }

    // Convert to TempoWorklogResponse format with enriched issue data
    return filtered.map((worklog: any) => {
      const issueId = String(worklog.issue?.id);
      const issueInfo = issueMap.get(issueId);
      return this.convertCloudWorklog(
        worklog,
        issueInfo?.key || `ID-${issueId}`,
        issueInfo?.summary || ''
      );
    });
  }

  /**
   * Server/DC: Get worklogs via Tempo Server plugin API
   */
  private async getWorklogsServerDC(params: {
    from?: string;
    to?: string;
    issueKey?: string;
  }, currentUser: string): Promise<TempoWorklogResponse[]> {
    // Issue-specific query via Jira REST API
    if (params.issueKey) {
      const issue = await this.getIssueById(params.issueKey);

      const response = await this.jiraAxios.get(
        `/rest/api/latest/issue/${params.issueKey}/worklog`
      );

      const jiraWorklogs = response.data?.worklogs || [];

      // Filter by current user
      const filteredWorklogs = jiraWorklogs.filter((worklog: any) =>
        worklog.author?.name === currentUser ||
        worklog.author?.accountId === currentUser ||
        worklog.author?.emailAddress === currentUser
      );

      return filteredWorklogs.map((worklog: any) => ({
        id: worklog.id,
        timeSpentSeconds: worklog.timeSpentSeconds,
        billableSeconds: worklog.timeSpentSeconds,
        timeSpent: worklog.timeSpent,
        issue: {
          id: issue.id,
          key: params.issueKey!,
          summary: issue.fields.summary,
          internalIssue: false,
          issueStatus: '',
          reporterKey: '',
          estimatedRemainingSeconds: 0,
          components: [],
          issueType: '',
          projectId: 0,
          projectKey: '',
          iconUrl: '',
          versions: [],
        },
        started: worklog.started,
        worker: worklog.author?.name || worklog.author?.accountId || 'unknown',
        updater: worklog.updateAuthor?.name || 'unknown',
        originId: 0,
        originTaskId: 0,
        dateCreated: worklog.created || '',
        dateUpdated: worklog.updated || '',
        attributes: {},
      }));
    }

    // Date-based query via Tempo search API
    const searchParams: any = {
      from: params.from || '2025-07-01',
      to: params.to || '2025-07-31',
      worker: [currentUser],
    };

    const response = await this.tempoAxios.post(
      `/rest/tempo-timesheets/4/worklogs/search`,
      searchParams
    );

    return Array.isArray(response.data) ? response.data : [];
  }

  /**
   * Convert a Tempo Cloud API v4 worklog to the TempoWorklogResponse format
   * used by tool implementations
   */
  private convertCloudWorklog(cloudWorklog: any, issueKey: string = '', issueSummary: string = ''): TempoWorklogResponse {
    return {
      tempoWorklogId: cloudWorklog.tempoWorklogId,
      billableSeconds: cloudWorklog.billableSeconds || 0,
      timeSpentSeconds: cloudWorklog.timeSpentSeconds || 0,
      timeSpent: this.formatTimeSpent(cloudWorklog.timeSpentSeconds || 0),
      comment: cloudWorklog.description || undefined,
      issue: {
        id: cloudWorklog.issue?.id || 0,
        key: issueKey || cloudWorklog.issue?.key || `ID-${cloudWorklog.issue?.id}`,
        summary: issueSummary,
        internalIssue: false,
        issueStatus: '',
        reporterKey: '',
        estimatedRemainingSeconds: 0,
        components: [],
        issueType: '',
        projectId: 0,
        projectKey: '',
        iconUrl: '',
        versions: [],
      },
      originId: 0,
      worker: cloudWorklog.author?.accountId || '',
      updater: cloudWorklog.author?.accountId || '',
      started: `${cloudWorklog.startDate} ${cloudWorklog.startTime || '00:00:00'}.000`,
      originTaskId: cloudWorklog.issue?.id || 0,
      dateCreated: cloudWorklog.createdAt || '',
      dateUpdated: cloudWorklog.updatedAt || '',
      attributes: {},
    };
  }

  /**
   * Format seconds as human-readable time string (e.g., "1h", "4h 30m")
   */
  private formatTimeSpent(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0 && minutes > 0) return `${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h`;
    return `${minutes}m`;
  }

  /**
   * Get work schedule
   * Cloud: Uses Tempo REST API v4 user-schedule endpoint
   * Server/DC: Uses Tempo Core API v2 schedule search
   */
  async getSchedule(params: GetScheduleParams): Promise<TempoScheduleResponse[]> {
    const currentUser = await this.getCurrentUser();

    try {
      if (this.isCloud) {
        return await this.getScheduleCloud(params, currentUser);
      } else {
        return await this.getScheduleServerDC(params, currentUser);
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        const url = error.config?.url;
        const method = error.config?.method?.toUpperCase();
        const responseData = error.response?.data;
        throw new Error(`Failed to retrieve schedule: ${method} ${url} returned ${status}. ${responseData?.message || JSON.stringify(responseData)}`);
      }
      throw new Error(`Failed to retrieve schedule: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Cloud: Get schedule via Tempo REST API v4
   */
  private async getScheduleCloud(params: GetScheduleParams, currentUser: string): Promise<TempoScheduleResponse[]> {
    const endDate = params.endDate || params.startDate;

    const response = await this.tempoAxios.get(
      `/4/user-schedule/${currentUser}`,
      { params: { from: params.startDate, to: endDate } }
    );

    // Cloud API returns: { metadata: {...}, results: [...] } or { results: [...] }
    const days: any[] = response.data.results || response.data || [];

    // Convert to TempoScheduleResponse format expected by tool implementations
    const workingDays = days.filter((d: any) => d.type === 'WORKING_DAY');
    const totalRequiredSeconds = days.reduce((sum: number, d: any) => sum + (d.requiredSeconds || 0), 0);

    return [{
      schedule: {
        numberOfWorkingDays: workingDays.length,
        requiredSeconds: totalRequiredSeconds,
        days: days.map((d: any) => ({
          date: d.date,
          requiredSeconds: d.requiredSeconds || 0,
          type: d.type === 'WORKING_DAY' ? 'WORKING_DAY' as const : 'NON_WORKING_DAY' as const,
        })),
      },
      user: {
        username: currentUser,
        displayName: '',
        key: currentUser,
      },
    }];
  }

  /**
   * Server/DC: Get schedule via Tempo Core API v2
   */
  private async getScheduleServerDC(params: GetScheduleParams, currentUser: string): Promise<TempoScheduleResponse[]> {
    const endDate = params.endDate || params.startDate;

    const searchParams = {
      from: params.startDate,
      to: endDate,
      userKeys: [currentUser]
    };

    const response = await this.tempoAxios.post(
      `/rest/tempo-core/2/user/schedule/search`,
      searchParams
    );

    return Array.isArray(response.data) ? response.data : [];
  }

  /**
   * Test basic connectivity to JIRA
   */
  private async testConnection(): Promise<void> {
    try {
      const response = await this.jiraAxios.get('/rest/api/2/myself');
      console.error(`Connection test successful. Authenticated as: ${response.data.displayName || response.data.name}`);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`Authentication test failed: ${error.response?.status} ${error.response?.statusText}`);
      }
      throw error;
    }
  }

  /**
   * Create a new worklog entry
   * Cloud: POST to Tempo REST API v4
   * Server/DC: POST to Tempo Server plugin API
   */
  async createWorklog(payload: TempoWorklogCreatePayload): Promise<TempoWorklogResponse> {
    try {
      if (this.isCloud) {
        return await this.createWorklogCloud(payload);
      } else {
        return await this.createWorklogServerDC(payload);
      }
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.data) {
        const apiError: TempoApiError = error.response.data;
        throw new Error(`Failed to create worklog: ${apiError.message || error.message}`);
      }
      throw new Error(`Failed to create worklog: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Cloud: Create worklog via Tempo REST API v4
   */
  private async createWorklogCloud(payload: TempoWorklogCreatePayload): Promise<TempoWorklogResponse> {
    const currentUser = await this.getCurrentUser();

    // Convert Server/DC-style payload to Cloud API v4 format
    const cloudPayload = {
      issueId: parseInt(payload.originTaskId),
      timeSpentSeconds: payload.timeSpentSeconds,
      billableSeconds: payload.billableSeconds,
      startDate: payload.started.split('T')[0], // Extract YYYY-MM-DD
      startTime: payload.started.split('T')[1]?.replace(/\.\d+$/, '') || '00:00:00', // Extract HH:mm:ss from started
      authorAccountId: currentUser,
      description: payload.comment || undefined,
    };

    const response = await this.tempoAxios.post('/4/worklogs', cloudPayload);

    // Cloud returns a single worklog object (not an array)
    const worklog = response.data;

    // Resolve issue ID to key/summary via Jira
    const issueId = String(worklog.issue?.id);
    let resolvedKey = '';
    let issueSummary = '';
    try {
      const issue = await this.getIssueById(issueId);
      resolvedKey = issue.key;
      issueSummary = issue.fields.summary;
    } catch {
      // Continue without enrichment
    }

    return this.convertCloudWorklog(worklog, resolvedKey, issueSummary);
  }

  /**
   * Server/DC: Create worklog via Tempo Server plugin API
   */
  private async createWorklogServerDC(payload: TempoWorklogCreatePayload): Promise<TempoWorklogResponse> {
    const response: AxiosResponse<TempoWorklogResponse[]> = await this.tempoAxios.post(
      '/rest/tempo-timesheets/4/worklogs/',
      payload
    );

    // Server/DC API returns an array with a single worklog object
    const worklogs = response.data;
    if (!Array.isArray(worklogs) || worklogs.length === 0) {
      throw new Error('Unexpected response format from Tempo API');
    }

    return worklogs[0];
  }

  /**
   * Delete a worklog entry
   * Cloud: DELETE on Tempo REST API v4
   * Server/DC: DELETE on Tempo Server plugin API
   */
  async deleteWorklog(worklogId: string): Promise<void> {
    try {
      if (this.isCloud) {
        await this.tempoAxios.delete(`/4/worklogs/${worklogId}`);
      } else {
        await this.tempoAxios.delete(`/rest/tempo-timesheets/4/worklogs/${worklogId}`);
      }
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        throw new Error(`Worklog ${worklogId} not found.`);
      }
      throw new Error(`Failed to delete worklog: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Update an existing worklog entry
   * Cloud: PUT on Tempo REST API v4
   * Server/DC: PUT on Tempo Server plugin API
   */
  async updateWorklog(worklogId: string, updates: {
    hours?: number;
    startDate?: string;
    startTime?: string;
    description?: string;
    billable?: boolean;
  }): Promise<TempoWorklogResponse> {
    try {
      if (this.isCloud) {
        return await this.updateWorklogCloud(worklogId, updates);
      } else {
        return await this.updateWorklogServerDC(worklogId, updates);
      }
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.data) {
        const apiError: TempoApiError = error.response.data;
        throw new Error(`Failed to update worklog: ${apiError.message || error.message}`);
      }
      throw new Error(`Failed to update worklog: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async updateWorklogCloud(worklogId: string, updates: {
    hours?: number;
    startDate?: string;
    startTime?: string;
    description?: string;
    billable?: boolean;
  }): Promise<TempoWorklogResponse> {
    const currentUser = await this.getCurrentUser();

    // Fetch the existing worklog to get current values
    const existing = await this.tempoAxios.get(`/4/worklogs/${worklogId}`);
    const current = existing.data;

    // Build full payload with existing values as defaults
    const timeInSeconds = updates.hours !== undefined
      ? this.hoursToSeconds(updates.hours)
      : current.timeSpentSeconds;

    const cloudPayload: Record<string, any> = {
      issueId: current.issue?.id,
      timeSpentSeconds: timeInSeconds,
      billableSeconds: updates.billable === false ? 0 : (updates.hours !== undefined ? timeInSeconds : current.billableSeconds),
      startDate: updates.startDate ?? current.startDate,
      startTime: updates.startTime !== undefined
        ? (updates.startTime.split(':').length === 2 ? `${updates.startTime}:00` : updates.startTime)
        : current.startTime,
      authorAccountId: currentUser,
      description: updates.description ?? current.description ?? undefined,
    };

    const response = await this.tempoAxios.put(`/4/worklogs/${worklogId}`, cloudPayload);
    const worklog = response.data;

    const issueId = String(worklog.issue?.id);
    let resolvedKey = '';
    let issueSummary = '';
    try {
      const issue = await this.getIssueById(issueId);
      resolvedKey = issue.key;
      issueSummary = issue.fields.summary;
    } catch {
      // Continue without enrichment
    }

    return this.convertCloudWorklog(worklog, resolvedKey, issueSummary);
  }

  private async updateWorklogServerDC(worklogId: string, updates: {
    hours?: number;
    startDate?: string;
    startTime?: string;
    description?: string;
    billable?: boolean;
  }): Promise<TempoWorklogResponse> {
    const payload: Record<string, any> = {};

    if (updates.hours !== undefined) {
      const timeInSeconds = this.hoursToSeconds(updates.hours);
      payload.timeSpentSeconds = timeInSeconds;
      if (updates.billable !== false) {
        payload.billableSeconds = timeInSeconds;
      } else {
        payload.billableSeconds = 0;
      }
    }

    if (updates.startDate !== undefined || updates.startTime !== undefined) {
      const rawTime = updates.startTime || '00:00:00';
      const normalizedTime = rawTime.includes(':') && rawTime.split(':').length === 2
        ? `${rawTime}:00.000`
        : `${rawTime}.000`;
      if (updates.startDate) {
        payload.started = `${updates.startDate}T${normalizedTime}`;
      }
    }

    if (updates.description !== undefined) {
      payload.comment = updates.description;
    }

    const response: AxiosResponse<TempoWorklogResponse[]> = await this.tempoAxios.put(
      `/rest/tempo-timesheets/4/worklogs/${worklogId}`,
      payload
    );

    const worklogs = response.data;
    if (!Array.isArray(worklogs) || worklogs.length === 0) {
      throw new Error('Unexpected response format from Tempo API');
    }

    return worklogs[0];
  }

  /**
   * Helper method to convert hours to seconds
   */
  hoursToSeconds(hours: number): number {
    return Math.round(hours * 3600);
  }

  /**
   * Helper method to convert seconds to hours
   */
  secondsToHours(seconds: number): number {
    return Math.round((seconds / 3600) * 100) / 100; // Round to 2 decimal places
  }

  /**
   * Create worklog payload from simplified parameters
   * Automatically uses the authenticated user as the worker
   */
  async createWorklogPayload(params: {
    issueKey: string;
    hours: number;
    startDate: string; // YYYY-MM-DD
    startTime?: string; // HH:mm or HH:mm:ss (defaults to 00:00:00)
    endDate?: string;  // YYYY-MM-DD
    billable?: boolean;
    description?: string;
  }): Promise<TempoWorklogCreatePayload> {
    // Resolve issue key to numerical ID
    const issue = await this.getIssueById(params.issueKey);

    // Get the current authenticated user
    const currentUser = await this.getCurrentUser();

    const timeInSeconds = this.hoursToSeconds(params.hours);
    const startDate = params.startDate;
    const endDate = params.endDate || params.startDate;

    // Normalize startTime to HH:mm:ss.SSS format
    const rawTime = params.startTime || '00:00:00';
    const normalizedTime = rawTime.includes(':') && rawTime.split(':').length === 2
      ? `${rawTime}:00.000`
      : `${rawTime}.000`;

    // Build the payload using the authenticated user as worker
    const payload: TempoWorklogCreatePayload = {
      attributes: {},
      billableSeconds: params.billable !== false ? timeInSeconds : 0,
      timeSpentSeconds: timeInSeconds,
      worker: currentUser,
      started: `${startDate}T${normalizedTime}`,
      originTaskId: issue.id,
      remainingEstimate: null,
      endDate: `${endDate}T00:00:00.000`,
      comment: params.description || undefined
    };

    return payload;
  }

  /**
   * Batch create multiple worklogs
   * Uses Promise.all() for concurrent processing
   */
  async createWorklogsBatch(worklogParams: Array<{
    issueKey: string;
    hours: number;
    startDate: string;
    startTime?: string;
    endDate?: string;
    billable?: boolean;
    description?: string;
  }>): Promise<Array<{
    success: boolean;
    worklog?: TempoWorklogResponse;
    error?: string;
    originalParams: typeof worklogParams[0];
  }>> {
    // Create all payloads first (this will cache issue resolutions)
    const payloadPromises = worklogParams.map(async (params) => ({
      params,
      payload: await this.createWorklogPayload(params)
    }));

    const payloadResults = await Promise.all(payloadPromises);

    // Now create all worklogs concurrently
    const createPromises = payloadResults.map(async ({ params, payload }) => {
      try {
        const worklog = await this.createWorklog(payload);
        return {
          success: true,
          worklog,
          originalParams: params
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
          originalParams: params
        };
      }
    });

    return Promise.all(createPromises);
  }

  /**
   * Clear the issue cache (useful for testing or when issues are updated)
   */
  clearIssueCache(): void {
    this.issueCache = {};
  }

  /**
   * Get cached issue count (for monitoring/debugging)
   */
  getCachedIssueCount(): number {
    return Object.keys(this.issueCache).length;
  }
}
