import { HealthStatus } from "./admin";
import { PaginationResult } from "./common";
import { FileUploadResult } from "./file";
import { Share } from "./sharing";
import { Invoice, Subscription } from "./subscription";
import { User } from "./user";

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: ApiError;
  message?: string;
  meta?: ApiMeta;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, any>;
  stack?: string;
}

export interface ApiMeta {
  pagination?: PaginationResult<any>['pagination'];
  timestamp: Date;
  version: string;
  requestId: string;
}

export interface ApiRequest<T = any> {
  body?: T;
  query?: Record<string, string | string[]>;
  params?: Record<string, string>;
  headers?: Record<string, string>;
  user?: User;
}

export interface ApiEndpoint {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  auth: boolean;
  roles?: ('user' | 'admin')[];
  rateLimit?: {
    requests: number;
    window: number;
  };
}

export interface ApiValidation {
  body?: any; // Zod schema
  query?: any; // Zod schema
  params?: any; // Zod schema
}

export interface FileUploadResponse {
  files: FileUploadResult[];
  failed: FileUploadError[];
  summary: {
    total: number;
    successful: number;
    failed: number;
    totalSize: number;
  };
}

export interface FileUploadError {
  filename: string;
  error: string;
  code: string;
}

export interface ShareResponse {
  share: Share;
  url: string;
  qrCode?: string;
}

export interface SubscriptionResponse {
  subscription: Subscription;
  invoice?: Invoice;
  paymentIntent?: {
    clientSecret: string;
    status: string;
  };
}

export interface WebhookEvent {
  id: string;
  type: string;
  data: any;
  timestamp: Date;
  source: 'stripe' | 'internal';
}

export interface HealthCheckResponse {
  status: 'healthy' | 'unhealthy';
  version: string;
  uptime: number;
  services: {
    database: HealthStatus;
    storage: HealthStatus;
    email: HealthStatus;
  };
  timestamp: Date;
}

export interface SearchResponse<T> {
  results: T[];
  suggestions: string[];
  facets: SearchFacet[];
  total: number;
  query: string;
  took: number;
}

export interface SearchFacet {
  field: string;
  values: SearchFacetValue[];
}

export interface SearchFacetValue {
  value: string;
  count: number;
  selected: boolean;
}

export interface BatchOperation<T> {
  action: string;
  items: T[];
  options?: Record<string, any>;
}

export interface BatchOperationResult<T> {
  successful: T[];
  failed: BatchOperationError<T>[];
  summary: {
    total: number;
    successful: number;
    failed: number;
  };
}

export interface BatchOperationError<T> {
  item: T;
  error: string;
  code: string;
}