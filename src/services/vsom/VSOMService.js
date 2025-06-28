/**
 * VSOM Service - Backend service for managing Vector Self-Organizing Map instances
 * 
 * Provides a service layer that orchestrates multiple VSOM instances, handles training,
 * manages data loading, and integrates with the broader Semem ecosystem.
 */

import VSOM from '../../ragno/algorithms/VSOM.js';
import { logger } from '../../Utils.js';

export default class VSOMService {
    constructor(options = {}) {
        this.instances = new Map(); // Store multiple VSOM instances
        this.defaultOptions = {
            mapSize: [20, 20],
            topology: 'rectangular',
            embeddingDimension: 1536,
            maxIterations: 1000,
            initialLearningRate: 0.1,
            finalLearningRate: 0.01,
            clusterThreshold: 0.8,
            minClusterSize: 3,
            maxInstancesPerSession: 5,
            ...options
        };
        
        this.logger = logger;
        this.nextInstanceId = 1;
        this.trainingProcesses = new Map(); // Track ongoing training
        
        this.logger.info('VSOMService initialized with default options:', this.defaultOptions);
    }
    
    /**
     * Create a new VSOM instance
     * @param {Object} config - Configuration for the VSOM instance
     * @returns {Promise<Object>} Instance creation result
     */
    async createInstance(config = {}) {
        // Check instance limit
        if (this.instances.size >= this.defaultOptions.maxInstancesPerSession) {
            throw new Error(`Maximum number of instances (${this.defaultOptions.maxInstancesPerSession}) reached`);
        }
        
        const instanceId = `vsom_${this.nextInstanceId++}`;
        const instanceConfig = { ...this.defaultOptions, ...config };
        
        try {
            const vsom = new VSOM(instanceConfig);
            
            const instanceData = {
                instanceId,
                vsom,
                config: instanceConfig,
                status: 'created',
                created: new Date(),
                dataLoaded: false,
                entitiesCount: 0,
                trainingProgress: null
            };
            
            this.instances.set(instanceId, instanceData);
            
            this.logger.info(`Created VSOM instance: ${instanceId}`, { config: instanceConfig });
            
            return {
                instanceId,
                config: instanceConfig,
                status: 'created',
                created: instanceData.created
            };
        } catch (error) {
            this.logger.error(`Failed to create VSOM instance: ${error.message}`);
            throw error;
        }
    }
    
    /**
     * Load data into a VSOM instance
     * @param {string} instanceId - Instance identifier
     * @param {Array} entities - Array of entity objects with embeddings
     * @returns {Promise<Object>} Loading result
     */
    async loadData(instanceId, entities) {
        const instance = this.getInstance(instanceId);
        
        if (!Array.isArray(entities) || entities.length === 0) {
            throw new Error('Entities must be a non-empty array');
        }
        
        // Validate entity format
        for (const entity of entities) {
            if (!entity.id || !entity.embedding || !Array.isArray(entity.embedding)) {
                throw new Error('Each entity must have id and embedding array');
            }
        }
        
        try {
            // Load entities into VSOM
            await instance.vsom.loadEntities(entities);
            
            // Update instance metadata
            instance.dataLoaded = true;
            instance.entitiesCount = entities.length;
            instance.status = 'data_loaded';
            
            this.logger.info(`Loaded ${entities.length} entities into VSOM instance: ${instanceId}`);
            
            return {
                success: true,
                entitiesLoaded: entities.length,
                status: 'data_loaded'
            };
        } catch (error) {
            this.logger.error(`Failed to load data into VSOM instance ${instanceId}: ${error.message}`);
            throw error;
        }
    }
    
    /**
     * Train a VSOM instance
     * @param {string} instanceId - Instance identifier
     * @param {Object} options - Training options
     * @returns {Promise<Object>} Training result
     */
    async train(instanceId, options = {}) {
        const instance = this.getInstance(instanceId);
        
        if (!instance.dataLoaded) {
            throw new Error('Cannot train VSOM: no data loaded');
        }
        
        if (this.trainingProcesses.has(instanceId)) {
            throw new Error('Training already in progress for this instance');
        }
        
        const {
            epochs = this.defaultOptions.defaultTrainingEpochs || 100,
            batchSize = 10,
            progressCallback = null
        } = options;
        
        try {
            instance.status = 'training';
            instance.trainingProgress = {
                startTime: new Date(),
                epochs: 0,
                totalEpochs: epochs,
                currentError: null
            };
            
            // Mark training as active
            this.trainingProcesses.set(instanceId, {
                startTime: new Date(),
                epochs,
                batchSize,
                stopped: false
            });
            
            this.logger.info(`Starting training for VSOM instance: ${instanceId}`, { epochs, batchSize });
            
            // Create progress callback that updates instance state
            const internalProgressCallback = (progress) => {
                if (instance.trainingProgress) {
                    instance.trainingProgress.epochs = progress.epoch;
                    instance.trainingProgress.currentError = progress.error;
                }
                
                // Call external callback if provided
                if (progressCallback && typeof progressCallback === 'function') {
                    progressCallback(progress);
                }
            };
            
            // Execute training
            const result = await instance.vsom.train({
                epochs,
                batchSize,
                progressCallback: internalProgressCallback
            });
            
            // Update instance state
            instance.status = 'trained';
            instance.trainingProgress.endTime = new Date();
            instance.trainingProgress.finalError = result.finalError;
            
            // Clean up training process tracking
            this.trainingProcesses.delete(instanceId);
            
            this.logger.info(`Training completed for VSOM instance: ${instanceId}`, {
                epochs: result.epochs,
                finalError: result.finalError,
                duration: Date.now() - instance.trainingProgress.startTime.getTime()
            });
            
            return {
                instanceId,
                epochs: result.epochs,
                finalError: result.finalError,
                duration: instance.trainingProgress.endTime - instance.trainingProgress.startTime,
                status: 'completed'
            };
        } catch (error) {
            // Clean up on error
            instance.status = 'error';
            this.trainingProcesses.delete(instanceId);
            
            this.logger.error(`Training failed for VSOM instance ${instanceId}: ${error.message}`);
            throw error;
        }
    }
    
    /**
     * Stop ongoing training for an instance
     * @param {string} instanceId - Instance identifier
     * @returns {Promise<Object>} Stop result
     */
    async stopTraining(instanceId) {
        const instance = this.getInstance(instanceId);
        const trainingProcess = this.trainingProcesses.get(instanceId);
        
        if (!trainingProcess) {
            return { stopped: false, status: instance.status, message: 'No training in progress' };
        }
        
        try {
            // Mark as stopped
            trainingProcess.stopped = true;
            
            // Update instance state
            instance.status = 'training_stopped';
            if (instance.trainingProgress) {
                instance.trainingProgress.stopped = true;
                instance.trainingProgress.endTime = new Date();
            }
            
            // Clean up
            this.trainingProcesses.delete(instanceId);
            
            this.logger.info(`Training stopped for VSOM instance: ${instanceId}`);
            
            return { stopped: true, status: 'training_stopped' };
        } catch (error) {
            this.logger.error(`Failed to stop training for VSOM instance ${instanceId}: ${error.message}`);
            throw error;
        }
    }
    
    /**
     * Get grid state for visualization
     * @param {string} instanceId - Instance identifier
     * @param {Object} options - Grid state options
     * @returns {Promise<Object>} Grid state
     */
    async getGridState(instanceId, options = {}) {
        const instance = this.getInstance(instanceId);
        const { includeWeights = false } = options;
        
        try {
            const grid = await instance.vsom.getGrid();
            const mappings = await instance.vsom.getEntityMappings();
            
            return {
                grid: includeWeights ? grid : this.stripWeights(grid),
                mappings,
                metadata: {
                    mapSize: instance.config.mapSize,
                    entitiesCount: instance.entitiesCount,
                    trained: instance.status === 'trained'
                }
            };
        } catch (error) {
            this.logger.error(`Failed to get grid state for VSOM instance ${instanceId}: ${error.message}`);
            throw error;
        }
    }
    
    /**
     * Get feature maps (U-Matrix, component planes)
     * @param {string} instanceId - Instance identifier
     * @param {Object} options - Feature map options
     * @returns {Promise<Object>} Feature maps
     */
    async getFeatureMaps(instanceId, options = {}) {
        const instance = this.getInstance(instanceId);
        const { mapType = 'umatrix' } = options;
        
        try {
            let featureMap;
            let statistics = {};
            
            switch (mapType) {
                case 'umatrix':
                    featureMap = await instance.vsom.calculateUMatrix();
                    statistics = this.calculateUMatrixStats(featureMap);
                    break;
                case 'component':
                    featureMap = await instance.vsom.getComponentPlanes();
                    statistics = this.calculateComponentStats(featureMap);
                    break;
                default:
                    throw new Error(`Unsupported map type: ${mapType}`);
            }
            
            return {
                featureMap,
                statistics,
                mapType,
                metadata: {
                    mapSize: instance.config.mapSize,
                    generated: new Date()
                }
            };
        } catch (error) {
            this.logger.error(`Failed to get feature maps for VSOM instance ${instanceId}: ${error.message}`);
            throw error;
        }
    }
    
    /**
     * Perform clustering on the trained SOM
     * @param {string} instanceId - Instance identifier
     * @param {Object} options - Clustering options
     * @returns {Promise<Object>} Clustering result
     */
    async cluster(instanceId, options = {}) {
        const instance = this.getInstance(instanceId);
        
        if (instance.status !== 'trained') {
            throw new Error('Cannot cluster: VSOM instance is not trained');
        }
        
        const {
            algorithm = 'umatrix',
            threshold = instance.config.clusterThreshold,
            minClusterSize = instance.config.minClusterSize
        } = options;
        
        try {
            const clusters = await instance.vsom.cluster({
                algorithm,
                threshold,
                minClusterSize
            });
            
            const statistics = {
                totalClusters: clusters.length,
                totalEntities: instance.entitiesCount,
                averageClusterSize: clusters.reduce((sum, c) => sum + c.entities.length, 0) / clusters.length,
                largestCluster: Math.max(...clusters.map(c => c.entities.length)),
                smallestCluster: Math.min(...clusters.map(c => c.entities.length))
            };
            
            this.logger.info(`Clustering completed for VSOM instance: ${instanceId}`, statistics);
            
            return {
                clusters,
                statistics,
                algorithm,
                parameters: { threshold, minClusterSize }
            };
        } catch (error) {
            this.logger.error(`Failed to cluster VSOM instance ${instanceId}: ${error.message}`);
            throw error;
        }
    }
    
    /**
     * Get training status for an instance
     * @param {string} instanceId - Instance identifier
     * @returns {Promise<Object>} Training status
     */
    async getTrainingStatus(instanceId) {
        const instance = this.getInstance(instanceId);
        const trainingProcess = this.trainingProcesses.get(instanceId);
        
        return {
            status: instance.status,
            trainingProgress: instance.trainingProgress,
            isTraining: !!trainingProcess,
            dataLoaded: instance.dataLoaded,
            entitiesCount: instance.entitiesCount
        };
    }
    
    /**
     * Get training status for all instances
     * @returns {Promise<Array>} All training statuses
     */
    async getAllTrainingStatus() {
        const statuses = [];
        
        for (const [instanceId, instance] of this.instances) {
            const status = await this.getTrainingStatus(instanceId);
            statuses.push({ instanceId, ...status });
        }
        
        return statuses;
    }
    
    /**
     * List all VSOM instances
     * @returns {Promise<Array>} List of instances
     */
    async listInstances() {
        const instances = [];
        
        for (const [instanceId, instance] of this.instances) {
            instances.push({
                instanceId,
                config: instance.config,
                status: instance.status,
                created: instance.created,
                dataLoaded: instance.dataLoaded,
                entitiesCount: instance.entitiesCount
            });
        }
        
        return instances;
    }
    
    /**
     * Delete a VSOM instance
     * @param {string} instanceId - Instance identifier
     * @returns {Promise<Object>} Deletion result
     */
    async deleteInstance(instanceId) {
        const instance = this.getInstance(instanceId);
        
        // Stop training if in progress
        if (this.trainingProcesses.has(instanceId)) {
            await this.stopTraining(instanceId);
        }
        
        // Clean up resources
        if (instance.vsom && typeof instance.vsom.cleanup === 'function') {
            await instance.vsom.cleanup();
        }
        
        // Remove from instances
        this.instances.delete(instanceId);
        
        this.logger.info(`Deleted VSOM instance: ${instanceId}`);
        
        return { deleted: true };
    }
    
    /**
     * Stop all training processes
     */
    async stopAllTraining() {
        const stopPromises = [];
        
        for (const instanceId of this.trainingProcesses.keys()) {
            stopPromises.push(this.stopTraining(instanceId));
        }
        
        await Promise.allSettled(stopPromises);
    }
    
    /**
     * Get instance by ID with validation
     * @param {string} instanceId - Instance identifier
     * @returns {Object} Instance data
     * @private
     */
    getInstance(instanceId) {
        const instance = this.instances.get(instanceId);
        if (!instance) {
            throw new Error(`VSOM instance not found: ${instanceId}`);
        }
        return instance;
    }
    
    /**
     * Strip weights from grid for lightweight transfer
     * @param {Array} grid - Grid with weights
     * @returns {Array} Grid without weights
     * @private
     */
    stripWeights(grid) {
        return grid.map(row => 
            row.map(node => ({
                x: node.x,
                y: node.y,
                entityCount: node.entities ? node.entities.length : 0
            }))
        );
    }
    
    /**
     * Calculate U-Matrix statistics
     * @param {Array} uMatrix - U-Matrix data
     * @returns {Object} Statistics
     * @private
     */
    calculateUMatrixStats(uMatrix) {
        const flatValues = uMatrix.flat();
        const validValues = flatValues.filter(v => v !== null && v !== undefined);
        
        return {
            min: Math.min(...validValues),
            max: Math.max(...validValues),
            mean: validValues.reduce((sum, v) => sum + v, 0) / validValues.length,
            nonNullCount: validValues.length,
            totalCells: flatValues.length
        };
    }
    
    /**
     * Calculate component plane statistics
     * @param {Object} componentPlanes - Component planes data
     * @returns {Object} Statistics
     * @private
     */
    calculateComponentStats(componentPlanes) {
        const stats = {};
        
        for (const [component, plane] of Object.entries(componentPlanes)) {
            const flatValues = plane.flat();
            const validValues = flatValues.filter(v => v !== null && v !== undefined);
            
            stats[component] = {
                min: Math.min(...validValues),
                max: Math.max(...validValues),
                mean: validValues.reduce((sum, v) => sum + v, 0) / validValues.length
            };
        }
        
        return stats;
    }
}