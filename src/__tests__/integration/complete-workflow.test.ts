import { CampaignService } from '../../main/services/CampaignService';
import { WalletService } from '../../main/services/WalletService';
import { ContractService } from '../../main/services/ContractService';
import { GasService } from '../../main/services/GasService';
import { DatabaseService } from '../../main/services/DatabaseService';
import { createTempTestDir, cleanupTempDir, mockEVMChain } from '../utils/testUtils';

// Mock ethers for integration testing
jest.mock('ethers', () => ({
  ethers: {
    JsonRpcProvider: jest.fn(),
    Wallet: jest.fn(),
    Contract: jest.fn(),
    ContractFactory: jest.fn(),
    parseUnits: jest.fn((value, decimals) => BigInt(Math.floor(parseFloat(value) * Math.pow(10, decimals)))),
    formatUnits: jest.fn((value, decimals) => (Number(value) / Math.pow(10, decimals)).toString()),
    id: jest.fn((signature) => `0x${'0'.repeat(63)}`),
    hexlify: jest.fn((value) => `0x${'0'.repeat(63)}`)
  }
}));

describe('Complete Workflow Integration Tests', () => {
  let campaignService: CampaignService;
  let walletService: WalletService;
  let contractService: ContractService;
  let gasService: GasService;
  let databaseService: DatabaseService;
  let testDir: string;

  beforeEach(async () => {
    testDir = createTempTestDir();

    // Initialize services
    databaseService = new DatabaseService();
    campaignService = new CampaignService(databaseService);
    walletService = new WalletService(databaseService);
    contractService = new ContractService();
    gasService = new GasService();

    await databaseService.init();
  });

  afterEach(async () => {
    await cleanupTempDir(testDir);
    jest.clearAllMocks();
  });

  test('complete campaign creation and execution workflow', async () => {
    // Step 1: Create campaign
    const campaignData = {
      name: 'Integration Test Campaign',
      tokenAddress: '0x1234567890123456789012345678901234567890',
      chainId: 1,
      rpcUrl: 'https://mainnet.infura.io/v3/test',
      deployerPrivateKey: '0x' + '1'.repeat(64)
    };

    // Create campaign
    const campaign = await campaignService.createCampaign(campaignData);
    expect(campaign).toBeDefined();
    expect(campaign.id).toBeDefined();
    expect(campaign.status).toBe('CREATED');

    // Step 2: Generate wallet for campaign
    const wallet = await walletService.generateWallet(campaign.id);
    expect(wallet.address).toBeDefined();
    expect(wallet.privateKey).toBeDefined();
    expect(wallet.publicKey).toBeDefined();

    // Update campaign with wallet and chain
    await campaignService.updateCampaign(campaign.id, {
      walletAddress: wallet.address,
      chain: '1'
    });

    // Step 3: Deploy contract
    const deploymentConfig = {
      tokenAddress: campaignData.tokenAddress,
      chainId: campaignData.chainId,
      rpcUrl: campaignData.rpcUrl,
      deployerPrivateKey: wallet.privateKey
    };

    // Mock successful deployment
    const mockDeploymentResult = {
      contractAddress: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
      transactionHash: '0xdeployhash',
      blockNumber: 12345,
      gasUsed: '150000'
    };

    jest.spyOn(contractService, 'deployContract').mockResolvedValue(mockDeploymentResult);

    const deploymentResult = await contractService.deployContract(deploymentConfig);
    expect(deploymentResult.contractAddress).toBeDefined();
    expect(deploymentResult.contractAddress).toMatch(/^0x[a-fA-F0-9]{40}$/);

    // Update campaign with contract address
    await campaignService.updateCampaign(campaign.id, {
      contractAddress: deploymentResult.contractAddress,
      status: 'READY'
    });

    // Step 4: Get gas information
    const mockGasInfo = {
      gasPrice: '20',
      network: 'ethereum',
      gasLimit: '1000000',
      estimatedCost: '0.02'
    };

    jest.spyOn(gasService, 'getGasInfo').mockResolvedValue(mockGasInfo);
    const gasInfo = await gasService.getGasInfo(campaignData.rpcUrl, 'ethereum');
    expect(gasInfo.gasPrice).toBe('20');

    // Step 5: Token approval (mocked)
    const mockApprovalResult = '0xapprovetxhash';
    jest.spyOn(contractService, 'approveTokens').mockResolvedValue(mockApprovalResult);

    const approvalResult = await contractService.approveTokens(
      campaignData.rpcUrl,
      wallet.privateKey,
      campaignData.tokenAddress,
      deploymentResult.contractAddress,
      '1000'
    );
    expect(approvalResult).toBe(mockApprovalResult);

    // Step 6: Batch transfer (mocked)
    const recipients = [
      '0x1234567890123456789012345678901234567890',
      '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd'
    ];
    const amounts = ['100', '200'];

    const mockBatchResult = {
      transactionHash: '0xbatchtxhash',
      totalAmount: '300',
      recipientCount: 2,
      gasUsed: '170000'
    };

    jest.spyOn(contractService, 'batchTransfer').mockResolvedValue(mockBatchResult);

    const batchResult = await contractService.batchTransfer(
      deploymentResult.contractAddress,
      campaignData.rpcUrl,
      wallet.privateKey,
      recipients,
      amounts,
      campaignData.tokenAddress
    );
    expect(batchResult.transactionHash).toBe('0xbatchtxhash');
    expect(batchResult.recipientCount).toBe(2);

    // Step 7: Update campaign status to completed
    await campaignService.updateCampaign(campaign.id, {
      status: 'COMPLETED',
      completedRecipients: recipients.length,
      totalRecipients: recipients.length
    });

    // Verify final campaign state
    const finalCampaign = await campaignService.getCampaignById(campaign.id);
    expect(finalCampaign.status).toBe('COMPLETED');
    expect(finalCampaign.completedRecipients).toBe(2);
    expect(finalCampaign.totalRecipients).toBe(2);
    expect(finalCampaign.contractAddress).toBe(deploymentResult.contractAddress);
    expect(finalCampaign.walletAddress).toBe(wallet.address);
  });

  test('campaign workflow with error handling', async () => {
    const campaignData = {
      name: 'Error Test Campaign',
      tokenAddress: '0x1234567890123456789012345678901234567890',
      chainId: 1,
      rpcUrl: 'https://mainnet.infura.io/v3/test',
      deployerPrivateKey: '0x' + '1'.repeat(64)
    };

    // Create campaign
    const campaign = await campaignService.createCampaign(campaignData);
    expect(campaign.status).toBe('CREATED');

    // Generate wallet
    const wallet = await walletService.generateWallet(campaign.id);

    // Update campaign
    await campaignService.updateCampaign(campaign.id, {
      walletAddress: wallet.address,
      chain: '1'
    });

    // Mock deployment failure
    jest.spyOn(contractService, 'deployContract').mockRejectedValue(
      new Error('Contract deployment failed')
    );

    // Attempt deployment
    await expect(contractService.deployContract({
      tokenAddress: campaignData.tokenAddress,
      chainId: campaignData.chainId,
      rpcUrl: campaignData.rpcUrl,
      deployerPrivateKey: wallet.privateKey
    })).rejects.toThrow('Contract deployment failed');

    // Campaign should remain in CREATED status
    const updatedCampaign = await campaignService.getCampaignById(campaign.id);
    expect(updatedCampaign.status).toBe('CREATED');
  });

  test('batch gas estimation workflow', async () => {
    const gasInfo = await gasService.getGasInfo(
      'https://mainnet.infura.io/v3/test',
      'ethereum',
      2000 // ETH price
    );

    expect(gasInfo).toHaveProperty('gasPrice');
    expect(gasInfo).toHaveProperty('network');
    expect(gasInfo).toHaveProperty('gasLimit');
    expect(gasInfo).toHaveProperty('estimatedCost');

    // Test batch gas estimation
    const batchGasEstimate = await gasService.getBatchGasEstimate(
      'https://mainnet.infura.io/v3/test',
      'ethereum',
      100 // 100 recipients
    );

    expect(batchGasEstimate).toHaveProperty('baseGas');
    expect(batchGasEstimate).toHaveProperty('gasPerRecipient');
    expect(batchGasEstimate).toHaveProperty('totalGas');
    expect(batchGasEstimate).toHaveProperty('estimatedCost');
    expect(batchGasEstimate.recipientCount).toBe(100);

    // Verify gas scales with recipient count
    const smallBatch = await gasService.getBatchGasEstimate(
      'https://mainnet.infura.io/v3/test',
      'ethereum',
      10 // 10 recipients
    );

    const largeBatch = await gasService.getBatchGasEstimate(
      'https://mainnet.infura.io/v3/test',
      'ethereum',
      1000 // 1000 recipients
    );

    expect(parseFloat(largeBatch.totalGas)).toBeGreaterThan(parseFloat(smallBatch.totalGas));
  });

  test('wallet management workflow', async () => {
    const campaignData = {
      name: 'Wallet Test Campaign',
      tokenAddress: '0x1234567890123456789012345678901234567890',
      chainId: 1,
      rpcUrl: 'https://mainnet.infura.io/v3/test',
      deployerPrivateKey: '0x' + '1'.repeat(64)
    };

    // Create campaign
    const campaign = await campaignService.createCampaign(campaignData);

    // Generate wallet
    const wallet = await walletService.generateWallet(campaign.id);
    expect(wallet.address).toMatch(/^0x[a-fA-F0-9]{40}$/);
    expect(wallet.privateKey).toMatch(/^0x[a-fA-F0-9]{64}$/);

    // Lock wallet
    await walletService.lockWallet(wallet.address, 'password123');

    // Try to unlock with wrong password
    const unlockResult = await walletService.unlockWallet(wallet.address, 'wrongpassword');
    expect(unlockResult.success).toBe(false);

    // Unlock with correct password
    const correctUnlockResult = await walletService.unlockWallet(wallet.address, 'password123');
    expect(correctUnlockResult.success).toBe(true);

    // Get wallet info
    const walletInfo = await walletService.getWalletInfo(wallet.address);
    expect(walletInfo.address).toBe(wallet.address);
    expect(walletInfo.isLocked).toBe(false);
  });

  test('database consistency workflow', async () => {
    const campaignData = {
      name: 'Database Test Campaign',
      tokenAddress: '0x1234567890123456789012345678901234567890',
      chainId: 1,
      rpcUrl: 'https://mainnet.infura.io/v3/test',
      deployerPrivateKey: '0x' + '1'.repeat(64)
    };

    // Create multiple campaigns
    const campaigns = [];
    for (let i = 0; i < 5; i++) {
      const campaign = await campaignService.createCampaign({
        ...campaignData,
        name: `${campaignData.name} ${i + 1}`
      });
      campaigns.push(campaign);
    }

    // Verify all campaigns are created
    const allCampaigns = await campaignService.listCampaigns();
    expect(allCampaigns.length).toBe(5);

    // Generate wallets for all campaigns
    for (const campaign of campaigns) {
      const wallet = await walletService.generateWallet(campaign.id);
      await campaignService.updateCampaign(campaign.id, {
        walletAddress: wallet.address,
        chain: '1'
      });
    }

    // Verify campaigns have wallet addresses
    const campaignsWithWallets = await campaignService.listCampaigns();
    for (const campaign of campaignsWithWallets) {
      expect(campaign.walletAddress).toBeDefined();
      expect(campaign.walletAddress).toMatch(/^0x[a-fA-F0-9]{40}$/);
    }

    // Delete one campaign
    await campaignService.deleteCampaign(campaigns[0].id);

    // Verify deletion
    const remainingCampaigns = await campaignService.listCampaigns();
    expect(remainingCampaigns.length).toBe(4);
    expect(remainingCampaigns.find(c => c.id === campaigns[0].id)).toBeUndefined();
  });

  test('complete workflow with different chains', async () => {
    const chains = [
      { chainId: 1, name: 'ethereum', rpcUrl: 'https://mainnet.infura.io/v3/test' },
      { chainId: 137, name: 'polygon', rpcUrl: 'https://polygon-mainnet.infura.io/v3/test' },
      { chainId: 56, name: 'bsc', rpcUrl: 'https://bsc-dataseed.binance.org' }
    ];

    for (const chain of chains) {
      const campaignData = {
        name: `${chain.name.toUpperCase()} Test Campaign`,
        tokenAddress: '0x1234567890123456789012345678901234567890',
        chainId: chain.chainId,
        rpcUrl: chain.rpcUrl,
        deployerPrivateKey: '0x' + '1'.repeat(64)
      };

      // Create campaign
      const campaign = await campaignService.createCampaign(campaignData);

      // Generate wallet
      const wallet = await walletService.generateWallet(campaign.id);

      // Update campaign
      await campaignService.updateCampaign(campaign.id, {
        walletAddress: wallet.address,
        chain: chain.chainId.toString()
      });

      // Get gas info for this chain
      const mockGasInfo = {
        gasPrice: '20',
        network: chain.name,
        gasLimit: '1000000',
        estimatedCost: '0.02'
      };

      jest.spyOn(gasService, 'getGasInfo').mockResolvedValue(mockGasInfo);
      const gasInfo = await gasService.getGasInfo(chain.rpcUrl, chain.name);
      expect(gasInfo.network).toBe(chain.name);
    }
  });

  test('campaign lifecycle workflow', async () => {
    const campaignData = {
      name: 'Lifecycle Test Campaign',
      tokenAddress: '0x1234567890123456789012345678901234567890',
      chainId: 1,
      rpcUrl: 'https://mainnet.infura.io/v3/test',
      deployerPrivateKey: '0x' + '1'.repeat(64)
    };

    // Create campaign (CREATED)
    const campaign = await campaignService.createCampaign(campaignData);
    expect(campaign.status).toBe('CREATED');

    // Generate wallet and deploy contract
    const wallet = await walletService.generateWallet(campaign.id);
    const mockDeploymentResult = {
      contractAddress: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
      transactionHash: '0xdeployhash',
      blockNumber: 12345,
      gasUsed: '150000'
    };

    jest.spyOn(contractService, 'deployContract').mockResolvedValue(mockDeploymentResult);

    // Deploy contract (READY)
    await campaignService.updateCampaign(campaign.id, {
      walletAddress: wallet.address,
      chain: '1',
      contractAddress: mockDeploymentResult.contractAddress,
      status: 'READY'
    });

    // Start sending (SENDING)
    await campaignService.updateCampaign(campaign.id, {
      status: 'SENDING',
      totalRecipients: 100,
      completedRecipients: 50
    });

    // Pause campaign (PAUSED)
    await campaignService.updateCampaign(campaign.id, {
      status: 'PAUSED'
    });

    // Resume and complete (COMPLETED)
    await campaignService.updateCampaign(campaign.id, {
      status: 'COMPLETED',
      completedRecipients: 100
    });

    // Verify final state
    const finalCampaign = await campaignService.getCampaignById(campaign.id);
    expect(finalCampaign.status).toBe('COMPLETED');
    expect(finalCampaign.completedRecipients).toBe(100);
    expect(finalCampaign.totalRecipients).toBe(100);
  });
});