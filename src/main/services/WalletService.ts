import { ethers } from 'ethers';
import { Keypair } from '@solana/web3.js';

interface WalletData {
  address: string;
  privateKeyBase64: string;
  type: 'evm' | 'solana';
}

export class WalletService {
  constructor() {
    // Simplified - no password protection needed
  }

  /**
   * Create EVM wallet and return address + base64 encoded private key
   */
  createEVMWallet(): WalletData {
    try {
      const wallet = ethers.Wallet.createRandom();
      const privateKeyBase64 = Buffer.from(wallet.privateKey.slice(2), 'hex').toString('base64');

      return {
        address: wallet.address,
        privateKeyBase64,
        type: 'evm'
      };
    } catch (error) {
      console.error('Failed to create EVM wallet:', error);
      throw new Error('EVM wallet creation failed');
    }
  }

  /**
   * Create Solana wallet and return address + base64 encoded private key
   */
  createSolanaWallet(): WalletData {
    try {
      const keypair = Keypair.generate();
      const privateKeyBase64 = Buffer.from(keypair.secretKey).toString('base64');

      return {
        address: keypair.publicKey.toBase58(),
        privateKeyBase64,
        type: 'solana'
      };
    } catch (error) {
      console.error('Failed to create Solana wallet:', error);
      throw new Error('Solana wallet creation failed');
    }
  }

  /**
   * Decode base64 private key to hex string
   */
  decodePrivateKey(privateKeyBase64: string): string {
    try {
      const privateKeyBuffer = Buffer.from(privateKeyBase64, 'base64');
      return '0x' + privateKeyBuffer.toString('hex');
    } catch (error) {
      console.error('Failed to decode private key:', error);
      throw new Error('Private key decode failed');
    }
  }

  /**
   * Export private key from base64 (for display or export)
   */
  exportPrivateKey(privateKeyBase64: string): string {
    return this.decodePrivateKey(privateKeyBase64);
  }

  /**
   * Get EVM wallet instance from base64 private key
   */
  getEVMWallet(privateKeyBase64: string): ethers.Wallet {
    try {
      const privateKey = this.decodePrivateKey(privateKeyBase64);
      return new ethers.Wallet(privateKey);
    } catch (error) {
      console.error('Failed to get EVM wallet:', error);
      throw new Error('EVM wallet retrieval failed');
    }
  }

  /**
   * Get Solana keypair from base64 private key
   */
  getSolanaKeypair(privateKeyBase64: string): Keypair {
    try {
      const privateKeyBuffer = Buffer.from(privateKeyBase64, 'base64');
      return Keypair.fromSecretKey(privateKeyBuffer);
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