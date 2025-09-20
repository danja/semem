// tests/core/unit/stores/modules/Store.test.js
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Store } from '../../../../../src/stores/modules/Store.js';
import { v4 as uuidv4 } from 'uuid';

// Mock dependencies
vi.mock('../../../../../src/services/templates/TemplateLoader.js', () => ({
    TemplateLoader: vi.fn().mockImplementation(() => ({
        loadAndInterpolate: vi.fn().mockResolvedValue('MOCKED SPARQL QUERY')
    }))
}));

vi.mock('../../../../../src/utils/WorkflowLogger.js', () => ({
    WorkflowLogger: vi.fn().mockImplementation(() => ({
        startOperation: vi.fn().mockReturnValue('op-123'),
        createOperationLogger: vi.fn().mockReturnValue({
            step: vi.fn(),
            complete: vi.fn(),
            fail: vi.fn()
        })
    }))
}));

describe('Store', () => {
    let store;
    let mockSparqlExecute;
    let graphName;

    beforeEach(() => {
        graphName = 'http://test.org/graph';

        mockSparqlExecute = {
            verify: vi.fn().mockResolvedValue(),
            executeSparqlQuery: vi.fn().mockResolvedValue({
                results: { bindings: [] }
            }),
            executeSparqlUpdate: vi.fn().mockResolvedValue(),
            beginTransaction: vi.fn().mockResolvedValue(),
            commitTransaction: vi.fn().mockResolvedValue(),
            rollbackTransaction: vi.fn().mockResolvedValue()
        };

        store = new Store(mockSparqlExecute, graphName, 768);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('constructor', () => {
        it('should initialize with required dependencies', () => {
            expect(store.sparqlExecute).toBe(mockSparqlExecute);
            expect(store.graphName).toBe(graphName);
            expect(store.dimension).toBe(768);
        });

        it('should use default dimension', () => {
            const s = new Store(mockSparqlExecute, graphName);
            expect(s.dimension).toBe(768);
        });
    });

    describe('loadHistory', () => {
        it('should load memory interactions successfully', async () => {
            const mockResult = {
                results: {
                    bindings: [
                        {
                            id: { value: 'test-id-1' },
                            prompt: { value: 'test prompt' },
                            output: { value: 'test output' },
                            embedding: { value: JSON.stringify(new Array(768).fill(0.5)) },
                            timestamp: { value: '1000000' },
                            accessCount: { value: '3' },
                            concepts: { value: JSON.stringify(['concept1', 'concept2']) },
                            decayFactor: { value: '0.95' },
                            memoryType: { value: 'short-term' }
                        },
                        {
                            id: { value: 'test-id-2' },
                            prompt: { value: 'test prompt 2' },
                            output: { value: 'test output 2' },
                            embedding: { value: JSON.stringify(new Array(768).fill(0.3)) },
                            timestamp: { value: '2000000' },
                            accessCount: { value: '1' },
                            concepts: { value: JSON.stringify(['concept3']) },
                            decayFactor: { value: '1.0' },
                            memoryType: { value: 'long-term' }
                        }
                    ]
                }
            };

            mockSparqlExecute.executeSparqlQuery.mockResolvedValueOnce(mockResult);

            const [shortTerm, longTerm] = await store.loadHistory();

            expect(mockSparqlExecute.verify).toHaveBeenCalled();
            expect(shortTerm).toHaveLength(1);
            expect(longTerm).toHaveLength(1);
            expect(shortTerm[0]).toEqual({
                id: 'test-id-1',
                prompt: 'test prompt',
                output: 'test output',
                embedding: expect.any(Array),
                timestamp: 1000000,
                accessCount: 3,
                concepts: ['concept1', 'concept2'],
                decayFactor: 0.95
            });
        });

        it('should handle malformed embeddings gracefully', async () => {
            const mockResult = {
                results: {
                    bindings: [
                        {
                            id: { value: 'test-id-1' },
                            prompt: { value: 'test prompt' },
                            output: { value: 'test output' },
                            embedding: { value: 'invalid json' },
                            timestamp: { value: '1000000' },
                            accessCount: { value: '1' },
                            concepts: { value: '[]' },
                            decayFactor: { value: '1.0' },
                            memoryType: { value: 'short-term' }
                        }
                    ]
                }
            };

            mockSparqlExecute.executeSparqlQuery.mockResolvedValueOnce(mockResult);

            const [shortTerm, longTerm] = await store.loadHistory();

            expect(shortTerm).toHaveLength(1);
            expect(shortTerm[0].embedding).toEqual(new Array(768).fill(0)); // Default embedding
        });

        it('should handle query errors gracefully', async () => {
            mockSparqlExecute.executeSparqlQuery.mockRejectedValueOnce(new Error('SPARQL error'));

            const [shortTerm, longTerm] = await store.loadHistory();

            expect(shortTerm).toEqual([]);
            expect(longTerm).toEqual([]);
        });
    });

    describe('saveMemoryToHistory', () => {
        let mockMemoryStore;

        beforeEach(() => {
            mockMemoryStore = {
                shortTermMemory: [
                    {
                        id: 'test-1',
                        prompt: 'test prompt',
                        output: 'test output',
                        embedding: new Array(768).fill(0.5),
                        timestamp: 1000000,
                        accessCount: 1,
                        concepts: ['concept1'],
                        decayFactor: 1.0
                    }
                ],
                longTermMemory: []
            };
        });

        it('should save memory to history successfully', async () => {
            await store.saveMemoryToHistory(mockMemoryStore);

            expect(mockSparqlExecute.verify).toHaveBeenCalled();
            expect(mockSparqlExecute.beginTransaction).toHaveBeenCalled();
            expect(mockSparqlExecute.executeSparqlUpdate).toHaveBeenCalledTimes(2); // clear + insert
            expect(mockSparqlExecute.commitTransaction).toHaveBeenCalled();
        });

        it('should rollback on error', async () => {
            mockSparqlExecute.executeSparqlUpdate.mockRejectedValueOnce(new Error('Update failed'));

            await expect(store.saveMemoryToHistory(mockMemoryStore)).rejects.toThrow('Update failed');

            expect(mockSparqlExecute.rollbackTransaction).toHaveBeenCalled();
        });

        it('should handle string length errors specifically', async () => {
            const stringLengthError = new RangeError('string length exceeded');
            mockSparqlExecute.executeSparqlUpdate.mockRejectedValueOnce(stringLengthError);

            await expect(store.saveMemoryToHistory(mockMemoryStore)).rejects.toThrow('String length error in SPARQL store');
            expect(mockSparqlExecute.rollbackTransaction).toHaveBeenCalled();
        });
    });

    describe('store', () => {
        it('should store single interaction successfully', async () => {
            const data = {
                id: uuidv4(),
                prompt: 'test prompt',
                response: 'test response',
                embedding: new Array(768).fill(0.5),
                concepts: ['concept1'],
                metadata: { memoryType: 'short-term' }
            };

            await store.store(data);

            expect(mockSparqlExecute.executeSparqlUpdate).toHaveBeenCalled();
            const query = mockSparqlExecute.executeSparqlUpdate.mock.calls[0][0];
            expect(query).toContain(data.id);
            expect(query).toContain('semem:Interaction');
        });

        it('should throw error for missing id', async () => {
            const data = { prompt: 'test' };

            await expect(store.store(data)).rejects.toThrow('Data must have an id field');
        });

        it('should use custom graph from metadata', async () => {
            const data = {
                id: uuidv4(),
                prompt: 'test',
                metadata: { graph: 'http://custom.org/graph' }
            };

            await store.store(data);

            const query = mockSparqlExecute.executeSparqlUpdate.mock.calls[0][0];
            expect(query).toContain('http://custom.org/graph');
        });
    });

    describe('storeEntity', () => {
        it('should store entity successfully', async () => {
            const entity = {
                id: 'http://example.org/entity1',
                label: 'Test Entity',
                subType: 'Person',
                embedding: new Array(768).fill(0.5),
                frequency: 10,
                centrality: 0.8,
                isEntryPoint: true,
                description: 'A test entity'
            };

            await store.storeEntity(entity);

            expect(mockSparqlExecute.executeSparqlUpdate).toHaveBeenCalled();
        });

        it('should throw error for missing id', async () => {
            const entity = { label: 'Test' };

            await expect(store.storeEntity(entity)).rejects.toThrow('Entity must have an id field');
        });
    });

    describe('storeSemanticUnit', () => {
        it('should store semantic unit successfully', async () => {
            const unit = {
                id: 'http://example.org/unit1',
                content: 'Test content',
                summary: 'Test summary',
                embedding: new Array(768).fill(0.5),
                tokenCount: 100,
                importance: 0.7,
                entities: ['http://example.org/entity1'],
                partOf: 'http://example.org/corpus1'
            };

            await store.storeSemanticUnit(unit);

            expect(mockSparqlExecute.executeSparqlUpdate).toHaveBeenCalled();
            const query = mockSparqlExecute.executeSparqlUpdate.mock.calls[0][0];
            expect(query).toContain('ragno:SemanticUnit');
            expect(query).toContain('Test content');
        });
    });

    describe('storeRelationship', () => {
        it('should store relationship successfully', async () => {
            const relationship = {
                id: 'http://example.org/rel1',
                source: 'http://example.org/entity1',
                target: 'http://example.org/entity2',
                label: 'knows',
                type: 'SocialRelation',
                weight: 0.8,
                confidence: 0.9,
                properties: { strength: 'strong' }
            };

            await store.storeRelationship(relationship);

            expect(mockSparqlExecute.executeSparqlUpdate).toHaveBeenCalled();
            const query = mockSparqlExecute.executeSparqlUpdate.mock.calls[0][0];
            expect(query).toContain('ragno:Relationship');
            expect(query).toContain('ragno:source');
            expect(query).toContain('ragno:target');
        });

        it('should throw error for missing required fields', async () => {
            const relationship = { id: 'test', source: 'test' }; // missing target

            await expect(store.storeRelationship(relationship)).rejects.toThrow('Relationship must have id, source, and target fields');
        });
    });

    describe('storeCommunity', () => {
        it('should store community successfully', async () => {
            const community = {
                id: 'http://example.org/community1',
                label: 'Test Community',
                cohesion: 0.8,
                size: 25,
                members: ['http://example.org/entity1', 'http://example.org/entity2'],
                description: 'A test community'
            };

            await store.storeCommunity(community);

            expect(mockSparqlExecute.executeSparqlUpdate).toHaveBeenCalled();
            const query = mockSparqlExecute.executeSparqlUpdate.mock.calls[0][0];
            expect(query).toContain('ragno:Community');
            expect(query).toContain('ragno:hasMember');
        });
    });

    describe('storeConcepts', () => {
        it('should store concepts with relationships', async () => {
            const concepts = [
                { label: 'concept1', confidence: 0.8, frequency: 5 },
                { label: 'concept2', confidence: 0.9, frequency: 3, embedding: new Array(768).fill(0.5) }
            ];
            const sourceEntityUri = 'http://example.org/entity1';

            await store.storeConcepts(concepts, sourceEntityUri);

            expect(mockSparqlExecute.executeSparqlUpdate).toHaveBeenCalled();
            const query = mockSparqlExecute.executeSparqlUpdate.mock.calls[0][0];
            expect(query).toContain('ragno:Concept');
            expect(query).toContain('ragno:hasConceptualRelation');
            expect(query).toContain('ragno:hasEmbedding'); // For concept with embedding
        });

        it('should handle empty concepts array', async () => {
            await store.storeConcepts([], 'http://example.org/entity1');
            expect(mockSparqlExecute.executeSparqlUpdate).not.toHaveBeenCalled();
        });

        it('should handle null concepts', async () => {
            await store.storeConcepts(null, 'http://example.org/entity1');
            expect(mockSparqlExecute.executeSparqlUpdate).not.toHaveBeenCalled();
        });
    });

    describe('generateConceptURI', () => {
        it('should generate consistent URIs', () => {
            const uri1 = store.generateConceptURI('Test Concept');
            const uri2 = store.generateConceptURI('Test Concept');

            expect(uri1).toBe(uri2);
            expect(uri1).toContain('ragno/concept/');
            expect(uri1).toContain('test-concept');
        });

        it('should handle special characters', () => {
            const uri = store.generateConceptURI('Test & Special! Concept?');
            expect(uri).toContain('test-special-concept');
            expect(uri).not.toContain('&');
            expect(uri).not.toContain('!');
        });
    });

    describe('validateEmbedding', () => {
        it('should validate correct embedding', () => {
            const embedding = new Array(768).fill(0.5);
            expect(() => store.validateEmbedding(embedding)).not.toThrow();
        });

        it('should reject non-array', () => {
            expect(() => store.validateEmbedding('not array')).toThrow('Embedding must be an array');
        });

        it('should reject wrong dimension', () => {
            const embedding = new Array(512).fill(0.5);
            expect(() => store.validateEmbedding(embedding)).toThrow('Embedding dimension mismatch');
        });

        it('should reject invalid numbers', () => {
            const embedding = new Array(768).fill(0.5);
            embedding[0] = NaN;
            expect(() => store.validateEmbedding(embedding)).toThrow('Embedding must contain only valid numbers');
        });
    });

    describe('_escapeSparqlString', () => {
        it('should escape special characters', () => {
            const input = 'Test "string" with \n newline and \\ backslash';
            const escaped = store._escapeSparqlString(input);

            expect(escaped).toContain('\\"');
            expect(escaped).toContain('\\n');
            expect(escaped).toContain('\\\\');
        });

        it('should handle non-string input', () => {
            expect(store._escapeSparqlString(123)).toBe('123');
            expect(store._escapeSparqlString(null)).toBe('null');
        });
    });

    describe('_generateInsertStatements', () => {
        it('should generate valid insert statements', () => {
            const memories = [
                {
                    id: 'test-1',
                    prompt: 'test prompt',
                    output: 'test output',
                    embedding: new Array(768).fill(0.5),
                    timestamp: 1000000,
                    accessCount: 1,
                    concepts: ['concept1'],
                    decayFactor: 1.0
                }
            ];

            const statements = store._generateInsertStatements(memories, 'short-term');

            expect(statements).toContain('_:interactionshort-term0');
            expect(statements).toContain('semem:Interaction');
            expect(statements).toContain('ragno:Unit');
            expect(statements).toContain('test prompt');
        });

        it('should handle invalid embeddings', () => {
            const memories = [
                {
                    id: 'test-1',
                    prompt: 'test',
                    output: 'test',
                    embedding: [1, 2, 3], // Wrong dimension
                    timestamp: 1000000,
                    accessCount: 1,
                    concepts: [],
                    decayFactor: 1.0
                }
            ];

            const statements = store._generateInsertStatements(memories, 'short-term');

            expect(statements).toContain('semem:embedding """[]"""'); // Should use empty array
        });
    });

    describe('_generateConceptStatements', () => {
        it('should generate concept statements', () => {
            const memories = [
                {
                    id: 'test-1',
                    concepts: ['concept1', 'concept2']
                }
            ];

            const statements = store._generateConceptStatements(memories);

            expect(statements).toContain('ragno:Concept');
            expect(statements).toContain('concept1');
            expect(statements).toContain('concept2');
            expect(statements).toContain('ragno:extractedFrom');
        });

        it('should handle non-string concepts', () => {
            const memories = [
                {
                    id: 'test-1',
                    concepts: ['valid concept', null, '', 123]
                }
            ];

            const statements = store._generateConceptStatements(memories);

            expect(statements).toContain('valid concept');
            // Should skip null, empty, and non-string concepts
            expect(statements.split('ragno:Concept').length - 1).toBe(1);
        });
    });

    describe('dispose', () => {
        it('should dispose resources cleanly', () => {
            expect(() => store.dispose()).not.toThrow();
        });
    });
});