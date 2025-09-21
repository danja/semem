/**
 * Service initialization for MCP server
 */
import path from 'path';
import { fileURLToPath } from 'url';
import MemoryManager from '../../src/MemoryManager.js';
import Config from '../../src/Config.js';
import { createLLMConnector, createEmbeddingConnector, getModelConfig } from './config.js';
import { mcpDebugger } from './debug-utils.js';

// Global instances for reuse
let memoryManager = null;
let config = null;

/**
 * Non-blocking service check for Inspector compatibility
 */
export function requireServices() {
  if (!memoryManager || !config) {
    throw new Error('Services not initialized. Use initializeServices() first or run in full mode.');
  }
  return { memoryManager, config };
}

/**
 * Fast initialization check for Inspector mode
 */
export async function initializeServicesQuick() {
  // If already initialized, return immediately
  if (memoryManager && config) {
    mcpDebugger.debug('✅ Services already initialized, returning cached instances');
    return { memoryManager, config };
  }

  // For Inspector mode, provide demo mode instead of real initialization
  if (process.env.MCP_INSPECTOR_MODE === 'true') {
    mcpDebugger.debug('🔍 Inspector mode detected, providing demo services');
    throw new Error('Inspector demo mode: This tool requires full Semem initialization. Use the clean inspector server for testing.');
  }

  // For production mode, do full initialization
  return await initializeServices();
}

/**
 * Initialize Semem services
 */
export async function initializeServices() {
  if (memoryManager && config) {
    mcpDebugger.info('✅ Services already initialized, returning cached instances');
    return { memoryManager, config }; // Already initialized
  }

  try {
    mcpDebugger.info('🚀 [INIT] Starting Semem services initialization...');
    
    // Initialize config first
    mcpDebugger.info('📝 [CONFIG] Initializing config...');
    // Use project root instead of process.cwd() to handle different working directories
    const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
    const configPath = process.env.SEMEM_CONFIG_PATH || path.join(projectRoot, 'config', 'config.json');
    mcpDebugger.debug(`📝 [CONFIG] Environment SEMEM_CONFIG_PATH: ${process.env.SEMEM_CONFIG_PATH}`);
    mcpDebugger.debug(`📝 [CONFIG] Resolved config file path: ${configPath}`);
    
    mcpDebugger.info('📝 [CONFIG] Creating Config instance...');
    config = new Config(configPath);
    
    mcpDebugger.info('📝 [CONFIG] Calling config.init()...');
    try {
      await config.init();
      mcpDebugger.info('✅ [CONFIG] Config initialized successfully');
    } catch (configError) {
      mcpDebugger.error('❌ [CONFIG] Config initialization failed with detailed error:', configError);
      throw configError;
    }
    
    // Initialize memory manager
    mcpDebugger.info('🧠 [MEMORY] Starting memory manager initialization...');

    // Create separate LLM and embedding providers
    mcpDebugger.info('🤖 [LLM] Creating LLM connector...');
    const llmProvider = await createLLMConnector(configPath);
    mcpDebugger.info('✅ [LLM] LLM provider created for chat operations');

    mcpDebugger.info('🔢 [EMBED] Creating embedding connector...');
    const embeddingProvider = await createEmbeddingConnector(configPath);
    mcpDebugger.info('✅ [EMBED] Embedding provider created for embedding operations');

    // Get embedding dimension from the active embedding provider (needed for all storage types)
    mcpDebugger.info('💾 [STORAGE] Getting embedding dimension from provider...');
    const llmProviders = config.get('llmProviders') || [];
    const activeEmbeddingProvider = llmProviders
      .filter(p => p.capabilities?.includes('embedding'))
      .sort((a, b) => (a.priority || 999) - (b.priority || 999))[0];

    if (!activeEmbeddingProvider) {
      throw new Error('No embedding provider found in config - check config.json llmProviders section for providers with embedding capability');
    }

    const embeddingDimension = activeEmbeddingProvider.embeddingDimension;
    if (!embeddingDimension) {
      throw new Error(`Embedding provider ${activeEmbeddingProvider.type} missing embeddingDimension in config - check config.json embeddingDimension setting`);
    }
    mcpDebugger.info(`💾 [STORAGE] Using embedding dimension: ${embeddingDimension} from ${activeEmbeddingProvider.type} provider`);

    // Initialize MemoryManager with proper parameters
    // Create storage backend based on config
    mcpDebugger.info('💾 [STORAGE] Initializing storage backend...');
    let storageBackend = null;
    const storageType = config.get('storage.type');
    mcpDebugger.info(`💾 [STORAGE] Storage type: ${storageType}`);
    
    if (storageType === 'sparql') {
      mcpDebugger.info('💾 [STORAGE] Importing SPARQLStore...');
      const { default: SPARQLStore } = await import('../../src/stores/SPARQLStore.js');
      mcpDebugger.info('💾 [STORAGE] Getting storage options...');
      const storageOptions = config.get('storage.options');
      mcpDebugger.info('💾 [STORAGE] Storage options:', JSON.stringify(storageOptions, null, 2));
      
      // Ensure we use the consistent graph from config, not the SPARQLStore default
      const configuredGraphName = config.get('graphName') || 'http://tensegrity.it/semem';
      storageOptions.graphName = configuredGraphName;
      mcpDebugger.info('💾 [STORAGE] Using configured graphName:', storageOptions.graphName);

      // Set embedding dimension for SPARQLStore
      storageOptions.dimension = embeddingDimension;

      mcpDebugger.info('💾 [STORAGE] Creating SPARQLStore instance...');
      // SPARQLStore constructor expects (endpoint, options, config)
      const endpoint = {
        query: storageOptions.query,
        update: storageOptions.update,
        data: storageOptions.data
      };
      storageBackend = new SPARQLStore(endpoint, storageOptions, config);
      mcpDebugger.info('✅ [STORAGE] SPARQLStore created');
    } else if (storageType === 'json') {
      mcpDebugger.info('💾 [STORAGE] Importing JSONStore...');
      const { default: JSONStore } = await import('../../src/stores/JSONStore.js');
      mcpDebugger.info('💾 [STORAGE] Getting storage options...');
      const storageOptions = config.get('storage.options');
      mcpDebugger.info('💾 [STORAGE] Creating JSONStore instance...');
      storageBackend = new JSONStore(storageOptions.path);
      mcpDebugger.info('✅ [STORAGE] JSONStore created');
    } else {
      mcpDebugger.info('💾 [STORAGE] Using default InMemoryStore (no backend specified)');
    }
    
    // Get model configuration from config.json
    mcpDebugger.info('⚙️ [MODEL] Getting model configuration...');
    const modelConfig = await getModelConfig(configPath);
    mcpDebugger.info('⚙️ [MODEL] Using model configuration:', modelConfig);
    
    mcpDebugger.info('🧠 [MEMORY] Creating MemoryManager instance...');
    memoryManager = new MemoryManager({
      llmProvider,
      embeddingProvider,
      chatModel: modelConfig.chatModel,
      embeddingModel: modelConfig.embeddingModel,
      storage: storageBackend,
      dimension: embeddingDimension,
      config: config
    });
    mcpDebugger.info('✅ [MEMORY] MemoryManager instance created');
    
    mcpDebugger.info('🧠 [MEMORY] Calling memoryManager.initialize()...');
    await memoryManager.initialize();
    mcpDebugger.info('✅ [MEMORY] Memory manager initialized successfully');
    
    mcpDebugger.info('🎉 [INIT] Semem services initialized successfully');
    return { memoryManager, config };
  } catch (error) {
    mcpDebugger.error('❌ [INIT] Failed to initialize Semem services:', error);
    mcpDebugger.error('❌ [INIT] Error stack:', error.stack);
    throw error;
  }
}

/**
 * Get initialized memory manager
 */
export function getMemoryManager() {
  return memoryManager;
}

/**
 * Get initialized config
 */
export function getConfig() {
  return config;
}

/**
 * Create isolated service instances for session isolation
 * Does not use global caching to allow multiple concurrent sessions
 */
export async function createIsolatedServices() {
  try {
    mcpDebugger.info('🚀 [ISOLATED] Creating isolated Semem services...');
    
    // Initialize config first
    mcpDebugger.info('📝 [ISOLATED-CONFIG] Initializing config...');
    // Use project root instead of process.cwd() to handle different working directories
    const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
    const configPath = process.env.SEMEM_CONFIG_PATH || path.join(projectRoot, 'config', 'config.json');
    mcpDebugger.info(`📝 [ISOLATED-CONFIG] Config file path: ${configPath}`);
    
    const isolatedConfig = new Config(configPath);
    await isolatedConfig.init();
    mcpDebugger.info('✅ [ISOLATED-CONFIG] Config initialized successfully');
    
    // Create separate LLM and embedding providers
    mcpDebugger.info('🤖 [ISOLATED-LLM] Creating LLM connector...');
    const llmProvider = await createLLMConnector(configPath);
    mcpDebugger.info('✅ [ISOLATED-LLM] LLM provider created');
    
    mcpDebugger.info('🔢 [ISOLATED-EMBED] Creating embedding connector...');
    const embeddingProvider = await createEmbeddingConnector(configPath);
    mcpDebugger.info('✅ [ISOLATED-EMBED] Embedding provider created');
    
    // Initialize storage backend
    mcpDebugger.info('💾 [ISOLATED-STORAGE] Initializing storage backend...');
    let storageBackend = null;
    const storageType = isolatedConfig.get('storage.type');
    mcpDebugger.info(`💾 [ISOLATED-STORAGE] Storage type: ${storageType}`);
    
    if (storageType === 'sparql') {
      const { default: SPARQLStore } = await import('../../src/stores/SPARQLStore.js');
      const storageOptions = isolatedConfig.get('storage.options');
      storageBackend = new SPARQLStore(storageOptions);
      mcpDebugger.info('✅ [ISOLATED-STORAGE] SPARQLStore created');
    } else if (storageType === 'json') {
      const { default: JSONStore } = await import('../../src/stores/JSONStore.js');
      const storageOptions = isolatedConfig.get('storage.options');
      storageBackend = new JSONStore(storageOptions.path);
      mcpDebugger.info('✅ [ISOLATED-STORAGE] JSONStore created');
    } else {
      mcpDebugger.info('💾 [ISOLATED-STORAGE] Using default InMemoryStore');
    }
    
    // Get model configuration
    mcpDebugger.info('⚙️ [ISOLATED-MODEL] Getting model configuration...');
    const modelConfig = await getModelConfig(configPath);
    mcpDebugger.info('⚙️ [ISOLATED-MODEL] Using model configuration:', modelConfig);
    
    // Create isolated MemoryManager
    mcpDebugger.info('🧠 [ISOLATED-MEMORY] Creating MemoryManager instance...');
    const isolatedMemoryManager = new MemoryManager({
      llmProvider,
      embeddingProvider,
      chatModel: modelConfig.chatModel,
      embeddingModel: modelConfig.embeddingModel,
      storage: storageBackend
    });
    mcpDebugger.info('✅ [ISOLATED-MEMORY] MemoryManager instance created');
    
    mcpDebugger.info('🧠 [ISOLATED-MEMORY] Initializing memory manager...');
    await isolatedMemoryManager.initialize();
    mcpDebugger.info('✅ [ISOLATED-MEMORY] Memory manager initialized successfully');
    
    mcpDebugger.info('🎉 [ISOLATED] Isolated Semem services created successfully');
    return { 
      memoryManager: isolatedMemoryManager, 
      config: isolatedConfig 
    };
  } catch (error) {
    mcpDebugger.error('❌ [ISOLATED] Failed to create isolated Semem services:', error);
    mcpDebugger.error('❌ [ISOLATED] Error stack:', error.stack);
    throw error;
  }
}

/**
 * Check if services are initialized
 */
export function isInitialized() {
  return !!(memoryManager && config);
}