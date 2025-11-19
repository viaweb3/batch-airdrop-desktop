import { ethers } from 'ethers';
import { Connection } from '@solana/web3.js';

export interface EVMChain {
  id?: number;
  type: 'evm';
  chainId: number;
  name: string;
  rpcUrl: string;
  rpcBackup?: string;
  explorerUrl: string;
  symbol: string;
  decimals: number;
  enabled: boolean;
  isCustom: boolean;
}

export interface SolanaRPC {
  id?: number;
  network: 'mainnet-beta' | 'devnet' | 'testnet';
  name: string;
  rpcUrl: string;
  wsUrl?: string;
  priority: number;
  latency?: number;
  uptime24h?: number;
  enabled: boolean;
}

export interface RPCTestResult {
  success: boolean;
  latency?: number;
  blockNumber?: number;
  error?: string;
}

export class ChainService {
  private db: any;

  constructor(databaseManager: any) {
    this.db = databaseManager.getDatabase();
  }

  async getEVMChains(onlyEnabled = true): Promise<EVMChain[]> {
    try {
      let query = 'SELECT * FROM evm_chains';
      const params: any[] = [];

      if (onlyEnabled) {
        query += ' WHERE enabled = 1';
      }

      query += ' ORDER BY name';

      const chains = this.db.prepare(query).all(...params) as any[];
      return chains.map(this.mapRowToEVMChain);
    } catch (error) {
      console.error('Failed to get EVM chains:', error);
      throw new Error('EVM chains retrieval failed');
    }
  }

  async addEVMChain(chainData: Omit<EVMChain, 'id' | 'type'>): Promise<number> {
    try {
      // 验证Chain ID是否重复
      const existing = this.db.prepare('SELECT id FROM evm_chains WHERE chain_id = ?').get(chainData.chainId);
      if (existing) {
        throw new Error(`Chain ID ${chainData.chainId} already exists`);
      }

      // 测试RPC连接
      const testResult = await this.testEVMLatencyByUrl(chainData.rpcUrl);
      if (!testResult.success) {
        throw new Error(`RPC connection failed: ${testResult.error}`);
      }

      const insertChain = this.db.prepare(`
        INSERT INTO evm_chains (
          chain_id, name, rpc_url, rpc_backup, explorer_url, symbol, decimals, enabled, is_custom, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const result = insertChain.run(
        chainData.chainId,
        chainData.name,
        chainData.rpcUrl,
        chainData.rpcBackup,
        chainData.explorerUrl,
        chainData.symbol,
        chainData.decimals,
        chainData.enabled ? 1 : 0,
        chainData.isCustom ? 1 : 0,
        new Date().toISOString()
      );

      return result.lastInsertRowid as number;
    } catch (error) {
      console.error('Failed to add EVM chain:', error);
      throw new Error('EVM chain addition failed');
    }
  }

  async updateEVMChain(chainId: number, updates: Partial<EVMChain>): Promise<void> {
    try {
      const fields: string[] = [];
      const params: any[] = [];

      if (updates.name !== undefined) {
        fields.push('name = ?');
        params.push(updates.name);
      }
      if (updates.rpcUrl !== undefined) {
        // 测试新的RPC连接
        const testResult = await this.testEVMLatencyByUrl(updates.rpcUrl);
        if (!testResult.success) {
          throw new Error(`RPC connection failed: ${testResult.error}`);
        }

        fields.push('rpc_url = ?');
        params.push(updates.rpcUrl);
      }
      if (updates.rpcBackup !== undefined) {
        fields.push('rpc_backup = ?');
        params.push(updates.rpcBackup);
      }
      if (updates.explorerUrl !== undefined) {
        fields.push('explorer_url = ?');
        params.push(updates.explorerUrl);
      }
      if (updates.symbol !== undefined) {
        fields.push('symbol = ?');
        params.push(updates.symbol);
      }
      if (updates.decimals !== undefined) {
        fields.push('decimals = ?');
        params.push(updates.decimals);
      }
      if (updates.enabled !== undefined) {
        fields.push('enabled = ?');
        params.push(updates.enabled ? 1 : 0);
      }

      if (fields.length === 0) {
        return;
      }

      params.push(chainId);

      const updateChain = this.db.prepare(`
        UPDATE evm_chains SET ${fields.join(', ')} WHERE id = ?
      `);

      updateChain.run(...params);
    } catch (error) {
      console.error('Failed to update EVM chain:', error);
      throw new Error('EVM chain update failed');
    }
  }

  async deleteEVMChain(chainId: number): Promise<void> {
    try {
      // 检查是否是内置链
      const chain = this.db.prepare('SELECT is_custom FROM evm_chains WHERE id = ?').get(chainId) as any;
      if (!chain || !chain.is_custom) {
        throw new Error('Cannot delete built-in chain');
      }

      this.db.prepare('DELETE FROM evm_chains WHERE id = ?').run(chainId);
    } catch (error) {
      console.error('Failed to delete EVM chain:', error);
      throw new Error('EVM chain deletion failed');
    }
  }

  async testEVMLatency(chainId: number): Promise<{ latency: number; blockNumber: number }> {
    try {
      const chain = this.db.prepare('SELECT * FROM evm_chains WHERE id = ?').get(chainId) as any;
      if (!chain) {
        throw new Error('Chain not found');
      }

      const testResult = await this.testEVMLatencyByUrl(chain.rpc_url);
      if (!testResult.success || !testResult.latency || !testResult.blockNumber) {
        throw new Error(testResult.error || 'Test failed');
      }

      return { latency: testResult.latency, blockNumber: testResult.blockNumber };
    } catch (error) {
      console.error('Failed to test EVM latency:', error);
      throw new Error('EVM latency test failed');
    }
  }

  async testEVMLatencyByUrl(rpcUrl: string): Promise<RPCTestResult> {
    try {
      const startTime = Date.now();
      const provider = new ethers.JsonRpcProvider(rpcUrl);
      const blockNumber = await provider.getBlockNumber();
      const latency = Date.now() - startTime;

      return {
        success: true,
        latency,
        blockNumber,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async getSolanaRPCs(network?: string, onlyEnabled = true): Promise<SolanaRPC[]> {
    try {
      let query = 'SELECT * FROM solana_rpcs';
      const params: any[] = [];

      if (network) {
        query += ' WHERE network = ?';
        params.push(network);
      }

      if (onlyEnabled) {
        query += network ? ' AND enabled = 1' : ' WHERE enabled = 1';
      }

      query += ' ORDER BY priority, name';

      const rpcs = this.db.prepare(query).all(...params) as any[];
      return rpcs.map(this.mapRowToSolanaRPC);
    } catch (error) {
      console.error('Failed to get Solana RPCs:', error);
      throw new Error('Solana RPCs retrieval failed');
    }
  }

  async getActiveSolanaRPC(network: string): Promise<SolanaRPC | null> {
    try {
      // 按优先级获取可用的RPC
      const rpcs = await this.getSolanaRPCs(network, true);

      for (const rpc of rpcs) {
        try {
          const testResult = await this.testSolanaRPC(rpc.rpcUrl);
          if (testResult.success && testResult.latency && testResult.latency < 10000) { // 10秒内响应
            return rpc;
          }
        } catch (error) {
          console.warn(`RPC ${rpc.name} failed health check:`, error);
        }
      }

      return null;
    } catch (error) {
      console.error('Failed to get active Solana RPC:', error);
      return null;
    }
  }

  async addSolanaRPC(rpcData: Omit<SolanaRPC, 'id'>): Promise<number> {
    try {
      // 测试RPC连接
      const testResult = await this.testSolanaRPC(rpcData.rpcUrl);
      if (!testResult.success) {
        throw new Error(`RPC connection failed`);
      }

      const insertRPC = this.db.prepare(`
        INSERT INTO solana_rpcs (
          network, name, rpc_url, ws_url, priority, enabled, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      const result = insertRPC.run(
        rpcData.network,
        rpcData.name,
        rpcData.rpcUrl,
        rpcData.wsUrl,
        rpcData.priority,
        rpcData.enabled ? 1 : 0,
        new Date().toISOString()
      );

      return result.lastInsertRowid as number;
    } catch (error) {
      console.error('Failed to add Solana RPC:', error);
      throw new Error('Solana RPC addition failed');
    }
  }

  async updateSolanaRPCPriority(id: number, priority: number): Promise<void> {
    try {
      this.db.prepare('UPDATE solana_rpcs SET priority = ? WHERE id = ?').run(priority, id);
    } catch (error) {
      console.error('Failed to update Solana RPC priority:', error);
      throw new Error('Solana RPC priority update failed');
    }
  }

  async deleteSolanaRPC(id: number): Promise<void> {
    try {
      this.db.prepare('DELETE FROM solana_rpcs WHERE id = ?').run(id);
    } catch (error) {
      console.error('Failed to delete Solana RPC:', error);
      throw new Error('Solana RPC deletion failed');
    }
  }

  async testSolanaRPC(rpcUrl: string): Promise<RPCTestResult> {
    try {
      const startTime = Date.now();
      const connection = new Connection(rpcUrl, 'confirmed');

      // 测试连接
      const slot = await connection.getSlot();
      const latency = Date.now() - startTime;

      return {
        success: true,
        latency,
        blockNumber: slot,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async healthCheckSolanaRPCs(): Promise<void> {
    try {
      const rpcs = await this.getSolanaRPCs(undefined, true);
      const updateRPC = this.db.prepare(`
        UPDATE solana_rpcs
        SET latency = ?, uptime_24h = ?, last_checked = ?
        WHERE id = ?
      `);

      for (const rpc of rpcs) {
        try {
          const testResult = await this.testSolanaRPC(rpc.rpcUrl);
          const uptime = testResult.success ? 100 : 0;

          updateRPC.run(
            testResult.latency || null,
            uptime,
            new Date().toISOString(),
            rpc.id
          );
        } catch (error) {
          updateRPC.run(null, 0, new Date().toISOString(), rpc.id);
        }
      }
    } catch (error) {
      console.error('Failed to perform health check:', error);
      throw new Error('Solana RPC health check failed');
    }
  }

  private mapRowToEVMChain(row: any): EVMChain {
    return {
      id: row.id,
      type: 'evm',
      chainId: row.chain_id,
      name: row.name,
      rpcUrl: row.rpc_url,
      rpcBackup: row.rpc_backup,
      explorerUrl: row.explorer_url,
      symbol: row.symbol,
      decimals: row.decimals,
      enabled: Boolean(row.enabled),
      isCustom: Boolean(row.is_custom),
    };
  }

  private mapRowToSolanaRPC(row: any): SolanaRPC {
    return {
      id: row.id,
      network: row.network,
      name: row.name,
      rpcUrl: row.rpc_url,
      wsUrl: row.ws_url,
      priority: row.priority,
      latency: row.latency,
      uptime24h: row.uptime_24h,
      enabled: Boolean(row.enabled),
    };
  }

  async getChainByChainId(chainId: number): Promise<EVMChain | null> {
    try {
      const row = this.db.prepare('SELECT * FROM evm_chains WHERE chain_id = ?').get(chainId) as any;
      return row ? this.mapRowToEVMChain(row) : null;
    } catch (error) {
      console.error('Failed to get chain by chain ID:', error);
      return null;
    }
  }

  async toggleEVMChain(chainId: number, enabled: boolean): Promise<void> {
    try {
      this.db.prepare('UPDATE evm_chains SET enabled = ? WHERE id = ?').run(enabled ? 1 : 0, chainId);
    } catch (error) {
      console.error('Failed to toggle EVM chain:', error);
      throw new Error('EVM chain toggle failed');
    }
  }

  async toggleSolanaRPC(rpcId: number, enabled: boolean): Promise<void> {
    try {
      this.db.prepare('UPDATE solana_rpcs SET enabled = ? WHERE id = ?').run(enabled ? 1 : 0, rpcId);
    } catch (error) {
      console.error('Failed to toggle Solana RPC:', error);
      throw new Error('Solana RPC toggle failed');
    }
  }
}