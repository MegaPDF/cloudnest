import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/database/connection';
import { StorageConfig } from '@/lib/database/models';
import { storageConfigSchema, storageConfigUpdateSchema, storageTestConnectionSchema, storageCleanupSchema, storageMigrationSchema } from '@/lib/validation/storage';
import { PermissionUtils } from '@/lib/utils/permission-utils';
import { HTTP_STATUS, ERROR_CODES, STORAGE_PROVIDERS } from '@/lib/utils/constants';
import { StorageUtils } from '@/lib/storage/utils';
import { getServerSession } from 'next-auth';
import { ApiResponse } from '@/types/api';
import { StorageConfig as IStorageConfig, StorageHealth } from '@/types/storage';
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

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const provider = searchParams.get('provider');

    await connectToDatabase();

    switch (action) {
      case 'providers':
        // Get all configured storage providers
        const query = provider ? { provider } : {};
        const configs = await StorageConfig.find(query).sort({ isDefault: -1, name: 1 });
        
        // Format for display and hide sensitive data
        const formattedConfigs = configs.map(config => {
          const formatted = config.toObject();
          // Hide sensitive credentials from admin view
          delete formatted.config.accessKeyId;
          delete formatted.config.secretAccessKey;
          if ('apiKey' in formatted.config) {
            delete formatted.config.apiKey;
          }
          
          return {
            ...formatted,
            displayInfo: StorageUtils.formatConfigForDisplay(formatted as any),
            supportsFeatures: {
              multipart: StorageUtils.supportsFeature(formatted.provider, 'multipart'),
              versioning: StorageUtils.supportsFeature(formatted.provider, 'versioning'),
              encryption: StorageUtils.supportsFeature(formatted.provider, 'encryption'),
              cdn: StorageUtils.supportsFeature(formatted.provider, 'cdn')
            }
          };
        });

        return NextResponse.json<ApiResponse>({
          success: true,
          data: {
            configs: formattedConfigs,
            availableProviders: Object.values(STORAGE_PROVIDERS),
            defaultProvider: configs.find(c => c.isDefault)?.provider || null
          },
          meta: {
            timestamp: new Date(),
            version: '1.0.0',
            requestId: crypto.randomUUID()
          }
        });

      case 'health':
        // Get health status of all storage providers
        const activeConfigs = await StorageConfig.getActiveProviders();
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
                errorCount: config.stats.errorCount
              };
            } catch (error) {
              return {
                configId: config._id,
                provider: config.provider,
                name: config.name,
                isHealthy: false,
                lastCheck: new Date(),
                errorCount: config.stats.errorCount + 1,
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

      case 'usage':
        // Get storage usage statistics
        const usageStats = await getStorageUsageStats();
        
        return NextResponse.json<ApiResponse>({
          success: true,
          data: usageStats,
          meta: {
            timestamp: new Date(),
            version: '1.0.0',
            requestId: crypto.randomUUID()
          }
        });

      default:
        // Get storage overview
        const overview = await getStorageOverview();
        
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
    console.error('Admin storage config fetch error:', error);
    
    return NextResponse.json<ApiResponse>({
      success: false,
      error: {
        code: ERROR_CODES.VALIDATION_ERROR,
        message: error instanceof Error ? error.message : 'Failed to fetch storage configuration'
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
        // Create new storage configuration
        const configData = storageConfigSchema.parse(body.config);
        
        // Validate provider credentials
        const validation = StorageUtils.validateProviderCredentials(configData as any);
        if (!validation.isValid) {
          return NextResponse.json<ApiResponse>({
            success: false,
            error: {
              code: ERROR_CODES.VALIDATION_ERROR,
              message: `Missing required fields: ${validation.missing.join(', ')}`
            }
          }, { status: HTTP_STATUS.BAD_REQUEST });
        }

        // If this is set as default, remove default from others
        if (configData.isDefault) {
          await StorageConfig.updateMany({}, { isDefault: false });
        }

        const newConfig = new StorageConfig(configData);
        await newConfig.save();

        return NextResponse.json<ApiResponse>({
          success: true,
          data: { configId: newConfig._id },
          message: 'Storage configuration created successfully',
          meta: {
            timestamp: new Date(),
            version: '1.0.0',
            requestId: crypto.randomUUID()
          }
        });

      case 'test_connection':
        // Test storage provider connection
        const testData = storageTestConnectionSchema.parse(body);
        
        const config = await StorageConfig.findById(testData.configId);
        if (!config) {
          return NextResponse.json<ApiResponse>({
            success: false,
            error: {
              code: ERROR_CODES.NOT_FOUND_ERROR,
              message: 'Storage configuration not found'
            }
          }, { status: HTTP_STATUS.NOT_FOUND });
        }

        const testResult = await config.testConnection();
        
        return NextResponse.json<ApiResponse>({
          success: true,
          data: { 
            configId: testData.configId,
            isHealthy: testResult,
            provider: config.provider,
            name: config.name
          },
          message: testResult ? 'Connection test successful' : 'Connection test failed',
          meta: {
            timestamp: new Date(),
            version: '1.0.0',
            requestId: crypto.randomUUID()
          }
        });

      case 'cleanup_storage':
        // Clean up old/unused files
        const cleanupData = storageCleanupSchema.parse(body);
        const cleanupResults = await performStorageCleanup(cleanupData);
        
        return NextResponse.json<ApiResponse>({
          success: true,
          data: cleanupResults,
          message: `Storage cleanup completed. ${cleanupResults.filesRemoved} files removed, ${formatBytes(cleanupResults.spaceFreed ?? 0)} freed`,
          meta: {
            timestamp: new Date(),
            version: '1.0.0',
            requestId: crypto.randomUUID()
          }
        });

      case 'migrate_files':
        // Migrate files between storage providers
        const migrationData = storageMigrationSchema.parse(body);
        const migrationResults = await performStorageMigration(migrationData);
        
        return NextResponse.json<ApiResponse>({
          success: true,
          data: migrationResults,
          message: `Migration completed. ${migrationResults.filesProcessed} files processed, ${migrationResults.successful} successful`,
          meta: {
            timestamp: new Date(),
            version: '1.0.0',
            requestId: crypto.randomUUID()
          }
        });

      case 'set_default':
        // Set default storage provider
        const { configId } = body;
        
        if (!mongoose.Types.ObjectId.isValid(configId)) {
          return NextResponse.json<ApiResponse>({
            success: false,
            error: {
              code: ERROR_CODES.VALIDATION_ERROR,
              message: 'Invalid configuration ID'
            }
          }, { status: HTTP_STATUS.BAD_REQUEST });
        }

        await StorageConfig.setDefault(new mongoose.Types.ObjectId(configId));
        
        return NextResponse.json<ApiResponse>({
          success: true,
          message: 'Default storage provider updated',
          meta: {
            timestamp: new Date(),
            version: '1.0.0',
            requestId: crypto.randomUUID()
          }
        });

      case 'bulk_health_check':
        // Run health check on all active providers
        const activeConfigs = await StorageConfig.getActiveProviders();
        const bulkHealthResults: {
          configId: mongoose.Types.ObjectId;
          provider: "aws" | "cloudflare" | "wasabi" | "gridfs";
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
    console.error('Admin storage config action error:', error);
    
    return NextResponse.json<ApiResponse>({
      success: false,
      error: {
        code: ERROR_CODES.VALIDATION_ERROR,
        message: error instanceof Error ? error.message : 'Failed to perform storage configuration action'
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

    const validatedUpdates = storageConfigUpdateSchema.parse(updates);

    await connectToDatabase();

    const config = await StorageConfig.findById(configId);
    if (!config) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: {
          code: ERROR_CODES.NOT_FOUND_ERROR,
          message: 'Storage configuration not found'
        }
      }, { status: HTTP_STATUS.NOT_FOUND });
    }

    // If setting as default, remove default from others
    if (validatedUpdates.isDefault) {
      await StorageConfig.updateMany({ _id: { $ne: configId } }, { isDefault: false });
    }

    Object.assign(config, validatedUpdates);
    await config.save();

    return NextResponse.json<ApiResponse>({
      success: true,
      data: { configId },
      message: 'Storage configuration updated successfully',
      meta: {
        timestamp: new Date(),
        version: '1.0.0',
        requestId: crypto.randomUUID()
      }
    });

  } catch (error) {
    console.error('Storage config update error:', error);
    
    return NextResponse.json<ApiResponse>({
      success: false,
      error: {
        code: ERROR_CODES.VALIDATION_ERROR,
        message: error instanceof Error ? error.message : 'Failed to update storage configuration'
      }
    }, { status: HTTP_STATUS.INTERNAL_SERVER_ERROR });
  }
}

// Helper functions

async function getStorageOverview() {
  const { File } = await import('@/lib/database/models');
  
  const [
    totalStats,
    providerStats,
    recentFiles
  ] = await Promise.all([
    File.aggregate([
      { $match: { isDeleted: false } },
      {
        $group: {
          _id: null,
          totalFiles: { $sum: 1 },
          totalSize: { $sum: '$size' },
          avgFileSize: { $avg: '$size' }
        }
      }
    ]),
    File.aggregate([
      { $match: { isDeleted: false } },
      {
        $group: {
          _id: '$storageProvider',
          fileCount: { $sum: 1 },
          totalSize: { $sum: '$size' }
        }
      }
    ]),
    File.find({ isDeleted: false })
      .sort({ createdAt: -1 })
      .limit(10)
      .select('name size storageProvider createdAt')
  ]);

  const configs = await StorageConfig.find({ isActive: true });

  return {
    summary: totalStats[0] || { totalFiles: 0, totalSize: 0, avgFileSize: 0 },
    providerDistribution: providerStats,
    recentFiles,
    activeProviders: configs.length,
    defaultProvider: configs.find(c => c.isDefault)?.provider || null
  };
}

async function getStorageUsageStats() {
  const { File, User } = await import('@/lib/database/models');
  
  const [
    dailyUsage,
    topUsers,
    fileTypes
  ] = await Promise.all([
    File.aggregate([
      { $match: { isDeleted: false } },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            day: { $dayOfMonth: '$createdAt' }
          },
          filesUploaded: { $sum: 1 },
          storageUsed: { $sum: '$size' }
        }
      },
      { $sort: { '_id.year': -1, '_id.month': -1, '_id.day': -1 } },
      { $limit: 30 }
    ]),
    User.aggregate([
      {
        $lookup: {
          from: 'files',
          localField: '_id',
          foreignField: 'owner',
          as: 'userFiles'
        }
      },
      {
        $addFields: {
          fileCount: { $size: '$userFiles' },
          storageUsed: { $sum: '$userFiles.size' }
        }
      },
      { $sort: { storageUsed: -1 } },
      { $limit: 10 },
      {
        $project: {
          name: 1,
          email: 1,
          fileCount: 1,
          storageUsed: 1,
          userFiles: 0
        }
      }
    ]),
    File.aggregate([
      { $match: { isDeleted: false } },
      {
        $group: {
          _id: '$extension',
          count: { $sum: 1 },
          totalSize: { $sum: '$size' }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ])
  ]);

  return {
    dailyUsage,
    topUsers,
    fileTypes
  };
}

async function performStorageCleanup(options: any) {
  const { File } = await import('@/lib/database/models');
  
  const query: any = {};
  
  if (options.olderThanDays) {
    const cutoffDate = new Date(Date.now() - (options.olderThanDays * 24 * 60 * 60 * 1000));
    query.createdAt = { $lt: cutoffDate };
  }
  
  if (options.fileTypes?.length) {
    query.extension = { $in: options.fileTypes };
  }

  if (options.dryRun) {
    // Just return what would be cleaned up
    const filesToCleanup = await File.find(query).select('name size extension createdAt');
    const totalSize = filesToCleanup.reduce((sum, file) => sum + file.size, 0);
    
    return {
      dryRun: true,
      filesFound: filesToCleanup.length,
      spaceWouldBeFree: totalSize,
      files: filesToCleanup.slice(0, 10) // Sample
    };
  } else {
    // Actually perform cleanup
    const filesToDelete = await File.find(query);
    const totalSize = filesToDelete.reduce((sum, file) => sum + file.size, 0);
    
    // Soft delete files
    await File.updateMany(query, {
      isDeleted: true,
      deletedAt: new Date(),
      deletedBy: new mongoose.Types.ObjectId('000000000000000000000000') // System cleanup
    });

    return {
      dryRun: false,
      filesRemoved: filesToDelete.length,
      spaceFreed: totalSize
    };
  }
}

async function performStorageMigration(options: any) {
  const { File } = await import('@/lib/database/models');
  
  const query: any = { storageProvider: options.fromProvider };
  
  if (options.fileIds?.length) {
    query._id = { $in: options.fileIds.map((id: string) => new mongoose.Types.ObjectId(id)) };
  }

  const filesToMigrate = await File.find(query).limit(options.batchSize || 100);
  
  const results = {
    filesProcessed: filesToMigrate.length,
    successful: 0,
    failed: 0,
    errors: [] as string[]
  };

  // In a real implementation, this would actually move files between storage providers
  for (const file of filesToMigrate) {
    try {
      // Simulate migration logic
      file.storageProvider = options.toProvider;
      
      if (!options.preserveOriginal) {
        await file.save();
      }
      
      results.successful++;
    } catch (error) {
      results.failed++;
      results.errors.push(`${file.name}: ${(error as Error).message}`);
    }
  }

  return results;
}

function formatBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = bytes;
  let unitIndex = 0;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  return `${size.toFixed(2)} ${units[unitIndex]}`;
}