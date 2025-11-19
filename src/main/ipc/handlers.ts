import { ipcMain } from 'electron';
import { DatabaseManager } from '../database/schema';
import { CampaignService } from '../services/CampaignService';
import { WalletService } from '../services/WalletService';
import { BlockchainService } from '../services/BlockchainService';
import { ChainService } from '../services/ChainService';
import { FileService } from '../services/FileService';
import { SettingsService } from '../services/SettingsService';
import { PriceService } from '../services/PriceService';
import { ContractService } from '../services/ContractService';

let databaseManager: DatabaseManager;
let campaignService: CampaignService;
let walletService: WalletService;
let blockchainService: BlockchainService;
let chainService: ChainService;
let fileService: FileService;
let settingsService: SettingsService;
let priceService: PriceService;
let contractService: ContractService;

export function setupIPCHandlers() {
  // 初始化服务
  try {
    databaseManager = new DatabaseManager();
    campaignService = new CampaignService(databaseManager);
    walletService = new WalletService();
    priceService = new PriceService(databaseManager);
    blockchainService = new BlockchainService(priceService);
    chainService = new ChainService(databaseManager);
    fileService = new FileService(databaseManager);
    settingsService = new SettingsService(databaseManager);
    contractService = new ContractService();

    console.log('All services initialized successfully');
  } catch (error) {
    console.error('Failed to initialize services:', error);
    return;
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
      console.log('获取活动列表:', filters);
      const campaigns = await campaignService.listCampaigns(filters);
      return campaigns;
    } catch (error) {
      console.error('获取活动列表失败:', error);
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

  // 钱包相关
  ipcMain.handle('wallet:unlock', async (_event, password) => {
    try {
      console.log('解锁钱包');
      const success = await walletService.unlockWithPassword(password);
      return { success, isLocked: walletService.isLocked() };
    } catch (error) {
      console.error('解锁钱包失败:', error);
      throw new Error(`解锁钱包失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  });

  ipcMain.handle('wallet:lock', async (_event) => {
    try {
      console.log('锁定钱包');
      walletService.lock();
      return { success: true };
    } catch (error) {
      console.error('锁定钱包失败:', error);
      throw new Error(`锁定钱包失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  });

  ipcMain.handle('wallet:changePassword', async (_event, oldPassword, newPassword) => {
    try {
      console.log('更改密码');
      const success = walletService.changePassword(oldPassword, newPassword);
      return { success };
    } catch (error) {
      console.error('更改密码失败:', error);
      throw new Error(`更改密码失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  });

  ipcMain.handle('wallet:create', async (_event, type = 'evm') => {
    try {
      console.log('创建钱包:', type);
      if (walletService.isLocked()) {
        throw new Error('Wallet is locked. Please unlock first.');
      }
      const wallet = type === 'solana'
        ? walletService.createSolanaWallet()
        : walletService.createEVMWallet();
      return wallet;
    } catch (error) {
      console.error('创建钱包失败:', error);
      throw new Error(`创建钱包失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  });

  ipcMain.handle('wallet:exportPrivateKey', async (_event, encryptedKey) => {
    try {
      console.log('导出私钥');
      if (walletService.isLocked()) {
        throw new Error('Wallet is locked. Please unlock first.');
      }
      const privateKey = walletService.exportPrivateKey(encryptedKey);
      return privateKey;
    } catch (error) {
      console.error('导出私钥失败:', error);
      throw new Error(`导出私钥失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  });

  ipcMain.handle('wallet:exportKeystore', async (_event, encryptedKey, password) => {
    try {
      console.log('导出Keystore');
      if (walletService.isLocked()) {
        throw new Error('Wallet is locked. Please unlock first.');
      }
      const keystore = walletService.exportKeystore(encryptedKey, password);
      return keystore;
    } catch (error) {
      console.error('导出Keystore失败:', error);
      throw new Error(`导出Keystore失败: ${error instanceof Error ? error.message : '未知错误'}`);
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

  ipcMain.handle('chain:getActiveSolanaRPC', async (_event, network) => {
    try {
      console.log('获取活跃Solana RPC:', network);
      const rpc = await chainService.getActiveSolanaRPC(network);
      return rpc;
    } catch (error) {
      console.error('获取活跃Solana RPC失败:', error);
      throw new Error(`获取活跃Solana RPC失败: ${error instanceof Error ? error.message : '未知错误'}`);
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

  // 设置相关
  ipcMain.handle('settings:get', async (_event) => {
    try {
      console.log('获取设置');
      const settings = await settingsService.getSettings();
      return settings;
    } catch (error) {
      console.error('获取设置失败:', error);
      throw new Error(`获取设置失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  });

  ipcMain.handle('settings:update', async (_event, settings) => {
    try {
      console.log('更新设置:', settings);
      const result = await settingsService.updateSettings(settings);
      return result;
    } catch (error) {
      console.error('更新设置失败:', error);
      throw new Error(`更新设置失败: ${error instanceof Error ? error.message : '未知错误'}`);
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

  ipcMain.handle('file:exportReport', async (_event, campaignId, format = 'csv') => {
    try {
      console.log('导出报告:', campaignId, format);
      const result = await fileService.exportReport(campaignId, format as 'csv' | 'json' | 'pdf');
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
      console.log('批量获取价格:', symbols);
      const prices = await priceService.getPricesForSymbols(symbols);
      return prices;
    } catch (error) {
      console.error('批量获取价格失败:', error);
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
