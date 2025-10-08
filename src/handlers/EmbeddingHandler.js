/**
 * Legacy-compatible EmbeddingHandler wrapper
 *
 * Provides the minimal surface area required by legacy components while delegating
 * validation and standardisation to the modern embeddings stack.
 */

import { createUnifiedLogger } from '../utils/LoggingConfig.js';
import { VectorOperations } from '../core/Vectors.js';

const logger = createUnifiedLogger('embedding-handler');

export default class EmbeddingHandler {
    /**
     * @param {Object} provider - Embedding provider implementing generateEmbedding(model, text)
     * @param {string} model - Embedding model identifier
     * @param {number} dimension - Expected embedding dimension
     * @param {Object} cacheManager - Optional cache with get/set API
     * @param {Object} options - Additional options
     */
    constructor(provider, model, dimension, cacheManager = null, options = {}) {
        if (!provider || typeof provider.generateEmbedding !== 'function') {
            throw new Error('Invalid embedding provider');
        }
        if (!model || typeof model !== 'string') {
            throw new Error('Embedding model is required');
        }
        if (!Number.isInteger(dimension) || dimension <= 0) {
            throw new Error('Embedding dimension must be a positive integer');
        }

        this.provider = provider;
        this.model = model;
        this.dimension = dimension;
        this.cacheManager = cacheManager;
        this.options = {
            cachePrefix: options.cachePrefix || 'embedding',
            cacheTTL: options.cacheTTL || 60 * 60 * 1000, // 1 hour default
            ...options
        };
    }

    /**
     * Generate an embedding for the provided text.
     * Applies simple caching when a cache manager is supplied.
     * @param {string} text
     * @returns {Promise<number[]>}
     */
    async generateEmbedding(text) {
        if (!text || typeof text !== 'string' || text.trim() === '') {
            throw new Error('Invalid input text');
        }

        const normalizedText = text.trim();
        const cacheKey = this.#buildCacheKey(normalizedText);

        if (this.cacheManager?.get) {
            const cached = this.cacheManager.get(cacheKey);
            if (Array.isArray(cached)) {
                logger.debug('Returning cached embedding', { cacheKey });
                return cached;
            }
        }

        try {
            const embedding = await this.provider.generateEmbedding(this.model, normalizedText);
            this.validateEmbedding(embedding);

            if (this.cacheManager?.set) {
                this.cacheManager.set(cacheKey, embedding);
            }

            return embedding;
        } catch (error) {
            logger.error('Provider failed to generate embedding', {
                message: error.message,
                stack: error.stack
            });
            throw new Error(`Provider error: ${error.message}`);
        }
    }

    /**
     * Validate embedding shape and numeric content
     * @param {Array<number>} embedding
     * @returns {boolean}
     */
    validateEmbedding(embedding) {
        if (!Array.isArray(embedding)) {
            throw new Error('Embedding must be an array');
        }

        if (embedding.length !== this.dimension) {
            throw new Error('Embedding dimension mismatch');
        }

        for (const value of embedding) {
            if (typeof value !== 'number' || Number.isNaN(value) || !Number.isFinite(value)) {
                throw new Error('Embedding must contain only valid numbers');
            }
        }

        return true;
    }

    /**
     * Standardize embeddings to the configured dimension.
     * Delegates to VectorOperations to keep behaviour consistent with new stack.
     * @param {Array<number>} embedding
     * @returns {Array<number>}
     */
    standardizeEmbedding(embedding) {
        if (!Array.isArray(embedding)) {
            throw new Error('Input must be an array');
        }

        if (embedding.length === this.dimension) {
            return embedding;
        }

        return VectorOperations.standardizeEmbedding(embedding, this.dimension);
    }

    #buildCacheKey(text) {
        const truncated = text.length > 200 ? text.slice(0, 200) : text;
        return `${this.options.cachePrefix}:${this.model}:${truncated}`;
    }
}
