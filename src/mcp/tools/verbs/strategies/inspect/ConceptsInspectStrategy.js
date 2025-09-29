/**
 * ConceptsInspectStrategy - Analyze concept networks and relationships
 *
 * Handles concept-specific inspection and analytics.
 */

import { BaseStrategy } from '../BaseStrategy.js';

export class ConceptsInspectStrategy extends BaseStrategy {
  constructor() {
    super('concepts');
    this.description = 'Analyze concept networks and relationships';
    this.supportedParameters = ['details'];
  }

  /**
   * Execute concepts inspection strategy
   * @param {Object} params - Strategy parameters
   * @param {boolean} params.details - Whether to include detailed analysis
   * @param {Object} context - Execution context with services
   * @returns {Promise<Object>} Strategy result
   */
  async execute(params, context) {
    const { details = false } = params;
    const service = context.serviceInstance;

    try {
      this.logOperation('info', 'Analyzing concept networks', { details });

      let result = {
        conceptAnalytics: await service._analyzeConceptNetwork(),
        conceptInsights: await service._generateConceptInsights()
      };

      if (details) {
        result.conceptRelationships = await service._analyzeConceptRelationships();
      }

      return this.createSuccessResponse(result);

    } catch (error) {
      return this.handleError(error, 'concepts inspection', { details });
    }
  }

  /**
   * Check if this strategy supports the given parameters
   * @param {Object} params - Parameters to check
   * @returns {boolean} Whether strategy supports the parameters
   */
  supports(params) {
    return params.what === 'concepts';
  }
}

export default ConceptsInspectStrategy;