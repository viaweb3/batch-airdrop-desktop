import { WalletService } from '../../main/services/WalletService';
import { createTempTestDir, cleanupTempDir } from '../utils/testUtils';
import fs from 'fs';
import path from 'path';

describe('WalletService', () => {
  let walletService: WalletService;
  let testDir: string;

  beforeEach(() => {
    testDir = createTempTestDir();
    // Override the default data directory for testing
    walletService = new WalletService();
    // Use a custom constructor approach to override the data directory
    (walletService as any).masterKeyPath = path.join(testDir, '.masterkey');
    (walletService as any).masterKeySaltPath = path.join(testDir, '.mastersalt');
  });

  afterEach(() => {
    if (walletService) {
      walletService.lock();
    }
    cleanupTempDir(testDir);
  });

  describe('Password Management', () => {
    test('should unlock with new password', async () => {
      const password = 'testPassword123';
      const result = await walletService.unlockWithPassword(password);

      expect(result).toBe(true);
      expect(walletService.isLocked()).toBe(false);
    });

    test('should fail to unlock with wrong password', async () => {
      const correctPassword = 'testPassword123';
      const wrongPassword = 'wrongPassword';

      // First unlock to create master key
      await walletService.unlockWithPassword(correctPassword);
      walletService.lock();

      // Try to unlock with wrong password
      const result = await walletService.unlockWithPassword(wrongPassword);

      expect(result).toBe(false);
      expect(walletService.isLocked()).toBe(true);
    });

    test('should change password successfully', async () => {
      const oldPassword = 'oldPassword123';
      const newPassword = 'newPassword456';

      // Initialize with old password
      await walletService.unlockWithPassword(oldPassword);

      // Change password
      const result = walletService.changePassword(oldPassword, newPassword);
      expect(result).toBe(true);

      // Lock and try unlock with new password
      walletService.lock();
      const unlockResult = await walletService.unlockWithPassword(newPassword);
      expect(unlockResult).toBe(true);
      expect(walletService.isLocked()).toBe(false);
    });

    test('should fail to change password with wrong old password', async () => {
      const oldPassword = 'oldPassword123';
      const wrongOldPassword = 'wrongPassword';
      const newPassword = 'newPassword456';

      // Initialize with correct password
      await walletService.unlockWithPassword(oldPassword);

      // Try to change with wrong old password
      const result = walletService.changePassword(wrongOldPassword, newPassword);
      expect(result).toBe(false);
    });
  });

  describe('EVM Wallet Creation', () => {
    beforeEach(async () => {
      await walletService.unlockWithPassword('testPassword123');
    });

    test('should create EVM wallet successfully', () => {
      const wallet = walletService.createEVMWallet();

      expect(wallet).toHaveProperty('address');
      expect(wallet).toHaveProperty('encryptedKey');
      expect(wallet.type).toBe('evm');
      expect(wallet.address).toMatch(/^0x[a-fA-F0-9]{40}$/);
      expect(wallet.encryptedKey).toContain(':');
    });

    test('should create unique EVM wallets', () => {
      const wallet1 = walletService.createEVMWallet();
      const wallet2 = walletService.createEVMWallet();

      expect(wallet1.address).not.toBe(wallet2.address);
      expect(wallet1.encryptedKey).not.toBe(wallet2.encryptedKey);
    });
  });

  describe('Solana Wallet Creation', () => {
    beforeEach(async () => {
      await walletService.unlockWithPassword('testPassword123');
    });

    test('should create Solana wallet successfully', () => {
      const wallet = walletService.createSolanaWallet();

      expect(wallet).toHaveProperty('address');
      expect(wallet).toHaveProperty('encryptedKey');
      expect(wallet.type).toBe('solana');
      expect(wallet.address).toMatch(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/);
      expect(wallet.encryptedKey).toContain(':');
    });

    test('should create unique Solana wallets', () => {
      const wallet1 = walletService.createSolanaWallet();
      const wallet2 = walletService.createSolanaWallet();

      expect(wallet1.address).not.toBe(wallet2.address);
      expect(wallet1.encryptedKey).not.toBe(wallet2.encryptedKey);
    });
  });

  describe('Private Key Export', () => {
    beforeEach(async () => {
      await walletService.unlockWithPassword('testPassword123');
    });

    test('should export EVM private key successfully', () => {
      const wallet = walletService.createEVMWallet();
      const privateKey = walletService.exportPrivateKey(wallet.encryptedKey);

      expect(typeof privateKey).toBe('string');
      expect(privateKey).toMatch(/^0x[a-fA-F0-9]{64}$/);
    });

    test('should export Solana private key successfully', () => {
      const wallet = walletService.createSolanaWallet();
      const privateKey = walletService.exportPrivateKey(wallet.encryptedKey);

      expect(typeof privateKey).toBe('string');
      expect(privateKey).toMatch(/^[a-fA-F0-9]{128}$/);
    });

    test('should fail to export with invalid encrypted key format', () => {
      expect(() => {
        walletService.exportPrivateKey('invalid-format');
      }).toThrow('Private key export failed');
    });
  });

  describe('Keystore Export', () => {
    beforeEach(async () => {
      await walletService.unlockWithPassword('testPassword123');
    });

    test('should export EVM keystore successfully', () => {
      const wallet = walletService.createEVMWallet();
      const keystorePassword = 'keystorePassword789';
      const keystore = walletService.exportKeystore(wallet.encryptedKey, keystorePassword);

      expect(typeof keystore).toBe('string');

      const keystoreData = JSON.parse(keystore);
      expect(keystoreData).toHaveProperty('address');
      expect(keystoreData).toHaveProperty('crypto');
      expect(keystoreData).toHaveProperty('id');
      expect(keystoreData).toHaveProperty('version', 3);
      expect(keystoreData.address).toBe(wallet.address.toLowerCase());
    });

    test('should export Solana keystore successfully', () => {
      const wallet = walletService.createSolanaWallet();
      const keystorePassword = 'keystorePassword789';
      const keystore = walletService.exportKeystore(wallet.encryptedKey, keystorePassword);

      expect(typeof keystore).toBe('string');

      const keystoreData = JSON.parse(keystore);
      expect(keystoreData).toHaveProperty('address');
      expect(keystoreData).toHaveProperty('crypto');
      expect(keystoreData).toHaveProperty('id');
      expect(keystoreData).toHaveProperty('version', 3);
    });
  });

  describe('Address Validation', () => {
    test('should validate correct EVM addresses', () => {
      const validAddresses = [
        '0x742d35Cc6634C0532925a3b8D4C8e8C4b8e8f8a8',
        '0x1234567890123456789012345678901234567890',
        '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd'
      ];

      validAddresses.forEach(address => {
        expect(walletService.validateAddress(address, 'evm')).toBe(true);
      });
    });

    test('should reject invalid EVM addresses', () => {
      const invalidAddresses = [
        '0x123456789012345678901234567890123456789', // Too short
        '0x12345678901234567890123456789012345678900', // Too long
        '742d35Cc6634C0532925a3b8D4C8e8C4b8e8f8a8', // Missing 0x
        '0xGHIJKL7890123456789012345678901234567890' // Invalid hex chars
      ];

      invalidAddresses.forEach(address => {
        expect(walletService.validateAddress(address, 'evm')).toBe(false);
      });
    });

    test('should validate correct Solana addresses', () => {
      const validAddresses = [
        '11111111111111111111111111111112',
        '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM'
      ];

      validAddresses.forEach(address => {
        expect(walletService.validateAddress(address, 'solana')).toBe(true);
      });
    });

    test('should reject invalid Solana addresses', () => {
      const invalidAddresses = [
        '0x1234567890123456789012345678901234567890', // Contains 0x
        '1111111111111111111111111111111', // Too short
        '111111111111111111111111111111111', // Too long
        '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM0', // Invalid character
      ];

      invalidAddresses.forEach(address => {
        expect(walletService.validateAddress(address, 'solana')).toBe(false);
      });
    });
  });

  describe('Lock/Unlock State Management', () => {
    test('should be locked initially', () => {
      expect(walletService.isLocked()).toBe(true);
    });

    test('should unlock successfully', async () => {
      await walletService.unlockWithPassword('testPassword123');
      expect(walletService.isLocked()).toBe(false);
    });

    test('should lock successfully', async () => {
      await walletService.unlockWithPassword('testPassword123');
      walletService.lock();
      expect(walletService.isLocked()).toBe(true);
    });

    test('should fail to create wallet when locked', () => {
      expect(() => {
        walletService.createEVMWallet();
      }).toThrow('Wallet is locked');
    });

    test('should fail to export private key when locked', () => {
      const encryptedKey = 'test:encryptedKey';
      expect(() => {
        walletService.exportPrivateKey(encryptedKey);
      }).toThrow('Wallet is locked');
    });
  });
});