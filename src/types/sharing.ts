import { ObjectId } from "mongoose";

export interface Share {
  id: ObjectId;
  type: 'file' | 'folder';
  resourceId: ObjectId;
  owner: ObjectId;
  shareToken: string;
  shareUrl: string;
  permissions: SharePermissions;
  access: ShareAccess;
  settings: ShareSettings;
  stats: ShareStats;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface SharePermissions {
  canView: boolean;
  canDownload: boolean;
  canEdit: boolean;
  canShare: boolean;
  canComment: boolean;
}

export interface ShareAccess {
  type: 'public' | 'restricted' | 'password';
  password?: string;
  allowedEmails?: string[];
  domains?: string[];
}

export interface ShareSettings {
  expiresAt?: Date;
  downloadLimit?: number;
  viewLimit?: number;
  requireSignIn: boolean;
  allowComments: boolean;
  trackAccess: boolean;
  customMessage?: string;
}

export interface ShareStats {
  views: number;
  downloads: number;
  uniqueVisitors: number;
  lastAccessedAt?: Date;
  accessHistory: ShareAccessLog[];
}

export interface ShareAccessLog {
  ip: string;
  userAgent: string;
  accessedAt: Date;
  action: 'view' | 'download' | 'comment';
  userId?: ObjectId;
  location?: string;
}

export interface ShareCreate {
  type: 'file' | 'folder';
  resourceId: ObjectId;
  permissions: Partial<SharePermissions>;
  access: Partial<ShareAccess>;
  settings: Partial<ShareSettings>;
}

export interface ShareUpdate {
  permissions?: Partial<SharePermissions>;
  access?: Partial<ShareAccess>;
  settings?: Partial<ShareSettings>;
  isActive?: boolean;
}

export interface SharePublic {
  id: ObjectId;
  name: string;
  type: 'file' | 'folder';
  size?: number;
  mimeType?: string;
  thumbnail?: string;
  permissions: SharePermissions;
  settings: ShareSettings;
  owner: {
    name: string;
    avatar?: string;
  };
  createdAt: Date;
}

export interface ShareNotification {
  id: ObjectId;
  shareId: ObjectId;
  recipientEmail: string;
  message?: string;
  sentAt: Date;
  status: 'pending' | 'sent' | 'failed';
}

export interface ShareComment {
  id: ObjectId;
  shareId: ObjectId;
  userId?: ObjectId;
  author: string;
  content: string;
  timestamp: Date;
  isAnonymous: boolean;
}

export interface ShareAnalytics {
  totalShares: number;
  activeShares: number;
  totalViews: number;
  totalDownloads: number;
  topShares: Share[];
  recentActivity: ShareAccessLog[];
}