/**
 * TrainVSOMCommand - Command for training Visual Self-Organizing Map
 *
 * Trains a VSOM on knowledge graph entities with their embeddings to create
 * a spatially-organized visualization where similar concepts cluster together.
 */

import { BaseVerbCommand } from './BaseVerbCommand.js';
import { TrainVSOMSchema } from '../../VerbSchemas.js';
import VSOM from '../../../../ragno/algorithms/VSOM.js';
import { VSOM_CONFIG } from '../../../../../config/preferences.js';

export class TrainVSOMCommand extends BaseVerbCommand {
  constructor() {
    super('train-vsom');
    this.schema = TrainVSOMSchema;
    this.vsom = null;
  }

  /**
   * Initialize command with VSOM
   * @param {Object} context - Shared context
   */
  async onInitialize(context) {
    // Store config from shared context
    this.config = context.config;

    if (!this.config) {
      throw new Error('Config not provided in context');
    }

    this.logOperation('debug', 'TrainVSOM command initialized');
  }

  /**
   * Execute train-vsom command
   * @param {Object} params - Command parameters
   * @param {number} params.epochs - Number of training epochs (default from config/preferences.js)
   * @param {number} params.learningRate - Initial learning rate (default from config/preferences.js)
   * @param {number} params.gridSize - Grid size (default from config/preferences.js)
   * @returns {Promise<Object>} Command result with trained grid
   */
  async execute(params) {
    const validatedParams = this.validateParameters(params);
    const {
      epochs = VSOM_CONFIG.TRAINING.DEFAULT_EPOCHS,
      learningRate = VSOM_CONFIG.TRAINING.DEFAULT_LEARNING_RATE,
      gridSize = VSOM_CONFIG.TRAINING.DEFAULT_GRID_SIZE
    } = validatedParams;

    try {
      this.logOperation('info', 'Starting VSOM training', { epochs, learningRate, gridSize });

      const startTime = Date.now();

      // Get embedding dimension from config
      const embeddingDimension = this._getEmbeddingDimension();

      // Get knowledge graph data with embeddings from inspect
      const knowledgeGraphData = await this._getKnowledgeGraphWithEmbeddings();

      if (!knowledgeGraphData || knowledgeGraphData.nodes.length === 0) {
        throw new Error('No knowledge graph data available for training');
      }

      this.logOperation('info', `Retrieved ${knowledgeGraphData.nodes.length} nodes for training`);

      // Filter nodes with valid embeddings
      const validNodes = knowledgeGraphData.nodes.filter(node =>
        node.embedding && Array.isArray(node.embedding) && node.embedding.length === embeddingDimension
      );

      if (validNodes.length === 0) {
        throw new Error(`No nodes with valid ${embeddingDimension}-dimensional embeddings found`);
      }

      this.logOperation('info', `Training on ${validNodes.length} nodes with embeddings`);

      // Create VSOM instance directly with embeddings
      const vsom = new VSOM({
        mapSize: [gridSize, gridSize],
        topology: 'rectangular',
        embeddingDimension: embeddingDimension,
        maxIterations: epochs,
        initialLearningRate: learningRate,
        finalLearningRate: learningRate * VSOM_CONFIG.TRAINING.FINAL_LEARNING_RATE_FACTOR
      });

      // Load embeddings directly into VSOM
      vsom.embeddings = validNodes.map(node => node.embedding);
      vsom.entities = validNodes.map((node, index) => ({ id: node.id, index }));
      vsom.entityMetadata = validNodes.map(node => ({
        uri: node.id,
        content: node.label || node.id,
        type: node.type || 'unknown'
      }));
      vsom.stats.totalEntities = validNodes.length;

      this.logOperation('info', 'Starting VSOM training');

      // Train the VSOM
      const trainingResult = await vsom.train({
        onIteration: (iteration, error) => {
          if (iteration % Math.floor(epochs / 10) === 0) {
            this.logOperation('debug', 'Training progress', { iteration, error });
          }
        }
      });

      this.logOperation('info', 'Training completed', {
        iterations: trainingResult.totalIterations,
        time: trainingResult.trainingTime
      });

      // Get node mappings (entity to grid position)
      const mappings = vsom.getNodeMappings();

      const trainingTime = Date.now() - startTime;

      return this.createSuccessResponse({
        trained: true,
        trainingTime,
        epochs: trainingResult.totalIterations,
        finalError: trainingResult.quantizationError || 0,
        mappings: mappings,
        metadata: {
          entitiesCount: validNodes.length,
          gridSize: [gridSize, gridSize],
          embeddingDimension: embeddingDimension
        },
        message: `VSOM trained successfully on ${validNodes.length} entities in ${trainingTime}ms`
      });

    } catch (error) {
      return this.handleError(error, 'train-vsom operation', {
        epochs,
        learningRate,
        gridSize,
        fallback: {
          trained: false,
          error: error.message,
          message: 'Training failed - check that knowledge graph data is available'
        }
      });
    }
  }

  /**
   * Get embedding dimension from config
   * @returns {number} Embedding dimension
   * @private
   */
  _getEmbeddingDimension() {
    if (!this.config) {
      throw new Error('Config not initialized - call onInitialize first');
    }

    // Get embedding dimension from llmProviders config
    const llmProviders = this.config.get('llmProviders') || [];
    const embeddingProvider = llmProviders
      .filter(p => p.capabilities?.includes('embedding'))
      .sort((a, b) => (a.priority || 999) - (b.priority || 999))[0];

    if (!embeddingProvider?.embeddingDimension) {
      throw new Error('No embedding dimension found in config - check llmProviders configuration');
    }

    return embeddingProvider.embeddingDimension;
  }

  /**
   * Get knowledge graph data with embeddings from the store
   * @returns {Promise<Object>} Knowledge graph data with nodes and embeddings
   * @private
   */
  async _getKnowledgeGraphWithEmbeddings() {
    try {
      // Access the memory manager's store to get entities with embeddings
      if (!this.memoryManager?.store) {
        throw new Error('Memory store not available');
      }

      const store = this.memoryManager.store;

      // Query for all entities with embeddings
      // Use SPARQL query to get entities and their embeddings
      const query = `
        PREFIX semem: <http://purl.org/stuff/semem/>
        PREFIX ragno: <http://purl.org/stuff/ragno/>
        PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

        SELECT DISTINCT ?entity ?label ?type ?embedding
        WHERE {
          GRAPH ?g {
            ?entity a semem:Interaction .
            ?entity a ?type .
            ?entity semem:embedding ?embedding .
            OPTIONAL { ?entity rdfs:label ?label }
          }
        }
        LIMIT 5000
      `;

      const results = await store.executeSparqlQuery(query);

      const nodes = (results?.results?.bindings || [])
        .map(binding => {
          let embedding = null;

          // Parse embedding if present
          if (binding.embedding?.value) {
            try {
              const embeddingStr = binding.embedding.value;
              // Handle both JSON array and comma-separated string formats
              embedding = embeddingStr.startsWith('[')
                ? JSON.parse(embeddingStr)
                : embeddingStr.split(',').map(v => parseFloat(v.trim()));
            } catch (e) {
              this.logOperation('warn', 'Failed to parse embedding', {
                entity: binding.entity?.value,
                error: e.message
              });
            }
          }

          return {
            id: binding.entity?.value || 'unknown',
            label: binding.label?.value || 'Unlabeled',
            type: binding.type?.value || 'unknown',
            embedding: embedding
          };
        })
        .filter(node => {
          const embeddingDimension = this._getEmbeddingDimension();
          return node.embedding && node.embedding.length === embeddingDimension;
        });

      this.logOperation('debug', 'Retrieved knowledge graph nodes', {
        totalNodes: results?.results?.bindings?.length || 0,
        nodesWithEmbeddings: nodes.length
      });

      return {
        nodes,
        edges: [] // Edges not needed for training, only for visualization
      };

    } catch (error) {
      this.logOperation('error', 'Failed to get knowledge graph with embeddings', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get training status for current instance
   * @returns {Promise<Object>} Training status
   */
  async getStatus() {
    if (!this.currentInstanceId) {
      return { status: 'no_instance' };
    }

    return await this.vsomService.getTrainingStatus(this.currentInstanceId);
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    if (this.currentInstanceId && this.vsomService) {
      try {
        await this.vsomService.deleteInstance(this.currentInstanceId);
        this.currentInstanceId = null;
      } catch (error) {
        this.logOperation('warn', 'Failed to cleanup VSOM instance', {
          error: error.message
        });
      }
    }
  }
}

export default TrainVSOMCommand;
