import logger from 'loglevel'
import { VectorOperations, VectorError } from '../core/Vectors.js'
import { Embeddings, EmbeddingError } from '../core/Embeddings.js'
import EmbeddingsAPIBridge from '../services/embeddings/EmbeddingsAPIBridge.js'

export default class EmbeddingHandler {
    constructor(provider, model, dimension, cacheManager, options = {}) {
        // Backward compatibility: if provider is provided, use legacy mode
        // New usage: if provider is a Config instance, use new core modules
        const isLegacyMode = provider && typeof provider.generateEmbedding === 'function';

        if (isLegacyMode) {
            // Legacy mode: use provided provider directly
            this.provider = provider
            this.model = String(model)
            this.dimension = dimension
            this.cacheManager = cacheManager
            this.legacyMode = true
            this.coreEmbeddings = null
            this.apiBridge = null

            if (!provider?.generateEmbedding) {
                throw new EmbeddingError('Invalid embedding provider', { type: 'CONFIGURATION_ERROR' })
            }
        } else {
            // New mode: provider is actually a Config instance
            const config = provider;
            if (!config || typeof config.get !== 'function') {
                throw new EmbeddingError(
                    'Config instance required. For legacy usage, provide connector with generateEmbedding method.',
                    { type: 'CONFIGURATION_ERROR' }
                );
            }

            this.config = config
            this.model = String(model)
            this.cacheManager = cacheManager
            this.legacyMode = false

            // Initialize core modules
            this.coreEmbeddings = new Embeddings(config, options)
            this.apiBridge = new EmbeddingsAPIBridge(config, options)

            // Get dimension from core module if not provided
            this.dimension = dimension || this.coreEmbeddings.getDimension(this.model)

            // Legacy provider reference for backward compatibility
            this.provider = null
        }

        // Merge options with sensible defaults
        this.options = {
            enableFallbacks: options.enableFallbacks === true, // Default disabled for backward compatibility
            maxRetries: options.maxRetries || 3,
            timeoutMs: options.timeoutMs || 30000,
            fallbackEmbeddingStrategy: options.fallbackEmbeddingStrategy || 'zero_vector',
            ...options
        }

        logger.debug(`EmbeddingHandler initialized in ${this.legacyMode ? 'legacy' : 'modern'} mode`);
    }

    async generateEmbedding(text, options = {}) {
        if (!text || typeof text !== 'string') {
            throw new EmbeddingError('Invalid input text', { type: 'VALIDATION_ERROR' })
        }

        const cacheKey = `${this.model}:${text.slice(0, 100)}`
        const cached = this.cacheManager?.get(cacheKey)
        if (cached) return cached

        const mergedOptions = { ...this.options, ...options }

        try {
            let embedding;

            if (this.legacyMode) {
                // Legacy mode: use original provider-based approach
                embedding = mergedOptions.enableFallbacks
                    ? await this.executeWithResilience(
                        () => this.provider.generateEmbedding(this.model, text),
                        mergedOptions
                      )
                    : await this.provider.generateEmbedding(this.model, text)

                if (!embedding || !Array.isArray(embedding)) {
                    throw new EmbeddingError('Invalid embedding format from provider', {
                        type: 'PROVIDER_ERROR'
                    })
                }

                const standardized = this.standardizeEmbedding(embedding)
                this.validateEmbedding(standardized)
                embedding = standardized;

            } else {
                // Modern mode: use API bridge with automatic provider selection and retries
                embedding = await this.apiBridge.generateEmbedding(text, {
                    model: this.model,
                    ...mergedOptions
                });
                // API bridge already handles validation and standardization
            }

            this.cacheManager?.set(cacheKey, embedding)
            return embedding

        } catch (error) {
            // Simple fallback mechanism (for legacy mode or when API bridge fails)
            if (mergedOptions.enableFallbacks) {
                logger.warn(`Embedding generation failed, using fallback: ${error.message}`)
                const fallbackEmbedding = this.generateFallbackEmbedding(text, mergedOptions.fallbackEmbeddingStrategy)
                this.cacheManager?.set(cacheKey, fallbackEmbedding)
                return fallbackEmbedding
            }

            if (error instanceof EmbeddingError) {
                throw error
            }
            logger.error('Unexpected error generating embedding:', error)
            throw new EmbeddingError(`Provider error: ${error.message}`, { cause: error })
        }
    }

    validateEmbedding(embedding) {
        if (this.legacyMode) {
            // Legacy mode: use VectorOperations directly with error conversion
            try {
                return VectorOperations.validateEmbedding(embedding, this.dimension)
            } catch (error) {
                // Convert VectorError to EmbeddingError for backward compatibility
                if (error instanceof VectorError) {
                    throw new EmbeddingError(error.message, {
                        type: error.type,
                        cause: error.cause
                    })
                }
                throw error
            }
        } else {
            // Modern mode: use core Embeddings module
            return this.coreEmbeddings.validateEmbedding(embedding, this.dimension)
        }
    }

    standardizeEmbedding(embedding) {
        if (this.legacyMode) {
            // Legacy mode: use VectorOperations directly with error conversion
            try {
                return VectorOperations.standardizeEmbedding(embedding, this.dimension)
            } catch (error) {
                // Convert VectorError to EmbeddingError for backward compatibility
                if (error instanceof VectorError) {
                    throw new EmbeddingError(error.message, {
                        type: error.type,
                        cause: error.cause
                    })
                }
                throw new EmbeddingError('Standardization failed', { cause: error })
            }
        } else {
            // Modern mode: use core Embeddings module
            return this.coreEmbeddings.standardizeEmbedding(embedding, this.dimension)
        }
    }

    // Simple resilience mechanism with timeout and retries
    async executeWithResilience(operation, options) {
        const { maxRetries, timeoutMs } = options
        let lastError = null

        for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
                return await this.withTimeout(operation(), timeoutMs)
            } catch (error) {
                lastError = error
                if (attempt < maxRetries - 1) {
                    const delay = Math.min(1000 * Math.pow(2, attempt), 5000) // Cap at 5s
                    await new Promise(resolve => setTimeout(resolve, delay))
                }
            }
        }

        throw new EmbeddingError(`Operation failed after ${maxRetries} attempts: ${lastError?.message}`, {
            cause: lastError,
            type: 'PROVIDER_ERROR'
        })
    }

    // Simple timeout wrapper
    async withTimeout(promise, timeoutMs) {
        return Promise.race([
            promise,
            new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Operation timed out')), timeoutMs)
            )
        ])
    }

    // Simple fallback embedding generation
    generateFallbackEmbedding(text, strategy) {
        switch (strategy) {
            case 'zero_vector':
                return VectorOperations.generateZeroVector(this.dimension)
            case 'random_vector':
                return VectorOperations.generateRandomVector(this.dimension)
            case 'text_hash':
                // Simple hash-based embedding
                return VectorOperations.generateHashEmbedding(text, this.dimension)
            default:
                return VectorOperations.generateZeroVector(this.dimension)
        }
    }

}