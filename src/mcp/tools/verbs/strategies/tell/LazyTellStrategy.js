/**
 * LazyTellStrategy - Strategy for handling lazy tells
 *
 * Stores content without processing (no embeddings/concepts) for later processing.
 */

import { BaseStrategy } from '../BaseStrategy.js';
import { verbsLogger, logOperation } from '../../../VerbsLogger.js';

export class LazyTellStrategy extends BaseStrategy {
  constructor() {
    super('lazy');
    this.description = 'Store content without processing for later batch processing';
    this.supportedParameters = ['content', 'type', 'metadata'];
  }

  /**
   * Execute lazy tell strategy
   * @param {Object} params - Strategy parameters
   * @param {string} params.content - Content to store
   * @param {string} params.type - Content type
   * @param {Object} params.metadata - Content metadata
   * @param {Object} context - Execution context with services
   * @returns {Promise<Object>} Strategy result
   */
  async execute(params, context) {
    const { content, type, metadata = {} } = params;
    const { memoryManager } = context;

    try {
      this.logOperation('info', 'Storing content lazily', {
        contentLength: content.length,
        type: type,
        hasTitle: !!metadata.title,
        hasName: !!metadata.name
      });

      // Generate element ID
      const elementId = `semem:${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

      // Create meaningful titles from content when metadata is missing
      const getDocumentTitle = () => metadata.title || `Document: ${content.substring(0, 50).replace(/\n/g, ' ').trim()}...`;
      const getConceptName = () => metadata.name || `${content.substring(0, 30).replace(/\n/g, ' ').trim()}`;

      const prompt = type === 'document' ? getDocumentTitle() :
        type === 'concept' ? `Concept: ${getConceptName()}` :
          (content.length > 200 ? `${content.substring(0, 200)}...` : content);

      const lazyData = {
        id: elementId,
        content,
        type,
        prompt,
        title: metadata.title || metadata.name,
        metadata
      };

      // Validate memory manager store
      verbsLogger.debug('DEBUG MEMORY MANAGER:', !!memoryManager);
      verbsLogger.debug('DEBUG STORE:', !!memoryManager?.store);
      verbsLogger.debug('DEBUG STORE TYPE:', typeof memoryManager?.store);

      if (!memoryManager?.store) {
        throw new Error('Memory manager store is not available');
      }

      verbsLogger.debug('DEBUG STORE CONSTRUCTOR:', memoryManager.store.constructor.name);

      // Store lazy content
      let result;
      if (typeof memoryManager.store.storeLazyContent === 'function') {
        result = await memoryManager.store.storeLazyContent(lazyData);
      } else {
        throw new Error(`Store does not have storeLazyContent method. Store type: ${memoryManager.store.constructor.name}`);
      }

      logOperation('info', 'tell', 'Lazy tell operation completed', {
        type,
        elementId,
        contentLength: content.length
      });

      return this.createSuccessResponse({
        type,
        stored: true,
        lazy: true,
        contentLength: content.length,
        metadata: { ...metadata },
        concepts: 0,
        sessionCached: false,
        message: `Successfully stored ${type} content lazily (without processing)`,
        elementId
      });

    } catch (error) {
      return this.handleError(error, 'lazy storage', {
        contentLength: content.length,
        type
      });
    }
  }

  /**
   * Check if this strategy supports the given parameters
   * @param {Object} params - Parameters to check
   * @returns {boolean} Whether strategy supports the parameters
   */
  supports(params) {
    return params.lazy === true;
  }
}

export default LazyTellStrategy;