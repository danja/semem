/**
 * Integration tests for feedback workflow components
 * 
 * These tests verify that the extracted feedback components work together
 * correctly and produce the same functionality as the original examples.
 */

import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import ResponseAnalyzer from '../../src/compose/feedback/ResponseAnalyzer.js';
import FollowUpGenerator from '../../src/compose/feedback/FollowUpGenerator.js';
import IterationManager from '../../src/compose/feedback/IterationManager.js';

// Mock implementations for testing
class MockLLMHandler {
    constructor(responses = {}) {
        this.responses = responses;
        this.callCount = 0;
    }

    async generateResponse(prompt) {
        this.callCount++;
        
        // Return predefined responses based on prompt content
        if (prompt.includes('completeness')) {
            return this.responses.completeness || `SCORE: 0.6
REASONING: The answer provides basic information but lacks specific details about implementation and examples.
MISSING: Specific implementation details and concrete examples`;
        }
        
        if (prompt.includes('follow-up questions')) {
            return this.responses.followUp || `1. What are the specific implementation requirements?
2. Can you provide concrete examples?`;
        }
        
        if (prompt.includes('enhanced answer')) {
            return this.responses.enhanced || 'This is an enhanced answer with additional research findings.';
        }
        
        return this.responses.default || 'This is a test response.';
    }
}

class MockSPARQLHelper {
    constructor() {
        this.queries = [];
        this.updates = [];
    }

    async executeSelect(query) {
        this.queries.push({ type: 'select', query });
        
        // Mock responses for different query types
        if (query.includes('beerqa:iterationLevel')) {
            return {
                success: true,
                data: {
                    results: {
                        bindings: [
                            {
                                question: { value: 'http://example.org/q1' },
                                text: { value: 'Test follow-up question?' },
                                type: { value: 'factual' },
                                priority: { value: '0.8' },
                                parentQuestion: { value: 'http://example.org/parent' },
                                parentText: { value: 'Original question' }
                            }
                        ]
                    }
                }
            };
        }
        
        if (query.includes('COUNT(?question)')) {
            return {
                success: true,
                data: {
                    results: {
                        bindings: [
                            {
                                totalGenerated: { value: '5' },
                                totalResearched: { value: '3' },
                                avgPriority: { value: '0.75' },
                                maxIteration: { value: '2' }
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
        this.updates.push({ type: 'update', query });
        return { success: true };
    }
}

class MockWikidataResearch {
    constructor(entities = []) {
        this.mockEntities = entities;
        this.researchCalls = [];
    }

    async executeResearch(question) {
        this.researchCalls.push(question);
        return {
            ragnoEntities: this.mockEntities,
            concepts: ['test-concept-1', 'test-concept-2']
        };
    }
}

describe('Feedback Workflow Integration Tests', () => {
    let mockLLMHandler;
    let mockSPARQLHelper;
    let mockWikidataResearch;
    let mockConfig;

    beforeEach(() => {
        mockLLMHandler = new MockLLMHandler();
        mockSPARQLHelper = new MockSPARQLHelper();
        mockWikidataResearch = new MockWikidataResearch(['entity1', 'entity2', 'entity3']);
        mockConfig = {
            beerqaGraphURI: 'http://purl.org/stuff/beerqa/test'
        };
    });

    describe('ResponseAnalyzer', () => {
        test('should analyze response completeness correctly', async () => {
            const analyzer = new ResponseAnalyzer();
            
            const input = {
                originalQuestion: 'What is machine learning?',
                response: 'Machine learning is a subset of AI. Additional information would be helpful.',
                context: 'Context about AI and algorithms'
            };
            
            const resources = {
                llmHandler: mockLLMHandler
            };
            
            const result = await analyzer.analyzeCompleteness(input, resources);
            
            expect(result.success).toBe(true);
            expect(result.isComplete).toBe(false);
            expect(result.completenessScore).toBe(0.6);
            expect(result.incompleteness.isIncomplete).toBe(true);
            expect(result.followUpQuestions.length).toBe(2);
            expect(result.metadata.analysisTimestamp).toBeDefined();
        });

        test('should handle analysis errors gracefully', async () => {
            const analyzer = new ResponseAnalyzer();
            const failingLLM = new MockLLMHandler();
            failingLLM.generateResponse = () => Promise.reject(new Error('LLM failure'));
            
            const input = {
                originalQuestion: 'Test question',
                response: 'Test response',
                context: ''
            };
            
            const resources = {
                llmHandler: failingLLM
            };
            
            const result = await analyzer.analyzeCompleteness(input, resources);
            
            expect(result.success).toBe(true); // Should not fail completely
            expect(result.isComplete).toBe(true); // Default to complete on error
            expect(result.error).toBeDefined();
        });
    });

    describe('FollowUpGenerator', () => {
        test('should generate and store follow-up questions', async () => {
            const generator = new FollowUpGenerator();
            
            const input = {
                originalQuestion: {
                    uri: 'http://example.org/question1',
                    text: 'What is machine learning?'
                },
                analysisResult: {
                    followUpQuestions: [
                        { text: 'What are the types of ML?', type: 'factual', priority: 0.8 },
                        { text: 'How does ML work?', type: 'general', priority: 0.7 }
                    ],
                    completenessScore: 0.6
                },
                iterationLevel: 1
            };
            
            const resources = {
                sparqlHelper: mockSPARQLHelper,
                config: mockConfig
            };
            
            const result = await generator.generateQuestions(input, resources);
            
            expect(result.success).toBe(true);
            expect(result.questions.length).toBe(2);
            expect(result.metadata.questionsGenerated).toBe(2);
            expect(mockSPARQLHelper.updates.length).toBe(2); // Should store both questions
        });

        test('should retrieve questions for research', async () => {
            const generator = new FollowUpGenerator();
            
            const input = {
                iterationLevel: 1,
                limit: 5
            };
            
            const resources = {
                sparqlHelper: mockSPARQLHelper,
                config: mockConfig
            };
            
            const result = await generator.getQuestionsForResearch(input, resources);
            
            expect(result.success).toBe(true);
            expect(result.questions.length).toBe(1);
            expect(result.metadata.questionsFound).toBe(1);
            expect(mockSPARQLHelper.queries.length).toBe(1);
        });

        test('should mark questions as researched', async () => {
            const generator = new FollowUpGenerator();
            
            const input = {
                questionURI: 'http://example.org/question1',
                researchResults: {
                    entityCount: 5,
                    conceptCount: 3
                }
            };
            
            const resources = {
                sparqlHelper: mockSPARQLHelper,
                config: mockConfig
            };
            
            const result = await generator.markQuestionResearched(input, resources);
            
            expect(result.success).toBe(true);
            expect(result.metadata.entitiesFound).toBe(5);
            expect(mockSPARQLHelper.updates.length).toBe(1);
        });

        test('should get question statistics', async () => {
            const generator = new FollowUpGenerator();
            
            const input = {};
            const resources = {
                sparqlHelper: mockSPARQLHelper,
                config: mockConfig
            };
            
            const result = await generator.getQuestionStatistics(input, resources);
            
            expect(result.success).toBe(true);
            expect(result.statistics.totalGenerated).toBe(5);
            expect(result.statistics.totalResearched).toBe(3);
            expect(result.statistics.researchProgress).toBe(0.6);
        });
    });

    describe('IterationManager', () => {
        test('should process complete iteration workflow', async () => {
            const manager = new IterationManager();
            
            const input = {
                originalQuestion: {
                    uri: 'http://example.org/question1',
                    text: 'What is machine learning?'
                },
                initialResponse: 'Machine learning is AI. Additional information would be helpful.',
                context: 'Context about AI'
            };
            
            const resources = {
                llmHandler: mockLLMHandler,
                sparqlHelper: mockSPARQLHelper,
                config: mockConfig,
                wikidataResearch: mockWikidataResearch
            };
            
            const options = {
                maxIterations: 2,
                completenessThreshold: 0.8,
                maxFollowUpQuestions: 2
            };
            
            const result = await manager.processIterations(input, resources, options);
            
            expect(result.success).toBe(true);
            expect(result.originalQuestion).toEqual(input.originalQuestion);
            expect(result.finalAnswer).toBeDefined();
            expect(result.iterations.length).toBeGreaterThan(0);
            expect(result.metadata.totalIterations).toBeGreaterThan(0);
            expect(result.metadata.finalCompleteness).toBeDefined();
        });

        test('should handle iteration without research component', async () => {
            const manager = new IterationManager();
            
            const input = {
                originalQuestion: {
                    uri: 'http://example.org/question1',
                    text: 'Simple question?'
                },
                initialResponse: 'Simple answer.',
                context: ''
            };
            
            const resources = {
                llmHandler: mockLLMHandler,
                sparqlHelper: mockSPARQLHelper,
                config: mockConfig
                // No wikidataResearch component
            };
            
            const result = await manager.processIterations(input, resources);
            
            expect(result.success).toBe(true);
            expect(result.iterations.length).toBeGreaterThan(0);
            // Should still work without research component
        });

        test('should respect max iterations limit', async () => {
            const manager = new IterationManager();
            
            // Mock LLM that always returns incomplete responses
            const incompleteLLM = new MockLLMHandler({
                completeness: `SCORE: 0.5
REASONING: Still incomplete
MISSING: More details needed`,
                followUp: `1. What about X?
2. What about Y?`
            });
            
            const input = {
                originalQuestion: {
                    uri: 'http://example.org/question1',
                    text: 'Complex question?'
                },
                initialResponse: 'Incomplete answer',
                context: ''
            };
            
            const resources = {
                llmHandler: incompleteLLM,
                sparqlHelper: mockSPARQLHelper,
                config: mockConfig,
                wikidataResearch: mockWikidataResearch
            };
            
            const options = {
                maxIterations: 2,
                completenessThreshold: 0.9 // High threshold to force iterations
            };
            
            const result = await manager.processIterations(input, resources, options);
            
            expect(result.success).toBe(true);
            expect(result.iterations.length).toBeLessThanOrEqual(2);
            expect(result.metadata.totalIterations).toBeLessThanOrEqual(2);
        });
    });

    describe('Component Integration', () => {
        test('should work together in realistic scenario', async () => {
            // Test the complete flow: analysis -> generation -> research -> enhancement
            const analyzer = new ResponseAnalyzer();
            const generator = new FollowUpGenerator();
            
            // Step 1: Analyze response
            const analysisInput = {
                originalQuestion: 'What are neural networks?',
                response: 'Neural networks are computational models. More specific information would be helpful.',
                context: 'AI and machine learning context'
            };
            
            const analysisResult = await analyzer.analyzeCompleteness(
                analysisInput,
                { llmHandler: mockLLMHandler }
            );
            
            expect(analysisResult.success).toBe(true);
            expect(analysisResult.isComplete).toBe(false);
            
            // Step 2: Generate follow-up questions
            const generationInput = {
                originalQuestion: {
                    uri: 'http://example.org/neural-networks',
                    text: 'What are neural networks?'
                },
                analysisResult: analysisResult,
                iterationLevel: 1
            };
            
            const generationResult = await generator.generateQuestions(
                generationInput,
                { sparqlHelper: mockSPARQLHelper, config: mockConfig }
            );
            
            expect(generationResult.success).toBe(true);
            expect(generationResult.questions.length).toBeGreaterThan(0);
            
            // Step 3: Simulate research on generated questions
            for (const question of generationResult.questions) {
                const researchResult = await mockWikidataResearch.executeResearch(question.text);
                expect(researchResult.ragnoEntities.length).toBeGreaterThan(0);
                
                // Mark as researched
                await generator.markQuestionResearched(
                    {
                        questionURI: question.uri,
                        researchResults: { entityCount: researchResult.ragnoEntities.length }
                    },
                    { sparqlHelper: mockSPARQLHelper, config: mockConfig }
                );
            }
            
            // Verify the complete workflow executed correctly
            expect(mockSPARQLHelper.updates.length).toBeGreaterThan(0); // Questions were stored
            expect(mockWikidataResearch.researchCalls.length).toBeGreaterThan(0); // Research was performed
        });
    });
});
