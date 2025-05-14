# Codecov Setup Guide

This document explains how Codecov integration works in this project and what you need to configure if you're setting it up for the first time.

## What is Codecov?

[Codecov](https://codecov.io) is a service that provides code coverage reporting for your repository. It helps you track what percentage of your code is covered by tests and visualize where coverage is lacking.

## How it Works in This Project

1. When tests run in GitHub Actions, coverage reports are generated with Vitest
2. These reports are uploaded to Codecov automatically
3. Codecov analyzes the reports and provides a badge and web interface to view coverage details

## Configuration

### GitHub Repository Settings

For Codecov to work with a public GitHub repository:

1. Go to [Codecov.io](https://codecov.io)
2. Sign in with your GitHub account
3. Add your repository to Codecov
4. You'll get a Codecov token (for public repos, this isn't actually needed in the GitHub workflow)

### Codecov Configuration File

The project includes a `codecov.yml` file that configures the Codecov integration:

```yaml
codecov:
  require_ci_to_pass: false

coverage:
  precision: 2
  round: down
  range: "10...50"
  status:
    project:
      default:
        threshold: 5%
        # Lower coverage target for now as we're only using mocked tests
        target: 15%
    patch:
      default:
        target: auto
        threshold: 5%

comment:
  layout: "reach, diff, flags, files"
  behavior: default
  require_changes: false
  require_base: false
  require_head: true
  branches:
    - main

ignore:
  - "tests/**/*"
  - "**/*.spec.js"
  - "**/*.test.js"
  - "**/*.vitest.js"
  - "**/types/**"
```

This configuration:
- Sets a 15% target for overall coverage (low because we're only using mocked tests currently)
- Allows a 5% threshold before reporting failures
- Configures Codecov comments on pull requests
- Ignores test files in the coverage calculations

### GitHub Actions Workflow Integration

The GitHub Actions workflow is set up to run tests with coverage and upload the results to Codecov:

```yaml
# Generate coverage for mocked tests only
- name: Generate coverage for mocked tests only
  run: ./run-mocked-tests.sh --coverage
  
# Upload coverage to Codecov without token (public repo)
- name: Upload coverage to Codecov
  uses: codecov/codecov-action@v3
  with:
    directory: ./coverage
    verbose: true
    fail_ci_if_error: false
```

## Troubleshooting

If you encounter issues with Codecov:

1. **Missing Codecov Report**: Make sure the coverage report is being generated in the `./coverage` directory
2. **Upload Failures**: Check that the `codecov/codecov-action` is running correctly and has the right directory
3. **Token Issues**: For public repos, the token isn't required. For private repos, you need to add the Codecov token as a GitHub repository secret named `CODECOV_TOKEN`

## Adding the Badge to README

To add a Codecov badge to your README, use this Markdown:

```markdown
[![codecov](https://codecov.io/gh/YOUR_USERNAME/semem/branch/main/graph/badge.svg)](https://codecov.io/gh/YOUR_USERNAME/semem)
```

Replace `YOUR_USERNAME` with your GitHub username.

## Improving Coverage

To improve your code coverage:

1. Write more tests for uncovered code areas
2. Focus on testing critical components first
3. Use the Codecov web interface to identify code with low coverage
4. Migrate more tests to use mocking so they can run in CI/CD

Remember that the coverage target is set low initially (15%) since we're only running mocked tests. As more tests are migrated to use mocks, you can gradually increase this target in the `codecov.yml` file.