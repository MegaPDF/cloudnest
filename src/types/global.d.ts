import { MongoClient } from 'mongodb';
import { NextAuth } from 'next-auth';

declare global {
  var mongooseCache: {
    conn: typeof import('mongoose') | null;
    promise: Promise<typeof import('mongoose')> | null;
  } | undefined;

  namespace NodeJS {
    interface ProcessEnv {
      // Database
      MONGODB_URI: string;
      
      // NextAuth
      NEXTAUTH_SECRET: string;
      NEXTAUTH_URL?: string;
      
      // Google OAuth
      GOOGLE_CLIENT_ID?: string;
      GOOGLE_CLIENT_SECRET?: string;
      
      // Storage Providers
      AWS_ACCESS_KEY_ID?: string;
      AWS_SECRET_ACCESS_KEY?: string;
      AWS_REGION?: string;
      AWS_BUCKET?: string;
      
      CLOUDFLARE_ACCOUNT_ID?: string;
      CLOUDFLARE_ACCESS_KEY_ID?: string;
      CLOUDFLARE_SECRET_ACCESS_KEY?: string;
      CLOUDFLARE_BUCKET?: string;
      
      WASABI_ACCESS_KEY_ID?: string;
      WASABI_SECRET_ACCESS_KEY?: string;
      WASABI_REGION?: string;
      WASABI_BUCKET?: string;
      WASABI_ENDPOINT?: string;
      
      // Stripe
      STRIPE_SECRET_KEY?: string;
      STRIPE_PUBLISHABLE_KEY?: string;
      STRIPE_WEBHOOK_SECRET?: string;
      
      // Email
      SMTP_HOST?: string;
      SMTP_PORT?: string;
      SMTP_USER?: string;
      SMTP_PASS?: string;
      SMTP_FROM?: string;
      SMTP_SECURE?: string;
      
      // App
      NODE_ENV: 'development' | 'production' | 'test';
      PORT?: string;
    }
  }
}

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      avatar?: string;
      role: 'user' | 'admin';
      subscription: {
        plan: 'free' | 'pro' | 'enterprise';
        status: 'active' | 'canceled' | 'past_due' | 'trialing';
      };
      storage: {
        used: number;
        limit: number;
      };
    };
  }

  interface User {
    id: string;
    email: string;
    name: string;
    avatar?: string;
    role: 'user' | 'admin';
    subscription: {
      plan: 'free' | 'pro' | 'enterprise';
      status: 'active' | 'canceled' | 'past_due' | 'trialing';
    };
    storage: {
      used: number;
      limit: number;
    };
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    role: 'user' | 'admin';
    subscription: {
      plan: 'free' | 'pro' | 'enterprise';
      status: 'active' | 'canceled' | 'past_due' | 'trialing';
    };
  }
}

export {};
