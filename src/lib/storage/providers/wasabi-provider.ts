import { S3Provider } from './s3-provider';

export class WasabiProvider extends S3Provider {
  constructor(config: any) {
    // Wasabi uses S3-compatible API with different endpoints
    const wasabiConfig = {
      ...config,
      config: {
        ...config.config,
        endpoint: config.config.endpoint || `https://s3.${config.config.region || 'us-east-1'}.wasabisys.com`
      }
    };

    super(wasabiConfig);
  }

  async testConnection(): Promise<any> {
    try {
      const health = await super.testConnection();
      return {
        ...health,
        version: 'Wasabi Hot Cloud Storage'
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