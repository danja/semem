/**
 * VSOMTraining.js - Training Procedures and Convergence Detection
 * 
 * This module manages the training process for VSOM including learning rate 
 * schedules, convergence detection, and training quality metrics. It provides
 * different training strategies and monitoring capabilities.
 * 
 * Key Features:
 * - Multiple learning rate schedules
 * - Convergence detection algorithms
 * - Training quality metrics
 * - Batch and online training modes
 * - Training progress monitoring
 */

import { logger } from '../../../Utils.js'

export default class VSOMTraining {
    constructor(options = {}) {
        this.options = {
            // Learning rate schedule
            initialLearningRate: options.initialLearningRate || 0.1,
            finalLearningRate: options.finalLearningRate || 0.01,
            learningRateSchedule: options.learningRateSchedule || 'exponential', // 'linear', 'exponential', 'inverse', 'step'
            
            // Neighborhood radius schedule
            initialRadius: options.initialRadius || 5.0,
            finalRadius: options.finalRadius || 0.5,
            radiusSchedule: options.radiusSchedule || 'exponential',
            
            // Training parameters
            maxIterations: options.maxIterations || 1000,
            batchSize: options.batchSize || 100,
            
            // Convergence detection
            convergenceThreshold: options.convergenceThreshold || 1e-4,
            convergenceWindow: options.convergenceWindow || 10,
            minIterations: options.minIterations || 100,
            
            // Quality metrics
            trackQuantizationError: options.trackQuantizationError !== false,
            trackTopographicError: options.trackTopographicError !== false,
            qualityCheckInterval: options.qualityCheckInterval || 50,
            
            // Monitoring
            logProgress: options.logProgress !== false,
            progressInterval: options.progressInterval || 100,
            
            ...options
        }
        
        // Training state
        this.currentIteration = 0
        this.isTraining = false
        this.trainingStartTime = null
        this.trainingHistory = []
        
        // Convergence tracking
        this.errorHistory = []
        this.converged = false
        this.convergenceIteration = null
        
        // Quality metrics
        this.qualityMetrics = {
            quantizationError: [],
            topographicError: [],
            neighborhoodPreservation: []
        }
        
        logger.debug('VSOMTraining initialized with options:', this.options)
    }
    
    /**
     * Execute complete training process
     * @param {Object} vsomCore - VSOM core algorithm instance
     * @param {Object} topology - VSOM topology instance
     * @param {Array} trainingData - Array of training vectors
     * @param {Object} callbacks - Optional training callbacks
     * @returns {Object} Training results
     */
    async train(vsomCore, topology, trainingData, callbacks = {}) {
        logger.info(`Starting VSOM training: ${trainingData.length} samples, ${this.options.maxIterations} iterations`)
        
        this.isTraining = true
        this.trainingStartTime = Date.now()
        this.currentIteration = 0
        this.converged = false
        this.convergenceIteration = null
        
        // Initialize training history
        this.trainingHistory = []
        this.errorHistory = []
        this.qualityMetrics = {
            quantizationError: [],
            topographicError: [],
            neighborhoodPreservation: []
        }
        
        // Create neighborhood function
        const neighborhoodFunction = topology.createNeighborhoodFunction('gaussian')
        
        try {
            // Training loop
            for (let iteration = 0; iteration < this.options.maxIterations; iteration++) {
                this.currentIteration = iteration
                
                // Calculate current learning parameters
                const learningRate = this.calculateLearningRate(iteration)
                const neighborhoodRadius = this.calculateNeighborhoodRadius(iteration)
                
                // Perform training step
                const iterationResults = await this.trainingStep(
                    vsomCore, 
                    topology, 
                    trainingData, 
                    learningRate, 
                    neighborhoodRadius, 
                    neighborhoodFunction
                )
                
                // Record training progress
                this.recordIteration(iteration, learningRate, neighborhoodRadius, iterationResults)
                
                // Check convergence
                if (iteration >= this.options.minIterations) {
                    if (this.checkConvergence()) {
                        this.converged = true
                        this.convergenceIteration = iteration
                        logger.info(`Training converged at iteration ${iteration}`)
                        break
                    }
                }
                
                // Quality metrics
                if (iteration % this.options.qualityCheckInterval === 0) {
                    await this.calculateQualityMetrics(vsomCore, trainingData, iteration)
                }
                
                // Progress logging
                if (this.options.logProgress && iteration % this.options.progressInterval === 0) {
                    this.logTrainingProgress(iteration, learningRate, neighborhoodRadius, iterationResults)
                }
                
                // Execute callbacks
                if (callbacks.onIteration) {
                    await callbacks.onIteration(iteration, iterationResults)
                }
                
                // Early stopping check
                if (callbacks.shouldStop && callbacks.shouldStop(iteration, iterationResults)) {
                    logger.info(`Training stopped early at iteration ${iteration} by callback`)
                    break
                }
            }
            
            // Final quality assessment
            await this.calculateQualityMetrics(vsomCore, trainingData, this.currentIteration)
            
            const trainingTime = Date.now() - this.trainingStartTime
            const results = this.compileTrainingResults(trainingTime)
            
            logger.info(`Training completed in ${trainingTime}ms after ${this.currentIteration + 1} iterations`)
            
            if (callbacks.onComplete) {
                await callbacks.onComplete(results)
            }
            
            return results
            
        } catch (error) {
            logger.error('Training failed:', error)
            throw error
        } finally {
            this.isTraining = false
        }
    }
    
    /**
     * Perform single training step
     * @param {Object} vsomCore - VSOM core algorithm instance
     * @param {Object} topology - VSOM topology instance
     * @param {Array} trainingData - Training data
     * @param {number} learningRate - Current learning rate
     * @param {number} neighborhoodRadius - Current neighborhood radius
     * @param {Function} neighborhoodFunction - Neighborhood function
     * @returns {Object} Iteration results
     */
    async trainingStep(vsomCore, topology, trainingData, learningRate, neighborhoodRadius, neighborhoodFunction) {
        const stepStartTime = Date.now()
        
        // Shuffle training data for this epoch
        const shuffledData = this.shuffleArray([...trainingData])
        
        let totalQuantizationError = 0
        let batchCount = 0
        
        // Process data in batches
        for (let i = 0; i < shuffledData.length; i += this.options.batchSize) {
            const batch = shuffledData.slice(i, i + this.options.batchSize)
            
            // Find BMUs for batch
            const bmuIndices = vsomCore.findBestMatchingUnits(batch)
            
            // Update weights
            vsomCore.updateWeights(batch, bmuIndices, learningRate, neighborhoodRadius, neighborhoodFunction)
            
            // Calculate batch quantization error
            for (let j = 0; j < batch.length; j++) {
                const distance = vsomCore.calculateDistance(batch[j], vsomCore.getNodeWeights(bmuIndices[j]))
                totalQuantizationError += distance
            }
            
            batchCount++
        }
        
        const averageQuantizationError = totalQuantizationError / shuffledData.length
        const stepTime = Date.now() - stepStartTime
        
        return {
            quantizationError: averageQuantizationError,
            processingTime: stepTime,
            batchCount: batchCount,
            samplesProcessed: shuffledData.length
        }
    }
    
    /**
     * Calculate learning rate for current iteration
     * @param {number} iteration - Current iteration
     * @returns {number} Learning rate
     */
    calculateLearningRate(iteration) {
        const progress = iteration / this.options.maxIterations
        const initial = this.options.initialLearningRate
        const final = this.options.finalLearningRate
        
        switch (this.options.learningRateSchedule) {
            case 'linear':
                return initial * (1 - progress) + final * progress
                
            case 'exponential':
                const decayFactor = Math.log(final / initial)
                return initial * Math.exp(decayFactor * progress)
                
            case 'inverse':
                return initial / (1 + iteration * 0.01)
                
            case 'step':
                const stepSize = this.options.maxIterations / 4
                const step = Math.floor(iteration / stepSize)
                return initial * Math.pow(0.5, step)
                
            default:
                return initial * Math.exp(-iteration / (this.options.maxIterations / 3))
        }
    }
    
    /**
     * Calculate neighborhood radius for current iteration
     * @param {number} iteration - Current iteration
     * @returns {number} Neighborhood radius
     */
    calculateNeighborhoodRadius(iteration) {
        const progress = iteration / this.options.maxIterations
        const initial = this.options.initialRadius
        const final = this.options.finalRadius
        
        switch (this.options.radiusSchedule) {
            case 'linear':
                return initial * (1 - progress) + final * progress
                
            case 'exponential':
                const decayFactor = Math.log(final / initial)
                return initial * Math.exp(decayFactor * progress)
                
            case 'inverse':
                return initial / (1 + iteration * 0.02)
                
            default:
                return initial * Math.exp(-iteration / (this.options.maxIterations / 2))
        }
    }
    
    /**
     * Check if training has converged
     * @returns {boolean} True if converged
     */
    checkConvergence() {
        if (this.errorHistory.length < this.options.convergenceWindow) {
            return false
        }
        
        // Get recent errors
        const recentErrors = this.errorHistory.slice(-this.options.convergenceWindow)
        
        // Calculate error variance over convergence window
        const mean = recentErrors.reduce((sum, error) => sum + error, 0) / recentErrors.length
        const variance = recentErrors.reduce((sum, error) => sum + Math.pow(error - mean, 2), 0) / recentErrors.length
        const standardDeviation = Math.sqrt(variance)
        
        // Check if standard deviation is below threshold
        return standardDeviation < this.options.convergenceThreshold
    }
    
    /**
     * Calculate training quality metrics
     * @param {Object} vsomCore - VSOM core algorithm instance
     * @param {Array} trainingData - Training data
     * @param {number} iteration - Current iteration
     */
    async calculateQualityMetrics(vsomCore, trainingData, iteration) {
        if (this.options.trackQuantizationError) {
            const qError = vsomCore.calculateQuantizationError(trainingData)
            this.qualityMetrics.quantizationError.push({
                iteration: iteration,
                value: qError
            })
        }
        
        if (this.options.trackTopographicError) {
            const tError = vsomCore.calculateTopographicError(trainingData)
            this.qualityMetrics.topographicError.push({
                iteration: iteration,
                value: tError
            })
        }
    }
    
    /**
     * Record iteration results
     * @param {number} iteration - Current iteration
     * @param {number} learningRate - Learning rate used
     * @param {number} neighborhoodRadius - Neighborhood radius used
     * @param {Object} results - Iteration results
     */
    recordIteration(iteration, learningRate, neighborhoodRadius, results) {
        this.trainingHistory.push({
            iteration: iteration,
            learningRate: learningRate,
            neighborhoodRadius: neighborhoodRadius,
            quantizationError: results.quantizationError,
            processingTime: results.processingTime,
            timestamp: Date.now()
        })
        
        this.errorHistory.push(results.quantizationError)
        
        // Limit history size to prevent memory issues
        const maxHistorySize = this.options.maxIterations + 100
        if (this.trainingHistory.length > maxHistorySize) {
            this.trainingHistory = this.trainingHistory.slice(-maxHistorySize)
        }
        if (this.errorHistory.length > maxHistorySize) {
            this.errorHistory = this.errorHistory.slice(-maxHistorySize)
        }
    }
    
    /**
     * Log training progress
     * @param {number} iteration - Current iteration
     * @param {number} learningRate - Learning rate
     * @param {number} neighborhoodRadius - Neighborhood radius
     * @param {Object} results - Iteration results
     */
    logTrainingProgress(iteration, learningRate, neighborhoodRadius, results) {
        const progress = ((iteration + 1) / this.options.maxIterations * 100).toFixed(1)
        const elapsed = Date.now() - this.trainingStartTime
        const eta = elapsed / (iteration + 1) * (this.options.maxIterations - iteration - 1)
        
        logger.info(`Training ${progress}%: iteration ${iteration + 1}/${this.options.maxIterations}, ` +
                   `QE: ${results.quantizationError.toFixed(6)}, ` +
                   `LR: ${learningRate.toFixed(4)}, ` +
                   `R: ${neighborhoodRadius.toFixed(2)}, ` +
                   `ETA: ${Math.round(eta / 1000)}s`)
    }
    
    /**
     * Compile final training results
     * @param {number} trainingTime - Total training time
     * @returns {Object} Complete training results
     */
    compileTrainingResults(trainingTime) {
        return {
            // Training summary
            totalIterations: this.currentIteration + 1,
            trainingTime: trainingTime,
            converged: this.converged,
            convergenceIteration: this.convergenceIteration,
            
            // Final state
            finalQuantizationError: this.errorHistory[this.errorHistory.length - 1] || null,
            finalLearningRate: this.calculateLearningRate(this.currentIteration),
            finalNeighborhoodRadius: this.calculateNeighborhoodRadius(this.currentIteration),
            
            // Training history
            trainingHistory: this.trainingHistory,
            errorHistory: this.errorHistory,
            qualityMetrics: this.qualityMetrics,
            
            // Performance metrics
            averageIterationTime: trainingTime / (this.currentIteration + 1),
            iterationsPerSecond: (this.currentIteration + 1) / (trainingTime / 1000),
            
            // Configuration used
            trainingOptions: this.options
        }
    }
    
    /**
     * Shuffle array in place using Fisher-Yates algorithm
     * @param {Array} array - Array to shuffle
     * @returns {Array} Shuffled array
     */
    shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1))
            ;[array[i], array[j]] = [array[j], array[i]]
        }
        return array
    }
    
    /**
     * Stop training if currently running
     */
    stopTraining() {
        if (this.isTraining) {
            logger.info(`Training stopped at iteration ${this.currentIteration}`)
            this.isTraining = false
        }
    }
    
    /**
     * Get current training status
     * @returns {Object} Training status information
     */
    getTrainingStatus() {
        return {
            isTraining: this.isTraining,
            currentIteration: this.currentIteration,
            maxIterations: this.options.maxIterations,
            progress: this.currentIteration / this.options.maxIterations,
            converged: this.converged,
            convergenceIteration: this.convergenceIteration,
            elapsedTime: this.trainingStartTime ? Date.now() - this.trainingStartTime : 0
        }
    }
    
    /**
     * Get training statistics
     * @returns {Object} Training statistics
     */
    getStatistics() {
        return {
            trainingHistorySize: this.trainingHistory.length,
            errorHistorySize: this.errorHistory.length,
            qualityMetricsCount: Object.values(this.qualityMetrics).reduce((sum, arr) => sum + arr.length, 0),
            memoryUsage: this.estimateMemoryUsage()
        }
    }
    
    /**
     * Estimate memory usage
     * @returns {number} Estimated memory usage in bytes
     */
    estimateMemoryUsage() {
        const historySize = this.trainingHistory.length * 200 // Rough estimate per entry
        const errorHistorySize = this.errorHistory.length * 8 // Float64
        const qualityMetricsSize = Object.values(this.qualityMetrics).reduce((sum, arr) => sum + arr.length * 16, 0)
        
        return historySize + errorHistorySize + qualityMetricsSize
    }
    
    /**
     * Reset training state
     */
    reset() {
        this.currentIteration = 0
        this.isTraining = false
        this.trainingStartTime = null
        this.trainingHistory = []
        this.errorHistory = []
        this.converged = false
        this.convergenceIteration = null
        this.qualityMetrics = {
            quantizationError: [],
            topographicError: [],
            neighborhoodPreservation: []
        }
        
        logger.debug('VSOMTraining state reset')
    }
}