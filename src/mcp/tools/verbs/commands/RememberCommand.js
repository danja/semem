/**
 * RememberCommand - Store content in specific memory domain with importance weighting
 *
 * Handles domain-specific memory storage with importance and metadata.
 */

import { BaseVerbCommand } from './BaseVerbCommand.js';
import { RememberSchema } from '../../VerbSchemas.js';
import { logOperation } from '../../VerbsLogger.js';

export class RememberCommand extends BaseVerbCommand {
  constructor() {
    super('remember');
    this.schema = RememberSchema;
  }

  /**
   * Execute remember command
   * @param {Object} params - Command parameters
   * @param {string} params.content - Content to remember
   * @param {string} params.domain - Memory domain (user, project, session, instruction)
   * @param {string} params.domainId - Domain identifier
   * @param {number} params.importance - Importance weighting (0-1)
   * @param {Object} params.metadata - Additional metadata
   * @returns {Promise<Object>} Command result
   */
  async execute(params) {
    const validatedParams = this.validateParameters(params);
    const { content, domain = 'user', domainId, importance = 0.5, metadata = {} } = validatedParams;

    try {
      this.logOperation('debug', 'Simple Verb: remember', {
        domain,
        domainId,
        importance,
        contentLength: content.length
      });

      // Create domain if needed
      if (domainId && domain !== 'session') {
        await this.memoryDomainManager.createDomain(domain, domainId, {
          description: metadata.description,
          tags: metadata.tags
        });
      }

      // Store memory with domain association
      const memoryData = {
        content: content,
        domain: domain,
        domainId: domainId || this.stateManager.getState().sessionId,
        importance: importance,
        timestamp: Date.now(),
        metadata: {
          ...metadata,
          source: 'remember_verb'
        }
      };

      // Use tell mechanism but with domain-specific storage
      const result = await this.executeCommand('tell', {
        content: content,
        type: 'interaction',
        metadata: memoryData
      });

      return this.createSuccessResponse({
        domain: domain,
        domainId: domainId || this.stateManager.getState().sessionId,
        importance: importance,
        stored: result.stored,
        zptState: this.stateManager.getState()
      });

    } catch (error) {
      return this.handleError(error, 'remember operation', {
        domain,
        domainId,
        importance
      });
    }
  }

  /**
   * Execute another command (helper for tell integration)
   * @param {string} command - Command name
   * @param {Object} params - Command parameters
   * @private
   */
  async executeCommand(command, params) {
    // This would ideally use the registry, but for now we'll use the memoryManager
    if (command === 'tell') {
      // Generate embedding and concepts
      const embedding = await this.safeOps.generateEmbedding(params.content);
      const concepts = await this.safeOps.extractConcepts(params.content);

      // Store the interaction
      return await this.safeOps.storeInteraction(
        params.content.length > 200 ? `${params.content.substring(0, 200)}...` : params.content,
        params.content,
        { ...params.metadata, type: 'tell_interaction', concepts }
      );
    }
    throw new Error(`Unknown command: ${command}`);
  }
}

export default RememberCommand;