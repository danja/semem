/**
 * VSOM Service - HTTP API wrapper for VSOM.js
 * Provides RESTful interface to Vector Self-Organizing Map functionality
 */

import VSOM from '../../ragno/algorithms/VSOM.js'
import { logger } from '../../Utils.js'

export default class VSOMService {
    constructor(options = {}) {
        this.instances = new Map() // Store multiple VSOM instances
        this.defaultOptions = {
            mapSize: [20, 20],
            topology: 'rectangular',
            embeddingDimension: 1536,
            maxIterations: 1000,
            initialLearningRate: 0.1,
            finalLearningRate: 0.01,
            clusterThreshold: 0.8,
            minClusterSize: 3,
            ...options
        }
        
        // Default VSOM instance
        this.currentInstance = null
        this.isTraining = false
        this.trainingProgress = null
        
        logger.info('VSOMService initialized')
    }

    /**
     * Create a new VSOM instance
     * @param {Object} options - VSOM configuration options
     * @returns {Object} Instance information
     */
    async createInstance(options = {}) {
        const instanceId = `vsom_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        const config = { ...this.defaultOptions, ...options }
        
        try {
            const vsom = new VSOM(config)
            this.instances.set(instanceId, {
                vsom: vsom,
                config: config,
                created: new Date(),
                status: 'created'
            })
            
            // Set as current instance if it's the first one
            if (!this.currentInstance) {
                this.currentInstance = instanceId
            }
            
            logger.info(`Created VSOM instance: ${instanceId}`)
            
            return {
                instanceId: instanceId,
                config: config,
                status: 'created',
                message: 'VSOM instance created successfully'
            }
            
        } catch (error) {
            logger.error('Error creating VSOM instance:', error)
            throw new Error(`Failed to create VSOM instance: ${error.message}`)
        }
    }

    /**
     * Load data into VSOM instance
     * @param {string} instanceId - VSOM instance ID
     * @param {Object} data - Data to load
     * @param {Object} embeddingHandler - Embedding handler
     * @returns {Object} Loading results
     */
    async loadData(instanceId, data, embeddingHandler) {
        const instance = this.getInstance(instanceId)
        
        try {
            let loadResults
            
            if (data.type === 'entities' && data.entities) {
                // Load from entities array
                loadResults = await instance.vsom.loadFromEntities(data.entities, embeddingHandler)
            } else if (data.type === 'vectorIndex' && data.vectorIndex) {
                // Load from VectorIndex
                loadResults = await instance.vsom.loadFromVectorIndex(data.vectorIndex, data.filters)
            } else if (data.type === 'sparql' && data.endpoint && data.query) {
                // Load from SPARQL endpoint
                loadResults = await instance.vsom.loadFromSPARQL(data.endpoint, data.query, embeddingHandler)
            } else {
                throw new Error('Invalid data format. Must specify type and corresponding data.')
            }
            
            instance.status = 'data_loaded'
            
            logger.info(`Loaded data into VSOM ${instanceId}:`, loadResults)
            
            return {
                instanceId: instanceId,
                loadResults: loadResults,
                status: 'data_loaded',
                message: 'Data loaded successfully'
            }
            
        } catch (error) {
            logger.error(`Error loading data into VSOM ${instanceId}:`, error)
            throw new Error(`Failed to load data: ${error.message}`)
        }
    }

    /**
     * Train VSOM instance
     * @param {string} instanceId - VSOM instance ID
     * @param {Object} options - Training options
     * @returns {Object} Training results
     */
    async trainInstance(instanceId, options = {}) {
        const instance = this.getInstance(instanceId)
        
        if (instance.status !== 'data_loaded') {
            throw new Error('Cannot train VSOM: No data loaded. Load data first.')
        }
        
        try {
            this.isTraining = true
            this.trainingProgress = {
                instanceId: instanceId,
                currentIteration: 0,
                totalIterations: options.maxIterations || instance.config.maxIterations,
                trainingError: 0,
                learningRate: options.initialLearningRate || instance.config.initialLearningRate,
                startTime: Date.now(),
                status: 'training'
            }
            
            // Set up progress callback
            const onIteration = (iteration, error, learningRate) => {
                this.trainingProgress.currentIteration = iteration
                this.trainingProgress.trainingError = error
                this.trainingProgress.learningRate = learningRate
                this.trainingProgress.progress = (iteration / this.trainingProgress.totalIterations) * 100
            }
            
            const onComplete = (results) => {
                this.trainingProgress.status = 'completed'
                this.trainingProgress.endTime = Date.now()
                this.trainingProgress.totalTime = this.trainingProgress.endTime - this.trainingProgress.startTime
                this.isTraining = false
            }
            
            // Execute training
            const trainingResults = await instance.vsom.train({
                ...options,
                onIteration: onIteration,
                onComplete: onComplete
            })
            
            instance.status = 'trained'
            instance.trainingResults = trainingResults
            
            logger.info(`VSOM ${instanceId} training completed:`, trainingResults)
            
            return {
                instanceId: instanceId,
                trainingResults: trainingResults,
                status: 'trained',
                message: 'Training completed successfully'
            }
            
        } catch (error) {
            this.isTraining = false
            this.trainingProgress = null
            logger.error(`Error training VSOM ${instanceId}:`, error)
            throw new Error(`Training failed: ${error.message}`)
        }
    }

    /**
     * Get VSOM grid data for visualization
     * @param {string} instanceId - VSOM instance ID
     * @returns {Object} Grid visualization data
     */
    getGridData(instanceId) {
        const instance = this.getInstance(instanceId)
        
        if (instance.status !== 'trained') {
            throw new Error('Cannot get grid data: VSOM not trained. Train the instance first.')
        }
        
        try {
            const visualizationData = instance.vsom.exportVisualization('coordinates')
            const topology = instance.vsom.getTopology()
            const nodeMappings = instance.vsom.getNodeMappings()
            const statistics = instance.vsom.getStatistics()
            
            return {
                instanceId: instanceId,
                topology: topology,
                nodes: visualizationData,
                mappings: nodeMappings,
                statistics: statistics,
                gridSize: instance.config.mapSize,
                message: 'Grid data retrieved successfully'
            }
            
        } catch (error) {
            logger.error(`Error getting grid data for VSOM ${instanceId}:`, error)
            throw new Error(`Failed to get grid data: ${error.message}`)
        }
    }

    /**
     * Get feature maps data
     * @param {string} instanceId - VSOM instance ID
     * @param {Object} options - Feature map options
     * @returns {Object} Feature maps data
     */
    getFeatureMaps(instanceId, options = {}) {
        const instance = this.getInstance(instanceId)
        
        if (instance.status !== 'trained') {
            throw new Error('Cannot get feature maps: VSOM not trained. Train the instance first.')
        }
        
        try {
            const { dimension = 0, colorScheme = 'viridis' } = options
            const topology = instance.vsom.getTopology()
            const statistics = instance.vsom.getStatistics()
            
            // Get weights for all nodes for the specified dimension
            const featureMap = []
            for (let i = 0; i < topology.totalNodes; i++) {
                const weights = instance.vsom.core.getNodeWeights(i)
                const coords = instance.vsom.topology.indexToCoordinates(i)
                
                featureMap.push({
                    nodeIndex: i,
                    coordinates: coords,
                    value: weights[dimension] || 0,
                    allWeights: weights.slice(0, 10) // First 10 dimensions for preview
                })
            }
            
            // Calculate min/max values for the dimension
            const values = featureMap.map(node => node.value)
            const minValue = Math.min(...values)
            const maxValue = Math.max(...values)
            
            return {
                instanceId: instanceId,
                dimension: dimension,
                colorScheme: colorScheme,
                featureMap: featureMap,
                statistics: {
                    totalDimensions: statistics.embeddingDimension,
                    currentDimension: dimension,
                    minValue: minValue,
                    maxValue: maxValue,
                    meanValue: values.reduce((sum, val) => sum + val, 0) / values.length
                },
                topology: topology,
                message: 'Feature maps retrieved successfully'
            }
            
        } catch (error) {
            logger.error(`Error getting feature maps for VSOM ${instanceId}:`, error)
            throw new Error(`Failed to get feature maps: ${error.message}`)
        }
    }

    /**
     * Get clustering results
     * @param {string} instanceId - VSOM instance ID
     * @param {Object} options - Clustering options
     * @returns {Object} Clustering data
     */
    getClusters(instanceId, options = {}) {
        const instance = this.getInstance(instanceId)
        
        if (instance.status !== 'trained') {
            throw new Error('Cannot get clusters: VSOM not trained. Train the instance first.')
        }
        
        try {
            const threshold = options.threshold || instance.config.clusterThreshold
            const clusters = instance.vsom.getClusters(threshold)
            const nodeMappings = instance.vsom.getNodeMappings()
            const topology = instance.vsom.getTopology()
            
            // Enhanced cluster data with entity information
            const enhancedClusters = clusters.map((cluster, index) => ({
                id: index,
                ...cluster,
                entities: cluster.members.map(nodeIndex => {
                    // Find entities assigned to this node
                    const assignedEntities = nodeMappings.filter(mapping => 
                        mapping.nodeIndex === nodeIndex
                    )
                    return assignedEntities.map(mapping => ({
                        entity: mapping.entity,
                        metadata: mapping.metadata,
                        distance: mapping.distance
                    }))
                }).flat(),
                visualCoords: cluster.members.map(nodeIndex => 
                    instance.vsom.topology.indexToCoordinates(nodeIndex)
                )
            }))
            
            // Calculate clustering quality metrics
            const totalEntities = nodeMappings.length
            const clusteredEntities = enhancedClusters.reduce((sum, cluster) => 
                sum + cluster.entities.length, 0
            )
            
            const clusteringSummary = {
                totalClusters: enhancedClusters.length,
                totalEntities: totalEntities,
                clusteredEntities: clusteredEntities,
                clusteringRatio: totalEntities > 0 ? clusteredEntities / totalEntities : 0,
                averageClusterSize: enhancedClusters.length > 0 ? 
                    clusteredEntities / enhancedClusters.length : 0,
                largestCluster: Math.max(...enhancedClusters.map(c => c.entities.length), 0),
                smallestCluster: Math.min(...enhancedClusters.map(c => c.entities.length), 0)
            }
            
            return {
                instanceId: instanceId,
                clusters: enhancedClusters,
                summary: clusteringSummary,
                topology: topology,
                threshold: threshold,
                message: 'Clusters retrieved successfully'
            }
            
        } catch (error) {
            logger.error(`Error getting clusters for VSOM ${instanceId}:`, error)
            throw new Error(`Failed to get clusters: ${error.message}`)
        }
    }

    /**
     * Get training progress
     * @param {string} instanceId - VSOM instance ID
     * @returns {Object} Training progress data
     */
    getTrainingProgress(instanceId) {
        if (!this.trainingProgress || this.trainingProgress.instanceId !== instanceId) {
            return {
                instanceId: instanceId,
                isTraining: false,
                progress: null,
                message: 'No training in progress'
            }
        }
        
        return {
            instanceId: instanceId,
            isTraining: this.isTraining,
            progress: { ...this.trainingProgress },
            message: 'Training progress retrieved'
        }
    }

    /**
     * Stop training
     * @param {string} instanceId - VSOM instance ID
     * @returns {Object} Stop result
     */
    stopTraining(instanceId) {
        if (!this.isTraining || !this.trainingProgress || 
            this.trainingProgress.instanceId !== instanceId) {
            return {
                instanceId: instanceId,
                message: 'No training to stop'
            }
        }
        
        this.isTraining = false
        this.trainingProgress.status = 'stopped'
        this.trainingProgress.endTime = Date.now()
        
        logger.info(`Training stopped for VSOM ${instanceId}`)
        
        return {
            instanceId: instanceId,
            message: 'Training stopped successfully'
        }
    }

    /**
     * Reset VSOM instance
     * @param {string} instanceId - VSOM instance ID
     * @returns {Object} Reset result
     */
    resetInstance(instanceId) {
        const instance = this.getInstance(instanceId)
        
        try {
            instance.vsom.reset()
            instance.status = 'created'
            instance.trainingResults = null
            
            // Clear training progress if it's for this instance
            if (this.trainingProgress && this.trainingProgress.instanceId === instanceId) {
                this.trainingProgress = null
                this.isTraining = false
            }
            
            logger.info(`VSOM instance ${instanceId} reset`)
            
            return {
                instanceId: instanceId,
                status: 'created',
                message: 'Instance reset successfully'
            }
            
        } catch (error) {
            logger.error(`Error resetting VSOM ${instanceId}:`, error)
            throw new Error(`Failed to reset instance: ${error.message}`)
        }
    }

    /**
     * Get instance statistics
     * @param {string} instanceId - VSOM instance ID
     * @returns {Object} Instance statistics
     */
    getInstanceInfo(instanceId) {
        const instance = this.getInstance(instanceId)
        
        try {
            const statistics = instance.vsom.getStatistics()
            
            return {
                instanceId: instanceId,
                config: instance.config,
                status: instance.status,
                created: instance.created,
                statistics: statistics,
                trainingResults: instance.trainingResults,
                isTraining: this.isTraining && this.trainingProgress?.instanceId === instanceId,
                message: 'Instance information retrieved'
            }
            
        } catch (error) {
            logger.error(`Error getting instance info for VSOM ${instanceId}:`, error)
            throw new Error(`Failed to get instance info: ${error.message}`)
        }
    }

    /**
     * List all instances
     * @returns {Object} List of all instances
     */
    listInstances() {
        const instanceList = Array.from(this.instances.entries()).map(([id, instance]) => ({
            instanceId: id,
            status: instance.status,
            created: instance.created,
            config: {
                mapSize: instance.config.mapSize,
                topology: instance.config.topology,
                embeddingDimension: instance.config.embeddingDimension
            },
            isCurrent: id === this.currentInstance
        }))
        
        return {
            instances: instanceList,
            currentInstance: this.currentInstance,
            totalInstances: instanceList.length,
            message: 'Instances listed successfully'
        }
    }

    /**
     * Delete an instance
     * @param {string} instanceId - VSOM instance ID
     * @returns {Object} Delete result
     */
    deleteInstance(instanceId) {
        if (!this.instances.has(instanceId)) {
            throw new Error(`VSOM instance not found: ${instanceId}`)
        }
        
        // Stop training if this instance is training
        if (this.trainingProgress && this.trainingProgress.instanceId === instanceId) {
            this.stopTraining(instanceId)
        }
        
        this.instances.delete(instanceId)
        
        // Update current instance if deleted
        if (this.currentInstance === instanceId) {
            const remainingInstances = Array.from(this.instances.keys())
            this.currentInstance = remainingInstances.length > 0 ? remainingInstances[0] : null
        }
        
        logger.info(`VSOM instance deleted: ${instanceId}`)
        
        return {
            instanceId: instanceId,
            message: 'Instance deleted successfully'
        }
    }

    /**
     * Set current instance
     * @param {string} instanceId - VSOM instance ID
     * @returns {Object} Set result
     */
    setCurrentInstance(instanceId) {
        this.getInstance(instanceId) // Validate instance exists
        
        this.currentInstance = instanceId
        
        return {
            instanceId: instanceId,
            message: 'Current instance set successfully'
        }
    }

    /**
     * Get current instance ID
     * @returns {string|null} Current instance ID
     */
    getCurrentInstanceId() {
        return this.currentInstance
    }

    /**
     * Helper method to get instance
     * @param {string} instanceId - VSOM instance ID
     * @returns {Object} Instance object
     */
    getInstance(instanceId) {
        // Use current instance if no specific ID provided
        const id = instanceId || this.currentInstance
        
        if (!id) {
            throw new Error('No VSOM instance specified and no current instance set')
        }
        
        if (!this.instances.has(id)) {
            throw new Error(`VSOM instance not found: ${id}`)
        }
        
        return this.instances.get(id)
    }

    /**
     * Create mock embedding handler for testing
     * @returns {Object} Mock embedding handler
     */
    createMockEmbeddingHandler() {
        return {
            generateEmbedding: async (text) => {
                // Generate a mock 1536-dimensional embedding
                const embedding = new Array(1536)
                for (let i = 0; i < 1536; i++) {
                    embedding[i] = Math.random() * 2 - 1 // Random values between -1 and 1
                }
                return embedding
            }
        }
    }

    /**
     * Generate sample data for testing
     * @param {number} count - Number of sample entities
     * @returns {Array} Sample entities
     */
    generateSampleData(count = 20) {
        const topics = [
            'machine learning', 'natural language processing', 'computer vision',
            'data science', 'artificial intelligence', 'deep learning',
            'web development', 'database design', 'software architecture',
            'cybersecurity', 'cloud computing', 'mobile development'
        ]
        
        const entities = []
        for (let i = 0; i < count; i++) {
            const topic = topics[i % topics.length]
            entities.push({
                uri: `http://example.org/entity_${i}`,
                content: `This is sample content about ${topic} with some additional information.`,
                type: 'concept',
                metadata: {
                    topic: topic,
                    generated: true,
                    index: i
                }
            })
        }
        
        return entities
    }
}