/**
 * VSOM.js - Vectorized Self-Organizing Map for Ragno Knowledge Graphs
 * 
 * This is the main VSOM implementation that integrates with the Ragno knowledge graph
 * system to provide entity clustering, visualization, and semantic organization
 * capabilities. It combines the core algorithm, topology management, and training
 * procedures into a unified interface.
 * 
 * Key Features:
 * - Entity clustering for knowledge graphs
 * - Integration with SPARQL endpoints and in-memory data
 * - RDF export with ragno ontology properties
 * - Multiple data input sources
 * - Visualization coordinate generation
 * - Integration with existing Ragno algorithms
 */

import rdf from 'rdf-ext'
import VSOMCore from './vsom/VSOMCore.js'
import VSOMTopology from './vsom/VSOMTopology.js'
import VSOMTraining from './vsom/VSOMTraining.js'
import NamespaceManager from '../core/NamespaceManager.js'
import { logger } from '../../Utils.js'

export default class VSOM {
    constructor(options = {}) {
        this.options = {
            // Map configuration
            mapSize: options.mapSize || [20, 20],
            topology: options.topology || 'rectangular',
            boundaryCondition: options.boundaryCondition || 'bounded',

            // Algorithm parameters
            embeddingDimension: options.embeddingDimension,
            distanceMetric: options.distanceMetric || 'cosine',

            // Training parameters
            maxIterations: options.maxIterations || 1000,
            initialLearningRate: options.initialLearningRate,
            finalLearningRate: options.finalLearningRate || 0.01,
            initialRadius: options.initialRadius || Math.max(...(options.mapSize || [20, 20])) / 4,
            finalRadius: options.finalRadius,

            // Data handling
            batchSize: options.batchSize || 100,

            // Clustering
            clusterThreshold: options.clusterThreshold,
            minClusterSize: options.minClusterSize || 3,

            // RDF integration
            uriBase: options.uriBase || 'http://example.org/ragno/',
            exportToRDF: options.exportToRDF !== false,

            // Performance
            logProgress: options.logProgress !== false,

            ...options
        }

        // Initialize components
        this.core = new VSOMCore({
            distanceMetric: this.options.distanceMetric,
            batchSize: this.options.batchSize
        })

        this.topology = new VSOMTopology({
            topology: this.options.topology,
            boundaryCondition: this.options.boundaryCondition,
            mapSize: this.options.mapSize
        })

        this.training = new VSOMTraining({
            maxIterations: this.options.maxIterations,
            initialLearningRate: this.options.initialLearningRate,
            finalLearningRate: this.options.finalLearningRate,
            initialRadius: this.options.initialRadius,
            finalRadius: this.options.finalRadius,
            batchSize: this.options.batchSize,
            logProgress: this.options.logProgress
        })

        this.namespaces = new NamespaceManager({ uriBase: this.options.uriBase })

        // Data storage
        this.entities = []
        this.embeddings = []
        this.entityMetadata = []
        this.trained = false
        this.clusters = null
        this.nodeAssignments = null

        // Training results
        this.trainingResults = null

        // Statistics
        this.stats = {
            totalEntities: 0,
            totalClusters: 0,
            trainingTime: 0,
            lastTrainingDate: null,
            dataLoadTime: 0,
            lastDataLoadDate: null
        }

        logger.debug('VSOM initialized with options:', {
            mapSize: this.options.mapSize,
            topology: this.options.topology,
            embeddingDimension: this.options.embeddingDimension
        })
    }

    /**
     * Load entities from an array with embedding generation
     * @param {Array} entities - Array of Entity objects or entity data
     * @param {Object} embeddingHandler - Embedding handler for vector generation
     * @param {Object} [options] - Loading options
     * @returns {Promise<Object>} Loading results
     */
    async loadFromEntities(entities, embeddingHandler, options = {}) {
        const startTime = Date.now()
        logger.info(`Loading ${entities.length} entities into VSOM`)

        this.entities = []
        this.embeddings = []
        this.entityMetadata = []

        const batchSize = options.batchSize || this.options.batchSize
        let processedCount = 0

        try {
            // Process entities in batches
            for (let i = 0; i < entities.length; i += batchSize) {
                const batch = entities.slice(i, i + batchSize)

                for (const entity of batch) {
                    // Extract entity information
                    const entityData = this.extractEntityData(entity)

                    // Generate embedding for entity content
                    const embedding = await embeddingHandler.generateEmbedding(entityData.content)

                    // Validate embedding dimension
                    if (embedding.length !== this.options.embeddingDimension) {
                        logger.warn(`Embedding dimension mismatch: expected ${this.options.embeddingDimension}, got ${embedding.length}`)
                        continue
                    }

                    this.entities.push(entity)
                    this.embeddings.push(embedding)
                    this.entityMetadata.push(entityData)
                    processedCount++
                }

                if (this.options.logProgress && (i + batchSize) % (batchSize * 10) === 0) {
                    logger.info(`Processed ${Math.min(i + batchSize, entities.length)}/${entities.length} entities`)
                }
            }

            const loadTime = Date.now() - startTime
            this.stats.totalEntities = processedCount
            this.stats.dataLoadTime = loadTime
            this.stats.lastDataLoadDate = new Date()

            logger.info(`Loaded ${processedCount} entities in ${loadTime}ms`)

            return {
                entitiesLoaded: processedCount,
                entitiesSkipped: entities.length - processedCount,
                loadTime: loadTime,
                averageEmbeddingTime: loadTime / processedCount
            }

        } catch (error) {
            logger.error('Error loading entities:', error)
            throw error
        }
    }

    /**
     * Load entities from SPARQL endpoint
     * @param {string} endpoint - SPARQL endpoint URL
     * @param {string} query - SPARQL query to retrieve entities
     * @param {Object} embeddingHandler - Embedding handler for vector generation
     * @param {Object} [options] - Loading options
     * @returns {Promise<Object>} Loading results
     */
    async loadFromSPARQL(endpoint, query, embeddingHandler, options = {}) {
        logger.info(`Loading entities from SPARQL endpoint: ${endpoint}`)

        try {
            // Execute SPARQL query
            const sparqlResults = await this.executeSPARQLQuery(endpoint, query, options)

            // Convert SPARQL results to entity format
            const entities = this.processSPARQLResults(sparqlResults)

            // Load the entities
            return await this.loadFromEntities(entities, embeddingHandler, options)

        } catch (error) {
            logger.error('Error loading from SPARQL:', error)
            throw error
        }
    }

    /**
     * Load entities from existing VectorIndex
     * @param {Object} vectorIndex - VectorIndex instance
     * @param {Object} [filters] - Filters to apply
     * @returns {Promise<Object>} Loading results
     */
    async loadFromVectorIndex(vectorIndex, filters = {}) {
        logger.info('Loading entities from VectorIndex')

        try {
            // Get all indexed entities
            const indexedEntities = vectorIndex.getAllNodes()

            // Apply filters
            const filteredEntities = this.applyEntityFilters(indexedEntities, filters)

            // Extract entities and embeddings
            this.entities = []
            this.embeddings = []
            this.entityMetadata = []

            for (const indexedEntity of filteredEntities) {
                this.entities.push(indexedEntity.entity)
                this.embeddings.push(indexedEntity.embedding)
                this.entityMetadata.push({
                    uri: indexedEntity.uri,
                    content: indexedEntity.content,
                    type: indexedEntity.type,
                    fromVectorIndex: true
                })
            }

            this.stats.totalEntities = this.entities.length
            this.stats.lastDataLoadDate = new Date()

            logger.info(`Loaded ${this.entities.length} entities from VectorIndex`)

            return {
                entitiesLoaded: this.entities.length,
                entitiesSkipped: 0,
                loadTime: 0
            }

        } catch (error) {
            logger.error('Error loading from VectorIndex:', error)
            throw error
        }
    }

    /**
     * Train the VSOM on loaded data
     * @param {Object} [options] - Training options
     * @returns {Promise<Object>} Training results
     */
    async train(options = {}) {
        if (this.embeddings.length === 0) {
            throw new Error('No data loaded. Call loadFromEntities, loadFromSPARQL, or loadFromVectorIndex first.')
        }

        logger.info(`Training VSOM on ${this.embeddings.length} entities`)

        // Initialize core algorithm
        this.core.initializeWeights(
            this.options.mapSize,
            this.options.embeddingDimension,
            options.initMethod || 'random'
        )

        // Execute training
        this.trainingResults = await this.training.train(
            this.core,
            this.topology,
            this.embeddings,
            {
                onIteration: options.onIteration,
                onComplete: options.onComplete,
                shouldStop: options.shouldStop
            }
        )

        this.trained = true
        this.stats.trainingTime = this.trainingResults.trainingTime
        this.stats.lastTrainingDate = new Date()

        // Generate node assignments
        this.generateNodeAssignments()

        logger.info(`VSOM training completed: ${this.trainingResults.totalIterations} iterations, ${this.trainingResults.trainingTime}ms`)

        return this.trainingResults
    }

    /**
     * Generate cluster assignments for entities
     * @param {number} [threshold] - Clustering threshold
     * @returns {Array} Array of cluster assignments
     */
    getClusters(threshold = null) {
        if (!this.trained) {
            throw new Error('VSOM must be trained before clustering. Call train() first.')
        }

        const clusterThreshold = threshold || this.options.clusterThreshold

        logger.info(`Generating clusters with threshold ${clusterThreshold}`)

        // Use weight similarity for clustering
        this.clusters = this.generateClusters(clusterThreshold)
        this.stats.totalClusters = this.clusters.length

        return this.clusters
    }

    /**
     * Get node mappings (entity to map position)
     * @returns {Array} Array of node mappings
     */
    getNodeMappings() {
        if (!this.nodeAssignments) {
            throw new Error('Node assignments not generated. Train the VSOM first.')
        }

        return this.nodeAssignments.map((assignment, index) => ({
            entityIndex: index,
            entity: this.entities[index],
            mapPosition: this.topology.indexToCoordinates(assignment.nodeIndex),
            nodeIndex: assignment.nodeIndex,
            distance: assignment.distance,
            metadata: this.entityMetadata[index]
        }))
    }

    /**
     * Get topology information
     * @returns {Object} Topology information
     */
    getTopology() {
        return this.topology.getTopologyInfo()
    }

    /**
     * Export results to RDF dataset
     * @param {Object} dataset - RDF dataset to augment
     * @param {Object} [options] - Export options
     * @returns {number} Number of triples added
     */
    exportToRDF(dataset, options = {}) {
        if (!this.trained) {
            throw new Error('VSOM must be trained before RDF export')
        }

        logger.info('Exporting VSOM results to RDF')

        let triplesAdded = 0
        const clusters = this.clusters || this.getClusters()
        const nodeMappings = this.getNodeMappings()

        // Export cluster information
        for (let clusterIndex = 0; clusterIndex < clusters.length; clusterIndex++) {
            const cluster = clusters[clusterIndex]
            const clusterUri = this.namespaces.ex(`cluster_${clusterIndex}`)

            // Cluster type
            dataset.add(rdf.quad(
                clusterUri,
                this.namespaces.rdf('type'),
                this.namespaces.ragno('Cluster')
            ))

            // Cluster properties
            dataset.add(rdf.quad(
                clusterUri,
                this.namespaces.ragno('memberCount'),
                rdf.literal(cluster.members.length.toString(), this.namespaces.xsd('integer'))
            ))

            if (cluster.centroid) {
                dataset.add(rdf.quad(
                    clusterUri,
                    this.namespaces.ragno('clusterCentroid'),
                    rdf.literal(cluster.centroid.join(','), this.namespaces.ragno('Vector'))
                ))
            }

            triplesAdded += 3
        }

        // Export entity mappings
        for (const mapping of nodeMappings) {
            const entityUri = rdf.namedNode(mapping.metadata.uri || mapping.entity.uri)

            // Map position
            dataset.add(rdf.quad(
                entityUri,
                this.namespaces.ragno('mapPosition'),
                rdf.literal(`${mapping.mapPosition[0]},${mapping.mapPosition[1]}`, this.namespaces.xsd('string'))
            ))

            // Find cluster assignment
            const clusterIndex = this.findEntityCluster(mapping.entityIndex, clusters)
            if (clusterIndex !== -1) {
                const clusterUri = this.namespaces.ex(`cluster_${clusterIndex}`)
                dataset.add(rdf.quad(
                    entityUri,
                    this.namespaces.ragno('cluster'),
                    clusterUri
                ))

                // Cluster confidence based on distance to BMU
                const confidence = Math.max(0, 1 - mapping.distance)
                dataset.add(rdf.quad(
                    entityUri,
                    this.namespaces.ragno('clusterConfidence'),
                    rdf.literal(confidence.toFixed(3), this.namespaces.xsd('decimal'))
                ))
            }

            triplesAdded += 3
        }

        logger.info(`Exported ${triplesAdded} RDF triples`)
        return triplesAdded
    }

    /**
     * Export visualization coordinates
     * @param {string} [format] - Output format ('coordinates', 'json', 'csv')
     * @returns {Object|string} Visualization data
     */
    exportVisualization(format = 'coordinates') {
        const visualCoords = this.topology.getVisualizationCoordinates('cartesian')
        const nodeMappings = this.getNodeMappings()

        const visualizationData = visualCoords.map(coord => {
            // Find entity assigned to this node
            const assignedEntity = nodeMappings.find(mapping => mapping.nodeIndex === coord.index)

            return {
                nodeIndex: coord.index,
                mapCoords: coord.mapCoords,
                visualCoords: coord.visualCoords,
                entity: assignedEntity ? {
                    uri: assignedEntity.metadata.uri,
                    content: assignedEntity.metadata.content,
                    type: assignedEntity.metadata.type
                } : null,
                weights: this.core.getNodeWeights(coord.index)
            }
        })

        switch (format) {
            case 'json':
                return JSON.stringify(visualizationData, null, 2)
            case 'csv':
                return this.convertToCSV(visualizationData)
            case 'coordinates':
            default:
                return visualizationData
        }
    }

    /**
     * Integrate with Hyde algorithm results
     * @param {Object} hydeResults - Results from Hyde algorithm
     * @returns {Object} Integration results
     */
    async integrateWithHyde(hydeResults) {
        logger.info('Integrating VSOM with Hyde results')

        // Separate hypothetical entities from factual ones
        const hypotheticalEntities = hydeResults.entities.filter(entity =>
            entity.metadata && entity.metadata.hypothetical
        )

        // Create separate clusters for hypothetical content
        const hypotheticalClusters = await this.clusterHypotheticalEntities(hypotheticalEntities)

        return {
            hypotheticalClusters: hypotheticalClusters,
            totalHypotheticalEntities: hypotheticalEntities.length,
            confidenceDistribution: this.analyzeConfidenceDistribution(hypotheticalEntities)
        }
    }

    /**
     * Integrate with GraphAnalytics results
     * @param {Object} graphResults - Results from GraphAnalytics
     * @returns {Object} Integration results
     */
    integrateWithGraphAnalytics(graphResults) {
        logger.info('Integrating VSOM with GraphAnalytics results')

        // Use centrality measures to weight entity importance in clustering
        const enhancedClusters = this.enhanceClustersWithCentrality(graphResults)

        return {
            enhancedClusters: enhancedClusters,
            centralityWeighting: true
        }
    }

    // Helper methods

    /**
     * Extract entity data from various entity formats
     * @param {Object} entity - Entity object
     * @returns {Object} Extracted entity data
     */
    extractEntityData(entity) {
        // Handle different entity formats
        if (entity.getPrefLabel && typeof entity.getPrefLabel === 'function') {
            // Ragno Entity object
            return {
                uri: entity.uri,
                content: entity.getPrefLabel() || entity.content || '',
                type: entity.getSubType() || 'entity',
                metadata: entity.metadata || {}
            }
        } else if (entity.uri && entity.content) {
            // Plain object with uri and content
            return {
                uri: entity.uri,
                content: entity.content,
                type: entity.type || 'entity',
                metadata: entity.metadata || {}
            }
        } else if (typeof entity === 'string') {
            // String content
            const uri = this.namespaces.ex(`entity_${Date.now()}_${Math.random()}`)
            return {
                uri: uri.value,
                content: entity,
                type: 'text',
                metadata: {}
            }
        } else {
            throw new Error(`Unsupported entity format: ${typeof entity}`)
        }
    }

    /**
     * Execute SPARQL query (placeholder implementation)
     * @param {string} endpoint - SPARQL endpoint URL
     * @param {string} query - SPARQL query
     * @param {Object} options - Query options
     * @returns {Promise<Array>} Query results
     */
    async executeSPARQLQuery(endpoint, query, options) {
        // This would integrate with the existing SPARQL infrastructure
        // For now, return empty results
        logger.warn('SPARQL query execution not implemented yet')
        return []
    }

    /**
     * Process SPARQL results into entity format
     * @param {Array} sparqlResults - SPARQL query results
     * @returns {Array} Processed entities
     */
    processSPARQLResults(sparqlResults) {
        return sparqlResults.map(result => ({
            uri: result.entity?.value || '',
            content: result.label?.value || result.content?.value || '',
            type: result.type?.value || 'entity',
            metadata: {
                fromSPARQL: true,
                sparqlResult: result
            }
        }))
    }

    /**
     * Apply filters to entity data
     * @param {Array} entities - Array of entities
     * @param {Object} filters - Filter criteria
     * @returns {Array} Filtered entities
     */
    applyEntityFilters(entities, filters) {
        return entities.filter(entity => {
            for (const [key, value] of Object.entries(filters)) {
                if (entity[key] !== value) {
                    return false
                }
            }
            return true
        })
    }

    /**
     * Generate node assignments for entities
     */
    generateNodeAssignments() {
        this.nodeAssignments = this.embeddings.map(embedding => {
            const bmuIndex = this.core.findSingleBMU(embedding)
            const distance = this.core.calculateDistance(embedding, this.core.getNodeWeights(bmuIndex))

            return {
                nodeIndex: bmuIndex,
                distance: distance
            }
        })
    }

    /**
     * Generate clusters from trained map
     * @param {number} threshold - Clustering threshold
     * @returns {Array} Array of clusters
     */
    generateClusters(threshold) {
        // Simple clustering based on weight similarity
        const clusters = []
        const visited = new Set()

        for (let i = 0; i < this.core.totalNodes; i++) {
            if (visited.has(i)) continue

            const cluster = this.expandCluster(i, threshold, visited)
            if (cluster.members.length >= this.options.minClusterSize) {
                clusters.push(cluster)
            }
        }

        return clusters
    }

    /**
     * Expand cluster using neighboring nodes
     * @param {number} seedIndex - Starting node index
     * @param {number} threshold - Similarity threshold
     * @param {Set} visited - Set of visited nodes
     * @returns {Object} Cluster object
     */
    expandCluster(seedIndex, threshold, visited) {
        const cluster = {
            id: seedIndex,
            members: [seedIndex],
            centroid: [...this.core.getNodeWeights(seedIndex)]
        }

        visited.add(seedIndex)
        const queue = [seedIndex]

        while (queue.length > 0) {
            const currentIndex = queue.shift()
            const currentCoords = this.topology.indexToCoordinates(currentIndex)

            // Check neighboring nodes
            const neighbors = this.topology.getNeighbors(currentCoords, 1.5)

            for (const neighbor of neighbors) {
                const neighborIndex = this.topology.coordinatesToIndex(...neighbor.coords)

                if (!visited.has(neighborIndex)) {
                    const similarity = this.calculateNodeSimilarity(currentIndex, neighborIndex)

                    if (similarity > threshold) {
                        cluster.members.push(neighborIndex)
                        visited.add(neighborIndex)
                        queue.push(neighborIndex)
                    }
                }
            }
        }

        // Recalculate centroid
        if (cluster.members.length > 1) {
            cluster.centroid = this.calculateClusterCentroid(cluster.members)
        }

        return cluster
    }

    /**
     * Calculate similarity between two nodes
     * @param {number} index1 - First node index
     * @param {number} index2 - Second node index
     * @returns {number} Similarity score
     */
    calculateNodeSimilarity(index1, index2) {
        const weights1 = this.core.getNodeWeights(index1)
        const weights2 = this.core.getNodeWeights(index2)
        const distance = this.core.calculateDistance(weights1, weights2)

        // Convert distance to similarity (0-1 scale)
        return Math.max(0, 1 - distance)
    }

    /**
     * Calculate cluster centroid
     * @param {Array} memberIndices - Array of member node indices
     * @returns {Array} Centroid vector
     */
    calculateClusterCentroid(memberIndices) {
        const centroid = new Array(this.options.embeddingDimension).fill(0)

        for (const index of memberIndices) {
            const weights = this.core.getNodeWeights(index)
            for (let i = 0; i < weights.length; i++) {
                centroid[i] += weights[i]
            }
        }

        for (let i = 0; i < centroid.length; i++) {
            centroid[i] /= memberIndices.length
        }

        return centroid
    }

    /**
     * Find which cluster an entity belongs to
     * @param {number} entityIndex - Entity index
     * @param {Array} clusters - Array of clusters
     * @returns {number} Cluster index or -1 if not found
     */
    findEntityCluster(entityIndex, clusters) {
        if (!this.nodeAssignments || !this.nodeAssignments[entityIndex]) {
            return -1
        }

        const nodeIndex = this.nodeAssignments[entityIndex].nodeIndex

        for (let i = 0; i < clusters.length; i++) {
            if (clusters[i].members.includes(nodeIndex)) {
                return i
            }
        }

        return -1
    }

    /**
     * Cluster hypothetical entities separately
     * @param {Array} hypotheticalEntities - Array of hypothetical entities
     * @returns {Promise<Array>} Hypothetical clusters
     */
    async clusterHypotheticalEntities(hypotheticalEntities) {
        // Placeholder implementation
        logger.info(`Clustering ${hypotheticalEntities.length} hypothetical entities`)
        return []
    }

    /**
     * Analyze confidence distribution
     * @param {Array} entities - Array of entities with confidence scores
     * @returns {Object} Confidence analysis
     */
    analyzeConfidenceDistribution(entities) {
        const confidences = entities
            .map(entity => entity.metadata?.confidence || 0)
            .filter(conf => conf > 0)

        if (confidences.length === 0) {
            return { mean: 0, std: 0, min: 0, max: 0 }
        }

        const mean = confidences.reduce((sum, conf) => sum + conf, 0) / confidences.length
        const variance = confidences.reduce((sum, conf) => sum + Math.pow(conf - mean, 2), 0) / confidences.length

        return {
            mean: mean,
            std: Math.sqrt(variance),
            min: Math.min(...confidences),
            max: Math.max(...confidences),
            count: confidences.length
        }
    }

    /**
     * Enhance clusters with centrality measures
     * @param {Object} graphResults - Graph analytics results
     * @returns {Array} Enhanced clusters
     */
    enhanceClustersWithCentrality(graphResults) {
        // Placeholder implementation
        logger.info('Enhancing clusters with centrality measures')
        return this.clusters || []
    }

    /**
     * Convert data to CSV format
     * @param {Array} data - Data to convert
     * @returns {string} CSV string
     */
    convertToCSV(data) {
        if (data.length === 0) return ''

        const headers = Object.keys(data[0])
        const csvHeaders = headers.join(',')
        const csvRows = data.map(row =>
            headers.map(header => {
                const value = row[header]
                return typeof value === 'object' ? JSON.stringify(value) : value
            }).join(',')
        )

        return [csvHeaders, ...csvRows].join('\n')
    }

    /**
     * Get algorithm statistics
     * @returns {Object} VSOM statistics
     */
    getStatistics() {
        return {
            ...this.stats,
            trained: this.trained,
            mapSize: this.options.mapSize,
            totalNodes: this.topology.totalNodes,
            embeddingDimension: this.options.embeddingDimension,
            core: this.core.getStatistics(),
            topology: this.topology.getTopologyInfo(),
            training: this.training.getStatistics(),
            memoryUsage: this.estimateMemoryUsage()
        }
    }

    /**
     * Estimate total memory usage
     * @returns {number} Estimated memory usage in bytes
     */
    estimateMemoryUsage() {
        const coreMemory = this.core.estimateMemoryUsage()
        const topologyMemory = this.topology.estimateMemoryUsage()
        const trainingMemory = this.training.estimateMemoryUsage()
        const dataMemory = this.embeddings.length * this.options.embeddingDimension * 8 // Float64

        return coreMemory + topologyMemory + trainingMemory + dataMemory
    }

    /**
     * Reset VSOM state
     */
    reset() {
        this.entities = []
        this.embeddings = []
        this.entityMetadata = []
        this.trained = false
        this.clusters = null
        this.nodeAssignments = null
        this.trainingResults = null

        this.training.reset()

        this.stats = {
            totalEntities: 0,
            totalClusters: 0,
            trainingTime: 0,
            lastTrainingDate: null,
            dataLoadTime: 0,
            lastDataLoadDate: null
        }

        logger.debug('VSOM state reset')
    }
}