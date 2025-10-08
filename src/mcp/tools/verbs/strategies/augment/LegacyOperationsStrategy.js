/**
 * LegacyOperationsStrategy - Handle legacy augment operations
 *
 * Handles backward compatibility operations: extract_concepts, generate_embedding,
 * analyze_text, and concept_embeddings.
 */

import { BaseStrategy } from '../BaseStrategy.js';
import { logOperation, verbsLogger } from '../../../VerbsLogger.js';
import SPARQLTemplateLoader from '../../../../../stores/SPARQLTemplateLoader.js';

const templateLoader = new SPARQLTemplateLoader();

export class LegacyOperationsStrategy extends BaseStrategy {
  constructor() {
    super('legacy_operations');
    this.description = 'Handle legacy augment operations for backward compatibility';
    this.supportedParameters = ['target', 'operation', 'maxConcepts', 'embeddingModel', 'batchSize', 'graph'];
  }

  /**
   * Execute legacy operation strategy
   * @param {Object} params - Strategy parameters
   * @param {string} params.target - Target content
   * @param {string} params.operation - Legacy operation name
   * @param {Object} params.options - Additional options
   * @param {Object} context - Execution context with services
   * @returns {Promise<Object>} Strategy result
   */
  async execute(params, context) {
    const { target, operation, options = {} } = params;
    const { safeOps } = context;

    try {
      this.logOperation('info', `Executing legacy operation: ${operation}`, {
        operation,
        targetLength: target?.length,
        hasOptions: Object.keys(options).length > 0
      });

      switch (operation) {
        case 'extract_concepts':
          return await this.handleExtractConcepts(target, safeOps);

        case 'generate_embedding':
          return await this.handleGenerateEmbedding(target, safeOps);

        case 'analyze_text':
          return await this.handleAnalyzeText(target, safeOps);

        case 'concept_embeddings':
          return await this.handleConceptEmbeddings(target, options, context);

        default:
          throw new Error(`Unsupported legacy operation: ${operation}`);
      }

    } catch (error) {
      return this.handleError(error, `legacy operation ${operation}`, {
        operation,
        targetLength: target?.length
      });
    }
  }

  /**
   * Handle extract_concepts legacy operation
   * @private
   */
  async handleExtractConcepts(target, safeOps) {
    const result = await safeOps.extractConcepts(target);

    return this.createSuccessResponse({
      concepts: result,
      augmentationType: 'extract_concepts'
    });
  }

  /**
   * Handle generate_embedding legacy operation
   * @private
   */
  async handleGenerateEmbedding(target, safeOps) {
    const embedding = await safeOps.generateEmbedding(target);

    return this.createSuccessResponse({
      embedding: {
        dimension: embedding.length,
        preview: embedding.slice(0, 5).map(x => parseFloat(x.toFixed(4))),
        model: 'default'
      },
      augmentationType: 'generate_embedding'
    });
  }

  /**
   * Handle analyze_text legacy operation
   * @private
   */
  async handleAnalyzeText(target, safeOps) {
    // Analyze text combines concept extraction and embedding
    const [analysisEmbedding, concepts] = await Promise.all([
      safeOps.generateEmbedding(target),
      safeOps.extractConcepts(target)
    ]);

    return this.createSuccessResponse({
      concepts,
      embedding: {
        dimension: analysisEmbedding.length,
        preview: analysisEmbedding.slice(0, 5).map(x => parseFloat(x.toFixed(4)))
      },
      textLength: target.length,
      augmentationType: 'analyze_text'
    });
  }

  /**
   * Handle concept_embeddings legacy operation
   * @private
   */
  async handleConceptEmbeddings(target, options, context) {
    const { safeOps, memoryManager } = context;

    verbsLogger.info('🔮 [CONCEPT_EMBEDDINGS] Extracting concepts and generating embeddings using new ragno format');

    try {
      const {
        maxConcepts = 20,
        embeddingModel = 'nomic-embed-text',
        batchSize = 5,
        graph
      } = options;

      // Extract concepts first
      const extractedConcepts = await safeOps.extractConcepts(target);
      const conceptsToProcess = extractedConcepts.slice(0, maxConcepts);

      if (conceptsToProcess.length === 0) {
        return this.createSuccessResponse({
          concepts: [],
          embeddedConcepts: [],
          message: 'No concepts extracted from target content',
          augmentationType: 'concept_embeddings'
        });
      }

      // Get configuration for SPARQL storage
      const config = memoryManager.config;
      const storageConfig = config.get('storage.options');
      const targetGraph = graph || storageConfig?.graphName || config.get('graphName');

      // Import utilities for ragno format storage
      const { URIMinter } = await import('../../../../../utils/URIMinter.js');
      const SPARQLHelper = (await import('../../../../../services/sparql/SPARQLHelper.js')).default;

      const sparqlHelper = new SPARQLHelper(storageConfig.update, {
        user: storageConfig.user,
        password: storageConfig.password
      });

      const conceptEmbeddings = [];

      // Process concepts in batches
      for (let i = 0; i < conceptsToProcess.length; i += batchSize) {
        const batch = conceptsToProcess.slice(i, i + batchSize);

        for (const concept of batch) {
          try {
            const conceptEmbedding = await safeOps.generateEmbedding(concept);
            const conceptUri = URIMinter.mintURI('http://purl.org/stuff/instance/', 'concept', concept);
            const embeddingUri = URIMinter.mintURI('http://purl.org/stuff/instance/', 'embedding', concept);
            const conceptLabel = concept.replace(/"/g, '\\"');
            const vectorContent = JSON.stringify(conceptEmbedding).replace(/"/g, '\\"');
            const createdAt = new Date().toISOString();

            // Store using ragno format
            const insertQuery = await templateLoader.loadAndInterpolate('store', 'insert-concept-embedding', {
              graph: targetGraph,
              conceptUri,
              conceptLabel,
              embeddingUri,
              embeddingModel,
              embeddingDimension: conceptEmbedding.length,
              vectorContent,
              createdAt
            });

            if (!insertQuery) {
              throw new Error('Concept embedding SPARQL template missing');
            }

            await sparqlHelper.executeUpdate(insertQuery);

            conceptEmbeddings.push({
              concept,
              conceptUri,
              embeddingUri,
              embeddingDimension: conceptEmbedding.length,
              embeddingModel
            });

          } catch (error) {
            logOperation('warn', 'augment', 'Failed to generate embedding for concept in legacy operation', {
              concept,
              error: error.message
            });
          }
        }
      }

      verbsLogger.info(`✅ [CONCEPT_EMBEDDINGS] Generated embeddings for ${conceptEmbeddings.length} concepts using ragno format`);

      return this.createSuccessResponse({
        concepts: extractedConcepts,
        embeddedConcepts: conceptEmbeddings,
        totalConcepts: extractedConcepts.length,
        totalProcessed: conceptEmbeddings.length,
        totalEmbeddings: conceptEmbeddings.length,
        embeddingModel,
        targetGraph,
        augmentationType: 'concept_embeddings'
      });

    } catch (error) {
      verbsLogger.error('❌ [CONCEPT_EMBEDDINGS] Legacy operation failed:', error.message);

      return this.createSuccessResponse({
        concepts: [],
        embeddedConcepts: [],
        error: error.message,
        augmentationType: 'concept_embeddings_failed'
      });
    }
  }

  /**
   * Check if this strategy supports the given operation
   * @param {Object} params - Parameters to check
   * @returns {boolean} Whether strategy supports the parameters
   */
  supports(params) {
    const legacyOps = ['extract_concepts', 'generate_embedding', 'analyze_text', 'concept_embeddings'];
    return legacyOps.includes(params.operation);
  }
}

export default LegacyOperationsStrategy;
