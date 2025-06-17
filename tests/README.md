# Testing in Semem

This directory contains all test files for the Semem project. The tests are organized into different categories to maintain a clear separation of concerns.

## Test Structure

```
tests/
├── e2e/                  # End-to-end tests (Playwright)
│   ├── helpers/          # Test utilities and helpers
│   │   └── pageObjects/  # Page object models for UI components
│   └── *.e2e.js         # Test files with .e2e.js extension
├── unit/                 # Unit tests (Vitest)
│   └── **/*.test.js     # Test files with .test.js extension
└── integration/          # Integration tests (Vitest)
    └── **/*.spec.js    # Test files with .spec.js extension
```

## Running Tests

### Unit Tests (Vitest)

```bash
# Run all unit tests
npm run test:unit

# Run in watch mode
npm run test:watch

# Generate coverage report
npm run test:coverage
```

### End-to-End Tests (Playwright)

```bash
# Run all e2e tests in headless mode
npm run test:e2e

# Run e2e tests in UI mode
npm run test:e2e:ui

# Debug e2e tests
npm run test:e2e:debug

# Update snapshots
npm run test:e2e:update-snapshots

# View test report
npm run test:e2e:report
```

## Test Naming Conventions

- Unit tests: `*.test.js`
- Integration tests: `*.spec.js`
- End-to-end tests: `*.e2e.js`

## Writing Tests

### Unit Tests
- Place unit tests next to the code they test
- Use `*.test.js` extension
- Keep tests small and focused
- Mock external dependencies

### Integration Tests
- Place in the `integration/` directory
- Use `*.spec.js` extension
- Test interactions between modules
- Mock only external services

### End-to-End Tests
- Place in the `e2e/` directory
- Use `*.e2e.js` extension
- Use page object models for UI interactions
- Keep tests independent and isolated

## Best Practices

1. **Isolation**: Each test should be independent
2. **Readability**: Clear test names and structure
3. **Maintainability**: Keep tests DRY with helper functions
4. **Reliability**: Use proper waiting strategies in e2e tests
5. **Performance**: Keep tests fast and efficient

## Continuous Integration

Tests are automatically run in CI. Make sure all tests pass before merging to the main branch.
