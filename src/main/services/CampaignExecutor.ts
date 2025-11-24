import { ContractService } from './ContractService';
import { WalletService } from './WalletService';
import { GasService } from './GasService';
import { BlockchainService } from './BlockchainService';
import { SolanaService } from './SolanaService';
import { ChainUtils } from '../utils/chain-utils';
import { RetryUtils } from '../utils/retry-utils';
import { TransactionUtils } from '../utils/transaction-utils';
import type { DatabaseManager } from '../database/sqlite-schema';


export interface ExecutionProgress {
  campaignId: string;
  totalRecipients: number;
  completedRecipients: number;
  failedRecipients: number;
  status: 'EXECUTING' | 'PAUSED' | 'COMPLETED' | 'FAILED';
  currentBatch: number;
  totalBatches: number;
}

export interface Recipient {
  address: string;
  amount: string;
  status: string;
}

export class CampaignExecutor {
  private db: any;
  private contractService: ContractService;
  private walletService: WalletService;
  private gasService: GasService;
  private blockchainService: BlockchainService;
  private solanaService: SolanaService;
  private executionMap: Map<string, boolean> = new Map(); // Track active executions
  private pauseMap: Map<string, boolean> = new Map(); // Track pause requests

  constructor(databaseManager: DatabaseManager) {
    this.db = databaseManager.getDatabase();
    this.contractService = new ContractService();
    this.walletService = new WalletService();
    this.gasService = new GasService();
    this.blockchainService = new BlockchainService();
    this.solanaService = new SolanaService();
  }

  /**
   * Execute campaign batch transfers
   */
  async executeCampaign(
    campaignId: string,
    password: string,
    batchSize: number = 100,
    onProgress?: (progress: ExecutionProgress) => void
  ): Promise<void> {
    console.log(`[CampaignExecutor] Starting campaign execution for ${campaignId}`);

    // Check if already executing
    if (this.executionMap.get(campaignId)) {
      const error = new Error('Campaign is already executing');
      console.error('[CampaignExecutor] Campaign already executing:', error);
      throw error;
    }

    try {
      this.executionMap.set(campaignId, true);
      this.pauseMap.set(campaignId, false);

      // Get campaign details
      console.log('[CampaignExecutor] Fetching campaign details...');
      const campaign = await this.getCampaign(campaignId);
      if (!campaign) {
        throw new Error('Campaign not found');
      }
      console.log(`[CampaignExecutor] Campaign found: ${campaign.name}, Status: ${campaign.status}, Chain: ${campaign.chain}`);

      // Validate campaign status
      if (campaign.status !== 'READY' && campaign.status !== 'PAUSED') {
        throw new Error(`Campaign must be in READY or PAUSED status to execute (current: ${campaign.status})`);
      }

      // Decode private key from base64
      console.log('[CampaignExecutor] Decoding private key...');
      if (!campaign.walletPrivateKeyBase64) {
        throw new Error('Campaign wallet private key missing');
      }
      const privateKey = this.walletService.exportPrivateKey(campaign.walletPrivateKeyBase64);
      const wallet = { privateKey };
      console.log('[CampaignExecutor] Private key decoded successfully');

      // Get pending recipients
      const recipients = await this.getPendingRecipients(campaignId);
      if (recipients.length === 0) {
        await this.updateCampaignStatus(campaignId, 'COMPLETED');
        return;
      }

      // Calculate batches
      const totalBatches = Math.ceil(recipients.length / batchSize);

      // Update campaign status
      await this.updateCampaignStatus(campaignId, 'SENDING');

      // Process batches
      for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
        // Check for pause request
        if (this.pauseMap.get(campaignId)) {
          await this.updateCampaignStatus(campaignId, 'PAUSED');
          // Campaign paused at batch ${batchIndex + 1}/${totalBatches}
          break;
        }

        const start = batchIndex * batchSize;
        const end = Math.min(start + batchSize, recipients.length);
        const batch = recipients.slice(start, end);

        try {
          // Execute batch transfer with retry mechanism
          const batchResult = await RetryUtils.executeWithRetry(
            () => this.executeBatch(
              campaignId,
              campaign,
              batch,
              wallet,
              batchIndex + 1,
              totalBatches
            ),
            {
              ...RetryUtils.BLOCKCHAIN_RETRY_OPTIONS,
              maxAttempts: 3, // 批量操作减少重试次数
              onRetry: (attempt, error, delay) => {
                console.warn(`[Batch ${batchIndex + 1}/${totalBatches}] Retry attempt ${attempt} in ${delay}ms:`, error.message);
                // Retrying batch
                console.log(`Retrying batch ${batchIndex + 1}/${totalBatches} attempt ${attempt}: ${error.message}`);
              }
            }
          );

          if (!batchResult.success) {
            throw batchResult.error || new Error('Batch execution failed after retries');
          }

          // Update progress
          const completedCount = await this.getCompletedRecipientCount(campaignId);
          const failedCount = await this.getFailedRecipientCount(campaignId);

          if (onProgress) {
            onProgress({
              campaignId,
              totalRecipients: recipients.length,
              completedRecipients: completedCount,
              failedRecipients: failedCount,
              status: 'EXECUTING',
              currentBatch: batchIndex + 1,
              totalBatches,
            });
          }

          // Small delay between batches to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 2000));
        } catch (error) {
          console.error(`Batch ${batchIndex + 1} failed permanently:`, error);

          // Mark batch recipients as failed
          for (const recipient of batch) {
            await this.updateRecipientStatus(campaignId, recipient.address, 'FAILED',
              error instanceof Error ? error.message : 'Unknown error');
          }

          // Continue with next batch instead of stopping entire campaign
          // Batch failed
          console.log(`Batch ${batchIndex + 1}/${totalBatches} failed permanently: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      // Final status update
      const finalCompleted = await this.getCompletedRecipientCount(campaignId);
      const finalFailed = await this.getFailedRecipientCount(campaignId);
      const finalPending = await this.getPendingRecipientCount(campaignId);

      if (finalPending === 0) {
        if (finalFailed === 0) {
          await this.updateCampaignStatus(campaignId, 'COMPLETED');
          // Campaign completed successfully
          console.log(`Campaign completed successfully. ${finalCompleted} recipients processed.`);
        } else {
          await this.updateCampaignStatus(campaignId, 'COMPLETED');
          // Campaign completed with errors
          console.log(`Campaign completed with errors. ${finalCompleted} succeeded, ${finalFailed} failed.`);
        }
      }

    } catch (error) {
      console.error('[CampaignExecutor] ❌ Campaign execution failed:', {
        campaignId,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
      await this.updateCampaignStatus(campaignId, 'FAILED');

      // Re-throw with more context
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Campaign execution failed: ${errorMessage}`);
    } finally {
      this.executionMap.delete(campaignId);
      this.pauseMap.delete(campaignId);
    }
  }

  /**
   * Execute a single batch of transfers
   */
  private async executeBatch(
    campaignId: string,
    campaign: any,
    recipients: Recipient[],
    wallet: any,
    batchNumber: number,
    totalBatches: number
  ): Promise<void> {
    const addresses = recipients.map(r => r.address);
    const amounts = recipients.map(r => r.amount);

    try {
      // Get RPC URL based on chain
      const rpcUrl = await this.getRpcUrlForChain(campaign.chain);

      let result;

      if (ChainUtils.isSolanaChain(campaign.chain)) {
        // Solana批量转账 - 直接转账，不需要授权和合约
        result = await this.solanaService.batchTransfer(
          rpcUrl,
          wallet.privateKey,
          addresses,
          amounts,
          campaign.tokenAddress
        );
      } else {
        // EVM批量转账流程
        // Calculate total amount using ethers parseUnits to handle decimals
        const { ethers } = await import('ethers');
        const totalAmount = amounts.reduce((sum, amt) => {
          return sum + ethers.parseUnits(amt.toString(), campaign.tokenDecimals);
        }, 0n);

        // Check if token approval is needed
        const approvalNeeded = await this.contractService.checkApproval(
          rpcUrl,
          wallet.privateKey,
          campaign.tokenAddress,
          campaign.contractAddress,
          totalAmount.toString()
        );

        if (!approvalNeeded) {
          // Approve tokens
          const approveTxHash = await this.contractService.approveTokens(
            rpcUrl,
            wallet.privateKey,
            campaign.tokenAddress,
            campaign.contractAddress,
            amounts.reduce((sum, amt) => (BigInt(sum) + BigInt(amt)).toString(), '0')
          );

          // Record approval transaction
          await this.recordTransaction(campaignId, {
            txHash: approveTxHash,
            txType: 'APPROVE_TOKENS',
            fromAddress: campaign.walletAddress || '',
            toAddress: campaign.contractAddress,
            amount: amounts.reduce((sum, amt) => (BigInt(sum) + BigInt(amt)).toString(), '0'),
            status: 'PENDING'
          });

          // Token approved
          console.log(`Tokens approved for batch ${batchNumber}. Tx: ${approveTxHash}`);

          // Wait for approval confirmation
          await this.waitForConfirmation(campaign.chain, approveTxHash, rpcUrl);

          // Update approval transaction status
          await this.updateTransactionStatus(approveTxHash, 'CONFIRMED');
        }

        // Execute batch transfer using contract
        result = await this.contractService.batchTransfer(
          campaign.contractAddress,
          rpcUrl,
          wallet.privateKey,
          addresses,
          amounts,
          campaign.tokenAddress
        );
      }

      // Record batch transfer transaction
      await this.recordTransaction(campaignId, {
        txHash: result.transactionHash,
        txType: 'BATCH_SEND',
        fromAddress: campaign.walletAddress || '',
        toAddress: campaign.contractAddress,
        amount: amounts.reduce((sum, amt) => (BigInt(sum) + BigInt(amt)).toString(), '0'),
        gasUsed: parseFloat(result.gasUsed || '0'),
        status: 'PENDING'
      });

      // Batch sent
      console.log(`Batch ${batchNumber}/${totalBatches} sent. Tx: ${result.transactionHash}`);

      // Wait for transaction confirmation with adaptive timeout
      const confirmationOptions = {
        adaptiveTimeout: true,
        networkCongestionMultiplier: 1.2,
        maxWaitTime: ChainUtils.isSolanaChain(campaign.chain) ? 60000 : 300000
      };

      const getStatus = ChainUtils.isSolanaChain(campaign.chain)
        ? (txHash: string) => this.solanaService.getTransactionStatus(rpcUrl, txHash)
        : (txHash: string) => this.blockchainService.getTransactionStatus(campaign.chain, txHash, rpcUrl);

      const confirmationResult = await TransactionUtils.waitForTransactionConfirmation(
        campaign.chain,
        result.transactionHash,
        getStatus,
        confirmationOptions
      );

      // Update batch transfer transaction status
      await this.updateTransactionStatus(
        result.transactionHash,
        confirmationResult.confirmed ? 'CONFIRMED' : 'FAILED',
        confirmationResult.transactionData?.blockNumber,
        confirmationResult.transactionData?.blockHash
      );

      if (confirmationResult.confirmed) {
        // Update recipient statuses to COMPLETED
        for (const recipient of recipients) {
          await this.updateRecipientStatus(campaignId, recipient.address, 'COMPLETED', result.transactionHash);
        }

        // Batch confirmed
        console.log(`Batch ${batchNumber}/${totalBatches} confirmed. Attempts: ${confirmationResult.attempts}, Time: ${confirmationResult.totalTime}ms`);
      } else {
        // Transaction failed or timeout
        const errorMessage = confirmationResult.finalStatus === 'failed'
          ? 'Transaction failed'
          : 'Transaction confirmation timeout';

        for (const recipient of recipients) {
          await this.updateRecipientStatus(campaignId, recipient.address, 'FAILED', errorMessage);
        }

        this.addAuditLog(campaignId, 'BATCH_CONFIRMATION_FAILED',
          `Batch ${batchNumber}/${totalBatches} ${confirmationResult.finalStatus}. Attempts: ${confirmationResult.attempts}, Time: ${confirmationResult.totalTime}ms`);
      }

      // Update campaign gas costs
      if (ChainUtils.isSolanaChain(campaign.chain)) {
        // Solana gas费用以lamports为单位，需要转换为SOL
        this.updateCampaignGasCost(campaignId, result.gasUsed.toString());
      } else {
        // EVM gas费用
        this.updateCampaignGasCost(campaignId, result.gasUsed.toString());
      }

      // Batch confirmed
      console.log(`Batch ${batchNumber}/${totalBatches} confirmed. Gas used: ${result.gasUsed}`);

    } catch (error) {
      console.error('Batch execution failed:', error);
      throw error;
    }
  }

  /**
   * Request pause for campaign execution
   */
  pauseExecution(campaignId: string): void {
    this.pauseMap.set(campaignId, true);
    console.log(`Pause requested for campaign ${campaignId}`);
  }

  /**
   * Resume paused campaign execution
   */
  resumeExecution(campaignId: string): void {
    this.pauseMap.set(campaignId, false);
    console.log(`Resume requested for campaign ${campaignId}`);
  }

  
  /**
   * Check if campaign is currently executing
   */
  isExecuting(campaignId: string): boolean {
    return this.executionMap.get(campaignId) || false;
  }

  // Helper methods
  private async getCampaign(campaignId: string): Promise<any> {
    console.log('[CampaignExecutor] getCampaign called for:', campaignId);
    const row = await this.db.prepare('SELECT * FROM campaigns WHERE id = ?').get(campaignId);
    console.log('[CampaignExecutor] Database row:', row ? 'FOUND' : 'NOT FOUND');

    if (!row) {
      console.log('[CampaignExecutor] Campaign not found in database');
      return null;
    }

    console.log('[CampaignExecutor] Raw row data:', {
      id: row.id,
      name: row.name,
      status: row.status,
      chain_type: row.chain_type,
      chain_id: row.chain_id
    });

    // Map database fields (snake_case) to application fields (camelCase)
    const mapped = {
      id: row.id,
      name: row.name,
      status: row.status,
      chain: row.chain || (row.chain_type === 'evm' ? row.chain_id?.toString() : row.network),
      tokenAddress: row.token_address,
      tokenDecimals: row.token_decimals || 18,
      walletAddress: row.wallet_address,
      walletPrivateKeyBase64: row.wallet_private_key_base64,
      contractAddress: row.contract_address,
      batchSize: row.batch_size || 100,
      sendInterval: row.send_interval || 2000
    };

    console.log('[CampaignExecutor] Mapped campaign:', {
      name: mapped.name,
      status: mapped.status,
      chain: mapped.chain
    });

    return mapped;
  }

  private async getPendingRecipients(campaignId: string): Promise<Recipient[]> {
    return await this.db.prepare(
      'SELECT address, amount, status FROM recipients WHERE campaign_id = ? AND status = ?'
    ).all(campaignId, 'PENDING') as Recipient[];
  }

  private async getCompletedRecipientCount(campaignId: string): Promise<number> {
    const result = await this.db.prepare(
      'SELECT COUNT(*) as count FROM recipients WHERE campaign_id = ? AND status = ?'
    ).get(campaignId, 'COMPLETED') as { count: number };
    return result.count;
  }

  private async getFailedRecipientCount(campaignId: string): Promise<number> {
    const result = await this.db.prepare(
      'SELECT COUNT(*) as count FROM recipients WHERE campaign_id = ? AND status = ?'
    ).get(campaignId, 'FAILED') as { count: number };
    return result.count;
  }

  private async getPendingRecipientCount(campaignId: string): Promise<number> {
    const result = await this.db.prepare(
      'SELECT COUNT(*) as count FROM recipients WHERE campaign_id = ? AND status = ?'
    ).get(campaignId, 'PENDING') as { count: number };
    return result.count;
  }

  private async updateCampaignStatus(campaignId: string, status: string): Promise<void> {
    const now = new Date().toISOString();
    await this.db.prepare(
      'UPDATE campaigns SET status = ?, updated_at = ? WHERE id = ?'
    ).run(status, now, campaignId);
  }

  private async updateRecipientStatus(
    campaignId: string,
    address: string,
    status: string,
    txHash?: string
  ): Promise<void> {
    await this.db.prepare(
      'UPDATE recipients SET status = ?, tx_hash = ? WHERE campaign_id = ? AND address = ?'
    ).run(status, txHash || null, campaignId, address);
  }

  private async updateCampaignGasCost(campaignId: string, gasUsed: string): Promise<void> {
    const campaign = await this.getCampaign(campaignId);
    const newGasUsed = Number(campaign.gas_used || 0) + Number(gasUsed);

    await this.db.prepare(
      'UPDATE campaigns SET gas_used = ? WHERE id = ?'
    ).run(newGasUsed, campaignId);
  }

  private addAuditLog(campaignId: string, action: string, details: string): void {
    // TODO: audit_logs table not created yet - temporarily disabled
    console.log(`[AUDIT] ${action}: ${details} for campaign ${campaignId}`);
    // const now = new Date().toISOString();
    // this.db.prepare(
    //   'INSERT INTO audit_logs (campaign_id, action, details, created_at) VALUES (?, ?, ?, ?)'
    // ).run(campaignId, action, details, now);
  }

  private async getRpcUrlForChain(chain: string): Promise<string> {
    if (ChainUtils.isSolanaChain(chain)) {
      const rpc = await this.db.prepare(
        'SELECT rpc_url FROM chains WHERE type = ? AND enabled = 1 ORDER BY priority ASC LIMIT 1'
      ).get('solana') as { rpc_url: string } | undefined;
      return rpc?.rpc_url || 'https://api.mainnet-beta.solana.com';
    } else {
      // Try to find chain by chain_id first (most reliable)
      const chainId = parseInt(chain);
      let evmChain;

      if (!isNaN(chainId)) {
        evmChain = await this.db.prepare(
          'SELECT rpc_url FROM chains WHERE type = ? AND chain_id = ? AND enabled = 1'
        ).get('evm', chainId) as { rpc_url: string } | undefined;
      }

      // Fallback to name-based search
      if (!evmChain) {
        evmChain = await this.db.prepare(
          'SELECT rpc_url FROM chains WHERE type = ? AND name LIKE ? AND enabled = 1'
        ).get('evm', `%${chain}%`) as { rpc_url: string } | undefined;
      }

      if (!evmChain || !evmChain.rpc_url) {
        throw new Error(`RPC URL not found for chain: ${chain}. Please check chain configuration.`);
      }

      return evmChain.rpc_url;
    }
  }

  private async waitForConfirmation(
    chain: string,
    txHash: string,
    rpcUrl: string,
    maxAttempts: number = 60
  ): Promise<void> {
    if (ChainUtils.isSolanaChain(chain)) {
      return await this.waitForSolanaConfirmation(txHash, rpcUrl);
    } else {
      return await this.waitForEVMConfirmation(txHash, rpcUrl, maxAttempts);
    }
  }

  private async waitForSolanaConfirmation(
    txHash: string,
    rpcUrl: string
  ): Promise<void> {
    const maxWaitTime = 30000; // 30秒超时
    const checkInterval = 1000; // 1秒检查一次
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitTime) {
      try {
        if (this.solanaService) {
          const status = await this.solanaService.getTransactionStatus(rpcUrl, txHash);

          if (status.status === 'confirmed') {
            console.log(`Solana transaction confirmed: ${txHash}`);
            return;
          } else if (status.status === 'failed') {
            throw new Error(`Solana transaction failed: ${status.error}`);
          }
        }

        // 动态调整检查间隔 - 开始时更频繁，之后减少
        const elapsed = Date.now() - startTime;
        let nextWaitTime = checkInterval;

        if (elapsed < 5000) {
          nextWaitTime = 500; // 前5秒每0.5秒检查一次
        } else if (elapsed < 15000) {
          nextWaitTime = 1000; // 5-15秒每1秒检查一次
        } else {
          nextWaitTime = 2000; // 15秒后每2秒检查一次
        }

        await new Promise(resolve => setTimeout(resolve, nextWaitTime));
      } catch (error) {
        console.error(`Failed to check Solana transaction status:`, error);

        // 网络错误时短暂等待后重试
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    throw new Error(`Solana transaction confirmation timeout after ${maxWaitTime}ms`);
  }

  private async waitForEVMConfirmation(
    txHash: string,
    rpcUrl: string,
    maxAttempts: number = 60
  ): Promise<void> {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const status = await this.blockchainService.getTransactionStatus('ethereum', txHash, rpcUrl);

        if (status.status === 'confirmed') {
          return;
        }

        // EVM交易确认较慢，使用更长的间隔
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (error) {
        console.error(`Failed to check EVM transaction status (attempt ${attempt + 1}):`, error);

        if (attempt === maxAttempts - 1) {
          throw new Error('EVM transaction confirmation timeout');
        }
      }
    }

    throw new Error('EVM transaction confirmation timeout');
  }

  /**
   * 记录交易
   */
  private async recordTransaction(campaignId: string, transactionData: {
    txHash: string;
    txType: 'DEPLOY_CONTRACT' | 'TRANSFER_TO_CONTRACT' | 'APPROVE_TOKENS' | 'BATCH_SEND' | 'WITHDRAW_REMAINING';
    fromAddress: string;
    toAddress?: string;
    amount?: string;
    gasUsed?: number;
    status?: 'PENDING' | 'CONFIRMED' | 'FAILED';
  }): Promise<void> {
    try {
      await this.db.prepare(`
        INSERT OR REPLACE INTO transactions (
          campaign_id, tx_hash, tx_type, from_address, to_address, amount,
          gas_used, status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        campaignId,
        transactionData.txHash,
        transactionData.txType,
        transactionData.fromAddress,
        transactionData.toAddress || null,
        transactionData.amount || null,
        transactionData.gasUsed || 0,
        transactionData.status || 'PENDING',
        new Date().toISOString()
      );

      console.log(`Transaction recorded: ${transactionData.txType} - ${transactionData.txHash}`);
    } catch (error) {
      console.error('Failed to record transaction:', error);
      // Don't throw error - recording transaction failure shouldn't break the main flow
    }
  }

  /**
   * 更新交易状态
   */
  private async updateTransactionStatus(
    txHash: string,
    status: 'PENDING' | 'CONFIRMED' | 'FAILED',
    blockNumber?: number,
    blockHash?: string
  ): Promise<void> {
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
      console.log(`Transaction status updated: ${txHash} -> ${status}`);
    } catch (error) {
      console.error('Failed to update transaction status:', error);
    }
  }
}
