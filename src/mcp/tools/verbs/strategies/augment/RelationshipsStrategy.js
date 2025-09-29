/**
 * RelationshipsStrategy - Generate relationships using current context
 *
 * Handles the 'relationships' augment operation by using ZPT navigation.
 */

import { BaseStrategy } from '../BaseStrategy.js';

export class RelationshipsStrategy extends BaseStrategy {
  constructor() {
    super('relationships');
    this.description = 'Generate relationships using current ZPT context and navigation';
    this.supportedParameters = ['target'];
  }

  /**
   * Execute relationships generation strategy
   * @param {Object} params - Strategy parameters
   * @param {string} params.target - Target content for relationship generation
   * @param {Object} context - Execution context with services
   * @returns {Promise<Object>} Strategy result
   */
  async execute(params, context) {
    const { target } = params;
    const { stateManager, zptService } = context;

    // Validate target for this operation
    if (!target || target === 'all') {
      return this.handleError(
        new Error('Operation "relationships" requires specific target content, not "all"'),
        'validate target',
        { target }
      );
    }

    try {
      this.logOperation('info', 'Generating relationships using current context', {
        targetLength: target.length,
        targetPreview: target.substring(0, 50) + '...'
      });

      // Generate relationships using current context
      const navParams = stateManager.getNavigationParams(target);
      const navResult = await zptService.navigate(navParams);

      if (navResult.success) {
        const relationships = navResult.content?.data || [];

        this.logOperation('info', 'Relationships generated successfully', {
          relationshipCount: relationships.length,
          navigationSuccess: navResult.success
        });

        return this.createSuccessResponse({
          relationships,
          context: navParams,
          augmentationType: 'relationships',
          navigationResult: navResult
        });
      } else {
        this.logOperation('warn', 'No relationships found in navigation result', {
          navResultSuccess: navResult.success,
          hasContent: !!navResult.content
        });

        return this.createSuccessResponse({
          relationships: [],
          error: 'No relationships found',
          context: navParams,
          augmentationType: 'relationships',
          navigationResult: navResult
        });
      }

    } catch (error) {
      return this.handleError(error, 'generate relationships', {
        targetLength: target?.length
      });
    }
  }

  /**
   * Check if this strategy supports the given operation
   * @param {Object} params - Parameters to check
   * @returns {boolean} Whether strategy supports the parameters
   */
  supports(params) {
    return params.operation === 'relationships';
  }
}

export default RelationshipsStrategy;