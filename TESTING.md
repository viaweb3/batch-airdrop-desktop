# CryptoCast Desktop 测试指南

本文档为 CryptoCast Desktop 应用的测试提供了全面的指导方针和策略。

> **注意**: 本项目已配置了完整的测试框架，但部分测试目录和用例可能需要根据本指南创建。如果 `src/__tests__/` 目录不存在，请在编写第一个测试时手动创建它。

## 1. 测试策略概览

我们的测试策略遵循测试金字塔模型，包含多个层次：

1.  **单元测试 (Unit Tests)**: 专注于测试单个服务、函数或模块的逻辑。
2.  **组件测试 (Component Tests)**: 专注于测试 React 组件的渲染和交互。
3.  **集成测试 (Integration Tests)**: 验证多个模块（例如服务与数据库）协同工作的正确性。
4.  **端到端测试 (E2E Tests)**: 使用 Playwright 模拟真实用户操作，测试完整的业务流程。
5.  **Testnet 测试**: 在真实的区块链测试网络（如 Sepolia）上验证交易和合约交互。

## 2. 测试命令

`package.json` 中定义了以下脚本来运行不同类型的测试：

```bash
# 运行所有 Jest 测试 (单元、组件、集成)
npm test

# 在观察模式下运行 Jest 测试
npm run test:watch

# 生成测试覆盖率报告
npm run test:coverage

# 仅运行单元测试
npm run test:unit

# 仅运行组件测试
npm run test:component

# 仅运行集成测试
npm run test:integration

# 运行 E2E 测试 (需要先设置)
npm run test:e2e

# 在 Testnet 上运行测试 (需要配置)
npm run test:testnet
```

## 3. 测试分类与目录结构

所有测试代码都应放置在 `src/__tests__/` 目录下，并按以下结构组织：

### 3.1. 单元测试 (`src/__tests__/services/`)

-   **目标**: 测试主进程中的单个服务或工具函数。
-   **位置**: `src/__tests__/services/`
-   **示例**: 测试 `CampaignService` 的活动创建逻辑，`GasService` 的费用估算等。
-   **命令**: `npm run test:unit`

### 3.2. 组件测试 (`src/__tests__/components/`)

-   **目标**: 使用 React Testing Library 测试前端组件的渲染和行为。Electron 和后端 API 应被 mock。
-   **位置**: `src/__tests__/components/`
-   **命令**: `npm run test:component`

### 3.3. 集成测试 (`src/__tests__/integration/`)

-   **目标**: 测试多个后端服务之间的交互，例如，验证 `CampaignService` 调用 `WalletService` 和数据库操作的完整流程。
-   **位置**: `src/__tests__/integration/`
-   **命令**: `npm run test:integration`

### 3.4. E2E 测试 (`src/__tests__/e2e/`)

-   **目标**: 使用 Playwright 模拟用户从头到尾的操作，例如完整地创建并执行一个空投活动。
-   **位置**: `src/__tests__/e2e/`
-   **设置与运行**:
    ```bash
    # 首次运行时需要安装 Playwright 依赖的浏览器
    npm run test:e2e:install

    # 运行所有 E2E 测试
    npm run test:e2e

    # 打开 Playwright UI 模式以进行交互式调试
    npm run test:e2e:ui

    # 启动代码生成器来录制新的测试用例
    npm run test:e2e:codegen
    ```

### 3.5. Testnet 测试 (`src/__tests__/testnet/`)

-   **目标**: 在真实的测试网络上执行交易，以验证与区块链的交互是否正确。
-   **位置**: `src/__tests__/testnet/`
-   **设置**:
    1.  从 faucet 获取测试币（例如，[Sepolia Faucet](https://sepoliafaucet.com/))。
    2.  在测试文件中配置一个拥有测试币的钱包私钥（**切勿使用主网私钥**）。
-   **命令**: `npm run test:testnet`

## 4. Mocking 策略

-   **Electron API Mocking**: 在组件测试和集成测试中，前端对 `window.electronAPI` 的调用应被完全 mock，以将前端与主进程解耦。
-   **区块链交互 Mocking**: 在单元测试中，应使用 `jest.mock` 来 mock `ethers.js` 或 `@solana/web3.js`，避免在测试中发出真实的网络请求。

```typescript
// 示例：在 Jest 中 mock ethers.js
jest.mock('ethers', () => ({
  ...jest.requireActual('ethers'), // 保留原始模块的其他部分
  JsonRpcProvider: jest.fn().mockImplementation(() => ({
    getBalance: jest.fn().mockResolvedValue(100n),
  })),
}));
```

## 5. 测试覆盖率

通过运行以下命令可以生成代码覆盖率报告：

```bash
npm run test:coverage
```

报告将生成在项目根目录的 `coverage/` 文件夹下。请在添加新功能时，务必为其编写测试，以维持或提高测试覆盖率。

## 6. 编写测试的最佳实践

1.  **遵循 AAA 模式**: Arrange (安排), Act (行动), Assert (断言)。
2.  **保持独立**: 每个测试用例都应独立，不依赖于其他测试的执行顺序或状态。
3.  **描述性命名**: 测试的描述应清晰地说明它在测试什么以及预期的结果。
4.  **Mock 外部依赖**: 在单元测试中，彻底 mock 所有外部依赖（如文件系统、网络请求、数据库）。
5.  **一个测试一个断言**: 尽量保证每个测试用例只验证一个具体的行为。

---

## 7. 相关资源

-   [Jest Documentation](https://jestjs.io/docs/)
-   [Playwright Documentation](https://playwright.dev/docs/intro)
-   [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/)