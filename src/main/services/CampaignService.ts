import { v4 as uuidv4 } from 'uuid';
import { WalletService } from './WalletService';
import { CampaignExecutor } from './CampaignExecutor';
import { DatabaseManager } from '../database/sqlite-schema';

export interface CampaignData {
  name: string;
  chain: string;
  tokenAddress: string;
  recipients: Array<{
    address: string;
    amount: string;
  }>;
}

export interface Campaign {
  id: string;
  name: string;
  chain: string;
  tokenAddress: string;
  status: 'CREATED' | 'READY' | 'SENDING' | 'PAUSED' | 'COMPLETED' | 'FAILED';
  totalRecipients: number;
  completedRecipients: number;
  walletAddress?: string;
  walletEncryptedKey?: string;
  contractAddress?: string;
  gasUsed: number;
  gasCostUsd: number;
  createdAt: string;
  updatedAt: string;
}

export class CampaignService {
  private db: any;
  private walletService: WalletService;
  private executor: CampaignExecutor;
  private databaseManager: DatabaseManager;

  constructor(databaseManager: DatabaseManager) {
    this.db = databaseManager.getDatabase();
    this.databaseManager = databaseManager;
    this.walletService = new WalletService();
    this.executor = new CampaignExecutor(databaseManager);
  }

  async createCampaign(data: CampaignData): Promise<Campaign> {
    const id = uuidv4();
    const now = new Date().toISOString();

    try {
      // 根据链类型创建钱包
      const wallet = this.createWalletForChain(data.chain);

      const insertCampaign = this.db.prepare(`
        INSERT INTO campaigns (
          id, name, chain, token_address, status, total_recipients,
          wallet_address, wallet_encrypted_key, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      insertCampaign.run(
        id,
        data.name,
        data.chain,
        data.tokenAddress,
        'CREATED',
        data.recipients.length,
        wallet.address,
        wallet.encryptedKey,
        now,
        now
      );

      // 插入接收者
      const insertRecipient = this.db.prepare(`
        INSERT INTO recipients (
          campaign_id, address, amount, status, created_at, updated_at
        ) VALUES (?, ?, ?, 'PENDING', ?, ?)
      `);

      data.recipients.forEach(recipient => {
        insertRecipient.run(id, recipient.address, recipient.amount, now, now);
      });

      // 记录审计日志
      this.addAuditLog('CAMPAIGN_CREATED', `Campaign ${id} created with ${data.recipients.length} recipients`);

      const campaign = await this.getCampaignById(id);
      if (!campaign) {
        throw new Error('Campaign creation failed - campaign not found');
      }
      return campaign;
    } catch (error) {
      console.error('Failed to create campaign:', error);
      throw new Error('Campaign creation failed');
    }
  }

  private createWalletForChain(chain: string) {
    if (chain.toLowerCase().includes('solana')) {
      return this.walletService.createSolanaWallet();
    } else {
      return this.walletService.createEVMWallet();
    }
  }

  async listCampaigns(filters?: {
    status?: string;
    chain?: string;
    limit?: number;
    offset?: number;
  }): Promise<Campaign[]> {
    try {
      let query = `
        SELECT * FROM campaigns
        WHERE 1=1
      `;
      const params: any[] = [];

      if (filters?.status) {
        query += ' AND status = ?';
        params.push(filters.status);
      }

      if (filters?.chain) {
        query += ' AND chain = ?';
        params.push(filters.chain);
      }

      query += ' ORDER BY created_at DESC';

      if (filters?.limit) {
        query += ' LIMIT ?';
        params.push(filters.limit);
      }

      if (filters?.offset) {
        query += ' OFFSET ?';
        params.push(filters.offset);
      }

      const campaigns = this.db.prepare(query).all(...params) as any[];
      return campaigns.map(this.mapRowToCampaign);
    } catch (error) {
      console.error('Failed to list campaigns:', error);
      throw new Error('Campaign listing failed');
    }
  }

  async getCampaignById(id: string): Promise<Campaign | null> {
    try {
      const row = this.db.prepare('SELECT * FROM campaigns WHERE id = ?').get(id) as any;
      return row ? this.mapRowToCampaign(row) : null;
    } catch (error) {
      console.error('Failed to get campaign by ID:', error);
      throw new Error('Campaign retrieval failed');
    }
  }

  private mapRowToCampaign(row: any): Campaign {
    return {
      id: row.id,
      name: row.name,
      chain: row.chain,
      tokenAddress: row.token_address,
      status: row.status,
      totalRecipients: row.total_recipients,
      completedRecipients: row.completed_recipients,
      walletAddress: row.wallet_address,
      walletEncryptedKey: row.wallet_encrypted_key,
      contractAddress: row.contract_address,
      gasUsed: row.gas_used || 0,
      gasCostUsd: row.gas_cost_usd || 0,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async updateCampaignStatus(id: string, status: Campaign['status']): Promise<void> {
    try {
      const now = new Date().toISOString();
      this.db.prepare(
        'UPDATE campaigns SET status = ?, updated_at = ? WHERE id = ?'
      ).run(status, now, id);

      this.addAuditLog('CAMPAIGN_STATUS_UPDATED', `Campaign ${id} status changed to ${status}`);
    } catch (error) {
      console.error('Failed to update campaign status:', error);
      throw new Error('Campaign status update failed');
    }
  }

  async startCampaign(
    id: string,
    password: string,
    batchSize?: number,
    onProgress?: (progress: any) => void
  ): Promise<{ success: boolean }> {
    try {
      const campaign = await this.getCampaignById(id);
      if (!campaign) {
        throw new Error('Campaign not found');
      }

      if (campaign.status !== 'CREATED' && campaign.status !== 'READY' && campaign.status !== 'PAUSED') {
        throw new Error('Campaign is not ready to start');
      }

      this.addAuditLog('CAMPAIGN_STARTED', `Campaign ${id} execution started`);

      // Execute campaign in background (non-blocking)
      this.executor.executeCampaign(id, password, batchSize, onProgress).catch(error => {
        console.error('Campaign execution error:', error);
        this.addAuditLog('CAMPAIGN_ERROR', `Campaign ${id} execution error: ${error.message}`);
      });

      return { success: true };
    } catch (error) {
      console.error('Failed to start campaign:', error);
      throw new Error('Campaign start failed');
    }
  }

  async pauseCampaign(id: string): Promise<{ success: boolean }> {
    try {
      const campaign = await this.getCampaignById(id);
      if (!campaign) {
        throw new Error('Campaign not found');
      }

      if (campaign.status !== 'SENDING') {
        throw new Error('Only sending campaigns can be paused');
      }

      // Request executor to pause
      this.executor.pauseExecution(id);

      this.addAuditLog('CAMPAIGN_PAUSE_REQUESTED', `Campaign ${id} pause requested`);

      return { success: true };
    } catch (error) {
      console.error('Failed to pause campaign:', error);
      throw new Error('Campaign pause failed');
    }
  }

  async updateProgress(id: string, completedCount: number): Promise<void> {
    try {
      const now = new Date().toISOString();
      this.db.prepare(
        'UPDATE campaigns SET completed_recipients = ?, updated_at = ? WHERE id = ?'
      ).run(completedCount, now, id);
    } catch (error) {
      console.error('Failed to update campaign progress:', error);
      throw new Error('Campaign progress update failed');
    }
  }

  async getCampaignRecipients(id: string): Promise<Array<{
    id: number;
    address: string;
    amount: string;
    status: string;
    txHash?: string;
    gasUsed?: number;
    errorMessage?: string;
    createdAt: string;
    updatedAt: string;
  }>> {
    try {
      const recipients = this.db.prepare(`
        SELECT * FROM recipients WHERE campaign_id = ? ORDER BY created_at
      `).all(id) as any[];

      return recipients.map(row => ({
        id: row.id,
        address: row.address,
        amount: row.amount,
        status: row.status,
        txHash: row.tx_hash,
        gasUsed: row.gas_used,
        errorMessage: row.error_message,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));
    } catch (error) {
      console.error('Failed to get campaign recipients:', error);
      throw new Error('Campaign recipients retrieval failed');
    }
  }

  async updateRecipientStatus(
    campaignId: string,
    address: string,
    status: 'PENDING' | 'SENT' | 'FAILED',
    txHash?: string,
    gasUsed?: number,
    errorMessage?: string
  ): Promise<void> {
    try {
      const now = new Date().toISOString();
      this.db.prepare(`
        UPDATE recipients
        SET status = ?, tx_hash = ?, gas_used = ?, error_message = ?, updated_at = ?
        WHERE campaign_id = ? AND address = ?
      `).run(status, txHash, gasUsed, errorMessage, now, campaignId, address);

      // 更新活动完成数量
      if (status === 'SENT') {
        const campaign = await this.getCampaignById(campaignId);
        if (campaign) {
          await this.updateProgress(campaignId, campaign.completedRecipients + 1);
        }
      }
    } catch (error) {
      console.error('Failed to update recipient status:', error);
      throw new Error('Recipient status update failed');
    }
  }

  async deleteCampaign(id: string): Promise<void> {
    try {
      // 开始事务
      const transaction = this.db.transaction(() => {
        // 删除相关的接收者记录
        this.db.prepare('DELETE FROM recipients WHERE campaign_id = ?').run(id);

        // 删除相关的交易记录
        this.db.prepare('DELETE FROM transactions WHERE campaign_id = ?').run(id);

        // 删除活动
        this.db.prepare('DELETE FROM campaigns WHERE id = ?').run(id);
      });

      transaction();

      this.addAuditLog('CAMPAIGN_DELETED', `Campaign ${id} deleted`);
    } catch (error) {
      console.error('Failed to delete campaign:', error);
      throw new Error('Campaign deletion failed');
    }
  }

  private addAuditLog(action: string, details: string): void {
    try {
      this.db.prepare(`
        INSERT INTO audit_logs (action, details, created_at) VALUES (?, ?, ?)
      `).run(action, details, new Date().toISOString());
    } catch (error) {
      console.error('Failed to add audit log:', error);
    }
  }

  async getAuditLogs(limit = 100): Promise<Array<{
    id: number;
    action: string;
    details: string;
    createdAt: string;
  }>> {
    try {
      const logs = this.db.prepare(`
        SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT ?
      `).all(limit) as any[];

      return logs.map(row => ({
        id: row.id,
        action: row.action,
        details: row.details,
        createdAt: row.created_at,
      }));
    } catch (error) {
      console.error('Failed to get audit logs:', error);
      throw new Error('Audit logs retrieval failed');
    }
  }
}