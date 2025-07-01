import { SupportedCurrency } from '@/lib/i18n/config';
import mongoose, { Schema } from 'mongoose';

// Update User model to include locale preferences
export const userLocaleSchema = new Schema({
  language: {
    type: String,
    enum: ['en', 'id'],
    default: 'en'
  },
  currency: {
    type: String,
    enum: ['USD', 'IDR'],
    default: 'USD'
  },
  timezone: {
    type: String,
    default: 'UTC'
  }
});

// Translation model for storing translations
export interface ITranslation extends mongoose.Document {
  key: string;
  namespace: string;
  en: string;
  id: string;
  context?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const translationSchema = new Schema<ITranslation>({
  key: {
    type: String,
    required: true,
    trim: true
  },
  namespace: {
    type: String,
    required: true,
    default: 'common'
  },
  en: {
    type: String,
    required: true
  },
  id: {
    type: String,
    required: true
  },
  context: String,
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Compound index for efficient queries
translationSchema.index({ namespace: 1, key: 1 }, { unique: true });

export const Translation = mongoose.models.Translation || mongoose.model<ITranslation>('Translation', translationSchema);

// Currency rate model for real-time conversion
export interface ICurrencyRate extends mongoose.Document {
  fromCurrency: SupportedCurrency;
  toCurrency: SupportedCurrency;
  rate: number;
  source: 'manual' | 'api';
  lastUpdated: Date;
  createdAt: Date;
  updatedAt: Date;
}

const currencyRateSchema = new Schema<ICurrencyRate>({
  fromCurrency: {
    type: String,
    enum: ['USD', 'IDR'],
    required: true
  },
  toCurrency: {
    type: String,
    enum: ['USD', 'IDR'],
    required: true
  },
  rate: {
    type: Number,
    required: true,
    min: 0
  },
  source: {
    type: String,
    enum: ['manual', 'api'],
    default: 'manual'
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

currencyRateSchema.index({ fromCurrency: 1, toCurrency: 1 }, { unique: true });

export const CurrencyRate = mongoose.models.CurrencyRate || mongoose.model<ICurrencyRate>('CurrencyRate', currencyRateSchema);
