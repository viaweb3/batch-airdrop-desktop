// Electron API types
export interface ElectronAPI {
  campaign: {
    create: (data: any) => Promise<Campaign>;
    list: (filters?: any) => Promise<Campaign[]>;
    getById: (id: string) => Promise<Campaign | null>;
    getDetails: (id: string) => Promise<Campaign | null>;
    getTransactions: (id: string, options?: { limit?: number; offset?: number; status?: string }) => Promise<Transaction[]>;
    getRecipients: (id: string) => Promise<Recipient[]>;
    updateStatus: (id: string, status: CampaignStatus) => Promise<{ success: boolean }>;
    start: (id: string) => Promise<{ success: boolean }>;
    pause: (id: string) => Promise<{ success: boolean }>;
    resume: (id: string) => Promise<{ success: boolean }>;
    deployContract: (campaignId: string) => Promise<{ success: boolean; contractAddress: string; transactionHash: string; gasUsed: string }>;
    onProgress: (callback: (data: ProgressData) => void) => void;
    estimate: (data: any) => Promise<CampaignEstimate>;
    retryFailedTransactions: (campaignId: string) => Promise<{ success: boolean; retried: number }>;
    withdrawTokens: (campaignId: string, recipientAddress: string) => Promise<{ txHash: string; amount: string }>;
    withdrawNative: (campaignId: string, recipientAddress: string) => Promise<{ txHash: string; amount: string }>;
  };
  wallet: {
    create: (type?: string) => Promise<{ address: string; privateKeyBase64: string }>;
    list: (options?: any) => Promise<{ wallets: ActivityWallet[]; total: number } | ActivityWallet[]>;
    getBalance: (address: string, chain: string, tokenAddress?: string, tokenDecimals?: number) => Promise<BalanceData>;
    exportEVMPrivateKey: (privateKeyBase64: string) => Promise<{ success: boolean; privateKey: string }>;
    exportSolanaPrivateKey: (privateKeyBase64: string) => Promise<{ success: boolean; privateKey: string }>;
  };
  chain: {
    getEVMChains: (onlyEnabled?: boolean) => Promise<EVMChain[]>;
    getAllChains: () => Promise<ChainInfo[]>;
    addEVMChain: (chainData: any) => Promise<number>;
    updateEVMChain: (chainId: number, updates: any) => Promise<void>;
    deleteEVMChain: (chainId: number) => Promise<void>;
    testEVMLatency: (rpcUrl: string) => Promise<{ latency: number; blockNumber: number }>;
    getSolanaRPCs: (network?: string, onlyEnabled?: boolean) => Promise<SolanaRPC[]>;
        addSolanaRPC: (rpcData: any) => Promise<number>;
    testSolanaRPC: (rpcUrl: string) => Promise<{ success: boolean; latency?: number }>;
    updateSolanaRPCPriority: (id: number, priority: number) => Promise<void>;
    deleteSolanaRPC: (id: number) => Promise<void>;
      };
  blockchain: {
    getBalance: (address: string, chainId: string, tokenAddress?: string, tokenDecimals?: number) => Promise<BalanceData>;
    estimateGas: (config: any) => Promise<any>;
    getTransactionStatus: (txHash: string, rpcUrl: string) => Promise<any>;
    batchTransfer: (config: any) => Promise<any>;
  };
  solana: {
    getBalance: (address: string, rpcUrl: string, tokenAddress?: string) => Promise<{ success: boolean; balance: string }>;
    batchTransfer: (config: any) => Promise<any>;
    getTransactionStatus: (signature: string, rpcUrl: string) => Promise<any>;
    getTokenInfo: (tokenAddress: string, rpcUrl: string) => Promise<TokenInfo | null>;
  };
  file: {
    readCSV: (filePath: string) => Promise<any[]>;
    exportReport: (campaignId: string, format?: string) => Promise<{ success: boolean; filePath: string }>;
  };
  price: {
    getPrice: (symbol: string) => Promise<{ symbol: string; price: number }>;
    getPrices: (symbols: string[]) => Promise<Record<string, number>>;
    getSummary: () => Promise<any>;
  };
  gas: {
    getInfo: (rpcUrl: string, network: string, tokenPrice?: number) => Promise<any>;
    estimateBatch: (rpcUrl: string, network: string, recipientCount: number, tokenPrice?: number) => Promise<any>;
  };
  contract: {
    deploy: (config: any) => Promise<any>;
    batchTransfer: (contractAddress: string, rpcUrl: string, privateKey: string, recipients: string[], amounts: string[], tokenAddress: string) => Promise<{ success: boolean; data: any }>;
    approveTokens: (rpcUrl: string, privateKey: string, tokenAddress: string, contractAddress: string, amount: string) => Promise<{ success: boolean; txHash: string }>;
    checkApproval: (rpcUrl: string, privateKey: string, tokenAddress: string, contractAddress: string, requiredAmount: string) => Promise<{ approved: boolean }>;
    getTokenInfo: (rpcUrl: string, tokenAddress: string) => Promise<{ symbol: string; name: string; decimals: number }>;
  };
  token: {
    getInfo: (tokenAddress: string, chainId: string) => Promise<TokenInfo | null>;
    validateAddress: (tokenAddress: string, chainId: string) => Promise<{ isValid: boolean; chainType?: 'evm' | 'solana'; error?: string }>;
    getMultipleInfo: (tokenAddresses: string[], chainId: string) => Promise<TokenInfo[]>;
  };
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

// Type exports
export type CampaignStatus = 'CREATED' | 'FUNDED' | 'READY' | 'SENDING' | 'PAUSED' | 'COMPLETED' | 'FAILED';

// Settings types
export interface AppSettings {
  chains: EVMChain[];
  solanaChains?: SolanaChain[];
  gasSettings?: {
    defaultGasPrice: number;
    defaultGasLimit: number;
    autoAdjustGas: boolean;
    maxGasPrice: number;
    priorityFee: number;
  };
  batchSettings?: {
    batchSize: number;
    sendInterval: number;
    maxConcurrency: number;
    retryAttempts: number;
    retryDelay: number;
  };
  securitySettings?: {
    autoBackup: boolean;
    backupInterval: number;
    sessionTimeout: number;
  };
  notificationSettings?: {
    emailNotifications: boolean;
    browserNotifications: boolean;
    campaignComplete: boolean;
    campaignFailed: boolean;
    lowBalance: boolean;
    securityAlerts: boolean;
  };
}

// Campaign types
// Enhanced Campaign interface with full functionality
export interface Campaign {
  id: string;
  name: string;
  description?: string;
  chain: string;
  chain_type?: 'evm' | 'solana'; // Added chain type for better handling
  chainId?: number; // Chain ID for better identification
  tokenAddress: string;
  tokenSymbol: string;
  tokenDecimals: number;
  status: 'CREATED' | 'FUNDED' | 'READY' | 'SENDING' | 'PAUSED' | 'COMPLETED' | 'FAILED';
  totalRecipients: number;
  completedRecipients: number;
  failedRecipients: number;
  totalAmount: string;
  completedAmount: string;
  walletAddress?: string;
  walletPrivateKeyBase64?: string;
  contractAddress?: string;
  contractDeployedAt?: string;
  startDate?: string;
  endDate?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  recipientCSV?: string; // File path
  gasUsed: string;
  gasEstimate: string;
  batchSize: number;
  sendInterval: number;
  recipients?: Recipient[];
  transactions?: Transaction[];
}

export interface Recipient {
  id: string;
  campaignId: string;
  address: string;
  amount: string;
  status: 'pending' | 'failed' | 'success' | 'sending';
  transactionHash?: string;
  gasUsed?: string;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Transaction {
  id: string;
  campaignId: string;
  recipientId: string;
  hash: string;
  from: string;
  to: string;
  amount: string;
  gasUsed: string;
  gasPrice: string;
  status: 'pending' | 'confirmed' | 'failed' | 'replaced';
  blockNumber?: number;
  blockHash?: string;
  timestamp: string;
  error?: string;
}

export interface CampaignEstimate {
  totalRecipients: number;
  totalAmount: string;
  gasEstimate: string;
  gasCostUSD: number;
  estimatedTime: number;
  batchCount: number;
  successProbability: number;
}

export interface TokenInfo {
  name: string;
  symbol: string;
  decimals: number;
  address: string;
  chainType: 'evm' | 'solana';
}

export interface CSVRow {
  address: string;
  amount: string;
}

export interface CSVValidationResult {
  isValid: boolean;
  totalRecords: number;
  validRecords: number;
  invalidRecords: number;
  errors: CSVValidationError[];
  sampleData: CSVRow[];
}

export interface CSVValidationError {
  row: number;
  field: 'address' | 'amount';
  value: string;
  error: string;
}

export interface WalletBalance {
  tokenAddress: string;
  tokenSymbol: string;
  tokenDecimals: number;
  balance: string;
  usdValue?: string;
}

export interface Wallet {
  address: string;
  privateKeyBase64: string;
  type: 'evm' | 'solana';
  chainId?: number;
  createdAt?: string;
}

export interface WalletExport {
  version: string;
  timestamp: string;
  wallets: Wallet[];
}

export interface ProgressData {
  campaignId: string;
  current: number;
  total: number;
  percentage: number;
}

export interface BalanceData {
  native: string;
  token?: string;
}

// Chain types
export type ChainInfo = EVMChain | SolanaChain;

export interface EVMChain {
  id?: number;
  type: 'evm';
  chainId: number;
  name: string;
  rpcUrl: string;
  rpcBackup?: string;
  explorerUrl: string;
  symbol: string;
  decimals: number;
  color?: string;
  badgeColor?: string;
  isCustom: boolean;
}

export interface SolanaChain {
  id?: number;
  type: 'solana';
  chainId?: number; // 501 for mainnet-beta, 502 for devnet
  name: string;
  rpcUrl: string;
  rpcBackup?: string;
  explorerUrl?: string;
  symbol: string;
  decimals: number;
  color?: string;
  badgeColor?: string;
  isCustom: boolean;
}

export interface SolanaRPC {
  id?: number;
  network: 'mainnet-beta' | 'devnet' | 'testnet';
  name: string;
  rpcUrl: string;
  wsUrl?: string;
  latency?: number;
  uptime24h?: number;
}



// Wallet Management types
export interface ActivityWallet {
  id: string;
  campaignId: string;
  campaignName: string;
  address: string;
  chain: string;
  privateKeyBase64?: string;
  balances: WalletBalance[];
  status: string;
  totalBalance: string;
  totalCapacity: string;
  createdAt: string;
  updatedAt: string;
  lastBalanceUpdate?: string;
}

export interface WalletDetail {
  wallet: ActivityWallet;
  transactions: WalletTransaction[];
  fundingHistory: FundingRecord[];
  balanceHistory: BalanceHistory[];
}

export interface WalletTransaction {
  id: string;
  walletId: string;
  hash: string;
  type: 'incoming' | 'outgoing' | 'self';
  amount: string;
  tokenSymbol: string;
  tokenAddress: string;
  from: string;
  to: string;
  gasUsed?: string;
  gasPrice?: string;
  status: 'pending' | 'confirmed' | 'failed';
  timestamp: string;
  blockNumber?: number;
}

export interface FundingRecord {
  id: string;
  walletId: string;
  fromAddress: string;
  amount: string;
  tokenSymbol: string;
  tokenAddress: string;
  txHash: string;
  status: 'pending' | 'confirmed' | 'failed';
  timestamp: string;
}

export interface BalanceHistory {
  id: string;
  walletId: string;
  tokenAddress: string;
  tokenSymbol: string;
  balance: string;
  usdValue: string;
  timestamp: string;
}

// Chain Configuration types
export interface ChainConfigurationForm {
  id?: number;
  name: string;
  chainId: number;
  rpcUrl: string;
  rpcBackup?: string;
  explorerUrl: string;
  symbol: string;
  decimals: number;
  gasPrice: number;
  gasLimit: number;
  batchSize: number;
  sendInterval: number;
  isCustom: boolean;
}

// Network Test Result
export interface NetworkTestResult {
  chainId: number;
  latency: number;
  blockNumber: number;
  gasPrice: number;
  status: 'success' | 'failed';
  error?: string;
  timestamp: string;
}

