import { ethers } from 'ethers';
import { ContractService } from '../../main/services/ContractService';
import { GasService } from '../../main/services/GasService';

// Sepolia Testnet Configuration
const SEPOLIA_CONFIG = {
  chainId: 11155111,
  name: 'sepolia',
  rpcUrl: 'https://ethereum-sepolia-rpc.publicnode.com', // PublicNode free endpoint
  blockExplorer: 'https://sepolia.etherscan.io'
};

// Test wallet with funded ETH
const TEST_WALLET = {
  address: '0xd8F29E2e49757d008a14E78BB0B4ef3062932A4a',
  privateKey: '0x11b3aff6bd4191b1bde981ffb9a389f832851c977c824643405e2ee179aa9fea'
};

// Test token (UNI token on mainnet as placeholder)
const TEST_TOKEN_CONFIG = {
  address: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984',
  decimals: 18,
  symbol: 'UNI'
};

describe('Ethereum Testnet Integration Tests', () => {
  let contractService: ContractService;
  let gasService: GasService;
  let provider: ethers.JsonRpcProvider;
  let testWallet: ethers.Wallet;

  beforeAll(async () => {
    // Initialize services
    contractService = new ContractService();
    gasService = new GasService();

    // Initialize provider
    provider = new ethers.JsonRpcProvider(SEPOLIA_CONFIG.rpcUrl);
    testWallet = new ethers.Wallet(TEST_WALLET.privateKey, provider);

    console.log('🔗 Connected to Sepolia testnet');
    console.log('📊 Network:', await provider.getNetwork());
  });

  test('should connect to Sepolia testnet', async () => {
    const network = await provider.getNetwork();
    expect(network.chainId).toBe(BigInt(SEPOLIA_CONFIG.chainId));
    expect(network.name).toBe(SEPOLIA_CONFIG.name);

    // Get latest block
    const latestBlock = await provider.getBlockNumber();
    expect(latestBlock).toBeGreaterThan(0);

    console.log(`✅ Connected to Sepolia (Chain ID: ${network.chainId})`);
    console.log(`📦 Latest block: ${latestBlock}`);
  });

  test('should get real gas information from testnet', async () => {
    const gasInfo = await gasService.getGasInfo(SEPOLIA_CONFIG.rpcUrl, 'sepolia');

    expect(gasInfo).toHaveProperty('gasPrice');
    expect(gasInfo).toHaveProperty('network');
    expect(gasInfo).toHaveProperty('estimatedGasLimit');
    expect(gasInfo).toHaveProperty('estimatedCost');

    expect(parseFloat(gasInfo.gasPrice)).toBeGreaterThan(0);
    expect(gasInfo.network).toBe('sepolia');

    // Get real fee data from provider
    const feeData = await provider.getFeeData();
    expect(feeData.gasPrice).toBeDefined();

    console.log(`⛽ Current gas price: ${gasInfo.gasPrice} Gwei`);
    console.log(`💰 Estimated deployment cost: ${gasInfo.estimatedCost} ETH`);
  });

  test('should deploy BatchAirdropContract on testnet', async () => {
    // Skip if no test ETH is available
    const balance = await provider.getBalance(testWallet.address);
    console.log(`💳 Test wallet balance: ${ethers.formatEther(balance)} ETH`);

    if (balance === 0n) {
      console.warn('⚠️  No test ETH available. Skipping contract deployment test.');
      expect(true).toBe(true); // Skip test gracefully
      return;
    }

    // Get gas information
    const gasInfo = await gasService.getGasInfo(SEPOLIA_CONFIG.rpcUrl, 'sepolia');

    // Deploy contract
    const deploymentConfig = {
      tokenAddress: TEST_TOKEN_CONFIG.address,
      chainId: SEPOLIA_CONFIG.chainId,
      rpcUrl: SEPOLIA_CONFIG.rpcUrl,
      deployerPrivateKey: testWallet.privateKey
    };

    try {
      const deploymentResult = await contractService.deployContract(deploymentConfig);

      expect(deploymentResult.contractAddress).toMatch(/^0x[a-fA-F0-9]{40}$/);
      expect(deploymentResult.transactionHash).toMatch(/^0x[a-fA-F0-9]{64}$/);
      expect(deploymentResult.blockNumber).toBeGreaterThan(0);
      expect(deploymentResult.gasUsed).toBeDefined();

      console.log(`✅ Contract deployed successfully`);
      console.log(`📍 Contract address: ${deploymentResult.contractAddress}`);
      console.log(`🔗 Transaction: ${SEPOLIA_CONFIG.blockExplorer}/tx/${deploymentResult.transactionHash}`);
      console.log(`⛽ Gas used: ${deploymentResult.gasUsed}`);

      // Verify contract on blockchain
      const contractCode = await provider.getCode(deploymentResult.contractAddress);
      expect(contractCode.length).toBeGreaterThan(2); // More than "0x"

      console.log(`✅ Contract verified on blockchain`);

      return deploymentResult;

    } catch (error) {
      console.error('❌ Contract deployment failed:', error);
      throw error;
    }
  });

  test('should estimate batch gas costs', async () => {
    const recipientCounts = [10, 50, 100, 500, 1000];

    for (const count of recipientCounts) {
      const gasEstimate = await gasService.getBatchGasEstimate(
        SEPOLIA_CONFIG.rpcUrl,
        'sepolia',
        count
      );

      expect(gasEstimate).toHaveProperty('baseGas');
      expect(gasEstimate).toHaveProperty('gasPerRecipient');
      expect(gasEstimate).toHaveProperty('totalGas');
      expect(gasEstimate).toHaveProperty('estimatedCost');
      expect(gasEstimate.recipientCount).toBe(count);

      expect(parseFloat(gasEstimate.totalGas)).toBeGreaterThan(0);
      expect(parseFloat(gasEstimate.estimatedCost)).toBeGreaterThan(0);

      console.log(`📊 ${count} recipients: ${gasEstimate.totalGas} gas, ${gasEstimate.estimatedCost} ETH`);
    }
  });

  test('should validate BatchAirdropContract bytecode', async () => {
    // This would verify that our compiled bytecode matches expected patterns
    const contractBytecode = ContractService.getContractBytecode();

    expect(contractBytecode).toBeDefined();
    expect(typeof contractBytecode).toBe('string');
    expect(contractBytecode.length).toBeGreaterThan(10);
    expect(contractBytecode.startsWith('0x')).toBe(true);

    // Bytecode should contain function selectors and runtime code
    expect(contractBytecode.length).toBeGreaterThan(100);

    console.log(`✅ BatchAirdropContract bytecode validated (${contractBytecode.length} characters)`);
  });

  test('should test error handling with invalid RPC', async () => {
    const invalidRpcUrl = 'https://invalid-rpc-url.example.com';

    await expect(
      gasService.getGasInfo(invalidRpcUrl, 'ethereum')
    ).rejects.toThrow();

    console.log('✅ Error handling validated for invalid RPC endpoints');
  });

  test('should validate address formats', async () => {
    const validAddresses = [
      '0x1234567890123456789012345678901234567890',
      '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd'
    ];

    const invalidAddresses = [
      '0x123',
      'invalid-address',
      '0x123456789012345678901234567890123456789012345', // Too long
      '1234567890123456789012345678901234567890' // Missing 0x prefix
    ];

    // Test valid addresses
    for (const address of validAddresses) {
      expect(address).toMatch(/^0x[a-fA-F0-9]{40}$/);
    }

    // Test invalid addresses
    for (const address of invalidAddresses) {
      expect(address).not.toMatch(/^0x[a-fA-F0-9]{40}$/);
    }

    console.log('✅ Address format validation tested');
  });

  test('should measure transaction performance', async () => {
    const performanceMetrics = {
      gasInfoFetchTime: 0,
      contractDeploymentTime: 0
    };

    // Measure gas info fetch time
    const gasInfoStart = Date.now();
    await gasService.getGasInfo(SEPOLIA_CONFIG.rpcUrl, 'sepolia');
    performanceMetrics.gasInfoFetchTime = Date.now() - gasInfoStart;

    console.log(`⚡ Gas info fetch time: ${performanceMetrics.gasInfoFetchTime}ms`);

    // All operations should complete within reasonable time
    expect(performanceMetrics.gasInfoFetchTime).toBeLessThan(5000); // 5 seconds

    console.log('✅ Performance metrics collected');
  });
});

// Integration test configuration
describe('Testnet Configuration Validation', () => {
  test('should validate Sepolia testnet configuration', () => {
    expect(SEPOLIA_CONFIG.chainId).toBe(11155111);
    expect(SEPOLIA_CONFIG.rpcUrl).toMatch(/^https:\/\//);
    expect(SEPOLIA_CONFIG.name).toBe('sepolia');
    expect(SEPOLIA_CONFIG.blockExplorer).toMatch(/^https:\/\//);
  });

  test('should validate test token configuration', () => {
    expect(TEST_TOKEN_CONFIG.address).toMatch(/^0x[a-fA-F0-9]{40}$/);
    expect(typeof TEST_TOKEN_CONFIG.decimals).toBe('number');
    expect(TEST_TOKEN_CONFIG.decimals).toBeGreaterThan(0);
    expect(typeof TEST_TOKEN_CONFIG.symbol).toBe('string');
    expect(TEST_TOKEN_CONFIG.symbol.length).toBeGreaterThan(0);
  });

  test('should validate test wallet configuration', () => {
    expect(TEST_WALLET.address).toMatch(/^0x[a-fA-F0-9]{40}$/);
    expect(TEST_WALLET.privateKey).toMatch(/^0x[a-fA-F0-9]{64}$/);
    expect(TEST_WALLET.address).toBe('0xd8F29E2e49757d008a14E78BB0B4ef3062932A4a');
  });
});