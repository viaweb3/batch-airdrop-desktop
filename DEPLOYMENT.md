# CryptoCast 部署文档

**文档版本**: v1.2.0
**最后更新**: 2025-11-27
**状态**: 生产就绪

---

## 📋 概述

CryptoCast 是一个基于 Electron 的桌面应用，支持 EVM 兼容链和 Solana 的批量代币分发。本文档详细记录了智能合约部署、应用构建和发布的完整流程。

---

## 🏗️ 智能合约部署

### 合约架构

CryptoCast 使用优化的批量转账智能合约来降低 Gas 费用：

- **EVM 链**: BatchAirdropContract - 极简版批量转账合约
- **Solana**: 直接转账，无需合约部署

### 部署记录

#### Sepolia 测试网

**BatchAirdropContract**:
- **合约地址**: `0x8d97B644d2b6F420C058fe15A00250f735DdB7bC`
- **网络**: Sepolia Testnet
- **部署交易**: [0xd80de401...](https://sepolia.etherscan.io/tx/0xd80de40109d38ac701cd67b2ee019f3b3cf6f3036ea8b13836f50095d5906157)
- **Gas Used**: 364,571
- **部署日期**: 2024-11-19

**合约特性**:
- ✅ 极简设计，仅包含 `batchTransfer()` 函数
- ✅ 使用 ReentrancyGuard 防重入攻击
- ✅ Gas 效率极高（比完整版节省 51% 部署成本）

#### 主网部署 (计划中)

- **Ethereum Mainnet**: 计划部署
- **Polygon Mainnet**: 计划部署
- **BSC Mainnet**: 计划部署

### 合约 ABI

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

---

## 💻 应用构建

### 系统要求

**开发环境**:
- Node.js 24+
- npm 10+
- Git 2.30+

**平台支持**:
- Windows 10+ (x64)
- macOS 10.15+ (Intel x64)
- macOS 11+ (Apple Silicon arm64)

### 构建步骤

#### 1. 环境准备

```bash
# 克隆代码库
git clone https://github.com/viaweb3/cryptocast-desktop.git
cd cryptocast-desktop

# 安装依赖
npm install

# 构建智能合约 (如果需要)
cd contracts
forge build
cd ..
```

#### 2. 开发模式

```bash
# 启动开发服务器
npm run dev

# 这将启动:
# - Vite 开发服务器 (http://localhost:5173)
# - Electron 主进程
```

#### 3. 生产构建

```bash
# 使用 CI 构建脚本 (推荐)
npm run build:ci

# 或使用标准构建
npm run build

# 构建特定平台
npm run build:win          # Windows x64
npm run build:mac-intel    # macOS Intel (x64)
npm run build:mac-arm      # macOS Apple Silicon (arm64)
```

#### 4. 构建产物

构建完成后，可执行文件将位于 `release/` 目录：

**Windows**:
- `CryptoCast Setup 1.2.0.exe` - NSIS 安装程序

**macOS (Intel)**:
- `CryptoCast-1.2.0-x64.dmg` 或 `CryptoCast-1.2.0-mac.dmg` - 磁盘映像

**macOS (Apple Silicon)**:
- `CryptoCast-1.2.0-arm64.dmg` - 磁盘映像

---

## 🚀 CI/CD 部署

### GitHub Actions 工作流

项目使用 GitHub Actions 进行自动化构建和发布：

#### 工作流触发条件

- **推送**: `main`, `develop` 分支
- **标签**: `v*` 版本标签
- **Pull Request**: 针对 `main` 分支

#### 构建矩阵

| 平台 | 架构 | 构建脚本 |
|------|------|----------|
| windows-latest | x64 | `build:win` |
| macos-latest | x64 | `build:mac-intel` |
| macos-latest | arm64 | `build:mac-arm` |

#### 构建步骤

1. **环境准备**
   - Node.js 24 安装
   - Python 3.x (用于 node-gyp)
   - 系统依赖安装

2. **依赖安装**
   - `npm ci` - 快速安装
   - 重建原生模块

3. **构建执行**
   - TypeScript 编译
   - Vite 构建
   - Electron Builder 打包

4. **产物上传**
   - GitHub Artifacts (30 天保留)
   - GitHub Releases (永久)

### 代码签名配置

#### macOS 代码签名

**必需的 GitHub Secrets**:
- `CSC_LINK_MAC`: macOS 开发者证书 (.p12)
- `CSC_KEY_PASSWORD_MAC`: 证书密码
- `APPLE_ID`: Apple ID 邮箱
- `APPLE_ID_PASSWORD`: 应用专用密码
- `APPLE_TEAM_ID`: Apple Team ID

**签名流程**:
- 应用签名
- 公证 (Notarization)
- 生成 DMG 和 ZIP

#### Windows 代码签名

**必需的 GitHub Secrets**:
- `CSC_LINK_WIN`: Windows 代码签名证书
- `CSC_KEY_PASSWORD_WIN`: 证书密码

**签名流程**:
- 生成安装程序
- 代码签名
- 创建便携版

---

## 🔧 配置管理

### 应用配置

#### Electron Builder 配置

`electron-builder.json`:
```json
{
  "appId": "com.cryptocast.desktop",
  "productName": "CryptoCast",
  "directories": {
    "output": "release",
    "buildResources": "assets"
  },
  "files": [
    "dist/**/*",
    "package.json",
    "assets/**/*",
    "node_modules/**/*"
  ],
  "npmRebuild": true,
  "buildDependenciesFromSource": false,
  "mac": {
    "category": "public.app-category.finance",
    "icon": "assets/icon.icns",
    "hardenedRuntime": true,
    "target": [
      {
        "target": "dmg",
        "arch": ["x64", "arm64"]
      },
      {
        "target": "zip",
        "arch": ["x64", "arm64"]
      }
    ]
  },
  "win": {
    "icon": "assets/icon.ico",
    "target": [
      {
        "target": "nsis",
        "arch": ["x64"]
      },
      {
        "target": "portable",
        "arch": ["x64"]
      }
    ]
  },
  "linux": {
    "icon": "assets/icon.png",
    "category": "Office",
    "target": [
      {
        "target": "AppImage",
        "arch": ["x64"]
      },
      {
        "target": "deb",
        "arch": ["x64"]
      }
    ]
  }
}
```

#### 网络配置

应用支持以下网络配置：

**EVM 网络**:
- Ethereum Mainnet, Sepolia Testnet
- Polygon Mainnet, Mumbai Testnet
- BSC Mainnet, BSC Testnet
- Arbitrum One, Goerli Testnet
- 自定义 EVM 网络支持

**Solana 网络**:
- Mainnet-beta
- Devnet
- Testnet
- 自定义 RPC 节点

### 环境变量

开发环境变量 (`.env`):
```env
# 开发模式
NODE_ENV=development

# 区块链 RPC
ETHEREUM_RPC_URL=https://mainnet.infura.io/v3/YOUR_PROJECT_ID
POLYGON_RPC_URL=https://polygon-mainnet.infura.io/v3/YOUR_PROJECT_ID
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com

# API Keys (可选)
COINGECKO_API_KEY=your_coingecko_api_key
```

---

## 📊 测试与验证

### 智能合约测试

#### Sepolia 测试网验证

**批量转账测试**:
- **测试代币**: `0xd6CeD5bbd2b0FAaBBD1f5602DE73Ed7ad4583221`
- **接收者数量**: 3
- **总分发量**: 60 TEST
- **Gas Used**: 123,456
- **成功率**: 100% (3/3)
- **交易**: [0x8396c673...](https://sepolia.etherscan.io/tx/0x8396c67328885b923b17206811d04ec603a3f92a9c4ccce937ecbe945ebad7d3)

**Gas 效率对比**:

| 操作 | 完整版 | 极简版 | 节省 |
|------|--------|--------|------|
| 合约部署 | 748,754 gas | 364,571 gas | **51%** |
| 批量转账 (3个) | ~165k gas | 123,456 gas | **25%** |

### 应用测试

#### 单元测试

```bash
# 运行所有测试
npm test

# 运行覆盖率测试
npm run test:coverage

# 运行组件测试
npm run test:component
```

#### 端到端测试

```bash
# 运行 E2E 测试
npm run test:e2e

# 运行 E2E UI 模式
npm run test:e2e:ui

# 安装 Playwright 浏览器
npm run test:e2e:install
```

#### 性能测试

- **应用启动时间**: < 5 秒
- **内存使用**: < 500MB (正常使用)
- **批量处理**: 5000 地址 < 30 分钟
- **界面响应**: < 200ms

---

## 🔒 安全配置

### 私钥管理

应用使用 AES-256-GCM 算法加密存储私钥：

```typescript
// 加密示例
const encryptedPrivateKey = encryptionService.encryptPrivateKey(privateKey);

// 存储位置
const config = {
  windows: '%APPDATA%\\cryptocast-desktop\\',
  macOS: '~/Library/Application Support/cryptocast-desktop/',
  linux: '~/.config/cryptocast-desktop/'
};
```

### 安全最佳实践

1. **私钥保护**
   - 内存中使用后立即清除
   - 文件权限设置为 600
   - 主密钥独立存储

2. **网络安全**
   - 所有 RPC 调用使用 HTTPS
   - 证书验证
   - 超时控制

3. **输入验证**
   - 地址格式验证
   - 金额范围检查
   - 重复检测

### 审计日志

应用记录以下关键操作：
- 钱包创建和导入
- 活动创建和执行
- 交易发送和确认
- 错误和异常

---

## 📈 监控与维护

### 应用监控

#### 性能指标

- **CPU 使用率**: < 5% (空闲)
- **内存使用**: < 500MB
- **磁盘 I/O**: 正常读写
- **网络延迟**: < 1 秒

#### 错误监控

- 应用崩溃报告
- 交易失败统计
- RPC 连接问题
- 用户操作异常

### 日志管理

#### 日志级别

```typescript
enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error'
}
```

#### 日志存储

- **位置**: 应用数据目录 `/logs/`
- **格式**: JSON 结构化日志
- **轮转**: 按大小和时间轮转
- **保留**: 最近 30 天

### 数据备份

#### 自动备份

- **频率**: 每日自动备份
- **内容**: 数据库、配置文件
- **压缩**: ZIP 压缩存储
- **保留**: 最近 7 份备份

#### 手动备份

用户可手动导出：
- 活动数据 (JSON/CSV)
- 钱包信息 (加密)
- 交易历史 (PDF)

---

## 🚨 故障排除

### 常见问题

#### 1. 应用启动失败

**原因**: 依赖缺失或版本不匹配
**解决**:
```bash
# 重新安装依赖
rm -rf node_modules package-lock.json
npm install

# 重建原生模块
npm rebuild
```

#### 2. 合约部署失败

**原因**: Gas 不足或网络问题
**解决**:
- 检查钱包余额
- 增加 Gas limit
- 切换 RPC 节点
- 检查网络连接

#### 3. 批量转账失败

**原因**: 合约未授权或余额不足
**解决**:
```typescript
// 检查授权
const allowance = await token.allowance(wallet.address, contractAddress);
if (allowance < totalAmount) {
  // 增加授权
  await token.approve(contractAddress, totalAmount);
}

// 检查余额
const balance = await token.balanceOf(wallet.address);
if (balance < totalAmount) {
  // 充值代币
}
```

#### 4. 网络连接问题

**原因**: RPC 节点故障或网络限制
**解决**:
- 切换备用 RPC
- 检查网络设置
- 配置代理 (如需要)
- 使用本地节点

### 调试模式

#### 开发调试

```bash
# 启用调试日志
DEBUG=cryptocast:* npm run dev

# 开发者工具
# 在应用中按 F12 打开开发者工具
```

#### 生产调试

```bash
# 查看应用日志
# Windows: %APPDATA%\cryptocast-desktop\logs\
# macOS: ~/Library/Logs/cryptocast-desktop/
# Linux: ~/.config/cryptocast-desktop/logs/
```

---

## 📋 版本历史

### v1.0.0 (2024-12-XX)

**功能**:
- ✅ EVM 链批量发送
- ✅ Solana 批量发送
- ✅ 活动管理
- ✅ 钱包管理
- ✅ 报告导出

**技术**:
- ✅ Electron 39.2.2
- ✅ React 19.2.0
- ✅ TypeScript 5.7.3
- ✅ SQLite 数据库

**平台**:
- ✅ Windows (x64)
- ✅ macOS (Intel + Apple Silicon)
- ✅ Linux (x64)

**安全**:
- ✅ AES-256-GCM 私钥加密
- ✅ 本地数据存储
- ✅ 代码签名支持

### 未来版本

#### v1.1.0 (计划中)
- 更多 EVM 链支持
- 高级报告功能
- 性能优化

#### v2.0.0 (计划中)
- 多用户支持
- API 接口
- 插件系统

---

## 📞 支持与维护

### 技术支持

- **GitHub Issues**: [提交问题](https://github.com/your-username/cryptocast-desktop/issues)
- **文档**: [在线文档](https://docs.cryptocast.app)
- **社区**: [Discord 社区](https://discord.gg/cryptocast)

### 维护团队

- **项目负责人**: [姓名] - [邮箱]
- **技术负责人**: [姓名] - [邮箱]
- **安全负责人**: [姓名] - [邮箱]

### 许可证

- **开源许可**: MIT License
- **第三方许可**: 详见 dependencies

---

**最后更新**: 2024-12-XX
**文档维护**: 开发团队
**下次审核**: 2025-03-XX
