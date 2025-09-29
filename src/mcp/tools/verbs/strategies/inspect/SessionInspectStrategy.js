/**
 * SessionInspectStrategy - Analyze current session data
 *
 * Handles session-specific inspection and analytics.
 */

import { BaseStrategy } from '../BaseStrategy.js';

export class SessionInspectStrategy extends BaseStrategy {
  constructor() {
    super('session');
    this.description = 'Analyze current session data and interactions';
    this.supportedParameters = ['details'];
  }

  /**
   * Execute session inspection strategy
   * @param {Object} params - Strategy parameters
   * @param {boolean} params.details - Whether to include detailed analysis
   * @param {Object} context - Execution context with services
   * @returns {Promise<Object>} Strategy result
   */
  async execute(params, context) {
    const { details = false } = params;
    const service = context.serviceInstance;

    try {
      this.logOperation('info', 'Analyzing session data', { details });

      let result = {
        sessionAnalytics: await service._analyzeSession()
      };

      if (details) {
        result.detailedInteractions = await service._getDetailedInteractions();
        result.performanceMetrics = await service._getPerformanceMetrics();
      }

      return this.createSuccessResponse(result);

    } catch (error) {
      return this.handleError(error, 'session inspection', { details });
    }
  }

  /**
   * Check if this strategy supports the given parameters
   * @param {Object} params - Parameters to check
   * @returns {boolean} Whether strategy supports the parameters
   */
  supports(params) {
    return params.what === 'session';
  }
}

export default SessionInspectStrategy;