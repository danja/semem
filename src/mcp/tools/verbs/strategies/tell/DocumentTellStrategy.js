/**
 * DocumentTellStrategy - Strategy for handling 'document' type tells
 *
 * Processes larger documents with chunking for content over size limits.
 * Handles both small documents (direct processing) and large documents (chunking).
 */

import { BaseStrategy } from '../BaseStrategy.js';
import { verbsLogger } from '../../../VerbsLogger.js';

export class DocumentTellStrategy extends BaseStrategy {
  constructor() {
    super('document');
    this.description = 'Process documents with automatic chunking for large content';
    this.supportedParameters = ['content', 'metadata'];
    this.MAX_EMBEDDING_SIZE = 8000; // Conservative limit for embedding APIs
  }

  /**
   * Execute document tell strategy
   * @param {Object} params - Strategy parameters
   * @param {string} params.content - Document content to process
   * @param {Object} params.metadata - Document metadata (title, filename, etc.)
   * @param {Object} context - Execution context with services
   * @returns {Promise<Object>} Strategy result
   */
  async execute(params, context) {
    const { content, metadata = {} } = params;
    const { safeOps } = context;

    try {
      this.logOperation('info', 'Processing document content', {
        contentLength: content.length,
        needsChunking: content.length > this.MAX_EMBEDDING_SIZE,
        title: metadata.title || 'Untitled'
      });

      if (content.length > this.MAX_EMBEDDING_SIZE) {
        return await this._processLargeDocument(content, metadata, context);
      } else {
        return await this._processSmallDocument(content, metadata, context);
      }

    } catch (error) {
      return this.handleError(error, 'process document', {
        contentLength: content.length,
        title: metadata.title
      });
    }
  }

  /**
   * Process small documents directly
   * @private
   */
  async _processSmallDocument(content, metadata, context) {
    const { safeOps } = context;

    verbsLogger.info(`📄 Processing document (${content.length} chars - under limit)...`);

    const embedding = await safeOps.generateEmbedding(content);
    const concepts = await safeOps.extractConcepts(content);
    const prompt = `Document: ${metadata.title || 'Untitled'}`;
    const response = content;

    const result = await safeOps.storeInteraction(
      prompt,
      response,
      { ...metadata, type: 'tell_document', concepts }
    );

    verbsLogger.info(`✅ Document processed successfully (${concepts.length} concepts extracted)`);

    return this.createSuccessResponse({
      result,
      embedding,
      concepts,
      prompt,
      contentLength: content.length,
      augmentationType: 'document',
      chunked: false
    });
  }

  /**
   * Process large documents with chunking
   * @private
   */
  async _processLargeDocument(content, metadata, context) {
    const { safeOps } = context;

    verbsLogger.info(`📚 Document too large (${content.length} chars > ${this.MAX_EMBEDDING_SIZE}). Chunking into smaller pieces...`);

    // Import chunker for large documents
    const Chunker = (await import('../../../../../services/document/Chunker.js')).default;
    const chunker = new Chunker({
      maxChunkSize: 2000,
      minChunkSize: 100,
      overlapSize: 100,
      strategy: 'semantic'
    });

    let chunkingResult;
    try {
      // Chunk the document
      chunkingResult = await chunker.chunk(content, {
        title: metadata.title || 'Untitled Document',
        sourceFile: metadata.filename || 'unknown'
      });

      verbsLogger.info(`✂️  Created ${chunkingResult.chunks.length} chunks for processing`);
    } catch (chunkingError) {
      verbsLogger.error('❌ Error during document chunking:', chunkingError.message);
      throw new Error(`Failed to chunk large document: ${chunkingError.message}. Document size: ${content.length} characters.`);
    }

    // Process each chunk separately
    const chunkResults = [];
    let allConcepts = [];

    for (let i = 0; i < chunkingResult.chunks.length; i++) {
      const chunk = chunkingResult.chunks[i];
      try {
        verbsLogger.info(`🧩 Processing chunk ${i + 1}/${chunkingResult.chunks.length} (${chunk.size} chars)...`);

        const chunkEmbedding = await safeOps.generateEmbedding(chunk.content);
        const chunkConcepts = await safeOps.extractConcepts(chunk.content);
        const chunkPrompt = `Document: ${metadata.title || 'Untitled'} (Chunk ${i + 1}/${chunkingResult.chunks.length})`;

        const chunkResult = await safeOps.storeInteraction(
          chunkPrompt,
          chunk.content,
          {
            ...metadata,
            type: 'tell_document_chunk',
            chunkIndex: i,
            totalChunks: chunkingResult.chunks.length,
            chunkSize: chunk.size,
            concepts: chunkConcepts
          }
        );

        chunkResults.push(chunkResult);
        allConcepts = [...allConcepts, ...chunkConcepts];

        verbsLogger.info(`✅ Chunk ${i + 1} processed successfully (${chunkConcepts.length} concepts extracted)`);
      } catch (chunkError) {
        verbsLogger.error(`❌ Error processing chunk ${i + 1}:`, chunkError.message);
        // Don't throw here - continue with other chunks but log the failure
        chunkResults.push({
          error: true,
          message: `Failed to process chunk ${i + 1}: ${chunkError.message}`,
          chunkIndex: i,
          chunkSize: chunk.size
        });
      }
    }

    // Store document summary with aggregated concepts
    const concepts = [...new Set(allConcepts)]; // Remove duplicates
    const prompt = `Document: ${metadata.title || 'Untitled'} (${chunkingResult.chunks.length} chunks)`;

    const result = {
      ...chunkResults[0], // Use first chunk as base result
      chunks: chunkResults.length,
      totalConcepts: concepts.length,
      chunkingMetadata: chunkingResult.metadata
    };

    return this.createSuccessResponse({
      result,
      concepts,
      prompt,
      contentLength: content.length,
      augmentationType: 'document',
      chunked: true,
      chunkResults,
      chunkCount: chunkingResult.chunks.length
    });
  }

  /**
   * Check if this strategy supports the given parameters
   * @param {Object} params - Parameters to check
   * @returns {boolean} Whether strategy supports the parameters
   */
  supports(params) {
    return params.type === 'document';
  }
}

export default DocumentTellStrategy;