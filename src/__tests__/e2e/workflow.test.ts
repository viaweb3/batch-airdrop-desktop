import { createTempTestDir, cleanupTempDir } from '../../utils/testUtils';
import path from 'path';

// Mock Electron module - mocks are hoisted, so define inline
jest.mock('electron', () => {
  const mockApp = {
    getPath: jest.fn((name: string) => {
      if (name === 'userData') {
        return '/tmp/electron-test';
      }
      return '/mock/path';
    }),
    quit: jest.fn(),
    on: jest.fn(),
    once: jest.fn(),
    whenReady: jest.fn().mockResolvedValue(undefined)
  };

  const mockWindow = {
    loadURL: jest.fn().mockResolvedValue(undefined),
    on: jest.fn(),
    once: jest.fn(),
    webContents: {
      openDevTools: jest.fn(),
      on: jest.fn()
    }
  };

  return {
    app: mockApp,
    BrowserWindow: jest.fn().mockImplementation(() => mockWindow),
    ipcMain: {
      handle: jest.fn(),
      on: jest.fn(),
      handlerMap: new Map()
    }
  };
}, { virtual: true });

import { app, BrowserWindow, ipcMain } from 'electron';
import { setupIPCHandlers } from '../../main/ipc/handlers';

describe('End-to-End Workflow Tests', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = createTempTestDir();
    ipcMain.handlerMap.clear();
    setupIPCHandlers();
  });

  afterEach(async () => {
    cleanupTempDir(testDir);
    jest.clearAllMocks();
  });

  describe('Complete Campaign Workflow', () => {
    test('should handle complete campaign lifecycle', async () => {
      // Step 1: Initialize wallet
      const unlockHandler = ipcMain.handlerMap.get('wallet:unlock');
      const unlockResult = await unlockHandler(null, 'testPassword123');
      expect(unlockResult.success).toBe(true);

      // Step 2: Create wallet
      const createWalletHandler = ipcMain.handlerMap.get('wallet:create');
      const evmWallet = await createWalletHandler(null, 'evm');
      expect(evmWallet.address).toMatch(/^0x[a-fA-F0-9]{40}$/);

      // Step 3: Create campaign
      const createCampaignHandler = ipcMain.handlerMap.get('campaign:create');
      const campaignData = {
        name: 'Test Airdrop Campaign',
        chain: 'ethereum',
        tokenAddress: '0x1234567890123456789012345678901234567890',
        totalRecipients: 100,
        walletAddress: evmWallet.address,
        walletEncryptedKey: evmWallet.encryptedKey
      };
      const campaign = await createCampaignHandler(null, campaignData);
      expect(campaign.status).toBe('CREATED');

      // Step 4: Start campaign
      const startCampaignHandler = ipcMain.handlerMap.get('campaign:start');
      const startResult = await startCampaignHandler(null, campaign.id);
      expect(startResult.success).toBe(true);

      // Step 5: Check campaign status
      const getCampaignHandler = ipcMain.handlerMap.get('campaign:getById');
      const updatedCampaign = await getCampaignHandler(null, campaign.id);
      expect(updatedCampaign.status).toBe('SENDING');

      // Step 6: Pause campaign
      const pauseCampaignHandler = ipcMain.handlerMap.get('campaign:pause');
      const pauseResult = await pauseCampaignHandler(null, campaign.id);
      expect(pauseResult.success).toBe(true);

      // Step 7: Verify final status
      const finalCampaign = await getCampaignHandler(null, campaign.id);
      expect(finalCampaign.status).toBe('PAUSED');
    });
  });

  describe('Multi-Chain Workflow', () => {
    test('should handle campaigns across different chains', async () => {
      // Initialize wallet
      const unlockHandler = ipcMain.handlerMap.get('wallet:unlock');
      await unlockHandler(null, 'testPassword123');

      // Create wallet
      const createWalletHandler = ipcMain.handlerMap.get('wallet:create');
      const wallet = await createWalletHandler(null, 'evm');

      // Get available chains
      const getChainsHandler = ipcMain.handlerMap.get('chain:getEVMChains');
      const chains = await getChainsHandler(null, true);
      expect(chains.length).toBeGreaterThan(1);

      // Create campaigns on different chains
      const createCampaignHandler = ipcMain.handlerMap.get('campaign:create');
      const ethereumCampaign = await createCampaignHandler(null, {
        name: 'Ethereum Airdrop',
        chain: 'ethereum',
        tokenAddress: '0x1234567890123456789012345678901234567890',
        totalRecipients: 50,
        walletAddress: wallet.address,
        walletEncryptedKey: wallet.encryptedKey
      });

      const polygonCampaign = await createCampaignHandler(null, {
        name: 'Polygon Airdrop',
        chain: 'polygon',
        tokenAddress: '0x9876543210987654321098765432109876543210',
        totalRecipients: 75,
        walletAddress: wallet.address,
        walletEncryptedKey: wallet.encryptedKey
      });

      expect(ethereumCampaign.chain).toBe('ethereum');
      expect(polygonCampaign.chain).toBe('polygon');

      // List campaigns with chain filter
      const listCampaignsHandler = ipcMain.handlerMap.get('campaign:list');
      const ethCampaigns = await listCampaignsHandler(null, { chain: 'ethereum' });
      const polygonCampaigns = await listCampaignsHandler(null, { chain: 'polygon' });

      expect(ethCampaigns.length).toBe(1);
      expect(polygonCampaigns.length).toBe(1);
      expect(ethCampaigns[0].chain).toBe('ethereum');
      expect(polygonCampaigns[0].chain).toBe('polygon');
    });
  });

  describe('Price and Gas Integration', () => {
    test('should integrate price monitoring with campaign operations', async () => {
      // Get initial price data
      const getPricesHandler = ipcMain.handlerMap.get('price:getPrices');
      const prices = await getPricesHandler(null, ['ETH', 'MATIC']);
      expect(prices).toHaveProperty('ETH');
      expect(prices).toHaveProperty('MATIC');

      // Get gas prices
      const getGasPriceHandler = ipcMain.handlerMap.get('price:getGasPrice');
      const ethGas = await getGasPriceHandler(null, 'ethereum');
      const polygonGas = await getGasPriceHandler(null, 'polygon');

      expect(ethGas).toHaveProperty('gasPrice');
      expect(polygonGas).toHaveProperty('gasPrice');

      // Get comprehensive summary
      const getSummaryHandler = ipcMain.handlerMap.get('price:getSummary');
      const summary = await getSummaryHandler(null);

      expect(summary).toHaveProperty('prices');
      expect(summary).toHaveProperty('changes');
      expect(summary).toHaveProperty('gasPrices');
      expect(summary.prices).toHaveProperty('ETH');
      expect(summary.gasPrices).toHaveProperty('ethereum');
    });
  });

  describe('File Import/Export Workflow', () => {
    test('should handle CSV import and report export', async () => {
      const fs = require('fs');
      const csvPath = path.join(testDir, 'recipients.csv');
      const csvContent = `address,amount
0x742d35Cc6634C0532925a3b8D4C8e8C4b8e8f8a8,100
0x8ba1f109551bD432803012645Hac136c22C57B,200
0x1234567890123456789012345678901234567890,150`;

      fs.writeFileSync(csvPath, csvContent);

      // Read CSV
      const readCSVHandler = ipcMain.handlerMap.get('file:readCSV');
      const recipients = await readCSVHandler(null, csvPath);

      expect(recipients).toHaveLength(3);
      expect(recipients[0]).toHaveProperty('address');
      expect(recipients[0]).toHaveProperty('amount');

      // Initialize wallet and create campaign for export test
      const unlockHandler = ipcMain.handlerMap.get('wallet:unlock');
      await unlockHandler(null, 'testPassword123');

      const createWalletHandler = ipcMain.handlerMap.get('wallet:create');
      const wallet = await createWalletHandler(null, 'evm');

      const createCampaignHandler = ipcMain.handlerMap.get('campaign:create');
      const campaign = await createCampaignHandler(null, {
        name: 'Test Export Campaign',
        chain: 'ethereum',
        tokenAddress: '0x1234567890123456789012345678901234567890',
        totalRecipients: recipients.length,
        walletAddress: wallet.address,
        walletEncryptedKey: wallet.encryptedKey
      });

      // Export report
      const exportReportHandler = ipcMain.handlerMap.get('file:exportReport');
      const exportResult = await exportReportHandler(null, campaign.id, 'csv');

      expect(exportResult.success).toBe(true);
      expect(exportResult).toHaveProperty('filePath');
      expect(fs.existsSync(exportResult.filePath)).toBe(true);
    });
  });

  describe('Settings Management Workflow', () => {
    test('should handle settings persistence and updates', async () => {
      // Get initial settings
      const getSettingsHandler = ipcMain.handlerMap.get('settings:get');
      const initialSettings = await getSettingsHandler(null);

      expect(typeof initialSettings).toBe('object');

      // Update settings
      const updateSettingsHandler = ipcMain.handlerMap.get('settings:update');
      const newSettings = {
        theme: 'dark',
        language: 'zh-CN',
        notifications: false,
        autoUpdate: true,
        gasThreshold: 50
      };

      const updateResult = await updateSettingsHandler(null, newSettings);
      expect(updateResult.success).toBe(true);

      // Verify updated settings
      const updatedSettings = await getSettingsHandler(null);
      expect(updatedSettings.theme).toBe('dark');
      expect(updatedSettings.language).toBe('zh-CN');
      expect(updatedSettings.notifications).toBe(false);
    });
  });

  describe('Error Recovery Workflow', () => {
    test('should handle service failures gracefully', async () => {
      // Test invalid campaign operations
      const getCampaignHandler = ipcMain.handlerMap.get('campaign:getById');
      const nonExistentCampaign = await getCampaignHandler(null, 'invalid-id');
      expect(nonExistentCampaign).toBeNull();

      // Test invalid wallet operations
      const exportKeyHandler = ipcMain.handlerMap.get('wallet:exportPrivateKey');
      await expect(exportKeyHandler(null, 'invalid-encrypted-key')).rejects.toThrow();

      // Test invalid chain operations
      const testLatencyHandler = ipcMain.handlerMap.get('chain:testEVMLatency');
      await expect(testLatencyHandler(null, 99999)).rejects.toThrow();

      // Verify system is still functional
      const listCampaignsHandler = ipcMain.handlerMap.get('campaign:list');
      const campaigns = await listCampaignsHandler(null, {});
      expect(Array.isArray(campaigns)).toBe(true);
    });
  });

  describe('Performance and Resource Management', () => {
    test('should handle concurrent operations efficiently', async () => {
      // Initialize wallet
      const unlockHandler = ipcMain.handlerMap.get('wallet:unlock');
      await unlockHandler(null, 'testPassword123');

      // Create multiple campaigns concurrently
      const createWalletHandler = ipcMain.handlerMap.get('wallet:create');
      const wallet = await createWalletHandler(null, 'evm');

      const createCampaignHandler = ipcMain.handlerMap.get('campaign:create');
      const campaignPromises = [];

      for (let i = 0; i < 5; i++) {
        campaignPromises.push(createCampaignHandler(null, {
          name: `Campaign ${i}`,
          chain: 'ethereum',
          tokenAddress: `0x${'1234567890'.repeat(4)}${i}`,
          totalRecipients: 10 + i,
          walletAddress: wallet.address,
          walletEncryptedKey: wallet.encryptedKey
        }));
      }

      const campaigns = await Promise.all(campaignPromises);
      expect(campaigns).toHaveLength(5);

      // Verify all campaigns were created successfully
      const listCampaignsHandler = ipcMain.handlerMap.get('campaign:list');
      const allCampaigns = await listCampaignsHandler(null, {});
      expect(allCampaigns.length).toBeGreaterThanOrEqual(5);
    });

    test('should handle large data operations efficiently', async () => {
      // Create large CSV file
      const fs = require('fs');
      const csvPath = path.join(testDir, 'large_recipients.csv');
      let csvContent = 'address,amount\n';

      for (let i = 0; i < 1000; i++) {
        csvContent += `0x${'1234567890abcdef'.repeat(4)}${i.toString(16).padStart(4, '0')},${10 + i}\n`;
      }

      fs.writeFileSync(csvPath, csvContent);

      // Read large CSV
      const startTime = Date.now();
      const readCSVHandler = ipcMain.handlerMap.get('file:readCSV');
      const recipients = await readCSVHandler(null, csvPath);
      const endTime = Date.now();

      expect(recipients).toHaveLength(1000);
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
    });
  });

  describe('Security Validation Workflow', () => {
    test('should enforce security constraints throughout workflow', async () => {
      // Test wallet security
      const unlockHandler = ipcMain.handlerMap.get('wallet:unlock');
      const wrongPasswordResult = await unlockHandler(null, 'wrong-password');
      expect(wrongPasswordResult.success).toBe(false);

      // Correct password
      const correctPasswordResult = await unlockHandler(null, 'testPassword123');
      expect(correctPasswordResult.success).toBe(true);

      // Test address validation
      const createCampaignHandler = ipcMain.handlerMap.get('campaign:create');
      const invalidCampaign = {
        name: 'Invalid Campaign',
        chain: 'ethereum',
        tokenAddress: 'invalid-address',
        totalRecipients: 100,
        walletAddress: 'invalid-wallet',
        walletEncryptedKey: 'encrypted:key'
      };

      await expect(createCampaignHandler(null, invalidCampaign)).rejects.toThrow();

      // Test valid campaign creation
      const createWalletHandler = ipcMain.handlerMap.get('wallet:create');
      const wallet = await createWalletHandler(null, 'evm');

      const validCampaign = {
        name: 'Valid Campaign',
        chain: 'ethereum',
        tokenAddress: '0x1234567890123456789012345678901234567890',
        totalRecipients: 100,
        walletAddress: wallet.address,
        walletEncryptedKey: wallet.encryptedKey
      };

      const campaign = await createCampaignHandler(null, validCampaign);
      expect(campaign.id).toBeDefined();
      expect(campaign.status).toBe('CREATED');
    });
  });
});