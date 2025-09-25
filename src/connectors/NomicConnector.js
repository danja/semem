/**
 * Connector for Nomic Atlas API embedding operations using hyperdata-clients
 */
import logger from 'loglevel'
import { createEmbeddingClient } from 'hyperdata-clients'

export default class NomicConnector {
    /**
     * Create a new NomicConnector
     * @param {string} apiKey - Nomic API key (must be provided from Config.js)
     * @param {string} defaultModel - Optional default model to use
     */
    constructor(apiKey = null, defaultModel = 'nomic-embed-text-v1.5') {
        this.apiKey = apiKey // No longer falls back to process.env - must be provided by caller
        this.defaultModel = defaultModel
        this.client = null
        // Don't initialize in constructor - do it lazily
    }

    /**
     * Initialize the Nomic client
     */
    async initialize() {
        try {
            if (!this.apiKey) {
                throw new Error('Nomic API key is required. Configure in config.json llmProviders or provide apiKey parameter.')
            }

            this.client = await createEmbeddingClient('nomic', {
                apiKey: this.apiKey,
                model: this.defaultModel
            })

            logger.debug('Nomic client initialized successfully')
        } catch (error) {
            logger.error('Failed to initialize Nomic client:', error)
            throw error
        }
    }

    /**
     * Generate embeddings using Nomic Atlas API
     * @param {string} model - Model name to use for embedding (optional, uses default)
     * @param {string|string[]} input - Text or array of texts to generate embeddings for
     * @returns {number[]|number[][]} - Vector embedding(s)
     */
    async generateEmbedding(model = this.defaultModel, input) {
        logger.debug(`Generating embedding with Nomic model ${model}`)

        try {
            if (!this.client) {
                await this.initialize()
            }

            // Handle both single text and array of texts
            if (Array.isArray(input)) {
                logger.debug(`Generating embeddings for ${input.length} texts`)
                const embeddings = await this.client.embed(input)
                logger.debug(`Generated ${embeddings.length} embeddings with ${embeddings[0]?.length || 0} dimensions each`)
                return embeddings
            } else {
                logger.debug('Generating embedding for single text')
                const embedding = await this.client.embedSingle(input)
                logger.debug(`Generated embedding with ${embedding.length} dimensions`)
                return embedding
            }
        } catch (error) {
            logger.error('Error generating Nomic embedding:', error)
            throw new Error(`Nomic embedding generation failed: ${error.message}`)
        }
    }

    /**
     * Generate chat completion (not supported by Nomic embedding API)
     */
    async generateCompletion() {
        throw new Error('Chat completion not supported by Nomic embedding API')
    }

    /**
     * Check if the connector is available
     * @returns {boolean} - Whether the connector can be used
     */
    isAvailable() {
        return Boolean(this.apiKey)
    }

    /**
     * Get connector information
     * @returns {object} - Connector metadata
     */
    getInfo() {
        return {
            provider: 'nomic',
            type: 'embedding',
            model: this.defaultModel,
            available: this.isAvailable(),
            capabilities: ['embedding']
        }
    }
}