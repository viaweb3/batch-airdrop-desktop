import { ipcMain } from 'electron';
import { DatabaseManager } from '../database/sqlite-schema';
import { CampaignService } from '../services/CampaignService';
import { WalletService } from '../services/WalletService';
import { WalletManagementService } from '../services/WalletManagementService';
import { BlockchainService } from '../services/BlockchainService';
import { ChainService } from '../services/ChainService';
import { FileService } from '../services/FileService';
import { PriceService } from '../services/PriceService';
import { ContractService } from '../services/ContractService';
import { CampaignEstimator } from '../services/CampaignEstimator';
import { TokenService } from '../services/TokenService';
import { SolanaService } from '../services/SolanaService';
import { KeyUtils } from '../utils/keyUtils';
import { Logger } from '../utils/logger';
import type {
  CreateCampaignRequest,
  CampaignFilters,
  EstimateRequest,
  WalletListOptions,
  EVMChainData,
  SolanaRPCData
} from '../types/ipc';

const logger = Logger.getInstance().child('IPCHandlers');

let databaseManager: DatabaseManager;
let campaignService: CampaignService;
let walletService: WalletService;
let walletManagementService: WalletManagementService;
let blockchainService: BlockchainService;
let chainService: ChainService;
let fileService: FileService;
let priceService: PriceService;
let contractService: ContractService;
let solanaService: SolanaService;
let campaignEstimator: CampaignEstimator;
let tokenService: TokenService;

export async function setupIPCHandlers() {
  try {
    logger.info('Initializing IPC handlers and services');

    databaseManager = new DatabaseManager();
    await databaseManager.initialize();

    campaignService = new CampaignService(databaseManager);
    walletService = new WalletService();
    walletManagementService = new WalletManagementService(databaseManager);
    priceService = new PriceService(databaseManager);
    blockchainService = new BlockchainService(priceService, databaseManager);
    chainService = new ChainService(databaseManager);
    fileService = new FileService(databaseManager);
    contractService = new ContractService();

    solanaService = new SolanaService();
    campaignEstimator = new CampaignEstimator(databaseManager);
    tokenService = new TokenService(chainService);

    logger.info('All services initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize services', error as Error);
    throw error;
  }

  ipcMain.handle('campaign:create', async (_event, data: CreateCampaignRequest) => {
    try {
      logger.debug('Creating campaign', { name: data.name, chain: data.chain });
      const campaign = await campaignService.createCampaign(data);
      logger.info('Campaign created successfully', { campaignId: campaign });
      return campaign;
    } catch (error) {
      logger.error('Failed to create campaign', error as Error, { data });
      throw new Error(`创建活动失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  });

  ipcMain.handle('campaign:list', async (_event, filters?: CampaignFilters) => {
    try {
      logger.debug('Listing campaigns', { filters });
      if (!campaignService) {
        throw new Error('CampaignService not initialized');
      }
      const campaigns = await campaignService.listCampaigns(filters);
      logger.debug('Campaigns listed', { count: campaigns.length });
      return campaigns;
    } catch (error) {
      logger.error('Failed to list campaigns', error as Error, { filters });
      throw new Error(`获取活动列表失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  });

  ipcMain.handle('campaign:getById', async (_event, id: string) => {
    try {
      logger.debug('Getting campaign by ID', { campaignId: id });
      const campaign = await campaignService.getCampaignById(id);
      return campaign;
    } catch (error) {
      logger.error('Failed to get campaign', error as Error, { campaignId: id });
      throw new Error(`获取活动详情失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  });

  ipcMain.handle('campaign:start', async (_event, id: string) => {
    try {
      logger.info('Starting campaign', { campaignId: id });
      const result = await campaignService.startCampaign(id);
      logger.info('Campaign started successfully', { campaignId: id });
      return result;
    } catch (error) {
      logger.error('Failed to start campaign', error as Error, { campaignId: id });
      throw new Error(`开始活动失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  });

  ipcMain.handle('campaign:pause', async (_event, id) => {
    try {
      logger.info('Pausing campaign', { campaignId: id });
      const result = await campaignService.pauseCampaign(id);
      return result;
    } catch (error) {
      logger.error('Failed to pause campaign', error as Error, { campaignId: id });
      throw new Error(`暂停活动失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  });

  ipcMain.handle('campaign:resume', async (_event, id) => {
    try {
      logger.info('Resuming campaign', { campaignId: id });
      const result = await campaignService.resumeCampaign(id);
      return result;
    } catch (error) {
      logger.error('Failed to resume campaign', error as Error, { campaignId: id });
      throw new Error(`恢复活动失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  });

  ipcMain.handle('campaign:updateStatus', async (_event, id, status) => {
    try {
      logger.info('Updating campaign status', { campaignId: id, status });
      await campaignService.updateCampaignStatus(id, status);
      return { success: true };
    } catch (error) {
      logger.error('Failed to update campaign status', error as Error, { campaignId: id, status });
      throw new Error(`更新活动状态失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  });


  ipcMain.handle('campaign:getDetails', async (_event, id) => {
    try {
      logger.debug('Getting campaign details', { campaignId: id });
      const details = await campaignService.getCampaignDetails(id);
      return details;
    } catch (error) {
      logger.error('Failed to get campaign details', error as Error, { campaignId: id });
      throw new Error(`获取活动详情失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  });

  ipcMain.handle('campaign:getTransactions', async (_event, id, options) => {
    try {
      logger.debug('Getting campaign transactions', { campaignId: id, options });
      const transactions = await campaignService.getCampaignTransactions(id, options);
      return transactions;
    } catch (error) {
      logger.error('Failed to get campaign transactions', error as Error, { campaignId: id });
      throw new Error(`获取活动交易记录失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  });

  ipcMain.handle('campaign:getRecipients', async (_event, id) => {
    try {
      logger.debug('Getting campaign recipients', { campaignId: id });
      const recipients = await campaignService.getCampaignRecipients(id);
      return recipients;
    } catch (error) {
      logger.error('Failed to get campaign recipients', error as Error, { campaignId: id });
      throw new Error(`获取活动接收者列表失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  });

  ipcMain.handle('campaign:estimate', async (_event, request) => {
    try {
      logger.info('Estimating campaign cost', { request });
      const estimate = await campaignEstimator.estimate(request);
      return estimate;
    } catch (error) {
      logger.error('Failed to estimate campaign cost', error as Error, { request });
      throw new Error(`估算活动成本失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  });

  // Solana相关API
  ipcMain.handle('solana:getBalance', async (_event, rpcUrl, walletAddress, tokenAddress) => {
    try {
      logger.debug('Getting Solana balance', { walletAddress, tokenAddress });
      const balance = await solanaService.getBalance(rpcUrl, walletAddress, tokenAddress);
      return { success: true, balance };
    } catch (error) {
      logger.error('Failed to get Solana balance', error as Error, { walletAddress });
      throw new Error(`获取Solana余额失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  });

  ipcMain.handle('solana:batchTransfer', async (_event, rpcUrl, privateKeyBase64, recipients, amounts, tokenAddress) => {
    try {
      logger.info('Initiating Solana batch transfer', { recipientCount: recipients.length, tokenAddress });
      const result = await solanaService.batchTransfer(rpcUrl, privateKeyBase64, recipients, amounts, tokenAddress);
      return { success: true, data: result };
    } catch (error) {
      logger.error('Failed to execute Solana batch transfer', error as Error);
      throw new Error(`Solana批量转账失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  });

  ipcMain.handle('solana:getTransactionStatus', async (_event, rpcUrl, transactionHash) => {
    try {
      logger.debug('Getting Solana transaction status', { transactionHash });
      const status = await solanaService.getTransactionStatus(rpcUrl, transactionHash);
      return { success: true, data: status };
    } catch (error) {
      logger.error('Failed to get Solana transaction status', error as Error, { transactionHash });
      throw new Error(`获取Solana交易状态失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  });

  ipcMain.handle('solana:getTokenInfo', async (_event, rpcUrl, tokenAddress) => {
    try {
      logger.debug('Getting Solana token info', { tokenAddress });
      const tokenInfo = await solanaService.getTokenInfo(rpcUrl, tokenAddress);
      return { success: true, data: tokenInfo };
    } catch (error) {
      logger.error('Failed to get Solana token info', error as Error, { tokenAddress });
      throw new Error(`获取Solana代币信息失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  });

  // 钱包相关（简化版 - 无密码保护）
  ipcMain.handle('wallet:create', async (_event, type = 'evm') => {
    try {
      logger.info('Creating wallet', { type });
      const wallet = type === 'solana'
        ? walletService.createSolanaWallet()
        : walletService.createEVMWallet();
      return wallet;
    } catch (error) {
      logger.error('Failed to create wallet', error as Error, { type });
      throw new Error(`创建钱包失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  });

  
  ipcMain.handle('wallet:getBalance', async (_event, address, chain, tokenAddress, tokenDecimals) => {
    try {
      logger.debug('Getting wallet balance', { address, chain, tokenAddress });
      const balance = await blockchainService.getBalance(address, chain, tokenAddress, tokenDecimals);
      return balance;
    } catch (error) {
      logger.error('Failed to get wallet balance', error as Error, { address, chain });
      throw new Error(`查询余额失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  });

  ipcMain.handle('wallet:list', async (_event, options) => {
    try {
      logger.debug('Listing wallets', { options });
      const wallets = await walletManagementService.listActivityWallets(options);
      return wallets;
    } catch (error) {
      logger.error('Failed to list wallets', error as Error, { options });
      throw new Error(`获取钱包列表失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  });

  ipcMain.handle('wallet:getBalances', async (_event, campaignId) => {
    try {
      logger.debug('Getting campaign wallet balances', { campaignId });
      const balances = await walletManagementService.getWalletBalances(campaignId);
      return balances;
    } catch (error) {
      logger.error('Failed to get campaign wallet balances', error as Error, { campaignId });
      throw new Error(`获取钱包余额失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  });

  ipcMain.handle('wallet:refreshBalances', async (_event, campaignIds) => {
    try {
      logger.debug('Refreshing wallet balances', { count: campaignIds.length });
      const results = await walletManagementService.refreshWalletBalances(campaignIds);
      // Convert Map to object for IPC
      return Object.fromEntries(results);
    } catch (error) {
      logger.error('Failed to refresh wallet balances', error as Error);
      throw new Error(`批量刷新钱包余额失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  });

  // 链管理相关
  ipcMain.handle('chain:getEVMChains', async (_event) => {
    try {
      logger.debug('Getting EVM chains');
      const chains = await chainService.getEVMChains();
      return chains;
    } catch (error) {
      logger.error('Failed to get EVM chains', error as Error);
      throw new Error(`获取EVM链列表失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  });

  ipcMain.handle('chain:getAllChains', async (_event) => {
    try {
      logger.debug('Getting all chains');
      const chains = await chainService.getAllChains();
      return chains;
    } catch (error) {
      logger.error('Failed to get all chains', error as Error);
      throw new Error(`获取所有链列表失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  });

  ipcMain.handle('chain:addEVMChain', async (_event, chainData) => {
    try {
      logger.info('Adding EVM chain', { chainData });
      const chainId = await chainService.addEVMChain(chainData);
      return chainId;
    } catch (error) {
      logger.error('Failed to add EVM chain', error as Error, { chainData });
      throw new Error(`添加EVM链失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  });

  ipcMain.handle('chain:updateEVMChain', async (_event, chainId, updates) => {
    try {
      logger.info('Updating EVM chain', { chainId, updates });
      await chainService.updateEVMChain(chainId, updates);
    } catch (error) {
      logger.error('Failed to update EVM chain', error as Error, { chainId });
      throw new Error(`更新EVM链失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  });

  ipcMain.handle('chain:deleteEVMChain', async (_event, chainId) => {
    try {
      logger.info('Deleting EVM chain', { chainId });
      await chainService.deleteEVMChain(chainId);
    } catch (error) {
      logger.error('Failed to delete EVM chain', error as Error, { chainId });
      throw new Error(`删除EVM链失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  });

  ipcMain.handle('chain:testEVMLatency', async (_event, rpcUrl) => {
    try {
      logger.debug('Testing EVM latency', { rpcUrl });
      const result = await chainService.testEVMLatency(rpcUrl);
      return result;
    } catch (error) {
      logger.error('Failed to test EVM latency', error as Error, { rpcUrl });
      throw new Error(`测试EVM链延迟失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  });

  ipcMain.handle('chain:getSolanaRPCs', async (_event) => {
    try {
      logger.debug('Getting Solana RPCs');
      const rpcs = await chainService.getSolanaRPCs();
      return rpcs;
    } catch (error) {
      logger.error('Failed to get Solana RPCs', error as Error);
      throw new Error(`获取Solana RPC列表失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  });

  
  ipcMain.handle('chain:addSolanaRPC', async (_event, rpcData) => {
    try {
      logger.info('Adding Solana RPC', { rpcData });
      const rpcId = await chainService.addSolanaRPC(rpcData);
      return rpcId;
    } catch (error) {
      logger.error('Failed to add Solana RPC', error as Error, { rpcData });
      throw new Error(`添加Solana RPC失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  });

  ipcMain.handle('chain:testSolanaRPC', async (_event, rpcUrl) => {
    try {
      logger.debug('Testing Solana RPC', { rpcUrl });
      const result = await chainService.testSolanaRPC(rpcUrl);
      return result;
    } catch (error) {
      logger.error('Failed to test Solana RPC', error as Error, { rpcUrl });
      throw new Error(`测试Solana RPC失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  });

  ipcMain.handle('chain:updateSolanaRPCPriority', async (_event, id, priority) => {
    try {
      logger.info('Updating Solana RPC priority', { id, priority });
      await chainService.updateSolanaRPCPriority(id, priority);
    } catch (error) {
      logger.error('Failed to update Solana RPC priority', error as Error, { id });
      throw new Error(`更新Solana RPC优先级失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  });

  ipcMain.handle('chain:deleteSolanaRPC', async (_event, id) => {
    try {
      logger.info('Deleting Solana RPC', { id });
      await chainService.deleteSolanaRPC(id);
    } catch (error) {
      logger.error('Failed to delete Solana RPC', error as Error, { id });
      throw new Error(`删除Solana RPC失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  });

  // 文件操作
  ipcMain.handle('file:readCSV', async (_event, filePath) => {
    try {
      logger.debug('Reading CSV file', { filePath });
      const data = await fileService.readCSV(filePath);
      return data;
    } catch (error) {
      logger.error('Failed to read CSV file', error as Error, { filePath });
      throw new Error(`读取CSV文件失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  });

  ipcMain.handle('file:exportReport', async (_event, campaignId) => {
    try {
      logger.info('Exporting report', { campaignId });
      const result = await fileService.exportReport(campaignId, 'csv');
      return result;
    } catch (error) {
      logger.error('Failed to export report', error as Error, { campaignId });
      throw new Error(`导出报告失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  });

  ipcMain.handle('blockchain:estimateGas', async (_event, chain, fromAddress, toAddress, tokenAddress, recipientCount) => {
    try {
      logger.info('Estimating gas', { chain, recipientCount });
      const estimate = await blockchainService.estimateGas(
        chain,
        fromAddress,
        toAddress,
        tokenAddress,
        recipientCount
      );
      return estimate;
    } catch (error) {
      logger.error('Failed to estimate gas', error as Error, { chain });
      throw new Error(`估算Gas费失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  });

  ipcMain.handle('blockchain:getTransactionStatus', async (_event, txHash, chain) => {
    try {
      logger.debug('Getting transaction status', { txHash, chain });
      const status = await blockchainService.getTransactionStatus(txHash, chain);
      return status;
    } catch (error) {
      logger.error('Failed to get transaction status', error as Error, { txHash, chain });
      throw new Error(`获取交易状态失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  });

  // 价格服务相关
  ipcMain.handle('price:getPrice', async (_event, symbol) => {
    try {
      logger.debug('Getting price', { symbol });
      const price = await priceService.getPrice(symbol);
      return { symbol, price };
    } catch (error) {
      logger.error('Failed to get price', error as Error, { symbol });
      throw new Error(`获取价格失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  });

  ipcMain.handle('price:getPrices', async (_event, symbols) => {
    try {
      logger.debug('Getting prices', { symbols });
      if (!priceService) {
        throw new Error('PriceService not initialized');
      }
      const prices = await priceService.getPricesForSymbols(symbols);
      logger.debug('Prices retrieved', { count: Object.keys(prices).length });
      return prices;
    } catch (error) {
      logger.error('Failed to get prices', error as Error, { symbols });
      throw new Error(`批量获取价格失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  });


  // Get cached prices without triggering new API calls
  ipcMain.handle('price:getCachedPrices', async (_event, symbols: string[]) => {
    try {
      logger.debug('Getting cached prices', { symbols });
      if (!priceService) {
        throw new Error('PriceService not initialized');
      }

      const prices: Record<string, number> = {};

      for (const symbol of symbols) {
        const priceData = await priceService.getPriceData(symbol);
        if (priceData) {
          prices[symbol] = priceData.price;
        } else {
          prices[symbol] = 0;
        }
      }

      return prices;
    } catch (error) {
      logger.error('Failed to get cached prices', error as Error);
      throw new Error(`获取缓存价格失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  });

  // Get price summary with all cached data
  ipcMain.handle('price:getSummary', async (_event) => {
    try {
      logger.debug('Getting price summary');
      if (!priceService) {
        throw new Error('PriceService not initialized');
      }
      const summary = await priceService.getPriceSummary();
      return summary;
    } catch (error) {
      logger.error('Failed to get price summary', error as Error);
      throw new Error(`获取价格汇总失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  });

  // 重试失败的交易
  ipcMain.handle('campaign:retryFailedTransactions', async (_event, campaignId) => {
    try {
      logger.info('Retrying failed transactions', { campaignId });
      const retriedCount = await campaignService.retryFailedTransactions(campaignId);
      return { success: true, retried: retriedCount, message: `已重置 ${retriedCount} 笔失败的交易，请点击"恢复发送"继续` };
    } catch (error) {
      logger.error('Failed to retry transactions', error as Error, { campaignId });
      throw new Error(`重试失败交易失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  });

  // 为活动部署合约（使用活动专用地址 + 幂等性保护）
  ipcMain.handle('campaign:deployContract', async (_event, campaignId) => {
    // 使用幂等性锁保护
    return campaignService.deployContractWithLock(campaignId, async () => {
      try {
        logger.info('Deploying contract for campaign', { campaignId });

        // 1. 获取活动信息
        const campaign = await campaignService.getCampaignById(campaignId);
        if (!campaign) {
          throw new Error('活动不存在');
        }

        if (!campaign.walletPrivateKeyBase64) {
          throw new Error('活动钱包信息缺失');
        }

        // 2. 解码私钥
        const chainInfo = await chainService.getChainById(parseInt(campaign.chain));
        const privateKey = chainInfo?.type === 'solana'
          ? walletService.exportSolanaPrivateKey(campaign.walletPrivateKeyBase64)
          : walletService.exportEVMPrivateKey(campaign.walletPrivateKeyBase64);

        // 3. 获取链配置
        const chain = await chainService.getEVMChainById(parseInt(campaign.chain));
        if (!chain) {
          throw new Error('链配置不存在');
        }

        // 4. 部署合约
        const config = {
          tokenAddress: campaign.tokenAddress,
          chainId: parseInt(campaign.chain),
          rpcUrl: chain.rpcUrl,
          deployerPrivateKey: privateKey
        };

        const contractInfo = await contractService.deployContract(config);

        // 5. 记录部署交易
        await campaignService.recordTransaction(campaignId, {
          txHash: contractInfo.transactionHash,
          txType: 'DEPLOY_CONTRACT',
          fromAddress: campaign.walletAddress || '',
          toAddress: contractInfo.contractAddress,
          gasUsed: parseFloat(contractInfo.gasUsed || '0'),
          status: 'CONFIRMED',
          blockNumber: contractInfo.blockNumber
        });

        // 6. 更新活动信息（包含状态验证）
        await campaignService.updateCampaignContract(
          campaignId,
          contractInfo.contractAddress,
          contractInfo.transactionHash
        );

        logger.info('Contract deployed successfully', {
          campaignId,
          contractAddress: contractInfo.contractAddress
        });

        return {
          success: true,
          contractAddress: contractInfo.contractAddress,
          transactionHash: contractInfo.transactionHash,
          gasUsed: contractInfo.gasUsed
        };
      } catch (error) {
        logger.error('Failed to deploy contract', error as Error, { campaignId });
        throw new Error(`为活动部署合约失败: ${error instanceof Error ? error.message : '未知错误'}`);
      }
    });
  });

  // 代币相关处理器
  ipcMain.handle('token:getInfo', async (_event, tokenAddress: string, chainId: string) => {
    try {
      logger.debug('Getting token info', { tokenAddress, chainId });
      const tokenInfo = await tokenService.getTokenInfo(tokenAddress, chainId);
      return tokenInfo;
    } catch (error) {
      logger.error('Failed to get token info', error as Error, { tokenAddress });
      throw new Error(`获取代币信息失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  });

  ipcMain.handle('token:validateAddress', async (_event, tokenAddress: string, chainId: string) => {
    try {
      logger.debug('Validating token address', { tokenAddress, chainId });
      const validation = await tokenService.validateTokenAddressForChain(tokenAddress, chainId);
      return validation;
    } catch (error) {
      logger.error('Failed to validate token address', error as Error, { tokenAddress });
      throw new Error(`验证代币地址失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  });

  ipcMain.handle('token:getMultipleInfo', async (_event, tokenAddresses: string[], chainId: string) => {
    try {
      logger.debug('Getting multiple token infos', { count: tokenAddresses.length, chainId });
      const tokenInfos = await tokenService.getMultipleTokenInfos(tokenAddresses, chainId);
      return tokenInfos;
    } catch (error) {
      logger.error('Failed to get multiple token infos', error as Error);
      throw new Error(`批量获取代币信息失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  });

  // Withdraw remaining tokens from campaign wallet
  ipcMain.handle('campaign:withdrawTokens', async (_event, campaignId: string, recipientAddress: string) => {
    try {
      logger.info('Withdrawing tokens', { campaignId, recipientAddress });

      // Get campaign details
      const campaign = await campaignService.getCampaignById(campaignId);
      if (!campaign) {
        throw new Error('Campaign not found');
      }

      if (!campaign.walletPrivateKeyBase64) {
        throw new Error('活动钱包信息缺失');
      }

      // Get chain config first
      const chain = await chainService.getChainById(parseInt(campaign.chain));
      if (!chain) {
        throw new Error('Chain not found');
      }

      // Decode private key using chain-specific method
      const privateKey = chain.type === 'solana'
        ? Buffer.from(KeyUtils.decodeToSolanaBytes(campaign.walletPrivateKeyBase64)).toString('hex')
        : walletService.exportEVMPrivateKey(campaign.walletPrivateKeyBase64);

      let result;

      // Check if it's a Solana chain
      if (chain.type === 'solana' || chain.name.toLowerCase().includes('solana')) {
        // Withdraw SPL tokens
        result = await blockchainService.withdrawRemainingSPLTokens(
          chain.rpcUrl,
          privateKey,
          recipientAddress,
          campaign.tokenAddress
        );
      } else {
        // Withdraw ERC20 tokens
        result = await contractService.withdrawRemainingTokens(
          chain.rpcUrl,
          privateKey,
          recipientAddress,
          campaign.tokenAddress
        );
      }

      logger.info('Tokens withdrawn successfully', { result });
      return result;
    } catch (error) {
      logger.error('Failed to withdraw tokens', error as Error, { campaignId });
      throw new Error(`回收代币失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  });

  // Withdraw remaining native token (ETH/BNB/MATIC/SOL/etc) from campaign wallet
  ipcMain.handle('campaign:withdrawNative', async (_event, campaignId: string, recipientAddress: string) => {
    try {
      logger.info('Withdrawing native tokens', { campaignId, recipientAddress });

      // Get campaign details
      const campaign = await campaignService.getCampaignById(campaignId);
      if (!campaign) {
        throw new Error('Campaign not found');
      }

      if (!campaign.walletPrivateKeyBase64) {
        throw new Error('活动钱包信息缺失');
      }

      // Get chain config first
      const chain = await chainService.getChainById(parseInt(campaign.chain));
      if (!chain) {
        throw new Error('Chain not found');
      }

      // Decode private key using chain-specific method
      const privateKey = chain.type === 'solana'
        ? Buffer.from(KeyUtils.decodeToSolanaBytes(campaign.walletPrivateKeyBase64)).toString('hex')
        : walletService.exportEVMPrivateKey(campaign.walletPrivateKeyBase64);

      let result;

      // Check if it's a Solana chain
      if (chain.type === 'solana' || chain.name.toLowerCase().includes('solana')) {
        // Withdraw SOL
        result = await blockchainService.withdrawRemainingSOL(
          chain.rpcUrl,
          privateKey,
          recipientAddress
        );
      } else {
        // Withdraw native token (ETH/BNB/MATIC/AVAX/etc)
        result = await contractService.withdrawRemainingETH(
          chain.rpcUrl,
          privateKey,
          recipientAddress
        );
      }

      logger.info('Native tokens withdrawn successfully', { result });
      return result;
    } catch (error) {
      logger.error('Failed to withdraw native tokens', error as Error, { campaignId });
      throw new Error(`回收原生代币失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  });

  // Private key export handlers with chain type support
  ipcMain.handle('wallet:exportEVMPrivateKey', async (_event, privateKeyBase64: string) => {
    try {
      logger.info('Exporting EVM private key');
      const privateKey = walletService.exportEVMPrivateKey(privateKeyBase64);
      return { success: true, privateKey };
    } catch (error) {
      logger.error('Failed to export EVM private key', error as Error);
      throw new Error(`导出EVM私钥失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  });

  ipcMain.handle('wallet:exportSolanaPrivateKey', async (_event, privateKeyBase64: string) => {
    try {
      logger.info('Exporting Solana private key');
      const privateKey = walletService.exportSolanaPrivateKey(privateKeyBase64);
      return { success: true, privateKey };
    } catch (error) {
      logger.error('Failed to export Solana private key', error as Error);
      throw new Error(`导出Solana私钥失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  });

  // 错误处理
  ipcMain.on('error', (_event, error) => {
    logger.error('IPC error received', error);
  });

  logger.info('IPC handlers setup complete');
}
