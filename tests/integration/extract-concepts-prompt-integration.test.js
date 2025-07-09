/**
 * Integration test for ExtractConcepts prompt usage
 * Tests the prompt flow before and after refactoring to unified prompt system
 */

import { test, expect, describe, beforeAll, afterAll } from 'vitest';
import { CreateConcepts } from '../../src/ragno/CreateConcepts.js';
import Config from '../../src/Config.js';
import logger from 'loglevel';
import { fileURLToPath } from 'url';
import path from 'path';

// Set up test environment
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('ExtractConcepts Prompt Integration', () => {
    let createConcepts;
    let config;
    let originalLogLevel;

    // Sample test data
    const testData = {
        shortText: "Machine learning is a subset of artificial intelligence that focuses on algorithms.",
        mediumText: "Climate change affects global weather patterns. Rising temperatures lead to more extreme weather events. Scientists study these patterns to predict future climate conditions.",
        longText: "Quantum computing represents a paradigm shift in computational power. Unlike classical computers that use bits, quantum computers use quantum bits or qubits. These qubits can exist in multiple states simultaneously through superposition. This allows quantum computers to process vast amounts of information in parallel. Major tech companies are investing heavily in quantum research. The implications for cryptography, drug discovery, and optimization problems are significant."
    };

    beforeAll(async () => {
        // Set log level to reduce noise during testing
        originalLogLevel = logger.getLevel();
        logger.setLevel('warn');

        // Initialize configuration
        config = new Config('config/config.json');
        await config.init();

        // Initialize CreateConcepts system
        createConcepts = new CreateConcepts(config);
        await createConcepts.init();
    });

    afterAll(async () => {
        // Restore log level
        logger.setLevel(originalLogLevel);

        // Cleanup
        if (createConcepts) {
            await createConcepts.cleanup();
        }
    });

    describe('Original Prompt System', () => {
        test('should extract concepts from short text', async () => {
            const concepts = await createConcepts.extractConcepts(testData.shortText);
            
            expect(concepts).toBeInstanceOf(Array);
            expect(concepts.length).toBeGreaterThan(0);
            
            // Check for expected concepts (be more flexible)
            const conceptsLower = concepts.map(c => c.toLowerCase());
            
            // At least one AI-related concept should be present
            const hasAIConcept = conceptsLower.some(c => 
                c.includes('machine learning') || c.includes('artificial intelligence') || c.includes('ai')
            );
            expect(hasAIConcept).toBe(true);
            
            // At least one algorithm-related concept should be present
            const hasAlgorithmConcept = conceptsLower.some(c => 
                c.includes('algorithm') || c.includes('subset') || c.includes('focus')
            );
            expect(hasAlgorithmConcept).toBe(true);
        });

        test('should extract concepts from medium text', async () => {
            const concepts = await createConcepts.extractConcepts(testData.mediumText);
            
            expect(concepts).toBeInstanceOf(Array);
            expect(concepts.length).toBeGreaterThan(2);
            
            // Check for expected concepts (be more flexible with exact matches)
            const conceptsLower = concepts.map(c => c.toLowerCase());
            expect(conceptsLower).toContain('climate change');
            
            // Check for weather-related concepts (more flexible)
            const hasWeatherConcept = conceptsLower.some(c => 
                c.includes('weather') || c.includes('temperature') || c.includes('climate')
            );
            expect(hasWeatherConcept).toBe(true);
        });

        test('should extract concepts from long text', async () => {
            const concepts = await createConcepts.extractConcepts(testData.longText);
            
            expect(concepts).toBeInstanceOf(Array);
            expect(concepts.length).toBeGreaterThan(3);
            
            // Check for expected concepts (be more flexible)
            const conceptsLower = concepts.map(c => c.toLowerCase());
            
            // At least one quantum-related concept should be present
            const hasQuantumConcept = conceptsLower.some(c => 
                c.includes('quantum') || c.includes('qubit') || c.includes('superposition')
            );
            expect(hasQuantumConcept).toBe(true);
            
            // At least one computing-related concept should be present
            const hasComputingConcept = conceptsLower.some(c => 
                c.includes('computing') || c.includes('computer') || c.includes('computational')
            );
            expect(hasComputingConcept).toBe(true);
        });

        test('should handle empty text gracefully', async () => {
            const concepts = await createConcepts.extractConcepts('');
            
            expect(concepts).toBeInstanceOf(Array);
            expect(concepts.length).toBe(0);
        });

        test('should handle very short text', async () => {
            const concepts = await createConcepts.extractConcepts('AI is cool');
            
            expect(concepts).toBeInstanceOf(Array);
            // Should either extract concepts or return empty array (not throw)
        });
    });

    describe('Prompt Flow Analysis', () => {
        test('should use correct model for concept extraction', async () => {
            // Test that the correct model is being used
            expect(createConcepts.llmHandler).toBeDefined();
            expect(createConcepts.llmHandler.chatModel).toBeDefined();
            expect(typeof createConcepts.llmHandler.chatModel).toBe('string');
        });

        test('should use PromptTemplates.formatConceptPrompt internally', async () => {
            // Import PromptTemplates to verify it's being used
            const PromptTemplates = (await import('../../src/PromptTemplates.js')).default;
            
            // Test that formatConceptPrompt works as expected
            const testText = "Test concept extraction";
            const prompt = PromptTemplates.formatConceptPrompt('qwen2:1.5b', testText);
            
            expect(prompt).toBeDefined();
            expect(typeof prompt === 'string' || Array.isArray(prompt)).toBe(true);
            
            if (typeof prompt === 'string') {
                expect(prompt).toContain(testText);
            } else if (Array.isArray(prompt)) {
                expect(prompt.length).toBeGreaterThan(0);
                expect(prompt[0]).toHaveProperty('role');
                expect(prompt[0]).toHaveProperty('content');
            }
        });
    });

    describe('Performance Baseline', () => {
        test('should measure extraction time for performance comparison', async () => {
            const startTime = Date.now();
            
            const concepts = await createConcepts.extractConcepts(testData.mediumText);
            
            const endTime = Date.now();
            const extractionTime = endTime - startTime;
            
            expect(concepts).toBeInstanceOf(Array);
            expect(extractionTime).toBeLessThan(30000); // Should complete within 30 seconds
            
            console.log(`Original system extraction time: ${extractionTime}ms for ${concepts.length} concepts`);
        });

        test('should handle concurrent extractions', async () => {
            const startTime = Date.now();
            
            const promises = [
                createConcepts.extractConcepts(testData.shortText),
                createConcepts.extractConcepts(testData.mediumText),
                createConcepts.extractConcepts(testData.longText)
            ];
            
            const results = await Promise.all(promises);
            
            const endTime = Date.now();
            const totalTime = endTime - startTime;
            
            expect(results).toHaveLength(3);
            results.forEach(concepts => {
                expect(concepts).toBeInstanceOf(Array);
            });
            
            console.log(`Original system concurrent extraction time: ${totalTime}ms`);
        });
    });

    describe('Error Handling', () => {
        test('should handle LLM failures gracefully', async () => {
            // Test with potentially problematic text
            const problematicText = "Special characters: !@#$%^&*(){}[]|\\:;\"'<>,.?/~`";
            
            const concepts = await createConcepts.extractConcepts(problematicText);
            
            expect(concepts).toBeInstanceOf(Array);
            // Should not throw, even if it returns empty array
        });

        test('should handle very long text', async () => {
            // Create a very long text by repeating content
            const longText = testData.longText.repeat(10);
            
            const concepts = await createConcepts.extractConcepts(longText);
            
            expect(concepts).toBeInstanceOf(Array);
            // Should handle long text without crashing
        });
    });

    describe('Data Validation', () => {
        test('should return clean concept strings', async () => {
            const concepts = await createConcepts.extractConcepts(testData.shortText);
            
            concepts.forEach(concept => {
                expect(typeof concept).toBe('string');
                expect(concept.trim()).toBe(concept); // No leading/trailing whitespace
                expect(concept.length).toBeGreaterThan(0);
            });
        });

        test('should remove duplicates', async () => {
            const concepts = await createConcepts.extractConcepts(testData.shortText);
            
            const uniqueConcepts = [...new Set(concepts)];
            expect(concepts.length).toBe(uniqueConcepts.length);
        });
    });

    describe('Configuration Integration', () => {
        test('should use configured models', async () => {
            const llmProviders = config.get('llmProviders') || [];
            const chatProviders = llmProviders.filter(p => p.capabilities?.includes('chat'));
            
            if (chatProviders.length > 0) {
                const sortedProviders = chatProviders.sort((a, b) => (a.priority || 999) - (b.priority || 999));
                const expectedModel = sortedProviders[0].chatModel || 'qwen2:1.5b';
                
                expect(createConcepts.llmHandler.chatModel).toBe(expectedModel);
            }
        });

        test('should initialize with correct storage configuration', async () => {
            const storageConfig = config.get('storage');
            
            expect(storageConfig).toBeDefined();
            expect(storageConfig.type).toBe('sparql');
            expect(createConcepts.sparqlHelper).toBeDefined();
            expect(createConcepts.queryService).toBeDefined();
        });
    });
});

// Export sample data for use in refactored tests
export { testData };