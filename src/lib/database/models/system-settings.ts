import mongoose, { Document, Schema, Model } from 'mongoose';

export interface ISystemSettings extends Document {
  _id: mongoose.Types.ObjectId;
  app: {
    name: string;
    description: string;
    logo?: string;
    favicon?: string;
    primaryColor: string;
    secondaryColor: string;
    version: string;
  };
  features: {
    registration: boolean;
    emailVerification: boolean;
    googleAuth: boolean;
    fileSharing: boolean;
    publicSharing: boolean;
    fileVersioning: boolean;
    trash: boolean;
    compression: boolean;
    encryption: boolean;
  };
  limits: {
    maxFileSize: number;
    maxFilesPerUpload: number;
    maxFolderDepth: number;
    maxSharesPerUser: number;
    sessionTimeout: number;
  };
  storage: {
    defaultProvider: string;
    autoCleanup: boolean;
    cleanupDays: number;
    backupEnabled: boolean;
    backupInterval: number;
  };
  email: {
    enabled: boolean;
    defaultProvider: string;
    templates: {
      branding: boolean;
      customFooter?: string;
      customHeader?: string;
    };
  };
  security: {
    passwordMinLength: number;
    passwordRequireUppercase: boolean;
    passwordRequireNumbers: boolean;
    passwordRequireSymbols: boolean;
    sessionTimeout: number;
    maxLoginAttempts: number;
    lockoutDuration: number;
    enableTwoFactor: boolean;
  };
  analytics: {
    enabled: boolean;
    provider?: string;
    trackingId?: string;
    anonymizeIp: boolean;
  };
  maintenance: {
    enabled: boolean;
    message?: string;
    allowedIps: string[];
    scheduledStart?: Date;
    scheduledEnd?: Date;
  };
  notifications: {
    webhook?: {
      url: string;
      events: string[];
      enabled: boolean;
    };
    slack?: {
      webhookUrl: string;
      channel: string;
      enabled: boolean;
    };
  };
  updatedBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface ISystemSettingsMethods {
  isMaintenanceMode(): boolean;
  isFeatureEnabled(feature: string): boolean;
  canUpload(fileSize: number): boolean;
  getAppConfig(): Record<string, any>;
}

export interface SystemSettingsModel extends Model<ISystemSettings, {}, ISystemSettingsMethods> {
  getInstance(): Promise<ISystemSettings>;
  updateSettings(data: Partial<ISystemSettings>, userId: mongoose.Types.ObjectId): Promise<ISystemSettings>;
}

const systemSettingsSchema = new Schema<ISystemSettings, SystemSettingsModel, ISystemSettingsMethods>({
  app: {
    name: {
      type: String,
      default: 'CloudNest',
      trim: true,
      maxlength: [50, 'App name cannot exceed 50 characters']
    },
    description: {
      type: String,
      default: 'Secure cloud storage and file management',
      trim: true,
      maxlength: [200, 'Description cannot exceed 200 characters']
    },
    logo: String,
    favicon: String,
    primaryColor: {
      type: String,
      default: '#3B82F6',
      match: /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/
    },
    secondaryColor: {
      type: String,
      default: '#1E40AF',
      match: /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/
    },
    version: {
      type: String,
      default: '1.0.0'
    }
  },
  features: {
    registration: {
      type: Boolean,
      default: true
    },
    emailVerification: {
      type: Boolean,
      default: true
    },
    googleAuth: {
      type: Boolean,
      default: true
    },
    fileSharing: {
      type: Boolean,
      default: true
    },
    publicSharing: {
      type: Boolean,
      default: true
    },
    fileVersioning: {
      type: Boolean,
      default: true
    },
    trash: {
      type: Boolean,
      default: true
    },
    compression: {
      type: Boolean,
      default: false
    },
    encryption: {
      type: Boolean,
      default: false
    }
  },
  limits: {
    maxFileSize: {
      type: Number,
      default: 100 * 1024 * 1024, // 100MB
      min: 1024 // 1KB minimum
    },
    maxFilesPerUpload: {
      type: Number,
      default: 10,
      min: 1,
      max: 100
    },
    maxFolderDepth: {
      type: Number,
      default: 10,
      min: 1,
      max: 50
    },
    maxSharesPerUser: {
      type: Number,
      default: 100,
      min: 1
    },
    sessionTimeout: {
      type: Number,
      default: 24 * 60 * 60 * 1000, // 24 hours in milliseconds
      min: 60 * 1000 // 1 minute minimum
    }
  },
  storage: {
    defaultProvider: {
      type: String,
      enum: ['aws', 'cloudflare', 'wasabi', 'gridfs'],
      default: 'gridfs'
    },
    autoCleanup: {
      type: Boolean,
      default: true
    },
    cleanupDays: {
      type: Number,
      default: 30,
      min: 1
    },
    backupEnabled: {
      type: Boolean,
      default: false
    },
    backupInterval: {
      type: Number,
      default: 24, // hours
      min: 1
    }
  },
  email: {
    enabled: {
      type: Boolean,
      default: true
    },
    defaultProvider: {
      type: String,
      enum: ['smtp', 'sendgrid', 'mailgun', 'ses'],
      default: 'smtp'
    },
    templates: {
      branding: {
        type: Boolean,
        default: true
      },
      customFooter: String,
      customHeader: String
    }
  },
  security: {
    passwordMinLength: {
      type: Number,
      default: 6,
      min: 4,
      max: 50
    },
    passwordRequireUppercase: {
      type: Boolean,
      default: false
    },
    passwordRequireNumbers: {
      type: Boolean,
      default: false
    },
    passwordRequireSymbols: {
      type: Boolean,
      default: false
    },
    sessionTimeout: {
      type: Number,
      default: 24 * 60 * 60 * 1000, // 24 hours
      min: 15 * 60 * 1000 // 15 minutes minimum
    },
    maxLoginAttempts: {
      type: Number,
      default: 5,
      min: 3,
      max: 10
    },
    lockoutDuration: {
      type: Number,
      default: 15 * 60 * 1000, // 15 minutes
      min: 60 * 1000 // 1 minute minimum
    },
    enableTwoFactor: {
      type: Boolean,
      default: false
    }
  },
  analytics: {
    enabled: {
      type: Boolean,
      default: false
    },
    provider: String,
    trackingId: String,
    anonymizeIp: {
      type: Boolean,
      default: true
    }
  },
  maintenance: {
    enabled: {
      type: Boolean,
      default: false
    },
    message: {
      type: String,
      default: 'System is under maintenance. Please try again later.'
    },
    allowedIps: [String],
    scheduledStart: Date,
    scheduledEnd: Date
  },
  notifications: {
    webhook: {
      url: String,
      events: [String],
      enabled: {
        type: Boolean,
        default: false
      }
    },
    slack: {
      webhookUrl: String,
      channel: String,
      enabled: {
        type: Boolean,
        default: false
      }
    }
  },
  updatedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Ensure only one settings document exists
systemSettingsSchema.index({}, { unique: true });

// Instance methods
systemSettingsSchema.methods.isMaintenanceMode = function(): boolean {
  if (!this.maintenance.enabled) return false;
  
  const now = new Date();
  if (this.maintenance.scheduledStart && this.maintenance.scheduledEnd) {
    return now >= this.maintenance.scheduledStart && now <= this.maintenance.scheduledEnd;
  }
  
  return this.maintenance.enabled;
};

systemSettingsSchema.methods.isFeatureEnabled = function(feature: string): boolean {
  return this.features[feature] === true;
};

systemSettingsSchema.methods.canUpload = function(fileSize: number): boolean {
  return fileSize <= this.limits.maxFileSize;
};

systemSettingsSchema.methods.getAppConfig = function(): Record<string, any> {
  return {
    name: this.app.name,
    description: this.app.description,
    logo: this.app.logo,
    primaryColor: this.app.primaryColor,
    secondaryColor: this.app.secondaryColor,
    version: this.app.version,
    features: this.features
  };
};

// Static methods
systemSettingsSchema.statics.getInstance = async function(): Promise<ISystemSettings> {
  let settings = await this.findOne();
  
  if (!settings) {
    // Create default settings if none exist
    const defaultUser = await mongoose.model('User').findOne({ role: 'admin' });
    settings = await this.create({
      updatedBy: defaultUser?._id || new mongoose.Types.ObjectId()
    });
  }
  
  return settings;
};

systemSettingsSchema.statics.updateSettings = async function(
  data: Partial<ISystemSettings>, 
  userId: mongoose.Types.ObjectId
): Promise<ISystemSettings> {
  const settings = await this.getInstance();
  
  Object.assign(settings, data);
  settings.updatedBy = userId;
  
  return settings.save();
};

export const SystemSettings = (mongoose.models.SystemSettings as SystemSettingsModel) || mongoose.model<ISystemSettings, SystemSettingsModel>('SystemSettings', systemSettingsSchema);
