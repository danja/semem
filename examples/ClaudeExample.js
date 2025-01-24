import MemoryManager from '../src/MemoryManager.js'
import JSONStore from '../src/stores/JSONStore.js'
import Config from '../src/Config.js'

class ClaudeConnector {
    constructor(apiKey, baseUrl = 'https://api.anthropic.com/v1') {
        this.apiKey = apiKey
        this.baseUrl = baseUrl
        this.defaultModel = 'claude-3-opus-20240229'
    }

    async generateEmbedding(model, input) {
        const response = await fetch(`${this.baseUrl}/messages`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': this.apiKey,
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
                model: this.defaultModel,
                messages: [{ role: 'user', content: input }],
                system: "Generate an embedding vector for the input text."
            })
        })

        if (!response.ok) {
            throw new Error(`Claude API error: ${response.status}`)
        }

        const data = await response.json()
        return data.embedding
    }

    async generateChat(model, messages, options = {}) {
        const response = await fetch(`${this.baseUrl}/messages`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': this.apiKey,
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
                model: this.defaultModel,
                messages: messages.map(msg => ({
                    role: msg.role,
                    content: msg.content
                })),
                ...options
            })
        })

        if (!response.ok) {
            throw new Error(`Claude API error: ${response.status}`)
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
                provider: 'claude',
                model: 'claude-3-opus-20240229'
            }
        }
    })

    const storage = new JSONStore(config.get('storage.options.path'))
    const claude = new ClaudeConnector(CLAUDE_API_KEY)

    memoryManager = new MemoryManager({
        llmProvider: claude,
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

// Start the application
main().catch(async (error) => {
    console.error('Fatal error:', error)
    await shutdown('fatal error')
})

export default ClaudeConnector