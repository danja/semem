// Validates embeddings and handles dimension standardization
export class EmbeddingValidator {
    constructor(config = {}) {
        // Default dimensions for different models
        this.dimensionMap = {
            'nomic-embed-text': 768,
            'qwen2:1.5b': 1536,
            'llama2': 4096,
            'default': 1536
        }

        // Override defaults with config
        Object.assign(this.dimensionMap, config.dimensions || {})
    }

    getDimension(model) {
        return this.dimensionMap[model] || this.dimensionMap.default
    }

    validateEmbedding(embedding, expectedDimension) {
        if (!Array.isArray(embedding)) {
            throw new TypeError('Embedding must be an array')
        }

        if (!embedding.every(x => typeof x === 'number' && !isNaN(x))) {
            throw new TypeError('Embedding must contain only valid numbers')
        }

        const actual = embedding.length
        if (actual !== expectedDimension) {
            throw new Error(`Embedding dimension mismatch: expected ${expectedDimension}, got ${actual}`)
        }

        return true
    }

    standardizeEmbedding(embedding, targetDimension) {
        this.validateEmbedding(embedding, embedding.length)
        const current = embedding.length

        if (current === targetDimension) {
            return embedding
        }

        if (current < targetDimension) {
            // Pad with zeros
            return [...embedding, ...new Array(targetDimension - current).fill(0)]
        }

        // Truncate to target dimension
        return embedding.slice(0, targetDimension)
    }

    // Utility method to check if padding/truncation would be lossy
    wouldBeLossy(embedding, targetDimension) {
        if (embedding.length <= targetDimension) {
            return false
        }

        // Check if truncated values would be non-zero
        return embedding.slice(targetDimension).some(x => Math.abs(x) > 1e-7)
    }
}