// src/lib/services/auth.ts
import { signIn, signOut, getSession } from 'next-auth/react';
import { getServerSession } from 'next-auth/next';
import { authConfig } from '@/lib/auth/config';
import { connectToDatabase } from '@/lib/database/connection';
import { User, type IUser } from '@/lib/database/models';
import { ValidationUtils } from '@/lib/utils/validation-utils';
import { EmailService } from './email';
import { API_ENDPOINTS } from '@/lib/api/endpoints';
import { ApiResponse } from '@/types/api';
import type { 
  LoginRequest, 
  LoginResponse, 
  RegisterRequest, 
  RegisterResponse,
  ForgotPasswordRequest,
  ResetPasswordRequest 
} from '@/lib/api/types';

export interface AuthResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  redirectUrl?: string;
}

export class AuthService {
  /**
   * Sign in with credentials using NextAuth
   */
  static async signInWithCredentials(
    credentials: LoginRequest
  ): Promise<AuthResult<LoginResponse>> {
    try {
      const result = await signIn('credentials', {
        email: credentials.email,
        password: credentials.password,
        redirect: false,
      });

      if (result?.error) {
        return {
          success: false,
          error: result.error
        };
      }

      if (result?.ok) {
        const session = await getSession();
        
        return {
          success: true,
          data: {
            user: session?.user as any,
            token: '', // NextAuth handles tokens internally
            expiresAt: new Date(session?.expires || Date.now() + 30 * 24 * 60 * 60 * 1000)
          },
          redirectUrl: '/dashboard'
        };
      }

      return {
        success: false,
        error: 'Unknown authentication error'
      };
    } catch (error) {
      console.error('Sign in error:', error);
      return {
        success: false,
        error: 'Authentication failed'
      };
    }
  }

  /**
   * Sign in with Google OAuth using NextAuth
   */
  static async signInWithGoogle(): Promise<AuthResult> {
    try {
      const result = await signIn('google', {
        redirect: false,
        callbackUrl: '/dashboard'
      });

      if (result?.error) {
        return {
          success: false,
          error: result.error
        };
      }

      return {
        success: true,
        redirectUrl: result?.url || '/dashboard'
      };
    } catch (error) {
      console.error('Google sign in error:', error);
      return {
        success: false,
        error: 'Google authentication failed'
      };
    }
  }

  /**
   * Sign out user using NextAuth
   */
  static async signOut(): Promise<AuthResult> {
    try {
      await signOut({
        redirect: false
      });

      return {
        success: true,
        redirectUrl: '/login'
      };
    } catch (error) {
      console.error('Sign out error:', error);
      return {
        success: false,
        error: 'Sign out failed'
      };
    }
  }

  /**
   * Register new user
   */
  static async register(data: RegisterRequest): Promise<AuthResult<RegisterResponse>> {
    try {
      const response = await fetch(API_ENDPOINTS.AUTH.REGISTER, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      const result: ApiResponse<RegisterResponse> = await response.json();

      if (!result.success) {
        return {
          success: false,
          error: result.error?.message || 'Registration failed'
        };
      }

      return {
        success: true,
        data: result.data,
        redirectUrl: '/verify-email'
      };
    } catch (error) {
      console.error('Registration error:', error);
      return {
        success: false,
        error: 'Registration failed'
      };
    }
  }

  /**
   * Request password reset
   */
  static async forgotPassword(email: string): Promise<AuthResult> {
    try {
      const response = await fetch(API_ENDPOINTS.AUTH.FORGOT_PASSWORD, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const result: ApiResponse = await response.json();

      if (!result.success) {
        return {
          success: false,
          error: result.error?.message || 'Failed to send reset email'
        };
      }

      return {
        success: true,
        data: { message: result.message }
      };
    } catch (error) {
      console.error('Forgot password error:', error);
      return {
        success: false,
        error: 'Failed to send reset email'
      };
    }
  }

  /**
   * Reset password with token
   */
  static async resetPassword(data: ResetPasswordRequest): Promise<AuthResult> {
    try {
      const response = await fetch(API_ENDPOINTS.AUTH.RESET_PASSWORD, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      const result: ApiResponse = await response.json();

      if (!result.success) {
        return {
          success: false,
          error: result.error?.message || 'Password reset failed'
        };
      }

      return {
        success: true,
        data: { message: result.message },
        redirectUrl: '/login?reset=success'
      };
    } catch (error) {
      console.error('Reset password error:', error);
      return {
        success: false,
        error: 'Password reset failed'
      };
    }
  }

  /**
   * Verify email with token
   */
  static async verifyEmail(token: string): Promise<AuthResult> {
    try {
      const response = await fetch(API_ENDPOINTS.AUTH.VERIFY_EMAIL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token }),
      });

      const result: ApiResponse = await response.json();

      if (!result.success) {
        return {
          success: false,
          error: result.error?.message || 'Email verification failed'
        };
      }

      return {
        success: true,
        data: { message: result.message },
        redirectUrl: '/login?verified=true'
      };
    } catch (error) {
      console.error('Email verification error:', error);
      return {
        success: false,
        error: 'Email verification failed'
      };
    }
  }

  /**
   * Resend verification email
   */
  static async resendVerificationEmail(email: string): Promise<AuthResult> {
    try {
      const response = await fetch(API_ENDPOINTS.AUTH.VERIFY_EMAIL, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const result: ApiResponse = await response.json();

      if (!result.success) {
        return {
          success: false,
          error: result.error?.message || 'Failed to resend verification email'
        };
      }

      return {
        success: true,
        data: { message: result.message }
      };
    } catch (error) {
      console.error('Resend verification error:', error);
      return {
        success: false,
        error: 'Failed to resend verification email'
      };
    }
  }

  /**
   * Get current session (client-side)
   */
  static async getCurrentSession() {
    try {
      return await getSession();
    } catch (error) {
      console.error('Get session error:', error);
      return null;
    }
  }

  /**
   * Get current session (server-side)
   */
  static async getServerSession() {
    try {
      return await getServerSession(authConfig);
    } catch (error) {
      console.error('Get server session error:', error);
      return null;
    }
  }

  /**
   * Check if user is authenticated (client-side)
   */
  static async isAuthenticated(): Promise<boolean> {
    try {
      const session = await getSession();
      return !!session?.user;
    } catch (error) {
      console.error('Authentication check error:', error);
      return false;
    }
  }

  /**
   * Check if user has specific role
   */
  static async hasRole(role: 'user' | 'admin'): Promise<boolean> {
    try {
      const session = await getSession();
      return session?.user?.role === role;
    } catch (error) {
      console.error('Role check error:', error);
      return false;
    }
  }

  /**
   * Check if user is admin
   */
  static async isAdmin(): Promise<boolean> {
    return this.hasRole('admin');
  }

  /**
   * Refresh user session data
   */
  static async refreshSession(): Promise<AuthResult> {
    try {
      const response = await fetch(API_ENDPOINTS.AUTH.REFRESH_TOKEN, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const result: ApiResponse = await response.json();

      if (!result.success) {
        return {
          success: false,
          error: result.error?.message || 'Session refresh failed'
        };
      }

      return {
        success: true,
        data: result.data
      };
    } catch (error) {
      console.error('Session refresh error:', error);
      return {
        success: false,
        error: 'Session refresh failed'
      };
    }
  }

  /**
   * Get user by ID (server-side) using existing model method
   */
  static async getUserById(userId: string): Promise<IUser | null> {
    try {
      await connectToDatabase();
      return await User.findById(userId);
    } catch (error) {
      console.error('Get user by ID error:', error);
      return null;
    }
  }

  /**
   * Get user by email (server-side) using existing model method
   */
  static async getUserByEmail(email: string): Promise<IUser | null> {
    try {
      await connectToDatabase();
      return await User.findByEmail(email);
    } catch (error) {
      console.error('Get user by email error:', error);
      return null;
    }
  }

  /**
   * Update user last login time
   */
  static async updateLastLogin(userId: string): Promise<void> {
    try {
      await connectToDatabase();
      await User.findByIdAndUpdate(userId, {
        lastLoginAt: new Date()
      });
    } catch (error) {
      console.error('Update last login error:', error);
    }
  }

  /**
   * Check if email exists using existing model method
   */
  static async emailExists(email: string): Promise<boolean> {
    try {
      await connectToDatabase();
      const user = await User.findByEmail(email);
      return !!user;
    } catch (error) {
      console.error('Email exists check error:', error);
      return false;
    }
  }

  /**
   * Validate password strength using existing utility
   */
  static validatePasswordStrength(password: string): {
    isValid: boolean;
    errors: string[];
    score: number;
  } {
    const result = ValidationUtils.validatePassword(password, {
      minLength: 8,
      requireUppercase: true,
      requireNumbers: true,
      requireSymbols: true
    });

    if (result.isValid) {
      return {
        isValid: true,
        errors: [],
        score: 5
      };
    }

    return {
      isValid: false,
      errors: [result.error || 'Password validation failed'],
      score: 0
    };
  }

  /**
   * Generate secure token using existing model method
   */
  static generateToken(): string {
    // Use existing crypto methods from User model
    const crypto = require('crypto');
    return crypto.randomBytes(32).toString('hex');
  }
}