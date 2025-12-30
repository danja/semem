/**
 * TiltCommand - Command for changing presentation/view style
 *
 * Implements tilt operations for ZPT (Zoom, Pan, Tilt) navigation system.
 */

import { BaseVerbCommand } from './BaseVerbCommand.js';
import { TiltSchema } from '../../VerbSchemas.js';
import { logOperation } from '../../VerbsLogger.js';

export class TiltCommand extends BaseVerbCommand {
  constructor() {
    super('tilt');
    this.schema = TiltSchema;
  }

  /**
   * Execute tilt command
   * @param {Object} params - Command parameters
   * @param {string} params.style - Presentation style (keywords, embedding, graph, temporal)
   * @param {string} params.query - Optional query for re-navigation
   * @returns {Promise<Object>} Command result
   */
  async execute(params) {
    const validatedParams = this.validateParameters(params);
    const { style = 'keywords', query } = validatedParams;

    try {
      this.logOperation('debug', 'Simple Verb: tilt', { style, query });

      // Update state
      await this.stateManager.setTilt(style, query);

      let result = {
        success: true,
        verb: 'tilt',
        style,
        previousStyle: this.stateManager.stateHistory.length > 0
          ? this.stateManager.stateHistory[this.stateManager.stateHistory.length - 1].previous?.tilt
          : null,
        zptState: this.stateManager.getState()
      };

      // If query provided or we have a last query, perform navigation with new tilt
      const navigationQuery = query || this.stateManager.state.lastQuery;
      if (navigationQuery) {
        try {
          const navParams = this.stateManager.getNavigationParams(navigationQuery);
          const navResult = await this.zptService.navigate(navParams);

          result.navigation = navResult;
          result.query = navigationQuery;

          this.logOperation('debug', 'Tilt navigation completed', {
            success: navResult.success,
            hasData: !!navResult.content?.data,
            style
          });
        } catch (navError) {
          this.logOperation('warn', 'Tilt navigation failed', { error: navError.message });
          result.navigation = {
            success: false,
            error: navError.message
          };
          result.warning = 'Tilt style updated, but navigation failed';
        }
      }

      return this.createSuccessResponse(result);

    } catch (error) {
      return this.handleError(error, 'tilt operation', {
        style,
        query,
        zptState: this.stateManager.getState()
      });
    }
  }
}

export default TiltCommand;
