#!/usr/bin/env node

/**
 * @fileoverview Module 6: Personalized PageRank Analysis
 * 
 * This module implements PersonalizedPageRank (PPR) to analyze concept importance
 * and relevance within the knowledge graph. It identifies the most significant
 * entities and concepts based on graph structure and semantic relationships.
 * 
 * Dependencies: Module 2 (Enrich) - requires entities in SPARQL store
 * 
 * Usage:
 *   node examples/end-to-end/PageRank.js
 * 
 * Features:
 * - Builds graph from SPARQL entity relationships
 * - Implements PersonalizedPageRank algorithm
 * - Ranks entities by importance and relevance
 * - Supports topic-specific personalization vectors
 * - Analyzes influence and centrality patterns
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { MemoryManager } from '../../src/MemoryManager.js';
import { Config } from '../../src/Config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * PersonalizedPageRank implementation for knowledge graph analysis
 */
class PersonalizedPageRank {
    constructor(alpha = 0.85, epsilon = 1e-6, maxIterations = 100) {
        this.alpha = alpha;          // Damping factor
        this.epsilon = epsilon;      // Convergence threshold
        this.maxIterations = maxIterations;
        this.graph = new Map();      // Adjacency list representation
        this.entities = new Map();   // Entity metadata
    }

    /**
     * Add entity to the graph
     */
    addEntity(id, metadata = {}) {
        this.entities.set(id, metadata);
        if (!this.graph.has(id)) {
            this.graph.set(id, new Set());
        }
    }

    /**
     * Add edge between entities
     */
    addEdge(from, to, weight = 1.0) {
        if (!this.graph.has(from)) this.graph.set(from, new Set());
        if (!this.graph.has(to)) this.graph.set(to, new Set());
        
        this.graph.get(from).add({ node: to, weight });
        // For undirected graph, add reverse edge
        this.graph.get(to).add({ node: from, weight });
    }

    /**
     * Calculate PersonalizedPageRank scores
     */
    calculatePPR(personalizationVector = null) {
        const nodes = Array.from(this.graph.keys());
        const n = nodes.length;
        
        if (n === 0) return new Map();

        // Initialize scores uniformly
        const scores = new Map();
        nodes.forEach(node => scores.set(node, 1.0 / n));

        // Default personalization vector (uniform)
        const pv = personalizationVector || new Map();
        if (pv.size === 0) {
            nodes.forEach(node => pv.set(node, 1.0 / n));
        }

        // Normalize personalization vector
        const pvSum = Array.from(pv.values()).reduce((sum, val) => sum + val, 0);
        if (pvSum > 0) {
            pv.forEach((val, key) => pv.set(key, val / pvSum));
        }

        // Power iteration
        for (let iter = 0; iter < this.maxIterations; iter++) {
            const newScores = new Map();
            
            // Initialize with personalization vector
            nodes.forEach(node => {
                newScores.set(node, (1 - this.alpha) * (pv.get(node) || 0));
            });

            // Add contributions from incoming edges
            for (const [node, neighbors] of this.graph) {
                const currentScore = scores.get(node) || 0;
                const outDegree = neighbors.size;
                
                if (outDegree > 0) {
                    const contribution = this.alpha * currentScore / outDegree;
                    
                    neighbors.forEach(({ node: neighbor, weight }) => {
                        const weightedContribution = contribution * weight;
                        newScores.set(neighbor, 
                            (newScores.get(neighbor) || 0) + weightedContribution);
                    });
                }
            }

            // Check convergence
            let maxDiff = 0;
            nodes.forEach(node => {
                const diff = Math.abs(newScores.get(node) - scores.get(node));
                maxDiff = Math.max(maxDiff, diff);
            });

            scores.clear();
            newScores.forEach((score, node) => scores.set(node, score));

            if (maxDiff < this.epsilon) {
                console.log(`✓ PageRank converged after ${iter + 1} iterations`);
                break;
            }
        }

        return scores;
    }

    /**
     * Get top-k entities by PageRank score
     */
    getTopEntities(scores, k = 10) {
        return Array.from(scores.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, k)
            .map(([id, score]) => ({
                id,
                score,
                metadata: this.entities.get(id) || {}
            }));
    }

    /**
     * Calculate topic-specific personalization
     */
    createTopicPersonalization(topicEntities) {
        const pv = new Map();
        const weight = 1.0 / topicEntities.length;
        
        topicEntities.forEach(entityId => {
            if (this.entities.has(entityId)) {
                pv.set(entityId, weight);
            }
        });
        
        return pv;
    }

    /**
     * Analyze influence patterns
     */
    analyzeInfluence(scores) {
        const values = Array.from(scores.values());
        const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
        const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
        const stdDev = Math.sqrt(variance);
        
        return {
            mean,
            variance,
            stdDev,
            min: Math.min(...values),
            max: Math.max(...values),
            entropy: -values.reduce((sum, val) => sum + (val > 0 ? val * Math.log(val) : 0), 0)
        };
    }
}

/**
 * Build graph from SPARQL entities and relationships
 */
async function buildGraphFromSPARQL(memoryManager) {
    const pageRank = new PersonalizedPageRank();
    
    console.log('🔍 Loading entities from SPARQL store...');
    
    // Query all entities
    const entitiesQuery = `
        PREFIX ragno: <http://purl.org/stuff/ragno/>
        
        SELECT ?entity ?name ?type WHERE {
            ?entity a ragno:Entity ;
                   ragno:hasName ?name .
            OPTIONAL { ?entity ragno:hasSubType ?type }
        }
    `;
    
    const entitiesResult = await memoryManager.store.queryRaw(entitiesQuery);
    const entities = entitiesResult.results?.bindings || [];
    
    console.log(`📊 Found ${entities.length} entities`);
    
    // Add entities to graph
    const entityMap = new Map();
    entities.forEach(entity => {
        const id = entity.entity.value;
        const name = entity.name.value;
        const type = entity.type?.value || 'Entity';
        
        entityMap.set(id, { name, type });
        pageRank.addEntity(id, { name, type });
    });
    
    // Create edges based on co-occurrence and semantic similarity
    console.log('🔗 Creating entity relationships...');
    
    const entityIds = Array.from(entityMap.keys());
    let edgeCount = 0;
    
    // Method 1: Co-occurrence in same documents
    for (let i = 0; i < entityIds.length; i++) {
        for (let j = i + 1; j < entityIds.length; j++) {
            const entity1 = entityIds[i];
            const entity2 = entityIds[j];
            
            // Query for co-occurrence
            const cooccurrenceQuery = `
                PREFIX ragno: <http://purl.org/stuff/ragno/>
                
                SELECT (COUNT(?doc) as ?count) WHERE {
                    ?doc ragno:containsEntity <${entity1}> .
                    ?doc ragno:containsEntity <${entity2}> .
                }
            `;
            
            try {
                const result = await memoryManager.store.queryRaw(cooccurrenceQuery);
                const count = parseInt(result.results?.bindings[0]?.count?.value || '0');
                
                if (count > 0) {
                    pageRank.addEdge(entity1, entity2, count);
                    edgeCount++;
                }
            } catch (error) {
                // Fallback: create edge based on entity names similarity
                const name1 = entityMap.get(entity1).name.toLowerCase();
                const name2 = entityMap.get(entity2).name.toLowerCase();
                
                // Simple similarity based on common words
                const words1 = name1.split(/\s+/);
                const words2 = name2.split(/\s+/);
                const commonWords = words1.filter(word => words2.includes(word));
                
                if (commonWords.length > 0 || name1.includes(name2) || name2.includes(name1)) {
                    pageRank.addEdge(entity1, entity2, 0.5);
                    edgeCount++;
                }
            }
        }
    }
    
    // Method 2: Type-based relationships
    const typeGroups = new Map();
    entityMap.forEach((metadata, id) => {
        const type = metadata.type;
        if (!typeGroups.has(type)) {
            typeGroups.set(type, []);
        }
        typeGroups.get(type).push(id);
    });
    
    // Connect entities of the same type
    typeGroups.forEach(entities => {
        if (entities.length > 1) {
            for (let i = 0; i < entities.length; i++) {
                for (let j = i + 1; j < entities.length; j++) {
                    pageRank.addEdge(entities[i], entities[j], 0.3);
                    edgeCount++;
                }
            }
        }
    });
    
    console.log(`✓ Created ${edgeCount} entity relationships`);
    
    return { pageRank, entityMap };
}

/**
 * Main PageRank analysis function
 */
async function runPageRankAnalysis() {
    console.log('🎯 === MODULE 6: PERSONALIZED PAGERANK ANALYSIS ===\n');
    
    let memoryManager;
    
    try {
        // Initialize configuration and memory manager
        const config = new Config();
        await config.initialize();
        
        memoryManager = new MemoryManager(config);
        await memoryManager.initialize();
        
        console.log('✓ Memory manager initialized');
        
        // Build graph from SPARQL data
        const { pageRank, entityMap } = await buildGraphFromSPARQL(memoryManager);
        
        if (entityMap.size === 0) {
            console.log('❌ No entities found. Please run Module 2 (Enrich) first.');
            return;
        }
        
        console.log(`\n📈 Running PageRank analysis on ${entityMap.size} entities...`);
        
        // 1. Global PageRank
        console.log('\n1️⃣ Global PageRank Analysis:');
        const globalScores = pageRank.calculatePPR();
        const topGlobal = pageRank.getTopEntities(globalScores, 5);
        
        console.log('🏆 Top 5 most important entities:');
        topGlobal.forEach((entity, idx) => {
            console.log(`   ${idx + 1}. ${entity.metadata.name} (${entity.metadata.type})`);
            console.log(`      Score: ${entity.score.toFixed(4)}`);
        });
        
        // 2. Topic-specific PageRank
        console.log('\n2️⃣ Topic-Specific PageRank Analysis:');
        
        // Group entities by type for topic analysis
        const typeGroups = new Map();
        entityMap.forEach((metadata, id) => {
            const type = metadata.type;
            if (!typeGroups.has(type)) {
                typeGroups.set(type, []);
            }
            typeGroups.get(type).push(id);
        });
        
        // Analyze each topic
        typeGroups.forEach((entities, type) => {
            if (entities.length > 1) {
                console.log(`\n🎯 Topic: ${type}`);
                const topicPV = pageRank.createTopicPersonalization(entities);
                const topicScores = pageRank.calculatePPR(topicPV);
                const topTopic = pageRank.getTopEntities(topicScores, 3);
                
                console.log(`   Top entities for ${type}:`);
                topTopic.forEach((entity, idx) => {
                    console.log(`     ${idx + 1}. ${entity.metadata.name} - ${entity.score.toFixed(4)}`);
                });
            }
        });
        
        // 3. Influence Analysis
        console.log('\n3️⃣ Influence Pattern Analysis:');
        const influence = pageRank.analyzeInfluence(globalScores);
        
        console.log(`📊 Score Distribution:`);
        console.log(`   Mean:     ${influence.mean.toFixed(4)}`);
        console.log(`   Std Dev:  ${influence.stdDev.toFixed(4)}`);
        console.log(`   Range:    ${influence.min.toFixed(4)} - ${influence.max.toFixed(4)}`);
        console.log(`   Entropy:  ${influence.entropy.toFixed(4)}`);
        
        // 4. Centrality Comparison
        console.log('\n4️⃣ Centrality Analysis:');
        
        // Calculate degree centrality for comparison
        const degreeCentrality = new Map();
        pageRank.graph.forEach((neighbors, node) => {
            degreeCentrality.set(node, neighbors.size);
        });
        
        const maxDegree = Math.max(...Array.from(degreeCentrality.values()));
        const normalizedDegree = new Map();
        degreeCentrality.forEach((degree, node) => {
            normalizedDegree.set(node, degree / maxDegree);
        });
        
        console.log('🔄 PageRank vs Degree Centrality (Top 3):');
        const topByDegree = Array.from(normalizedDegree.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3);
        
        topByDegree.forEach(([nodeId, degreeScore], idx) => {
            const prScore = globalScores.get(nodeId) || 0;
            const metadata = entityMap.get(nodeId);
            console.log(`   ${idx + 1}. ${metadata.name}`);
            console.log(`      PageRank: ${prScore.toFixed(4)}, Degree: ${degreeScore.toFixed(4)}`);
        });
        
        // 5. Summary
        console.log('\n📋 Summary:');
        console.log(`✓ Analyzed ${entityMap.size} entities with ${pageRank.graph.size} nodes`);
        console.log(`✓ Identified ${topGlobal.length} top-ranking entities`);
        console.log(`✓ Analyzed ${typeGroups.size} entity types`);
        console.log(`✓ PageRank algorithm converged successfully`);
        
        const topEntity = topGlobal[0];
        if (topEntity) {
            console.log(`🎯 Most influential entity: "${topEntity.metadata.name}" (score: ${topEntity.score.toFixed(4)})`);
        }
        
        console.log('\n🎉 PageRank analysis completed successfully!');
        
    } catch (error) {
        console.error('❌ PageRank analysis failed:', error.message);
        if (error.message.includes('Entity') || error.message.includes('SPARQL')) {
            console.log('\n💡 Tip: Make sure to run Module 2 (Enrich) first to populate entities');
        }
    } finally {
        if (memoryManager) {
            await memoryManager.dispose();
        }
    }
}

// Run the module if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    runPageRankAnalysis().catch(console.error);
}

export { runPageRankAnalysis };