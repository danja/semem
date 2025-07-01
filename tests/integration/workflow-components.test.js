/**
 * Integration tests for workflow components
 * 
 * These tests verify that the workflow components (BeerQAWorkflow, WikidataWorkflow, FeedbackWorkflow)
 * work correctly and maintain compatibility with the original examples.
 */

import { describe, test, expect, beforeEach } from 'vitest';
import BeerQAWorkflow from '../../src/compose/workflows/BeerQAWorkflow.js';
import WikidataWorkflow from '../../src/compose/workflows/WikidataWorkflow.js';
import FeedbackWorkflow from '../../src/compose/workflows/FeedbackWorkflow.js';

// Mock implementations
class MockLLMHandler {
    constructor(responses = {}) {
        this.responses = responses;
        this.calls = [];
    }

    async generateResponse(prompt) {
        this.calls.push(prompt);
        
        if (prompt.includes('completeness')) {
            return this.responses.completeness || 'SCORE: 0.7\nREASONING: Good answer\nMISSING: Some details';
        }
        
        if (prompt.includes('follow-up')) {
            return this.responses.followUp || '1. What about X?\n2. What about Y?';
        }
        
        if (prompt.includes('enhanced')) {
            return this.responses.enhanced || 'Enhanced answer with research findings.';
        }
        
        return this.responses.default || 'This is a comprehensive answer about the question.';
    }
}

class MockSPARQLHelper {
    constructor() {
        this.queries = [];
        this.updates = [];
        this.mockData = {
            corpuscles: [
                { uri: 'http://example.org/c1', label: 'Test Corpuscle 1', content: 'Content 1' },
                { uri: 'http://example.org/c2', label: 'Test Corpuscle 2', content: 'Content 2' }
            ]
        };
    }

    async executeSelect(query) {
        this.queries.push(query);
        
        // Mock BeerQA corpuscle queries
        if (query.includes('ragno:Corpuscle') && query.includes('rdfs:label')) {
            return {
                success: true,
                data: {
                    results: {
                        bindings: this.mockData.corpuscles.map(c => ({
                            corpuscle: { value: c.uri },
                            label: { value: c.label },
                            content: { value: c.content }
                        }))
                    }
                }
            };
        }
        
        // Mock iteration level queries
        if (query.includes('beerqa:iterationLevel')) {
            return {
                success: true,
                data: {
                    results: {
                        bindings: [
                            {
                                question: { value: 'http://example.org/q1' },
                                text: { value: 'Follow-up question' },
                                type: { value: 'factual' },
                                priority: { value: '0.8' }
                            }
                        ]
                    }
                }
            };
        }
        
        return {
            success: true,
            data: { results: { bindings: [] } }
        };
    }

    async executeUpdate(query) {
        this.updates.push(query);
        return { success: true };
    }
}

class MockWikidataResearch {
    constructor() {
        this.researchCalls = [];
    }

    async executeResearch(query) {
        this.researchCalls.push(query);
        return {
            ragnoEntities: ['entity1', 'entity2', 'entity3'],
            concepts: ['concept1', 'concept2']
        };
    }
}

describe('Workflow Components Integration Tests', () => {
    let mockLLMHandler;
    let mockSPARQLHelper;
    let mockWikidataResearch;
    let mockConfig;
    let testQuestion;

    beforeEach(() => {
        mockLLMHandler = new MockLLMHandler();
        mockSPARQLHelper = new MockSPARQLHelper();
        mockWikidataResearch = new MockWikidataResearch();
        mockConfig = {
            beerqaGraphURI: 'http://purl.org/stuff/beerqa/test',
            wikipediaGraphURI: 'http://purl.org/stuff/wikipedia/research',
            wikidataGraphURI: 'http://purl.org/stuff/wikidata/research'
        };
        testQuestion = {
            text: 'What is artificial intelligence?',
            uri: 'http://example.org/ai-question'
        };
    });

    describe('BeerQAWorkflow', () => {
        test('should execute basic BeerQA workflow successfully', async () => {
            const workflow = new BeerQAWorkflow();
            
            const input = { question: testQuestion };
            const resources = {
                llmHandler: mockLLMHandler,
                sparqlHelper: mockSPARQLHelper,
                config: mockConfig
            };
            
            const result = await workflow.execute(input, resources);
            
            expect(result.success).toBe(true);
            expect(result.workflowType).toBe('beerqa');
            expect(result.data.question).toEqual(testQuestion);
            expect(result.data.augmentedQuestion).toBeDefined();
            expect(result.data.context).toBeDefined();
            expect(result.data.answer).toBeDefined();
            expect(result.metadata.totalSteps).toBe(3);
            expect(result.metadata.timestamp).toBeDefined();
        });

        test('should handle missing resources gracefully', async () => {
            const workflow = new BeerQAWorkflow();
            
            const input = { question: testQuestion };
            const resources = {
                // Missing llmHandler
                sparqlHelper: mockSPARQLHelper,
                config: mockConfig
            };
            
            const result = await workflow.execute(input, resources);
            
            expect(result.success).toBe(false);
            expect(result.error).toContain('llmHandler');
        });

        test('should use custom options', async () => {
            const workflow = new BeerQAWorkflow();
            
            const input = { question: testQuestion };
            const resources = {
                llmHandler: mockLLMHandler,
                sparqlHelper: mockSPARQLHelper,
                config: mockConfig
            };
            const options = {
                maxContextTokens: 2000,
                answerStyle: 'concise',
                maxRelatedCorpuscles: 5
            };
            
            const result = await workflow.execute(input, resources, options);
            
            expect(result.success).toBe(true);
            // Should use the custom options internally
        });
    });

    describe('WikidataWorkflow', () => {
        test('should execute enhanced workflow with Wikidata research', async () => {
            const workflow = new WikidataWorkflow();
            
            const input = { 
                question: testQuestion,
                enableWikidataResearch: true
            };
            const resources = {
                llmHandler: mockLLMHandler,
                sparqlHelper: mockSPARQLHelper,
                config: mockConfig,
                wikidataResearch: mockWikidataResearch
            };
            
            const result = await workflow.execute(input, resources);
            
            expect(result.success).toBe(true);
            expect(result.workflowType).toBe('wikidata-enhanced');
            expect(result.data.standardAnswer).toBeDefined();
            expect(result.data.enhancedAnswer).toBeDefined();
            expect(result.data.wikidataResults).toBeDefined();
            expect(result.data.wikidataEntitiesFound).toBeGreaterThan(0);
            expect(mockWikidataResearch.researchCalls.length).toBeGreaterThan(0);
        });

        test('should fallback to BeerQA when Wikidata disabled', async () => {
            const workflow = new WikidataWorkflow();
            
            const input = { 
                question: testQuestion,
                enableWikidataResearch: false
            };
            const resources = {
                llmHandler: mockLLMHandler,
                sparqlHelper: mockSPARQLHelper,
                config: mockConfig
            };
            
            const result = await workflow.execute(input, resources);
            
            expect(result.success).toBe(true);
            expect(result.data.wikidataResults).toBeNull();
            expect(result.data.standardAnswer).toBeDefined();
        });

        test('should handle missing Wikidata research component', async () => {
            const workflow = new WikidataWorkflow();
            
            const input = { 
                question: testQuestion,
                enableWikidataResearch: true
            };
            const resources = {
                llmHandler: mockLLMHandler,
                sparqlHelper: mockSPARQLHelper,
                config: mockConfig
                // Missing wikidataResearch
            };
            
            const result = await workflow.execute(input, resources);
            
            expect(result.success).toBe(true);
            expect(result.data.wikidataResults).toBeNull();
            // Should still work without research component
        });

        test('should respect enhancement level options', async () => {
            const workflow = new WikidataWorkflow();
            
            const input = { question: testQuestion };
            const resources = {
                llmHandler: mockLLMHandler,
                sparqlHelper: mockSPARQLHelper,
                config: mockConfig,
                wikidataResearch: mockWikidataResearch
            };
            const options = {
                enhancementLevel: 'comprehensive',
                maxWikidataEntities: 25
            };
            
            const result = await workflow.execute(input, resources, options);
            
            expect(result.success).toBe(true);
            expect(result.metadata.enhancementLevel).toBe('comprehensive');
        });
    });

    describe('FeedbackWorkflow', () => {
        test('should execute complete iterative feedback workflow', async () => {
            const workflow = new FeedbackWorkflow();
            
            const input = { 
                question: testQuestion,
                enableIterativeFeedback: true,
                enableWikidataResearch: true
            };
            const resources = {
                llmHandler: mockLLMHandler,
                sparqlHelper: mockSPARQLHelper,
                config: mockConfig,
                wikidataResearch: mockWikidataResearch
            };
            const options = {
                maxIterations: 2,
                workflowMode: 'standard'
            };
            
            const result = await workflow.execute(input, resources, options);
            
            expect(result.success).toBe(true);
            expect(result.workflowType).toBe('feedback-iterative');
            expect(result.data.initialAnswer).toBeDefined();
            expect(result.data.finalAnswer).toBeDefined();
            expect(result.data.iterations).toBeDefined();
            expect(result.data.workflow.feedbackEnabled).toBe(true);
            expect(result.metadata.workflowMode).toBe('standard');
        });

        test('should work in fast mode with reduced iterations', async () => {
            const workflow = new FeedbackWorkflow();
            
            const input = { question: testQuestion };
            const resources = {
                llmHandler: mockLLMHandler,
                sparqlHelper: mockSPARQLHelper,
                config: mockConfig,
                wikidataResearch: mockWikidataResearch
            };
            const options = {
                workflowMode: 'fast'
            };
            
            const result = await workflow.execute(input, resources, options);
            
            expect(result.success).toBe(true);
            expect(result.metadata.workflowMode).toBe('fast');
            // Fast mode should use fewer iterations
        });

        test('should work in comprehensive mode with more iterations', async () => {
            const workflow = new FeedbackWorkflow();
            
            const input = { question: testQuestion };
            const resources = {
                llmHandler: mockLLMHandler,
                sparqlHelper: mockSPARQLHelper,
                config: mockConfig,
                wikidataResearch: mockWikidataResearch
            };
            const options = {
                workflowMode: 'comprehensive'
            };
            
            const result = await workflow.execute(input, resources, options);
            
            expect(result.success).toBe(true);
            expect(result.metadata.workflowMode).toBe('comprehensive');
            // Comprehensive mode should use more iterations and higher thresholds
        });

        test('should work without iterative feedback', async () => {
            const workflow = new FeedbackWorkflow();
            
            const input = { 
                question: testQuestion,
                enableIterativeFeedback: false
            };
            const resources = {
                llmHandler: mockLLMHandler,
                sparqlHelper: mockSPARQLHelper,
                config: mockConfig,
                wikidataResearch: mockWikidataResearch
            };
            
            const result = await workflow.execute(input, resources);
            
            expect(result.success).toBe(true);
            expect(result.data.workflow.feedbackEnabled).toBe(false);
            expect(result.data.workflow.iterationsPerformed).toBe(0);
        });
    });

    describe('Workflow Composition', () => {
        test('should demonstrate workflow composition patterns', async () => {
            // Test that workflows can be composed together
            const beerqaWorkflow = new BeerQAWorkflow();
            const wikidataWorkflow = new WikidataWorkflow();
            
            const sharedResources = {
                llmHandler: mockLLMHandler,
                sparqlHelper: mockSPARQLHelper,
                config: mockConfig,
                wikidataResearch: mockWikidataResearch
            };
            
            // Run BeerQA workflow
            const beerqaResult = await beerqaWorkflow.execute(
                { question: testQuestion },
                sharedResources
            );
            
            expect(beerqaResult.success).toBe(true);
            
            // Run Wikidata workflow
            const wikidataResult = await wikidataWorkflow.execute(
                { question: testQuestion },
                sharedResources
            );
            
            expect(wikidataResult.success).toBe(true);
            
            // Compare results
            expect(wikidataResult.data.standardAnswer).toBeDefined();
            expect(wikidataResult.data.enhancedAnswer).toBeDefined();
            // Enhanced answer should be different from standard
        });

        test('should handle resource sharing correctly', async () => {
            const workflow1 = new BeerQAWorkflow();
            const workflow2 = new WikidataWorkflow();
            
            const sharedResources = {
                llmHandler: mockLLMHandler,
                sparqlHelper: mockSPARQLHelper,
                config: mockConfig
            };
            
            // Both workflows should work with same resources
            const result1 = await workflow1.execute({ question: testQuestion }, sharedResources);
            const result2 = await workflow2.execute({ question: testQuestion }, sharedResources);
            
            expect(result1.success).toBe(true);
            expect(result2.success).toBe(true);
            
            // Verify resource state after multiple workflow executions
            expect(mockLLMHandler.calls.length).toBeGreaterThan(0);
            expect(mockSPARQLHelper.queries.length).toBeGreaterThan(0);
        });
    });

    describe('Error Handling', () => {
        test('should handle LLM failures gracefully', async () => {
            const failingLLM = new MockLLMHandler();
            failingLLM.generateResponse = () => Promise.reject(new Error('LLM service unavailable'));
            
            const workflow = new BeerQAWorkflow();
            const input = { question: testQuestion };
            const resources = {
                llmHandler: failingLLM,
                sparqlHelper: mockSPARQLHelper,
                config: mockConfig
            };
            
            const result = await workflow.execute(input, resources);
            
            expect(result.success).toBe(false);
            expect(result.error).toContain('LLM service unavailable');
        });

        test('should handle SPARQL failures gracefully', async () => {
            const failingSPARQL = new MockSPARQLHelper();
            failingSPARQL.executeSelect = () => Promise.reject(new Error('SPARQL endpoint down'));
            
            const workflow = new BeerQAWorkflow();
            const input = { question: testQuestion };
            const resources = {
                llmHandler: mockLLMHandler,
                sparqlHelper: failingSPARQL,
                config: mockConfig
            };
            
            const result = await workflow.execute(input, resources);
            
            expect(result.success).toBe(false);
            expect(result.error).toContain('SPARQL endpoint down');
        });
    });
});