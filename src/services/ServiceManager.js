/**
 * Unified Service Manager
 * Provides shared services for both HTTP API and STDIO MCP to eliminate duplication
 */
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import log from 'loglevel';
import MemoryManager from '../MemoryManager.js';
import { Embeddings } from '../core/Embeddings.js';
import EmbeddingsAPIBridge from '../services/embeddings/EmbeddingsAPIBridge.js';
import LLMHandler from '../handlers/LLMHandler.js';
import Config from '../Config.js';
import { createLLMConnector, createEmbeddingConnector, getModelConfig } from '../mcp/lib/config.js';

const logger = log.getLogger('ServiceManager');

class ServiceManager {
    constructor() {
        this.initialized = false;
        this.services = {};
    }

    async initialize(configPath = null) {
        if (this.initialized) {
            logger.debug('🔄 [ServiceManager] Returning existing services (already initialized)');
            return this.services;
        }

        logger.debug('🔧 [ServiceManager] Initializing services for the first time...');

        // Initialize configuration
        const __filename = fileURLToPath(import.meta.url);
        const projectRoot = path.resolve(path.dirname(__filename), '../..');
        const defaultConfigPath = path.join(projectRoot, 'config/config.json');

        logger.debug('🔧 [ServiceManager] ProjectRoot:', projectRoot);
        logger.debug('🔧 [ServiceManager] DefaultConfigPath:', defaultConfigPath);
        logger.debug('🔧 [ServiceManager] ConfigPath exists:', fs.existsSync(defaultConfigPath));

        const config = new Config(configPath || defaultConfigPath);
        await config.init();

        // Create LLM and embedding providers using initialized config instance
        const llmProvider = await createLLMConnector(config);
        const embeddingProvider = await createEmbeddingConnector(config);
        const modelConfig = await getModelConfig(config);

        // Get embedding dimension and LLM provider config
        const llmProviders = config.get('llmProviders') || [];
        const activeEmbeddingProvider = llmProviders
            .filter(p => p.capabilities?.includes('embedding'))
            .sort((a, b) => (a.priority || 999) - (b.priority || 999))[0];

        const activeLLMProvider = llmProviders
            .filter(p => p.capabilities?.includes('chat'))
            .sort((a, b) => (a.priority || 999) - (b.priority || 999))[0];

        const embeddingDimension = activeEmbeddingProvider?.embeddingDimension;
        if (!embeddingDimension) {
            throw new Error(`Embedding dimension not configured in provider: ${activeEmbeddingProvider?.type}`);
        }

        // Initialize storage backend
        let storage = null;
        const storageType = config.get('storage.type');

        if (storageType === 'sparql') {
            const { default: SPARQLStore } = await import('../stores/SPARQLStore.js');
            const storageOptions = config.get('storage.options');
            const configuredGraphName = config.get('graphName');

            logger.debug('🔧 ServiceManager storageOptions:', JSON.stringify(storageOptions, null, 2));

            if (!configuredGraphName) {
                throw new Error('graphName not found in config - check config.json graphName setting');
            }

            storageOptions.graphName = configuredGraphName;
            storageOptions.dimension = embeddingDimension;

            const endpoint = {
                query: storageOptions.query,
                update: storageOptions.update,
                data: storageOptions.data
            };

            logger.debug('🔧 ServiceManager endpoint object:', JSON.stringify(endpoint, null, 2));

            storage = new SPARQLStore(endpoint, storageOptions, config);
        } else {
            throw new Error(`Unsupported storage type: ${storageType}`);
        }

        // Create embedding handler using modern core architecture
        // Note: For ServiceManager, we'll create a simple wrapper that provides the expected interface
        const embeddings = new Embeddings(config);
        const embeddingsAPIBridge = new EmbeddingsAPIBridge(config);

        // Create a compatibility wrapper that matches the old EmbeddingHandler interface
        const embeddingHandler = {
            generateEmbedding: async (text) => {
                return await embeddingsAPIBridge.generateEmbedding(text, {
                    model: modelConfig.embeddingModel
                });
            },
            validateEmbedding: (embedding) => {
                return embeddings.validateEmbedding(embedding, embeddingDimension);
            },
            standardizeEmbedding: (embedding) => {
                return embeddings.standardizeEmbedding(embedding, embeddingDimension);
            },
            dimension: embeddingDimension,
            model: modelConfig.embeddingModel
        };
        const llmHandler = new LLMHandler(llmProvider, modelConfig.chatModel, 0.7, {
            rateLimitDelayMs: activeLLMProvider?.rateLimit?.delayMs || 100
        });

        // Initialize MemoryManager with unified configuration
        const memoryManager = new MemoryManager({
            llmProvider,
            embeddingProvider,
            chatModel: modelConfig.chatModel,
            embeddingModel: modelConfig.embeddingModel,
            storage,
            dimension: embeddingDimension,
            config
        });

        await memoryManager.initialize();

        // Store all services
        this.services = {
            config,
            memoryManager,
            storage,
            embeddingHandler,
            llmHandler,
            llmProvider,
            embeddingProvider,
            dimension: embeddingDimension,
            modelConfig
        };

        this.initialized = true;
        return this.services;
    }

    async getServices(configPath = null) {
        if (!this.initialized) {
            await this.initialize(configPath);
        }
        return this.services;
    }

    async getMemoryManager() {
        const services = await this.getServices();
        return services.memoryManager;
    }

    async getStorage() {
        const services = await this.getServices();
        return services.storage;
    }

    async getConfig() {
        const services = await this.getServices();
        return services.config;
    }
}

// Singleton instance
const serviceManager = new ServiceManager();
export default serviceManager;