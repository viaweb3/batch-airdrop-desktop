import { v4 as uuidv4 } from 'uuid';
import { WalletService } from './WalletService';
import { CampaignExecutor } from './CampaignExecutor';
import { DatabaseManager } from '../database/sqlite-schema';

export interface CampaignData {
  name: string;
  description?: string;
  chain: string;
  tokenAddress: string;
  tokenSymbol?: string;
  tokenName?: string;
  tokenDecimals?: number;
  batchSize?: number;
  sendInterval?: number;
  recipients: Array<{
    address: string;
    amount: string;
  }>;
}

export interface Campaign {
  id: string;
  name: string;
  description?: string;
  chain: string;
  tokenAddress: string;
  tokenSymbol?: string;
  tokenName?: string;
  tokenDecimals?: number;
  status: 'CREATED' | 'FUNDED' | 'READY' | 'SENDING' | 'PAUSED' | 'COMPLETED' | 'FAILED';
  totalRecipients: number;
  completedRecipients: number;
  failedRecipients?: number;
  walletAddress?: string;
  walletPrivateKeyBase64?: string;
  contractAddress?: string;
  contractDeployedAt?: string;
  batchSize?: number;
  sendInterval?: number;
  gasUsed: number;
  gasCostUsd: number;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export class CampaignService {
  private db: any;
  private walletService: WalletService;
  private executor: CampaignExecutor;
  private databaseManager: DatabaseManager;
  private deploymentLocks: Map<string, Promise<any>> = new Map();

  constructor(databaseManager: DatabaseManager) {
    this.db = databaseManager.getDatabase();
    this.databaseManager = databaseManager;
    this.walletService = new WalletService();
    this.executor = new CampaignExecutor(databaseManager);
  }

  async createCampaign(data: CampaignData): Promise<Campaign> {
    const id = uuidv4();
    const now = new Date().toISOString();

    console.log('🚀 [CampaignService] createCampaign STARTED - MODIFIED VERSION');
    console.log('🚀 [CampaignService] ID:', id);

    try {
      // 根据链类型创建钱包
      const wallet = this.createWalletForChain(data.chain);

      console.log('🔑 [CampaignService] Wallet created:', {
        address: wallet.address,
        hasPrivateKey: !!wallet.privateKeyBase64,
        privateKeyLength: wallet.privateKeyBase64?.length || 0,
        chain: data.chain
      });

      // Determine chain type and ID from the chain value
      let chainType = 'evm';
      let chainId = parseInt(data.chain);
      let network = null;

      // Handle Solana chains (they use chain_id 501+ in our schema)
      if (typeof data.chain === 'string' && data.chain.toLowerCase().includes('solana')) {
        chainType = 'solana';
        chainId = data.chain.includes('mainnet') ? 501 : 502; // Solana chain IDs in our schema
        network = data.chain.includes('mainnet') ? 'mainnet-beta' : 'devnet';
      }

      const insertCampaign = this.db.prepare(`
        INSERT INTO campaigns (
          id, name, description, chain_type, chain_id, network, token_address, token_symbol, token_name, token_decimals, status, total_recipients,
          wallet_address, wallet_private_key_base64, batch_size, send_interval,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      console.log('💾 [CampaignService] Inserting campaign data:', {
        id,
        name: data.name,
        chain: data.chain,
        chainType,
        chainId,
        walletAddress: wallet.address,
        privateKeyProvided: !!wallet.privateKeyBase64,
        privateKeyLength: wallet.privateKeyBase64?.length || 0,
        recipientsCount: data.recipients.length
      });

      await insertCampaign.run(
        id,
        data.name,
        data.description || null,
        chainType,
        chainId,
        network,
        data.tokenAddress,
        data.tokenSymbol || null,
        data.tokenName || null,
        data.tokenDecimals || null,
        'CREATED',
        data.recipients.length,
        wallet.address,
        wallet.privateKeyBase64,
        data.batchSize || 100,
        data.sendInterval || 2000,
        now,
        now
      );

      console.log('✅ [CampaignService] Campaign inserted successfully');

      // 插入接收者
      const insertRecipient = this.db.prepare(`
        INSERT INTO recipients (
          campaign_id, address, amount, status, created_at
        ) VALUES (?, ?, ?, 'PENDING', ?)
      `);

      for (const recipient of data.recipients) {
        await insertRecipient.run(id, recipient.address, recipient.amount, now);
      }

      
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

      const campaigns = await this.db.prepare(query).all(...params) as any[] || [];
      return campaigns.map(this.mapRowToCampaign);
    } catch (error) {
      console.error('Failed to list campaigns:', error);
      throw new Error('Campaign listing failed');
    }
  }

  async getCampaignById(id: string): Promise<Campaign | null> {
    try {
      const row = await this.db.prepare('SELECT * FROM campaigns WHERE id = ?').get(id) as any;
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
      description: row.description,
      // For backward compatibility, construct chain from the new schema
      chain: row.chain || (row.chain_type === 'evm' ? row.chain_id?.toString() : row.network),
      tokenAddress: row.token_address,
      tokenSymbol: row.token_symbol,
      status: row.status,
      totalRecipients: row.total_recipients,
      completedRecipients: row.completed_recipients,
      failedRecipients: row.failed_recipients || 0,
      walletAddress: row.wallet_address,
      walletPrivateKeyBase64: row.wallet_private_key_base64,
      contractAddress: row.contract_address,
      contractDeployedAt: row.contract_deployed_at,
      batchSize: row.batch_size || 100,
      sendInterval: row.send_interval || 2000,
      gasUsed: row.total_gas_used || 0,
      gasCostUsd: row.total_cost_usd || 0,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      completedAt: row.completed_at,
    };
  }

  async updateCampaignStatus(id: string, status: Campaign['status']): Promise<void> {
    try {
      const now = new Date().toISOString();
      await this.db.prepare(
        'UPDATE campaigns SET status = ?, updated_at = ? WHERE id = ?'
      ).run(status, now, id);
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

      // Solana链不需要READY状态，可以直接从FUNDED开始
      if (!this.isSolanaChain(campaign.chain)) {
        if (campaign.status !== 'READY' && campaign.status !== 'PAUSED') {
          throw new Error('Campaign is not ready to start. Please deploy the contract first.');
        }
      } else {
        if (campaign.status !== 'FUNDED' && campaign.status !== 'PAUSED') {
          throw new Error('Solana campaign must be funded before starting.');
        }
      }

      
      // Execute campaign in background (non-blocking)
      this.executor.executeCampaign(id, password, batchSize, onProgress).catch(error => {
        console.error('Campaign execution error:', error);
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

      
      return { success: true };
    } catch (error) {
      console.error('Failed to pause campaign:', error);
      throw new Error('Campaign pause failed');
    }
  }

  async updateProgress(id: string, completedCount: number): Promise<void> {
    try {
      const now = new Date().toISOString();
      await this.db.prepare(
        'UPDATE campaigns SET completed_recipients = ?, updated_at = ? WHERE id = ?'
      ).run(completedCount, now, id);
    } catch (error) {
      console.error('Failed to update campaign progress:', error);
      throw new Error('Campaign progress update failed');
    }
  }

  async updateCampaignContract(
    id: string,
    contractAddress: string,
    deploymentTxHash: string
  ): Promise<void> {
    try {
      const campaign = await this.getCampaignById(id);
      if (!campaign) {
        throw new Error('Campaign not found');
      }

      // 验证状态转换合法性
      const validTransitions = ['CREATED', 'FUNDED'];
      if (!validTransitions.includes(campaign.status)) {
        throw new Error(
          `Cannot deploy contract from status ${campaign.status}. ` +
          `Valid states: ${validTransitions.join(', ')}`
        );
      }

      // 检查是否已经部署过
      if (campaign.contractAddress) {
        throw new Error(
          `Contract already deployed at ${campaign.contractAddress}. ` +
          `Cannot deploy again.`
        );
      }

      const now = new Date().toISOString();
      const result = await this.db.prepare(`
        UPDATE campaigns
        SET contract_address = ?, contract_deployed_at = ?, status = 'READY', updated_at = ?
        WHERE id = ? AND status IN ('CREATED', 'FUNDED') AND contract_address IS NULL
      `).run(contractAddress, now, now, id);

      // 验证更新成功（防止并发部署）
      if (result.changes === 0) {
        throw new Error('Campaign status changed during deployment or already deployed, please retry');
      }
    } catch (error) {
      console.error('Failed to update campaign contract:', error);
      throw error;
    }
  }

  /**
   * 部署合约（带幂等性保护）
   */
  async deployContractWithLock(campaignId: string, deployFn: () => Promise<any>): Promise<any> {
    // 检查是否正在部署
    if (this.deploymentLocks.has(campaignId)) {
      throw new Error('Contract deployment already in progress for this campaign');
    }

    // 创建部署Promise
    const deployPromise = deployFn();
    this.deploymentLocks.set(campaignId, deployPromise);

    try {
      const result = await deployPromise;
      return result;
    } finally {
      // 清理锁
      this.deploymentLocks.delete(campaignId);
    }
  }

  async getCampaignRecipients(campaignId: string): Promise<Array<{
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
      if (!campaignId || campaignId === 'undefined') {
        console.warn('getCampaignRecipients: Invalid campaignId provided:', campaignId);
        return [];
      }

      const recipients = await this.db.prepare(`
        SELECT * FROM recipients WHERE campaign_id = ? ORDER BY created_at
      `).all(campaignId) as any[] || [];

      if (!Array.isArray(recipients)) {
        console.warn('getCampaignRecipients: Database did not return an array, got:', typeof recipients, recipients);
        return [];
      }

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
      return []; // Return empty array instead of throwing error
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
      await this.db.prepare(`
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
      // 删除相关的接收者记录
      await this.db.prepare('DELETE FROM recipients WHERE campaign_id = ?').run(id);

      // 删除相关的交易记录
      await this.db.prepare('DELETE FROM transactions WHERE campaign_id = ?').run(id);

      // 删除活动
      await this.db.prepare('DELETE FROM campaigns WHERE id = ?').run(id);
    } catch (error) {
      console.error('Failed to delete campaign:', error);
      throw new Error('Campaign deletion failed');
    }
  }

  /**
   * 获取活动交易记录
   */
  async getCampaignTransactions(
    campaignId: string,
    options?: {
      limit?: number;
      offset?: number;
    }
  ): Promise<Array<{
    id: number;
    txHash: string;
    txType: string;
    fromAddress: string;
    toAddress?: string;
    amount?: string;
    gasUsed?: number;
    gasPrice?: string;
    gasCost?: number;
    status: string;
    blockNumber?: number;
    blockHash?: string;
    createdAt: string;
    confirmedAt?: string;
  }>> {
    try {
      if (!campaignId || campaignId === 'undefined') {
        console.warn('getCampaignTransactions: Invalid campaignId provided:', campaignId);
        return [];
      }

      let query = `
        SELECT * FROM transactions
        WHERE campaign_id = ?
        ORDER BY created_at DESC
      `;
      const params: any[] = [campaignId];

      if (options?.limit) {
        query += ' LIMIT ?';
        params.push(options.limit);
      }

      if (options?.offset) {
        query += ' OFFSET ?';
        params.push(options.offset);
      }

      const transactions = await this.db.prepare(query).all(...params) as any[] || [];

      if (!Array.isArray(transactions)) {
        console.warn('getCampaignTransactions: Database did not return an array, got:', typeof transactions, transactions);
        return [];
      }

      return transactions.map(row => ({
        id: row.id,
        txHash: row.tx_hash,
        txType: row.tx_type,
        fromAddress: row.from_address,
        toAddress: row.to_address,
        amount: row.amount,
        gasUsed: row.gas_used,
        gasPrice: row.gas_price,
        gasCost: row.gas_cost,
        status: row.status,
        blockNumber: row.block_number,
        blockHash: row.block_hash,
        createdAt: row.created_at,
        confirmedAt: row.confirmed_at,
      }));
    } catch (error) {
      console.error('Failed to get campaign transactions:', error);
      return []; // Return empty array instead of throwing error
    }
  }

  /**
   * 恢复活动
   */
  async resumeCampaign(id: string): Promise<{ success: boolean }> {
    try {
      const campaign = await this.getCampaignById(id);
      if (!campaign) {
        throw new Error('Campaign not found');
      }

      if (campaign.status !== 'PAUSED') {
        throw new Error('Only paused campaigns can be resumed');
      }

      // 更新状态为SENDING
      await this.updateCampaignStatus(id, 'SENDING');

      // 请求执行器恢复执行
      this.executor.resumeExecution(id);

      return { success: true };
    } catch (error) {
      console.error('Failed to resume campaign:', error);
      throw new Error('Campaign resume failed');
    }
  }

  /**
   * 取消活动
   */
  async cancelCampaign(id: string): Promise<{ success: boolean }> {
    try {
      const campaign = await this.getCampaignById(id);
      if (!campaign) {
        throw new Error('Campaign not found');
      }

      if (!['SENDING', 'PAUSED'].includes(campaign.status)) {
        throw new Error('Only sending or paused campaigns can be canceled');
      }

      // 请求执行器停止执行
      this.executor.cancelExecution(id);

      // 更新状态为FAILED
      await this.updateCampaignStatus(id, 'FAILED');

      return { success: true };
    } catch (error) {
      console.error('Failed to cancel campaign:', error);
      throw new Error('Campaign cancel failed');
    }
  }

  /**
   * 获取活动详细信息（包含统计数据）
   */
  async getCampaignDetails(id: string): Promise<{
    campaign: Campaign;
    stats: {
      totalRecipients: number;
      completedRecipients: number;
      failedRecipients: number;
      pendingRecipients: number;
      successRate: number;
      totalGasUsed: number;
      totalGasCost: number;
    };
  } | null> {
    try {
      const campaign = await this.getCampaignById(id);
      if (!campaign) {
        return null;
      }

      // 获取接收者统计
      const recipientStats = await this.db.prepare(`
        SELECT
          COUNT(*) as total,
          SUM(CASE WHEN status = 'SENT' THEN 1 ELSE 0 END) as completed,
          SUM(CASE WHEN status = 'FAILED' THEN 1 ELSE 0 END) as failed,
          SUM(CASE WHEN status = 'PENDING' THEN 1 ELSE 0 END) as pending
        FROM recipients
        WHERE campaign_id = ?
      `).get(id) as any;

      const successRate = recipientStats.total > 0
        ? (recipientStats.completed / recipientStats.total) * 100
        : 0;

      return {
        campaign,
        stats: {
          totalRecipients: recipientStats.total || 0,
          completedRecipients: recipientStats.completed || 0,
          failedRecipients: recipientStats.failed || 0,
          pendingRecipients: recipientStats.pending || 0,
          successRate: Math.round(successRate * 100) / 100,
          totalGasUsed: campaign.gasUsed,
          totalGasCost: campaign.gasCostUsd,
        },
      };
    } catch (error) {
      console.error('Failed to get campaign details:', error);
      throw new Error('Campaign details retrieval failed');
    }
  }

  /**
   * 重试失败的交易
   */
  async retryFailedTransactions(campaignId: string): Promise<void> {
    try {
      // 验证活动存在
      const campaign = await this.getCampaignById(campaignId);
      if (!campaign) {
        throw new Error('活动不存在');
      }

      // 验证活动状态
      if (campaign.status !== 'PAUSED') {
        throw new Error('只能重试暂停状态的活动');
      }

      // 重置所有失败和待处理的接收者为待发送状态
      const result = await this.db.prepare(`
        UPDATE recipients
        SET status = 'PENDING', tx_hash = NULL, gas_used = NULL, error_message = NULL, updated_at = ?
        WHERE campaign_id = ? AND status IN ('FAILED', 'PENDING')
      `).run(new Date().toISOString(), campaignId);

      console.log(`重置了 ${result.changes} 个失败的接收者`);
    } catch (error) {
      console.error('Failed to retry failed transactions:', error);
      throw error;
    }
  }

  /**
   * 检查是否为Solana链
   */
  private isSolanaChain(chain: string): boolean {
    return chain?.toLowerCase().includes('solana');
  }
}