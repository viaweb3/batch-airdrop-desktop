// Electron API types
export interface ElectronAPI {
  campaign: {
    create: (data: any) => Promise<Campaign>;
    list: (filters?: any) => Promise<Campaign[]>;
    getById: (id: string) => Promise<Campaign | null>;
    start: (id: string) => Promise<{ success: boolean }>;
    pause: (id: string) => Promise<{ success: boolean }>;
    deployContract: (campaignId: string) => Promise<{ success: boolean; contractAddress: string; transactionHash: string; gasUsed: string }>;
    onProgress: (callback: (data: ProgressData) => void) => void;
  };
  wallet: {
    create: (type?: string) => Promise<{ address: string; privateKeyBase64: string }>;
    exportPrivateKey: (privateKeyBase64: string) => Promise<string>;
    getBalance: (address: string, chain: string, tokenAddress?: string) => Promise<BalanceData>;
  };
  chain: {
    getEVMChains: (onlyEnabled?: boolean) => Promise<EVMChain[]>;
    addEVMChain: (chainData: any) => Promise<number>;
    updateEVMChain: (chainId: number, updates: any) => Promise<void>;
    deleteEVMChain: (chainId: number) => Promise<void>;
    testEVMLatency: (chainId: number) => Promise<{ latency: number; blockNumber: number }>;
    getSolanaRPCs: (network?: string, onlyEnabled?: boolean) => Promise<SolanaRPC[]>;
        addSolanaRPC: (rpcData: any) => Promise<number>;
    testSolanaRPC: (rpcUrl: string) => Promise<{ success: boolean; latency?: number }>;
    updateSolanaRPCPriority: (id: number, priority: number) => Promise<void>;
    deleteSolanaRPC: (id: number) => Promise<void>;
      };
  file: {
    readCSV: (filePath: string) => Promise<any[]>;
    exportReport: (campaignId: string, format?: string) => Promise<{ success: boolean; filePath: string }>;
  };
  price: {
    getPrice: (symbol: string) => Promise<{ symbol: string; price: number }>;
    getPrices: (symbols: string[]) => Promise<Record<string, number>>;
    getGasPrice: (network: string) => Promise<any>;
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
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

// Campaign types
// Enhanced Campaign interface with full functionality
export interface Campaign {
  id: string;
  name: string;
  description?: string;
  chain: string;
  tokenAddress: string;
  tokenSymbol: string;
  tokenDecimals: number;
  status: 'CREATED' | 'FUNDED' | 'READY' | 'SENDING' | 'PAUSED' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
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
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'skipped';
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

export interface CSVValidationResult {
  isValid: boolean;
  totalRecords: number;
  validRecords: number;
  invalidRecords: number;
  errors: CSVValidationError[];
  sampleData: Recipient[];
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
  enabled: boolean;
  isCustom: boolean;
}

export interface SolanaRPC {
  id?: number;
  network: 'mainnet-beta' | 'devnet' | 'testnet';
  name: string;
  rpcUrl: string;
  wsUrl?: string;
  priority: number;
  latency?: number;
  uptime24h?: number;
  enabled: boolean;
}



// Wallet Management types
export interface ActivityWallet {
  id: string;
  campaignId: string;
  campaignName: string;
  address: string;
  privateKeyBase64?: string;
  balances: WalletBalance[];
  status: 'active' | 'pending' | 'completed' | 'failed';
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
  enabled: boolean;
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

