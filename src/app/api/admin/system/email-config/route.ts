import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/database/connection';
import { EmailConfig } from '@/lib/database/models';
import { emailTestSchema, emailTemplateSchema } from '@/lib/validation/admin';
import { PermissionUtils } from '@/lib/utils/permission-utils';
import { HTTP_STATUS, ERROR_CODES, EMAIL_PROVIDERS } from '@/lib/utils/constants';
import { getServerSession } from 'next-auth';
import { ApiResponse } from '@/types/api';
import { EmailConfig as IEmailConfig, EmailTemplate } from '@/types/email';
import mongoose from 'mongoose';
import { emailConfigSchema } from '@/lib/validation/settings';

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: {
          code: ERROR_CODES.AUTHENTICATION_ERROR,
          message: 'Authentication required'
        }
      }, { status: HTTP_STATUS.UNAUTHORIZED });
    }

    // Check admin permissions
    if (!PermissionUtils.requireAdmin(session.user.role as 'user' | 'admin')) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: {
          code: ERROR_CODES.AUTHORIZATION_ERROR,
          message: 'Admin access required'
        }
      }, { status: HTTP_STATUS.FORBIDDEN });
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const provider = searchParams.get('provider');

    await connectToDatabase();

    switch (action) {
      case 'providers':
        // Get all configured email providers
        const query = provider ? { provider } : {};
        const configs = await EmailConfig.find(query)
          .sort({ isDefault: -1, name: 1 })
          .select('-config.password -config.apiKey -config.accessKeyId -config.secretAccessKey');
        
        return NextResponse.json<ApiResponse>({
          success: true,
          data: {
            configs,
            availableProviders: Object.values(EMAIL_PROVIDERS),
            defaultProvider: configs.find(c => c.isDefault)?.provider || null
          },
          meta: {
            timestamp: new Date(),
            version: '1.0.0',
            requestId: crypto.randomUUID()
          }
        });

      case 'templates':
        // Get email templates
        const templates = getEmailTemplates();
        
        return NextResponse.json<ApiResponse>({
          success: true,
          data: { templates },
          meta: {
            timestamp: new Date(),
            version: '1.0.0',
            requestId: crypto.randomUUID()
          }
        });

      case 'statistics':
        // Get email statistics
        const statistics = await getEmailStatistics();
        
        return NextResponse.json<ApiResponse>({
          success: true,
          data: statistics,
          meta: {
            timestamp: new Date(),
            version: '1.0.0',
            requestId: crypto.randomUUID()
          }
        });

      case 'health':
        // Get health status of email providers
        const activeConfigs = await EmailConfig.find({ isActive: true });
        const healthChecks = await Promise.all(
          activeConfigs.map(async (config) => {
            try {
              const isHealthy = await config.testConnection();
              return {
                configId: config._id,
                provider: config.provider,
                name: config.name,
                isHealthy,
                lastCheck: config.lastHealthCheck,
                stats: config.stats
              };
            } catch (error) {
              return {
                configId: config._id,
                provider: config.provider,
                name: config.name,
                isHealthy: false,
                lastCheck: new Date(),
                error: (error as Error).message
              };
            }
          })
        );

        return NextResponse.json<ApiResponse>({
          success: true,
          data: { healthChecks },
          meta: {
            timestamp: new Date(),
            version: '1.0.0',
            requestId: crypto.randomUUID()
          }
        });

      default:
        // Get email overview
        const overview = await getEmailOverview();
        
        return NextResponse.json<ApiResponse>({
          success: true,
          data: overview,
          meta: {
            timestamp: new Date(),
            version: '1.0.0',
            requestId: crypto.randomUUID()
          }
        });
    }

  } catch (error) {
    console.error('Admin email config fetch error:', error);
    
    return NextResponse.json<ApiResponse>({
      success: false,
      error: {
        code: ERROR_CODES.VALIDATION_ERROR,
        message: error instanceof Error ? error.message : 'Failed to fetch email configuration'
      }
    }, { status: HTTP_STATUS.INTERNAL_SERVER_ERROR });
  }
}

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: {
          code: ERROR_CODES.AUTHENTICATION_ERROR,
          message: 'Authentication required'
        }
      }, { status: HTTP_STATUS.UNAUTHORIZED });
    }

    // Check admin permissions
    if (!PermissionUtils.requireAdmin(session.user.role as 'user' | 'admin')) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: {
          code: ERROR_CODES.AUTHORIZATION_ERROR,
          message: 'Admin access required'
        }
      }, { status: HTTP_STATUS.FORBIDDEN });
    }

    const body = await request.json();
    const { action } = body;

    await connectToDatabase();

    switch (action) {
      case 'create_config':
        // Create new email configuration
        const configData = emailConfigSchema.parse(body.config);
        
        // Validate provider-specific requirements
        const validation = validateEmailProvider(configData);
        if (!validation.isValid) {
          return NextResponse.json<ApiResponse>({
            success: false,
            error: {
              code: ERROR_CODES.VALIDATION_ERROR,
              message: validation.message ?? 'Invalid email provider configuration'
            }
          }, { status: HTTP_STATUS.BAD_REQUEST });
        }

        // If this is set as default, remove default from others
        if (configData.isDefault) {
          await EmailConfig.updateMany({}, { isDefault: false });
        }

        const newConfig = new EmailConfig(configData);
        await newConfig.save();

        return NextResponse.json<ApiResponse>({
          success: true,
          data: { configId: newConfig._id },
          message: 'Email configuration created successfully',
          meta: {
            timestamp: new Date(),
            version: '1.0.0',
            requestId: crypto.randomUUID()
          }
        });

      case 'test_email':
        // Send test email
        const testData = emailTestSchema.parse(body);
        
        const config = await EmailConfig.findById(testData.configId);
        if (!config) {
          return NextResponse.json<ApiResponse>({
            success: false,
            error: {
              code: ERROR_CODES.NOT_FOUND_ERROR,
              message: 'Email configuration not found'
            }
          }, { status: HTTP_STATUS.NOT_FOUND });
        }

        const testResult = await sendTestEmail(config, testData);
        
        return NextResponse.json<ApiResponse>({
          success: testResult.success,
          data: testResult,
          message: testResult.success ? 'Test email sent successfully' : 'Test email failed',
          meta: {
            timestamp: new Date(),
            version: '1.0.0',
            requestId: crypto.randomUUID()
          }
        });

      case 'test_connection':
        // Test email provider connection
        const { configId } = body;
        
        const testConfig = await EmailConfig.findById(configId);
        if (!testConfig) {
          return NextResponse.json<ApiResponse>({
            success: false,
            error: {
              code: ERROR_CODES.NOT_FOUND_ERROR,
              message: 'Email configuration not found'
            }
          }, { status: HTTP_STATUS.NOT_FOUND });
        }

        const connectionTest = await testConfig.testConnection();
        
        return NextResponse.json<ApiResponse>({
          success: true,
          data: { 
            configId,
            isHealthy: connectionTest,
            provider: testConfig.provider,
            name: testConfig.name
          },
          message: connectionTest ? 'Connection test successful' : 'Connection test failed',
          meta: {
            timestamp: new Date(),
            version: '1.0.0',
            requestId: crypto.randomUUID()
          }
        });

      case 'set_default':
        // Set default email provider
        const { configId: defaultConfigId } = body;
        
        if (!mongoose.Types.ObjectId.isValid(defaultConfigId)) {
          return NextResponse.json<ApiResponse>({
            success: false,
            error: {
              code: ERROR_CODES.VALIDATION_ERROR,
              message: 'Invalid configuration ID'
            }
          }, { status: HTTP_STATUS.BAD_REQUEST });
        }

        await EmailConfig.setDefault(new mongoose.Types.ObjectId(defaultConfigId));
        
        return NextResponse.json<ApiResponse>({
          success: true,
          message: 'Default email provider updated',
          meta: {
            timestamp: new Date(),
            version: '1.0.0',
            requestId: crypto.randomUUID()
          }
        });

      case 'update_template':
        // Update email template
        const templateData = emailTemplateSchema.parse(body.template);
        const updatedTemplate = await updateEmailTemplate(templateData);
        
        return NextResponse.json<ApiResponse>({
          success: true,
          data: updatedTemplate,
          message: 'Email template updated successfully',
          meta: {
            timestamp: new Date(),
            version: '1.0.0',
            requestId: crypto.randomUUID()
          }
        });

      case 'bulk_health_check':
        // Run health check on all active providers
        const activeConfigs = await EmailConfig.find({ isActive: true });
        const bulkHealthResults: {
          configId: mongoose.Types.ObjectId;
          provider: "smtp" | "sendgrid" | "mailgun" | "ses";
          name: string;
          isHealthy: boolean;
          message: string;
        }[] = [];

        for (const config of activeConfigs) {
          try {
            const isHealthy = await config.testConnection();
            bulkHealthResults.push({
              configId: config._id,
              provider: config.provider,
              name: config.name,
              isHealthy,
              message: isHealthy ? 'Connection successful' : 'Connection failed'
            });
          } catch (error) {
            bulkHealthResults.push({
              configId: config._id,
              provider: config.provider,
              name: config.name,
              isHealthy: false,
              message: (error as Error).message
            });
          }
        }

        return NextResponse.json<ApiResponse>({
          success: true,
          data: { results: bulkHealthResults },
          message: 'Bulk health check completed',
          meta: {
            timestamp: new Date(),
            version: '1.0.0',
            requestId: crypto.randomUUID()
          }
        });

      default:
        return NextResponse.json<ApiResponse>({
          success: false,
          error: {
            code: ERROR_CODES.VALIDATION_ERROR,
            message: 'Invalid action specified'
          }
        }, { status: HTTP_STATUS.BAD_REQUEST });
    }

  } catch (error) {
    console.error('Admin email config action error:', error);
    
    return NextResponse.json<ApiResponse>({
      success: false,
      error: {
        code: ERROR_CODES.VALIDATION_ERROR,
        message: error instanceof Error ? error.message : 'Failed to perform email configuration action'
      }
    }, { status: HTTP_STATUS.INTERNAL_SERVER_ERROR });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user || !PermissionUtils.requireAdmin(session.user.role as 'user' | 'admin')) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: {
          code: ERROR_CODES.AUTHORIZATION_ERROR,
          message: 'Admin access required'
        }
      }, { status: HTTP_STATUS.FORBIDDEN });
    }

    const body = await request.json();
    const { configId, updates } = body;

    if (!mongoose.Types.ObjectId.isValid(configId)) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: {
          code: ERROR_CODES.VALIDATION_ERROR,
          message: 'Invalid configuration ID'
        }
      }, { status: HTTP_STATUS.BAD_REQUEST });
    }

    const validatedUpdates = emailConfigSchema.partial().parse(updates);

    await connectToDatabase();

    const config = await EmailConfig.findById(configId);
    if (!config) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: {
          code: ERROR_CODES.NOT_FOUND_ERROR,
          message: 'Email configuration not found'
        }
      }, { status: HTTP_STATUS.NOT_FOUND });
    }

    // If setting as default, remove default from others
    if (validatedUpdates.isDefault) {
      await EmailConfig.updateMany({ _id: { $ne: configId } }, { isDefault: false });
    }

    Object.assign(config, validatedUpdates);
    await config.save();

    return NextResponse.json<ApiResponse>({
      success: true,
      data: { configId },
      message: 'Email configuration updated successfully',
      meta: {
        timestamp: new Date(),
        version: '1.0.0',
        requestId: crypto.randomUUID()
      }
    });

  } catch (error) {
    console.error('Email config update error:', error);
    
    return NextResponse.json<ApiResponse>({
      success: false,
      error: {
        code: ERROR_CODES.VALIDATION_ERROR,
        message: error instanceof Error ? error.message : 'Failed to update email configuration'
      }
    }, { status: HTTP_STATUS.INTERNAL_SERVER_ERROR });
  }
}

// Helper functions

function validateEmailProvider(config: any): { isValid: boolean; message?: string } {
  switch (config.provider) {
    case 'smtp':
      if (!config.config.host || !config.config.port) {
        return { isValid: false, message: 'SMTP requires host and port' };
      }
      break;
    
    case 'sendgrid':
      if (!config.config.apiKey) {
        return { isValid: false, message: 'SendGrid requires API key' };
      }
      break;
    
    case 'mailgun':
      if (!config.config.domain || !config.config.apiKey) {
        return { isValid: false, message: 'Mailgun requires domain and API key' };
      }
      break;
    
    case 'ses':
      if (!config.config.region || !config.config.accessKeyId || !config.config.secretAccessKey) {
        return { isValid: false, message: 'SES requires region, access key ID, and secret access key' };
      }
      break;
    
    default:
      return { isValid: false, message: 'Invalid email provider' };
  }
  
  return { isValid: true };
}

async function sendTestEmail(config: any, testData: any): Promise<any> {
  try {
    // In a real implementation, this would actually send an email using the configured provider
    // For now, we'll simulate the process
    
    const emailData = {
      to: testData.toEmail,
      subject: testData.subject,
      content: testData.content,
      variables: testData.variables || {}
    };

    // Simulate email sending delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Update statistics
    await config.updateStats(1, 0);

    return {
      success: true,
      messageId: `test-${Date.now()}`,
      provider: config.provider,
      timestamp: new Date()
    };
  } catch (error) {
    // Update statistics with failure
    await config.updateStats(0, 1);
    
    return {
      success: false,
      error: (error as Error).message,
      provider: config.provider,
      timestamp: new Date()
    };
  }
}

function getEmailTemplates(): EmailTemplate[] {
  return [
    {
      id: 'welcome',
      name: 'Welcome Email',
      subject: 'Welcome to {{appName}}!',
      htmlContent: `
        <h1>Welcome to {{appName}}!</h1>
        <p>Hi {{userName}},</p>
        <p>Thank you for joining {{appName}}. We're excited to have you on board!</p>
        <p>Best regards,<br>The {{appName}} Team</p>
      `,
      textContent: `
        Welcome to {{appName}}!
        
        Hi {{userName}},
        
        Thank you for joining {{appName}}. We're excited to have you on board!
        
        Best regards,
        The {{appName}} Team
      `,
      variables: [
        { name: 'appName', description: 'Application name', required: true },
        { name: 'userName', description: 'User name', required: true }
      ],
      isActive: true
    },
    {
      id: 'password-reset',
      name: 'Password Reset',
      subject: 'Reset your {{appName}} password',
      htmlContent: `
        <h1>Password Reset Request</h1>
        <p>Hi {{userName}},</p>
        <p>We received a request to reset your password. Click the link below to reset it:</p>
        <p><a href="{{resetUrl}}">Reset Password</a></p>
        <p>This link will expire in {{expiryHours}} hours.</p>
        <p>If you didn't request this, please ignore this email.</p>
      `,
      textContent: `
        Password Reset Request
        
        Hi {{userName}},
        
        We received a request to reset your password. Visit this link to reset it:
        {{resetUrl}}
        
        This link will expire in {{expiryHours}} hours.
        
        If you didn't request this, please ignore this email.
      `,
      variables: [
        { name: 'userName', description: 'User name', required: true },
        { name: 'resetUrl', description: 'Password reset URL', required: true },
        { name: 'expiryHours', description: 'Link expiry time in hours', required: true, defaultValue: '24' }
      ],
      isActive: true
    },
    {
      id: 'file-shared',
      name: 'File Shared',
      subject: '{{senderName}} shared a file with you',
      htmlContent: `
        <h1>File Shared</h1>
        <p>Hi,</p>
        <p>{{senderName}} has shared a file with you: <strong>{{fileName}}</strong></p>
        <p><a href="{{shareUrl}}">View File</a></p>
        <p>{{customMessage}}</p>
      `,
      textContent: `
        File Shared
        
        Hi,
        
        {{senderName}} has shared a file with you: {{fileName}}
        
        View it here: {{shareUrl}}
        
        {{customMessage}}
      `,
      variables: [
        { name: 'senderName', description: 'Name of person sharing', required: true },
        { name: 'fileName', description: 'Name of shared file', required: true },
        { name: 'shareUrl', description: 'Share URL', required: true },
        { name: 'customMessage', description: 'Custom message from sender', required: false }
      ],
      isActive: true
    }
  ];
}

async function updateEmailTemplate(templateData: any): Promise<EmailTemplate> {
  // In a real implementation, this would save to database
  // For now, we'll return the updated template
  return {
    ...templateData,
    isActive: templateData.isActive ?? true
  };
}

async function getEmailOverview() {
  const configs = await EmailConfig.find({ isActive: true });
  
  const totalStats = configs.reduce(
    (totals, config) => ({
      emailsSent: totals.emailsSent + config.stats.emailsSent,
      emailsFailed: totals.emailsFailed + config.stats.emailsFailed,
      successRate: 0 // Will calculate below
    }),
    { emailsSent: 0, emailsFailed: 0, successRate: 0 }
  );

  const totalEmails = totalStats.emailsSent + totalStats.emailsFailed;
  totalStats.successRate = totalEmails > 0 ? (totalStats.emailsSent / totalEmails) * 100 : 0;

  return {
    summary: totalStats,
    providers: configs.map(config => ({
      id: config._id,
      name: config.name,
      provider: config.provider,
      isDefault: config.isDefault,
      isHealthy: config.isHealthy,
      stats: config.stats
    })),
    templates: getEmailTemplates(),
    recentActivity: [] // Would fetch from email logs in real implementation
  };
}

async function getEmailStatistics() {
  const configs = await EmailConfig.find();
  
  // In a real implementation, this would aggregate actual email sending statistics
  const mockStats = {
    dailyStats: [
      { date: '2024-01-01', sent: 150, failed: 5 },
      { date: '2024-01-02', sent: 180, failed: 3 },
      { date: '2024-01-03', sent: 220, failed: 8 }
    ],
    providerStats: configs.map(config => ({
      provider: config.provider,
      name: config.name,
      sent: config.stats.emailsSent,
      failed: config.stats.emailsFailed,
      successRate: config.stats.emailsSent + config.stats.emailsFailed > 0 
        ? (config.stats.emailsSent / (config.stats.emailsSent + config.stats.emailsFailed)) * 100 
        : 0
    })),
    templateStats: [
      { template: 'welcome', sent: 120, opens: 85, clicks: 15 },
      { template: 'password-reset', sent: 45, opens: 40, clicks: 35 },
      { template: 'file-shared', sent: 200, opens: 180, clicks: 160 }
    ]
  };

  return mockStats;
}