/**
 * ChunkDocumentsStrategy - Chunk documents stored in SPARQL
 *
 * Handles the 'chunk_documents' augment operation for processing large documents
 * by breaking them into manageable chunks with embeddings.
 */

import path from 'path';
import { BaseStrategy } from '../BaseStrategy.js';
import { logOperation, verbsLogger } from '../../../VerbsLogger.js';

export class ChunkDocumentsStrategy extends BaseStrategy {
  constructor() {
    super('chunk_documents');
    this.description = 'Chunk documents stored in SPARQL that haven\'t been processed yet';
    this.supportedParameters = [
      'target', 'maxChunkSize', 'minChunkSize', 'overlapSize',
      'strategy', 'minContentLength', 'graph'
    ];
  }

  /**
   * Execute document chunking strategy
   * @param {Object} params - Strategy parameters
   * @param {string} params.target - Target to chunk ('all' or specific URI/content)
   * @param {Object} params.options - Chunking options
   * @param {Object} context - Execution context with services
   * @returns {Promise<Object>} Strategy result
   */
  async execute(params, context) {
    const { target, options = {} } = params;
    const { memoryManager, safeOps } = context;

    verbsLogger.info('🔄 [CHUNK_DOCUMENTS] Case triggered - starting chunking process');
    logOperation('info', 'augment', 'chunk_documents case triggered', {
      target: target.substring(0, 50),
      options
    });

    try {
      const chunkingOptions = this.extractChunkingOptions(options);
      const dependencies = await this.loadDependencies();
      const services = await this.initializeServices(chunkingOptions, dependencies, memoryManager);

      const textElementsToProcess = await this.findTextElementsToProcess(
        target,
        chunkingOptions,
        services
      );

      if (textElementsToProcess.length === 0) {
        return this.createSuccessResponse({
          chunkedDocuments: [],
          message: 'No eligible text elements found for chunking',
          augmentationType: 'chunk_documents'
        });
      }

      const chunkedResults = await this.processTextElements(
        textElementsToProcess,
        services,
        safeOps
      );

      return this.createSuccessResponse({
        chunkedDocuments: chunkedResults,
        processedCount: chunkedResults.length,
        message: `Successfully chunked ${chunkedResults.length} documents`,
        augmentationType: 'chunk_documents'
      });

    } catch (error) {
      return this.handleError(error, 'chunk documents', {
        target,
        optionsKeys: Object.keys(options)
      });
    }
  }

  /**
   * Extract and validate chunking options
   * @param {Object} options - Raw options
   * @returns {Object} Validated chunking options
   * @private
   */
  extractChunkingOptions(options) {
    return {
      maxChunkSize: options.maxChunkSize || 2000,
      minChunkSize: options.minChunkSize || 100,
      overlapSize: options.overlapSize || 100,
      strategy: options.strategy || 'semantic',
      minContentLength: options.minContentLength || 2000,
      graph: options.graph
    };
  }

  /**
   * Load required dependencies
   * @returns {Object} Loaded dependencies
   * @private
   */
  async loadDependencies() {
    const Chunker = (await import('../../../../services/document/Chunker.js')).default;
    const { SPARQLQueryService } = await import('../../../../services/sparql/index.js');
    const SPARQLHelper = (await import('../../../../services/sparql/SPARQLHelper.js')).default;
    const { URIMinter } = await import('../../../../utils/URIMinter.js');

    return { Chunker, SPARQLQueryService, SPARQLHelper, URIMinter };
  }

  /**
   * Initialize required services
   * @param {Object} chunkingOptions - Chunking configuration
   * @param {Object} dependencies - Loaded dependencies
   * @param {Object} memoryManager - Memory manager instance
   * @returns {Object} Initialized services
   * @private
   */
  async initializeServices(chunkingOptions, dependencies, memoryManager) {
    const { Chunker, SPARQLQueryService, SPARQLHelper, URIMinter } = dependencies;
    const config = memoryManager.config;
    const storageConfig = config.get('storage.options');

    // Determine target graph
    const targetGraph = chunkingOptions.graph ||
                       storageConfig?.graphName ||
                       config.get('graphName');

    // Initialize services with explicit paths
    const projectRoot = process.cwd();
    const queryService = new SPARQLQueryService({
      queryPath: path.join(projectRoot, 'sparql/queries'),
      templatePath: path.join(projectRoot, 'sparql/templates'),
      configPath: path.join(projectRoot, 'sparql/config')
    });

    const sparqlHelper = new SPARQLHelper(storageConfig.update, {
      user: storageConfig.user,
      password: storageConfig.password
    });

    const chunker = new Chunker({
      maxChunkSize: chunkingOptions.maxChunkSize,
      minChunkSize: chunkingOptions.minChunkSize,
      overlapSize: chunkingOptions.overlapSize,
      strategy: chunkingOptions.strategy,
      baseNamespace: 'http://purl.org/stuff/instance/'
    });

    return {
      queryService,
      sparqlHelper,
      chunker,
      URIMinter,
      targetGraph,
      storageConfig
    };
  }

  /**
   * Find text elements to process based on target
   * @param {string} target - Target specification
   * @param {Object} chunkingOptions - Chunking options
   * @param {Object} services - Initialized services
   * @returns {Array} Text elements to process
   * @private
   */
  async findTextElementsToProcess(target, chunkingOptions, services) {
    const { queryService, targetGraph, storageConfig } = services;
    const { minContentLength } = chunkingOptions;

    if (target === 'all' || target === '') {
      return await this.findAllUnprocessedElements(queryService, targetGraph, storageConfig, minContentLength);
    } else if (target.startsWith('http://') || target.startsWith('https://')) {
      return await this.findSpecificElement(target, targetGraph, storageConfig, minContentLength);
    } else {
      return await this.createSyntheticElement(target, minContentLength);
    }
  }

  /**
   * Find all unprocessed text elements
   * @private
   */
  async findAllUnprocessedElements(queryService, targetGraph, storageConfig, minContentLength) {
    const query = await queryService.getQuery('find-unprocessed-text-elements', {
      graphURI: targetGraph,
      limit: 1000000,
      minContentLength
    });

    const response = await fetch(storageConfig.query, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/sparql-query',
        'Accept': 'application/sparql-results+json',
        'Authorization': `Basic ${Buffer.from(`${storageConfig.user}:${storageConfig.password}`).toString('base64')}`
      },
      body: query
    });

    const queryResult = await response.json();
    return queryResult.results?.bindings || [];
  }

  /**
   * Find specific text element by URI
   * @private
   */
  async findSpecificElement(target, targetGraph, storageConfig, minContentLength) {
    const query = `
      PREFIX ragno: <http://purl.org/stuff/ragno/>
      PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
      PREFIX prov: <http://www.w3.org/ns/prov#>

      SELECT ?textElement ?content ?sourceUnit WHERE {
        GRAPH <${targetGraph}> {
          <${target}> ragno:content ?content ;
                     rdfs:label ?label .
          OPTIONAL { <${target}> prov:wasDerivedFrom ?sourceUnit }
          BIND(<${target}> AS ?textElement)
          FILTER(STRLEN(?content) >= ${minContentLength})
        }
      }
    `;

    const response = await fetch(storageConfig.query, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/sparql-query',
        'Accept': 'application/sparql-results+json',
        'Authorization': `Basic ${Buffer.from(`${storageConfig.user}:${storageConfig.password}`).toString('base64')}`
      },
      body: query
    });

    const queryResult = await response.json();
    return queryResult.results?.bindings || [];
  }

  /**
   * Create synthetic text element from direct content
   * @private
   */
  async createSyntheticElement(target, minContentLength) {
    verbsLogger.info('📝 [CHUNK_DOCUMENTS] Processing direct content text from UI');

    if (target.length >= minContentLength) {
      // Generate a URI for this content using a simple hash
      const crypto = await import('crypto');
      const contentHash = crypto.createHash('md5').update(target).digest('hex').substring(0, 8);
      const syntheticURI = `http://purl.org/stuff/instance/text-element-${contentHash}`;

      verbsLogger.info(`📝 [CHUNK_DOCUMENTS] Created synthetic TextElement: ${syntheticURI} (${target.length} chars)`);

      return [{
        textElement: { value: syntheticURI },
        content: { value: target },
        sourceUnit: null
      }];
    } else {
      verbsLogger.info(`⚠️ [CHUNK_DOCUMENTS] Content too short: ${target.length} < ${minContentLength} chars`);
      return [];
    }
  }

  /**
   * Process text elements by chunking them
   * @param {Array} textElementsToProcess - Elements to process
   * @param {Object} services - Services for processing
   * @param {Object} safeOps - Safe operations
   * @returns {Array} Processing results
   * @private
   */
  async processTextElements(textElementsToProcess, services, safeOps) {
    const { chunker, sparqlHelper, URIMinter, targetGraph } = services;
    const chunkedResults = [];

    verbsLogger.info('🔄 [CHUNK_DOCUMENTS] Processing documents for chunking...');

    for (const element of textElementsToProcess) {
      const textElementURI = element.textElement.value;
      const content = element.content.value;
      const sourceUnit = element.sourceUnit?.value;

      try {
        verbsLogger.info(`🧩 [CHUNK_DOCUMENTS] Processing document: ${textElementURI} (${content.length} chars)`);

        const result = await this.processSingleElement(
          textElementURI,
          content,
          sourceUnit,
          chunker,
          sparqlHelper,
          URIMinter,
          targetGraph,
          safeOps
        );

        chunkedResults.push(result);

      } catch (error) {
        verbsLogger.error(`❌ [CHUNK_DOCUMENTS] Error processing element ${textElementURI}:`, error.message);

        chunkedResults.push({
          textElementURI,
          success: false,
          error: error.message,
          contentLength: content.length
        });
      }
    }

    return chunkedResults;
  }

  /**
   * Process a single text element
   * @private
   */
  async processSingleElement(textElementURI, content, sourceUnit, chunker, sparqlHelper, URIMinter, targetGraph, safeOps) {
    logOperation('info', 'augment', 'Starting document chunking', {
      textElementURI,
      contentLength: content.length
    });

    // Chunk the content
    verbsLogger.info('✂️ [CHUNK_DOCUMENTS] Chunking content...');
    const chunkingResult = await chunker.chunk(content, {
      title: `TextElement ${textElementURI.split('/').pop()}`,
      sourceUri: textElementURI
    });

    verbsLogger.info(`✂️ [CHUNK_DOCUMENTS] Created ${chunkingResult.chunks.length} chunks`);

    // Process chunks and store them with embeddings
    const processedChunks = [];

    for (let i = 0; i < chunkingResult.chunks.length; i++) {
      const chunk = chunkingResult.chunks[i];
      const chunkURI = chunk.uri;

      // Generate embedding for chunk
      const chunkEmbedding = await safeOps.generateEmbedding(chunk.content);
      const embeddingURI = URIMinter.mintURI('http://purl.org/stuff/instance/', 'embedding', chunk.content);

      // Store chunk with embedding in SPARQL
      await this.storeChunkWithEmbedding(
        chunkURI,
        chunk,
        textElementURI,
        chunkEmbedding,
        embeddingURI,
        sparqlHelper,
        targetGraph
      );

      processedChunks.push({
        chunkURI,
        chunkIndex: i,
        chunkSize: chunk.size,
        embeddingDimension: chunkEmbedding.length
      });
    }

    return {
      textElementURI,
      success: true,
      chunksCreated: chunkingResult.chunks.length,
      processedChunks,
      chunkingMetadata: chunkingResult.metadata
    };
  }

  /**
   * Store chunk with embedding in SPARQL
   * @private
   */
  async storeChunkWithEmbedding(chunkURI, chunk, textElementURI, chunkEmbedding, embeddingURI, sparqlHelper, targetGraph) {
    const insertQuery = `
      PREFIX ragno: <http://purl.org/stuff/ragno/>
      PREFIX dcterms: <http://purl.org/dc/terms/>
      PREFIX olo: <http://purl.org/ontology/olo/core#>
      PREFIX prov: <http://www.w3.org/ns/prov#>
      PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>

      INSERT DATA {
        GRAPH <${targetGraph}> {
          <${chunkURI}> a ragno:Unit, ragno:TextElement ;
                        ragno:content """${chunk.content.replace(/"/g, '\\"')}""" ;
                        dcterms:extent ${chunk.size} ;
                        olo:index ${chunk.index} ;
                        prov:wasDerivedFrom <${textElementURI}> ;
                        ragno:hasEmbedding <${embeddingURI}> ;
                        dcterms:created "${new Date().toISOString()}"^^xsd:dateTime .

          <${embeddingURI}> a ragno:IndexElement ;
                            ragno:embeddingModel "nomic-embed-text" ;
                            ragno:subType ragno:TextEmbedding ;
                            ragno:embeddingDimension ${chunkEmbedding.length} ;
                            ragno:vectorContent "[${chunkEmbedding.join(',')}]" .
        }
      }
    `;

    await sparqlHelper.executeUpdate(insertQuery);
  }

  /**
   * Check if this strategy supports the given operation
   * @param {Object} params - Parameters to check
   * @returns {boolean} Whether strategy supports the parameters
   */
  supports(params) {
    return params.operation === 'chunk_documents';
  }
}

export default ChunkDocumentsStrategy;