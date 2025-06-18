import logger from 'loglevel'
import PromptTemplates from '../PromptTemplates.js'

/**
 * @typedef {Object} LLMProvider - Language model provider interface
 * @typedef {Object} ChatMessage - Chat message object
 */

export default class LLMHandler {
    /**
     * @param {LLMProvider} llmProvider
     * @param {string} chatModel
     * @param {number} [temperature=0.7]
     */
    constructor(llmProvider, chatModel, temperature = 0.7) {
        this.llmProvider = llmProvider
        this.chatModel = chatModel
        this.temperature = temperature
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
        baseDelay = 1000
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
            
            // Add rate limiting with exponential backoff for Claude
            return await this.withRateLimit(async () => {
                return await this.llmProvider.generateChat(
                    model,
                    messages,
                    { temperature }
                )
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
    async extractConcepts(text) {
        try {
            const prompt = PromptTemplates.formatConceptPrompt(this.chatModel, text)
            
            // Use rate limiting for concept extraction too
            const response = await this.withRateLimit(async () => {
                return await this.llmProvider.generateCompletion(
                    this.chatModel,
                    prompt,
                    { temperature: 0.2 }
                )
            })
            
            console.log(`response = ${response}, ${JSON.stringify(response)}`)
            const match = response.match(/\[.*\]/)
            if (!match) {
                logger.warn('No concept array found in LLM response')
                return []
            }
            // console.log(`match[0] = ${match[0]}, ${JSON.stringify(match[0])}`)
            try {
                return JSON.parse(match[0])
            } catch (parseError) {
                logger.error('Failed to parse concepts array:', parseError)
                logger.error('Raw match was:', match[0])
                return []
            }
        } catch (error) {
            logger.error('Error extracting concepts:', error)
            return []
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
}