// tests/debug/connector-bypass.spec.js
import { describe, it, expect } from 'vitest';

describe('Connector Bypass Tests', () => {
    it('should test direct Ollama API vs OllamaConnector', async () => {
        const testPrompt = 'Extract key concepts from: artificial intelligence and machine learning';
        
        // Test 1: Direct API call
        console.error('\\n=== Testing Direct Ollama API ===');
        const directResponse = await fetch('http://localhost:11434/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: 'qwen2:1.5b',
                prompt: testPrompt,
                stream: false
            })
        });
        
        const directResult = await directResponse.json();
        console.error('Direct API response:', JSON.stringify(directResult, null, 2));
        console.error('Direct response text:', directResult.response);
        
        // Test 2: Through OllamaConnector
        console.error('\\n=== Testing Through OllamaConnector ===');
        const OllamaConnector = await import('../../src/connectors/OllamaConnector.js');
        const connector = new OllamaConnector.default();
        
        try {
            const connectorResponse = await connector.generateCompletion('qwen2:1.5b', testPrompt);
            console.error('Connector response:', JSON.stringify(connectorResponse));
            console.error('Connector response type:', typeof connectorResponse);
            
            // Compare responses
            const directText = directResult.response;
            const connectorText = connectorResponse;
            
            console.error('\\n=== Comparison ===');
            console.error('Direct length:', directText?.length);
            console.error('Connector length:', connectorText?.length);
            console.error('Are equal:', directText === connectorText);
            
            if (directText !== connectorText) {
                console.error('🔴 MISMATCH DETECTED!');
                console.error('Direct first 100 chars:', directText?.substring(0, 100));
                console.error('Connector first 100 chars:', connectorText?.substring(0, 100));
            }
            
        } catch (error) {
            console.error('🔴 Connector error:', error.message);
            console.error('Error includes "Cannot rea":', error.message.includes('Cannot rea'));
        }
        
        expect(directResult.response).toBeDefined();
        expect(typeof directResult.response).toBe('string');
    }, 10000);
});