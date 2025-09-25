import { createUnifiedLogger } from '../../utils/LoggingConfig.js';
import { Embeddings, EmbeddingError } from '../../core/Embeddings.js';
import EmbeddingsAPIBridge from './EmbeddingsAPIBridge.js';
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
        // Fetch embedding dimension from configuration
        this.dimension = this.config.get('embeddingDimension') || this.coreEmbeddings.getDimension(this.model);

        if (!this.dimension) {
            throw new EmbeddingError('Embedding dimension is required - check config.json embeddingDimension setting', {
                type: 'CONFIGURATION_ERROR'
            });
        }
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
    async generateEmbedding(text, options = {}) {
        if (!text || typeof text !== 'string') {
            throw new EmbeddingError('Invalid input text', { type: 'VALIDATION_ERROR' });
        }

        try {
            logger.debug(`Generating embedding for text (${text.length} characters)...`);
            logger.debug(`Using ${this.legacyMode ? 'legacy' : 'modern'} mode with model ${this.model}`);

            // Delegate embedding generation to Embeddings.js
            const embeddings = new Embeddings(this.config, this.options);
            return await embeddings.generateEmbedding(text, { ...this.options, ...options });
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
}

export default EmbeddingService;