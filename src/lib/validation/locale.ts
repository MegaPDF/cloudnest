import { z } from 'zod';
import { languageSchema, currencySchema } from '../i18n/config';

// Update user preferences schema to include locale
export const userLocalePreferencesSchema = z.object({
  language: languageSchema.default('en'),
  currency: currencySchema.default('USD'),
  timezone: z.string().default('UTC'),
  dateFormat: z.enum(['MM/dd/yyyy', 'dd/MM/yyyy', 'yyyy-MM-dd']).optional(),
  numberFormat: z.enum(['en-US', 'id-ID']).optional()
});

// Translation management (admin)
export const translationSchema = z.object({
  key: z.string().min(1).max(200),
  namespace: z.string().min(1).max(50).default('common'),
  en: z.string().min(1),
  id: z.string().min(1),
  context: z.string().max(500).optional()
});

// Currency rate management
export const currencyRateSchema = z.object({
  fromCurrency: currencySchema,
  toCurrency: currencySchema,
  rate: z.number().min(0.000001),
  source: z.enum(['manual', 'api']).default('manual')
});

// Regional pricing
export const regionalPricingSchema = z.object({
  planId: z.string().min(1),
  currency: currencySchema,
  price: z.number().min(0),
  stripePriceId: z.string().optional()
});
