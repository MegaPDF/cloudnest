
import { ApiResponse } from '@/types/api';
import { HTTP_STATUS } from '../utils/constants';
import { API_ENDPOINTS } from './endpoints';
import { ApiErrorHandler } from './error-handler';

export interface ApiClientConfig {
  baseUrl?: string;
  timeout?: number;
  retries?: number;
  headers?: Record<string, string>;
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  headers?: Record<string, string>;
  body?: any;
  timeout?: number;
  retries?: number;
  signal?: AbortSignal;
}

export class ApiClient {
  private config: Required<ApiClientConfig>;
  private errorHandler: ApiErrorHandler;

  constructor(config: ApiClientConfig = {}) {
    this.config = {
      baseUrl: config.baseUrl || '/api',
      timeout: config.timeout || 30000,
      retries: config.retries || 3,
      headers: {
        'Content-Type': 'application/json',
        ...config.headers
      }
    };
    this.errorHandler = new ApiErrorHandler();
  }

  /**
   * Make HTTP request with error handling and retries
   */
  private async request<T = any>(
    endpoint: string,
    options: RequestOptions = {}
  ): Promise<ApiResponse<T>> {
    const {
      method = 'GET',
      headers = {},
      body,
      timeout = this.config.timeout,
      retries = this.config.retries,
      signal
    } = options;

    const url = `${this.config.baseUrl}${endpoint}`;
    const requestHeaders = { ...this.config.headers, ...headers };

    // Remove Content-Type for FormData
    if (body instanceof FormData) {
      delete requestHeaders['Content-Type'];
    }

    const requestConfig: RequestInit = {
      method,
      headers: requestHeaders,
      signal,
      ...(body && {
        body: body instanceof FormData ? body : JSON.stringify(body)
      })
    };

    let lastError: Error;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        const response = await fetch(url, {
          ...requestConfig,
          signal: signal || controller.signal
        });

        clearTimeout(timeoutId);

        const data = await this.parseResponse<T>(response);
        
        if (!response.ok) {
          throw this.errorHandler.createError(response.status, data);
        }

        return data;

      } catch (error) {
        lastError = error as Error;
        
        // Don't retry on client errors (4xx) or abort
        if (error instanceof Error && 
            (error.name === 'AbortError' || 
             this.errorHandler.isClientError(error))) {
          throw error;
        }

        // Wait before retry (exponential backoff)
        if (attempt < retries) {
          await this.delay(Math.pow(2, attempt) * 1000);
        }
      }
    }

    throw lastError!;
  }

  /**
   * Parse response and handle different content types
   */
  private async parseResponse<T>(response: Response): Promise<ApiResponse<T>> {
    const contentType = response.headers.get('content-type');
    
    if (contentType?.includes('application/json')) {
      return await response.json();
    }
    
    if (contentType?.includes('text/')) {
      const text = await response.text();
      return { success: true, data: text as T };
    }

    // For binary data (file downloads)
    const blob = await response.blob();
    return { success: true, data: blob as T };
  }

  /**
   * Delay helper for retries
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // HTTP Methods
  async get<T>(endpoint: string, options: Omit<RequestOptions, 'method'> = {}): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...options, method: 'GET' });
  }

  async post<T>(endpoint: string, body?: any, options: Omit<RequestOptions, 'method' | 'body'> = {}): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...options, method: 'POST', body });
  }

  async put<T>(endpoint: string, body?: any, options: Omit<RequestOptions, 'method' | 'body'> = {}): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...options, method: 'PUT', body });
  }

  async patch<T>(endpoint: string, body?: any, options: Omit<RequestOptions, 'method' | 'body'> = {}): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...options, method: 'PATCH', body });
  }

  async delete<T>(endpoint: string, options: Omit<RequestOptions, 'method'> = {}): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...options, method: 'DELETE' });
  }

  // Auth API
  auth = {
    login: (credentials: { email: string; password: string; remember?: boolean }) =>
      this.post(API_ENDPOINTS.AUTH.LOGIN, credentials),

    register: (data: { name: string; email: string; password: string; confirmPassword: string; acceptTerms: boolean }) =>
      this.post(API_ENDPOINTS.AUTH.REGISTER, data),

    forgotPassword: (email: string) =>
      this.post(API_ENDPOINTS.AUTH.FORGOT_PASSWORD, { email }),

    resetPassword: (data: { token: string; password: string; confirmPassword: string }) =>
      this.post(API_ENDPOINTS.AUTH.RESET_PASSWORD, data),
  };

  // Users API
  users = {
    getProfile: () => this.get(API_ENDPOINTS.USERS.PROFILE),
    
    updateProfile: (data: any) => this.patch(API_ENDPOINTS.USERS.PROFILE, data),
    
    getPreferences: () => this.get(API_ENDPOINTS.USERS.PREFERENCES),
    
    updatePreferences: (data: any) => this.patch(API_ENDPOINTS.USERS.PREFERENCES, data),
    
    getStorageUsage: (userId: string) => 
      this.get(API_ENDPOINTS.USERS.STORAGE_USAGE.replace(':userId', userId)),
    
    getSubscription: (userId: string) => 
      this.get(API_ENDPOINTS.USERS.SUBSCRIPTION.replace(':userId', userId)),
  };

  // Files API
  files = {
    list: (params?: any) => 
      this.get(`${API_ENDPOINTS.FILES.LIST}${params ? '?' + new URLSearchParams(params) : ''}`),
    
    upload: (files: FormData) => 
      this.post(API_ENDPOINTS.FILES.UPLOAD, files),
    
    get: (fileId: string) => 
      this.get(API_ENDPOINTS.FILES.GET.replace(':fileId', fileId)),
    
    update: (fileId: string, data: any) => 
      this.patch(API_ENDPOINTS.FILES.UPDATE.replace(':fileId', fileId), data),
    
    delete: (fileId: string) => 
      this.delete(API_ENDPOINTS.FILES.DELETE.replace(':fileId', fileId)),
    
    download: (fileId: string) => 
      this.get(API_ENDPOINTS.FILES.DOWNLOAD.replace(':fileId', fileId)),
    
    preview: (fileId: string) => 
      this.get(API_ENDPOINTS.FILES.PREVIEW.replace(':fileId', fileId)),
    
    move: (data: { fileIds: string[]; targetFolderId?: string }) => 
      this.patch(API_ENDPOINTS.FILES.MOVE, data),
    
    copy: (data: { fileIds: string[]; targetFolderId?: string }) => 
      this.post(API_ENDPOINTS.FILES.COPY, data),
    
    restore: (data: { fileIds: string[] }) => 
      this.patch(API_ENDPOINTS.FILES.RESTORE, data),
    
    search: (params: any) => 
      this.get(`${API_ENDPOINTS.FILES.SEARCH}?${new URLSearchParams(params)}`),
    
    getVersions: (fileId: string) => 
      this.get(API_ENDPOINTS.FILES.VERSIONS.replace(':fileId', fileId)),
    
    share: (data: any) => 
      this.post(API_ENDPOINTS.FILES.SHARE, data),
  };

  // Folders API
  folders = {
    list: (params?: any) => 
      this.get(`${API_ENDPOINTS.FOLDERS.LIST}${params ? '?' + new URLSearchParams(params) : ''}`),
    
    create: (data: { name: string; parentId?: string; description?: string; color?: string }) => 
      this.post(API_ENDPOINTS.FOLDERS.CREATE, data),
    
    get: (folderId: string) => 
      this.get(API_ENDPOINTS.FOLDERS.GET.replace(':folderId', folderId)),
    
    update: (folderId: string, data: any) => 
      this.patch(API_ENDPOINTS.FOLDERS.UPDATE.replace(':folderId', folderId), data),
    
    delete: (folderId: string) => 
      this.delete(API_ENDPOINTS.FOLDERS.DELETE.replace(':folderId', folderId)),
    
    move: (data: { folderIds: string[]; targetParentId?: string }) => 
      this.patch(API_ENDPOINTS.FOLDERS.MOVE, data),
    
    share: (folderId: string, data: any) => 
      this.post(API_ENDPOINTS.FOLDERS.SHARE.replace(':folderId', folderId), data),
  };

  // Sharing API
  shares = {
    create: (data: any) => this.post(API_ENDPOINTS.SHARES.CREATE, data),
    
    get: (shareToken: string) => 
      this.get(API_ENDPOINTS.SHARES.GET.replace(':shareToken', shareToken)),
    
    update: (shareId: string, data: any) => 
      this.patch(API_ENDPOINTS.SHARES.UPDATE.replace(':shareId', shareId), data),
    
    delete: (shareId: string) => 
      this.delete(API_ENDPOINTS.SHARES.DELETE.replace(':shareId', shareId)),
    
    getPublic: (shareId: string) => 
      this.get(API_ENDPOINTS.SHARES.PUBLIC.replace(':shareId', shareId)),
  };

  // Admin API
  admin = {
    getStats: (params?: any) => 
      this.get(`${API_ENDPOINTS.ADMIN.STATS}${params ? '?' + new URLSearchParams(params) : ''}`),
    
    getUsers: (params?: any) => 
      this.get(`${API_ENDPOINTS.ADMIN.USERS}${params ? '?' + new URLSearchParams(params) : ''}`),
    
    getUser: (userId: string) => 
      this.get(API_ENDPOINTS.ADMIN.USER.replace(':userId', userId)),
    
    updateUser: (userId: string, data: any) => 
      this.patch(API_ENDPOINTS.ADMIN.USER.replace(':userId', userId), data),
    
    deleteUser: (userId: string) => 
      this.delete(API_ENDPOINTS.ADMIN.USER.replace(':userId', userId)),
    
    getAnalytics: (params?: any) => 
      this.get(`${API_ENDPOINTS.ADMIN.ANALYTICS}${params ? '?' + new URLSearchParams(params) : ''}`),
    
    getSystemSettings: () => this.get(API_ENDPOINTS.ADMIN.SYSTEM_SETTINGS),
    
    updateSystemSettings: (data: any) => 
      this.patch(API_ENDPOINTS.ADMIN.SYSTEM_SETTINGS, data),
    
    getEmailConfig: () => this.get(API_ENDPOINTS.ADMIN.EMAIL_CONFIG),
    
    updateEmailConfig: (data: any) => 
      this.patch(API_ENDPOINTS.ADMIN.EMAIL_CONFIG, data),
    
    getStorageConfig: () => this.get(API_ENDPOINTS.ADMIN.STORAGE_CONFIG),
    
    updateStorageConfig: (data: any) => 
      this.patch(API_ENDPOINTS.ADMIN.STORAGE_CONFIG, data),
    
    testEmailConfig: (data: any) => 
      this.post(API_ENDPOINTS.ADMIN.EMAIL_TEST, data),
    
    testStorageConnection: (data: any) => 
      this.post(API_ENDPOINTS.ADMIN.STORAGE_TEST, data),
  };

  // Payments API
  payments = {
    createSubscription: (data: any) => 
      this.post(API_ENDPOINTS.PAYMENTS.CREATE_SUBSCRIPTION, data),
    
    cancelSubscription: () => 
      this.post(API_ENDPOINTS.PAYMENTS.CANCEL_SUBSCRIPTION),
    
    createPortalSession: () => 
      this.post(API_ENDPOINTS.PAYMENTS.PORTAL),
    
    webhook: (data: any) => 
      this.post(API_ENDPOINTS.PAYMENTS.WEBHOOK, data),
  };

  // Storage API
  storage = {
    getUsage: () => this.get(API_ENDPOINTS.STORAGE.USAGE),
    
    getConfig: () => this.get(API_ENDPOINTS.STORAGE.CONFIG),
    
    testConnection: (data: any) => 
      this.post(API_ENDPOINTS.STORAGE.TEST_CONNECTION, data),
  };

  // Email API
  email = {
    send: (data: any) => this.post(API_ENDPOINTS.EMAIL.SEND, data),
    
    getTemplates: () => this.get(API_ENDPOINTS.EMAIL.TEMPLATES),
    
    test: (data: any) => this.post(API_ENDPOINTS.EMAIL.TEST, data),
  };

  // Health check
  health = {
    check: () => this.get(API_ENDPOINTS.HEALTH),
  };
}

// Default instance
export const apiClient = new ApiClient();
