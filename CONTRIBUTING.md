# Contributing to Batch Airdrop Desktop

Thank you for your interest in contributing to our blockchain batch airdrop desktop application! This document provides guidelines and information for contributors.

## Table of Contents

- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Code Style](#code-style)
- [Testing](#testing)
- [Pull Request Process](#pull-request-process)
- [Issue Reporting](#issue-reporting)
- [Community Guidelines](#community-guidelines)

## Getting Started

### Prerequisites

- Node.js 24+
- npm 10+
- Git
- Basic knowledge of TypeScript, React, and Electron

### Fork and Clone

1. Fork the repository on GitHub
2. Clone your fork locally:
   ```bash
   git clone https://github.com/yourusername/batch-airdrop-desktop.git
   cd batch-airdrop-desktop
   ```

3. Add the original repository as a remote:
   ```bash
   git remote add upstream https://github.com/original/batch-airdrop-desktop.git
   ```

## Development Setup

### Installation

```bash
npm install
```

### Development

```bash
# Start development server
npm run dev

# Run tests in watch mode
npm run test:watch

# Run with coverage
npm run test:coverage
```

### Project Structure

```
src/
├── main/                    # Electron main process
│   ├── database/           # Database schema and management
│   ├── ipc/                # IPC handlers
│   └── services/           # Backend services
├── renderer/               # React frontend
│   └── src/
│       ├── components/     # React components
│       ├── pages/          # Page components
│       └── types/          # TypeScript types
└── __tests__/              # Test files
    ├── services/           # Unit tests
    ├── integration/        # Integration tests
    └── e2e/               # End-to-end tests
```

## Code Style

### TypeScript

- Use strict TypeScript mode
- Prefer explicit return types for functions
- Use interfaces for object shapes
- Avoid `any` type when possible

### React

- Use functional components with hooks
- Follow hooks rules (only call at top level)
- Use TypeScript for component props
- Prefer default exports for components

### General

- Use descriptive variable and function names
- Keep functions small and focused
- Add JSDoc comments for complex functions
- Follow conventional commit messages

#### Example:

```typescript
// Good
interface WalletBalance {
  address: string;
  balance: string;
  tokenSymbol: string;
}

/**
 * Retrieves the wallet balance for a specific token
 * @param address Wallet address to query
 * @param tokenAddress Token contract address (null for native token)
 * @returns Promise resolving to wallet balance information
 */
async function getWalletBalance(
  address: string,
  tokenAddress: string | null
): Promise<WalletBalance> {
  // Implementation
}
```

## Testing

### Test Types

1. **Unit Tests**: Test individual functions and classes
2. **Integration Tests**: Test interaction between components
3. **E2E Tests**: Test complete user workflows

### Writing Tests

- Use Jest for unit and integration tests
- Test both happy path and error cases
- Mock external dependencies
- Aim for high test coverage (>80%)

#### Example:

```typescript
describe('WalletService', () => {
  beforeEach(() => {
    // Setup test environment
  });

  test('should create EVM wallet successfully', async () => {
    const wallet = walletService.createEVMWallet();

    expect(wallet.address).toMatch(/^0x[a-fA-F0-9]{40}$/);
    expect(wallet.encryptedKey).toContain(':');
  });
});
```

### Running Tests

```bash
# All tests
npm test

# Unit tests only
npm run test:unit

# Integration tests only
npm run test:integration

# E2E tests only
npm run test:e2e

# Coverage report
npm run test:coverage
```

## Pull Request Process

### Before Submitting

1. **Fork** the repository and create a feature branch
2. **Write tests** for new functionality
3. **Ensure all tests pass** locally
4. **Update documentation** if needed
5. **Commit changes** with clear messages

### Branch Naming

Use descriptive branch names:
- `feature/wallet-security-improvements`
- `bugfix/campaign-status-update`
- `docs/api-documentation`

### Commit Messages

Follow conventional commits format:

```
type(scope): description

[optional body]

[optional footer]
```

Examples:
- `feat(wallet): add biometric authentication`
- `fix(campaign): resolve status update issue`
- `docs(readme): update installation instructions`

### Pull Request Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] Manual testing completed

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] Tests pass locally
```

## Issue Reporting

### Bug Reports

When reporting bugs, please include:

1. **Environment information**
   - OS version
   - Application version
   - Node.js version

2. **Steps to reproduce**
   - Detailed description
   - Expected behavior
   - Actual behavior

3. **Additional context**
   - Screenshots if applicable
   - Error messages
   - Relevant logs

### Feature Requests

For feature requests:

1. **Problem description**: What problem does this solve?
2. **Proposed solution**: How should it work?
3. **Alternatives considered**: What other approaches did you consider?
4. **Additional context**: Any other relevant information

## Community Guidelines

### Code of Conduct

1. **Be respectful**: Treat everyone with respect and professionalism
2. **Be inclusive**: Welcome contributors from all backgrounds
3. **Be constructive**: Provide helpful feedback and suggestions
4. **Be patient**: Understand that contributors have varying experience levels

### Getting Help

- **GitHub Issues**: For bug reports and feature requests
- **Discussions**: For general questions and ideas
- **Discord**: For real-time conversation (if available)

### Communication

- Use clear and concise language
- Provide context for questions and issues
- Be patient when waiting for responses
- Help others when you can

## Recognition

Contributors will be recognized in:

- `CONTRIBUTORS.md` file
- Release notes for significant contributions
- Project documentation for major features

## License

By contributing to this project, you agree that your contributions will be licensed under the same license as the project.

## Questions?

If you have questions about contributing:

1. Check existing [issues](https://github.com/original/batch-airdrop-desktop/issues)
2. Create a new issue with the "question" label
3. Start a [discussion](https://github.com/original/batch-airdrop-desktop/discussions)

Thank you for contributing to Batch Airdrop Desktop! 🚀