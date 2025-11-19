import { ethers } from 'ethers';
import { Keypair } from '@solana/web3.js';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import os from 'os';

interface EncryptedWallet {
  address: string;
  encryptedKey: string;
  type: 'evm' | 'solana';
}

interface KeystoreData {
  address: string;
  crypto: {
    ciphertext: string;
    cipherparams: { iv: string };
    cipher: string;
    kdf: string;
    kdfparams: {
      dklen: number;
      salt: string;
      n: number;
      r: number;
      p: number;
    };
    mac: string;
  };
  id: string;
  version: 3;
}

export class WalletService {
  private masterKey: Buffer | null = null;
  private masterKeyPath: string;
  private masterKeySaltPath: string;
  private isUnlocked: boolean = false;

  constructor() {
    const dataDir = this.getDefaultDataDir();
    this.masterKeyPath = path.join(dataDir, '.masterkey');
    this.masterKeySaltPath = path.join(dataDir, '.mastersalt');
  }

  private getDefaultDataDir(): string {
    const platform = os.platform();
    const homeDir = os.homedir();

    switch (platform) {
      case 'win32':
        return path.join(homeDir, 'AppData', 'Roaming', 'batch-airdrop');
      case 'darwin':
        return path.join(homeDir, 'Library', 'Application Support', 'batch-airdrop');
      default:
        return path.join(homeDir, '.config', 'batch-airdrop');
    }
  }

  async unlockWithPassword(password: string): Promise<boolean> {
    try {
      // 确保目录存在
      const dir = path.dirname(this.masterKeyPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      if (fs.existsSync(this.masterKeyPath) && fs.existsSync(this.masterKeySaltPath)) {
        // 读取现有的主密钥和salt
        const encryptedMasterKey = fs.readFileSync(this.masterKeyPath);
        const salt = fs.readFileSync(this.masterKeySaltPath);

        try {
          // 尝试使用密码解密
          this.masterKey = this.decryptMasterKey(encryptedMasterKey.toString(), salt, password);
          this.isUnlocked = true;
          return true;
        } catch (decryptError) {
          // 密码错误
          this.isUnlocked = false;
          return false;
        }
      } else {
        // 创建新的主密钥
        const salt = crypto.randomBytes(32);
        const masterKey = crypto.randomBytes(32);

        // 加密并保存主密钥
        const encryptedKey = this.encryptMasterKey(masterKey, salt, password);

        fs.writeFileSync(this.masterKeySaltPath, salt, { mode: 0o600 });
        fs.writeFileSync(this.masterKeyPath, encryptedKey, { mode: 0o600 });

        this.masterKey = masterKey;
        this.isUnlocked = true;
        return true;
      }
    } catch (error) {
      console.error('Failed to unlock with password:', error);
      this.isUnlocked = false;
      return false;
    }
  }

  lock(): void {
    this.masterKey = null;
    this.isUnlocked = false;
  }

  isLocked(): boolean {
    return !this.isUnlocked;
  }

  changePassword(oldPassword: string, newPassword: string): boolean {
    try {
      if (!this.masterKey || this.isLocked()) {
        throw new Error('Wallet is locked');
      }

      const dir = path.dirname(this.masterKeyPath);
      const salt = crypto.randomBytes(32);

      // 验证旧密码
      const existingEncrypted = fs.readFileSync(this.masterKeyPath);
      try {
        this.decryptMasterKey(existingEncrypted.toString(), salt, oldPassword);
      } catch {
        throw new Error('Old password is incorrect');
      }

      // 用新密码重新加密
      const encryptedKey = this.encryptMasterKey(this.masterKey, salt, newPassword);

      fs.writeFileSync(this.masterKeySaltPath, salt, { mode: 0o600 });
      fs.writeFileSync(this.masterKeyPath, encryptedKey, { mode: 0o600 });

      return true;
    } catch (error) {
      console.error('Failed to change password:', error);
      return false;
    }
  }

  private encryptMasterKey(masterKey: Buffer, salt: Buffer, password: string): string {
    const key = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256');
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

    let encrypted = cipher.update(masterKey, undefined, 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
  }

  private decryptMasterKey(encryptedData: string, salt: Buffer, password: string): Buffer {
    const parts = encryptedData.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted data format');
    }

    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];

    const key = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);

    const decryptedBuffer = Buffer.concat([
      decipher.update(encrypted, 'hex') as Buffer,
      decipher.final()
    ]);
    return decryptedBuffer;
  }

  private deriveKey(password: string, salt: Buffer): Buffer {
    return crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256');
  }

  private encrypt(data: string, key: Buffer): { encrypted: string; iv: string } {
    if (!this.masterKey) {
      throw new Error('Wallet is locked');
    }

    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    return {
      encrypted: encrypted + authTag.toString('hex'),
      iv: iv.toString('hex')
    };
  }

  /**
   * Decrypt wallet private key using master key
   */
  public decryptWalletKey(encryptedKey: string): string {
    if (!this.masterKey) {
      throw new Error('Wallet is locked. Please unlock first.');
    }

    // Parse encrypted key format: iv:encrypted
    const parts = encryptedKey.split(':');
    if (parts.length !== 2) {
      throw new Error('Invalid encrypted key format');
    }

    const iv = parts[0];
    const encrypted = parts[1];

    return this.decrypt(encrypted, iv, this.masterKey);
  }

  private decrypt(encryptedData: string, iv: string, key: Buffer): string {
    if (!this.masterKey) {
      throw new Error('Wallet is locked');
    }

    const authTag = Buffer.from(encryptedData.slice(-64), 'hex');
    const ciphertext = encryptedData.slice(0, -64);
    const ivBuffer = Buffer.from(iv, 'hex');

    const decipher = crypto.createDecipheriv('aes-256-gcm', key, ivBuffer);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  createEVMWallet(): EncryptedWallet {
    try {
      const wallet = ethers.Wallet.createRandom();

      const { encrypted, iv } = this.encrypt(wallet.privateKey, this.masterKey!);
      const encryptedKey = `${iv}:${encrypted}`;

      return {
        address: wallet.address,
        encryptedKey,
        type: 'evm'
      };
    } catch (error) {
      console.error('Failed to create EVM wallet:', error);
      throw new Error('EVM wallet creation failed');
    }
  }

  createSolanaWallet(): EncryptedWallet {
    try {
      const keypair = Keypair.generate();
      const privateKey = Buffer.from(keypair.secretKey).toString('hex');

      const { encrypted, iv } = this.encrypt(privateKey, this.masterKey!);
      const encryptedKey = `${iv}:${encrypted}`;

      return {
        address: keypair.publicKey.toBase58(),
        encryptedKey,
        type: 'solana'
      };
    } catch (error) {
      console.error('Failed to create Solana wallet:', error);
      throw new Error('Solana wallet creation failed');
    }
  }

  exportPrivateKey(encryptedKey: string): string {
    try {
      const [iv, encrypted] = encryptedKey.split(':');
      if (!iv || !encrypted) {
        throw new Error('Invalid encrypted key format');
      }

      const ivBuffer = Buffer.from(iv, 'hex');
      const decryptedKey = this.decrypt(encrypted, iv, this.masterKey!);

      return decryptedKey;
    } catch (error) {
      console.error('Failed to export private key:', error);
      throw new Error('Private key export failed');
    }
  }

  exportKeystore(encryptedKey: string, password: string): string {
    try {
      const privateKey = this.exportPrivateKey(encryptedKey);
      const address = this.getAddressFromKey(encryptedKey);

      const keystore = this.createKeystore(privateKey, password, address);
      return JSON.stringify(keystore, null, 2);
    } catch (error) {
      console.error('Failed to export keystore:', error);
      throw new Error('Keystore export failed');
    }
  }

  private createKeystore(privateKey: string, password: string, address: string): KeystoreData {
    const salt = crypto.randomBytes(32);
    const iv = crypto.randomBytes(16);

    const derivedKey = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256');

    const cipher = crypto.createCipheriv('aes-128-cbc', derivedKey.slice(0, 16), iv);

    let ciphertext = cipher.update(privateKey, 'utf8', 'hex');
    ciphertext += cipher.final('hex');

    const mac = crypto.createHash('sha256')
      .update(derivedKey.slice(16, 32))
      .update(Buffer.from(ciphertext, 'hex'))
      .digest('hex');

    return {
      address: address.toLowerCase(),
      crypto: {
        ciphertext,
        cipherparams: { iv: iv.toString('hex') },
        cipher: 'aes-128-cbc',
        kdf: 'pbkdf2',
        kdfparams: {
          dklen: 32,
          salt: salt.toString('hex'),
          n: 100000,
          r: 1,
          p: 8
        },
        mac
      },
      id: crypto.randomBytes(16).toString('hex'),
      version: 3
    };
  }

  private getAddressFromKey(encryptedKey: string): string {
    try {
      const privateKey = this.exportPrivateKey(encryptedKey);
      const wallet = new ethers.Wallet(privateKey);
      return wallet.address;
    } catch (error) {
      // 如果不是EVM钱包，尝试Solana
      try {
        const privateKey = this.exportPrivateKey(encryptedKey);
        const secretKey = Buffer.from(privateKey, 'hex');
        const keypair = Keypair.fromSecretKey(secretKey);
        return keypair.publicKey.toBase58();
      } catch (solError) {
        throw new Error('Unable to determine wallet type');
      }
    }
  }

  getEVMWallet(encryptedKey: string): ethers.Wallet {
    try {
      const privateKey = this.exportPrivateKey(encryptedKey);
      return new ethers.Wallet(privateKey);
    } catch (error) {
      console.error('Failed to get EVM wallet:', error);
      throw new Error('EVM wallet retrieval failed');
    }
  }

  getSolanaKeypair(encryptedKey: string): Keypair {
    try {
      const privateKey = this.exportPrivateKey(encryptedKey);
      const secretKey = Buffer.from(privateKey, 'hex');
      return Keypair.fromSecretKey(secretKey);
    } catch (error) {
      console.error('Failed to get Solana keypair:', error);
      throw new Error('Solana keypair retrieval failed');
    }
  }

  validateAddress(address: string, type: 'evm' | 'solana'): boolean {
    if (type === 'evm') {
      return ethers.isAddress(address);
    } else {
      // 简单的Solana地址验证
      try {
        return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
      } catch {
        return false;
      }
    }
  }

  async generateQRCode(data: string): Promise<string> {
    try {
      const QRCode = await import('qrcode');

      // Generate QR code as data URL
      const qrCodeDataURL = await QRCode.toDataURL(data, {
        errorCorrectionLevel: 'M',
        type: 'image/png',
        width: 300,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });

      return qrCodeDataURL;
    } catch (error) {
      console.error('Failed to generate QR code:', error);
      throw new Error('QR code generation failed');
    }
  }
}