/**
 * Connector for Anthropic Claude API operations
 * 
 * This connector provides a direct implementation for the Claude API
 * without requiring the hyperdata-clients library.
 */
import logger from 'loglevel'
import dotenv from 'dotenv'

// Load environment variables
dotenv.config()

/**
 * ClaudeConnector implements the LLMProvider interface for Claude API
 */
export default class ClaudeConnector {
    /**
     * Create a new ClaudeConnector
     * @param {string} apiKey - Claude API key (can be loaded from environment)
     * @param {string} baseUrl - API endpoint (defaults to https://api.anthropic.com)
     * @param {string} defaultModel - Default model to use (defaults to claude-3-opus-20240229)
     */
    constructor(apiKey = process.env.CLAUDE_API_KEY, baseUrl = process.env.CLAUDE_API_BASE || 'https://api.anthropic.com', defaultModel = process.env.CLAUDE_MODEL || 'claude-3-opus-20240229') {
        if (!apiKey) {
            throw new Error('Claude API key is required. Provide it directly or set CLAUDE_API_KEY environment variable.')
        }

        this.apiKey = apiKey
        this.baseUrl = baseUrl
        this.defaultModel = defaultModel
        
        logger.debug(`ClaudeConnector initialized with model: ${this.defaultModel}`)
    }

    /**
     * Generate embeddings using Claude
     * 
     * NOTE: This method is provided for LLMProvider interface compatibility,
     * but Claude doesn't currently have a stable embedding API.
     * Use OllamaConnector or another provider for embeddings.
     * 
     * @param {string} model - The embedding model name (ignored, using default)
     * @param {string} input - The text to embed
     * @returns {Promise<number[]>} - A promise that resolves to the embedding vector
     * @throws {Error} - Always throws an error as Claude doesn't support embeddings directly
     */
    async generateEmbedding(model, input) {
        logger.warn(`ClaudeConnector.generateEmbedding called but Claude doesn't support embeddings directly.`)
        logger.warn(`Use OllamaConnector or another provider for embeddings.`)
        
        // Throw error - Claude embeddings are not supported
        throw new Error('Claude embeddings not supported directly. Use another provider for embeddings.');
    }

    /**
     * Generate a chat response using Claude API
     * 
     * @param {string} model - The model to use (ignored, using default from constructor)
     * @param {Array<{role: string, content: string}>} messages - Array of message objects
     * @param {Object} options - Additional options for the API call
     * @returns {Promise<string>} - A promise that resolves to the generated text
     * @throws {Error} - If the API call fails
     */
    async generateChat(model, messages, options = {}) {
        logger.debug(`ClaudeConnector.generateChat using model: ${this.defaultModel}`)
        
        // Handle system message separately for Claude API
        let systemPrompt = null;
        const cleanedMessages = [];
        
        // Process messages
        for (const msg of messages) {
            if (msg.role === 'system') {
                systemPrompt = msg.content;
            } else {
                cleanedMessages.push({
                    role: msg.role,
                    content: msg.content
                });
            }
        }
        
        try {
            const response = await fetch(`${this.baseUrl}/v1/messages`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': this.apiKey,
                    'anthropic-version': '2023-06-01'
                },
                body: JSON.stringify({
                    model: this.defaultModel,
                    messages: cleanedMessages,
                    system: systemPrompt, // Claude API takes system prompt separately
                    max_tokens: options.max_tokens || 1000,
                    temperature: options.temperature || 0.7,
                    ...options
                })
            })
    
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Claude API error: ${response.status} ${errorText}`);
            }
    
            const data = await response.json()
            return data.content[0].text
        } catch (error) {
            logger.error('Error in ClaudeConnector.generateChat:', error)
            throw error
        }
    }

    /**
     * Generate a completion using Claude's chat API
     * 
     * @param {string} model - The model to use (ignored, using default)
     * @param {string} prompt - The prompt to send
     * @param {Object} options - Additional options for the API call
     * @returns {Promise<string>} - A promise that resolves to the generated text
     */
    async generateCompletion(model, prompt, options = {}) {
        return this.generateChat(model, [{
            role: 'user',
            content: prompt
        }], options)
    }
    
    /**
     * Close any open connections
     * 
     * @returns {Promise<void>}
     */
    async dispose() {
        // Nothing to dispose for fetch-based API
        logger.debug('ClaudeConnector.dispose() called')
        return Promise.resolve()
    }
}