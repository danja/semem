/**
 * Ragno Knowledge Graph MCP Tools
 * 
 * These tools expose the Ragno corpus decomposition and knowledge graph
 * functionality through MCP for use by AI agents.
 */

import { z } from 'zod';
import { mcpDebugger } from '../../lib/debug-utils.js';
import { initializeServices, getMemoryManager } from '../../lib/initialization.js';
import { SafeOperations } from '../../lib/safe-operations.js';

// Import Ragno functionality
import { decomposeCorpus } from '../../../ragno/decomposeCorpus.js';
import { enrichWithEmbeddings } from '../../../ragno/enrichWithEmbeddings.js';
import { augmentWithAttributes } from '../../../ragno/augmentWithAttributes.js';
import { aggregateCommunities } from '../../../ragno/aggregateCommunities.js';

/**
 * Export decomposition results to SPARQL endpoint
 * @param {Object} decompositionResults - Results from corpus decomposition
 * @param {string} endpoint - SPARQL endpoint URL
 * @param {Object} auth - Authentication credentials
 * @returns {Promise<Object>} Export results
 */
async function exportDecompositionToSPARQL(decompositionResults, endpoint, auth) {
  try {
    // Import SPARQL service layer
    const SPARQLHelper = (await import('../../src/services/sparql/SPARQLHelper.js')).default;
    
    const startTime = Date.now();
    
    // Validate input
    if (!decompositionResults || !decompositionResults.dataset) {
      throw new Error('Decomposition results must contain an RDF dataset');
    }
    
    // Create SPARQL helper instance
    const sparqlHelper = new SPARQLHelper(endpoint, {
      auth: auth ? { user: auth.username, password: auth.password } : undefined,
      timeout: 30000
    });
    
    // Convert RDF dataset to N-Triples format for SPARQL insertion
    const { dataset } = decompositionResults;
    const triples = [];
    
    // Iterate through the dataset and convert to N-Triples strings
    for (const quad of dataset) {
      const subject = quad.subject.termType === 'NamedNode' ? `<${quad.subject.value}>` : quad.subject.value;
      const predicate = `<${quad.predicate.value}>`;
      let object;
      
      if (quad.object.termType === 'NamedNode') {
        object = `<${quad.object.value}>`;
      } else if (quad.object.termType === 'Literal') {
        const value = SPARQLHelper.escapeString(quad.object.value);
        if (quad.object.datatype) {
          object = `"${value}"^^<${quad.object.datatype.value}>`;
        } else if (quad.object.language) {
          object = `"${value}"@${quad.object.language}`;
        } else {
          object = `"${value}"`;
        }
      } else {
        object = quad.object.value;
      }
      
      triples.push(`${subject} ${predicate} ${object} .`);
    }
    
    if (triples.length === 0) {
      return {
        triplesExported: 0,
        endpoint: endpoint,
        status: 'success',
        message: 'No triples to export',
        responseTime: Date.now() - startTime
      };
    }
    
    // Create graph URI for the data
    const graphURI = `http://purl.org/stuff/ragno/decomposition/${Date.now()}`;
    
    // Batch insert triples in chunks to avoid overwhelming the endpoint
    const batchSize = 100;
    const batches = [];
    
    for (let i = 0; i < triples.length; i += batchSize) {
      const batch = triples.slice(i, i + batchSize);
      const insertQuery = sparqlHelper.createInsertDataQuery(graphURI, batch.join('\n'));
      batches.push(insertQuery);
    }
    
    // Execute all batches
    const results = await sparqlHelper.executeUpdates(batches);
    const stats = SPARQLHelper.getExecutionStats(results);
    
    // Count successful exports
    const successfulBatches = results.filter(r => r.success).length;
    const totalTriples = successfulBatches * batchSize + 
                        (triples.length % batchSize) * (results[results.length - 1]?.success ? 1 : 0);
    
    const exportResults = {
      triplesExported: Math.min(totalTriples, triples.length),
      endpoint: endpoint,
      graphURI: graphURI,
      status: stats.successRate > 0 ? 'success' : 'failed',
      batchesExecuted: batches.length,
      successfulBatches: successfulBatches,
      successRate: stats.successRate,
      responseTime: Date.now() - startTime,
      statistics: decompositionResults.statistics
    };
    
    if (stats.successRate < 100) {
      exportResults.warnings = results
        .filter(r => !r.success)
        .map(r => r.error || 'Unknown error');
    }
    
    return exportResults;
    
  } catch (error) {
    return {
      triplesExported: 0,
      endpoint: endpoint,
      status: 'error',
      error: error.message,
      responseTime: Date.now() - (Date.now() - 1000) // Approximate timing
    };
  }
}

// Ragno Tool Input Schemas
const RagnoDecomposeCorpusSchema = z.object({
  textChunks: z.array(z.union([
    z.string(),
    z.object({
      content: z.string(),
      source: z.string().optional(),
      metadata: z.object({}).optional()
    })
  ])).min(1).max(100).describe("Text chunks to decompose into semantic units"),
  options: z.object({
    extractRelationships: z.boolean().optional().default(true),
    generateSummaries: z.boolean().optional().default(true),
    minEntityConfidence: z.number().min(0).max(1).optional().default(0.3),
    maxEntitiesPerUnit: z.number().min(1).max(50).optional().default(10),
    chunkOverlap: z.number().min(0).max(1).optional().default(0.1)
  }).optional().default({})
});

const RagnoEnrichEmbeddingsSchema = z.object({
  decompositionResults: z.object({
    units: z.array(z.object({})).optional(),
    entities: z.array(z.object({})).optional(),
    relationships: z.array(z.object({})).optional()
  }).describe("Results from corpus decomposition"),
  embeddingOptions: z.object({
    includeUnits: z.boolean().optional().default(true),
    includeEntities: z.boolean().optional().default(true),
    includeRelationships: z.boolean().optional().default(true),
    batchSize: z.number().min(1).max(100).optional().default(10)
  }).optional().default({})
});

const RagnoAugmentAttributesSchema = z.object({
  entities: z.array(z.object({}).passthrough()).min(1).describe("Entities to augment with attributes"),
  options: z.object({
    maxAttributesPerEntity: z.number().min(1).max(20).optional().default(5),
    minConfidence: z.number().min(0).max(1).optional().default(0.4),
    attributeTypes: z.array(z.string()).optional().default(['property', 'category', 'relation'])
  }).optional().default({})
});

const RagnoAggregateCommunitiesSchema = z.object({
  entities: z.array(z.object({}).passthrough()).min(2).describe("Entities for community detection"),
  relationships: z.array(z.object({}).passthrough()).optional().default([]).describe("Relationships between entities"),
  options: z.object({
    algorithm: z.enum(['leiden', 'louvain']).optional().default('leiden'),
    resolution: z.number().min(0.1).max(5.0).optional().default(1.0),
    minCommunitySize: z.number().min(2).max(100).optional().default(3)
  }).optional().default({})
});

const RagnoExportToSPARQLSchema = z.object({
  decompositionResults: z.object({
    dataset: z.any().describe("RDF dataset"),
    statistics: z.object({}).optional()
  }).describe("Results from corpus decomposition"),
  endpoint: z.string().url().optional().describe("SPARQL endpoint URL (uses configured if not provided)"),
  auth: z.object({
    username: z.string().optional(),
    password: z.string().optional()
  }).optional()
});

const RagnoGetEntitySchema = z.object({
  entityId: z.string().describe("Entity ID or URI"),
  includeRelationships: z.boolean().optional().default(true),
  includeAttributes: z.boolean().optional().default(true)
});

const RagnoSearchGraphSchema = z.object({
  query: z.string().min(1).describe("Search query"),
  searchType: z.enum(['semantic', 'entity', 'dual']).optional().default('dual'),
  limit: z.number().min(1).max(100).optional().default(10),
  threshold: z.number().min(0).max(1).optional().default(0.7),
  includeRelationships: z.boolean().optional().default(true)
});

const RagnoGetGraphStatsSchema = z.object({
  detailed: z.boolean().optional().default(false).describe("Include detailed statistics"),
  computeMetrics: z.boolean().optional().default(true).describe("Compute graph metrics")
});

/**
 * Register Ragno knowledge graph tools with MCP server
 */
export function registerRagnoTools(server) {
  mcpDebugger.info('Registering Ragno knowledge graph tools...');
  
  // Note: Tools are registered but services are only initialized when tools are called

  // 1. Corpus Decomposition Tool
  server.tool(
    "ragno_decompose_corpus",
    "Decompose text chunks into semantic units, entities, and relationships using LLM analysis",
    RagnoDecomposeCorpusSchema,
    async ({ textChunks, options = {} }) => {
      try {
        mcpDebugger.info('Starting Ragno corpus decomposition', { 
          chunkCount: textChunks.length,
          options 
        });

        await initializeServices();
        const memoryManager = getMemoryManager();
        const safeOps = new SafeOperations(memoryManager);

        // Normalize text chunks to objects
        const normalizedChunks = textChunks.map((chunk, index) => {
          if (typeof chunk === 'string') {
            return {
              content: chunk,
              source: `chunk_${index}`,
              metadata: {}
            };
          }
          return {
            content: chunk.content,
            source: chunk.source || `chunk_${index}`,
            metadata: chunk.metadata || {}
          };
        });

        // Get LLM handler from memory manager
        const llmHandler = memoryManager.llmHandler;
        if (!llmHandler) {
          throw new Error('LLM handler not available in memory manager');
        }

        // Perform decomposition
        const results = await decomposeCorpus(normalizedChunks, llmHandler, options);

        // Store results in memory for later use
        const interactionId = `ragno_decompose_${Date.now()}`;
        await safeOps.storeInteraction(
          `Ragno corpus decomposition: ${normalizedChunks.length} chunks`,
          JSON.stringify(results.statistics),
          {
            type: 'ragno_decomposition',
            id: interactionId,
            statistics: results.statistics,
            timestamp: new Date().toISOString()
          }
        );

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              interactionId,
              statistics: results.statistics,
              results: {
                unitCount: results.units.length,
                entityCount: results.entities.length,
                relationshipCount: results.relationships.length,
                processingTime: results.statistics.processingTime
              },
              // Include limited preview of results
              preview: {
                sampleUnits: results.units.slice(0, 3).map(unit => ({
                  id: unit.getURI(),
                  content: unit.getContent().substring(0, 100) + '...',
                  summary: unit.getSummary()
                })),
                sampleEntities: results.entities.slice(0, 5).map(entity => ({
                  name: entity.getPreferredLabel(),
                  type: entity.getSubType(),
                  isEntryPoint: entity.isEntryPoint()
                }))
              },
              tool: 'ragno_decompose_corpus'
            }, null, 2)
          }]
        };

      } catch (error) {
        mcpDebugger.error('Ragno corpus decomposition failed', error);
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: false,
              error: error.message,
              tool: 'ragno_decompose_corpus'
            }, null, 2)
          }]
        };
      }
    }
  );

  // 2. Enrich with Embeddings Tool
  server.tool(
    "ragno_enrich_embeddings",
    "Add vector embeddings to decomposition results for semantic search",
    RagnoEnrichEmbeddingsSchema,
    async ({ decompositionResults, embeddingOptions = {} }) => {
      try {
        mcpDebugger.info('Starting Ragno embedding enrichment');

        await initializeServices();
        const memoryManager = getMemoryManager();
        const safeOps = new SafeOperations(memoryManager);

        const embeddingHandler = memoryManager.embeddingHandler;
        if (!embeddingHandler) {
          throw new Error('Embedding handler not available in memory manager');
        }

        // Perform embedding enrichment
        const enrichedResults = await enrichWithEmbeddings(
          decompositionResults,
          embeddingHandler,
          embeddingOptions
        );

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              enrichedCount: enrichedResults.enrichedCount || 0,
              embeddingStats: enrichedResults.embeddingStats || {},
              processingTime: enrichedResults.processingTime || 0,
              tool: 'ragno_enrich_embeddings'
            }, null, 2)
          }]
        };

      } catch (error) {
        mcpDebugger.error('Ragno embedding enrichment failed', error);
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: false,
              error: error.message,
              tool: 'ragno_enrich_embeddings'
            }, null, 2)
          }]
        };
      }
    }
  );

  // 3. Augment with Attributes Tool
  server.tool(
    "ragno_augment_attributes",
    "Extract and add semantic attributes to entities using LLM analysis",
    RagnoAugmentAttributesSchema,
    async ({ entities, options = {} }) => {
      try {
        mcpDebugger.info('Starting Ragno attribute augmentation', { 
          entityCount: entities.length,
          options 
        });

        await initializeServices();
        const memoryManager = getMemoryManager();

        const llmHandler = memoryManager.llmHandler;
        if (!llmHandler) {
          throw new Error('LLM handler not available in memory manager');
        }

        // Perform attribute augmentation
        const augmentedResults = await augmentWithAttributes(
          entities,
          llmHandler,
          options
        );

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              augmentedEntities: augmentedResults.augmentedEntities || 0,
              totalAttributes: augmentedResults.totalAttributes || 0,
              attributeStats: augmentedResults.attributeStats || {},
              processingTime: augmentedResults.processingTime || 0,
              tool: 'ragno_augment_attributes'
            }, null, 2)
          }]
        };

      } catch (error) {
        mcpDebugger.error('Ragno attribute augmentation failed', error);
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: false,
              error: error.message,
              tool: 'ragno_augment_attributes'
            }, null, 2)
          }]
        };
      }
    }
  );

  // 4. Aggregate Communities Tool
  server.tool(
    "ragno_aggregate_communities",
    "Detect and analyze entity communities in the knowledge graph",
    RagnoAggregateCommunitiesSchema,
    async ({ entities, relationships = [], options = {} }) => {
      try {
        mcpDebugger.info('Starting Ragno community aggregation', { 
          entityCount: entities.length,
          relationshipCount: relationships.length,
          options 
        });

        await initializeServices();
        const memoryManager = getMemoryManager();

        // Perform community aggregation
        const communityResults = await aggregateCommunities(
          entities,
          relationships,
          options
        );

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              communities: communityResults.communities || [],
              communityCount: communityResults.communityCount || 0,
              communityStats: communityResults.communityStats || {},
              algorithm: options.algorithm || 'leiden',
              processingTime: communityResults.processingTime || 0,
              tool: 'ragno_aggregate_communities'
            }, null, 2)
          }]
        };

      } catch (error) {
        mcpDebugger.error('Ragno community aggregation failed', error);
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: false,
              error: error.message,
              tool: 'ragno_aggregate_communities'
            }, null, 2)
          }]
        };
      }
    }
  );

  // 5. Export to SPARQL Tool
  server.tool(
    "ragno_export_sparql",
    "Export decomposition results to a SPARQL endpoint for querying",
    RagnoExportToSPARQLSchema,
    async ({ decompositionResults, endpoint, auth }) => {
      try {
        mcpDebugger.info('Starting Ragno SPARQL export');

        await initializeServices();
        const memoryManager = getMemoryManager();

        // Use configured SPARQL endpoint if none provided
        const targetEndpoint = endpoint || memoryManager.store?.config?.endpoint;
        if (!targetEndpoint) {
          throw new Error('No SPARQL endpoint configured or provided');
        }

        // Perform export
        const exportResults = await exportDecompositionToSPARQL(
          decompositionResults,
          targetEndpoint,
          auth
        );

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              endpoint: targetEndpoint,
              exportResults,
              tool: 'ragno_export_sparql'
            }, null, 2)
          }]
        };

      } catch (error) {
        mcpDebugger.error('Ragno SPARQL export failed', error);
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: false,
              error: error.message,
              tool: 'ragno_export_sparql'
            }, null, 2)
          }]
        };
      }
    }
  );

  // 6. Get Entity Tool
  server.tool(
    "ragno_get_entity",
    "Retrieve detailed information about a specific entity from the knowledge graph",
    RagnoGetEntitySchema,
    async ({ entityId, includeRelationships = true, includeAttributes = true }) => {
      try {
        mcpDebugger.info('Retrieving Ragno entity', { entityId });

        await initializeServices();
        const memoryManager = getMemoryManager();
        const safeOps = new SafeOperations(memoryManager);

        // Query the SPARQL store for entity information
        const store = memoryManager.store;
        if (!store) {
          throw new Error('SPARQL store not available');
        }

        // Construct SPARQL query for entity retrieval
        const query = `
          PREFIX ragno: <http://purl.org/stuff/ragno/>
          PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
          
          SELECT ?property ?value WHERE {
            <${entityId}> ?property ?value .
          }
        `;

        const queryResults = await store.executeQuery(query);
        
        // Format results
        const entityData = {
          id: entityId,
          properties: queryResults || [],
          relationships: includeRelationships ? [] : undefined,
          attributes: includeAttributes ? [] : undefined
        };

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              entity: entityData,
              tool: 'ragno_get_entity'
            }, null, 2)
          }]
        };

      } catch (error) {
        mcpDebugger.error('Ragno entity retrieval failed', error);
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: false,
              error: error.message,
              entityId,
              tool: 'ragno_get_entity'
            }, null, 2)
          }]
        };
      }
    }
  );

  // 7. Search Graph Tool
  server.tool(
    "ragno_search_graph",
    "Search the knowledge graph using semantic similarity, entity matching, or hybrid approaches",
    RagnoSearchGraphSchema,
    async ({ query, searchType = 'dual', limit = 10, threshold = 0.7, includeRelationships = true }) => {
      try {
        mcpDebugger.info('Searching Ragno graph', { 
          query: query.substring(0, 50) + '...',
          searchType,
          limit 
        });

        await initializeServices();
        const memoryManager = getMemoryManager();
        const safeOps = new SafeOperations(memoryManager);

        let searchResults = [];

        if (searchType === 'semantic' || searchType === 'dual') {
          // Perform semantic search using embeddings
          const embedding = await safeOps.generateEmbedding(query);
          const similarityResults = await safeOps.searchSimilar(embedding, limit, threshold);
          searchResults.push(...similarityResults);
        }

        if (searchType === 'entity' || searchType === 'dual') {
          // Perform entity-based search using SPARQL
          const store = memoryManager.store;
          if (store) {
            const entityQuery = `
              PREFIX ragno: <http://purl.org/stuff/ragno/>
              PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
              
              SELECT ?entity ?label ?type WHERE {
                ?entity a ragno:Entity ;
                       rdfs:label ?label ;
                       ragno:hasType ?type .
                FILTER(CONTAINS(LCASE(?label), LCASE("${query}")))
              }
              LIMIT ${limit}
            `;

            const entityResults = await store.executeQuery(entityQuery);
            searchResults.push(...(entityResults || []));
          }
        }

        // Remove duplicates and limit results
        const uniqueResults = Array.from(
          new Map(searchResults.map(item => [item.id || item.entity, item])).values()
        ).slice(0, limit);

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              query,
              searchType,
              resultCount: uniqueResults.length,
              results: uniqueResults,
              tool: 'ragno_search_graph'
            }, null, 2)
          }]
        };

      } catch (error) {
        mcpDebugger.error('Ragno graph search failed', error);
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: false,
              error: error.message,
              query,
              tool: 'ragno_search_graph'
            }, null, 2)
          }]
        };
      }
    }
  );

  // 8. Get Graph Statistics Tool
  server.tool(
    "ragno_get_graph_stats",
    "Retrieve comprehensive statistics about the knowledge graph",
    RagnoGetGraphStatsSchema,
    async ({ detailed = false, computeMetrics = true }) => {
      try {
        mcpDebugger.info('Retrieving Ragno graph statistics', { detailed, computeMetrics });

        await initializeServices();
        const memoryManager = getMemoryManager();

        const store = memoryManager.store;
        if (!store) {
          throw new Error('SPARQL store not available');
        }

        // Basic count queries
        const statsQuery = `
          PREFIX ragno: <http://purl.org/stuff/ragno/>
          
          SELECT 
            (COUNT(DISTINCT ?entity) as ?entityCount)
            (COUNT(DISTINCT ?unit) as ?unitCount)
            (COUNT(DISTINCT ?relationship) as ?relationshipCount)
          WHERE {
            {
              ?entity a ragno:Entity .
            } UNION {
              ?unit a ragno:SemanticUnit .
            } UNION {
              ?relationship a ragno:Relationship .
            }
          }
        `;

        const basicStats = await store.executeQuery(statsQuery);

        let detailedStats = {};
        if (detailed) {
          // Additional detailed queries
          const typeStatsQuery = `
            PREFIX ragno: <http://purl.org/stuff/ragno/>
            
            SELECT ?type (COUNT(?entity) as ?count) WHERE {
              ?entity a ragno:Entity ;
                     ragno:hasType ?type .
            }
            GROUP BY ?type
            ORDER BY DESC(?count)
          `;

          const typeStats = await store.executeQuery(typeStatsQuery);
          detailedStats.entityTypes = typeStats || [];
        }

        const statistics = {
          basic: basicStats?.[0] || {
            entityCount: 0,
            unitCount: 0,
            relationshipCount: 0
          },
          detailed: detailed ? detailedStats : undefined,
          computedAt: new Date().toISOString()
        };

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              statistics,
              tool: 'ragno_get_graph_stats'
            }, null, 2)
          }]
        };

      } catch (error) {
        mcpDebugger.error('Ragno graph statistics failed', error);
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: false,
              error: error.message,
              tool: 'ragno_get_graph_stats'
            }, null, 2)
          }]
        };
      }
    }
  );

  mcpDebugger.info('Ragno knowledge graph tools registered successfully');
}

// Export schemas for use in other modules
export {
  RagnoDecomposeCorpusSchema,
  RagnoEnrichEmbeddingsSchema,
  RagnoAugmentAttributesSchema,
  RagnoAggregateCommunitiesSchema,
  RagnoExportToSPARQLSchema,
  RagnoGetEntitySchema,
  RagnoSearchGraphSchema,
  RagnoGetGraphStatsSchema
};