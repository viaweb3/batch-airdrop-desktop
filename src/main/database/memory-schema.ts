// 临时内存数据库管理器 - 用于测试应用启动
export interface Campaign {
  id: string;
  name: string;
  chain: string;
  token_address: string;
  status: 'CREATED' | 'READY' | 'SENDING' | 'PAUSED' | 'COMPLETED' | 'FAILED';
  total_recipients: number;
  completed_recipients: number;
  wallet_address?: string;
  wallet_encrypted_key?: string;
  contract_address?: string;
  gas_used: number;
  gas_cost_usd: number;
  created_at: string;
  updated_at: string;
}

export interface Setting {
  key: string;
  value: string;
  updated_at: string;
}

export class DatabaseManager {
  private campaigns: Map<string, Campaign> = new Map();
  private settings: Map<string, Setting> = new Map();
  private priceHistory: Map<string, any[]> = new Map();
  private db: any = this; // 为了兼容性，指向自己

  constructor() {
    console.log('Using in-memory database for testing');
  }

  // 初始化数据库
  initialize(): void {
    console.log('In-memory database initialized');
    this.loadDefaultSettings();
  }

  private loadDefaultSettings(): void {
    const defaults = [
      { key: 'theme', value: 'dark' },
      { key: 'language', value: 'zh-CN' },
      { key: 'network', value: 'ethereum' }
    ];

    defaults.forEach(setting => {
      if (!this.settings.has(setting.key)) {
        this.settings.set(setting.key, {
          ...setting,
          updated_at: new Date().toISOString()
        });
      }
    });
  }

  // 活动相关方法
  createCampaign(campaign: Omit<Campaign, 'id' | 'created_at' | 'updated_at'>): Campaign {
    const newCampaign: Campaign = {
      ...campaign,
      id: this.generateId(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    this.campaigns.set(newCampaign.id, newCampaign);
    console.log('Created campaign:', newCampaign.id);
    return newCampaign;
  }

  getCampaignById(id: string): Campaign | null {
    return this.campaigns.get(id) || null;
  }

  listCampaigns(filters?: any): Campaign[] {
    let campaigns = Array.from(this.campaigns.values());

    if (filters) {
      if (filters.status) {
        campaigns = campaigns.filter(c => c.status === filters.status);
      }
      if (filters.chain) {
        campaigns = campaigns.filter(c => c.chain === filters.chain);
      }
    }

    return campaigns.sort((a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }

  updateCampaign(id: string, updates: Partial<Campaign>): Campaign | null {
    const campaign = this.campaigns.get(id);
    if (!campaign) return null;

    const updatedCampaign = {
      ...campaign,
      ...updates,
      updated_at: new Date().toISOString()
    };

    this.campaigns.set(id, updatedCampaign);
    return updatedCampaign;
  }

  deleteCampaign(id: string): boolean {
    return this.campaigns.delete(id);
  }

  // 设置相关方法
  getSetting(key: string): string | null {
    const setting = this.settings.get(key);
    return setting ? setting.value : null;
  }

  setSetting(key: string, value: string): void {
    this.settings.set(key, {
      key,
      value,
      updated_at: new Date().toISOString()
    });
  }

  getAllSettings(): Setting[] {
    return Array.from(this.settings.values());
  }

  // 文件相关方法（模拟）
  saveFileInfo(filename: string, path: string, size: number): string {
    const id = this.generateId();
    console.log('Saved file info:', { id, filename, path, size });
    return id;
  }

  getFileInfo(id: string): any {
    console.log('Getting file info:', id);
    return { id, filename: 'test.csv', path: '/tmp/test.csv', size: 1024 };
  }

  // 模拟SQLite exec方法
  exec(sql: string): void {
    // 模拟创建表的SQL语句，减少日志输出
    if (sql.includes('CREATE TABLE')) {
      // 静默创建表
    }
  }

  // 模拟SQLite prepare方法
  prepare(sql: string): any {
    return {
      run: (...args: any[]) => {
        return { lastInsertRowid: Date.now() };
      },
      all: (...args: any[]) => {
        return [];
      },
      get: (...args: any[]) => {
        return null;
      }
    };
  }

  // 获取数据库实例（兼容性方法）
  getDatabase(): any {
    return this; // 返回自身以兼容现有代码
  }

  // 清理方法
  close(): void {
    console.log('In-memory database closed');
  }

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  // 价格数据相关
  savePriceData(symbol: string, price: number, timestamp: number): void {
    console.log('Saved price data:', { symbol, price, timestamp });
  }

  getPriceData(symbol: string, startTime?: number, endTime?: number): any[] {
    console.log('Getting price data:', { symbol, startTime, endTime });
    // 返回模拟价格数据
    return [
      { symbol, price: 2000, timestamp: Date.now() - 3600000 },
      { symbol, price: 2050, timestamp: Date.now() - 1800000 },
      { symbol, price: 2100, timestamp: Date.now() }
    ];
  }
}