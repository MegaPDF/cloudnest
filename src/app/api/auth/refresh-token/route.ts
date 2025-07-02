// src/app/api/auth/refresh-token/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { connectToDatabase } from '@/lib/database/connection';
import { User } from '@/lib/database/models';
import { HTTP_STATUS, ERROR_CODES } from '@/lib/utils/constants';
import { AuthenticationError, AuthorizationError } from '@/lib/api/error-handler';
import { authConfig } from '@/lib/auth/config';
import { ApiResponse } from '@/types/api';

export async function POST(request: NextRequest) {
  try {
    // Get session using existing NextAuth method
    const session = await getServerSession(authConfig);
    
    if (!session?.user?.id) {
      throw new AuthenticationError('No valid session found');
    }

    await connectToDatabase();

    // Verify user still exists and is active using existing static method
    const user = await User.findById(session.user.id);
    
    if (!user || !user.isActive) {
      throw new AuthorizationError('User account is inactive or not found');
    }

    // Update last login time
    user.lastLoginAt = new Date();
    await user.save();

    // Return refreshed user data using existing method
    const userResponse = user.toPublicJSON();

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        user: userResponse,
        session: {
          expires: session.expires,
          user: session.user
        }
      },
      message: 'Session refreshed successfully',
      meta: {
        timestamp: new Date(),
        version: '1.0.0',
        requestId: crypto.randomUUID()
      }
    });

  } catch (error) {
    console.error('Token refresh error:', error);

    if (error instanceof AuthenticationError || error instanceof AuthorizationError) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: error.toJSON()
      }, { status: error.statusCode });
    }

    return NextResponse.json<ApiResponse>({
      success: false,
      error: {
        code: ERROR_CODES.INTERNAL_SERVER_ERROR,
        message: 'Internal server error'
      }
    }, { status: HTTP_STATUS.INTERNAL_SERVER_ERROR });
  }
}

export async function GET(request: NextRequest) {
  try {
    // Get session information without refreshing using existing method
    const session = await getServerSession(authConfig);
    
    if (!session?.user?.id) {
      throw new AuthenticationError('No valid session found');
    }

    await connectToDatabase();

    // Get current user using existing static method
    const user = await User.findById(session.user.id);
    
    if (!user || !user.isActive) {
      throw new AuthorizationError('User account is inactive or not found');
    }

    // Return session information using existing method
    const userResponse = user.toPublicJSON();

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        user: userResponse,
        session: {
          expires: session.expires,
          user: session.user,
          isValid: true
        }
      },
      meta: {
        timestamp: new Date(),
        version: '1.0.0',
        requestId: crypto.randomUUID()
      }
    });

  } catch (error) {
    console.error('Session info error:', error);

    if (error instanceof AuthenticationError || error instanceof AuthorizationError) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: error.toJSON()
      }, { status: error.statusCode });
    }

    return NextResponse.json<ApiResponse>({
      success: false,
      error: {
        code: ERROR_CODES.INTERNAL_SERVER_ERROR,
        message: 'Internal server error'
      }
    }, { status: HTTP_STATUS.INTERNAL_SERVER_ERROR });
  }
}