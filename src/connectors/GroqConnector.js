/**
 * Connector for Groq API operations using hyperdata-clients
 */
import logger from 'loglevel'
import { ClientFactory } from 'hyperdata-clients'

export default class GroqConnector {
    /**
     * Create a new GroqConnector
     * @param {string} apiKey - Groq API key
     * @param {string} baseUrl - Optional base URL for the API (defaults to 'https://api.groq.com/openai/v1')
     * @param {string} defaultModel - Optional default model to use (defaults to 'llama-3.1-8b-instant')
     */
    constructor(apiKey, baseUrl = 'https://api.groq.com/openai/v1', defaultModel = 'llama-3.1-8b-instant') {
        if (!apiKey) {
            throw new Error('Groq API key is required');
        }

        this.apiKey = apiKey;
        this.baseUrl = baseUrl;
        this.defaultModel = defaultModel;
        this.client = null;
        this.initialized = false;
        this.initializing = false;
    }

    /**
     * Initialize the Groq client
     * @returns {Promise<void>}
     */
    async initialize() {
        if (this.initialized) return;
        if (this.initializing) {
            // If already initializing, wait for it to complete
            return new Promise((resolve) => {
                const checkInitialized = () => {
                    if (this.initialized) resolve();
                    else setTimeout(checkInitialized, 100);
                };
                checkInitialized();
            });
        }

        this.initializing = true;
        try {
            this.client = await ClientFactory.createAPIClient('groq', {
                apiKey: this.apiKey,
                baseUrl: this.baseUrl,
                model: this.defaultModel
            });
            this.initialized = true;
            logger.debug('Groq client initialized successfully');
        } catch (error) {
            logger.error('Failed to initialize Groq client:', error);
            this.initialized = false;
            this.initializing = false;
            throw error;
        } finally {
            this.initializing = false;
        }
    }

    /**
     * Generate embeddings using Groq
     * Note: Groq doesn't currently support embeddings, so this will throw an error
     * @param {string} model - Model name to use for embedding
     * @param {string} input - Text to generate embedding for
     * @returns {number[]} - Vector embedding
     */
    async generateEmbedding(model = 'text-embedding-3-small', input) {
        logger.debug(`Attempting embedding with model ${model} (Groq doesn't support embeddings)`)
        throw new Error('Groq API does not support embedding generation. Use a different provider for embeddings.');
    }

    /**
     * Generate chat completion using Groq
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

            const stream = await this.client.stream(messages, (chunk) => {
                // Stream callback - handled by the generator
            }, {
                model,
                temperature: options.temperature || 0.7,
                max_tokens: options.max_tokens || 2000,
                top_p: options.top_p || 1.0,
                ...options
            })

            // Note: This might need adjustment based on how hyperdata-clients Groq streaming works
            for await (const chunk of stream) {
                if (chunk && typeof chunk === 'string') {
                    yield chunk
                } else if (chunk.choices && chunk.choices[0]?.delta?.content) {
                    yield chunk.choices[0].delta.content
                }
            }
        } catch (error) {
            logger.error('Streaming chat failed:', error)
            throw error
        }
    }

    /**
     * Generate completion (for backward compatibility)
     * @param {string} model - Model name to use
     * @param {string} prompt - The prompt to complete
     * @param {Object} options - Additional options
     * @returns {string} - Completion text
     */
    async generateCompletion(model = this.defaultModel, prompt, options = {}) {
        // Convert prompt to chat format for compatibility
        const messages = [{ role: 'user', content: prompt }];
        return await this.generateChat(model, messages, options);
    }
}