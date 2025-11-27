# CryptoCast API 文档

**文档版本**: v1.2.0
**最后更新**: 2025-11-27
**状态**: 生产就绪

---

## 📋 概述

CryptoCast 提供 Electron IPC（Inter-Process Communication）API，用于渲染进程（React UI）与主进程（Node.js 后端）之间的通信。所有 API 调用都是异步的，使用 Promise 模式。

### 调用方式

```typescript
// 在渲染进程中调用 API
const result = await window.electronAPI.campaign.create(data);
```

---

## 🎯 活动 (Campaign) API

### 创建活动

**接口**: `campaign:create`

**描述**: 创建新的批量分发活动

**参数**:
```typescript
interface CampaignData {
  name: string;                    // 活动名称
  description?: string;           // 活动描述
  chain: string;                   // 区块链网络
  tokenAddress: string;           // 代币合约地址
  tokenSymbol?: string;           // 代币符号
  tokenName?: string;             // 代币名称
  tokenDecimals?: number;         // 代币小数位数
  batchSize?: number;             // 批次大小 (默认: 100)
  sendInterval?: number;          // 发送间隔毫秒 (默认: 2000)
  recipients: Array<{             // 收款人列表
    address: string;              // 收款地址
    amount: string;               // 发放数量
  }>;
}
```

**返回值**:
```typescript
interface Campaign {
  id: string;
  name: string;
  description?: string;
  chain: string;
  tokenAddress: string;
  tokenSymbol?: string;
  tokenName?: string;
  tokenDecimals?: number;
  status: 'CREATED' | 'FUNDED' | 'READY' | 'SENDING' | 'PAUSED' | 'COMPLETED' | 'FAILED';
  totalRecipients: number;
  completedRecipients: number;
  failedRecipients?: number;
  walletAddress?: string;
  walletPrivateKeyBase64?: string;
  contractAddress?: string;
  contractDeployedAt?: string;
  batchSize?: number;
  sendInterval?: number;
  gasUsed: number;
  gasCostUsd: number;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}
```

**示例**:
```typescript
const campaign = await window.electronAPI.campaign.create({
  name: "2024年1月空投活动",
  description: "新用户奖励发放",
  chain: "137", // Polygon
  tokenAddress: "0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063",
  tokenSymbol: "USDT",
  tokenDecimals: 6,
  recipients: [
    { address: "0x742d35Cc6634C0532925a3b8D4C9db96C4b4Db45", amount: "100" }
  ]
});
```

### 获取活动列表

**接口**: `campaign:list`

**描述**: 获取活动列表，支持筛选

**参数**:
```typescript
interface CampaignFilters {
  status?: string;     // 活动状态筛选
  chain?: string;      // 区块链筛选
  limit?: number;      // 返回数量限制
  offset?: number;     // 偏移量
}
```

**返回值**: `Campaign[]`

### 获取活动详情

**接口**: `campaign:getById`

**参数**: `id: string` - 活动ID

**返回值**: `Campaign | null`

### 开始活动

**接口**: `campaign:start`

**参数**: `id: string` - 活动ID

**返回值**: `{ success: boolean }`

### 暂停活动

**接口**: `campaign:pause`

**参数**: `id: string` - 活动ID

**返回值**: `{ success: boolean }`

### 恢复活动

**接口**: `campaign:resume`

**参数**: `id: string` - 活动ID

**返回值**: `{ success: boolean }`

### 获取活动详细信息（含统计）

**接口**: `campaign:getDetails`

**参数**: `id: string` - 活动ID

**返回值**:
```typescript
{
  campaign: Campaign;
  stats: {
    totalRecipients: number;
    completedRecipients: number;
    failedRecipients: number;
    pendingRecipients: number;
    successRate: number;
    totalGasUsed: number;
    totalGasCost: number;
  };
} | null
```

### 获取活动交易记录

**接口**: `campaign:getTransactions`

**参数**:
```typescript
{
  id: string;              // 活动ID
  options?: {
    limit?: number;       // 限制数量
    offset?: number;      // 偏移量
  };
}
```

**返回值**:
```typescript
Array<{
  id: number;
  txHash: string;
  txType: 'DEPLOY_CONTRACT' | 'TRANSFER_TO_CONTRACT' | 'APPROVE_TOKENS' | 'BATCH_SEND' | 'WITHDRAW_REMAINING';
  fromAddress: string;
  toAddress?: string;
  amount?: string;
  gasUsed?: number;
  gasPrice?: string;
  gasCost?: number;
  status: 'PENDING' | 'CONFIRMED' | 'FAILED';
  blockNumber?: number;
  blockHash?: string;
  recipientCount?: number;
  createdAt: string;
  confirmedAt?: string;
}>
```

### 获取活动收款人列表

**接口**: `campaign:getRecipients`

**参数**: `id: string` - 活动ID

**返回值**:
```typescript
Array<{
  id: number;
  address: string;
  amount: string;
  status: 'PENDING' | 'SENT' | 'FAILED';
  txHash?: string;
  gasUsed?: number;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}>
```

### 重试失败的交易

**接口**: `campaign:retryFailedTransactions`

**参数**: `id: string` - 活动ID

**返回值**: `{ success: boolean, message: string }`

### 估算活动成本

**接口**: `campaign:estimate`

**参数**: 估算请求数据

**返回值**: 估算结果

### 部署合约

**接口**: `campaign:deployContract`

**参数**: `campaignId: string` - 活动ID

**返回值**:
```typescript
{
  success: boolean;
  contractAddress: string;
  transactionHash: string;
  gasUsed: string;
}
```

### 回收剩余代币

**接口**: `campaign:withdrawTokens`

**参数**:
```typescript
{
  campaignId: string;      // 活动ID
  recipientAddress: string; // 接收地址
}
```

**返回值**: 提取交易结果

### 回收剩余原生代币

**接口**: `campaign:withdrawNative`

**参数**:
```typescript
{
  campaignId: string;      // 活动ID
  recipientAddress: string; // 接收地址
}
```

**返回值**: 提取交易结果

---

## 💰 钱包 (Wallet) API

### 创建钱包

**接口**: `wallet:create`

**参数**: `type: 'evm' | 'solana'` - 钱包类型（默认: 'evm'）

**返回值**:
```typescript
{
  address: string;           // 钱包地址
  privateKey: string;        // 私钥
  privateKeyBase64: string;  // Base64编码私钥
}
```

### 获取钱包余额

**接口**: `wallet:getBalance`

**参数**:
```typescript
{
  address: string;          // 钱包地址
  chain: string;           // 区块链网络
  tokenAddress?: string;   // 代币地址（可选，查询原生代币余额时省略）
  tokenDecimals?: number;   // 代币小数位数
}
```

**返回值**: 余额信息

### 获取活动钱包列表

**接口**: `wallet:list`

**参数**: 查询选项

**返回值**: 钱包列表

### 获取钱包余额

**接口**: `wallet:getBalances`

**参数**: `campaignId: string` - 活动ID

**返回值**: 余额信息

### 批量刷新钱包余额

**接口**: `wallet:refreshBalances`

**参数**: `campaignIds: string[]` - 活动ID数组

**返回值**: 刷新结果

---

## ⛓️ 链管理 (Chain) API

### 获取EVM链列表

**接口**: `chain:getEVMChains`

**返回值**: EVM链配置列表

### 添加EVM链

**接口**: `chain:addEVMChain`

**参数**: 链配置数据

**返回值**: 新增链的ID

### 更新EVM链

**接口**: `chain:updateEVMChain`

**参数**:
```typescript
{
  chainId: number;  // 链ID
  updates: any;     // 更新数据
}
```

### 删除EVM链

**接口**: `chain:deleteEVMChain`

**参数**: `chainId: number` - 链ID

### 测试EVM链延迟

**接口**: `chain:testEVMLatency`

**参数**: `rpcUrl: string` - RPC URL

**返回值**: 延迟测试结果

### 获取Solana RPC列表

**接口**: `chain:getSolanaRPCs`

**参数**:
```typescript
{
  network: string;     // 网络类型
  onlyEnabled?: boolean; // 仅获取启用的RPC
}
```

**返回值**: Solana RPC配置列表

### 添加Solana RPC

**接口**: `chain:addSolanaRPC`

**参数**: RPC配置数据

**返回值**: 新增RPC的ID

### 测试Solana RPC

**接口**: `chain:testSolanaRPC`

**参数**: `rpcUrl: string` - RPC URL

**返回值**: 测试结果

### 更新Solana RPC优先级

**接口**: `chain:updateSolanaRPCPriority`

**参数**:
```typescript
{
  id: number;        // RPC ID
  priority: number;  // 优先级
}
```

### 删除Solana RPC

**接口**: `chain:deleteSolanaRPC`

**参数**: `id: number` - RPC ID

### 健康检查Solana RPCs

**接口**: `chain:healthCheckSolanaRPCs`

**返回值**: 健康检查结果

---

## 🌐 Solana 专用 API

### 获取Solana余额

**接口**: `solana:getBalance`

**参数**:
```typescript
{
  rpcUrl: string;         // RPC URL
  walletAddress: string;  // 钱包地址
  tokenAddress?: string;  // SPL代币地址（可选）
}
```

**返回值**: `{ success: boolean, balance: string }`

### Solana批量转账

**接口**: `solana:batchTransfer`

**参数**:
```typescript
{
  rpcUrl: string;                    // RPC URL
  privateKeyBase64: string;         // Base64编码私钥
  recipients: string[];              // 收款人地址数组
  amounts: string[];                 // 对应金额数组
  tokenAddress?: string;            // SPL代币地址（可选）
}
```

**返回值**: `{ success: boolean, data: any }`

### 获取Solana交易状态

**接口**: `solana:getTransactionStatus`

**参数**:
```typescript
{
  rpcUrl: string;        // RPC URL
  transactionHash: string; // 交易哈希
}
```

**返回值**: `{ success: boolean, data: any }`

### 获取Solana代币信息

**接口**: `solana:getTokenInfo`

**参数**:
```typescript
{
  rpcUrl: string;      // RPC URL
  tokenAddress: string; // 代币地址
}
```

**返回值**: `{ success: boolean, data: any }`

---

## 📄 文件操作 (File) API

### 读取CSV文件

**接口**: `file:readCSV`

**参数**: `filePath: string` - 文件路径

**返回值**: CSV解析后的数据

### 导出报告

**接口**: `file:exportReport`

**参数**: `campaignId: string` - 活动ID

**返回值**: 导出结果

---

## 💰 价格 (Price) API

### 获取单个价格

**接口**: `price:getPrice`

**参数**: `symbol: string` - 代币符号

**返回值**: `{ symbol: string, price: number }`

### 获取多个价格

**接口**: `price:getPrices`

**参数**: `symbols: string[]` - 代币符号数组

**返回值**: 价格映射对象

### 获取缓存价格

**接口**: `price:getCachedPrices`

**参数**: `symbols: string[]` - 代币符号数组

**返回值**: 缓存价格映射

### 获取价格汇总

**接口**: `price:getSummary`

**返回值**: 价格汇总信息

---

## 🔗 区块链 (Blockchain) API

### 估算Gas费用

**接口**: `blockchain:estimateGas`

**参数**:
```typescript
{
  chain: string;           // 区块链
  fromAddress: string;     // 发送地址
  toAddress?: string;      // 接收地址
  tokenAddress?: string;   // 代币地址
  recipientCount: number;   // 收款人数量
}
```

**返回值**: Gas估算结果

### 获取交易状态

**接口**: `blockchain:getTransactionStatus`

**参数**:
```typescript
{
  txHash: string;    // 交易哈希
  chain: string;     // 区块链
}
```

**返回值**: 交易状态信息

---

## 🪙 代币 (Token) API

### 获取代币信息

**接口**: `token:getInfo`

**参数**:
```typescript
{
  tokenAddress: string;  // 代币地址
  chainId: string;      // 链ID
}
```

**返回值**: 代币详细信息

### 验证代币地址

**接口**: `token:validateAddress`

**参数**:
```typescript
{
  tokenAddress: string;  // 代币地址
  chainId: string;      // 链ID
}
```

**返回值**: 验证结果

### 获取多个代币信息

**接口**: `token:getMultipleInfo`

**参数**:
```typescript
{
  tokenAddresses: string[]; // 代币地址数组
  chainId: string;         // 链ID
}
```

**返回值**: 代币信息数组

---

## 🔄 错误处理

所有API调用都可能抛出错误，错误格式为：

```typescript
{
  message: string;  // 错误消息
  stack?: string;   // 错误堆栈（开发模式）
}
```

### 常见错误类型

1. **验证错误**: 输入参数格式不正确
2. **网络错误**: RPC连接失败或超时
3. **状态错误**: 操作在当前状态下不被允许
4. **权限错误**: 缺少必要的权限
5. **资源错误**: 资源不存在或已被删除

### 错误处理示例

```typescript
try {
  const campaign = await window.electronAPI.campaign.create(data);
  console.log('活动创建成功:', campaign.id);
} catch (error) {
  console.error('创建活动失败:', error.message);
  // 显示错误提示给用户
}
```

---

## 📊 数据类型

### CampaignStatus 活动状态

```typescript
type CampaignStatus =
  | 'CREATED'    // 已创建
  | 'FUNDED'     // 已充值
  | 'READY'      // 就绪（合约已部署）
  | 'SENDING'    // 发送中
  | 'PAUSED'     // 已暂停
  | 'COMPLETED'  // 已完成
  | 'FAILED';    // 失败
```

### TransactionType 交易类型

```typescript
type TransactionType =
  | 'DEPLOY_CONTRACT'       // 部署合约
  | 'TRANSFER_TO_CONTRACT'  // 转账到合约
  | 'APPROVE_TOKENS'        // 授权代币
  | 'BATCH_SEND'           // 批量发送
  | 'WITHDRAW_REMAINING';  // 提取剩余资金
```

### TransactionStatus 交易状态

```typescript
type TransactionStatus =
  | 'PENDING'    // 待确认
  | 'CONFIRMED'  // 已确认
  | 'FAILED';    // 失败
```

### RecipientStatus 收款人状态

```typescript
type RecipientStatus =
  | 'PENDING'  // 待发送
  | 'SENT'     // 已发送
  | 'FAILED';  // 失败
```

---

## 🔧 使用最佳实践

### 1. 错误处理

- 始终使用 try-catch 包装API调用
- 向用户显示友好的错误消息
- 记录详细的错误日志用于调试

### 2. 状态管理

- 在关键操作后刷新相关数据
- 使用轮询获取长时间运行操作的状态
- 合理设置超时时间

### 3. 性能优化

- 批量操作使用专门的API
- 合理设置分页参数
- 避免频繁的小数据请求

### 4. 数据验证

- 在发送前验证所有输入参数
- 检查必需字段的存在
- 验证地址和金额格式

---

## 📋 版本历史

### v1.0.0 (2024-12-XX)

- 初始版本
- 包含所有核心功能的API
- 支持EVM和Solana链
- 完整的活动管理API
- 钱包和余额管理
- 链配置管理
- 文件操作API

---

**文档维护**: 开发团队
**最后审核**: [日期]
**下次更新**: 根据API变更更新