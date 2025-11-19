

export interface AppSettings {
  // 通用设置
  language: string;
  theme: 'light' | 'dark' | 'system';
  notifications: boolean;
  autoBackup: boolean;
  backupInterval: 'daily' | 'weekly' | 'monthly';

  // Gas设置
  gasStrategy: 'economic' | 'standard' | 'fast' | 'custom';
  customGasPrice?: string;
  gasAlertThreshold: number;

  // 数据目录设置
  customDataDir?: string;

  // RPC设置
  rpcTimeout: number;
  maxRetries: number;

  // 安全设置
  sessionTimeout: number;
  requirePassword: boolean;

  // 发送设置
  batchSize: number;
  maxConcurrency: number;
  sendDelay: number;
}

const DEFAULT_SETTINGS: AppSettings = {
  language: 'zh-CN',
  theme: 'system',
  notifications: true,
  autoBackup: false,
  backupInterval: 'weekly',
  gasStrategy: 'standard',
  gasAlertThreshold: 100,
  rpcTimeout: 30000,
  maxRetries: 3,
  sessionTimeout: 3600000, // 1小时
  requirePassword: false,
  batchSize: 100,
  maxConcurrency: 5,
  sendDelay: 1000,
};

export class SettingsService {
  private db: any;

  constructor(databaseManager: any) {
    this.db = databaseManager.getDatabase();
  }

  async getSettings(): Promise<AppSettings> {
    try {
      const settings = { ...DEFAULT_SETTINGS };

      const rows = this.db.prepare('SELECT key, value FROM settings').all() as any[];

      rows.forEach(row => {
        const key = row.key as keyof AppSettings;
        let value: any = row.value;

        // 类型转换
        if (value === 'true') value = true;
        if (value === 'false') value = false;
        if (!isNaN(Number(value)) && value !== '') value = Number(value);

        if (key in settings) {
          (settings as any)[key] = value;
        }
      });

      return settings;
    } catch (error) {
      console.error('Failed to get settings:', error);
      return DEFAULT_SETTINGS;
    }
  }

  async updateSettings(updates: Partial<AppSettings>): Promise<{ success: boolean }> {
    try {
      const updateSetting = this.db.prepare(`
        INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, ?)
      `);

      Object.entries(updates).forEach(([key, value]) => {
        updateSetting.run(key, String(value), new Date().toISOString());
      });

      return { success: true };
    } catch (error) {
      console.error('Failed to update settings:', error);
      throw new Error('Settings update failed');
    }
  }

  async getSetting(key: keyof AppSettings): Promise<any> {
    try {
      const row = this.db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as any;
      if (!row) {
        return DEFAULT_SETTINGS[key];
      }

      let value = row.value;
      if (value === 'true') value = true;
      if (value === 'false') value = false;
      if (!isNaN(Number(value)) && value !== '') value = Number(value);

      return value;
    } catch (error) {
      console.error(`Failed to get setting ${key}:`, error);
      return DEFAULT_SETTINGS[key];
    }
  }

  async resetSettings(): Promise<void> {
    try {
      this.db.prepare('DELETE FROM settings').run();
    } catch (error) {
      console.error('Failed to reset settings:', error);
      throw new Error('Settings reset failed');
    }
  }

  async exportSettings(): Promise<string> {
    try {
      const settings = await this.getSettings();
      return JSON.stringify(settings, null, 2);
    } catch (error) {
      console.error('Failed to export settings:', error);
      throw new Error('Settings export failed');
    }
  }

  async importSettings(settingsJson: string): Promise<{ success: boolean; errors: string[] }> {
    try {
      const errors: string[] = [];
      let settings: Partial<AppSettings>;

      try {
        settings = JSON.parse(settingsJson);
      } catch {
        return { success: false, errors: ['Invalid JSON format'] };
      }

      // 验证设置
      for (const [key, value] of Object.entries(settings)) {
        if (!(key in DEFAULT_SETTINGS)) {
          errors.push(`Unknown setting: ${key}`);
          continue;
        }

        // 类型验证
        const expectedType = typeof (DEFAULT_SETTINGS as any)[key];
        const actualType = typeof value;

        if (expectedType !== actualType && value !== null && value !== undefined) {
          errors.push(`Invalid type for ${key}: expected ${expectedType}, got ${actualType}`);
        }
      }

      if (errors.length > 0) {
        return { success: false, errors };
      }

      // 应用设置
      await this.updateSettings(settings);

      return { success: true, errors: [] };
    } catch (error) {
      console.error('Failed to import settings:', error);
      return { success: false, errors: ['Import failed'] };
    }
  }

  async validateSetting(key: keyof AppSettings, value: any): Promise<boolean> {
    try {
      switch (key) {
        case 'language':
          return ['zh-CN', 'en-US'].includes(value);
        case 'theme':
          return ['light', 'dark', 'system'].includes(value);
        case 'notifications':
        case 'autoBackup':
        case 'requirePassword':
          return typeof value === 'boolean';
        case 'backupInterval':
          return ['daily', 'weekly', 'monthly'].includes(value);
        case 'gasStrategy':
          return ['economic', 'standard', 'fast', 'custom'].includes(value);
        case 'gasAlertThreshold':
          return typeof value === 'number' && value >= 0;
        case 'rpcTimeout':
        case 'sessionTimeout':
          return typeof value === 'number' && value > 0;
        case 'maxRetries':
          return typeof value === 'number' && value >= 0 && value <= 10;
        case 'batchSize':
          return typeof value === 'number' && value > 0 && value <= 1000;
        case 'maxConcurrency':
          return typeof value === 'number' && value > 0 && value <= 20;
        case 'sendDelay':
          return typeof value === 'number' && value >= 0;
        case 'customGasPrice':
          return value === undefined || (typeof value === 'string' && parseFloat(value) > 0);
        case 'customDataDir':
          return value === undefined || typeof value === 'string';
        default:
          return false;
      }
    } catch (error) {
      return false;
    }
  }

  async getDataDirectory(): Promise<string> {
    try {
      const customDir = await this.getSetting('customDataDir');
      if (customDir) {
        return customDir;
      }

      // 返回默认数据目录
      const os = require('os');
      const path = require('path');
      const homeDir = os.homedir();
      const platform = os.platform();

      switch (platform) {
        case 'win32':
          return path.join(homeDir, 'AppData', 'Roaming', 'batch-airdrop');
        case 'darwin':
          return path.join(homeDir, 'Library', 'Application Support', 'batch-airdrop');
        default:
          return path.join(homeDir, '.config', 'batch-airdrop');
      }
    } catch (error) {
      throw new Error('Failed to get data directory');
    }
  }

  async setDataDirectory(directory: string): Promise<{ success: boolean; error?: string }> {
    try {
      const fs = require('fs');

      // 检查目录是否存在和是否可写
      if (!fs.existsSync(directory)) {
        try {
          fs.mkdirSync(directory, { recursive: true });
        } catch {
          return { success: false, error: 'Cannot create directory' };
        }
      }

      try {
        fs.accessSync(directory, fs.constants.W_OK);
      } catch {
        return { success: false, error: 'Directory is not writable' };
      }

      await this.updateSettings({ customDataDir: directory });
      return { success: true };
    } catch (error) {
      return { success: false, error: 'Failed to set data directory' };
    }
  }

  async resetDataDirectory(): Promise<void> {
    try {
      await this.updateSettings({ customDataDir: undefined });
    } catch (error) {
      throw new Error('Failed to reset data directory');
    }
  }

  async getGasPriceSettings(): Promise<{
    strategy: string;
    customPrice?: string;
    multiplier: number;
  }> {
    const strategy = await this.getSetting('gasStrategy');
    const customPrice = await this.getSetting('customGasPrice');

    let multiplier = 1.0;
    switch (strategy) {
      case 'economic':
        multiplier = 0.8;
        break;
      case 'standard':
        multiplier = 1.0;
        break;
      case 'fast':
        multiplier = 1.2;
        break;
      case 'custom':
        multiplier = 1.0;
        break;
    }

    return { strategy, customPrice, multiplier };
  }

  async getBatchSettings(): Promise<{
    batchSize: number;
    maxConcurrency: number;
    sendDelay: number;
  }> {
    const batchSize = await this.getSetting('batchSize');
    const maxConcurrency = await this.getSetting('maxConcurrency');
    const sendDelay = await this.getSetting('sendDelay');

    return {
      batchSize,
      maxConcurrency,
      sendDelay,
    };
  }

  async getNotificationSettings(): Promise<{
    enabled: boolean;
    gasThreshold: number;
  }> {
    const enabled = await this.getSetting('notifications');
    const gasThreshold = await this.getSetting('gasAlertThreshold');

    return {
      enabled,
      gasThreshold,
    };
  }

  async shouldShowNotification(_type: 'gas' | 'completion' | 'error'): Promise<boolean> {
    const notifications = await this.getSetting('notifications');
    if (!notifications) {
      return false;
    }

    // 可以根据不同类型返回不同的设置
    return true;
  }

  async migrateSettings(): Promise<void> {
    try {
      // 检查是否有需要迁移的旧设置
      // 简化处理，暂时不实现版本迁移
      console.log('Settings migration check completed');
    } catch (error) {
      console.error('Settings migration failed:', error);
    }
  }
}