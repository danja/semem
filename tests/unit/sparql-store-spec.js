import SPARQLStore from '../../src/stores/SPARQLStore.js';

describe('SPARQLStore', () => {
    let store;
    let mockFetch;
    
    const endpoint = {
        query: 'http://example.org/sparql/query',
        update: 'http://example.org/sparql/update'
    };

    beforeEach(() => {
        // Mock fetch API
        mockFetch = jasmine.createSpy('fetch').and.returnValue(
            Promise.resolve({
                ok: true,
                json: () => Promise.resolve({
                    results: {
                        bindings: [{
                            id: { value: 'test-id' },
                            prompt: { value: 'test prompt' },
                            output: { value: 'test output' },
                            embedding: { value: '[0,1,2]' },
                            timestamp: { value: '1234567890' },
                            accessCount: { value: '1' },
                            concepts: { value: '["test"]' },
                            decayFactor: { value: '1.0' },
                            memoryType: { value: 'short-term' }
                        }]
                    }
                })
            })
        );
        global.fetch = mockFetch;
        global.Buffer = {
            from: (str) => ({ toString: () => 'mock-base64' })
        };

        store = new SPARQLStore(endpoint, {
            user: 'testuser',
            password: 'testpass',
            graphName: 'http://test.org/memory'
        });
    });

    afterEach(() => {
        delete global.fetch;
        delete global.Buffer;
    });

    describe('loadHistory', () => {
        it('should load and parse memory data correctly', async () => {
            const [shortTerm, longTerm] = await store.loadHistory();

            expect(shortTerm.length).toBe(1);
            expect(longTerm.length).toBe(0);
            
            const memory = shortTerm[0];
            expect(memory.id).toBe('test-id');
            expect(memory.prompt).toBe('test prompt');
            expect(memory.embedding).toEqual([0,1,2]);
            expect(memory.timestamp).toBe(1234567890);
            expect(memory.concepts).toEqual(['test']);
        });

        it('should handle query errors', async () => {
            mockFetch.and.returnValue(Promise.resolve({ ok: false, status: 500 }));
            
            await expectAsync(store.loadHistory())
                .toBeRejectedWithError('SPARQL query failed: 500');
        });
    });

    describe('saveMemoryToHistory', () => {
        const mockMemoryStore = {
            shortTermMemory: [{
                id: 'test-id',
                prompt: 'test prompt',
                output: 'test output',
                embedding: [0,1,2],
                timestamp: 1234567890,
                accessCount: 1,
                concepts: ['test'],
                decayFactor: 1.0
            }],
            longTermMemory: []
        };

        it('should save memory data correctly', async () => {
            await store.saveMemoryToHistory(mockMemoryStore);

            expect(mockFetch).toHaveBeenCalledWith(
                endpoint.update,
                jasmine.objectContaining({
                    method: 'POST',
                    headers: jasmine.objectContaining({
                        'Content-Type': 'application/sparql-update'
                    })
                })
            );
        });

        it('should handle update errors', async () => {
            mockFetch.and.returnValue(Promise.resolve({ ok: false, status: 500 }));
            
            await expectAsync(store.saveMemoryToHistory(mockMemoryStore))
                .toBeRejectedWithError('SPARQL update failed: 500');
        });
    });

    describe('transaction handling', () => {
        it('should manage transactions correctly', async () => {
            await store.beginTransaction();
            expect(store.inTransaction).toBeTrue();
            
            await store.commitTransaction();
            expect(store.inTransaction).toBeFalse();
        });

        it('should handle transaction rollback', async () => {
            await store.beginTransaction();
            await store.rollbackTransaction();
            expect(store.inTransaction).toBeFalse();
        });

        it('should prevent nested transactions', async () => {
            await store.beginTransaction();
            await expectAsync(store.beginTransaction())
                .toBeRejectedWithError('Transaction already in progress');
        });
    });

    describe('verify', () => {
        it('should verify graph existence', async () => {
            mockFetch.and.returnValue(
                Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({ boolean: true })
                })
            );

            const isValid = await store.verify();
            expect(isValid).toBeTrue();
        });

        it('should handle verification failures', async () => {
            mockFetch.and.returnValue(Promise.resolve({ ok: false }));
            
            const isValid = await store.verify();
            expect(isValid).toBeFalse();
        });
    });

    describe('cleanup', () => {
        it('should clean up transaction state on close', async () => {
            await store.beginTransaction();
            await store.close();
            expect(store.inTransaction).toBeFalse();
        });
    });
});
