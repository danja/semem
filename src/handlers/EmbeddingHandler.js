import logger from 'loglevel'

export default class EmbeddingHandler {
    /**
     * @param {Object} llmProvider
     * @param {string} model Model identifier
     * @param {number} dimension Embedding dimension
     * @param {Object} cacheManager
     */
    constructor(llmProvider, model, dimension, cacheManager) {
        if (typeof model !== 'string') {
            throw new TypeError('Model must be a string')
        }

        this.llmProvider = llmProvider
        this.model = model
        this.dimension = dimension
        this.cacheManager = cacheManager
    }

    /**
     * @param {string} text
     * @returns {Promise<number[]>}
     */
    async generateEmbedding(text) {
        const cacheKey = `${this.model}:${text.slice(0, 100)}`

        const cached = this.cacheManager.get(cacheKey)
        if (cached) return cached

        try {
            const embedding = await this.llmProvider.generateEmbedding(
                this.model,
                text
            )

            const standardized = this.standardizeEmbedding(embedding)
            this.cacheManager.set(cacheKey, standardized)
            return standardized
        } catch (error) {
            logger.error('Error generating embedding:', error)
            throw error
        }
    }

    /**
     * @param {number[]} embedding
     * @private
     */
    validateEmbedding(embedding) {
        if (!Array.isArray(embedding)) {
            throw new TypeError('Embedding must be an array')
        }
        if (!embedding.every(x => typeof x === 'number' && !isNaN(x))) {
            throw new TypeError('Embedding must contain only valid numbers')
        }
    }

    /**
     * @param {number[]} embedding
     * @returns {number[]}
     */
    standardizeEmbedding(embedding) {
        this.validateEmbedding(embedding)
        const current = embedding.length

        if (current === this.dimension) return embedding
        if (current < this.dimension) {
            return [...embedding, ...new Array(this.dimension - current).fill(0)]
        }
        return embedding.slice(0, this.dimension)
    }
}