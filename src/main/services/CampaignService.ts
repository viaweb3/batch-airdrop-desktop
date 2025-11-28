import { v4 as uuidv4 } from 'uuid';
import { WalletService } from './WalletService';
import { CampaignExecutor } from './CampaignExecutor';
import { ChainUtils } from '../utils/chain-utils';
import { Logger } from '../utils/logger';
import { DatabaseManager } from '../database/sqlite-schema';
import type { DatabaseAdapter } from '../database/db-adapter';

const logger = Logger.getInstance().child('CampaignService');

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
  private db: DatabaseAdapter;
  private walletService: WalletService;
  private executor: CampaignExecutor;
  private databaseManager: DatabaseManager;
  private deploymentLocks: Map<string, Promise<any>> = new Map();

  constructor(databaseManager: DatabaseManager) {
    logger.debug('[CampaignService] Initializing campaign service');

    this.db = databaseManager.getDatabase();
    this.databaseManager = databaseManager;
    this.walletService = new WalletService();
    this.executor = new CampaignExecutor(databaseManager);

    logger.info('[CampaignService] Campaign service initialized', {
      databaseManager: databaseManager.constructor.name
    });
  }

  async createCampaign(data: CampaignData): Promise<Campaign> {
    const id = uuidv4();
    const now = new Date().toISOString();

    logger.info('[CampaignService] Creating new campaign', {
      campaignId: id,
      name: data.name,
      chain: data.chain,
      recipientsCount: data.recipients.length
    });

    try {
      // 使用统一的链类型判断工具
      const chainType = ChainUtils.getChainType(data.chain);
      // 统一使用 chain_id，不再使用 network 字段
      const chainId = parseInt(data.chain);

      // 根据链类型创建钱包
      const wallet = this.createWalletForChain(chainType);

      logger.debug('[CampaignService] Campaign wallet created', {
        address: wallet.address,
        chain: data.chain,
        chainType,
        hasPrivateKey: !!wallet.privateKeyBase64,
        privateKeyLength: wallet.privateKeyBase64?.length || 0
      });

      const insertCampaign = this.db.prepare(`
        INSERT INTO campaigns (
          id, name, description, chain_type, chain_id, token_address, token_symbol, token_name, token_decimals, status, total_recipients,
          wallet_address, wallet_private_key_base64, batch_size, send_interval,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      logger.debug('[CampaignService] Inserting campaign data into database', {
        campaignId: id,
        name: data.name,
        chainType,
        chainId,
        walletAddress: wallet.address,
        recipientsCount: data.recipients.length
      });

      await insertCampaign.run(
        id,
        data.name,
        data.description || null,
        chainType,
        chainId,
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

      logger.debug('[CampaignService] Campaign data inserted successfully', { campaignId: id });

      // 在事务中插入接收者并分配批次号
      await this.db.transaction(async (tx) => {
        // 插入接收者并设置批次号
        const insertRecipient = tx.prepare(`
          INSERT INTO recipients (
            campaign_id, address, amount, status, batch_number, created_at
          ) VALUES (?, ?, ?, 'PENDING', ?, ?)
        `);

        for (let i = 0; i < data.recipients.length; i++) {
          const recipient = data.recipients[i];
          const batchNumber = Math.floor(i / (data.batchSize || 100)) + 1;
          await insertRecipient.run(id, recipient.address, recipient.amount, batchNumber, now);
        }

              });

      const campaign = await this.getCampaignById(id);
      if (!campaign) {
        throw new Error('Campaign creation failed - campaign not found');
      }
      return campaign;
    } catch (error) {
      logger.error('[CampaignService] Campaign creation failed', error as Error, {
      campaignId: id,
      name: data.name,
      chain: data.chain
    });

      throw new Error('Campaign creation failed');
    }
  }

  private createWalletForChain(chainType: 'evm' | 'solana') {
    if (chainType === 'solana') {
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
      logger.error('[CampaignService] Failed to list campaigns', error as Error, { filters });
      throw new Error('Campaign listing failed');
    }
  }

  async getCampaignById(id: string): Promise<Campaign | null> {
    try {
      const row = await this.db.prepare('SELECT * FROM campaigns WHERE id = ?').get(id) as any;
      return row ? this.mapRowToCampaign(row) : null;
    } catch (error) {
      logger.error('[CampaignService] Failed to get campaign by ID', error as Error, { id });
      throw new Error('Campaign retrieval failed');
    }
  }

  private mapRowToCampaign(row: any): Campaign {
        const campaign = {
      id: row.id,
      name: row.name,
      description: row.description,
      // 统一使用 chain_id
      chain: row.chain_id?.toString() || '',
      chainId: row.chain_id,
      chainType: row.chain_type,
      tokenAddress: row.token_address,
      tokenSymbol: row.token_symbol,
      tokenDecimals: row.token_decimals || 18,
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
        return campaign;
  }

  async updateCampaignStatus(id: string, status: Campaign['status']): Promise<void> {
    try {
      const now = new Date().toISOString();
      await this.db.prepare(
        'UPDATE campaigns SET status = ?, updated_at = ? WHERE id = ?'
      ).run(status, now, id);
    } catch (error) {
      logger.error('[CampaignService] Failed to update campaign status', error as Error, { id, status });
      throw new Error('Campaign status update failed');
    }
  }

  async startCampaign(
    id: string,
    onProgress?: (progress: any) => void
  ): Promise<{ success: boolean }> {
    try {
      const campaign = await this.getCampaignById(id);
      if (!campaign) {
        throw new Error('Campaign not found');
      }

      // 统一要求 READY 或 PAUSED 状态
      if (campaign.status !== 'READY' && campaign.status !== 'PAUSED') {
        if (!ChainUtils.isSolanaChain(campaign.chain)) {
          throw new Error('Campaign is not ready to start. Please deploy the contract first.');
        } else {
          throw new Error('Solana campaign must be ready before starting.');
        }
      }

      
      // Execute campaign in background (non-blocking)
    this.executor.executeCampaign(id, onProgress).catch(error => {
      logger.error('Campaign execution failed', error as Error, { id });
    });

      return { success: true };
    } catch (error) {
      logger.error('[CampaignService] Failed to start campaign', error as Error, { id });
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
      logger.error('[CampaignService] Failed to pause campaign', error as Error, { id });
      throw new Error('Campaign pause failed');
    }
  }

  async updateProgress(id: string, completedCount?: number): Promise<void> {
    try {
      // IMPORTANT: Ignore the completedCount parameter and always calculate from recipients table
      // This ensures data consistency by using a single source of truth
      const counts = await this.db.prepare(`
        SELECT
          COUNT(CASE WHEN status = 'SENT' THEN 1 END) as completed,
          COUNT(CASE WHEN status = 'FAILED' THEN 1 END) as failed
        FROM recipients
        WHERE campaign_id = ?
      `).get(id) as any;

      const now = new Date().toISOString();
      await this.db.prepare(
        'UPDATE campaigns SET completed_recipients = ?, failed_recipients = ?, updated_at = ? WHERE id = ?'
      ).run(counts.completed || 0, counts.failed || 0, now, id);

      logger.debug('[CampaignService] Progress updated from aggregation', {
        campaignId: id,
        completed: counts.completed || 0,
        failed: counts.failed || 0
      });
    } catch (error) {
      logger.error('[CampaignService] Failed to update campaign progress', error as Error, { id });
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
      logger.error('[CampaignService] Failed to update campaign contract', error as Error, { id, contractAddress });
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
        logger.warn('Invalid campaignId provided', { campaignId });
        return [];
      }

      const recipients = await this.db.prepare(`
        SELECT * FROM recipients WHERE campaign_id = ? ORDER BY created_at
      `).all(campaignId) as any[] || [];

      if (!Array.isArray(recipients)) {
        logger.warn('Database did not return an array', { type: typeof recipients, recipients });
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
      logger.error('[CampaignService] Failed to get campaign recipients', error as Error, { campaignId });
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

      // NOTE: Progress is automatically updated by CampaignExecutor.updateRecipientStatusesTransaction
      // which uses a transaction to update both recipients and campaigns table atomically.
      // We don't need to call updateProgress here to avoid double updates.
    } catch (error) {
      logger.error('[CampaignService] Failed to update recipient status', error as Error, { campaignId, address, status });
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
      logger.error('[CampaignService] Failed to delete campaign', error as Error, { id });
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
    recipientCount?: number;
    createdAt: string;
    confirmedAt?: string;
  }>> {
    try {
      if (!campaignId || campaignId === 'undefined') {
        logger.warn('Invalid campaignId provided for transactions', { campaignId });
        return [];
      }

      let query = `
        SELECT
          t.*,
          COUNT(DISTINCT r.id) as recipient_count
        FROM transactions t
        LEFT JOIN recipients r ON r.tx_hash = t.tx_hash AND r.campaign_id = t.campaign_id
        WHERE t.campaign_id = ?
        GROUP BY t.id
        ORDER BY t.created_at ASC
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
        logger.warn('Database did not return an array for transactions', { type: typeof transactions, transactions });
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
        recipientCount: row.recipient_count || 0,
        createdAt: row.created_at,
        confirmedAt: row.confirmed_at,
      }));
    } catch (error) {
      logger.error('[CampaignService] Failed to get campaign transactions', error as Error, { campaignId });
      return []; // Return empty array instead of throwing error
    }
  }

  /**
   * 记录交易
   */
  async recordTransaction(campaignId: string, transactionData: {
    txHash: string;
    txType: 'DEPLOY_CONTRACT' | 'TRANSFER_TO_CONTRACT' | 'APPROVE_TOKENS' | 'BATCH_SEND' | 'WITHDRAW_REMAINING';
    fromAddress: string;
    toAddress?: string;
    amount?: string;
    gasUsed?: number;
    gasPrice?: string;
    gasCost?: number;
    status?: 'PENDING' | 'CONFIRMED' | 'FAILED';
    blockNumber?: number;
    blockHash?: string;
  }): Promise<void> {
    try {
      await this.db.prepare(`
        INSERT OR REPLACE INTO transactions (
          campaign_id, tx_hash, tx_type, from_address, to_address, amount,
          gas_used, gas_price, gas_cost, status, block_number, block_hash, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        campaignId,
        transactionData.txHash,
        transactionData.txType,
        transactionData.fromAddress,
        transactionData.toAddress || null,
        transactionData.amount || null,
        transactionData.gasUsed || 0,
        transactionData.gasPrice || null,
        transactionData.gasCost || 0,
        transactionData.status || 'PENDING',
        transactionData.blockNumber || null,
        transactionData.blockHash || null,
        new Date().toISOString()
      );

          } catch (error) {
      logger.error('[CampaignService] Failed to record transaction', error as Error, { campaignId, txHash: transactionData.txHash });
      // Don't throw error - recording transaction failure shouldn't break the main flow
    }
  }

  /**
   * 更新交易状态
   */
  async updateTransactionStatus(txHash: string, status: 'PENDING' | 'CONFIRMED' | 'FAILED', blockNumber?: number, blockHash?: string): Promise<void> {
    try {
      const updates: any[] = [status, new Date().toISOString(), txHash];
      let query = `
        UPDATE transactions
        SET status = ?, confirmed_at = ?
      `;

      if (blockNumber) {
        query += `, block_number = ?`;
        updates.splice(-1, 0, blockNumber); // Insert before txHash
      }

      if (blockHash) {
        query += `, block_hash = ?`;
        updates.splice(-1, 0, blockHash); // Insert before txHash
      }

      query += ` WHERE tx_hash = ?`;

      await this.db.prepare(query).run(...updates);
          } catch (error) {
      logger.error('[CampaignService] Failed to update transaction status', error as Error, { txHash, status });
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
      await this.executor.resumeExecution(id);

      return { success: true };
    } catch (error) {
      logger.error('[CampaignService] Failed to resume campaign', error as Error, { id });
      throw new Error('Campaign resume failed');
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
      logger.error('[CampaignService] Failed to get campaign details', error as Error, { id });
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

          } catch (error) {
      logger.error('[CampaignService] Failed to retry failed transactions', error as Error, { campaignId });
      throw error;
    }
  }

  }