import * as sqlite3 from 'sqlite3';
import { Database, open } from 'sqlite';
import path from 'path';
import os from 'os';

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
  private db: Database | null = null;

  constructor() {
    console.log('Using SQLite3 database');
  }

  async initialize(): Promise<void> {
    try {
      const dbPath = this.getDefaultDataDir();
      await this.ensureDirectoryExists(dbPath);

      this.db = await open({
        filename: path.join(dbPath, 'airdrop.db'),
        driver: sqlite3.Database
      });

      await this.initializeTables();
      console.log('SQLite database initialized successfully');
    } catch (error) {
      console.error('Failed to initialize SQLite database:', error);
      // 降级到内存数据库
      await this.initializeMemoryDB();
    }
  }

  private getDefaultDataDir(): string {
    const platform = os.platform();
    const homeDir = os.homedir();

    switch (platform) {
      case 'win32':
        return path.join(homeDir, 'AppData', 'Roaming', 'batch-airdrop');
      case 'darwin':
        return path.join(homeDir, 'Library', 'Application Support', 'batch-airdrop');
      default:
        return path.join(homeDir, '.config', 'batch-airdrop');
    }
  }

  private async ensureDirectoryExists(dirPath: string): Promise<void> {
    const fs = require('fs').promises;
    try {
      await fs.access(dirPath);
    } catch {
      await fs.mkdir(dirPath, { recursive: true });
    }
  }

  private async initializeMemoryDB(): Promise<void> {
    console.log('Falling back to in-memory database');
    this.db = await open({
      filename: ':memory:',
      driver: sqlite3.Database
    });
    await this.initializeTables();
  }

  private async initializeTables(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    // 活动表
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS campaigns (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        chain TEXT NOT NULL,
        token_address TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('CREATED', 'READY', 'SENDING', 'PAUSED', 'COMPLETED', 'FAILED')),
        total_recipients INTEGER NOT NULL,
        completed_recipients INTEGER DEFAULT 0,
        wallet_address TEXT,
        wallet_encrypted_key TEXT,
        contract_address TEXT,
        gas_used REAL DEFAULT 0,
        gas_cost_usd REAL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);

    // 设置表
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);

    // 价格历史表
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS price_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        symbol TEXT NOT NULL,
        price REAL NOT NULL,
        change_24h REAL,
        change_percent_24h REAL,
        timestamp INTEGER NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 文件信息表
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS files (
        id TEXT PRIMARY KEY,
        filename TEXT NOT NULL,
        file_path TEXT NOT NULL,
        size INTEGER NOT NULL,
        created_at TEXT NOT NULL
      )
    `);

    // 区块链信息表
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS chains (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL,
        chain_id INTEGER,
        name TEXT NOT NULL,
        rpc_url TEXT NOT NULL,
        currency TEXT DEFAULT 'USD',
        native_token_symbol TEXT,
        coingecko_id TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 插入默认链信息
    await this.insertDefaultChains();

    // 插入默认设置
    await this.insertDefaultSettings();
  }

  private async insertDefaultChains(): Promise<void> {
    if (!this.db) return;

    const defaultChains = [
      { type: 'evm', chain_id: 1, name: 'ethereum', rpc_url: 'https://rpc.ankr.com/eth', currency: 'USD', native_token_symbol: 'ETH', coingecko_id: 'ethereum' },
      { type: 'evm', chain_id: 137, name: 'polygon', rpc_url: 'https://rpc.ankr.com/polygon', currency: 'USD', native_token_symbol: 'MATIC', coingecko_id: 'matic-network' },
      { type: 'evm', chain_id: 56, name: 'bsc', rpc_url: 'https://rpc.ankr.com/bsc', currency: 'USD', native_token_symbol: 'BNB', coingecko_id: 'binancecoin' },
      { type: 'evm', chain_id: 43114, name: 'avalanche', rpc_url: 'https://rpc.ankr.com/avalanche', currency: 'USD', native_token_symbol: 'AVAX', coingecko_id: 'avalanche-2' },
      { type: 'solana', chain_id: 0, name: 'solana', rpc_url: 'https://rpc.ankr.com/solana', currency: 'USD', native_token_symbol: 'SOL', coingecko_id: 'solana' }
    ];

    for (const chain of defaultChains) {
      try {
        await this.db.run(`
          INSERT OR IGNORE INTO chains (type, chain_id, name, rpc_url, currency, native_token_symbol, coingecko_id)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [chain.type, chain.chain_id, chain.name, chain.rpc_url, chain.currency, chain.native_token_symbol, chain.coingecko_id]);
      } catch (error) {
        // 忽略重复插入错误
      }
    }
  }

  private async insertDefaultSettings(): Promise<void> {
    if (!this.db) return;

    const defaultSettings = [
      { key: 'theme', value: 'dark' },
      { key: 'language', value: 'zh-CN' },
      { key: 'network', value: 'ethereum' }
    ];

    for (const setting of defaultSettings) {
      try {
        await this.db.run(`
          INSERT OR REPLACE INTO settings (key, value, updated_at)
          VALUES (?, ?, ?)
        `, [setting.key, setting.value, new Date().toISOString()]);
      } catch (error) {
        console.error('Failed to insert default setting:', error);
      }
    }
  }

  // 获取数据库实例
  getDatabase(): Database {
    if (!this.db) {
      throw new Error('Database not initialized');
    }
    return this.db;
  }

  // 关闭数据库连接
  async close(): Promise<void> {
    if (this.db) {
      await this.db.close();
      this.db = null;
    }
  }
}