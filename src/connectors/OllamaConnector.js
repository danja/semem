import logger from 'loglevel'

/**
 * Connector for Ollama API operations
 */
export default class OllamaConnector {
    constructor(options = {}) {
        // Make sure we have a proper baseUrl string
        this.baseUrl = typeof options === 'string' 
            ? options 
            : (options.baseUrl || 'http://localhost:11434');
        
        if (this.baseUrl.endsWith('/')) {
            this.baseUrl = this.baseUrl.slice(0, -1); // Remove trailing slash
        }
        
        logger.debug(`Initializing OllamaConnector with baseUrl: ${this.baseUrl}`);
        this.chatModel = options.chatModel || 'qwen2:1.5b';
        this.embeddingModel = options.embeddingModel || 'nomic-embed-text';
    }

    /**
     * Generate embeddings using Ollama
     * @param {string} model - Model to use for embedding (or default if not provided)
     * @param {string} input - Text to embed
     * @returns {Promise<number[]>} - Vector embedding
     */
    async generateEmbedding(model, input) {
        // Allow model to be a parameter or use the default
        const embeddingModel = model || this.embeddingModel;
        
        logger.debug(`Generating embedding with model ${embeddingModel}`);
        logger.debug('Input length:', input.length);

        try {
            const response = await fetch(`${this.baseUrl}/api/embeddings`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: embeddingModel,
                    prompt: input,
                    options: { num_ctx: 8192 }
                })
            })

            if (!response.ok) {
                throw new Error(`Ollama API error: ${response.status}`)
            }

            const data = await response.json()
            logger.debug('Embedding generated successfully')
            return data.embedding
        } catch (error) {
            logger.error('Embedding generation failed:', error)
            throw error
        }
    }

    /**
     * Generate chat completion using Ollama
     * @param {string} model - Model to use for chat (or default if not provided)
     * @param {Array} messages - Array of message objects with role and content
     * @param {Object} options - Additional options for the API call
     * @returns {Promise<string>} - Generated response text
     */
    async generateChat(model, messages, options = {}) {
        // Allow model to be a parameter or use the default
        const chatModel = model || this.chatModel;
        
        logger.debug(`Generating chat with model ${chatModel}`);
        logger.debug('Messages count:', messages.length);

        try {
            const response = await fetch(`${this.baseUrl}/api/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: chatModel,
                    messages,
                    stream: false,
                    options: {
                        temperature: options.temperature || 0.7,
                        ...options
                    }
                })
            })

            if (!response.ok) {
                throw new Error(`Ollama API error: ${response.status}`)
            }

            const data = await response.json()
            logger.debug('Chat response:', data.message?.content)
            return data.message?.content || ''
        } catch (error) {
            logger.error('Chat generation failed:', error)
            throw error
        }
    }

    /**
     * Generate completion using Ollama
     * @param {string} model - Model to use for completion (or default if not provided)
     * @param {string} prompt - Text prompt
     * @param {Object} options - Additional options for the API call
     * @returns {Promise<string>} - Generated response text
     */
    async generateCompletion(model, prompt, options = {}) {
        // Allow model to be a parameter or use the default
        const chatModel = model || this.chatModel;
        
        logger.debug(`Generating completion with model ${chatModel}`);
        logger.debug('Prompt length:', prompt.length);

        try {
            const response = await fetch(`${this.baseUrl}/api/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: chatModel,
                    prompt,
                    stream: false,
                    options: {
                        temperature: options.temperature || 0.7,
                        ...options
                    }
                })
            })

            if (!response.ok) {
                throw new Error(`Ollama API error: ${response.status}`)
            }

            const data = await response.json()
            logger.debug('Completion response:', data.response)
            return data.response || ''
        } catch (error) {
            logger.error('Completion generation failed:', error)
            throw error
        }
    }
}