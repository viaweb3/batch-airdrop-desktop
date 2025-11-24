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
  // 初始化服务
  try {
    console.log('Initializing database manager...');
    databaseManager = new DatabaseManager();
    await databaseManager.initialize();
    console.log('Database initialized successfully');

    console.log('Initializing campaign service...');
    campaignService = new CampaignService(databaseManager);

    console.log('Initializing wallet service...');
    walletService = new WalletService();

    console.log('Initializing wallet management service...');
    walletManagementService = new WalletManagementService(databaseManager);

    console.log('Initializing price service...');
    priceService = new PriceService(databaseManager);

    console.log('Initializing blockchain service...');
    blockchainService = new BlockchainService(priceService, databaseManager);

    console.log('Initializing chain service...');
    chainService = new ChainService(databaseManager);

    console.log('Initializing file service...');
    fileService = new FileService(databaseManager);

    
    console.log('Initializing contract service...');
    contractService = new ContractService();

    console.log('Initializing Solana service...');
    solanaService = new SolanaService();

    console.log('Initializing campaign estimator...');
    campaignEstimator = new CampaignEstimator(databaseManager);

    console.log('Initializing token service...');
    tokenService = new TokenService(chainService);

    console.log('All services initialized successfully');
  } catch (error) {
    console.error('Failed to initialize services:', error);
    throw error;
  }

  // 活动相关
  ipcMain.handle('campaign:create', async (_event, data) => {
    try {
      console.log('创建活动:', data);
      const campaign = await campaignService.createCampaign(data);
      console.log('✅ 活动创建成功:', campaign.id);
      return campaign;
    } catch (error) {
      console.error('❌ 创建活动失败:', error);
      console.error('错误堆栈:', error instanceof Error ? error.stack : 'No stack trace');
      throw new Error(`创建活动失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  });

  ipcMain.handle('campaign:list', async (_event, filters) => {
    try {
      console.log('[IPC] campaign:list called with filters:', filters);
      if (!campaignService) {
        throw new Error('CampaignService not initialized');
      }
      const campaigns = await campaignService.listCampaigns(filters);
      console.log('[IPC] campaign:list success, returning', campaigns.length, 'campaigns');
      return campaigns;
    } catch (error) {
      console.error('[IPC] campaign:list failed:', error);
      throw new Error(`获取活动列表失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  });

  ipcMain.handle('campaign:getById', async (_event, id) => {
    try {
      console.log('获取活动详情:', id);
      const campaign = await campaignService.getCampaignById(id);
      return campaign;
    } catch (error) {
      console.error('获取活动详情失败:', error);
      throw new Error(`获取活动详情失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  });

  ipcMain.handle('campaign:start', async (_event, id, password, batchSize) => {
    try {
      console.log('[IPC] campaign:start called for campaign:', id);

      // 注意：password参数保持但不再使用，私钥直接从数据库获取
      const result = await campaignService.startCampaign(id, '', batchSize);
      console.log('[IPC] campaign:start success:', result);
      return result;
    } catch (error) {
      console.error('[IPC] campaign:start failed:', error);
      throw new Error(`开始活动失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  });

  ipcMain.handle('campaign:pause', async (_event, id) => {
    try {
      console.log('暂停活动:', id);
      const result = await campaignService.pauseCampaign(id);
      return result;
    } catch (error) {
      console.error('暂停活动失败:', error);
      throw new Error(`暂停活动失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  });

  ipcMain.handle('campaign:resume', async (_event, id) => {
    try {
      console.log('恢复活动:', id);
      const result = await campaignService.resumeCampaign(id);
      return result;
    } catch (error) {
      console.error('恢复活动失败:', error);
      throw new Error(`恢复活动失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  });

  
  ipcMain.handle('campaign:getDetails', async (_event, id) => {
    try {
      console.log('获取活动详情:', id);
      const details = await campaignService.getCampaignDetails(id);
      return details;
    } catch (error) {
      console.error('获取活动详情失败:', error);
      throw new Error(`获取活动详情失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  });

  ipcMain.handle('campaign:getTransactions', async (_event, id, options) => {
    try {
      console.log('获取活动交易记录:', id);
      const transactions = await campaignService.getCampaignTransactions(id, options);
      return transactions;
    } catch (error) {
      console.error('获取活动交易记录失败:', error);
      throw new Error(`获取活动交易记录失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  });

  ipcMain.handle('campaign:getRecipients', async (_event, id) => {
    try {
      console.log('获取活动接收者列表:', id);
      const recipients = await campaignService.getCampaignRecipients(id);
      return recipients;
    } catch (error) {
      console.error('获取活动接收者列表失败:', error);
      throw new Error(`获取活动接收者列表失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  });

  ipcMain.handle('campaign:estimate', async (_event, request) => {
    try {
      console.log('估算活动成本:', request);
      const estimate = await campaignEstimator.estimate(request);
      return estimate;
    } catch (error) {
      console.error('估算活动成本失败:', error);
      throw new Error(`估算活动成本失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  });

  // Solana相关API
  ipcMain.handle('solana:getBalance', async (_event, rpcUrl, walletAddress, tokenAddress) => {
    try {
      const balance = await solanaService.getBalance(rpcUrl, walletAddress, tokenAddress);
      return { success: true, balance };
    } catch (error) {
      console.error('获取Solana余额失败:', error);
      throw new Error(`获取Solana余额失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  });

  ipcMain.handle('solana:batchTransfer', async (_event, rpcUrl, privateKeyBase64, recipients, amounts, tokenAddress) => {
    try {
      const result = await solanaService.batchTransfer(rpcUrl, privateKeyBase64, recipients, amounts, tokenAddress);
      return { success: true, data: result };
    } catch (error) {
      console.error('Solana批量转账失败:', error);
      throw new Error(`Solana批量转账失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  });

  ipcMain.handle('solana:getTransactionStatus', async (_event, rpcUrl, transactionHash) => {
    try {
      const status = await solanaService.getTransactionStatus(rpcUrl, transactionHash);
      return { success: true, data: status };
    } catch (error) {
      console.error('获取Solana交易状态失败:', error);
      throw new Error(`获取Solana交易状态失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  });

  ipcMain.handle('solana:getTokenInfo', async (_event, rpcUrl, tokenAddress) => {
    try {
      const tokenInfo = await solanaService.getTokenInfo(rpcUrl, tokenAddress);
      return { success: true, data: tokenInfo };
    } catch (error) {
      console.error('获取Solana代币信息失败:', error);
      throw new Error(`获取Solana代币信息失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  });

  // 钱包相关（简化版 - 无密码保护）
  ipcMain.handle('wallet:create', async (_event, type = 'evm') => {
    try {
      console.log('创建钱包:', type);
      const wallet = type === 'solana'
        ? walletService.createSolanaWallet()
        : walletService.createEVMWallet();
      return wallet;
    } catch (error) {
      console.error('创建钱包失败:', error);
      throw new Error(`创建钱包失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  });

  
  ipcMain.handle('wallet:getBalance', async (_event, address, chain, tokenAddress, tokenDecimals) => {
    try {
      console.log('查询余额:', address, chain, tokenAddress, tokenDecimals);
      const balance = await blockchainService.getBalance(address, chain, tokenAddress, tokenDecimals);
      return balance;
    } catch (error) {
      console.error('查询余额失败:', error);
      throw new Error(`查询余额失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  });

  ipcMain.handle('wallet:list', async (_event, options) => {
    try {
      console.log('获取钱包列表:', options);
      const wallets = await walletManagementService.listActivityWallets(options);
      return wallets;
    } catch (error) {
      console.error('获取钱包列表失败:', error);
      throw new Error(`获取钱包列表失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  });

  ipcMain.handle('wallet:getBalances', async (_event, campaignId) => {
    try {
      console.log('获取钱包余额:', campaignId);
      const balances = await walletManagementService.getWalletBalances(campaignId);
      return balances;
    } catch (error) {
      console.error('获取钱包余额失败:', error);
      throw new Error(`获取钱包余额失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  });

  ipcMain.handle('wallet:refreshBalances', async (_event, campaignIds) => {
    try {
      console.log('批量刷新钱包余额:', campaignIds);
      const results = await walletManagementService.refreshWalletBalances(campaignIds);
      // Convert Map to object for IPC
      return Object.fromEntries(results);
    } catch (error) {
      console.error('批量刷新钱包余额失败:', error);
      throw new Error(`批量刷新钱包余额失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  });

  // 链管理相关
  ipcMain.handle('chain:getEVMChains', async (_event) => {
    try {
      console.log('获取EVM链列表');
      const chains = await chainService.getEVMChains();
      return chains;
    } catch (error) {
      console.error('获取EVM链列表失败:', error);
      throw new Error(`获取EVM链列表失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  });

  ipcMain.handle('chain:addEVMChain', async (_event, chainData) => {
    try {
      console.log('添加EVM链:', chainData);
      const chainId = await chainService.addEVMChain(chainData);
      return chainId;
    } catch (error) {
      console.error('添加EVM链失败:', error);
      throw new Error(`添加EVM链失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  });

  ipcMain.handle('chain:updateEVMChain', async (_event, chainId, updates) => {
    try {
      console.log('更新EVM链:', chainId, updates);
      await chainService.updateEVMChain(chainId, updates);
    } catch (error) {
      console.error('更新EVM链失败:', error);
      throw new Error(`更新EVM链失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  });

  ipcMain.handle('chain:deleteEVMChain', async (_event, chainId) => {
    try {
      console.log('删除EVM链:', chainId);
      await chainService.deleteEVMChain(chainId);
    } catch (error) {
      console.error('删除EVM链失败:', error);
      throw new Error(`删除EVM链失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  });

  ipcMain.handle('chain:testEVMLatency', async (_event, rpcUrl) => {
    try {
      console.log('测试EVM链延迟, RPC URL:', rpcUrl);
      const result = await chainService.testEVMLatency(rpcUrl);
      return result;
    } catch (error) {
      console.error('测试EVM链延迟失败:', error);
      throw new Error(`测试EVM链延迟失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  });

  ipcMain.handle('chain:getSolanaRPCs', async (_event, network, onlyEnabled) => {
    try {
      console.log('获取Solana RPC列表:', network, onlyEnabled);
      const rpcs = await chainService.getSolanaRPCs(network, onlyEnabled);
      return rpcs;
    } catch (error) {
      console.error('获取Solana RPC列表失败:', error);
      throw new Error(`获取Solana RPC列表失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  });

  
  ipcMain.handle('chain:addSolanaRPC', async (_event, rpcData) => {
    try {
      console.log('添加Solana RPC:', rpcData);
      const rpcId = await chainService.addSolanaRPC(rpcData);
      return rpcId;
    } catch (error) {
      console.error('添加Solana RPC失败:', error);
      throw new Error(`添加Solana RPC失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  });

  ipcMain.handle('chain:testSolanaRPC', async (_event, rpcUrl) => {
    try {
      console.log('测试Solana RPC:', rpcUrl);
      const result = await chainService.testSolanaRPC(rpcUrl);
      return result;
    } catch (error) {
      console.error('测试Solana RPC失败:', error);
      throw new Error(`测试Solana RPC失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  });

  ipcMain.handle('chain:updateSolanaRPCPriority', async (_event, id, priority) => {
    try {
      console.log('更新Solana RPC优先级:', id, priority);
      await chainService.updateSolanaRPCPriority(id, priority);
    } catch (error) {
      console.error('更新Solana RPC优先级失败:', error);
      throw new Error(`更新Solana RPC优先级失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  });

  ipcMain.handle('chain:deleteSolanaRPC', async (_event, id) => {
    try {
      console.log('删除Solana RPC:', id);
      await chainService.deleteSolanaRPC(id);
    } catch (error) {
      console.error('删除Solana RPC失败:', error);
      throw new Error(`删除Solana RPC失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  });

  ipcMain.handle('chain:healthCheckSolanaRPCs', async (_event) => {
    try {
      console.log('健康检查Solana RPCs');
      await chainService.healthCheckSolanaRPCs();
    } catch (error) {
      console.error('健康检查Solana RPCs失败:', error);
      throw new Error(`健康检查Solana RPCs失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  });

  
  // 文件操作
  ipcMain.handle('file:readCSV', async (_event, filePath) => {
    try {
      console.log('读取CSV文件:', filePath);
      const data = await fileService.readCSV(filePath);
      return data;
    } catch (error) {
      console.error('读取CSV文件失败:', error);
      throw new Error(`读取CSV文件失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  });

  ipcMain.handle('file:exportReport', async (_event, campaignId) => {
    try {
      console.log('导出报告:', campaignId);
      const result = await fileService.exportReport(campaignId, 'csv');
      return result;
    } catch (error) {
      console.error('导出报告失败:', error);
      throw new Error(`导出报告失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  });

  ipcMain.handle('blockchain:estimateGas', async (_event, chain, fromAddress, toAddress, tokenAddress, recipientCount) => {
    try {
      console.log('估算Gas费:', chain);
      const estimate = await blockchainService.estimateGas(
        chain,
        fromAddress,
        toAddress,
        tokenAddress,
        recipientCount
      );
      return estimate;
    } catch (error) {
      console.error('估算Gas费失败:', error);
      throw new Error(`估算Gas费失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  });

  ipcMain.handle('blockchain:getTransactionStatus', async (_event, txHash, chain) => {
    try {
      console.log('获取交易状态:', txHash, chain);
      const status = await blockchainService.getTransactionStatus(txHash, chain);
      return status;
    } catch (error) {
      console.error('获取交易状态失败:', error);
      throw new Error(`获取交易状态失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  });

  // 价格服务相关
  ipcMain.handle('price:getPrice', async (_event, symbol) => {
    try {
      console.log('获取价格:', symbol);
      const price = await priceService.getPrice(symbol);
      return { symbol, price };
    } catch (error) {
      console.error('获取价格失败:', error);
      throw new Error(`获取价格失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  });

  ipcMain.handle('price:getPrices', async (_event, symbols) => {
    try {
      console.log('[IPC] price:getPrices called with symbols:', symbols);
      if (!priceService) {
        throw new Error('PriceService not initialized');
      }
      const prices = await priceService.getPricesForSymbols(symbols);
      console.log('[IPC] price:getPrices success, returning prices:', prices);
      return prices;
    } catch (error) {
      console.error('[IPC] price:getPrices failed:', error);
      throw new Error(`批量获取价格失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  });

  
  // Gas info with buffer
  ipcMain.handle('gas:getInfo', async (_event, rpcUrl, network, tokenPrice) => {
    try {
      const { GasService } = require('../services/GasService');
      const gasService = new GasService();
      const gasInfo = await gasService.getGasInfo(rpcUrl, network, tokenPrice);
      return gasInfo;
    } catch (error) {
      console.error('获取Gas信息失败:', error);
      throw new Error(`获取Gas信息失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  });

  // Batch gas estimation
  ipcMain.handle('gas:estimateBatch', async (_event, rpcUrl, network, recipientCount, tokenPrice) => {
    try {
      const { GasService } = require('../services/GasService');
      const gasService = new GasService();
      const estimate = await gasService.getBatchGasEstimate(rpcUrl, network, recipientCount, tokenPrice);
      return estimate;
    } catch (error) {
      console.error('估算批量Gas费用失败:', error);
      throw new Error(`估算批量Gas费用失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  });

  ipcMain.handle('price:getSummary', async (_event) => {
    try {
      console.log('获取价格汇总');
      const summary = await priceService.getPriceSummary();
      return summary;
    } catch (error) {
      console.error('获取价格汇总失败:', error);
      throw new Error(`获取价格汇总失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  });

  // 合约服务相关 - 最简化版本
  ipcMain.handle('contract:deploy', async (_event, config) => {
    try {
      console.log('部署合约:', config);
      const contractInfo = await contractService.deployContract(config);
      return contractInfo;
    } catch (error) {
      console.error('部署合约失败:', error);
      throw new Error(`部署合约失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  });

  // 重试失败的交易
  ipcMain.handle('campaign:retryFailedTransactions', async (_event, campaignId) => {
    try {
      console.log('重试失败的交易:', campaignId);
      await campaignService.retryFailedTransactions(campaignId);
      return { success: true, message: '已重置失败的交易，可以重新开始发送' };
    } catch (error) {
      console.error('重试失败交易失败:', error);
      throw new Error(`重试失败交易失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  });

  // 为活动部署合约（使用活动专用地址 + 幂等性保护）
  ipcMain.handle('campaign:deployContract', async (_event, campaignId) => {
    // 使用幂等性锁保护
    return campaignService.deployContractWithLock(campaignId, async () => {
      try {
        console.log('为活动部署合约:', campaignId);

        // 1. 获取活动信息
        const campaign = await campaignService.getCampaignById(campaignId);
        if (!campaign) {
          throw new Error('活动不存在');
        }

        if (!campaign.walletPrivateKeyBase64) {
          throw new Error('活动钱包信息缺失');
        }

        // 2. 解码私钥
        const privateKey = walletService.exportPrivateKey(campaign.walletPrivateKeyBase64);

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

        return {
          success: true,
          contractAddress: contractInfo.contractAddress,
          transactionHash: contractInfo.transactionHash,
          gasUsed: contractInfo.gasUsed
        };
      } catch (error) {
        console.error('为活动部署合约失败:', error);
        throw new Error(`为活动部署合约失败: ${error instanceof Error ? error.message : '未知错误'}`);
      }
    });
  });

  // Token approval - 授权代币给合约使用
  ipcMain.handle('contract:approveTokens', async (_event, rpcUrl, privateKey, tokenAddress, contractAddress, amount) => {
    try {
      console.log('授权代币:', tokenAddress);
      const result = await contractService.approveTokens(rpcUrl, privateKey, tokenAddress, contractAddress, amount);
      return { success: true, txHash: result };
    } catch (error) {
      console.error('授权代币失败:', error);
      throw new Error(`授权代币失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  });

  // Check approval
  ipcMain.handle('contract:checkApproval', async (_event, rpcUrl, privateKey, tokenAddress, contractAddress, requiredAmount) => {
    try {
      const isApproved = await contractService.checkApproval(rpcUrl, privateKey, tokenAddress, contractAddress, requiredAmount);
      return { approved: isApproved };
    } catch (error) {
      console.error('检查授权失败:', error);
      throw new Error(`检查授权失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  });

  // 直接批量转账 - 一个函数搞定所有功能
  ipcMain.handle('contract:batchTransfer', async (_event, contractAddress, rpcUrl, privateKey, recipients, amounts, tokenAddress) => {
    try {
      console.log('执行批量转账:', contractAddress, recipients.length, '个地址');
      const result = await contractService.batchTransfer(contractAddress, rpcUrl, privateKey, recipients, amounts, tokenAddress);
      return { success: true, data: result };
    } catch (error) {
      console.error('批量转账失败:', error);
      throw new Error(`批量转账失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  });

  // 代币相关处理器
  ipcMain.handle('token:getInfo', async (_event, tokenAddress: string, chainId: string) => {
    try {
      console.log('获取代币信息:', { tokenAddress, chainId });
      const tokenInfo = await tokenService.getTokenInfo(tokenAddress, chainId);
      return tokenInfo;
    } catch (error) {
      console.error('获取代币信息失败:', error);
      throw new Error(`获取代币信息失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  });

  ipcMain.handle('token:validateAddress', async (_event, tokenAddress: string, chainId: string) => {
    try {
      console.log('验证代币地址:', { tokenAddress, chainId });
      const validation = await tokenService.validateTokenAddressForChain(tokenAddress, chainId);
      return validation;
    } catch (error) {
      console.error('验证代币地址失败:', error);
      throw new Error(`验证代币地址失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  });

  ipcMain.handle('token:getMultipleInfo', async (_event, tokenAddresses: string[], chainId: string) => {
    try {
      console.log('批量获取代币信息:', { tokenAddresses, chainId });
      const tokenInfos = await tokenService.getMultipleTokenInfos(tokenAddresses, chainId);
      return tokenInfos;
    } catch (error) {
      console.error('批量获取代币信息失败:', error);
      throw new Error(`批量获取代币信息失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  });

  // 错误处理
  ipcMain.on('error', (_event, error) => {
    console.error('IPC error:', error);
  });

  console.log('IPC handlers setup complete');
}
