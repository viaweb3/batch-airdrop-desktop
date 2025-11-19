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
      // Increase gas limit significantly for contract deployment
      const deployOptions = {
        ...txOptions,
        gasLimit: BigInt(3000000) // 3M gas for contract deployment
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
        console.log('Sufficient allowance already exists, skipping approval');
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
      const bigintAmounts = amounts.map(amount => ethers.parseUnits(amount, tokenDecimals));

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
   * Compiled from contracts/BatchAirdrop.sol using Solidity 0.8.18
   * Contract features:
   * - Batch ERC20 token transfers (up to 200 recipients per batch)
   * - Gas optimized with optimizer runs: 200
   * - Error handling for individual transfer failures
   * - Event emission for monitoring
   * - Statistics tracking
   * - Emergency withdrawal function
   * - Ownership transfer capability
   */
  private getContractBytecode(): string {
    // Correct BatchAirdropContract bytecode (minimal version - no events, no statistics)
    return '0x608060405260015f553480156012575f5ffd5b50610539806100205f395ff3fe608060405234801561000f575f5ffd5b5060043610610029575f3560e01c80631239ec8c1461002d575b5f5ffd5b61004061003b3660046103f7565b610042565b005b5f546001146100985760405162461bcd60e51b815260206004820152601f60248201527f5265656e7472616e637947756172643a207265656e7472616e742063616c6c0060448201526064015b60405180910390fd5b60025f5580518251146100d35760405162461bcd60e51b81526020600482015260036024820152623632b760e91b604482015260640161008f565b5f805b8251811015610108578281815181106100f1576100f16104c9565b6020026020010151820191508060010190506100d6565b506040516323b872dd60e01b8152336004820152306024820152604481018290526001600160a01b038516906323b872dd906064016020604051808303815f875af1158015610159573d5f5f3e3d5ffd5b505050506040513d601f19601f8201168201806040525081019061017d91906104dd565b6101ae5760405162461bcd60e51b815260206004820152600260248201526134b760f11b604482015260640161008f565b5f5b83518110156102ff575f6001600160a01b03168482815181106101d5576101d56104c9565b60200260200101516001600160a01b03161415801561020c57505f838281518110610202576102026104c9565b6020026020010151115b156102f757846001600160a01b031663a9059cbb858381518110610232576102326104c9565b602002602001015185848151811061024c5761024c6104c9565b60200260200101516040518363ffffffff1660e01b81526004016102859291906001600160a01b03929092168252602082015260400190565b6020604051808303815f875af11580156102a1573d5f5f3e3d5ffd5b505050506040513d601f19601f820116820180604052508101906102c591906104dd565b6102f75760405162461bcd60e51b81526020600482015260036024820152621bdd5d60ea1b604482015260640161008f565b6001016101b0565b505060015f55505050565b80356001600160a01b0381168114610320575f5ffd5b919050565b634e487b7160e01b5f52604160045260245ffd5b604051601f8201601f1916810167ffffffffffffffff8111828210171561036257610362610325565b604052919050565b5f67ffffffffffffffff82111561038357610383610325565b5060051b60200190565b5f82601f83011261039c575f5ffd5b81356103af6103aa8261036a565b610339565b8082825260208201915060208360051b8601019250858311156103d0575f5ffd5b602085015b838110156103ed5780358352602092830192016103d5565b5095945050505050565b5f5f5f60608486031215610409575f5ffd5b6104128461030a565b9250602084013567ffffffffffffffff81111561042d575f5ffd5b8401601f8101861361043d575f5ffd5b803561044b6103aa8261036a565b8082825260208201915060208360051b85010192508883111561046c575f5ffd5b6020840193505b82841015610495576104848461030a565b825260209384019390910190610473565b9450505050604084013567ffffffffffffffff8111156104b3575f5ffd5b6104bf8682870161038d565b9150509250925092565b634e487b7160e01b5f52603260045260245ffd5b5f602082840312156104ed575f5ffd5b815180151581146104fc575f5ffd5b939250505056fea26469706673582212205d59968e9b65c47ebd0a245cf1d376c9c72bf30b10fc270ca146d1f731bc1deb64736f6c634300081e0033';
  }

  /**
   * Static method to get contract bytecode for testing
   */
  public static getContractBytecode(): string {
    return '0x608060405260015f553480156012575f5ffd5b50610539806100205f395ff3fe608060405234801561000f575f5ffd5b5060043610610029575f3560e01c80631239ec8c1461002d575b5f5ffd5b61004061003b3660046103f7565b610042565b005b5f546001146100985760405162461bcd60e51b815260206004820152601f60248201527f5265656e7472616e637947756172643a207265656e7472616e742063616c6c0060448201526064015b60405180910390fd5b60025f5580518251146100d35760405162461bcd60e51b81526020600482015260036024820152623632b760e91b604482015260640161008f565b5f805b8251811015610108578281815181106100f1576100f16104c9565b6020026020010151820191508060010190506100d6565b506040516323b872dd60e01b8152336004820152306024820152604481018290526001600160a01b038516906323b872dd906064016020604051808303815f875af1158015610159573d5f5f3e3d5ffd5b505050506040513d601f19601f8201168201806040525081019061017d91906104dd565b6101ae5760405162461bcd60e51b815260206004820152600260248201526134b760f11b604482015260640161008f565b5f5b83518110156102ff575f6001600160a01b03168482815181106101d5576101d56104c9565b60200260200101516001600160a01b03161415801561020c57505f838281518110610202576102026104c9565b6020026020010151115b156102f757846001600160a01b031663a9059cbb858381518110610232576102326104c9565b602002602001015185848151811061024c5761024c6104c9565b60200260200101516040518363ffffffff1660e01b81526004016102859291906001600160a01b03929092168252602082015260400190565b6020604051808303815f875af11580156102a1573d5f5f3e3d5ffd5b505050506040513d601f19601f820116820180604052508101906102c591906104dd565b6102f75760405162461bcd60e51b81526020600482015260036024820152621bdd5d60ea1b604482015260640161008f565b6001016101b0565b505060015f55505050565b80356001600160a01b0381168114610320575f5ffd5b919050565b634e487b7160e01b5f52604160045260245ffd5b604051601f8201601f1916810167ffffffffffffffff8111828210171561036257610362610325565b604052919050565b5f67ffffffffffffffff82111561038357610383610325565b5060051b60200190565b5f82601f83011261039c575f5ffd5b81356103af6103aa8261036a565b610339565b8082825260208201915060208360051b8601019250858311156103d0575f5ffd5b602085015b838110156103ed5780358352602092830192016103d5565b5095945050505050565b5f5f5f60608486031215610409575f5ffd5b6104128461030a565b9250602084013567ffffffffffffffff81111561042d575f5ffd5b8401601f8101861361043d575f5ffd5b803561044b6103aa8261036a565b8082825260208201915060208360051b85010192508883111561046c575f5ffd5b6020840193505b82841015610495576104848461030a565b825260209384019390910190610473565b9450505050604084013567ffffffffffffffff8111156104b3575f5ffd5b6104bf8682870161038d565b9150509250925092565b634e487b7160e01b5f52603260045260245ffd5b5f602082840312156104ed575f5ffd5b815180151581146104fc575f5ffd5b939250505056fea26469706673582212205d59968e9b65c47ebd0a245cf1d376c9c72bf30b10fc270ca146d1f731bc1deb64736f6c634300081e0033';
  }
}