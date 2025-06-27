import logger from 'loglevel'
import PromptTemplates from '../PromptTemplates.js'
import ParseHelper from '../utils/ParseHelper.js'

/**
 * @typedef {Object} LLMProvider - Language model provider interface
 * @typedef {Object} ChatMessage - Chat message object
 */

export default class LLMHandler {
    /**
     * @param {LLMProvider} llmProvider
     * @param {string} chatModel
     * @param {number} [temperature=0.7]
     * @param {Object} [options={}]
     */
    constructor(llmProvider, chatModel, temperature = 0.7, options = {}) {
        this.llmProvider = llmProvider
        this.chatModel = chatModel
        this.temperature = temperature
        
        // Simple fallback configuration (opt-in for backward compatibility)
        this.options = {
            enableFallbacks: options.enableFallbacks === true, // Default disabled for backward compatibility
            timeoutMs: options.timeoutMs || 60000,
            fallbackResponse: options.fallbackResponse || 'Unable to generate response due to service unavailability.',
            ...options
        }
        
        // Detect provider interface type
        this._hasHyperdataClientsInterface = typeof this.llmProvider.chat === 'function'
        this._hasLegacyInterface = typeof this.llmProvider.generateChat === 'function'
    }

    /**
     * Call chat method using the appropriate provider interface
     */
    async _callChat(model, messages, options = {}) {
        if (this._hasHyperdataClientsInterface) {
            // hyperdata-clients interface: chat(messages, options)
            return await this.llmProvider.chat(messages, { model, ...options })
        } else if (this._hasLegacyInterface) {
            // Legacy interface: generateChat(model, messages, options)
            return await this.llmProvider.generateChat(model, messages, options)
        } else {
            throw new Error('Provider does not support chat operations')
        }
    }

    /**
     * Call completion method using the appropriate provider interface
     */
    async _callCompletion(model, prompt, options = {}) {
        if (this._hasHyperdataClientsInterface) {
            // hyperdata-clients interface: complete(prompt, options)
            return await this.llmProvider.complete(prompt, { model, ...options })
        } else if (this._hasLegacyInterface) {
            // Legacy interface: generateCompletion(model, prompt, options)
            return await this.llmProvider.generateCompletion(model, prompt, options)
        } else {
            throw new Error('Provider does not support completion operations')
        }
    }

    /**
     * @param {string} prompt
     * @param {string} context
     * @param {string} [systemPrompt]
     * @returns {Promise<string>}
     */
    /**
     * @param {string} prompt - The user's input prompt
     * @param {string} context - Additional context for the prompt
     * @param {Object} [options] - Additional options
     * @param {string} [options.systemPrompt] - System prompt to use
     * @param {string} [options.model] - Override the default model
     * @param {number} [options.temperature] - Override the default temperature
     * @returns {Promise<string>}
     */
    async generateResponse(prompt, context, {
        systemPrompt = "You're a helpful assistant with memory of past interactions.",
        model = this.chatModel,
        temperature = this.temperature,
        maxRetries = 3,
        baseDelay = 1000,
        timeoutMs = this.options.timeoutMs
    } = {}) {
        try {
            logger.log(`LLMHandler.generateResponse,
                prompt = ${prompt}
                context = ${context}
                `)
            const messages = PromptTemplates.formatChatPrompt(
                model,
                systemPrompt,
                context,
                prompt
            )
            logger.log(`LLMHandler.generateResponse, model = ${model}`)
            
            return await this.withRateLimit(async () => {
                return await this._callChat(model, messages, { temperature })
            }, maxRetries, baseDelay)
            
        } catch (error) {
            logger.error('Error generating chat response:', error)
            throw error
        }
    }

    /**
     * Execute a function with rate limiting and exponential backoff
     */
    async withRateLimit(fn, maxRetries = 3, baseDelay = 1000) {
        let lastError = null;
        
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                // Add a small delay before each request to avoid overwhelming the API
                if (attempt > 0) {
                    const delay = baseDelay * Math.pow(2, attempt - 1) + Math.random() * 500; // Add jitter
                    logger.log(`Retrying after ${delay.toFixed(0)}ms (attempt ${attempt}/${maxRetries})`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                } else {
                    // Even on first attempt, add a small delay to avoid rapid-fire requests
                    await new Promise(resolve => setTimeout(resolve, Math.random() * 200 + 100));
                }
                
                return await fn();
                
            } catch (error) {
                lastError = error;
                
                // Check if it's a rate limit error
                if (error.code === 529 || error.message?.includes('overloaded') || error.message?.includes('rate limit')) {
                    if (attempt < maxRetries) {
                        logger.warn(`Rate limited (attempt ${attempt + 1}/${maxRetries + 1}), retrying...`);
                        continue;
                    }
                }
                
                // For non-rate-limit errors, throw immediately
                if (!error.message?.includes('overloaded') && error.code !== 529) {
                    throw error;
                }
            }
        }
        
        // If we've exhausted all retries, throw the last error
        logger.error(`All ${maxRetries + 1} attempts failed due to rate limiting`);
        throw lastError;
    }

    /**
     * @param {string} text
     * @returns {Promise<string[]>}
     */
    async extractConcepts(text, options = {}) {
        try {
            const prompt = PromptTemplates.formatConceptPrompt(this.chatModel, text)
            
            // Determine if we should use chat or completion based on prompt format
            const isMessagesFormat = Array.isArray(prompt)
            
            const response = await this.withRateLimit(async () => {
                if (isMessagesFormat) {
                    return await this._callChat(
                        this.chatModel,
                        prompt, // pass the full messages array
                        { temperature: 0.2 }
                    )
                } else {
                    return await this._callCompletion(
                        this.chatModel,
                        prompt,
                        { temperature: 0.2 }
                    )
                }
            })
            
            logger.info(`LLM response for concept extraction: ${response}`)
            
            // Use ParseHelper to resolve syntax
            const cleanedResponse = ParseHelper.resolveSyntax(response)
            if (cleanedResponse === false) {
                logger.warn('ParseHelper could not resolve syntax, falling back to regex extraction')
                
                // Fallback to regex-based extraction
                const match = response.match(/\[.*\]/)
                if (!match) {
                    logger.warn('No concept array found in LLM response')
                    logger.warn('Raw response was:', response)
                    throw new Error('No JSON array found in LLM response for concept extraction')
                }
                
                try {
                    const parsed = JSON.parse(match[0])
                    logger.info(`Successfully parsed ${parsed.length} concepts using regex fallback`)
                    return parsed
                } catch (parseError) {
                    logger.error('Failed to parse concepts array:', parseError)
                    logger.error('Raw match was:', match[0])
                    throw new Error(`Failed to parse JSON from LLM response: ${parseError.message}`)
                }
            }
            
            // Parse the cleaned response
            try {
                const parsed = JSON.parse(cleanedResponse)
                if (Array.isArray(parsed)) {
                    logger.info(`Successfully parsed ${parsed.length} concepts using ParseHelper`)
                    return parsed
                } else {
                    throw new Error('Parsed result is not an array')
                }
            } catch (parseError) {
                logger.error('Failed to parse cleaned response:', parseError)
                logger.error('Cleaned response was:', cleanedResponse)
                throw new Error(`Failed to parse JSON from cleaned response: ${parseError.message}`)
            }
        } catch (error) {
            logger.error('Error extracting concepts:', error)
            throw error
        }
    }

    /**
     * @param {string} text
     * @param {string} model
     * @param {number} [retries=3]
     * @returns {Promise<number[]>}
     */
    async generateEmbedding(text, model, retries = 3) {
        let lastError = null

        for (let attempt = 0; attempt < retries; attempt++) {
            try {
                return await this.llmProvider.generateEmbedding(model, text)
            } catch (error) {
                lastError = error
                logger.warn(`Embedding generation attempt ${attempt + 1} failed:`, error)
                await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)))
            }
        }

        throw new Error(`Failed to generate embedding after ${retries} attempts: ${lastError?.message}`)
    }

    /**
     * @param {number} temperature
     * @throws {Error} If temperature is invalid
     */
    setTemperature(temperature) {
        if (temperature < 0 || temperature > 1) {
            throw new Error('Temperature must be between 0 and 1')
        }
        this.temperature = temperature
    }

    /**
     * @param {string} model
     * @returns {boolean}
     */
    validateModel(model) {
        return typeof model === 'string' && model.length > 0
    }

    // Simple timeout wrapper
    async withTimeout(promise, timeoutMs) {
        return Promise.race([
            promise,
            new Promise((_, reject) => 
                setTimeout(() => reject(new Error('LLM operation timed out')), timeoutMs)
            )
        ])
    }

    // Simple fallback response generation
    generateFallbackResponse(prompt, context, error) {
        const isTimeoutError = error.message?.includes('timeout') || error.message?.includes('timed out')
        
        if (isTimeoutError) {
            return `${this.options.fallbackResponse} The request took too long to process. Please try with a simpler query.`
        }
        
        return this.options.fallbackResponse
    }

    // Simple fallback concept extraction using basic text analysis
    extractBasicConcepts(text) {
        if (!text || typeof text !== 'string') return []
        
        // Simple keyword extraction - remove common words and extract meaningful terms
        const commonWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can', 'this', 'that', 'these', 'those'])
        
        const words = text.toLowerCase()
            .replace(/[^\w\s]/g, ' ')
            .split(/\s+/)
            .filter(word => word.length > 2 && !commonWords.has(word))
        
        // Count frequency and return top concepts
        const frequency = {}
        words.forEach(word => {
            frequency[word] = (frequency[word] || 0) + 1
        })
        
        return Object.entries(frequency)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 10)
            .map(([word]) => word)
    }
}