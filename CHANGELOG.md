# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.3.0] - 2025-11-28

### Changed
- **CI/CD Workflow**: Optimized macOS build configuration for better native module compatibility
  - Intel (x64) builds now use `macos-13` runner for native architecture compilation
  - Apple Silicon (arm64) builds now use `macos-14` runner for ARM64 native compilation
  - Ensures proper native module compilation (sqlite3, sharp) on correct platforms
  - Improves backward compatibility for Intel builds and native performance for ARM64

### Fixed
- **Dependencies**: Regenerated package-lock.json for consistent dependency resolution across environments

## [1.2.0] - 2025-11-27

### Added
- **Winston Logging System**: Integrated Winston logger library for structured logging across all services
  - Type-safe logger interface with `Record<string, unknown>` for metadata
  - Contextual logging with categories (BLOCKCHAIN, CAMPAIGN, TRANSACTION, WALLET, etc.)
  - Logger singleton pattern with child logger support for better traceability
- **Airdrop Generation Scripts**: Added utility scripts for testing
  - `scripts/generate-evm-airdrop.js`: Generate 333 test EVM addresses with random amounts
  - `scripts/generate-solana-airdrop.js`: Generate 333 test Solana addresses with random amounts
- **Type Definitions**: New type definition files for better TypeScript support
  - `src/main/types/ipc.ts`: IPC channel type definitions
  - `src/types/electron-api.ts`: Electron API type definitions

### Changed
- **Logging**: Replaced all `console.log/error/warn` calls with structured Winston logger
  - BlockchainService: Enhanced error logging with context
  - CampaignEstimator: Improved logging for cost estimation
  - CampaignExecutor: Better transaction execution logging
  - All services: Consistent logging patterns and error handling
- **CI/CD Workflow**: Optimized build pipeline
  - Removed Linux build support (focus on Windows and macOS)
  - Enhanced artifact verification and version naming
  - Improved build script robustness with better error handling
  - Only upload final installer files (.dmg, .exe) to releases, excluding intermediate files
- **Database Schema**: Enhanced with logging support
- **IPC Handlers**: Updated with better type safety
- **Preload Script**: Refactored for improved security and type definitions

### Fixed
- **Release Artifacts**: Fixed release upload to only include installer files
  - Excluded .blockmap files (used for auto-updates, not needed by end users)
  - Excluded helper executables (bundled in main installer)
  - Excluded zip and portable builds (simplified to dmg and NSIS installer only)
  - Reduced release artifacts from 153+ files to just 3 clean installers
- **Build Configuration**: Removed duplicate version numbering in artifact filenames
- **Electron Builder**: Optimized target configurations
  - macOS: Only build DMG (removed zip)
  - Windows: Only build NSIS installer (removed portable)

### Removed
- **Linux Support**: Removed Linux build from CI/CD pipeline (Windows and macOS only)
- **Intermediate Build Files**: Cleaned up release artifacts for cleaner distribution

### Technical Improvements
- Enhanced type safety across main process services
- Better error context in all logging calls
- Improved database interaction patterns
- Cleaner IPC communication layer

## [1.0.1] - 2025-01-25

### Fixed
- **BSC Testnet Balance Refresh**: Fixed async/sync mismatch in database queries that prevented balance refresh functionality on BSC testnet
- **Dynamic Native Token Symbols**: Fixed hardcoded "ETH" in insufficient balance messages to use correct native token symbols (BNB, MATIC, etc.)
- **Contract Deployment Gas Limits**: Optimized gas limits for better efficiency:
  - Contract deployment: 700K → 500K gas
  - Token approval: 165K → 47K gas
  - Batch transfer: 14.4M → 5.7M gas
- **Variable Scope Error**: Fixed "nativeBalance is not defined" error during contract deployment balance checks
- **UI Routing**: Fixed campaign detail page return button to show correct destination ("返回仪表盘" instead of "返回活动列表")
- **Token Amount Display**: Simplified total airdrop amount display logic to prevent precision issues

### Changed
- **Gas Estimation**: Enhanced accuracy with chain-specific gas multipliers for different networks
- **UI Terminology**: Updated "Gas 价格" to "GasPrice" for more professional blockchain terminology
- **Currency Display**: Removed fiat currency estimation, focusing on native token costs only
- **Code Cleanup**: Removed unnecessary debug console.log statements across all service files
- **Wallet Management**: Removed refresh balance functionality from wallet management page for cleaner UI

### Optimized
- **Gas Multipliers**: Implemented chain-specific gas multipliers for accurate cost estimation:
  - Ethereum: 1.0x (baseline)
  - BSC: 0.3x (lower gas costs)
  - Polygon: 0.5x
  - Arbitrum/Optimism/Base: 0.2x
  - Sepolia testnet: 0.1x
- **Safety Buffers**: Reduced gas multiplier from 1.2 to 1.1 and transaction buffer from 10% to 5%

## [Unreleased]

### Added
- Enhanced wallet encryption with master key protection
- Real-time price monitoring from CoinGecko API
- Smart contract integration for batch token distribution
- Comprehensive test suite with unit, integration, and E2E tests
- Support for multiple blockchain networks (Ethereum, Polygon, Solana)
- CSV import/export functionality for recipient management
- Gas price monitoring and estimation
- Campaign progress tracking and statistics
- Auto-update mechanism with code signing

### Changed
- Upgraded all dependencies to latest stable versions
- Improved TypeScript configuration for better type safety
- Enhanced error handling and user feedback
- Optimized database schema for better performance
- Improved security measures and input validation

### Fixed
- Resolved compilation issues with Database type imports
- Fixed encryption/decryption in WalletService
- Corrected IPC handler parameter mismatches
- Addressed potential memory leaks and resource cleanup

## [1.0.0] - 2024-01-19

### Added
- Initial release of Batch Airdrop Desktop application
- Multi-chain support (Ethereum, Polygon, Solana)
- EVM and Solana wallet creation and management
- Campaign creation and management system
- Real-time price tracking dashboard
- Secure wallet encryption with AES-256-GCM
- CSV import for recipient lists
- Batch transaction processing
- Transaction history and reporting
- Settings management and configuration
- Responsive UI with Tailwind CSS

### Security Features
- Master key password protection for wallets
- Private key encryption at rest
- Secure key derivation with PBKDF2
- Input validation and sanitization
- Safe file handling and temporary directories

### Technical Stack
- Electron 39.2.2 for desktop application framework
- React 19.2.0 for user interface
- TypeScript 5.7.3 for type safety
- SQLite for local data storage
- Ethers.js 6.13.4 for Ethereum interactions
- Solana Web3.js 1.98.0 for Solana interactions
- Vite 7.2.2 for build tooling

### Breaking Changes
- Initial release - no breaking changes

## [0.9.0] - 2024-01-15

### Added
- Beta version with core functionality
- Basic wallet management
- Simple campaign creation
- Price monitoring dashboard

### Known Issues
- Limited error handling
- Basic UI design
- No real-time updates

---

## Version History

### Version Numbering

- **Major (X.0.0)**: Breaking changes, major new features
- **Minor (X.Y.0)**: New features, improvements
- **Patch (X.Y.Z)**: Bug fixes, security updates

### Release Schedule

- **Major releases**: Every 3-4 months
- **Minor releases**: Monthly
- **Patch releases**: As needed for critical fixes

### Support Policy

- **Current version**: Full support
- **Previous major version**: Security updates only
- **Older versions**: No support

### Upgrade Instructions

#### From 0.x.x to 1.0.0
1. Backup your wallet data
2. Export any active campaigns
3. Uninstall previous version
4. Install version 1.0.0
5. Restore wallet data and campaigns

#### Automatic Updates
Starting with version 1.0.0, the application supports automatic updates for minor and patch releases.

### Deprecation Notices

- Direct database access methods will be deprecated in 2.0.0
- Legacy wallet export formats will be removed in 2.0.0
- Manual configuration files will be deprecated in 1.1.0

### Migration Guides

#### Wallet Migration (0.x → 1.0)
```bash
# Export old wallet
npm run export-wallet -- --source ~/.batch-airdrop-old --output wallet-backup.json

# Import to new version
npm run import-wallet -- --source wallet-backup.json
```

### Security Updates

Security updates will be documented separately and may include:
- Vulnerability patches
- Encryption improvements
- Access control enhancements
- Audit compliance updates

### Platform Support

#### Supported Operating Systems
- **Windows**: Windows 10 and later
- **macOS**: macOS 10.15 and later
- **Linux**: Ubuntu 18.04 and later, other distributions

#### Architecture Support
- **Windows**: x64, ARM64
- **macOS**: x64, Apple Silicon
- **Linux**: x64, ARM64

### Dependencies

#### Core Dependencies
- Electron: ^39.2.2
- React: ^19.2.0
- TypeScript: ^5.7.3
- Ethers.js: ^6.13.4
- Solana Web3.js: ^1.98.0

#### Development Dependencies
- Jest: ^29.7.0
- Vite: ^7.2.2
- Tailwind CSS: ^4.1.17

### Performance Improvements

#### Version 1.0.0
- 50% faster wallet creation
- 30% reduction in memory usage
- Improved database query performance
- Optimized price update frequency

### Known Issues in Current Release

- [Issue #123] Wallet backup may fail on Windows with special characters
- [Issue #124] Price updates may be delayed during high network load
- [Issue #125] Campaign export limited to 10,000 recipients

### Planned Features for Next Release

#### Version 1.1.0 (Planned: 2024-02-15)
- Hardware wallet integration
- Advanced filtering and search
- Campaign templates
- Multi-language support
- Enhanced reporting capabilities

#### Version 1.2.0 (Planned: 2024-03-15)
- Webhook integrations
- Advanced scheduling features
- Custom transaction fees
- Audit trail functionality
- API access for enterprise users

### Community Contributions

Special thanks to our contributors:
- [@contributor1] - Security improvements
- [@contributor2] - UI/UX enhancements
- [@contributor3] - Documentation improvements
- [@contributor4] - Performance optimizations

### Translators

Thank you to our translators:
- Chinese Simplified - [@translator1]
- Japanese - [@translator2]
- Korean - [@translator3]

### Support and Feedback

- **Issues**: [GitHub Issues](https://github.com/batch-airdrop/desktop/issues)
- **Discussions**: [GitHub Discussions](https://github.com/batch-airdrop/desktop/discussions)
- **Discord**: [Community Server](https://discord.gg/batch-airdrop)
- **Email**: support@batch-airdrop.com

### License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

### Third-Party Licenses

This application uses third-party libraries with their own licenses:
- [Electron](https://github.com/electron/electron/blob/master/LICENSE)
- [React](https://github.com/facebook/react/blob/main/LICENSE)
- [Ethers.js](https://github.com/ethers-io/ethers.js/blob/master/LICENSE)
- [Solana Web3.js](https://github.com/solana-labs/solana-web3.js/blob/master/LICENSE)

For a complete list of third-party licenses, see [THIRD_PARTY_LICENSES.md](THIRD_PARTY_LICENSES.md).