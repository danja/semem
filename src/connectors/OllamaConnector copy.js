import logger from 'loglevel'
import fetch from 'node-fetch'

export default class OllamaConnector {
    constructor(baseUrl = 'http://localhost:11434') {
        this.baseUrl = baseUrl
    }

    async generateEmbedding(model, input) {
        logger.setLevel('debug')
        model = await Promise.resolve(model) // TODO unhackify
        logger.log(`OllamaConnector.generateEmbedding, \nmodel = ${model} \ninput = ${input}`)
        const response = await fetch(`${this.baseUrl}/api/embeddings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model,
                prompt: input,
                options: {
                    num_ctx: 8192
                }
            })
        })

        if (!response.ok) {
            throw new Error(`Ollama API error: ${response.status}`)
        }

        const data = await response.json()
        return data.embedding
    }

    async generateChat(model, messages, options = {}) {
        const response = await fetch(`${this.baseUrl}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model,
                messages,
                stream: false,
                options
            })
        })

        if (!response.ok) {
            throw new Error(`Ollama API error: ${response.status}`)
        }

        const data = await response.json()
        return data.message.content
    }

    async generateCompletion(model, prompt, options = {}) {
        const response = await fetch(`${this.baseUrl}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model,
                prompt,
                stream: false,
                options
            })
        })

        if (!response.ok) {
            throw new Error(`Ollama API error: ${response.status}`)
        }

        const data = await response.json()
        return data.response
    }
}
