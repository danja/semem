// tests/core/unit/stores/modules/Graph.test.js
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GraphModule } from '../../../../../src/stores/modules/Graph.js';

// Mock dependencies
vi.mock('../../../../../src/services/templates/TemplateLoader.js', () => ({
    TemplateLoader: vi.fn().mockImplementation(() => ({
        loadAndInterpolate: vi.fn().mockResolvedValue('MOCKED SPARQL QUERY')
    }))
}));

vi.mock('graphology', () => {
    const mockGraph = {
        order: 0,
        size: 0,
        addNode: vi.fn(),
        hasNode: vi.fn().mockReturnValue(false),
        addEdge: vi.fn(),
        edges: vi.fn().mockReturnValue([]),
        getEdgeAttribute: vi.fn().mockReturnValue(1),
        setEdgeAttribute: vi.fn(),
        clear: vi.fn(),
        nodes: vi.fn().mockReturnValue([]),
        extremities: vi.fn().mockReturnValue(['node1', 'node2']),
        copy: vi.fn().mockReturnValue({}),
        forEachNode: vi.fn(),
        forEachNeighbor: vi.fn(),
        neighbors: vi.fn().mockReturnValue([]),
        degree: vi.fn().mockReturnValue(2)
    };

    return {
        default: vi.fn().mockImplementation(() => mockGraph)
    };
});

describe('GraphModule', () => {
    let graphModule;
    let mockSparqlExecute;
    let graphName;
    let baseUri;

    beforeEach(() => {
        graphName = 'http://test.org/graph';
        baseUri = 'http://test.org/';

        mockSparqlExecute = {
            executeSparqlQuery: vi.fn().mockResolvedValue({
                results: { bindings: [] }
            }),
            executeSparqlUpdate: vi.fn().mockResolvedValue()
        };

        graphModule = new GraphModule(mockSparqlExecute, graphName, baseUri);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('constructor', () => {
        it('should initialize with required dependencies', () => {
            expect(graphModule.sparqlExecute).toBe(mockSparqlExecute);
            expect(graphModule.graphName).toBe(graphName);
            expect(graphModule.baseUri).toBe(baseUri);
            expect(graphModule.graph).toBeDefined();
        });
    });

    describe('traverseGraph', () => {
        it('should traverse graph with default options', async () => {
            const mockResult = {
                results: {
                    bindings: [
                        {
                            node: { value: 'http://example.org/node1' },
                            label: { value: 'Node 1' },
                            type: { value: 'Entity' },
                            distance: { value: '0' }
                        },
                        {
                            node: { value: 'http://example.org/node2' },
                            label: { value: 'Node 2' },
                            type: { value: 'Entity' },
                            distance: { value: '1' }
                        }
                    ]
                }
            };

            const mockEdgeResult = {
                results: {
                    bindings: [
                        {
                            source: { value: 'http://example.org/node1' },
                            target: { value: 'http://example.org/node2' },
                            label: { value: 'connects' },
                            type: { value: 'relation' }
                        }
                    ]
                }
            };

            mockSparqlExecute.executeSparqlQuery
                .mockResolvedValueOnce(mockResult)
                .mockResolvedValueOnce(mockEdgeResult);

            const result = await graphModule.traverseGraph('http://example.org/start');

            expect(result.nodes).toHaveLength(2);
            expect(result.edges).toHaveLength(1);
            expect(result.startNode).toBe('http://example.org/start');
            expect(result.depth).toBe(2);
        });

        it('should handle different traversal directions', async () => {
            await graphModule.traverseGraph('http://example.org/start', 3, { direction: 'outgoing' });

            const query = mockSparqlExecute.executeSparqlQuery.mock.calls[0][0];
            expect(query).toContain('ragno:connectsTo'); // Outgoing direction
        });

        it('should handle specific relation types', async () => {
            await graphModule.traverseGraph('http://example.org/start', 2, {
                relationTypes: ['knows', 'worksFor']
            });

            const query = mockSparqlExecute.executeSparqlQuery.mock.calls[0][0];
            expect(query).toContain('ragno:knows');
            expect(query).toContain('ragno:worksFor');
        });

        it('should handle traversal errors gracefully', async () => {
            mockSparqlExecute.executeSparqlQuery.mockRejectedValueOnce(new Error('SPARQL error'));

            const result = await graphModule.traverseGraph('http://example.org/start');

            expect(result.nodes).toEqual([]);
            expect(result.edges).toEqual([]);
        });
    });

    describe('validateCorpus', () => {
        it('should return corpus health statistics', async () => {
            const mockResult = {
                results: {
                    bindings: [
                        {
                            entityCount: { value: '100' },
                            unitCount: { value: '50' },
                            relationshipCount: { value: '80' },
                            communityCount: { value: '10' },
                            embeddingCount: { value: '120' }
                        }
                    ]
                }
            };

            mockSparqlExecute.executeSparqlQuery.mockResolvedValueOnce(mockResult);

            const health = await graphModule.validateCorpus();

            expect(health.healthy).toBe(true);
            expect(health.stats.entityCount).toBe(100);
            expect(health.stats.relationshipCount).toBe(80);
            expect(health.embeddingCoverage).toBeCloseTo(0.52, 2); // 120/(100+50+80)
            expect(health.connectivity).toBe(0.8); // 80/100
        });

        it('should detect unhealthy corpus', async () => {
            const mockResult = {
                results: {
                    bindings: [
                        {
                            entityCount: { value: '100' },
                            unitCount: { value: '50' },
                            relationshipCount: { value: '10' }, // Low connectivity
                            communityCount: { value: '0' }, // No communities
                            embeddingCount: { value: '30' } // Low embedding coverage
                        }
                    ]
                }
            };

            mockSparqlExecute.executeSparqlQuery.mockResolvedValueOnce(mockResult);

            const health = await graphModule.validateCorpus();

            expect(health.healthy).toBe(false);
            expect(health.recommendations).toContain('Low embedding coverage');
            expect(health.recommendations).toContain('Low graph connectivity');
            expect(health.recommendations).toContain('No communities detected');
        });

        it('should handle validation errors gracefully', async () => {
            mockSparqlExecute.executeSparqlQuery.mockRejectedValueOnce(new Error('Query failed'));

            const health = await graphModule.validateCorpus();

            expect(health.healthy).toBe(false);
            expect(health.error).toBe('Query failed');
            expect(health.recommendations).toContain('Unable to validate corpus');
        });
    });

    describe('updateGraph', () => {
        beforeEach(() => {
            // Reset mock calls
            graphModule.graph.hasNode.mockClear();
            graphModule.graph.addNode.mockClear();
            graphModule.graph.edges.mockClear();
            graphModule.graph.addEdge.mockClear();
        });

        it('should add new nodes', () => {
            const concepts = ['concept1', 'concept2'];
            graphModule.graph.hasNode.mockReturnValue(false);

            graphModule.updateGraph(concepts);

            expect(graphModule.graph.addNode).toHaveBeenCalledWith('concept1');
            expect(graphModule.graph.addNode).toHaveBeenCalledWith('concept2');
        });

        it('should create edges between concepts', () => {
            const concepts = ['concept1', 'concept2'];
            graphModule.graph.hasNode.mockReturnValue(true);
            graphModule.graph.edges.mockReturnValue([]); // No existing edges

            graphModule.updateGraph(concepts);

            expect(graphModule.graph.addEdge).toHaveBeenCalledWith('concept1', 'concept2', { weight: 1 });
        });

        it('should update existing edge weights', () => {
            const concepts = ['concept1', 'concept2'];
            graphModule.graph.hasNode.mockReturnValue(true);
            graphModule.graph.edges.mockReturnValue(['edge1']); // Existing edge
            graphModule.graph.getEdgeAttribute.mockReturnValue(2); // Current weight

            graphModule.updateGraph(concepts);

            expect(graphModule.graph.setEdgeAttribute).toHaveBeenCalledWith('edge1', 'weight', 3);
        });
    });

    describe('loadGraphFromStore', () => {
        it('should load graph successfully', async () => {
            const mockGraphData = {
                nodes: ['node1', 'node2'],
                edges: [
                    { source: 'node1', target: 'node2', weight: 2 }
                ]
            };

            const mockResult = {
                results: {
                    bindings: [
                        {
                            graphData: { value: JSON.stringify(mockGraphData) }
                        }
                    ]
                }
            };

            mockSparqlExecute.executeSparqlQuery.mockResolvedValueOnce(mockResult);

            const loaded = await graphModule.loadGraphFromStore();

            expect(loaded).toBe(true);
            expect(graphModule.graph.clear).toHaveBeenCalled();
            expect(graphModule.graph.addNode).toHaveBeenCalledWith('node1');
            expect(graphModule.graph.addNode).toHaveBeenCalledWith('node2');
            expect(graphModule.graph.addEdge).toHaveBeenCalledWith('node1', 'node2', { weight: 2 });
        });

        it('should return false when no graph found', async () => {
            mockSparqlExecute.executeSparqlQuery.mockResolvedValueOnce({
                results: { bindings: [] }
            });

            const loaded = await graphModule.loadGraphFromStore();

            expect(loaded).toBe(false);
        });

        it('should handle load errors gracefully', async () => {
            mockSparqlExecute.executeSparqlQuery.mockRejectedValueOnce(new Error('Load failed'));

            const loaded = await graphModule.loadGraphFromStore();

            expect(loaded).toBe(false);
        });
    });

    describe('persistGraphToStore', () => {
        it('should persist graph successfully', async () => {
            graphModule.graph.nodes.mockReturnValue(['node1', 'node2']);
            graphModule.graph.edges.mockReturnValue(['edge1']);
            graphModule.graph.extremities.mockReturnValue(['node1', 'node2']);
            graphModule.graph.getEdgeAttribute.mockReturnValue(3);

            await graphModule.persistGraphToStore();

            expect(mockSparqlExecute.executeSparqlUpdate).toHaveBeenCalledTimes(2); // clear + insert
        });
    });

    describe('getGraphStats', () => {
        it('should return comprehensive graph statistics', () => {
            graphModule.graph.order = 10; // 10 nodes
            graphModule.graph.size = 15; // 15 edges
            graphModule.graph.forEachNode = vi.fn((callback) => {
                // Mock a few nodes with neighbors
                callback('node1');
                callback('node2');
                callback('node3');
            });
            graphModule.graph.neighbors = vi.fn()
                .mockReturnValueOnce(['node2', 'node3']) // node1 neighbors
                .mockReturnValueOnce(['node1']) // node2 neighbors
                .mockReturnValueOnce(['node1']); // node3 neighbors
            graphModule.graph.hasEdge = vi.fn().mockReturnValue(true);

            const stats = graphModule.getGraphStats();

            expect(stats.nodeCount).toBe(10);
            expect(stats.edgeCount).toBe(15);
            expect(stats.avgDegree).toBe(3); // (2*15)/10
            expect(stats.density).toBeCloseTo(0.33, 2); // (2*15)/(10*9)
        });
    });

    describe('isGraphConnected', () => {
        it('should return true for empty graph', () => {
            graphModule.graph.order = 0;
            expect(graphModule.isGraphConnected()).toBe(true);
        });

        it('should return true for single node', () => {
            graphModule.graph.order = 1;
            expect(graphModule.isGraphConnected()).toBe(true);
        });

        it('should check connectivity via BFS', () => {
            graphModule.graph.order = 3;
            graphModule.graph.nodes.mockReturnValue(['node1', 'node2', 'node3']);

            // Mock BFS traversal
            let visitedNodes = new Set();
            graphModule.graph.forEachNeighbor = vi.fn((node, callback) => {
                if (node === 'node1' && !visitedNodes.has('node2')) {
                    visitedNodes.add('node2');
                    callback('node2');
                }
                if (node === 'node2' && !visitedNodes.has('node3')) {
                    visitedNodes.add('node3');
                    callback('node3');
                }
            });

            const connected = graphModule.isGraphConnected();
            expect(connected).toBe(true);
        });
    });

    describe('getMostCentralNodes', () => {
        it('should return nodes sorted by centrality', () => {
            graphModule.graph.order = 5;
            graphModule.graph.forEachNode = vi.fn((callback) => {
                callback('node1');
                callback('node2');
                callback('node3');
            });
            graphModule.graph.degree = vi.fn()
                .mockReturnValueOnce(3) // node1
                .mockReturnValueOnce(1) // node2
                .mockReturnValueOnce(2); // node3

            const central = graphModule.getMostCentralNodes(2);

            expect(central).toHaveLength(2);
            expect(central[0].node).toBe('node1'); // Highest degree
            expect(central[0].centrality).toBeCloseTo(0.75, 2); // 3/4
            expect(central[1].node).toBe('node3');
        });
    });

    describe('findCommunities', () => {
        it('should detect communities based on edge weights', () => {
            graphModule.graph.forEachNode = vi.fn((callback) => {
                callback('node1');
                callback('node2');
                callback('node3');
            });

            // Mock community detection
            const visited = new Set();
            graphModule.graph.neighbors = vi.fn((node) => {
                if (node === 'node1') return ['node2'];
                if (node === 'node2') return ['node1'];
                return [];
            });
            graphModule.graph.getEdgeAttribute = vi.fn().mockReturnValue(2); // High weight

            const communities = graphModule.findCommunities();

            expect(communities).toHaveLength(1); // One community found
            expect(communities[0]).toContain('node1');
            expect(communities[0]).toContain('node2');
        });
    });

    describe('clearGraph', () => {
        it('should clear the graph', () => {
            graphModule.clearGraph();
            expect(graphModule.graph.clear).toHaveBeenCalled();
        });
    });

    describe('getGraphCopy', () => {
        it('should return a copy of the graph', () => {
            const copy = graphModule.getGraphCopy();
            expect(graphModule.graph.copy).toHaveBeenCalled();
            expect(copy).toBeDefined();
        });
    });

    describe('cancelScheduledPersistence', () => {
        it('should cancel scheduled persistence', () => {
            const timers = vi.useFakeTimers();

            // Schedule persistence
            graphModule._scheduleGraphPersistence();
            expect(graphModule._graphPersistenceTimer).toBeTruthy();

            // Cancel it
            graphModule.cancelScheduledPersistence();
            expect(graphModule._graphPersistenceTimer).toBeNull();

            timers.useRealTimers();
        });
    });

    describe('dispose', () => {
        it('should dispose resources and cancel persistence', () => {
            const cancelSpy = vi.spyOn(graphModule, 'cancelScheduledPersistence');
            const clearSpy = vi.spyOn(graphModule, 'clearGraph');

            graphModule.dispose();

            expect(cancelSpy).toHaveBeenCalled();
            expect(clearSpy).toHaveBeenCalled();
        });
    });
});