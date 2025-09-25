/**
 * Factory for creating embedding connectors based on provider type
 */
import logger from 'loglevel'
import OllamaConnector from './OllamaConnector.js'
import NomicConnector from './NomicConnector.js'
import { EMBEDDING_CONFIG } from '../../config/preferences.js'

export default class EmbeddingConnectorFactory {
    /**
     * Create an embedding connector based on provider configuration
     * @param {Object} config - Provider configuration
     * @param {string} config.provider - Provider type ('ollama', 'nomic')
     * @param {string} config.model - Model name to use
     * @param {Object} config.options - Provider-specific options (including apiKey, baseUrl from Config.js)
     * @returns {Object} - Embedding connector instance
     */
    static createConnector(config = {}) {
        const { provider = EMBEDDING_CONFIG.PROVIDERS.FALLBACK_PROVIDER, model, options = {} } = config

        logger.debug(`Creating embedding connector for provider: ${provider}`)

        switch (provider.toLowerCase()) {
            case 'ollama':
                return new OllamaConnector(
                    options.baseUrl, // Will be resolved via Config.js by caller
                    model
                )

            case 'nomic':
                return new NomicConnector(
                    options.apiKey, // Must be provided by caller from Config.js
                    model
                )

            default:
                logger.warn(`Unknown embedding provider: ${provider}, falling back to ${EMBEDDING_CONFIG.PROVIDERS.FALLBACK_PROVIDER}`)
                return new OllamaConnector(
                    options.baseUrl, // Will be resolved via Config.js by caller
                    model
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
     * Note: This method provides fallback defaults only.
     * Actual configuration should come from Config.js
     * @param {string} provider - Provider name
     * @returns {Object} - Default configuration object
     */
    static getDefaultConfig(provider) {
        const configs = {
            ollama: {
                provider: 'ollama',
                model: 'nomic-embed-text',
                options: {
                    // baseUrl should come from config.json via Config.js
                }
            },
            nomic: {
                provider: 'nomic',
                model: 'nomic-embed-text-v1.5',
                options: {
                    // apiKey should come from config.json via Config.js
                }
            }
        }

        const fallbackProvider = EMBEDDING_CONFIG.PROVIDERS.FALLBACK_PROVIDER;
        return configs[provider.toLowerCase()] || configs[fallbackProvider] || configs.ollama
    }
}