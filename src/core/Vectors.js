/**
 * Consolidated Vector and Embedding Operations Module
 *
 * This module provides a single source of truth for all vector mathematics
 * and embedding operations throughout the Semem codebase.
 *
 * Consolidates functionality from:
 * - src/Utils.js (vectorOps)
 * - src/handlers/EmbeddingHandler.js
 * - src/stores/modules/Store.js
 * - src/stores/modules/Vectors.js
 * - src/stores/modules/Search.js
 * - src/services/embeddings/EmbeddingService.js
 * - src/utils/EmbeddingValidator.js
 */

/**
 * Custom error class for vector/embedding operations
 */
export class VectorError extends Error {
    constructor(message, { cause, type = 'VECTOR_ERROR' } = {}) {
        super(message)
        this.name = 'VectorError'
        this.type = type
        if (cause) this.cause = cause
    }
}

/**
 * Consolidated Vector Operations Class
 * Provides all vector mathematics and embedding utilities in one place
 */
export class VectorOperations {

    // =============================================================================
    // CORE VECTOR MATHEMATICS
    // =============================================================================

    /**
     * Normalize a vector to unit length
     * @param {number[]} vector - Input vector
     * @returns {number[]} Normalized vector
     * @throws {VectorError} If vector is invalid or zero-length
     */
    static normalize(vector) {
        if (!Array.isArray(vector) || vector.length === 0) {
            throw new VectorError('Vector must be a non-empty array', { type: 'VALIDATION_ERROR' })
        }

        if (!vector.every(x => typeof x === 'number' && !isNaN(x))) {
            throw new VectorError('Vector must contain only valid numbers', { type: 'VALIDATION_ERROR' })
        }

        const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0))

        if (magnitude === 0) {
            throw new VectorError('Cannot normalize zero vector', { type: 'MATH_ERROR' })
        }

        return vector.map(val => val / magnitude)
    }

    /**
     * Calculate cosine similarity between two vectors
     * @param {number[]} vecA - First vector
     * @param {number[]} vecB - Second vector
     * @returns {number} Cosine similarity (0-1 range, higher is more similar)
     * @throws {VectorError} If vectors are invalid or mismatched dimensions
     */
    static cosineSimilarity(vecA, vecB) {
        if (!Array.isArray(vecA) || !Array.isArray(vecB)) {
            throw new VectorError('Both vectors must be arrays', { type: 'VALIDATION_ERROR' })
        }

        if (vecA.length !== vecB.length) {
            throw new VectorError(`Vector dimension mismatch: ${vecA.length} vs ${vecB.length}`, { type: 'DIMENSION_ERROR' })
        }

        if (vecA.length === 0) {
            throw new VectorError('Vectors must not be empty', { type: 'VALIDATION_ERROR' })
        }

        let dotProduct = 0
        let normA = 0
        let normB = 0

        for (let i = 0; i < vecA.length; i++) {
            if (typeof vecA[i] !== 'number' || isNaN(vecA[i]) ||
                typeof vecB[i] !== 'number' || isNaN(vecB[i])) {
                throw new VectorError('Vectors must contain only valid numbers', { type: 'VALIDATION_ERROR' })
            }

            dotProduct += vecA[i] * vecB[i]
            normA += vecA[i] * vecA[i]
            normB += vecB[i] * vecB[i]
        }

        if (normA === 0 || normB === 0) {
            return 0 // Handle zero vectors gracefully
        }

        return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB))
    }

    /**
     * Calculate Euclidean distance between two vectors
     * @param {number[]} vecA - First vector
     * @param {number[]} vecB - Second vector
     * @returns {number} Euclidean distance
     */
    static euclideanDistance(vecA, vecB) {
        if (!Array.isArray(vecA) || !Array.isArray(vecB)) {
            throw new VectorError('Both vectors must be arrays', { type: 'VALIDATION_ERROR' })
        }

        if (vecA.length !== vecB.length) {
            throw new VectorError(`Vector dimension mismatch: ${vecA.length} vs ${vecB.length}`, { type: 'DIMENSION_ERROR' })
        }

        let sumSquares = 0
        for (let i = 0; i < vecA.length; i++) {
            const diff = vecA[i] - vecB[i]
            sumSquares += diff * diff
        }

        return Math.sqrt(sumSquares)
    }

    /**
     * Calculate dot product of two vectors
     * @param {number[]} vecA - First vector
     * @param {number[]} vecB - Second vector
     * @returns {number} Dot product
     */
    static dotProduct(vecA, vecB) {
        if (!Array.isArray(vecA) || !Array.isArray(vecB)) {
            throw new VectorError('Both vectors must be arrays', { type: 'VALIDATION_ERROR' })
        }

        if (vecA.length !== vecB.length) {
            throw new VectorError(`Vector dimension mismatch: ${vecA.length} vs ${vecB.length}`, { type: 'DIMENSION_ERROR' })
        }

        return vecA.reduce((sum, val, i) => sum + val * vecB[i], 0)
    }

    // =============================================================================
    // EMBEDDING VALIDATION
    // =============================================================================

    /**
     * Validate an embedding vector (strict validation)
     * @param {Array} embedding - Embedding vector to validate
     * @param {number} expectedDimension - Expected dimension count
     * @throws {VectorError} If embedding is invalid
     * @returns {boolean} True if valid
     */
    static validateEmbedding(embedding, expectedDimension) {
        if (!Array.isArray(embedding)) {
            throw new VectorError('Embedding must be an array', { type: 'VALIDATION_ERROR' })
        }

        if (typeof expectedDimension === 'number' && embedding.length !== expectedDimension) {
            throw new VectorError(
                `Embedding dimension mismatch: expected ${expectedDimension}, got ${embedding.length}`,
                { type: 'DIMENSION_ERROR' }
            )
        }

        if (embedding.length === 0) {
            throw new VectorError('Embedding must not be empty', { type: 'VALIDATION_ERROR' })
        }

        if (!embedding.every(x => typeof x === 'number' && !isNaN(x))) {
            throw new VectorError('Embedding must contain only valid numbers', { type: 'VALIDATION_ERROR' })
        }

        return true
    }

    /**
     * Check if an embedding is valid (non-throwing validation)
     * @param {Array} embedding - Embedding to check
     * @param {number} [expectedDimension] - Optional expected dimension
     * @returns {boolean} True if valid, false otherwise
     */
    static isValidEmbedding(embedding, expectedDimension) {
        try {
            return this.validateEmbedding(embedding, expectedDimension)
        } catch (error) {
            return false
        }
    }

    /**
     * Check if an embedding has meaningful content (not all zeros)
     * @param {Array} embedding - Embedding to check
     * @returns {boolean} True if has meaningful content
     */
    static hasMeaningfulContent(embedding) {
        if (!this.isValidEmbedding(embedding)) {
            return false
        }

        // Check if embedding contains at least some non-zero values
        return embedding.some(val => Math.abs(val) > 1e-7)
    }

    // =============================================================================
    // EMBEDDING STANDARDIZATION
    // =============================================================================

    /**
     * Standardize embedding to target dimension
     * @param {Array} embedding - Source embedding vector
     * @param {number} targetDimension - Target dimension count
     * @returns {number[]} Standardized embedding vector
     * @throws {VectorError} If input is invalid
     */
    static standardizeEmbedding(embedding, targetDimension) {
        if (!Array.isArray(embedding)) {
            throw new VectorError('Embedding must be an array', { type: 'VALIDATION_ERROR' })
        }

        if (typeof targetDimension !== 'number' || targetDimension <= 0) {
            throw new VectorError('Target dimension must be a positive number', { type: 'VALIDATION_ERROR' })
        }

        if (!embedding.every(x => typeof x === 'number' && !isNaN(x))) {
            throw new VectorError('Embedding must contain only valid numbers', { type: 'VALIDATION_ERROR' })
        }

        const current = embedding.length

        if (current === targetDimension) {
            return [...embedding] // Return copy to avoid mutations
        }

        if (current < targetDimension) {
            // Pad with zeros
            return [...embedding, ...new Array(targetDimension - current).fill(0)]
        }

        // Truncate to target dimension
        return embedding.slice(0, targetDimension)
    }

    /**
     * Alias for standardizeEmbedding for backward compatibility
     * @param {Array} embedding - Source embedding vector
     * @param {number} targetLength - Target length
     * @returns {number[]} Adjusted embedding vector
     */
    static adjustEmbeddingLength(embedding, targetLength) {
        return this.standardizeEmbedding(embedding, targetLength)
    }

    /**
     * Check if standardization would be lossy (truncating non-zero values)
     * @param {Array} embedding - Source embedding
     * @param {number} targetDimension - Target dimension
     * @returns {boolean} True if truncation would lose information
     */
    static wouldBeLossy(embedding, targetDimension) {
        if (!Array.isArray(embedding) || embedding.length <= targetDimension) {
            return false
        }

        // Check if truncated values contain meaningful information
        return embedding.slice(targetDimension).some(x => Math.abs(x) > 1e-7)
    }

    // =============================================================================
    // EMBEDDING GENERATION UTILITIES
    // =============================================================================

    /**
     * Generate a zero vector of specified dimension
     * @param {number} dimension - Vector dimension
     * @returns {number[]} Zero vector
     */
    static generateZeroVector(dimension) {
        if (typeof dimension !== 'number' || dimension <= 0) {
            throw new VectorError('Dimension must be a positive number', { type: 'VALIDATION_ERROR' })
        }

        return new Array(dimension).fill(0)
    }

    /**
     * Generate a random vector of specified dimension
     * @param {number} dimension - Vector dimension
     * @param {number} [scale=1] - Scale factor for random values
     * @returns {number[]} Random vector with values in [-scale/2, scale/2]
     */
    static generateRandomVector(dimension, scale = 1) {
        if (typeof dimension !== 'number' || dimension <= 0) {
            throw new VectorError('Dimension must be a positive number', { type: 'VALIDATION_ERROR' })
        }

        return Array.from({ length: dimension }, () => (Math.random() - 0.5) * scale)
    }

    /**
     * Generate a deterministic hash-based embedding from text
     * @param {string} text - Input text
     * @param {number} dimension - Target embedding dimension
     * @returns {number[]} Hash-based embedding vector
     */
    static generateHashEmbedding(text, dimension) {
        if (typeof text !== 'string') {
            throw new VectorError('Text must be a string', { type: 'VALIDATION_ERROR' })
        }

        if (typeof dimension !== 'number' || dimension <= 0) {
            throw new VectorError('Dimension must be a positive number', { type: 'VALIDATION_ERROR' })
        }

        const embedding = new Array(dimension).fill(0)
        let hash = 0

        // Generate hash from text
        for (let i = 0; i < text.length; i++) {
            hash = ((hash << 5) - hash + text.charCodeAt(i)) & 0xffffffff
        }

        // Distribute hash across dimensions with some variation
        for (let i = 0; i < dimension; i++) {
            const seed = hash + i * 31 // Add prime offset for variation
            embedding[i] = ((seed % 1000) / 1000) - 0.5 // Map to [-0.5, 0.5] range
        }

        return embedding
    }

    // =============================================================================
    // DISTANCE/SIMILARITY CONVERSIONS
    // =============================================================================

    /**
     * Convert FAISS L2 distance to similarity score
     * @param {number} distance - L2 distance value
     * @returns {number} Similarity score (0-1 range, higher is more similar)
     */
    static distanceToSimilarity(distance) {
        if (typeof distance !== 'number' || distance < 0) {
            throw new VectorError('Distance must be a non-negative number', { type: 'VALIDATION_ERROR' })
        }

        // Convert L2 distance to similarity: higher distance = lower similarity
        return 1 / (1 + distance)
    }

    /**
     * Convert similarity score to distance
     * @param {number} similarity - Similarity score (0-1 range)
     * @returns {number} Distance value
     */
    static similarityToDistance(similarity) {
        if (typeof similarity !== 'number' || similarity < 0 || similarity > 1) {
            throw new VectorError('Similarity must be between 0 and 1', { type: 'VALIDATION_ERROR' })
        }

        if (similarity === 1) {
            return 0 // Perfect similarity = zero distance
        }

        return (1 / similarity) - 1
    }

    /**
     * Convert cosine similarity to approximate Euclidean distance
     * @param {number} cosineSimilarity - Cosine similarity score
     * @returns {number} Approximate Euclidean distance
     */
    static cosineToEuclidean(cosineSimilarity) {
        if (typeof cosineSimilarity !== 'number' || cosineSimilarity < -1 || cosineSimilarity > 1) {
            throw new VectorError('Cosine similarity must be between -1 and 1', { type: 'VALIDATION_ERROR' })
        }

        // For unit vectors: d² = 2(1 - cos(θ))
        return Math.sqrt(2 * (1 - cosineSimilarity))
    }
}

/**
 * Default export for backward compatibility
 */
export default VectorOperations

/**
 * Convenience exports for specific use cases
 */
export const {
    normalize,
    cosineSimilarity,
    euclideanDistance,
    dotProduct,
    validateEmbedding,
    isValidEmbedding,
    standardizeEmbedding,
    adjustEmbeddingLength,
    generateZeroVector,
    generateRandomVector,
    generateHashEmbedding,
    distanceToSimilarity,
    similarityToDistance
} = VectorOperations