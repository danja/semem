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
    return { memoryManager, config }; // Already initialized
  }

  try {
    console.log('Initializing Semem services...');
    
    // Initialize config first
    console.log('Initializing config...');
    const configPath = process.env.SEMEM_CONFIG_PATH || path.join(process.cwd(), 'config', 'config.json');
    console.log(`Environment SEMEM_CONFIG_PATH: ${process.env.SEMEM_CONFIG_PATH}`);
    console.log(`Resolved config file path: ${configPath}`);
    config = new Config(configPath);
    try {
      await config.init();
      console.log('Config initialized successfully');
    } catch (configError) {
      console.error('Config initialization failed with detailed error:', configError);
      throw configError;
    }
    
    // Initialize memory manager
    console.log('Initializing memory manager...');
    
    // Create separate LLM and embedding providers
    const llmProvider = await createLLMConnector(configPath);
    const embeddingProvider = await createEmbeddingConnector(configPath);
    
    console.log('LLM provider created for chat operations');
    console.log('Embedding provider created for embedding operations');
    
    // Initialize MemoryManager with proper parameters
    // Create storage backend based on config
    let storageBackend = null;
    const storageType = config.get('storage.type');
    console.log(`Creating ${storageType} storage backend...`);
    
    if (storageType === 'sparql') {
      const { default: SPARQLStore } = await import('../../src/stores/SPARQLStore.js');
      const storageOptions = config.get('storage.options');
      storageBackend = new SPARQLStore(storageOptions);
    } else if (storageType === 'json') {
      const { default: JSONStore } = await import('../../src/stores/JSONStore.js');
      const storageOptions = config.get('storage.options');
      storageBackend = new JSONStore(storageOptions.path);
    }
    // If storageType is 'memory' or null, storageBackend remains null (default InMemoryStore)
    
    // Get model configuration from config.json
    const modelConfig = await getModelConfig(configPath);
    console.log('Using model configuration:', modelConfig);
    
    memoryManager = new MemoryManager({
      llmProvider,
      embeddingProvider,
      chatModel: modelConfig.chatModel,
      embeddingModel: modelConfig.embeddingModel,
      storage: storageBackend
    });
    
    await memoryManager.initialize();
    console.log('Memory manager initialized successfully');
    
    console.log('Semem services initialized successfully');
    return { memoryManager, config };
  } catch (error) {
    console.error('Failed to initialize Semem services:', error);
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
 * Check if services are initialized
 */
export function isInitialized() {
  return !!(memoryManager && config);
}