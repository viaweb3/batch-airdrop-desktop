import * as sqlite3 from 'sqlite3';
import { Database, open } from 'sqlite';
import path from 'path';
import os from 'os';
import { DatabaseAdapter } from './db-adapter';

export interface Campaign {
  id: string;
  name: string;
  chain: string;
  token_address: string;
  status: 'CREATED' | 'FUNDED' | 'READY' | 'SENDING' | 'PAUSED' | 'COMPLETED' | 'FAILED';
  total_recipients: number;
  completed_recipients: number;
  wallet_address?: string;
  wallet_private_key_base64?: string;
  contract_address?: string;
  contract_deployed_at?: string;
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
        status TEXT NOT NULL CHECK (status IN ('CREATED', 'FUNDED', 'READY', 'SENDING', 'PAUSED', 'COMPLETED', 'FAILED')),
        total_recipients INTEGER NOT NULL,
        completed_recipients INTEGER DEFAULT 0,
        wallet_address TEXT,
        wallet_private_key_base64 TEXT,
        contract_address TEXT,
        contract_deployed_at TEXT,
        gas_used REAL DEFAULT 0,
        gas_cost_usd REAL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);

    // 接收者表
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS recipients (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        campaign_id TEXT NOT NULL,
        address TEXT NOT NULL,
        amount TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('PENDING', 'SENT', 'FAILED')),
        tx_hash TEXT,
        gas_used REAL,
        error_message TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (campaign_id) REFERENCES campaigns (id) ON DELETE CASCADE,
        UNIQUE(campaign_id, address)
      )
    `);

    // 交易记录表
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        campaign_id TEXT NOT NULL,
        tx_hash TEXT NOT NULL,
        tx_type TEXT NOT NULL CHECK (tx_type IN ('DEPLOY_CONTRACT', 'TRANSFER_TO_CONTRACT', 'BATCH_SEND', 'WITHDRAW_REMAINING')),
        from_address TEXT NOT NULL,
        to_address TEXT,
        amount TEXT,
        gas_used REAL,
        gas_price TEXT,
        gas_cost REAL,
        status TEXT NOT NULL CHECK (status IN ('PENDING', 'CONFIRMED', 'FAILED')),
        block_number INTEGER,
        block_hash TEXT,
        created_at TEXT NOT NULL,
        confirmed_at TEXT,
        FOREIGN KEY (campaign_id) REFERENCES campaigns (id) ON DELETE CASCADE
      )
    `);

    // EVM链配置表
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS evm_chains (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT DEFAULT 'evm',
        chain_id INTEGER UNIQUE NOT NULL,
        name TEXT NOT NULL,
        rpc_url TEXT NOT NULL,
        rpc_backup TEXT,
        explorer_url TEXT,
        symbol TEXT,
        decimals INTEGER DEFAULT 18,
        enabled BOOLEAN DEFAULT 1,
        is_custom BOOLEAN DEFAULT 0,
        created_at TEXT NOT NULL
      )
    `);

    // Solana RPC配置表
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS solana_rpcs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        network TEXT NOT NULL CHECK (network IN ('mainnet-beta', 'devnet', 'testnet')),
        name TEXT NOT NULL,
        rpc_url TEXT NOT NULL,
        ws_url TEXT,
        priority INTEGER DEFAULT 5,
        latency INTEGER,
        uptime_24h REAL DEFAULT 100.0,
        enabled BOOLEAN DEFAULT 1,
        last_checked TEXT,
        created_at TEXT NOT NULL
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

    // 价格历史表 - 添加缺失的列
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS price_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        symbol TEXT NOT NULL,
        price REAL NOT NULL,
        change_24h REAL,
        change_percent_24h REAL,
        market_cap REAL,
        volume_24h REAL,
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

    // 审计日志表
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        action TEXT NOT NULL,
        details TEXT,
        created_at TEXT NOT NULL
      )
    `);

    // 创建索引
    await this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_recipients_campaign_id ON recipients(campaign_id);
      CREATE INDEX IF NOT EXISTS idx_recipients_status ON recipients(status);
      CREATE INDEX IF NOT EXISTS idx_transactions_campaign_id ON transactions(campaign_id);
      CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
      CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);
      CREATE INDEX IF NOT EXISTS idx_campaigns_created_at ON campaigns(created_at);
      CREATE INDEX IF NOT EXISTS idx_price_symbol ON price_history(symbol);
      CREATE INDEX IF NOT EXISTS idx_price_timestamp ON price_history(timestamp);
    `);

    // 插入默认链信息
    await this.insertDefaultChains();

    // 插入默认设置
    await this.insertDefaultSettings();
  }

  private async insertDefaultChains(): Promise<void> {
    if (!this.db) return;

    // 插入默认EVM链
    const defaultEVMChains = [
      {
        chain_id: 1,
        name: 'Ethereum Mainnet',
        rpc_url: 'https://eth.llamarpc.com',
        rpc_backup: 'https://rpc.ankr.com/eth',
        explorer_url: 'https://etherscan.io',
        symbol: 'ETH',
        decimals: 18,
      },
      {
        chain_id: 137,
        name: 'Polygon',
        rpc_url: 'https://polygon.llamarpc.com',
        rpc_backup: 'https://rpc.ankr.com/polygon',
        explorer_url: 'https://polygonscan.com',
        symbol: 'MATIC',
        decimals: 18,
      },
      {
        chain_id: 42161,
        name: 'Arbitrum One',
        rpc_url: 'https://arbitrum.llamarpc.com',
        rpc_backup: 'https://rpc.ankr.com/arbitrum',
        explorer_url: 'https://arbiscan.io',
        symbol: 'ETH',
        decimals: 18,
      },
      {
        chain_id: 10,
        name: 'Optimism',
        rpc_url: 'https://optimism.llamarpc.com',
        rpc_backup: 'https://rpc.ankr.com/optimism',
        explorer_url: 'https://optimistic.etherscan.io',
        symbol: 'ETH',
        decimals: 18,
      },
      {
        chain_id: 8453,
        name: 'Base',
        rpc_url: 'https://base.llamarpc.com',
        rpc_backup: 'https://rpc.ankr.com/base',
        explorer_url: 'https://basescan.org',
        symbol: 'ETH',
        decimals: 18,
      },
      {
        chain_id: 56,
        name: 'BSC',
        rpc_url: 'https://bsc.llamarpc.com',
        rpc_backup: 'https://rpc.ankr.com/bsc',
        explorer_url: 'https://bscscan.com',
        symbol: 'BNB',
        decimals: 18,
      },
      {
        chain_id: 43114,
        name: 'Avalanche C-Chain',
        rpc_url: 'https://avalanche.llamarpc.com',
        rpc_backup: 'https://rpc.ankr.com/avalanche',
        explorer_url: 'https://snowtrace.io',
        symbol: 'AVAX',
        decimals: 18,
      },
    ];

    for (const chain of defaultEVMChains) {
      try {
        await this.db.run(`
          INSERT OR IGNORE INTO evm_chains (chain_id, name, rpc_url, rpc_backup, explorer_url, symbol, decimals, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [chain.chain_id, chain.name, chain.rpc_url, chain.rpc_backup, chain.explorer_url, chain.symbol, chain.decimals, new Date().toISOString()]);
      } catch (error) {
        // 忽略重复插入错误
      }
    }

    // 插入默认Solana RPC节点
    const defaultSolanaRPCs = [
      {
        network: 'mainnet-beta',
        name: 'Solana Mainnet (Official)',
        rpc_url: 'https://api.mainnet-beta.solana.com',
        priority: 1,
      },
      {
        network: 'mainnet-beta',
        name: 'Triton One',
        rpc_url: 'https://rpc.ankr.com/solana',
        priority: 2,
      },
      {
        network: 'devnet',
        name: 'Solana Devnet (Official)',
        rpc_url: 'https://api.devnet.solana.com',
        priority: 1,
      },
    ];

    for (const rpc of defaultSolanaRPCs) {
      try {
        await this.db.run(`
          INSERT OR IGNORE INTO solana_rpcs (network, name, rpc_url, priority, created_at)
          VALUES (?, ?, ?, ?, ?)
        `, [rpc.network, rpc.name, rpc.rpc_url, rpc.priority, new Date().toISOString()]);
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

  // 获取数据库实例 - 返回适配器以提供同步API
  getDatabase(): DatabaseAdapter {
    if (!this.db) {
      throw new Error('Database not initialized');
    }
    return new DatabaseAdapter(this.db);
  }

  // 关闭数据库连接
  async close(): Promise<void> {
    if (this.db) {
      await this.db.close();
      this.db = null;
    }
  }
}