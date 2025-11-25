import { ethers } from 'ethers';
import { GasService, GasInfo } from './GasService';

// Batch Airdrop Contract ABI
const BATCH_AIRDROP_CONTRACT_ABI = [
  // Write function - only one function
  "function batchTransfer(address token, address[] recipients, uint256[] amounts) external"
];

// ERC20 ABI for token operations
const ERC20_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function balanceOf(address account) external view returns (uint256)",
  "function transfer(address to, uint256 amount) external returns (bool)",
  "function decimals() external view returns (uint8)",
  "function symbol() external view returns (string)",
  "function name() external view returns (string)"
];

export interface BatchInfo {
  token: string;
  totalAmount: string;
  recipientCount: number;
  executedCount: number;
  executed: boolean;
  cancelled: boolean;
  createdAt: string;
}

export interface BatchDetails {
  recipients: string[];
  amounts: string[];
}

export interface ContractDeploymentResult {
  contractAddress: string;
  transactionHash: string;
  blockNumber: number;
  gasUsed: string;
}

export interface BatchTransferResult {
  transactionHash: string;
  totalAmount: string;
  recipientCount: number;
  gasUsed: string;
}

export interface ContractDeploymentConfig {
  tokenAddress: string;
  chainId: number;
  rpcUrl: string;
  deployerPrivateKey: string;
}

export class ContractService {
  private gasService: GasService;

  constructor() {
    this.gasService = new GasService();
  }

  /**
   * Deploy the simple batch transfer contract
   */
  async deployContract(config: ContractDeploymentConfig): Promise<ContractDeploymentResult> {
    try {
      const provider = new ethers.JsonRpcProvider(config.rpcUrl);
      const wallet = new ethers.Wallet(config.deployerPrivateKey, provider);

      // Get deployment gas estimate
      const gasInfo = await this.gasService.getGasInfo(config.rpcUrl, 'ethereum');
      const txOptions = this.gasService.getTransactionOptions(gasInfo);

      // Load contract bytecode
      const bytecode = this.getContractBytecode();
      const contractFactory = new ethers.ContractFactory(BATCH_AIRDROP_CONTRACT_ABI, bytecode, wallet);

      // Deploy contract
      // Our contract has no constructor arguments, so we pass tx options directly
      // Gas limit optimized (actual usage ~306K, setting to 500K for safety)
      const deployOptions = {
        ...txOptions,
        gasLimit: BigInt(500000) // 500K gas for contract deployment (63% buffer)
      };

      const contract = await contractFactory.deploy(deployOptions);
      await contract.waitForDeployment();
      const receipt = await contract.deploymentTransaction()?.wait();

      return {
        contractAddress: await contract.getAddress(),
        transactionHash: contract.deploymentTransaction()?.hash || '',
        blockNumber: receipt?.blockNumber || 0,
        gasUsed: receipt?.gasUsed?.toString() || '0'
      };
    } catch (error) {
      console.error('Failed to deploy contract:', error);
      throw new Error(`Contract deployment failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Approve tokens for the contract to use
   */
  async approveTokens(
    rpcUrl: string,
    privateKey: string,
    tokenAddress: string,
    contractAddress: string,
    amount: string
  ): Promise<string> {
    try {
      const provider = new ethers.JsonRpcProvider(rpcUrl);
      const wallet = new ethers.Wallet(privateKey, provider);
      const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, wallet);

      // Check current allowance
      const currentAllowance = await tokenContract.allowance(wallet.address, contractAddress);
      if (currentAllowance >= BigInt(amount)) {
        return 'already-approved';
      }

      // Get gas info and create transaction
      const gasInfo = await this.gasService.getGasInfo(rpcUrl, 'ethereum');
      const txOptions = this.gasService.getTransactionOptions(gasInfo);

      // Approve tokens
      const tx = await tokenContract.approve(contractAddress, amount, txOptions);
      const receipt = await tx.wait();

      return tx.hash;
    } catch (error) {
      console.error('Failed to approve tokens:', error);
      throw new Error(`Token approval failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * 直接执行批量转账 - 最简单的方法
   */
  async batchTransfer(
    contractAddress: string,
    rpcUrl: string,
    privateKey: string,
    recipients: string[],
    amounts: string[],
    tokenAddress: string
  ): Promise<BatchTransferResult> {
    try {
      const provider = new ethers.JsonRpcProvider(rpcUrl);
      const wallet = new ethers.Wallet(privateKey, provider);
      const contract = new ethers.Contract(contractAddress, BATCH_AIRDROP_CONTRACT_ABI, wallet);

      // Validate inputs
      if (recipients.length !== amounts.length) {
        throw new Error('收币地址和金额数组长度必须相同');
      }

      if (recipients.length === 0) {
        throw new Error('收币地址不能为空');
      }

      // Get token decimals dynamically
      const tokenDecimals = await this.getTokenDecimals(rpcUrl, tokenAddress);

      // Convert amounts to BigInt with correct decimals
      // Ensure amount is a string before parsing
      const bigintAmounts = amounts.map(amount => ethers.parseUnits(amount.toString(), tokenDecimals));

      // Get gas info for this batch
      const gasInfo = await this.gasService.getBatchGasEstimate(rpcUrl, 'ethereum', recipients.length);
      const txOptions = this.gasService.getTransactionOptions(gasInfo);

      // 执行批量转账
      const tx = await contract.batchTransfer(tokenAddress, recipients, bigintAmounts, txOptions);
      const receipt = await tx.wait();

      // 计算总金额
      const totalAmount = bigintAmounts.reduce((sum, amount) => sum + amount, 0n);

      return {
        transactionHash: tx.hash,
        totalAmount: ethers.formatUnits(totalAmount, 18),
        recipientCount: recipients.length,
        gasUsed: receipt?.gasUsed?.toString() || '0'
      };
    } catch (error) {
      console.error('批量转账失败:', error);
      throw new Error(`批量转账失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * Get token decimals
   */
  async getTokenDecimals(rpcUrl: string, tokenAddress: string): Promise<number> {
    try {
      const provider = new ethers.JsonRpcProvider(rpcUrl);
      const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
      const decimals = await tokenContract.decimals();
      return Number(decimals);
    } catch (error) {
      console.error('Failed to get token decimals, defaulting to 18:', error);
      return 18; // Default fallback
    }
  }

  /**
   * Get token information
   */
  async getTokenInfo(
    rpcUrl: string,
    tokenAddress: string
  ): Promise<{ symbol: string; name: string; decimals: number }> {
    try {
      const provider = new ethers.JsonRpcProvider(rpcUrl);
      const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);

      const [symbol, name, decimals] = await Promise.all([
        tokenContract.symbol(),
        tokenContract.name(),
        tokenContract.decimals()
      ]);

      return {
        symbol,
        name,
        decimals: Number(decimals)
      };
    } catch (error) {
      console.error('Failed to get token info:', error);
      throw new Error(`Failed to get token info: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Withdraw remaining tokens from campaign wallet to specified address
   */
  async withdrawRemainingTokens(
    rpcUrl: string,
    privateKey: string,
    recipientAddress: string,
    tokenAddress: string
  ): Promise<{
    txHash: string;
    amount: string;
  }> {
    try {
      const provider = new ethers.JsonRpcProvider(rpcUrl);
      const wallet = new ethers.Wallet(privateKey, provider);

      if (!tokenAddress || tokenAddress === ethers.ZeroAddress) {
        throw new Error('Token address is required');
      }

      const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, wallet);
      const tokenDecimals = await this.getTokenDecimals(rpcUrl, tokenAddress);
      const tokenBalance = await tokenContract.balanceOf(wallet.address);

      if (tokenBalance === 0n) {
        throw new Error('No tokens to withdraw');
      }

      // Get gas info
      const gasInfo = await this.gasService.getGasInfo(rpcUrl, 'ethereum');
      const txOptions = this.gasService.getTransactionOptions(gasInfo);

      const tx = await tokenContract.transfer(recipientAddress, tokenBalance, txOptions);
      await tx.wait();

      const amount = ethers.formatUnits(tokenBalance, tokenDecimals);

      return {
        txHash: tx.hash,
        amount
      };
    } catch (error) {
      console.error('Failed to withdraw tokens:', error);
      throw new Error(`Failed to withdraw tokens: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Withdraw remaining native token (ETH/BNB/MATIC/AVAX/etc) from EVM wallet to specified address
   * Preserves enough native token to cover transaction fee (1.5x buffer)
   */
  async withdrawRemainingETH(
    rpcUrl: string,
    privateKey: string,
    recipientAddress: string
  ): Promise<{
    txHash: string;
    amount: string;
  }> {
    try {
      const provider = new ethers.JsonRpcProvider(rpcUrl);
      const wallet = new ethers.Wallet(privateKey, provider);

      // Get native token balance (ETH/BNB/MATIC/AVAX/etc)
      const balance = await provider.getBalance(wallet.address);

      // Get gas info
      const gasInfo = await this.gasService.getGasInfo(rpcUrl, 'ethereum');

      // Use precise gas estimation with minimal buffer
      let gasCost: bigint;
      let gasLimit: bigint;

      try {
        // Estimate gas for the exact transaction amount we plan to send
        // First, get a reasonable estimate of withdrawable amount
        const estimatedGasCost = ethers.parseUnits(gasInfo.gasPrice, 'gwei') * 21000n;
        const estimatedWithdrawable = balance - estimatedGasCost;

        if (estimatedWithdrawable <= 0n) {
          throw new Error('Insufficient balance for any withdrawal');
        }

        // Create a mock transaction with the actual amount we plan to withdraw
        const mockTx = {
          to: recipientAddress,
          value: estimatedWithdrawable,
        };

        // Estimate gas with the actual transaction amount
        const estimatedGasLimit = await provider.estimateGas(mockTx);
        gasLimit = estimatedGasLimit;

              } catch (estimateError) {
        console.warn('Precise gas estimation failed, using fallback:', estimateError);
        gasLimit = 21000n; // Standard ETH transfer gas limit
      }

      // Get current gas price from provider for most accurate pricing
      const feeData = await provider.getFeeData();

      if (feeData.maxFeePerGas && feeData.maxPriorityFeePerGas && feeData.maxFeePerGas > 0n) {
        // EIP-1559: Use actual fee data from network
        gasCost = feeData.maxFeePerGas * gasLimit;
              } else if (feeData.gasPrice && feeData.gasPrice > 0n) {
        // Legacy: Use actual gas price from network
        gasCost = feeData.gasPrice * gasLimit;
              } else {
        // Fallback to gasService data
        const txOptions = this.gasService.getTransactionOptions(gasInfo);
        if (txOptions.maxFeePerGas) {
          gasCost = BigInt(txOptions.maxFeePerGas) * gasLimit;
        } else if (txOptions.gasPrice) {
          gasCost = BigInt(txOptions.gasPrice) * gasLimit;
        } else {
          gasCost = ethers.parseUnits(gasInfo.gasPrice, 'gwei') * gasLimit;
        }
      }

      // Add minimal 5% buffer for slight network fluctuations (much more reasonable)
      const totalGasCost = (gasCost * 105n) / 100n;
      const amountToWithdraw = balance - totalGasCost;

      if (amountToWithdraw <= 0n) {
        // Provide detailed error information
        const gasCostEth = ethers.formatEther(gasCost);
        const balanceEth = ethers.formatEther(balance);
        const totalGasCostEth = ethers.formatEther(totalGasCost);

        throw new Error(
          `Insufficient balance to withdraw. Balance: ${balanceEth} ETH, ` +
          `Estimated gas cost: ${gasCostEth} ETH, ` +
          `With 5% safety buffer: ${totalGasCostEth} ETH. ` +
          `Available for withdrawal: 0 ETH`
        );
      }

      // Prepare transaction with proper gas settings
      let txOptions: any = {
        gasLimit: gasLimit
      };

      if (feeData.maxFeePerGas && feeData.maxPriorityFeePerGas && feeData.maxFeePerGas > 0n) {
        // EIP-1559: Use actual fee data from network
        txOptions.maxFeePerGas = feeData.maxFeePerGas;
        txOptions.maxPriorityFeePerGas = feeData.maxPriorityFeePerGas;
      } else if (feeData.gasPrice && feeData.gasPrice > 0n) {
        // Legacy: Use actual gas price from network
        txOptions.gasPrice = feeData.gasPrice;
      } else {
        // Fallback to gasService data
        const fallbackTxOptions = this.gasService.getTransactionOptions(gasInfo);
        if (fallbackTxOptions.maxFeePerGas) {
          txOptions.maxFeePerGas = fallbackTxOptions.maxFeePerGas;
          txOptions.maxPriorityFeePerGas = fallbackTxOptions.maxPriorityFeePerGas;
        } else if (fallbackTxOptions.gasPrice) {
          txOptions.gasPrice = fallbackTxOptions.gasPrice;
        }
      }

      const tx = await wallet.sendTransaction({
        to: recipientAddress,
        value: amountToWithdraw,
        ...txOptions
      });
      await tx.wait();

      const amount = ethers.formatEther(amountToWithdraw);

      return {
        txHash: tx.hash,
        amount
      };
    } catch (error) {
      console.error('Failed to withdraw native tokens:', error);
      throw new Error(`Failed to withdraw native tokens: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Check if tokens are approved for the contract
   */
  async checkApproval(
    rpcUrl: string,
    privateKey: string,
    tokenAddress: string,
    contractAddress: string,
    requiredAmount: string
  ): Promise<boolean> {
    try {
      const provider = new ethers.JsonRpcProvider(rpcUrl);
      const wallet = new ethers.Wallet(privateKey, provider);
      const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);

      const allowance = await tokenContract.allowance(wallet.address, contractAddress);
      return allowance >= ethers.parseEther(requiredAmount);
    } catch (error) {
      console.error('Failed to check approval:', error);
      return false;
    }
  }

  /**
   * Get BatchAirdropContract bytecode
   * Compiled from contracts/src/BatchAirdropContract.sol using Solidity 0.8.26
   *
   * Gas-Optimized Contract Features:
   * - Ultra-lightweight design (no OpenZeppelin dependencies)
   * - Uses calldata instead of memory for array parameters
   * - Caches array length and token contract reference
   * - Uses unchecked increment for loop counter
   * - Custom errors instead of require strings
   * - Atomic transactions (all-or-nothing guarantee)
   * - No reentrancy protection needed (safe by design)
   *
   * Estimated Gas Savings vs Previous Version:
   * - Deployment: ~3,000 gas saved
   * - Per batch (50 addresses): ~7,950 gas saved
   */
  private getContractBytecode(): string {
    return '0x6080604052348015600e575f80fd5b506104958061001c5f395ff3fe608060405234801561000f575f80fd5b5060043610610029575f3560e01c80631239ec8c1461002d575b5f80fd5b610047600480360381019061004291906102ba565b610049565b005b5f84849050905082829050811461008c576040517fff633a3800000000000000000000000000000000000000000000000000000000815260040160405180910390fd5b5f8690505f5b82811015610198578173ffffffffffffffffffffffffffffffffffffffff166323b872dd338989858181106100ca576100c961034b565b5b90506020020160208101906100df9190610378565b8888868181106100f2576100f161034b565b5b905060200201356040518463ffffffff1660e01b8152600401610117939291906103ca565b6020604051808303815f875af1158015610133573d5f803e3d5ffd5b505050506040513d601f19601f820116820180604052508101906101579190610434565b61018d576040517f90b8ec1800000000000000000000000000000000000000000000000000000000815260040160405180910390fd5b806001019050610092565b5050505050505050565b5f80fd5b5f80fd5b5f73ffffffffffffffffffffffffffffffffffffffff82169050919050565b5f6101d3826101aa565b9050919050565b6101e3816101c9565b81146101ed575f80fd5b50565b5f813590506101fe816101da565b92915050565b5f80fd5b5f80fd5b5f80fd5b5f8083601f84011261022557610224610204565b5b8235905067ffffffffffffffff81111561024257610241610208565b5b60208301915083602082028301111561025e5761025d61020c565b5b9250929050565b5f8083601f84011261027a57610279610204565b5b8235905067ffffffffffffffff81111561029757610296610208565b5b6020830191508360208202830111156102b3576102b261020c565b5b9250929050565b5f805f805f606086880312156102d3576102d26101a2565b5b5f6102e0888289016101f0565b955050602086013567ffffffffffffffff811115610301576103006101a6565b5b61030d88828901610210565b9450945050604086013567ffffffffffffffff8111156103305761032f6101a6565b5b61033c88828901610265565b92509250509295509295909350565b7f4e487b71000000000000000000000000000000000000000000000000000000005f52603260045260245ffd5b5f6020828403121561038d5761038c6101a2565b5b5f61039a848285016101f0565b91505092915050565b6103ac816101c9565b82525050565b5f819050919050565b6103c4816103b2565b82525050565b5f6060820190506103dd5f8301866103a3565b6103ea60208301856103a3565b6103f760408301846103bb565b949350505050565b5f8115159050919050565b610413816103ff565b811461041d575f80fd5b50565b5f8151905061042e8161040a565b92915050565b5f60208284031215610449576104486101a2565b5b5f61045684828501610420565b9150509291505056fea264697066735822122022c0f9d42a8e151bd750c5fc07523b172aa9de79b803b9b1c693dd00248b60c964736f6c634300081a0033';
  }

  /**
   * Static method to get contract bytecode for testing
   */
  public static getContractBytecode(): string {
    // Gas-optimized BatchAirdropContract bytecode compiled with Solidity 0.8.26
    return '0x6080604052348015600e575f80fd5b506104958061001c5f395ff3fe608060405234801561000f575f80fd5b5060043610610029575f3560e01c80631239ec8c1461002d575b5f80fd5b610047600480360381019061004291906102ba565b610049565b005b5f84849050905082829050811461008c576040517fff633a3800000000000000000000000000000000000000000000000000000000815260040160405180910390fd5b5f8690505f5b82811015610198578173ffffffffffffffffffffffffffffffffffffffff166323b872dd338989858181106100ca576100c961034b565b5b90506020020160208101906100df9190610378565b8888868181106100f2576100f161034b565b5b905060200201356040518463ffffffff1660e01b8152600401610117939291906103ca565b6020604051808303815f875af1158015610133573d5f803e3d5ffd5b505050506040513d601f19601f820116820180604052508101906101579190610434565b61018d576040517f90b8ec1800000000000000000000000000000000000000000000000000000000815260040160405180910390fd5b806001019050610092565b5050505050505050565b5f80fd5b5f80fd5b5f73ffffffffffffffffffffffffffffffffffffffff82169050919050565b5f6101d3826101aa565b9050919050565b6101e3816101c9565b81146101ed575f80fd5b50565b5f813590506101fe816101da565b92915050565b5f80fd5b5f80fd5b5f80fd5b5f8083601f84011261022557610224610204565b5b8235905067ffffffffffffffff81111561024257610241610208565b5b60208301915083602082028301111561025e5761025d61020c565b5b9250929050565b5f8083601f84011261027a57610279610204565b5b8235905067ffffffffffffffff81111561029757610296610208565b5b6020830191508360208202830111156102b3576102b261020c565b5b9250929050565b5f805f805f606086880312156102d3576102d26101a2565b5b5f6102e0888289016101f0565b955050602086013567ffffffffffffffff811115610301576103006101a6565b5b61030d88828901610210565b9450945050604086013567ffffffffffffffff8111156103305761032f6101a6565b5b61033c88828901610265565b92509250509295509295909350565b7f4e487b71000000000000000000000000000000000000000000000000000000005f52603260045260245ffd5b5f6020828403121561038d5761038c6101a2565b5b5f61039a848285016101f0565b91505092915050565b6103ac816101c9565b82525050565b5f819050919050565b6103c4816103b2565b82525050565b5f6060820190506103dd5f8301866103a3565b6103ea60208301856103a3565b6103f760408301846103bb565b949350505050565b5f8115159050919050565b610413816103ff565b811461041d575f80fd5b50565b5f8151905061042e8161040a565b92915050565b5f60208284031215610449576104486101a2565b5b5f61045684828501610420565b9150509291505056fea264697066735822122022c0f9d42a8e151bd750c5fc07523b172aa9de79b803b9b1c693dd00248b60c964736f6c634300081a0033';
  }
}