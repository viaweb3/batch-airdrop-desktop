import { ipcMain } from 'electron';
import { DatabaseManager } from '../database/sqlite-schema';
import { CampaignService } from '../services/CampaignService';
import { WalletService } from '../services/WalletService';
import { BlockchainService } from '../services/BlockchainService';
import { ChainService } from '../services/ChainService';
import { FileService } from '../services/FileService';
import { PriceService } from '../services/PriceService';
import { ContractService } from '../services/ContractService';

let databaseManager: DatabaseManager;
let campaignService: CampaignService;
let walletService: WalletService;
let blockchainService: BlockchainService;
let chainService: ChainService;
let fileService: FileService;
let priceService: PriceService;
let contractService: ContractService;

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

    console.log('Initializing price service...');
    priceService = new PriceService(databaseManager);

    console.log('Initializing blockchain service...');
    blockchainService = new BlockchainService(priceService);

    console.log('Initializing chain service...');
    chainService = new ChainService(databaseManager);

    console.log('Initializing file service...');
    fileService = new FileService(databaseManager);

    
    console.log('Initializing contract service...');
    contractService = new ContractService();

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
      return campaign;
    } catch (error) {
      console.error('创建活动失败:', error);
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
      console.log('开始活动:', id);
      const result = await campaignService.startCampaign(id, password, batchSize);
      return result;
    } catch (error) {
      console.error('开始活动失败:', error);
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

  ipcMain.handle('wallet:exportPrivateKey', async (_event, privateKeyBase64) => {
    try {
      console.log('导出私钥');
      const privateKey = walletService.exportPrivateKey(privateKeyBase64);
      return privateKey;
    } catch (error) {
      console.error('导出私钥失败:', error);
      throw new Error(`导出私钥失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  });

  ipcMain.handle('wallet:getBalance', async (_event, address, chain, tokenAddress) => {
    try {
      console.log('查询余额:', address, chain, tokenAddress);
      const balance = await blockchainService.getBalance(address, chain, tokenAddress);
      return balance;
    } catch (error) {
      console.error('查询余额失败:', error);
      throw new Error(`查询余额失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  });

  // 链管理相关
  ipcMain.handle('chain:getEVMChains', async (_event, onlyEnabled) => {
    try {
      console.log('获取EVM链列表');
      const chains = await chainService.getEVMChains(onlyEnabled);
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

  ipcMain.handle('chain:testEVMLatency', async (_event, chainId) => {
    try {
      console.log('测试EVM链延迟:', chainId);
      const result = await chainService.testEVMLatency(chainId);
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
      console.log('[IPC] price:getPrices success, returning', Object.keys(prices).length, 'prices');
      return prices;
    } catch (error) {
      console.error('[IPC] price:getPrices failed:', error);
      throw new Error(`批量获取价格失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  });

  ipcMain.handle('price:getGasPrice', async (_event, network) => {
    try {
      console.log('获取Gas价格:', network);
      const gasPrice = await priceService.getGasPrice(network);
      return gasPrice;
    } catch (error) {
      console.error('获取Gas价格失败:', error);
      throw new Error(`获取Gas价格失败: ${error instanceof Error ? error.message : '未知错误'}`);
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

        // 5. 更新活动信息（包含状态验证）
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

  // 错误处理
  ipcMain.on('error', (_event, error) => {
    console.error('IPC error:', error);
  });

  console.log('IPC handlers setup complete');
}
