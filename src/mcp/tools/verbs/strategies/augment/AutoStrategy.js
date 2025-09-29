/**
 * AutoStrategy - Automatically determine and execute appropriate augment operation
 *
 * Handles the 'auto' and default augment operations by analyzing content
 * and selecting the most appropriate augmentation strategy.
 */

import { BaseStrategy } from '../BaseStrategy.js';
import { verbsLogger } from '../../../VerbsLogger.js';

export class AutoStrategy extends BaseStrategy {
  constructor() {
    super('auto');
    this.description = 'Automatically determine and execute appropriate augmentation operation';
    this.supportedParameters = ['target', 'options'];
  }

  /**
   * Execute auto strategy by analyzing content and selecting appropriate operation
   * @param {Object} params - Strategy parameters
   * @param {string} params.target - Target content to analyze
   * @param {Object} params.options - Additional options
   * @param {Object} context - Execution context with services
   * @returns {Promise<Object>} Strategy result
   */
  async execute(params, context) {
    const { target, options = {} } = params;
    const { safeOps } = context;

    try {
      verbsLogger.info('🔄 [AUGMENT] Entered auto case - determining best augmentation approach', {
        targetType: typeof target,
        targetLength: target?.length,
        isAll: target === 'all'
      });

      // Analyze target to determine best augmentation approach
      const augmentationPlan = this.analyzeTargetForAugmentation(target, options);

      this.logOperation('info', `Auto-selected augmentation: ${augmentationPlan.operation}`, {
        operation: augmentationPlan.operation,
        reason: augmentationPlan.reason,
        targetCharacteristics: augmentationPlan.characteristics
      });

      // Execute the determined operation
      return await this.executeSelectedOperation(augmentationPlan, target, context);

    } catch (error) {
      return this.handleError(error, 'auto augmentation', {
        targetLength: target?.length,
        targetType: typeof target
      });
    }
  }

  /**
   * Analyze target content to determine best augmentation approach
   * @param {string} target - Target content
   * @param {Object} options - Additional options
   * @returns {Object} Augmentation plan
   * @private
   */
  analyzeTargetForAugmentation(target, options) {
    const characteristics = this.analyzeTargetCharacteristics(target);

    // Decision logic for auto-selection
    if (target === 'all' || target === '') {
      return {
        operation: 'process_lazy',
        reason: 'Target is "all" - processing lazy content',
        characteristics,
        selectedOptions: { limit: options.limit || 10 }
      };
    }

    if (target.startsWith('http://') || target.startsWith('https://')) {
      if (characteristics.length > 5000) {
        return {
          operation: 'chunk_documents',
          reason: 'URI target with large content - chunking recommended',
          characteristics,
          selectedOptions: options
        };
      } else {
        return {
          operation: 'concepts',
          reason: 'URI target with moderate content - extracting concepts',
          characteristics,
          selectedOptions: options
        };
      }
    }

    if (characteristics.length > 8000) {
      return {
        operation: 'chunk_documents',
        reason: 'Large content detected - chunking for better processing',
        characteristics,
        selectedOptions: {
          ...options,
          maxChunkSize: 2000,
          strategy: 'semantic'
        }
      };
    }

    if (characteristics.hasStructuredContent) {
      return {
        operation: 'relationships',
        reason: 'Structured content detected - extracting relationships',
        characteristics,
        selectedOptions: options
      };
    }

    // Default to concept extraction for most content
    return {
      operation: 'concepts',
      reason: 'Standard content - extracting concepts',
      characteristics,
      selectedOptions: {
        ...options,
        includeEmbeddings: true // Enhanced concept extraction
      }
    };
  }

  /**
   * Analyze target characteristics for decision making
   * @param {string} target - Target content
   * @returns {Object} Content characteristics
   * @private
   */
  analyzeTargetCharacteristics(target) {
    if (!target || typeof target !== 'string') {
      return {
        length: 0,
        hasStructuredContent: false,
        isUri: false,
        contentType: 'unknown'
      };
    }

    const length = target.length;
    const isUri = target.startsWith('http://') || target.startsWith('https://');

    // Simple heuristics for structured content detection
    const hasStructuredContent = (
      target.includes('{') && target.includes('}') || // JSON-like
      target.includes('<') && target.includes('>') || // XML/HTML-like
      target.split('\n').length > 10 || // Multi-line structured
      target.includes('|') && target.includes('-') // Table-like
    );

    const contentType = this.guessContentType(target);

    return {
      length,
      hasStructuredContent,
      isUri,
      contentType,
      lineCount: target.split('\n').length,
      wordCount: target.split(/\s+/).length
    };
  }

  /**
   * Guess content type based on content patterns
   * @param {string} target - Target content
   * @returns {string} Guessed content type
   * @private
   */
  guessContentType(target) {
    if (target.trim().startsWith('{') && target.trim().endsWith('}')) {
      return 'json';
    }
    if (target.includes('<') && target.includes('</')) {
      return 'html_xml';
    }
    if (target.includes('|') && target.includes('---')) {
      return 'markdown_table';
    }
    if (target.split('\n').length > 5 && target.includes(':')) {
      return 'structured_text';
    }
    return 'plain_text';
  }

  /**
   * Execute the selected augmentation operation
   * @param {Object} plan - Augmentation plan
   * @param {string} target - Target content
   * @param {Object} context - Execution context
   * @returns {Promise<Object>} Execution result
   * @private
   */
  async executeSelectedOperation(plan, target, context) {
    const { safeOps } = context;

    verbsLogger.info(`🎯 [AUTO] Executing selected operation: ${plan.operation}`, {
      operation: plan.operation,
      reason: plan.reason
    });

    switch (plan.operation) {
      case 'concepts':
        const concepts = await safeOps.extractConcepts(target);
        return this.createSuccessResponse({
          concepts,
          augmentationType: 'auto_concepts',
          autoSelection: plan,
          selectedOperation: plan.operation
        });

      case 'process_lazy':
        // For auto mode, we'll just return a placeholder for lazy processing
        // The actual processing would need access to the store
        return this.createSuccessResponse({
          message: 'Auto-selected lazy processing - would process unhandled content',
          augmentationType: 'auto_process_lazy',
          autoSelection: plan,
          selectedOperation: plan.operation
        });

      case 'chunk_documents':
        return this.createSuccessResponse({
          message: 'Auto-selected document chunking - large content detected',
          targetLength: target.length,
          recommendedChunkSize: plan.selectedOptions.maxChunkSize,
          augmentationType: 'auto_chunk_documents',
          autoSelection: plan,
          selectedOperation: plan.operation
        });

      case 'relationships':
        return this.createSuccessResponse({
          message: 'Auto-selected relationship extraction - structured content detected',
          augmentationType: 'auto_relationships',
          autoSelection: plan,
          selectedOperation: plan.operation
        });

      default:
        // Fallback to concept extraction
        const fallbackConcepts = await safeOps.extractConcepts(target);
        return this.createSuccessResponse({
          concepts: fallbackConcepts,
          augmentationType: 'auto_fallback_concepts',
          autoSelection: plan,
          selectedOperation: 'concepts_fallback'
        });
    }
  }

  /**
   * Check if this strategy supports the given operation
   * @param {Object} params - Parameters to check
   * @returns {boolean} Whether strategy supports the parameters
   */
  supports(params) {
    return params.operation === 'auto' || !params.operation; // Default case
  }
}

export default AutoStrategy;