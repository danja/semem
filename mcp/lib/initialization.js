/**
 * Service initialization for MCP server
 */
import path from 'path';
import MemoryManager from '../../src/MemoryManager.js';
import Config from '../../src/Config.js';
import { createLLMConnector, modelConfig } from './config.js';

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
    config = new Config(path.join(process.cwd(), 'config', 'config.json'));
    await config.init();
    console.log('Config initialized successfully');
    
    // Initialize memory manager
    console.log('Initializing memory manager...');
    
    // Create LLM provider
    const llmProvider = createLLMConnector();
    
    // Initialize MemoryManager with proper parameters
    memoryManager = new MemoryManager({
      llmProvider,
      chatModel: modelConfig.chatModel,
      embeddingModel: modelConfig.embeddingModel,
      storage: null // Will use default in-memory storage
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