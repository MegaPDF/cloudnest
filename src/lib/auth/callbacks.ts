import { CallbacksOptions } from 'next-auth';
import { JWT } from 'next-auth/jwt';
import { User } from '../database/models/user';
import { connectToDatabase } from '../database/connection';
import { STORAGE_LIMITS, SUBSCRIPTION_PLANS } from '../utils/constants';

export const authCallbacks: CallbacksOptions = {
  async signIn({ user, account, profile, email, credentials }) {
    try {
      await connectToDatabase();

      // For OAuth providers
      if (account?.provider === 'google') {
        const existingUser = await User.findByEmail(user.email!);
        
        if (existingUser) {
          // Update existing user with OAuth info if needed
          if (!existingUser.providerId && account.providerAccountId) {
            existingUser.providerId = account.providerAccountId;
            existingUser.provider = 'google';
            existingUser.isVerified = true;
            await existingUser.save();
          }
          return true;
        } else {
          // Create new user from OAuth
          const newUser = await User.createWithProvider({
            email: user.email!,
            name: user.name || user.email!.split('@')[0],
            provider: 'google',
            providerId: account.providerAccountId,
            avatar: user.image ?? undefined,
            isVerified: true,
            subscription: {
              plan: SUBSCRIPTION_PLANS.FREE,
              status: 'active'
            },
            storage: {
              used: 0,
              limit: STORAGE_LIMITS.FREE
            }
          });
          
          // Update user object with database ID
          user.id = newUser._id.toString();
          return true;
        }
      }

      // For credentials provider (email/password)
      if (account?.provider === 'credentials') {
        return true; // User already validated in authorize function
      }

      return true;
    } catch (error) {
      console.error('SignIn callback error:', error);
      return false;
    }
  },

  async jwt({ token, user, account, trigger, session }) {
    try {
      await connectToDatabase();

      // Initial sign in
      if (user && account) {
        const dbUser = await User.findByEmail(user.email!);
        if (dbUser) {
          token.id = dbUser._id.toString();
          token.role = dbUser.role;
          token.subscription = {
            plan: dbUser.subscription.plan,
            status: dbUser.subscription.status
          };
          token.storage = {
            used: dbUser.storage.used,
            limit: dbUser.storage.limit
          };
          token.preferences = dbUser.preferences;
          token.isVerified = dbUser.isVerified;
          token.lastLoginAt = new Date();

          // Update last login time
          dbUser.lastLoginAt = new Date();
          await dbUser.save();
        }
      }

      // Session update trigger (when session is updated on client)
      if (trigger === 'update' && session) {
        const dbUser = await User.findById(token.id);
        if (dbUser) {
          token.role = dbUser.role;
          token.subscription = {
            plan: dbUser.subscription.plan,
            status: dbUser.subscription.status
          };
          token.storage = {
            used: dbUser.storage.used,
            limit: dbUser.storage.limit
          };
          token.preferences = dbUser.preferences;
          token.isVerified = dbUser.isVerified;
        }
      }

      // Refresh user data periodically (every 5 minutes)
      if (token.lastRefresh && Date.now() - Number(token.lastRefresh) > 5 * 60 * 1000) {
        const dbUser = await User.findById(token.id);
        if (dbUser) {
          token.role = dbUser.role;
          token.subscription = {
            plan: dbUser.subscription.plan,
            status: dbUser.subscription.status
          };
          token.storage = {
            used: dbUser.storage.used,
            limit: dbUser.storage.limit
          };
          token.preferences = dbUser.preferences;
          token.isVerified = dbUser.isVerified;
          token.lastRefresh = Date.now();
        }
      }

      return token;
    } catch (error) {
      console.error('JWT callback error:', error);
      return token;
    }
  },

  async session({ session, token }) {
    try {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as 'user' | 'admin';
        session.user.subscription = token.subscription as {
          plan: 'free' | 'pro' | 'enterprise';
          status: 'active' | 'canceled' | 'past_due' | 'trialing';
        };
        session.user.storage = token.storage as {
          used: number;
          limit: number;
        };
        session.user.avatar = (token as any).avatar ?? session.user.avatar;
        
        // Add computed properties
        const storagePercentage = (session.user.storage.used / session.user.storage.limit) * 100;
        (session.user as any).storagePercentage = Math.round(storagePercentage);
        (session.user as any).isVerified = token.isVerified;
        (session.user as any).preferences = token.preferences;
      }

      return session;
    } catch (error) {
      console.error('Session callback error:', error);
      return session;
    }
  },

  async redirect({ url, baseUrl }) {
    // Handle post-authentication redirects
    try {
      const urlObj = new URL(url);
      
      // If it's a relative URL, prepend baseUrl
      if (url.startsWith('/')) {
        return `${baseUrl}${url}`;
      }
      
      // If it's the same domain, allow it
      if (urlObj.origin === baseUrl) {
        return url;
      }
      
      // Default redirect to dashboard
      return `${baseUrl}/dashboard`;
    } catch {
      // If URL parsing fails, redirect to dashboard
      return `${baseUrl}/dashboard`;
    }
  }
};

// Helper function to check if user needs to be refreshed
export function shouldRefreshUser(token: JWT): boolean {
  if (!token.lastRefresh) return true;
  const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
  return typeof token.lastRefresh === 'number' ? token.lastRefresh < fiveMinutesAgo : true;
}

// Helper function to update user session data
export async function updateUserSession(userId: string): Promise<Partial<JWT>> {
  try {
    await connectToDatabase();
    const user = await User.findById(userId);
    
    if (!user) {
      throw new Error('User not found');
    }

    return {
      role: user.role,
      subscription: {
        plan: user.subscription.plan,
        status: user.subscription.status
      },
      storage: {
        used: user.storage.used,
        limit: user.storage.limit
      },
      preferences: user.preferences,
      isVerified: user.isVerified,
      lastRefresh: Date.now()
    };
  } catch (error) {
    console.error('Error updating user session:', error);
    return {};
  }
}