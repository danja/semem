import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs/promises';
import { JsonStore } from '../../../src/stores/JsonStore.js'; // NOTE: Adjust path if needed
import { MemoryRecord } from '../../../src/lib/MemoryRecord.js'; // NOTE: Adjust path if needed

// Mock the entire fs/promises module to avoid actual file I/O
vi.mock('fs/promises');

describe('JsonStore', () => {
    const testFilePath = '/tmp/test-memories.json';
    let store;

    beforeEach(() => {
        // Reset mocks before each test to ensure isolation
        vi.resetAllMocks();
        store = new JsonStore({ filePath: testFilePath });
    });

    describe('initialization', () => {
        it('should create and initialize an empty store if the data file does not exist', async () => {
            // Arrange: Simulate file not found error
            fs.readFile.mockRejectedValue({ code: 'ENOENT' });

            // Act
            await store.init();

            // Assert
            expect(store.memories).toEqual([]);
            // It should write an empty array to the new file
            expect(fs.writeFile).toHaveBeenCalledWith(testFilePath, '[]', 'utf-8');
        });

        it('should load memories from an existing file on initialization', async () => {
            // Arrange
            const existingData = [
                { id: '1', text: 'test memory', embedding: [0.1, 0.2], timestamp: Date.now(), score: 1 }
            ];
            fs.readFile.mockResolvedValue(JSON.stringify(existingData));

            // Act
            await store.init();

            // Assert
            expect(fs.readFile).toHaveBeenCalledWith(testFilePath, 'utf-8');
            expect(store.memories.length).toBe(1);
            // Assuming MemoryRecord is used to structure data
            expect(store.memories[0]).toBeInstanceOf(MemoryRecord);
            expect(store.memories[0].text).toBe('test memory');
        });

        it('should handle errors during file reading', async () => {
            // Arrange
            const error = new Error('Read permission denied');
            fs.readFile.mockRejectedValue(error);

            // Act & Assert
            await expect(store.init()).rejects.toThrow('Read permission denied');
        });
    });

    describe('add()', () => {
        beforeEach(async () => {
            // Start with an empty, initialized store for 'add' tests
            fs.readFile.mockRejectedValue({ code: 'ENOENT' });
            await store.init();
            // Clear the writeFile mock call from init()
            vi.clearAllMocks();
        });

        it('should add a new memory record and save the store to file', async () => {
            // Arrange
            // Assuming MemoryRecord can be instantiated like this
            const record = new MemoryRecord({ text: 'new record', embedding: [0.3, 0.4] });

            // Act
            await store.add(record);

            // Assert
            expect(store.memories).toContain(record);
            expect(store.memories.length).toBe(1);
            expect(fs.writeFile).toHaveBeenCalledOnce();
            expect(fs.writeFile).toHaveBeenCalledWith(testFilePath, expect.stringContaining('"text":"new record"'), 'utf-8');
        });
    });
});