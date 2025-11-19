import { ethers } from 'ethers';
import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { PriceService } from './PriceService';

export interface BalanceData {
  native: string;
  token?: string;
}

export interface GasEstimate {
  gasLimit: string;
  gasPrice: string;
  gasCost: string;
  gasCostUsd: string;
}

export interface TransactionData {
  hash: string;
  status: 'pending' | 'confirmed' | 'failed';
  gasUsed?: string;
  effectiveGasPrice?: string;
  blockNumber?: number;
  blockHash?: string;
}

export class BlockchainService {
  private priceService: PriceService | null = null;

  constructor(priceService?: PriceService) {
    this.priceService = priceService || null;
  }

  async getBalance(
    address: string,
    chain: string,
    tokenAddress?: string,
    rpcUrl?: string
  ): Promise<BalanceData> {
    try {
      if (this.isSolanaChain(chain)) {
        return await this.getSolanaBalance(address, tokenAddress, rpcUrl);
      } else {
        return await this.getEVMBalance(address, chain, tokenAddress, rpcUrl);
      }
    } catch (error) {
      console.error('Failed to get balance:', error);
      throw new Error('Balance retrieval failed');
    }
  }

  private isSolanaChain(chain: string): boolean {
    return chain.toLowerCase().includes('solana');
  }

  private async getEVMBalance(
    address: string,
    chain: string,
    tokenAddress?: string,
    rpcUrl?: string
  ): Promise<BalanceData> {
    const provider = new ethers.JsonRpcProvider(rpcUrl || this.getDefaultRPC(chain));

    // 获取原生代币余额
    const nativeBalance = await provider.getBalance(address);

    let tokenBalance: string | undefined;
    if (tokenAddress) {
      try {
        // ERC20 ABI (只包含balanceOf)
        const erc20Abi = [
          'function balanceOf(address owner) view returns (uint256)',
          'function decimals() view returns (uint8)'
        ];

        const contract = new ethers.Contract(tokenAddress, erc20Abi, provider);
        const decimals = await contract.decimals();
        const balance = await contract.balanceOf(address);

        tokenBalance = ethers.formatUnits(balance, decimals);
      } catch (error) {
        console.error('Failed to get token balance:', error);
        tokenBalance = '0';
      }
    }

    return {
      native: ethers.formatEther(nativeBalance),
      token: tokenBalance,
    };
  }

  private async getSolanaBalance(
    address: string,
    tokenAddress?: string,
    rpcUrl?: string
  ): Promise<BalanceData> {
    const connection = new Connection(rpcUrl || 'https://api.mainnet-beta.solana.com');
    const publicKey = new PublicKey(address);

    // 获取SOL余额
    const solBalance = await connection.getBalance(publicKey);
    const nativeBalance = (solBalance / LAMPORTS_PER_SOL).toString();

    let tokenBalance: string | undefined;
    if (tokenAddress) {
      try {
        // 导入 SPL Token 程序
        const { TOKEN_PROGRAM_ID } = await import('@solana/spl-token');

        // 获取 token mint 地址
        const mintPublicKey = new PublicKey(tokenAddress);

        // 获取关联的 token 账户地址
        const tokenAccounts = await connection.getTokenAccountsByOwner(publicKey, {
          mint: mintPublicKey,
        });

        if (tokenAccounts.value.length > 0) {
          // 解析 token 账户数据
          const accountInfo = tokenAccounts.value[0].account;
          const data = Buffer.from(accountInfo.data);

          // Token账户数据结构: amount在偏移量64的位置，占8字节
          const amount = data.readBigUInt64LE(64);

          // 获取 token decimals
          const mintInfo = await connection.getParsedAccountInfo(mintPublicKey);
          const decimals = (mintInfo.value?.data as any)?.parsed?.info?.decimals || 9;

          // 转换为可读格式
          tokenBalance = (Number(amount) / Math.pow(10, decimals)).toString();
        } else {
          tokenBalance = '0';
        }
      } catch (error) {
        console.error('Failed to get SPL token balance:', error);
        tokenBalance = '0';
      }
    }

    return {
      native: nativeBalance,
      token: tokenBalance,
    };
  }

  async estimateGas(
    chain: string,
    fromAddress: string,
    toAddress?: string,
    tokenAddress?: string,
    recipientCount?: number,
    rpcUrl?: string
  ): Promise<GasEstimate> {
    try {
      if (this.isSolanaChain(chain)) {
        return await this.estimateSolanaGas(chain, recipientCount || 1, rpcUrl);
      } else {
        return await this.estimatEVMGas(chain, fromAddress, toAddress, tokenAddress, recipientCount, rpcUrl);
      }
    } catch (error) {
      console.error('Failed to estimate gas:', error);
      throw new Error('Gas estimation failed');
    }
  }

  private async estimatEVMGas(
    chain: string,
    _fromAddress: string,
    _toAddress?: string,
    tokenAddress?: string,
    recipientCount?: number,
    rpcUrl?: string
  ): Promise<GasEstimate> {
    const provider = new ethers.JsonRpcProvider(rpcUrl || this.getDefaultRPC(chain));

    // 获取当前gas价格
    const feeData = await provider.getFeeData();
    const gasPrice = feeData.gasPrice || ethers.parseUnits('20', 'gwei');

    let gasLimit: bigint;

    if (tokenAddress && recipientCount) {
      // 估算批量转账的gas
      gasLimit = await this.estimateBatchTransferGas(recipientCount);
    } else {
      // 默认gas限制
      gasLimit = BigInt('21000'); // 标准转账
    }

    const gasCost = gasLimit * gasPrice;
    const gasCostEth = ethers.formatEther(gasCost);

    // 获取ETH价格（简化处理，实际应该调用价格API）
    const ethPriceUsd = await this.getETHPriceUSD();
    const gasCostUsd = (parseFloat(gasCostEth) * ethPriceUsd).toFixed(6);

    return {
      gasLimit: gasLimit.toString(),
      gasPrice: ethers.formatUnits(gasPrice, 'gwei'),
      gasCost: gasCostEth,
      gasCostUsd,
    };
  }

  private async estimateBatchTransferGas(recipientCount: number): Promise<bigint> {
    // 简化的gas估算，实际应该部署合约进行精确估算
    // 每个ERC20转账约需要50000 gas
    const gasPerTransfer = BigInt('50000');
    const baseGas = BigInt('100000'); // 合约调用基础gas
    return baseGas + (gasPerTransfer * BigInt(recipientCount));
  }

  private async estimateSolanaGas(
    _chain: string,
    transactionCount: number,
    rpcUrl?: string
  ): Promise<GasEstimate> {
    // 简化处理，使用固定的费用计算
    void rpcUrl; // 避免未使用变量的警告
    const baseFeePerSignature = BigInt('5000');
    const totalLamports = baseFeePerSignature * BigInt(transactionCount * 2);
    const solCost = totalLamports / BigInt(LAMPORTS_PER_SOL);

    // 获取SOL价格
    const solPriceUsd = await this.getSOLPriceUSD();
    const solCostUsd = (Number(solCost) * solPriceUsd).toFixed(6);

    return {
      gasLimit: totalLamports.toString(),
      gasPrice: baseFeePerSignature.toString(),
      gasCost: solCost.toString(),
      gasCostUsd: solCostUsd,
    };
  }

  private getDefaultRPC(chain: string): string {
    const rpcMap: { [key: string]: string } = {
      'ethereum': 'https://eth.llamarpc.com',
      'polygon': 'https://polygon.llamarpc.com',
      'arbitrum': 'https://arbitrum.llamarpc.com',
      'optimism': 'https://optimism.llamarpc.com',
      'base': 'https://base.llamarpc.com',
      'bsc': 'https://bsc.llamarpc.com',
      'avalanche': 'https://avalanche.llamarpc.com',
    };

    return rpcMap[chain.toLowerCase()] || rpcMap['ethereum'];
  }

  private async getETHPriceUSD(): Promise<number> {
    if (this.priceService) {
      return await this.priceService.getPrice('ETH');
    }
    try {
      // Fallback to hardcoded price
      return 2000; // 假设ETH价格为$2000
    } catch (error) {
      return 2000; // 默认价格
    }
  }

  private async getSOLPriceUSD(): Promise<number> {
    if (this.priceService) {
      return await this.priceService.getPrice('SOL');
    }
    try {
      // Fallback to hardcoded price
      return 60; // 假设SOL价格为$60
    } catch (error) {
      return 60; // 默认价格
    }
  }

  async getTransactionStatus(
    txHash: string,
    chain: string,
    rpcUrl?: string
  ): Promise<TransactionData> {
    try {
      if (this.isSolanaChain(chain)) {
        return await this.getSolanaTransactionStatus(txHash, rpcUrl);
      } else {
        return await this.getEVMTransactionStatus(txHash, rpcUrl);
      }
    } catch (error) {
      console.error('Failed to get transaction status:', error);
      throw new Error('Transaction status retrieval failed');
    }
  }

  private async getEVMTransactionStatus(
    txHash: string,
    rpcUrl?: string
  ): Promise<TransactionData> {
    const provider = new ethers.JsonRpcProvider(rpcUrl);

    const receipt = await provider.getTransactionReceipt(txHash);

    if (!receipt) {
      return {
        hash: txHash,
        status: 'pending',
      };
    }

    return {
      hash: txHash,
      status: receipt.status === 1 ? 'confirmed' : 'failed',
      gasUsed: receipt.gasUsed?.toString(),
      effectiveGasPrice: receipt.gasPrice?.toString(),
      blockNumber: receipt.blockNumber,
      blockHash: receipt.blockHash,
    };
  }

  private async getSolanaTransactionStatus(
    txHash: string,
    rpcUrl?: string
  ): Promise<TransactionData> {
    const connection = new Connection(rpcUrl || 'https://api.mainnet-beta.solana.com');

    const signature = txHash;
    const status = await connection.getSignatureStatus(signature);

    if (!status.value) {
      return {
        hash: txHash,
        status: 'pending',
      };
    }

    const confirmed = !status.value.err;

    let blockNumber: number | undefined;
    if (confirmed) {
      try {
        const tx = await connection.getTransaction(signature);
        blockNumber = tx?.slot;
      } catch (error) {
        console.error('Failed to get block number:', error);
      }
    }

    return {
      hash: txHash,
      status: confirmed ? 'confirmed' : 'failed',
      blockNumber,
    };
  }

  async validateAddress(address: string, chain: string): Promise<boolean> {
    try {
      if (this.isSolanaChain(chain)) {
        try {
          new PublicKey(address);
          return true;
        } catch {
          return false;
        }
      } else {
        return ethers.isAddress(address);
      }
    } catch (error) {
      return false;
    }
  }

  async waitForTransactionConfirmation(
    txHash: string,
    chain: string,
    maxWaitTime = 300000, // 5分钟
    checkInterval = 5000 // 5秒
  ): Promise<TransactionData> {
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitTime) {
      try {
        const status = await this.getTransactionStatus(txHash, chain);

        if (status.status === 'confirmed') {
          return status;
        }

        if (status.status === 'failed') {
          return status;
        }

        // 等待下次检查
        await new Promise(resolve => setTimeout(resolve, checkInterval));
      } catch (error) {
        console.error('Error checking transaction status:', error);
        await new Promise(resolve => setTimeout(resolve, checkInterval));
      }
    }

    throw new Error('Transaction confirmation timeout');
  }
}