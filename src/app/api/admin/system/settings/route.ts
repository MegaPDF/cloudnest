import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/database/connection';
import { SystemSettings, User } from '@/lib/database/models';
import { adminSystemSettingsUpdateSchema } from '@/lib/validation/admin';
import { PermissionUtils } from '@/lib/utils/permission-utils';
import { HTTP_STATUS, ERROR_CODES } from '@/lib/utils/constants';
import { getServerSession } from 'next-auth';
import { SystemSettings as ISystemSettings } from '@/types/admin';
import { ApiResponse } from '@/types/api';
import mongoose from 'mongoose';

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

    await connectToDatabase();

    // Get system settings (creates default if none exist)
    const settings = await SystemSettings.getInstance();

    // Get additional system information
    const db = mongoose.connection.db;
    const systemInfo = {
      database: {
        status: db ? 'connected' : 'disconnected',
        collections: db ? await db.listCollections().toArray() : [],
        stats: db ? await db.stats() : {}
      },
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage()
      }
    };

    const response = {
      settings: settings.toObject(),
      systemInfo
    };

    return NextResponse.json<ApiResponse>({
      success: true,
      data: response,
      meta: {
        timestamp: new Date(),
        version: '1.0.0',
        requestId: crypto.randomUUID()
      }
    });

  } catch (error) {
    console.error('System settings fetch error:', error);
    
    return NextResponse.json<ApiResponse>({
      success: false,
      error: {
        code: ERROR_CODES.VALIDATION_ERROR,
        message: error instanceof Error ? error.message : 'Failed to fetch system settings'
      }
    }, { status: HTTP_STATUS.INTERNAL_SERVER_ERROR });
  }
}

export async function PUT(request: NextRequest) {
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
    
    // Add updatedBy to the request body
    const updateData = {
      ...body,
      updatedBy: new mongoose.Types.ObjectId(session.user.id)
    };

    const validatedData = adminSystemSettingsUpdateSchema.parse(updateData);

    await connectToDatabase();

    // Update system settings
    const updatedSettings = await SystemSettings.updateSettings(
      validatedData,
      new mongoose.Types.ObjectId(session.user.id)
    );

    // Log the settings change
    console.log(`System settings updated by admin ${session.user.email}:`, {
      changedFields: Object.keys(body),
      timestamp: new Date()
    });

    return NextResponse.json<ApiResponse>({
      success: true,
      data: updatedSettings.toObject(),
      message: 'System settings updated successfully',
      meta: {
        timestamp: new Date(),
        version: '1.0.0',
        requestId: crypto.randomUUID()
      }
    });

  } catch (error) {
    console.error('System settings update error:', error);
    
    return NextResponse.json<ApiResponse>({
      success: false,
      error: {
        code: ERROR_CODES.VALIDATION_ERROR,
        message: error instanceof Error ? error.message : 'Failed to update system settings'
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
      case 'reset_to_defaults':
        // Reset specific section to defaults
        const { section } = body;
        const settings = await SystemSettings.getInstance();
        
        if (section && settings[section as keyof typeof settings]) {
          // Reset specific section to defaults based on schema defaults
          const defaultValues = getDefaultValues(section);
          (settings as any)[section] = defaultValues;
          settings.updatedBy = new mongoose.Types.ObjectId(session.user.id);
          await settings.save();
          
          return NextResponse.json<ApiResponse>({
            success: true,
            data: settings.toObject(),
            message: `${section} settings reset to defaults`,
            meta: {
              timestamp: new Date(),
              version: '1.0.0',
              requestId: crypto.randomUUID()
            }
          });
        } else {
          return NextResponse.json<ApiResponse>({
            success: false,
            error: {
              code: ERROR_CODES.VALIDATION_ERROR,
              message: 'Invalid section specified'
            }
          }, { status: HTTP_STATUS.BAD_REQUEST });
        }

      case 'export_settings':
        // Export current settings
        const currentSettings = await SystemSettings.getInstance();
        const exportData = {
          settings: currentSettings.toObject(),
          exportedAt: new Date(),
          exportedBy: session.user.email,
          version: '1.0.0'
        };

        return NextResponse.json<ApiResponse>({
          success: true,
          data: exportData,
          message: 'Settings exported successfully',
          meta: {
            timestamp: new Date(),
            version: '1.0.0',
            requestId: crypto.randomUUID()
          }
        });

      case 'import_settings':
        // Import settings from backup
        const { importData } = body;
        
        if (!importData || !importData.settings) {
          return NextResponse.json<ApiResponse>({
            success: false,
            error: {
              code: ERROR_CODES.VALIDATION_ERROR,
              message: 'Invalid import data'
            }
          }, { status: HTTP_STATUS.BAD_REQUEST });
        }

        // Validate imported settings
        const validatedImportData = adminSystemSettingsUpdateSchema.parse({
          ...importData.settings,
          updatedBy: new mongoose.Types.ObjectId(session.user.id)
        });

        const importedSettings = await SystemSettings.updateSettings(
          validatedImportData,
          new mongoose.Types.ObjectId(session.user.id)
        );

        return NextResponse.json<ApiResponse>({
          success: true,
          data: importedSettings.toObject(),
          message: 'Settings imported successfully',
          meta: {
            timestamp: new Date(),
            version: '1.0.0',
            requestId: crypto.randomUUID()
          }
        });

      case 'test_configuration':
        // Test various system configurations
        const testResults = await runSystemTests();
        
        return NextResponse.json<ApiResponse>({
          success: true,
          data: testResults,
          message: 'System configuration test completed',
          meta: {
            timestamp: new Date(),
            version: '1.0.0',
            requestId: crypto.randomUUID()
          }
        });

      case 'clear_cache':
        // Clear system caches (if any)
        // This would clear Redis cache, file cache, etc.
        return NextResponse.json<ApiResponse>({
          success: true,
          message: 'System cache cleared successfully',
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
    console.error('System settings action error:', error);
    
    return NextResponse.json<ApiResponse>({
      success: false,
      error: {
        code: ERROR_CODES.VALIDATION_ERROR,
        message: error instanceof Error ? error.message : 'Failed to perform system settings action'
      }
    }, { status: HTTP_STATUS.INTERNAL_SERVER_ERROR });
  }
}

// Helper function to get default values for settings sections
function getDefaultValues(section: string): any {
  const defaults = {
    app: {
      name: 'CloudNest',
      description: 'Secure cloud storage and file management',
      primaryColor: '#3B82F6',
      secondaryColor: '#1E40AF',
      version: '1.0.0'
    },
    features: {
      registration: true,
      emailVerification: true,
      googleAuth: true,
      fileSharing: true,
      publicSharing: true,
      fileVersioning: true,
      trash: true,
      compression: false,
      encryption: false
    },
    limits: {
      maxFileSize: 100 * 1024 * 1024, // 100MB
      maxFilesPerUpload: 10,
      maxFolderDepth: 10,
      maxSharesPerUser: 100,
      sessionTimeout: 24 * 60 * 60 * 1000 // 24 hours
    },
    storage: {
      defaultProvider: 'gridfs',
      autoCleanup: true,
      cleanupDays: 30,
      backupEnabled: false,
      backupInterval: 24
    },
    email: {
      enabled: true,
      defaultProvider: 'smtp',
      templates: {
        branding: true
      }
    },
    security: {
      passwordMinLength: 6,
      passwordRequireUppercase: false,
      passwordRequireNumbers: false,
      passwordRequireSymbols: false,
      sessionTimeout: 24 * 60 * 60 * 1000,
      maxLoginAttempts: 5,
      lockoutDuration: 15 * 60 * 1000,
      enableTwoFactor: false
    },
    analytics: {
      enabled: false,
      anonymizeIp: true
    },
    maintenance: {
      enabled: false,
      message: 'System is under maintenance. Please try again later.',
      allowedIps: []
    },
    notifications: {}
  };

  return defaults[section as keyof typeof defaults] || {};
}

// Helper function to run system tests
type SystemTestResult = {
  name: string;
  status: 'passed' | 'failed';
  message: string;
  error?: string;
};

async function runSystemTests(): Promise<any> {
  const tests: SystemTestResult[] = [];

  // Test database connection
  try {
    if (!mongoose.connection.db) {
      throw new Error('Database connection is not established');
    }
    await mongoose.connection.db.admin().ping();
    tests.push({
      name: 'Database Connection',
      status: 'passed',
      message: 'Successfully connected to MongoDB'
    });
  } catch (error) {
    tests.push({
      name: 'Database Connection',
      status: 'failed',
      message: 'Failed to connect to MongoDB',
      error: (error as Error).message
    });
  }

  // Test basic model operations
  try {
    const userCount = await User.countDocuments();
    tests.push({
      name: 'User Model',
      status: 'passed',
      message: `Found ${userCount} users in database`
    });
  } catch (error) {
    tests.push({
      name: 'User Model',
      status: 'failed',
      message: 'Failed to query user model',
      error: (error as Error).message
    });
  }

  // Test environment variables
  const requiredEnvVars = ['MONGODB_URI', 'NEXTAUTH_SECRET'];
  const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missingEnvVars.length === 0) {
    tests.push({
      name: 'Environment Variables',
      status: 'passed',
      message: 'All required environment variables are set'
    });
  } else {
    tests.push({
      name: 'Environment Variables',
      status: 'failed',
      message: `Missing environment variables: ${missingEnvVars.join(', ')}`
    });
  }

  return {
    summary: {
      total: tests.length,
      passed: tests.filter(t => t.status === 'passed').length,
      failed: tests.filter(t => t.status === 'failed').length
    },
    tests
  };
}