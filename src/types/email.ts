import { ObjectId } from "mongoose";

export interface EmailConfig {
  id: ObjectId;
  name: string;
  provider: EmailProvider;
  isActive: boolean;
  isDefault: boolean;
  config: EmailProviderConfig;
  settings: EmailSettings;
  templates: EmailTemplateConfig;
  stats: EmailStats;
  isHealthy: boolean;
  lastHealthCheck?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type EmailProvider = 'smtp' | 'sendgrid' | 'mailgun' | 'ses';

export interface EmailProviderConfig {
  // SMTP
  host?: string;
  port?: number;
  secure?: boolean;
  username?: string;
  password?: string;
  
  // SendGrid
  apiKey?: string;
  
  // Mailgun
  domain?: string;
  
  // SES
  region?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
}

export interface EmailSettings {
  fromEmail: string;
  fromName: string;
  replyTo?: string;
  timeout: number;
  retryAttempts: number;
  enableTracking: boolean;
  enableBounceHandling: boolean;
}

export interface EmailTemplateConfig {
  welcome: boolean;
  passwordReset: boolean;
  fileShared: boolean;
  storageQuota: boolean;
  subscription: boolean;
  customBranding: boolean;
}

export interface EmailStats {
  emailsSent: number;
  emailsFailed: number;
  bounceRate: number;
  openRate: number;
  clickRate: number;
  lastUsed?: Date;
}

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  htmlContent: string;
  textContent: string;
  variables: EmailVariable[];
  isActive: boolean;
}

export interface EmailVariable {
  name: string;
  description: string;
  required: boolean;
  defaultValue?: string;
}

export interface EmailMessage {
  to: string | string[];
  from?: string;
  replyTo?: string;
  subject: string;
  html?: string;
  text?: string;
  attachments?: EmailAttachment[];
  variables?: Record<string, any>;
  templateId?: string;
  metadata?: Record<string, any>;
}

export interface EmailAttachment {
  filename: string;
  content: Buffer | string;
  contentType?: string;
  disposition?: 'attachment' | 'inline';
  cid?: string;
}

export interface EmailDelivery {
  id: ObjectId;
  messageId: string;
  to: string;
  subject: string;
  status: EmailDeliveryStatus;
  provider: EmailProvider;
  sentAt: Date;
  deliveredAt?: Date;
  openedAt?: Date;
  clickedAt?: Date;
  bouncedAt?: Date;
  error?: string;
}

export type EmailDeliveryStatus = 
  | 'queued' 
  | 'sent' 
  | 'delivered' 
  | 'opened' 
  | 'clicked' 
  | 'bounced' 
  | 'failed';

export interface EmailQueue {
  id: ObjectId;
  message: EmailMessage;
  attempts: number;
  maxAttempts: number;
  scheduledAt: Date;
  processedAt?: Date;
  status: 'pending' | 'processing' | 'sent' | 'failed';
  error?: string;
}
