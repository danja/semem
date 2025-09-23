/**
 * Service initialization for MCP server - unified interface to ServiceManager
 */
import serviceManager from '../../src/services/ServiceManager.js';
import { mcpDebugger } from './debug-utils.js';

/**
 * Non-blocking service check for Inspector compatibility
 */
export async function requireServices() {
  const services = await serviceManager.getServices();
  return {
    memoryManager: services.memoryManager,
    config: services.config
  };
}

/**
 * Fast initialization check for Inspector mode
 */
export async function initializeServicesQuick() {
  // Always use live services - no demo mode
  return await initializeServices();
}

/**
 * Initialize Semem services using unified ServiceManager
 */
export async function initializeServices() {
  try {
    mcpDebugger.info('🚀 [INIT] Starting Semem services initialization via ServiceManager...');

    // Use unified service manager for all initialization
    const services = await serviceManager.getServices();

    mcpDebugger.info('✅ [INIT] Semem services initialized successfully via unified ServiceManager');

    return {
      memoryManager: services.memoryManager,
      config: services.config
    };
  } catch (error) {
    mcpDebugger.error('❌ [INIT] Failed to initialize Semem services:', error);
    mcpDebugger.error('❌ [INIT] Error stack:', error.stack);
    throw error;
  }
}

/**
 * Get initialized memory manager
 */
export async function getMemoryManager() {
  const services = await serviceManager.getServices();
  return services.memoryManager;
}

/**
 * Get initialized config
 */
export async function getConfig() {
  const services = await serviceManager.getServices();
  return services.config;
}

/**
 * Create isolated service instances for session isolation
 * Uses ServiceManager but creates a new instance instead of using singleton
 */
export async function createIsolatedServices(configPath = null) {
  try {
    mcpDebugger.info('🚀 [ISOLATED] Creating isolated Semem services via ServiceManager...');

    // Create a new ServiceManager instance (not using singleton) for isolation
    const { default: ServiceManager } = await import('../../src/services/ServiceManager.js');
    const isolatedServiceManager = new ServiceManager();

    // Initialize with specific config path if provided
    const services = await isolatedServiceManager.initialize(configPath);

    mcpDebugger.info('🎉 [ISOLATED] Isolated Semem services created successfully via ServiceManager');
    return {
      memoryManager: services.memoryManager,
      config: services.config
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
  return serviceManager.initialized;
}