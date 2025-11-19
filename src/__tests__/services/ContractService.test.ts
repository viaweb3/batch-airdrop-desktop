import { ContractService } from '../../main/services/ContractService';
import { GasService } from '../../main/services/GasService';
import { createTempTestDir, cleanupTempDir, mockEVMChain } from '../utils/testUtils';
import { ethers } from 'ethers';

// Mock ethers for testing
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

describe('ContractService', () => {
  let contractService: ContractService;
  let testDir: string;

  beforeEach(() => {
    testDir = createTempTestDir();
    contractService = new ContractService();
  });

  afterEach(() => {
    cleanupTempDir(testDir);
    jest.clearAllMocks();
  });

  describe('Contract Deployment', () => {
    test('should deploy Absolute Minimal contract successfully', async () => {
      const config = {
        tokenAddress: '0x1234567890123456789012345678901234567890',
        chainId: 1,
        rpcUrl: 'https://mainnet.infura.io/v3/test',
        deployerPrivateKey: '0x' + '1'.repeat(64)
      };

      // Mock ethers responses
      const mockProvider = {
        getFeeData: jest.fn().mockResolvedValue({
          gasPrice: BigInt('20000000000'),
          maxFeePerGas: BigInt('3000000000'),
          maxPriorityFeePerGas: BigInt('1000000000')
        })
      };

      const mockWallet = {
        address: '0x1234567890123456789012345678901234567890',
        privatekey: '0x' + '1'.repeat(64)
      };

      const mockContract = {
        waitForDeployment: jest.fn().mockResolvedValue({}),
        deploymentTransaction: jest.fn().mockReturnValue({
          hash: '0xdeployhash'
        }),
        getAddress: jest.fn().mockResolvedValue('0xcontractaddress'),
        wait: jest.fn().mockResolvedValue({
          blockNumber: 12345,
          gasUsed: BigInt('150000')
        })
      };

      const mockFactory = {
        deploy: jest.fn().mockResolvedValue(mockContract)
      };

      ethers.JsonRpcProvider.mockImplementation(() => mockProvider);
      ethers.Wallet.mockImplementation(() => mockWallet);
      ethers.ContractFactory.mockImplementation(() => mockFactory);

      const result = await contractService.deployContract(config);

      expect(result).toHaveProperty('contractAddress');
      expect(result).toHaveProperty('transactionHash');
      expect(result).toHaveProperty('blockNumber');
      expect(result).toHaveProperty('gasUsed');
      expect(result.contractAddress).toBe('0xcontractaddress');
      expect(result.transactionHash).toBe('0xdeployhash');
    });

    test('should handle deployment failure gracefully', async () => {
      const config = {
        tokenAddress: '0x1234567890123456789012345678901234567890',
        chainId: 1,
        rpcUrl: 'https://invalid-rpc-url',
        deployerPrivateKey: '0x' + '1'.repeat(64)
      };

      // Mock ethers to throw error
      ethers.JsonRpcProvider.mockImplementation(() => {
        throw new Error('Network error');
      });

      await expect(contractService.deployContract(config)).rejects.toThrow('Contract deployment failed');
    });
  });

  describe('Token Approval', () => {
    test('should approve tokens successfully', async () => {
      const mockProvider = {
        getFeeData: jest.fn().mockResolvedValue({
          gasPrice: BigInt('20000000')
        })
      };

      const mockWallet = {
        address: '0x1234567890123456789012345678901234567890'
      };

      const mockTokenContract = {
        allowance: jest.fn().mockResolvedValue(BigInt(0)),
        approve: jest.fn().mockResolvedValue({
          hash: '0xapprovetxhash'
        }),
        wait: jest.fn().mockResolvedValue({})
      };

      ethers.JsonRpcProvider.mockImplementation(() => mockProvider);
      ethers.Wallet.mockImplementation(() => mockWallet);
      ethers.Contract.mockImplementation(() => mockTokenContract);

      const result = await contractService.approveTokens(
        'https://mainnet.infura.io/v3/test',
        '0x' + '1'.repeat(64),
        '0x1234567890123456789012345678901234567890',
        '0xcontractaddress',
        '1000'
      );

      expect(result).toBe('0xapprovetxhash');
    });

    test('should skip approval when sufficient allowance exists', async () => {
      const mockProvider = {
        getFeeData: jest.fn().mockResolvedValue({
          gasPrice: BigInt('20000000')
        })
      };

      const mockWallet = {
        address: '0x1234567890123456789012345678901234567890'
      };

      const mockTokenContract = {
        allowance: jest.fn().mockResolvedValue(BigInt('2000')),
        approve: jest.fn()
      };

      ethers.JsonRpcProvider.mockImplementation(() => mockProvider);
      ethers.Wallet.mockImplementation(() => mockWallet);
      ethers.Contract.mockImplementation(() => mockTokenContract);

      const result = await contractService.approveTokens(
        'https://mainnet.infura.io/v3/test',
        '0x' + '1'.repeat(64),
        '0x1234567890123456789012345678901234567890',
        '0xcontractaddress',
        '1000'
      );

      expect(result).toBe('already-approved');
      expect(mockTokenContract.approve).not.toHaveBeenCalled();
    });

    test('should handle approval failure', async () => {
      const mockProvider = {
        getFeeData: jest.fn().mockResolvedValue({
          gasPrice: BigInt('20000000')
        })
      };

      const mockWallet = {
        address: '0x1234567890123456789012345678901234567890'
      };

      const mockTokenContract = {
        allowance: jest.fn().mockResolvedValue(BigInt(0)),
        approve: jest.fn().mockRejectedValue(new Error('Approval failed'))
      };

      ethers.JsonRpcProvider.mockImplementation(() => mockProvider);
      ethers.Wallet.mockImplementation(() => mockWallet);
      ethers.Contract.mockImplementation(() => mockTokenContract);

      await expect(contractService.approveTokens(
        'https://mainnet.infura.io/v3/test',
        '0x' + '1'.repeat(64),
        '0x1234567890123456789012345678901234567890',
        '0xcontractaddress',
        '1000'
      )).rejects.toThrow('Token approval failed');
    });
  });

  describe('Batch Transfer', () => {
    test('should execute batch transfer successfully', async () => {
      const mockProvider = {
        getFeeData: jest.fn().mockResolvedValue({
          gasPrice: BigInt('20000000')
        })
      };

      const mockWallet = {
        address: '0x1234567890123456789012345678901234567890'
      };

      const mockContract = {
        batchTransfer: jest.fn().mockResolvedValue({
          hash: '0xbatchtxhash'
        }),
        wait: jest.fn().mockResolvedValue({
          gasUsed: BigInt('500000')
        })
      };

      ethers.JsonRpcProvider.mockImplementation(() => mockProvider);
      ethers.Wallet.mockImplementation(() => mockWallet);
      ethers.Contract.mockImplementation(() => mockContract);

      const recipients = [
        '0x1234567890123456789012345678901234567890',
        '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd'
      ];
      const amounts = ['100', '200'];

      const result = await contractService.batchTransfer(
        '0xcontractaddress',
        'https://mainnet.infura.io/v3/test',
        '0x' + '1'.repeat(64),
        recipients,
        amounts,
        '0xtokenaddress'
      );

      expect(result).toHaveProperty('transactionHash');
      expect(result).toHaveProperty('totalAmount');
      expect(result).toHaveProperty('recipientCount');
      expect(result).toHaveProperty('gasUsed');
      expect(result.transactionHash).toBe('0xbatchtxhash');
      expect(result.totalAmount).toBe('300');
      expect(result.recipientCount).toBe(2);
      expect(result.gasUsed).toBe('500000');
    });

    test('should validate recipients and amounts arrays', async () => {
      const mockProvider = {
        getFeeData: jest.fn().mockResolvedValue({
          gasPrice: BigInt('20000000')
        })
      };

      const mockWallet = {
        address: '0x1234567890123456789012345678901234567890'
      };

      ethers.JsonRpcProvider.mockImplementation(() => mockProvider);
      ethers.Wallet.mockImplementation(() => mockWallet);

      // Test array length mismatch
      await expect(contractService.batchTransfer(
        '0xcontractaddress',
        'https://mainnet.infura.io/v3/test',
        '0x' + '1'.repeat(64),
        ['0x1234567890123456789012345678901234567890'],
        ['100', '200', '300'],
        '0xtokenaddress'
      )).rejects.toThrow('收币地址和金额数组长度必须相同');

      // Test empty arrays
      await expect(contractService.batchTransfer(
        '0xcontractaddress',
        'https://mainnet.infura.io/v3/test',
        '0x' + '1'.repeat(64),
        [],
        [],
        '0xtokenaddress'
      )).rejects.toThrow('收币地址不能为空');
    });
  });

  describe('Token Information', () => {
    test('should get token information successfully', async () => {
      const mockProvider = {};
      const mockTokenContract = {
        symbol: jest.fn().mockResolvedValue('TEST'),
        name: jest.fn().mockResolvedValue('Test Token'),
        decimals: jest.fn().mockResolvedValue(18),
        balanceOf: jest.fn().mockResolvedValue(BigInt('1000000')),
        allowance: jest.fn().mockResolvedValue(BigInt('5000'))
      };

      ethers.JsonRpcProvider.mockImplementation(() => mockProvider);
      ethers.Contract.mockImplementation(() => mockTokenContract);

      const result = await contractService.getTokenInfo(
        'https://mainnet.infura.io/v3/test',
        '0xtokenaddress'
      );

      expect(result).toHaveProperty('symbol');
      expect(result).toHaveProperty('name');
      expect(result).toHaveProperty('decimals');
      expect(result.symbol).toBe('TEST');
      expect(result.name).toBe('Test Token');
      expect(result.decimals).toBe(18);
    });

    test('should handle token info retrieval failure', async () => {
      const mockProvider = {};
      const mockTokenContract = {
        symbol: jest.fn().mockRejectedValue(new Error('Contract call failed'))
      };

      ethers.JsonRpcProvider.mockImplementation(() => mockProvider);
      ethers.Contract.mockImplementation(() => mockTokenContract);

      await expect(contractService.getTokenInfo(
        'https://mainnet.infura.io/v3/test',
        '0xtokenaddress'
      )).rejects.toThrow('Failed to get token info');
    });
  });

  describe('Approval Check', () => {
    test('should check approval status correctly', async () => {
      const mockProvider = {};
      const mockTokenContract = {
        allowance: jest.fn().mockResolvedValue(BigInt('1000'))
      };

      ethers.JsonRpcProvider.mockImplementation(() => mockProvider);
      ethers.Contract.mockImplementation(() => mockTokenContract);

      const result = await contractService.checkApproval(
        'https://mainnet.infura.io/v3/test',
        '0x' + '1'.repeat(64),
        '0xtokenaddress',
        '0xcontractaddress',
        '500'
      );

      expect(result).toBe(true);
    });

    test('should handle insufficient allowance', async () => {
      const mockProvider = {};
      const mockTokenContract = {
        allowance: jest.fn().mockResolvedValue(BigInt('100'))
      };

      ethers.JsonRpcProvider.mockImplementation(() => mockProvider);
      ethers.Contract.mockImplementation(() => mockTokenContract);

      const result = await contractService.checkApproval(
        'https://mainnet.infura.io/v3/test',
        '0x' + '1'.repeat(64),
        '0xtokenaddress',
        '0xcontractaddress',
        '500'
      );

      expect(result).toBe(false);
    });

    test('should handle approval check errors gracefully', async () => {
      const mockProvider = {};
      const mockTokenContract = {
        allowance: jest.fn().mockRejectedValue(new Error('Contract call failed'))
      };

      ethers.JsonRpcProvider.mockImplementation(() => mockProvider);
      ethers.Contract.mockImplementation(() => mockTokenContract);

      const result = await contractService.checkApproval(
        'https://mainnet.infura.io/v3/test',
        '0x' + '1'.repeat(64),
        '0xtokenaddress',
        '0xcontractaddress',
        '500'
      );

      expect(result).toBe(false);
    });
  });
});

describe('GasService', () => {
  let gasService: GasService;

  beforeEach(() => {
    gasService = new GasService();
  });

  describe('Gas Information Retrieval', () => {
    test('should get gas info for Ethereum network', async () => {
      const mockProvider = {
        getFeeData: jest.fn().mockResolvedValue({
          gasPrice: BigInt('20000000000'),
          maxFeePerGas: BigInt('3000000000'),
          maxPriorityFeePerGas: BigInt('1000000000')
        })
      };

      ethers.JsonRpcProvider.mockImplementation(() => mockProvider);

      const result = await gasService.getGasInfo(
        'https://mainnet.infura.io/v3/test',
        'ethereum'
      );

      expect(result).toHaveProperty('gasPrice');
      expect(result).toHaveProperty('network');
      expect(result).toHaveProperty('gasLimit');
      expect(result).toHaveProperty('estimatedCost');
      expect(result.network).toBe('ethereum');
      expect(parseFloat(result.gasPrice)).toBeGreaterThan(0);
    });

    test('should get gas info with token price', async () => {
      const mockProvider = {
        getFeeData: jest.fn().mockResolvedValue({
          gasPrice: BigInt('20000000'),
          maxFeePerGas: BigInt('30000000'),
          maxPriorityFeePerGas: BigInt('1000000')
        })
      };

      ethers.JsonRpcProvider.mockImplementation(() => mockProvider);

      const result = await gasService.getGasInfo(
        'https://mainnet.infura.io/v3/test',
        'ethereum',
        2000 // $2000 per ETH
      );

      expect(result).toHaveProperty('gasPriceETH');
      expect(result.gasPriceETH).toBeGreaterThan(0);
    });

    test('should handle RPC failure gracefully', async () => {
      ethers.JsonRpcProvider.mockImplementation(() => {
        throw new Error('RPC connection failed');
      });

      const result = await gasService.getGasInfo(
        'https://invalid-rpc-url',
        'ethereum'
      );

      expect(result).toHaveProperty('gasPrice');
      expect(result.gasPrice).toBe('5'); // Fallback gas price
    });
  });

  describe('Batch Gas Estimation', () => {
    test('should estimate gas for batch transfers', async () => {
      const mockProvider = {
        getFeeData: jest.fn().mockResolvedValue({
          gasPrice: BigInt('20000000')
        })
      };

      ethers.JsonRpcProvider.mockImplementation(() => mockProvider);

      const result = await gasService.getBatchGasEstimate(
        'https://mainnet.infura.io/v3/test',
        'ethereum',
        100 // 100 recipients
      );

      expect(result).toHaveProperty('baseGas');
      expect(result).toHaveProperty('gasPerRecipient');
      expect(result).toHaveProperty('totalGas');
      expect(result).toHaveProperty('estimatedCost');
      expect(parseFloat(result.totalGas)).toBeGreaterThan(parseFloat(result.baseGas));
    });

    test('should handle large batch sizes', async () => {
      const mockProvider = {
        getFeeData: jest.fn().mockResolvedValue({
          gasPrice: BigInt('20000000')
        })
      };

      ethers.JsonRpcProvider.mockImplementation(() => mockProvider);

      const result = await gasService.getBatchGasEstimate(
        'https://mainnet.infura.io/v3/test',
        'ethereum',
        500 // 500 recipients
      );

      expect(result.recipientCount).toBe(500);
      expect(parseFloat(result.totalGas)).toBeGreaterThan(0);
    });

    test('should handle RPC failure for batch estimation', async () => {
      ethers.JsonRpcProvider.mockImplementation(() => {
        throw new Error('RPC connection failed');
      });

      const result = await gasService.getBatchGasEstimate(
        'https://invalid-rpc-url',
        'ethereum',
        100
      );

      expect(result).toHaveProperty('totalGas');
      expect(result.recipientCount).toBe(100);
    });
  });

  describe('Transaction Options', () => {
    test('should create transaction options with EIP-1559', () => {
      const gasInfo = {
        gasPrice: '20',
        maxFeePerGas: '30',
        maxPriorityFeePerGas: '2'
      };

      const options = gasService.getTransactionOptions(gasInfo);

      expect(options).toHaveProperty('gasPrice');
      expect(options).toHaveProperty('maxFeePerGas');
      expect(options).toHaveProperty('maxPriorityFeePerGas');
    });

    test('should create transaction options with legacy gas price', () => {
      const gasInfo = {
        gasPrice: '20'
      };

      const options = gasService.getTransactionOptions(gasInfo);

      expect(options).toHaveProperty('gasPrice');
      expect(options).not.toHaveProperty('maxFeePerGas');
    });

    test('should apply buffer to gas prices', () => {
      const gasInfo = {
        gasPrice: '20',
        maxFeePerGas: '30'
      };

      const options = gasService.getTransactionOptions(gasInfo);

      // Should apply 20% buffer to base gas price
      const expectedGasPrice = parseFloat(20) * 1.2;
      expect(parseFloat(options.gasPrice)).toBeCloseTo(expectedGasPrice, 1);
    });
  });
});