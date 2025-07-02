// src/lib/config/email.ts
import { env } from './env';
import { EmailProvider, EmailTemplate, EmailVariable } from '@/types/email';

export interface EmailProviderConfig {
  smtp: {
    host: string;
    port: number;
    secure: boolean;
    auth: {
      user: string;
      pass: string;
    };
    tls?: {
      rejectUnauthorized: boolean;
    };
  };
  sendgrid: {
    apiKey: string;
    apiVersion: string;
  };
  mailgun: {
    apiKey: string;
    domain: string;
    host: string;
  };
  ses: {
    region: string;
    accessKeyId: string;
    secretAccessKey: string;
    apiVersion: string;
  };
}

export interface EmailGlobalConfig {
  defaultProvider: EmailProvider;
  fallbackProvider?: EmailProvider;
  retryAttempts: number;
  retryDelay: number;
  timeout: number;
  rateLimit: {
    maxEmails: number;
    windowMs: number;
  };
  templates: {
    baseUrl: string;
    defaultLanguage: 'en' | 'id';
    enablePreview: boolean;
  };
  tracking: {
    enableOpen: boolean;
    enableClick: boolean;
    enableDelivery: boolean;
    enableBounce: boolean;
  };
  compliance: {
    enableUnsubscribe: boolean;
    unsubscribeUrl: string;
    includeListId: boolean;
    gdprCompliant: boolean;
  };
}

export const emailProviderConfigs: EmailProviderConfig = {
  smtp: {
    host: env.SMTP_HOST || 'localhost',
    port: parseInt(env.SMTP_PORT || '587'),
    secure: env.SMTP_SECURE === 'true',
    auth: {
      user: env.SMTP_USER || '',
      pass: env.SMTP_PASS || '',
    },
    tls: {
      rejectUnauthorized: false,
    },
  },
  sendgrid: {
    apiKey: process.env.SENDGRID_API_KEY || '',
    apiVersion: 'v3',
  },
  mailgun: {
    apiKey: process.env.MAILGUN_API_KEY || '',
    domain: process.env.MAILGUN_DOMAIN || '',
    host: process.env.MAILGUN_HOST || 'api.mailgun.net',
  },
  ses: {
    region: process.env.SES_REGION || 'us-east-1',
    accessKeyId: process.env.SES_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.SES_SECRET_ACCESS_KEY || '',
    apiVersion: '2010-12-01',
  },
};

export const emailGlobalConfig: EmailGlobalConfig = {
  defaultProvider: (process.env.DEFAULT_EMAIL_PROVIDER as EmailProvider) || 'smtp',
  fallbackProvider: (process.env.FALLBACK_EMAIL_PROVIDER as EmailProvider) || undefined,
  retryAttempts: 3,
  retryDelay: 5000, // 5 seconds
  timeout: 30000, // 30 seconds
  rateLimit: {
    maxEmails: 100,
    windowMs: 60 * 1000, // 1 minute
  },
  templates: {
    baseUrl: process.env.NEXTAUTH_URL || 'http://localhost:3000',
    defaultLanguage: 'en',
    enablePreview: env.NODE_ENV === 'development',
  },
  tracking: {
    enableOpen: true,
    enableClick: true,
    enableDelivery: true,
    enableBounce: true,
  },
  compliance: {
    enableUnsubscribe: true,
    unsubscribeUrl: '/unsubscribe',
    includeListId: true,
    gdprCompliant: true,
  },
};

// Default email templates configuration
export const defaultEmailTemplates: Record<string, EmailTemplate> = {
  welcome: {
    id: 'welcome',
    name: 'Welcome Email',
    subject: 'Welcome to CloudNest!',
    htmlContent: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #3B82F6;">Welcome to CloudNest!</h1>
        <p>Hi {{userName}},</p>
        <p>Thank you for joining CloudNest! Your account has been successfully created.</p>
        <p>You can now start uploading and managing your files securely in the cloud.</p>
        <div style="margin: 30px 0;">
          <a href="{{dashboardUrl}}" style="background-color: #3B82F6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px;">
            Go to Dashboard
          </a>
        </div>
        <p>If you have any questions, feel free to contact our support team.</p>
        <p>Best regards,<br>The CloudNest Team</p>
      </div>
    `,
    textContent: `
      Welcome to CloudNest!
      
      Hi {{userName}},
      
      Thank you for joining CloudNest! Your account has been successfully created.
      You can now start uploading and managing your files securely in the cloud.
      
      Visit your dashboard: {{dashboardUrl}}
      
      If you have any questions, feel free to contact our support team.
      
      Best regards,
      The CloudNest Team
    `,
    variables: [
      { name: 'userName', description: 'User full name', required: true },
      { name: 'dashboardUrl', description: 'URL to user dashboard', required: true },
      { name: 'supportEmail', description: 'Support email address', required: false, defaultValue: 'support@cloudnest.com' },
    ],
    isActive: true,
  },
  passwordReset: {
    id: 'passwordReset',
    name: 'Password Reset',
    subject: 'Reset Your CloudNest Password',
    htmlContent: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #3B82F6;">Password Reset Request</h1>
        <p>Hi {{userName}},</p>
        <p>We received a request to reset your CloudNest password.</p>
        <div style="margin: 30px 0;">
          <a href="{{resetUrl}}" style="background-color: #3B82F6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px;">
            Reset Password
          </a>
        </div>
        <p>This link will expire in {{expiryTime}} for security reasons.</p>
        <p>If you didn't request this reset, please ignore this email.</p>
        <p>Best regards,<br>The CloudNest Team</p>
      </div>
    `,
    textContent: `
      Password Reset Request
      
      Hi {{userName}},
      
      We received a request to reset your CloudNest password.
      
      Reset your password: {{resetUrl}}
      
      This link will expire in {{expiryTime}} for security reasons.
      If you didn't request this reset, please ignore this email.
      
      Best regards,
      The CloudNest Team
    `,
    variables: [
      { name: 'userName', description: 'User full name', required: true },
      { name: 'resetUrl', description: 'Password reset URL', required: true },
      { name: 'expiryTime', description: 'Link expiry time', required: true, defaultValue: '10 minutes' },
    ],
    isActive: true,
  },
  fileShared: {
    id: 'fileShared',
    name: 'File Shared',
    subject: '{{senderName}} shared a file with you',
    htmlContent: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #3B82F6;">File Shared With You</h1>
        <p>Hi there,</p>
        <p>{{senderName}} has shared a file with you on CloudNest.</p>
        <div style="background-color: #f3f4f6; padding: 20px; margin: 20px 0; border-radius: 5px;">
          <h3 style="margin: 0 0 10px 0;">{{fileName}}</h3>
          <p style="margin: 0; color: #6b7280;">{{fileType}} • {{fileSize}}</p>
        </div>
        {{#if customMessage}}
        <div style="background-color: #fef3c7; padding: 15px; margin: 20px 0; border-radius: 5px; border-left: 4px solid #f59e0b;">
          <p style="margin: 0; font-style: italic;">"{{customMessage}}"</p>
        </div>
        {{/if}}
        <div style="margin: 30px 0;">
          <a href="{{shareUrl}}" style="background-color: #3B82F6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px;">
            View File
          </a>
        </div>
        {{#if expiresAt}}
        <p><small>This share link expires on {{expiresAt}}.</small></p>
        {{/if}}
        <p>Best regards,<br>The CloudNest Team</p>
      </div>
    `,
    textContent: `
      File Shared With You
      
      Hi there,
      
      {{senderName}} has shared a file with you on CloudNest.
      
      File: {{fileName}}
      Type: {{fileType}}
      Size: {{fileSize}}
      
      {{#if customMessage}}
      Message: "{{customMessage}}"
      {{/if}}
      
      View file: {{shareUrl}}
      
      {{#if expiresAt}}
      This share link expires on {{expiresAt}}.
      {{/if}}
      
      Best regards,
      The CloudNest Team
    `,
    variables: [
      { name: 'senderName', description: 'Name of person sharing', required: true },
      { name: 'fileName', description: 'Name of shared file', required: true },
      { name: 'fileType', description: 'File type', required: true },
      { name: 'fileSize', description: 'File size', required: true },
      { name: 'shareUrl', description: 'URL to view shared file', required: true },
      { name: 'customMessage', description: 'Custom message from sender', required: false },
      { name: 'expiresAt', description: 'Share expiration date', required: false },
    ],
    isActive: true,
  },
  storageQuota: {
    id: 'storageQuota',
    name: 'Storage Quota Warning',
    subject: 'CloudNest Storage Alert: {{quotaPercentage}}% Full',
    htmlContent: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #f59e0b;">Storage Alert</h1>
        <p>Hi {{userName}},</p>
        <p>Your CloudNest storage is {{quotaPercentage}}% full.</p>
        <div style="background-color: #fef3c7; padding: 20px; margin: 20px 0; border-radius: 5px;">
          <h3 style="margin: 0 0 10px 0;">Storage Usage</h3>
          <p style="margin: 0;">{{usedStorage}} of {{totalStorage}} used</p>
          <div style="background-color: #e5e7eb; height: 10px; border-radius: 5px; margin: 10px 0;">
            <div style="background-color: {{#if isNearLimit}}#ef4444{{else}}#f59e0b{{/if}}; height: 100%; width: {{quotaPercentage}}%; border-radius: 5px;"></div>
          </div>
        </div>
        <p>Consider cleaning up old files or upgrading your plan to get more storage.</p>
        <div style="margin: 30px 0;">
          <a href="{{upgradeUrl}}" style="background-color: #3B82F6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin-right: 10px;">
            Upgrade Plan
          </a>
          <a href="{{manageUrl}}" style="background-color: #6b7280; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px;">
            Manage Files
          </a>
        </div>
        <p>Best regards,<br>The CloudNest Team</p>
      </div>
    `,
    textContent: `
      Storage Alert
      
      Hi {{userName}},
      
      Your CloudNest storage is {{quotaPercentage}}% full.
      
      Storage Usage: {{usedStorage}} of {{totalStorage}} used
      
      Consider cleaning up old files or upgrading your plan to get more storage.
      
      Upgrade plan: {{upgradeUrl}}
      Manage files: {{manageUrl}}
      
      Best regards,
      The CloudNest Team
    `,
    variables: [
      { name: 'userName', description: 'User full name', required: true },
      { name: 'quotaPercentage', description: 'Storage usage percentage', required: true },
      { name: 'usedStorage', description: 'Used storage formatted', required: true },
      { name: 'totalStorage', description: 'Total storage formatted', required: true },
      { name: 'upgradeUrl', description: 'URL to upgrade plan', required: true },
      { name: 'manageUrl', description: 'URL to manage files', required: true },
      { name: 'isNearLimit', description: 'Whether near storage limit', required: false },
    ],
    isActive: true,
  },
  subscription: {
    id: 'subscription',
    name: 'Subscription Update',
    subject: 'CloudNest Subscription {{action}}',
    htmlContent: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #3B82F6;">Subscription {{action}}</h1>
        <p>Hi {{userName}},</p>
        <p>{{message}}</p>
        <div style="background-color: #f3f4f6; padding: 20px; margin: 20px 0; border-radius: 5px;">
          <h3 style="margin: 0 0 10px 0;">{{planName}} Plan</h3>
          <p style="margin: 0;">{{planPrice}} • {{planInterval}}</p>
          {{#if nextBillingDate}}
          <p style="margin: 10px 0 0 0;"><strong>Next billing:</strong> {{nextBillingDate}}</p>
          {{/if}}
        </div>
        <div style="margin: 30px 0;">
          <a href="{{manageUrl}}" style="background-color: #3B82F6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px;">
            Manage Subscription
          </a>
        </div>
        <p>Best regards,<br>The CloudNest Team</p>
      </div>
    `,
    textContent: `
      Subscription {{action}}
      
      Hi {{userName}},
      
      {{message}}
      
      Plan: {{planName}} Plan
      Price: {{planPrice}} • {{planInterval}}
      {{#if nextBillingDate}}
      Next billing: {{nextBillingDate}}
      {{/if}}
      
      Manage subscription: {{manageUrl}}
      
      Best regards,
      The CloudNest Team
    `,
    variables: [
      { name: 'userName', description: 'User full name', required: true },
      { name: 'action', description: 'Subscription action (Created, Updated, Cancelled)', required: true },
      { name: 'message', description: 'Custom message about the action', required: true },
      { name: 'planName', description: 'Subscription plan name', required: true },
      { name: 'planPrice', description: 'Plan price formatted', required: true },
      { name: 'planInterval', description: 'Billing interval', required: true },
      { name: 'manageUrl', description: 'URL to manage subscription', required: true },
      { name: 'nextBillingDate', description: 'Next billing date', required: false },
    ],
    isActive: true,
  },
};

// Email queue configuration
export const emailQueueConfig = {
  maxRetries: 3,
  retryDelay: 5000,
  batchSize: 10,
  processInterval: 5000,
  maxAge: 24 * 60 * 60 * 1000, // 24 hours
};

// Common email variables available to all templates
export const commonEmailVariables: EmailVariable[] = [
  { name: 'appName', description: 'Application name', required: true, defaultValue: 'CloudNest' },
  { name: 'appUrl', description: 'Application URL', required: true },
  { name: 'supportEmail', description: 'Support email', required: true, defaultValue: 'support@cloudnest.com' },
  { name: 'currentYear', description: 'Current year', required: true, defaultValue: new Date().getFullYear().toString() },
  { name: 'unsubscribeUrl', description: 'Unsubscribe URL', required: false },
];

export default {
  providers: emailProviderConfigs,
  global: emailGlobalConfig,
  templates: defaultEmailTemplates,
  queue: emailQueueConfig,
  commonVariables: commonEmailVariables,
};