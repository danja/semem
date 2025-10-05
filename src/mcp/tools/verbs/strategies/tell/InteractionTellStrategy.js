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
        contentPreview: content.substring(0, 50) + (content.length > 50 ? '...' : ''),
        hasLabel: !!metadata.chunkLabel,
        source: metadata.source
      });

      // Generate embedding and extract concepts
      this.logOperation('debug', 'Generating embedding for content');
      let embedding;
      try {
        embedding = await safeOps.generateEmbedding(content);
        this.logOperation('debug', 'Embedding generated successfully', {
          dimension: embedding?.length
        });
      } catch (embError) {
        this.logOperation('error', 'Embedding generation failed', {
          error: embError.message,
          contentLength: content.length
        });
        throw embError;
      }

      this.logOperation('debug', 'Extracting concepts from content');
      let concepts;
      try {
        concepts = await safeOps.extractConcepts(content);
        this.logOperation('debug', 'Concepts extracted successfully', {
          conceptCount: concepts?.length || 0
        });
      } catch (conceptError) {
        this.logOperation('warn', 'Concept extraction failed, continuing without concepts', {
          error: conceptError.message
        });
        concepts = []; // Continue without concepts rather than failing
      }

      // Create reasonable prompt for display
      const prompt = content.length > 200 ? `${content.substring(0, 200)}...` : content;
      const response = content;

      // Use chunkLabel from metadata if provided, otherwise use prompt
      const label = metadata.chunkLabel || prompt;

      this.logOperation('debug', 'Storing interaction', {
        hasLabel: !!label,
        label: label?.substring(0, 50),
        conceptCount: concepts.length
      });

      // Store the interaction
      let result;
      try {
        result = await safeOps.storeInteraction(
          prompt,
          response,
          { ...metadata, type: 'tell_interaction', concepts, label }
        );
        this.logOperation('debug', 'Interaction stored successfully', {
          resultSuccess: result?.success
        });
      } catch (storeError) {
        this.logOperation('error', 'Failed to store interaction', {
          error: storeError.message,
          stack: storeError.stack
        });
        throw storeError;
      }

      this.logOperation('info', 'Interaction processed successfully', {
        conceptCount: concepts.length,
        embeddingDimension: embedding.length,
        label: label?.substring(0, 50)
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
      this.logOperation('error', 'Interaction processing failed', {
        error: error.message,
        stack: error.stack,
        contentLength: content.length,
        source: metadata.source
      });
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