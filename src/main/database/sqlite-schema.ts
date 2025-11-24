import * as sqlite3 from 'sqlite3';
import { Database, open } from 'sqlite';
import path from 'path';
import os from 'os';
import { DatabaseAdapter } from './db-adapter';

/**
 * Campaign interface
 */
export interface Campaign {
  id: string;
  name: string;
  description?: string;
  chain: string;
  token_address: string;
  token_symbol?: string;
  status: 'CREATED' | 'FUNDED' | 'READY' | 'SENDING' | 'PAUSED' | 'COMPLETED' | 'FAILED';
  total_recipients: number;
  completed_recipients: number;
  failed_recipients: number;
  wallet_address?: string;
  wallet_private_key_base64?: string;
  contract_address?: string;
  contract_deployed_at?: string;
  batch_size: number;
  send_interval: number;
  gas_used: number;
  gas_cost_usd: number;
  created_at: string;
  updated_at: string;
  completed_at?: string;
}

/**
 * Clean database manager without memory mode or migrations
 */
export class DatabaseManager {
  private db: Database | null = null;
  private dbPath: string = '';

  constructor() {
    console.log('[Database] Using SQLite3 database');
  }

  /**
   * Initialize database connection
   */
  async initialize(): Promise<void> {
    try {
      this.dbPath = this.getDefaultDataDir();
      await this.ensureDirectoryExists(this.dbPath);

      const dbFilePath = path.join(this.dbPath, 'cryptocast.db');
      console.log(`[Database] Opening database at: ${dbFilePath}`);

      this.db = await open({
        filename: dbFilePath,
        driver: sqlite3.Database
      });

      // Enable foreign keys
      await this.db.exec('PRAGMA foreign_keys = ON');

      // Enable WAL mode for better concurrency
      await this.db.exec('PRAGMA journal_mode = WAL');

      // Set synchronous mode
      await this.db.exec('PRAGMA synchronous = NORMAL');

      await this.createTables();
      await this.dropObsoleteTables();
      await this.createIndexes();
      await this.insertDefaultChains();

      console.log('[Database] SQLite database initialized successfully');
    } catch (error) {
      console.error('[Database] Failed to initialize database:', error);
      throw error;
    }
  }

  /**
   * Get default data directory based on platform
   */
  private getDefaultDataDir(): string {
    const platform = os.platform();
    const homeDir = os.homedir();

    switch (platform) {
      case 'win32':
        return path.join(homeDir, 'AppData', 'Roaming', 'cryptocast');
      case 'darwin':
        return path.join(homeDir, 'Library', 'Application Support', 'cryptocast');
      default:
        return path.join(homeDir, '.config', 'cryptocast');
    }
  }

  /**
   * Ensure directory exists
   */
  private async ensureDirectoryExists(dirPath: string): Promise<void> {
    const fs = require('fs').promises;
    try {
      await fs.access(dirPath);
    } catch {
      await fs.mkdir(dirPath, { recursive: true });
    }
  }

  /**
   * Create all database tables
   */
  private async createTables(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    console.log('[Database] Creating tables...');

    // Campaigns table
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS campaigns (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        chain_type TEXT NOT NULL CHECK (chain_type IN ('evm', 'solana')),
        chain_id INTEGER,
        network TEXT,
        token_address TEXT NOT NULL,
        token_symbol TEXT,
        token_name TEXT,
        token_decimals INTEGER,
        status TEXT NOT NULL CHECK (status IN ('CREATED', 'FUNDED', 'READY', 'SENDING', 'PAUSED', 'COMPLETED', 'FAILED')),
        total_recipients INTEGER NOT NULL,
        completed_recipients INTEGER DEFAULT 0,
        failed_recipients INTEGER DEFAULT 0,
        wallet_address TEXT,
        wallet_private_key_base64 TEXT,
        contract_address TEXT,
        contract_deployed_at TEXT,
        batch_size INTEGER DEFAULT 100,
        send_interval INTEGER DEFAULT 2000,
        total_gas_used REAL DEFAULT 0,
        total_cost_usd REAL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        completed_at TEXT
      )
    `);

    // Recipients table
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS recipients (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        campaign_id TEXT NOT NULL,
        address TEXT NOT NULL,
        amount TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('PENDING', 'SENT', 'FAILED')),
        tx_hash TEXT,
        gas_used REAL DEFAULT 0,
        error_message TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (campaign_id) REFERENCES campaigns (id) ON DELETE CASCADE,
        UNIQUE(campaign_id, address)
      )
    `);

    // Transactions table
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        campaign_id TEXT NOT NULL,
        tx_hash TEXT NOT NULL,
        tx_type TEXT NOT NULL CHECK (tx_type IN ('DEPLOY_CONTRACT', 'TRANSFER_TO_CONTRACT', 'APPROVE_TOKENS', 'BATCH_SEND', 'WITHDRAW_REMAINING')),
        from_address TEXT NOT NULL,
        to_address TEXT,
        amount TEXT,
        gas_used REAL DEFAULT 0,
        gas_price TEXT,
        gas_cost REAL DEFAULT 0,
        status TEXT NOT NULL CHECK (status IN ('PENDING', 'CONFIRMED', 'FAILED')),
        block_number INTEGER,
        block_hash TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        confirmed_at TEXT,
        FOREIGN KEY (campaign_id) REFERENCES campaigns (id) ON DELETE CASCADE,
        UNIQUE(tx_hash)
      )
    `);

    // Chains table (unified for both EVM and Solana)
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS chains (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL CHECK (type IN ('evm', 'solana')),
        chain_id INTEGER,
        name TEXT NOT NULL UNIQUE,
        rpc_url TEXT NOT NULL,
        rpc_backup TEXT,
        explorer_url TEXT,
        symbol TEXT NOT NULL,
        decimals INTEGER DEFAULT 18,
        color TEXT DEFAULT '#3B82F6',
        badge_color TEXT DEFAULT 'badge-primary',
        network TEXT,
        priority INTEGER DEFAULT 5,
        latency INTEGER,
        enabled BOOLEAN DEFAULT 1,
        is_custom BOOLEAN DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Price history table
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

  
    console.log('[Database] Tables created successfully');
  }

  /**
   * Drop obsolete tables to clean up database
   */
  private async dropObsoleteTables(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    console.log('[Database] Dropping obsolete tables...');

    // Drop the obsolete files table if it exists (was completely unused)
    await this.db.exec('DROP TABLE IF EXISTS files');

    console.log('[Database] Obsolete tables dropped successfully');
  }

  /**
   * Create indexes for better performance
   */
  private async createIndexes(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    console.log('[Database] Creating indexes...');

    await this.db.exec(`
      -- Campaign indexes
      CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);
      CREATE INDEX IF NOT EXISTS idx_campaigns_chain ON campaigns(chain_type, chain_id);
      CREATE INDEX IF NOT EXISTS idx_campaigns_created_at ON campaigns(created_at);

      -- Recipient indexes
      CREATE INDEX IF NOT EXISTS idx_recipients_campaign_id ON recipients(campaign_id);
      CREATE INDEX IF NOT EXISTS idx_recipients_status ON recipients(status);
      CREATE INDEX IF NOT EXISTS idx_recipients_address ON recipients(address);

      -- Transaction indexes
      CREATE INDEX IF NOT EXISTS idx_transactions_campaign_id ON transactions(campaign_id);
      CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
      CREATE INDEX IF NOT EXISTS idx_transactions_hash ON transactions(tx_hash);
      CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(tx_type);

      -- Chain indexes
      CREATE INDEX IF NOT EXISTS idx_chains_type_enabled ON chains(type, enabled);
      CREATE INDEX IF NOT EXISTS idx_chains_chain_id ON chains(chain_id);
      CREATE INDEX IF NOT EXISTS idx_chains_network ON chains(network);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_chains_name ON chains(name);

      -- Price history indexes
      CREATE INDEX IF NOT EXISTS idx_price_symbol_timestamp ON price_history(symbol, timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_price_timestamp ON price_history(timestamp DESC);

      `);

    console.log('[Database] Indexes created successfully');
  }

  /**
   * Insert default chain configurations
   */
  private async insertDefaultChains(): Promise<void> {
    if (!this.db) return;

    console.log('[Database] Inserting default chains...');

    // Default EVM chains
    const defaultEVMChains = [
      {
        type: 'evm',
        chain_id: 1,
        name: 'Ethereum Mainnet',
        rpc_url: 'https://ethereum-rpc.publicnode.com',
        rpc_backup: 'https://ethereum-rpc.publicnode.com',
        explorer_url: 'https://etherscan.io',
        symbol: 'ETH',
        decimals: 18,
        color: '#627EEA',
        badge_color: 'badge-neutral',
      },
      {
        type: 'evm',
        chain_id: 11155111,
        name: 'Ethereum Sepolia Testnet',
        rpc_url: 'https://ethereum-sepolia-rpc.publicnode.com',
        rpc_backup: 'https://ethereum-sepolia-rpc.publicnode.com',
        explorer_url: 'https://sepolia.etherscan.io',
        symbol: 'ETH',
        decimals: 18,
        color: '#4169E1',
        badge_color: 'badge-info',
      },
      {
        type: 'evm',
        chain_id: 137,
        name: 'Polygon',
        rpc_url: 'https://polygon-bor-rpc.publicnode.com',
        rpc_backup: 'https://polygon-bor-rpc.publicnode.com',
        explorer_url: 'https://polygonscan.com',
        symbol: 'POL',
        decimals: 18,
        color: '#8247E5',
        badge_color: 'badge-secondary',
      },
      {
        type: 'evm',
        chain_id: 42161,
        name: 'Arbitrum One',
        rpc_url: 'https://arbitrum-one-rpc.publicnode.com',
        rpc_backup: 'https://arbitrum-one-rpc.publicnode.com',
        explorer_url: 'https://arbiscan.io',
        symbol: 'ETH',
        decimals: 18,
        color: '#28A0F0',
        badge_color: 'badge-info',
      },
      {
        type: 'evm',
        chain_id: 10,
        name: 'Optimism',
        rpc_url: 'https://optimism-rpc.publicnode.com',
        rpc_backup: 'https://optimism-rpc.publicnode.com',
        explorer_url: 'https://optimistic.etherscan.io',
        symbol: 'ETH',
        decimals: 18,
        color: '#FF0420',
        badge_color: 'badge-error',
      },
      {
        type: 'evm',
        chain_id: 8453,
        name: 'Base',
        rpc_url: 'https://base-rpc.publicnode.com',
        rpc_backup: 'https://base-rpc.publicnode.com',
        explorer_url: 'https://basescan.org',
        symbol: 'ETH',
        decimals: 18,
        color: '#0052FF',
        badge_color: 'badge-success',
      },
      {
        type: 'evm',
        chain_id: 56,
        name: 'BSC',
        rpc_url: 'https://bsc-rpc.publicnode.com',
        rpc_backup: 'https://bsc-rpc.publicnode.com',
        explorer_url: 'https://bscscan.com',
        symbol: 'BNB',
        decimals: 18,
        color: '#F3BA2F',
        badge_color: 'badge-warning',
      },
      {
        type: 'evm',
        chain_id: 43114,
        name: 'Avalanche C-Chain',
        rpc_url: 'https://avalanche-c-chain-rpc.publicnode.com',
        rpc_backup: 'https://avalanche-c-chain-rpc.publicnode.com',
        explorer_url: 'https://snowtrace.io',
        symbol: 'AVAX',
        decimals: 18,
        color: '#E84142',
        badge_color: 'badge-accent',
      },
    ];

    // Default Solana networks
    const defaultSolanaNetworks = [
      {
        type: 'solana',
        chain_id: 501,
        name: 'Solana Mainnet',
        rpc_url: 'https://api.mainnet-beta.solana.com',
        rpc_backup: null,
        explorer_url: 'https://explorer.solana.com',
        symbol: 'SOL',
        decimals: 9,
        color: '#00FFA3',
        badge_color: 'badge-accent',
        network: 'mainnet-beta',
        priority: 1,
      },
      {
        type: 'solana',
        chain_id: 502,
        name: 'Solana Devnet',
        rpc_url: 'https://api.devnet.solana.com',
        rpc_backup: null,
        explorer_url: 'https://explorer.solana.com',
        symbol: 'SOL',
        decimals: 9,
        color: '#00D4AA',
        badge_color: 'badge-info',
        network: 'devnet',
        priority: 1,
      },
    ];

    const allDefaultChains = [...defaultEVMChains, ...defaultSolanaNetworks];

    for (const chain of allDefaultChains) {
      try {
        await this.db.run(`
          INSERT OR REPLACE INTO chains (
            type, chain_id, name, rpc_url, rpc_backup, explorer_url, symbol, decimals,
            color, badge_color, network, priority, enabled, is_custom, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          chain.type,
          chain.chain_id,
          chain.name,
          chain.rpc_url,
          chain.rpc_backup,
          chain.explorer_url,
          chain.symbol,
          chain.decimals,
          chain.color,
          chain.badge_color,
          (chain as any).network || null,
          (chain as any).priority || null,
          1, // enabled
          0, // is_custom
          new Date().toISOString()
        ]);
      } catch (error) {
        console.error(`[Database] Failed to insert chain ${chain.name}:`, error);
      }
    }

    console.log(`[Database] Inserted ${allDefaultChains.length} default chains`);
  }

  /**
   * Get database instance with sync adapter
   */
  getDatabase(): DatabaseAdapter {
    if (!this.db) {
      throw new Error('Database not initialized');
    }
    return new DatabaseAdapter(this.db);
  }

  /**
   * Close database connection
   */
  async close(): Promise<void> {
    if (this.db) {
      await this.db.close();
      this.db = null;
      console.log('[Database] Database connection closed');
    }
  }
}
