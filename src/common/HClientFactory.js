/**
 * Wrapper for hyperdata-clients ClientFactory
 * Provides a unified interface for creating API clients for different LLM providers
 */
import ClientFactory from '../../../hyperdata-clients/src/common/ClientFactory.js'
import logger from 'loglevel'

class HClientFactory {
    /**
     * Create an API client for the specified provider
     * @param {string} provider - The API provider (e.g., 'ollama', 'openai', 'mistral')
     * @param {Object} config - Configuration including apiKey and other options
     * @returns {Object} - The API client instance
     */
    static async createAPIClient(provider, config = {}) {
        try {
            logger.debug(`Creating ${provider} client with config:`,
                { ...config, apiKey: config.apiKey ? '[REDACTED]' : undefined })

            return await ClientFactory.createAPIClient(provider, config)
        } catch (error) {
            logger.error(`Failed to create ${provider} client:`, error)
            throw error
        }
    }
}

export default HClientFactory
