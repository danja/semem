/**
 * VSOM (Vector Self-Organizing Maps) MCP Tools
 * 
 * These tools expose VSOM clustering and visualization functionality
 * through MCP for knowledge graph analysis and entity organization.
 */

import { z } from 'zod';
import { mcpDebugger } from '../lib/debug-utils.js';
import { initializeServices, getMemoryManager } from '../lib/initialization.js';
import { SafeOperations } from '../lib/safe-operations.js';

// Import VSOM functionality
import VSOMService from '../../src/services/vsom/VSOMService.js';

// VSOM Tool Input Schemas
const VSOMCreateInstanceSchema = z.object({
  mapSize: z.array(z.number().int().min(5).max(100)).length(2).optional().default([20, 20]).describe("VSOM grid dimensions [width, height]"),
  topology: z.enum(['rectangular', 'hexagonal']).optional().default('rectangular').describe("Grid topology"),
  embeddingDimension: z.number().int().min(100).max(2000).optional().default(1536).describe("Expected embedding vector dimension"),
  maxIterations: z.number().int().min(100).max(10000).optional().default(1000).describe("Maximum training iterations"),
  initialLearningRate: z.number().min(0.001).max(1.0).optional().default(0.1).describe("Initial learning rate"),
  finalLearningRate: z.number().min(0.001).max(0.1).optional().default(0.01).describe("Final learning rate"),
  clusterThreshold: z.number().min(0.1).max(1.0).optional().default(0.8).describe("Threshold for cluster formation"),
  minClusterSize: z.number().int().min(2).max(50).optional().default(3).describe("Minimum entities per cluster")
});

const VSOMLoadDataSchema = z.object({
  instanceId: z.string().describe("VSOM instance ID"),
  dataType: z.enum(['entities', 'sparql', 'vectorIndex', 'sample']).describe("Type of data to load"),
  data: z.union([
    z.object({
      entities: z.array(z.object({
        uri: z.string(),
        content: z.string(),
        type: z.string().optional(),
        embedding: z.array(z.number()).optional()
      })).describe("Entity array for 'entities' type")
    }),
    z.object({
      endpoint: z.string().url(),
      query: z.string(),
      embeddingProperty: z.string().optional().default('semem:embedding')
    }).describe("SPARQL configuration for 'sparql' type"),
    z.object({
      vectorIndex: z.object({}).passthrough(),
      filters: z.object({}).optional()
    }).describe("Vector index configuration for 'vectorIndex' type"),
    z.object({
      count: z.number().int().min(10).max(1000).default(100),
      dimension: z.number().int().min(100).max(2000).optional()
    }).describe("Sample data configuration for 'sample' type")
  ])
});

const VSOMTrainInstanceSchema = z.object({
  instanceId: z.string().describe("VSOM instance ID"),
  progressCallback: z.boolean().optional().default(false).describe("Enable training progress updates"),
  saveCheckpoints: z.boolean().optional().default(false).describe("Save training checkpoints"),
  validateConvergence: z.boolean().optional().default(true).describe("Check for training convergence")
});

const VSOMGetGridDataSchema = z.object({
  instanceId: z.string().describe("VSOM instance ID"),
  includeWeights: z.boolean().optional().default(false).describe("Include neuron weight vectors"),
  includeEntityMappings: z.boolean().optional().default(true).describe("Include entity-to-neuron mappings"),
  format: z.enum(['json', 'coordinates', 'full']).optional().default('json').describe("Output format")
});

const VSOMGetClustersSchema = z.object({
  instanceId: z.string().describe("VSOM instance ID"),
  method: z.enum(['threshold', 'kmeans', 'hierarchical']).optional().default('threshold').describe("Clustering method"),
  numClusters: z.number().int().min(2).max(50).optional().describe("Number of clusters (for kmeans)"),
  includeEntityDetails: z.boolean().optional().default(true).describe("Include detailed entity information"),
  minClusterSize: z.number().int().min(1).max(20).optional().describe("Override minimum cluster size")
});

const VSOMGetFeatureMapsSchema = z.object({
  instanceId: z.string().describe("VSOM instance ID"),
  features: z.array(z.string()).optional().describe("Specific features to visualize"),
  dimensions: z.array(z.number().int().min(0)).optional().describe("Specific embedding dimensions to map"),
  normalize: z.boolean().optional().default(true).describe("Normalize feature values"),
  resolution: z.enum(['low', 'medium', 'high']).optional().default('medium').describe("Map resolution")
});

const VSOMAnalyzeTopologySchema = z.object({
  instanceId: z.string().describe("VSOM instance ID"),
  computeDistortions: z.boolean().optional().default(true).describe("Compute topological distortions"),
  computeNeighborhoods: z.boolean().optional().default(true).describe("Analyze neighborhood structures"),
  includeMetrics: z.boolean().optional().default(true).describe("Include quality metrics")
});

const VSOMListInstancesSchema = z.object({
  includeStatus: z.boolean().optional().default(true).describe("Include instance status information"),
  includeConfig: z.boolean().optional().default(false).describe("Include configuration details")
});

const VSOMGenerateSampleDataSchema = z.object({
  count: z.number().int().min(10).max(1000).default(50).describe("Number of sample entities to generate"),
  dimension: z.number().int().min(100).max(2000).optional().describe("Embedding dimension (uses service default if not provided)"),
  entityTypes: z.array(z.string()).optional().default(['person', 'organization', 'concept', 'location']).describe("Types of entities to generate"),
  addNoise: z.boolean().optional().default(true).describe("Add realistic noise to embeddings")
});

// VSOM service instance (singleton pattern)
let vsomService = null;

/**
 * Get or create VSOM service instance
 */
function getVSOMService() {
  if (!vsomService) {
    vsomService = new VSOMService();
  }
  return vsomService;
}

/**
 * Register VSOM clustering and visualization tools with MCP server
 */
export function registerVSOMTools(server) {
  mcpDebugger.info('Registering VSOM clustering tools...');

  // 1. Create VSOM Instance Tool
  server.tool(
    "vsom_create_instance",
    "Create a new VSOM instance for entity clustering and visualization",
    VSOMCreateInstanceSchema,
    async (options) => {
      try {
        mcpDebugger.info('Creating VSOM instance', options);

        const service = getVSOMService();
        const result = await service.createInstance(options);

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              instanceId: result.instanceId,
              config: result.config,
              status: result.status,
              message: result.message,
              tool: 'vsom_create_instance'
            }, null, 2)
          }]
        };

      } catch (error) {
        mcpDebugger.error('VSOM instance creation failed', error);
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: false,
              error: error.message,
              tool: 'vsom_create_instance'
            }, null, 2)
          }]
        };
      }
    }
  );

  // 2. Load Data Tool
  server.tool(
    "vsom_load_data",
    "Load entities, SPARQL results, or vector indices into a VSOM instance",
    VSOMLoadDataSchema,
    async ({ instanceId, dataType, data }) => {
      try {
        mcpDebugger.info('Loading VSOM data', { instanceId, dataType });

        await initializeServices();
        const memoryManager = getMemoryManager();
        const service = getVSOMService();

        let loadResult;

        switch (dataType) {
          case 'entities':
            loadResult = await service.loadData(instanceId, {
              type: 'entities',
              entities: data.entities
            }, memoryManager.embeddingHandler);
            break;

          case 'sparql':
            loadResult = await service.loadData(instanceId, {
              type: 'sparql',
              endpoint: data.endpoint,
              query: data.query
            }, memoryManager.embeddingHandler);
            break;

          case 'vectorIndex':
            loadResult = await service.loadData(instanceId, {
              type: 'vectorIndex',
              vectorIndex: data.vectorIndex,
              filters: data.filters
            }, memoryManager.embeddingHandler);
            break;

          case 'sample':
            loadResult = await service.loadData(instanceId, {
              type: 'sample',
              count: data.count || 100,
              dimension: data.dimension
            }, memoryManager.embeddingHandler);
            break;

          default:
            throw new Error(`Unknown data type: ${dataType}`);
        }

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              instanceId,
              dataType,
              loadResult,
              tool: 'vsom_load_data'
            }, null, 2)
          }]
        };

      } catch (error) {
        mcpDebugger.error('VSOM data loading failed', error);
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: false,
              error: error.message,
              instanceId,
              dataType,
              tool: 'vsom_load_data'
            }, null, 2)
          }]
        };
      }
    }
  );

  // 3. Train Instance Tool
  server.tool(
    "vsom_train_instance",
    "Train a VSOM instance to organize loaded entities",
    VSOMTrainInstanceSchema,
    async ({ instanceId, progressCallback = false, saveCheckpoints = false, validateConvergence = true }) => {
      try {
        mcpDebugger.info('Training VSOM instance', { 
          instanceId, 
          progressCallback, 
          saveCheckpoints, 
          validateConvergence 
        });

        const service = getVSOMService();
        const trainingOptions = {
          progressCallback,
          saveCheckpoints,
          validateConvergence
        };

        const result = await service.trainInstance(instanceId, trainingOptions);

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              instanceId,
              trainingResult: result,
              tool: 'vsom_train_instance'
            }, null, 2)
          }]
        };

      } catch (error) {
        mcpDebugger.error('VSOM training failed', error);
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: false,
              error: error.message,
              instanceId,
              tool: 'vsom_train_instance'
            }, null, 2)
          }]
        };
      }
    }
  );

  // 4. Get Grid Data Tool
  server.tool(
    "vsom_get_grid_data",
    "Export VSOM grid topology and neuron data for visualization",
    VSOMGetGridDataSchema,
    async ({ instanceId, includeWeights = false, includeEntityMappings = true, format = 'json' }) => {
      try {
        mcpDebugger.info('Getting VSOM grid data', { 
          instanceId, 
          includeWeights, 
          includeEntityMappings, 
          format 
        });

        const service = getVSOMService();
        const gridData = await service.getGridData(instanceId, {
          includeWeights,
          includeEntityMappings,
          format
        });

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              instanceId,
              format,
              gridData,
              tool: 'vsom_get_grid_data'
            }, null, 2)
          }]
        };

      } catch (error) {
        mcpDebugger.error('VSOM grid data retrieval failed', error);
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: false,
              error: error.message,
              instanceId,
              tool: 'vsom_get_grid_data'
            }, null, 2)
          }]
        };
      }
    }
  );

  // 5. Get Clusters Tool
  server.tool(
    "vsom_get_clusters",
    "Extract clusters from a trained VSOM with entity assignments",
    VSOMGetClustersSchema,
    async ({ instanceId, method = 'threshold', numClusters, includeEntityDetails = true, minClusterSize }) => {
      try {
        mcpDebugger.info('Getting VSOM clusters', { 
          instanceId, 
          method, 
          numClusters, 
          includeEntityDetails, 
          minClusterSize 
        });

        const service = getVSOMService();
        const clusterOptions = {
          method,
          numClusters,
          includeEntityDetails,
          minClusterSize
        };

        const clusters = await service.getClusters(instanceId, clusterOptions);

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              instanceId,
              method,
              clusterCount: Array.isArray(clusters) ? clusters.length : 0,
              clusters,
              tool: 'vsom_get_clusters'
            }, null, 2)
          }]
        };

      } catch (error) {
        mcpDebugger.error('VSOM cluster extraction failed', error);
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: false,
              error: error.message,
              instanceId,
              method,
              tool: 'vsom_get_clusters'
            }, null, 2)
          }]
        };
      }
    }
  );

  // 6. Get Feature Maps Tool
  server.tool(
    "vsom_get_feature_maps",
    "Generate feature maps for specific dimensions or entity attributes",
    VSOMGetFeatureMapsSchema,
    async ({ instanceId, features, dimensions, normalize = true, resolution = 'medium' }) => {
      try {
        mcpDebugger.info('Getting VSOM feature maps', { 
          instanceId, 
          features, 
          dimensions, 
          normalize, 
          resolution 
        });

        const service = getVSOMService();
        const mapOptions = {
          features,
          dimensions,
          normalize,
          resolution
        };

        const featureMaps = await service.getFeatureMaps(instanceId, mapOptions);

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              instanceId,
              mapOptions,
              featureMaps,
              tool: 'vsom_get_feature_maps'
            }, null, 2)
          }]
        };

      } catch (error) {
        mcpDebugger.error('VSOM feature map generation failed', error);
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: false,
              error: error.message,
              instanceId,
              tool: 'vsom_get_feature_maps'
            }, null, 2)
          }]
        };
      }
    }
  );

  // 7. Analyze Topology Tool
  server.tool(
    "vsom_analyze_topology",
    "Analyze VSOM topology quality, distortions, and neighborhood structure",
    VSOMAnalyzeTopologySchema,
    async ({ instanceId, computeDistortions = true, computeNeighborhoods = true, includeMetrics = true }) => {
      try {
        mcpDebugger.info('Analyzing VSOM topology', { 
          instanceId, 
          computeDistortions, 
          computeNeighborhoods, 
          includeMetrics 
        });

        const service = getVSOMService();
        const analysisOptions = {
          computeDistortions,
          computeNeighborhoods,
          includeMetrics
        };

        const analysis = await service.analyzeTopology(instanceId, analysisOptions);

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              instanceId,
              analysisOptions,
              topologyAnalysis: analysis,
              tool: 'vsom_analyze_topology'
            }, null, 2)
          }]
        };

      } catch (error) {
        mcpDebugger.error('VSOM topology analysis failed', error);
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: false,
              error: error.message,
              instanceId,
              tool: 'vsom_analyze_topology'
            }, null, 2)
          }]
        };
      }
    }
  );

  // 8. List Instances Tool
  server.tool(
    "vsom_list_instances",
    "List all VSOM instances with status and configuration information",
    VSOMListInstancesSchema,
    async ({ includeStatus = true, includeConfig = false }) => {
      try {
        mcpDebugger.info('Listing VSOM instances', { includeStatus, includeConfig });

        const service = getVSOMService();
        const instances = await service.listInstances({
          includeStatus,
          includeConfig
        });

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              instanceCount: Array.isArray(instances) ? instances.length : 0,
              instances,
              tool: 'vsom_list_instances'
            }, null, 2)
          }]
        };

      } catch (error) {
        mcpDebugger.error('VSOM instance listing failed', error);
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: false,
              error: error.message,
              tool: 'vsom_list_instances'
            }, null, 2)
          }]
        };
      }
    }
  );

  // 9. Generate Sample Data Tool
  server.tool(
    "vsom_generate_sample_data",
    "Generate sample entity data for VSOM testing and experimentation",
    VSOMGenerateSampleDataSchema,
    async ({ count = 50, dimension, entityTypes = ['person', 'organization', 'concept', 'location'], addNoise = true }) => {
      try {
        mcpDebugger.info('Generating VSOM sample data', { 
          count, 
          dimension, 
          entityTypes, 
          addNoise 
        });

        const service = getVSOMService();
        const sampleData = await service.generateSampleData({
          count,
          dimension,
          entityTypes,
          addNoise
        });

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              generatedCount: sampleData?.entities?.length || count,
              dimension: sampleData?.dimension || dimension,
              entityTypes,
              sampleData,
              tool: 'vsom_generate_sample_data'
            }, null, 2)
          }]
        };

      } catch (error) {
        mcpDebugger.error('VSOM sample data generation failed', error);
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: false,
              error: error.message,
              count,
              tool: 'vsom_generate_sample_data'
            }, null, 2)
          }]
        };
      }
    }
  );

  mcpDebugger.info('VSOM clustering tools registered successfully');
}

// Export schemas for use in other modules
export {
  VSOMCreateInstanceSchema,
  VSOMLoadDataSchema,
  VSOMTrainInstanceSchema,
  VSOMGetGridDataSchema,
  VSOMGetClustersSchema,
  VSOMGetFeatureMapsSchema,
  VSOMAnalyzeTopologySchema,
  VSOMListInstancesSchema,
  VSOMGenerateSampleDataSchema
};