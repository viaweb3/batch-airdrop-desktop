import { ethers } from 'ethers';

export interface GasInfo {
  network: string;
  gasPrice: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
  estimatedGasLimit: string;
  estimatedCost: string;
  estimatedCostUsd: string;
  timestamp: string;
}

export class GasService {
  private readonly GAS_MULTIPLIER = 1.2; // 20% buffer for faster confirmation
  private readonly PRIORITY_FEE_MULTIPLIER = 1.5; // 50% buffer for priority fee

  /**
   * Get gas information from RPC directly
   */
  async getGasInfo(rpcUrl: string, network: string, tokenPrice: number = 0): Promise<GasInfo> {
    try {
      const provider = new ethers.JsonRpcProvider(rpcUrl);
      const feeData = await provider.getFeeData();

      let gasPrice = '0';
      let maxFeePerGas: string | undefined;
      let maxPriorityFeePerGas: string | undefined;

      // Check if network supports EIP-1559
      if (feeData.maxFeePerGas && feeData.maxPriorityFeePerGas) {
        // EIP-1559 transaction (Ethereum, Polygon, etc.)
        // Calculate adjusted fees with multipliers
        const adjustedMaxFee = (feeData.maxFeePerGas * BigInt(Math.floor(this.GAS_MULTIPLIER * 100))) / 100n;
        const adjustedPriorityFee = (feeData.maxPriorityFeePerGas * BigInt(Math.floor(this.PRIORITY_FEE_MULTIPLIER * 100))) / 100n;

        // Ensure maxPriorityFeePerGas never exceeds maxFeePerGas (EIP-1559 requirement)
        const finalPriorityFee = adjustedPriorityFee > adjustedMaxFee ? adjustedMaxFee : adjustedPriorityFee;

        maxFeePerGas = ethers.formatUnits(adjustedMaxFee, 'gwei');
        maxPriorityFeePerGas = ethers.formatUnits(finalPriorityFee, 'gwei');
        gasPrice = maxFeePerGas;
      } else if (feeData.gasPrice) {
        // Legacy transaction
        const adjustedGasPrice = (feeData.gasPrice * BigInt(Math.floor(this.GAS_MULTIPLIER * 100))) / 100n;
        gasPrice = ethers.formatUnits(adjustedGasPrice, 'gwei');
      }

      // Estimate gas for a standard transfer (as baseline)
      const estimatedGasLimit = await this.estimateGasLimit(provider, network);

      // Calculate estimated costs (fix BigInt type mixing)
      const gasPriceWei = ethers.parseUnits(gasPrice, 'gwei');
      const estimatedGasLimitBigInt = BigInt(estimatedGasLimit);
      const estimatedCostWei = gasPriceWei * estimatedGasLimitBigInt;
      const estimatedCost = ethers.formatEther(estimatedCostWei);
      const estimatedCostUsd = tokenPrice > 0
        ? (parseFloat(estimatedCost) * tokenPrice).toFixed(2)
        : '0.00';

      return {
        network,
        gasPrice,
        maxFeePerGas,
        maxPriorityFeePerGas,
        estimatedGasLimit,
        estimatedCost,
        estimatedCostUsd,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Failed to get gas info:', error);
      return this.getFallbackGasInfo(network, tokenPrice);
    }
  }

  /**
   * Estimate gas limit for different transaction types
   */
  private async estimateGasLimit(provider: ethers.JsonRpcProvider, network: string): Promise<string> {
    try {
      // Standard ERC20 transfer
      const erc20TransferGas = 65000;

      // Batch transfer estimate (base + recipients * per-recipient)
      const baseBatchGas = 80000;
      const perRecipientGas = 12000;

      // Contract interaction estimate
      const contractInteractionGas = 150000;

      // Return highest estimate as safe default
      return Math.max(erc20TransferGas, contractInteractionGas, baseBatchGas).toString();
    } catch (error) {
      // Fallback to safe defaults
      return '200000'; // Conservative estimate
    }
  }

  /**
   * Get fallback gas info for when RPC calls fail
   */
  private getFallbackGasInfo(network: string, tokenPrice: number = 0): GasInfo {
    const fallbackGasPrices: Record<string, number> = {
      'ethereum': 30,      // 30 Gwei
      'polygon': 30,       // 30 Gwei
      'arbitrum': 0.5,    // 0.5 Gwei
      'optimism': 0.5,    // 0.5 Gwei
      'bsc': 5,           // 5 Gwei
      'avalanche': 25,    // 25 Gwei
      'fantom': 20,       // 20 Gwei
      'default': 20       // 20 Gwei default
    };

    const gasPrice = (fallbackGasPrices[network.toLowerCase()] || fallbackGasPrices['default'])
      * this.GAS_MULTIPLIER;

    const estimatedGasLimit = '200000';
    const gasPriceWei = ethers.parseUnits(gasPrice.toString(), 'gwei');
    const estimatedCostWei = gasPriceWei * BigInt(estimatedGasLimit);
    const estimatedCost = ethers.formatEther(estimatedCostWei);
    const estimatedCostUsd = tokenPrice > 0
      ? (parseFloat(estimatedCost) * tokenPrice).toFixed(2)
      : '0.00';

    return {
      network,
      gasPrice: gasPrice.toFixed(2),
      maxFeePerGas: gasPrice.toFixed(2),
      maxPriorityFeePerGas: (gasPrice * 0.1).toFixed(2), // 10% of base fee
      estimatedGasLimit,
      estimatedCost,
      estimatedCostUsd,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Get detailed gas estimate for batch transfer
   */
  async getBatchGasEstimate(
    rpcUrl: string,
    network: string,
    recipientCount: number,
    tokenPrice: number = 0
  ): Promise<GasInfo & { estimatedGasLimit: string; totalRecipients: number }> {
    try {
      const provider = new ethers.JsonRpcProvider(rpcUrl);
      const feeData = await provider.getFeeData();

      // Calculate gas limit for batch transfer
      const baseGas = 80000;      // Base gas for contract call
      const perRecipientGas = 12000; // Gas per recipient
      const totalGasLimit = (baseGas + (perRecipientGas * recipientCount)).toString();

      let gasPrice = '0';
      let maxFeePerGas: string | undefined;
      let maxPriorityFeePerGas: string | undefined;

      if (feeData.maxFeePerGas && feeData.maxPriorityFeePerGas) {
        // EIP-1559 - use same logic as getGasInfo to ensure consistency
        const adjustedMaxFee = (feeData.maxFeePerGas * BigInt(Math.floor(this.GAS_MULTIPLIER * 100))) / 100n;
        const adjustedPriorityFee = (feeData.maxPriorityFeePerGas * BigInt(Math.floor(this.PRIORITY_FEE_MULTIPLIER * 100))) / 100n;

        // Ensure maxPriorityFeePerGas never exceeds maxFeePerGas (EIP-1559 requirement)
        const finalPriorityFee = adjustedPriorityFee > adjustedMaxFee ? adjustedMaxFee : adjustedPriorityFee;

        maxFeePerGas = ethers.formatUnits(adjustedMaxFee, 'gwei');
        maxPriorityFeePerGas = ethers.formatUnits(finalPriorityFee, 'gwei');
        gasPrice = maxFeePerGas;
      } else if (feeData.gasPrice) {
        // Legacy transaction
        const adjustedGasPrice = (feeData.gasPrice * BigInt(Math.floor(this.GAS_MULTIPLIER * 100))) / 100n;
        gasPrice = ethers.formatUnits(adjustedGasPrice, 'gwei');
      }

      // Calculate costs (fix BigInt type mixing)
      const gasPriceWei = ethers.parseUnits(gasPrice, 'gwei');
      const totalGasLimitBigInt = BigInt(totalGasLimit);
      const estimatedCostWei = gasPriceWei * totalGasLimitBigInt;
      const estimatedCost = ethers.formatEther(estimatedCostWei);
      const estimatedCostUsd = tokenPrice > 0
        ? (parseFloat(estimatedCost) * tokenPrice).toFixed(2)
        : '0.00';

      return {
        network,
        gasPrice,
        maxFeePerGas,
        maxPriorityFeePerGas,
        estimatedGasLimit: totalGasLimit,
        estimatedCost,
        estimatedCostUsd,
        timestamp: new Date().toISOString(),
        totalRecipients: recipientCount
      };
    } catch (error) {
      console.error('Failed to get batch gas estimate:', error);
      const fallback = this.getFallbackGasInfo(network, tokenPrice);
      const totalGasLimit = (80000 + (12000 * recipientCount)).toString();

      return {
        ...fallback,
        estimatedGasLimit: totalGasLimit,
        totalRecipients: recipientCount
      };
    }
  }

  /**
   * Get gas price for a specific network (simplified version)
   */
  async getGasPrice(chainId: string): Promise<string> {
    try {
      // For now, use fallback gas prices
      // In a real implementation, you would use RPC to get real-time gas price
      const fallbackGasPrices: Record<string, number> = {
        '1': 30,      // Ethereum
        '137': 30,    // Polygon
        '42161': 0.5, // Arbitrum
        '10': 0.5,    // Optimism
        '8453': 0.5,  // Base
        '56': 5,      // BSC
      };

      const gasPrice = fallbackGasPrices[chainId] || 20;
      return (gasPrice * this.GAS_MULTIPLIER).toFixed(2);
    } catch (error) {
      console.error('Failed to get gas price:', error);
      return '20.0';
    }
  }

  /**
   * Get transaction options with proper gas settings
   */
  getTransactionOptions(gasInfo: GasInfo): any {
    const options: any = {};

    if (gasInfo.maxFeePerGas && gasInfo.maxPriorityFeePerGas) {
      // EIP-1559 transaction
      options.maxFeePerGas = ethers.parseUnits(gasInfo.maxFeePerGas, 'gwei');
      options.maxPriorityFeePerGas = ethers.parseUnits(gasInfo.maxPriorityFeePerGas, 'gwei');
    } else {
      // Legacy transaction
      options.gasPrice = ethers.parseUnits(gasInfo.gasPrice, 'gwei');
    }

    options.gasLimit = BigInt(Math.floor(Number(gasInfo.estimatedGasLimit) * 1.1)); // 10% buffer

    return options;
  }

  /**
   * Estimate total gas cost for campaign
   */
  async estimateCampaignGasCost(
    rpcUrl: string,
    network: string,
    totalRecipients: number,
    batchSize: number = 100,
    tokenPrice: number = 0
  ): Promise<{ totalBatches: number; totalGasCost: string; totalGasCostUsd: string }> {
    const batchesNeeded = Math.ceil(totalRecipients / batchSize);
    let totalCostWei = BigInt(0);

    for (let i = 0; i < batchesNeeded; i++) {
      const recipientsInBatch = Math.min(batchSize, totalRecipients - (i * batchSize));
      const gasInfo = await this.getBatchGasEstimate(rpcUrl, network, recipientsInBatch, tokenPrice);
      const gasPriceWei = ethers.parseUnits(gasInfo.gasPrice, 'gwei');
      const batchCost = gasPriceWei * BigInt(gasInfo.estimatedGasLimit);
      totalCostWei += batchCost;
    }

    const totalCost = ethers.formatEther(totalCostWei);
    const totalCostUsd = tokenPrice > 0
      ? (parseFloat(totalCost) * tokenPrice).toFixed(2)
      : '0.00';

    return {
      totalBatches: batchesNeeded,
      totalGasCost: totalCost,
      totalGasCostUsd: totalCostUsd
    };
  }
}