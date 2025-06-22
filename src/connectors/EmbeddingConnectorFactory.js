/**
 * Factory for creating embedding connectors based on provider type
 */
import logger from 'loglevel'
import OllamaConnector from './OllamaConnector.js'
import NomicConnector from './NomicConnector.js'

export default class EmbeddingConnectorFactory {
    /**
     * Create an embedding connector based on provider configuration
     * @param {Object} config - Provider configuration
     * @param {string} config.provider - Provider type ('ollama', 'nomic')
     * @param {string} config.model - Model name to use
     * @param {Object} config.options - Provider-specific options
     * @returns {Object} - Embedding connector instance
     */
    static createConnector(config = {}) {
        const { provider = 'ollama', model, options = {} } = config
        
        logger.debug(`Creating embedding connector for provider: ${provider}`)
        
        switch (provider.toLowerCase()) {
            case 'ollama':
                return new OllamaConnector(
                    options.baseUrl || 'http://localhost:11434',
                    model || 'nomic-embed-text'
                )
                
            case 'nomic':
                return new NomicConnector(
                    options.apiKey || process.env.NOMIC_API_KEY,
                    model || 'nomic-embed-text-v1.5'
                )
                
            default:
                logger.warn(`Unknown embedding provider: ${provider}, falling back to Ollama`)
                return new OllamaConnector(
                    options.baseUrl || 'http://localhost:11434',
                    model || 'nomic-embed-text'
                )
        }
    }
    
    /**
     * Get list of supported embedding providers
     * @returns {string[]} - Array of supported provider names
     */
    static getSupportedProviders() {
        return ['ollama', 'nomic']
    }
    
    /**
     * Check if a provider is supported
     * @param {string} provider - Provider name to check
     * @returns {boolean} - Whether the provider is supported
     */
    static isProviderSupported(provider) {
        return this.getSupportedProviders().includes(provider.toLowerCase())
    }
    
    /**
     * Get default configuration for a provider
     * @param {string} provider - Provider name
     * @returns {Object} - Default configuration object
     */
    static getDefaultConfig(provider) {
        const configs = {
            ollama: {
                provider: 'ollama',
                model: 'nomic-embed-text',
                options: {
                    baseUrl: 'http://localhost:11434'
                }
            },
            nomic: {
                provider: 'nomic',
                model: 'nomic-embed-text-v1.5',
                options: {
                    apiKey: process.env.NOMIC_API_KEY
                }
            }
        }
        
        return configs[provider.toLowerCase()] || configs.ollama
    }
}