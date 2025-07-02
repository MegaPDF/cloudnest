import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/database/connection';
import { User, File, Share, Subscription } from '@/lib/database/models';
import { adminUserFilterSchema, adminUserActionSchema } from '@/lib/validation/admin';
import { PermissionUtils } from '@/lib/utils/permission-utils';
import { HTTP_STATUS, ERROR_CODES, STORAGE_LIMITS } from '@/lib/utils/constants';
import { getServerSession } from 'next-auth';
import { AdminUser } from '@/types/admin';
import { ApiResponse } from '@/types/api';
import mongoose from 'mongoose';
import { PaginationResult } from '@/types/common';
import { userCreateSchema } from '@/lib/validation/users';

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
    const filterData = {
      page: parseInt(searchParams.get('page') || '1'),
      limit: Math.min(parseInt(searchParams.get('limit') || '20'), 100),
      sortBy: searchParams.get('sortBy') || 'createdAt',
      sortOrder: searchParams.get('sortOrder') || 'desc',
      query: searchParams.get('query') || undefined,
      role: searchParams.get('role') as 'user' | 'admin' | undefined,
      subscription: searchParams.get('subscription') as 'free' | 'pro' | 'enterprise' | undefined,
      status: searchParams.get('status') as 'active' | 'inactive' | undefined,
      provider: searchParams.get('provider') as 'email' | 'google' | undefined,
      verified: searchParams.get('verified') ? searchParams.get('verified') === 'true' : undefined,
      hasFiles: searchParams.get('hasFiles') ? searchParams.get('hasFiles') === 'true' : undefined,
      storageUsageMin: searchParams.get('storageUsageMin') ? parseInt(searchParams.get('storageUsageMin')!) : undefined,
      storageUsageMax: searchParams.get('storageUsageMax') ? parseInt(searchParams.get('storageUsageMax')!) : undefined,
      startDate: searchParams.get('startDate') ? new Date(searchParams.get('startDate')!) : undefined,
      endDate: searchParams.get('endDate') ? new Date(searchParams.get('endDate')!) : undefined
    };

    const validatedFilters = adminUserFilterSchema.parse(filterData);
    
    await connectToDatabase();

    // Build MongoDB query
    const mongoQuery: any = {};

    // Text search
    if (validatedFilters.query) {
      mongoQuery.$or = [
        { name: { $regex: validatedFilters.query, $options: 'i' } },
        { email: { $regex: validatedFilters.query, $options: 'i' } }
      ];
    }

    // Role filter
    if (validatedFilters.role) {
      mongoQuery.role = validatedFilters.role;
    }

    // Subscription filter
    if (validatedFilters.subscription) {
      mongoQuery['subscription.plan'] = validatedFilters.subscription;
    }

    // Status filter
    if (validatedFilters.status) {
      mongoQuery.isActive = validatedFilters.status === 'active';
    }

    // Provider filter
    if (validatedFilters.provider) {
      mongoQuery.provider = validatedFilters.provider;
    }

    // Verified filter
    if (validatedFilters.verified !== undefined) {
      mongoQuery.isVerified = validatedFilters.verified;
    }

    // Storage usage filters
    if (validatedFilters.storageUsageMin !== undefined) {
      mongoQuery['storage.used'] = { $gte: validatedFilters.storageUsageMin };
    }
    if (validatedFilters.storageUsageMax !== undefined) {
      mongoQuery['storage.used'] = { 
        ...mongoQuery['storage.used'],
        $lte: validatedFilters.storageUsageMax 
      };
    }

    // Date range filter
    if (validatedFilters.startDate || validatedFilters.endDate) {
      mongoQuery.createdAt = {};
      if (validatedFilters.startDate) {
        mongoQuery.createdAt.$gte = validatedFilters.startDate;
      }
      if (validatedFilters.endDate) {
        mongoQuery.createdAt.$lte = validatedFilters.endDate;
      }
    }

    // Build aggregation pipeline
    const pipeline: any[] = [
      { $match: mongoQuery },
      {
        $lookup: {
          from: 'files',
          localField: '_id',
          foreignField: 'owner',
          as: 'userFiles'
        }
      },
      {
        $lookup: {
          from: 'folders',
          localField: '_id',
          foreignField: 'owner',
          as: 'userFolders'
        }
      },
      {
        $lookup: {
          from: 'shares',
          localField: '_id',
          foreignField: 'owner',
          as: 'userShares'
        }
      },
      {
        $addFields: {
          stats: {
            totalFiles: { $size: { $filter: { input: '$userFiles', cond: { $eq: ['$$this.isDeleted', false] } } } },
            totalFolders: { $size: { $filter: { input: '$userFolders', cond: { $eq: ['$$this.isDeleted', false] } } } },
            totalShares: { $size: { $filter: { input: '$userShares', cond: { $eq: ['$$this.isActive', true] } } } },
            storageUsed: '$storage.used',
            lastActivity: { $max: ['$lastLoginAt', { $max: '$userFiles.createdAt' }] }
          }
        }
      }
    ];

    // Add hasFiles filter if specified
    if (validatedFilters.hasFiles !== undefined) {
      pipeline.push({
        $match: {
          'stats.totalFiles': validatedFilters.hasFiles ? { $gt: 0 } : { $eq: 0 }
        }
      } as any);
    }

    // Add sorting
    const sortField = validatedFilters.sortBy === 'createdAt' ? 'createdAt' : `stats.${validatedFilters.sortBy}`;
    pipeline.push({
      $sort: { [sortField]: validatedFilters.sortOrder === 'asc' ? 1 : -1 }
    });

    // Execute aggregation for total count
    const totalPipeline = [...pipeline, { $count: 'total' }];
    const totalResult = await User.aggregate(totalPipeline);
    const total = totalResult[0]?.total || 0;

    // Add pagination
    const skip = (validatedFilters.page - 1) * validatedFilters.limit;
    pipeline.push(
      { $skip: skip },
      { $limit: validatedFilters.limit }
    );

    // Remove sensitive fields
    pipeline.push({
      $project: {
        password: 0,
        verificationToken: 0,
        resetPasswordToken: 0,
        resetPasswordExpires: 0,
        userFiles: 0,
        userFolders: 0,
        userShares: 0
      }
    });

    // Execute main query
    const users = await User.aggregate(pipeline);

    // Transform to AdminUser format
    const adminUsers: AdminUser[] = users.map(user => ({
      id: user._id,
      email: user.email,
      name: user.name,
      role: user.role,
      isActive: user.isActive,
      subscription: user.subscription,
      storage: user.storage,
      stats: user.stats,
      lastLogin: user.lastLoginAt,
      createdAt: user.createdAt
    }));

    // Calculate pagination info
    const pages = Math.ceil(total / validatedFilters.limit);
    const hasNext = validatedFilters.page < pages;
    const hasPrev = validatedFilters.page > 1;

    const result: PaginationResult<AdminUser> = {
      data: adminUsers,
      pagination: {
        page: validatedFilters.page,
        limit: validatedFilters.limit,
        total,
        pages,
        hasNext,
        hasPrev
      }
    };

    return NextResponse.json<ApiResponse<PaginationResult<AdminUser>>>({
      success: true,
      data: result,
      meta: {
        timestamp: new Date(),
        version: '1.0.0',
        requestId: crypto.randomUUID()
      }
    });

  } catch (error) {
    console.error('Admin users fetch error:', error);
    
    return NextResponse.json<ApiResponse>({
      success: false,
      error: {
        code: ERROR_CODES.VALIDATION_ERROR,
        message: error instanceof Error ? error.message : 'Failed to fetch users'
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
    
    // Handle bulk actions
    if (body.action) {
      const validatedAction = adminUserActionSchema.parse(body);
      
      await connectToDatabase();
      
      const results: Array<{ userId: string; success: boolean; message?: string; error?: string; resetToken?: string }> = [];
      
      for (const userId of validatedAction.userIds) {
        try {
          const user = await User.findById(userId);
          if (!user) {
            results.push({ userId, success: false, error: 'User not found' });
            continue;
          }

          switch (validatedAction.action) {
            case 'activate':
              user.isActive = true;
              await user.save();
              results.push({ userId, success: true, message: 'User activated' });
              break;

            case 'deactivate':
              user.isActive = false;
              await user.save();
              results.push({ userId, success: true, message: 'User deactivated' });
              break;

            case 'verify':
              user.isVerified = true;
              user.verificationToken = undefined;
              await user.save();
              results.push({ userId, success: true, message: 'User verified' });
              break;

            case 'unverify':
              user.isVerified = false;
              await user.save();
              results.push({ userId, success: true, message: 'User unverified' });
              break;

            case 'reset_password':
              const resetToken = user.generateResetPasswordToken();
              await user.save();
              results.push({ userId, success: true, message: 'Password reset token generated', resetToken });
              break;

            case 'delete':
              // Soft delete by deactivating and anonymizing
              user.isActive = false;
              user.name = `Deleted User ${user._id}`;
              user.email = `deleted.${user._id}@example.com`;
              await user.save();
              results.push({ userId, success: true, message: 'User deleted' });
              break;

            default:
              results.push({ userId, success: false, error: 'Invalid action' });
          }
        } catch (error) {
          results.push({ 
            userId, 
            success: false, 
            error: error instanceof Error ? error.message : 'Unknown error' 
          });
        }
      }

      return NextResponse.json<ApiResponse>({
        success: true,
        data: results,
        message: `Bulk action ${validatedAction.action} completed`,
        meta: {
          timestamp: new Date(),
          version: '1.0.0',
          requestId: crypto.randomUUID()
        }
      });
    }

    // Handle user creation
    const validatedData = userCreateSchema.parse(body);
    
    await connectToDatabase();

    // Check if user already exists
    const existingUser = await User.findByEmail(validatedData.email);
    if (existingUser) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: {
          code: ERROR_CODES.DUPLICATE_ERROR,
          message: 'User with this email already exists'
        }
      }, { status: HTTP_STATUS.CONFLICT });
    }

    // Set storage limit based on subscription plan
    const storageLimit = validatedData.subscription?.plan === 'pro' 
      ? STORAGE_LIMITS.PRO
      : validatedData.subscription?.plan === 'enterprise'
      ? STORAGE_LIMITS.ENTERPRISE
      : STORAGE_LIMITS.FREE;

    // Create new user
    const newUser = new User({
      ...validatedData,
      storage: {
        used: 0,
        limit: storageLimit,
        ...validatedData.storage
      },
      subscription: {
        plan: 'free',
        status: 'active',
        ...validatedData.subscription
      },
      preferences: {
        theme: 'system',
        language: 'en',
        notifications: {
          email: true,
          sharing: true,
          storage: true
        },
        ...validatedData.preferences
      }
    });

    await newUser.save();

    // Remove sensitive data from response
    const userResponse = newUser.toPublicJSON();

    return NextResponse.json<ApiResponse<AdminUser>>({
      success: true,
      data: userResponse as AdminUser,
      message: 'User created successfully',
      meta: {
        timestamp: new Date(),
        version: '1.0.0',
        requestId: crypto.randomUUID()
      }
    }, { status: HTTP_STATUS.CREATED });

  } catch (error) {
    console.error('Admin user operation error:', error);
    
    return NextResponse.json<ApiResponse>({
      success: false,
      error: {
        code: ERROR_CODES.VALIDATION_ERROR,
        message: error instanceof Error ? error.message : 'Failed to process user operation'
      }
    }, { status: HTTP_STATUS.INTERNAL_SERVER_ERROR });
  }
}