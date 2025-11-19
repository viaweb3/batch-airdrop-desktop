import request from 'supertest';
import { setupTestApp, teardownTestApp } from '../utils/testApp';
import { DatabaseService } from '../../main/services/DatabaseService';

// Mock electron environment
const mockElectronAPI = {
  ipcRenderer: {
    invoke: jest.fn()
  }
};

global.window = {
  electronAPI: mockElectronAPI
} as any;

describe('API Endpoints Integration Tests', () => {
  let app: any;
  let databaseService: DatabaseService;

  beforeAll(async () => {
    const setup = await setupTestApp();
    app = setup.app;
    databaseService = setup.databaseService;
  });

  afterAll(async () => {
    await teardownTestApp();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Campaign API', () => {
    test('POST /api/campaigns - create campaign', async () => {
      const campaignData = {
        name: 'API Test Campaign',
        tokenAddress: '0x1234567890123456789012345678901234567890',
        chainId: 1,
        rpcUrl: 'https://mainnet.infura.io/v3/test'
      };

      // Mock the campaign creation
      const mockCampaign = {
        id: '1',
        name: campaignData.name,
        tokenAddress: campaignData.tokenAddress,
        chainId: campaignData.chainId,
        rpcUrl: campaignData.rpcUrl,
        status: 'CREATED',
        totalRecipients: 0,
        completedRecipients: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      mockElectronAPI.ipcRenderer.invoke.mockResolvedValue(mockCampaign);

      const response = await request(app)
        .post('/api/campaigns')
        .send(campaignData)
        .expect(201);

      expect(response.body.id).toBe('1');
      expect(response.body.name).toBe(campaignData.name);
      expect(response.body.status).toBe('CREATED');
      expect(mockElectronAPI.ipcRenderer.invoke).toHaveBeenCalledWith(
        'campaign:create',
        campaignData
      );
    });

    test('GET /api/campaigns - list campaigns', async () => {
      const mockCampaigns = [
        {
          id: '1',
          name: 'Campaign 1',
          status: 'CREATED',
          totalRecipients: 0,
          completedRecipients: 0
        },
        {
          id: '2',
          name: 'Campaign 2',
          status: 'READY',
          totalRecipients: 100,
          completedRecipients: 50
        }
      ];

      mockElectronAPI.ipcRenderer.invoke.mockResolvedValue(mockCampaigns);

      const response = await request(app)
        .get('/api/campaigns')
        .expect(200);

      expect(response.body).toHaveLength(2);
      expect(response.body[0].name).toBe('Campaign 1');
      expect(response.body[1].status).toBe('READY');
      expect(mockElectronAPI.ipcRenderer.invoke).toHaveBeenCalledWith('campaign:list');
    });

    test('GET /api/campaigns/:id - get campaign by id', async () => {
      const mockCampaign = {
        id: '1',
        name: 'Test Campaign',
        status: 'READY',
        totalRecipients: 100,
        completedRecipients: 50,
        walletAddress: '0x1234567890123456789012345678901234567890',
        contractAddress: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd'
      };

      mockElectronAPI.ipcRenderer.invoke.mockResolvedValue(mockCampaign);

      const response = await request(app)
        .get('/api/campaigns/1')
        .expect(200);

      expect(response.body.id).toBe('1');
      expect(response.body.name).toBe('Test Campaign');
      expect(response.body.walletAddress).toBeDefined();
      expect(mockElectronAPI.ipcRenderer.invoke).toHaveBeenCalledWith(
        'campaign:getById',
        '1'
      );
    });

    test('GET /api/campaigns/:id - campaign not found', async () => {
      mockElectronAPI.ipcRenderer.invoke.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/campaigns/999')
        .expect(404);

      expect(response.body.error).toBe('Campaign not found');
    });

    test('PUT /api/campaigns/:id - update campaign', async () => {
      const updateData = {
        status: 'COMPLETED',
        completedRecipients: 100
      };

      const mockUpdatedCampaign = {
        id: '1',
        name: 'Test Campaign',
        status: 'COMPLETED',
        completedRecipients: 100,
        totalRecipients: 100
      };

      mockElectronAPI.ipcRenderer.invoke.mockResolvedValue(mockUpdatedCampaign);

      const response = await request(app)
        .put('/api/campaigns/1')
        .send(updateData)
        .expect(200);

      expect(response.body.status).toBe('COMPLETED');
      expect(response.body.completedRecipients).toBe(100);
      expect(mockElectronAPI.ipcRenderer.invoke).toHaveBeenCalledWith(
        'campaign:update',
        '1',
        updateData
      );
    });

    test('DELETE /api/campaigns/:id - delete campaign', async () => {
      mockElectronAPI.ipcRenderer.invoke.mockResolvedValue({ success: true });

      await request(app)
        .delete('/api/campaigns/1')
        .expect(204);

      expect(mockElectronAPI.ipcRenderer.invoke).toHaveBeenCalledWith(
        'campaign:delete',
        '1'
      );
    });
  });

  describe('Wallet API', () => {
    test('POST /api/wallets/generate - generate wallet', async () => {
      const mockWallet = {
        address: '0x1234567890123456789012345678901234567890',
        privateKey: '0x' + '1'.repeat(64),
        publicKey: '0x' + '2'.repeat(128)
      };

      mockElectronAPI.ipcRenderer.invoke.mockResolvedValue(mockWallet);

      const response = await request(app)
        .post('/api/wallets/generate')
        .send({ campaignId: '1' })
        .expect(201);

      expect(response.body.address).toMatch(/^0x[a-fA-F0-9]{40}$/);
      expect(response.body.privateKey).toMatch(/^0x[a-fA-F0-9]{64}$/);
      expect(mockElectronAPI.ipcRenderer.invoke).toHaveBeenCalledWith(
        'wallet:generate',
        { campaignId: '1' }
      );
    });

    test('POST /api/wallets/unlock - unlock wallet', async () => {
      const mockUnlockResult = {
        success: true,
        address: '0x1234567890123456789012345678901234567890'
      };

      mockElectronAPI.ipcRenderer.invoke.mockResolvedValue(mockUnlockResult);

      const response = await request(app)
        .post('/api/wallets/unlock')
        .send({
          address: '0x1234567890123456789012345678901234567890',
          password: 'password123'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(mockElectronAPI.ipcRenderer.invoke).toHaveBeenCalledWith(
        'wallet:unlock',
        {
          address: '0x1234567890123456789012345678901234567890',
          password: 'password123'
        }
      );
    });

    test('POST /api/wallets/lock - lock wallet', async () => {
      mockElectronAPI.ipcRenderer.invoke.mockResolvedValue({ success: true });

      await request(app)
        .post('/api/wallets/lock')
        .send({
          address: '0x1234567890123456789012345678901234567890',
          password: 'password123'
        })
        .expect(204);

      expect(mockElectronAPI.ipcRenderer.invoke).toHaveBeenCalledWith(
        'wallet:lock',
        {
          address: '0x1234567890123456789012345678901234567890',
          password: 'password123'
        }
      );
    });

    test('GET /api/wallets/:address - get wallet info', async () => {
      const mockWalletInfo = {
        address: '0x1234567890123456789012345678901234567890',
        isLocked: false,
        balance: '1.5'
      };

      mockElectronAPI.ipcRenderer.invoke.mockResolvedValue(mockWalletInfo);

      const response = await request(app)
        .get('/api/wallets/0x1234567890123456789012345678901234567890')
        .expect(200);

      expect(response.body.address).toBe('0x1234567890123456789012345678901234567890');
      expect(response.body.isLocked).toBe(false);
      expect(mockElectronAPI.ipcRenderer.invoke).toHaveBeenCalledWith(
        'wallet:getInfo',
        '0x1234567890123456789012345678901234567890'
      );
    });
  });

  describe('Contract API', () => {
    test('POST /api/contracts/deploy - deploy contract', async () => {
      const deployData = {
        tokenAddress: '0x1234567890123456789012345678901234567890',
        chainId: 1,
        rpcUrl: 'https://mainnet.infura.io/v3/test',
        deployerPrivateKey: '0x' + '1'.repeat(64)
      };

      const mockDeploymentResult = {
        contractAddress: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
        transactionHash: '0xdeployhash',
        blockNumber: 12345,
        gasUsed: '150000'
      };

      mockElectronAPI.ipcRenderer.invoke.mockResolvedValue(mockDeploymentResult);

      const response = await request(app)
        .post('/api/contracts/deploy')
        .send(deployData)
        .expect(201);

      expect(response.body.contractAddress).toMatch(/^0x[a-fA-F0-9]{40}$/);
      expect(response.body.transactionHash).toMatch(/^0x[a-fA-F0-9]{64}$/);
      expect(mockElectronAPI.ipcRenderer.invoke).toHaveBeenCalledWith(
        'contract:deploy',
        deployData
      );
    });

    test('POST /api/contracts/approve - approve tokens', async () => {
      const approveData = {
        rpcUrl: 'https://mainnet.infura.io/v3/test',
        privateKey: '0x' + '1'.repeat(64),
        tokenAddress: '0x1234567890123456789012345678901234567890',
        contractAddress: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
        amount: '1000'
      };

      mockElectronAPI.ipcRenderer.invoke.mockResolvedValue('0xapprovetxhash');

      const response = await request(app)
        .post('/api/contracts/approve')
        .send(approveData)
        .expect(200);

      expect(response.body.transactionHash).toBe('0xapprovetxhash');
      expect(mockElectronAPI.ipcRenderer.invoke).toHaveBeenCalledWith(
        'contract:approveTokens',
        approveData
      );
    });

    test('POST /api/contracts/batch-transfer - execute batch transfer', async () => {
      const batchData = {
        contractAddress: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
        rpcUrl: 'https://mainnet.infura.io/v3/test',
        privateKey: '0x' + '1'.repeat(64),
        recipients: [
          '0x1234567890123456789012345678901234567890',
          '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd'
        ],
        amounts: ['100', '200'],
        tokenAddress: '0x1234567890123456789012345678901234567890'
      };

      const mockBatchResult = {
        transactionHash: '0xbatchtxhash',
        totalAmount: '300',
        recipientCount: 2,
        gasUsed: '170000'
      };

      mockElectronAPI.ipcRenderer.invoke.mockResolvedValue(mockBatchResult);

      const response = await request(app)
        .post('/api/contracts/batch-transfer')
        .send(batchData)
        .expect(200);

      expect(response.body.transactionHash).toBe('0xbatchtxhash');
      expect(response.body.recipientCount).toBe(2);
      expect(mockElectronAPI.ipcRenderer.invoke).toHaveBeenCalledWith(
        'contract:batchTransfer',
        batchData
      );
    });
  });

  describe('Gas API', () => {
    test('GET /api/gas/info - get gas information', async () => {
      const mockGasInfo = {
        gasPrice: '20',
        network: 'ethereum',
        gasLimit: '1000000',
        estimatedCost: '0.02'
      };

      mockElectronAPI.ipcRenderer.invoke.mockResolvedValue(mockGasInfo);

      const response = await request(app)
        .get('/api/gas/info')
        .query({
          rpcUrl: 'https://mainnet.infura.io/v3/test',
          network: 'ethereum'
        })
        .expect(200);

      expect(response.body.gasPrice).toBe('20');
      expect(response.body.network).toBe('ethereum');
      expect(mockElectronAPI.ipcRenderer.invoke).toHaveBeenCalledWith(
        'gas:getInfo',
        {
          rpcUrl: 'https://mainnet.infura.io/v3/test',
          network: 'ethereum'
        }
      );
    });

    test('GET /api/gas/batch-estimate - get batch gas estimate', async () => {
      const mockBatchGas = {
        baseGas: '50000',
        gasPerRecipient: '20000',
        totalGas: '170000',
        estimatedCost: '0.0034',
        recipientCount: 3
      };

      mockElectronAPI.ipcRenderer.invoke.mockResolvedValue(mockBatchGas);

      const response = await request(app)
        .get('/api/gas/batch-estimate')
        .query({
          rpcUrl: 'https://mainnet.infura.io/v3/test',
          network: 'ethereum',
          recipientCount: 3
        })
        .expect(200);

      expect(response.body.recipientCount).toBe(3);
      expect(response.body.totalGas).toBe('170000');
      expect(mockElectronAPI.ipcRenderer.invoke).toHaveBeenCalledWith(
        'gas:getBatchEstimate',
        {
          rpcUrl: 'https://mainnet.infura.io/v3/test',
          network: 'ethereum',
          recipientCount: 3
        }
      );
    });
  });

  describe('File API', () => {
    test('POST /api/files/import-csv - import CSV file', async () => {
      const mockCSVData = [
        { address: '0x1234567890123456789012345678901234567890', amount: '100' },
        { address: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd', amount: '200' }
      ];

      mockElectronAPI.ipcRenderer.invoke.mockResolvedValue(mockCSVData);

      const response = await request(app)
        .post('/api/files/import-csv')
        .send({
          filePath: '/path/to/test.csv'
        })
        .expect(200);

      expect(response.body).toHaveLength(2);
      expect(response.body[0].address).toBe('0x1234567890123456789012345678901234567890');
      expect(response.body[0].amount).toBe('100');
      expect(mockElectronAPI.ipcRenderer.invoke).toHaveBeenCalledWith(
        'file:importCSV',
        { filePath: '/path/to/test.csv' }
      );
    });

    test('GET /api/files/export/:campaignId/:format - export campaign report', async () => {
      const mockExportResult = {
        success: true,
        filePath: '/path/to/export.csv'
      };

      mockElectronAPI.ipcRenderer.invoke.mockResolvedValue(mockExportResult);

      const response = await request(app)
        .get('/api/files/export/1/csv')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.filePath).toBe('/path/to/export.csv');
      expect(mockElectronAPI.ipcRenderer.invoke).toHaveBeenCalledWith(
        'file:exportReport',
        { campaignId: '1', format: 'csv' }
      );
    });
  });

  describe('Error Handling', () => {
    test('handles invalid request body', async () => {
      const response = await request(app)
        .post('/api/campaigns')
        .send({})
        .expect(400);

      expect(response.body.error).toBeDefined();
    });

    test('handles service errors', async () => {
      mockElectronAPI.ipcRenderer.invoke.mockRejectedValue(
        new Error('Service unavailable')
      );

      const response = await request(app)
        .get('/api/campaigns')
        .expect(500);

      expect(response.body.error).toBe('Service unavailable');
    });

    test('handles timeout errors', async () => {
      mockElectronAPI.ipcRenderer.invoke.mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      const response = await request(app)
        .get('/api/campaigns')
        .timeout(1000)
        .expect(408);
    });
  });

  describe('Input Validation', () => {
    test('validates campaign creation data', async () => {
      const invalidData = {
        name: '', // Empty name
        tokenAddress: 'invalid-address', // Invalid address format
        chainId: 'invalid' // Invalid chain ID
      };

      const response = await request(app)
        .post('/api/campaigns')
        .send(invalidData)
        .expect(400);

      expect(response.body.errors).toBeDefined();
    });

    test('validates wallet unlock data', async () => {
      const invalidData = {
        address: 'invalid-address', // Invalid address format
        password: '' // Empty password
      };

      const response = await request(app)
        .post('/api/wallets/unlock')
        .send(invalidData)
        .expect(400);

      expect(response.body.errors).toBeDefined();
    });

    test('validates batch transfer data', async () => {
      const invalidData = {
        contractAddress: 'invalid-address', // Invalid address
        recipients: [], // Empty recipients array
        amounts: ['100'] // Mismatched array lengths
      };

      const response = await request(app)
        .post('/api/contracts/batch-transfer')
        .send(invalidData)
        .expect(400);

      expect(response.body.errors).toBeDefined();
    });
  });
});