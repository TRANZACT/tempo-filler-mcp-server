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
  private axiosInstance: AxiosInstance;
  private issueCache: IssueCache = {};
  private config: TempoClientConfig;
  private currentUser: string | null = null; // Cache for the authenticated user

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
        console.error(`DEBUG: Headers:`, JSON.stringify(config.headers, null, 2));
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
        console.error(`DEBUG: Response error ${error.response?.status} from ${error.config?.url}`);
        console.error(`DEBUG: Error response:`, error.response?.data);

        if (error.response?.status === 401) {
          throw new Error('Authentication failed. Please check your Personal Access Token.');
        }
        if (error.response?.status === 403) {
          throw new Error('Access forbidden. Please check your permissions in JIRA/Tempo.');
        }
        if (error.response?.status === 429) {
          throw new Error('Rate limit exceeded. Please try again later.');
        }
        
        const apiError: TempoApiError = error.response?.data;
        if (apiError?.message) {
          throw new Error(`Tempo API Error: ${apiError.message}`);
        }
        
        throw error;
      }
    );
  }

  /**
   * Get the current authenticated user from JIRA
   * Caches the result to avoid repeated API calls
   */
  private async getCurrentUser(): Promise<string> {
    if (this.currentUser) {
      return this.currentUser;
    }

    try {
      const response = await this.axiosInstance.get('/rest/api/latest/myself');
      // Use the username (name field) for Tempo API
      this.currentUser = response.data.key;
      console.error(`🔐 AUTHENTICATED USER: ${this.currentUser}`);
      
      if (!this.currentUser) {
        throw new Error('Unable to determine current user from API response');
      }
      
      return this.currentUser;
    } catch (error) {
      throw new Error(`Failed to get current user: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get JIRA issue details by issue key
   * Implements caching to avoid repeated API calls
   */
  async getIssueById(issueKey: string): Promise<JiraIssue> {
    // Check cache first
    const cached = this.issueCache[issueKey];
    if (cached && (Date.now() - cached.cached.getTime()) < 300000) { // 5 minute cache
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

  /**
   * Get worklogs using Tempo API search endpoint
   * Automatically filters by the authenticated user
   * Uses the working /rest/tempo-timesheets/4/worklogs/search endpoint
   */
  async getWorklogs(params: {
    from?: string; // YYYY-MM-DD
    to?: string;   // YYYY-MM-DD
    issueKey?: string;
  }): Promise<TempoWorklogResponse[]> {
    // Get the current authenticated user
    const currentUser = await this.getCurrentUser();
    
    console.error(`🔍 WORKLOG SEARCH: Processing request for params:`, JSON.stringify(params));
    console.error(`👤 USER: Using authenticated user ${currentUser}`);
    
    try {
      // Since POST search has parameter format issues, let's try a different approach
      // First, let's try getting worklogs from a specific issue we know exists
      if (params.issueKey) {
        console.error(`📋 ISSUE-SPECIFIC: Getting worklogs for issue ${params.issueKey}`);
        
        const issue = await this.getIssueById(params.issueKey);
        console.error(`✅ ISSUE RESOLVED: ${issue.key} - ${issue.fields.summary}`);
        
        // Get worklogs from JIRA API instead of Tempo search
        const response = await this.axiosInstance.get(
          `/rest/api/latest/issue/${params.issueKey}/worklog`
        );
        
        console.error(`📊 JIRA RESPONSE: Found ${response.data?.worklogs?.length || 0} worklogs`);
        
        // Convert JIRA worklog format to Tempo format
        const jiraWorklogs = response.data?.worklogs || [];
        
        // Filter by current user
        const filteredWorklogs = jiraWorklogs.filter((worklog: any) => 
          worklog.author?.name === currentUser || 
          worklog.author?.accountId === currentUser ||
          worklog.author?.emailAddress === currentUser
        );
        
        const convertedWorklogs = filteredWorklogs.map((worklog: any) => ({
          id: worklog.id,
          timeSpentSeconds: worklog.timeSpentSeconds,
          billableSeconds: worklog.timeSpentSeconds, // Assume all time is billable for now
          timeSpent: worklog.timeSpent,
          issue: {
            id: issue.id,
            key: params.issueKey!,
            summary: issue.fields.summary
          },
          started: worklog.started,
          worker: {
            displayName: worklog.author?.displayName || 'Unknown',
            accountId: worklog.author?.accountId || 'unknown'
          },
          attributes: {}
        }));
        
        console.error(`🎯 CONVERTED: Returning ${convertedWorklogs.length} worklogs for user ${currentUser}`);
        return convertedWorklogs;
      }
      
      // For date-based queries without specific issue, we need to use Tempo search
      console.error(`📅 DATE-BASED: Attempting Tempo search for date range`);
      
      const searchParams: any = {
        from: params.from || '2025-07-01',
        to: params.to || '2025-07-31'
      };

      // Add current user as worker for server-side filtering
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
        throw new Error(`Failed to retrieve worklogs: ${method} ${url} returned ${status}. ${responseData?.message || JSON.stringify(responseData)}`);
      }
      throw new Error(`Failed to retrieve worklogs: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get work schedule using Tempo Core API v2 schedule search endpoint
   * Automatically filters by the authenticated user
   * Uses the /rest/tempo-core/2/user/schedule/search endpoint
   */
  async getSchedule(params: GetScheduleParams): Promise<TempoScheduleResponse[]> {
    // Get the current authenticated user
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
        throw new Error(`Failed to retrieve schedule: ${method} ${url} returned ${status}. ${responseData?.message || JSON.stringify(responseData)}`);
      }
      throw new Error(`Failed to retrieve schedule: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Test basic connectivity to JIRA
   */
  private async testConnection(): Promise<void> {
    try {
      const response = await this.axiosInstance.get('/rest/api/2/myself');
      console.error(`Connection test successful. Authenticated as: ${response.data.displayName || response.data.name}`);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const debugInfo = `
        URL: ${error.config?.baseURL}${error.config?.url}
        Status: ${error.response?.status}
        Method: ${error.config?.method}
        Headers: ${JSON.stringify(error.config?.headers)}
        Response: ${JSON.stringify(error.response?.data)}
        `;
        throw new Error(`Authentication test failed: ${error.response?.status} ${error.response?.statusText}. Debug info: ${debugInfo}`);
      }
      throw error;
    }
  }

  /**
   * Get worklogs for a specific issue using JIRA API
   */
  private async getWorklogsForIssue(
    issueKey: string, 
    from?: string, 
    to?: string, 
    worker?: string
  ): Promise<TempoWorklogResponse[]> {
    try {
      // Get all worklogs for the issue using JIRA API
      const response = await this.axiosInstance.get(
        `/rest/api/latest/issue/${issueKey}/worklog`
      );

      const jiraWorklogs = response.data.worklogs || [];
      
      // Convert JIRA worklogs to Tempo format and apply filters
      const tempoWorklogs: TempoWorklogResponse[] = jiraWorklogs
        .filter((worklog: any) => {
          // Filter by date if specified
          if (from || to) {
            const worklogDate = worklog.started ? worklog.started.split('T')[0] : null;
            if (from && worklogDate && worklogDate < from) return false;
            if (to && worklogDate && worklogDate > to) return false;
          }
          
          // Filter by worker if specified  
          if (worker && worklog.author?.name !== worker) return false;
          
          return true;
        })
        .map((worklog: any) => ({
          id: worklog.id,
          billableSeconds: worklog.timeSpentSeconds, // Assume all time is billable for now
          timeSpentSeconds: worklog.timeSpentSeconds,
          timeSpent: worklog.timeSpent,
          issue: {
            id: worklog.issueId || 'unknown',
            key: issueKey,
            summary: 'Issue summary not available from worklog API'
          },
          started: worklog.started,
          worker: {
            accountId: worklog.author?.accountId || 'unknown',
            displayName: worklog.author?.displayName || worklog.author?.name || 'Unknown'
          },
          attributes: {
            description: worklog.comment || ''
          }
        }));

      return tempoWorklogs;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        throw new Error(`Issue ${issueKey} not found or you don't have permission to view its worklogs.`);
      }
      throw error;
    }
  }

  /**
   * Create a new worklog entry
   * Follows the pattern from the C# implementation
   * Note: API returns an array with a single worklog object
   */
  async createWorklog(payload: TempoWorklogCreatePayload): Promise<TempoWorklogResponse> {
    try {
      const response: AxiosResponse<TempoWorklogResponse[]> = await this.axiosInstance.post(
        '/rest/tempo-timesheets/4/worklogs/',
        payload
      );

      // API returns an array with a single worklog object
      const worklogs = response.data;
      if (!Array.isArray(worklogs) || worklogs.length === 0) {
        throw new Error('Unexpected response format from Tempo API');
      }

      return worklogs[0];
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.data) {
        const apiError: TempoApiError = error.response.data;
        throw new Error(`Failed to create worklog: ${apiError.message || error.message}`);
      }
      throw new Error(`Failed to create worklog: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Delete a worklog entry
   */
  async deleteWorklog(worklogId: string): Promise<void> {
    try {
      await this.axiosInstance.delete(`/rest/tempo-timesheets/4/worklogs/${worklogId}`);
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        throw new Error(`Worklog ${worklogId} not found.`);
      }
      throw new Error(`Failed to delete worklog: ${error instanceof Error ? error.message : String(error)}`);
    }
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
   * Implements the same pattern as the C# PostTime method
   * Automatically uses the authenticated user as the worker
   */
  async createWorklogPayload(params: {
    issueKey: string;
    hours: number;
    startDate: string; // YYYY-MM-DD
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
    
    // Build attributes object - keep it empty to match working payload
    const attributes: Record<string, any> = {};

    // Build the payload using the authenticated user as worker
    const payload: TempoWorklogCreatePayload = {
      attributes,
      billableSeconds: params.billable !== false ? timeInSeconds : 0,
      timeSpentSeconds: timeInSeconds,
      worker: currentUser, // Always use the authenticated user
      started: `${startDate}T00:00:00.000`,
      originTaskId: issue.id,
      remainingEstimate: null,
      endDate: `${endDate}T00:00:00.000`,
      comment: params.description || undefined
    };

    return payload;
  }

  /**
   * Batch create multiple worklogs
   * Automatically uses the authenticated user as the worker
   * Uses Promise.all() for concurrent processing like the C# Task.WhenAll pattern
   */
  async createWorklogsBatch(worklogParams: Array<{
    issueKey: string;
    hours: number;
    startDate: string;
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