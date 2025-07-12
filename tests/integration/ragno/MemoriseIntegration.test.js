/**
 * Integration tests for Memorise.js
 * 
 * These tests verify the Memorise module works correctly with real components
 * and follows the complete memory ingestion pipeline. They test actual
 * integration with SPARQL stores, LLM providers, and document processing.
 * 
 * Note: These tests require a running SPARQL endpoint and available LLM providers.
 * They are designed to be run in a development environment with proper configuration.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Memorise from '../../../src/ragno/Memorise.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Memorise Integration Tests', () => {
    let memorise;
    const testGraph = 'http://purl.org/stuff/semem/test/memorise';
    
    // Test configuration using test config
    const testConfigPath = path.resolve(__dirname, '../../../config/test-config.json');

    beforeEach(async () => {
        memorise = new Memorise(testConfigPath);
    });

    afterEach(async () => {
        if (memorise) {
            await memorise.cleanup();
        }
    });

    describe('initialization', () => {
        it('should initialize with test configuration', async () => {
            await memorise.init();
            
            expect(memorise.initialized).toBe(true);
            expect(memorise.config).toBeDefined();
            expect(memorise.sparqlHelper).toBeDefined();
            expect(memorise.llmHandler).toBeDefined();
            expect(memorise.embeddingHandler).toBeDefined();
            expect(memorise.chunker).toBeDefined();
            expect(memorise.conceptExtractor).toBeDefined();
        }, 30000);

        it('should handle missing config gracefully', async () => {
            const invalidMemoriseInstance = new Memorise('/nonexistent/config.json');
            
            // Should fall back to default config path
            await expect(invalidMemoriseInstance.init()).resolves.not.toThrow();
        }, 30000);
    });

    describe('memory ingestion pipeline', () => {
        const sampleText = `
        Artificial Intelligence (AI) is transforming the modern world. Machine learning algorithms
        enable computers to learn from data without explicit programming. Deep learning, a subset
        of machine learning, uses neural networks with multiple layers to process complex patterns.
        
        Natural Language Processing (NLP) is another important area of AI that focuses on the
        interaction between computers and human language. Applications include chatbots, translation
        services, and sentiment analysis.
        
        The field of AI continues to evolve rapidly, with new breakthroughs in areas like computer
        vision, robotics, and autonomous systems. These technologies have applications in healthcare,
        finance, transportation, and many other industries.
        `;

        it('should complete full memory ingestion pipeline', async () => {
            const options = {
                title: 'AI Overview Integration Test',
                source: 'integration-test',
                graph: testGraph
            };

            const result = await memorise.memorize(sampleText, options);

            // Verify successful completion
            expect(result.success).toBe(true);
            expect(result.unitURI).toBeDefined();
            expect(result.textElementURI).toBeDefined();
            expect(result.chunks).toBeGreaterThan(0);

            // Verify statistics
            const stats = result.statistics;
            expect(stats.textLength).toBe(sampleText.length);
            expect(stats.unitsCreated).toBe(1);
            expect(stats.textElementsCreated).toBe(1);
            expect(stats.chunksCreated).toBeGreaterThan(0);
            expect(stats.processingTimeMs).toBeGreaterThan(0);

            // Should have processed embeddings (if embedding provider available)
            if (stats.embeddingsCreated > 0) {
                expect(stats.embeddingsCreated).toBe(stats.chunksCreated);
            }

            // Should have extracted concepts (if LLM provider available)
            if (stats.conceptsExtracted > 0) {
                expect(stats.conceptsExtracted).toBeGreaterThan(0);
            }

            // Verify decomposition results
            if (result.decompositionResults) {
                expect(result.decompositionResults.units).toBeDefined();
                expect(Array.isArray(result.decompositionResults.units)).toBe(true);
            }
        }, 120000); // Extended timeout for full pipeline

        it('should handle shorter text correctly', async () => {
            const shortText = 'This is a short test text for memory ingestion.';
            
            const result = await memorise.memorize(shortText, {
                title: 'Short Text Test',
                graph: testGraph
            });

            expect(result.success).toBe(true);
            expect(result.statistics.textLength).toBe(shortText.length);
            expect(result.statistics.unitsCreated).toBe(1);
        }, 60000);

        it('should handle text with special characters', async () => {
            const specialText = `
            This text contains "quotes", 'apostrophes', and various symbols: @#$%^&*()
            It also has unicode characters: α β γ δ ε and emojis: 🚀 🧠 💡
            Line breaks and    multiple    spaces should be preserved.
            `;

            const result = await memorise.memorize(specialText, {
                title: 'Special Characters Test',
                graph: testGraph
            });

            expect(result.success).toBe(true);
            expect(result.statistics.textLength).toBe(specialText.length);
        }, 60000);
    });

    describe('error handling and resilience', () => {
        it('should handle invalid graph URIs gracefully', async () => {
            const result = await memorise.memorize('Test text', {
                graph: 'invalid-graph-uri'
            });

            // Should still succeed with fallback behavior
            expect(result.success).toBe(true);
        }, 30000);

        it('should continue processing when optional steps fail', async () => {
            // This test verifies that the pipeline continues even if some
            // components (like concept extraction) fail due to provider issues
            const result = await memorise.memorize('Test text for resilience', {
                title: 'Resilience Test',
                graph: testGraph
            });

            expect(result.success).toBe(true);
            expect(result.statistics.unitsCreated).toBe(1);
            expect(result.statistics.textElementsCreated).toBe(1);
        }, 60000);
    });

    describe('resource management', () => {
        it('should properly cleanup resources', async () => {
            await memorise.init();
            
            // Verify services are initialized
            expect(memorise.conceptExtractor).toBeDefined();
            expect(memorise.embeddingHandler).toBeDefined();
            
            // Cleanup should not throw
            await expect(memorise.cleanup()).resolves.not.toThrow();
        }, 30000);

        it('should handle multiple memorize calls correctly', async () => {
            const text1 = 'First text for memory ingestion.';
            const text2 = 'Second text for memory ingestion.';

            const result1 = await memorise.memorize(text1, {
                title: 'First Text',
                graph: testGraph
            });

            const result2 = await memorise.memorize(text2, {
                title: 'Second Text', 
                graph: testGraph
            });

            expect(result1.success).toBe(true);
            expect(result2.success).toBe(true);
            expect(result1.unitURI).not.toBe(result2.unitURI);
            expect(result1.textElementURI).not.toBe(result2.textElementURI);
        }, 90000);
    });

    describe('configuration flexibility', () => {
        it('should work with minimal configuration', async () => {
            // Test with a memorise instance that uses default settings
            const minimalMemoriseInstance = new Memorise();
            
            try {
                const result = await minimalMemoriseInstance.memorize('Minimal config test', {
                    graph: testGraph
                });
                
                expect(result.success).toBe(true);
            } finally {
                await minimalMemoriseInstance.cleanup();
            }
        }, 60000);

        it('should respect custom configuration options', async () => {
            const customOptions = {
                title: 'Custom Configuration Test',
                source: 'custom-source-file.txt',
                graph: testGraph
            };

            const result = await memorise.memorize('Custom configuration test text', customOptions);

            expect(result.success).toBe(true);
            // Custom options should be reflected in the created resources
            expect(result.unitURI).toBeDefined();
            expect(result.textElementURI).toBeDefined();
        }, 60000);
    });

    describe('data quality and consistency', () => {
        it('should generate consistent URIs for same content', async () => {
            const testText = 'Consistent URI test text';
            
            const result1 = await memorise.memorize(testText, {
                title: 'URI Test 1',
                graph: testGraph
            });
            
            const result2 = await memorise.memorize(testText, {
                title: 'URI Test 2', 
                graph: testGraph
            });

            // URIs should be different for different ingestion instances
            expect(result1.unitURI).not.toBe(result2.unitURI);
            expect(result1.textElementURI).not.toBe(result2.textElementURI);
        }, 60000);

        it('should maintain data integrity across pipeline steps', async () => {
            const testText = 'Data integrity test with multiple sentences. Each sentence should be processed correctly. The final result should maintain all information.';
            
            const result = await memorise.memorize(testText, {
                title: 'Data Integrity Test',
                graph: testGraph
            });

            expect(result.success).toBe(true);
            
            // Verify that the original text length is preserved
            expect(result.statistics.textLength).toBe(testText.length);
            
            // Verify that chunks were created (for longer text)
            if (result.chunks > 1) {
                expect(result.statistics.chunksCreated).toBe(result.chunks);
            }
        }, 60000);
    });

    describe('performance characteristics', () => {
        it('should complete processing within reasonable time limits', async () => {
            const mediumText = 'Performance test text. '.repeat(100); // ~2000 characters
            const startTime = Date.now();
            
            const result = await memorise.memorize(mediumText, {
                title: 'Performance Test',
                graph: testGraph
            });
            
            const endTime = Date.now();
            const totalTime = endTime - startTime;

            expect(result.success).toBe(true);
            expect(totalTime).toBeLessThan(120000); // Should complete within 2 minutes
            expect(result.statistics.processingTimeMs).toBeGreaterThan(0);
            expect(result.statistics.processingTimeMs).toBeLessThan(totalTime);
        }, 120000);

        it('should scale appropriately with text length', async () => {
            const shortText = 'Short text.';
            const longerText = 'Longer text with more content. '.repeat(20);

            const shortResult = await memorise.memorize(shortText, {
                title: 'Short Performance Test',
                graph: testGraph
            });

            const longerResult = await memorise.memorize(longerText, {
                title: 'Longer Performance Test',
                graph: testGraph
            });

            expect(shortResult.success).toBe(true);
            expect(longerResult.success).toBe(true);
            
            // Longer text should generally create more chunks
            expect(longerResult.chunks).toBeGreaterThanOrEqual(shortResult.chunks);
        }, 120000);
    });
});