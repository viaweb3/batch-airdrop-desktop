import { CampaignService } from '../../main/services/CampaignService';
import { DatabaseManager } from '../../main/database/schema';
import { createTempTestDir, cleanupTempDir, mockCampaign } from '../utils/testUtils';

// Mock dependencies
jest.mock('axios');

describe('CampaignService', () => {
  let campaignService: CampaignService;
  let databaseManager: DatabaseManager;
  let testDir: string;

  beforeEach(async () => {
    testDir = createTempTestDir();
    databaseManager = new DatabaseManager(testDir);
    campaignService = new CampaignService(databaseManager);
  });

  afterEach(async () => {
    cleanupTempDir(testDir);
  });

  describe('Campaign Creation', () => {
    test('should create campaign successfully', async () => {
      const campaignData = {
        name: 'Test Campaign',
        chain: 'ethereum',
        tokenAddress: '0x1234567890123456789012345678901234567890',
        totalRecipients: 100,
        walletAddress: '0x1234567890123456789012345678901234567890',
        walletEncryptedKey: 'encrypted:test:key'
      };

      const campaign = await campaignService.createCampaign(campaignData);

      expect(campaign).toHaveProperty('id');
      expect(campaign.name).toBe(campaignData.name);
      expect(campaign.chain).toBe(campaignData.chain);
      expect(campaign.tokenAddress).toBe(campaignData.tokenAddress);
      expect(campaign.status).toBe('CREATED');
      expect(campaign.totalRecipients).toBe(campaignData.totalRecipients);
      expect(campaign.completedRecipients).toBe(0);
      expect(campaign.walletAddress).toBe(campaignData.walletAddress);
      expect(campaign.walletEncryptedKey).toBe(campaignData.walletEncryptedKey);
      expect(campaign.createdAt).toBeDefined();
      expect(campaign.updatedAt).toBeDefined();
    });

    test('should fail to create campaign with missing required fields', async () => {
      const invalidData = {
        name: 'Test Campaign'
        // Missing required fields
      };

      await expect(campaignService.createCampaign(invalidData as any)).rejects.toThrow();
    });

    test('should fail to create campaign with invalid chain', async () => {
      const campaignData = {
        name: 'Test Campaign',
        chain: 'invalid-chain',
        tokenAddress: '0x1234567890123456789012345678901234567890',
        totalRecipients: 100,
        walletAddress: '0x1234567890123456789012345678901234567890',
        walletEncryptedKey: 'encrypted:test:key'
      };

      await expect(campaignService.createCampaign(campaignData)).rejects.toThrow('Invalid chain');
    });

    test('should fail to create campaign with invalid token address', async () => {
      const campaignData = {
        name: 'Test Campaign',
        chain: 'ethereum',
        tokenAddress: 'invalid-address',
        totalRecipients: 100,
        walletAddress: '0x1234567890123456789012345678901234567890',
        walletEncryptedKey: 'encrypted:test:key'
      };

      await expect(campaignService.createCampaign(campaignData)).rejects.toThrow('Invalid token address');
    });

    test('should fail to create campaign with zero recipients', async () => {
      const campaignData = {
        name: 'Test Campaign',
        chain: 'ethereum',
        tokenAddress: '0x1234567890123456789012345678901234567890',
        totalRecipients: 0,
        walletAddress: '0x1234567890123456789012345678901234567890',
        walletEncryptedKey: 'encrypted:test:key'
      };

      await expect(campaignService.createCampaign(campaignData)).rejects.toThrow('Total recipients must be greater than 0');
    });
  });

  describe('Campaign Retrieval', () => {
    let createdCampaign: any;

    beforeEach(async () => {
      const campaignData = {
        name: 'Test Campaign',
        chain: 'ethereum',
        tokenAddress: '0x1234567890123456789012345678901234567890',
        totalRecipients: 100,
        walletAddress: '0x1234567890123456789012345678901234567890',
        walletEncryptedKey: 'encrypted:test:key'
      };
      createdCampaign = await campaignService.createCampaign(campaignData);
    });

    test('should get campaign by ID', async () => {
      const retrievedCampaign = await campaignService.getCampaignById(createdCampaign.id);

      expect(retrievedCampaign).not.toBeNull();
      expect(retrievedCampaign!.id).toBe(createdCampaign.id);
      expect(retrievedCampaign!.name).toBe(createdCampaign.name);
    });

    test('should return null for non-existent campaign ID', async () => {
      const retrievedCampaign = await campaignService.getCampaignById('non-existent-id');
      expect(retrievedCampaign).toBeNull();
    });

    test('should list all campaigns', async () => {
      const campaigns = await campaignService.listCampaigns();

      expect(campaigns).toHaveLength(1);
      expect(campaigns[0].id).toBe(createdCampaign.id);
    });

    test('should list campaigns with filters', async () => {
      // Create another campaign with different status
      const campaignData2 = {
        name: 'Another Campaign',
        chain: 'polygon',
        tokenAddress: '0x9876543210987654321098765432109876543210',
        totalRecipients: 50,
        walletAddress: '0x9876543210987654321098765432109876543210',
        walletEncryptedKey: 'encrypted:test:key2'
      };
      await campaignService.createCampaign(campaignData2);

      // Filter by chain
      const ethereumCampaigns = await campaignService.listCampaigns({ chain: 'ethereum' });
      expect(ethereumCampaigns).toHaveLength(1);
      expect(ethereumCampaigns[0].chain).toBe('ethereum');

      // Filter by status
      const createdCampaigns = await campaignService.listCampaigns({ status: 'CREATED' });
      expect(createdCampaigns).toHaveLength(2);
    });
  });

  describe('Campaign Status Management', () => {
    let createdCampaign: any;

    beforeEach(async () => {
      const campaignData = {
        name: 'Test Campaign',
        chain: 'ethereum',
        tokenAddress: '0x1234567890123456789012345678901234567890',
        totalRecipients: 100,
        walletAddress: '0x1234567890123456789012345678901234567890',
        walletEncryptedKey: 'encrypted:test:key'
      };
      createdCampaign = await campaignService.createCampaign(campaignData);
    });

    test('should start campaign successfully', async () => {
      const result = await campaignService.startCampaign(createdCampaign.id);

      expect(result.success).toBe(true);

      const updatedCampaign = await campaignService.getCampaignById(createdCampaign.id);
      expect(updatedCampaign!.status).toBe('SENDING');
    });

    test('should pause campaign successfully', async () => {
      // First start the campaign
      await campaignService.startCampaign(createdCampaign.id);

      // Then pause it
      const result = await campaignService.pauseCampaign(createdCampaign.id);

      expect(result.success).toBe(true);

      const updatedCampaign = await campaignService.getCampaignById(createdCampaign.id);
      expect(updatedCampaign!.status).toBe('PAUSED');
    });

    test('should fail to start non-existent campaign', async () => {
      await expect(campaignService.startCampaign('non-existent-id')).rejects.toThrow('Campaign not found');
    });

    test('should fail to pause non-existent campaign', async () => {
      await expect(campaignService.pauseCampaign('non-existent-id')).rejects.toThrow('Campaign not found');
    });

    test('should fail to start already completed campaign', async () => {
      // Update campaign status to completed directly in database
      await campaignService.updateCampaignStatus(createdCampaign.id, 'COMPLETED');

      await expect(campaignService.startCampaign(createdCampaign.id)).rejects.toThrow('Cannot start completed campaign');
    });
  });

  describe('Campaign Progress Tracking', () => {
    let createdCampaign: any;

    beforeEach(async () => {
      const campaignData = {
        name: 'Test Campaign',
        chain: 'ethereum',
        tokenAddress: '0x1234567890123456789012345678901234567890',
        totalRecipients: 100,
        walletAddress: '0x1234567890123456789012345678901234567890',
        walletEncryptedKey: 'encrypted:test:key'
      };
      createdCampaign = await campaignService.createCampaign(campaignData);
    });

    test('should update campaign progress', async () => {
      const completedCount = 25;
      await campaignService.updateCampaignProgress(createdCampaign.id, completedCount);

      const updatedCampaign = await campaignService.getCampaignById(createdCampaign.id);
      expect(updatedCampaign!.completedRecipients).toBe(completedCount);
    });

    test('should not update progress beyond total recipients', async () => {
      const completedCount = 150; // More than total
      await campaignService.updateCampaignProgress(createdCampaign.id, completedCount);

      const updatedCampaign = await campaignService.getCampaignById(createdCampaign.id);
      expect(updatedCampaign!.completedRecipients).toBe(createdCampaign.totalRecipients);
    });

    test('should complete campaign when all recipients processed', async () => {
      // Start campaign first
      await campaignService.startCampaign(createdCampaign.id);

      // Update to full completion
      await campaignService.updateCampaignProgress(createdCampaign.id, createdCampaign.totalRecipients);

      const updatedCampaign = await campaignService.getCampaignById(createdCampaign.id);
      expect(updatedCampaign!.status).toBe('COMPLETED');
    });
  });

  describe('Campaign Statistics', () => {
    test('should get campaign statistics', async () => {
      // Create multiple campaigns with different statuses
      const campaign1 = await campaignService.createCampaign({
        name: 'Active Campaign',
        chain: 'ethereum',
        tokenAddress: '0x1234567890123456789012345678901234567890',
        totalRecipients: 100,
        walletAddress: '0x1234567890123456789012345678901234567890',
        walletEncryptedKey: 'encrypted:test:key1'
      });

      const campaign2 = await campaignService.createCampaign({
        name: 'Completed Campaign',
        chain: 'polygon',
        tokenAddress: '0x9876543210987654321098765432109876543210',
        totalRecipients: 50,
        walletAddress: '0x9876543210987654321098765432109876543210',
        walletEncryptedKey: 'encrypted:test:key2'
      });

      // Start and complete campaign2
      await campaignService.startCampaign(campaign2.id);
      await campaignService.updateCampaignProgress(campaign2.id, campaign2.totalRecipients);

      const stats = await campaignService.getCampaignStats();

      expect(stats.totalCampaigns).toBe(2);
      expect(stats.activeCampaigns).toBe(1);
      expect(stats.completedCampaigns).toBe(1);
      expect(stats.totalRecipients).toBe(150);
      expect(stats.totalCompletedRecipients).toBe(50);
      expect(stats.averageCompletionRate).toBeCloseTo(33.33, 1);
    });

    test('should handle empty statistics', async () => {
      const stats = await campaignService.getCampaignStats();

      expect(stats.totalCampaigns).toBe(0);
      expect(stats.activeCampaigns).toBe(0);
      expect(stats.completedCampaigns).toBe(0);
      expect(stats.totalRecipients).toBe(0);
      expect(stats.totalCompletedRecipients).toBe(0);
      expect(stats.averageCompletionRate).toBe(0);
    });
  });

  describe('Campaign Deletion', () => {
    let createdCampaign: any;

    beforeEach(async () => {
      const campaignData = {
        name: 'Test Campaign',
        chain: 'ethereum',
        tokenAddress: '0x1234567890123456789012345678901234567890',
        totalRecipients: 100,
        walletAddress: '0x1234567890123456789012345678901234567890',
        walletEncryptedKey: 'encrypted:test:key'
      };
      createdCampaign = await campaignService.createCampaign(campaignData);
    });

    test('should delete campaign successfully', async () => {
      await campaignService.deleteCampaign(createdCampaign.id);

      const deletedCampaign = await campaignService.getCampaignById(createdCampaign.id);
      expect(deletedCampaign).toBeNull();
    });

    test('should fail to delete non-existent campaign', async () => {
      await expect(campaignService.deleteCampaign('non-existent-id')).rejects.toThrow('Campaign not found');
    });

    test('should not delete active campaign', async () => {
      // Start the campaign
      await campaignService.startCampaign(createdCampaign.id);

      // Try to delete it
      await expect(campaignService.deleteCampaign(createdCampaign.id)).rejects.toThrow('Cannot delete active campaign');
    });
  });
});