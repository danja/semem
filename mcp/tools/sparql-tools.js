/**
 * Advanced SPARQL Operation MCP Tools
 * 
 * These tools expose advanced SPARQL querying, navigation, and data management
 * functionality through MCP for use by AI agents.
 */

import { z } from 'zod';
import { mcpDebugger } from '../lib/debug-utils.js';
import { initializeServices, getMemoryManager } from '../lib/initialization.js';
import { SafeOperations } from '../lib/safe-operations.js';

// SPARQL Tool Input Schemas
const SPARQLExecuteQuerySchema = z.object({
  query: z.string().min(1).describe("SPARQL SELECT or ASK query to execute"),
  limit: z.number().min(1).max(1000).optional().default(100).describe("Maximum number of results"),
  timeout: z.number().min(1000).max(60000).optional().default(30000).describe("Query timeout in milliseconds")
});

const SPARQLExecuteConstructSchema = z.object({
  query: z.string().min(1).describe("SPARQL CONSTRUCT query to execute"),
  format: z.enum(['turtle', 'n-triples', 'json-ld', 'rdf-xml']).optional().default('turtle').describe("Output format for constructed RDF"),
  timeout: z.number().min(1000).max(60000).optional().default(30000).describe("Query timeout in milliseconds")
});

const SPARQLNavigateZPTSchema = z.object({
  zoom: z.enum(['micro', 'entity', 'relationship', 'community', 'corpus']).describe("ZPT zoom level for navigation"),
  filters: z.object({
    type: z.string().optional().describe("Filter by RDF type"),
    label: z.string().optional().describe("Filter by label (contains)"),
    property: z.string().optional().describe("Filter by property existence"),
    value: z.string().optional().describe("Filter by property value"),
    dateRange: z.object({
      start: z.string().optional(),
      end: z.string().optional()
    }).optional().describe("Filter by date range")
  }).optional().default({}),
  limit: z.number().min(1).max(500).optional().default(50).describe("Maximum number of results"),
  orderBy: z.enum(['similarity', 'frequency', 'centrality', 'weight', 'timestamp']).optional().describe("Result ordering")
});

const SPARQLSimilaritySearchSchema = z.object({
  embedding: z.array(z.number()).min(100).max(2000).describe("Query embedding vector"),
  threshold: z.number().min(0).max(1).optional().default(0.7).describe("Similarity threshold"),
  limit: z.number().min(1).max(100).optional().default(10).describe("Maximum number of results"),
  entityTypes: z.array(z.string()).optional().describe("Filter by entity types"),
  includeMetadata: z.boolean().optional().default(true).describe("Include metadata in results")
});

const SPARQLValidateCorpusSchema = z.object({
  checkIntegrity: z.boolean().optional().default(true).describe("Check graph integrity"),
  checkEmbeddings: z.boolean().optional().default(true).describe("Check embedding coverage"),
  checkConnectivity: z.boolean().optional().default(true).describe("Check graph connectivity"),
  detailed: z.boolean().optional().default(false).describe("Return detailed validation report")
});

const SPARQLStoreDatasetSchema = z.object({
  rdfData: z.string().describe("RDF data in turtle, n-triples, or JSON-LD format"),
  format: z.enum(['turtle', 'n-triples', 'json-ld', 'rdf-xml']).optional().default('turtle').describe("Input RDF format"),
  graphName: z.string().optional().describe("Named graph to store data in (uses default if not provided)"),
  replace: z.boolean().optional().default(false).describe("Replace existing data in graph")
});

const SPARQLBulkOperationsSchema = z.object({
  operations: z.array(z.object({
    type: z.enum(['insert', 'update', 'delete']),
    query: z.string(),
    graphName: z.string().optional()
  })).min(1).max(50).describe("Bulk operations to execute"),
  atomic: z.boolean().optional().default(true).describe("Execute as atomic transaction"),
  continueOnError: z.boolean().optional().default(false).describe("Continue execution if individual operations fail")
});

const SPARQLGraphManagementSchema = z.object({
  operation: z.enum(['create', 'delete', 'clear', 'copy', 'move']).describe("Graph management operation"),
  graphName: z.string().describe("Target graph name"),
  sourceGraph: z.string().optional().describe("Source graph (for copy/move operations)"),
  force: z.boolean().optional().default(false).describe("Force operation (for delete)")
});

/**
 * Register advanced SPARQL tools with MCP server
 */
export function registerSPARQLTools(server) {
  mcpDebugger.info('Registering advanced SPARQL tools...');

  // 1. Execute SPARQL Query Tool
  server.tool(
    "sparql_execute_query",
    "Execute a SPARQL SELECT or ASK query against the knowledge graph",
    SPARQLExecuteQuerySchema,
    async ({ query, limit = 100, timeout = 30000 }) => {
      try {
        mcpDebugger.info('Executing SPARQL query', { 
          query: query.substring(0, 100) + '...',
          limit,
          timeout 
        });

        await initializeServices();
        const memoryManager = getMemoryManager();
        const store = memoryManager.store;

        if (!store) {
          throw new Error('SPARQL store not available');
        }

        // Add LIMIT clause if not present and this is a SELECT query
        let finalQuery = query;
        if (query.trim().toUpperCase().startsWith('SELECT') && 
            !query.toUpperCase().includes('LIMIT')) {
          finalQuery = `${query} LIMIT ${limit}`;
        }

        const startTime = Date.now();
        const results = await store.executeQuery(finalQuery);
        const executionTime = Date.now() - startTime;

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              query: finalQuery,
              resultCount: Array.isArray(results) ? results.length : (results ? 1 : 0),
              results: results,
              executionTime,
              metadata: {
                queryType: query.trim().toUpperCase().startsWith('SELECT') ? 'SELECT' : 
                          query.trim().toUpperCase().startsWith('ASK') ? 'ASK' : 'UNKNOWN',
                timeout,
                limitApplied: limit
              },
              tool: 'sparql_execute_query'
            }, null, 2)
          }]
        };

      } catch (error) {
        mcpDebugger.error('SPARQL query execution failed', error);
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: false,
              error: error.message,
              query: query.substring(0, 200) + '...',
              tool: 'sparql_execute_query'
            }, null, 2)
          }]
        };
      }
    }
  );

  // 2. Execute SPARQL CONSTRUCT Query Tool
  server.tool(
    "sparql_execute_construct",
    "Execute a SPARQL CONSTRUCT query to generate new RDF data",
    SPARQLExecuteConstructSchema,
    async ({ query, format = 'turtle', timeout = 30000 }) => {
      try {
        mcpDebugger.info('Executing SPARQL CONSTRUCT query', { format, timeout });

        await initializeServices();
        const memoryManager = getMemoryManager();
        const store = memoryManager.store;

        if (!store) {
          throw new Error('SPARQL store not available');
        }

        const startTime = Date.now();
        const results = await store.executeQuery(query);
        const executionTime = Date.now() - startTime;

        // For CONSTRUCT queries, results might be RDF data
        // In a full implementation, we would serialize to the requested format
        let serializedResults = results;
        if (typeof results === 'object' && results !== null) {
          serializedResults = JSON.stringify(results, null, 2);
        }

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              query,
              format,
              constructedData: serializedResults,
              executionTime,
              tool: 'sparql_execute_construct'
            }, null, 2)
          }]
        };

      } catch (error) {
        mcpDebugger.error('SPARQL CONSTRUCT execution failed', error);
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: false,
              error: error.message,
              query: query.substring(0, 200) + '...',
              tool: 'sparql_execute_construct'
            }, null, 2)
          }]
        };
      }
    }
  );

  // 3. ZPT Navigation Tool
  server.tool(
    "sparql_navigate_zpt",
    "Navigate the knowledge graph using ZPT (zoom/pan/tilt) spatial metaphors",
    SPARQLNavigateZPTSchema,
    async ({ zoom, filters = {}, limit = 50, orderBy }) => {
      try {
        mcpDebugger.info('SPARQL ZPT navigation', { zoom, filters, limit, orderBy });

        await initializeServices();
        const memoryManager = getMemoryManager();
        const store = memoryManager.store;

        if (!store || !store.navigateZPT) {
          throw new Error('ZPT navigation not available in SPARQL store');
        }

        const navigationParams = {
          zoom,
          pan: filters,
          limit,
          orderBy
        };

        const results = await store.navigateZPT(navigationParams);

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              zoom,
              filters,
              resultCount: Array.isArray(results) ? results.length : 0,
              results: results || [],
              navigation: navigationParams,
              tool: 'sparql_navigate_zpt'
            }, null, 2)
          }]
        };

      } catch (error) {
        mcpDebugger.error('SPARQL ZPT navigation failed', error);
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: false,
              error: error.message,
              zoom,
              filters,
              tool: 'sparql_navigate_zpt'
            }, null, 2)
          }]
        };
      }
    }
  );

  // 4. Similarity Search Tool
  server.tool(
    "sparql_similarity_search",
    "Perform vector similarity search in the knowledge graph using embeddings",
    SPARQLSimilaritySearchSchema,
    async ({ embedding, threshold = 0.7, limit = 10, entityTypes, includeMetadata = true }) => {
      try {
        mcpDebugger.info('SPARQL similarity search', { 
          embeddingDim: embedding.length,
          threshold,
          limit 
        });

        await initializeServices();
        const memoryManager = getMemoryManager();
        const store = memoryManager.store;

        if (!store) {
          throw new Error('SPARQL store not available');
        }

        // Use the store's search method if available
        const results = await store.search(embedding, limit, threshold);

        // Filter by entity types if specified
        let filteredResults = results || [];
        if (entityTypes && Array.isArray(entityTypes)) {
          filteredResults = filteredResults.filter(result => 
            entityTypes.some(type => 
              result.type === type || 
              result.metadata?.type === type
            )
          );
        }

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              searchParams: {
                embeddingDimension: embedding.length,
                threshold,
                limit,
                entityTypes
              },
              resultCount: filteredResults.length,
              results: filteredResults,
              tool: 'sparql_similarity_search'
            }, null, 2)
          }]
        };

      } catch (error) {
        mcpDebugger.error('SPARQL similarity search failed', error);
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: false,
              error: error.message,
              searchParams: {
                embeddingDimension: embedding.length,
                threshold,
                limit
              },
              tool: 'sparql_similarity_search'
            }, null, 2)
          }]
        };
      }
    }
  );

  // 5. Validate Corpus Tool
  server.tool(
    "sparql_validate_corpus",
    "Validate the integrity and health of the knowledge graph corpus",
    SPARQLValidateCorpusSchema,
    async ({ checkIntegrity = true, checkEmbeddings = true, checkConnectivity = true, detailed = false }) => {
      try {
        mcpDebugger.info('SPARQL corpus validation', { 
          checkIntegrity, 
          checkEmbeddings, 
          checkConnectivity, 
          detailed 
        });

        await initializeServices();
        const memoryManager = getMemoryManager();
        const store = memoryManager.store;

        if (!store) {
          throw new Error('SPARQL store not available');
        }

        const validation = {
          overall: { valid: true, issues: [] },
          integrity: null,
          embeddings: null,
          connectivity: null,
          timestamp: new Date().toISOString()
        };

        // Check corpus integrity
        if (checkIntegrity) {
          try {
            const integrityQuery = `
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

            const integrityResults = await store.executeQuery(integrityQuery);
            validation.integrity = {
              valid: true,
              counts: integrityResults?.[0] || { entityCount: 0, unitCount: 0, relationshipCount: 0 }
            };
          } catch (error) {
            validation.integrity = { valid: false, error: error.message };
            validation.overall.valid = false;
            validation.overall.issues.push('Integrity check failed');
          }
        }

        // Check embedding coverage
        if (checkEmbeddings) {
          try {
            const embeddingQuery = `
              PREFIX semem: <http://purl.org/stuff/semem/>
              PREFIX ragno: <http://purl.org/stuff/ragno/>
              
              SELECT 
                (COUNT(?entity) as ?totalEntities)
                (COUNT(?embedding) as ?entitiesWithEmbeddings)
              WHERE {
                ?entity a ragno:Entity .
                OPTIONAL { ?entity semem:embedding ?embedding }
              }
            `;

            const embeddingResults = await store.executeQuery(embeddingQuery);
            const result = embeddingResults?.[0] || { totalEntities: 0, entitiesWithEmbeddings: 0 };
            const coverage = result.totalEntities > 0 ? 
              (result.entitiesWithEmbeddings / result.totalEntities) : 0;

            validation.embeddings = {
              valid: coverage > 0.5, // At least 50% coverage considered valid
              coverage,
              counts: result
            };

            if (coverage < 0.5) {
              validation.overall.valid = false;
              validation.overall.issues.push('Low embedding coverage');
            }
          } catch (error) {
            validation.embeddings = { valid: false, error: error.message };
            validation.overall.valid = false;
            validation.overall.issues.push('Embedding check failed');
          }
        }

        // Check connectivity
        if (checkConnectivity) {
          try {
            const connectivityQuery = `
              PREFIX ragno: <http://purl.org/stuff/ragno/>
              
              SELECT 
                (COUNT(DISTINCT ?entity) as ?totalEntities)
                (COUNT(DISTINCT ?connectedEntity) as ?connectedEntities)
              WHERE {
                ?entity a ragno:Entity .
                OPTIONAL { 
                  ?connectedEntity a ragno:Entity .
                  ?rel a ragno:Relationship ;
                       ragno:source ?entity ;
                       ragno:target ?connectedEntity .
                }
              }
            `;

            const connectivityResults = await store.executeQuery(connectivityQuery);
            const result = connectivityResults?.[0] || { totalEntities: 0, connectedEntities: 0 };
            const connectivity = result.totalEntities > 0 ? 
              (result.connectedEntities / result.totalEntities) : 0;

            validation.connectivity = {
              valid: connectivity > 0.1, // At least 10% connectivity considered valid
              connectivity,
              counts: result
            };

            if (connectivity < 0.1) {
              validation.overall.valid = false;
              validation.overall.issues.push('Low graph connectivity');
            }
          } catch (error) {
            validation.connectivity = { valid: false, error: error.message };
            validation.overall.valid = false;
            validation.overall.issues.push('Connectivity check failed');
          }
        }

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              validation,
              detailed,
              tool: 'sparql_validate_corpus'
            }, null, 2)
          }]
        };

      } catch (error) {
        mcpDebugger.error('SPARQL corpus validation failed', error);
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: false,
              error: error.message,
              tool: 'sparql_validate_corpus'
            }, null, 2)
          }]
        };
      }
    }
  );

  // 6. Store Dataset Tool
  server.tool(
    "sparql_store_dataset",
    "Store RDF dataset in the knowledge graph",
    SPARQLStoreDatasetSchema,
    async ({ rdfData, format = 'turtle', graphName, replace = false }) => {
      try {
        mcpDebugger.info('Storing SPARQL dataset', { 
          format, 
          dataSize: rdfData.length, 
          graphName, 
          replace 
        });

        await initializeServices();
        const memoryManager = getMemoryManager();
        const store = memoryManager.store;

        if (!store) {
          throw new Error('SPARQL store not available');
        }

        // Use the store's configured graph if none provided
        const targetGraph = graphName || store.graphName;

        let insertQuery;
        if (replace) {
          // Clear and replace graph content
          insertQuery = `
            CLEAR GRAPH <${targetGraph}> ;
            INSERT DATA { 
              GRAPH <${targetGraph}> {
                ${rdfData}
              }
            }
          `;
        } else {
          // Insert into existing graph
          insertQuery = `
            INSERT DATA { 
              GRAPH <${targetGraph}> {
                ${rdfData}
              }
            }
          `;
        }

        const startTime = Date.now();
        await store.executeUpdate(insertQuery);
        const executionTime = Date.now() - startTime;

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              graphName: targetGraph,
              format,
              dataSize: rdfData.length,
              replace,
              executionTime,
              tool: 'sparql_store_dataset'
            }, null, 2)
          }]
        };

      } catch (error) {
        mcpDebugger.error('SPARQL dataset storage failed', error);
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: false,
              error: error.message,
              graphName,
              format,
              tool: 'sparql_store_dataset'
            }, null, 2)
          }]
        };
      }
    }
  );

  // 7. Bulk Operations Tool
  server.tool(
    "sparql_bulk_operations",
    "Execute multiple SPARQL operations in batch",
    SPARQLBulkOperationsSchema,
    async ({ operations, atomic = true, continueOnError = false }) => {
      try {
        mcpDebugger.info('Executing SPARQL bulk operations', { 
          operationCount: operations.length,
          atomic,
          continueOnError 
        });

        await initializeServices();
        const memoryManager = getMemoryManager();
        const store = memoryManager.store;

        if (!store) {
          throw new Error('SPARQL store not available');
        }

        const results = [];
        const startTime = Date.now();
        let successCount = 0;
        let errorCount = 0;

        for (let i = 0; i < operations.length; i++) {
          const operation = operations[i];
          try {
            const opStartTime = Date.now();
            
            if (operation.type === 'insert' || operation.type === 'update' || operation.type === 'delete') {
              await store.executeUpdate(operation.query);
            } else {
              const result = await store.executeQuery(operation.query);
              results.push({
                index: i,
                type: operation.type,
                success: true,
                result,
                executionTime: Date.now() - opStartTime
              });
            }

            successCount++;
            
          } catch (error) {
            errorCount++;
            results.push({
              index: i,
              type: operation.type,
              success: false,
              error: error.message,
              executionTime: Date.now() - opStartTime
            });

            if (!continueOnError) {
              break;
            }
          }
        }

        const totalExecutionTime = Date.now() - startTime;

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: errorCount === 0 || continueOnError,
              operationCount: operations.length,
              successCount,
              errorCount,
              atomic,
              continueOnError,
              results,
              totalExecutionTime,
              tool: 'sparql_bulk_operations'
            }, null, 2)
          }]
        };

      } catch (error) {
        mcpDebugger.error('SPARQL bulk operations failed', error);
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: false,
              error: error.message,
              operationCount: operations.length,
              tool: 'sparql_bulk_operations'
            }, null, 2)
          }]
        };
      }
    }
  );

  // 8. Graph Management Tool
  server.tool(
    "sparql_graph_management",
    "Manage named graphs in the SPARQL store (create, delete, clear, copy, move)",
    SPARQLGraphManagementSchema,
    async ({ operation, graphName, sourceGraph, force = false }) => {
      try {
        mcpDebugger.info('SPARQL graph management', { operation, graphName, sourceGraph, force });

        await initializeServices();
        const memoryManager = getMemoryManager();
        const store = memoryManager.store;

        if (!store) {
          throw new Error('SPARQL store not available');
        }

        let query;
        const startTime = Date.now();

        switch (operation) {
          case 'create':
            query = `CREATE GRAPH <${graphName}>`;
            break;
            
          case 'delete':
            query = force ? 
              `DROP GRAPH <${graphName}>` : 
              `DROP SILENT GRAPH <${graphName}>`;
            break;
            
          case 'clear':
            query = `CLEAR GRAPH <${graphName}>`;
            break;
            
          case 'copy':
            if (!sourceGraph) {
              throw new Error('Source graph required for copy operation');
            }
            query = `COPY GRAPH <${sourceGraph}> TO <${graphName}>`;
            break;
            
          case 'move':
            if (!sourceGraph) {
              throw new Error('Source graph required for move operation');
            }
            query = `MOVE GRAPH <${sourceGraph}> TO <${graphName}>`;
            break;
            
          default:
            throw new Error(`Unknown graph operation: ${operation}`);
        }

        await store.executeUpdate(query);
        const executionTime = Date.now() - startTime;

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              operation,
              graphName,
              sourceGraph,
              force,
              query,
              executionTime,
              tool: 'sparql_graph_management'
            }, null, 2)
          }]
        };

      } catch (error) {
        mcpDebugger.error('SPARQL graph management failed', error);
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: false,
              error: error.message,
              operation,
              graphName,
              sourceGraph,
              tool: 'sparql_graph_management'
            }, null, 2)
          }]
        };
      }
    }
  );

  mcpDebugger.info('Advanced SPARQL tools registered successfully');
}

// Export schemas for use in other modules
export {
  SPARQLExecuteQuerySchema,
  SPARQLExecuteConstructSchema,
  SPARQLNavigateZPTSchema,
  SPARQLSimilaritySearchSchema,
  SPARQLValidateCorpusSchema,
  SPARQLStoreDatasetSchema,
  SPARQLBulkOperationsSchema,
  SPARQLGraphManagementSchema
};