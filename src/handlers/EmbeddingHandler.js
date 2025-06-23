import logger from 'loglevel'

class EmbeddingError extends Error {
    constructor(message, { cause, type = 'EMBEDDING_ERROR' } = {}) {
        super(message)
        this.name = 'EmbeddingError'
        this.type = type
        if (cause) this.cause = cause
    }
}

export default class EmbeddingHandler {
    constructor(provider, model, dimension, cacheManager, options = {}) {
        if (!provider?.generateEmbedding) {
            throw new EmbeddingError('Invalid embedding provider', { type: 'CONFIGURATION_ERROR' })
        }

        this.provider = provider
        this.model = String(model)
        this.dimension = dimension
        this.cacheManager = cacheManager
        
        // Simple fallback configuration (opt-in for backward compatibility)
        this.options = {
            enableFallbacks: options.enableFallbacks === true, // Default disabled for backward compatibility
            maxRetries: options.maxRetries || 3,
            timeoutMs: options.timeoutMs || 30000,
            fallbackEmbeddingStrategy: options.fallbackEmbeddingStrategy || 'zero_vector',
            ...options
        }
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
            // Use resilience only if fallbacks are enabled, otherwise use original behavior
            const embedding = mergedOptions.enableFallbacks
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
            this.cacheManager?.set(cacheKey, standardized)
            return standardized
        } catch (error) {
            // Simple fallback mechanism
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
        if (!Array.isArray(embedding)) {
            throw new EmbeddingError('Embedding must be an array', {
                type: 'VALIDATION_ERROR'
            })
        }

        if (embedding.length !== this.dimension) {
            throw new EmbeddingError(
                `Embedding dimension mismatch: expected ${this.dimension}, got ${embedding.length}`, {
                type: 'VALIDATION_ERROR'
            }
            )
        }

        if (!embedding.every(x => typeof x === 'number' && !isNaN(x))) {
            throw new EmbeddingError('Embedding must contain only valid numbers', {
                type: 'VALIDATION_ERROR'
            })
        }

        return true
    }

    standardizeEmbedding(embedding) {
        try {
            if (!Array.isArray(embedding)) {
                throw new EmbeddingError('Input must be an array', {
                    type: 'VALIDATION_ERROR'
                })
            }

            const current = embedding.length
            if (current === this.dimension) return embedding

            if (current < this.dimension) {
                return [...embedding, ...new Array(this.dimension - current).fill(0)]
            }

            return embedding.slice(0, this.dimension)
        } catch (error) {
            if (error instanceof EmbeddingError) throw error
            throw new EmbeddingError('Standardization failed', { cause: error })
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
                return new Array(this.dimension).fill(0)
            case 'random_vector':
                return Array.from({ length: this.dimension }, () => Math.random() - 0.5)
            case 'text_hash':
                // Simple hash-based embedding
                return this.generateHashEmbedding(text)
            default:
                return new Array(this.dimension).fill(0)
        }
    }

    // Simple text hash to embedding conversion
    generateHashEmbedding(text) {
        const embedding = new Array(this.dimension).fill(0)
        let hash = 0
        
        for (let i = 0; i < text.length; i++) {
            hash = ((hash << 5) - hash + text.charCodeAt(i)) & 0xffffffff
        }
        
        // Distribute hash across dimensions
        for (let i = 0; i < this.dimension; i++) {
            embedding[i] = ((hash + i) % 1000) / 1000 - 0.5
        }
        
        return embedding
    }
}