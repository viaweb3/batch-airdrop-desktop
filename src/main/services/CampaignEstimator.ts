import { GasService } from './GasService';
import { PriceService } from './PriceService';
import { ChainService } from './ChainService';
import type { DatabaseManager } from '../database/sqlite-schema';

export interface EstimateRequest {
  chain: string;
  tokenAddress: string;
  recipientCount: number;
  batchSize?: number;
}

export interface EstimateResult {
  totalRecipients: number;
  estimatedBatches: number;
  estimatedGasPerBatch: string;
  estimatedTotalGas: string;
  estimatedGasCostETH: string;
  estimatedGasCostUSD: string;
  estimatedDuration: string; // in minutes
  gasPrice: string;
  tokenSymbol?: string;
  recommendations: {
    optimalBatchSize: number;
    estimatedTimePerBatch: string; // in seconds
    totalEstimatedTime: string; // in minutes
  };
}

export class CampaignEstimator {
  private gasService: GasService;
  private priceService: PriceService;
  private chainService: ChainService;

  // Gas constants for different operations
  private readonly GAS_PER_TRANSFER = 21000; // Standard ETH transfer
  private readonly GAS_PER_ERC20_TRANSFER = 65000; // ERC20 transfer
  private readonly GAS_OVERHEAD_PER_BATCH = 50000; // Contract batch overhead
  private readonly DEFAULT_BATCH_SIZE = 100;
  private readonly SECONDS_PER_BATCH = 15; // Default sending interval

  constructor(databaseManager: DatabaseManager) {
    this.gasService = new GasService();
    this.priceService = new PriceService(databaseManager);
    this.chainService = new ChainService(databaseManager);
  }

  /**
   * Estimate campaign costs and duration
   */
  async estimate(request: EstimateRequest): Promise<EstimateResult> {
    try {
      const batchSize = request.batchSize || this.DEFAULT_BATCH_SIZE;
      const totalBatches = Math.ceil(request.recipientCount / batchSize);

      // Get chain configuration
      const chains = await this.chainService.getEVMChains(true);
      const chainConfig = chains.find(c => c.chainId.toString() === request.chain);

      if (!chainConfig) {
        throw new Error(`Chain configuration not found for chain ${request.chain}`);
      }

      // Get current gas price
      const gasPrice = await this.gasService.getGasPrice(request.chain);
      const gasPriceGwei = parseFloat(gasPrice);

      // Determine if it's ERC20 or native token
      const isNativeToken = !request.tokenAddress ||
        request.tokenAddress === '0x0000000000000000000000000000000000000000';

      // Calculate gas estimates
      const gasPerTransfer = isNativeToken
        ? this.GAS_PER_TRANSFER
        : this.GAS_PER_ERC20_TRANSFER;

      const gasPerBatch = (gasPerTransfer * batchSize) + this.GAS_OVERHEAD_PER_BATCH;
      const totalGas = gasPerBatch * totalBatches;

      // Calculate gas cost in ETH
      const gasCostWei = BigInt(totalGas) * BigInt(Math.floor(gasPriceGwei * 1e9));
      const gasCostETH = Number(gasCostWei) / 1e18;

      // Get ETH price in USD
      const ethPrice = await this.priceService.getPrice('ETH');
      const gasCostUSD = gasCostETH * ethPrice;

      // Calculate duration
      const totalTimeSeconds = totalBatches * this.SECONDS_PER_BATCH;
      const totalTimeMinutes = totalTimeSeconds / 60;

      // Calculate optimal batch size (balance between gas efficiency and speed)
      const optimalBatchSize = this.calculateOptimalBatchSize(
        request.recipientCount,
        gasPerTransfer
      );

      return {
        totalRecipients: request.recipientCount,
        estimatedBatches: totalBatches,
        estimatedGasPerBatch: gasPerBatch.toString(),
        estimatedTotalGas: totalGas.toString(),
        estimatedGasCostETH: gasCostETH.toFixed(6),
        estimatedGasCostUSD: gasCostUSD.toFixed(2),
        estimatedDuration: totalTimeMinutes.toFixed(1),
        gasPrice: gasPrice,
        tokenSymbol: chainConfig.symbol,
        recommendations: {
          optimalBatchSize,
          estimatedTimePerBatch: this.SECONDS_PER_BATCH.toString(),
          totalEstimatedTime: totalTimeMinutes.toFixed(1),
        },
      };
    } catch (error) {
      console.error('Failed to estimate campaign:', error);
      throw new Error('Campaign estimation failed');
    }
  }

  /**
   * Calculate optimal batch size based on recipient count and gas costs
   */
  private calculateOptimalBatchSize(recipientCount: number, gasPerTransfer: number): number {
    // For small campaigns, use smaller batches
    if (recipientCount < 50) {
      return Math.min(25, recipientCount);
    }

    // For medium campaigns
    if (recipientCount < 500) {
      return 50;
    }

    // For large campaigns, larger batches are more efficient
    if (recipientCount < 2000) {
      return 100;
    }

    // For very large campaigns
    return 200;
  }

  /**
   * Estimate token amount needed including buffer
   */
  async estimateTokenAmount(
    totalAmount: string,
    bufferPercentage: number = 5
  ): Promise<{
    requiredAmount: string;
    bufferAmount: string;
    totalWithBuffer: string;
  }> {
    try {
      const amount = parseFloat(totalAmount);
      const buffer = amount * (bufferPercentage / 100);
      const total = amount + buffer;

      return {
        requiredAmount: amount.toFixed(6),
        bufferAmount: buffer.toFixed(6),
        totalWithBuffer: total.toFixed(6),
      };
    } catch (error) {
      console.error('Failed to estimate token amount:', error);
      throw new Error('Token amount estimation failed');
    }
  }
}
