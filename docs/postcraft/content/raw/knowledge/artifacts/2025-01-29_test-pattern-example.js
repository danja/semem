// example/test/DataManagerTest.js
import { BaseTest } from '../../tests/helpers/BaseTest.js';
import DataManager from '../src/DataManager.js';

/**
 * Example test implementation demonstrating test patterns
 */
class DataManagerTest extends BaseTest {
    beforeEach() {
        super.beforeEach();
        
        // Create mocks
        this.mockStorage = {
            save: jasmine.createSpy('save').and.resolveTo(true),
            load: jasmine.createSpy('load').and.resolveTo([]),
            delete: jasmine.createSpy('delete').and.resolveTo(true)
        };
        this.addMock(this.mockStorage);

        this.mockValidator = {
            validate: jasmine.createSpy('validate').and.returnValue(true)
        };
        this.addMock(this.mockValidator);

        // Create test instance
        this.manager = new DataManager(this.mockStorage, this.mockValidator);
        
        // Setup cleanup
        this.addCleanup(() => this.manager.dispose());
    }

    // Helper to create test data
    createTestData(id = 'test-1') {
        return {
            id,
            value: 'test value',
            timestamp: Date.now()
        };
    }
}

describe('DataManager', () => {
    let test;

    beforeEach(() => {
        test = new DataManagerTest();
    });

    describe('Data Operations', () => {
        it('should save valid data', async (done) => {
            const data = test.createTestData();
            
            await test.trackPromise(test.manager.saveData(data));

            expect(test.mockValidator.validate).toHaveBeenCalledWith(data);
            expect(test.mockStorage.save).toHaveBeenCalledWith(data);
            done();
        });

        it('should reject invalid data', async (done) => {
            const data = test.createTestData();
            test.mockValidator.validate.and.returnValue(false);

            try {
                await test.trackPromise(test.manager.saveData(data));
                done.fail('Should have rejected invalid data');
            } catch (error) {
                expect(error.message).toContain('Invalid data');
                expect(test.mockStorage.save).not.toHaveBeenCalled();
                done();
            }
        });

        it('should handle storage errors', async (done) => {
            const data = test.createTestData();
            test.mockStorage.save.and.rejectWith(new Error('Storage error'));

            try {
                await test.trackPromise(test.manager.saveData(data));
                done.fail('Should have thrown storage error');
            } catch (error) {
                expect(error.message).toContain('Storage error');
                expect(test.errorSpy).toHaveBeenCalled();
                done();
            }
        });
    });

    describe('Data Retrieval', () => {
        it('should load data with caching', async (done) => {
            const testData = [test.createTestData()];
            test.mockStorage.load.and.resolveTo(testData);

            // First load
            const result1 = await test.trackPromise(test.manager.loadData());
            expect(result1).toEqual(testData);
            expect(test.mockStorage.load).toHaveBeenCalledTimes(1);

            // Should use cache
            const result2 = await test.trackPromise(test.manager.loadData());
            expect(result2).toEqual(testData);
            expect(test.mockStorage.load).toHaveBeenCalledTimes(1);

            // After timeout, should reload
            await test.advanceTime(60000);
            const result3 = await test.trackPromise(test.manager.loadData());
            expect(result3).toEqual(testData);
            expect(test.mockStorage.load).toHaveBeenCalledTimes(2);

            done();
        });
    });

    describe('Event Handling', () => {
        it('should emit change events', async (done) => {
            const data = test.createTestData();
            const eventPromise = test.waitForEvent(test.manager, 'dataChanged');

            await test.trackPromise(test.manager.saveData(data));
            const event = await eventPromise;

            expect(event.data).toEqual(data);
            done();
        });
    });

    describe('Resource Management', () => {
        it('should cleanup resources', async (done) => {
            const eventSpy = jasmine.createSpy('eventListener');
            test.manager.on('dataChanged', eventSpy);

            await test.trackPromise(test.manager.dispose());
            
            await test.trackPromise(test.manager.saveData(test.createTestData()));
            expect(eventSpy).not.toHaveBeenCalled();
            expect(test.mockStorage.save).not.toHaveBeenCalled();
            done();
        });
    });
});

// example/src/DataManager.js
import { EventEmitter } from 'events';

export default class DataManager extends EventEmitter {
    constructor(storage, validator) {
        super();
        this.storage = storage;
        this.validator = validator;
        this.cache = null;
        this.cacheTime = null;
        this.disposed = false;
    }

    async saveData(data) {
        if (this.disposed) return;
        
        if (!this.validator.validate(data)) {
            throw new Error('Invalid data');
        }

        try {
            await this.storage.save(data);
            this.cache = null;
            this.emit('dataChanged', { data });
        } catch (error) {
            console.error('Save error:', error);
            throw error;
        }
    }

    async loadData() {
        if (this.disposed) return [];

        const now = Date.now();
        if (this.cache && now - this.cacheTime < 60000) {
            return this.cache;
        }

        this.cache = await this.storage.load();
        this.cacheTime = now;
        return this.cache;
    }

    async dispose() {
        this.disposed = true;
        this.cache = null;
        this.removeAllListeners();
    }
}