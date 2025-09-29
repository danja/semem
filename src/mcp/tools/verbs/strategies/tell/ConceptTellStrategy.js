/**
 * ConceptTellStrategy - Strategy for handling 'concept' type tells
 *
 * Processes content as concept definitions with appropriate labeling and metadata.
 */

import { BaseStrategy } from '../BaseStrategy.js';

export class ConceptTellStrategy extends BaseStrategy {
  constructor() {
    super('concept');
    this.description = 'Process content as concept definitions';
    this.supportedParameters = ['content', 'metadata'];
  }

  /**
   * Execute concept tell strategy
   * @param {Object} params - Strategy parameters
   * @param {string} params.content - Concept content to process
   * @param {Object} params.metadata - Concept metadata (name, etc.)
   * @param {Object} context - Execution context with services
   * @returns {Promise<Object>} Strategy result
   */
  async execute(params, context) {
    const { content, metadata = {} } = params;
    const { safeOps } = context;

    try {
      this.logOperation('info', 'Processing concept content', {
        contentLength: content.length,
        conceptName: metadata.name || 'Unnamed',
        contentPreview: content.substring(0, 50) + (content.length > 50 ? '...' : '')
      });

      // Generate embedding and extract concepts
      const embedding = await safeOps.generateEmbedding(content);
      const concepts = await safeOps.extractConcepts(content);
      const prompt = `Concept: ${metadata.name || 'Unnamed'}`;
      const response = content;

      // Store the concept
      const result = await safeOps.storeInteraction(
        prompt,
        response,
        { ...metadata, type: 'tell_concept', concepts }
      );

      this.logOperation('info', 'Concept processed successfully', {
        conceptCount: concepts.length,
        embeddingDimension: embedding.length,
        conceptName: metadata.name
      });

      return this.createSuccessResponse({
        result,
        embedding,
        concepts,
        prompt,
        contentLength: content.length,
        augmentationType: 'concept'
      });

    } catch (error) {
      return this.handleError(error, 'process concept', {
        contentLength: content.length,
        conceptName: metadata.name
      });
    }
  }

  /**
   * Check if this strategy supports the given parameters
   * @param {Object} params - Parameters to check
   * @returns {boolean} Whether strategy supports the parameters
   */
  supports(params) {
    return params.type === 'concept';
  }
}

export default ConceptTellStrategy;