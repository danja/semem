#!/usr/bin/env node

/**
 * Document Self-Organizing Map (SOM) Script
 * 
 * Finds ragno:Corpuscle instances created by ExtractConcepts.js, extracts concept-based features,
 * applies VSOM clustering to create semantic neighborhoods, and stores cluster assignments
 * and relationships back to SPARQL following the Ragno ontology.
 * 
 * This script creates cluster-based features similar to embeddings but without using
 * LLM or embedding tools - instead using concept co-occurrence, TF-IDF, and structural features.
 * 
 * Usage: node examples/document/SOM.js [--limit N] [--graph URI] [--map-size WxH]
 */

import { parseArgs } from 'util';
import path from 'path';
import Config from '../../src/Config.js';
import { SPARQLQueryService } from '../../src/services/sparql/index.js';
import SPARQLHelper from '../../src/services/sparql/SPARQLHelper.js';
import VSOM from '../../src/ragno/algorithms/VSOM.js';
import Entity from '../../src/ragno/Entity.js';
import { URIMinter } from '../../src/utils/URIMinter.js';
import logger from 'loglevel';
import rdf from 'rdf-ext';

// Load environment variables with explicit path
import { fileURLToPath } from 'url';
import { dirname } from 'path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class DocumentSOMProcessor {
    constructor() {
        this.config = null;
        this.sparqlHelper = null;
        this.queryService = null;
    }

    async init() {
        // Load configuration
        const configPath = path.join(process.cwd(), 'config/config.json');
        logger.info(`Loading configuration from: ${configPath}`);
        this.config = new Config(configPath);
        await this.config.init();
        
        const storageConfig = this.config.get('storage');
        if (storageConfig.type !== 'sparql') {
            throw new Error('DocumentSOMProcessor requires SPARQL storage configuration');
        }
        
        this.sparqlHelper = new SPARQLHelper(storageConfig.options.update, {
            auth: { 
                user: storageConfig.options.user, 
                password: storageConfig.options.password 
            },
            timeout: 30000
        });
        this.queryService = new SPARQLQueryService();
    }

    async findCorpuscles(targetGraph, limit = 0) {
        try {
            const query = `
                SELECT ?corpuscle ?corpuscleLabel ?sourceChunk ?concepts ?conceptLabels ?embedding WHERE {
                    GRAPH <${targetGraph}> {
                        ?corpuscle a ragno:Corpuscle ;
                                   rdfs:label ?corpuscleLabel ;
                                   prov:wasDerivedFrom ?sourceChunk .
                        
                        # Get the embedding from the source chunk
                        ?sourceChunk ragno:embedding ?embedding .
                        
                        # Only process corpuscles that haven't been clustered yet
                        FILTER NOT EXISTS {
                            ?corpuscle ragno:cluster ?cluster .
                        }
                        
                        # Get concepts in this corpuscle
                        {
                            SELECT ?corpuscle (COUNT(?concept) AS ?concepts) 
                                   (GROUP_CONCAT(?conceptLabel; separator="|") AS ?conceptLabels) WHERE {
                                ?corpuscle skos:member ?concept .
                                ?concept a ragno:Unit ;
                                         rdfs:label ?conceptLabel .
                            }
                            GROUP BY ?corpuscle
                        }
                        
                        # Only process corpuscles with at least 2 concepts
                        FILTER (?concepts >= 2)
                    }
                }
                ORDER BY DESC(?concepts) ?corpuscle
                ${limit > 0 ? `LIMIT ${limit}` : ''}
            `;
            
            // Add prefixes and execute using SPARQLHelper
            const prefixes = this.queryService.getDefaultPrefixes();
            const fullQuery = prefixes + query;
            
            const result = await this.sparqlHelper.executeSelect(fullQuery);
            
            if (result.success) {
                return result.data.results?.bindings || [];
            } else {
                logger.error(`SPARQL query failed: ${result.error}`);
                return [];
            }
        } catch (error) {
            logger.error(`Error finding corpuscles: ${error.message}`);
            return [];
        }
    }

    async prepareCorpusclesWithEmbeddings(corpuscles, targetGraph) {
        logger.info(`Preparing ${corpuscles.length} corpuscles with actual embeddings`);
        
        const preparedCorpuscles = [];
        
        for (const corpuscle of corpuscles) {
            // Safely parse concepts
            const conceptLabelsValue = corpuscle.conceptLabels?.value || '';
            const concepts = conceptLabelsValue ? conceptLabelsValue.split('|').filter(c => c.trim()) : [];
            
            // Parse the embedding from the source chunk
            const embeddingString = corpuscle.embedding?.value || '';
            if (!embeddingString) {
                logger.warn(`No embedding found for corpuscle ${corpuscle.corpuscle.value}, skipping`);
                continue;
            }
            
            const embedding = embeddingString.split(',').map(v => parseFloat(v.trim()));
            
            // Validate embedding
            if (embedding.some(v => isNaN(v))) {
                logger.warn(`Invalid embedding for corpuscle ${corpuscle.corpuscle.value}, skipping`);
                continue;
            }
            
            const corpuscleData = {
                uri: corpuscle.corpuscle?.value || '',
                label: corpuscle.corpuscleLabel?.value || '',
                sourceChunk: corpuscle.sourceChunk?.value || '',
                concepts: concepts.map(c => c.toLowerCase().trim()),
                conceptCount: parseInt(corpuscle.concepts?.value || '0'),
                embedding: embedding
            };
            
            // Calculate some basic concept statistics for metadata
            const conceptCounts = {};
            corpuscleData.concepts.forEach(concept => {
                conceptCounts[concept] = (conceptCounts[concept] || 0) + 1;
            });
            
            let entropy = 0;
            const totalConcepts = corpuscleData.concepts.length;
            for (const count of Object.values(conceptCounts)) {
                const p = count / totalConcepts;
                if (p > 0) {
                    entropy -= p * Math.log2(p);
                }
            }
            const maxEntropy = Math.log2(Object.keys(conceptCounts).length);
            const normalizedEntropy = (maxEntropy > 0 && !isNaN(entropy)) ? entropy / maxEntropy : 0;
            
            const totalConceptLength = corpuscleData.concepts.reduce((sum, c) => sum + (c.length || 0), 0);
            const avgConceptLength = corpuscleData.concepts.length > 0 ? totalConceptLength / corpuscleData.concepts.length : 0;
            const uniqueConceptRatio = corpuscleData.concepts.length > 0 ? Object.keys(conceptCounts).length / corpuscleData.concepts.length : 0;
            
            // Create Entity for VSOM processing
            const entity = new Entity({
                uri: corpuscleData.uri,
                name: corpuscleData.label,
                content: (corpuscleData.concepts && corpuscleData.concepts.length > 0) ? corpuscleData.concepts.join(', ') : corpuscleData.label,
                subType: 'corpuscle',
                metadata: {
                    sourceChunk: corpuscleData.sourceChunk,
                    conceptCount: corpuscleData.conceptCount,
                    conceptDiversity: isNaN(normalizedEntropy) ? 0 : normalizedEntropy,
                    avgConceptLength: isNaN(avgConceptLength) ? 0 : avgConceptLength,
                    uniqueConceptRatio: isNaN(uniqueConceptRatio) ? 0 : uniqueConceptRatio
                }
            });
            
            preparedCorpuscles.push({
                entity: entity,
                embedding: embedding,
                originalData: corpuscleData
            });
        }
        
        logger.info(`Prepared ${preparedCorpuscles.length} corpuscles with ${preparedCorpuscles[0]?.embedding.length || 0}-dimensional embeddings`);
        return { preparedCorpuscles, embeddingDimension: preparedCorpuscles[0]?.embedding.length || 0 };
    }

    async performSOMClustering(preparedCorpuscles, mapSize) {
        logger.info(`Training SOM with ${mapSize[0]}x${mapSize[1]} map`);
        
        // Temporarily set debug level for embedding lookup debugging
        const originalLevel = logger.getLevel();
        logger.setLevel('debug');
        
        const embeddingDimension = preparedCorpuscles[0]?.embedding.length || 1536;
        
        // Configure VSOM for embedding-based clustering
        const vsomConfig = {
            mapSize: mapSize,
            topology: 'hexagonal',
            boundaryCondition: 'bounded',
            embeddingDimension: embeddingDimension,
            distanceMetric: 'cosine', // Better for semantic embeddings
            maxIterations: 300,
            initialLearningRate: 0.1,
            finalLearningRate: 0.01,
            initialRadius: Math.max(mapSize[0], mapSize[1]) / 4,
            finalRadius: 0.5,
            clusterThreshold: 0.7, // Lower threshold for embedding similarity
            minClusterSize: 2,
            batchSize: 50,
            logProgress: false
        };
        
        const vsom = new VSOM(vsomConfig);
        
        // Create a lookup map for faster embedding retrieval
        const embeddingMap = new Map();
        preparedCorpuscles.forEach((pc, i) => {
            // Index by all possible text that VSOM might pass
            embeddingMap.set(pc.entity.content, pc.embedding);  // concepts joined with ', '
            embeddingMap.set(pc.entity.uri, pc.embedding);      // entity URI
            embeddingMap.set(pc.entity.name, pc.embedding);     // entity name (corpuscle label)
            embeddingMap.set(pc.originalData.label, pc.embedding); // original corpuscle label
            
            if (i < 3) { // Log first few for debugging
                logger.debug(`Entity ${i} indexed with keys:`);
                logger.debug(`  content: "${(pc.entity.content || '').substring(0, 50)}..."`);
                logger.debug(`  name: "${(pc.entity.name || 'undefined').substring(0, 50)}"`);
                logger.debug(`  label: "${(pc.originalData.label || 'undefined').substring(0, 50)}"`);
            }
        });
        
        // Create an embedding handler that uses the actual stored embeddings
        const embeddingHandler = {
            generateEmbedding: async (text) => {
                const safeText = text || '';
                logger.debug(`VSOM requesting embedding for: "${safeText.substring(0, 100)}..."`);
                
                // Try direct lookup first
                let embedding = embeddingMap.get(text);
                if (embedding) {
                    logger.debug(`Found embedding via direct lookup`);
                    return embedding;
                }
                
                // Try fuzzy matching by finding corpuscle with matching properties
                const match = preparedCorpuscles.find(pc => 
                    pc.entity.content === text || 
                    pc.entity.uri === text ||
                    pc.entity.name === text ||
                    pc.originalData.label === text ||
                    pc.originalData.concepts.join(', ') === text
                );
                
                if (match) {
                    logger.debug(`Found embedding via fuzzy matching`);
                    return match.embedding;
                }
                
                // Log the actual text being requested for debugging
                logger.warn(`No embedding found for text: "${safeText.substring(0, 100)}..."`);
                logger.debug(`Available entity contents:`);
                preparedCorpuscles.slice(0, 3).forEach((pc, i) => {
                    const content = (pc.entity.content || '');
                    logger.debug(`  ${i}: "${content.substring(0, 50)}..."`);
                });
                
                // Fallback: return zero vector
                return new Array(embeddingDimension).fill(0);
            }
        };
        
        // Load entities into VSOM
        const entities = preparedCorpuscles.map(pc => pc.entity);
        const loadResults = await vsom.loadFromEntities(entities, embeddingHandler);
        logger.info(`Loaded ${loadResults.entitiesLoaded} entities in ${loadResults.loadTime}ms`);
        
        // Train the VSOM
        const trainingResults = await vsom.train({
            onIteration: (iteration, results) => {
                if (iteration % 50 === 0) {
                    logger.debug(`SOM iteration ${iteration}: QE=${results.quantizationError?.toFixed(6) || 'N/A'}`);
                }
            }
        });
        
        logger.info(`Training completed: ${trainingResults.totalIterations} iterations, ` +
                   `${trainingResults.trainingTime}ms, ` +
                   `QE=${trainingResults.finalQuantizationError?.toFixed(6) || 'N/A'}`);
        
        // Generate clusters
        const clusters = vsom.getClusters();
        const nodeMappings = vsom.getNodeMappings();
        
        logger.info(`Generated ${clusters.length} clusters`);
        
        // Restore original log level
        logger.setLevel(originalLevel);
        
        return { vsom, clusters, nodeMappings, trainingResults };
    }

    analyzeClusterQuality(clusters, nodeMappings, preparedCorpuscles) {
        logger.info('Analyzing cluster quality');
        
        const clusterStats = {
            totalClusters: clusters.length,
            totalCorpuscles: preparedCorpuscles.length,
            clusteredCorpuscles: 0,
            avgClusterSize: 0,
            maxClusterSize: 0,
            minClusterSize: Infinity,
            conceptOverlap: [],
            clusterDetails: []
        };
        
        // Group corpuscles by cluster
        const corpusclesByCluster = new Map();
        
        for (let i = 0; i < preparedCorpuscles.length; i++) {
            const mapping = nodeMappings[i];
            const clusterIndex = this.findEntityCluster(mapping.nodeIndex, clusters);
            
            if (clusterIndex !== -1) {
                if (!corpusclesByCluster.has(clusterIndex)) {
                    corpusclesByCluster.set(clusterIndex, []);
                }
                corpusclesByCluster.get(clusterIndex).push({
                    corpuscle: preparedCorpuscles[i],
                    distance: mapping.distance
                });
                clusterStats.clusteredCorpuscles++;
            }
        }
        
        // Analyze each cluster
        for (const [clusterIndex, clusterCorpuscles] of corpusclesByCluster.entries()) {
            const cluster = clusters[clusterIndex];
            const size = clusterCorpuscles.length;
            
            clusterStats.maxClusterSize = Math.max(clusterStats.maxClusterSize, size);
            clusterStats.minClusterSize = Math.min(clusterStats.minClusterSize, size);
            
            // Calculate concept overlap within cluster
            const allConcepts = [];
            clusterCorpuscles.forEach(cc => {
                allConcepts.push(...cc.corpuscle.originalData.concepts);
            });
            
            const conceptCounts = {};
            allConcepts.forEach(concept => {
                conceptCounts[concept] = (conceptCounts[concept] || 0) + 1;
            });
            
            const sharedConcepts = Object.entries(conceptCounts)
                .filter(([concept, count]) => count > 1)
                .length;
            
            const totalUniqueConcepts = Object.keys(conceptCounts).length;
            const overlapRatio = totalUniqueConcepts > 0 ? sharedConcepts / totalUniqueConcepts : 0;
            
            clusterStats.clusterDetails.push({
                index: clusterIndex,
                size: size,
                avgDistance: size > 0 ? clusterCorpuscles.reduce((sum, cc) => sum + (isNaN(cc.distance) ? 0 : cc.distance), 0) / size : 0,
                conceptOverlapRatio: overlapRatio,
                sharedConcepts: sharedConcepts,
                totalConcepts: totalUniqueConcepts,
                concepts: Object.keys(conceptCounts).slice(0, 10) // Top 10 concepts
            });
        }
        
        clusterStats.avgClusterSize = clusterStats.totalClusters > 0 ? clusterStats.clusteredCorpuscles / clusterStats.totalClusters : 0;
        if (clusterStats.minClusterSize === Infinity) clusterStats.minClusterSize = 0;
        
        logger.info(`Cluster analysis: ${clusterStats.totalClusters} clusters, ` +
                   `${clusterStats.clusteredCorpuscles}/${clusterStats.totalCorpuscles} corpuscles clustered, ` +
                   `avg size: ${clusterStats.avgClusterSize.toFixed(1)}`);
        
        return clusterStats;
    }

    findEntityCluster(nodeIndex, clusters) {
        for (let i = 0; i < clusters.length; i++) {
            if (clusters[i].members.includes(nodeIndex)) {
                return i;
            }
        }
        return -1;
    }

    async storeSOMResults(vsom, clusters, nodeMappings, preparedCorpuscles, clusterStats, targetGraph) {
        logger.info('Storing SOM results to SPARQL');
        
        const dataset = rdf.dataset();
        const now = new Date().toISOString();
        
        // Export VSOM results to RDF
        const triplesAdded = vsom.exportToRDF(dataset);
        logger.info(`VSOM exported ${triplesAdded} triples to dataset`);
        
        // Additional triples for corpuscle cluster assignments
        const additionalTriples = [];
        
        // Create cluster assignment triples
        for (let i = 0; i < preparedCorpuscles.length; i++) {
            const mapping = nodeMappings[i];
            const clusterIndex = this.findEntityCluster(mapping.nodeIndex, clusters);
            const corpuscle = preparedCorpuscles[i];
            
            if (clusterIndex !== -1) {
                const cluster = clusters[clusterIndex];
                const clusterUri = URIMinter.mintURI('http://purl.org/stuff/instance/', 'som_cluster', clusterIndex.toString());
                const corpuscleUri = corpuscle.entity.uri;
                
                // Cluster assignment (with NaN protection)
                const clusterDistance = isNaN(mapping.distance) ? 0.0 : mapping.distance;
                additionalTriples.push(`<${corpuscleUri}> ragno:cluster <${clusterUri}> .`);
                additionalTriples.push(`<${corpuscleUri}> ragno:clusterDistance ${clusterDistance.toFixed(6)} .`);
                additionalTriples.push(`<${corpuscleUri}> ragno:clusterIndex ${clusterIndex} .`);
                
                // SOM position
                const nodeCoords = vsom.topology.indexToCoordinates(mapping.nodeIndex);
                if (nodeCoords) {
                    additionalTriples.push(`<${corpuscleUri}> ragno:somPosition "${nodeCoords[0]},${nodeCoords[1]}" .`);
                }
                
                // Feature metadata (with NaN protection)
                const metadata = corpuscle.entity.metadata || {};
                const conceptDiversity = isNaN(metadata.conceptDiversity) ? 0.0 : metadata.conceptDiversity;
                const avgConceptLength = isNaN(metadata.avgConceptLength) ? 0.0 : metadata.avgConceptLength;
                const uniqueConceptRatio = isNaN(metadata.uniqueConceptRatio) ? 0.0 : metadata.uniqueConceptRatio;
                
                additionalTriples.push(`<${corpuscleUri}> ragno:conceptDiversity ${conceptDiversity.toFixed(6)} .`);
                additionalTriples.push(`<${corpuscleUri}> ragno:avgConceptLength ${avgConceptLength.toFixed(2)} .`);
                additionalTriples.push(`<${corpuscleUri}> ragno:uniqueConceptRatio ${uniqueConceptRatio.toFixed(6)} .`);
            }
        }
        
        // Create cluster relationship triples (corpuscles in same cluster are related)
        const corpusclesByCluster = new Map();
        for (let i = 0; i < preparedCorpuscles.length; i++) {
            const mapping = nodeMappings[i];
            const clusterIndex = this.findEntityCluster(mapping.nodeIndex, clusters);
            if (clusterIndex !== -1) {
                if (!corpusclesByCluster.has(clusterIndex)) {
                    corpusclesByCluster.set(clusterIndex, []);
                }
                corpusclesByCluster.get(clusterIndex).push({
                    index: i,
                    corpuscle: preparedCorpuscles[i],
                    distance: mapping.distance
                });
            }
        }
        
        // Create pairwise relationships within clusters
        let relationshipCount = 0;
        for (const [clusterIndex, clusterCorpuscles] of corpusclesByCluster.entries()) {
            if (clusterCorpuscles.length > 1) {
                // Create relationships between all pairs in cluster
                for (let i = 0; i < clusterCorpuscles.length; i++) {
                    for (let j = i + 1; j < clusterCorpuscles.length; j++) {
                        const corp1 = clusterCorpuscles[i].corpuscle;
                        const corp2 = clusterCorpuscles[j].corpuscle;
                        
                        const relUri = URIMinter.mintURI('http://purl.org/stuff/instance/', 'som_rel', relationshipCount.toString());
                        
                        additionalTriples.push(`<${relUri}> a ragno:Relationship .`);
                        additionalTriples.push(`<${relUri}> ragno:hasSource <${corp1.entity.uri}> .`);
                        additionalTriples.push(`<${relUri}> ragno:hasTarget <${corp2.entity.uri}> .`);
                        additionalTriples.push(`<${relUri}> ragno:relationshipType "som-cluster-member" .`);
                        const dist1 = isNaN(clusterCorpuscles[i].distance) ? 0.0 : clusterCorpuscles[i].distance;
                        const dist2 = isNaN(clusterCorpuscles[j].distance) ? 0.0 : clusterCorpuscles[j].distance;
                        const weight = 1.0 / (1.0 + Math.abs(dist1 - dist2));
                        const safeWeight = isNaN(weight) ? 0.5 : weight;
                        additionalTriples.push(`<${relUri}> ragno:weight ${safeWeight.toFixed(6)} .`);
                        additionalTriples.push(`<${relUri}> ragno:clusterIndex ${clusterIndex} .`);
                        additionalTriples.push(`<${relUri}> dcterms:created "${now}"^^xsd:dateTime .`);
                        
                        relationshipCount++;
                    }
                }
            }
        }
        
        // Add global SOM metadata (with NaN protection)
        const somMetadataUri = URIMinter.mintURI('http://purl.org/stuff/instance/', 'som_analysis', Date.now().toString());
        const safeAvgClusterSize = isNaN(clusterStats.avgClusterSize) ? 0.0 : clusterStats.avgClusterSize;
        
        additionalTriples.push(`<${somMetadataUri}> a ragno:AnalysisResult .`);
        additionalTriples.push(`<${somMetadataUri}> ragno:analysisType "som-clustering" .`);
        additionalTriples.push(`<${somMetadataUri}> ragno:totalCorpuscles ${clusterStats.totalCorpuscles} .`);
        additionalTriples.push(`<${somMetadataUri}> ragno:totalClusters ${clusterStats.totalClusters} .`);
        additionalTriples.push(`<${somMetadataUri}> ragno:clusteredCorpuscles ${clusterStats.clusteredCorpuscles} .`);
        additionalTriples.push(`<${somMetadataUri}> ragno:avgClusterSize ${safeAvgClusterSize.toFixed(2)} .`);
        additionalTriples.push(`<${somMetadataUri}> ragno:relationshipsCreated ${relationshipCount} .`);
        additionalTriples.push(`<${somMetadataUri}> dcterms:created "${now}"^^xsd:dateTime .`);
        
        // Convert RDF dataset to triples and combine with additional triples
        const datasetTriples = [];
        for (const quad of dataset) {
            const subject = quad.subject.termType === 'NamedNode' ? `<${quad.subject.value}>` : `_:${quad.subject.value}`;
            const predicate = `<${quad.predicate.value}>`;
            const object = quad.object.termType === 'NamedNode' ? `<${quad.object.value}>` : 
                          quad.object.termType === 'Literal' ? `"${SPARQLHelper.escapeString(quad.object.value)}"` : 
                          `_:${quad.object.value}`;
            datasetTriples.push(`${subject} ${predicate} ${object} .`);
        }
        
        const allTriples = [...datasetTriples, ...additionalTriples];
        
        // Use SPARQLHelper to create and execute the INSERT DATA query
        const triplesText = allTriples.join('\n        ');
        const updateQuery = this.sparqlHelper.createInsertDataQuery(targetGraph, triplesText);
        
        const result = await this.sparqlHelper.executeUpdate(updateQuery);
        
        if (!result.success) {
            throw new Error(`Failed to store SOM results: ${result.error}`);
        }
        
        logger.info(`Stored ${allTriples.length} triples (${datasetTriples.length} from VSOM + ${additionalTriples.length} additional)`);
        
        return {
            triplesStored: allTriples.length,
            vsomTriples: datasetTriples.length,
            clusterTriples: additionalTriples.length,
            relationshipsCreated: relationshipCount,
            clustersCreated: clusterStats.totalClusters
        };
    }

    async run(options) {
        const { limit, graph, mapSize } = options;
        
        const targetGraph = graph || this.config.get('storage.options.graphName') || 
                            this.config.get('graphName') || 
                            'http://tensegrity.it/semem';
        
        logger.info(`Processing corpuscles in: ${targetGraph.split('/').pop()}`);
        
        // Step 1: Find corpuscles to cluster
        const corpuscles = await this.findCorpuscles(targetGraph, limit);
        logger.info(`Found ${corpuscles.length} corpuscles ready for clustering`);
        
        if (corpuscles.length === 0) {
            logger.info('No corpuscles need clustering');
            return { processed: 0 };
        }
        
        if (corpuscles.length < 2) {
            logger.info('Need at least 2 corpuscles for clustering');
            return { processed: 0 };
        }
        
        try {
            // Step 2: Prepare corpuscles with actual embeddings
            const { preparedCorpuscles, embeddingDimension } = await this.prepareCorpusclesWithEmbeddings(corpuscles, targetGraph);
            
            // Step 3: Perform SOM clustering
            const { vsom, clusters, nodeMappings, trainingResults } = await this.performSOMClustering(preparedCorpuscles, mapSize);
            
            // Step 4: Analyze cluster quality
            const clusterStats = this.analyzeClusterQuality(clusters, nodeMappings, preparedCorpuscles);
            
            // Step 5: Store results
            const storeResults = await this.storeSOMResults(vsom, clusters, nodeMappings, preparedCorpuscles, clusterStats, targetGraph);
            
            logger.info(`Summary: ${corpuscles.length} corpuscles → ${clusterStats.totalClusters} clusters, ${storeResults.relationshipsCreated} relationships`);
            
            return {
                processed: corpuscles.length,
                clusters: clusterStats.totalClusters,
                relationships: storeResults.relationshipsCreated,
                embeddingDimension: embeddingDimension,
                trainingResults: trainingResults,
                clusterStats: clusterStats,
                storeResults: storeResults
            };
            
        } catch (error) {
            logger.error(`❌ SOM clustering process failed: ${error.message}`);
            throw error;
        }
    }

    async cleanup() {
        // Close any open connections
        if (this.sparqlHelper && typeof this.sparqlHelper.close === 'function') {
            await this.sparqlHelper.close();
        }
        
        if (this.queryService && typeof this.queryService.cleanup === 'function') {
            await this.queryService.cleanup();
        }
    }
}

async function main() {
    // Set appropriate log level
    logger.setLevel(process.env.LOG_LEVEL || 'info');
    
    const { values: args } = parseArgs({
        options: {
            limit: {
                type: 'string',
                default: '0'
            },
            graph: {
                type: 'string'
            },
            'map-size': {
                type: 'string',
                default: '10x10'
            },
            help: {
                type: 'boolean',
                short: 'h'
            }
        }
    });

    if (args.help) {
        console.log(`
SOM.js - Apply Self-Organizing Map clustering to document corpuscles

Usage: node examples/document/SOM.js [options]

Options:
  --limit <number>     Maximum number of corpuscles to process (default: 0, no limit)
  --graph <uri>        Target graph URI (default: from config)
  --map-size <WxH>     SOM map dimensions (default: 10x10)
  --help, -h           Show this help message

Description:
  This script finds ragno:Corpuscle instances created by ExtractConcepts.js, 
  extracts concept-based features (TF-IDF, diversity, structural), applies VSOM
  clustering, and stores cluster assignments and relationships in SPARQL.
  
  Creates cluster-based features without using LLM or embedding tools.
  
  Prerequisites:
  - Corpuscles must exist (ExtractConcepts.js)
  - At least 2 corpuscles with 2+ concepts each

Examples:
  node examples/document/SOM.js                                    # Process all corpuscles
  node examples/document/SOM.js --limit 20 --map-size 8x8         # Process 20 corpuscles, 8x8 map
  node examples/document/SOM.js --graph "http://example.org/docs" # Use specific graph
        `);
        return;
    }

    // Parse map size
    const mapSizeStr = args['map-size'] || '10x10';
    const mapSizeMatch = mapSizeStr.match(/^(\d+)x(\d+)$/);
    if (!mapSizeMatch) {
        logger.error('Invalid map size format. Use WIDTHxHEIGHT (e.g., 10x10)');
        process.exit(1);
    }
    const mapSize = [parseInt(mapSizeMatch[1]), parseInt(mapSizeMatch[2])];

    logger.info('Starting Document SOM Clustering');

    const processor = new DocumentSOMProcessor();
    
    try {
        await processor.init();
        
        const options = {
            limit: parseInt(args.limit) || 0,
            graph: args.graph,
            mapSize: mapSize
        };
        
        const results = await processor.run(options);
        
        if (results.processed > 0) {
            logger.info('SOM clustering completed successfully');
            logger.info(`Results: ${results.processed} corpuscles processed, ` +
                       `${results.clusters} clusters created, ` +
                       `${results.relationships} relationships established`);
        } else {
            logger.info('No corpuscles were processed');
        }
        
    } catch (error) {
        logger.error('\n❌ Document SOM clustering failed:', error.message);
        logger.error('Stack:', error.stack);
        
        logger.info('\nTroubleshooting:');
        logger.info('- Ensure SPARQL endpoint is running and accessible');
        logger.info('- Check that ExtractConcepts.js has been run');
        logger.info('- Verify corpuscles exist with at least 2 concepts each');
        logger.info('- Ensure at least 2 corpuscles exist for clustering');
        
        process.exit(1);
    } finally {
        // Always cleanup, even if there was an error
        await processor.cleanup();
        
        // Force exit after a short delay to ensure cleanup completes
        setTimeout(() => {
            process.exit(0);
        }, 100);
    }
}

if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(error => {
        logger.error('Fatal error:', error);
        process.exit(1);
    });
}

export default DocumentSOMProcessor;