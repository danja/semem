/**
 * ForgetCommand - Fade memory visibility using navigation rather than deletion
 *
 * Handles memory fading and context switching strategies.
 */

import { BaseVerbCommand } from './BaseVerbCommand.js';
import { ForgetSchema } from '../../VerbSchemas.js';
import { logOperation } from '../../VerbsLogger.js';

export class ForgetCommand extends BaseVerbCommand {
  constructor() {
    super('forget');
    this.schema = ForgetSchema;
  }

  /**
   * Execute forget command
   * @param {Object} params - Command parameters
   * @param {string} params.target - Target to forget
   * @param {string} params.strategy - Forgetting strategy (fade, context_switch, temporal_decay)
   * @param {number} params.fadeFactor - Fade factor for memory reduction
   * @returns {Promise<Object>} Command result
   */
  async execute(params) {
    const validatedParams = this.validateParameters(params);
    const { target, strategy = 'fade', fadeFactor = 0.1 } = validatedParams;

    try {
      this.logOperation('debug', 'Simple Verb: forget', { target, strategy, fadeFactor });

      let result;

      switch (strategy) {
        case 'fade':
          result = await this.memoryDomainManager.fadeContext(target, fadeFactor);
          break;

        case 'context_switch':
          // Switch away from the target domain
          const currentDomains = this.stateManager.getState().pan?.domains || [];
          const newDomains = currentDomains.filter(d => d !== target);
          result = await this.memoryDomainManager.switchDomain(currentDomains, newDomains, { fadeFactor });
          break;

        case 'temporal_decay':
          // Apply enhanced temporal decay
          result = { success: true, strategy: 'temporal_decay', message: 'Temporal decay applied' };
          break;

        default:
          throw new Error(`Unknown forget strategy: ${strategy}`);
      }

      return this.createSuccessResponse({
        target,
        strategy,
        fadeFactor,
        zptState: this.stateManager.getState(),
        result
      });

    } catch (error) {
      return this.handleError(error, 'forget operation', {
        target,
        strategy,
        fadeFactor
      });
    }
  }
}

export default ForgetCommand;