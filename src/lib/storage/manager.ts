
import { DEFAULT_STORAGE_CONFIG } from './config';
import { 
  StorageConfig, 
  StorageProvider, 
  UploadOptions, 
  UploadResult,
  DownloadOptions,
  DownloadResult,
  DeleteOptions,
  CopyOptions,
  StorageStats,
  StorageHealth
} from './types';
import { STORAGE_PROVIDERS } from '../utils/constants';
import { BaseStorageProvider } from './providers/base-provider';
import { S3Provider } from './providers/s3-provider';
import { R2Provider } from './providers/r2-provider';
import { WasabiProvider } from './providers/wasabi-provider';
import { GridFSProvider } from './providers/gridfs-provider';

// Storage Configuration Manager (moved here to avoid circular imports)
class StorageConfigManager {
  private configs: Map<string, StorageConfig> = new Map();

  addConfig(id: string, config: StorageConfig): void {
    this.configs.set(id, { ...DEFAULT_STORAGE_CONFIG, ...config });
  }

  getConfig(id: string): StorageConfig | null {
    return this.configs.get(id) || null;
  }

  updateConfig(id: string, updates: Partial<StorageConfig>): void {
    const existing = this.configs.get(id);
    if (existing) {
      this.configs.set(id, { ...existing, ...updates });
    }
  }

  removeConfig(id: string): void {
    this.configs.delete(id);
  }

  listConfigs(): Array<{ id: string; config: StorageConfig }> {
    return Array.from(this.configs.entries()).map(([id, config]) => ({ id, config }));
  }

  getDefaultConfig(): { id: string; config: StorageConfig } | null {
    for (const [id, config] of this.configs.entries()) {
      if (config.isDefault && config.isActive) {
        return { id, config };
      }
    }
    return null;
  }

  setDefault(id: string): void {
    // Remove default from all configs
    for (const config of this.configs.values()) {
      config.isDefault = false;
    }

    // Set new default
    const config = this.configs.get(id);
    if (config) {
      config.isDefault = true;
    }
  }

  getActiveConfigs(): Array<{ id: string; config: StorageConfig }> {
    return this.listConfigs().filter(({ config }) => config.isActive);
  }

  getConfigsByProvider(provider: StorageProvider): Array<{ id: string; config: StorageConfig }> {
    return this.listConfigs().filter(({ config }) => config.provider === provider);
  }

  validateConfig(config: StorageConfig): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!config.name) {
      errors.push('Configuration name is required');
    }

    if (!Object.values(STORAGE_PROVIDERS).includes(config.provider)) {
      errors.push('Invalid storage provider');
    }

    // Provider-specific validation
    switch (config.provider) {
      case STORAGE_PROVIDERS.AWS:
      case STORAGE_PROVIDERS.WASABI:
        if (!config.config.accessKeyId) errors.push('Access Key ID is required');
        if (!config.config.secretAccessKey) errors.push('Secret Access Key is required');
        if (!config.config.bucket) errors.push('Bucket name is required');
        if (!config.config.region) errors.push('Region is required');
        break;

      case STORAGE_PROVIDERS.CLOUDFLARE:
        if (!config.config.accountId) errors.push('Account ID is required');
        if (!config.config.accessKeyId) errors.push('Access Key ID is required');
        if (!config.config.secretAccessKey) errors.push('Secret Access Key is required');
        if (!config.config.bucket) errors.push('Bucket name is required');
        break;

      case STORAGE_PROVIDERS.GRIDFS:
        if (!config.config.database) errors.push('Database name is required');
        break;
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

export class StorageManager {
  private providers: Map<string, BaseStorageProvider> = new Map();
  private configManager: StorageConfigManager;
  private defaultProviderId: string | null = null;

  constructor() {
    this.configManager = new StorageConfigManager();
  }

  async addProvider(id: string, config: StorageConfig): Promise<void> {
    // Validate configuration
    const validation = this.configManager.validateConfig(config);
    if (!validation.isValid) {
      throw new Error(`Invalid configuration: ${validation.errors.join(', ')}`);
    }

    // Create provider instance
    const provider = this.createProvider(config);
    
    // Test connection
    const health = await provider.healthCheck();
    if (!health.isHealthy) {
      throw new Error(`Provider health check failed: ${health.errors.join(', ')}`);
    }

    // Store provider and config
    this.providers.set(id, provider);
    this.configManager.addConfig(id, config);

    // Set as default if it's the first provider or explicitly marked as default
    if (config.isDefault || this.providers.size === 1) {
      this.setDefaultProvider(id);
    }
  }

  async removeProvider(id: string): Promise<void> {
    const provider = this.providers.get(id);
    if (provider) {
      // Cleanup provider
      if ('cleanup' in provider && typeof provider.cleanup === 'function') {
        await provider.cleanup();
      }
      
      this.providers.delete(id);
      this.configManager.removeConfig(id);

      // Reset default if this was the default provider
      if (this.defaultProviderId === id) {
        this.defaultProviderId = null;
        // Set first available provider as default
        const remaining = Array.from(this.providers.keys());
        if (remaining.length > 0) {
          this.setDefaultProvider(remaining[0]);
        }
      }
    }
  }

  setDefaultProvider(id: string): void {
    if (!this.providers.has(id)) {
      throw new Error(`Provider ${id} not found`);
    }

    this.defaultProviderId = id;
    this.configManager.setDefault(id);
  }

  getDefaultProvider(): BaseStorageProvider | null {
    if (!this.defaultProviderId) return null;
    return this.providers.get(this.defaultProviderId) || null;
  }

  getProvider(id: string): BaseStorageProvider | null {
    return this.providers.get(id) || null;
  }

  listProviders(): Array<{ id: string; config: StorageConfig; stats: StorageStats }> {
    return Array.from(this.providers.entries()).map(([id, provider]) => ({
      id,
      config: provider.getConfig(),
      stats: provider.getStats()
    }));
  }

  // File operations using default provider
  async upload(data: Buffer, options: UploadOptions, providerId?: string): Promise<UploadResult & { providerId: string }> {
    const provider = providerId ? this.getProvider(providerId) : this.getDefaultProvider();
    if (!provider) {
      throw new Error('No storage provider available');
    }

    const result = await provider.upload(data, options);
    return { ...result, providerId: providerId || this.defaultProviderId! };
  }

  async download(options: DownloadOptions, providerId?: string): Promise<DownloadResult> {
    const provider = providerId ? this.getProvider(providerId) : this.getDefaultProvider();
    if (!provider) {
      throw new Error('No storage provider available');
    }

    return provider.download(options);
  }

  async delete(options: DeleteOptions, providerId?: string): Promise<void> {
    const provider = providerId ? this.getProvider(providerId) : this.getDefaultProvider();
    if (!provider) {
      throw new Error('No storage provider available');
    }

    return provider.delete(options);
  }

  async copy(options: CopyOptions, providerId?: string): Promise<void> {
    const provider = providerId ? this.getProvider(providerId) : this.getDefaultProvider();
    if (!provider) {
      throw new Error('No storage provider available');
    }

    return provider.copy(options);
  }

  async move(fromKey: string, toKey: string, providerId?: string): Promise<void> {
    const provider = providerId ? this.getProvider(providerId) : this.getDefaultProvider();
    if (!provider) {
      throw new Error('No storage provider available');
    }

    return provider.move(fromKey, toKey);
  }

  async exists(storageKey: string, providerId?: string): Promise<boolean> {
    const provider = providerId ? this.getProvider(providerId) : this.getDefaultProvider();
    if (!provider) {
      throw new Error('No storage provider available');
    }

    return provider.exists(storageKey);
  }

  async getFileInfo(storageKey: string, providerId?: string): Promise<{ size: number; mimeType: string; metadata: Record<string, any> }> {
    const provider = providerId ? this.getProvider(providerId) : this.getDefaultProvider();
    if (!provider) {
      throw new Error('No storage provider available');
    }

    return provider.getFileInfo(storageKey);
  }

  // Health checks
  async checkHealth(providerId?: string): Promise<StorageHealth> {
    const provider = providerId ? this.getProvider(providerId) : this.getDefaultProvider();
    if (!provider) {
      throw new Error('No storage provider available');
    }

    return provider.healthCheck();
  }

  async checkAllProvidersHealth(): Promise<Array<{ id: string; health: StorageHealth }>> {
    const results: Array<{ id: string; health: StorageHealth }> = [];

    for (const [id, provider] of this.providers.entries()) {
      try {
        const health = await provider.healthCheck();
        results.push({ id, health });
      } catch (error) {
        results.push({
          id,
          health: {
            isHealthy: false,
            latency: -1,
            lastCheck: new Date(),
            errors: [(error as Error).message]
          }
        });
      }
    }

    return results;
  }

  // Statistics
  getAggregatedStats(): StorageStats {
    const allStats = Array.from(this.providers.values()).map(p => p.getStats());
    
    return allStats.reduce((total, stats) => ({
      totalFiles: total.totalFiles + stats.totalFiles,
      totalSize: total.totalSize + stats.totalSize,
      avgFileSize: (total.avgFileSize + stats.avgFileSize) / 2,
      lastUsed: stats.lastUsed && (!total.lastUsed || stats.lastUsed > total.lastUsed) 
        ? stats.lastUsed 
        : total.lastUsed,
      errorCount: total.errorCount + stats.errorCount,
      successRate: (total.successRate + stats.successRate) / 2,
      bandwidth: {
        upload: total.bandwidth.upload + stats.bandwidth.upload,
        download: total.bandwidth.download + stats.bandwidth.download,
        period: stats.bandwidth.period
      }
    }), {
      totalFiles: 0,
      totalSize: 0,
      avgFileSize: 0,
      errorCount: 0,
      successRate: 100,
      bandwidth: { upload: 0, download: 0, period: 'day' as const }
    });
  }

  private createProvider(config: StorageConfig): BaseStorageProvider {
    switch (config.provider) {
      case STORAGE_PROVIDERS.AWS:
        return new S3Provider(config);
      
      case STORAGE_PROVIDERS.CLOUDFLARE:
        return new R2Provider(config);
      
      case STORAGE_PROVIDERS.WASABI:
        return new WasabiProvider(config);
      
      case STORAGE_PROVIDERS.GRIDFS:
        return new GridFSProvider(config);
      
      default:
        throw new Error(`Unsupported storage provider: ${config.provider}`);
    }
  }

  // Migration utilities
  async migrateFiles(
    fromProviderId: string, 
    toProviderId: string, 
    fileKeys: string[]
  ): Promise<Array<{ key: string; success: boolean; error?: string }>> {
    const fromProvider = this.getProvider(fromProviderId);
    const toProvider = this.getProvider(toProviderId);

    if (!fromProvider || !toProvider) {
      throw new Error('Source or destination provider not found');
    }

    const results: Array<{ key: string; success: boolean; error?: string }> = [];

    for (const key of fileKeys) {
      try {
        // Download from source
        const data = await fromProvider.download({ storageKey: key });
        
        // Read stream to buffer
        const chunks: Uint8Array[] = [];
        const reader = data.stream.getReader();
        
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
        }
        
        const buffer = Buffer.concat(chunks.map(chunk => Buffer.from(chunk)));
        
        // Upload to destination
        await toProvider.upload(buffer, {
          filename: key,
          mimeType: data.mimeType,
          size: buffer.length,
          metadata: data.metadata
        });

        results.push({ key, success: true });
      } catch (error) {
        results.push({ 
          key, 
          success: false, 
          error: (error as Error).message 
        });
      }
    }

    return results;
  }
}
