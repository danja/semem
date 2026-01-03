/**
 * Integration test for LLM Chat API Communication
 * Tests the configured chat API using Config.js to validate provider-agnostic functionality
 */

import { test, expect, describe, beforeAll, afterAll } from 'vitest';
import Config from '../../../src/Config.js';

// Skip this test if INTEGRATION_TESTS environment variable is not set
const shouldSkip = process.env.INTEGRATION_TESTS !== 'true';

describe('LLM Chat API Integration (Config-Driven)', { skip: shouldSkip }, () => {
    let config;
    let providerConfig;

    beforeAll(async () => {
        try {
            // Initialize configuration from config.json (same as production)
            config = new Config('config/config.json');
            await config.init();

            // Get LLM provider configuration exactly as the system does
            const llmProviders = config.get('llmProviders') || [];
            const chatProviders = llmProviders.filter(p => p.capabilities?.includes('chat'));

            if (chatProviders.length === 0) {
                throw new Error('No chat providers configured in config.json. Please check llmProviders section.');
            }

            // Use the same priority logic as the real system
            const sortedProviders = chatProviders.sort((a, b) => (a.priority || 999) - (b.priority || 999));
            providerConfig = sortedProviders[0];

        } catch (error) {
            throw error;
        }
    });

    describe('Configuration-Driven Setup', () => {
        test('should load and validate config.json', () => {
            expect(config).toBeDefined();
            expect(config.initialized).toBe(true);

            const llmProviders = config.get('llmProviders');
            expect(llmProviders).toBeInstanceOf(Array);
            expect(llmProviders.length).toBeGreaterThan(0);

            const chatProviders = llmProviders.filter(p => p.capabilities?.includes('chat'));
            expect(chatProviders.length).toBeGreaterThan(0);

        });

        test('should select correct provider by priority', () => {
            expect(providerConfig).toBeDefined();
            expect(providerConfig.type).toBeDefined();
            expect(providerConfig.capabilities).toContain('chat');

            // If it's not ollama, it should have an API key
            if (providerConfig.type !== 'ollama') {
                expect(providerConfig.apiKey).toBeDefined();
                expect(providerConfig.apiKey.length).toBeGreaterThan(0);
            }

        });
    });

    describe('LLM API Integration via Node Process', () => {
        test('should perform concept extraction using configured provider', async () => {
            // Since vitest has timeout issues, use a subprocess approach
            const { spawn } = await import('child_process');

            const testScript = `
import LLMHandler from './src/handlers/LLMHandler.js';
import GroqConnector from './src/connectors/GroqConnector.js';
import MistralConnector from './src/connectors/MistralConnector.js';
import OllamaConnector from './src/connectors/OllamaConnector.js';
import ClaudeConnector from './src/connectors/ClaudeConnector.js';

const providerType = '${providerConfig.type}';
const apiKey = '${providerConfig.apiKey || ''}';
const model = '${providerConfig.chatModel}';

let llmProvider;
if (providerType === 'groq') {
    if (!apiKey) {
        throw new Error('Missing Groq API key for configured provider');
    }
    llmProvider = new GroqConnector(apiKey);
} else if (providerType === 'mistral') {
    if (!apiKey) {
        throw new Error('Missing Mistral API key for configured provider');
    }
    llmProvider = new MistralConnector(apiKey);
} else if (providerType === 'claude') {
    if (!apiKey) {
        throw new Error('Missing Claude API key for configured provider');
    }
    llmProvider = new ClaudeConnector(apiKey);
} else if (providerType === 'ollama') {
    llmProvider = new OllamaConnector();
} else {
    throw new Error(`Unsupported provider type: ${providerType}`);
}

const llmHandler = new LLMHandler(llmProvider, model);
const testText = 'AI transforms technology';

const startTime = Date.now();
try {
    const concepts = await llmHandler.extractConcepts(testText);
    const duration = Date.now() - startTime;

    console.log(JSON.stringify({
        success: true,
        provider: providerType,
        model: model,
        duration: duration,
        conceptCount: concepts.length,
        concepts: concepts.slice(0, 3)
    }));
} catch (error) {
    console.log(JSON.stringify({
        success: false,
        provider: providerType,
        error: error.message,
        duration: Date.now() - startTime
    }));
}
`;

            return new Promise((resolve, reject) => {
                const child = spawn('node', ['--input-type=module', '-e', testScript], {
                    stdio: ['pipe', 'pipe', 'pipe'],
                    timeout: 10000 // 10 second timeout
                });

                let stdout = '';
                let stderr = '';

                child.stdout.on('data', (data) => {
                    stdout += data.toString();
                });

                child.stderr.on('data', (data) => {
                    stderr += data.toString();
                });

                child.on('close', (code) => {
                    try {
                        if (code !== 0) {
                            reject(new Error(`Process exited with code ${code}`));
                            return;
                        }

                        // Extract the JSON result from stdout
                        const lines = stdout.trim().split('\n');
                        const lastLine = lines[lines.length - 1];
                        const result = JSON.parse(lastLine);

                        expect(result.success).toBe(true);
                        expect(result.provider).toBe(providerConfig.type);
                        expect(result.duration).toBeLessThan(5000); // Should complete in under 5 seconds
                        expect(result.conceptCount).toBeGreaterThanOrEqual(0);

                        resolve();
                    } catch (parseError) {
                        reject(parseError);
                    }
                });

                child.on('error', (error) => {
                    reject(error);
                });
            });
        }, 15000); // 15 second vitest timeout

        test('should perform chat response using configured provider', async () => {
            const { spawn } = await import('child_process');

            const testScript = `
import LLMHandler from './src/handlers/LLMHandler.js';
import GroqConnector from './src/connectors/GroqConnector.js';
import MistralConnector from './src/connectors/MistralConnector.js';
import OllamaConnector from './src/connectors/OllamaConnector.js';
import ClaudeConnector from './src/connectors/ClaudeConnector.js';

const providerType = '${providerConfig.type}';
const apiKey = '${providerConfig.apiKey || ''}';
const model = '${providerConfig.chatModel}';

let llmProvider;
if (providerType === 'groq') {
    if (!apiKey) {
        throw new Error('Missing Groq API key for configured provider');
    }
    llmProvider = new GroqConnector(apiKey);
} else if (providerType === 'mistral') {
    if (!apiKey) {
        throw new Error('Missing Mistral API key for configured provider');
    }
    llmProvider = new MistralConnector(apiKey);
} else if (providerType === 'claude') {
    if (!apiKey) {
        throw new Error('Missing Claude API key for configured provider');
    }
    llmProvider = new ClaudeConnector(apiKey);
} else if (providerType === 'ollama') {
    llmProvider = new OllamaConnector();
} else {
    throw new Error(`Unsupported provider type: ${providerType}`);
}

const llmHandler = new LLMHandler(llmProvider, model);

const startTime = Date.now();
try {
    const response = await llmHandler.generateResponse('What is 1+1?', 'Math test');
    const duration = Date.now() - startTime;

    console.log(JSON.stringify({
        success: true,
        provider: providerType,
        model: model,
        duration: duration,
        responseLength: response.length,
        response: response.substring(0, 100)
    }));
} catch (error) {
    console.log(JSON.stringify({
        success: false,
        provider: providerType,
        error: error.message,
        duration: Date.now() - startTime
    }));
}
`;

            return new Promise((resolve, reject) => {
                const child = spawn('node', ['--input-type=module', '-e', testScript], {
                    stdio: ['pipe', 'pipe', 'pipe'],
                    timeout: 10000 // 10 second timeout
                });

                let stdout = '';
                let stderr = '';

                child.stdout.on('data', (data) => {
                    stdout += data.toString();
                });

                child.stderr.on('data', (data) => {
                    stderr += data.toString();
                });

                child.on('close', (code) => {
                    try {
                        if (code !== 0) {
                            reject(new Error(`Process exited with code ${code}`));
                            return;
                        }

                        // Extract the JSON result from stdout
                        const lines = stdout.trim().split('\n');
                        const lastLine = lines[lines.length - 1];
                        const result = JSON.parse(lastLine);

                        expect(result.success).toBe(true);
                        expect(result.provider).toBe(providerConfig.type);
                        expect(result.duration).toBeLessThan(5000); // Should complete in under 5 seconds
                        expect(result.responseLength).toBeGreaterThan(0);

                        resolve();
                    } catch (parseError) {
                        reject(parseError);
                    }
                });

                child.on('error', (error) => {
                    reject(error);
                });
            });
        }, 15000); // 15 second vitest timeout
    });

    describe('Provider Migration Readiness', () => {
        test('should demonstrate provider-agnostic functionality', () => {
            const llmProviders = config.get('llmProviders') || [];
            const chatProviders = llmProviders.filter(p => p.capabilities?.includes('chat'));

            expect(chatProviders.length).toBeGreaterThan(0);

            const providerTypes = chatProviders.map(p => p.type);
            // Validate priority ordering works
            const priorities = chatProviders.map(p => p.priority || 999);
            const sortedPriorities = [...priorities].sort((a, b) => a - b);
            expect(priorities[0]).toBe(sortedPriorities[0]);
        });
    });
});
