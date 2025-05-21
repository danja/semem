/**
 * Connector for Mistral AI API operations using hyperdata-clients
 */
import logger from 'loglevel'
import HMistralClientConnector from './HMistralClientConnector.js'

/**
 * MistralConnector implements the LLMProvider interface for Mistral AI API
 */
export default class MistralConnector {
    /**
     * Create a new MistralConnector
     * @param {string} apiKey - Mistral API key (can be loaded from environment)
     * @param {string} baseUrl - API endpoint (defaults to https://api.mistral.ai/v1)
     * @param {string} defaultModel - Default model to use (defaults to mistral-medium)
     */
    constructor(
        apiKey = process.env.MISTRAL_API_KEY, 
        baseUrl = process.env.MISTRAL_API_BASE || 'https://api.mistral.ai/v1',
        defaultModel = process.env.MISTRAL_MODEL || 'mistral-medium'
    ) {
        if (!apiKey) {
            throw new Error('Mistral API key is required. Provide it directly or set MISTRAL_API_KEY environment variable.')
        }

        this.client = new HMistralClientConnector(apiKey, baseUrl, defaultModel)
        this.defaultModel = defaultModel
        
        logger.debug(`MistralConnector initialized with model: ${this.defaultModel}`)
    }

    /**
     * Generate embeddings using Mistral
     * @param {string} model - The embedding model name (defaults to 'mistral-embed')
     * @param {string} input - The text to embed
     * @returns {Promise<number[]>} - A promise that resolves to the embedding vector
     */
    async generateEmbedding(model = 'mistral-embed', input) {
        return this.client.generateEmbedding(model, input);
    }

    /**
     * Generate chat completion using Mistral
     * @param {string} model - The model to use (defaults to the instance's default model)
     * @param {Array} messages - Array of message objects with 'role' and 'content'
     * @param {Object} options - Additional options for the completion
     * @returns {Promise<string>} - A promise that resolves to the generated text
     */
    async generateChat(model = this.defaultModel, messages, options = {}) {
        return this.client.generateChat(model, messages, options);
    }

    /**
     * Generate a streaming chat completion
     * @param {string} model - The model to use
     * @param {Array} messages - Array of message objects with 'role' and 'content'
     * @param {Object} options - Additional options for the completion
     * @returns {AsyncGenerator<string>} - An async generator that yields chunks of the response
     */
    async *generateChatStream(model = this.defaultModel, messages, options = {}) {
        yield* this.client.generateChatStream(model, messages, options);
    }
}
