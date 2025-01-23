import MemoryManager from './MemoryManager.js'
import JSONStore from './stores/JSONStore.js'
import Config from './Config.js'
import Anthropic from '@anthropic-ai/sdk'

class HybridConnector {
    constructor(claudeApiKey, ollamaBaseUrl = 'http://localhost:11434') {
        this.anthropic = new Anthropic({ apiKey: claudeApiKey })
        this.ollamaBaseUrl = ollamaBaseUrl
    }

    async generateEmbedding(model, input) {
        const response = await fetch(`${this.ollamaBaseUrl}/api/embeddings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: 'nomic-embed-text',
                prompt: input,
                options: { num_ctx: 8192 }
            })
        })

        if (!response.ok) {
            throw new Error(`Ollama embedding error: ${response.status}`)
        }

        const data = await response.json()
        return data.embedding
    }

    async generateChat(model, messages, options = {}) {
        const response = await this.anthropic.messages.create({
            model: "claude-3-opus-20240229",
            max_tokens: options.max_tokens || 1024,
            messages: messages.map(msg => ({
                role: msg.role,
                content: msg.content
            })),
            ...options
        })

        return response.content[0].text
    }

    async generateCompletion(model, prompt, options = {}) {
        return this.generateChat(model, [{
            role: 'user',
            content: prompt
        }], options)
    }
}

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
    const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY
    if (!CLAUDE_API_KEY) {
        throw new Error('CLAUDE_API_KEY environment variable is required')
    }

    const config = new Config({
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
                provider: 'ollama',
                model: 'nomic-embed-text'
            }
        }
    })

    const storage = new JSONStore(config.get('storage.options.path'))
    const hybridProvider = new HybridConnector(CLAUDE_API_KEY)

    memoryManager = new MemoryManager({
        llmProvider: hybridProvider,
        chatModel: config.get('models.chat.model'),
        embeddingModel: config.get('models.embedding.model'),
        storage
    })

    const prompt = "What's the current state of AI technology?"

    try {
        const relevantInteractions = await memoryManager.retrieveRelevantInteractions(prompt)
        const response = await memoryManager.generateResponse(prompt, [], relevantInteractions)
        console.log('Response:', response)

        const embedding = await memoryManager.generateEmbedding(`${prompt} ${response}`)
        const concepts = await memoryManager.extractConcepts(`${prompt} ${response}`)
        await memoryManager.addInteraction(prompt, response, embedding, concepts)
    } catch (error) {
        console.error('Error during execution:', error)
        await shutdown('error')
    }
}

main().catch(async (error) => {
    console.error('Fatal error:', error)
    await shutdown('fatal error')
})