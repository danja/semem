/**
 * Integration test for CreateConceptsUnified (refactored unified prompt system)
 * Tests the unified prompt system against the original prompt system
 */

import { test, expect, describe, beforeAll, afterAll } from 'vitest';
import { CreateConcepts } from '../../src/ragno/CreateConcepts.js';
import { CreateConceptsUnified } from '../../src/ragno/CreateConceptsUnified.js';
import Config from '../../src/Config.js';
import logger from 'loglevel';
import { fileURLToPath } from 'url';
import path from 'path';

// Set up test environment
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Test data for concept extraction
const testData = {
    shortText: "Machine learning is a subset of artificial intelligence that focuses on algorithms.",
    mediumText: "Climate change affects global weather patterns. Rising temperatures lead to more extreme weather events. Scientists study these patterns to predict future climate conditions.",
    longText: "Quantum computing represents a paradigm shift in computational power. Unlike classical computers that use bits, quantum computers use quantum bits or qubits. These qubits can exist in multiple states simultaneously through superposition. This allows quantum computers to process vast amounts of information in parallel. Major tech companies are investing heavily in quantum research. The implications for cryptography, drug discovery, and optimization problems are significant."
};

describe('CreateConceptsUnified Integration Test', () => {
    let createConcepts;
    let createConceptsUnified;
    let config;
    let originalLogLevel;

    beforeAll(async () => {
        // Set log level to reduce noise during testing
        originalLogLevel = logger.getLevel();
        logger.setLevel('warn');

        // Initialize configuration
        config = new Config('config/config.json');
        await config.init();

        // Initialize both systems
        createConcepts = new CreateConcepts(config);
        await createConcepts.init();

        createConceptsUnified = new CreateConceptsUnified(config);
        await createConceptsUnified.init();
    });

    afterAll(async () => {
        // Restore log level
        logger.setLevel(originalLogLevel);

        // Cleanup both systems
        if (createConcepts) {
            await createConcepts.cleanup();
        }
        if (createConceptsUnified) {
            await createConceptsUnified.cleanup();
        }
    });

    describe('Unified Prompt System', () => {
        test('should extract concepts from short text using unified system', async () => {
            const concepts = await createConceptsUnified.extractConcepts(testData.shortText);
            
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

        test('should extract concepts from medium text using unified system', async () => {
            const concepts = await createConceptsUnified.extractConcepts(testData.mediumText);
            
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

        test('should extract concepts from long text using unified system', async () => {
            const concepts = await createConceptsUnified.extractConcepts(testData.longText);
            
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

        test('should handle empty text gracefully with unified system', async () => {
            const concepts = await createConceptsUnified.extractConcepts('');
            
            expect(concepts).toBeInstanceOf(Array);
            expect(concepts.length).toBe(0);
        });

        test('should handle very short text with unified system', async () => {
            const concepts = await createConceptsUnified.extractConcepts('AI is cool');
            
            expect(concepts).toBeInstanceOf(Array);
            // Should either extract concepts or return empty array (not throw)
        });
    });

    describe('Comparison Tests', () => {
        test('should produce similar concept counts between systems', async () => {
            const originalConcepts = await createConcepts.extractConcepts(testData.mediumText);
            const unifiedConcepts = await createConceptsUnified.extractConcepts(testData.mediumText);
            
            expect(originalConcepts).toBeInstanceOf(Array);
            expect(unifiedConcepts).toBeInstanceOf(Array);
            
            // Allow for some variance in concept count (±3 concepts)
            const countDifference = Math.abs(originalConcepts.length - unifiedConcepts.length);
            expect(countDifference).toBeLessThanOrEqual(3);
            
            console.log(`Original system: ${originalConcepts.length} concepts`);
            console.log(`Unified system: ${unifiedConcepts.length} concepts`);
        });

        test('should produce overlapping concepts between systems', async () => {
            const originalConcepts = await createConcepts.extractConcepts(testData.shortText);
            const unifiedConcepts = await createConceptsUnified.extractConcepts(testData.shortText);
            
            // Convert to lowercase for comparison
            const originalLower = originalConcepts.map(c => c.toLowerCase());
            const unifiedLower = unifiedConcepts.map(c => c.toLowerCase());
            
            // Find overlapping concepts
            const overlap = originalLower.filter(concept => 
                unifiedLower.some(unifiedConcept => 
                    unifiedConcept.includes(concept) || concept.includes(unifiedConcept)
                )
            );
            
            // Expect at least 30% overlap in concepts
            const overlapPercentage = overlap.length / Math.max(originalLower.length, 1);
            expect(overlapPercentage).toBeGreaterThanOrEqual(0.3);
            
            console.log(`Concept overlap: ${overlap.length}/${originalLower.length} (${(overlapPercentage * 100).toFixed(1)}%)`);
        });

        test('should maintain concept quality between systems', async () => {
            const originalConcepts = await createConcepts.extractConcepts(testData.longText);
            const unifiedConcepts = await createConceptsUnified.extractConcepts(testData.longText);
            
            // Test concept quality - both should extract meaningful concepts
            [originalConcepts, unifiedConcepts].forEach((concepts, systemIndex) => {
                const systemName = systemIndex === 0 ? 'Original' : 'Unified';
                
                concepts.forEach(concept => {
                    expect(typeof concept).toBe('string');
                    expect(concept.trim()).toBe(concept); // No leading/trailing whitespace
                    expect(concept.length).toBeGreaterThan(0);
                    expect(concept.length).toBeLessThan(100); // Reasonable length
                });
                
                // Test for duplicates
                const uniqueConcepts = [...new Set(concepts)];
                expect(concepts.length).toBe(uniqueConcepts.length);
                
                console.log(`${systemName} system concepts quality: ✓`);
            });
        });
    });

    describe('Performance Comparison', () => {
        test('should measure extraction time comparison', async () => {
            const testText = testData.mediumText;
            
            // Test original system
            const originalStartTime = Date.now();
            const originalConcepts = await createConcepts.extractConcepts(testText);
            const originalEndTime = Date.now();
            const originalTime = originalEndTime - originalStartTime;
            
            // Test unified system
            const unifiedStartTime = Date.now();
            const unifiedConcepts = await createConceptsUnified.extractConcepts(testText);
            const unifiedEndTime = Date.now();
            const unifiedTime = unifiedEndTime - unifiedStartTime;
            
            expect(originalConcepts).toBeInstanceOf(Array);
            expect(unifiedConcepts).toBeInstanceOf(Array);
            
            // Both should complete within reasonable time
            expect(originalTime).toBeLessThan(30000);
            expect(unifiedTime).toBeLessThan(30000);
            
            console.log(`Performance comparison:`);
            console.log(`  Original system: ${originalTime}ms for ${originalConcepts.length} concepts`);
            console.log(`  Unified system:  ${unifiedTime}ms for ${unifiedConcepts.length} concepts`);
            
            const speedRatio = unifiedTime / originalTime;
            console.log(`  Speed ratio: ${speedRatio.toFixed(2)}x (${speedRatio > 1 ? 'slower' : 'faster'})`);
        });

        test('should handle concurrent extractions in both systems', async () => {
            const testTexts = [testData.shortText, testData.mediumText, testData.longText];
            
            // Test original system
            const originalStartTime = Date.now();
            const originalPromises = testTexts.map(text => createConcepts.extractConcepts(text));
            const originalResults = await Promise.all(originalPromises);
            const originalEndTime = Date.now();
            const originalTotalTime = originalEndTime - originalStartTime;
            
            // Test unified system
            const unifiedStartTime = Date.now();
            const unifiedPromises = testTexts.map(text => createConceptsUnified.extractConcepts(text));
            const unifiedResults = await Promise.all(unifiedPromises);
            const unifiedEndTime = Date.now();
            const unifiedTotalTime = unifiedEndTime - unifiedStartTime;
            
            expect(originalResults).toHaveLength(3);
            expect(unifiedResults).toHaveLength(3);
            
            originalResults.forEach(concepts => {
                expect(concepts).toBeInstanceOf(Array);
            });
            
            unifiedResults.forEach(concepts => {
                expect(concepts).toBeInstanceOf(Array);
            });
            
            console.log(`Concurrent performance comparison:`);
            console.log(`  Original system: ${originalTotalTime}ms`);
            console.log(`  Unified system:  ${unifiedTotalTime}ms`);
        });
    });

    describe('Error Handling Comparison', () => {
        test('should handle problematic text in both systems', async () => {
            const problematicText = "Special characters: !@#$%^&*(){}[]|\\:;\"'<>,.?/~`";
            
            const originalConcepts = await createConcepts.extractConcepts(problematicText);
            const unifiedConcepts = await createConceptsUnified.extractConcepts(problematicText);
            
            expect(originalConcepts).toBeInstanceOf(Array);
            expect(unifiedConcepts).toBeInstanceOf(Array);
            
            // Both should handle gracefully without throwing
        });

        test('should handle very long text in both systems', async () => {
            const longText = testData.longText.repeat(5);
            
            const originalConcepts = await createConcepts.extractConcepts(longText);
            const unifiedConcepts = await createConceptsUnified.extractConcepts(longText);
            
            expect(originalConcepts).toBeInstanceOf(Array);
            expect(unifiedConcepts).toBeInstanceOf(Array);
            
            // Both should handle long text without crashing
        });
    });

    describe('Configuration Integration', () => {
        test('should use the same model configuration', async () => {
            // Both systems should use the same chat model
            expect(createConcepts.llmHandler.chatModel).toBe(createConceptsUnified.chatModel);
            
            console.log(`Both systems using model: ${createConcepts.llmHandler.chatModel}`);
        });

        test('should use the same storage configuration', async () => {
            const storageConfig = config.get('storage');
            
            expect(storageConfig).toBeDefined();
            expect(storageConfig.type).toBe('sparql');
            
            // Both systems should have SPARQL helpers
            expect(createConcepts.sparqlHelper).toBeDefined();
            expect(createConceptsUnified.sparqlHelper).toBeDefined();
            expect(createConcepts.queryService).toBeDefined();
            expect(createConceptsUnified.queryService).toBeDefined();
        });
    });

    describe('Prompt System Integration', () => {
        test('should verify unified system uses PromptManager', async () => {
            // Unified system should have prompt manager
            expect(createConceptsUnified.promptManager).toBeDefined();
            expect(typeof createConceptsUnified.promptManager.generatePrompt).toBe('function');
            
            // Should have registered concept extraction templates
            const template = createConceptsUnified.promptManager.getTemplate('concept-extraction-enhanced');
            expect(template).toBeDefined();
        });

        test('should verify template registration in unified system', async () => {
            const templates = [
                'concept-extraction-enhanced',
                'concept-extraction-mistral', 
                'concept-extraction-llama'
            ];
            
            templates.forEach(templateName => {
                const template = createConceptsUnified.promptManager.getTemplate(templateName);
                expect(template).toBeDefined();
                expect(template.name).toBe(templateName);
                expect(template.category).toBe('concept-extraction');
            });
        });
    });
});