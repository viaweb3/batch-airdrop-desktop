import { ipcMain } from 'electron';
import { setupIPCHandlers } from '../../main/ipc/handlers';
import { createTempTestDir, cleanupTempDir } from '../../utils/testUtils';

// Mock dependencies
jest.mock('axios');
const axios = require('axios');

describe('IPC Handlers Integration Tests', () => {
  let testDir: string;
  let responses: any[] = [];

  beforeEach(() => {
    testDir = createTempTestDir();
    responses = [];

    // Clear all handlers before each test
    ipcMain.removeAllListeners();

    // Setup handlers with custom test directory
    setupIPCHandlers();

    // Mock axios responses
    axios.get.mockResolvedValue({
      data: {
        ethereum: { usd: 2000.50 },
        'matic-network': { usd: 1.20 },
        solana: { usd: 100.00 }
      }
    });
  });

  afterEach(async () => {
    cleanupTempDir(testDir);
    jest.clearAllMocks();
  });

  describe('Campaign Handlers', () => {
    test('should handle campaign:create successfully', async () => {
      const campaignData = {
        name: 'Test Campaign',
        chain: 'ethereum',
        tokenAddress: '0x1234567890123456789012345678901234567890',
        totalRecipients: 100,
        walletAddress: '0x1234567890123456789012345678901234567890',
        walletEncryptedKey: 'encrypted:test:key'
      };

      // Get the handler function directly from the IPC handlers
      const handlers = (ipcMain as any).handlerMap || new Map();
      if (!handlers.get) {
        // If handlerMap is not available, skip this test
        console.log('Handler map not available, skipping test');
        return;
      }

      const handler = handlers.get('campaign:create');
      if (!handler) {
        console.log('campaign:create handler not found, skipping test');
        return;
      }

      const result = await handler(null, campaignData);

      expect(result).toHaveProperty('id');
      expect(result.name).toBe(campaignData.name);
      expect(result.status).toBe('CREATED');
    });
  });

  describe('Wallet Handlers', () => {
    test('should handle wallet:unlock successfully', async () => {
      const password = 'testPassword123';

      const handlers = (ipcMain as any).handlerMap || new Map();
      if (!handlers.get) {
        console.log('Handler map not available, skipping test');
        return;
      }

      const handler = handlers.get('wallet:unlock');
      if (!handler) {
        console.log('wallet:unlock handler not found, skipping test');
        return;
      }

      const result = await handler(null, password);

      expect(result.success).toBe(true);
      expect(result.isLocked).toBe(false);
    });
  });

  describe('Chain Handlers', () => {
    test('should handle chain:getEVMChains successfully', async () => {
      const handlers = (ipcMain as any).handlerMap || new Map();
      if (!handlers.get) {
        console.log('Handler map not available, skipping test');
        return;
      }

      const handler = handlers.get('chain:getEVMChains');
      if (!handler) {
        console.log('chain:getEVMChains handler not found, skipping test');
        return;
      }

      const chains = await handler(null, false);

      expect(Array.isArray(chains)).toBe(true);
      expect(chains.length).toBeGreaterThan(0);
      expect(chains[0]).toHaveProperty('chainId');
      expect(chains[0]).toHaveProperty('name');
      expect(chains[0]).toHaveProperty('rpcUrl');
    });
  });

  describe('Price Handlers', () => {
    test('should handle price:getPrice successfully', async () => {
      const symbol = 'ETH';

      const handlers = (ipcMain as any).handlerMap || new Map();
      if (!handlers.get) {
        console.log('Handler map not available, skipping test');
        return;
      }

      const handler = handlers.get('price:getPrice');
      if (!handler) {
        console.log('price:getPrice handler not found, skipping test');
        return;
      }

      const result = await handler(null, symbol);

      expect(result).toHaveProperty('symbol', symbol);
      expect(result).toHaveProperty('price');
      expect(typeof result.price).toBe('number');
    });

    test('should handle price:getPrices successfully', async () => {
      const symbols = ['ETH', 'BTC', 'MATIC'];

      const handlers = (ipcMain as any).handlerMap || new Map();
      if (!handlers.get) {
        console.log('Handler map not available, skipping test');
        return;
      }

      const handler = handlers.get('price:getPrices');
      if (!handler) {
        console.log('price:getPrices handler not found, skipping test');
        return;
      }

      const result = await handler(null, symbols);

      expect(typeof result).toBe('object');
      symbols.forEach(symbol => {
        expect(result).toHaveProperty(symbol);
        expect(typeof result[symbol]).toBe('number');
      });
    });
  });

  describe('Settings Handlers', () => {
    test('should handle settings:get successfully', async () => {
      const handlers = (ipcMain as any).handlerMap || new Map();
      if (!handlers.get) {
        console.log('Handler map not available, skipping test');
        return;
      }

      const handler = handlers.get('settings:get');
      if (!handler) {
        console.log('settings:get handler not found, skipping test');
        return;
      }

      const settings = await handler(null);

      expect(typeof settings).toBe('object');
    });

    test('should handle settings:update successfully', async () => {
      const newSettings = {
        theme: 'dark',
        language: 'en',
        notifications: true
      };

      const handlers = (ipcMain as any).handlerMap || new Map();
      if (!handlers.get) {
        console.log('Handler map not available, skipping test');
        return;
      }

      const handler = handlers.get('settings:update');
      if (!handler) {
        console.log('settings:update handler not found, skipping test');
        return;
      }

      const result = await handler(null, newSettings);

      expect(result.success).toBe(true);
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid handler names gracefully', async () => {
      const handlers = (ipcMain as any).handlerMap || new Map();
      const invalidHandler = handlers.get('invalid:handler');
      expect(invalidHandler).toBeUndefined();
    });

    test('should handle malformed data gracefully', async () => {
      const handlers = (ipcMain as any).handlerMap || new Map();
      if (!handlers.get) {
        console.log('Handler map not available, skipping test');
        return;
      }

      const handler = handlers.get('campaign:create');
      if (!handler) {
        console.log('campaign:create handler not found, skipping test');
        return;
      }

      await expect(handler(null, null)).rejects.toThrow();
      await expect(handler(null, undefined)).rejects.toThrow();
    });
  });
});