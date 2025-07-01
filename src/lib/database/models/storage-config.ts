import mongoose, { Document, Schema, Model } from 'mongoose';

export interface IStorageConfig extends Document {
  _id: mongoose.Types.ObjectId;
  provider: 'aws' | 'cloudflare' | 'wasabi' | 'gridfs';
  name: string;
  isActive: boolean;
  isDefault: boolean;
  config: {
    // AWS S3 / Wasabi
    accessKeyId?: string;
    secretAccessKey?: string;
    region?: string;
    bucket?: string;
    endpoint?: string;
    // Cloudflare R2
    accountId?: string;
    // GridFS (MongoDB)
    database?: string;
    // Common
    maxFileSize?: number;
    allowedMimeTypes?: string[];
  };
  settings: {
    uploadTimeout: number;
    retryAttempts: number;
    chunkSize: number;
    enableCompression: boolean;
    enableEncryption: boolean;
  };
  stats: {
    totalFiles: number;
    totalSize: number;
    lastUsed?: Date;
    errorCount: number;
  };
  isHealthy: boolean;
  lastHealthCheck?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface IStorageConfigMethods {
  testConnection(): Promise<boolean>;
  updateStats(files: number, size: number): Promise<void>;
  markUnhealthy(error: string): Promise<void>;
  markHealthy(): Promise<void>;
  getCredentials(): Record<string, any>;
}

export interface StorageConfigModel extends Model<IStorageConfig, {}, IStorageConfigMethods> {
  getActiveProviders(): Promise<IStorageConfig[]>;
  getDefaultProvider(): Promise<IStorageConfig | null>;
  setDefault(id: mongoose.Types.ObjectId): Promise<void>;
  findByProvider(provider: string): Promise<IStorageConfig[]>;
}

const storageConfigSchema = new Schema<IStorageConfig, StorageConfigModel, IStorageConfigMethods>({
  provider: {
    type: String,
    enum: ['aws', 'cloudflare', 'wasabi', 'gridfs'],
    required: true
  },
  name: {
    type: String,
    required: [true, 'Storage configuration name is required'],
    trim: true,
    maxlength: [100, 'Name cannot exceed 100 characters']
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isDefault: {
    type: Boolean,
    default: false
  },
  config: {
    accessKeyId: {
      type: String,
      select: false
    },
    secretAccessKey: {
      type: String,
      select: false
    },
    region: String,
    bucket: String,
    endpoint: String,
    accountId: String,
    database: String,
    maxFileSize: {
      type: Number,
      default: 100 * 1024 * 1024 // 100MB
    },
    allowedMimeTypes: [String]
  },
  settings: {
    uploadTimeout: {
      type: Number,
      default: 30000 // 30 seconds
    },
    retryAttempts: {
      type: Number,
      default: 3
    },
    chunkSize: {
      type: Number,
      default: 5 * 1024 * 1024 // 5MB
    },
    enableCompression: {
      type: Boolean,
      default: false
    },
    enableEncryption: {
      type: Boolean,
      default: false
    }
  },
  stats: {
    totalFiles: {
      type: Number,
      default: 0,
      min: 0
    },
    totalSize: {
      type: Number,
      default: 0,
      min: 0
    },
    lastUsed: Date,
    errorCount: {
      type: Number,
      default: 0,
      min: 0
    }
  },
  isHealthy: {
    type: Boolean,
    default: true
  },
  lastHealthCheck: Date
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
storageConfigSchema.index({ provider: 1, isActive: 1 });
storageConfigSchema.index({ isDefault: 1 });
storageConfigSchema.index({ isHealthy: 1 });

// Pre-save middleware to ensure only one default
storageConfigSchema.pre('save', async function(next) {
  if (this.isDefault && this.isModified('isDefault')) {
    await (this.constructor as StorageConfigModel).updateMany(
      { _id: { $ne: this._id } },
      { isDefault: false }
    );
  }
  next();
});

// Instance methods
storageConfigSchema.methods.testConnection = async function(): Promise<boolean> {
  try {
    // Implementation would depend on the provider
    // This is a placeholder that would test actual connectivity
    this.lastHealthCheck = new Date();
    this.isHealthy = true;
    await this.save();
    return true;
  } catch (error) {
    this.isHealthy = false;
    this.stats.errorCount += 1;
    await this.save();
    return false;
  }
};

storageConfigSchema.methods.updateStats = async function(files: number, size: number): Promise<void> {
  this.stats.totalFiles += files;
  this.stats.totalSize += size;
  this.stats.lastUsed = new Date();
  await this.save();
};

storageConfigSchema.methods.markUnhealthy = async function(error: string): Promise<void> {
  this.isHealthy = false;
  this.stats.errorCount += 1;
  this.lastHealthCheck = new Date();
  await this.save();
};

storageConfigSchema.methods.markHealthy = async function(): Promise<void> {
  this.isHealthy = true;
  this.lastHealthCheck = new Date();
  await this.save();
};

storageConfigSchema.methods.getCredentials = function(): Record<string, any> {
  const credentials: Record<string, any> = {};
  
  if (this.config.accessKeyId) credentials.accessKeyId = this.config.accessKeyId;
  if (this.config.secretAccessKey) credentials.secretAccessKey = this.config.secretAccessKey;
  if (this.config.region) credentials.region = this.config.region;
  if (this.config.bucket) credentials.bucket = this.config.bucket;
  if (this.config.endpoint) credentials.endpoint = this.config.endpoint;
  if (this.config.accountId) credentials.accountId = this.config.accountId;
  
  return credentials;
};

// Static methods
storageConfigSchema.statics.getActiveProviders = function() {
  return this.find({ isActive: true, isHealthy: true }).sort('name');
};

storageConfigSchema.statics.getDefaultProvider = function() {
  return this.findOne({ isDefault: true, isActive: true, isHealthy: true });
};

storageConfigSchema.statics.setDefault = async function(id: mongoose.Types.ObjectId) {
  await this.updateMany({}, { isDefault: false });
  await this.findByIdAndUpdate(id, { isDefault: true });
};

storageConfigSchema.statics.findByProvider = function(provider: string) {
  return this.find({ provider, isActive: true }).sort('name');
};

export const StorageConfig = (mongoose.models.StorageConfig as StorageConfigModel) || mongoose.model<IStorageConfig, StorageConfigModel>('StorageConfig', storageConfigSchema);
