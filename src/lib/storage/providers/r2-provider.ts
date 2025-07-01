import { S3Client } from '@aws-sdk/client-s3';
import { S3Provider } from './s3-provider';

export class R2Provider extends S3Provider {
  constructor(config: any) {
    // Cloudflare R2 uses S3-compatible API
    const r2Config = {
      ...config,
      config: {
        ...config.config,
        endpoint: config.config.endpoint || `https://${config.config.accountId}.r2.cloudflarestorage.com`,
        region: 'auto' // R2 uses 'auto' region
      }
    };

    super(r2Config);
  }

  async testConnection(): Promise<any> {
    try {
      const health = await super.testConnection();
      return {
        ...health,
        version: 'Cloudflare R2'
      };
    } catch (error) {
      return {
        isHealthy: false,
        latency: -1,
        lastCheck: new Date(),
        errors: [(error as Error).message]
      };
    }
  }
}