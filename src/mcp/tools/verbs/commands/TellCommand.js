/**
 * TellCommand - Command for storing content in semantic memory
 *
 * Implements the Command Pattern to replace the tell switch statement.
 * Uses Strategy Pattern to handle different content types and processing modes.
 */

import { BaseVerbCommand } from './BaseVerbCommand.js';
import { TellSchema } from '../../VerbSchemas.js';
import { verbsLogger, logOperation, logPerformance } from '../../VerbsLogger.js';
import { TellOperationTimer } from '../../../../utils/PerformanceTiming.js';

// Import tell strategies
import { InteractionTellStrategy } from '../strategies/tell/InteractionTellStrategy.js';
import { DocumentTellStrategy } from '../strategies/tell/DocumentTellStrategy.js';
import { ConceptTellStrategy } from '../strategies/tell/ConceptTellStrategy.js';
import { LazyTellStrategy } from '../strategies/tell/LazyTellStrategy.js';

export class TellCommand extends BaseVerbCommand {
  constructor() {
    super('tell');
    this.schema = TellSchema;
    this.strategies = new Map();
  }

  /**
   * Initialize command with strategies
   * @param {Object} context - Shared context
   */
  async onInitialize(context) {
    // Register strategies for different tell types and modes
    this.strategies.set('lazy', new LazyTellStrategy());
    this.strategies.set('interaction', new InteractionTellStrategy());
    this.strategies.set('document', new DocumentTellStrategy());
    this.strategies.set('concept', new ConceptTellStrategy());

    this.logOperation('debug', 'Tell command initialized with strategies', {
      strategiesCount: this.strategies.size,
      strategies: Array.from(this.strategies.keys())
    });
  }

  /**
   * Execute tell command
   * @param {Object} params - Command parameters
   * @param {string} params.content - Content to store
   * @param {string} params.type - Content type (interaction, document, concept)
   * @param {Object} params.metadata - Additional metadata
   * @param {boolean} params.lazy - Whether to use lazy processing
   * @returns {Promise<Object>} Command result
   */
  async execute(params) {
    const validatedParams = this.validateParameters(params);
    const { content, type = 'interaction', metadata = {}, lazy = false } = validatedParams;

    // Validate required parameters
    if (!content || typeof content !== 'string') {
      logOperation('error', 'tell', 'Invalid content parameter', { content: typeof content });
      return {
        success: false,
        error: 'Content is required and must be a string',
        verb: 'tell',
        id: null,
        conceptsExtracted: 0
      };
    }

    const tellTimer = new TellOperationTimer(content);
    tellTimer.startPhase('initialization');

    try {
      this.logOperation('info', 'Tell operation started', {
        type,
        contentLength: content.length,
        lazy,
        contentPreview: content.substring(0, 50) + (content.length > 50 ? '...' : ''),
        metadata: Object.keys(metadata)
      });

      tellTimer.endPhase('initialization');
      tellTimer.startPhase('content_processing');

      // Select appropriate strategy
      const strategy = this.selectStrategy({ content, type, metadata, lazy });
      if (!strategy) {
        throw new Error(`No strategy found for tell type: ${type}, lazy: ${lazy}`);
      }

      this.logOperation('debug', 'Selected strategy', {
        strategyName: strategy.name,
        type,
        lazy
      });

      // Execute strategy
      const strategyResult = await strategy.execute(
        { content, type, metadata, lazy },
        {
          memoryManager: this.memoryManager,
          safeOps: this.safeOps,
          stateManager: this.stateManager
        }
      );

      if (!strategyResult.success) {
        throw new Error(strategyResult.error || 'Strategy execution failed');
      }

      // Handle session caching for non-lazy processed content
      let sessionCached = false;
      if (!lazy && strategyResult.embedding && strategyResult.concepts) {
        await this.addToSessionCache(
          strategyResult.prompt,
          strategyResult.content || content,
          strategyResult.embedding,
          strategyResult.concepts,
          { ...metadata, type: `tell_${type}`, storedAt: Date.now() }
        );
        sessionCached = true;

        this.logOperation('info', 'Tell operation completed with session caching', {
          type,
          conceptCount: strategyResult.concepts.length,
          sessionCacheSize: this.stateManager.sessionCache.interactions.size
        });
      }

      tellTimer.endPhase('content_processing');
      const perfData = tellTimer.complete();

      // Log performance data in neutral format
      logPerformance('tell', {
        duration: perfData.totalDuration,
        phases: perfData.phases,
        success: true,
        type,
        lazy,
        conceptCount: strategyResult.concepts?.length || 0
      });

      return this.createSuccessResponse({
        content,  // Include content for MCP protocol compatibility
        type,
        stored: true,
        contentLength: content.length,
        metadata: { ...metadata },
        concepts: strategyResult.concepts?.length || 0,
        sessionCached,
        zptState: this.stateManager.getState(),
        performance: perfData,
        message: `Successfully stored ${type} content${lazy ? ' lazily (without processing)' : ''}`,
        // Include strategy-specific data
        ...strategyResult
      });

    } catch (error) {
      const perfData = tellTimer.complete(error);

      // Log performance data for failed operation
      logPerformance('tell', {
        duration: perfData.totalDuration,
        phases: perfData.phases,
        success: false,
        error: error.message,
        type,
        lazy
      });

      return this.handleError(error, 'tell operation', {
        type,
        lazy,
        performance: perfData,
        zptState: this.stateManager.getState()
      });
    }
  }

  /**
   * Select appropriate strategy based on parameters
   * @param {Object} params - Tell parameters
   * @returns {BaseStrategy} Selected strategy
   * @private
   */
  selectStrategy(params) {
    const { lazy, type } = params;

    // Lazy processing takes precedence
    if (lazy) {
      return this.strategies.get('lazy');
    }

    // Select by type
    return this.strategies.get(type) || this.strategies.get('interaction');
  }

  /**
   * Add processed content to session cache
   * @param {string} prompt - Content prompt
   * @param {string} response - Content response
   * @param {Array} embedding - Content embedding
   * @param {Array} concepts - Extracted concepts
   * @param {Object} metadata - Additional metadata
   * @private
   */
  async addToSessionCache(prompt, response, embedding, concepts, metadata) {
    const sessionId = `${this.stateManager.state.sessionId}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    await this.stateManager.addToSessionCache(
      sessionId,
      prompt,
      response,
      embedding,
      concepts,
      metadata
    );
  }
}

export default TellCommand;