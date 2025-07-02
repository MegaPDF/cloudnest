// src/app/api/auth/verify-email/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/database/connection';
import { User } from '@/lib/database/models';
import { verifyEmailSchema } from '@/lib/validation/auth';
import { HTTP_STATUS, ERROR_CODES } from '@/lib/utils/constants';
import { ValidationError, NotFoundError, AuthorizationError } from '@/lib/api/error-handler';
import { ApiResponse } from '@/types/api';
import { EmailService } from '@/lib/services/email';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate request data using existing Zod schema
    const validation = verifyEmailSchema.safeParse(body);
    if (!validation.success) {
      throw new ValidationError(
        'Invalid verification token',
        ERROR_CODES.VALIDATION_ERROR,
        HTTP_STATUS.BAD_REQUEST,
        validation.error.flatten().fieldErrors
      );
    }

    const { token } = validation.data;

    await connectToDatabase();

    // Find user by verification token
    const user = await User.findOne({ 
      verificationToken: token,
      isVerified: false 
    });
    
    if (!user) {
      throw new NotFoundError('Invalid verification token or email already verified');
    }

    // Check if user is active
    if (!user.isActive) {
      throw new AuthorizationError('User account is inactive');
    }

    // Verify the email
    user.isVerified = true;
    user.verificationToken = undefined;
    
    await user.save();

    // Send welcome email using existing service
    try {
      await EmailService.sendWelcomeEmail(
        user.email,
        user.name
      );
    } catch (emailError) {
      console.error('Failed to send welcome email:', emailError);
      // Don't fail verification if welcome email fails
    }

    return NextResponse.json<ApiResponse>({
      success: true,
      message: 'Email verified successfully! Welcome to CloudNest.',
      meta: {
        timestamp: new Date(),
        version: '1.0.0',
        requestId: crypto.randomUUID()
      }
    });

  } catch (error) {
    console.error('Email verification error:', error);

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
        code: ERROR_CODES.VALIDATION_ERROR,
        message: 'Internal server error'
      }
    }, { status: HTTP_STATUS.INTERNAL_SERVER_ERROR });
  }
}

export async function GET(request: NextRequest) {
  try {
    // Handle verification via GET request (for email links)
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
      throw new ValidationError('Verification token is required');
    }

    // Validate token format using existing schema
    const validation = verifyEmailSchema.safeParse({ token });
    if (!validation.success) {
      throw new ValidationError('Invalid verification token format');
    }

    await connectToDatabase();

    // Find user by verification token
    const user = await User.findOne({ 
      verificationToken: token,
      isVerified: false 
    });
    
    if (!user) {
      // Redirect to login page with error
      const redirectUrl = new URL('/login', request.url);
      redirectUrl.searchParams.set('error', 'verification_failed');
      return NextResponse.redirect(redirectUrl);
    }

    // Check if user is active
    if (!user.isActive) {
      const redirectUrl = new URL('/login', request.url);
      redirectUrl.searchParams.set('error', 'account_inactive');
      return NextResponse.redirect(redirectUrl);
    }

    // Verify the email
    user.isVerified = true;
    user.verificationToken = undefined;
    
    await user.save();

    // Send welcome email using existing service
    try {
      await EmailService.sendWelcomeEmail(
        user.email,
        user.name
      );
    } catch (emailError) {
      console.error('Failed to send welcome email:', emailError);
    }

    // Redirect to login page with success message
    const redirectUrl = new URL('/login', request.url);
    redirectUrl.searchParams.set('verified', 'true');
    
    return NextResponse.redirect(redirectUrl);

  } catch (error) {
    console.error('Email verification error:', error);

    // Redirect to login page with error
    const redirectUrl = new URL('/login', request.url);
    redirectUrl.searchParams.set('error', 'verification_failed');
    
    return NextResponse.redirect(redirectUrl);
  }
}

// Route to resend verification email
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email) {
      throw new ValidationError('Email is required');
    }

    await connectToDatabase();

    // Find unverified user using existing static method
    const user = await User.findOne({ 
      email: email.toLowerCase(),
      isVerified: false,
      isActive: true 
    });

    if (!user) {
      // Return success even if user doesn't exist (security best practice)
      return NextResponse.json<ApiResponse>({
        success: true,
        message: 'If an unverified account exists, a verification email has been sent.'
      });
    }

    // Generate new verification token using existing method
    const verificationToken = user.generateVerificationToken();
    await user.save();

    // Send verification email using existing service
    try {
      await EmailService.sendVerificationEmail(
        user.email,
        user.name,
        verificationToken
      );
    } catch (emailError) {
      console.error('Failed to resend verification email:', emailError);
      
      return NextResponse.json<ApiResponse>({
        success: false,
        error: {
          code: ERROR_CODES.EMAIL_ERROR,
          message: 'Failed to send verification email. Please try again later.'
        }
      }, { status: HTTP_STATUS.INTERNAL_SERVER_ERROR });
    }

    return NextResponse.json<ApiResponse>({
      success: true,
      message: 'Verification email sent successfully.',
      meta: {
        timestamp: new Date(),
        version: '1.0.0',
        requestId: crypto.randomUUID()
      }
    });

  } catch (error) {
    console.error('Resend verification error:', error);

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