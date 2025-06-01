import logger from 'loglevel'
import PromptTemplates from '../PromptTemplates.js'

/**
 * @typedef {import('../types/MemoryTypes').LLMProvider} LLMProvider
 * @typedef {import('../types/MemoryTypes').ChatMessage} ChatMessage
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
        temperature = this.temperature
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
            return await this.llmProvider.generateChat(
                model,
                messages,
                { temperature }
            )
        } catch (error) {
            logger.error('Error generating chat response:', error)
            throw error
        }
    }

    /**
     * @param {string} text
     * @returns {Promise<string[]>}
     */
    async extractConcepts(text) {
        try {
            const prompt = PromptTemplates.formatConceptPrompt(this.chatModel, text)
            const response = await this.llmProvider.generateCompletion(
                this.chatModel,
                prompt,
                { temperature: 0.2 }
            )

            const match = response.match(/\[.*\]/)
            if (!match) {
                logger.warn('No concept array found in LLM response')
                return []
            }

            try {
                return JSON.parse(match[0])
            } catch (parseError) {
                logger.error('Failed to parse concepts array:', parseError)
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