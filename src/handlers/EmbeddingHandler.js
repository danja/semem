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
    constructor(provider, model, dimension, cacheManager) {
        if (!provider?.generateEmbedding) {
            throw new EmbeddingError('Invalid embedding provider', { type: 'CONFIGURATION_ERROR' })
        }

        this.provider = provider
        this.model = String(model)
        this.dimension = dimension
        this.cacheManager = cacheManager
    }

    async generateEmbedding(text) {
        if (!text || typeof text !== 'string') {
            throw new EmbeddingError('Invalid input text', { type: 'VALIDATION_ERROR' })
        }

        const cacheKey = `${this.model}:${text.slice(0, 100)}`
        const cached = this.cacheManager?.get(cacheKey)
        if (cached) return cached

        try {
            const embedding = await this.provider.generateEmbedding(this.model, text)
                .catch(error => {
                    throw new EmbeddingError(`Provider error: ${error.message}`, {
                        cause: error,
                        type: 'PROVIDER_ERROR'
                    })
                })

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
            if (error instanceof EmbeddingError) {
                throw error
            }
            logger.error('Unexpected error generating embedding:', error)
            throw new EmbeddingError('Embedding generation failed', { cause: error })
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
}