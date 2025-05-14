# GitHub Integration and Badge Setup

This document summarizes the changes made to enhance the project's GitHub integration and set up badges.

## Changes Made

1. **Added GitHub Workflows**
   - Created `.github/workflows/test.yml`: Workflow to run tests on every push and PR
   - Created `.github/workflows/badges.yml`: Workflow to update badges on the main branch

2. **Updated Code Coverage Configuration**
   - Updated `codecov.yml` to include Vitest test files and set appropriate coverage targets
   - Changed code coverage provider from c8 to v8 in `vitest.config.js`
   - Added LCOV reporter output for better coverage reporting

3. **Added Badges to README.md**
   - Added Tests passing badge
   - Updated CodeCov badge to point to the correct repo
   - Added npm version badge
   - Added MIT license badge

4. **GitHub Templates and Issue Configuration**
   - Added issue templates for bug reports
   - Added issue templates for feature requests
   - Created a configuration file for the issue templates

5. **NPM Package Configuration**
   - Updated `.npmignore` to exclude test files and development-related files
   - Added additional patterns for Vitest test files

## How the Badges Work

1. **Tests Badge**: Shows the status of the latest test run from the GitHub Actions workflow
2. **CodeCov Badge**: Shows the code coverage percentage from CodeCov
3. **NPM Version Badge**: Shows the current version of the package on npm
4. **License Badge**: Shows the MIT license status

## GitHub Actions Workflow

The GitHub Actions workflow does the following:

1. **On Push or PR to main branch**:
   - Runs all tests
   - Generates code coverage
   - Uploads coverage to CodeCov

2. **On Push to main branch**:
   - Updates the badges

## Coverage Thresholds

The following coverage thresholds have been configured:

- Overall project: 50% coverage (with 5% threshold)
- New code in PRs: 70% coverage (with 5% threshold)

## Next Steps

1. **Complete Setup**: After pushing these changes to GitHub, complete the setup by:
   - Setting up CodeCov integration (sign in with GitHub at codecov.io)
   - Configuring the CodeCov secret in GitHub repo settings

2. **Publish to NPM**: If you plan to publish to npm, make sure:
   - The package.json is configured correctly
   - You're logged in to npm with appropriate permissions

3. **Add More Tests**: Consider adding more tests to improve coverage