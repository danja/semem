import logger from 'loglevel'
import OllamaConnector from '../src/connectors/OllamaConnector.js'

class ClaudeConnector {
    constructor(apiKey, baseUrl = 'https://api.anthropic.com') {
        this.apiKey = apiKey
        this.baseUrl = baseUrl
        this.defaultModel = 'claude-3-opus-20240229'
    }

    async generateChat(model, messages, options = {}) {
        console.log("Using Claude API for chat:", messages);
        
        const response = await fetch(`${this.baseUrl}/v1/messages`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': this.apiKey,
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
                model: this.defaultModel,
                messages: messages.map(msg => ({
                    role: msg.role === 'system' ? 'user' : msg.role,
                    content: msg.content
                })),
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
}

async function main() {
    // Load environment variables
    const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY
    if (!CLAUDE_API_KEY) {
        throw new Error('CLAUDE_API_KEY environment variable is required')
    }

    // Initialize clients
    const claude = new ClaudeConnector(CLAUDE_API_KEY)
    const ollama = new OllamaConnector()
    
    try {
        // Test Claude chat API
        console.log("\n--- Testing Claude Chat API ---")
        const chatResponse = await claude.generateChat('claude-3-opus-20240229', [
            { role: 'user', content: "What's the current state of AI technology? Keep it brief." }
        ])
        console.log('Claude Chat Response:', chatResponse)
        
        // Test Ollama embeddings API
        console.log("\n--- Testing Ollama Embeddings API ---")
        const embeddingText = "What's the current state of AI technology?"
        const embedding = await ollama.generateEmbedding('nomic-embed-text', embeddingText)
        console.log('Ollama Embedding:', `(Vector with ${embedding.length} dimensions)`)
        
        console.log("\nTests completed successfully")
    } catch (error) {
        console.error('Error during execution:', error)
    }
}

// Start the application
main().catch((error) => {
    console.error('Fatal error:', error)
})