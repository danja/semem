import SPARQLStore from '../../stores/SPARQLStore.js';
import { v4 as uuidv4 } from 'uuid';
import logger from 'loglevel';

/**
 * Document ingestion service with PROV-O integration
 * Ingests chunked documents into SPARQL store with provenance tracking
 */
export default class Ingester {
  constructor(store, options = {}) {
    if (!store) {
      throw new Error('Ingester: SPARQL store is required');
    }

    this.store = store;
    this.config = {
      graphName: options.graphName || 'http://hyperdata.it/content',
      batchSize: options.batchSize || 10,
      enableProvenance: options.enableProvenance !== false,
      ...options
    };
  }

  /**
   * Ingest chunked document data into SPARQL store
   * @param {Object} chunkingResult - Result from Chunker.chunk()
   * @param {Object} options - Ingestion options
   * @returns {Promise<Object>} Ingestion result
   */
  async ingest(chunkingResult, options = {}) {
    if (!chunkingResult || !chunkingResult.chunks) {
      throw new Error('Ingester: chunkingResult with chunks is required');
    }

    try {
      const startTime = Date.now();
      const ingestOptions = { ...this.config, ...options };
      const activityId = uuidv4();

      // Create ingestion activity for provenance
      const activity = this.createIngestionActivity(activityId, chunkingResult);

      // Prepare ingestion data
      const ingestionData = await this.prepareIngestionData(chunkingResult, activity, ingestOptions);

      // Execute SPARQL UPDATE operations
      const results = await this.executeIngestion(ingestionData, ingestOptions);

      const processingTime = Date.now() - startTime;

      logger.info(`Ingester: Successfully ingested ${chunkingResult.chunks.length} chunks in ${processingTime}ms`);

      return {
        success: true,
        chunkCount: chunkingResult.chunks.length,
        processingTime,
        activityId,
        graphName: ingestOptions.graphName,
        results,
        metadata: {
          sourceUri: chunkingResult.sourceUri,
          corpusUri: chunkingResult.corpus?.uri,
          communityUri: chunkingResult.community?.uri,
          ingestionTimestamp: new Date().toISOString()
        }
      };

    } catch (error) {
      logger.error('Ingester: Error during ingestion:', error.message);
      throw new Error(`Ingester: Failed to ingest chunks: ${error.message}`);
    }
  }

  /**
   * Prepare data for SPARQL insertion
   * @private
   * @param {Object} chunkingResult - Chunking result
   * @param {Object} activity - PROV-O activity
   * @param {Object} options - Options
   * @returns {Promise<Array>} Prepared SPARQL update queries
   */
  async prepareIngestionData(chunkingResult, activity, options) {
    const updates = [];

    // 1. Insert source document
    updates.push(this.createDocumentInsertQuery(chunkingResult, activity, options.graphName));

    // 2. Insert corpus
    if (chunkingResult.corpus) {
      updates.push(this.createCorpusInsertQuery(chunkingResult.corpus, activity, options.graphName));
    }

    // 3. Insert community
    if (chunkingResult.community) {
      updates.push(this.createCommunityInsertQuery(chunkingResult.community, activity, options.graphName));
    }

    // 4. Insert chunks (text elements)
    const chunkBatches = this.batchChunks(chunkingResult.chunks, options.batchSize);
    for (const batch of chunkBatches) {
      updates.push(this.createChunksBatchInsertQuery(batch, activity, options.graphName));
    }

    // 5. Insert provenance data if enabled
    if (options.enableProvenance) {
      updates.push(this.createProvenanceInsertQuery(activity, chunkingResult, options.graphName));
    }

    return updates;
  }

  /**
   * Execute SPARQL UPDATE operations
   * @private
   * @param {Array} updateQueries - SPARQL UPDATE queries
   * @param {Object} options - Options
   * @returns {Promise<Array>} Execution results
   */
  async executeIngestion(updateQueries, options) {
    const results = [];

    for (let i = 0; i < updateQueries.length; i++) {
      const query = updateQueries[i];
      
      try {
        logger.debug(`Ingester: Executing update ${i + 1}/${updateQueries.length}`);
        
        // Execute SPARQL UPDATE
        const result = await this.store.executeUpdate(query);
        
        results.push({
          index: i,
          success: true,
          result
        });

      } catch (error) {
        logger.error(`Ingester: Failed to execute update ${i + 1}:`, error.message);
        
        results.push({
          index: i,
          success: false,
          error: error.message,
          query: query.substring(0, 200) + '...' // Truncated for logging
        });

        // Decide whether to continue or abort
        if (options.failFast !== false) {
          throw new Error(`Ingester: Update ${i + 1} failed: ${error.message}`);
        }
      }
    }

    return results;
  }

  /**
   * Create PROV-O ingestion activity
   * @private
   * @param {string} activityId - Activity ID
   * @param {Object} chunkingResult - Chunking result
   * @returns {Object} PROV-O activity
   */
  createIngestionActivity(activityId, chunkingResult) {
    return {
      uri: `${this.config.graphName}/activity/${activityId}`,
      type: 'prov:Activity',
      label: 'Document Ingestion Activity',
      startedAtTime: new Date().toISOString(),
      wasAssociatedWith: 'semem:Ingester',
      used: [chunkingResult.sourceUri],
      generated: [
        chunkingResult.corpus?.uri,
        chunkingResult.community?.uri,
        ...chunkingResult.chunks.map(c => c.uri)
      ].filter(Boolean)
    };
  }

  /**
   * Create SPARQL INSERT query for source document
   * @private
   * @param {Object} chunkingResult - Chunking result
   * @param {Object} activity - PROV-O activity
   * @param {string} graphName - Target graph
   * @returns {string} SPARQL UPDATE query
   */
  createDocumentInsertQuery(chunkingResult, activity, graphName) {
    const metadata = chunkingResult.metadata;
    const sourceUri = chunkingResult.sourceUri;

    return `
      PREFIX ragno: <http://purl.org/stuff/ragno/>
      PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
      PREFIX dcterms: <http://purl.org/dc/terms/>
      PREFIX semem: <http://purl.org/stuff/semem/>
      PREFIX prov: <http://www.w3.org/ns/prov#>
      PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
      
      INSERT DATA {
        GRAPH <${graphName}> {
          <${sourceUri}> a ragno:Corpus ;
            rdfs:label "${this.escapeString(metadata.title || 'Source Document')}" ;
            dcterms:created "${metadata.timestamp || new Date().toISOString()}"^^xsd:dateTime ;
            semem:sourceFile "${this.escapeString(metadata.sourceFile || '')}" ;
            semem:format "${metadata.format || 'unknown'}" ;
            semem:fileSize ${metadata.fileSize || 0} ;
            prov:wasGeneratedBy <${activity.uri}> .
        }
      }
    `;
  }

  /**
   * Create SPARQL INSERT query for corpus
   * @private
   * @param {Object} corpus - Corpus object
   * @param {Object} activity - PROV-O activity
   * @param {string} graphName - Target graph
   * @returns {string} SPARQL UPDATE query
   */
  createCorpusInsertQuery(corpus, activity, graphName) {
    return `
      PREFIX ragno: <http://purl.org/stuff/ragno/>
      PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
      PREFIX dcterms: <http://purl.org/dc/terms/>
      PREFIX prov: <http://www.w3.org/ns/prov#>
      
      INSERT DATA {
        GRAPH <${graphName}> {
          <${corpus.uri}> a ragno:Corpus ;
            rdfs:label "${this.escapeString(corpus.label)}" ;
            dcterms:description "${this.escapeString(corpus.description)}" ;
            ragno:memberCount ${corpus.memberCount} ;
            prov:wasDerivedFrom <${corpus.wasDerivedFrom}> ;
            prov:wasGeneratedBy <${activity.uri}> .
        }
      }
    `;
  }

  /**
   * Create SPARQL INSERT query for community
   * @private
   * @param {Object} community - Community object
   * @param {Object} activity - PROV-O activity
   * @param {string} graphName - Target graph
   * @returns {string} SPARQL UPDATE query
   */
  createCommunityInsertQuery(community, activity, graphName) {
    const elementTriples = community.hasCommunityElement
      .map(elem => `<${community.uri}> ragno:hasCommunityElement <${elem.element}> .`)
      .join('\n            ');

    return `
      PREFIX ragno: <http://purl.org/stuff/ragno/>
      PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
      PREFIX dcterms: <http://purl.org/dc/terms/>
      PREFIX prov: <http://www.w3.org/ns/prov#>
      
      INSERT DATA {
        GRAPH <${graphName}> {
          <${community.uri}> a ragno:Community ;
            rdfs:label "${this.escapeString(community.label)}" ;
            dcterms:description "${this.escapeString(community.description)}" ;
            ragno:elementCount ${community.metadata.elementCount} ;
            ragno:cohesion ${community.metadata.cohesion} ;
            prov:wasGeneratedBy <${activity.uri}> .
          ${elementTriples}
        }
      }
    `;
  }

  /**
   * Create SPARQL INSERT query for chunks batch
   * @private
   * @param {Array} chunks - Chunk batch
   * @param {Object} activity - PROV-O activity
   * @param {string} graphName - Target graph
   * @returns {string} SPARQL UPDATE query
   */
  createChunksBatchInsertQuery(chunks, activity, graphName) {
    const chunkTriples = chunks.map(chunk => {
      return `
        <${chunk.uri}> a ragno:TextElement ;
          rdfs:label "${this.escapeString(chunk.title)}" ;
          ragno:hasContent """${this.escapeString(chunk.content)}""" ;
          ragno:size ${chunk.size} ;
          ragno:index ${chunk.index} ;
          dcterms:isPartOf <${chunk.partOf}> ;
          semem:contentHash "${chunk.metadata.hash}" ;
          prov:wasDerivedFrom <${chunk.partOf}> ;
          prov:wasGeneratedBy <${activity.uri}> .
      `;
    }).join('\n');

    return `
      PREFIX ragno: <http://purl.org/stuff/ragno/>
      PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
      PREFIX dcterms: <http://purl.org/dc/terms/>
      PREFIX semem: <http://purl.org/stuff/semem/>
      PREFIX prov: <http://www.w3.org/ns/prov#>
      
      INSERT DATA {
        GRAPH <${graphName}> {
          ${chunkTriples}
        }
      }
    `;
  }

  /**
   * Create SPARQL INSERT query for provenance data
   * @private
   * @param {Object} activity - PROV-O activity
   * @param {Object} chunkingResult - Chunking result
   * @param {string} graphName - Target graph
   * @returns {string} SPARQL UPDATE query
   */
  createProvenanceInsertQuery(activity, chunkingResult, graphName) {
    const usedTriples = activity.used.map(uri => `<${activity.uri}> prov:used <${uri}> .`).join('\n            ');
    const generatedTriples = activity.generated.map(uri => `<${activity.uri}> prov:generated <${uri}> .`).join('\n            ');

    return `
      PREFIX prov: <http://www.w3.org/ns/prov#>
      PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
      PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
      
      INSERT DATA {
        GRAPH <${graphName}> {
          <${activity.uri}> a prov:Activity ;
            rdfs:label "${this.escapeString(activity.label)}" ;
            prov:startedAtTime "${activity.startedAtTime}"^^xsd:dateTime ;
            prov:wasAssociatedWith <${activity.wasAssociatedWith}> .
          ${usedTriples}
          ${generatedTriples}
        }
      }
    `;
  }

  /**
   * Split chunks into batches for processing
   * @private
   * @param {Array} chunks - Chunks to batch
   * @param {number} batchSize - Size of each batch
   * @returns {Array<Array>} Batched chunks
   */
  batchChunks(chunks, batchSize) {
    const batches = [];
    for (let i = 0; i < chunks.length; i += batchSize) {
      batches.push(chunks.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * Escape string for SPARQL
   * @private
   * @param {string} str - String to escape
   * @returns {string} Escaped string
   */
  escapeString(str) {
    if (!str) return '';
    return str
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/\t/g, '\\t');
  }

  /**
   * Query ingested documents
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Query results
   */
  async queryDocuments(options = {}) {
    const query = `
      SELECT DISTINCT ?document ?label ?created ?format ?chunks WHERE {
        GRAPH <${options.graphName || this.config.graphName}> {
          ?document a ragno:Corpus ;
            rdfs:label ?label .
          OPTIONAL { ?document dcterms:created ?created }
          OPTIONAL { ?document semem:format ?format }
          {
            SELECT ?document (COUNT(?chunk) as ?chunks) WHERE {
              ?chunk dcterms:isPartOf ?document .
            } GROUP BY ?document
          }
        }
      }
      ORDER BY DESC(?created)
      ${options.limit ? `LIMIT ${options.limit}` : ''}
    `;

    try {
      return await this.store.query(query);
    } catch (error) {
      logger.error('Ingester: Error querying documents:', error.message);
      throw new Error(`Ingester: Failed to query documents: ${error.message}`);
    }
  }

  /**
   * Query chunks for a specific document
   * @param {string} documentUri - Document URI
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Query results
   */
  async queryDocumentChunks(documentUri, options = {}) {
    if (!documentUri) {
      throw new Error('Ingester: documentUri is required');
    }

    const query = `
      SELECT ?chunk ?label ?content ?size ?index WHERE {
        GRAPH <${options.graphName || this.config.graphName}> {
          ?chunk a ragno:TextElement ;
            dcterms:isPartOf <${documentUri}> ;
            rdfs:label ?label ;
            ragno:hasContent ?content ;
            ragno:size ?size ;
            ragno:index ?index .
        }
      }
      ORDER BY ?index
      ${options.limit ? `LIMIT ${options.limit}` : ''}
    `;

    try {
      return await this.store.query(query);
    } catch (error) {
      logger.error('Ingester: Error querying document chunks:', error.message);
      throw new Error(`Ingester: Failed to query document chunks: ${error.message}`);
    }
  }

  /**
   * Delete document and all related data
   * @param {string} documentUri - Document URI to delete
   * @param {Object} options - Delete options
   * @returns {Promise<Object>} Delete result
   */
  async deleteDocument(documentUri, options = {}) {
    if (!documentUri) {
      throw new Error('Ingester: documentUri is required');
    }

    const deleteQuery = `
      DELETE WHERE {
        GRAPH <${options.graphName || this.config.graphName}> {
          # Delete chunks
          ?chunk dcterms:isPartOf <${documentUri}> .
          ?chunk ?chunkProp ?chunkValue .
          
          # Delete document
          <${documentUri}> ?docProp ?docValue .
          
          # Delete related corpus/community
          ?related prov:wasDerivedFrom <${documentUri}> .
          ?related ?relProp ?relValue .
        }
      }
    `;

    try {
      const result = await this.store.executeUpdate(deleteQuery);
      logger.info(`Ingester: Deleted document ${documentUri}`);
      
      return {
        success: true,
        documentUri,
        result
      };
    } catch (error) {
      logger.error('Ingester: Error deleting document:', error.message);
      throw new Error(`Ingester: Failed to delete document: ${error.message}`);
    }
  }
}