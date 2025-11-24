/**
 * 智能交易确认工具
 * 根据网络状况动态调整等待时间和重试策略
 */

import { ChainUtils } from './chain-utils';
import { RetryUtils } from './retry-utils';

export interface TransactionConfirmationOptions {
  maxWaitTime?: number;
  checkInterval?: number;
  maxAttempts?: number;
  networkCongestionMultiplier?: number;
  adaptiveTimeout?: boolean;
}

export interface NetworkStatus {
  isCongested: boolean;
  averageBlockTime: number;
  gasPriceLevel: 'low' | 'medium' | 'high';
  recommendedTimeout: number;
}

export interface ConfirmationResult {
  confirmed: boolean;
  finalStatus: 'confirmed' | 'failed' | 'timeout';
  transactionData?: any;
  attempts: number;
  totalTime: number;
  networkStatus?: NetworkStatus;
}

export class TransactionUtils {
  // 网络配置
  private static readonly NETWORK_CONFIGS = {
    // EVM 网络配置
    ethereum: { averageBlockTime: 12000, baseTimeout: 300000 }, // 12s block time, 5min base timeout
    polygon: { averageBlockTime: 2000, baseTimeout: 120000 },   // 2s block time, 2min base timeout
    arbitrum: { averageBlockTime: 250, baseTimeout: 60000 },     // 0.25s block time, 1min base timeout
    optimism: { averageBlockTime: 2000, baseTimeout: 120000 },    // 2s block time, 2min base timeout
    base: { averageBlockTime: 2000, baseTimeout: 120000 },       // 2s block time, 2min base timeout
    bsc: { averageBlockTime: 3000, baseTimeout: 180000 },       // 3s block time, 3min base timeout
    avalanche: { averageBlockTime: 2000, baseTimeout: 120000 },  // 2s block time, 2min base timeout

    // Solana 网络配置
    'solana-mainnet-beta': { averageBlockTime: 400, baseTimeout: 30000 }, // 0.4s slot time, 30s base timeout
    'solana-devnet': { averageBlockTime: 400, baseTimeout: 15000 },        // 0.4s slot time, 15s base timeout
    'solana-testnet': { averageBlockTime: 400, baseTimeout: 15000 },       // 0.4s slot time, 15s base timeout
  };

  /**
   * 智能等待交易确认
   */
  static async waitForTransactionConfirmation(
    chain: string,
    txHash: string,
    getTransactionStatus: (txHash: string) => Promise<any>,
    options: TransactionConfirmationOptions = {}
  ): Promise<ConfirmationResult> {
    const startTime = Date.now();
    const networkStatus = this.assessNetworkStatus(chain);
    const config = this.getNetworkConfig(chain);

    // 自适应超时时间
    const maxWaitTime = options.adaptiveTimeout
      ? networkStatus.recommendedTimeout * (options.networkCongestionMultiplier || 1)
      : options.maxWaitTime || config.baseTimeout;

    const checkInterval = options.checkInterval || this.calculateCheckInterval(chain, networkStatus);

    let attempts = 0;
    let finalStatus: 'confirmed' | 'failed' | 'timeout' = 'timeout';

    while (Date.now() - startTime < maxWaitTime) {
      attempts++;

      try {
        const status = await getTransactionStatus(txHash);

        if (status.status === 'confirmed') {
          finalStatus = 'confirmed';
          return {
            confirmed: true,
            finalStatus,
            transactionData: status,
            attempts,
            totalTime: Date.now() - startTime,
            networkStatus
          };
        }

        if (status.status === 'failed') {
          finalStatus = 'failed';
          return {
            confirmed: false,
            finalStatus,
            transactionData: status,
            attempts,
            totalTime: Date.now() - startTime,
            networkStatus
          };
        }

        // 动态调整检查间隔
        const elapsed = Date.now() - startTime;
        const dynamicInterval = this.calculateDynamicCheckInterval(
          elapsed,
          maxWaitTime,
          checkInterval,
          networkStatus
        );

        await this.sleep(dynamicInterval);

      } catch (error) {
        console.warn(`[Transaction Confirmation] Check ${attempts} failed:`, error);

        // 使用重试机制处理网络错误
        const retryResult = await RetryUtils.executeWithRetry(
          async () => {
            // 等待后重试
            await this.sleep(checkInterval);
            return await getTransactionStatus(txHash);
          },
          {
            ...RetryUtils.NETWORK_RETRY_OPTIONS,
            maxAttempts: 2,
            onRetry: (attempt, error, delay) => {
              console.warn(`[Transaction Confirmation] Network retry ${attempt}:`, error.message);
            }
          }
        );

        if (retryResult.success && retryResult.result?.status === 'confirmed') {
          finalStatus = 'confirmed';
          return {
            confirmed: true,
            finalStatus,
            transactionData: retryResult.result,
            attempts,
            totalTime: Date.now() - startTime,
            networkStatus
          };
        }
      }
    }

    return {
      confirmed: false,
      finalStatus,
      attempts,
      totalTime: Date.now() - startTime,
      networkStatus
    };
  }

  /**
   * 评估网络状态
   */
  private static assessNetworkStatus(chain: string): NetworkStatus {
    const config = this.getNetworkConfig(chain);

    // 简化的网络状态评估
    // 在实际项目中，可以集成网络监控API获取实时状态
    const isSolana = ChainUtils.isSolanaChain(chain);

    // 模拟网络拥堵检测（基于时间等）
    const currentHour = new Date().getHours();
    const isPeakHours = (currentHour >= 9 && currentHour <= 17) || (currentHour >= 20 && currentHour <= 23);

    const isCongested = isPeakHours;
    const gasPriceLevel = isCongested ? 'high' : isSolana ? 'low' : 'medium';

    // 根据网络拥堵情况调整推荐超时时间
    const congestionMultiplier = isCongested ? 1.5 : 1.0;
    const recommendedTimeout = Math.round(config.baseTimeout * congestionMultiplier);

    return {
      isCongested,
      averageBlockTime: config.averageBlockTime,
      gasPriceLevel: gasPriceLevel as 'low' | 'medium' | 'high',
      recommendedTimeout
    };
  }

  /**
   * 获取网络配置
   */
  private static getNetworkConfig(chain: string) {
    const normalizedChain = ChainUtils.normalizeChainIdentifier(chain);

    if (ChainUtils.isSolanaChain(chain)) {
      return this.NETWORK_CONFIGS[normalizedChain as keyof typeof this.NETWORK_CONFIGS] || this.NETWORK_CONFIGS['solana-mainnet-beta'];
    }

    // EVM链的配置映射
    const evmChainMap: Record<string, keyof typeof this.NETWORK_CONFIGS> = {
      '1': 'ethereum',
      '11155111': 'ethereum', // Sepolia使用相同的配置
      '137': 'polygon',
      '80001': 'polygon',     // Mumbai
      '42161': 'arbitrum',
      '421614': 'arbitrum',  // Arbitrum Sepolia
      '10': 'optimism',
      '11155420': 'optimism', // OP Sepolia
      '8453': 'base',
      '84532': 'base',      // Base Sepolia
      '56': 'bsc',
      '97': 'bsc',         // BSC Testnet
      '43114': 'avalanche',
      '43113': 'avalanche' // Avalanche Fuji
    };

    const chainKey = evmChainMap[normalizedChain] || 'ethereum';
    return this.NETWORK_CONFIGS[chainKey];
  }

  /**
   * 计算检查间隔
   */
  private static calculateCheckInterval(chain: string, networkStatus: NetworkStatus): number {
    const baseInterval = networkStatus.averageBlockTime;

    // 根据网络拥堵程度调整检查间隔
    if (ChainUtils.isSolanaChain(chain)) {
      // Solana 确认更快，但需要更多检查
      return networkStatus.isCongested ? 1000 : 500;
    }

    // EVM链根据拥堵程度调整
    return networkStatus.isCongested
      ? baseInterval * 1.5  // 拥堵时减少检查频率
      : baseInterval * 0.8; // 正常时增加检查频率
  }

  /**
   * 计算动态检查间隔
   */
  private static calculateDynamicCheckInterval(
    elapsed: number,
    maxWaitTime: number,
    baseInterval: number,
    networkStatus: NetworkStatus
  ): number {
    const progress = elapsed / maxWaitTime;

    // 随着时间推移，逐渐增加检查间隔
    let intervalMultiplier = 1.0;

    if (progress > 0.8) {
      // 最后20%时间，减少检查频率
      intervalMultiplier = 2.0;
    } else if (progress > 0.5) {
      // 中间时间段，稍微增加间隔
      intervalMultiplier = 1.5;
    }

    // 网络拥堵时进一步调整
    if (networkStatus.isCongested) {
      intervalMultiplier *= 1.2;
    }

    return Math.round(baseInterval * intervalMultiplier);
  }

  /**
   * 异步睡眠
   */
  private static sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 批量等待交易确认
   */
  static async waitForBatchTransactions(
    chain: string,
    txHashes: string[],
    getTransactionStatus: (txHash: string) => Promise<any>,
    options: TransactionConfirmationOptions = {}
  ): Promise<ConfirmationResult[]> {
    const results: ConfirmationResult[] = [];

    // 并行等待，但限制并发数以避免过载
    const concurrencyLimit = ChainUtils.isSolanaChain(chain) ? 5 : 3;

    for (let i = 0; i < txHashes.length; i += concurrencyLimit) {
      const batch = txHashes.slice(i, i + concurrencyLimit);

      const batchPromises = batch.map(async (txHash) => {
        return await this.waitForTransactionConfirmation(chain, txHash, getTransactionStatus, options);
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      // 批次间稍作停顿
      if (i + concurrencyLimit < txHashes.length) {
        await this.sleep(1000);
      }
    }

    return results;
  }
}