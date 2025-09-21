import faiss from 'faiss-node'
import logger from 'loglevel'

/**
 * Vectors module handles vector operations and FAISS index management
 * Responsible for vector similarity calculations, embedding validation, and FAISS operations
 */
export class Vectors {
    constructor(dimension = 768) {
        this.dimension = dimension
        this.index = null

        // Mapping arrays to track valid embeddings after filtering invalid ones
        this.faissToMemoryMap = []      // Maps FAISS index → shortTermMemory index
        this.memoryToFaissMap = []      // Maps shortTermMemory index → FAISS index (-1 if no FAISS entry)

        this.initializeIndex()
    }

    /**
     * Initialize FAISS index for fast similarity search
     */
    initializeIndex() {
        try {
            this.index = new faiss.IndexFlatL2(this.dimension)
            if (!this.index || !this.index.getDimension) {
                throw new Error('Failed to initialize FAISS index')
            }
            logger.info(`Initialized FAISS index with dimension ${this.dimension}`)
        } catch (error) {
            logger.error('FAISS index initialization failed:', error)
            throw new Error('Failed to initialize FAISS index: ' + error.message)
        }
    }

    /**
     * Validate an embedding vector
     * @param {Array<number>} embedding - Embedding vector to validate
     * @throws {Error} If embedding is invalid
     */
    validateEmbedding(embedding) {
        if (!Array.isArray(embedding)) {
            throw new TypeError('Embedding must be an array')
        }
        if (embedding.length !== this.dimension) {
            throw new Error(`Embedding dimension mismatch: expected ${this.dimension}, got ${embedding.length}`)
        }
        if (!embedding.every(x => typeof x === 'number' && !isNaN(x))) {
            throw new TypeError('Embedding must contain only valid numbers')
        }
    }

    /**
     * Calculate cosine similarity between two vectors
     * @param {Array<number>} vecA - First vector
     * @param {Array<number>} vecB - Second vector
     * @returns {number} Cosine similarity (0-1 range)
     */
    calculateCosineSimilarity(vecA, vecB) {
        if (vecA.length !== vecB.length) return 0

        let dotProduct = 0
        let normA = 0
        let normB = 0

        for (let i = 0; i < vecA.length; i++) {
            dotProduct += vecA[i] * vecB[i]
            normA += vecA[i] * vecA[i]
            normB += vecB[i] * vecB[i]
        }

        if (normA === 0 || normB === 0) return 0

        return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB))
    }

    /**
     * Adjust embedding vector length to match target length
     * @param {Array<number>} embedding - Source embedding vector
     * @param {number} targetLength - Target length to match
     * @returns {Array<number>} Adjusted embedding vector
     */
    adjustEmbeddingLength(embedding, targetLength) {
        if (embedding.length === targetLength) {
            return embedding;
        }

        if (embedding.length > targetLength) {
            // Truncate if too long
            return embedding.slice(0, targetLength);
        } else {
            // Pad with zeros if too short
            const padded = [...embedding];
            while (padded.length < targetLength) {
                padded.push(0);
            }
            return padded;
        }
    }

    /**
     * Check if an embedding is valid (correct dimensions and contains valid numbers)
     * @param {Array<number>} embedding - Embedding to check
     * @returns {boolean} True if valid
     */
    isValidEmbedding(embedding) {
        if (!Array.isArray(embedding) || embedding.length !== this.dimension) {
            return false
        }

        // Check if embedding contains valid numbers and is not all zeros
        const hasValidNumbers = embedding.some(val =>
            typeof val === 'number' && !isNaN(val) && val !== 0
        )

        return hasValidNumbers
    }

    /**
     * Add embedding to FAISS index and update mapping
     * @param {Array<number>} embedding - Embedding vector to add
     * @param {number} memoryIndex - Index in the memory array
     * @returns {number} FAISS index where embedding was added, or -1 if skipped
     */
    addEmbedding(embedding, memoryIndex) {
        if (!this.isValidEmbedding(embedding)) {
            logger.warn(`Skipping invalid embedding for memory index ${memoryIndex}: ${Array.isArray(embedding) ? embedding.length : typeof embedding}D (expected ${this.dimension}D)`)
            return -1
        }

        try {
            const beforeTotal = this.index.ntotal()

            // Validate embedding structure
            logger.debug(`Adding embedding: type=${typeof embedding}, isArray=${Array.isArray(embedding)}, length=${embedding?.length}`)
            if (Array.isArray(embedding) && embedding.length > 0) {
                logger.debug(`First few values: [${embedding.slice(0, 3).join(', ')}...]`)
            }

            // Prepare array for FAISS (expects regular Array, not Float32Array)
            // Handle nested arrays or non-array structures
            let flatEmbedding = embedding;
            if (Array.isArray(embedding) && embedding.length === 1 && Array.isArray(embedding[0])) {
                // Handle nested array structure like [[1,2,3,4...]]
                flatEmbedding = embedding[0];
                logger.debug(`🔧 Unwrapped nested embedding array: ${flatEmbedding.length}D`)
            } else if (!Array.isArray(embedding)) {
                throw new Error(`Embedding must be an array, got ${typeof embedding}`)
            }

            // FAISS expects a regular JavaScript Array, not Float32Array
            const embeddingArray = Array.isArray(flatEmbedding) ? flatEmbedding : Array.from(flatEmbedding);

            this.index.add(embeddingArray)
            const afterTotal = this.index.ntotal()

            if (afterTotal > beforeTotal) {
                const newFaissIndex = afterTotal - 1

                // Ensure mapping arrays exist and have correct length
                if (!this.faissToMemoryMap) this.faissToMemoryMap = []
                if (!this.memoryToFaissMap) this.memoryToFaissMap = []

                // Extend memoryToFaissMap if needed
                while (this.memoryToFaissMap.length <= memoryIndex) {
                    this.memoryToFaissMap.push(-1)
                }

                // Record the mapping
                this.faissToMemoryMap[newFaissIndex] = memoryIndex
                this.memoryToFaissMap[memoryIndex] = newFaissIndex

                logger.debug(`🔗 Added embedding to FAISS[${newFaissIndex}] ↔ memory[${memoryIndex}]`)
                return newFaissIndex
            } else {
                logger.error(`❌ FAISS add failed: count didn't increase (${beforeTotal} → ${afterTotal})`)
                return -1
            }
        } catch (error) {
            logger.error(`❌ Failed to add embedding to FAISS:`, error.message)
            return -1
        }
    }

    /**
     * Rebuild FAISS index from embeddings array, skipping invalid embeddings
     * @param {Array<Array<number>>} embeddings - Array of embedding vectors
     * @returns {Object} Statistics about the rebuild operation
     */
    rebuildIndex(embeddings) {
        // Reset index and mappings
        this.index = new faiss.IndexFlatL2(this.dimension)
        this.faissToMemoryMap = []
        this.memoryToFaissMap = new Array(embeddings.length).fill(-1)

        let addedCount = 0
        let skippedCount = 0

        for (let i = 0; i < embeddings.length; i++) {
            const embedding = embeddings[i]

            if (this.isValidEmbedding(embedding)) {
                const faissIndex = this.addEmbedding(embedding, i)
                if (faissIndex !== -1) {
                    addedCount++
                } else {
                    skippedCount++
                }
            } else {
                skippedCount++
            }
        }

        logger.info(`🔧 Rebuilt FAISS index: ${addedCount} valid embeddings added, ${skippedCount} invalid embeddings skipped`)
        logger.info(`🔍 FAISS index contains ${this.index.ntotal()} entries, memory contains ${embeddings.length} entries`)

        return { addedCount, skippedCount, totalEmbeddings: embeddings.length }
    }

    /**
     * Search FAISS index for similar vectors
     * @param {Array<number>} queryEmbedding - Query vector
     * @param {number} k - Number of results to return
     * @returns {Object} Search results with distances and labels
     */
    searchIndex(queryEmbedding, k = 10) {
        if (!this.index || this.index.ntotal() === 0) {
            return { distances: [], labels: [] }
        }

        try {
            this.validateEmbedding(queryEmbedding)
            // Convert to Float32Array as required by FAISS
            const queryFloat32 = new Float32Array(queryEmbedding)
            const results = this.index.search(queryFloat32, Math.min(k, this.index.ntotal()))
            return results
        } catch (error) {
            logger.error('FAISS search error:', error.message)
            return { distances: [], labels: [] }
        }
    }

    /**
     * Get memory index from FAISS index using mapping
     * @param {number} faissIndex - FAISS index
     * @returns {number} Memory index, or -1 if not found
     */
    getMemoryIndex(faissIndex) {
        if (faissIndex >= 0 && faissIndex < this.faissToMemoryMap.length) {
            return this.faissToMemoryMap[faissIndex]
        }
        return -1
    }

    /**
     * Get FAISS index from memory index using mapping
     * @param {number} memoryIndex - Memory index
     * @returns {number} FAISS index, or -1 if not found
     */
    getFaissIndex(memoryIndex) {
        if (memoryIndex >= 0 && memoryIndex < this.memoryToFaissMap.length) {
            return this.memoryToFaissMap[memoryIndex]
        }
        return -1
    }

    /**
     * Get total number of vectors in FAISS index
     * @returns {number}
     */
    getIndexSize() {
        return this.index ? this.index.ntotal() : 0
    }

    /**
     * Get index dimension
     * @returns {number}
     */
    getDimension() {
        return this.dimension
    }

    /**
     * Get mapping statistics
     * @returns {Object}
     */
    getMappingStats() {
        return {
            faissSize: this.getIndexSize(),
            memorySize: this.memoryToFaissMap.length,
            validMappings: this.faissToMemoryMap.length,
            invalidMappings: this.memoryToFaissMap.filter(idx => idx === -1).length
        }
    }

    /**
     * Convert FAISS L2 distance to similarity score
     * @param {number} distance - L2 distance from FAISS
     * @returns {number} Similarity score (0-1 range, higher is more similar)
     */
    distanceToSimilarity(distance) {
        // Convert L2 distance to cosine-like similarity (0-1 range)
        return 1 / (1 + distance)
    }

    /**
     * Serialize FAISS index to buffer for persistence
     * @returns {Buffer|null} Serialized index buffer, or null if failed
     */
    serializeIndex() {
        try {
            if (!this.index || this.index.ntotal() === 0) {
                return null
            }
            return this.index.toBuffer()
        } catch (error) {
            logger.error('Failed to serialize FAISS index:', error.message)
            return null
        }
    }

    /**
     * Deserialize FAISS index from buffer
     * @param {Buffer} buffer - Serialized index buffer
     * @returns {boolean} True if successful
     */
    deserializeIndex(buffer) {
        try {
            this.index = faiss.IndexFlatL2.fromBuffer(buffer)
            if (!this.index || this.index.getDimension() !== this.dimension) {
                throw new Error('Deserialized index dimension mismatch')
            }
            logger.info(`Deserialized FAISS index: ${this.index.ntotal()} vectors, dimension ${this.dimension}`)
            return true
        } catch (error) {
            logger.error('Failed to deserialize FAISS index:', error.message)
            this.initializeIndex() // Fallback to new index
            return false
        }
    }

    /**
     * Dispose of vector resources
     */
    dispose() {
        // Clear index and mappings
        this.index = null
        this.faissToMemoryMap = []
        this.memoryToFaissMap = []
        logger.info('Vectors module disposed')
    }
}

export default Vectors