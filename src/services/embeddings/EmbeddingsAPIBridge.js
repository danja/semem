/**
 * Embeddings API Bridge Service
 *
 * This service provides a unified interface for calling external embedding APIs.
 * It handles:
 * - Provider connection management and caching
 * - Rate limiting and retry logic
 * - Error handling and fallback mechanisms
 * - Batch processing and optimization
 * - API call monitoring and metrics
 *
 * The bridge uses existing connectors but adds service-level features like
 * intelligent failover, performance optimization, and unified error handling.
 */

import EmbeddingConnectorFactory from '../../connectors/EmbeddingConnectorFactory.js';
import { Embeddings, EmbeddingError } from '../../core/Embeddings.js';
import { EMBEDDING_CONFIG } from '../../../config/preferences.js';
import { createUnifiedLogger } from '../../utils/LoggingConfig.js';

// Use unified STDIO-aware logger
const logger = createUnifiedLogger('embeddings-api-bridge');

/**
 * Embeddings API Bridge class
 */
export class EmbeddingsAPIBridge {
    /**
     * Creates a new EmbeddingsAPIBridge
     * @param {Object} config - Configuration instance (Config.js)
     * @param {Object} options - Additional options
     */
    constructor(config, options = {}) {
        if (!config) {
            throw new EmbeddingError('Config instance is required', { type: 'CONFIGURATION_ERROR' });
        }

        this.config = config;

        this.options = {
            ...EMBEDDING_CONFIG,
            ...options
        };

        // Connection caching
        this.connectorCache = new Map();
        this.lastUsedProvider = null;

        // Rate limiting
        this.requestTimes = new Map(); // provider -> array of request timestamps
        this.rateLimitPromises = new Map(); // provider -> promise for rate limit delay

        // Performance metrics
        this.metrics = {
            totalRequests: 0,
            successfulRequests: 0,
            failedRequests: 0,
            retriedRequests: 0,
            providerStats: new Map(), // provider -> { requests, successes, failures, avgResponseTime }
            cacheHits: 0
        };

        logger.info('Embeddings API Bridge initialized');
    }

    /**
     * Generate embedding using the provider-specific API
     * @param {string} text - Text to embed
     * @param {Object} options - Generation options
     * @returns {Promise<Array<number>>} - Embedding vector
     */
    async generateEmbedding(text, options = {}) {
        const {
            provider: preferredProvider = null,
            model = null,
            maxRetries = this.options.PROVIDERS.MAX_RETRIES
        } = options;

        let lastError = null;
        let attemptsRemaining = maxRetries + 1; // +1 for initial attempt

        // Use the consolidated logic from Embeddings.js
        const providers = this._getProviderFallbackChain(preferredProvider);

        for (const providerConfig of providers) {
            if (attemptsRemaining <= 0) break;

            try {
                logger.debug(`Attempting embedding generation with provider: ${providerConfig.type}`);

                // Apply rate limiting
                await this._enforceRateLimit(providerConfig.type);

                // Get or create connector
                const connector = await this._getConnector(providerConfig);

                // Determine model to use
                const modelToUse = model || providerConfig.embeddingModel || 'default';

                // Delegate embedding generation to Embeddings.js
                const embeddings = new Embeddings(this.config, this.options);
                const rawEmbedding = await embeddings.generateEmbedding(text, options);

                // Update metrics
                this._updateMetrics(providerConfig.type, true);
                this.metrics.successfulRequests++;
                this.lastUsedProvider = providerConfig.type;

                logger.debug(
                    `Successfully generated embedding using ${providerConfig.type}`
                );

                return rawEmbedding;

            } catch (error) {
                lastError = error;
                attemptsRemaining--;

                // Update metrics
                this._updateMetrics(providerConfig.type, false);
                this.metrics.failedRequests++;

                if (attemptsRemaining > 0) {
                    this.metrics.retriedRequests++;
                    logger.warn(
                        `Provider ${providerConfig.type} failed: ${error.message}. ` +
                        `Retrying with next provider (${attemptsRemaining} attempts remaining)`
                    );

                    // Brief delay before retry
                    await this._delay(1000);
                } else {
                    logger.error(`All providers exhausted for embedding generation: ${error.message}`);
                }
            }
        }

        // All providers failed
        throw new EmbeddingError(
            `Failed to generate embedding after trying all available providers. Last error: ${lastError?.message}`,
            {
                cause: lastError,
                type: 'PROVIDER_EXHAUSTED'
            }
        );
    }

    /**
     * Generate multiple embeddings in batch (if supported by provider)
     * @param {Array<string>} texts - Array of texts to embed
     * @param {Object} options - Generation options
     * @returns {Promise<Array<Array<number>>>} - Array of embedding vectors
     */
    async generateEmbeddingsBatch(texts, options = {}) {
        if (!Array.isArray(texts) || texts.length === 0) {
            throw new EmbeddingError('Texts must be a non-empty array', { type: 'VALIDATION_ERROR' });
        }

        const {
            batchSize = this.options.PROCESSING.DEFAULT_BATCH_SIZE,
            provider: preferredProvider = null
        } = options;

        // Validate batch size
        const maxBatchSize = this.options.PROCESSING.MAX_BATCH_SIZE;
        if (batchSize > maxBatchSize) {
            throw new EmbeddingError(
                `Batch size ${batchSize} exceeds maximum ${maxBatchSize}`,
                { type: 'VALIDATION_ERROR' }
            );
        }

        // Process in batches
        const results = [];
        for (let i = 0; i < texts.length; i += batchSize) {
            const batch = texts.slice(i, i + batchSize);
            logger.debug(`Processing batch ${Math.floor(i / batchSize) + 1} (${batch.length} items)`);

            // Try batch generation first, fall back to individual if not supported
            try {
                const batchResults = await this._generateBatchInternal(batch, options);
                results.push(...batchResults);
            } catch (error) {
                // Fall back to individual generation
                logger.debug('Batch generation failed, falling back to individual generation');
                for (const text of batch) {
                    const embedding = await this.generateEmbedding(text, options);
                    results.push(embedding);

                    // Small delay between individual requests in batch mode
                    if (batch.indexOf(text) < batch.length - 1) {
                        await this._delay(this.options.PROVIDERS.RATE_LIMIT_DELAY_MS);
                    }
                }
            }
        }

        return results;
    }

    /**
     * Get provider performance statistics
     * @returns {Object} - Performance metrics
     */
    getMetrics() {
        return {
            ...this.metrics,
            providerStats: Object.fromEntries(this.metrics.providerStats),
            lastUsedProvider: this.lastUsedProvider,
            connectorCacheSize: this.connectorCache.size
        };
    }

    /**
     * Get provider fallback chain in priority order
     * @param {string} preferredProvider - Preferred provider (optional)
     * @returns {Array} - Provider configurations in fallback order
     */
    _getProviderFallbackChain(preferredProvider = null) {
        const providers = this.config.get('llmProviders') || [];
        // Filter to embedding-capable providers
        const availableProviders = providers.filter(provider =>
            provider.capabilities && provider.capabilities.includes('embedding')
        );

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

        if (this.connectorCache.has(cacheKey)) {
            this.metrics.cacheHits++;
            return this.connectorCache.get(cacheKey);
        }

        try {
            // Get configuration from Config.js
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
            this.connectorCache.set(cacheKey, connector);

            logger.debug(`Created new connector for ${providerConfig.type}`);
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

    /**
     * Generate batch of embeddings internally
     * @param {Array<string>} texts - Texts to embed
     * @param {Object} options - Options
     * @returns {Promise<Array<Array<number>>>} - Array of embeddings
     */
    async _generateBatchInternal(texts, options) {
        // For now, process individually with rate limiting
        // Future: implement true batch processing for providers that support it
        const results = [];
        for (const text of texts) {
            const embedding = await this.generateEmbedding(text, options);
            results.push(embedding);

            // Rate limiting between batch items
            if (texts.indexOf(text) < texts.length - 1) {
                await this._delay(this.options.PROVIDERS.RATE_LIMIT_DELAY_MS);
            }
        }
        return results;
    }

    /**
     * Enforce rate limiting for provider
     * @param {string} providerType - Provider type
     * @returns {Promise<void>} - Resolves when rate limit is satisfied
     */
    async _enforceRateLimit(providerType) {
        const now = Date.now();
        const delayMs = this.options.PROVIDERS.RATE_LIMIT_DELAY_MS;

        if (!this.requestTimes.has(providerType)) {
            this.requestTimes.set(providerType, []);
        }

        const requestTimes = this.requestTimes.get(providerType);

        // Clean old request times (older than delay period)
        while (requestTimes.length > 0 && (now - requestTimes[0]) > delayMs) {
            requestTimes.shift();
        }

        // If we made a request recently, wait
        if (requestTimes.length > 0) {
            const timeSinceLastRequest = now - requestTimes[requestTimes.length - 1];
            if (timeSinceLastRequest < delayMs) {
                const waitTime = delayMs - timeSinceLastRequest;
                logger.debug(`Rate limiting: waiting ${waitTime}ms for ${providerType}`);
                await this._delay(waitTime);
            }
        }

        // Record this request time
        requestTimes.push(Date.now());
    }

    /**
     * Update performance metrics
     * @param {string} providerType - Provider type
     * @param {boolean} success - Whether request succeeded
     * @param {number} responseTime - Response time in ms (optional)
     */
    _updateMetrics(providerType, success, responseTime = 0) {
        if (!this.metrics.providerStats.has(providerType)) {
            this.metrics.providerStats.set(providerType, {
                requests: 0,
                successes: 0,
                failures: 0,
                totalResponseTime: 0,
                avgResponseTime: 0
            });
        }

        const stats = this.metrics.providerStats.get(providerType);
        stats.requests++;

        if (success) {
            stats.successes++;
            stats.totalResponseTime += responseTime;
            stats.avgResponseTime = stats.totalResponseTime / stats.successes;
        } else {
            stats.failures++;
        }
    }

    /**
     * Simple delay utility
     * @param {number} ms - Milliseconds to wait
     * @returns {Promise<void>} - Resolves after delay
     */
    _delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Clear connector cache
     */
    clearCache() {
        this.connectorCache.clear();
        this.requestTimes.clear();
        this.rateLimitPromises.clear();
        logger.debug('Cleared API bridge caches');
    }

    /**
     * Reset performance metrics
     */
    resetMetrics() {
        this.metrics = {
            totalRequests: 0,
            successfulRequests: 0,
            failedRequests: 0,
            retriedRequests: 0,
            providerStats: new Map(),
            cacheHits: 0
        };
        logger.debug('Reset performance metrics');
    }

    /**
     * Dispose of resources
     */
    dispose() {
        this.clearCache();
        this.resetMetrics();
        logger.info('Embeddings API Bridge disposed');
    }
}

export default EmbeddingsAPIBridge;