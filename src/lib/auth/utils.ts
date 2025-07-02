import { getServerSession } from 'next-auth/next';
import { getSession } from 'next-auth/react';
import { NextRequest } from 'next/server';
import { JWT, getToken } from 'next-auth/jwt';
import { authConfig, type AuthSession } from './config';
import { User, IUser } from '../database/models/user';
import { connectToDatabase } from '../database/connection';
import { PermissionUtils, type Permission } from '../utils/permission-utils';
import { EncryptionUtils } from '../utils/encryption';
import { ValidationUtils } from '../utils/validation-utils';
import { env } from '../config/env';

// Server-side session utilities
export async function getAuthSession(): Promise<AuthSession | null> {
  try {
    const session = await getServerSession(authConfig);
    return session as AuthSession | null;
  } catch (error) {
    console.error('Error getting auth session:', error);
    return null;
  }
}

// Get current user from session (server-side)
export async function getCurrentUser(): Promise<IUser | null> {
  try {
    const session = await getAuthSession();
    if (!session?.user?.id) return null;

    await connectToDatabase();
    const user = await User.findById(session.user.id);
    return user;
  } catch (error) {
    console.error('Error getting current user:', error);
    return null;
  }
}

// Get user from request (middleware/API routes)
export async function getUserFromRequest(request: NextRequest): Promise<IUser | null> {
  try {
    const token = await getToken({
      req: request,
      secret: env.NEXTAUTH_SECRET
    });

    if (!token?.id) return null;

    await connectToDatabase();
    const user = await User.findById(token.id);
    return user;
  } catch (error) {
    console.error('Error getting user from request:', error);
    return null;
  }
}

// Check if user has specific permission
export async function hasPermission(permission: Permission): Promise<boolean> {
  try {
    const user = await getCurrentUser();
    if (!user) return false;

    return PermissionUtils.hasPermission(user.role, permission);
  } catch (error) {
    console.error('Error checking permission:', error);
    return false;
  }
}

// Check if user has admin role
export async function isAdmin(): Promise<boolean> {
  try {
    const user = await getCurrentUser();
    return user?.role === 'admin' || false;
  } catch (error) {
    console.error('Error checking admin status:', error);
    return false;
  }
}

// Require authentication (throws if not authenticated)
export async function requireAuth(): Promise<IUser> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error('Authentication required');
  }
  return user;
}

// Require admin role (throws if not admin)
export async function requireAdmin(): Promise<IUser> {
  const user = await requireAuth();
  if (user.role !== 'admin') {
    throw new Error('Admin access required');
  }
  return user;
}

// Require specific permission (throws if permission not granted)
export async function requirePermission(permission: Permission): Promise<IUser> {
  const user = await requireAuth();
  if (!PermissionUtils.hasPermission(user.role, permission)) {
    throw new Error(`Permission '${permission}' required`);
  }
  return user;
}

// Password utilities
export class PasswordUtils {
  /**
   * Generate secure password
   */
  static generateSecurePassword(length: number = 12): string {
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let password = '';
    
    // Ensure at least one character from each category
    const categories = [
      'abcdefghijklmnopqrstuvwxyz', // lowercase
      'ABCDEFGHIJKLMNOPQRSTUVWXYZ', // uppercase
      '0123456789',                 // numbers
      '!@#$%^&*'                   // symbols
    ];
    
    // Add one character from each category
    for (const category of categories) {
      const randomIndex = Math.floor(Math.random() * category.length);
      password += category[randomIndex];
    }
    
    // Fill remaining length with random characters
    for (let i = password.length; i < length; i++) {
      const randomIndex = Math.floor(Math.random() * charset.length);
      password += charset[randomIndex];
    }
    
    // Shuffle the password
    return password.split('').sort(() => Math.random() - 0.5).join('');
  }

  /**
   * Check password strength
   */
  static checkPasswordStrength(password: string): {
    score: number;
    feedback: string[];
    strength: 'weak' | 'fair' | 'good' | 'strong';
  } {
    const feedback: string[] = [];
    let score = 0;

    // Length check
    if (password.length >= 8) score += 1;
    else feedback.push('Use at least 8 characters');

    if (password.length >= 12) score += 1;
    else feedback.push('Use 12+ characters for better security');

    // Character variety checks
    if (/[a-z]/.test(password)) score += 1;
    else feedback.push('Add lowercase letters');

    if (/[A-Z]/.test(password)) score += 1;
    else feedback.push('Add uppercase letters');

    if (/[0-9]/.test(password)) score += 1;
    else feedback.push('Add numbers');

    if (/[^A-Za-z0-9]/.test(password)) score += 1;
    else feedback.push('Add special characters');

    // Common patterns check
    if (!/(.)\1{2,}/.test(password)) score += 1;
    else feedback.push('Avoid repeated characters');

    if (!/123|abc|qwe|password/i.test(password)) score += 1;
    else feedback.push('Avoid common patterns');

    const strengthMap = {
      0: 'weak', 1: 'weak', 2: 'weak', 3: 'fair',
      4: 'fair', 5: 'good', 6: 'good', 7: 'strong', 8: 'strong'
    } as const;

    return {
      score,
      feedback: score >= 6 ? [] : feedback,
      strength: strengthMap[score as keyof typeof strengthMap]
    };
  }

  /**
   * Hash password for storage
   */
  static async hashPassword(password: string): Promise<string> {
    return EncryptionUtils.hashPassword(password);
  }

  /**
   * Verify password against hash
   */
  static async verifyPassword(password: string, hash: string): Promise<boolean> {
    return EncryptionUtils.verifyPassword(password, hash);
  }
}

// Token utilities
export class TokenUtils {
  /**
   * Generate verification token
   */
  static generateVerificationToken(): string {
    return EncryptionUtils.generateToken(32);
  }

  /**
   * Generate password reset token
   */
  static generateResetToken(): { token: string; expires: Date } {
    const token = EncryptionUtils.generateToken(32);
    const expires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    return { token, expires };
  }

  /**
   * Generate API key
   */
  static generateApiKey(): string {
    const prefix = 'cn_'; // CloudNest prefix
    const key = EncryptionUtils.generateToken(32);
    return `${prefix}${key}`;
  }

  /**
   * Validate token format
   */
  static isValidToken(token: string): boolean {
    return /^[a-f0-9]{64}$/i.test(token);
  }
}

// Session utilities
export class SessionUtils {
  /**
   * Update user session data
   */
  static async updateSession(userId: string): Promise<void> {
    try {
      // This would trigger a session update on the client
      // Implementation depends on how you handle session updates
      console.log(`Session update triggered for user: ${userId}`);
    } catch (error) {
      console.error('Error updating session:', error);
    }
  }

  /**
   * Invalidate user sessions
   */
  static async invalidateUserSessions(userId: string): Promise<void> {
    try {
      // Implementation would depend on session storage strategy
      // For JWT, you might add to a blacklist
      // For database sessions, delete them
      console.log(`Sessions invalidated for user: ${userId}`);
    } catch (error) {
      console.error('Error invalidating sessions:', error);
    }
  }

  /**
   * Get session info from token
   */
  static getSessionInfo(token: JWT): {
    userId: string;
    email: string;
    role: string;
    issuedAt: number;
    expiresAt: number;
  } | null {
    if (!token.id || !token.email) return null;

    return {
      userId: token.id as string,
      email: token.email,
      role: token.role as string,
      issuedAt: token.iat as number,
      expiresAt: token.exp as number,
    };
  }
}

// Email verification utilities
export class EmailVerificationUtils {
  /**
   * Send verification email
   */
  static async sendVerificationEmail(user: IUser): Promise<boolean> {
    try {
      const token = user.generateVerificationToken();
      await user.save();

      // Here you would integrate with your email service
      // For now, just log the token
      console.log(`Verification token for ${user.email}: ${token}`);
      
      return true;
    } catch (error) {
      console.error('Error sending verification email:', error);
      return false;
    }
  }

  /**
   * Verify email with token
   */
  static async verifyEmail(token: string): Promise<{ success: boolean; user?: IUser; error?: string }> {
    try {
      if (!TokenUtils.isValidToken(token)) {
        return { success: false, error: 'Invalid token format' };
      }

      await connectToDatabase();
      const user = await User.findOne({ verificationToken: token });
      
      if (!user) {
        return { success: false, error: 'Invalid or expired token' };
      }

      user.isVerified = true;
      user.verificationToken = undefined;
      await user.save();

      return { success: true, user };
    } catch (error) {
      console.error('Error verifying email:', error);
      return { success: false, error: 'Verification failed' };
    }
  }
}

// Password reset utilities
export class PasswordResetUtils {
  /**
   * Send password reset email
   */
  static async sendResetEmail(email: string): Promise<{ success: boolean; error?: string }> {
    try {
      const validation = ValidationUtils.validateEmail(email);
      if (!validation.isValid) {
        return { success: false, error: validation.error };
      }

      await connectToDatabase();
      const user = await User.findByEmail(email);
      
      if (!user) {
        // Don't reveal if email exists
        return { success: true };
      }

      const token = user.generateResetPasswordToken();
      await user.save();

      // Here you would integrate with your email service
      console.log(`Reset token for ${user.email}: ${token}`);
      
      return { success: true };
    } catch (error) {
      console.error('Error sending reset email:', error);
      return { success: false, error: 'Failed to send reset email' };
    }
  }

  /**
   * Reset password with token
   */
  static async resetPassword(
    token: string, 
    newPassword: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      if (!TokenUtils.isValidToken(token)) {
        return { success: false, error: 'Invalid token format' };
      }

      const passwordValidation = ValidationUtils.validatePassword(newPassword);
      if (!passwordValidation.isValid) {
        return { success: false, error: passwordValidation.error };
      }

      await connectToDatabase();
      const user = await User.findByResetToken(token);
      
      if (!user) {
        return { success: false, error: 'Invalid or expired token' };
      }

      user.password = newPassword; // Will be hashed by pre-save middleware
      user.resetPasswordToken = undefined;
      user.resetPasswordExpires = undefined;
      await user.save();

      return { success: true };
    } catch (error) {
      console.error('Error resetting password:', error);
      return { success: false, error: 'Password reset failed' };
    }
  }
}

// Utility function to get client session (for use in React components)
export async function getClientSession(): Promise<AuthSession | null> {
  try {
    const session = await getSession();
    return session as AuthSession | null;
  } catch (error) {
    console.error('Error getting client session:', error);
    return null;
  }
}