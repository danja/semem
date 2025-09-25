/**
 * Connector for Anthropic Claude API operations using hyperdata-clients
 */
import logger from 'loglevel';
import { ClientFactory } from 'hyperdata-clients';

export default class ClaudeConnector {
    /**
     * Create a new HClaudeClientConnector
     * @param {string} apiKey - Claude API key
     * @param {string} defaultModel - Optional default model to use
     */

    // USE CONFIG!!
    constructor(apiKey, defaultModel, dimension) {
        if (!apiKey) {
            throw new Error('Claude API key is required');
        }

        this.apiKey = apiKey;
        this.defaultModel = defaultModel;
        this.dimension = dimension;
        this.client = null;
        this.initialized = false;
        this.initializing = false;

        // Initialize the client
        this.initialize();
    }

    /**
     * Initialize the Claude client
     * @returns {Promise<void>}
     */
    async initialize() {
        if (this.initialized || this.initializing) {
            return;
        }

        this.initializing = true;

        try {
            this.client = await ClientFactory.createAPIClient('claude', {
                apiKey: this.apiKey,
                model: this.defaultModel,
                clientOptions: {
                    // Add any specific client options here
                }
            });
            this.initialized = true;
            logger.info('Claude client initialized successfully');
        } catch (error) {
            logger.error('Failed to initialize Claude client:', error);
            this.initialized = false;
            this.initializing = false;
            throw error;
        } finally {
            this.initializing = false;
        }
    }

    /**
     * Initialize the Claude client
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
            this.client = await ClientFactory.createAPIClient('claude', {
                apiKey: this.apiKey,
                model: this.defaultModel,
                clientOptions: {
                    // Add any specific client options here
                }
            });
            this.initialized = true;
            logger.debug('Claude client initialized successfully');
        } catch (error) {
            logger.error('Failed to initialize Claude client:', error);
            this.initialized = false;
            this.initializing = false;
            throw error;
        } finally {
            this.initializing = false;
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
            await this.initialize();

            // Convert single string to array if needed
            const inputs = Array.isArray(input) ? input : [input];

            // Generate embeddings for all inputs
            const embeddings = [];
            for (const text of inputs) {
                try {
                    // Try to use Claude's embedding endpoint if available
                    const response = await this.client.embedding(text, {
                        model: model || this.defaultModel
                    });
                    embeddings.push(response);
                } catch (error) {
                    logger.warn('Claude embedding failed, falling back to local embedding model');
                    // Fallback to a simple local embedding if Claude's embedding fails
                    const embedding = this._generateSimpleEmbedding(text);
                    embeddings.push(embedding);
                }
            }

            logger.debug('Embedding generation successful');
            return embeddings.length === 1 ? embeddings[0] : embeddings;
        } catch (error) {
            logger.error('Embedding generation failed:', error);
            throw error;
        }
    }

    /**
     * Generate a simple local embedding as a fallback
     * @private
     */
    _generateSimpleEmbedding(text) {
        // This is a simple hash-based embedding generator as a fallback
        // It's not as good as a real embedding model but better than nothing
        const hash = this._hashCode(text);
        const embedding = new Array(this.dimension).fill(0);

        // Distribute the hash values across the embedding dimensions
        for (let i = 0; i < this.dimension; i++) {
            const val = (hash * (i + 1)) % 1.0; // Simple pseudo-random value based on hash and position
            embedding[i] = (val - 0.5) * 2; // Scale to [-1, 1]
        }

        return embedding;
    }

    /**
     * Simple string hash function
     * @private
     */
    _hashCode(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return Math.abs(hash);
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
        logger.debug('Messages:', messages);

        try {
            await this.initialize();

            // For Claude API, we need to handle system messages differently
            // System message should be a top-level parameter, not in the messages array
            let systemMessage = '';
            const filteredMessages = [];

            // Separate system messages from user/assistant messages
            for (const msg of messages) {
                if (msg.role === 'system') {
                    systemMessage += (systemMessage ? '\n' : '') + msg.content;
                } else {
                    filteredMessages.push({
                        role: msg.role,
                        content: msg.content
                    });
                }
            }

            // Prepare the request options with Claude API expected parameter names
            const requestOptions = {
                model: model || this.defaultModel,
                max_tokens: options.maxTokens || 1024, // Note: max_tokens instead of maxTokens
                temperature: options.temperature ?? 0.7,
                top_p: options.topP, // Note: top_p instead of topP
                ...options
            };

            // Remove any undefined options
            Object.keys(requestOptions).forEach(key => {
                if (requestOptions[key] === undefined) {
                    delete requestOptions[key];
                }
            });

            // Add system message as a top-level parameter if present
            if (systemMessage) {
                requestOptions.system = systemMessage;
            }

            // The first argument should be the messages array
            const response = await this.client.chat(
                filteredMessages,
                requestOptions
            );

            logger.debug('Chat response generated successfully');

            // Extract the content string from the response
            // If the response is already a string, return it directly
            if (typeof response === 'string') {
                return response;
            }

            // If the response is an object with content, extract the content
            if (response && typeof response === 'object' && response.content) {
                return response.content;
            }

            // If the response has a different structure, try to convert to string
            return String(response);
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
        logger.debug(`Generating completion with model ${model}`)
        logger.debug('Prompt length:', prompt.length)

        try {
            if (!this.client) {
                await this.initialize()
            }

            // Convert to chat format since Claude uses chat API for completions
            const response = await this.client.complete(prompt, {
                model,
                temperature: options.temperature,
                max_tokens: options.max_tokens || 1024,
                ...options
            })

            logger.debug('Completion response received')

            // Extract content string from the response object
            // Based on the Claude response format: {content: '...', role: 'assistant'}
            if (response && typeof response === 'object' && response.content) {
                logger.debug('Extracting content from Claude response object')
                return response.content;
            } else if (typeof response === 'string') {
                logger.debug('Response is already a string')
                return response;
            } else {
                logger.error('Unexpected response format from Claude completion:', response);
                // Fallback - return empty string to avoid JSON parse errors
                return '';
            }
        } catch (error) {
            logger.error('Completion generation failed:', error)
            throw error
        }
    }
}
