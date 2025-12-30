/**
 * PanCommand - Command for applying pan filters (domains, keywords, entities, temporal, corpuscles)
 *
 * Implements pan operations for ZPT (Zoom, Pan, Tilt) navigation system.
 */

import { BaseVerbCommand } from './BaseVerbCommand.js';
import { PanSchema } from '../../VerbSchemas.js';
import { logOperation } from '../../VerbsLogger.js';

export class PanCommand extends BaseVerbCommand {
  constructor() {
    super('pan');
    this.schema = PanSchema;
  }

  /**
   * Execute pan command
   * @param {Object} params - Command parameters (panParams)
   * @param {Array<string>} params.domains - Domain filters
   * @param {Array<string>} params.keywords - Keyword filters
   * @param {Array<string>} params.entities - Entity filters
   * @param {Object} params.temporal - Temporal bounds
   * @param {Array<string>} params.corpuscle - Corpuscle scope filters
   * @returns {Promise<Object>} Command result
   */
  async execute(params) {
    const validatedParams = this.validateParameters(params);
    const panParams = validatedParams;

    try {
      this.logOperation('debug', 'Simple Verb: pan', panParams);

      // Update state with pan parameters
      await this.stateManager.setPan(panParams);

      let result = {
        success: true,
        verb: 'pan',
        panParams,
        zptState: this.stateManager.getState()
      };

      // If we have a last query, re-navigate with new pan settings
      if (this.stateManager.state.lastQuery) {
        try {
          const navParams = this.stateManager.getNavigationParams();
          const navResult = await this.zptService.navigate(navParams);

          result.navigation = navResult;
          result.reNavigated = true;

          this.logOperation('debug', 'Pan re-navigation completed', {
            success: navResult.success,
            hasData: !!navResult.content?.data
          });
        } catch (navError) {
          this.logOperation('warn', 'Pan re-navigation failed', { error: navError.message });
          result.navigation = {
            success: false,
            error: navError.message
          };
          result.warning = 'Pan settings updated, but re-navigation failed';
        }
      }

      return this.createSuccessResponse(result);

    } catch (error) {
      return this.handleError(error, 'pan operation', {
        panParams,
        zptState: this.stateManager.getState()
      });
    }
  }
}

export default PanCommand;
