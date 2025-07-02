import { NextAuthOptions } from 'next-auth';
import { MongoDBAdapter } from '@auth/mongodb-adapter';
import { MongoClient } from 'mongodb';
import { authCallbacks } from './callbacks';
import { authProviders } from './providers';
import { env } from '../config/env';

// MongoDB client for NextAuth adapter
const client = new MongoClient(env.MONGODB_URI);

export const authConfig: NextAuthOptions = {
  // Use MongoDB adapter for session storage
  adapter: MongoDBAdapter(client, {
    databaseName: 'cloudnest'
  }),

  // Configure authentication providers
  providers: authProviders,

  // Session configuration
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
    updateAge: 24 * 60 * 60, // 24 hours
  },

  // JWT configuration
  jwt: {
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },

  // Callback functions
  callbacks: authCallbacks,

  // Pages configuration (custom auth pages)
  pages: {
    signIn: '/login',
    error: '/login',
    verifyRequest: '/verify-email',
    newUser: '/dashboard' // Redirect new users to dashboard
  },

  // Events for logging and side effects
  events: {
    async signIn({ user, account, profile, isNewUser }) {
      console.log(`User signed in: ${user.email} via ${account?.provider}`);
      
      // Log successful sign-in (you can implement proper logging here)
      if (isNewUser) {
        console.log(`New user registered: ${user.email}`);
        // You could send welcome email, analytics events, etc.
      }
    },

    async signOut({ token, session }) {
      console.log(`User signed out: ${token?.email || session?.user?.email}`);
    },

    async createUser({ user }) {
      console.log(`New user created: ${user.email}`);
    },

    async updateUser({ user }) {
      console.log(`User updated: ${user.email}`);
    },

    async linkAccount({ user, account, profile }) {
      console.log(`Account linked: ${user.email} linked ${account.provider}`);
    },

    async session({ session, token }) {
      // Session accessed - could be used for analytics
      // Don't log this as it happens too frequently
    }
  },

  // Security settings
  useSecureCookies: process.env.NODE_ENV === 'production',
  
  // Cookie configuration
  cookies: {
    sessionToken: {
      name: 'cloudnest-session-token',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
      }
    },
    callbackUrl: {
      name: 'cloudnest-callback-url',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 15 * 60 * 1000 // 15 minutes
      }
    },
    csrfToken: {
      name: 'cloudnest-csrf-token',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 4 * 60 * 60 * 1000 // 4 hours
      }
    }
  },

  // Debug mode for development
  debug: process.env.NODE_ENV === 'development',

  // Custom logger
  logger: {
    error(code, metadata) {
      console.error(`NextAuth Error [${code}]:`, metadata);
    },
    warn(code) {
      console.warn(`NextAuth Warning [${code}]`);
    },
    debug(code, metadata) {
      if (process.env.NODE_ENV === 'development') {
        console.debug(`NextAuth Debug [${code}]:`, metadata);
      }
    }
  },

  // Theme configuration for auth pages
  theme: {
    colorScheme: 'auto',
    brandColor: '#3B82F6',
    logo: '/logo.png'
  }
};

// Export the configuration for use in API routes
export default authConfig;

// Helper function to get auth configuration with runtime overrides
export function getAuthConfig(overrides?: Partial<NextAuthOptions>): NextAuthOptions {
  return {
    ...authConfig,
    ...overrides
  };
}

// Type-safe session configuration (extend session in callbacks, not AdapterUser)
export interface AuthSession {
  user: {
    id: string;
    email: string;
    name: string;
    avatar?: string;
    // Custom fields like role, subscription, storage, etc. should be added to the session object via callbacks, not AdapterUser
  };
  expires: string;
}

// Configuration validation
export function validateAuthConfig(): boolean {
  const requiredEnvVars = ['MONGODB_URI', 'NEXTAUTH_SECRET'];
  const missing = requiredEnvVars.filter(envVar => !process.env[envVar]);
  
  if (missing.length > 0) {
    console.error('Missing required environment variables for auth:', missing);
    return false;
  }
  
  return true;
}