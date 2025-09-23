/**
 * Unified Service Manager
 * Provides shared services for both HTTP API and STDIO MCP to eliminate duplication
 */
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import MemoryManager from '../MemoryManager.js';
import EmbeddingHandler from '../handlers/EmbeddingHandler.js';
import LLMHandler from '../handlers/LLMHandler.js';
import Config from '../Config.js';
import { createLLMConnector, createEmbeddingConnector, getModelConfig } from '../../mcp/lib/config.js';

class ServiceManager {
    constructor() {
        this.initialized = false;
        this.services = {};
    }

    async initialize(configPath = null) {
        if (this.initialized) {
            return this.services;
        }

        // Initialize configuration
        const __filename = fileURLToPath(import.meta.url);
        const projectRoot = path.resolve(path.dirname(__filename), '../..');
        const defaultConfigPath = path.join(projectRoot, 'config/config.json');

        console.log('🔧 [ServiceManager] ProjectRoot:', projectRoot);
        console.log('🔧 [ServiceManager] DefaultConfigPath:', defaultConfigPath);
        console.log('🔧 [ServiceManager] ConfigPath exists:', fs.existsSync(defaultConfigPath));

        const config = new Config(configPath || defaultConfigPath);
        await config.init();

        // Create LLM and embedding providers using initialized config instance
        const llmProvider = await createLLMConnector(config);
        const embeddingProvider = await createEmbeddingConnector(config);
        const modelConfig = await getModelConfig(config);

        // Get embedding dimension
        const llmProviders = config.get('llmProviders') || [];
        const activeEmbeddingProvider = llmProviders
            .filter(p => p.capabilities?.includes('embedding'))
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

            console.log('🔧 ServiceManager storageOptions:', JSON.stringify(storageOptions, null, 2));

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

            console.log('🔧 ServiceManager endpoint object:', JSON.stringify(endpoint, null, 2));

            storage = new SPARQLStore(endpoint, storageOptions, config);
        } else {
            throw new Error(`Unsupported storage type: ${storageType}`);
        }

        // Create handlers
        const embeddingHandler = new EmbeddingHandler(embeddingProvider, modelConfig.embeddingModel, embeddingDimension);
        const llmHandler = new LLMHandler(llmProvider, modelConfig.chatModel);

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