import { createUnifiedLogger } from '../../utils/LoggingConfig.js';
import { VectorOperations } from '../../core/Vectors.js';
import { Embeddings, EmbeddingError } from '../../core/Embeddings.js';
import EmbeddingsAPIBridge from './EmbeddingsAPIBridge.js';
import EmbeddingConnectorFactory from '../../connectors/EmbeddingConnectorFactory.js';
import { EMBEDDING_CONFIG } from '../../../config/preferences.js';

// Use unified STDIO-aware logger
const logger = createUnifiedLogger('embedding-service');

/**
 * Service for generating and managing embeddings
 * Now uses the unified core architecture with EmbeddingsAPIBridge
 */
class EmbeddingService {
    /**
     * Creates a new EmbeddingService
     * @param {Object} config - Config instance (required for new architecture)
     * @param {Object} options - Additional options
     * @param {string} options.provider - Preferred embedding provider
     * @param {string} options.model - Preferred embedding model
     * @param {number} options.dimension - Expected embedding dimension (optional, auto-detected)
     */
    constructor(config, options = {}) {
        // Support legacy constructor signature for backward compatibility
        if (!config || typeof config.get !== 'function') {
            logger.warn('EmbeddingService: Config instance not provided, falling back to legacy mode');
            return this._legacyConstructor(config, options);
        }

        this.config = config;
        this.options = {
            ...EMBEDDING_CONFIG,
            ...options
        };

        // Initialize core modules
        this.coreEmbeddings = new Embeddings(config, options);
        this.apiBridge = new EmbeddingsAPIBridge(config, options);

        // Get configuration from core module
        this.model = options.model || this._getDefaultModel();
        this.dimension = options.dimension || this.coreEmbeddings.getDimension(this.model);
        this.provider = options.provider || this._getPreferredProvider();

        // For backward compatibility
        this.connector = null; // No longer used in modern mode
        this.legacyMode = false;

        logger.info(`EmbeddingService initialized with provider: ${this.provider}, model: ${this.model}, dimension: ${this.dimension}`);
    }

    /**
     * Legacy constructor for backward compatibility
     * @param {Object} legacyOptions - Legacy options object
     * @param {Object} additionalOptions - Additional options
     * @private
     */
    _legacyConstructor(legacyOptions = {}, additionalOptions = {}) {
        const options = { ...legacyOptions, ...additionalOptions };

        this.provider = options.provider || EMBEDDING_CONFIG.PROVIDERS.FALLBACK_PROVIDER;
        this.model = options.model || 'nomic-embed-text';
        this.dimension = options.dimension;

        if (!this.dimension) {
            throw new EmbeddingError('Embedding dimension is required - check config.json embeddingDimension setting', {
                type: 'CONFIGURATION_ERROR'
            });
        }

        // Legacy mode: create connector directly
        this.connector = EmbeddingConnectorFactory.createConnector({
            provider: this.provider,
            model: this.model,
            options: options.providerOptions || {}
        });

        this.coreEmbeddings = null;
        this.apiBridge = null;
        this.legacyMode = true;

        logger.warn(`EmbeddingService initialized in legacy mode with provider: ${this.provider}, model: ${this.model}, dimension: ${this.dimension}`);
    }

    /**
     * Get default model from configuration
     * @returns {string} - Default model name
     * @private
     */
    _getDefaultModel() {
        try {
            const providers = this.config.get('llmProviders') || [];
            const embeddingProvider = providers.find(p =>
                p.capabilities && p.capabilities.includes('embedding')
            );
            return embeddingProvider?.embeddingModel || 'nomic-embed-text';
        } catch (error) {
            logger.warn('Could not get default model from config, using fallback');
            return 'nomic-embed-text';
        }
    }

    /**
     * Get preferred provider from configuration
     * @returns {string} - Preferred provider name
     * @private
     */
    _getPreferredProvider() {
        try {
            const providers = this.config.get('llmProviders') || [];
            const embeddingProviders = providers
                .filter(p => p.capabilities && p.capabilities.includes('embedding'))
                .sort((a, b) => (a.priority || 999) - (b.priority || 999));

            return embeddingProviders[0]?.type || EMBEDDING_CONFIG.PROVIDERS.FALLBACK_PROVIDER;
        } catch (error) {
            logger.warn('Could not get preferred provider from config, using fallback');
            return EMBEDDING_CONFIG.PROVIDERS.FALLBACK_PROVIDER;
        }
    }
    
    /**
     * Generate an embedding for text
     * @param {string} text - The text to embed
     * @returns {Promise<number[]>} The embedding vector
     */
    async generateEmbedding(text) {
        if (!text || typeof text !== 'string') {
            throw new EmbeddingError('Invalid input text', { type: 'VALIDATION_ERROR' });
        }

        try {
            logger.debug(`Generating embedding for text (${text.length} characters)...`);
            logger.debug(`Using ${this.legacyMode ? 'legacy' : 'modern'} mode with model ${this.model}`);

            let embedding;

            if (this.legacyMode) {
                // Legacy mode: use connector directly
                const rawEmbedding = await this.connector.generateEmbedding(this.model, text);
                logger.debug(`Generated raw embedding with ${rawEmbedding.length} dimensions`);

                // Standardize and validate using VectorOperations directly
                embedding = this.standardizeEmbedding(rawEmbedding);
                logger.debug(`Standardized embedding to ${embedding.length} dimensions`);
                this.validateEmbedding(embedding);

            } else {
                // Modern mode: use API bridge
                embedding = await this.apiBridge.generateEmbedding(text, {
                    model: this.model,
                    provider: this.provider
                });
                // API bridge already handles validation and standardization
                logger.debug(`Generated and validated embedding with ${embedding.length} dimensions`);
            }

            return embedding;
        } catch (error) {
            logger.error('Error generating embedding:', error);

            // Convert generic errors to EmbeddingError if needed
            if (!(error instanceof EmbeddingError)) {
                throw new EmbeddingError(`Embedding generation failed: ${error.message}`, {
                    cause: error,
                    type: 'GENERATION_ERROR'
                });
            }
            throw error;
        }
    }
    
    /**
     * Validate an embedding vector
     * @param {number[]} embedding - The embedding vector to validate
     * @returns {boolean} True if valid
     * @throws {EmbeddingError} If the embedding is invalid
     */
    validateEmbedding(embedding) {
        if (this.legacyMode) {
            // Legacy mode: use VectorOperations directly
            try {
                return VectorOperations.validateEmbedding(embedding, this.dimension);
            } catch (error) {
                throw new EmbeddingError(error.message, {
                    cause: error,
                    type: 'VALIDATION_ERROR'
                });
            }
        } else {
            // Modern mode: use core Embeddings module
            return this.coreEmbeddings.validateEmbedding(embedding, this.dimension);
        }
    }

    /**
     * Standardize an embedding to match the expected dimension
     * @param {number[]} embedding - The embedding to standardize
     * @returns {number[]} The standardized embedding
     */
    standardizeEmbedding(embedding) {
        if (this.legacyMode) {
            // Legacy mode: use VectorOperations directly
            try {
                return VectorOperations.standardizeEmbedding(embedding, this.dimension);
            } catch (error) {
                throw new EmbeddingError(error.message, {
                    cause: error,
                    type: 'STANDARDIZATION_ERROR'
                });
            }
        } else {
            // Modern mode: use core Embeddings module
            return this.coreEmbeddings.standardizeEmbedding(embedding, this.dimension);
        }
    }
}

export default EmbeddingService;