/**
 * Connector for Mistral AI API operations using hyperdata-clients
 */
import logger from 'loglevel'
import { ClientFactory } from 'hyperdata-clients'

export default class MistralConnector {
    /**
     * Create a new HMistralClientConnector
     * @param {string} apiKey - Mistral API key
     * @param {string} baseUrl - Optional base URL for the API (defaults to 'https://api.mistral.ai/v1')
     * @param {string} defaultModel - Optional default model to use (defaults to 'mistral-medium')
     */
    constructor(apiKey, baseUrl = 'https://api.mistral.ai/v1', defaultModel = 'mistral-medium') {
        if (!apiKey) {
            throw new Error('Mistral API key is required')
        }

        this.apiKey = apiKey
        this.baseUrl = baseUrl
        this.defaultModel = defaultModel
        this.client = null
        this.initialize()
    }

    /**
     * Initialize the Mistral client
     */
    async initialize() {
        try {
            // Create a client factory instance
            this.client = await ClientFactory.createAPIClient('mistral', {
                apiKey: this.apiKey,
                baseUrl: this.baseUrl,
                model: this.defaultModel
            });

            if (!this.client) {
                throw new Error('Failed to create Mistral client: Client is null');
            }

            logger.debug('Mistral client initialized successfully');
        } catch (error) {
            logger.error('Failed to initialize Mistral client:', error);
            throw error;
        }
    }

    /**
     * Generate embeddings using Mistral
     * @param {string} model - Model name to use for embedding (defaults to 'mistral-embed')
     * @param {string} input - Text to generate embedding for
     * @returns {number[]} - Vector embedding
     */
    async generateEmbedding(model = 'mistral-embed', input) {
        logger.debug(`Generating embedding with model ${model}`)
        logger.debug('Input length:', input.length)

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
     * Generate chat completion using Mistral
     * @param {string} model - Model name to use (defaults to instance default)
     * @param {Array} messages - Array of message objects with role and content
     * @param {Object} options - Additional options
     * @returns {string} - Response text
     */
    async generateChat(model = this.defaultModel, messages, options = {}) {
        logger.debug(`Generating chat with model ${model}`)
        logger.debug('Messages count:', messages.length)

        try {
            if (!this.client) {
                await this.initialize()
            }

            const response = await this.client.chat(messages, {
                model,
                temperature: options.temperature || 0.7,
                max_tokens: options.max_tokens || 2000,
                top_p: options.top_p || 1.0,
                ...options
            })

            logger.debug('Chat response received')
            return response
        } catch (error) {
            logger.error('Chat generation failed:', error)
            throw error
        }
    }

    /**
     * Generate a streaming chat completion
     * @param {string} model - Model name to use (defaults to instance default)
     * @param {Array} messages - Array of message objects with role and content
     * @param {Object} options - Additional options
     * @returns {AsyncGenerator<string>} - An async generator that yields chunks of the response
     */
    async *generateChatStream(model = this.defaultModel, messages, options = {}) {
        logger.debug(`Starting streaming chat with model ${model}`)
        logger.debug('Messages count:', messages.length)

        try {
            if (!this.client) {
                await this.initialize()
            }

            const stream = await this.client.chatStream(messages, {
                model,
                temperature: options.temperature || 0.7,
                max_tokens: options.max_tokens || 2000,
                top_p: options.top_p || 1.0,
                ...options
            })

            for await (const chunk of stream) {
                if (chunk.choices && chunk.choices[0]?.delta?.content) {
                    yield chunk.choices[0].delta.content
                }
            }
        } catch (error) {
            logger.error('Streaming chat failed:', error)
            throw error
        }
    }
}
