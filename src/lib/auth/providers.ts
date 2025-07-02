import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import { User } from '../database/models/user';
import { connectToDatabase } from '../database/connection';
import { loginSchema } from '../validation/auth';
import { STORAGE_LIMITS, SUBSCRIPTION_PLANS, USER_LIMITS } from '../utils/constants';
import { env } from '../config/env';
import { Provider } from 'next-auth/providers/index';

// Rate limiting store (in production, use Redis)
const loginAttempts = new Map<string, { count: number; lastAttempt: number; lockedUntil?: number }>();

// Helper function to check rate limiting
function checkRateLimit(identifier: string): { allowed: boolean; lockedUntil?: number } {
  const now = Date.now();
  const attempts = loginAttempts.get(identifier);
  
  if (!attempts) {
    loginAttempts.set(identifier, { count: 1, lastAttempt: now });
    return { allowed: true };
  }
  
  // Check if still locked
  if (attempts.lockedUntil && now < attempts.lockedUntil) {
    return { allowed: false, lockedUntil: attempts.lockedUntil };
  }
  
  // Reset if last attempt was more than 15 minutes ago
  if (now - attempts.lastAttempt > 15 * 60 * 1000) {
    loginAttempts.set(identifier, { count: 1, lastAttempt: now });
    return { allowed: true };
  }
  
  // Increment attempt count
  attempts.count++;
  attempts.lastAttempt = now;
  
  // Lock if exceeded max attempts
  if (attempts.count >= USER_LIMITS.MAX_LOGIN_ATTEMPTS) {
    attempts.lockedUntil = now + USER_LIMITS.LOCKOUT_DURATION;
    return { allowed: false, lockedUntil: attempts.lockedUntil };
  }
  
  return { allowed: true };
}

// Helper function to reset rate limit on successful login
function resetRateLimit(identifier: string): void {
  loginAttempts.delete(identifier);
}

export const authProviders: Provider[] = [
  // Credentials provider for email/password authentication
  CredentialsProvider({
    id: 'credentials',
    name: 'Email and Password',
    credentials: {
      email: { label: 'Email', type: 'email' },
      password: { label: 'Password', type: 'password' }
    },
    async authorize(credentials, req) {
      try {
        // Validate input
        const validation = loginSchema.safeParse(credentials);
        if (!validation.success) {
          console.error('Invalid credentials format:', validation.error);
          return null;
        }

        const { email, password } = validation.data;
        
        // Check rate limiting
        const clientIp = req?.headers?.['x-forwarded-for'] as string || 
                        req?.headers?.['x-real-ip'] as string || 
                        'unknown';
        const identifier = `${email}-${clientIp}`;
        
        const rateLimit = checkRateLimit(identifier);
        if (!rateLimit.allowed) {
          console.warn(`Login rate limit exceeded for ${email} from ${clientIp}`);
          throw new Error('Too many login attempts. Please try again later.');
        }

        // Connect to database
        await connectToDatabase();
        
        // Find user by email
        const user = await User.findByEmail(email).select('+password');
        if (!user) {
          console.warn(`Login attempt for non-existent user: ${email}`);
          return null;
        }

        // Check if user is active
        if (!user.isActive) {
          console.warn(`Login attempt for inactive user: ${email}`);
          throw new Error('Account is deactivated. Please contact support.');
        }

        // Verify password
        const isValidPassword = await user.comparePassword(password);
        if (!isValidPassword) {
          console.warn(`Invalid password for user: ${email}`);
          return null;
        }

        // Reset rate limit on successful login
        resetRateLimit(identifier);

        // Return user object that matches NextAuth user type
        return {
          id: user._id.toString(),
          email: user.email,
          name: user.name,
          image: user.avatar,
          role: user.role,
          subscription: user.subscription,
          storage: user.storage,
          preferences: user.preferences,
          isVerified: user.isVerified
        };

      } catch (error) {
        console.error('Credentials authentication error:', error);
        
        // Re-throw specific errors for user feedback
        if (error instanceof Error && error.message.includes('Too many login attempts')) {
          throw error;
        }
        if (error instanceof Error && error.message.includes('Account is deactivated')) {
          throw error;
        }
        
        return null;
      }
    }
  }),

  // Google OAuth provider
  ...(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET ? [
    GoogleProvider({
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      authorization: {
        params: {
          prompt: 'consent',
          access_type: 'offline',
          response_type: 'code',
          scope: 'openid email profile'
        }
      },
      profile(profile) {
        return {
          id: profile.sub,
          name: profile.name,
          email: profile.email,
          image: profile.picture,
          emailVerified: profile.email_verified
        };
      }
    })
  ] : [])
];

// Helper function to create user from OAuth profile
export async function createUserFromOAuth(profile: any, provider: string): Promise<any> {
  try {
    await connectToDatabase();
    
    const userData = {
      email: profile.email,
      name: profile.name || profile.email.split('@')[0],
      provider: provider as 'google',
      providerId: profile.id || profile.sub,
      avatar: profile.image || profile.picture,
      isVerified: profile.email_verified || true,
      subscription: {
        plan: SUBSCRIPTION_PLANS.FREE,
        status: 'active' as const
      },
      storage: {
        used: 0,
        limit: STORAGE_LIMITS.FREE
      },
      preferences: {
        theme: 'system' as const,
        language: 'en',
        notifications: {
          email: true,
          sharing: true,
          storage: true
        }
      }
    };

    const user = await User.createWithProvider(userData);
    
    return {
      id: user._id.toString(),
      email: user.email,
      name: user.name,
      image: user.avatar,
      role: user.role,
      subscription: user.subscription,
      storage: user.storage,
      preferences: user.preferences,
      isVerified: user.isVerified
    };
  } catch (error) {
    console.error('Error creating user from OAuth:', error);
    throw error;
  }
}

// Helper function to link OAuth account to existing user
export async function linkOAuthAccount(userId: string, profile: any, provider: string): Promise<void> {
  try {
    await connectToDatabase();
    
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Update user with OAuth information
    user.provider = provider as 'google';
    user.providerId = profile.id || profile.sub;
    user.isVerified = profile.email_verified || user.isVerified;
    
    if (!user.avatar && (profile.image || profile.picture)) {
      user.avatar = profile.image || profile.picture;
    }

    await user.save();
  } catch (error) {
    console.error('Error linking OAuth account:', error);
    throw error;
  }
}

// Helper function to get available providers based on system settings
export async function getAvailableProviders(): Promise<{ id: string; name: string; type: string }[]> {
  try {
    await connectToDatabase();
    const SystemSettings = (await import('../database/models/system-settings')).SystemSettings;
    const settings = await SystemSettings.getInstance();
    
    const providers = [
      { id: 'credentials', name: 'Email & Password', type: 'credentials' }
    ];

    // Add Google if enabled and configured
    if (settings.features.googleAuth && env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) {
      providers.push({ id: 'google', name: 'Google', type: 'oauth' });
    }

    return providers;
  } catch (error) {
    console.error('Error getting available providers:', error);
    return [{ id: 'credentials', name: 'Email & Password', type: 'credentials' }];
  }
}

// Helper function to validate OAuth profile
export function validateOAuthProfile(profile: any, provider: string): boolean {
  if (!profile.email) {
    console.error(`OAuth profile missing email for provider: ${provider}`);
    return false;
  }

  if (provider === 'google' && !profile.email_verified) {
    console.error('Google OAuth profile email not verified');
    return false;
  }

  return true;
}

// Helper function to get rate limit info for user
export function getRateLimitInfo(identifier: string): {
  attempts: number;
  isLocked: boolean;
  lockedUntil?: number;
  timeRemaining?: number;
} {
  const attempts = loginAttempts.get(identifier);
  const now = Date.now();
  
  if (!attempts) {
    return { attempts: 0, isLocked: false };
  }
  
  const isLocked = attempts.lockedUntil ? now < attempts.lockedUntil : false;
  const timeRemaining = attempts.lockedUntil ? Math.max(0, attempts.lockedUntil - now) : undefined;
  
  return {
    attempts: attempts.count,
    isLocked,
    lockedUntil: attempts.lockedUntil,
    timeRemaining
  };
}

// Cleanup function for rate limiting (should be called periodically)
export function cleanupRateLimits(): void {
  const now = Date.now();
  const expiredThreshold = 24 * 60 * 60 * 1000; // 24 hours
  
  for (const [identifier, attempts] of loginAttempts.entries()) {
    if (now - attempts.lastAttempt > expiredThreshold) {
      loginAttempts.delete(identifier);
    }
  }
}

// Export provider configurations for client-side usage
export const PROVIDER_CONFIGS = {
  credentials: {
    id: 'credentials',
    name: 'Email & Password',
    type: 'credentials',
    signinUrl: '/api/auth/signin/credentials',
    callbackUrl: '/api/auth/callback/credentials'
  },
  google: {
    id: 'google',
    name: 'Google',
    type: 'oauth',
    signinUrl: '/api/auth/signin/google',
    callbackUrl: '/api/auth/callback/google'
  }
} as const;