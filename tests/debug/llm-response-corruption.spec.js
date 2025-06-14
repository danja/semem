// tests/debug/llm-response-corruption.spec.js
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import OllamaConnector from '../../src/connectors/OllamaConnector.js';
import LLMHandler from '../../src/handlers/LLMHandler.js';

// Don't mock anything - we want to test real LLM communication
describe('LLM Response Corruption Debug', () => {
    let connector;
    let handler;

    beforeEach(() => {
        // Test with real connector to see where corruption happens
        connector = new OllamaConnector();
        handler = new LLMHandler(connector, 'qwen2:1.5b');
    });

    describe('Raw LLM Communication', () => {
        it('should test raw generateCompletion for concept extraction', async () => {
            const testText = "Artificial intelligence and machine learning are transforming technology.";
            
            try {
                console.error('\\n=== Testing Raw LLM Communication ===');
                console.error('Input text:', testText);
                
                // Test the exact prompt used by extractConcepts
                const PromptTemplates = await import('../../src/PromptTemplates.js');
                const prompt = PromptTemplates.default.formatConceptPrompt('qwen2:1.5b', testText);
                console.error('Generated prompt:', prompt);
                
                // Make raw call to LLM
                const rawResponse = await connector.generateCompletion('qwen2:1.5b', prompt, { temperature: 0.2 });
                console.error('Raw LLM response:', JSON.stringify(rawResponse));
                console.error('Raw response type:', typeof rawResponse);
                console.error('Raw response length:', rawResponse?.length);
                
                // Test our JSON parsing
                const concepts = await handler.extractConcepts(testText);
                console.error('Parsed concepts:', concepts);
                
                // Verify response isn't truncated
                expect(typeof rawResponse).toBe('string');
                expect(rawResponse.length).toBeGreaterThan(10);
                
                // Try to identify corruption patterns
                if (rawResponse.includes('Cannot rea')) {
                    console.log('🔴 FOUND CORRUPTION: "Cannot rea" detected');
                }
                
                if (rawResponse.startsWith('{"') && !rawResponse.endsWith('"}')) {
                    console.log('🔴 FOUND TRUNCATION: JSON appears cut off');
                }
                
                console.log('\\n=== End Test ===\\n');
                
            } catch (error) {
                console.log('🔴 ERROR in raw communication:', error.message);
                console.log('Error type:', error.constructor.name);
                throw error;
            }
        }, 10000); // 10 second timeout

        it('should test raw embedding generation', async () => {
            const testText = "Test embedding generation";
            
            try {
                console.log('\\n=== Testing Raw Embedding Generation ===');
                console.log('Input text:', testText);
                
                const rawEmbedding = await connector.generateEmbedding('nomic-embed-text', testText);
                console.log('Embedding type:', typeof rawEmbedding);
                console.log('Embedding length:', rawEmbedding?.length);
                console.log('First few values:', rawEmbedding?.slice(0, 5));
                
                expect(Array.isArray(rawEmbedding)).toBe(true);
                expect(rawEmbedding.length).toBeGreaterThan(1000);
                
                console.log('\\n=== End Test ===\\n');
                
            } catch (error) {
                console.log('🔴 ERROR in embedding generation:', error.message);
                
                // Check if it's a JSON parsing error
                if (error.message.includes('Unexpected token')) {
                    console.log('🔴 JSON PARSING ERROR detected in embedding generation');
                    console.log('This indicates the Ollama response is corrupted');
                }
                
                throw error;
            }
        }, 10000);

        it('should test raw chat generation', async () => {
            const messages = [
                { role: 'user', content: 'Say hello in exactly 5 words.' }
            ];
            
            try {
                console.log('\\n=== Testing Raw Chat Generation ===');
                console.log('Input messages:', JSON.stringify(messages));
                
                const rawResponse = await connector.generateChat('qwen2:1.5b', messages, { temperature: 0.7 });
                console.log('Raw chat response:', JSON.stringify(rawResponse));
                console.log('Response type:', typeof rawResponse);
                console.log('Response length:', rawResponse?.length);
                
                expect(typeof rawResponse).toBe('string');
                expect(rawResponse.length).toBeGreaterThan(0);
                
                console.log('\\n=== End Test ===\\n');
                
            } catch (error) {
                console.log('🔴 ERROR in chat generation:', error.message);
                
                if (error.message.includes('Unexpected token')) {
                    console.log('🔴 JSON PARSING ERROR detected in chat generation');
                }
                
                throw error;
            }
        }, 10000);
    });

    describe('Error Pattern Analysis', () => {
        it('should analyze the specific "Cannot rea" error pattern', () => {
            // Test cases that might produce this error
            const corruptedResponses = [
                'Cannot rea',
                'Cannot read',
                'Cannot read properties',
                '{"Cannot rea',
                '"Cannot rea"...',
                '"message": "Cannot rea'
            ];
            
            console.log('\\n=== Analyzing Corruption Patterns ===');
            
            for (const response of corruptedResponses) {
                console.log(`Testing corrupted response: "${response}"`);
                
                try {
                    JSON.parse(response);
                    console.log('  ✅ Unexpectedly valid JSON');
                } catch (error) {
                    console.log(`  🔴 JSON Error: ${error.message}`);
                    expect(error.message).toContain('Unexpected token');
                }
            }
            
            console.log('\\n=== End Analysis ===\\n');
        });
    });
});