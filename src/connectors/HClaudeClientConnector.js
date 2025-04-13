/**
 * Connector for Anthropic Claude API operations using hyperdata-clients
 */
import logger from 'loglevel';
import HClientFactory from '../common/HClientFactory.js';

export default class HClaudeClientConnector {
    /**
     * Create a new HClaudeClientConnector
     * @param {string} apiKey - Claude API key
     * @param {string} defaultModel - Optional default model to use
     */
    constructor(apiKey, defaultModel = 'claude-3-opus-20240229') {
        if (!apiKey) {
            throw new Error('Claude API key is required');
        }
        
        this.apiKey = apiKey;
        this.defaultModel = defaultModel;
        this.client = null;
        this.initialize();
    }

    /**
     * Initialize the Claude client
     */
    async initialize() {
        try {
            this.client = await HClientFactory.createAPIClient('claude', {
                apiKey: this.apiKey,
                model: this.defaultModel
            });
            logger.debug('Claude client initialized successfully');
        } catch (error) {
            logger.error('Failed to initialize Claude client:', error);
            throw error;
        }
    }

    /**
     * Generate embeddings using Claude
     * @param {string} model - Model name to use for embedding
     * @param {string} input - Text to generate embedding for
     * @returns {number[]} - Vector embedding
     */
    async generateEmbedding(model, input) {
        logger.debug(`Generating embedding with model ${model}`);
        logger.debug('Input length:', input.length);

        try {
            if (!this.client) {
                await this.initialize();
            }

            const embedding = await this.client.embedding(input, { model });
            logger.debug('Embedding generated successfully');
            return embedding;
        } catch (error) {
            logger.error('Embedding generation failed:', error);
            throw error;
        }
    }

    /**
     * Generate chat completion using Claude
     * @param {string} model - Model name to use
     * @param {Array} messages - Array of message objects with role and content
     * @param {Object} options - Additional options
     * @returns {string} - Response text
     */
    async generateChat(model, messages, options = {}) {
        logger.debug(`Generating chat with model ${model}`);
        logger.debug('Messages count:', messages.length);

        try {
            if (!this.client) {
                await this.initialize();
            }

            const response = await this.client.chat(messages, {
                model,
                temperature: options.temperature || 0.7,
                max_tokens: options.max_tokens || 1024,
                ...options
            });

            logger.debug('Chat response received');
            return response;
        } catch (error) {
            logger.error('Chat generation failed:', error);
            throw error;
        }
    }

    /**
     * Generate completion using Claude
     * @param {string} model - Model name to use
     * @param {string} prompt - Text prompt
     * @param {Object} options - Additional options
     * @returns {string} - Response text
     */
    async generateCompletion(model, prompt, options = {}) {
        logger.debug(`Generating completion with model ${model}`);
        logger.debug('Prompt length:', prompt.length);

        try {
            if (!this.client) {
                await this.initialize();
            }

            // Convert to chat format since Claude uses chat API for completions
            const response = await this.client.complete(prompt, {
                model,
                temperature: options.temperature || 0.7,
                max_tokens: options.max_tokens || 1024,
                ...options
            });

            logger.debug('Completion response received');
            return response;
        } catch (error) {
            logger.error('Completion generation failed:', error);
            throw error;
        }
    }
}
