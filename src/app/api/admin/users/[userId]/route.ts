import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/database/connection';
import { User, File, Folder, Share, Subscription } from '@/lib/database/models';
import { userUpdateSchema } from '@/lib/validation/users';
import { PermissionUtils } from '@/lib/utils/permission-utils';
import { HTTP_STATUS, ERROR_CODES } from '@/lib/utils/constants';
import { getServerSession } from 'next-auth';
import { AdminUser } from '@/types/admin';
import { ApiResponse } from '@/types/api';
import mongoose from 'mongoose';

interface RouteParams {
  params: {
    userId: string;
  };
}

export async function GET(request: NextRequest, { params }: RouteParams) {
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

    const { userId } = params;

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: {
          code: ERROR_CODES.VALIDATION_ERROR,
          message: 'Invalid user ID format'
        }
      }, { status: HTTP_STATUS.BAD_REQUEST });
    }

    await connectToDatabase();

    // Get user with detailed statistics
    const userDetails = await User.aggregate([
      { $match: { _id: new mongoose.Types.ObjectId(userId) } },
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
        $lookup: {
          from: 'subscriptions',
          localField: '_id',
          foreignField: 'user',
          as: 'userSubscription'
        }
      },
      {
        $addFields: {
          detailedStats: {
            totalFiles: { $size: { $filter: { input: '$userFiles', cond: { $eq: ['$$this.isDeleted', false] } } } },
            deletedFiles: { $size: { $filter: { input: '$userFiles', cond: { $eq: ['$$this.isDeleted', true] } } } },
            totalFolders: { $size: { $filter: { input: '$userFolders', cond: { $eq: ['$$this.isDeleted', false] } } } },
            deletedFolders: { $size: { $filter: { input: '$userFolders', cond: { $eq: ['$$this.isDeleted', true] } } } },
            totalShares: { $size: { $filter: { input: '$userShares', cond: { $eq: ['$$this.isActive', true] } } } },
            inactiveShares: { $size: { $filter: { input: '$userShares', cond: { $eq: ['$$this.isActive', false] } } } },
            storageUsed: '$storage.used',
            storageLimit: '$storage.limit',
            storagePercentage: { 
              $multiply: [
                { $divide: ['$storage.used', '$storage.limit'] }, 
                100
              ]
            },
            lastActivity: { 
              $max: [
                '$lastLoginAt', 
                { $max: '$userFiles.createdAt' },
                { $max: '$userFolders.createdAt' },
                { $max: '$userShares.createdAt' }
              ]
            },
            filesByType: {
              $arrayToObject: {
                $map: {
                  input: {
                    $setUnion: {
                      $map: {
                        input: { $filter: { input: '$userFiles', cond: { $eq: ['$$this.isDeleted', false] } } },
                        as: 'file',
                        in: '$$file.extension'
                      }
                    }
                  },
                  as: 'ext',
                  in: {
                    k: '$$ext',
                    v: {
                      $size: {
                        $filter: {
                          input: '$userFiles',
                          cond: { 
                            $and: [
                              { $eq: ['$$this.isDeleted', false] },
                              { $eq: ['$$this.extension', '$$ext'] }
                            ]
                          }
                        }
                      }
                    }
                  }
                }
              }
            },
            shareViews: { $sum: '$userShares.stats.views' },
            shareDownloads: { $sum: '$userShares.stats.downloads' }
          },
          subscriptionDetails: { $arrayElemAt: ['$userSubscription', 0] }
        }
      },
      {
        $project: {
          password: 0,
          verificationToken: 0,
          resetPasswordToken: 0,
          resetPasswordExpires: 0,
          userFiles: 0,
          userFolders: 0,
          userShares: 0,
          userSubscription: 0
        }
      }
    ]);

    if (!userDetails.length) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: {
          code: ERROR_CODES.NOT_FOUND_ERROR,
          message: 'User not found'
        }
      }, { status: HTTP_STATUS.NOT_FOUND });
    }

    const user = userDetails[0];

    // Get recent files (last 10)
    const recentFiles = await File.find({ 
      owner: new mongoose.Types.ObjectId(userId),
      isDeleted: false 
    })
    .sort({ createdAt: -1 })
    .limit(10)
    .select('name size mimeType createdAt extension');

    // Get recent shares (last 5)
    const recentShares = await Share.find({ 
      owner: new mongoose.Types.ObjectId(userId),
      isActive: true 
    })
    .sort({ createdAt: -1 })
    .limit(5)
    .select('type shareUrl stats.views stats.downloads createdAt');

    // Transform to AdminUser format with additional details
    const adminUser: AdminUser & {
      detailedStats: any;
      recentFiles: any[];
      recentShares: any[];
      subscriptionDetails: any;
    } = {
      id: user._id,
      email: user.email,
      name: user.name,
      role: user.role,
      isActive: user.isActive,
      subscription: user.subscription,
      storage: user.storage,
      stats: user.detailedStats,
      lastLogin: user.lastLoginAt,
      createdAt: user.createdAt,
      detailedStats: user.detailedStats,
      recentFiles,
      recentShares,
      subscriptionDetails: user.subscriptionDetails
    };

    return NextResponse.json<ApiResponse>({
      success: true,
      data: adminUser,
      meta: {
        timestamp: new Date(),
        version: '1.0.0',
        requestId: crypto.randomUUID()
      }
    });

  } catch (error) {
    console.error('Admin user detail fetch error:', error);
    
    return NextResponse.json<ApiResponse>({
      success: false,
      error: {
        code: ERROR_CODES.VALIDATION_ERROR,
        message: error instanceof Error ? error.message : 'Failed to fetch user details'
      }
    }, { status: HTTP_STATUS.INTERNAL_SERVER_ERROR });
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
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

    const { userId } = params;

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: {
          code: ERROR_CODES.VALIDATION_ERROR,
          message: 'Invalid user ID format'
        }
      }, { status: HTTP_STATUS.BAD_REQUEST });
    }

    const body = await request.json();
    const validatedData = userUpdateSchema.parse(body);

    await connectToDatabase();

    // Find and update user
    const user = await User.findById(userId);
    if (!user) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: {
          code: ERROR_CODES.NOT_FOUND_ERROR,
          message: 'User not found'
        }
      }, { status: HTTP_STATUS.NOT_FOUND });
    }

    // Check for email conflicts if email is being updated
    if (validatedData.email && validatedData.email !== user.email) {
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
    }

    // Update user fields
    Object.assign(user, validatedData);

    // If subscription plan is changed, update storage limit
    if (validatedData.subscription?.plan) {
      const newLimit = validatedData.subscription.plan === 'pro' 
        ? 100 * 1024 * 1024 * 1024  // 100GB
        : validatedData.subscription.plan === 'enterprise'
        ? 1024 * 1024 * 1024 * 1024  // 1TB
        : 5 * 1024 * 1024 * 1024;    // 5GB

      user.storage.limit = newLimit;
    }

    await user.save();

    // Return updated user without sensitive fields
    const updatedUser = user.toPublicJSON();

    return NextResponse.json<ApiResponse<AdminUser>>({
      success: true,
      data: updatedUser as AdminUser,
      message: 'User updated successfully',
      meta: {
        timestamp: new Date(),
        version: '1.0.0',
        requestId: crypto.randomUUID()
      }
    });

  } catch (error) {
    console.error('Admin user update error:', error);
    
    return NextResponse.json<ApiResponse>({
      success: false,
      error: {
        code: ERROR_CODES.VALIDATION_ERROR,
        message: error instanceof Error ? error.message : 'Failed to update user'
      }
    }, { status: HTTP_STATUS.INTERNAL_SERVER_ERROR });
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
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

    const { userId } = params;

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: {
          code: ERROR_CODES.VALIDATION_ERROR,
          message: 'Invalid user ID format'
        }
      }, { status: HTTP_STATUS.BAD_REQUEST });
    }

    // Prevent self-deletion
    if (userId === session.user.id) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: {
          code: ERROR_CODES.AUTHORIZATION_ERROR,
          message: 'Cannot delete your own account'
        }
      }, { status: HTTP_STATUS.FORBIDDEN });
    }

    await connectToDatabase();

    // Find user
    const user = await User.findById(userId);
    if (!user) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: {
          code: ERROR_CODES.NOT_FOUND_ERROR,
          message: 'User not found'
        }
      }, { status: HTTP_STATUS.NOT_FOUND });
    }

    // Parse query parameters for deletion type
    const { searchParams } = new URL(request.url);
    const permanent = searchParams.get('permanent') === 'true';

    if (permanent) {
      // Permanent deletion
      await Promise.all([
        File.deleteMany({ owner: userId }),
        Folder.deleteMany({ owner: userId }),
        Share.deleteMany({ owner: userId }),
        Subscription.deleteMany({ user: userId }),
        User.findByIdAndDelete(userId)
      ]);

      return NextResponse.json<ApiResponse>({
        success: true,
        message: 'User permanently deleted',
        meta: {
          timestamp: new Date(),
          version: '1.0.0',
          requestId: crypto.randomUUID()
        }
      });
    } else {
      // Soft deletion - deactivate and anonymize
      user.isActive = false;
      user.name = `Deleted User ${user._id}`;
      user.email = `deleted.${user._id}@example.com`;
      
      await user.save();

      // Also soft delete user's files and folders
      await Promise.all([
        File.updateMany(
          { owner: userId },
          { 
            isDeleted: true, 
            deletedAt: new Date(),
            deletedBy: new mongoose.Types.ObjectId(session.user.id)
          }
        ),
        Folder.updateMany(
          { owner: userId },
          { 
            isDeleted: true, 
            deletedAt: new Date(),
            deletedBy: new mongoose.Types.ObjectId(session.user.id)
          }
        ),
        Share.updateMany(
          { owner: userId },
          { isActive: false }
        )
      ]);

      return NextResponse.json<ApiResponse>({
        success: true,
        message: 'User deactivated and data anonymized',
        meta: {
          timestamp: new Date(),
          version: '1.0.0',
          requestId: crypto.randomUUID()
        }
      });
    }

  } catch (error) {
    console.error('Admin user delete error:', error);
    
    return NextResponse.json<ApiResponse>({
      success: false,
      error: {
        code: ERROR_CODES.VALIDATION_ERROR,
        message: error instanceof Error ? error.message : 'Failed to delete user'
      }
    }, { status: HTTP_STATUS.INTERNAL_SERVER_ERROR });
  }
}