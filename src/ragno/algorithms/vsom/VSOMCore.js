/**
 * VSOMCore.js - Core Vectorized Self-Organizing Map Engine
 * 
 * This module implements the core VSOM algorithm with vectorized operations
 * for efficient batch processing and training. It provides the fundamental
 * mathematical operations needed for SOM training and inference.
 * 
 * Key Features:
 * - Vectorized distance calculations
 * - Batch Best Matching Unit (BMU) finding
 * - Efficient neighborhood weight computation
 * - Memory-efficient matrix operations
 * - Support for different distance metrics
 */

import { logger } from '../../../Utils.js'

export default class VSOMCore {
    constructor(options = {}) {
        this.options = {
            distanceMetric: options.distanceMetric || 'cosine',
            batchSize: options.batchSize || 100,
            numericPrecision: options.numericPrecision || 1e-10,
            ...options
        }
        
        // Core matrices - will be initialized when map is created
        this.weights = null          // [mapNodes x inputDimension] - SOM weight vectors
        this.mapSize = null          // [width, height] - Map dimensions
        this.inputDimension = null   // Dimension of input vectors
        this.totalNodes = 0          // Total number of map nodes
        
        // Distance computation cache
        this.distanceCache = new Map()
        this.cacheHits = 0
        this.cacheMisses = 0
        
        // Performance statistics
        this.stats = {
            totalComputations: 0,
            averageComputationTime: 0,
            lastBMUTime: 0,
            lastUpdateTime: 0,
            memoryUsage: 0
        }
        
        logger.debug('VSOMCore initialized with options:', this.options)
    }
    
    /**
     * Initialize the SOM weight matrix with random values
     * @param {Array} mapSize - [width, height] dimensions
     * @param {number} inputDimension - Dimension of input vectors
     * @param {string} initMethod - Initialization method ('random', 'linear', 'pca')
     */
    initializeWeights(mapSize, inputDimension, initMethod = 'random') {
        this.mapSize = mapSize
        this.inputDimension = inputDimension
        this.totalNodes = mapSize[0] * mapSize[1]
        
        // Initialize weight matrix [totalNodes x inputDimension]
        this.weights = new Array(this.totalNodes)
        
        switch (initMethod) {
            case 'random':
                this.initializeRandomWeights()
                break
            case 'linear':
                this.initializeLinearWeights()
                break
            case 'pca':
                this.initializePCAWeights()
                break
            default:
                this.initializeRandomWeights()
        }
        
        logger.debug(`Initialized VSOM weights: ${this.totalNodes} nodes, ${inputDimension}D input`)
    }
    
    /**
     * Initialize weights with random values (Gaussian distribution)
     */
    initializeRandomWeights() {
        for (let i = 0; i < this.totalNodes; i++) {
            this.weights[i] = new Array(this.inputDimension)
            for (let j = 0; j < this.inputDimension; j++) {
                // Initialize with small random values (Gaussian distribution)
                this.weights[i][j] = this.gaussianRandom() * 0.1
            }
        }
    }
    
    /**
     * Initialize weights with linear interpolation across map
     */
    initializeLinearWeights() {
        for (let i = 0; i < this.totalNodes; i++) {
            const [x, y] = this.indexToCoordinates(i)
            this.weights[i] = new Array(this.inputDimension)
            
            for (let j = 0; j < this.inputDimension; j++) {
                // Linear interpolation based on position
                const xFactor = x / (this.mapSize[0] - 1)
                const yFactor = y / (this.mapSize[1] - 1)
                this.weights[i][j] = (xFactor + yFactor) / 2 * 0.1 - 0.05
            }
        }
    }
    
    /**
     * Initialize weights using PCA (placeholder - would need input data)
     */
    initializePCAWeights() {
        // For now, fall back to random initialization
        // In a full implementation, this would use the first two principal components
        this.initializeRandomWeights()
        logger.warn('PCA initialization not implemented, using random initialization')
    }
    
    /**
     * Find Best Matching Units (BMUs) for a batch of input vectors
     * @param {Array} inputBatch - Array of input vectors
     * @returns {Array} Array of BMU indices for each input
     */
    findBestMatchingUnits(inputBatch) {
        const startTime = Date.now()
        const bmus = new Array(inputBatch.length)
        
        for (let i = 0; i < inputBatch.length; i++) {
            bmus[i] = this.findSingleBMU(inputBatch[i])
        }
        
        this.stats.lastBMUTime = Date.now() - startTime
        this.stats.totalComputations += inputBatch.length
        
        return bmus
    }
    
    /**
     * Find Best Matching Unit for a single input vector
     * @param {Array} inputVector - Input vector
     * @returns {number} Index of the best matching unit
     */
    findSingleBMU(inputVector) {
        let bestDistance = Infinity
        let bestIndex = 0
        
        for (let i = 0; i < this.totalNodes; i++) {
            const distance = this.calculateDistance(inputVector, this.weights[i])
            if (distance < bestDistance) {
                bestDistance = distance
                bestIndex = i
            }
        }
        
        return bestIndex
    }
    
    /**
     * Calculate distance between two vectors
     * @param {Array} vector1 - First vector
     * @param {Array} vector2 - Second vector
     * @returns {number} Distance value
     */
    calculateDistance(vector1, vector2) {
        switch (this.options.distanceMetric) {
            case 'cosine':
                return this.cosineDistance(vector1, vector2)
            case 'euclidean':
                return this.euclideanDistance(vector1, vector2)
            case 'manhattan':
                return this.manhattanDistance(vector1, vector2)
            default:
                return this.euclideanDistance(vector1, vector2)
        }
    }
    
    /**
     * Calculate cosine distance (1 - cosine similarity)
     * @param {Array} vector1 - First vector
     * @param {Array} vector2 - Second vector
     * @returns {number} Cosine distance
     */
    cosineDistance(vector1, vector2) {
        let dotProduct = 0
        let norm1 = 0
        let norm2 = 0
        
        for (let i = 0; i < vector1.length; i++) {
            dotProduct += vector1[i] * vector2[i]
            norm1 += vector1[i] * vector1[i]
            norm2 += vector2[i] * vector2[i]
        }
        
        norm1 = Math.sqrt(norm1)
        norm2 = Math.sqrt(norm2)
        
        if (norm1 < this.options.numericPrecision || norm2 < this.options.numericPrecision) {
            return 1.0 // Maximum distance for zero vectors
        }
        
        const cosineSimilarity = dotProduct / (norm1 * norm2)
        return 1.0 - Math.max(-1.0, Math.min(1.0, cosineSimilarity)) // Clamp to [-1, 1]
    }
    
    /**
     * Calculate Euclidean distance
     * @param {Array} vector1 - First vector
     * @param {Array} vector2 - Second vector
     * @returns {number} Euclidean distance
     */
    euclideanDistance(vector1, vector2) {
        let sum = 0
        for (let i = 0; i < vector1.length; i++) {
            const diff = vector1[i] - vector2[i]
            sum += diff * diff
        }
        return Math.sqrt(sum)
    }
    
    /**
     * Calculate Manhattan distance
     * @param {Array} vector1 - First vector
     * @param {Array} vector2 - Second vector
     * @returns {number} Manhattan distance
     */
    manhattanDistance(vector1, vector2) {
        let sum = 0
        for (let i = 0; i < vector1.length; i++) {
            sum += Math.abs(vector1[i] - vector2[i])
        }
        return sum
    }
    
    /**
     * Update weights for a batch of training samples
     * @param {Array} inputBatch - Batch of input vectors
     * @param {Array} bmuIndices - BMU indices for each input
     * @param {number} learningRate - Current learning rate
     * @param {number} neighborhoodRadius - Current neighborhood radius
     * @param {Function} neighborhoodFunction - Neighborhood weight function
     */
    updateWeights(inputBatch, bmuIndices, learningRate, neighborhoodRadius, neighborhoodFunction) {
        const startTime = Date.now()
        
        // Create weight updates accumulator
        const weightUpdates = new Array(this.totalNodes)
        const updateCounts = new Array(this.totalNodes)
        
        for (let i = 0; i < this.totalNodes; i++) {
            weightUpdates[i] = new Array(this.inputDimension).fill(0)
            updateCounts[i] = 0
        }
        
        // Accumulate updates for each training sample
        for (let sampleIdx = 0; sampleIdx < inputBatch.length; sampleIdx++) {
            const inputVector = inputBatch[sampleIdx]
            const bmuIndex = bmuIndices[sampleIdx]
            const bmuCoords = this.indexToCoordinates(bmuIndex)
            
            // Update all nodes based on neighborhood function
            for (let nodeIdx = 0; nodeIdx < this.totalNodes; nodeIdx++) {
                const nodeCoords = this.indexToCoordinates(nodeIdx)
                const distance = this.calculateMapDistance(bmuCoords, nodeCoords)
                const neighborhoodWeight = neighborhoodFunction(distance, neighborhoodRadius)
                
                if (neighborhoodWeight > this.options.numericPrecision) {
                    const updateFactor = learningRate * neighborhoodWeight
                    
                    for (let dim = 0; dim < this.inputDimension; dim++) {
                        const weightDelta = updateFactor * (inputVector[dim] - this.weights[nodeIdx][dim])
                        weightUpdates[nodeIdx][dim] += weightDelta
                    }
                    updateCounts[nodeIdx] += 1
                }
            }
        }
        
        // Apply accumulated updates
        for (let nodeIdx = 0; nodeIdx < this.totalNodes; nodeIdx++) {
            if (updateCounts[nodeIdx] > 0) {
                for (let dim = 0; dim < this.inputDimension; dim++) {
                    this.weights[nodeIdx][dim] += weightUpdates[nodeIdx][dim] / updateCounts[nodeIdx]
                }
            }
        }
        
        this.stats.lastUpdateTime = Date.now() - startTime
    }
    
    /**
     * Convert linear index to 2D map coordinates
     * @param {number} index - Linear index
     * @returns {Array} [x, y] coordinates
     */
    indexToCoordinates(index) {
        const x = index % this.mapSize[0]
        const y = Math.floor(index / this.mapSize[0])
        return [x, y]
    }
    
    /**
     * Convert 2D map coordinates to linear index
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @returns {number} Linear index
     */
    coordinatesToIndex(x, y) {
        return y * this.mapSize[0] + x
    }
    
    /**
     * Calculate distance between two points on the map
     * @param {Array} coords1 - [x, y] coordinates of first point
     * @param {Array} coords2 - [x, y] coordinates of second point
     * @returns {number} Distance on the map
     */
    calculateMapDistance(coords1, coords2) {
        const dx = coords1[0] - coords2[0]
        const dy = coords1[1] - coords2[1]
        return Math.sqrt(dx * dx + dy * dy)
    }
    
    /**
     * Generate Gaussian random number (Box-Muller transform)
     * @returns {number} Random number from standard normal distribution
     */
    gaussianRandom() {
        if (this.spare !== undefined) {
            const value = this.spare
            delete this.spare
            return value
        }
        
        const u = Math.random()
        const v = Math.random()
        const mag = Math.sqrt(-2.0 * Math.log(u))
        this.spare = mag * Math.cos(2.0 * Math.PI * v)
        return mag * Math.sin(2.0 * Math.PI * v)
    }
    
    /**
     * Calculate quantization error for the current map
     * @param {Array} inputData - Array of input vectors
     * @returns {number} Average quantization error
     */
    calculateQuantizationError(inputData) {
        let totalError = 0
        
        for (const inputVector of inputData) {
            const bmuIndex = this.findSingleBMU(inputVector)
            const error = this.calculateDistance(inputVector, this.weights[bmuIndex])
            totalError += error
        }
        
        return totalError / inputData.length
    }
    
    /**
     * Calculate topographic error for the current map
     * @param {Array} inputData - Array of input vectors
     * @returns {number} Topographic error (0-1)
     */
    calculateTopographicError(inputData) {
        let topographicErrors = 0
        
        for (const inputVector of inputData) {
            const bmuIndex = this.findSingleBMU(inputVector)
            const bmuCoords = this.indexToCoordinates(bmuIndex)
            
            // Find second best matching unit
            let secondBestDistance = Infinity
            let secondBestIndex = -1
            
            for (let i = 0; i < this.totalNodes; i++) {
                if (i !== bmuIndex) {
                    const distance = this.calculateDistance(inputVector, this.weights[i])
                    if (distance < secondBestDistance) {
                        secondBestDistance = distance
                        secondBestIndex = i
                    }
                }
            }
            
            if (secondBestIndex !== -1) {
                const secondBmuCoords = this.indexToCoordinates(secondBestIndex)
                const mapDistance = this.calculateMapDistance(bmuCoords, secondBmuCoords)
                
                // If BMU and second BMU are not adjacent, it's a topographic error
                if (mapDistance > Math.sqrt(2) + this.options.numericPrecision) {
                    topographicErrors++
                }
            }
        }
        
        return topographicErrors / inputData.length
    }
    
    /**
     * Get weight vector for a specific map node
     * @param {number} nodeIndex - Index of the map node
     * @returns {Array} Weight vector
     */
    getNodeWeights(nodeIndex) {
        if (nodeIndex < 0 || nodeIndex >= this.totalNodes) {
            throw new Error(`Invalid node index: ${nodeIndex}`)
        }
        return [...this.weights[nodeIndex]] // Return copy
    }
    
    /**
     * Set weight vector for a specific map node
     * @param {number} nodeIndex - Index of the map node
     * @param {Array} weights - New weight vector
     */
    setNodeWeights(nodeIndex, weights) {
        if (nodeIndex < 0 || nodeIndex >= this.totalNodes) {
            throw new Error(`Invalid node index: ${nodeIndex}`)
        }
        if (weights.length !== this.inputDimension) {
            throw new Error(`Weight vector dimension mismatch: ${weights.length} vs ${this.inputDimension}`)
        }
        this.weights[nodeIndex] = [...weights] // Store copy
    }
    
    /**
     * Get current algorithm statistics
     * @returns {Object} Performance and usage statistics
     */
    getStatistics() {
        return {
            ...this.stats,
            cacheHits: this.cacheHits,
            cacheMisses: this.cacheMisses,
            cacheHitRatio: this.cacheHits / (this.cacheHits + this.cacheMisses) || 0,
            memoryUsage: this.estimateMemoryUsage()
        }
    }
    
    /**
     * Estimate memory usage of the algorithm
     * @returns {number} Estimated memory usage in bytes
     */
    estimateMemoryUsage() {
        if (!this.weights) return 0
        
        // Weight matrix: totalNodes * inputDimension * 8 bytes (float64)
        const weightsMemory = this.totalNodes * this.inputDimension * 8
        
        // Additional overhead for arrays and objects
        const overhead = this.totalNodes * 100 // Rough estimate
        
        return weightsMemory + overhead
    }
    
    /**
     * Reset algorithm statistics
     */
    resetStatistics() {
        this.stats = {
            totalComputations: 0,
            averageComputationTime: 0,
            lastBMUTime: 0,
            lastUpdateTime: 0,
            memoryUsage: 0
        }
        this.cacheHits = 0
        this.cacheMisses = 0
        this.distanceCache.clear()
        
        logger.debug('VSOM core statistics reset')
    }
}