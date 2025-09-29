/**
 * VerbCommandRegistry - Registry for managing verb commands using Command Pattern
 *
 * Replaces the main switch statement in SimpleVerbsService with dynamic dispatch.
 * Implements the Registry Pattern + Command Pattern for extensible verb handling.
 */

import { verbsLogger } from '../VerbsLogger.js';
import { VerbContextService } from './services/VerbContextService.js';

// Import command classes
import { TellCommand } from './commands/TellCommand.js';
import { AskCommand } from './commands/AskCommand.js';
import { AugmentCommand } from './commands/AugmentCommand.js';
import { ZoomCommand } from './commands/ZoomCommand.js';
import { PanCommand } from './commands/PanCommand.js';
import { TiltCommand } from './commands/TiltCommand.js';
import { InspectCommand } from './commands/InspectCommand.js';
import { RememberCommand } from './commands/RememberCommand.js';
import { ForgetCommand } from './commands/ForgetCommand.js';
import { RecallCommand } from './commands/RecallCommand.js';
import { ProjectContextCommand } from './commands/ProjectContextCommand.js';
import { FadeMemoryCommand } from './commands/FadeMemoryCommand.js';

export class VerbCommandRegistry {
  constructor() {
    this.commands = new Map();
    this.contextService = new VerbContextService();
    this.initialized = false;
  }

  /**
   * Initialize the registry and register all available commands
   */
  async initialize() {
    if (this.initialized) {
      return;
    }

    verbsLogger.info('🚀 Initializing VerbCommandRegistry');

    // Prepare shared context for all commands
    const sharedContext = await this.contextService.prepareContext();

    // Register core commands
    await this.registerCommand('tell', new TellCommand(), sharedContext);
    await this.registerCommand('ask', new AskCommand(), sharedContext);
    await this.registerCommand('augment', new AugmentCommand(), sharedContext);

    // Register navigation commands
    await this.registerCommand('zoom', new ZoomCommand(), sharedContext);
    await this.registerCommand('pan', new PanCommand(), sharedContext);
    await this.registerCommand('tilt', new TiltCommand(), sharedContext);

    // Register inspection and memory commands
    await this.registerCommand('inspect', new InspectCommand(), sharedContext);
    await this.registerCommand('remember', new RememberCommand(), sharedContext);
    await this.registerCommand('forget', new ForgetCommand(), sharedContext);
    await this.registerCommand('recall', new RecallCommand(), sharedContext);

    // Register context and memory management commands
    await this.registerCommand('project_context', new ProjectContextCommand(), sharedContext);
    await this.registerCommand('fade_memory', new FadeMemoryCommand(), sharedContext);

    this.initialized = true;

    verbsLogger.info('✅ VerbCommandRegistry initialized successfully', {
      registeredCommands: Array.from(this.commands.keys()),
      commandCount: this.commands.size
    });
  }

  /**
   * Register a command in the registry
   * @param {string} verb - The verb name
   * @param {BaseVerbCommand} command - The command instance
   * @param {Object} sharedContext - Shared context for initialization
   */
  async registerCommand(verb, command, sharedContext) {
    try {
      // Initialize the command with shared context
      await command.initialize(sharedContext);

      // Register in the map
      this.commands.set(verb, command);

      verbsLogger.debug(`📝 Registered command: ${verb}`);
    } catch (error) {
      verbsLogger.error(`❌ Failed to register command ${verb}:`, error.message);
      throw new Error(`Failed to register command ${verb}: ${error.message}`);
    }
  }

  /**
   * Execute a verb command
   * @param {string} verb - The verb to execute
   * @param {Object} params - Command parameters
   * @returns {Promise<Object>} Command result
   */
  async execute(verb, params = {}) {
    // Ensure registry is initialized
    if (!this.initialized) {
      await this.initialize();
    }

    // Get command
    const command = this.commands.get(verb);
    if (!command) {
      const availableVerbs = Array.from(this.commands.keys());
      throw new Error(`Unknown verb: ${verb}. Available verbs: ${availableVerbs.join(', ')}`);
    }

    verbsLogger.debug(`🎯 Executing ${verb} command`, {
      verb,
      hasParams: Object.keys(params).length > 0,
      paramKeys: Object.keys(params)
    });

    try {
      // Execute the command
      const result = await command.execute(params);

      verbsLogger.debug(`✅ ${verb} command completed successfully`, {
        verb,
        success: result.success,
        duration: result.performance?.totalDuration || 'unknown'
      });

      return result;

    } catch (error) {
      verbsLogger.error(`❌ ${verb} command failed:`, error.message);

      // Return standardized error response
      return {
        success: false,
        verb,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Check if a verb is supported
   * @param {string} verb - The verb to check
   * @returns {boolean} Whether the verb is supported
   */
  supports(verb) {
    return this.commands.has(verb);
  }

  /**
   * Get list of supported verbs
   * @returns {string[]} List of supported verb names
   */
  getSupportedVerbs() {
    return Array.from(this.commands.keys()).sort();
  }

  /**
   * Get command metadata for a verb
   * @param {string} verb - The verb to get metadata for
   * @returns {Object} Command metadata or null if not found
   */
  getCommandMetadata(verb) {
    const command = this.commands.get(verb);
    if (!command) {
      return null;
    }

    return {
      name: command.name,
      schema: command.schema ? command.schema._def : null,
      initialized: command.initialized,
      supportedFeatures: this.getCommandFeatures(command)
    };
  }

  /**
   * Get features supported by a command
   * @param {BaseVerbCommand} command - The command instance
   * @returns {string[]} List of supported features
   * @private
   */
  getCommandFeatures(command) {
    const features = [];

    if (command.schema) features.push('validation');
    if (command.strategies && command.strategies.size > 0) features.push('strategies');
    if (command.templateLoader) features.push('templates');

    return features;
  }

  /**
   * Get registry health status
   * @returns {Object} Health status information
   */
  getHealthStatus() {
    return {
      initialized: this.initialized,
      commandCount: this.commands.size,
      supportedVerbs: this.getSupportedVerbs(),
      contextServiceHealth: this.contextService.getHealthStatus(),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Reset registry (for testing)
   */
  reset() {
    this.commands.clear();
    this.contextService.reset();
    this.initialized = false;
    verbsLogger.debug('VerbCommandRegistry reset');
  }
}

export default VerbCommandRegistry;