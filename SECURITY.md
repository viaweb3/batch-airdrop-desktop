# Security Policy

## Supported Versions

| Version | Supported          |
|---------|--------------------|
| 1.2.x   | :white_check_mark: |
| 1.1.x   | :white_check_mark: |
| 1.0.x   | :x:                |

## Reporting a Vulnerability

We take the security of our application seriously. If you discover a security vulnerability, please report it to us privately before disclosing it publicly.

### How to Report

- Email: security@batch-airdrop.com
- Include detailed information about the vulnerability
- Provide steps to reproduce the issue if possible
- Allow us reasonable time to address the vulnerability before public disclosure

### What to Include

1. **Type of vulnerability** (e.g., XSS, authentication bypass, data exposure)
2. **Affected versions** of the application
3. **Detailed description** of the vulnerability
4. **Proof of concept** or steps to reproduce
5. **Potential impact** of the vulnerability
6. **Suggested mitigation** if applicable

### Response Time

- **Critical**: 48 hours
- **High**: 72 hours
- **Medium**: 1 week
- **Low**: 2 weeks

## Security Features

Our application implements the following security measures:

### Wallet Security
- **AES-256-GCM encryption** for all private keys
- **Master key protection** with user-defined passwords
- **PBKDF2 key derivation** with 100,000 iterations
- **Secure memory handling** for sensitive data

### Data Protection
- **Local database encryption** for sensitive campaign data
- **No plaintext storage** of private keys or passwords
- **Secure random number generation** using crypto module

### Network Security
- **HTTPS/TLS** for all external API communications
- **RPC endpoint validation** to prevent MITM attacks
- **Input validation** for all user-provided data

### Application Security
- **Code signing** for executable verification
- **Auto-update verification** with cryptographic signatures
- **Process isolation** between main and renderer processes

## Security Best Practices

### For Users
1. **Use strong passwords** for wallet encryption
2. **Keep software updated** to the latest version
3. **Verify downloads** from official sources only
4. **Backup wallets** securely offline
5. **Use hardware wallets** for large amounts

### For Developers
1. **Validate all inputs** and sanitize user data
2. **Use parameterized queries** to prevent SQL injection
3. **Implement proper error handling** without exposing sensitive information
4. **Follow principle of least privilege** for all operations
5. **Regular security audits** of the codebase

## Threat Model

### Potential Threats
1. **Malware infection** of user's system
2. **Phishing attacks** targeting user credentials
3. **Network interception** of sensitive communications
4. **Database compromise** through direct access
5. **Supply chain attacks** through dependency compromise

### Mitigations
1. **Code signing** and verification
2. **User education** and security warnings
3. **End-to-end encryption** for sensitive data
4. **Database encryption** and access controls
5. **Dependency scanning** and regular updates

## Responsible Disclosure

We appreciate your help in making our application more secure. When reporting vulnerabilities:

- **Do not** exploit the vulnerability beyond what's necessary for demonstration
- **Do not** disclose the vulnerability publicly until we've addressed it
- **Do provide** sufficient information for us to reproduce and fix the issue
- **Do allow** us reasonable time to respond and release a fix

## Security Updates

Security updates will be released as:

- **Critical patches**: Immediately after vulnerability is fixed
- **Security releases**: Scheduled for the first Tuesday of each month
- **Feature updates**: Include security improvements as part of regular releases

Users will be automatically notified of available updates through the application's auto-update mechanism.

## Contact Information

For security-related inquiries:
- **Security Team**: security@batch-airdrop.com
- **General Support**: support@batch-airdrop.com
- **Security Research**: research@batch-airdrop.com

Thank you for helping keep our application and users secure!