import { ObjectId } from "mongoose";
import { StorageSettings } from "./storage";
import { EmailSettings } from "./email";
import { SecuritySettings } from "./auth";
import { UserStats, UserStorage, UserSubscription } from "./user";
import { DateRange } from "./common";

export interface AdminDashboard {
  stats: AdminStats;
  recentActivity: AdminActivity[];
  systemHealth: SystemHealth;
  alerts: SystemAlert[];
}

export interface AdminStats {
  users: {
    total: number;
    active: number;
    newThisMonth: number;
    growthRate: number;
  };
  files: {
    total: number;
    totalSize: number;
    newThisMonth: number;
    storageGrowthRate: number;
  };
  subscriptions: {
    total: number;
    active: number;
    revenue: number;
    churnRate: number;
  };
  shares: {
    total: number;
    active: number;
    views: number;
    downloads: number;
  };
}

export interface AdminActivity {
  id: ObjectId;
  userId: ObjectId;
  action: string;
  resource: string;
  resourceId: ObjectId;
  details: string;
  timestamp: Date;
  ip: string;
  userAgent: string;
}

export interface SystemHealth {
  database: HealthStatus;
  storage: HealthStatus;
  email: HealthStatus;
  overall: HealthStatus;
  lastCheck: Date;
}

export interface HealthStatus {
  status: 'healthy' | 'warning' | 'critical';
  message: string;
  details: Record<string, any>;
}

export interface SystemAlert {
  id: ObjectId;
  type: 'info' | 'warning' | 'error' | 'critical';
  title: string;
  message: string;
  source: string;
  acknowledged: boolean;
  acknowledgedBy?: ObjectId;
  acknowledgedAt?: Date;
  createdAt: Date;
}

export interface AdminUser {
  id: ObjectId;
  email: string;
  name: string;
  role: 'user' | 'admin';
  isActive: boolean;
  subscription: UserSubscription;
  storage: UserStorage;
  stats: UserStats;
  lastLogin?: Date;
  createdAt: Date;
}

export interface UserManagement {
  users: AdminUser[];
  filters: UserFilter;
  actions: UserAction[];
}

export interface UserFilter {
  role?: 'user' | 'admin';
  subscription?: 'free' | 'pro' | 'enterprise';
  status?: 'active' | 'inactive';
  dateRange?: DateRange;
  search?: string;
}

export interface UserAction {
  id: string;
  label: string;
  icon: string;
  action: (users: ObjectId[]) => void;
  destructive?: boolean;
  requireConfirmation?: boolean;
}

export interface SystemSettings {
  app: AppSettings;
  features: FeatureSettings;
  limits: SystemLimits;
  storage: StorageSettings;
  email: EmailSettings;
  security: SecuritySettings;
  analytics: AnalyticsSettings;
  maintenance: MaintenanceSettings;
}

export interface AppSettings {
  name: string;
  description: string;
  logo?: string;
  favicon?: string;
  primaryColor: string;
  secondaryColor: string;
  version: string;
}

export interface FeatureSettings {
  registration: boolean;
  emailVerification: boolean;
  googleAuth: boolean;
  fileSharing: boolean;
  publicSharing: boolean;
  fileVersioning: boolean;
  trash: boolean;
  compression: boolean;
  encryption: boolean;
}

export interface SystemLimits {
  maxFileSize: number;
  maxFilesPerUpload: number;
  maxFolderDepth: number;
  maxSharesPerUser: number;
  sessionTimeout: number;
}

export interface AnalyticsSettings {
  enabled: boolean;
  provider?: string;
  trackingId?: string;
  anonymizeIp: boolean;
}

export interface MaintenanceSettings {
  enabled: boolean;
  message?: string;
  allowedIps: string[];
  scheduledStart?: Date;
  scheduledEnd?: Date;
}

export interface AuditLog {
  id: ObjectId;
  userId: ObjectId;
  action: string;
  resource: string;
  resourceId: ObjectId;
  changes: AuditChange[];
  metadata: Record<string, any>;
  ip: string;
  userAgent: string;
  timestamp: Date;
}

export interface AuditChange {
  field: string;
  oldValue: any;
  newValue: any;
}
