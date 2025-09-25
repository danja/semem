/**
 * Connector for Nomic Atlas API embedding operations using hyperdata-clients
 */
import logger from 'loglevel'
import { createEmbeddingClient } from 'hyperdata-clients'
import Config from '../Config.js';

export default class NomicConnector {
    /**
     * Create a new NomicConnector
     * @param {string} apiKey - Nomic API key (optional, defaults to Config.js value)
     * @param {string} defaultModel - Optional default model to use
     */
    constructor(apiKey = null, defaultModel = null) {
        const config = new Config();
        config.init();

        const nomicConfig = config.config.models.embeddingProviders.nomic;
        this.apiKey = apiKey || nomicConfig.options.apiKey;
        this.defaultModel = defaultModel || nomicConfig.model || 'nomic-embed-text-v1.5';
        this.client = null;
    }

    /**
     * Initialize the Nomic client
     */
    async initialize() {
        if (!this.apiKey || this.apiKey.trim() === '') {
            throw new Error('Nomic API key is required. Configure in config.json llmProviders or provide apiKey parameter.');
        }

        try {
            this.client = await createEmbeddingClient('nomic', {
                apiKey: this.apiKey,
                model: this.defaultModel
            });

            logger.debug('Nomic client initialized successfully');
        } catch (error) {
            logger.error('Failed to initialize Nomic client:', error);
            throw error;
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
        return Boolean(this.apiKey && this.apiKey.trim().length > 0);
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