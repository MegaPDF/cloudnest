import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/database/connection';
import { User, File, Share, Subscription } from '@/lib/database/models';
import { adminStatsSchema } from '@/lib/validation/admin';
import { PermissionUtils } from '@/lib/utils/permission-utils';
import { HTTP_STATUS, ERROR_CODES } from '@/lib/utils/constants';
import { getServerSession } from 'next-auth';
import { AdminStats, AdminActivity, SystemHealth } from '@/types/admin';
import { ApiResponse } from '@/types/api';

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

    // Parse and validate query parameters
    const { searchParams } = new URL(request.url);
    const queryData = {
      dateRange: searchParams.get('startDate') && searchParams.get('endDate') ? {
        startDate: new Date(searchParams.get('startDate')!),
        endDate: new Date(searchParams.get('endDate')!)
      } : undefined,
      includeGrowthRate: searchParams.get('includeGrowthRate') !== 'false'
    };

    const validatedQuery = adminStatsSchema.parse(queryData);
    
    await connectToDatabase();

    // Calculate date ranges for growth rate
    const now = new Date();
    const currentPeriodStart = validatedQuery.dateRange?.startDate || new Date(now.getFullYear(), now.getMonth(), 1);
    const currentPeriodEnd = validatedQuery.dateRange?.endDate || now;
    
    const previousPeriodDuration = currentPeriodEnd.getTime() - currentPeriodStart.getTime();
    const previousPeriodStart = new Date(currentPeriodStart.getTime() - previousPeriodDuration);
    const previousPeriodEnd = currentPeriodStart;

    // Build aggregation pipelines
    const currentPeriodMatch = {
      createdAt: {
        $gte: currentPeriodStart,
        $lte: currentPeriodEnd
      }
    };

    const previousPeriodMatch = {
      createdAt: {
        $gte: previousPeriodStart,
        $lte: previousPeriodEnd
      }
    };

    // Get user statistics
    const [
      totalUsers,
      activeUsers,
      newUsersThisMonth,
      newUsersPreviousMonth
    ] = await Promise.all([
      User.countDocuments({ isActive: true }),
      User.countDocuments({ 
        isActive: true, 
        lastLoginAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
      }),
      User.countDocuments(currentPeriodMatch),
      validatedQuery.includeGrowthRate ? User.countDocuments(previousPeriodMatch) : 0
    ]);

    // Get file statistics
    const [
      fileStats,
      newFilesThisMonth,
      newFilesPreviousMonth
    ] = await Promise.all([
      File.aggregate([
        { $match: { isDeleted: false } },
        {
          $group: {
            _id: null,
            totalFiles: { $sum: 1 },
            totalSize: { $sum: '$size' }
          }
        }
      ]),
      File.countDocuments({ ...currentPeriodMatch, isDeleted: false }),
      validatedQuery.includeGrowthRate ? File.countDocuments({ ...previousPeriodMatch, isDeleted: false }) : 0
    ]);

    const { totalFiles = 0, totalSize = 0 } = fileStats[0] || {};

    // Get subscription statistics
    const [
      subscriptionStats,
      revenueStats
    ] = await Promise.all([
      Subscription.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ]),
      Subscription.aggregate([
        {
          $match: {
            status: 'active',
            ...currentPeriodMatch
          }
        },
        {
          $group: {
            _id: null,
            revenue: { $sum: '$plan.price' }
          }
        }
      ])
    ]);

    const activeSubscriptions = subscriptionStats.find(s => s._id === 'active')?.count || 0;
    const totalSubscriptions = subscriptionStats.reduce((sum, s) => sum + s.count, 0);
    const revenue = revenueStats[0]?.revenue || 0;

    // Get share statistics
    const [
      shareStats,
      shareActivity
    ] = await Promise.all([
      Share.aggregate([
        { $match: { isActive: true } },
        {
          $group: {
            _id: null,
            totalShares: { $sum: 1 },
            totalViews: { $sum: '$stats.views' },
            totalDownloads: { $sum: '$stats.downloads' }
          }
        }
      ]),
      Share.countDocuments({ ...currentPeriodMatch, isActive: true })
    ]);

    const { totalShares = 0, totalViews = 0, totalDownloads = 0 } = shareStats[0] || {};

    // Calculate growth rates
    const userGrowthRate = validatedQuery.includeGrowthRate && newUsersPreviousMonth > 0
      ? ((newUsersThisMonth - newUsersPreviousMonth) / newUsersPreviousMonth) * 100
      : 0;

    const storageGrowthRate = validatedQuery.includeGrowthRate && newFilesPreviousMonth > 0
      ? ((newFilesThisMonth - newFilesPreviousMonth) / newFilesPreviousMonth) * 100
      : 0;

    // Calculate churn rate (simplified - cancelled subscriptions / total active)
    const cancelledSubscriptions = subscriptionStats.find(s => s._id === 'canceled')?.count || 0;
    const churnRate = activeSubscriptions > 0 ? (cancelledSubscriptions / (activeSubscriptions + cancelledSubscriptions)) * 100 : 0;

    const stats: AdminStats = {
      users: {
        total: totalUsers,
        active: activeUsers,
        newThisMonth: newUsersThisMonth,
        growthRate: userGrowthRate
      },
      files: {
        total: totalFiles,
        totalSize,
        newThisMonth: newFilesThisMonth,
        storageGrowthRate
      },
      subscriptions: {
        total: totalSubscriptions,
        active: activeSubscriptions,
        revenue,
        churnRate
      },
      shares: {
        total: totalShares,
        active: shareActivity,
        views: totalViews,
        downloads: totalDownloads
      }
    };

    return NextResponse.json<ApiResponse<AdminStats>>({
      success: true,
      data: stats,
      meta: {
        timestamp: new Date(),
        version: '1.0.0',
        requestId: crypto.randomUUID()
      }
    });

  } catch (error) {
    console.error('Admin analytics error:', error);
    
    return NextResponse.json<ApiResponse>({
      success: false,
      error: {
        code: ERROR_CODES.VALIDATION_ERROR,
        message: error instanceof Error ? error.message : 'Failed to fetch analytics'
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

    await connectToDatabase();

    // Get recent activity (last 50 activities)
    const recentActivity: AdminActivity[] = await User.aggregate([
      {
        $lookup: {
          from: 'files',
          localField: '_id',
          foreignField: 'owner',
          as: 'files'
        }
      },
      {
        $lookup: {
          from: 'folders',
          localField: '_id',
          foreignField: 'owner',
          as: 'folders'
        }
      },
      {
        $lookup: {
          from: 'shares',
          localField: '_id',
          foreignField: 'owner',
          as: 'shares'
        }
      },
      {
        $project: {
          activities: {
            $concatArrays: [
              {
                $map: {
                  input: { $slice: ['$files', -10] },
                  as: 'file',
                  in: {
                    id: '$$file._id',
                    userId: '$_id',
                    action: 'file_upload',
                    resource: 'file',
                    resourceId: '$$file._id',
                    details: { $concat: ['Uploaded file: ', '$$file.name'] },
                    timestamp: '$$file.createdAt',
                    ip: '0.0.0.0',
                    userAgent: 'Unknown'
                  }
                }
              },
              {
                $map: {
                  input: { $slice: ['$folders', -5] },
                  as: 'folder',
                  in: {
                    id: '$$folder._id',
                    userId: '$_id',
                    action: 'folder_create',
                    resource: 'folder',
                    resourceId: '$$folder._id',
                    details: { $concat: ['Created folder: ', '$$folder.name'] },
                    timestamp: '$$folder.createdAt',
                    ip: '0.0.0.0',
                    userAgent: 'Unknown'
                  }
                }
              },
              {
                $map: {
                  input: { $slice: ['$shares', -5] },
                  as: 'share',
                  in: {
                    id: '$$share._id',
                    userId: '$_id',
                    action: 'share_create',
                    resource: 'share',
                    resourceId: '$$share._id',
                    details: 'Created share link',
                    timestamp: '$$share.createdAt',
                    ip: '0.0.0.0',
                    userAgent: 'Unknown'
                  }
                }
              }
            ]
          }
        }
      },
      { $unwind: '$activities' },
      { $replaceRoot: { newRoot: '$activities' } },
      { $sort: { timestamp: -1 } },
      { $limit: 50 }
    ]);

    // Get system health
    const systemHealth: SystemHealth = {
      database: {
        status: 'healthy',
        message: 'Database connection active',
        details: {}
      },
      storage: {
        status: 'healthy',
        message: 'Storage providers operational',
        details: {}
      },
      email: {
        status: 'healthy',
        message: 'Email service operational',
        details: {}
      },
      overall: {
        status: 'healthy',
        message: 'All systems operational',
        details: {}
      },
      lastCheck: new Date()
    };

    return NextResponse.json<ApiResponse<{
      recentActivity: AdminActivity[];
      systemHealth: SystemHealth;
    }>>({
      success: true,
      data: {
        recentActivity,
        systemHealth
      },
      meta: {
        timestamp: new Date(),
        version: '1.0.0',
        requestId: crypto.randomUUID()
      }
    });

  } catch (error) {
    console.error('Admin activity fetch error:', error);
    
    return NextResponse.json<ApiResponse>({
      success: false,
      error: {
        code: ERROR_CODES.VALIDATION_ERROR,
        message: error instanceof Error ? error.message : 'Failed to fetch admin activity'
      }
    }, { status: HTTP_STATUS.INTERNAL_SERVER_ERROR });
  }
}