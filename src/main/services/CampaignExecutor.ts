import { ContractService } from './ContractService';
import { WalletService } from './WalletService';
import { GasService } from './GasService';
import { BlockchainService } from './BlockchainService';
import { SolanaService } from './SolanaService';
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
    // Check if already executing
    if (this.executionMap.get(campaignId)) {
      throw new Error('Campaign is already executing');
    }

    try {
      this.executionMap.set(campaignId, true);
      this.pauseMap.set(campaignId, false);

      // Get campaign details
      const campaign = this.getCampaign(campaignId);
      if (!campaign) {
        throw new Error('Campaign not found');
      }

      // Validate campaign status
      if (campaign.status !== 'READY' && campaign.status !== 'PAUSED') {
        throw new Error('Campaign must be in READY or PAUSED status to execute');
      }

      // Decode private key from base64
      if (!campaign.walletPrivateKeyBase64) {
        throw new Error('Campaign wallet private key missing');
      }
      const privateKey = this.walletService.exportPrivateKey(campaign.walletPrivateKeyBase64);
      const wallet = { privateKey };

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
          this.addAuditLog(campaignId, 'EXECUTION_PAUSED', `Campaign paused at batch ${batchIndex + 1}/${totalBatches}`);
          break;
        }

        const start = batchIndex * batchSize;
        const end = Math.min(start + batchSize, recipients.length);
        const batch = recipients.slice(start, end);

        try {
          // Execute batch transfer
          await this.executeBatch(
            campaignId,
            campaign,
            batch,
            wallet,
            batchIndex + 1,
            totalBatches
          );

          // Update progress
          const completedCount = this.getCompletedRecipientCount(campaignId);
          const failedCount = this.getFailedRecipientCount(campaignId);

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
          console.error(`Batch ${batchIndex + 1} failed:`, error);

          // Mark batch recipients as failed
          batch.forEach(recipient => {
            this.updateRecipientStatus(campaignId, recipient.address, 'FAILED',
              error instanceof Error ? error.message : 'Unknown error');
          });

          // Continue with next batch instead of stopping entire campaign
          this.addAuditLog(campaignId, 'BATCH_FAILED',
            `Batch ${batchIndex + 1}/${totalBatches} failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      // Final status update
      const finalCompleted = this.getCompletedRecipientCount(campaignId);
      const finalFailed = this.getFailedRecipientCount(campaignId);
      const finalPending = this.getPendingRecipientCount(campaignId);

      if (finalPending === 0) {
        if (finalFailed === 0) {
          await this.updateCampaignStatus(campaignId, 'COMPLETED');
          this.addAuditLog(campaignId, 'CAMPAIGN_COMPLETED',
            `Campaign completed successfully. ${finalCompleted} recipients processed.`);
        } else {
          await this.updateCampaignStatus(campaignId, 'COMPLETED');
          this.addAuditLog(campaignId, 'CAMPAIGN_COMPLETED_WITH_ERRORS',
            `Campaign completed with errors. ${finalCompleted} succeeded, ${finalFailed} failed.`);
        }
      }

    } catch (error) {
      console.error('Campaign execution failed:', error);
      await this.updateCampaignStatus(campaignId, 'FAILED');
      this.addAuditLog(campaignId, 'EXECUTION_FAILED',
        `Campaign execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
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
      const rpcUrl = this.getRpcUrlForChain(campaign.chain);

      let result;

      if (this.isSolanaChain(campaign.chain)) {
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
        // Check if token approval is needed
        const approvalNeeded = await this.contractService.checkApproval(
          rpcUrl,
          wallet.privateKey,
          campaign.tokenAddress,
          campaign.contractAddress,
          amounts.reduce((sum, amt) => (BigInt(sum) + BigInt(amt)).toString(), '0')
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

          this.addAuditLog(campaignId, 'TOKEN_APPROVED',
            `Tokens approved for batch ${batchNumber}. Tx: ${approveTxHash}`);

          // Wait for approval confirmation
          await this.waitForConfirmation(campaign.chain, approveTxHash, rpcUrl);
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

      this.addAuditLog(campaignId, 'BATCH_SENT',
        `Batch ${batchNumber}/${totalBatches} sent. Tx: ${result.transactionHash}`);

      // Wait for transaction confirmation
      await this.waitForConfirmation(campaign.chain, result.transactionHash, rpcUrl);

      // Update recipient statuses to COMPLETED
      recipients.forEach(recipient => {
        this.updateRecipientStatus(campaignId, recipient.address, 'COMPLETED', result.transactionHash);
      });

      // Update campaign gas costs
      if (this.isSolanaChain(campaign.chain)) {
        // Solana gas费用以lamports为单位，需要转换为SOL
        this.updateCampaignGasCost(campaignId, parseInt(result.gasUsed));
      } else {
        // EVM gas费用
        this.updateCampaignGasCost(campaignId, result.gasUsed);
      }

      this.addAuditLog(campaignId, 'BATCH_CONFIRMED',
        `Batch ${batchNumber}/${totalBatches} confirmed. Gas used: ${result.gasUsed}`);

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
   * Cancel campaign execution
   */
  cancelExecution(campaignId: string): void {
    this.executionMap.set(campaignId, false);
    this.pauseMap.set(campaignId, true);
    console.log(`Cancel requested for campaign ${campaignId}`);
  }

  /**
   * Check if campaign is currently executing
   */
  isExecuting(campaignId: string): boolean {
    return this.executionMap.get(campaignId) || false;
  }

  // Helper methods
  private getCampaign(campaignId: string): any {
    return this.db.prepare('SELECT * FROM campaigns WHERE id = ?').get(campaignId);
  }

  private getPendingRecipients(campaignId: string): Recipient[] {
    return this.db.prepare(
      'SELECT address, amount, status FROM recipients WHERE campaign_id = ? AND status = ?'
    ).all(campaignId, 'PENDING') as Recipient[];
  }

  private getCompletedRecipientCount(campaignId: string): number {
    const result = this.db.prepare(
      'SELECT COUNT(*) as count FROM recipients WHERE campaign_id = ? AND status = ?'
    ).get(campaignId, 'COMPLETED') as { count: number };
    return result.count;
  }

  private getFailedRecipientCount(campaignId: string): number {
    const result = this.db.prepare(
      'SELECT COUNT(*) as count FROM recipients WHERE campaign_id = ? AND status = ?'
    ).get(campaignId, 'FAILED') as { count: number };
    return result.count;
  }

  private getPendingRecipientCount(campaignId: string): number {
    const result = this.db.prepare(
      'SELECT COUNT(*) as count FROM recipients WHERE campaign_id = ? AND status = ?'
    ).get(campaignId, 'PENDING') as { count: number };
    return result.count;
  }

  private async updateCampaignStatus(campaignId: string, status: string): Promise<void> {
    const now = new Date().toISOString();
    this.db.prepare(
      'UPDATE campaigns SET status = ?, updated_at = ? WHERE id = ?'
    ).run(status, now, campaignId);
  }

  private updateRecipientStatus(
    campaignId: string,
    address: string,
    status: string,
    txHash?: string
  ): void {
    const now = new Date().toISOString();
    this.db.prepare(
      'UPDATE recipients SET status = ?, tx_hash = ?, updated_at = ? WHERE campaign_id = ? AND address = ?'
    ).run(status, txHash || null, now, campaignId, address);
  }

  private updateCampaignGasCost(campaignId: string, gasUsed: string): void {
    const campaign = this.getCampaign(campaignId);
    const newGasUsed = Number(campaign.gas_used || 0) + Number(gasUsed);

    this.db.prepare(
      'UPDATE campaigns SET gas_used = ? WHERE id = ?'
    ).run(newGasUsed, campaignId);
  }

  private addAuditLog(campaignId: string, action: string, details: string): void {
    const now = new Date().toISOString();
    this.db.prepare(
      'INSERT INTO audit_logs (campaign_id, action, details, created_at) VALUES (?, ?, ?, ?)'
    ).run(campaignId, action, details, now);
  }

  private getRpcUrlForChain(chain: string): string {
    if (this.isSolanaChain(chain)) {
      const rpc = this.db.prepare(
        'SELECT endpoint FROM solana_rpcs WHERE is_active = 1 ORDER BY priority ASC LIMIT 1'
      ).get() as { endpoint: string } | undefined;
      return rpc?.endpoint || 'https://api.mainnet-beta.solana.com';
    } else {
      const evmChain = this.db.prepare(
        'SELECT rpc_url FROM evm_chains WHERE name = ?'
      ).get(chain) as { rpc_url: string } | undefined;
      return evmChain?.rpc_url || '';
    }
  }

  private isSolanaChain(chain: string): boolean {
    return chain.toLowerCase().includes('solana');
  }

  private async waitForConfirmation(
    chain: string,
    txHash: string,
    rpcUrl: string,
    maxAttempts: number = 60
  ): Promise<void> {
    if (this.isSolanaChain(chain)) {
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
}
