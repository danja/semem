/**
 * VSOM API - Vector Self-Organizing Map API for knowledge graph visualization
 * 
 * Provides RESTful endpoints for creating, training, and visualizing
 * Self-Organizing Maps for high-dimensional entity embeddings from the knowledge graph.
 */

import BaseAPI from '../common/BaseAPI.js';
import VSOMService from '../../services/vsom/VSOMService.js';
import VSOM from '../../ragno/algorithms/VSOM.js';

export default class VSOMAPI extends BaseAPI {
    constructor(options = {}) {
        super('vsom-api', options);
        
        this.defaultOptions = {
            maxInstancesPerSession: 5,
            defaultMapSize: [20, 20],
            defaultEmbeddingDim: 1536,
            maxTrainingIterations: 10000,
            defaultTrainingEpochs: 100,
            ...options
        };
        
        this.vsomService = new VSOMService(this.defaultOptions);
        this.initialized = false;
    }

    async initialize() {
        try {
            this.logger.info('Initializing VSOM API...');
            
            // Verify VSOM dependencies are available
            await this.verifyDependencies();
            
            this.initialized = true;
            this.logger.info('VSOM API initialized successfully');
            
            return { success: true, message: 'VSOM API initialized' };
        } catch (error) {
            this.logger.error('Failed to initialize VSOM API:', error);
            throw error;
        }
    }

    async verifyDependencies() {
        // Check if registry is available
        if (!this.registry) {
            this.logger.warn('API registry not available - VSOM will operate with limited functionality');
            return;
        }
        
        // Check if memory manager is available for entity data
        try {
            const memoryManager = this.registry.get('memory');
            if (memoryManager) {
                this.logger.debug('Memory manager available for VSOM entity operations');
            } else {
                this.logger.warn('Memory manager not available - some VSOM features may be limited');
            }
        } catch (error) {
            this.logger.warn('Could not verify memory manager availability:', error.message);
        }
        
        // Check if embedding handler is available
        try {
            const embeddingHandler = this.registry.get('embedding');
            if (embeddingHandler) {
                this.logger.debug('Embedding handler available for VSOM vector operations');
            } else {
                this.logger.warn('Embedding handler not available - some VSOM features may be limited');
            }
        } catch (error) {
            this.logger.warn('Could not verify embedding handler availability:', error.message);
        }
    }

    async executeOperation(operation, params = {}) {
        if (!this.initialized) {
            throw new Error('VSOM API not initialized');
        }
        
        try {
            this.logger.debug(`Executing VSOM operation: ${operation}`, { params });
            
            switch (operation) {
                case 'create':
                    return await this.createSOMInstance(params);
                case 'load-data':
                    return await this.loadData(params);
                case 'generate-sample-data':
                    return await this.generateSampleData(params);
                case 'train':
                    return await this.trainSOM(params);
                case 'stop-training':
                    return await this.stopTraining(params);
                case 'grid':
                    return await this.getGridState(params);
                case 'features':
                    return await this.getFeatureMaps(params);
                case 'cluster':
                    return await this.performClustering(params);
                case 'training-status':
                    return await this.getTrainingStatus(params);
                case 'instances':
                    return await this.listInstances(params);
                case 'delete':
                    return await this.deleteInstance(params);
                default:
                    throw new Error(`Unknown VSOM operation: ${operation}`);
            }
        } catch (error) {
            this.logger.error(`VSOM operation ${operation} failed:`, error);
            throw error;
        }
    }

    /**
     * Create a new SOM instance with specified configuration
     */
    async createSOMInstance(params = {}) {
        const {
            mapSize = this.defaultOptions.defaultMapSize,
            topology = 'rectangular',
            embeddingDimension = this.defaultOptions.defaultEmbeddingDim,
            maxIterations = 1000,
            initialLearningRate = 0.1,
            finalLearningRate = 0.01,
            clusterThreshold = 0.8,
            minClusterSize = 3
        } = params;

        // Validate parameters
        if (!Array.isArray(mapSize) || mapSize.length !== 2 || mapSize.some(s => s < 3 || s > 100)) {
            throw new Error('Map size must be array of 2 integers between 3 and 100');
        }

        if (embeddingDimension < 100 || embeddingDimension > 2000) {
            throw new Error('Embedding dimension must be between 100 and 2000');
        }

        const config = {
            mapSize,
            topology,
            embeddingDimension,
            maxIterations: Math.min(maxIterations, this.defaultOptions.maxTrainingIterations),
            initialLearningRate,
            finalLearningRate,
            clusterThreshold,
            minClusterSize
        };

        const result = await this.vsomService.createInstance(config);
        
        this.logger.info(`Created VSOM instance: ${result.instanceId}`, { config });
        
        return {
            instanceId: result.instanceId,
            config: result.config,
            status: result.status,
            created: result.created
        };
    }

    /**
     * Load data into a VSOM instance
     */
    async loadData(params = {}) {
        const { instanceId, dataType, data } = params;

        if (!instanceId) {
            throw new Error('Instance ID is required');
        }

        if (!dataType) {
            throw new Error('Data type is required (entities, sparql, sample)');
        }

        let processedData;

        switch (dataType) {
            case 'entities':
                processedData = await this.processEntityData(data);
                break;
            case 'sparql':
                processedData = await this.processSparqlData(data);
                break;
            case 'sample':
                processedData = await this.generateSampleEntities(data.count || 50);
                break;
            default:
                throw new Error(`Unsupported data type: ${dataType}`);
        }

        const result = await this.vsomService.loadData(instanceId, processedData);

        this.logger.info(`Loaded ${processedData.length} entities into VSOM instance: ${instanceId}`);

        return {
            instanceId,
            dataType,
            entitiesLoaded: processedData.length,
            dataPreview: processedData.slice(0, 3).map(e => ({ 
                id: e.id, 
                name: e.name || e.id,
                embeddingDim: e.embedding?.length 
            }))
        };
    }

    /**
     * Generate sample data for testing
     */
    async generateSampleData(params = {}) {
        const { count = 50 } = params;
        
        if (count < 10 || count > 1000) {
            throw new Error('Sample count must be between 10 and 1000');
        }

        const sampleData = await this.generateSampleEntities(count);

        return {
            entities: sampleData,
            count: sampleData.length,
            format: 'entities',
            embeddingDimension: this.defaultOptions.defaultEmbeddingDim
        };
    }

    /**
     * Train a SOM instance
     */
    async trainSOM(params = {}) {
        const { 
            instanceId, 
            epochs = this.defaultOptions.defaultTrainingEpochs,
            batchSize = 10,
            progressCallback = null 
        } = params;

        if (!instanceId) {
            throw new Error('Instance ID is required');
        }

        if (epochs < 1 || epochs > 1000) {
            throw new Error('Epochs must be between 1 and 1000');
        }

        const result = await this.vsomService.train(instanceId, {
            epochs: Math.min(epochs, this.defaultOptions.defaultTrainingEpochs),
            batchSize,
            progressCallback
        });

        this.logger.info(`Training completed for VSOM instance: ${instanceId}`, { 
            epochs: result.epochs, 
            finalError: result.finalError 
        });

        return {
            instanceId,
            trainingResults: result,
            status: 'completed'
        };
    }

    /**
     * Stop ongoing training
     */
    async stopTraining(params = {}) {
        const { instanceId } = params;

        if (!instanceId) {
            throw new Error('Instance ID is required');
        }

        const result = await this.vsomService.stopTraining(instanceId);

        return {
            instanceId,
            stopped: result.stopped,
            status: result.status
        };
    }

    /**
     * Get current grid state
     */
    async getGridState(params = {}) {
        const { instanceId, includeWeights = false } = params;

        if (!instanceId) {
            throw new Error('Instance ID is required');
        }

        const result = await this.vsomService.getGridState(instanceId, { includeWeights });

        return {
            instanceId,
            gridState: result.grid,
            mappings: result.mappings,
            metadata: result.metadata
        };
    }

    /**
     * Get feature maps (U-Matrix, component planes)
     */
    async getFeatureMaps(params = {}) {
        const { instanceId, mapType = 'umatrix' } = params;

        if (!instanceId) {
            throw new Error('Instance ID is required');
        }

        const result = await this.vsomService.getFeatureMaps(instanceId, { mapType });

        return {
            instanceId,
            mapType,
            featureMap: result.featureMap,
            statistics: result.statistics
        };
    }

    /**
     * Perform clustering on the SOM
     */
    async performClustering(params = {}) {
        const { 
            instanceId, 
            algorithm = 'umatrix',
            threshold = null,
            minClusterSize = 3 
        } = params;

        if (!instanceId) {
            throw new Error('Instance ID is required');
        }

        const result = await this.vsomService.cluster(instanceId, {
            algorithm,
            threshold,
            minClusterSize
        });

        this.logger.info(`Clustering completed for VSOM instance: ${instanceId}`, { 
            clustersFound: result.clusters.length 
        });

        return {
            instanceId,
            clusters: result.clusters,
            algorithm,
            statistics: result.statistics
        };
    }

    /**
     * Get training status
     */
    async getTrainingStatus(params = {}) {
        const { instanceId } = params;

        if (instanceId) {
            const result = await this.vsomService.getTrainingStatus(instanceId);
            return {
                instanceId,
                ...result
            };
        } else {
            // Get status for all instances
            const allStatus = await this.vsomService.getAllTrainingStatus();
            return {
                instances: allStatus
            };
        }
    }

    /**
     * List all VSOM instances
     */
    async listInstances(params = {}) {
        const instances = await this.vsomService.listInstances();

        return {
            instances: instances.map(instance => ({
                instanceId: instance.instanceId,
                config: instance.config,
                status: instance.status,
                created: instance.created,
                dataLoaded: instance.dataLoaded,
                entitiesCount: instance.entitiesCount
            })),
            count: instances.length
        };
    }

    /**
     * Delete a VSOM instance
     */
    async deleteInstance(params = {}) {
        const { instanceId } = params;

        if (!instanceId) {
            throw new Error('Instance ID is required');
        }

        const result = await this.vsomService.deleteInstance(instanceId);

        this.logger.info(`Deleted VSOM instance: ${instanceId}`);

        return {
            instanceId,
            deleted: result.deleted
        };
    }

    /**
     * Process entity data format
     */
    async processEntityData(data) {
        if (!data || !data.entities || !Array.isArray(data.entities)) {
            throw new Error('Entity data must contain entities array');
        }

        const embeddingHandler = this.registry.get('embedding');
        const processedEntities = [];

        for (const entity of data.entities) {
            if (!entity.uri) {
                continue; // Skip entities without URI
            }

            let embedding = entity.embedding;
            
            // Generate embedding if not provided
            if (!embedding && entity.content) {
                try {
                    const embeddingResult = await embeddingHandler.generateEmbedding(entity.content);
                    embedding = embeddingResult.embedding;
                } catch (error) {
                    this.logger.warn(`Failed to generate embedding for entity ${entity.uri}:`, error);
                    continue;
                }
            }

            if (!embedding || !Array.isArray(embedding)) {
                this.logger.warn(`Skipping entity ${entity.uri}: invalid or missing embedding`);
                continue;
            }

            processedEntities.push({
                id: entity.uri,
                name: entity.name || entity.uri.split('/').pop(),
                type: entity.type || 'unknown',
                content: entity.content,
                embedding: embedding
            });
        }

        return processedEntities;
    }

    /**
     * Process SPARQL data format
     */
    async processSparqlData(data) {
        const { endpoint, query, embeddingProperty = 'ragno:embedding' } = data;

        if (!endpoint || !query) {
            throw new Error('SPARQL data must contain endpoint and query');
        }

        // Execute SPARQL query to fetch entities with embeddings
        // This would integrate with the existing SPARQL infrastructure
        const memoryManager = this.registry.get('memory');
        
        // For now, return empty array - would need SPARQL query execution
        this.logger.warn('SPARQL data loading not yet implemented');
        return [];
    }

    /**
     * Generate sample entities for testing
     */
    async generateSampleEntities(count) {
        const embeddingHandler = this.registry.get('embedding');
        const sampleData = [];

        const topics = [
            'artificial intelligence', 'machine learning', 'neural networks', 'deep learning',
            'natural language processing', 'computer vision', 'robotics', 'data science',
            'quantum computing', 'blockchain', 'cybersecurity', 'cloud computing',
            'software engineering', 'web development', 'mobile development', 'database systems'
        ];

        for (let i = 0; i < count; i++) {
            const topic = topics[i % topics.length];
            const variation = Math.floor(i / topics.length) + 1;
            const content = `${topic} research and development ${variation}`;
            
            try {
                const embeddingResult = await embeddingHandler.generateEmbedding(content);
                
                sampleData.push({
                    id: `http://example.org/entity/${i + 1}`,
                    name: `${topic.replace(' ', '_')}_${variation}`,
                    type: 'concept',
                    content: content,
                    embedding: embeddingResult.embedding
                });
            } catch (error) {
                this.logger.warn(`Failed to generate embedding for sample entity ${i + 1}:`, error);
            }
        }

        return sampleData;
    }

    async getMetrics() {
        const instances = await this.vsomService.listInstances();
        
        return {
            totalInstances: instances.length,
            activeTraining: instances.filter(i => i.status === 'training').length,
            completedTraining: instances.filter(i => i.status === 'trained').length,
            totalEntitiesProcessed: instances.reduce((sum, i) => sum + (i.entitiesCount || 0), 0)
        };
    }

    async shutdown() {
        this.logger.info('Shutting down VSOM API...');
        
        // Stop any ongoing training
        try {
            await this.vsomService.stopAllTraining();
        } catch (error) {
            this.logger.warn('Error stopping training during shutdown:', error);
        }
        
        this.initialized = false;
        this.logger.info('VSOM API shutdown complete');
    }
}