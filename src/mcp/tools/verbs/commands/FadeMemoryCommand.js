/**
 * FadeMemoryCommand - Apply memory decay and fade transitions
 *
 * Handles memory fading operations for smooth context transitions.
 */

import { BaseVerbCommand } from './BaseVerbCommand.js';
import { FadeMemorySchema } from '../../VerbSchemas.js';
import { logOperation } from '../../VerbsLogger.js';

export class FadeMemoryCommand extends BaseVerbCommand {
  constructor() {
    super('fade_memory');
    this.schema = FadeMemorySchema;
  }

  /**
   * Execute fade memory command
   * @param {Object} params - Command parameters
   * @param {string} params.domain - Domain to fade
   * @param {number} params.fadeFactor - Fade factor (0-1)
   * @param {string} params.transition - Transition type (smooth, abrupt)
   * @param {boolean} params.preserveInstructions - Whether to preserve instruction memories
   * @returns {Promise<Object>} Command result
   */
  async execute(params) {
    const validatedParams = this.validateParameters(params);
    const {
      domain,
      fadeFactor = 0.1,
      transition = 'smooth',
      preserveInstructions = true
    } = validatedParams;

    try {
      this.logOperation('debug', 'Simple Verb: fade_memory', {
        domain,
        fadeFactor,
        transition,
        preserveInstructions
      });

      let result;

      if (transition === 'smooth') {
        // Gradual fade over time
        result = await this.memoryDomainManager.fadeContext(domain, fadeFactor, {
          gradual: true,
          preserveInstructions
        });

        // Apply fade in multiple steps for smoothness
        if (fadeFactor > 0.5) {
          const steps = Math.ceil(fadeFactor / 0.2);
          const stepFactor = fadeFactor / steps;

          for (let i = 0; i < steps; i++) {
            await new Promise(resolve => setTimeout(resolve, 100)); // Small delay
            await this.memoryDomainManager.fadeContext(domain, stepFactor, {
              incremental: true,
              preserveInstructions
            });
          }
        }
      } else {
        // Abrupt fade - single operation
        result = await this.memoryDomainManager.fadeContext(domain, fadeFactor, {
          preserveInstructions
        });
      }

      // Update state to reflect memory changes
      const currentState = this.stateManager.getState();
      const updatedDomains = currentState.pan?.domains?.filter(d => d !== domain) || [];

      if (updatedDomains.length !== (currentState.pan?.domains?.length || 0)) {
        await this.stateManager.setPan({
          ...currentState.pan,
          domains: updatedDomains
        });
      }

      return this.createSuccessResponse({
        domain,
        fadeFactor,
        transition,
        preserveInstructions,
        result,
        zptState: this.stateManager.getState(),
        fadedSuccessfully: result?.success || false
      });

    } catch (error) {
      return this.handleError(error, 'fade memory operation', {
        domain,
        fadeFactor,
        transition,
        preserveInstructions
      });
    }
  }
}

export default FadeMemoryCommand;