import logger from 'loglevel'

/**
 * Connector for Ollama API operations
 */
export default class OllamaConnector {
    constructor(baseUrl = 'http://localhost:11434') {
        this.baseUrl = baseUrl
        logger.setLevel('debug')
    }

    /**
     * Generate embeddings using Ollama
     */
    async generateEmbedding(model, input) {
        logger.debug(`Generating embedding with model ${model}`)
        logger.debug('Input:', input)

        try {
            const response = await fetch(`${this.baseUrl}/api/embeddings`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model,
                    prompt: input,
                    options: { num_ctx: 8192 }
                })
            })

            if (!response.ok) {
                throw new Error(`Ollama API error: ${response.status}`)
            }

            const data = await response.json()
            logger.debug('Embedding generated successfully')
            return data.embedding
        } catch (error) {
            logger.error('Embedding generation failed:', error)
            throw error
        }
    }

    /**
     * Generate chat completion using Ollama
     */
    async generateChat(model, messages, options = {}) {
        logger.debug(`Generating chat with model ${model}`)
        logger.debug('Messages:', messages)

        try {
            const response = await fetch(`${this.baseUrl}/api/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model,
                    messages,
                    stream: false,
                    options: {
                        temperature: options.temperature || 0.7,
                        ...options
                    }
                })
            })

            if (!response.ok) {
                throw new Error(`Ollama API error: ${response.status}`)
            }

            const data = await response.json()
            logger.debug('Chat response:', data.message?.content)
            return data.message?.content || ''
        } catch (error) {
            logger.error('Chat generation failed:', error)
            throw error
        }
    }

    /**
     * Generate completion using Ollama
     */
    async generateCompletion(model, prompt, options = {}) {
        logger.debug(`Generating completion with model ${model}`)
        logger.debug('Prompt:', prompt)

        try {
            const response = await fetch(`${this.baseUrl}/api/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model,
                    prompt,
                    stream: false,
                    options: {
                        temperature: options.temperature || 0.7,
                        ...options
                    }
                })
            })

            if (!response.ok) {
                throw new Error(`Ollama API error: ${response.status}`)
            }

            const data = await response.json()
            logger.debug('Completion response:', data.response)
            return data.response || ''
        } catch (error) {
            logger.error('Completion generation failed:', error)
            throw error
        }
    }
}