import { ethers } from 'ethers';
import { Connection, PublicKey, LAMPORTS_PER_SOL, Keypair, Transaction, SystemProgram, sendAndConfirmTransaction } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress, createTransferInstruction, getAccount } from '@solana/spl-token';
import { PriceService } from './PriceService';
import { ChainUtils } from '../utils/chain-utils';
import type { DatabaseManager } from '../database/sqlite-schema';

export interface BalanceData {
  native: string;
  token?: string;
}

export interface GasEstimate {
  gasLimit: string;
  gasPrice: string;
  gasCost: string;
  gasCostUsd: string;
  networkInfo?: {
    blockhash?: string;
    lastValidBlockHeight?: number;
    priorityFee?: string;
    baseFee?: string;
    fallback?: boolean;
    reason?: string;
  };
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
  private databaseManager: DatabaseManager | null = null;

  constructor(priceService?: PriceService, databaseManager?: DatabaseManager) {
    this.priceService = priceService || null;
    this.databaseManager = databaseManager || null;
  }

  async getBalance(
    address: string,
    chain: string,
    tokenAddress?: string,
    tokenDecimals?: number,
    rpcUrl?: string
  ): Promise<BalanceData> {
    try {
      if (ChainUtils.isSolanaChain(chain)) {
        return await this.getSolanaBalance(address, tokenAddress, rpcUrl);
      } else {
        return await this.getEVMBalance(address, chain, tokenAddress, tokenDecimals, rpcUrl);
      }
    } catch (error) {
      console.error('Failed to get balance:', error);
      throw new Error('Balance retrieval failed');
    }
  }

  private async getEVMBalance(
    address: string,
    chain: string,
    tokenAddress?: string,
    tokenDecimals?: number,
    rpcUrl?: string
  ): Promise<BalanceData> {
    const effectiveRpcUrl = rpcUrl || await this.getDefaultRPC(chain);
    const provider = new ethers.JsonRpcProvider(effectiveRpcUrl);

    // 获取原生代币余额
    const nativeBalance = await provider.getBalance(address);

    let tokenBalance: string | undefined;
    if (tokenAddress && tokenAddress !== '0x0000000000000000000000000000000000000000') {
      try {

        // If tokenDecimals is not provided, fetch it dynamically
        if (tokenDecimals === undefined) {
                    const erc20Abi = [
            'function balanceOf(address owner) view returns (uint256)',
            'function decimals() view returns (uint8)'
          ];

          const contract = new ethers.Contract(tokenAddress, erc20Abi, provider);

          // Fetch both balance and decimals in parallel
          const [balance, decimals] = await Promise.all([
            contract.balanceOf(address),
            contract.decimals()
          ]);

          tokenBalance = ethers.formatUnits(balance, Number(decimals));
        } else {
          // Use provided decimals
          const erc20Abi = [
            'function balanceOf(address owner) view returns (uint256)'
          ];

          const contract = new ethers.Contract(tokenAddress, erc20Abi, provider);
          const balance = await contract.balanceOf(address);
          tokenBalance = ethers.formatUnits(balance, tokenDecimals);
        }

      } catch (error) {
        console.error('Failed to get token balance:', {
          error: error instanceof Error ? error.message : error,
          tokenAddress,
          tokenDecimals,
          chain,
          address
        });
        tokenBalance = '0';
      }
    } else {
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
      if (ChainUtils.isSolanaChain(chain)) {
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
    const provider = new ethers.JsonRpcProvider(rpcUrl || await this.getDefaultRPC(chain));

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
    chain: string,
    transactionCount: number,
    rpcUrl?: string
  ): Promise<GasEstimate> {
    try {
      const connection = rpcUrl
        ? new Connection(rpcUrl, 'confirmed')
        : new Connection('https://solana-rpc.publicnode.com', 'confirmed');

      // 获取最新的区块哈希
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();

      // 基础签名费用 (Solana 默认值)
      const baseFeePerSignature = BigInt(5000);

      // Solana交易的典型组件费用估算
      const computeUnitsPerInstruction = 200000; // 典型的compute unit限制
      const computeUnitPrice = BigInt(0); // 默认为0

      // 对于批量转账，每个交易包含多个指令
      const instructionsPerTransfer = 5; // 转账 + 可能的账户创建 + 其他指令
      const totalInstructions = transactionCount * instructionsPerTransfer;
      const totalComputeUnits = computeUnitsPerInstruction * totalInstructions;

      // 计算总费用
      const computeFee = BigInt(totalComputeUnits) * computeUnitPrice;
      const signatureFees = baseFeePerSignature * BigInt(transactionCount + 1); // +1 for payer signature

      // SPL转账的额外费用（创建关联账户等）
      const splAccountCreationFee = BigInt('2039280') * BigInt(Math.min(transactionCount, Math.floor(transactionCount * 0.3))); // 假设30%需要创建账户

      const totalLamports = computeFee + signatureFees + splAccountCreationFee;
      const solCost = totalLamports / BigInt(LAMPORTS_PER_SOL);

      // 获取SOL价格
      const solPriceUsd = await this.getSOLPriceUSD();
      const solCostUsd = (Number(solCost) * solPriceUsd).toFixed(6);

      // 添加网络拥堵缓冲 (20%)
      const bufferedLamports = totalLamports * BigInt(12) / BigInt(10);
      const bufferedSolCost = bufferedLamports / BigInt(LAMPORTS_PER_SOL);
      const bufferedSolCostUsd = (Number(bufferedSolCost) * solPriceUsd).toFixed(6);

      return {
        gasLimit: bufferedLamports.toString(),
        gasPrice: baseFeePerSignature.toString(),
        gasCost: bufferedSolCost.toString(),
        gasCostUsd: bufferedSolCostUsd,
        networkInfo: {
          blockhash,
          lastValidBlockHeight,
          priorityFee: computeUnitPrice.toString(),
          baseFee: baseFeePerSignature.toString()
        }
      };
    } catch (error) {
      console.error('Failed to get dynamic Solana gas estimation:', error);
      // Fallback to static estimation
      const baseFeePerSignature = BigInt('5000');
      const totalLamports = baseFeePerSignature * BigInt(transactionCount * 3); // 更保守的估算
      const solCost = totalLamports / BigInt(LAMPORTS_PER_SOL);

      const solPriceUsd = await this.getSOLPriceUSD();
      const solCostUsd = (Number(solCost) * solPriceUsd).toFixed(6);

      return {
        gasLimit: totalLamports.toString(),
        gasPrice: baseFeePerSignature.toString(),
        gasCost: solCost.toString(),
        gasCostUsd: solCostUsd,
        networkInfo: {
          fallback: true,
          reason: 'Dynamic estimation failed, using static calculation'
        }
      };
    }
  }

  private async getDefaultRPC(chain: string): Promise<string> {
    // 尝试从数据库获取 RPC URL
    try {
      if (this.databaseManager) {
        const db = this.databaseManager.getDatabase();

        // 首先尝试按名称或类型查询
        let chainData = await db.prepare(
          'SELECT rpc_url FROM chains WHERE name = ? OR type = ? LIMIT 1'
        ).get(chain, chain.toLowerCase()) as { rpc_url?: string } | undefined;

        // 如果没有找到，尝试按 chain_id 查询（适用于传入的是数字字符串的情况）
        if (!chainData || !chainData.rpc_url) {
          chainData = await db.prepare(
            'SELECT rpc_url FROM chains WHERE chain_id = ? LIMIT 1'
          ).get(chain) as { rpc_url?: string } | undefined;
        }

        if (chainData && chainData.rpc_url) {
                    return chainData.rpc_url;
        }
      }
    } catch (error) {
      console.warn('[BlockchainService] Failed to get RPC URL from database:', error);
    }

    // Fallback RPC URLs
    const rpcMap: { [key: string]: string } = {
      // 主网
      '1': 'https://eth.llamarpc.com',
      'ethereum': 'https://eth.llamarpc.com',
      '137': 'https://polygon.llamarpc.com',
      'polygon': 'https://polygon.llamarpc.com',
      '42161': 'https://arbitrum.llamarpc.com',
      'arbitrum': 'https://arbitrum.llamarpc.com',
      '10': 'https://optimism.llamarpc.com',
      'optimism': 'https://optimism.llamarpc.com',
      '8453': 'https://base.llamarpc.com',
      'base': 'https://base.llamarpc.com',
      '56': 'https://bsc.llamarpc.com',
      'bsc': 'https://bsc.llamarpc.com',
      '43114': 'https://avalanche.llamarpc.com',
      'avalanche': 'https://avalanche.llamarpc.com',
      // 测试网
      '11155111': 'https://ethereum-sepolia-rpc.publicnode.com',
      'ethereum sepolia testnet': 'https://ethereum-sepolia-rpc.publicnode.com',
      'sepolia': 'https://ethereum-sepolia-rpc.publicnode.com',
    };

    const rpcUrl = rpcMap[chain.toLowerCase()] || rpcMap[chain] || rpcMap['ethereum'];
        return rpcUrl;
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
      if (ChainUtils.isSolanaChain(chain)) {
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
      return ChainUtils.isValidAddress(address, chain);
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

  /**
   * Withdraw all remaining SPL tokens from a Solana wallet
   */
  async withdrawRemainingSPLTokens(
    rpcUrl: string,
    privateKey: string,
    recipientAddress: string,
    tokenMintAddress: string
  ): Promise<{
    txHash: string;
    amount: string;
  }> {
    try {
      const connection = new Connection(rpcUrl, 'confirmed');

      // Create keypair from private key
      const privateKeyBytes = Buffer.from(privateKey, 'hex');
      const wallet = Keypair.fromSecretKey(privateKeyBytes);
      const walletPublicKey = wallet.publicKey;

      // Get token mint
      const mintPublicKey = new PublicKey(tokenMintAddress);
      const recipientPublicKey = new PublicKey(recipientAddress);

      // Get source token account (sender's associated token account)
      const sourceTokenAccount = await getAssociatedTokenAddress(
        mintPublicKey,
        walletPublicKey
      );

      // Get destination token account (recipient's associated token account)
      const destinationTokenAccount = await getAssociatedTokenAddress(
        mintPublicKey,
        recipientPublicKey
      );

      // Get token account info to read balance
      const tokenAccountInfo = await getAccount(connection, sourceTokenAccount);
      const balance = tokenAccountInfo.amount;

      if (balance === BigInt(0)) {
        throw new Error('No SPL tokens to withdraw');
      }

      // Get token decimals
      const mintInfo = await connection.getParsedAccountInfo(mintPublicKey);
      const decimals = (mintInfo.value?.data as any)?.parsed?.info?.decimals || 9;

      // Create transfer instruction
      const transaction = new Transaction().add(
        createTransferInstruction(
          sourceTokenAccount,
          destinationTokenAccount,
          walletPublicKey,
          balance
        )
      );

      // Send and confirm transaction
      const signature = await sendAndConfirmTransaction(
        connection,
        transaction,
        [wallet],
        {
          commitment: 'confirmed'
        }
      );

      // Convert amount to human-readable format
      const amountFormatted = (Number(balance) / Math.pow(10, decimals)).toString();

      
      return {
        txHash: signature,
        amount: amountFormatted
      };
    } catch (error) {
      console.error('[BlockchainService] Failed to withdraw SPL tokens:', error);
      throw new Error(`Failed to withdraw SPL tokens: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Withdraw remaining SOL from a Solana wallet
   * Preserves enough SOL to cover transaction fee (1.5x buffer)
   */
  async withdrawRemainingSOL(
    rpcUrl: string,
    privateKey: string,
    recipientAddress: string
  ): Promise<{
    txHash: string;
    amount: string;
  }> {
    try {
      const connection = new Connection(rpcUrl, 'confirmed');

      // Create keypair from private key
      const privateKeyBytes = Buffer.from(privateKey, 'hex');
      const wallet = Keypair.fromSecretKey(privateKeyBytes);
      const walletPublicKey = wallet.publicKey;

      // Get current balance
      const balance = await connection.getBalance(walletPublicKey);

      if (balance === 0) {
        throw new Error('No SOL to withdraw');
      }

      // Get recent blockhash and fee calculator
      const { blockhash } = await connection.getLatestBlockhash();

      // Create a dummy transaction to estimate fee
      const recipientPublicKey = new PublicKey(recipientAddress);
      const dummyTransaction = new Transaction({
        feePayer: walletPublicKey,
        blockhash,
        lastValidBlockHeight: 0
      }).add(
        SystemProgram.transfer({
          fromPubkey: walletPublicKey,
          toPubkey: recipientPublicKey,
          lamports: 1
        })
      );

      // Get fee for transaction (typically 5000 lamports)
      const fee = await connection.getFeeForMessage(
        dummyTransaction.compileMessage(),
        'confirmed'
      );

      const estimatedFee = fee.value || 5000;

      // Calculate amount to send with 1.5x fee buffer
      const feeBuffer = Math.ceil(estimatedFee * 1.5);
      const amountToSend = balance - feeBuffer;

      if (amountToSend <= 0) {
        throw new Error('Insufficient SOL balance to cover transaction fee');
      }

      // Create the actual transfer transaction
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: walletPublicKey,
          toPubkey: recipientPublicKey,
          lamports: amountToSend
        })
      );

      // Send and confirm transaction
      const signature = await sendAndConfirmTransaction(
        connection,
        transaction,
        [wallet],
        {
          commitment: 'confirmed'
        }
      );

      // Convert lamports to SOL
      const amountInSOL = (amountToSend / LAMPORTS_PER_SOL).toString();

      
      return {
        txHash: signature,
        amount: amountInSOL
      };
    } catch (error) {
      console.error('[BlockchainService] Failed to withdraw SOL:', error);
      throw new Error(`Failed to withdraw SOL: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}