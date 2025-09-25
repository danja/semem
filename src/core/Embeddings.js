/**
 * Core Embeddings Module
 *
 * This module provides unified embedding operations, consolidating functionality
 * that was previously scattered across multiple files. It handles:
 * - Provider selection and fallback logic
 * - Model-to-dimension mapping and validation
 * - Embedding processing and standardization
 * - Configuration management for embedding operations
 *
 * This module delegates mathematical operations to VectorOperations and focuses
 * on the higher-level embedding management logic.
 */

import { VectorOperations, VectorError } from './Vectors.js';
import { EMBEDDING_CONFIG } from '../../config/preferences.js';
import { createUnifiedLogger } from '../utils/LoggingConfig.js';
import EmbeddingConnectorFactory from '../connectors/EmbeddingConnectorFactory.js';

// Use unified STDIO-aware logger
const logger = createUnifiedLogger('core-embeddings');

/**
 * Custom error type for embedding operations
 */
export class EmbeddingError extends Error {
    constructor(message, { cause, type = 'EMBEDDING_ERROR', provider } = {}) {
        super(message);
        this.name = 'EmbeddingError';
        this.type = type;
        this.provider = provider;
        if (cause) this.cause = cause;
    }
}

/**
 * Core Embeddings class providing unified embedding operations
 */
export class Embeddings {
    /**
     * Creates a new Embeddings instance
     * @param {Object} config - Configuration instance (Config.js)
     * @param {Object} options - Additional options
     */
    constructor(config, options = {}) {
        if (!config) {
            throw new EmbeddingError('Config instance is required', { type: 'CONFIGURATION_ERROR' });
        }

        this.config = config;
        this.options = {
            // Allow overriding preferences through options
            ...EMBEDDING_CONFIG,
            ...options
        };

        // Cache for provider configurations to avoid repeated config lookups
        this.providerCache = new Map();

        // Cache for dimension mappings
        this.dimensionCache = new Map();

        logger.info('Core Embeddings module initialized');
    }

    /**
     * Get dimension for a specific model, with caching
     * @param {string} model - Model name
     * @returns {number} - Dimension for the model
     */
    getDimension(model) {
        if (!model) {
            return this.options.DIMENSIONS.DEFAULT_DIMENSION;
        }

        // Check cache first
        if (this.dimensionCache.has(model)) {
            return this.dimensionCache.get(model);
        }

        // Check configured model dimensions
        const configuredDimension = this.options.DIMENSIONS.MODEL_DIMENSIONS[model];
        if (configuredDimension) {
            this.dimensionCache.set(model, configuredDimension);
            logger.debug(`Found configured dimension for model ${model}: ${configuredDimension}`);
            return configuredDimension;
        }

        // Check if model name contains dimension info (e.g., "model-768")
        const dimensionMatch = model.match(/(\d+)(?:d|dim|dimension)?$/i);
        if (dimensionMatch) {
            const extractedDimension = parseInt(dimensionMatch[1], 10);
            if (this.isValidDimension(extractedDimension)) {
                this.dimensionCache.set(model, extractedDimension);
                logger.debug(`Extracted dimension from model name ${model}: ${extractedDimension}`);
                return extractedDimension;
            }
        }

        // Check config.json for provider-specific dimensions
        try {
            const providers = this.config.get('llmProviders') || [];
            for (const provider of providers) {
                if (provider.embeddingModel === model && provider.embeddingDimension) {
                    const configDimension = provider.embeddingDimension;
                    if (this.isValidDimension(configDimension)) {
                        this.dimensionCache.set(model, configDimension);
                        logger.debug(`Found config dimension for model ${model}: ${configDimension}`);
                        return configDimension;
                    }
                }
            }
        } catch (error) {
            logger.warn(`Error reading config for dimension lookup: ${error.message}`);
        }

        // Fall back to default dimension
        const defaultDimension = this.options.DIMENSIONS.DEFAULT_DIMENSION;
        this.dimensionCache.set(model, defaultDimension);
        logger.warn(`Using default dimension for unknown model ${model}: ${defaultDimension}`);
        return defaultDimension;
    }

    /**
     * Get available embedding providers in priority order
     * @returns {Array} - Array of provider configurations
     */
    getAvailableProviders() {
        try {
            const providers = this.config.get('llmProviders') || [];

            // Filter to embedding-capable providers
            const embeddingProviders = providers.filter(provider =>
                provider.capabilities && provider.capabilities.includes('embedding')
            );

            // Sort by priority (lower number = higher priority)
            embeddingProviders.sort((a, b) => (a.priority || 999) - (b.priority || 999));

            logger.debug(`Found ${embeddingProviders.length} embedding providers`);
            return embeddingProviders;
        } catch (error) {
            logger.error('Error getting available providers:', error);
            return [];
        }
    }

    /**
     * Get the best available provider for embedding generation
     * @param {string} preferredProvider - Preferred provider name (optional)
     * @returns {Object|null} - Provider configuration or null if none available
     */
    getBestProvider(preferredProvider = null) {
        const cacheKey = preferredProvider || 'auto';

        // Check cache first
        if (this.providerCache.has(cacheKey)) {
            return this.providerCache.get(cacheKey);
        }

        const availableProviders = this.getAvailableProviders();

        if (availableProviders.length === 0) {
            logger.error('No embedding providers available');
            return null;
        }

        let selectedProvider = null;

        // If specific provider requested, try to find it
        if (preferredProvider) {
            selectedProvider = availableProviders.find(p =>
                p.type === preferredProvider || p.provider === preferredProvider
            );

            if (!selectedProvider) {
                logger.warn(`Preferred provider ${preferredProvider} not found, using auto-selection`);
            }
        }

        // Fall back to priority-based selection
        if (!selectedProvider) {
            selectedProvider = availableProviders[0]; // Highest priority (lowest priority number)
        }

        // Cache the selection
        this.providerCache.set(cacheKey, selectedProvider);

        logger.debug(`Selected provider: ${selectedProvider.type} (priority: ${selectedProvider.priority})`);
        return selectedProvider;
    }

    /**
     * Validate embedding vector
     * @param {Array<number>} embedding - Embedding vector to validate
     * @param {number} expectedDimension - Expected dimension (optional)
     * @returns {boolean} - True if valid
     * @throws {EmbeddingError} - If embedding is invalid
     */
    validateEmbedding(embedding, expectedDimension = null) {
        try {
            // Use VectorOperations for basic validation
            VectorOperations.validateEmbedding(embedding, expectedDimension);

            // Additional embedding-specific validation
            if (this.isZeroVector(embedding)) {
                throw new EmbeddingError('Embedding appears to be a zero vector', {
                    type: 'VALIDATION_ERROR'
                });
            }

            return true;
        } catch (error) {
            if (error instanceof VectorError) {
                throw new EmbeddingError(error.message, {
                    type: error.type,
                    cause: error.cause
                });
            }
            throw error;
        }
    }

    /**
     * Standardize embedding to expected dimension
     * @param {Array<number>} embedding - Embedding vector to standardize
     * @param {number} targetDimension - Target dimension
     * @returns {Array<number>} - Standardized embedding
     */
    standardizeEmbedding(embedding, targetDimension) {
        try {
            return VectorOperations.standardizeEmbedding(embedding, targetDimension);
        } catch (error) {
            if (error instanceof VectorError) {
                throw new EmbeddingError(error.message, {
                    type: error.type,
                    cause: error.cause
                });
            }
            throw error;
        }
    }

    /**
     * Check if a dimension value is valid
     * @param {number} dimension - Dimension to validate
     * @returns {boolean} - True if valid
     */
    isValidDimension(dimension) {
        return (
            typeof dimension === 'number' &&
            !isNaN(dimension) &&
            dimension >= this.options.DIMENSIONS.MIN_DIMENSION &&
            dimension <= this.options.DIMENSIONS.MAX_DIMENSION
        );
    }

    /**
     * Check if an embedding vector is effectively zero (all values near zero)
     * @param {Array<number>} embedding - Embedding vector
     * @returns {boolean} - True if embedding is effectively zero
     */
    isZeroVector(embedding) {
        if (!Array.isArray(embedding)) {
            return false;
        }

        const threshold = this.options.QUALITY.ZERO_VECTOR_THRESHOLD;
        return embedding.every(value => Math.abs(value) < threshold);
    }

    /**
     * Truncate content to maximum allowed length
     * @param {string} content - Content to truncate
     * @returns {string} - Truncated content
     */
    truncateContent(content) {
        if (!content || typeof content !== 'string') {
            return content;
        }

        const maxLength = this.options.PROCESSING.MAX_CONTENT_LENGTH;
        if (content.length <= maxLength) {
            return content;
        }

        const truncated = content.substring(0, maxLength);
        logger.debug(`Truncated content from ${content.length} to ${maxLength} characters`);
        return truncated;
    }

    /**
     * Validate content before embedding generation
     * @param {string} content - Content to validate
     * @returns {boolean} - True if valid
     * @throws {EmbeddingError} - If content is invalid
     */
    validateContent(content) {
        if (!content || typeof content !== 'string') {
            throw new EmbeddingError('Content must be a non-empty string', {
                type: 'VALIDATION_ERROR'
            });
        }

        const trimmedContent = content.trim();
        const minLength = this.options.PROCESSING.MIN_CONTENT_LENGTH;

        if (trimmedContent.length < minLength) {
            throw new EmbeddingError(
                `Content too short: ${trimmedContent.length} chars (minimum: ${minLength})`,
                { type: 'VALIDATION_ERROR' }
            );
        }

        return true;
    }

    /**
     * Calculate similarity between two embeddings
     * @param {Array<number>} embedding1 - First embedding
     * @param {Array<number>} embedding2 - Second embedding
     * @returns {number} - Similarity score (0-1 range)
     */
    calculateSimilarity(embedding1, embedding2) {
        try {
            const similarity = VectorOperations.cosineSimilarity(embedding1, embedding2);

            // Validate similarity result
            if (
                similarity < this.options.QUALITY.MIN_SIMILARITY_THRESHOLD ||
                similarity > this.options.QUALITY.MAX_SIMILARITY_THRESHOLD
            ) {
                logger.warn(`Similarity out of expected range: ${similarity}`);
            }

            return similarity;
        } catch (error) {
            logger.error('Error calculating embedding similarity:', error);
            throw new EmbeddingError('Failed to calculate embedding similarity', {
                cause: error,
                type: 'CALCULATION_ERROR'
            });
        }
    }

    /**
     * Get embedding configuration for debugging/monitoring
     * @returns {Object} - Configuration summary
     */
    getConfigSummary() {
        const availableProviders = this.getAvailableProviders();

        return {
            availableProviders: availableProviders.map(p => ({
                type: p.type,
                model: p.embeddingModel,
                dimension: p.embeddingDimension,
                priority: p.priority
            })),
            defaultDimension: this.options.DIMENSIONS.DEFAULT_DIMENSION,
            cacheStats: {
                providerCache: this.providerCache.size,
                dimensionCache: this.dimensionCache.size
            },
            configuration: {
                maxRetries: this.options.PROVIDERS.MAX_RETRIES,
                timeout: this.options.PROVIDERS.TIMEOUT_MS,
                maxContentLength: this.options.PROCESSING.MAX_CONTENT_LENGTH
            }
        };
    }

    /**
     * Clear internal caches
     */
    clearCaches() {
        this.providerCache.clear();
        this.dimensionCache.clear();
        logger.debug('Cleared embedding caches');
    }

    /**
     * Dispose of resources
     */
    dispose() {
        this.clearCaches();
        logger.info('Core Embeddings module disposed');
    }

    // Consolidated functionality from EmbeddingsAPIBridge.js

    /**
     * Generate embedding using the best available provider
     * @param {string} text - Text to embed
     * @param {Object} options - Generation options
     * @returns {Promise<Array<number>>} - Embedding vector
     */
    async generateEmbedding(text, options = {}) {
        const content = this.truncateContent(text);
        this.validateContent(content);

        const {
            provider: preferredProvider = null,
            model = null,
            maxRetries = this.options.PROVIDERS.MAX_RETRIES
        } = options;

        let lastError = null;
        let attemptsRemaining = maxRetries + 1;

        const providers = this._getProviderFallbackChain(preferredProvider);

        for (const providerConfig of providers) {
            if (attemptsRemaining <= 0) break;

            try {
                const connector = await this._getConnector(providerConfig);
                const modelToUse = model || providerConfig.embeddingModel || 'default';
                const expectedDimension = this.getDimension(modelToUse);

                const rawEmbedding = await connector.generateEmbedding(modelToUse, content);
                const standardizedEmbedding = this.standardizeEmbedding(rawEmbedding, expectedDimension);
                this.validateEmbedding(standardizedEmbedding, expectedDimension);

                return standardizedEmbedding;
            } catch (error) {
                lastError = error;
                attemptsRemaining--;
            }
        }

        throw new Error(`Failed to generate embedding: ${lastError?.message}`);
    }

    /**
     * Get provider fallback chain in priority order
     * @param {string} preferredProvider - Preferred provider (optional)
     * @returns {Array} - Provider configurations in fallback order
     */
    _getProviderFallbackChain(preferredProvider = null) {
        const availableProviders = this.getAvailableProviders();

        if (availableProviders.length === 0) {
            throw new EmbeddingError('No embedding providers available', { type: 'CONFIGURATION_ERROR' });
        }

        // If specific provider requested, try it first, then others
        if (preferredProvider) {
            const preferred = availableProviders.find(p => p.type === preferredProvider);
            if (preferred) {
                const others = availableProviders.filter(p => p.type !== preferredProvider);
                return [preferred, ...others];
            }
        }

        return availableProviders;
    }

    /**
     * Get or create connector for provider
     * @param {Object} providerConfig - Provider configuration
     * @returns {Promise<Object>} - Connector instance
     */
    async _getConnector(providerConfig) {
        const cacheKey = `${providerConfig.type}-${providerConfig.embeddingModel || 'default'}`;

        if (this.providerCache.has(cacheKey)) {
            return this.providerCache.get(cacheKey);
        }

        try {
            const connectorConfig = {
                provider: providerConfig.type,
                model: providerConfig.embeddingModel,
                options: {
                    ...providerConfig,
                    apiKey: providerConfig.apiKey,
                    baseUrl: providerConfig.baseUrl
                }
            };

            const connector = EmbeddingConnectorFactory.createConnector(connectorConfig);
            this.providerCache.set(cacheKey, connector);

            return connector;
        } catch (error) {
            throw new EmbeddingError(
                `Failed to create connector for provider ${providerConfig.type}: ${error.message}`,
                {
                    cause: error,
                    type: 'CONNECTOR_ERROR',
                    provider: providerConfig.type
                }
            );
        }
    }
}

export default Embeddings;