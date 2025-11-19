# 批量发奖工具 - Electron 桌面应用

> 支持 EVM 和 Solana 的区块链批量奖励分发桌面应用

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey.svg)

---

## 📖 项目简介

这是一个基于 Electron 的跨平台桌面应用,专为营销活动批量发放代币奖励而设计。

### 核心特性

- ✅ **多链支持**: 支持所有EVM兼容链 + Solana
- ✅ **批量发送**: 单次处理 500-5000 个地址
- ✅ **隐私优先**: 每次活动使用独立钱包和合约
- ✅ **本地运行**: 数据和私钥本地存储,无需云服务器
- ✅ **零成本**: 无服务器费用,仅RPC调用成本
- ✅ **跨平台**: Windows、macOS、Linux 一键安装

---

## 📚 文档导航

### 核心文档
1. **[需求规格文档](./REQUIREMENTS.md)** - 详细的业务需求和功能规格
2. **[技术架构文档](./ARCHITECTURE_ELECTRON.md)** - Electron 应用的技术架构设计
3. **[技术挑战与解决方案](./CHALLENGES.md)** - 6大核心挑战的深度分析
4. **[实施路线图](./ROADMAP_ELECTRON.md)** - 6周详细开发计划
5. **[产品形态对比](./PRODUCT_OPTIONS.md)** - 三种产品方案的对比分析
6. **[部署文档](./DEPLOYMENT.md)** - Sepolia 测试网部署记录与使用说明

### 推荐阅读顺序
1. 先阅读 `PRODUCT_OPTIONS.md` 了解为什么选择 Electron
2. 再阅读 `REQUIREMENTS.md` 理解业务需求
3. 然后看 `ARCHITECTURE_ELECTRON.md` 了解技术实现
4. 查看 `DEPLOYMENT.md` 了解合约部署信息
5. 最后按照 `ROADMAP_ELECTRON.md` 开始开发

---

## 🚀 快速开始

### 前置要求

- Node.js 18+
- npm 或 yarn
- Git

### 1. 克隆项目（未来）

```bash
git clone https://github.com/your-org/batch-airdrop-desktop.git
cd batch-airdrop-desktop
```

### 2. 安装依赖

```bash
npm install
```

### 3. 开发模式运行

```bash
npm run dev
```

这将启动:
- Vite 开发服务器（React UI）在 `http://localhost:5173`
- Electron 主进程

### 4. 构建应用

```bash
# 构建所有平台
npm run package

# 仅构建Windows
npm run package:win

# 仅构建macOS
npm run package:mac

# 仅构建Linux
npm run package:linux
```

构建产物在 `release/` 目录。

---

## 📁 项目结构

```
batch-airdrop-desktop/
├── src/
│   ├── main/                  # Electron 主进程（Node.js）
│   │   ├── index.ts           # 主入口
│   │   ├── preload.ts         # Preload 脚本
│   │   ├── database/          # SQLite 数据库
│   │   ├── services/          # 业务逻辑服务
│   │   ├── ipc/               # IPC 通信处理器
│   │   └── utils/             # 工具函数
│   │
│   └── renderer/              # Electron 渲染进程（React）
│       ├── src/
│       │   ├── App.tsx
│       │   ├── pages/         # 页面组件
│       │   ├── components/    # UI 组件
│       │   ├── hooks/         # 自定义 Hooks
│       │   └── types/         # TypeScript 类型
│       └── index.html
│
├── contracts/                 # 智能合约
│   └── src/
│       └── BatchAirdropContract.sol  # 极简版批量空投合约
│
├── assets/                    # 应用图标等资源
├── docs/                      # 文档
└── README.md
```

---

## 🛠️ 开发指南

### 技术栈

**前端**:
- React 18
- TypeScript
- TailwindCSS
- React Router

**后端（主进程）**:
- Node.js
- SQLite (better-sqlite3)
- ethers.js v6
- @solana/web3.js

**桌面框架**:
- Electron
- electron-builder

**智能合约**:
- Solidity
- Hardhat

### 核心服务

#### 1. 活动管理服务 (CampaignService)
负责活动的创建、查询、状态管理。

#### 2. 钱包管理服务 (WalletService)
处理钱包生成、私钥加密存储、签名操作。

#### 3. 合约服务 (ContractService)
智能合约的部署和调用。

#### 4. 发送调度服务 (DispatcherService)
批量发送任务的调度和执行。

### IPC 通信

主进程和渲染进程通过 IPC（Inter-Process Communication）通信：

```typescript
// 渲染进程调用
const campaign = await window.electronAPI.campaign.create(data);

// 主进程处理
ipcMain.handle('campaign:create', async (event, data) => {
  return await campaignService.create(data);
});
```

### 数据存储

数据存储在用户目录的 SQLite 数据库：

```
Windows: C:\Users\<username>\AppData\Roaming\batch-airdrop\airdrop.db
macOS:   ~/Library/Application Support/batch-airdrop/airdrop.db
Linux:   ~/.config/batch-airdrop/airdrop.db
```

---

## 🧪 测试

```bash
# 运行所有测试
npm test

# 智能合约测试
cd contracts && npx hardhat test

# E2E 测试
npm run test:e2e
```

---

## 📦 打包说明

### Windows

生成 NSIS 安装器和便携版：

```bash
npm run package:win
```

产物：
- `batch-airdrop-setup-1.0.0.exe` (安装器)
- `batch-airdrop-1.0.0-portable.exe` (便携版)

### macOS

生成 DMG 和 ZIP：

```bash
npm run package:mac
```

产物：
- `batch-airdrop-1.0.0.dmg`
- `batch-airdrop-1.0.0-mac.zip`

注意：macOS 需要代码签名和公证才能避免安全警告。

### Linux

生成 AppImage 和 deb 包：

```bash
npm run package:linux
```

产物：
- `batch-airdrop-1.0.0.AppImage`
- `batch-airdrop_1.0.0_amd64.deb`

---

## 🔒 安全性

### 私钥管理

- 主密钥存储在 `~/.config/batch-airdrop/.masterkey`
- 权限设置为 600（仅所有者可读写）
- 活动钱包私钥使用 AES-256-GCM 加密
- 内存中的私钥使用后立即清除

### 代码签名（可选）

为了避免操作系统的安全警告，建议进行代码签名：

**Windows**: 购买 Authenticode 证书
**macOS**: 加入 Apple Developer Program

---

## 💡 使用流程

### 1. 首次配置

1. 启动应用
2. 进入设置页面
3. 导入主钱包（用于资金转账）
4. 配置 RPC 节点（可选，使用默认节点）

### 2. 创建活动

1. 点击"新建活动"
2. 填写活动名称
3. 选择区块链（Polygon、Arbitrum等）
4. 输入代币合约地址
5. 上传地址列表（CSV格式）
6. 预览并确认

### 3. 启动发送

1. 系统自动：
   - 生成独立活动钱包
   - 从主钱包转入代币和Gas费
   - 部署批量发送合约
   - 转入代币到合约
2. 点击"开始发送"
3. 实时查看进度
4. 发送完成后收到桌面通知

### 4. 查看历史

- 所有活动记录保存在本地数据库
- 支持导出报告（CSV/PDF）
- 交易哈希可在区块链浏览器查看

---

## 🐛 故障排除

### 问题：无法启动应用

**解决**：
1. 确保 Node.js 版本 >= 18
2. 删除 `node_modules` 重新安装依赖
3. 检查防火墙是否阻止了应用

### 问题：数据库错误

**解决**：
1. 备份 `airdrop.db` 文件
2. 删除数据库文件重新创建
3. 从备份恢复（如果有）

### 问题：交易发送失败

**解决**：
1. 检查主钱包余额是否充足
2. 检查 RPC 节点是否正常
3. 查看错误日志 `~/batch-airdrop/logs/`

---

## 📝 开发计划

参见 [ROADMAP_ELECTRON.md](./ROADMAP_ELECTRON.md)

- ✅ Week 1: 项目搭建
- ⏳ Week 2: 核心功能
- ⏳ Week 3: 发送逻辑
- ⏳ Week 4: UI 完善
- ⏳ Week 5: 多链支持
- ⏳ Week 6: 打包发布

---

## 🤝 贡献指南

欢迎贡献代码！请遵循以下步骤：

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'Add amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 开启 Pull Request

---

## 📄 许可证

MIT License - 详见 [LICENSE](./LICENSE) 文件

---

## 📧 联系方式

- 项目主页: https://github.com/your-org/batch-airdrop-desktop
- 问题反馈: https://github.com/your-org/batch-airdrop-desktop/issues
- 电子邮件: your-email@example.com

---

## 🙏 致谢

- [Electron](https://www.electronjs.org/)
- [React](https://react.dev/)
- [ethers.js](https://docs.ethers.org/)
- [OpenZeppelin](https://www.openzeppelin.com/)

---

**注意**: 本项目仍在开发中,功能可能不完整或存在 Bug。请勿在生产环境使用未经充分测试的版本。

**免责声明**: 使用本工具进行代币发送时,请确保遵守相关法律法规。开发者不对使用本工具造成的任何损失负责。
