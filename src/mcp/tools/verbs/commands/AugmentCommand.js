/**
 * AugmentCommand - Command for running operations on relevant knowledgebase parts
 *
 * Implements the Command Pattern with Strategy Pattern to replace the massive
 * 738-line augment switch statement with focused, maintainable strategies.
 */

import { BaseVerbCommand } from './BaseVerbCommand.js';
import { AugmentSchema } from '../../VerbSchemas.js';
import { logOperation, verbsLogger } from '../../VerbsLogger.js';

// Import augment strategies
import { ConceptsStrategy } from '../strategies/augment/ConceptsStrategy.js';
import { AttributesStrategy } from '../strategies/augment/AttributesStrategy.js';
import { RelationshipsStrategy } from '../strategies/augment/RelationshipsStrategy.js';
import { ProcessLazyStrategy } from '../strategies/augment/ProcessLazyStrategy.js';
import { ChunkDocumentsStrategy } from '../strategies/augment/ChunkDocumentsStrategy.js';
import { LegacyOperationsStrategy } from '../strategies/augment/LegacyOperationsStrategy.js';
import { AutoStrategy } from '../strategies/augment/AutoStrategy.js';

export class AugmentCommand extends BaseVerbCommand {
  constructor() {
    super('augment');
    this.schema = AugmentSchema;
    this.strategies = new Map();
  }

  /**
   * Initialize command with augment strategies
   * @param {Object} context - Shared context
   */
  async onInitialize(context) {
    // Register strategies for different augment operations
    this.strategies.set('concepts', new ConceptsStrategy());
    this.strategies.set('attributes', new AttributesStrategy());
    this.strategies.set('relationships', new RelationshipsStrategy());
    this.strategies.set('process_lazy', new ProcessLazyStrategy());
    this.strategies.set('chunk_documents', new ChunkDocumentsStrategy());

    // Legacy operations strategy handles multiple operations
    const legacyStrategy = new LegacyOperationsStrategy();
    this.strategies.set('extract_concepts', legacyStrategy);
    this.strategies.set('generate_embedding', legacyStrategy);
    this.strategies.set('analyze_text', legacyStrategy);
    this.strategies.set('concept_embeddings', legacyStrategy);

    // Auto strategy for automatic operation selection
    this.strategies.set('auto', new AutoStrategy());

    this.logOperation('debug', 'Augment command initialized with strategies', {
      strategiesCount: this.strategies.size,
      strategies: Array.from(this.strategies.keys())
    });
  }

  /**
   * Execute augment command
   * @param {Object} params - Command parameters
   * @param {string} params.target - Target content or identifier
   * @param {string} params.operation - Augment operation type (auto, concepts, attributes, etc.)
   * @param {Object} params.options - Additional operation options
   * @param {Object} params.parameters - Legacy parameters (merged into options)
   * @returns {Promise<Object>} Command result
   */
  async execute(params) {
    const validatedParams = this.validateParameters(params);
    const { target, operation = 'auto', options = {}, parameters = {} } = validatedParams;

    // Backward compatibility: merge legacy 'parameters' into 'options'
    const mergedOptions = { ...parameters, ...options };
    if (Object.keys(parameters).length > 0) {
      logOperation('debug', 'augment', 'Legacy parameters detected, merged into options', {
        parameters,
        mergedOptions
      });
    }

    verbsLogger.info('🔄 [AUGMENT] Function called', {
      target: typeof target === 'string' ? target.substring(0, 50) + '...' : target,
      operation,
      options: Object.keys(mergedOptions),
      parameters: Object.keys(parameters)
    });

    try {
      // Validate target for operations that require specific content
      const requiresSpecificTarget = ['concepts', 'attributes', 'relationships'].includes(operation);
      if (requiresSpecificTarget && (!target || target === 'all')) {
        throw new Error(`Operation '${operation}' requires specific target content, not 'all'`);
      }

      logOperation('debug', 'augment', 'Augment operation started', {
        target: typeof target === 'string' ? target.substring(0, 50) : target,
        operation
      });

      verbsLogger.info('🔄 [AUGMENT] Selecting strategy', { operation });

      // Select appropriate strategy
      const strategy = this.selectStrategy(operation);
      if (!strategy) {
        throw new Error(`No strategy found for augment operation: ${operation}`);
      }

      this.logOperation('debug', 'Selected augment strategy', {
        strategyName: strategy.name,
        operation
      });

      // Execute strategy
      const strategyResult = await strategy.execute(
        { target, operation, options: mergedOptions },
        {
          memoryManager: this.memoryManager,
          safeOps: this.safeOps,
          stateManager: this.stateManager,
          zptService: this.zptService
        }
      );

      if (!strategyResult.success) {
        throw new Error(strategyResult.error || 'Strategy execution failed');
      }

      this.logOperation('info', 'Augment operation completed successfully', {
        operation,
        strategyUsed: strategy.name,
        augmentationType: strategyResult.augmentationType
      });

      return this.createSuccessResponse({
        target: typeof target === 'string' ? target.substring(0, 100) + '...' : target,
        operation,
        options: mergedOptions,
        // Include strategy-specific results
        ...strategyResult
      });

    } catch (error) {
      return this.handleError(error, 'augment operation', {
        target: typeof target === 'string' ? target.substring(0, 50) : target,
        operation,
        hasOptions: Object.keys(mergedOptions).length > 0
      });
    }
  }

  /**
   * Select appropriate strategy based on operation
   * @param {string} operation - The augment operation
   * @returns {BaseStrategy} Selected strategy
   * @private
   */
  selectStrategy(operation) {
    // Direct operation mapping
    if (this.strategies.has(operation)) {
      return this.strategies.get(operation);
    }

    // Default to auto strategy for unknown operations
    verbsLogger.info(`🔄 [AUGMENT] Unknown operation '${operation}', using auto strategy`);
    return this.strategies.get('auto');
  }

  /**
   * Get supported operations
   * @returns {string[]} List of supported operations
   */
  getSupportedOperations() {
    const operations = new Set();

    for (const [operation, strategy] of this.strategies.entries()) {
      operations.add(operation);

      // Add operations that legacy strategy supports
      if (strategy.name === 'legacy_operations') {
        operations.add('extract_concepts');
        operations.add('generate_embedding');
        operations.add('analyze_text');
        operations.add('concept_embeddings');
      }
    }

    return Array.from(operations).sort();
  }

  /**
   * Get operation metadata
   * @param {string} operation - Operation to get metadata for
   * @returns {Object} Operation metadata
   */
  getOperationMetadata(operation) {
    const strategy = this.strategies.get(operation);
    if (!strategy) {
      return null;
    }

    return {
      operation,
      strategyName: strategy.name,
      description: strategy.description,
      supportedParameters: strategy.supportedParameters || []
    };
  }
}

export default AugmentCommand;