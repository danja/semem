// tests/core/unit/stores/modules/ZPT.test.js
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ZPT } from '../../../../../src/stores/modules/ZPT.js';
import { readFileSync } from 'fs';

// Mock fs module
vi.mock('fs', () => ({
    readFileSync: vi.fn()
}));

describe('ZPT', () => {
    let zpt;
    let mockSparqlExecute;
    let graphName;

    beforeEach(() => {
        graphName = 'http://test.org/graph';

        mockSparqlExecute = {
            executeSparqlQuery: vi.fn().mockResolvedValue({
                results: { bindings: [] }
            })
        };

        // Mock template files
        readFileSync.mockImplementation((path) => {
            if (path.includes('micro.sparql')) {
                return 'SELECT * WHERE { GRAPH <{{graphName}}> { ?uri a semem:Interaction . {{filters}} } } LIMIT {{limit}}';
            }
            if (path.includes('entity.sparql')) {
                return 'SELECT * WHERE { GRAPH <{{graphName}}> { ?uri a ragno:Entity . {{filters}} } } LIMIT {{limit}}';
            }
            if (path.includes('relationship.sparql')) {
                return 'SELECT * WHERE { GRAPH <{{graphName}}> { ?uri a ragno:Relationship . {{filters}} } } LIMIT {{limit}}';
            }
            if (path.includes('community.sparql')) {
                return 'SELECT * WHERE { GRAPH <{{graphName}}> { ?uri a ragno:Community . {{filters}} } } LIMIT {{limit}}';
            }
            if (path.includes('corpus.sparql')) {
                return 'SELECT * WHERE { GRAPH <{{graphName}}> { ?uri a ragno:Corpus . {{filters}} } } LIMIT {{limit}}';
            }
            throw new Error(`Template not found: ${path}`);
        });

        zpt = new ZPT(mockSparqlExecute, graphName);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('constructor', () => {
        it('should initialize with required dependencies', () => {
            expect(zpt.sparqlExecute).toBe(mockSparqlExecute);
            expect(zpt.graphName).toBe(graphName);
        });

        it('should load ZPT query templates', () => {
            expect(readFileSync).toHaveBeenCalledTimes(5); // 5 template files
            expect(zpt.zptTemplates.micro).toBeDefined();
            expect(zpt.zptTemplates.entity).toBeDefined();
            expect(zpt.zptTemplates.relationship).toBeDefined();
            expect(zpt.zptTemplates.community).toBeDefined();
            expect(zpt.zptTemplates.corpus).toBeDefined();
        });

        it('should throw error if template loading fails', () => {
            readFileSync.mockImplementation(() => {
                throw new Error('File not found');
            });

            expect(() => new ZPT(mockSparqlExecute, graphName)).toThrow('Could not load ZPT template');
        });
    });

    describe('queryByZoomLevel', () => {
        it('should execute query for valid zoom level', async () => {
            const queryConfig = {
                zoomLevel: 'entity',
                filters: { domains: ['test'] },
                limit: 50
            };

            const mockResult = {
                results: {
                    bindings: [
                        {
                            uri: { value: 'http://example.org/entity1' },
                            label: { value: 'Test Entity' },
                            type: { value: 'Person' },
                            frequency: { value: '5' },
                            centrality: { value: '0.8' }
                        }
                    ]
                }
            };

            mockSparqlExecute.executeSparqlQuery.mockResolvedValueOnce(mockResult);

            const results = await zpt.queryByZoomLevel(queryConfig);

            expect(mockSparqlExecute.executeSparqlQuery).toHaveBeenCalledWith(
                expect.stringContaining('ragno:Entity')
            );
            expect(results).toHaveLength(1);
            expect(results[0]).toEqual({
                id: 'http://example.org/entity1',
                type: 'entity',
                timestamp: expect.any(String),
                label: 'Test Entity',
                entityType: 'Person',
                prefLabel: '',
                frequency: 5,
                centrality: 0.8,
                isEntryPoint: false,
                description: ''
            });
        });

        it('should throw error for invalid zoom level', async () => {
            const queryConfig = { zoomLevel: 'invalid' };

            await expect(zpt.queryByZoomLevel(queryConfig)).rejects.toThrow('Unknown zoom level: invalid');
        });

        it('should use default values for missing parameters', async () => {
            await zpt.queryByZoomLevel({ zoomLevel: 'micro' });

            const call = mockSparqlExecute.executeSparqlQuery.mock.calls[0];
            const query = call[0];

            expect(query).toContain('LIMIT 25'); // Default limit
        });

        it('should replace template variables correctly', async () => {
            const queryConfig = {
                zoomLevel: 'micro',
                filters: { keywords: ['test'] },
                limit: 100
            };

            await zpt.queryByZoomLevel(queryConfig);

            const call = mockSparqlExecute.executeSparqlQuery.mock.calls[0];
            const query = call[0];

            expect(query).toContain(`GRAPH <${graphName}>`);
            expect(query).toContain('LIMIT 100');
            expect(query).toContain('FILTER(REGEX(?content'); // From filter clauses
        });
    });

    describe('buildFilterClauses', () => {
        it('should build domain filters', () => {
            const filters = { domains: ['science', 'technology'] };
            const clauses = zpt.buildFilterClauses(filters);

            expect(clauses).toContain('FILTER(REGEX(?label');
            expect(clauses).toContain('"science"');
            expect(clauses).toContain('"technology"');
        });

        it('should build keyword filters', () => {
            const filters = { keywords: ['test', 'example'] };
            const clauses = zpt.buildFilterClauses(filters);

            expect(clauses).toContain('FILTER(REGEX(?content');
            expect(clauses).toContain('"test"');
            expect(clauses).toContain('"example"');
        });

        it('should build entity filters', () => {
            const filters = { entities: ['http://example.org/entity1'] };
            const clauses = zpt.buildFilterClauses(filters);

            expect(clauses).toContain('VALUES ?relatedEntity');
            expect(clauses).toContain('<http://example.org/entity1>');
            expect(clauses).toContain('?uri ragno:connectsTo ?relatedEntity');
        });

        it('should build temporal filters', () => {
            const filters = {
                temporal: {
                    start: '2023-01-01T00:00:00Z',
                    end: '2023-12-31T23:59:59Z'
                }
            };
            const clauses = zpt.buildFilterClauses(filters);

            expect(clauses).toContain('FILTER(?timestamp >= "2023-01-01T00:00:00Z"');
            expect(clauses).toContain('FILTER(?timestamp <= "2023-12-31T23:59:59Z"');
        });

        it('should build numeric threshold filters', () => {
            const filters = {
                similarityThreshold: 0.8,
                minFrequency: 5,
                minCentrality: 0.7,
                minWeight: 0.5,
                minCommunitySize: 10,
                minCohesion: 0.6
            };
            const clauses = zpt.buildFilterClauses(filters);

            expect(clauses).toContain('FILTER(?similarity >= 0.8)');
            expect(clauses).toContain('FILTER(?frequency >= 5)');
            expect(clauses).toContain('FILTER(?centrality >= 0.7)');
            expect(clauses).toContain('FILTER(?weight >= 0.5)');
            expect(clauses).toContain('FILTER(?memberCount >= 10)');
            expect(clauses).toContain('FILTER(?cohesion >= 0.6)');
        });

        it('should build type filters', () => {
            const filters = {
                entityTypes: ['Person', 'Organization'],
                relationshipTypes: ['knows', 'worksFor']
            };
            const clauses = zpt.buildFilterClauses(filters);

            expect(clauses).toContain('VALUES ?type { "Person" "Organization" }');
            expect(clauses).toContain('VALUES ?relType { ragno:knows ragno:worksFor }');
        });

        it('should handle empty filters', () => {
            const clauses = zpt.buildFilterClauses({});
            expect(clauses).toBe('');
        });
    });

    describe('_parseQueryResults', () => {
        it('should parse micro-level results', () => {
            const result = {
                results: {
                    bindings: [
                        {
                            uri: { value: 'http://example.org/interaction1' },
                            content: { value: 'Test content' },
                            metadata: { value: '{"type":"test"}' },
                            similarity: { value: '0.9' },
                            prompt: { value: 'Test prompt' },
                            response: { value: 'Test response' },
                            accessCount: { value: '3' },
                            decayFactor: { value: '0.95' }
                        }
                    ]
                }
            };

            const corpuscles = zpt._parseQueryResults(result, 'micro');

            expect(corpuscles).toHaveLength(1);
            expect(corpuscles[0]).toEqual({
                id: 'http://example.org/interaction1',
                type: 'micro',
                timestamp: expect.any(String),
                content: 'Test content',
                metadata: { type: 'test' },
                similarity: 0.9,
                prompt: 'Test prompt',
                response: 'Test response',
                accessCount: 3,
                decayFactor: 0.95
            });
        });

        it('should parse entity-level results', () => {
            const result = {
                results: {
                    bindings: [
                        {
                            uri: { value: 'http://example.org/entity1' },
                            label: { value: 'Test Entity' },
                            type: { value: 'Person' },
                            prefLabel: { value: 'Mr. Test' },
                            frequency: { value: '10' },
                            centrality: { value: '0.85' },
                            isEntryPoint: { value: 'true' },
                            description: { value: 'A test entity' }
                        }
                    ]
                }
            };

            const corpuscles = zpt._parseQueryResults(result, 'entity');

            expect(corpuscles[0]).toEqual({
                id: 'http://example.org/entity1',
                type: 'entity',
                timestamp: expect.any(String),
                label: 'Test Entity',
                entityType: 'Person',
                prefLabel: 'Mr. Test',
                frequency: 10,
                centrality: 0.85,
                isEntryPoint: true,
                description: 'A test entity'
            });
        });

        it('should parse relationship-level results', () => {
            const result = {
                results: {
                    bindings: [
                        {
                            uri: { value: 'http://example.org/rel1' },
                            label: { value: 'knows' },
                            source: { value: 'http://example.org/person1' },
                            target: { value: 'http://example.org/person2' },
                            type: { value: 'social' },
                            weight: { value: '0.8' },
                            confidence: { value: '0.9' },
                            bidirectional: { value: 'true' }
                        }
                    ]
                }
            };

            const corpuscles = zpt._parseQueryResults(result, 'relationship');

            expect(corpuscles[0]).toEqual({
                id: 'http://example.org/rel1',
                type: 'relationship',
                timestamp: expect.any(String),
                label: 'knows',
                source: 'http://example.org/person1',
                target: 'http://example.org/person2',
                relationshipType: 'social',
                weight: 0.8,
                confidence: 0.9,
                bidirectional: true
            });
        });

        it('should handle missing optional fields', () => {
            const result = {
                results: {
                    bindings: [
                        {
                            uri: { value: 'http://example.org/entity1' }
                        }
                    ]
                }
            };

            const corpuscles = zpt._parseQueryResults(result, 'entity');

            expect(corpuscles[0]).toEqual({
                id: 'http://example.org/entity1',
                type: 'entity',
                timestamp: expect.any(String),
                label: '',
                entityType: '',
                prefLabel: '',
                frequency: 0,
                centrality: 0,
                isEntryPoint: false,
                description: ''
            });
        });

        it('should handle parse errors gracefully', () => {
            const result = {
                results: {
                    bindings: [
                        {
                            uri: { value: 'http://example.org/entity1' },
                            metadata: { value: 'invalid json' } // Will cause parse error
                        }
                    ]
                }
            };

            const corpuscles = zpt._parseQueryResults(result, 'micro');

            expect(corpuscles).toHaveLength(0); // Should skip failed parsing
        });
    });

    describe('getAvailableZoomLevels', () => {
        it('should return all available zoom levels', () => {
            const levels = zpt.getAvailableZoomLevels();
            expect(levels).toEqual(['micro', 'entity', 'relationship', 'community', 'corpus']);
        });
    });

    describe('isValidZoomLevel', () => {
        it('should validate zoom levels', () => {
            expect(zpt.isValidZoomLevel('entity')).toBe(true);
            expect(zpt.isValidZoomLevel('invalid')).toBe(false);
        });
    });

    describe('getZoomLevelHierarchy', () => {
        it('should return hierarchy from detailed to general', () => {
            const hierarchy = zpt.getZoomLevelHierarchy();
            expect(hierarchy).toEqual(['micro', 'entity', 'relationship', 'community', 'corpus']);
        });
    });

    describe('createDrillDownQuery', () => {
        it('should create drill-down query from corpus to community', () => {
            const config = zpt.createDrillDownQuery('corpus', 'http://example.org/corpus1');

            expect(config.zoomLevel).toBe('community');
            expect(config.filters.entities).toContain('http://example.org/corpus1');
            expect(config.limit).toBe(50);
        });

        it('should create drill-down query from entity to micro', () => {
            const config = zpt.createDrillDownQuery('entity', 'http://example.org/entity1');

            expect(config.zoomLevel).toBe('micro');
            expect(config.filters.entities).toContain('http://example.org/entity1');
        });

        it('should throw error for invalid drill-down', () => {
            expect(() => zpt.createDrillDownQuery('micro', 'test')).toThrow('Cannot drill down from zoom level: micro');
            expect(() => zpt.createDrillDownQuery('invalid', 'test')).toThrow('Cannot drill down from zoom level: invalid');
        });
    });

    describe('createZoomOutQuery', () => {
        it('should create zoom-out query from micro to entity', () => {
            const config = zpt.createZoomOutQuery('micro', ['http://example.org/entity1']);

            expect(config.zoomLevel).toBe('entity');
            expect(config.filters.entities).toContain('http://example.org/entity1');
            expect(config.limit).toBe(25);
        });

        it('should create zoom-out query from relationship to community', () => {
            const config = zpt.createZoomOutQuery('relationship');

            expect(config.zoomLevel).toBe('community');
            expect(config.filters).toEqual({});
        });

        it('should throw error for invalid zoom-out', () => {
            expect(() => zpt.createZoomOutQuery('corpus')).toThrow('Cannot zoom out from zoom level: corpus');
            expect(() => zpt.createZoomOutQuery('invalid')).toThrow('Cannot zoom out from zoom level: invalid');
        });
    });

    describe('_parseJsonValue', () => {
        it('should parse valid JSON', () => {
            const result = zpt._parseJsonValue('{"key": "value"}');
            expect(result).toEqual({ key: 'value' });
        });

        it('should handle invalid JSON', () => {
            const result = zpt._parseJsonValue('invalid json');
            expect(result).toEqual({});
        });

        it('should handle undefined values', () => {
            expect(zpt._parseJsonValue(undefined)).toEqual({});
            expect(zpt._parseJsonValue('undefined')).toEqual({});
        });
    });

    describe('getTemplate', () => {
        it('should return template for valid zoom level', () => {
            const template = zpt.getTemplate('entity');
            expect(template).toBeDefined();
            expect(template).toContain('ragno:Entity');
        });

        it('should return null for invalid zoom level', () => {
            const template = zpt.getTemplate('invalid');
            expect(template).toBeNull();
        });
    });

    describe('dispose', () => {
        it('should dispose resources cleanly', () => {
            expect(() => zpt.dispose()).not.toThrow();
        });
    });
});