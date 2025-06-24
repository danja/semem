/**
 * Service initialization for MCP server
 */
import path from 'path';
import MemoryManager from '../../src/MemoryManager.js';
import Config from '../../src/Config.js';
import { createLLMConnector, createEmbeddingConnector, getModelConfig } from './config.js';

// Global instances for reuse
let memoryManager = null;
let config = null;

/**
 * Initialize Semem services
 */
export async function initializeServices() {
  if (memoryManager && config) {
    console.log('✅ Services already initialized, returning cached instances');
    return { memoryManager, config }; // Already initialized
  }

  try {
    console.log('🚀 [INIT] Starting Semem services initialization...');
    
    // Initialize config first
    console.log('📝 [CONFIG] Initializing config...');
    const configPath = process.env.SEMEM_CONFIG_PATH || path.join(process.cwd(), 'config', 'config.json');
    console.log(`📝 [CONFIG] Environment SEMEM_CONFIG_PATH: ${process.env.SEMEM_CONFIG_PATH}`);
    console.log(`📝 [CONFIG] Resolved config file path: ${configPath}`);
    
    console.log('📝 [CONFIG] Creating Config instance...');
    config = new Config(configPath);
    
    console.log('📝 [CONFIG] Calling config.init()...');
    try {
      await config.init();
      console.log('✅ [CONFIG] Config initialized successfully');
    } catch (configError) {
      console.error('❌ [CONFIG] Config initialization failed with detailed error:', configError);
      throw configError;
    }
    
    // Initialize memory manager
    console.log('🧠 [MEMORY] Starting memory manager initialization...');
    
    // Create separate LLM and embedding providers
    console.log('🤖 [LLM] Creating LLM connector...');
    const llmProvider = await createLLMConnector(configPath);
    console.log('✅ [LLM] LLM provider created for chat operations');
    
    console.log('🔢 [EMBED] Creating embedding connector...');
    const embeddingProvider = await createEmbeddingConnector(configPath);
    console.log('✅ [EMBED] Embedding provider created for embedding operations');
    
    // Initialize MemoryManager with proper parameters
    // Create storage backend based on config
    console.log('💾 [STORAGE] Initializing storage backend...');
    let storageBackend = null;
    const storageType = config.get('storage.type');
    console.log(`💾 [STORAGE] Storage type: ${storageType}`);
    
    if (storageType === 'sparql') {
      console.log('💾 [STORAGE] Importing SPARQLStore...');
      const { default: SPARQLStore } = await import('../../src/stores/SPARQLStore.js');
      console.log('💾 [STORAGE] Getting storage options...');
      const storageOptions = config.get('storage.options');
      console.log('💾 [STORAGE] Creating SPARQLStore instance...');
      storageBackend = new SPARQLStore(storageOptions);
      console.log('✅ [STORAGE] SPARQLStore created');
    } else if (storageType === 'json') {
      console.log('💾 [STORAGE] Importing JSONStore...');
      const { default: JSONStore } = await import('../../src/stores/JSONStore.js');
      console.log('💾 [STORAGE] Getting storage options...');
      const storageOptions = config.get('storage.options');
      console.log('💾 [STORAGE] Creating JSONStore instance...');
      storageBackend = new JSONStore(storageOptions.path);
      console.log('✅ [STORAGE] JSONStore created');
    } else {
      console.log('💾 [STORAGE] Using default InMemoryStore (no backend specified)');
    }
    
    // Get model configuration from config.json
    console.log('⚙️ [MODEL] Getting model configuration...');
    const modelConfig = await getModelConfig(configPath);
    console.log('⚙️ [MODEL] Using model configuration:', modelConfig);
    
    console.log('🧠 [MEMORY] Creating MemoryManager instance...');
    memoryManager = new MemoryManager({
      llmProvider,
      embeddingProvider,
      chatModel: modelConfig.chatModel,
      embeddingModel: modelConfig.embeddingModel,
      storage: storageBackend
    });
    console.log('✅ [MEMORY] MemoryManager instance created');
    
    console.log('🧠 [MEMORY] Calling memoryManager.initialize()...');
    await memoryManager.initialize();
    console.log('✅ [MEMORY] Memory manager initialized successfully');
    
    console.log('🎉 [INIT] Semem services initialized successfully');
    return { memoryManager, config };
  } catch (error) {
    console.error('❌ [INIT] Failed to initialize Semem services:', error);
    console.error('❌ [INIT] Error stack:', error.stack);
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
    console.log('🚀 [ISOLATED] Creating isolated Semem services...');
    
    // Initialize config first
    console.log('📝 [ISOLATED-CONFIG] Initializing config...');
    const configPath = process.env.SEMEM_CONFIG_PATH || path.join(process.cwd(), 'config', 'config.json');
    console.log(`📝 [ISOLATED-CONFIG] Config file path: ${configPath}`);
    
    const isolatedConfig = new Config(configPath);
    await isolatedConfig.init();
    console.log('✅ [ISOLATED-CONFIG] Config initialized successfully');
    
    // Create separate LLM and embedding providers
    console.log('🤖 [ISOLATED-LLM] Creating LLM connector...');
    const llmProvider = await createLLMConnector(configPath);
    console.log('✅ [ISOLATED-LLM] LLM provider created');
    
    console.log('🔢 [ISOLATED-EMBED] Creating embedding connector...');
    const embeddingProvider = await createEmbeddingConnector(configPath);
    console.log('✅ [ISOLATED-EMBED] Embedding provider created');
    
    // Initialize storage backend
    console.log('💾 [ISOLATED-STORAGE] Initializing storage backend...');
    let storageBackend = null;
    const storageType = isolatedConfig.get('storage.type');
    console.log(`💾 [ISOLATED-STORAGE] Storage type: ${storageType}`);
    
    if (storageType === 'sparql') {
      const { default: SPARQLStore } = await import('../../src/stores/SPARQLStore.js');
      const storageOptions = isolatedConfig.get('storage.options');
      storageBackend = new SPARQLStore(storageOptions);
      console.log('✅ [ISOLATED-STORAGE] SPARQLStore created');
    } else if (storageType === 'json') {
      const { default: JSONStore } = await import('../../src/stores/JSONStore.js');
      const storageOptions = isolatedConfig.get('storage.options');
      storageBackend = new JSONStore(storageOptions.path);
      console.log('✅ [ISOLATED-STORAGE] JSONStore created');
    } else {
      console.log('💾 [ISOLATED-STORAGE] Using default InMemoryStore');
    }
    
    // Get model configuration
    console.log('⚙️ [ISOLATED-MODEL] Getting model configuration...');
    const modelConfig = await getModelConfig(configPath);
    console.log('⚙️ [ISOLATED-MODEL] Using model configuration:', modelConfig);
    
    // Create isolated MemoryManager
    console.log('🧠 [ISOLATED-MEMORY] Creating MemoryManager instance...');
    const isolatedMemoryManager = new MemoryManager({
      llmProvider,
      embeddingProvider,
      chatModel: modelConfig.chatModel,
      embeddingModel: modelConfig.embeddingModel,
      storage: storageBackend
    });
    console.log('✅ [ISOLATED-MEMORY] MemoryManager instance created');
    
    console.log('🧠 [ISOLATED-MEMORY] Initializing memory manager...');
    await isolatedMemoryManager.initialize();
    console.log('✅ [ISOLATED-MEMORY] Memory manager initialized successfully');
    
    console.log('🎉 [ISOLATED] Isolated Semem services created successfully');
    return { 
      memoryManager: isolatedMemoryManager, 
      config: isolatedConfig 
    };
  } catch (error) {
    console.error('❌ [ISOLATED] Failed to create isolated Semem services:', error);
    console.error('❌ [ISOLATED] Error stack:', error.stack);
    throw error;
  }
}

/**
 * Check if services are initialized
 */
export function isInitialized() {
  return !!(memoryManager && config);
}