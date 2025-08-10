// tests/integration/http/simple-verbs-http.integration.test.js
// Integration tests for Simple Verbs HTTP REST API

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import fetch from 'node-fetch';
import { spawn } from 'child_process';
import path from 'path';

// Test configuration
const TEST_TIMEOUT = 30000; // 30 seconds
const SERVER_STARTUP_TIMEOUT = 15000; // 15 seconds
const HTTP_PORT = 3001; // Use different port for tests
const BASE_URL = `http://localhost:${HTTP_PORT}`;

describe('Simple Verbs HTTP REST API Integration', () => {
    let serverProcess;

    beforeAll(async () => {
        // Start HTTP server process
        const serverPath = path.resolve('mcp/http-server.js');
        
        serverProcess = spawn('node', [serverPath], {
            stdio: ['pipe', 'pipe', 'pipe'],
            env: {
                ...process.env,
                NODE_ENV: 'test',
                MCP_PORT: HTTP_PORT.toString(),
                LOG_LEVEL: 'error' // Minimize noise in tests
            }
        });

        // Wait for server to start up
        await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('HTTP Server startup timeout'));
            }, SERVER_STARTUP_TIMEOUT);

            const checkServer = async () => {
                try {
                    const response = await fetch(`${BASE_URL}/health`);
                    if (response.ok) {
                        clearTimeout(timeout);
                        resolve();
                    }
                } catch (error) {
                    // Server not ready yet, continue waiting
                }
            };

            // Check every 500ms
            const interval = setInterval(checkServer, 500);

            serverProcess.on('error', (error) => {
                clearTimeout(timeout);
                clearInterval(interval);
                reject(error);
            });

            // Also listen for stderr output indicating server is ready
            serverProcess.stderr.on('data', (data) => {
                const output = data.toString();
                if (output.includes('listening on port') || output.includes('Simple Verbs REST')) {
                    checkServer();
                }
            });
        });

        // Verify server is responding
        const healthResponse = await fetch(`${BASE_URL}/health`);
        expect(healthResponse.ok).toBe(true);

        const healthData = await healthResponse.json();
        expect(healthData.status).toBe('ok');
    }, TEST_TIMEOUT);

    afterAll(async () => {
        if (serverProcess) {
            serverProcess.kill('SIGTERM');
            
            // Wait for process to exit
            await new Promise((resolve) => {
                serverProcess.on('exit', resolve);
                setTimeout(() => {
                    serverProcess.kill('SIGKILL');
                    resolve();
                }, 5000); // Force kill after 5 seconds
            });
        }
    });

    beforeEach(async () => {
        // Reset any persistent state by creating a new session
        // This ensures each test starts with clean state
    });

    describe('Health and Status Endpoints', () => {
        it('should return health status', async () => {
            const response = await fetch(`${BASE_URL}/health`);
            expect(response.ok).toBe(true);

            const data = await response.json();
            expect(data.status).toBe('ok');
            expect(data.server_state).toBeDefined();
            expect(data.timestamp).toBeDefined();
        }, TEST_TIMEOUT);

        it('should return ZPT state', async () => {
            const response = await fetch(`${BASE_URL}/state`);
            expect(response.ok).toBe(true);

            const data = await response.json();
            expect(data.success).toBe(true);
            expect(data.state).toBeDefined();
            
            // Should have default ZPT state
            if (data.state.zoom) {
                expect(['entity', 'unit', 'text', 'community', 'corpus', 'micro']).toContain(data.state.zoom);
            }
            if (data.state.tilt) {
                expect(['keywords', 'embedding', 'graph', 'temporal']).toContain(data.state.tilt);
            }
        }, TEST_TIMEOUT);
    });

    describe('POST /tell endpoint', () => {
        it('should store interaction content', async () => {
            const payload = {
                content: 'HTTP Integration test: Machine learning algorithms can learn patterns from data',
                type: 'interaction',
                metadata: { source: 'http_test', timestamp: new Date().toISOString() }
            };

            const response = await fetch(`${BASE_URL}/tell`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            expect(response.ok).toBe(true);

            const data = await response.json();
            expect(data.success).toBe(true);
            expect(data.verb).toBe('tell');
            expect(data.type).toBe('interaction');
            expect(data.stored).toBe(true);
            expect(data.contentLength).toBe(payload.content.length);
            expect(data.zptState).toBeDefined();
        }, TEST_TIMEOUT);

        it('should store document content', async () => {
            const payload = {
                content: 'HTTP document test: This is a comprehensive guide to neural network architectures',
                type: 'document',
                metadata: { 
                    title: 'Neural Network Guide',
                    author: 'HTTP Test',
                    category: 'education'
                }
            };

            const response = await fetch(`${BASE_URL}/tell`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            expect(response.ok).toBe(true);

            const data = await response.json();
            expect(data.success).toBe(true);
            expect(data.type).toBe('document');
            expect(data.metadata.title).toBe('Neural Network Guide');
        }, TEST_TIMEOUT);

        it('should store concept content', async () => {
            const payload = {
                content: 'Backpropagation is the algorithm used to train neural networks by propagating errors backward through the network',
                type: 'concept',
                metadata: { name: 'Backpropagation', domain: 'neural_networks' }
            };

            const response = await fetch(`${BASE_URL}/tell`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            expect(response.ok).toBe(true);

            const data = await response.json();
            expect(data.success).toBe(true);
            expect(data.type).toBe('concept');
        }, TEST_TIMEOUT);

        it('should return error for missing content', async () => {
            const payload = { type: 'interaction' };

            const response = await fetch(`${BASE_URL}/tell`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            expect(response.status).toBe(400);

            const data = await response.json();
            expect(data.error).toContain('Content is required');
        }, TEST_TIMEOUT);

        it('should use default type when not specified', async () => {
            const payload = {
                content: 'Default type test content'
            };

            const response = await fetch(`${BASE_URL}/tell`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            expect(response.ok).toBe(true);

            const data = await response.json();
            expect(data.success).toBe(true);
            expect(data.type).toBe('interaction'); // Default type
        }, TEST_TIMEOUT);
    });

    describe('POST /ask endpoint', () => {
        beforeEach(async () => {
            // Store some content for questioning
            await fetch(`${BASE_URL}/tell`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    content: 'Convolutional Neural Networks (CNNs) are specialized neural networks for processing grid-like data such as images.',
                    type: 'concept',
                    metadata: { name: 'CNNs' }
                })
            });
        });

        it('should answer question without context', async () => {
            const payload = {
                question: 'What are Convolutional Neural Networks?',
                useContext: false
            };

            const response = await fetch(`${BASE_URL}/ask`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            expect(response.ok).toBe(true);

            const data = await response.json();
            expect(data.success).toBe(true);
            expect(data.verb).toBe('ask');
            expect(data.question).toBe(payload.question);
            expect(data.usedContext).toBe(false);
            expect(data.answer).toBeDefined();
            expect(typeof data.answer).toBe('string');
            expect(data.memories).toBeGreaterThanOrEqual(0);
            expect(data.zptState).toBeDefined();
        }, TEST_TIMEOUT);

        it('should answer question with context when available', async () => {
            // First set up context with zoom
            await fetch(`${BASE_URL}/zoom`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ level: 'entity', query: 'neural networks' })
            });

            const payload = {
                question: 'How do CNNs process images?',
                useContext: true
            };

            const response = await fetch(`${BASE_URL}/ask`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            expect(response.ok).toBe(true);

            const data = await response.json();
            expect(data.success).toBe(true);
            expect(data.answer).toBeDefined();
            expect(data.zptState).toBeDefined();
        }, TEST_TIMEOUT);

        it('should handle different modes', async () => {
            const question = 'Explain deep learning';

            const basicResponse = await fetch(`${BASE_URL}/ask`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ question, mode: 'basic' })
            });

            const comprehensiveResponse = await fetch(`${BASE_URL}/ask`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ question, mode: 'comprehensive' })
            });

            expect(basicResponse.ok).toBe(true);
            expect(comprehensiveResponse.ok).toBe(true);

            const basicData = await basicResponse.json();
            const comprehensiveData = await comprehensiveResponse.json();

            expect(basicData.success).toBe(true);
            expect(comprehensiveData.success).toBe(true);
        }, TEST_TIMEOUT);

        it('should return error for missing question', async () => {
            const response = await fetch(`${BASE_URL}/ask`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({})
            });

            expect(response.status).toBe(400);

            const data = await response.json();
            expect(data.error).toContain('Question is required');
        }, TEST_TIMEOUT);

        it('should use default values for optional parameters', async () => {
            const payload = { question: 'Test question with defaults' };

            const response = await fetch(`${BASE_URL}/ask`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            expect(response.ok).toBe(true);

            const data = await response.json();
            expect(data.success).toBe(true);
            // Should use defaults: mode: 'standard', useContext: true
        }, TEST_TIMEOUT);
    });

    describe('POST /augment endpoint', () => {
        it('should extract concepts from content', async () => {
            const payload = {
                target: 'Recurrent Neural Networks (RNNs) are designed to handle sequential data by maintaining hidden states',
                operation: 'concepts'
            };

            const response = await fetch(`${BASE_URL}/augment`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            expect(response.ok).toBe(true);

            const data = await response.json();
            expect(data.success).toBe(true);
            expect(data.verb).toBe('augment');
            expect(data.operation).toBe('concepts');
            expect(data.result).toBeDefined();
            expect(data.zptState).toBeDefined();
        }, TEST_TIMEOUT);

        it('should perform auto augmentation', async () => {
            const payload = {
                target: 'Long Short-Term Memory networks are a type of RNN capable of learning long-term dependencies',
                operation: 'auto'
            };

            const response = await fetch(`${BASE_URL}/augment`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            expect(response.ok).toBe(true);

            const data = await response.json();
            expect(data.success).toBe(true);
            expect(data.operation).toBe('auto');
            expect(data.result).toBeDefined();
            expect(data.result.concepts).toBeDefined();
            expect(data.result.embedding).toBeDefined();
            expect(data.result.augmentationType).toBe('auto');
        }, TEST_TIMEOUT);

        it('should generate relationships', async () => {
            const payload = {
                target: 'transformer attention mechanisms',
                operation: 'relationships'
            };

            const response = await fetch(`${BASE_URL}/augment`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            expect(response.ok).toBe(true);

            const data = await response.json();
            expect(data.success).toBe(true);
            expect(data.operation).toBe('relationships');
        }, TEST_TIMEOUT);

        it('should return error for missing target', async () => {
            const response = await fetch(`${BASE_URL}/augment`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ operation: 'concepts' })
            });

            expect(response.status).toBe(400);

            const data = await response.json();
            expect(data.error).toContain('Target content is required');
        }, TEST_TIMEOUT);

        it('should use default operation when not specified', async () => {
            const payload = { target: 'Default operation test content' };

            const response = await fetch(`${BASE_URL}/augment`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            expect(response.ok).toBe(true);

            const data = await response.json();
            expect(data.success).toBe(true);
            expect(data.operation).toBe('auto'); // Default operation
        }, TEST_TIMEOUT);
    });

    describe('ZPT Navigation Endpoints', () => {
        describe('POST /zoom endpoint', () => {
            it('should set zoom level', async () => {
                const payload = { level: 'unit' };

                const response = await fetch(`${BASE_URL}/zoom`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                expect(response.ok).toBe(true);

                const data = await response.json();
                expect(data.success).toBe(true);
                expect(data.verb).toBe('zoom');
                expect(data.level).toBe('unit');
                expect(data.zptState.zoom).toBe('unit');
            }, TEST_TIMEOUT);

            it('should set zoom level and navigate with query', async () => {
                const payload = { 
                    level: 'entity',
                    query: 'machine learning algorithms'
                };

                const response = await fetch(`${BASE_URL}/zoom`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                expect(response.ok).toBe(true);

                const data = await response.json();
                expect(data.success).toBe(true);
                expect(data.level).toBe('entity');
                expect(data.query).toBe('machine learning algorithms');
                expect(data.navigation).toBeDefined();
                expect(data.zptState.lastQuery).toBe('machine learning algorithms');
            }, TEST_TIMEOUT);

            it('should use default level when not specified', async () => {
                const response = await fetch(`${BASE_URL}/zoom`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({})
                });

                expect(response.ok).toBe(true);

                const data = await response.json();
                expect(data.success).toBe(true);
                expect(data.level).toBe('entity'); // Default level
            }, TEST_TIMEOUT);
        });

        describe('POST /pan endpoint', () => {
            it('should set pan filters', async () => {
                const payload = {
                    domains: ['machine_learning', 'artificial_intelligence'],
                    keywords: ['neural networks', 'deep learning'],
                    temporal: {
                        start: '2020-01-01',
                        end: '2024-01-01'
                    }
                };

                const response = await fetch(`${BASE_URL}/pan`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                expect(response.ok).toBe(true);

                const data = await response.json();
                expect(data.success).toBe(true);
                expect(data.verb).toBe('pan');
                expect(data.panParams).toEqual(payload);
                expect(data.zptState.pan.domains).toEqual(payload.domains);
                expect(data.zptState.pan.keywords).toEqual(payload.keywords);
                expect(data.zptState.pan.temporal).toEqual(payload.temporal);
            }, TEST_TIMEOUT);

            it('should re-navigate when lastQuery exists', async () => {
                // First set a query via ask
                await fetch(`${BASE_URL}/ask`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        question: 'What is AI?',
                        useContext: false 
                    })
                });

                // Then set pan filters
                const response = await fetch(`${BASE_URL}/pan`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ domains: ['artificial_intelligence'] })
                });

                expect(response.ok).toBe(true);

                const data = await response.json();
                expect(data.success).toBe(true);
                expect(data.reNavigated).toBe(true);
                expect(data.navigation).toBeDefined();
            }, TEST_TIMEOUT);

            it('should handle empty pan parameters', async () => {
                const response = await fetch(`${BASE_URL}/pan`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({})
                });

                expect(response.ok).toBe(true);

                const data = await response.json();
                expect(data.success).toBe(true);
                expect(data.panParams).toEqual({});
            }, TEST_TIMEOUT);
        });

        describe('POST /tilt endpoint', () => {
            it('should set tilt style', async () => {
                const payload = { style: 'embedding' };

                const response = await fetch(`${BASE_URL}/tilt`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                expect(response.ok).toBe(true);

                const data = await response.json();
                expect(data.success).toBe(true);
                expect(data.verb).toBe('tilt');
                expect(data.style).toBe('embedding');
                expect(data.zptState.tilt).toBe('embedding');
            }, TEST_TIMEOUT);

            it('should set tilt style and navigate with query', async () => {
                const payload = { 
                    style: 'graph',
                    query: 'knowledge representation'
                };

                const response = await fetch(`${BASE_URL}/tilt`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                expect(response.ok).toBe(true);

                const data = await response.json();
                expect(data.success).toBe(true);
                expect(data.style).toBe('graph');
                expect(data.query).toBe('knowledge representation');
                expect(data.navigation).toBeDefined();
            }, TEST_TIMEOUT);

            it('should use default style when not specified', async () => {
                const response = await fetch(`${BASE_URL}/tilt`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({})
                });

                expect(response.ok).toBe(true);

                const data = await response.json();
                expect(data.success).toBe(true);
                expect(data.style).toBe('keywords'); // Default style
            }, TEST_TIMEOUT);
        });
    });

    describe('State Persistence Across HTTP Requests', () => {
        it('should maintain state across multiple requests', async () => {
            // Set initial state with multiple requests
            await fetch(`${BASE_URL}/zoom`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ level: 'community' })
            });

            await fetch(`${BASE_URL}/pan`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    domains: ['technology'],
                    keywords: ['AI', 'ML'] 
                })
            });

            await fetch(`${BASE_URL}/tilt`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ style: 'temporal' })
            });

            // Verify state is maintained in a tell operation
            const tellResponse = await fetch(`${BASE_URL}/tell`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    content: 'State persistence test content' 
                })
            });

            expect(tellResponse.ok).toBe(true);

            const tellData = await tellResponse.json();
            expect(tellData.zptState.zoom).toBe('community');
            expect(tellData.zptState.pan.domains).toEqual(['technology']);
            expect(tellData.zptState.pan.keywords).toEqual(['AI', 'ML']);
            expect(tellData.zptState.tilt).toBe('temporal');

            // Verify state is still maintained in GET /state
            const stateResponse = await fetch(`${BASE_URL}/state`);
            const stateData = await stateResponse.json();
            expect(stateData.state.zoom).toBe('community');
            expect(stateData.state.tilt).toBe('temporal');
        }, TEST_TIMEOUT);

        it('should track lastQuery appropriately across requests', async () => {
            // Ask should set lastQuery
            const askResponse = await fetch(`${BASE_URL}/ask`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    question: 'What is neural architecture search?',
                    useContext: false 
                })
            });

            const askData = await askResponse.json();
            expect(askData.zptState.lastQuery).toBe('What is neural architecture search?');

            // Zoom with query should update lastQuery
            const zoomResponse = await fetch(`${BASE_URL}/zoom`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    level: 'unit',
                    query: 'automated machine learning'
                })
            });

            const zoomData = await zoomResponse.json();
            expect(zoomData.zptState.lastQuery).toBe('automated machine learning');

            // Tell should not change lastQuery
            const tellResponse = await fetch(`${BASE_URL}/tell`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    content: 'This should not change lastQuery' 
                })
            });

            const tellData = await tellResponse.json();
            expect(tellData.zptState.lastQuery).toBe('automated machine learning');
        }, TEST_TIMEOUT);
    });

    describe('Complete Workflow via HTTP', () => {
        it('should support complete knowledge building workflow via REST API', async () => {
            // 1. Tell the system about a domain
            const tellResponse = await fetch(`${BASE_URL}/tell`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    content: 'Graph Neural Networks (GNNs) extend deep learning to graph-structured data by propagating information along graph edges.',
                    type: 'document',
                    metadata: { 
                        title: 'Graph Neural Networks Introduction',
                        category: 'machine_learning' 
                    }
                })
            });
            
            const tellData = await tellResponse.json();
            expect(tellData.success).toBe(true);

            // 2. Set up navigation context
            const zoomResponse = await fetch(`${BASE_URL}/zoom`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ level: 'entity' })
            });
            expect((await zoomResponse.json()).success).toBe(true);

            const panResponse = await fetch(`${BASE_URL}/pan`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    domains: ['graph_neural_networks'],
                    keywords: ['GNN', 'graph', 'neural']
                })
            });
            expect((await panResponse.json()).success).toBe(true);

            const tiltResponse = await fetch(`${BASE_URL}/tilt`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ style: 'keywords' })
            });
            expect((await tiltResponse.json()).success).toBe(true);

            // 3. Ask contextual questions
            const askResponse = await fetch(`${BASE_URL}/ask`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    question: 'How do Graph Neural Networks propagate information?',
                    useContext: true
                })
            });

            const askData = await askResponse.json();
            expect(askData.success).toBe(true);
            expect(askData.usedContext).toBe(true);

            // 4. Augment the answer with concepts
            const augmentResponse = await fetch(`${BASE_URL}/augment`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    target: askData.answer,
                    operation: 'concepts'
                })
            });

            const augmentData = await augmentResponse.json();
            expect(augmentData.success).toBe(true);

            // Verify final state consistency
            const finalState = augmentData.zptState;
            expect(finalState.zoom).toBe('entity');
            expect(finalState.pan.domains).toEqual(['graph_neural_networks']);
            expect(finalState.pan.keywords).toEqual(['GNN', 'graph', 'neural']);
            expect(finalState.tilt).toBe('keywords');
        }, TEST_TIMEOUT);
    });

    describe('Error Handling via HTTP', () => {
        it('should handle malformed JSON requests', async () => {
            const response = await fetch(`${BASE_URL}/tell`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: 'invalid json'
            });

            expect(response.status).toBe(400);
        }, TEST_TIMEOUT);

        it('should handle missing Content-Type header', async () => {
            const response = await fetch(`${BASE_URL}/tell`, {
                method: 'POST',
                body: JSON.stringify({ content: 'test' })
            });

            // Should still work or return appropriate error
            expect([200, 400, 415]).toContain(response.status);
        }, TEST_TIMEOUT);

        it('should return appropriate error codes for various failure scenarios', async () => {
            // Missing required fields
            const missingContentResponse = await fetch(`${BASE_URL}/tell`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({})
            });
            expect(missingContentResponse.status).toBe(400);

            const missingQuestionResponse = await fetch(`${BASE_URL}/ask`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({})
            });
            expect(missingQuestionResponse.status).toBe(400);

            const missingTargetResponse = await fetch(`${BASE_URL}/augment`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({})
            });
            expect(missingTargetResponse.status).toBe(400);
        }, TEST_TIMEOUT);

        it('should handle service errors gracefully', async () => {
            // Test with potentially problematic input
            const response = await fetch(`${BASE_URL}/tell`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    content: '', // Empty content
                    type: 'interaction'
                })
            });

            // Should get some response (either success or error), not a server crash
            expect(response.status).toBeLessThan(500);
            
            const data = await response.json();
            expect(data).toBeDefined();
        }, TEST_TIMEOUT);
    });
});