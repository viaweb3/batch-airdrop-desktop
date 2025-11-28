/**
 * Shared type definitions for Electron API
 * Used by both main and renderer processes
 */

// Re-export types from main process
export type {
  CreateCampaignRequest,
  CampaignFilters,
  Campaign,
  CampaignDetails,
  CampaignRecipient,
  Transaction,
  TransactionOptions,
  EstimateRequest,
  EstimateResponse,
  CampaignProgress,
  CreateWalletRequest,
  WalletData,
  ActivityWallet,
  WalletListOptions,
  WalletListResponse,
  WalletBalance,
  GetBalanceRequest,
  EstimateGasRequest,
  TransactionStatusRequest,
  TransactionStatus,
  SolanaBalanceRequest,
  SolanaBatchTransferRequest,
  SolanaTransactionStatusRequest,
  SolanaTokenInfoRequest,
  SolanaTokenInfo,
  EVMChainData,
  SolanaRPCData,
  ChainInfo,
  LatencyTestResult,
  AppSettings,
  CSVData,
  ExportReportRequest,
  TokenPrice,
  PriceSummary,
  TokenInfoRequest,
  TokenInfo,
  ValidateAddressRequest,
  MultipleTokenInfoRequest
} from '../main/types/ipc';

/**
 * ElectronAPI interface exposed to renderer process
 */
export interface ElectronAPI {
  campaign: {
    create: (data: import('../main/types/ipc').CreateCampaignRequest) => Promise<string>;
    list: (filters?: import('../main/types/ipc').CampaignFilters) => Promise<import('../main/types/ipc').Campaign[]>;
    getById: (id: string) => Promise<import('../main/types/ipc').Campaign | null>;
    start: (id: string) => Promise<void>;
    pause: (id: string) => Promise<void>;
    resume: (id: string) => Promise<void>;
    updateStatus: (id: string, status: string) => Promise<void>;
    getDetails: (id: string) => Promise<import('../main/types/ipc').CampaignDetails | null>;
    getTransactions: (id: string, options?: import('../main/types/ipc').TransactionOptions) => Promise<import('../main/types/ipc').Transaction[]>;
    getRecipients: (id: string) => Promise<import('../main/types/ipc').CampaignRecipient[]>;
    estimate: (request: import('../main/types/ipc').EstimateRequest) => Promise<import('../main/types/ipc').EstimateResponse>;
    deployContract: (id: string) => Promise<string>;
    retryFailedTransactions: (id: string) => Promise<void>;
    withdrawTokens: (campaignId: string, recipientAddress: string) => Promise<string>;
    withdrawNative: (campaignId: string, recipientAddress: string) => Promise<string>;
    onProgress: (callback: (data: import('../main/types/ipc').CampaignProgress) => void) => void;
  };

  solana: {
    getBalance: (rpcUrl: string, walletAddress: string, tokenAddress?: string) => Promise<string>;
    batchTransfer: (rpcUrl: string, privateKeyBase64: string, recipients: string[], amounts: string[], tokenAddress: string) => Promise<unknown>;
    getTransactionStatus: (rpcUrl: string, transactionHash: string) => Promise<import('../main/types/ipc').TransactionStatus>;
    getTokenInfo: (rpcUrl: string, tokenAddress: string) => Promise<import('../main/types/ipc').SolanaTokenInfo>;
  };

  wallet: {
    create: (type?: 'evm' | 'solana') => Promise<import('../main/types/ipc').WalletData>;
    getBalance: (address: string, chain: string, tokenAddress?: string) => Promise<string>;
    list: (options?: import('../main/types/ipc').WalletListOptions) => Promise<import('../main/types/ipc').WalletListResponse>;
    getBalances: (campaignId: string) => Promise<import('../main/types/ipc').WalletBalance>;
    exportEVMPrivateKey: (privateKeyBase64: string) => Promise<string>;
    exportSolanaPrivateKey: (privateKeyBase64: string) => Promise<string>;
  };

  blockchain: {
    getBalance: (address: string, chain: string, tokenAddress?: string) => Promise<string>;
    estimateGas: (chain: string, fromAddress: string, toAddress: string, tokenAddress: string, recipientCount: number) => Promise<string>;
    getTransactionStatus: (txHash: string, chain: string) => Promise<import('../main/types/ipc').TransactionStatus>;
  };

  chain: {
    getAllChains: () => Promise<import('../main/types/ipc').ChainInfo[]>;
    getEVMChains: () => Promise<import('../main/types/ipc').ChainInfo[]>;
    addEVMChain: (chainData: import('../main/types/ipc').EVMChainData) => Promise<number>;
    updateEVMChain: (chainId: number, updates: Partial<import('../main/types/ipc').EVMChainData>) => Promise<void>;
    deleteEVMChain: (chainId: number) => Promise<void>;
    testEVMLatency: (chainId: number) => Promise<import('../main/types/ipc').LatencyTestResult>;
    getSolanaRPCs: (network?: string, onlyEnabled?: boolean) => Promise<unknown[]>;
    addSolanaRPC: (rpcData: import('../main/types/ipc').SolanaRPCData) => Promise<number>;
    testSolanaRPC: (rpcUrl: string) => Promise<import('../main/types/ipc').LatencyTestResult>;
    updateSolanaRPCPriority: (id: number, priority: number) => Promise<void>;
    deleteSolanaRPC: (id: number) => Promise<void>;
  };

  settings: {
    get: () => Promise<import('../main/types/ipc').AppSettings>;
    update: (settings: Partial<import('../main/types/ipc').AppSettings>) => Promise<void>;
  };

  file: {
    readCSV: (filePath: string) => Promise<import('../main/types/ipc').CSVData>;
    exportReport: (campaignId: string) => Promise<string>;
  };

  price: {
    getPrice: (symbol: string) => Promise<number>;
    getPrices: (symbols: string[]) => Promise<Record<string, number>>;
    getCachedPrices: (symbols: string[]) => Promise<import('../main/types/ipc').PriceSummary>;
    getSummary: () => Promise<import('../main/types/ipc').PriceSummary>;
  };

  token: {
    getInfo: (tokenAddress: string, chainId: string) => Promise<import('../main/types/ipc').TokenInfo>;
    validateAddress: (tokenAddress: string, chainId: string) => Promise<boolean>;
    getMultipleInfo: (tokenAddresses: string[], chainId: string) => Promise<import('../main/types/ipc').TokenInfo[]>;
  };
}

// Note: Window interface is declared in renderer/src/types/index.ts
