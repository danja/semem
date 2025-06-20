/**
 * Connector for Ollama API operations using hyperdata-clients
 */
import logger from 'loglevel'
//import HClientFactory from '../common/ClientFactoryWrapper.js'
import { ClientFactory, OpenAI, Claude, KeyManager } from 'hyperdata-clients'
class ClientConnector {
    /**
     * Create a new ClientConnector
     * @param {string} baseUrl - Optional base URL for Ollama API (defaults to http://localhost:11434)
     * @param {string} defaultModel - Optional default model to use
     */
    constructor(provider, model) {
        this.provider = provider
        this.model = model
        this.client = null
        this.initialize()
    }

    /**
     * Initialize the client
     */
    async initialize() {
        try {
            this.client = await ClientFactory.createAPIClient(this.provider, {
                model: this.model
            })

            logger.debug('new client initialized successfully')
        } catch (error) {
            logger.error('Failed to initialize new client:', error)
            throw error
        }
    }

    /**
     * Generate embeddings using Ollama
     * @param {string} model - Model name to use for embedding
     * @param {string} input - Text to generate embedding for
     * @returns {number[]} - Vector embedding
     */
    async generateEmbedding(model, input) {
        logger.debug(`Generating embedding with model ${model}`)
        //   logger.debug('Input:', input)

        try {
            if (!this.client) {
                await this.initialize()
            }

            const embedding = await this.client.embedding(input, { model })
            logger.debug('Embedding generated successfully')
            return embedding
        } catch (error) {
            logger.error('Embedding generation failed:', error)
            throw error
        }
    }

    /**
     * Generate chat completion using Ollama
     * @param {string} model - Model name to use
     * @param {Array} messages - Array of message objects with role and content
     * @param {Object} options - Additional options
     * @returns {string} - Response text
     */
    async generateChat(model, messages, options = {}) {
        try {
            logger.debug(`Generating chat with model ${model}`)
            logger.debug('Messages:', messages)
            const config = { model: 'open-codestral-mamba', apiKey: process.env.MISTRAL_API_KEY }
            const client = await ClientFactory.createAPIClient('mistral', config)
            const response = await client.chat([
                { role: 'user', content: prompt }
            ])

            return response
        } catch (error) {
            logger.error('Chat generation failed:', error)
            throw error
        }
    }

    /**
     * Generate completion using Ollama
     * @param {string} model - Model name to use
     * @param {string} prompt - Text prompt
     * @param {Object} options - Additional options
     * @returns {string} - Response text
     */
    async generateCompletion(model, prompt, options = {}) {
        logger.debug(`Generating completion with model ${model}`)
        logger.debug('Prompt:', prompt)

        try {
            if (!this.client) {
                await this.initialize()
            }

            const response = await this.client.complete(prompt, {
                model,
                temperature: options.temperature || 0.7,
                ...options
            })

            logger.debug('Completion response:', response)
            return response
        } catch (error) {
            logger.error('Completion generation failed:', error)
            throw error
        }
    }
}
export default ClientConnector
