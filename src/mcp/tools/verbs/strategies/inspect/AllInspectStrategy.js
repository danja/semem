/**
 * AllInspectStrategy - Comprehensive system analysis
 *
 * Handles comprehensive inspection of all system components.
 */

import { BaseStrategy } from '../BaseStrategy.js';

export class AllInspectStrategy extends BaseStrategy {
  constructor() {
    super('all');
    this.description = 'Comprehensive system analysis and health checks';
    this.supportedParameters = ['details'];
  }

  /**
   * Execute comprehensive inspection strategy
   * @param {Object} params - Strategy parameters
   * @param {boolean} params.details - Whether to include detailed analysis
   * @param {Object} context - Execution context with services
   * @returns {Promise<Object>} Strategy result
   */
  async execute(params, context) {
    const { details = false } = params;
    const service = context.serviceInstance;

    try {
      this.logOperation('info', 'Running comprehensive system analysis', { details });

      // Comprehensive system analysis
      let result = {
        systemHealth: await service._analyzeSystemHealth(),
        memoryAnalytics: await service._analyzeMemoryPatterns(),
        performanceAnalytics: await service._analyzePerformance(),
        recommendations: await service._generateRecommendations()
      };

      if (details) {
        result.knowledgeGraph = await service._generateKnowledgeGraphData();
        result.usagePatterns = await service._analyzeUsagePatterns();
      }

      return this.createSuccessResponse(result);

    } catch (error) {
      return this.handleError(error, 'comprehensive inspection', { details });
    }
  }

  /**
   * Check if this strategy supports the given parameters
   * @param {Object} params - Parameters to check
   * @returns {boolean} Whether strategy supports the parameters
   */
  supports(params) {
    return params.what === 'all';
  }
}

export default AllInspectStrategy;