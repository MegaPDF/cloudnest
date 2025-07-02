// src/lib/config/database.ts
import { env } from './env';

export interface DatabaseConfig {
  mongodb: {
    uri: string;
    options: {
      maxPoolSize: number;
      serverSelectionTimeoutMS: number;
      socketTimeoutMS: number;
      family: number;
      retryWrites: boolean;
      w: string | number;
      bufferCommands: boolean;
      maxBufferTime: number;
      minPoolSize: number;
      maxIdleTimeMS: number;
      heartbeatFrequencyMS: number;
    };
  };
  gridfs: {
    bucketName: string;
    chunkSizeBytes: number;
    enableSharding: boolean;
    indexes: boolean;
  };
  indexes: {
    autoCreate: boolean;
    background: boolean;
  };
  monitoring: {
    enableProfiling: boolean;
    slowOpThresholdMs: number;
    logQueries: boolean;
  };
  backup: {
    enabled: boolean;
    schedule: string; // cron expression
    retention: {
      daily: number;
      weekly: number;
      monthly: number;
    };
  };
}

export const databaseConfig: DatabaseConfig = {
  mongodb: {
    uri: env.MONGODB_URI,
    options: {
      maxPoolSize: parseInt(process.env.DB_MAX_POOL_SIZE || '10'),
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      family: 4, // Use IPv4, skip trying IPv6
      retryWrites: true,
      w: 'majority',
      bufferCommands: false,
      maxBufferTime: 20000,
      minPoolSize: 2,
      maxIdleTimeMS: 30000,
      heartbeatFrequencyMS: 10000,
    },
  },
  gridfs: {
    bucketName: 'files',
    chunkSizeBytes: 255 * 1024, // 255KB chunks
    enableSharding: env.NODE_ENV === 'production',
    indexes: true,
  },
  indexes: {
    autoCreate: env.NODE_ENV !== 'production',
    background: true,
  },
  monitoring: {
    enableProfiling: env.NODE_ENV === 'development',
    slowOpThresholdMs: 1000,
    logQueries: env.NODE_ENV === 'development',
  },
  backup: {
    enabled: env.NODE_ENV === 'production',
    schedule: '0 2 * * *', // Daily at 2 AM
    retention: {
      daily: 7,
      weekly: 4,
      monthly: 12,
    },
  },
};

// Database connection retry configuration
export const connectionRetryConfig = {
  maxRetries: 5,
  retryDelayMs: 5000,
  exponentialBackoff: true,
  maxRetryDelayMs: 30000,
};

// Collection-specific configurations
export const collectionConfigs = {
  users: {
    name: 'users',
    indexes: [
      { email: 1 },
      { providerId: 1, provider: 1 },
      { 'subscription.stripeCustomerId': 1 },
      { createdAt: -1 },
      { role: 1, isActive: 1 },
    ],
  },
  files: {
    name: 'files',
    indexes: [
      { owner: 1, isDeleted: 1 },
      { folder: 1, isDeleted: 1 },
      { hash: 1 },
      { name: 'text', description: 'text', tags: 'text' },
      { mimeType: 1 },
      { createdAt: -1 },
      { 'access.lastAccessedAt': -1 },
      { storageProvider: 1, storageKey: 1 },
    ],
  },
  folders: {
    name: 'folders',
    indexes: [
      { owner: 1, parent: 1, isDeleted: 1 },
      { path: 1, owner: 1 },
      { name: 'text', description: 'text' },
      { createdAt: -1 },
    ],
  },
  shares: {
    name: 'shares',
    indexes: [
      { shareToken: 1, isActive: 1 },
      { resourceId: 1, type: 1 },
      { owner: 1, isActive: 1 },
      { 'settings.expiresAt': 1 },
      { createdAt: -1 },
    ],
  },
  subscriptions: {
    name: 'subscriptions',
    indexes: [
      { user: 1, status: 1 },
      { stripeSubscriptionId: 1 },
      { currentPeriodEnd: 1, status: 1 },
      { createdAt: -1 },
    ],
  },
  storageConfigs: {
    name: 'storageconfigs',
    indexes: [
      { provider: 1, isActive: 1 },
      { isDefault: 1 },
      { isHealthy: 1 },
    ],
  },
  emailConfigs: {
    name: 'emailconfigs',
    indexes: [
      { provider: 1, isActive: 1 },
      { isDefault: 1 },
      { isHealthy: 1 },
    ],
  },
  systemSettings: {
    name: 'systemsettings',
    indexes: [
      {},
    ],
  },
};

// Database health check configuration
export const healthCheckConfig = {
  timeout: 5000,
  interval: 30000, // Check every 30 seconds
  retries: 3,
  operations: [
    'ping',
    'listCollections',
    'serverStatus',
  ],
};

// Migration configuration
export const migrationConfig = {
  migrationsDir: 'src/lib/database/migrations',
  migrationCollection: 'migrations',
  autoRun: env.NODE_ENV === 'development',
  lockTimeout: 600000, // 10 minutes
};

export default databaseConfig;