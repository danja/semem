/**
 * InteractionTellStrategy - Strategy for handling 'interaction' type tells
 *
 * Processes content as semantic memory interactions with embeddings and concepts.
 */

import { BaseStrategy } from '../BaseStrategy.js';
import { logOperation } from '../../../VerbsLogger.js';

export class InteractionTellStrategy extends BaseStrategy {
  constructor() {
    super('interaction');
    this.description = 'Process content as semantic memory interactions';
    this.supportedParameters = ['content', 'metadata'];
  }

  /**
   * Execute interaction tell strategy
   * @param {Object} params - Strategy parameters
   * @param {string} params.content - Content to process
   * @param {Object} params.metadata - Additional metadata
   * @param {Object} context - Execution context with services
   * @returns {Promise<Object>} Strategy result
   */
  async execute(params, context) {
    const { content, metadata = {} } = params;
    const { safeOps } = context;

    try {
      this.logOperation('info', 'Processing interaction content', {
        contentLength: content.length,
        contentPreview: content.substring(0, 50) + (content.length > 50 ? '...' : '')
      });

      // Generate embedding and extract concepts
      const embedding = await safeOps.generateEmbedding(content);
      const concepts = await safeOps.extractConcepts(content);

      // Create reasonable prompt for display
      const prompt = content.length > 200 ? `${content.substring(0, 200)}...` : content;
      const response = content;

      // Use chunkLabel from metadata if provided, otherwise use prompt
      const label = metadata.chunkLabel || prompt;

      // Store the interaction
      const result = await safeOps.storeInteraction(
        prompt,
        response,
        { ...metadata, type: 'tell_interaction', concepts, label }
      );

      this.logOperation('info', 'Interaction processed successfully', {
        conceptCount: concepts.length,
        embeddingDimension: embedding.length
      });

      return this.createSuccessResponse({
        result,
        embedding,
        concepts,
        prompt,
        contentLength: content.length,
        augmentationType: 'interaction'
      });

    } catch (error) {
      return this.handleError(error, 'process interaction', {
        contentLength: content.length
      });
    }
  }

  /**
   * Check if this strategy supports the given parameters
   * @param {Object} params - Parameters to check
   * @returns {boolean} Whether strategy supports the parameters
   */
  supports(params) {
    return params.type === 'interaction' || !params.type; // Default type
  }
}

export default InteractionTellStrategy;