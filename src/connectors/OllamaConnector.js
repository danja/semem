/**
 * Connector for Ollama API operations using hyperdata-clients
 */
import logger from 'loglevel'
import { ClientFactory } from 'hyperdata-clients'

export default class OllamaConnector {
    /**
     * Create a new OllamaConnector
     * @param {string} baseUrl - Base URL for Ollama API (should be provided from Config.js)
     * @param {string} defaultModel - Optional default model to use
     */
    constructor(baseUrl = 'http://localhost:11434', defaultModel = 'qwen2:1.5b') {
        this.baseUrl = baseUrl // Should come from config.json via Config.js
        this.defaultModel = defaultModel
        this.client = null
        this.initialize()
    }

    /**
     * Initialize the Ollama client
     */
    async initialize() {
        try {
            this.client = await ClientFactory.createAPIClient('ollama', {
                apiKey: 'NO_KEY_REQUIRED',
                baseUrl: this.baseUrl,
                model: this.defaultModel
            })

            logger.debug('Ollama client initialized successfully')
        } catch (error) {
            logger.error('Failed to initialize Ollama client:', error)
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
        //  logger.debug('Input:', input)

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
        logger.debug(`Generating chat with model ${model}`)
        logger.debug('Messages:', messages)

        try {
            if (!this.client) {
                await this.initialize()
            }

            // Convert messages to the format expected by Ollama
            const ollamaMessages = messages.map(msg => ({
                role: msg.role,
                content: Array.isArray(msg.content) ? msg.content.join('\n') : String(msg.content)
            }));

            const response = await this.client.chat(ollamaMessages, {
                model,
                temperature: options.temperature,
                ...options
            });

            logger.debug('Chat response:', response);
            return response;
        } catch (error) {
            logger.error('Chat generation failed:', error);
            throw error;
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
                temperature: options.temperature,
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
