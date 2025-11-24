import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  sendAndConfirmTransaction,
  clusterApiUrl,
  LAMPORTS_PER_SOL,
  SystemProgram
} from '@solana/web3.js';
import {
  createTransferInstruction,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  getOrCreateAssociatedTokenAccount,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID
} from '@solana/spl-token';

export interface SolanaBatchTransferResult {
  transactionHash: string;
  totalAmount: string;
  recipientCount: number;
  gasUsed: string;
  status: 'success' | 'partial' | 'failed';
  details?: Array<{
    address: string;
    amount: string;
    status: 'success' | 'failed';
    error?: string;
  }>;
}

export interface SolanaTokenInfo {
  address: string;
  decimals: number;
  symbol?: string;
  isNativeSOL: boolean;
}

export class SolanaService {
  private connection: Connection | null = null;

  /**
   * 初始化Solana连接
   */
  private initializeConnection(rpcUrl: string): Connection {
    if (!this.connection) {
      this.connection = new Connection(rpcUrl, 'confirmed');
    }
    return this.connection;
  }

  /**
   * 从base64私钥创建Keypair
   */
  private createKeypairFromBase64(privateKeyBase64: string): Keypair {
    const privateKeyBytes = Buffer.from(privateKeyBase64, 'base64');
    return Keypair.fromSecretKey(privateKeyBytes);
  }

  /**
   * 获取代币信息
   */
  async getTokenInfo(rpcUrl: string, tokenAddress: string): Promise<SolanaTokenInfo> {
    try {
      const connection = this.initializeConnection(rpcUrl);

      // 检查是否是原生SOL
      if (tokenAddress.toLowerCase() === 'sol' || tokenAddress.toLowerCase() === 'native') {
        return {
          address: 'So11111111111111111111111111111111111111112',
          decimals: 9,
          symbol: 'SOL',
          isNativeSOL: true
        };
      }

      const tokenMint = new PublicKey(tokenAddress);
      const tokenInfo = await connection.getParsedAccountInfo(tokenMint);

      if (!tokenInfo || !tokenInfo.value) {
        throw new Error('Invalid token address');
      }

      const parsedInfo = tokenInfo.value.data as any;
      const decimals = parsedInfo.parsed.info.decimals;

      return {
        address: tokenAddress,
        decimals,
        isNativeSOL: false
      };
    } catch (error) {
      console.error('Failed to get token info:', error);
      throw new Error(`获取代币信息失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * 获取钱包余额
   */
  async getBalance(rpcUrl: string, walletPublicKey: string, tokenAddress?: string): Promise<string> {
    try {
      const connection = this.initializeConnection(rpcUrl);
      const publicKey = new PublicKey(walletPublicKey);

      if (!tokenAddress || tokenAddress.toLowerCase() === 'sol') {
        // 原生SOL余额
        const balance = await connection.getBalance(publicKey);
        return (balance / LAMPORTS_PER_SOL).toString();
      } else {
        // SPL代币余额
        const tokenMint = new PublicKey(tokenAddress);
        const tokenAccount = await getAssociatedTokenAddress(tokenMint, publicKey);

        try {
          const tokenBalance = await connection.getTokenAccountBalance(tokenAccount);
          return tokenBalance.value.uiAmountString || '0';
        } catch (error) {
          // 代币账户不存在
          return '0';
        }
      }
    } catch (error) {
      console.error('Failed to get balance:', error);
      return '0';
    }
  }

  /**
   * 批量SPL代币转账 - 符合Solana交易限制的实现
   */
  async batchTransfer(
    rpcUrl: string,
    privateKeyBase64: string,
    recipients: string[],
    amounts: string[],
    tokenAddress: string
  ): Promise<SolanaBatchTransferResult> {
    try {
      const connection = this.initializeConnection(rpcUrl);
      const wallet = this.createKeypairFromBase64(privateKeyBase64);

      // 获取代币信息
      const tokenInfo = await this.getTokenInfo(rpcUrl, tokenAddress);

      const results: Array<{ address: string; amount: string; status: 'success' | 'failed'; error?: string }> = [];
      let totalGasUsed = 0;
      const transactionHashes: string[] = [];

      // Solana交易限制：基于QuickNode最佳实践
      // 交易大小限制：1232字节，建议每交易最多10条指令
      // 根据代币类型动态调整批量大小
      const batchSize = tokenInfo.isNativeSOL ? 15 : 8; // SOL指令更简单，但仍需保守

      console.log(`Solana批量转账开始: 总计${recipients.length}个地址，每批${batchSize}个`);

      // 分批处理
      for (let batchStart = 0; batchStart < recipients.length; batchStart += batchSize) {
        const batchEnd = Math.min(batchStart + batchSize, recipients.length);
        const batchRecipients = recipients.slice(batchStart, batchEnd);
        const batchAmounts = amounts.slice(batchStart, batchEnd);

        console.log(`处理批次 ${Math.floor(batchStart / batchSize) + 1}: 地址 ${batchStart + 1}-${batchEnd}`);

        try {
          const batchResult = await this.executeBatchTransfer(
            connection,
            wallet,
            batchRecipients,
            batchAmounts,
            tokenInfo,
            batchStart
          );

          results.push(...batchResult.results);
          totalGasUsed += batchResult.gasUsed;
          transactionHashes.push(batchResult.transactionHash);

          // 批次之间短暂延迟，避免网络拥堵
          if (batchEnd < recipients.length) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }

        } catch (error) {
          console.error(`批次 ${Math.floor(batchStart / batchSize) + 1} 失败:`, error);

          // 标记整个批次为失败
          for (let i = 0; i < batchRecipients.length; i++) {
            results.push({
              address: batchRecipients[i],
              amount: batchAmounts[i],
              status: 'failed',
              error: error instanceof Error ? error.message : '批次执行失败'
            });
          }
        }
      }

      // 计算总金额
      const totalAmount = amounts.reduce((sum, amount) => {
        const numAmount = parseFloat(amount) || 0;
        return sum + numAmount;
      }, 0);

      const successCount = results.filter(r => r.status === 'success').length;

      return {
        transactionHash: transactionHashes.join(','), // 多个交易哈希用逗号分隔
        totalAmount: totalAmount.toString(),
        recipientCount: successCount,
        gasUsed: totalGasUsed.toString(),
        status: successCount === recipients.length ? 'success' : successCount > 0 ? 'partial' : 'failed',
        details: results
      };
    } catch (error) {
      console.error('Solana batch transfer failed:', error);
      throw new Error(`Solana批量转账失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * 执行单个批次的转账 - 基于QuickNode最佳实践优化
   */
  private async executeBatchTransfer(
    connection: Connection,
    wallet: Keypair,
    recipients: string[],
    amounts: string[],
    tokenInfo: SolanaTokenInfo,
    batchIndex: number
  ): Promise<{ transactionHash: string; results: any[]; gasUsed: number }> {
    const transaction = new Transaction();
    const results: Array<{ address: string; amount: string; status: 'success' | 'failed'; error?: string }> = [];

    for (let i = 0; i < recipients.length; i++) {
      const recipientAddress = recipients[i];
      const amount = amounts[i];

      try {
        if (tokenInfo.isNativeSOL) {
          // 原生SOL转账
          const recipientPubkey = new PublicKey(recipientAddress);
          const lamports = Math.floor(parseFloat(amount) * LAMPORTS_PER_SOL);

          transaction.add(
            SystemProgram.transfer({
              fromPubkey: wallet.publicKey,
              toPubkey: recipientPubkey,
              lamports,
            })
          );
        } else {
          // SPL代币转账
          const recipientPubkey = new PublicKey(recipientAddress);
          const tokenMint = new PublicKey(tokenInfo.address);
          const senderATA = await getAssociatedTokenAddress(tokenMint, wallet.publicKey);
          const recipientATA = await getAssociatedTokenAddress(tokenMint, recipientPubkey);

          // 检查接收者的关联代币账户是否存在
          const recipientAccountInfo = await connection.getAccountInfo(recipientATA);
          if (!recipientAccountInfo) {
            // 创建关联代币账户
            transaction.add(
              createAssociatedTokenAccountInstruction(
                wallet.publicKey,
                recipientATA,
                tokenMint,
                recipientPubkey
              )
            );
          }

          // 计算转账金额（考虑小数位数）
          const decimals = Math.pow(10, tokenInfo.decimals);
          const transferAmount = BigInt(Math.floor(parseFloat(amount) * decimals));

          // 添加转账指令
          transaction.add(
            createTransferInstruction(
              senderATA,
              recipientATA,
              wallet.publicKey,
              transferAmount
            )
          );
        }

        results.push({
          address: recipientAddress,
          amount,
          status: 'success'
        });
      } catch (error) {
        console.error(`Failed to prepare transfer for ${recipientAddress}:`, error);
        results.push({
          address: recipientAddress,
          amount,
          status: 'failed',
          error: error instanceof Error ? error.message : '指令准备失败'
        });
      }
    }

    // 如果没有成功的转账，返回错误
    const successCount = results.filter(r => r.status === 'success').length;
    if (successCount === 0) {
      throw new Error('批次中没有准备成功的转账');
    }

    // 获取最新的区块哈希
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = wallet.publicKey;

    // 基于QuickNode最佳实践：检查交易大小
    const transactionSize = transaction.serialize({ requireAllSignatures: false }).length;
    const maxTransactionSize = 1232; // Solana交易大小限制

    if (transactionSize > maxTransactionSize) {
      console.warn(`批次 ${batchIndex + 1} 交易大小过大: ${transactionSize} bytes (限制: ${maxTransactionSize})`);
      // 可以考虑拆分交易或减少批量大小
    }

    console.log(`批次 ${batchIndex + 1} 交易大小: ${transactionSize} bytes, 指令数: ${transaction.instructions.length}`);

    // 签名并发送交易
    const signature = await sendAndConfirmTransaction(connection, transaction, [wallet], {
      commitment: 'confirmed',
      maxRetries: 3
    });

    // 获取交易详情以计算gas费用
    const transactionDetails = await connection.getTransaction(signature, {
      maxSupportedTransactionVersion: 0
    });

    const gasUsed = transactionDetails?.meta?.fee || 0;

    console.log(`批次 ${batchIndex + 1} 完成: 交易哈希 ${signature}, Gas费用 ${gasUsed} lamports`);

    return {
      transactionHash: signature,
      results,
      gasUsed
    };
  }

  /**
   * 检查交易状态
   */
  async getTransactionStatus(rpcUrl: string, transactionHash: string): Promise<{
    status: 'confirmed' | 'pending' | 'failed';
    blockHeight?: number;
    error?: string;
    confirmations?: number;
  }> {
    const maxRetries = 3;
    const retryDelay = 1000; // 1 second

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const connection = this.initializeConnection(rpcUrl);

        // 使用更高效的查询方法
        const [transaction, signatureStatuses] = await Promise.all([
          connection.getTransaction(transactionHash, {
            maxSupportedTransactionVersion: 0
          }),
          connection.getSignatureStatus(transactionHash, {
            searchTransactionHistory: false
          })
        ]);

        if (!transaction) {
          return { status: 'pending' };
        }

        if (transaction.meta?.err) {
          return {
            status: 'failed',
            error: `Transaction failed: ${JSON.stringify(transaction.meta.err)}`,
            blockHeight: (transaction as any).blockHeight || undefined
          };
        }

        // 检查确认状态
        const confirmations = signatureStatuses?.value?.confirmations || 0;

        return {
          status: 'confirmed',
          blockHeight: (transaction as any).blockHeight || undefined,
          confirmations
        };
      } catch (error) {
        console.error(`Failed to get transaction status (attempt ${attempt + 1}/${maxRetries}):`, error);

        if (attempt === maxRetries - 1) {
          // 最后一次尝试失败，返回错误
          return {
            status: 'failed',
            error: `Failed to check transaction status after ${maxRetries} attempts: ${error instanceof Error ? error.message : '未知错误'}`
          };
        }

        // 重试前等待
        await new Promise(resolve => setTimeout(resolve, retryDelay * (attempt + 1)));
      }
    }

    // 这种情况理论上不会到达，但为了类型安全
    return {
      status: 'failed',
      error: 'Unknown error in transaction status check'
    };
  }

  /**
   * 估算批量转账费用
   */
  async estimateBatchTransferFee(
    rpcUrl: string,
    recipientCount: number,
    isSPLToken: boolean
  ): Promise<number> {
    try {
      const connection = this.initializeConnection(rpcUrl);

      // 基础交易费用
      let baseFee = 5000; // Solana基础交易费用（lamports）

      // SPL代币转账需要额外的费用（每个转账可能需要创建关联代币账户）
      if (isSPLToken) {
        baseFee += recipientCount * 2039280; // 估算的SPL转账费用
      }

      // 添加一些缓冲
      const estimatedFee = baseFee * 1.2;

      return Math.ceil(estimatedFee);
    } catch (error) {
      console.error('Failed to estimate fee:', error);
      return 100000; // 默认估算费用
    }
  }
}