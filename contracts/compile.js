const fs = require('fs');
const path = require('path');
const solc = require('solc');

// Read the contract source code
const contractPath = path.join(__dirname, 'BatchAirdrop.sol');
const source = fs.readFileSync(contractPath, 'utf8');

// Prepare the input for the compiler
const input = {
  language: 'Solidity',
  sources: {
    'BatchAirdrop.sol': {
      content: source
    }
  },
  settings: {
    optimizer: {
      enabled: true,
      runs: 200
    },
    outputSelection: {
      '*': {
        '*': ['abi', 'evm.bytecode.object', 'evm.deployedBytecode.object']
      }
    }
  }
};

console.log('Compiling BatchAirdrop.sol...');

// Compile the contract
const output = JSON.parse(solc.compile(JSON.stringify(input)));

// Check for errors
if (output.errors) {
  const errors = output.errors.filter(err => err.severity === 'error');
  if (errors.length > 0) {
    console.error('Compilation errors:');
    errors.forEach(err => console.error(err.formattedMessage));
    process.exit(1);
  }

  // Show warnings
  const warnings = output.errors.filter(err => err.severity === 'warning');
  if (warnings.length > 0) {
    console.warn('Compilation warnings:');
    warnings.forEach(warn => console.warn(warn.formattedMessage));
  }
}

// Extract the compiled contract
const contract = output.contracts['BatchAirdrop.sol']['BatchAirdrop'];

if (!contract) {
  console.error('Contract not found in compilation output');
  process.exit(1);
}

const bytecode = '0x' + contract.evm.bytecode.object;
const abi = contract.abi;

console.log('\n✅ Compilation successful!');
console.log('\nBytecode length:', bytecode.length);
console.log('ABI methods:', abi.length);

// Save outputs
const outputDir = __dirname;
fs.writeFileSync(
  path.join(outputDir, 'BatchAirdrop.bytecode.txt'),
  bytecode
);

fs.writeFileSync(
  path.join(outputDir, 'BatchAirdrop.abi.json'),
  JSON.stringify(abi, null, 2)
);

console.log('\n📝 Files created:');
console.log('  - BatchAirdrop.bytecode.txt');
console.log('  - BatchAirdrop.abi.json');

// Output for updating ContractService
console.log('\n📋 To update ContractService.ts, use this bytecode:');
console.log('\nconst BATCH_AIRDROP_BYTECODE =');
console.log(`  '${bytecode}';`);

// Return for programmatic use
module.exports = {
  bytecode,
  abi
};
