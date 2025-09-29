/**
 * ConceptsStrategy - Extract concepts from target content
 *
 * Handles the 'concepts' augment operation with optional embedding generation.
 */

import { BaseStrategy } from '../BaseStrategy.js';
import { logOperation, verbsLogger } from '../../../VerbsLogger.js';

export class ConceptsStrategy extends BaseStrategy {
  constructor() {
    super('concepts');
    this.description = 'Extract concepts from content with optional embeddings';
    this.supportedParameters = ['target', 'includeEmbeddings', 'maxConcepts', 'embeddingModel', 'batchSize', 'graph'];
  }

  /**
   * Execute concepts extraction strategy
   * @param {Object} params - Strategy parameters
   * @param {string} params.target - Target content to extract concepts from
   * @param {Object} params.options - Additional options
   * @param {Object} context - Execution context with services
   * @returns {Promise<Object>} Strategy result
   */
  async execute(params, context) {
    const { target, options = {} } = params;
    const { safeOps } = context;

    // Validate target for this operation
    if (!target || target === 'all') {
      return this.handleError(
        new Error('Operation "concepts" requires specific target content, not "all"'),
        'validate target',
        { target }
      );
    }

    try {
      this.logOperation('info', 'Extracting concepts from target content', {
        targetLength: target.length,
        targetPreview: target.substring(0, 50) + '...',
        includeEmbeddings: !!options.includeEmbeddings
      });

      // Extract concepts from target content
      const extractedConcepts = await safeOps.extractConcepts(target);

      // If includeEmbeddings option is set, generate embeddings for concepts
      if (options.includeEmbeddings) {
        return await this.generateConceptEmbeddings(extractedConcepts, options, context);
      } else {
        return this.createSuccessResponse({
          concepts: extractedConcepts,
          augmentationType: 'concepts'
        });
      }

    } catch (error) {
      return this.handleError(error, 'extract concepts', {
        targetLength: target?.length,
        includeEmbeddings: options.includeEmbeddings
      });
    }
  }

  /**
   * Generate embeddings for extracted concepts
   * @param {Array} extractedConcepts - Concepts to generate embeddings for
   * @param {Object} options - Options including embedding parameters
   * @param {Object} context - Execution context
   * @returns {Promise<Object>} Strategy result with embeddings
   * @private
   */
  async generateConceptEmbeddings(extractedConcepts, options, context) {
    const { safeOps, memoryManager } = context;
    const { maxConcepts = 20, embeddingModel = 'nomic-embed-text', batchSize = 5, graph } = options;

    verbsLogger.info('🔮 [CONCEPTS] Generating embeddings for extracted concepts...');

    try {
      const conceptsToProcess = extractedConcepts.slice(0, maxConcepts);
      const conceptEmbeddings = [];

      // Get SPARQL configuration
      const config = memoryManager.config;
      const storageConfig = config.get('storage.options');
      // Use graph option, or storage.options.graphName, or fallback to top-level graphName, or default
      const targetGraph = graph || storageConfig?.graphName || config.get('graphName');

      // Import utilities
      const { URIMinter } = await import('../../../../../utils/URIMinter.js');
      const SPARQLHelper = (await import('../../../../../services/sparql/SPARQLHelper.js')).default;
      const sparqlHelper = new SPARQLHelper(storageConfig.update, {
        user: storageConfig.user,
        password: storageConfig.password
      });

      // Process concepts in batches
      for (let i = 0; i < conceptsToProcess.length; i += batchSize) {
        const batch = conceptsToProcess.slice(i, i + batchSize);
        for (const concept of batch) {
          try {
            const conceptEmbedding = await safeOps.generateEmbedding(concept);
            const conceptUri = URIMinter.mintURI('http://purl.org/stuff/instance/', 'concept', concept);
            const embeddingUri = URIMinter.mintURI('http://purl.org/stuff/instance/', 'embedding', concept);

            // Store using ragno format
            const insertQuery = `
              PREFIX ragno: <http://purl.org/stuff/ragno/>
              PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
              PREFIX dcterms: <http://purl.org/dc/terms/>
              PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>

              INSERT DATA {
                  GRAPH <${targetGraph}> {
                      <${conceptUri}> a ragno:Concept ;
                                      skos:prefLabel "${concept.replace(/"/g, '\\"')}" ;
                                      ragno:hasEmbedding <${embeddingUri}> ;
                                      dcterms:created "${new Date().toISOString()}"^^xsd:dateTime .

                      <${embeddingUri}> a ragno:IndexElement ;
                                        ragno:embeddingModel "${embeddingModel}" ;
                                        ragno:subType ragno:ConceptEmbedding ;
                                        ragno:embeddingDimension ${conceptEmbedding.length} ;
                                        ragno:vectorContent "[${conceptEmbedding.join(',')}]" .
                  }
              }
            `;

            await sparqlHelper.executeUpdate(insertQuery);
            conceptEmbeddings.push({
              concept,
              uri: conceptUri,
              embeddingDimension: conceptEmbedding.length
            });
          } catch (error) {
            logOperation('warn', 'augment', 'Failed to generate embedding for concept', {
              concept,
              error: error.message
            });
          }
        }
      }

      verbsLogger.info(`✅ [CONCEPTS] Generated embeddings for ${conceptEmbeddings.length} concepts`);

      return this.createSuccessResponse({
        concepts: extractedConcepts,
        embeddedConcepts: conceptEmbeddings,
        totalEmbeddings: conceptEmbeddings.length,
        embeddingModel: embeddingModel,
        augmentationType: 'concepts_with_embeddings'
      });

    } catch (embeddingError) {
      verbsLogger.warn('⚠️ [CONCEPTS] Embedding generation failed:', embeddingError.message);

      return this.createSuccessResponse({
        concepts: extractedConcepts,
        embeddingError: embeddingError.message,
        augmentationType: 'concepts_embedding_failed'
      });
    }
  }

  /**
   * Check if this strategy supports the given operation
   * @param {Object} params - Parameters to check
   * @returns {boolean} Whether strategy supports the parameters
   */
  supports(params) {
    return params.operation === 'concepts';
  }
}

export default ConceptsStrategy;