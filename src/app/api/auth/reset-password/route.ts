// src/app/api/auth/reset-password/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/database/connection';
import { User } from '@/lib/database/models';
import { resetPasswordSchema } from '@/lib/validation/auth';
import { HTTP_STATUS, ERROR_CODES } from '@/lib/utils/constants';
import { ValidationError, NotFoundError, AuthorizationError } from '@/lib/api/error-handler';
import { ApiResponse } from '@/types/api';
import type { ResetPasswordRequest } from '@/lib/api/types';
import { EmailService } from '@/lib/services/email';

export async function POST(request: NextRequest) {
  try {
    const body: ResetPasswordRequest = await request.json();
    
    // Validate request data using existing Zod schema
    const validation = resetPasswordSchema.safeParse(body);
    if (!validation.success) {
      throw new ValidationError(
        'Invalid reset password data',
        ERROR_CODES.VALIDATION_ERROR,
        HTTP_STATUS.BAD_REQUEST,
        validation.error.flatten().fieldErrors
      );
    }

    const { token, password } = validation.data;

    await connectToDatabase();

    // Find user by reset token using existing static method
    const user = await User.findByResetToken(token);
    
    if (!user) {
      throw new NotFoundError('Invalid or expired reset token');
    }

    // Check if user is active
    if (!user.isActive) {
      throw new AuthorizationError('User account is inactive');
    }

    // Check if user is using OAuth (should not be able to reset password)
    if (user.provider !== 'email') {
      throw new ValidationError('Cannot reset password for OAuth accounts');
    }

    // Update user password and clear reset token
    user.password = password; // Will be hashed by pre-save middleware
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    user.lastLoginAt = new Date(); // Update last login time
    
    await user.save();

    // Send password reset confirmation email using existing service
    try {
      await EmailService.sendPasswordResetConfirmationEmail(
        user.email,
        user.name
      );
    } catch (emailError) {
      console.error('Failed to send password reset confirmation email:', emailError);
      // Don't fail the password reset if email sending fails
    }

    return NextResponse.json<ApiResponse>({
      success: true,
      message: 'Password has been successfully reset. You can now login with your new password.',
      meta: {
        timestamp: new Date(),
        version: '1.0.0',
        requestId: crypto.randomUUID()
      }
    });

  } catch (error) {
    console.error('Reset password error:', error);

    if (error instanceof ValidationError || 
        error instanceof NotFoundError || 
        error instanceof AuthorizationError) {
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