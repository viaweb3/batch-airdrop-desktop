# Smart Contract Compilation Guide

This directory contains the BatchAirdrop smart contract for executing batch token transfers.

## Prerequisites

1. Install Node.js (v16 or later)
2. Install Hardhat or Foundry for compilation

## Method 1: Using Hardhat

### Setup

```bash
npm install --save-dev hardhat @nomicfoundation/hardhat-toolbox
npx hardhat init
```

### Create hardhat.config.js

```javascript
require("@nomicfoundation/hardhat-toolbox");

module.exports = {
  solidity: {
    version: "0.8.18",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  }
};
```

### Compile

```bash
npx hardhat compile
```

The compiled bytecode will be in `artifacts/contracts/BatchAirdrop.sol/BatchAirdrop.json`

### Extract Bytecode

```bash
node -e "console.log(require('./artifacts/contracts/BatchAirdrop.sol/BatchAirdrop.json').bytecode)"
```

## Method 2: Using Foundry

### Setup

```bash
# Install Foundry
curl -L https://foundry.paradigm.xyz | bash
foundryup

# Initialize project
forge init --force
```

### Compile

```bash
forge build
```

The compiled bytecode will be in `out/BatchAirdrop.sol/BatchAirdrop.json`

### Extract Bytecode

```bash
jq -r '.bytecode.object' out/BatchAirdrop.sol/BatchAirdrop.json
```

## Method 3: Using Remix IDE (Easiest)

1. Go to https://remix.ethereum.org
2. Create a new file `BatchAirdrop.sol`
3. Paste the contract code
4. Click "Compile BatchAirdrop.sol"
5. Click on "Compilation Details"
6. Copy the "Bytecode" value

## Updating ContractService

After compiling, update the bytecode in `src/main/services/ContractService.ts`:

```typescript
// Line ~240
const BATCH_AIRDROP_BYTECODE = '0x608060...'; // Replace with your compiled bytecode
```

## Contract ABI

The contract ABI is:

```json
[
  "function batchTransfer(address token, address[] recipients, uint256[] amounts) external",
  "function getStatistics() external view returns (uint256 totalDistributed, uint256 totalRecipients)",
  "function emergencyWithdraw(address token) external",
  "function transferOwnership(address newOwner) external"
]
```

## Testing on Testnet

Before deploying to mainnet, test on:
- Ethereum: Sepolia or Goerli
- BSC: BSC Testnet
- Polygon: Mumbai

Get testnet ETH/BNB/MATIC from faucets:
- Sepolia: https://sepoliafaucet.com/
- BSC Testnet: https://testnet.binance.org/faucet-smart
- Mumbai: https://faucet.polygon.technology/

## Security Considerations

1. ✅ No reentrancy vulnerabilities (no external calls before state updates)
2. ✅ Input validation (array length checks)
3. ✅ Gas optimization (batch size limit of 200)
4. ✅ Event emission for monitoring
5. ✅ Error handling for failed transfers
6. ⚠️ Requires ERC20 token approval before use

## Deployment

The application will deploy this contract automatically when creating a campaign. The deployment process:

1. User creates campaign
2. App generates deployment wallet
3. App compiles transaction with contract bytecode
4. App broadcasts deployment transaction
5. App stores contract address in database

## Estimated Gas Costs

- Contract deployment: ~500,000 gas (~$10-50 depending on gas price)
- Batch transfer (50 recipients): ~300,000 gas (~$6-30)
- Batch transfer (100 recipients): ~550,000 gas (~$11-55)

## License

MIT License - See contract header for details
