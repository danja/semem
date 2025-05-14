# Jasmine to Vitest Migration Guide

This guide provides instructions for migrating test files from Jasmine to Vitest in the Semem project.

## Overview

The Semem project is in the process of migrating from Jasmine to Vitest for testing. This migration offers several benefits:

- Improved performance with parallel test execution
- Better ESM support for modern JavaScript
- Enhanced watch mode and UI for development
- Built-in coverage reporting
- Consistent API with the larger JavaScript ecosystem

## Migration Process

### 1. File Naming Convention

- Rename test files from `.spec.js` to `.test.js`
- Keep the file in the same directory structure

### 2. Import Changes

Replace Jasmine-specific imports with Vitest imports:

```javascript
// Before (Jasmine)
// No imports typically needed, globals are available

// After (Vitest)
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
```

### 3. Test Structure Mapping

| Jasmine | Vitest | Notes |
|---------|--------|-------|
| `describe()` | `describe()` | Same syntax |
| `it()` | `it()` | Same syntax |
| `beforeEach()` | `beforeEach()` | Same syntax |
| `afterEach()` | `afterEach()` | Same syntax |
| `beforeAll()` | `beforeAll()` | Same syntax |
| `afterAll()` | `afterAll()` | Same syntax |
| `jasmine.createSpy()` | `vi.fn()` | Vitest uses `vi` instead of `jasmine` |
| `spyOn()` | `vi.spyOn()` | Similar, but different usage in some cases |

### 4. Assertion Conversion

| Jasmine | Vitest | Notes |
|---------|--------|-------|
| `expect(x).toBe(y)` | `expect(x).toBe(y)` | Same syntax |
| `expect(x).toEqual(y)` | `expect(x).toEqual(y)` | Same syntax |
| `expect(x).toBeTrue()` | `expect(x).toBeTruthy()` | Vitest generally doesn't have `.toBeTrue()` |
| `expect(x).toBeFalse()` | `expect(x).toBeFalsy()` | Vitest doesn't have `.toBeFalse()` |
| `expect(fn).toThrow()` | `expect(() => fn()).toThrow()` | Vitest requires a function call |
| `expectAsync(promise).toBeRejected()` | `await expect(promise).rejects.toThrow()` | Different promise syntax |
| `expectAsync(promise).toBeRejectedWithError(msg)` | `await expect(promise).rejects.toThrow(msg)` | Different syntax |
| `expect(spy).toHaveBeenCalled()` | `expect(spy).toHaveBeenCalled()` | Same syntax |
| `expect(spy.calls.mostRecent())` | `expect(spy.mock.calls[spy.mock.calls.length - 1])` | Different access to calls |

### 5. Custom Matchers and Test Utils

Jasmine Base Test classes should be converted to use Vitest's utilities:

```javascript
// Before (Jasmine)
class MyTest extends BaseTest {
    beforeEach() {
        // Setup test
    }
    
    expectSuccess(promise) {
        return expectAsync(promise).toBeResolved();
    }
}

// After (Vitest)
// Instead of inheritance, use composition with helper functions
function setupTest() {
    // Setup test
    return {
        // test utilities...
    };
}

// Helper functions can be defined separately
async function expectSuccess(promise) {
    await expect(promise).resolves.toBeDefined();
}
```

### 6. Mocking

Jasmine's spy approach needs to be converted to Vitest's `vi` utilities:

```javascript
// Before (Jasmine)
const spy = jasmine.createSpy('myFunction')
spy.and.returnValue('test')

// After (Vitest)
const spy = vi.fn().mockReturnValue('test')

// Before (Jasmine)
spyOn(obj, 'method').and.callFake(() => 'fake')

// After (Vitest)
vi.spyOn(obj, 'method').mockImplementation(() => 'fake')

// Before (Jasmine)
spy.and.rejectWith(new Error('test'))

// After (Vitest)
spy.mockRejectedValue(new Error('test'))
```

### 7. Async Tests

Vitest handles async tests in a more standard way:

```javascript
// Before (Jasmine)
it('should handle async', (done) => {
    someAsync().then(() => {
        expect(result).toBe(true);
        done();
    });
});

// After (Vitest)
it('should handle async', async () => {
    await someAsync();
    expect(result).toBe(true);
});
```

### 8. Mock Reset and Cleanup

```javascript
// Before (Jasmine)
// Jasmine automatically resets spies between tests

// After (Vitest)
// Need to manually reset mocks between tests
afterEach(() => {
    vi.resetAllMocks();
});
```

## Advanced Topics

### Module Mocking

Vitest provides more advanced module mocking:

```javascript
// Mocking a module
vi.mock('logger', () => ({
    default: {
        error: vi.fn(),
        info: vi.fn()
    }
}));
```

### Timer Mocking

```javascript
// Before (Jasmine)
jasmine.clock().install();
jasmine.clock().tick(1000);
jasmine.clock().uninstall();

// After (Vitest)
vi.useFakeTimers();
vi.advanceTimersByTime(1000);
vi.useRealTimers();
```

### Event Testing

```javascript
// Before (Jasmine)
it('should emit events', (done) => {
    const listener = jasmine.createSpy('listener');
    emitter.on('event', listener);
    emitter.emit('event', data);
    expect(listener).toHaveBeenCalledWith(data);
    done();
});

// After (Vitest)
it('should emit events', () => {
    return new Promise((resolve) => {
        emitter.once('event', (data) => {
            expect(data).toEqual(expectedData);
            resolve();
        });
        
        emitter.emit('event', expectedData);
    });
});
```

## Examples

For reference, see the following migrated test files:

1. `/tests/unit/MemoryManager.test.js`
2. `/tests/unit/ContextWindowManager.test.js`
3. `/tests/unit/handlers/EmbeddingHandler.test.js`
4. `/tests/unit/api/MetricsCollector.test.js`
5. `/tests/unit/utils/EmbeddingValidator.test.js`

These provide concrete examples of how to structure Vitest tests for different modules in the Semem project:

- The MetricsCollector test demonstrates handling timers, events, and complex cleanup operations
- The EmbeddingValidator test shows how to test validation logic and handle edge cases
- The rest provide patterns for testing core component functionality

## Remaining Files to Migrate

The following files still need to be migrated from Jasmine to Vitest:

```
/tests/unit/api/APILogger.spec.js
/tests/unit/handlers/CLIHandler.spec.js
/tests/unit/handlers/REPLHandler.spec.js
/tests/unit/http/message-queue.spec.js
/tests/unit/http/WebSocketServer.spec.js
/tests/unit/sparql/SPARQLEndpoint.spec.js
/tests/integration/ContextManager.integration.spec.js
/tests/integration/examples/OllamaExample.spec.js
/tests/integration/http/HTTPServer.integration.spec.js
/tests/integration/http/websocket-integration.spec.js
/tests/integration/llms/LLMHandler.integration.spec.js
/tests/integration/llms/Ollama.spec.js
```

### Completed Migrations

The following files have been successfully migrated from Jasmine to Vitest:

```
/tests/unit/MemoryManager.test.js
/tests/unit/ContextWindowManager.test.js
/tests/unit/handlers/EmbeddingHandler.test.js 
/tests/unit/handlers/LLMHandler.test.js
/tests/unit/handlers/ActiveHandler.test.js
/tests/unit/handlers/PassiveHandler.test.js
/tests/unit/handlers/SelfieHandler.test.js
/tests/unit/api/APIRegistry.test.js
/tests/unit/api/BaseAPI.test.js
/tests/unit/api/MetricsCollector.test.js
/tests/unit/sparql/CachedSPARQLStore.test.js
/tests/unit/utils/EmbeddingValidator.test.js
```

## Testing Both Frameworks During Transition

During the migration phase, both Jasmine and Vitest tests can be run:

```bash
# Run Vitest tests
npm test

# Run remaining Jasmine tests
npm run test:jasmine
```

This allows for a gradual transition between the two frameworks.

## Troubleshooting

- **Module loading errors**: Make sure you're using ESM-compatible imports
- **Mock issues**: Vitest mocks need more explicit setup and teardown
- **Path issues**: Vitest may require absolute paths in some cases
- **Async test failures**: Ensure you're using `async/await` or properly handling promises