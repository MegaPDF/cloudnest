// src/app/api/auth/forgot-password/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/database/connection';
import { User } from '@/lib/database/models';
import { forgotPasswordSchema } from '@/lib/validation/auth';
import { HTTP_STATUS, ERROR_CODES } from '@/lib/utils/constants';
import { ValidationError } from '@/lib/api/error-handler';
import { ApiResponse } from '@/types/api';
import type { ForgotPasswordRequest } from '@/lib/api/types';
import { EmailService } from '@/lib/services/email';

export async function POST(request: NextRequest) {
  try {
    const body: ForgotPasswordRequest = await request.json();
    
    // Validate request data using existing Zod schema
    const validation = forgotPasswordSchema.safeParse(body);
    if (!validation.success) {
      throw new ValidationError(
        'Invalid email format',
        ERROR_CODES.VALIDATION_ERROR,
        HTTP_STATUS.BAD_REQUEST,
        validation.error.flatten().fieldErrors
      );
    }

    const { email } = validation.data;

    await connectToDatabase();

    // Find user using existing static method
    const user = await User.findByEmail(email);
    
    // Always return success to prevent email enumeration attacks
    const successResponse: ApiResponse = {
      success: true,
      message: 'If an account with that email exists, we have sent a password reset link.',
      meta: {
        timestamp: new Date(),
        version: '1.0.0',
        requestId: crypto.randomUUID()
      }
    };

    if (!user) {
      // Return success even if user doesn't exist (security best practice)
      return NextResponse.json<ApiResponse>(successResponse);
    }

    // Check if user is active
    if (!user.isActive) {
      // Return success even for inactive users (security best practice)
      return NextResponse.json<ApiResponse>(successResponse);
    }

    // Check if user is using OAuth (Google) - they can't reset password
    if (user.provider !== 'email') {
      // Still return success (security best practice)
      return NextResponse.json<ApiResponse>(successResponse);
    }

    // Generate reset token using existing model method
    const resetToken = user.generateResetPasswordToken();
    await user.save();

    // Send password reset email using existing service
    try {
      await EmailService.sendPasswordResetEmail(
        user.email,
        user.name,
        resetToken
      );
    } catch (emailError) {
      console.error('Failed to send password reset email:', emailError);
      
      // Clear the reset token if email fails
      user.resetPasswordToken = undefined;
      user.resetPasswordExpires = undefined;
      await user.save();

      return NextResponse.json<ApiResponse>({
        success: false,
        error: {
          code: ERROR_CODES.EMAIL_ERROR,
          message: 'Failed to send password reset email. Please try again later.'
        }
      }, { status: HTTP_STATUS.INTERNAL_SERVER_ERROR });
    }

    return NextResponse.json<ApiResponse>(successResponse);

  } catch (error) {
    console.error('Forgot password error:', error);

    if (error instanceof ValidationError) {
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