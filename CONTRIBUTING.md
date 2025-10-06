# Contributing to Universities

First off, thank you for considering contributing to Universities! It's people like you that make this project a great tool for the community.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [How Can I Contribute?](#how-can-i-contribute)
  - [Reporting Bugs](#reporting-bugs)
  - [Suggesting Enhancements](#suggesting-enhancements)
  - [Your First Code Contribution](#your-first-code-contribution)
  - [Pull Requests](#pull-requests)
- [Development Setup](#development-setup)
- [Styleguides](#styleguides)
  - [Git Commit Messages](#git-commit-messages)
  - [TypeScript Styleguide](#typescript-styleguide)
  - [Documentation Styleguide](#documentation-styleguide)
- [Ethical Considerations](#ethical-considerations)

## Code of Conduct

This project and everyone participating in it is governed by our [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code. Please report unacceptable behavior to [victor.williams.dev@gmail.com](mailto:victor.williams.dev@gmail.com).

## Getting Started

1. Fork the repository on GitHub
2. Clone your fork locally
3. Set up the development environment (see [Development Setup](#development-setup))
4. Create a new branch for your changes
5. Make your changes
6. Push to your fork and submit a pull request

## How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check the issue list as you might find out that you don't need to create one. When you are creating a bug report, please include as many details as possible:

- **Use a clear and descriptive title** for the issue to identify the problem.
- **Describe the exact steps which reproduce the problem** in as many details as possible.
- **Provide specific examples to demonstrate the steps**. Include links to files or GitHub projects, or copy/pasteable snippets.
- **Describe the behavior you observed after following the steps** and point out what exactly is the problem with that behavior.
- **Explain which behavior you expected to see instead and why.**
- **Include screenshots and animated GIFs** if relevant.
- **Include your environment details**: OS, Node.js version, npm version, etc.

### Suggesting Enhancements

Enhancement suggestions are tracked as GitHub issues. When creating an enhancement suggestion, please include:

- **Use a clear and descriptive title** for the issue to identify the suggestion.
- **Provide a step-by-step description of the suggested enhancement** in as many details as possible.
- **Provide specific examples to demonstrate the steps** or provide mockups/screenshots.
- **Describe the current behavior** and **explain which behavior you expected to see instead** and why.
- **Explain why this enhancement would be useful** to most users.

### Your First Code Contribution

Unsure where to begin contributing? You can start by looking through these issues:

- [Good First Issue](https://github.com/Vaporjawn/universities/labels/good%20first%20issue) - issues which should only require a few lines of code.
- [Help Wanted](https://github.com/Vaporjawn/universities/labels/help%20wanted) - issues which should be a bit more involved than beginner issues.

### Pull Requests

- Fill in the required template
- Do not include issue numbers in the PR title
- Follow the [TypeScript styleguide](#typescript-styleguide)
- Include thoughtful comments in your code
- Include tests for new features
- Update documentation as needed
- End all files with a newline
- Avoid platform-dependent code

## Development Setup

1. **Clone your fork**:

   ```bash
   git clone https://github.com/YOUR-USERNAME/universities.git
   cd universities
   ```

2. **Install dependencies**:

   ```bash
   npm install
   ```

3. **Build the project**:

   ```bash
   npm run build
   ```

4. **Run tests**:

   ```bash
   npm test
   ```

5. **Run linting**:

   ```bash
   npm run lint
   ```

6. **Format code**:
   ```bash
   npm run format
   ```

## Styleguides

### Git Commit Messages

- Use the present tense ("Add feature" not "Added feature")
- Use the imperative mood ("Move cursor to..." not "Moves cursor to...")
- Limit the first line to 72 characters or less
- Reference issues and pull requests liberally after the first line
- Consider starting the commit message with an applicable emoji:
  - 🎨 `:art:` when improving the format/structure of the code
  - 🐎 `:racehorse:` when improving performance
  - 📝 `:memo:` when writing docs
  - 🐛 `:bug:` when fixing a bug
  - 🔥 `:fire:` when removing code or files
  - ✅ `:white_check_mark:` when adding tests
  - 🔒 `:lock:` when dealing with security
  - ⬆️ `:arrow_up:` when upgrading dependencies
  - ⬇️ `:arrow_down:` when downgrading dependencies

### TypeScript Styleguide

- Use TypeScript for all new code
- Follow the existing code style (enforced by ESLint and Prettier)
- Use meaningful variable and function names
- Add JSDoc comments for public APIs
- Prefer `const` over `let`, avoid `var`
- Use async/await over raw promises when possible
- Handle errors appropriately (don't swallow them)
- Write pure functions when possible
- Keep functions small and focused on a single task
- Use proper TypeScript types, avoid `any` unless absolutely necessary
- Export types that are part of the public API

Example:

```typescript
/**
 * Searches for universities matching the given criteria
 * @param options - Search options including filters and pagination
 * @returns Array of matching universities
 */
export function searchUniversities(options: UniversitySearchOptions): University[] {
  // Implementation
}
```

### Documentation Styleguide

- Use [Markdown](https://daringfireball.net/projects/markdown/) for documentation
- Reference functions, classes, and modules in backticks: \`UniversityScraper\`
- Include code examples where helpful
- Keep language clear and concise
- Update the README.md if you change functionality
- Document all public APIs with JSDoc comments

## Ethical Considerations

### Web Scraping Ethics

This project includes web scraping functionality. When contributing to scraping-related features:

- **Respect robots.txt**: Always check and honor robots.txt directives
- **Rate Limiting**: Implement and respect rate limits to avoid overloading servers
- **User-Agent**: Use a descriptive User-Agent that identifies the bot and provides contact information
- **Caching**: Implement proper caching to avoid redundant requests
- **Error Handling**: Handle errors gracefully and implement backoff strategies
- **Terms of Service**: Consider the terms of service of websites being scraped
- **Privacy**: Do not scrape or store personal data beyond institutional metadata
- **Transparency**: Document what data is being collected and how it's used

### Conservative Defaults

- Default to lower concurrency settings
- Implement delays between requests
- Provide clear documentation on responsible usage
- Add warnings for bulk operations

## Testing

- Write tests for all new features
- Ensure all tests pass before submitting PR
- Aim for high test coverage (currently targeting 30%+ for critical paths)
- Use meaningful test descriptions
- Mock external dependencies appropriately
- Test edge cases and error conditions

## Questions?

Feel free to open an issue with your question or reach out to the maintainers:

- Email: [victor.williams.dev@gmail.com](mailto:victor.williams.dev@gmail.com)
- GitHub: [@Vaporjawn](https://github.com/Vaporjawn)

## Recognition

Contributors will be recognized in:

- The project README
- Release notes for significant contributions
- The contributors graph on GitHub

Thank you for contributing! 🎉
