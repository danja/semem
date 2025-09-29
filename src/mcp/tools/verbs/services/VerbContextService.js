/**
 * VerbContextService - Manages shared context and services for verb commands
 *
 * Centralizes initialization and dependency injection for all verb commands.
 * Replaces the scattered initialization logic in the original SimpleVerbsService.
 */

import { SafeOperations } from '../../../lib/safe-operations.js';
import { ZPTNavigationService } from '../../modules/zpt-tools.js';
import { EnhancementCoordinator } from '../../../../services/enhancement/EnhancementCoordinator.js';
import { MemoryDomainManager } from '../../../../services/memory/MemoryDomainManager.js';
import { MemoryRelevanceEngine } from '../../../../services/memory/MemoryRelevanceEngine.js';
import { ZPTStateManager } from '../../ZptStateManager.js';
import { SimpleTemplateLoader } from '../../../lib/SimpleTemplateLoader.js';
import { verbsLogger } from '../../VerbsLogger.js';

export class VerbContextService {
  constructor() {
    this.initialized = false;
    this.context = null;
  }

  /**
   * Initialize and prepare shared context for verb commands
   * @returns {Promise<Object>} Shared context object
   */
  async prepareContext() {
    if (this.initialized && this.context) {
      return this.context;
    }

    verbsLogger.info('🔥 VerbContextService.prepareContext() - Initializing shared services');

    try {
      // Use unified ServiceManager for consistent initialization
      const serviceManager = (await import('../../../../services/ServiceManager.js')).default;
      const services = await serviceManager.getServices();

      // Create shared service instances
      const memoryManager = services.memoryManager;
      const safeOps = new SafeOperations(memoryManager);
      const stateManager = new ZPTStateManager(memoryManager);
      const templateLoader = new SimpleTemplateLoader();

      // Initialize ZPT navigation service
      const zptService = new ZPTNavigationService(memoryManager, safeOps);

      // Initialize enhancement coordinator with shared handlers
      const enhancementCoordinator = new EnhancementCoordinator({
        llmHandler: services.llmHandler,
        embeddingHandler: services.embeddingHandler,
        sparqlHelper: services.storage?.sparqlExecute,
        config: services.config
      });

      // Initialize memory domain management services
      const memoryRelevanceEngine = new MemoryRelevanceEngine({
        baseWeights: {
          domainMatch: 0.35,
          temporal: 0.20,
          semantic: 0.30,
          frequency: 0.15
        }
      });

      const memoryDomainManager = new MemoryDomainManager(
        memoryManager.store,
        stateManager,
        {
          memoryRelevanceEngine
        }
      );

      // Create shared context object
      this.context = {
        memoryManager,
        safeOps,
        stateManager,
        templateLoader,
        zptService,
        enhancementCoordinator,
        memoryRelevanceEngine,
        memoryDomainManager,

        // Include original services for compatibility
        llmHandler: services.llmHandler,
        embeddingHandler: services.embeddingHandler,
        config: services.config,
        storage: services.storage,

        // Service metadata
        initialized: true,
        initTimestamp: new Date().toISOString()
      };

      this.initialized = true;
      verbsLogger.info('✅ VerbContextService - Shared context initialized successfully');

      return this.context;

    } catch (error) {
      verbsLogger.error('❌ VerbContextService initialization failed:', error.message);
      throw new Error(`Failed to initialize verb context: ${error.message}`);
    }
  }

  /**
   * Get current context (must be initialized first)
   * @returns {Object} Current context object
   */
  getContext() {
    if (!this.initialized || !this.context) {
      throw new Error('VerbContextService not initialized. Call prepareContext() first.');
    }
    return this.context;
  }

  /**
   * Check if context is initialized
   * @returns {boolean} Whether context is ready
   */
  isInitialized() {
    return this.initialized && !!this.context;
  }

  /**
   * Reset context (for testing or reinitialization)
   */
  reset() {
    this.initialized = false;
    this.context = null;
    verbsLogger.debug('VerbContextService reset');
  }

  /**
   * Get context health status
   * @returns {Object} Health check results
   */
  getHealthStatus() {
    if (!this.isInitialized()) {
      return {
        status: 'not_initialized',
        services: {}
      };
    }

    const ctx = this.context;
    return {
      status: 'initialized',
      timestamp: ctx.initTimestamp,
      services: {
        memoryManager: !!ctx.memoryManager,
        safeOps: !!ctx.safeOps,
        stateManager: !!ctx.stateManager,
        templateLoader: !!ctx.templateLoader,
        zptService: !!ctx.zptService,
        enhancementCoordinator: !!ctx.enhancementCoordinator,
        memoryRelevanceEngine: !!ctx.memoryRelevanceEngine,
        memoryDomainManager: !!ctx.memoryDomainManager,
        llmHandler: !!ctx.llmHandler,
        embeddingHandler: !!ctx.embeddingHandler
      }
    };
  }
}

export default VerbContextService;