/**
 * ProcessLazyStrategy - Process lazy content that hasn't been fully processed
 *
 * Handles the 'process_lazy' augment operation for batch processing of unprocessed content.
 */

import { BaseStrategy } from '../BaseStrategy.js';
import { logOperation } from '../../../VerbsLogger.js';

export class ProcessLazyStrategy extends BaseStrategy {
  constructor() {
    super('process_lazy');
    this.description = 'Process lazy content - find and process unprocessed content items';
    this.supportedParameters = ['target', 'limit'];
  }

  /**
   * Execute process lazy strategy
   * @param {Object} params - Strategy parameters
   * @param {string} params.target - Target to process ('all' or specific content)
   * @param {Object} params.options - Options including limit
   * @param {Object} context - Execution context with services
   * @returns {Promise<Object>} Strategy result
   */
  async execute(params, context) {
    const { target, options = {} } = params;
    const { memoryManager, safeOps } = context;

    try {
      this.logOperation('info', 'Processing lazy content', {
        target: target === 'all' ? 'all lazy items' : 'specific content',
        hasLimit: !!options.limit,
        limit: options.limit
      });

      if (target === 'all' || target === '') {
        return await this.processAllLazyContent(options, context);
      } else {
        return await this.processSpecificContent(target, context);
      }

    } catch (error) {
      return this.handleError(error, 'process lazy content', {
        target,
        limit: options.limit
      });
    }
  }

  /**
   * Process all lazy content in the system
   * @param {Object} options - Processing options
   * @param {Object} context - Execution context
   * @returns {Promise<Object>} Processing result
   * @private
   */
  async processAllLazyContent(options, context) {
    const { memoryManager, safeOps } = context;
    const limit = options.limit || 10;

    const lazyItems = await memoryManager.store.findLazyContent(limit);

    if (lazyItems.length === 0) {
      return this.createSuccessResponse({
        processedItems: [],
        message: 'No lazy content found to process',
        augmentationType: 'process_lazy'
      });
    }

    this.logOperation('info', 'Found lazy content to process', {
      lazyItemsCount: lazyItems.length,
      limit
    });

    const processedItems = [];

    for (const item of lazyItems) {
      try {
        this.logOperation('debug', 'Processing lazy item', {
          id: item.id,
          label: item.label,
          type: item.type,
          contentLength: item.content?.length
        });

        // Generate embedding and extract concepts for lazy content
        const embedding = await safeOps.generateEmbedding(item.content);
        const concepts = await safeOps.extractConcepts(item.content);

        // Update the lazy content to processed status
        await memoryManager.store.updateLazyToProcessed(item.id, embedding, concepts);

        processedItems.push({
          id: item.id,
          label: item.label,
          type: item.type,
          conceptCount: concepts.length,
          embeddingDimension: embedding.length
        });

        logOperation('info', 'augment', 'Processed lazy content', {
          id: item.id,
          conceptCount: concepts.length
        });

      } catch (itemError) {
        logOperation('warn', 'augment', 'Failed to process lazy item', {
          id: item.id,
          error: itemError.message
        });

        // Continue processing other items but record the failure
        processedItems.push({
          id: item.id,
          error: true,
          message: `Failed to process: ${itemError.message}`
        });
      }
    }

    return this.createSuccessResponse({
      processedItems,
      totalProcessed: processedItems.filter(item => !item.error).length,
      totalFound: lazyItems.length,
      augmentationType: 'process_lazy'
    });
  }

  /**
   * Process specific content (treat as regular augmentation)
   * @param {string} target - Target content to process
   * @param {Object} context - Execution context
   * @returns {Promise<Object>} Processing result
   * @private
   */
  async processSpecificContent(target, context) {
    const { safeOps } = context;

    this.logOperation('info', 'Processing specific content as lazy augmentation', {
      targetLength: target.length,
      targetPreview: target.substring(0, 50) + '...'
    });

    // Process specific content (treat as regular augmentation)
    const concepts = await safeOps.extractConcepts(target);
    const embedding = await safeOps.generateEmbedding(target);

    return this.createSuccessResponse({
      concepts,
      embedding: {
        dimension: embedding.length,
        preview: embedding.slice(0, 5).map(x => parseFloat(x.toFixed(4)))
      },
      augmentationType: 'process_lazy_specific'
    });
  }

  /**
   * Check if this strategy supports the given operation
   * @param {Object} params - Parameters to check
   * @returns {boolean} Whether strategy supports the parameters
   */
  supports(params) {
    return params.operation === 'process_lazy';
  }
}

export default ProcessLazyStrategy;