/**
 * ZoomCommand - Command for navigating to different granularities
 *
 * Implements zoom operations for ZPT (Zoom, Pan, Tilt) navigation system.
 */

import { BaseVerbCommand } from './BaseVerbCommand.js';
import { ZoomSchema } from '../../VerbSchemas.js';
import { logOperation } from '../../VerbsLogger.js';

export class ZoomCommand extends BaseVerbCommand {
  constructor() {
    super('zoom');
    this.schema = ZoomSchema;
  }

  /**
   * Execute zoom command
   * @param {Object} params - Command parameters
   * @param {string} params.level - Zoom level (entity, concept, document, community)
   * @param {string} params.query - Optional query for navigation
   * @returns {Promise<Object>} Command result
   */
  async execute(params) {
    const validatedParams = this.validateParameters(params);
    const { level = 'entity', query } = validatedParams;

    try {
      this.logOperation('debug', 'Simple Verb: zoom', { level, query });

      // Update state
      await this.stateManager.setZoom(level, query);

      let result = {
        success: true,
        verb: 'zoom',
        level,
        previousLevel: this.stateManager.stateHistory.length > 0
          ? this.stateManager.stateHistory[this.stateManager.stateHistory.length - 1].previous?.zoom
          : null,
        zptState: this.stateManager.getState()
      };

      // If query provided, perform navigation with new zoom level
      if (query) {
        try {
          const navParams = this.stateManager.getNavigationParams(query);
          logOperation('debug', 'zoom', 'Zoom navigation params', navParams);

          // Ensure proper parameter format for ZPT navigation
          const zptParams = {
            query: navParams.query,
            zoom: navParams.zoom,
            pan: navParams.pan || {},
            tilt: navParams.tilt || 'keywords'
          };

          logOperation('debug', 'zoom', 'Calling ZPT navigate with params', zptParams);
          const navResult = await this.zptService.navigate(zptParams);

          result.navigation = navResult;
          result.query = query;
        } catch (navError) {
          logOperation('warn', 'zoom', 'ZPT navigation failed in zoom verb', { error: navError.message });
          // Navigation failed but zoom state change succeeded - this is acceptable
          result.navigation = {
            success: false,
            error: navError.message,
            content: { data: [], success: false, error: navError.message }
          };
          result.query = query;
          result.warning = 'Zoom level set successfully, but navigation skipped due to error';
        }
      }

      return this.createSuccessResponse(result);

    } catch (error) {
      return this.handleError(error, 'zoom operation', {
        level,
        query,
        zptState: this.stateManager.getState()
      });
    }
  }
}

export default ZoomCommand;