/**
 * AttributesStrategy - Use Ragno to augment with attributes
 *
 * Handles the 'attributes' augment operation using Ragno attribute extraction.
 */

import { BaseStrategy } from '../BaseStrategy.js';

export class AttributesStrategy extends BaseStrategy {
  constructor() {
    super('attributes');
    this.description = 'Extract attributes using Ragno augmentation with fallback to concepts';
    this.supportedParameters = ['target', 'options'];
  }

  /**
   * Execute attributes extraction strategy
   * @param {Object} params - Strategy parameters
   * @param {string} params.target - Target content to extract attributes from
   * @param {Object} params.options - Additional options for Ragno
   * @param {Object} context - Execution context with services
   * @returns {Promise<Object>} Strategy result
   */
  async execute(params, context) {
    const { target, options = {} } = params;
    const { safeOps, memoryManager } = context;

    // Validate target for this operation
    if (!target || target === 'all') {
      return this.handleError(
        new Error('Operation "attributes" requires specific target content, not "all"'),
        'validate target',
        { target }
      );
    }

    try {
      this.logOperation('info', 'Extracting attributes using Ragno', {
        targetLength: target.length,
        targetPreview: target.substring(0, 50) + '...',
        hasOptions: Object.keys(options).length > 0
      });

      // Try to use Ragno for attribute extraction
      try {
        const { augmentWithAttributes } = await import('../../../../ragno/augmentWithAttributes.js');
        const result = await augmentWithAttributes(
          [{ content: target }],
          memoryManager.llmHandler,
          options
        );

        this.logOperation('info', 'Ragno attributes extraction completed', {
          resultType: typeof result,
          hasResult: !!result
        });

        return this.createSuccessResponse({
          attributes: result,
          augmentationType: 'attributes_ragno',
          usedRagno: true
        });

      } catch (importError) {
        this.logOperation('warn', 'Ragno not available, falling back to concept extraction', {
          error: importError.message
        });

        // Fallback to concept extraction if Ragno is not available
        const concepts = await safeOps.extractConcepts(target);

        return this.createSuccessResponse({
          attributes: concepts,
          augmentationType: 'attributes_fallback',
          usedRagno: false,
          fallbackReason: 'Ragno module not available'
        });
      }

    } catch (error) {
      return this.handleError(error, 'extract attributes', {
        targetLength: target?.length,
        hasOptions: Object.keys(options).length > 0
      });
    }
  }

  /**
   * Check if this strategy supports the given operation
   * @param {Object} params - Parameters to check
   * @returns {boolean} Whether strategy supports the parameters
   */
  supports(params) {
    return params.operation === 'attributes';
  }
}

export default AttributesStrategy;