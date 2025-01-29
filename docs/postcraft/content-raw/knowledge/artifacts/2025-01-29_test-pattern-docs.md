# Test Pattern Documentation

## Core Infrastructure

The testing framework provides a structured approach for creating reliable, maintainable tests with proper resource management and asynchronous operation handling.

### BaseTest Class
```javascript
import { TestHelper } from './TestHelper.js';

export class BaseTest {
    constructor() {
        this.mocks = new Set();
        this.cleanupFunctions = new Set();
        this.pendingPromises = new Set();
    }

    beforeAll() {
        jasmine.addMatchers(TestHelper.jasmineMatchers);
        jasmine.DEFAULT_TIMEOUT_INTERVAL = 5000;
    }

    beforeEach() {
        this.errorSpy = spyOn(console, 'error');
        this.logSpy = spyOn(console, 'log');
        this.warnSpy = spyOn(console, 'warn');
        this.debugSpy = spyOn(console, 'debug');
        jasmine.clock().install();
    }

    afterEach(done) {
        jasmine.clock().uninstall();
        Promise.all(this.pendingPromises)
            .then(() => {
                this.cleanupFunctions.forEach(cleanup => cleanup());
                this.cleanupFunctions.clear();
                this.pendingPromises.clear();
                done();
            })
            .catch(done.fail);
    }

    async afterAll() {
        await Promise.all([...this.pendingPromises]);
        await TestHelper.cleanupMocks(...this.mocks);
        this.mocks.clear();
    }
}
```

## Key Features

### 1. Async Operation Tracking
```javascript
class ComponentTest extends BaseTest {
    it('handles async operations', async (done) => {
        try {
            const result = await this.trackPromise(
                component.asyncOperation()
            );
            expect(result).toBeDefined();
            done();
        } catch (error) {
            done.fail(error);
        }
    });
}
```

### 2. Resource Management
```javascript
class ServiceTest extends BaseTest {
    beforeEach() {
        super.beforeEach();
        this.mockDb = this.addMock({
            query: jasmine.createSpy().and.resolveTo([])
        });
        this.service = new Service(this.mockDb);
        this.addCleanup(() => this.service.dispose());
    }
}
```

### 3. Event Testing
```javascript
class EventTest extends BaseTest {
    async testEventEmission() {
        const eventPromise = this.waitForEvent(emitter, 'change');
        await this.trackPromise(emitter.triggerChange());
        const event = await eventPromise;
        expect(event).toBeDefined();
    }
}
```

### 4. Time Management
```javascript
class TimerTest extends BaseTest {
    async testTimeout() {
        const operation = service.startOperation();
        await this.advanceTime(1000);
        expect(service.isComplete).toBeTrue();
    }
}
```

## Usage Patterns

### 1. Test Class Definition
```javascript
class UserServiceTest extends BaseTest {
    beforeEach() {
        super.beforeEach();
        this.mockAuth = this.addMock(TestHelper.createMockAuth());
        this.mockDb = this.addMock(TestHelper.createMockDb());
        this.service = new UserService(this.mockAuth, this.mockDb);
    }

    async testUserCreation(done) {
        const user = { id: 1, name: 'Test' };
        await this.trackPromise(this.service.createUser(user));
        expect(this.mockDb.insert).toHaveBeenCalledWith(user);
        done();
    }
}
```

### 2. Error Testing
```javascript
class ErrorTest extends BaseTest {
    async testErrorHandling(done) {
        this.mockDb.query.and.rejectWith(new Error('DB Error'));
        
        try {
            await this.trackPromise(this.service.getData());
            done.fail('Should have thrown error');
        } catch (error) {
            expect(error.message).toContain('DB Error');
            expect(this.errorSpy).toHaveBeenCalled();
            done();
        }
    }
}
```

### 3. Mock Verification
```javascript
class MockTest extends BaseTest {
    async testDependencyInteraction(done) {
        const mock = this.addMock({
            process: jasmine.createSpy().and.resolveTo('result')
        });

        const result = await this.trackPromise(
            this.service.processData('input')
        );

        expect(mock.process).toHaveBeenCalledWith('input');
        expect(result).toBe('result');
        done();
    }
}
```

## Best Practices

1. Test Isolation
   - Each test should be completely independent
   - Use fresh mocks for each test
   - Clean up all resources

2. Async Handling
   - Always use trackPromise for async operations
   - Handle all promise rejections
   - Use done callback correctly

3. Mock Management
   - Register all mocks with addMock
   - Define cleanup functions when needed
   - Verify mock interactions explicitly

4. Resource Cleanup
   - Dispose resources in afterEach
   - Clean up event listeners
   - Reset state between tests

## Implementation Steps

1. Create Test Class
```javascript
class ComponentTest extends BaseTest {
    beforeEach() {
        super.beforeEach();
        this.initializeMocks();
        this.initializeComponent();
    }
}
```

2. Define Tests
```javascript
describe('Component', () => {
    let test;

    beforeEach(() => {
        test = new ComponentTest();
    });

    it('performs operation', async (done) => {
        const result = await test.trackPromise(
            test.component.operation()
        );
        expect(result).toBeDefined();
        done();
    });
});
```

3. Add Cleanup
```javascript
    afterEach(done) {
        this.component.removeAllListeners();
        super.afterEach(done);
    }
```