import logger from 'loglevel'
import MemoryManager from '../src/MemoryManager.js'
import JSONStore from '../src/stores/JSONStore.js'
import Config from '../src/Config.js'
import OllamaConnector from '../src/connectors/OllamaConnector.js'

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
    // Load environment variables
    const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY
    if (!CLAUDE_API_KEY) {
        throw new Error('CLAUDE_API_KEY environment variable is required')
    }

    const config = Config.create({
        storage: {
            type: 'json',
            options: {
                path: 'data/memory.json'
            }
        },
        models: {
            chat: {
                provider: 'claude',
                model: 'claude-3-opus-20240229'
            },
            embedding: {
                provider: 'claude',
                model: 'claude-3-opus-20240229'
            }
        }
    })

    const storage = new JSONStore(config.get('storage.options.path'))
    const claude = new ClaudeConnector(CLAUDE_API_KEY)
    const ollama = new OllamaConnector()

    memoryManager = new MemoryManager({
        llmProvider: claude,
        embeddingProvider: ollama,
        chatModel: config.get('models.chat.model'),
        embeddingModel: 'nomic-embed-text',
        storage
    })

    const prompt = "What's the current state of AI technology?"

    try {
        // Simplified example to just generate a response
        const response = await memoryManager.generateResponse(prompt, [])
        console.log('Response:', response)
        
        // Set a timeout to avoid hanging
        const timeout = setTimeout(() => {
            console.log('Operation timed out, shutting down gracefully...');
            shutdown('timeout');
        }, 60000); // 60 second timeout
        
        // Generate embedding using Ollama for the prompt only (faster)
        const embedding = await memoryManager.generateEmbedding(prompt);
        console.log('Generated embedding of length:', embedding.length);
        
        // Add simple concepts directly instead of extracting them (faster)
        const concepts = ["AI", "technology", "current state"];
        await memoryManager.addInteraction(prompt, response, embedding, concepts);
        
        // Clear timeout since we finished successfully
        clearTimeout(timeout);
        
        console.log('Successfully added interaction')
    } catch (error) {
        console.error('Error during execution:', error)
        await shutdown('error')
    }
}

// Start the application
main().catch(async (error) => {
    console.error('Fatal error:', error)
    await shutdown('fatal error')
})

export default ClaudeConnector