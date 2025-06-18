#!/usr/bin/env node

/**
 * @fileoverview Module 7: Vector Self-Organizing Map (VSOM)
 * 
 * This module implements a Self-Organizing Map (SOM) for visualizing and clustering
 * high-dimensional entity embeddings from the knowledge graph. It creates a 2D
 * topological representation of the semantic space, revealing clusters and
 * relationships between entities.
 * 
 * Dependencies: Module 3 (Search) - requires entity embeddings
 * 
 * Usage:
 *   node examples/end-to-end/VSOM.js
 * 
 * Features:
 * - Self-Organizing Map training on entity embeddings
 * - Topological visualization of semantic space
 * - Cluster analysis and boundary detection
 * - Distance-based similarity mapping
 * - Convergence analysis and training metrics
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import Config from '../../src/Config.js';
import fs from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Self-Organizing Map implementation for high-dimensional embeddings
 */
class SelfOrganizingMap {
    constructor(width = 10, height = 10, inputDim = 1536, learningRate = 0.1, radius = 3.0) {
        this.width = width;
        this.height = height;
        this.inputDim = inputDim;
        this.initialLearningRate = learningRate;
        this.initialRadius = radius;
        this.currentLearningRate = learningRate;
        this.currentRadius = radius;
        this.iteration = 0;
        this.maxIterations = 1000;
        
        // Initialize weight matrix with random values
        this.weights = [];
        for (let i = 0; i < width; i++) {
            this.weights[i] = [];
            for (let j = 0; j < height; j++) {
                this.weights[i][j] = [];
                for (let k = 0; k < inputDim; k++) {
                    this.weights[i][j][k] = Math.random() * 0.1 - 0.05; // Small random values
                }
            }
        }
        
        this.trainingHistory = [];
    }

    /**
     * Calculate Euclidean distance between two vectors
     */
    euclideanDistance(a, b) {
        if (a.length !== b.length) {
            throw new Error('Vector dimensions must match');
        }
        let sum = 0;
        for (let i = 0; i < a.length; i++) {
            sum += Math.pow(a[i] - b[i], 2);
        }
        return Math.sqrt(sum);
    }

    /**
     * Find the Best Matching Unit (BMU) for an input vector
     */
    findBMU(input) {
        let minDistance = Infinity;
        let bmu = { x: 0, y: 0 };

        for (let i = 0; i < this.width; i++) {
            for (let j = 0; j < this.height; j++) {
                const distance = this.euclideanDistance(input, this.weights[i][j]);
                if (distance < minDistance) {
                    minDistance = distance;
                    bmu = { x: i, y: j };
                }
            }
        }

        return { ...bmu, distance: minDistance };
    }

    /**
     * Calculate neighborhood function (Gaussian)
     */
    neighborhoodFunction(distance, radius) {
        return Math.exp(-(distance * distance) / (2 * radius * radius));
    }

    /**
     * Update learning rate and radius based on iteration
     */
    updateParameters() {
        const timeConstant = this.maxIterations / Math.log(this.initialRadius);
        this.currentRadius = this.initialRadius * Math.exp(-this.iteration / timeConstant);
        this.currentLearningRate = this.initialLearningRate * Math.exp(-this.iteration / this.maxIterations);
    }

    /**
     * Train the SOM with a single input vector
     */
    trainStep(input) {
        // Find Best Matching Unit
        const bmu = this.findBMU(input);
        
        // Update weights in neighborhood
        for (let i = 0; i < this.width; i++) {
            for (let j = 0; j < this.height; j++) {
                const nodeDistance = Math.sqrt(Math.pow(i - bmu.x, 2) + Math.pow(j - bmu.y, 2));
                
                if (nodeDistance <= this.currentRadius) {
                    const influence = this.neighborhoodFunction(nodeDistance, this.currentRadius);
                    const learningInfluence = this.currentLearningRate * influence;
                    
                    // Update weights
                    for (let k = 0; k < this.inputDim; k++) {
                        this.weights[i][j][k] += learningInfluence * (input[k] - this.weights[i][j][k]);
                    }
                }
            }
        }
        
        this.iteration++;
        this.updateParameters();
        
        return bmu;
    }

    /**
     * Train the SOM with multiple epochs
     */
    train(data, epochs = 100) {
        console.log(`🧠 Training SOM (${this.width}x${this.height}) for ${epochs} epochs...`);
        
        this.maxIterations = epochs * data.length;
        let totalError = 0;
        
        for (let epoch = 0; epoch < epochs; epoch++) {
            let epochError = 0;
            
            // Shuffle data for each epoch
            const shuffledData = [...data].sort(() => Math.random() - 0.5);
            
            for (const input of shuffledData) {
                const bmu = this.trainStep(input.embedding);
                epochError += bmu.distance;
            }
            
            epochError /= data.length;
            totalError += epochError;
            
            this.trainingHistory.push({
                epoch: epoch + 1,
                error: epochError,
                learningRate: this.currentLearningRate,
                radius: this.currentRadius
            });
            
            // Progress reporting
            if ((epoch + 1) % Math.ceil(epochs / 10) === 0 || epoch === 0) {
                console.log(`   Epoch ${epoch + 1}/${epochs}: Error=${epochError.toFixed(6)}, LR=${this.currentLearningRate.toFixed(4)}, Radius=${this.currentRadius.toFixed(2)}`);
            }
        }
        
        const avgError = totalError / epochs;
        console.log(`✓ Training completed. Average error: ${avgError.toFixed(6)}`);
        
        return {
            finalError: this.trainingHistory[this.trainingHistory.length - 1].error,
            averageError: avgError,
            epochs: epochs,
            converged: avgError < 0.1
        };
    }

    /**
     * Map input vectors to SOM coordinates
     */
    mapToSOM(data) {
        const mappings = [];
        
        for (const item of data) {
            const bmu = this.findBMU(item.embedding);
            mappings.push({
                ...item,
                somX: bmu.x,
                somY: bmu.y,
                distance: bmu.distance
            });
        }
        
        return mappings;
    }

    /**
     * Calculate U-Matrix (Unified Distance Matrix) for visualization
     */
    calculateUMatrix() {
        const uMatrix = [];
        
        for (let i = 0; i < this.width; i++) {
            uMatrix[i] = [];
            for (let j = 0; j < this.height; j++) {
                let totalDistance = 0;
                let neighborCount = 0;
                
                // Check all 8 neighbors
                for (let di = -1; di <= 1; di++) {
                    for (let dj = -1; dj <= 1; dj++) {
                        if (di === 0 && dj === 0) continue;
                        
                        const ni = i + di;
                        const nj = j + dj;
                        
                        if (ni >= 0 && ni < this.width && nj >= 0 && nj < this.height) {
                            const distance = this.euclideanDistance(this.weights[i][j], this.weights[ni][nj]);
                            totalDistance += distance;
                            neighborCount++;
                        }
                    }
                }
                
                uMatrix[i][j] = neighborCount > 0 ? totalDistance / neighborCount : 0;
            }
        }
        
        return uMatrix;
    }

    /**
     * Identify clusters based on U-Matrix
     */
    identifyClusters(uMatrix, threshold = null) {
        if (!threshold) {
            // Auto-calculate threshold as mean + std deviation
            const flatValues = uMatrix.flat();
            const mean = flatValues.reduce((sum, val) => sum + val, 0) / flatValues.length;
            const variance = flatValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / flatValues.length;
            const stdDev = Math.sqrt(variance);
            threshold = mean + stdDev * 0.5; // Adjustable factor
        }
        
        const clusters = [];
        const visited = Array(this.width).fill().map(() => Array(this.height).fill(false));
        let clusterId = 0;
        
        for (let i = 0; i < this.width; i++) {
            for (let j = 0; j < this.height; j++) {
                if (!visited[i][j] && uMatrix[i][j] < threshold) {
                    const cluster = [];
                    this.exploreCluster(i, j, uMatrix, threshold, visited, cluster);
                    if (cluster.length > 1) { // Only consider clusters with more than 1 node
                        clusters.push({
                            id: clusterId++,
                            nodes: cluster,
                            size: cluster.length
                        });
                    }
                }
            }
        }
        
        return clusters;
    }

    /**
     * Depth-first search to explore cluster
     */
    exploreCluster(x, y, uMatrix, threshold, visited, cluster) {
        if (x < 0 || x >= this.width || y < 0 || y >= this.height || visited[x][y] || uMatrix[x][y] >= threshold) {
            return;
        }
        
        visited[x][y] = true;
        cluster.push({ x, y, distance: uMatrix[x][y] });
        
        // Explore 4-connected neighbors
        this.exploreCluster(x + 1, y, uMatrix, threshold, visited, cluster);
        this.exploreCluster(x - 1, y, uMatrix, threshold, visited, cluster);
        this.exploreCluster(x, y + 1, uMatrix, threshold, visited, cluster);
        this.exploreCluster(x, y - 1, uMatrix, threshold, visited, cluster);
    }

    /**
     * Generate ASCII visualization of the SOM
     */
    visualize(mappings = null) {
        console.log(`\n📊 SOM Visualization (${this.width}x${this.height}):`);
        
        // Create a grid to show entity positions
        const grid = Array(this.height).fill().map(() => Array(this.width).fill('.'));
        const entityCount = Array(this.height).fill().map(() => Array(this.width).fill(0));
        
        if (mappings) {
            mappings.forEach(mapping => {
                entityCount[mapping.somY][mapping.somX]++;
            });
            
            // Mark positions with entities
            for (let j = 0; j < this.height; j++) {
                for (let i = 0; i < this.width; i++) {
                    const count = entityCount[j][i];
                    if (count > 0) {
                        grid[j][i] = count > 9 ? '+' : count.toString();
                    }
                }
            }
        }
        
        // Print grid with coordinates
        console.log('   ' + Array.from({length: this.width}, (_, i) => i % 10).join(''));
        for (let j = 0; j < this.height; j++) {
            console.log(`${j.toString().padStart(2)} ${grid[j].join('')}`);
        }
        
        console.log('\nLegend: . = empty, 1-9 = entity count, + = 10+ entities');
        
        return grid;
    }
}

/**
 * Execute SPARQL SELECT query
 */
async function executeSparqlSelect(query, config) {
    const sparqlEndpoints = config.get('sparqlEndpoints');
    const endpoint = sparqlEndpoints[0];
    const queryEndpoint = `${endpoint.urlBase}${endpoint.query}`;
    
    const response = await fetch(queryEndpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/sparql-query',
            'Accept': 'application/sparql-results+json',
            'Authorization': `Basic ${Buffer.from(`${endpoint.user}:${endpoint.password}`).toString('base64')}`
        },
        body: query
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`SPARQL SELECT failed: ${response.status} - ${errorText}`);
    }

    return await response.json();
}

/**
 * Load entity embeddings from SPARQL store
 */
async function loadEntityEmbeddings(config) {
    console.log('📚 Loading entity embeddings from SPARQL store...');
    
    // Query entities with their embeddings
    const entitiesQuery = `
        PREFIX ragno: <http://purl.org/stuff/ragno/>
        PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
        
        SELECT ?entity ?name ?embedding WHERE {
            GRAPH <http://semem.hyperdata.it/end-to-end> {
                ?entity a ragno:Element ;
                       skos:prefLabel ?name ;
                       ragno:embedding ?embedding .
            }
        }
    `;
    
    const result = await executeSparqlSelect(entitiesQuery, config);
    const entities = result.results?.bindings || [];
    
    console.log(`📊 Found ${entities.length} entities with embeddings`);
    
    const embeddings = [];
    for (const entity of entities) {
        try {
            const embeddingStr = entity.embedding.value;
            const embedding = JSON.parse(embeddingStr);
            
            if (Array.isArray(embedding) && embedding.length === 1536) {
                embeddings.push({
                    id: entity.entity.value,
                    name: entity.name.value,
                    embedding: embedding
                });
            } else {
                console.log(`⚠️  Invalid embedding for ${entity.name.value}: length=${embedding?.length || 'not array'}`);
            }
        } catch (error) {
            console.log(`⚠️  Failed to parse embedding for ${entity.name.value}: ${error.message}`);
        }
    }
    
    console.log(`✅ Loaded ${embeddings.length} valid embeddings\n`);
    return embeddings;
}

/**
 * VSOM Module Class for orchestrator integration
 */
class VSOMModule {
    constructor(config = null) {
        this.config = config;
        this.results = {
            entitiesProcessed: 0,
            mapSize: '0x0',
            clustersFound: 0,
            trainingEpochs: 0,
            finalError: 0,
            converged: false,
            success: false
        };
    }

    async initialize() {
        if (!this.config) {
            this.config = new Config();
            await this.config.init();
        }
    }

    async execute() {
        const analysisResults = await runVSOMAnalysis();
        this.results.entitiesProcessed = analysisResults?.entitiesProcessed || 0;
        this.results.mapSize = analysisResults?.mapSize || '0x0';
        this.results.clustersFound = analysisResults?.clustersFound || 0;
        this.results.trainingEpochs = analysisResults?.trainingEpochs || 0;
        this.results.finalError = analysisResults?.finalError || 0;
        this.results.converged = analysisResults?.converged || false;
        this.results.success = true;
    }

    async cleanup() {
        // Cleanup if needed
    }

    getResults() {
        return this.results;
    }
}

/**
 * Main VSOM analysis function
 */
async function runVSOMAnalysis() {
    console.log('🗺️ === MODULE 7: VECTOR SELF-ORGANIZING MAP ===\n');
    
    try {
        // Initialize configuration
        const config = new Config();
        await config.init();
        
        // Check SPARQL endpoint configuration
        const sparqlEndpoints = config.get('sparqlEndpoints');
        if (!sparqlEndpoints || sparqlEndpoints.length === 0) {
            throw new Error('No SPARQL endpoints configured. Please check your config.');
        }

        console.log('✓ Configuration initialized');
        
        // Load entity embeddings
        const embeddings = await loadEntityEmbeddings(config);
        
        if (embeddings.length === 0) {
            console.log('❌ No entity embeddings found. Please run Module 2 (Enrich) first.');
            return {
                entitiesProcessed: 0,
                mapSize: '0x0',
                clustersFound: 0,
                trainingEpochs: 0,
                finalError: 0,
                converged: false
            };
        }
        
        // Determine SOM size based on data size (rule of thumb: ~5-10 times fewer neurons than data points)
        const numEntities = embeddings.length;
        let mapWidth, mapHeight;
        
        if (numEntities <= 5) {
            mapWidth = mapHeight = 3;
        } else if (numEntities <= 15) {
            mapWidth = mapHeight = 4;
        } else if (numEntities <= 30) {
            mapWidth = mapHeight = 5;
        } else {
            mapWidth = mapHeight = Math.ceil(Math.sqrt(numEntities / 2));
        }
        
        console.log(`🗺️ Creating ${mapWidth}x${mapHeight} SOM for ${numEntities} entities...`);
        
        // Create and train SOM
        const som = new SelfOrganizingMap(mapWidth, mapHeight, 1536, 0.1, Math.max(mapWidth, mapHeight) / 2);
        
        // Train the SOM
        const epochs = Math.max(50, Math.min(200, numEntities * 5)); // Adaptive epoch count
        const trainingResults = som.train(embeddings, epochs);
        
        // Map entities to SOM
        console.log('\n🎯 Mapping entities to SOM coordinates...');
        const mappings = som.mapToSOM(embeddings);
        
        // Calculate U-Matrix for cluster analysis
        console.log('🧮 Calculating U-Matrix for cluster detection...');
        const uMatrix = som.calculateUMatrix();
        
        // Identify clusters
        const clusters = som.identifyClusters(uMatrix);
        console.log(`📍 Identified ${clusters.length} clusters`);
        
        // Visualize SOM
        const grid = som.visualize(mappings);
        
        // Analyze entity distributions
        console.log('\n📋 Entity Analysis:');
        const entityDistribution = new Map();
        mappings.forEach(mapping => {
            const key = `${mapping.somX},${mapping.somY}`;
            if (!entityDistribution.has(key)) {
                entityDistribution.set(key, []);
            }
            entityDistribution.get(key).push(mapping);
        });
        
        // Show entities at each position
        let positionsWithEntities = 0;
        entityDistribution.forEach((entities, position) => {
            if (entities.length > 0) {
                positionsWithEntities++;
                const [x, y] = position.split(',').map(Number);
                console.log(`   Position (${x},${y}): ${entities.length} entities`);
                entities.forEach(entity => {
                    console.log(`     • ${entity.name} (distance: ${entity.distance.toFixed(4)})`);
                });
            }
        });
        
        // Cluster analysis
        console.log('\n🎯 Cluster Analysis:');
        if (clusters.length > 0) {
            clusters.forEach((cluster, idx) => {
                console.log(`   Cluster ${idx + 1}: ${cluster.size} nodes`);
                const clusterEntities = [];
                cluster.nodes.forEach(node => {
                    const entitiesAtNode = entityDistribution.get(`${node.x},${node.y}`) || [];
                    clusterEntities.push(...entitiesAtNode);
                });
                if (clusterEntities.length > 0) {
                    console.log(`     Entities: ${clusterEntities.map(e => e.name).join(', ')}`);
                }
            });
        } else {
            console.log('   No distinct clusters detected (entities may be uniformly distributed)');
        }
        
        // Training convergence analysis
        console.log('\n📊 Training Analysis:');
        console.log(`   Final error: ${trainingResults.finalError.toFixed(6)}`);
        console.log(`   Average error: ${trainingResults.averageError.toFixed(6)}`);
        console.log(`   Training epochs: ${epochs}`);
        console.log(`   Converged: ${trainingResults.converged ? 'Yes' : 'No'}`);
        
        // Topology preservation analysis
        const occupiedPositions = Array.from(entityDistribution.keys()).filter(
            key => entityDistribution.get(key).length > 0
        ).length;
        const totalPositions = mapWidth * mapHeight;
        const coverage = (occupiedPositions / totalPositions) * 100;
        
        console.log(`   Map coverage: ${occupiedPositions}/${totalPositions} positions (${coverage.toFixed(1)}%)`);
        
        // Summary
        console.log('\n📋 Summary:');
        console.log(`✓ Processed ${numEntities} entity embeddings (1536D)`);
        console.log(`✓ Trained ${mapWidth}x${mapHeight} SOM with ${epochs} epochs`);
        console.log(`✓ Mapped entities to ${occupiedPositions} distinct positions`);
        console.log(`✓ Identified ${clusters.length} topological clusters`);
        console.log(`✓ SOM training ${trainingResults.converged ? 'converged' : 'completed'} successfully`);
        
        if (mappings.length > 0) {
            const bestMapped = mappings.reduce((best, current) => 
                current.distance < best.distance ? current : best
            );
            console.log(`🎯 Best mapped entity: "${bestMapped.name}" at position (${bestMapped.somX},${bestMapped.somY}) with distance ${bestMapped.distance.toFixed(4)}`);
        }
        
        console.log('\n🎉 VSOM analysis completed successfully!');
        
        // Return results for orchestrator
        return {
            entitiesProcessed: numEntities,
            mapSize: `${mapWidth}x${mapHeight}`,
            clustersFound: clusters.length,
            trainingEpochs: epochs,
            finalError: trainingResults.finalError,
            converged: trainingResults.converged
        };
        
    } catch (error) {
        console.error('❌ VSOM analysis failed:', error.message);
        if (error.message.includes('Entity') || error.message.includes('SPARQL')) {
            console.log('\n💡 Tip: Make sure to run Module 2 (Enrich) first to populate entity embeddings');
        }
        
        // Return default results on error
        return {
            entitiesProcessed: 0,
            mapSize: '0x0',
            clustersFound: 0,
            trainingEpochs: 0,
            finalError: 0,
            converged: false
        };
    }
}

// Run the module if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    runVSOMAnalysis().catch(console.error);
}

export default VSOMModule;
export { runVSOMAnalysis };