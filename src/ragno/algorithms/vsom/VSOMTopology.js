/**
 * VSOMTopology.js - Map Topology Management for VSOM
 * 
 * This module manages different map topologies for the VSOM algorithm including
 * rectangular and hexagonal grids. It provides neighborhood calculations,
 * coordinate transformations, and boundary condition handling.
 * 
 * Key Features:
 * - Rectangular and hexagonal topologies
 * - Neighborhood distance calculations
 * - Boundary condition handling (toroidal, bounded)
 * - Coordinate transformation utilities
 * - Visualization coordinate generation
 */

import { logger } from '../../../Utils.js'

export default class VSOMTopology {
    constructor(options = {}) {
        this.options = {
            topology: options.topology || 'rectangular', // 'rectangular', 'hexagonal'
            boundaryCondition: options.boundaryCondition || 'bounded', // 'bounded', 'toroidal'
            mapSize: options.mapSize || [10, 10],
            ...options
        }
        
        this.width = this.options.mapSize[0]
        this.height = this.options.mapSize[1]
        this.totalNodes = this.width * this.height
        
        // Precompute neighborhood lookup tables for efficiency
        this.neighborhoodCache = new Map()
        this.distanceCache = new Map()
        
        // Topology-specific parameters
        this.hexOffsetEven = this.options.topology === 'hexagonal'
        
        logger.debug(`VSOMTopology initialized: ${this.options.topology} ${this.width}x${this.height}`)
    }
    
    /**
     * Calculate distance between two nodes on the map
     * @param {Array} coords1 - [x, y] coordinates of first node
     * @param {Array} coords2 - [x, y] coordinates of second node
     * @returns {number} Distance between nodes
     */
    calculateDistance(coords1, coords2) {
        const cacheKey = `${coords1[0]},${coords1[1]}-${coords2[0]},${coords2[1]}`
        
        if (this.distanceCache.has(cacheKey)) {
            return this.distanceCache.get(cacheKey)
        }
        
        let distance
        switch (this.options.topology) {
            case 'hexagonal':
                distance = this.calculateHexagonalDistance(coords1, coords2)
                break
            case 'rectangular':
            default:
                distance = this.calculateRectangularDistance(coords1, coords2)
                break
        }
        
        this.distanceCache.set(cacheKey, distance)
        return distance
    }
    
    /**
     * Calculate distance in rectangular topology
     * @param {Array} coords1 - [x, y] coordinates of first node
     * @param {Array} coords2 - [x, y] coordinates of second node
     * @returns {number} Euclidean distance
     */
    calculateRectangularDistance(coords1, coords2) {
        let dx = coords2[0] - coords1[0]
        let dy = coords2[1] - coords1[1]
        
        // Handle toroidal boundary conditions
        if (this.options.boundaryCondition === 'toroidal') {
            dx = this.toroidalDistance(dx, this.width)
            dy = this.toroidalDistance(dy, this.height)
        }
        
        return Math.sqrt(dx * dx + dy * dy)
    }
    
    /**
     * Calculate distance in hexagonal topology
     * @param {Array} coords1 - [x, y] coordinates of first node
     * @param {Array} coords2 - [x, y] coordinates of second node
     * @returns {number} Hexagonal distance
     */
    calculateHexagonalDistance(coords1, coords2) {
        // Convert to cube coordinates for hexagonal distance calculation
        const cube1 = this.offsetToCube(coords1[0], coords1[1])
        const cube2 = this.offsetToCube(coords2[0], coords2[1])
        
        // Handle toroidal boundary conditions in cube space
        if (this.options.boundaryCondition === 'toroidal') {
            // Hexagonal toroidal wrapping is complex - for now use bounded
            logger.warn('Toroidal boundary conditions not fully implemented for hexagonal topology')
        }
        
        // Hexagonal distance in cube coordinates
        return (Math.abs(cube1.x - cube2.x) + 
                Math.abs(cube1.y - cube2.y) + 
                Math.abs(cube1.z - cube2.z)) / 2
    }
    
    /**
     * Calculate toroidal distance (shortest path around torus)
     * @param {number} delta - Raw coordinate difference
     * @param {number} size - Size of the dimension
     * @returns {number} Shortest toroidal distance
     */
    toroidalDistance(delta, size) {
        const absDelta = Math.abs(delta)
        return Math.min(absDelta, size - absDelta)
    }
    
    /**
     * Convert offset coordinates to cube coordinates (for hexagonal topology)
     * @param {number} col - Column (x coordinate)
     * @param {number} row - Row (y coordinate)
     * @returns {Object} Cube coordinates {x, y, z}
     */
    offsetToCube(col, row) {
        const x = col - (row - (row & 1)) / 2
        const z = row
        const y = -x - z
        return { x, y, z }
    }
    
    /**
     * Convert cube coordinates to offset coordinates
     * @param {Object} cube - Cube coordinates {x, y, z}
     * @returns {Array} Offset coordinates [col, row]
     */
    cubeToOffset(cube) {
        const col = cube.x + (cube.z - (cube.z & 1)) / 2
        const row = cube.z
        return [col, row]
    }
    
    /**
     * Get all neighbors of a node within a given radius
     * @param {Array} coords - [x, y] coordinates of the center node
     * @param {number} radius - Neighborhood radius
     * @returns {Array} Array of neighbor coordinates [[x, y], ...]
     */
    getNeighbors(coords, radius) {
        const cacheKey = `${coords[0]},${coords[1]}-${radius}`
        
        if (this.neighborhoodCache.has(cacheKey)) {
            return this.neighborhoodCache.get(cacheKey)
        }
        
        const neighbors = []
        const [centerX, centerY] = coords
        
        // Search in a square/hexagonal region around the center
        const searchRadius = Math.ceil(radius)
        
        for (let x = centerX - searchRadius; x <= centerX + searchRadius; x++) {
            for (let y = centerY - searchRadius; y <= centerY + searchRadius; y++) {
                // Check if coordinates are valid
                if (this.isValidCoordinate(x, y)) {
                    const nodeCoords = [x, y]
                    const distance = this.calculateDistance(coords, nodeCoords)
                    
                    if (distance <= radius) {
                        neighbors.push({
                            coords: nodeCoords,
                            distance: distance
                        })
                    }
                }
            }
        }
        
        this.neighborhoodCache.set(cacheKey, neighbors)
        return neighbors
    }
    
    /**
     * Check if coordinates are valid for the current map
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @returns {boolean} True if coordinates are valid
     */
    isValidCoordinate(x, y) {
        if (this.options.boundaryCondition === 'toroidal') {
            return true // All coordinates are valid with wrapping
        }
        
        return x >= 0 && x < this.width && y >= 0 && y < this.height
    }
    
    /**
     * Normalize coordinates according to boundary conditions
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @returns {Array} Normalized coordinates [x, y]
     */
    normalizeCoordinates(x, y) {
        if (this.options.boundaryCondition === 'toroidal') {
            const normalizedX = ((x % this.width) + this.width) % this.width
            const normalizedY = ((y % this.height) + this.height) % this.height
            return [normalizedX, normalizedY]
        }
        
        // Bounded: clamp to valid range
        const clampedX = Math.max(0, Math.min(this.width - 1, x))
        const clampedY = Math.max(0, Math.min(this.height - 1, y))
        return [clampedX, clampedY]
    }
    
    /**
     * Convert linear index to 2D coordinates
     * @param {number} index - Linear index
     * @returns {Array} [x, y] coordinates
     */
    indexToCoordinates(index) {
        const x = index % this.width
        const y = Math.floor(index / this.width)
        return [x, y]
    }
    
    /**
     * Convert 2D coordinates to linear index
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @returns {number} Linear index
     */
    coordinatesToIndex(x, y) {
        const [normalizedX, normalizedY] = this.normalizeCoordinates(x, y)
        return normalizedY * this.width + normalizedX
    }
    
    /**
     * Get visualization coordinates for the map nodes
     * Converts map coordinates to visual coordinates suitable for plotting
     * @param {string} outputFormat - 'cartesian', 'normalized', 'screen'
     * @returns {Array} Array of coordinate pairs for visualization
     */
    getVisualizationCoordinates(outputFormat = 'cartesian') {
        const coordinates = []
        
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                let visualCoords
                
                switch (this.options.topology) {
                    case 'hexagonal':
                        visualCoords = this.getHexagonalVisualCoords(x, y)
                        break
                    case 'rectangular':
                    default:
                        visualCoords = [x, y]
                        break
                }
                
                // Transform according to output format
                switch (outputFormat) {
                    case 'normalized':
                        visualCoords = [
                            visualCoords[0] / this.width,
                            visualCoords[1] / this.height
                        ]
                        break
                    case 'screen':
                        // Assume screen coordinates with origin at top-left
                        visualCoords = [
                            visualCoords[0],
                            this.height - visualCoords[1] - 1
                        ]
                        break
                    case 'cartesian':
                    default:
                        // Keep as-is
                        break
                }
                
                coordinates.push({
                    mapCoords: [x, y],
                    visualCoords: visualCoords,
                    index: this.coordinatesToIndex(x, y)
                })
            }
        }
        
        return coordinates
    }
    
    /**
     * Get visual coordinates for hexagonal topology
     * @param {number} x - Map X coordinate
     * @param {number} y - Map Y coordinate
     * @returns {Array} [visualX, visualY] coordinates
     */
    getHexagonalVisualCoords(x, y) {
        // Hexagonal grid layout with offset
        const hexWidth = Math.sqrt(3)
        const hexHeight = 2.0
        
        const visualX = x * hexWidth + (y % 2) * (hexWidth / 2)
        const visualY = y * hexHeight * 0.75
        
        return [visualX, visualY]
    }
    
    /**
     * Create neighborhood function for training
     * @param {string} functionType - 'gaussian', 'mexican_hat', 'bubble', 'linear'
     * @returns {Function} Neighborhood function(distance, radius)
     */
    createNeighborhoodFunction(functionType = 'gaussian') {
        switch (functionType) {
            case 'gaussian':
                return (distance, radius) => {
                    if (radius <= 0) return distance === 0 ? 1 : 0
                    const sigma = radius / 3.0 // 3-sigma rule
                    return Math.exp(-(distance * distance) / (2 * sigma * sigma))
                }
                
            case 'mexican_hat':
                return (distance, radius) => {
                    if (radius <= 0) return distance === 0 ? 1 : 0
                    const sigma = radius / 3.0
                    const factor = 2 / (Math.sqrt(3 * sigma) * Math.pow(Math.PI, 0.25))
                    const x = distance / sigma
                    return factor * (1 - x * x) * Math.exp(-x * x / 2)
                }
                
            case 'bubble':
                return (distance, radius) => {
                    return distance <= radius ? 1 : 0
                }
                
            case 'linear':
                return (distance, radius) => {
                    if (radius <= 0) return distance === 0 ? 1 : 0
                    return Math.max(0, 1 - distance / radius)
                }
                
            default:
                logger.warn(`Unknown neighborhood function: ${functionType}, using gaussian`)
                return this.createNeighborhoodFunction('gaussian')
        }
    }
    
    /**
     * Get topology information
     * @returns {Object} Topology information
     */
    getTopologyInfo() {
        return {
            topology: this.options.topology,
            boundaryCondition: this.options.boundaryCondition,
            mapSize: [this.width, this.height],
            totalNodes: this.totalNodes,
            cacheSize: this.neighborhoodCache.size,
            distanceCacheSize: this.distanceCache.size
        }
    }
    
    /**
     * Clear topology caches
     */
    clearCaches() {
        this.neighborhoodCache.clear()
        this.distanceCache.clear()
        logger.debug('VSOMTopology caches cleared')
    }
    
    /**
     * Estimate memory usage of topology management
     * @returns {number} Estimated memory usage in bytes
     */
    estimateMemoryUsage() {
        const neighborhoodCacheSize = this.neighborhoodCache.size * 100 // Rough estimate
        const distanceCacheSize = this.distanceCache.size * 16 // Cache key + value
        return neighborhoodCacheSize + distanceCacheSize
    }
    
    /**
     * Validate topology configuration
     * @returns {Object} Validation result {valid: boolean, errors: Array}
     */
    validateConfiguration() {
        const errors = []
        
        if (this.width <= 0 || this.height <= 0) {
            errors.push('Map dimensions must be positive')
        }
        
        if (!['rectangular', 'hexagonal'].includes(this.options.topology)) {
            errors.push(`Invalid topology: ${this.options.topology}`)
        }
        
        if (!['bounded', 'toroidal'].includes(this.options.boundaryCondition)) {
            errors.push(`Invalid boundary condition: ${this.options.boundaryCondition}`)
        }
        
        if (this.options.topology === 'hexagonal' && this.options.boundaryCondition === 'toroidal') {
            logger.warn('Toroidal hexagonal topology may have limitations')
        }
        
        return {
            valid: errors.length === 0,
            errors: errors
        }
    }
}