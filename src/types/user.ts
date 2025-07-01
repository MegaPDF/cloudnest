import { ObjectId } from 'mongodb';
import { NotificationPreferences } from './common';

export interface User {
  id: ObjectId;
  email: string;
  name: string;
  avatar?: string;
  provider: 'email' | 'google';
  providerId?: string;
  role: 'user' | 'admin';
  isVerified: boolean;
  subscription: UserSubscription;
  storage: UserStorage;
  preferences: UserPreferences;
  lastLoginAt?: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserSubscription {
  plan: 'free' | 'pro' | 'enterprise';
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  status: 'active' | 'canceled' | 'past_due' | 'trialing';
  currentPeriodEnd?: Date;
}

export interface UserStorage {
  used: number;
  limit: number;
  usagePercentage: number;
}

export interface UserPreferences {
  theme: 'light' | 'dark' | 'system';
  language: string;
  notifications: NotificationPreferences;
  defaultView: 'grid' | 'list';
  itemsPerPage: number;
}

export interface UserProfile {
  name: string;
  email: string;
  avatar?: string;
  bio?: string;
  website?: string;
  location?: string;
}

export interface UserStats {
  totalFiles: number;
  totalFolders: number;
  totalShares: number;
  storageUsed: number;
  lastActivity?: Date;
}

export interface PasswordResetRequest {
  email: string;
  token: string;
  expiresAt: Date;
}

export interface EmailVerificationRequest {
  email: string;
  token: string;
  expiresAt: Date;
}

export interface UserActivity {
  id: ObjectId;
  userId: ObjectId;
  action: string;
  resource: string;
  resourceId: ObjectId;
  metadata?: Record<string, any>;
  timestamp: Date;
}

export interface UserInvitation {
  id: ObjectId;
  email: string;
  invitedBy: ObjectId;
  role: 'user' | 'admin';
  token: string;
  expiresAt: Date;
  acceptedAt?: Date;
  status: 'pending' | 'accepted' | 'expired';
}
