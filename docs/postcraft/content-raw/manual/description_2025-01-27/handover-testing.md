# Testing Strategy & Coverage

## Overview
The testing infrastructure has been refactored to improve isolation, reliability, and coverage reporting. Key improvements include standardized test helpers, proper mocking patterns, and comprehensive coverage analysis using Istanbul/nyc.

## Test Structure

### Core Components

1. TestHelper (`tests/helpers/TestHelper.js`)
   - Common mock creation
   - Test isolation utilities
   - Custom matchers
   - Error simulation

2. Base Test Setup
   - Standardized beforeEach/afterEach
   - Mock management
   - Error tracking
   - Clock handling

### Test Organization
```
tests/
├── unit/          # Unit tests
├── integration/   # Integration tests
├── helpers/       # Test utilities
└── fixtures/      # Test data
```

## Mock Patterns

### Service Mocks
```javascript
const mockLLMProvider = {
    generateEmbedding: jasmine.createSpy('generateEmbedding')
        .and.resolveTo(new Array(1536).fill(0)),
    generateChat: jasmine.createSpy('generateChat')
        .and.resolveTo('test response')
};
```

### Store Mocks
```javascript
const mockStore = {
    loadHistory: jasmine.createSpy('loadHistory')
        .and.resolveTo([[], []]),
    saveMemoryToHistory: jasmine.createSpy('saveMemoryToHistory')
};
```

## Coverage Setup

### Running Coverage
```bash
# Full test suite with coverage
npm run test:coverage

# Single file coverage
npm run test:coverage -- tests/unit/FileName.spec.js

# View HTML report
npm run test:report
```

### Coverage Thresholds
- Lines: 85%
- Functions: 85%
- Branches: 80%
- Statements: 85%

### CI Integration
- Automated coverage on PR/push
- Coverage diff reporting
- Codecov integration
- GitHub status checks

## Best Practices

1. Test Structure
   - One test file per source file
   - Clear describe/it block hierarchy
   - Focused test descriptions
   - Proper setup/teardown

2. Mocking
   - Mock at boundaries
   - Clear mock creation
   - Reset between tests
   - Verify interactions

3. Assertions
   - Single concept per test
   - Clear failure messages
   - Proper async handling
   - Error case coverage

4. Coverage
   - Maintain minimum thresholds
   - Document exclusions
   - Regular coverage reviews
   - Report coverage changes

## Common Patterns

### Async Testing
```javascript
describe('AsyncOperation', () => {
    it('should handle success', async () => {
        await expectAsync(operation())
            .toBeResolved();
    });

    it('should handle errors', async () => {
        await expectAsync(operation())
            .toBeRejectedWith(jasmine.any(Error));
    });
});
```

### Mock Verification
```javascript
describe('ServiceCall', () => {
    it('should call dependencies', async () => {
        await service.operation();
        expect(mockDependency.method)
            .toHaveBeenCalledWith(expected);
    });
});
```

## Next Steps

1. Immediate
   - Complete unit test migration
   - Add missing integration tests
   - Improve error reporting

2. Short Term
   - Add performance tests
   - Enhance CI reporting
   - Expand test helpers

3. Long Term
   - Add mutation testing
   - Automated test generation
   - Visual test reporting