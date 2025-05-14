/**
 * Claude Example for Semem
 * 
 * This example demonstrates using Claude with Semem:
 * - Uses Claude for chat generation
 * - Uses Ollama for embeddings
 * - Stores interactions in a JSON store
 * 
 * Usage:
 * 1. Create a .env file in the project root (copy from example.env)
 * 2. Add your Claude API key to the .env file:
 *    CLAUDE_API_KEY=your_actual_key_here
 * 3. Run the example:
 *    node examples/ClaudeExample.js
 * 
 * Environment Variables:
 * - CLAUDE_API_KEY: Your Claude API key (required)
 * - CLAUDE_API_BASE: Claude API endpoint (default: https://api.anthropic.com)
 * - CLAUDE_MODEL: Claude model to use (default: claude-3-opus-20240229)
 * - OLLAMA_API_BASE: Ollama API endpoint (default: http://localhost:11434)
 * - EMBEDDING_MODEL: Model for embeddings (default: nomic-embed-text)
 * - MEMORY_JSON_PATH: Path to memory storage (default: data/memory.json)
 * - TEST_PROMPT: Custom prompt to use (optional)
 * - CUSTOM_CONCEPTS: Comma-separated concepts (optional)
 * - OPERATION_TIMEOUT: Timeout in milliseconds (default: 60000)
 */

import logger from 'loglevel'
import MemoryManager from '../src/MemoryManager.js'
import JSONStore from '../src/stores/JSONStore.js'
import Config from '../src/Config.js'
import OllamaConnector from '../src/connectors/OllamaConnector.js'
import dotenv from 'dotenv'

// Load environment variables from .env file
dotenv.config()

class ClaudeConnector {
    constructor(apiKey, baseUrl = 'https://api.anthropic.com') {
        this.apiKey = apiKey
        this.baseUrl = baseUrl
        this.defaultModel = 'claude-3-opus-20240229' // Update default model
    }

    async generateEmbedding(model, input) {
        // This is a fallback method - we won't use it in practice since we use Ollama for embeddings
        // Claude doesn't have a stable embedding API yet, so we'll just log the attempt
        logger.setLevel('debug')
        logger.log(`ClaudeExample.generateEmbedding called but using Ollama instead`)
        logger.log(`Model: ${model}, Input length: ${input.length} chars`)
        
        // Throw error - Claude embeddings are not supported
        throw new Error('Claude embeddings not supported directly. Use Ollama for embeddings.');
    }

    async generateChat(model, messages, options = {}) {
        // Handle system message separately for Claude API
        let systemPrompt = null;
        const cleanedMessages = [];
        
        // Process messages
        for (const msg of messages) {
            if (msg.role === 'system') {
                systemPrompt = msg.content;
            } else {
                cleanedMessages.push({
                    role: msg.role,
                    content: msg.content
                });
            }
        }
        
        console.log("Using Claude API for chat with model:", this.defaultModel);
        
        const response = await fetch(`${this.baseUrl}/v1/messages`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': this.apiKey,
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
                model: this.defaultModel,
                messages: cleanedMessages,
                system: systemPrompt, // Claude API takes system prompt separately
                max_tokens: 1000,
                ...options
            })
        })

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Claude API error: ${response.status} ${errorText}`);
        }

        const data = await response.json()
        return data.content[0].text
    }

    async generateCompletion(model, prompt, options = {}) {
        return this.generateChat(model, [{
            role: 'user',
            content: prompt
        }], options)
    }
}

// Handle graceful shutdown
let memoryManager = null

async function shutdown(signal) {
    console.log(`\nReceived ${signal}, starting graceful shutdown...`)
    if (memoryManager) {
        try {
            await memoryManager.dispose()
            console.log('Cleanup complete')
            process.exit(0)
        } catch (error) {
            console.error('Error during cleanup:', error)
            process.exit(1)
        }
    } else {
        process.exit(0)
    }
}

// Handle different termination signals
process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))
process.on('uncaughtException', async (error) => {
    console.error('Uncaught Exception:', error)
    await shutdown('uncaughtException')
})
process.on('unhandledRejection', async (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason)
    await shutdown('unhandledRejection')
})

async function main() {
    // Get API key from environment variables (loaded by dotenv)
    const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY
    if (!CLAUDE_API_KEY) {
        console.error("Error: CLAUDE_API_KEY not found in environment variables")
        console.error("Please create a .env file with your Claude API key based on example.env")
        throw new Error('CLAUDE_API_KEY environment variable is required')
    }
    
    console.log("Successfully loaded Claude API key from environment")

    // Use environment variables for configuration where available
    const config = Config.create({
        storage: {
            type: 'json',
            options: {
                path: process.env.MEMORY_JSON_PATH || 'data/memory.json'
            }
        },
        models: {
            chat: {
                provider: 'claude',
                model: process.env.CLAUDE_MODEL || 'claude-3-opus-20240229'
            },
            embedding: {
                provider: 'ollama',
                model: process.env.EMBEDDING_MODEL || 'nomic-embed-text'
            }
        }
    })

    console.log(`Using Claude model: ${config.get('models.chat.model')}`)
    console.log(`Using embedding model: ${config.get('models.embedding.model')}`)
    
    // Initialize storage
    const storage = new JSONStore(config.get('storage.options.path'))
    
    // Initialize LLM providers
    const claude = new ClaudeConnector(CLAUDE_API_KEY, process.env.CLAUDE_API_BASE || 'https://api.anthropic.com')
    const ollama = new OllamaConnector(process.env.OLLAMA_API_BASE || 'http://localhost:11434')

    // Create memory manager with proper configuration
    memoryManager = new MemoryManager({
        llmProvider: claude,
        embeddingProvider: ollama,
        chatModel: config.get('models.chat.model'),
        embeddingModel: config.get('models.embedding.model'),
        storage,
        // Use other environment variables where available
        dimension: parseInt(process.env.EMBEDDING_DIMENSION || '1536', 10),
        contextOptions: {
            maxTokens: parseInt(process.env.MAX_TOKENS || '8192', 10)
        },
        cacheOptions: {
            maxSize: parseInt(process.env.CACHE_SIZE || '1000', 10),
            ttl: parseInt(process.env.CACHE_TTL || '3600000', 10)
        }
    })

    // Test prompt - can be customized via env var
    const prompt = process.env.TEST_PROMPT || "What's the current state of AI technology?"
    console.log(`Using test prompt: "${prompt}"`)

    try {
        // Set timeout value from env or default to 60 seconds
        const timeoutValue = parseInt(process.env.OPERATION_TIMEOUT || '60000', 10);
        console.log(`Setting operation timeout to ${timeoutValue}ms`);
        
        // Set a timeout to avoid hanging
        const timeout = setTimeout(() => {
            console.log('Operation timed out, shutting down gracefully...');
            shutdown('timeout');
        }, timeoutValue);
        
        console.log("Generating response from Claude...");
        // Generate a response using Claude
        const response = await memoryManager.generateResponse(prompt, []);
        console.log('\nResponse from Claude:');
        console.log('-------------------');
        console.log(response);
        console.log('-------------------\n');
        
        console.log("Generating embedding...");
        // Generate embedding using Ollama for the prompt
        const embedding = await memoryManager.generateEmbedding(prompt);
        console.log(`Generated embedding of length: ${embedding.length}`);
        
        // Extract concepts - can be customized via env
        const concepts = process.env.CUSTOM_CONCEPTS ? 
            process.env.CUSTOM_CONCEPTS.split(',') : 
            ["AI", "technology", "current state"];
        
        console.log("Adding interaction to memory...");
        // Add the interaction to memory
        await memoryManager.addInteraction(prompt, response, embedding, concepts);
        
        // Clear timeout since we finished successfully
        clearTimeout(timeout);
        
        console.log('\n✅ Successfully added interaction to memory');
    } catch (error) {
        console.error('\n❌ Error during execution:');
        console.error('------------------------');
        if (error.response) {
            // If it's an API error with response data
            console.error(`Status: ${error.response.status}`);
            console.error(`Message: ${error.message}`);
            try {
                const errorData = await error.response.text();
                console.error(`Response: ${errorData}`);
            } catch (e) {
                console.error('Could not parse error response');
            }
        } else {
            // Regular error
            console.error(error);
        }
        console.error('------------------------');
        
        await shutdown('error');
    }
}

// Start the application
main().catch(async (error) => {
    console.error('Fatal error:', error)
    await shutdown('fatal error')
})

export default ClaudeConnector