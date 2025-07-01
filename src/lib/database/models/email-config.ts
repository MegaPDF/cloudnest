import mongoose, { Document, Schema, Model } from 'mongoose';

export interface IEmailConfig extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  provider: 'smtp' | 'sendgrid' | 'mailgun' | 'ses';
  isActive: boolean;
  isDefault: boolean;
  config: {
    // SMTP
    host?: string;
    port?: number;
    secure?: boolean;
    username?: string;
    password?: string;
    // SendGrid
    apiKey?: string;
    // Mailgun
    domain?: string;
    // SES
    region?: string;
    accessKeyId?: string;
    secretAccessKey?: string;
  };
  settings: {
    fromEmail: string;
    fromName: string;
    replyTo?: string;
    timeout: number;
    retryAttempts: number;
    enableTracking: boolean;
  };
  templates: {
    welcome: boolean;
    passwordReset: boolean;
    fileShared: boolean;
    storageQuota: boolean;
    subscription: boolean;
  };
  stats: {
    emailsSent: number;
    emailsFailed: number;
    lastUsed?: Date;
  };
  isHealthy: boolean;
  lastHealthCheck?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface IEmailConfigMethods {
  testConnection(): Promise<boolean>;
  sendTestEmail(to: string): Promise<boolean>;
  updateStats(sent: number, failed: number): Promise<void>;
  markUnhealthy(error: string): Promise<void>;
  markHealthy(): Promise<void>;
}

export interface EmailConfigModel extends Model<IEmailConfig, {}, IEmailConfigMethods> {
  getDefaultProvider(): Promise<IEmailConfig | null>;
  setDefault(id: mongoose.Types.ObjectId): Promise<void>;
  findByProvider(provider: string): Promise<IEmailConfig[]>;
}

const emailConfigSchema = new Schema<IEmailConfig, EmailConfigModel, IEmailConfigMethods>({
  name: {
    type: String,
    required: [true, 'Email configuration name is required'],
    trim: true,
    maxlength: [100, 'Name cannot exceed 100 characters']
  },
  provider: {
    type: String,
    enum: ['smtp', 'sendgrid', 'mailgun', 'ses'],
    required: true
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
    host: String,
    port: {
      type: Number,
      min: 1,
      max: 65535
    },
    secure: {
      type: Boolean,
      default: true
    },
    username: {
      type: String,
      select: false
    },
    password: {
      type: String,
      select: false
    },
    apiKey: {
      type: String,
      select: false
    },
    domain: String,
    region: String,
    accessKeyId: {
      type: String,
      select: false
    },
    secretAccessKey: {
      type: String,
      select: false
    }
  },
  settings: {
    fromEmail: {
      type: String,
      required: [true, 'From email is required'],
      validate: {
        validator: function(email: string) {
          return /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/.test(email);
        },
        message: 'Please enter a valid email address'
      }
    },
    fromName: {
      type: String,
      required: [true, 'From name is required'],
      trim: true
    },
    replyTo: {
      type: String,
      validate: {
        validator: function(email: string) {
          return !email || /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/.test(email);
        },
        message: 'Please enter a valid reply-to email address'
      }
    },
    timeout: {
      type: Number,
      default: 30000,
      min: 1000
    },
    retryAttempts: {
      type: Number,
      default: 3,
      min: 0,
      max: 10
    },
    enableTracking: {
      type: Boolean,
      default: true
    }
  },
  templates: {
    welcome: {
      type: Boolean,
      default: true
    },
    passwordReset: {
      type: Boolean,
      default: true
    },
    fileShared: {
      type: Boolean,
      default: true
    },
    storageQuota: {
      type: Boolean,
      default: true
    },
    subscription: {
      type: Boolean,
      default: true
    }
  },
  stats: {
    emailsSent: {
      type: Number,
      default: 0,
      min: 0
    },
    emailsFailed: {
      type: Number,
      default: 0,
      min: 0
    },
    lastUsed: Date
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
emailConfigSchema.index({ provider: 1, isActive: 1 });
emailConfigSchema.index({ isDefault: 1 });
emailConfigSchema.index({ isHealthy: 1 });

// Virtual for success rate
emailConfigSchema.virtual('successRate').get(function() {
  const total = this.stats.emailsSent + this.stats.emailsFailed;
  return total > 0 ? (this.stats.emailsSent / total) * 100 : 0;
});

// Pre-save middleware to ensure only one default
emailConfigSchema.pre('save', async function(next) {
  if (this.isDefault && this.isModified('isDefault')) {
    await (this.constructor as EmailConfigModel).updateMany(
      { _id: { $ne: this._id } },
      { isDefault: false }
    );
  }
  next();
});

// Instance methods
emailConfigSchema.methods.testConnection = async function(): Promise<boolean> {
  try {
    // Implementation would test actual email connectivity
    // This is a placeholder
    this.lastHealthCheck = new Date();
    this.isHealthy = true;
    await this.save();
    return true;
  } catch (error) {
    this.isHealthy = false;
    await this.save();
    return false;
  }
};

emailConfigSchema.methods.sendTestEmail = async function(to: string): Promise<boolean> {
  try {
    // Implementation would send actual test email
    // This is a placeholder
    this.stats.emailsSent += 1;
    this.stats.lastUsed = new Date();
    await this.save();
    return true;
  } catch (error) {
    this.stats.emailsFailed += 1;
    await this.save();
    return false;
  }
};

emailConfigSchema.methods.updateStats = async function(sent: number, failed: number): Promise<void> {
  this.stats.emailsSent += sent;
  this.stats.emailsFailed += failed;
  this.stats.lastUsed = new Date();
  await this.save();
};

emailConfigSchema.methods.markUnhealthy = async function(error: string): Promise<void> {
  this.isHealthy = false;
  this.lastHealthCheck = new Date();
  await this.save();
};

emailConfigSchema.methods.markHealthy = async function(): Promise<void> {
  this.isHealthy = true;
  this.lastHealthCheck = new Date();
  await this.save();
};

// Static methods
emailConfigSchema.statics.getDefaultProvider = function() {
  return this.findOne({ isDefault: true, isActive: true, isHealthy: true });
};

emailConfigSchema.statics.setDefault = async function(id: mongoose.Types.ObjectId) {
  await this.updateMany({}, { isDefault: false });
  await this.findByIdAndUpdate(id, { isDefault: true });
};

emailConfigSchema.statics.findByProvider = function(provider: string) {
  return this.find({ provider, isActive: true }).sort('name');
};

export const EmailConfig = (mongoose.models.EmailConfig as EmailConfigModel) || mongoose.model<IEmailConfig, EmailConfigModel>('EmailConfig', emailConfigSchema);
