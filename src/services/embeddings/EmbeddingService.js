import logger from 'loglevel';
import EmbeddingConnectorFactory from '../../connectors/EmbeddingConnectorFactory.js';

// Default Ollama embedding model
const DEFAULT_MODEL = 'nomic-embed-text';
// Embedding dimension should come from config - no hardcoded defaults

/**
 * Service for generating and managing embeddings
 */
class EmbeddingService {
    /**
     * Creates a new EmbeddingService
     * @param {Object} options - Configuration options
     * @param {string} options.provider - The embedding provider to use ('ollama', 'nomic')
     * @param {string} options.model - The embedding model to use
     * @param {number} options.dimension - The expected embedding dimension
     * @param {Object} options.providerOptions - Provider-specific options
     */
    constructor(options = {}) {
        this.provider = options.provider || 'ollama';
        this.model = options.model || DEFAULT_MODEL;
        this.dimension = options.dimension;
        if (!this.dimension) {
            throw new Error('Embedding dimension is required - check config.json embeddingDimension setting');
        }
        
        // Create embedding connector using factory
        this.connector = EmbeddingConnectorFactory.createConnector({
            provider: this.provider,
            model: this.model,
            options: options.providerOptions || {}
        });
        
        logger.info(`EmbeddingService initialized with provider: ${this.provider}, model: ${this.model}, dimension: ${this.dimension}`);
    }
    
    /**
     * Generate an embedding for text
     * @param {string} text - The text to embed
     * @returns {Promise<number[]>} The embedding vector
     */
    async generateEmbedding(text) {
        if (!text || typeof text !== 'string') {
            throw new Error('Invalid input text');
        }
        
        try {
            logger.debug(`Generating embedding for text (${text.length} characters)...`);
            logger.debug(`Generating embedding with model ${this.model}`);
            
            const rawEmbedding = await this.connector.generateEmbedding(this.model, text);
            logger.debug(`Generated raw embedding with ${rawEmbedding.length} dimensions`);
            
            // Standardize the embedding to match expected dimensions
            const embedding = this.standardizeEmbedding(rawEmbedding);
            logger.debug(`Standardized embedding to ${embedding.length} dimensions`);
            
            // Validate the standardized embedding
            this.validateEmbedding(embedding);
            
            return embedding;
        } catch (error) {
            logger.error('Error generating embedding:', error);
            throw error;
        }
    }
    
    /**
     * Validate an embedding vector
     * @param {number[]} embedding - The embedding vector to validate
     * @returns {boolean} True if valid
     * @throws {Error} If the embedding is invalid
     */
    validateEmbedding(embedding) {
        if (!Array.isArray(embedding)) {
            throw new Error('Embedding must be an array');
        }
        
        if (embedding.length !== this.dimension) {
            throw new Error(`Embedding dimension mismatch: expected ${this.dimension}, got ${embedding.length}`);
        }
        
        if (!embedding.every(x => typeof x === 'number' && !isNaN(x))) {
            throw new Error('Embedding must contain only valid numbers');
        }
        
        return true;
    }
    
    /**
     * Standardize an embedding to match the expected dimension
     * @param {number[]} embedding - The embedding to standardize
     * @returns {number[]} The standardized embedding
     */
    standardizeEmbedding(embedding) {
        if (!Array.isArray(embedding)) {
            throw new Error('Embedding must be an array');
        }
        
        const current = embedding.length;
        
        if (current === this.dimension) {
            return embedding;
        }
        
        if (current < this.dimension) {
            // Pad with zeros if embedding is too short
            return [...embedding, ...new Array(this.dimension - current).fill(0)];
        }
        
        // Truncate if embedding is too long
        return embedding.slice(0, this.dimension);
    }
}

export default EmbeddingService;