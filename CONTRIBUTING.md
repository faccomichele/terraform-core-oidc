# Contributing to Terraform Serverless OIDC Provider

Thank you for your interest in contributing! This document provides guidelines for contributing to this project.

## How to Contribute

### Reporting Bugs

If you find a bug, please open an issue with:
- A clear description of the problem
- Steps to reproduce the issue
- Expected vs actual behavior
- Your environment (AWS region, Terraform version, etc.)
- Relevant logs or error messages

### Suggesting Enhancements

Enhancement suggestions are welcome! Please open an issue with:
- A clear description of the enhancement
- Use cases and benefits
- Potential implementation approach
- Any relevant examples

### Pull Requests

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Test your changes thoroughly
5. Commit with clear messages (`git commit -m 'Add amazing feature'`)
6. Push to your branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

## Development Guidelines

### Code Style

**Terraform:**
- Use 2 spaces for indentation
- Follow HashiCorp's style guide
- Use descriptive resource names
- Add comments for complex logic
- Use variables for configurable values

**JavaScript (Lambda):**
- Use 2 spaces for indentation
- Use ES6+ features
- Use async/await for asynchronous code
- Add JSDoc comments for functions
- Handle errors appropriately
- Use meaningful variable names

**Shell Scripts:**
- Use bash
- Include error checking (`set -e`)
- Add comments for complex operations
- Make scripts executable

### Testing

Before submitting a PR:

1. **Syntax Check:**
   ```bash
   # JavaScript
   cd lambda/src
   node -c *.js
   
   # Terraform (if available)
   terraform fmt -check
   terraform validate
   ```

2. **Functional Testing:**
   - Deploy to a test AWS account
   - Test all OIDC endpoints
   - Verify token issuance and validation
   - Test with example clients

3. **Documentation:**
   - Update README if needed
   - Update ARCHITECTURE.md for structural changes
   - Add/update examples if relevant

### Commit Messages

Use clear, descriptive commit messages:

```
Add feature: Description of feature

- Detail 1
- Detail 2
```

Or for bug fixes:
```
Fix: Description of what was fixed

Fixes #123
```

## Project Structure

```
.
├── main.tf              # Terraform entry point
├── variables.tf         # Input variables
├── outputs.tf           # Output values
├── *.tf                 # Other Terraform modules
├── lambda/
│   └── src/            # Lambda function source code
├── scripts/            # Utility scripts
├── examples/           # Example client applications
└── docs/               # Additional documentation
```

## Areas for Contribution

We welcome contributions in these areas:

### High Priority
- [ ] Add unit tests for Lambda functions
- [ ] Add integration tests
- [ ] Implement token rotation
- [ ] Add user registration endpoint
- [ ] Implement consent screen
- [ ] Add rate limiting

### Medium Priority
- [ ] Support for more grant types
- [ ] Admin API for user/client management
- [ ] Multi-factor authentication
- [ ] Custom claims support
- [ ] Better error handling and logging

### Documentation
- [ ] Video tutorials
- [ ] More example clients (Go, Java, .NET)
- [ ] Deployment guides for different scenarios
- [ ] Troubleshooting guide

## Security

If you discover a security vulnerability:

1. **DO NOT** open a public issue
2. Email the maintainers privately
3. Provide detailed information about the vulnerability
4. Allow time for the issue to be addressed

## Code of Conduct

### Our Pledge

We pledge to make participation in our project a harassment-free experience for everyone, regardless of age, body size, disability, ethnicity, gender identity and expression, level of experience, nationality, personal appearance, race, religion, or sexual identity and orientation.

### Our Standards

**Positive behavior includes:**
- Being respectful of differing viewpoints
- Accepting constructive criticism gracefully
- Focusing on what is best for the community
- Showing empathy towards others

**Unacceptable behavior includes:**
- Trolling, insulting/derogatory comments, and personal attacks
- Public or private harassment
- Publishing others' private information
- Other conduct which could reasonably be considered inappropriate

## Questions?

If you have questions about contributing, feel free to:
- Open a discussion issue
- Ask in pull request comments
- Reach out to maintainers

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
