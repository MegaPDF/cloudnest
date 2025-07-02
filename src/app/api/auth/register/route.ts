// src/app/api/auth/register/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/database/connection';
import { User } from '@/lib/database/models';
import { registerSchema } from '@/lib/validation/auth';
import { HTTP_STATUS, ERROR_CODES, STORAGE_LIMITS, SUBSCRIPTION_PLANS } from '@/lib/utils/constants';
import { ValidationError, ConflictError } from '@/lib/api/error-handler';
import { ApiResponse } from '@/types/api';
import type { RegisterRequest, RegisterResponse } from '@/lib/api/types';
import { EmailService } from '@/lib/services/email';

export async function POST(request: NextRequest) {
  try {
    const body: RegisterRequest = await request.json();
    
    // Validate request data using existing Zod schema
    const validation = registerSchema.safeParse(body);
    if (!validation.success) {
      throw new ValidationError(
        'Invalid registration data',
        ERROR_CODES.VALIDATION_ERROR,
        HTTP_STATUS.BAD_REQUEST,
        validation.error.flatten().fieldErrors
      );
    }

    const { name, email, password } = validation.data;

    await connectToDatabase();

    // Check if user already exists using existing static method
    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      throw new ConflictError('User with this email already exists');
    }

    // Create new user following existing patterns
    const newUser = new User({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password, // Will be hashed by pre-save middleware
      provider: 'email',
      role: 'user',
      isVerified: false,
      subscription: {
        plan: SUBSCRIPTION_PLANS.FREE,
        status: 'active'
      },
      storage: {
        used: 0,
        limit: STORAGE_LIMITS.FREE
      },
      preferences: {
        theme: 'system',
        language: 'en',
        notifications: {
          email: true,
          sharing: true,
          storage: true
        }
      },
      isActive: true
    });

    // Generate verification token using model method
    const verificationToken = newUser.generateVerificationToken();
    await newUser.save();

    // Send verification email using existing service
    try {
      await EmailService.sendVerificationEmail(
        email,
        name,
        verificationToken
      );
    } catch (emailError) {
      console.error('Failed to send verification email:', emailError);
      // Don't fail registration if email sending fails
    }

    // Return user data using model method
    const userResponse = newUser.toPublicJSON();

    return NextResponse.json<ApiResponse<RegisterResponse>>({
      success: true,
      data: {
        user: userResponse as any,
        verificationRequired: true,
        message: 'Registration successful! Please check your email to verify your account.'
      },
      message: 'User registered successfully',
      meta: {
        timestamp: new Date(),
        version: '1.0.0',
        requestId: crypto.randomUUID()
      }
    }, { status: HTTP_STATUS.CREATED });

  } catch (error) {
    console.error('Registration error:', error);

    if (error instanceof ValidationError || error instanceof ConflictError) {
      return NextResponse.json<ApiResponse<RegisterResponse>>({
        success: false,
        error: error.toJSON()
      }, { status: error.statusCode });
    }

    return NextResponse.json<ApiResponse<RegisterResponse>>({
      success: false,
      error: {
        code: ERROR_CODES.INTERNAL_SERVER_ERROR,
        message: 'Internal server error during registration'
      }
    }, { status: HTTP_STATUS.INTERNAL_SERVER_ERROR });
  }
}