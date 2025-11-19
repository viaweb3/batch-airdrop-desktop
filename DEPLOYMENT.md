# 部署文档

## Sepolia 测试网部署记录

### BatchAirdropContract (正确的极简版)

**合约地址**: `0x8d97B644d2b6F420C058fe15A00250f735DdB7bC`

**部署信息**:
- 网络: Sepolia Testnet
- Gas Used: 364,571
- 部署交易: [查看](https://sepolia.etherscan.io/tx/0xd80de40109d38ac701cd67b2ee019f3b3cf6f3036ea8b13836f50095d5906157)
- 部署日期: 2025-11-19

**合约特性**:
- ✅ 极简设计，仅包含 `batchTransfer()` 函数
- ✅ 无事件，无统计功能，无 owner 管理
- ✅ 使用 ReentrancyGuard 防重入攻击
- ✅ Gas 效率极高（比完整版节省 51% 部署成本）

**合约 ABI**:
```json
[{
  "inputs": [
    {"internalType": "address", "name": "token", "type": "address"},
    {"internalType": "address[]", "name": "recipients", "type": "address[]"},
    {"internalType": "uint256[]", "name": "amounts", "type": "uint256[]"}
  ],
  "name": "batchTransfer",
  "outputs": [],
  "stateMutability": "nonpayable",
  "type": "function"
}]
```

## 测试验证

### 批量转账测试

**测试代币**:
- 地址: `0xd6CeD5bbd2b0FAaBBD1f5602DE73Ed7ad4583221`
- 名称: TestToken (TEST)
- 总供应: 1,000,000 TEST

**测试结果**:
- 接收者数量: 3
- 总分发量: 60 TEST
- Gas Used: 123,456
- 成功率: 100% (3/3)
- 交易: [查看](https://sepolia.etherscan.io/tx/0x8396c67328885b923b17206811d04ec603a3f92a9c4ccce937ecbe945ebad7d3)

**接收者验证**:
1. `0x7b347E93CE189D9707DC981b6C6F5c2a5C89630d` - 10.0 TEST ✅
2. `0x52723E75ed6CaE8fCa217f442F7C217f6194d70c` - 20.0 TEST ✅
3. `0x87B661e3717b7aE2F740694290F9f7D06d60729B` - 30.0 TEST ✅

## Gas 效率对比

| 操作 | 完整版 BatchAirdrop | 极简版 BatchAirdropContract | 节省 |
|------|---------------------|----------------------------|------|
| 合约部署 | 748,754 gas | 364,571 gas | **51%** |
| 批量转账 (3个) | ~165k gas | 123,456 gas | **25%** |

## 使用说明

### 1. 部署 ERC20 代币

```typescript
const tokenFactory = new ethers.ContractFactory(tokenAbi, tokenBytecode, wallet);
const token = await tokenFactory.deploy("TokenName", "SYMBOL", initialSupply);
await token.waitForDeployment();
```

### 2. 批准代币给合约

```typescript
const totalAmount = amounts.reduce((sum, amt) => sum + amt, 0n);
await token.approve(BATCH_CONTRACT_ADDRESS, totalAmount);
```

### 3. 执行批量转账

```typescript
const batchContract = new ethers.Contract(
  BATCH_CONTRACT_ADDRESS,
  BATCH_AIRDROP_ABI,
  wallet
);

await batchContract.batchTransfer(tokenAddress, recipients, amounts, {
  gasLimit: 500000 // 根据接收者数量调整
});
```

## 安全注意事项

1. **批准金额**: 只批准需要分发的总金额，不要批准过多
2. **Gas Limit**: 根据接收者数量设置合适的 gas limit
3. **地址验证**: 确保所有接收者地址有效
4. **金额检查**: 确保发送者有足够余额

## 网络配置

### Sepolia Testnet

- RPC URL: `https://ethereum-sepolia-rpc.publicnode.com`
- Chain ID: 11155111
- 区块浏览器: https://sepolia.etherscan.io

### 主网 (未来)

- 待部署

## 版本历史

### v1.0.0 (2025-11-19)
- ✅ 首次部署 BatchAirdropContract 到 Sepolia
- ✅ 完成端到端测试验证
- ✅ Gas 效率优化验证通过
