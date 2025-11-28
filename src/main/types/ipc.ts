/**
 * Type definitions for IPC communication between main and renderer processes
 * This eliminates the use of 'any' types in IPC handlers
 */

// ============================================================================
// Campaign Types
// ============================================================================

export interface CreateCampaignRequest {
  name: string;
  description?: string;
  chain: string;
  chainType: 'evm' | 'solana';
  tokenAddress: string;
  tokenSymbol?: string;
  batchSize: number;
  sendInterval: number;
  recipients: Array<{
    address: string;
    amount: string;
  }>;
}

export interface CampaignFilters {
  status?: 'CREATED' | 'FUNDED' | 'READY' | 'SENDING' | 'PAUSED' | 'COMPLETED' | 'FAILED';
  chain?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface Campaign {
  id: string;
  name: string;
  description?: string;
  chain: string;
  chainType: 'evm' | 'solana';
  tokenAddress: string;
  tokenSymbol?: string;
  status: 'CREATED' | 'FUNDED' | 'READY' | 'SENDING' | 'PAUSED' | 'COMPLETED' | 'FAILED';
  totalRecipients: number;
  completedRecipients: number;
  failedRecipients: number;
  walletAddress?: string;
  contractAddress?: string;
  batchSize: number;
  sendInterval: number;
  gasUsed: number;
  gasCostUsd: number;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface CampaignDetails extends Campaign {
  recipients: CampaignRecipient[];
  transactions: Transaction[];
}

export interface CampaignRecipient {
  address: string;
  amount: string;
  status: 'pending' | 'success' | 'failed';
  transactionHash?: string;
  error?: string;
}

export interface Transaction {
  id: string;
  campaignId: string;
  transactionHash: string;
  status: 'pending' | 'confirmed' | 'failed';
  recipientAddress: string;
  amount: string;
  gasUsed?: number;
  gasCost?: string;
  createdAt: string;
  confirmedAt?: string;
}

export interface TransactionOptions {
  status?: 'pending' | 'confirmed' | 'failed';
  limit?: number;
  offset?: number;
}

export interface EstimateRequest {
  chain: string;
  chainType: 'evm' | 'solana';
  tokenAddress: string;
  recipientCount: number;
  batchSize: number;
}

export interface EstimateResponse {
  totalGasEstimate: string;
  totalGasCostUsd: string;
  perTransactionGas: string;
  perTransactionCostUsd: string;
  numberOfBatches: number;
}

export interface CampaignProgress {
  campaignId: string;
  totalRecipients: number;
  completedRecipients: number;
  failedRecipients: number;
  status: 'EXECUTING' | 'PAUSED' | 'COMPLETED' | 'FAILED';
  currentBatch: number;
  totalBatches: number;
}

// ============================================================================
// Wallet Types
// ============================================================================

export interface CreateWalletRequest {
  type?: 'evm' | 'solana';
}

export interface WalletData {
  address: string;
  privateKeyBase64: string;
  type: 'evm' | 'solana';
  createdAt?: string;
}

export interface ActivityWallet {
  id: string;
  campaignId: string;
  campaignName: string;
  address: string;
  chain: string;
  status: string;
  balances: Array<{
    tokenAddress: string;
    tokenSymbol: string;
    tokenDecimals: number;
    balance: string;
    usdValue?: string;
  }>;
  totalBalance: string;
  totalCapacity: string;
  createdAt: string;
  updatedAt: string;
  lastBalanceUpdate?: string;
  privateKeyBase64?: string;
}

export interface WalletListOptions {
  type?: 'evm' | 'solana';
  limit?: number;
  offset?: number;
}

export interface WalletListResponse {
  wallets: ActivityWallet[];
  total: number;
}

export interface WalletBalance {
  address: string;
  balance: string;
  tokenBalance?: string;
  symbol?: string;
}

// ============================================================================
// Blockchain Types
// ============================================================================

export interface GetBalanceRequest {
  address: string;
  chain: string;
  tokenAddress?: string;
}

export interface EstimateGasRequest {
  chain: string;
  fromAddress: string;
  toAddress: string;
  tokenAddress: string;
  recipientCount: number;
}

export interface TransactionStatusRequest {
  txHash: string;
  chain: string;
}

export interface TransactionStatus {
  hash: string;
  status: 'pending' | 'confirmed' | 'failed';
  confirmations?: number;
  blockNumber?: number;
  gasUsed?: string;
  error?: string;
}

// ============================================================================
// Solana Types
// ============================================================================

export interface SolanaBalanceRequest {
  rpcUrl: string;
  walletAddress: string;
  tokenAddress?: string;
}

export interface SolanaBatchTransferRequest {
  rpcUrl: string;
  privateKeyBase64: string;
  recipients: string[];
  amounts: string[];
  tokenAddress: string;
}

export interface SolanaTransactionStatusRequest {
  rpcUrl: string;
  transactionHash: string;
}

export interface SolanaTokenInfoRequest {
  rpcUrl: string;
  tokenAddress: string;
}

export interface SolanaTokenInfo {
  address: string;
  decimals: number;
  symbol?: string;
  name?: string;
  supply?: string;
}

// ============================================================================
// Chain Management Types
// ============================================================================

export interface EVMChainData {
  chainId: number;
  name: string;
  rpcUrl: string;
  rpcBackup?: string;
  explorerUrl?: string;
  symbol: string;
  decimals: number;
  color?: string;
  badgeColor?: string;
}

export interface SolanaRPCData {
  network: 'mainnet' | 'devnet' | 'testnet';
  name: string;
  rpcUrl: string;
}

export interface ChainInfo {
  id: number;
  type: 'evm' | 'solana';
  chainId?: number;
  name: string;
  rpcUrl: string;
  rpcBackup?: string;
  explorerUrl?: string;
  symbol: string;
  decimals: number;
  color: string;
  badgeColor: string;
  isCustom: boolean;
}

export interface LatencyTestResult {
  chainId: number;
  latency: number;
  success: boolean;
  error?: string;
}

// ============================================================================
// Settings Types
// ============================================================================

export interface AppSettings {
  language?: string;
  theme?: 'light' | 'dark' | 'auto';
  currency?: string;
  gasLimit?: number;
  confirmations?: number;
  notifications?: boolean;
}

// ============================================================================
// File Types
// ============================================================================

export interface CSVData {
  headers: string[];
  rows: Array<Record<string, string>>;
  totalRows: number;
}

export interface ExportReportRequest {
  campaignId: string;
  format?: 'csv' | 'json' | 'pdf';
}

// ============================================================================
// Price Service Types
// ============================================================================

export interface TokenPrice {
  symbol: string;
  price: number;
  timestamp: number;
}

export interface PriceSummary {
  [symbol: string]: TokenPrice;
}

// ============================================================================
// Token Service Types
// ============================================================================

export interface TokenInfoRequest {
  tokenAddress: string;
  chainId: string;
}

export interface TokenInfo {
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  totalSupply?: string;
}

export interface ValidateAddressRequest {
  tokenAddress: string;
  chainId: string;
}

export interface MultipleTokenInfoRequest {
  tokenAddresses: string[];
  chainId: string;
}
