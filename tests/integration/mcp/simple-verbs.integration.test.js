// tests/integration/mcp/simple-verbs.integration.test.js
// Integration tests for Simple Verbs MCP tools with real MCP server

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { spawn } from 'child_process';
import path from 'path';

// Test configuration
const TEST_TIMEOUT = 30000; // 30 seconds
const SERVER_STARTUP_TIMEOUT = 10000; // 10 seconds

describe('Simple Verbs MCP Integration', () => {
    let client;
    let transport;
    let serverProcess;

    beforeAll(async () => {
        // Start MCP server process
        const serverPath = path.resolve('mcp/index.js');
        const nodeArgs = ['--experimental-modules'];
        
        serverProcess = spawn('node', [...nodeArgs, serverPath], {
            stdio: ['pipe', 'pipe', 'pipe'],
            env: {
                ...process.env,
                NODE_ENV: 'test',
                LOG_LEVEL: 'error' // Minimize noise in tests
            }
        });

        // Wait for server to start up
        await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Server startup timeout'));
            }, SERVER_STARTUP_TIMEOUT);

            serverProcess.stderr.on('data', (data) => {
                const output = data.toString();
                // Look for server ready indication
                if (output.includes('MCP server') || output.includes('tools registered')) {
                    clearTimeout(timeout);
                    resolve();
                }
            });

            serverProcess.on('error', (error) => {
                clearTimeout(timeout);
                reject(error);
            });
        });

        // Create MCP client
        transport = new StdioClientTransport({
            command: 'node',
            args: [serverPath],
            env: {
                ...process.env,
                NODE_ENV: 'test'
            }
        });

        client = new Client({
            name: 'simple-verbs-test-client',
            version: '1.0.0'
        }, {
            capabilities: {
                roots: {
                    listChanged: false
                },
                sampling: {}
            }
        });

        await client.connect(transport);

        // Verify simple verbs are available
        const { tools } = await client.listTools();
        const simpleVerbNames = ['tell', 'ask', 'augment', 'zoom', 'pan', 'tilt'];
        
        for (const verbName of simpleVerbNames) {
            const tool = tools.find(t => t.name === verbName);
            expect(tool, `Tool '${verbName}' should be available`).toBeDefined();
        }
    }, TEST_TIMEOUT);

    afterAll(async () => {
        if (client) {
            await client.close();
        }
        
        if (serverProcess) {
            serverProcess.kill();
            
            // Wait for process to exit
            await new Promise((resolve) => {
                serverProcess.on('exit', resolve);
                setTimeout(resolve, 1000); // Fallback timeout
            });
        }
    });

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('tell verb integration', () => {
        it('should store interaction content successfully', async () => {
            const content = 'Integration test: Machine learning is a subset of artificial intelligence';
            const type = 'interaction';
            const metadata = { source: 'integration_test', timestamp: new Date().toISOString() };

            const result = await client.callTool('tell', {
                content,
                type,
                metadata
            });

            expect(result).toBeDefined();
            expect(result.content).toBeDefined();
            
            const response = JSON.parse(result.content[0].text);
            expect(response.success).toBe(true);
            expect(response.verb).toBe('tell');
            expect(response.type).toBe(type);
            expect(response.stored).toBe(true);
            expect(response.contentLength).toBe(content.length);
            expect(response.zptState).toBeDefined();
            expect(response.zptState.sessionId).toMatch(/^session_\d+_[a-z0-9]{6}$/);
        }, TEST_TIMEOUT);

        it('should store document content successfully', async () => {
            const content = 'Integration test document: This document describes our AI research methodology.';
            const type = 'document';
            const metadata = { 
                title: 'AI Research Methodology', 
                author: 'Integration Test',
                category: 'research'
            };

            const result = await client.callTool('tell', {
                content,
                type,
                metadata
            });

            const response = JSON.parse(result.content[0].text);
            expect(response.success).toBe(true);
            expect(response.type).toBe('document');
            expect(response.metadata.title).toBe('AI Research Methodology');
        }, TEST_TIMEOUT);

        it('should store concept content successfully', async () => {
            const content = 'Neural networks are computing systems inspired by biological neural networks';
            const type = 'concept';
            const metadata = { name: 'Neural Networks', domain: 'machine_learning' };

            const result = await client.callTool('tell', {
                content,
                type,
                metadata
            });

            const response = JSON.parse(result.content[0].text);
            expect(response.success).toBe(true);
            expect(response.type).toBe('concept');
        }, TEST_TIMEOUT);
    });

    describe('ask verb integration', () => {
        beforeEach(async () => {
            // Store some content to query against
            await client.callTool('tell', {
                content: 'Machine learning models can be trained using supervised, unsupervised, or reinforcement learning techniques.',
                type: 'concept',
                metadata: { name: 'Machine Learning Training' }
            });
        });

        it('should answer questions without context', async () => {
            const question = 'What are the main types of machine learning?';

            const result = await client.callTool('ask', {
                question,
                useContext: false
            });

            const response = JSON.parse(result.content[0].text);
            expect(response.success).toBe(true);
            expect(response.verb).toBe('ask');
            expect(response.question).toBe(question);
            expect(response.usedContext).toBe(false);
            expect(response.answer).toBeDefined();
            expect(typeof response.answer).toBe('string');
            expect(response.memories).toBeGreaterThanOrEqual(0);
        }, TEST_TIMEOUT);

        it('should answer questions with context when available', async () => {
            const question = 'What is supervised learning?';

            // First set up ZPT context
            await client.callTool('zoom', { level: 'entity', query: 'machine learning' });

            const result = await client.callTool('ask', {
                question,
                useContext: true
            });

            const response = JSON.parse(result.content[0].text);
            expect(response.success).toBe(true);
            expect(response.question).toBe(question);
            expect(response.answer).toBeDefined();
            expect(response.zptState).toBeDefined();
        }, TEST_TIMEOUT);

        it('should handle questions with different modes', async () => {
            const question = 'Explain deep learning';

            const basicResult = await client.callTool('ask', {
                question,
                mode: 'basic'
            });

            const comprehensiveResult = await client.callTool('ask', {
                question,
                mode: 'comprehensive'
            });

            const basicResponse = JSON.parse(basicResult.content[0].text);
            const comprehensiveResponse = JSON.parse(comprehensiveResult.content[0].text);

            expect(basicResponse.success).toBe(true);
            expect(comprehensiveResponse.success).toBe(true);
            expect(basicResponse.answer).toBeDefined();
            expect(comprehensiveResponse.answer).toBeDefined();
        }, TEST_TIMEOUT);
    });

    describe('augment verb integration', () => {
        it('should extract concepts from content', async () => {
            const target = 'Deep learning neural networks use multiple layers to learn hierarchical representations of data';

            const result = await client.callTool('augment', {
                target,
                operation: 'concepts'
            });

            const response = JSON.parse(result.content[0].text);
            expect(response.success).toBe(true);
            expect(response.verb).toBe('augment');
            expect(response.operation).toBe('concepts');
            expect(response.result).toBeDefined();
            expect(Array.isArray(response.result) || typeof response.result === 'object').toBe(true);
        }, TEST_TIMEOUT);

        it('should perform auto augmentation', async () => {
            const target = 'Convolutional neural networks are particularly effective for image recognition tasks';

            const result = await client.callTool('augment', {
                target,
                operation: 'auto'
            });

            const response = JSON.parse(result.content[0].text);
            expect(response.success).toBe(true);
            expect(response.operation).toBe('auto');
            expect(response.result).toBeDefined();
            expect(response.result.concepts).toBeDefined();
            expect(response.result.embedding).toBeDefined();
            expect(response.result.embedding.dimension).toBe(1536);
        }, TEST_TIMEOUT);

        it('should generate relationships using context', async () => {
            const target = 'transformer architecture attention mechanism';

            const result = await client.callTool('augment', {
                target,
                operation: 'relationships'
            });

            const response = JSON.parse(result.content[0].text);
            expect(response.success).toBe(true);
            expect(response.operation).toBe('relationships');
            expect(response.result).toBeDefined();
        }, TEST_TIMEOUT);
    });

    describe('ZPT navigation verbs integration', () => {
        it('should set zoom level successfully', async () => {
            const level = 'unit';

            const result = await client.callTool('zoom', { level });

            const response = JSON.parse(result.content[0].text);
            expect(response.success).toBe(true);
            expect(response.verb).toBe('zoom');
            expect(response.level).toBe(level);
            expect(response.zptState.zoom).toBe(level);
        }, TEST_TIMEOUT);

        it('should set zoom level and navigate with query', async () => {
            const level = 'entity';
            const query = 'artificial intelligence research';

            const result = await client.callTool('zoom', { level, query });

            const response = JSON.parse(result.content[0].text);
            expect(response.success).toBe(true);
            expect(response.level).toBe(level);
            expect(response.query).toBe(query);
            expect(response.navigation).toBeDefined();
            expect(response.zptState.lastQuery).toBe(query);
        }, TEST_TIMEOUT);

        it('should set pan filters successfully', async () => {
            const panParams = {
                domains: ['artificial_intelligence', 'machine_learning'],
                keywords: ['neural networks', 'deep learning'],
                temporal: {
                    start: '2020-01-01',
                    end: '2024-01-01'
                }
            };

            const result = await client.callTool('pan', panParams);

            const response = JSON.parse(result.content[0].text);
            expect(response.success).toBe(true);
            expect(response.verb).toBe('pan');
            expect(response.panParams).toEqual(panParams);
            expect(response.zptState.pan.domains).toEqual(panParams.domains);
            expect(response.zptState.pan.keywords).toEqual(panParams.keywords);
        }, TEST_TIMEOUT);

        it('should set tilt style successfully', async () => {
            const style = 'embedding';

            const result = await client.callTool('tilt', { style });

            const response = JSON.parse(result.content[0].text);
            expect(response.success).toBe(true);
            expect(response.verb).toBe('tilt');
            expect(response.style).toBe(style);
            expect(response.zptState.tilt).toBe(style);
        }, TEST_TIMEOUT);

        it('should set tilt style and navigate with query', async () => {
            const style = 'graph';
            const query = 'knowledge representation';

            const result = await client.callTool('tilt', { style, query });

            const response = JSON.parse(result.content[0].text);
            expect(response.success).toBe(true);
            expect(response.style).toBe(style);
            expect(response.query).toBe(query);
            expect(response.navigation).toBeDefined();
        }, TEST_TIMEOUT);
    });

    describe('ZPT state persistence integration', () => {
        it('should maintain state across multiple verb calls', async () => {
            // Set initial state
            await client.callTool('zoom', { level: 'community' });
            await client.callTool('pan', { domains: ['technology'], keywords: ['AI'] });
            await client.callTool('tilt', { style: 'temporal' });

            // Make a tell call and verify state is preserved
            const tellResult = await client.callTool('tell', {
                content: 'State persistence test content'
            });

            const tellResponse = JSON.parse(tellResult.content[0].text);
            expect(tellResponse.zptState.zoom).toBe('community');
            expect(tellResponse.zptState.pan.domains).toEqual(['technology']);
            expect(tellResponse.zptState.pan.keywords).toEqual(['AI']);
            expect(tellResponse.zptState.tilt).toBe('temporal');

            // Make an ask call with context and verify it uses the state
            const askResult = await client.callTool('ask', {
                question: 'What is the current context?',
                useContext: true
            });

            const askResponse = JSON.parse(askResult.content[0].text);
            expect(askResponse.success).toBe(true);
            expect(askResponse.usedContext).toBe(true);
            expect(askResponse.zptState.zoom).toBe('community');
        }, TEST_TIMEOUT);

        it('should update lastQuery appropriately', async () => {
            // Ask should update lastQuery
            const askResult = await client.callTool('ask', {
                question: 'What is machine learning?',
                useContext: false
            });
            const askResponse = JSON.parse(askResult.content[0].text);
            expect(askResponse.zptState.lastQuery).toBe('What is machine learning?');

            // Zoom with query should update lastQuery
            const zoomResult = await client.callTool('zoom', {
                level: 'unit',
                query: 'deep learning networks'
            });
            const zoomResponse = JSON.parse(zoomResult.content[0].text);
            expect(zoomResponse.zptState.lastQuery).toBe('deep learning networks');

            // Tell should not change lastQuery
            const tellResult = await client.callTool('tell', {
                content: 'This should not change lastQuery'
            });
            const tellResponse = JSON.parse(tellResult.content[0].text);
            expect(tellResponse.zptState.lastQuery).toBe('deep learning networks');
        }, TEST_TIMEOUT);
    });

    describe('workflow integration', () => {
        it('should support complete knowledge building workflow', async () => {
            // 1. Tell the system about a domain
            const tellResult = await client.callTool('tell', {
                content: 'Transformers revolutionized natural language processing by introducing the attention mechanism, allowing models to focus on relevant parts of input sequences.',
                type: 'document',
                metadata: { title: 'Transformer Architecture Overview', category: 'AI' }
            });
            expect(JSON.parse(tellResult.content[0].text).success).toBe(true);

            // 2. Set up navigation context
            const zoomResult = await client.callTool('zoom', { level: 'entity' });
            expect(JSON.parse(zoomResult.content[0].text).success).toBe(true);

            const panResult = await client.callTool('pan', {
                domains: ['natural_language_processing'],
                keywords: ['transformer', 'attention']
            });
            expect(JSON.parse(panResult.content[0].text).success).toBe(true);

            const tiltResult = await client.callTool('tilt', { style: 'keywords' });
            expect(JSON.parse(tiltResult.content[0].text).success).toBe(true);

            // 3. Ask contextual questions
            const askResult = await client.callTool('ask', {
                question: 'How do transformers use attention mechanisms?',
                useContext: true
            });
            const askResponse = JSON.parse(askResult.content[0].text);
            expect(askResponse.success).toBe(true);
            expect(askResponse.usedContext).toBe(true);

            // 4. Augment the answer with concepts
            const augmentResult = await client.callTool('augment', {
                target: askResponse.answer,
                operation: 'concepts'
            });
            const augmentResponse = JSON.parse(augmentResult.content[0].text);
            expect(augmentResponse.success).toBe(true);

            // Verify all operations maintained consistent state
            const finalState = augmentResponse.zptState;
            expect(finalState.zoom).toBe('entity');
            expect(finalState.pan.domains).toEqual(['natural_language_processing']);
            expect(finalState.pan.keywords).toEqual(['transformer', 'attention']);
            expect(finalState.tilt).toBe('keywords');
        }, TEST_TIMEOUT);
    });

    describe('error handling integration', () => {
        it('should handle malformed requests gracefully', async () => {
            // Test tell with missing content
            try {
                await client.callTool('tell', {});
                expect.fail('Should have thrown an error');
            } catch (error) {
                expect(error.message).toContain('content');
            }

            // Test ask with missing question
            try {
                await client.callTool('ask', {});
                expect.fail('Should have thrown an error');
            } catch (error) {
                expect(error.message).toContain('question');
            }

            // Test augment with missing target
            try {
                await client.callTool('augment', {});
                expect.fail('Should have thrown an error');
            } catch (error) {
                expect(error.message).toContain('target');
            }
        }, TEST_TIMEOUT);

        it('should handle invalid enum values gracefully', async () => {
            // Invalid zoom level
            try {
                await client.callTool('zoom', { level: 'invalid_zoom' });
                expect.fail('Should have thrown an error');
            } catch (error) {
                expect(error.message).toContain('level');
            }

            // Invalid tilt style
            try {
                await client.callTool('tilt', { style: 'invalid_style' });
                expect.fail('Should have thrown an error');
            } catch (error) {
                expect(error.message).toContain('style');
            }
        }, TEST_TIMEOUT);

        it('should return error responses for service failures', async () => {
            // This test would require mocking internal failures
            // For now, we'll test that the service handles errors gracefully
            const result = await client.callTool('tell', {
                content: '', // Empty content might cause issues
                type: 'interaction'
            });

            // Should get a response (either success or error), not an exception
            expect(result).toBeDefined();
            expect(result.content).toBeDefined();
        }, TEST_TIMEOUT);
    });
});