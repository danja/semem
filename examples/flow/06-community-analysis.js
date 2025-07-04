#!/usr/bin/env node

/**
 * Flow Stage 6: Community Analysis
 * 
 * Detect communities using Leiden algorithm with Flow components.
 * Maps to: community detection in the original workflow
 * 
 * Usage: node examples/flow/06-community-analysis.js [--limit N] [--resolution R]
 */

import path from 'path';
import logger from 'loglevel';
import chalk from 'chalk';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Import Flow components
import Config from '../../src/Config.js';
import SPARQLHelper from '../../src/services/sparql/SPARQLHelper.js';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// Configure logging
logger.setLevel('info');

/**
 * Display header
 */
function displayHeader() {
    console.log('');
    console.log(chalk.bold.magenta('╔══════════════════════════════════════════════════════════════╗'));
    console.log(chalk.bold.magenta('║') + chalk.bold.white('           🏘️  FLOW STAGE 6: COMMUNITY ANALYSIS              ') + chalk.bold.magenta('║'));
    console.log(chalk.bold.magenta('║') + chalk.gray('         Detect communities using Leiden algorithm           ') + chalk.bold.magenta('║'));
    console.log(chalk.bold.magenta('╚══════════════════════════════════════════════════════════════╝'));
    console.log('');
}

/**
 * Parse command line arguments
 */
function parseArgs() {
    const args = process.argv.slice(2);
    const options = { 
        limit: null,
        resolution: 1.0,
        minCommunitySize: 2
    };
    
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        switch (arg) {
            case '--limit':
                options.limit = parseInt(args[++i], 10);
                break;
            case '--resolution':
                options.resolution = parseFloat(args[++i]);
                break;
            case '--min-size':
                options.minCommunitySize = parseInt(args[++i], 10);
                break;
            case '--help':
            case '-h':
                console.log(chalk.bold.white('Usage: node 06-community-analysis.js [options]'));
                console.log('');
                console.log(chalk.white('Options:'));
                console.log('  --limit N       Limit number of corpuscles to process (default: all)');
                console.log('  --resolution R  Resolution parameter for community detection (default: 1.0)');
                console.log('  --min-size N    Minimum community size (default: 2)');
                console.log('  --help, -h      Show this help');
                console.log('');
                process.exit(0);
                break;
        }
    }
    
    return options;
}

/**
 * Retrieve graph data for community analysis
 */
async function retrieveGraphData(sparqlHelper, config, limit) {
    console.log(chalk.cyan('📖 Retrieving graph data for community analysis...'));
    
    // Get corpuscles with ranking scores and embeddings (distinct corpuscles only)
    const corpuscleQuery = `
PREFIX ragno: <http://purl.org/stuff/ragno/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

SELECT DISTINCT ?corpuscle ?label ?type (MAX(?ranking) AS ?maxRanking) ?embedding
WHERE {
    {
        GRAPH <${config.beerqaGraphURI}> {
            ?corpuscle a ragno:Corpuscle ;
                       rdfs:label ?label ;
                       ragno:corpuscleType ?type .
            
            OPTIONAL {
                ?corpuscle ragno:hasAttribute ?rankAttr .
                ?rankAttr ragno:attributeType ?rankType ;
                         ragno:attributeValue ?ranking .
                FILTER(STRSTARTS(?rankType, "ranking-"))
            }
            
            OPTIONAL {
                ?corpuscle ragno:hasAttribute ?embAttr .
                ?embAttr ragno:attributeType "embedding" ;
                        ragno:attributeValue ?embedding .
            }
        }
    }
    UNION
    {
        GRAPH <${config.wikipediaGraphURI}> {
            ?corpuscle a ragno:Corpuscle ;
                       rdfs:label ?label ;
                       ragno:corpuscleType ?type .
            
            OPTIONAL {
                ?corpuscle ragno:hasAttribute ?rankAttr .
                ?rankAttr ragno:attributeType ?rankType ;
                         ragno:attributeValue ?ranking .
                FILTER(STRSTARTS(?rankType, "ranking-"))
            }
            
            OPTIONAL {
                ?corpuscle ragno:hasAttribute ?embAttr .
                ?embAttr ragno:attributeType "embedding" ;
                        ragno:attributeValue ?embedding .
            }
        }
    }
}
GROUP BY ?corpuscle ?label ?type ?embedding
${limit ? `LIMIT ${limit}` : ''}`;

    const corpuscleResult = await sparqlHelper.executeSelect(corpuscleQuery);
    
    // Get relationships for edges
    const relationshipQuery = `
PREFIX ragno: <http://purl.org/stuff/ragno/>

SELECT ?relationship ?subject ?object ?confidence ?sourceCorpuscle
WHERE {
    GRAPH <${config.beerqaGraphURI}> {
        ?relationship a ragno:Relationship ;
                      ragno:subject ?subject ;
                      ragno:object ?object ;
                      ragno:confidence ?confidence ;
                      ragno:sourceCorpuscle ?sourceCorpuscle .
    }
}`;

    const relationshipResult = await sparqlHelper.executeSelect(relationshipQuery);
    
    if (corpuscleResult.success && relationshipResult.success) {
        const corpuscles = corpuscleResult.data.results.bindings.map(binding => ({
            uri: binding.corpuscle.value,
            label: binding.label.value,
            type: binding.type.value,
            ranking: binding.maxRanking ? parseFloat(binding.maxRanking.value) : 0.0,
            embedding: binding.embedding ? binding.embedding.value.split(',').map(x => parseFloat(x)) : null
        }));
        
        const relationships = relationshipResult.data.results.bindings.map(binding => ({
            uri: binding.relationship.value,
            subject: binding.subject.value,
            object: binding.object.value,
            confidence: parseFloat(binding.confidence.value),
            sourceCorpuscle: binding.sourceCorpuscle.value
        }));
        
        console.log(chalk.green(`   ✓ Found ${corpuscles.length} corpuscles and ${relationships.length} relationships`));
        return { corpuscles, relationships };
    } else {
        console.log(chalk.yellow('   ⚠️  No graph data found for community analysis'));
        return { corpuscles: [], relationships: [] };
    }
}

/**
 * Calculate cosine similarity between two vectors
 */
function cosineSimilarity(vecA, vecB) {
    if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
    
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < vecA.length; i++) {
        dotProduct += vecA[i] * vecB[i];
        normA += vecA[i] * vecA[i];
        normB += vecB[i] * vecB[i];
    }
    
    const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
    return magnitude === 0 ? 0 : dotProduct / magnitude;
}

/**
 * Build adjacency matrix using embedding-based similarity
 */
function buildAdjacencyMatrix(corpuscles, relationships) {
    console.log(chalk.cyan('🔗 Building adjacency matrix using embedding similarity...'));
    
    const n = corpuscles.length;
    const adjacencyMatrix = Array(n).fill().map(() => Array(n).fill(0));
    let edgesCreated = 0;
    
    // Count how many corpuscles have embeddings
    const corpusclesWithEmbeddings = corpuscles.filter(c => c.embedding !== null);
    console.log(chalk.gray(`   → Found ${corpusclesWithEmbeddings.length}/${n} corpuscles with embeddings`));
    
    if (corpusclesWithEmbeddings.length < 2) {
        console.log(chalk.yellow('   ⚠️  Insufficient embeddings, falling back to relationship-based connections'));
        return buildRelationshipBasedMatrix(corpuscles, relationships);
    }
    
    // Build adjacency matrix using embedding similarity
    const similarityThreshold = 0.3; // Minimum similarity to create an edge
    console.log(chalk.gray(`   → Building adjacency matrix using cosine similarity (threshold: ${similarityThreshold})`));
    
    for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
            if (corpuscles[i].embedding && corpuscles[j].embedding) {
                const similarity = cosineSimilarity(corpuscles[i].embedding, corpuscles[j].embedding);
                
                if (similarity > similarityThreshold) {
                    adjacencyMatrix[i][j] = similarity;
                    adjacencyMatrix[j][i] = similarity;
                    edgesCreated++;
                }
            }
        }
    }
    
    console.log(chalk.green(`   ✓ Adjacency matrix built with ${edgesCreated} embedding-based edges`));
    
    // Add relationship-based edges as bonus connections
    console.log(chalk.gray('   → Adding relationship-based edge weights using string matching...'));
    let relationshipEdges = 0;
    
    const corpuscleIndex = new Map();
    corpuscles.forEach((corpuscle, index) => {
        corpuscleIndex.set(corpuscle.uri, index);
    });
    
    relationships.forEach(rel => {
        const sourceIndex = corpuscleIndex.get(rel.sourceCorpuscle);
        
        corpuscles.forEach((corpuscle, targetIndex) => {
            if (sourceIndex !== undefined && sourceIndex !== targetIndex) {
                // String matching as secondary signal
                if (corpuscle.label.toLowerCase().includes(rel.subject.toLowerCase()) ||
                    corpuscle.label.toLowerCase().includes(rel.object.toLowerCase())) {
                    // Add relationship strength to existing embedding-based connection
                    const relationshipWeight = rel.confidence * 0.2; // Lower weight than embeddings
                    adjacencyMatrix[sourceIndex][targetIndex] += relationshipWeight;
                    adjacencyMatrix[targetIndex][sourceIndex] += relationshipWeight;
                    relationshipEdges++;
                }
            }
        });
    });
    
    console.log(chalk.gray(`   → Added ${relationshipEdges} relationship-based edge weights from ${relationships.length} relationships`));
    
    // Log connectivity statistics
    const connectedNodes = adjacencyMatrix.map((row, i) => 
        row.some((weight, j) => i !== j && weight > 0) ? 1 : 0
    ).reduce((sum, connected) => sum + connected, 0);
    
    console.log(chalk.gray(`   → Connected nodes: ${connectedNodes}/${n}`));
    
    return adjacencyMatrix;
}

/**
 * Fallback: Build adjacency matrix from relationships using string matching
 */
function buildRelationshipBasedMatrix(corpuscles, relationships) {
    console.log(chalk.yellow('   ⚠️  Using string matching for adjacency matrix (no embeddings available)'));
    
    const corpuscleIndex = new Map();
    corpuscles.forEach((corpuscle, index) => {
        corpuscleIndex.set(corpuscle.uri, index);
    });
    
    const n = corpuscles.length;
    const adjacencyMatrix = Array(n).fill().map(() => Array(n).fill(0));
    let edgesCreated = 0;
    
    // Build matrix from relationships using string matching
    relationships.forEach(rel => {
        const sourceIndex = corpuscleIndex.get(rel.sourceCorpuscle);
        
        corpuscles.forEach((corpuscle, targetIndex) => {
            if (sourceIndex !== undefined && sourceIndex !== targetIndex) {
                if (corpuscle.label.toLowerCase().includes(rel.subject.toLowerCase()) ||
                    corpuscle.label.toLowerCase().includes(rel.object.toLowerCase())) {
                    const weight = rel.confidence;
                    const currentWeight = adjacencyMatrix[sourceIndex][targetIndex];
                    if (currentWeight === 0) {
                        edgesCreated++;
                    }
                    adjacencyMatrix[sourceIndex][targetIndex] = Math.max(currentWeight, weight);
                    adjacencyMatrix[targetIndex][sourceIndex] = Math.max(
                        adjacencyMatrix[targetIndex][sourceIndex], 
                        weight
                    );
                }
            }
        });
    });
    
    console.log(chalk.green(`   ✓ Adjacency matrix built with ${edgesCreated} relationship-based edges`));
    return adjacencyMatrix;
}

/**
 * Simplified Leiden algorithm implementation
 */
function detectCommunities(corpuscles, adjacencyMatrix, resolution = 1.0, minCommunitySize = 2) {
    console.log(chalk.cyan('🏘️  Detecting communities with Leiden algorithm...'));
    
    const n = corpuscles.length;
    let communities = Array.from({ length: n }, (_, i) => i); // Initially each node is its own community
    let improved = true;
    let iteration = 0;
    const maxIterations = 50;
    
    while (improved && iteration < maxIterations) {
        improved = false;
        iteration++;
        
        // Local move phase
        for (let i = 0; i < n; i++) {
            const currentCommunity = communities[i];
            let bestCommunity = currentCommunity;
            let bestModularityGain = 0;
            
            // Try moving node i to neighboring communities
            const neighborCommunities = new Set();
            for (let j = 0; j < n; j++) {
                if (i !== j && adjacencyMatrix[i][j] > 0) {
                    neighborCommunities.add(communities[j]);
                }
            }
            
            for (const community of neighborCommunities) {
                if (community !== currentCommunity) {
                    const modularityGain = calculateModularityGain(i, community, communities, adjacencyMatrix, resolution);
                    if (modularityGain > bestModularityGain) {
                        bestModularityGain = modularityGain;
                        bestCommunity = community;
                    }
                }
            }
            
            if (bestCommunity !== currentCommunity) {
                communities[i] = bestCommunity;
                improved = true;
            }
        }
        
        console.log(chalk.gray(`   Iteration ${iteration}: ${getUniqueCommunities(communities).length} communities`));
    }
    
    // Filter out small communities
    const communityGroups = groupByCommunity(corpuscles, communities);
    const filteredCommunities = communityGroups.filter(group => group.members.length >= minCommunitySize);
    
    console.log(chalk.green(`   ✓ Found ${filteredCommunities.length} communities (min size: ${minCommunitySize})`));
    return filteredCommunities;
}

/**
 * Calculate modularity gain for moving a node to a community
 */
function calculateModularityGain(nodeIndex, targetCommunity, communities, adjacencyMatrix, resolution) {
    const n = adjacencyMatrix.length;
    let gain = 0;
    
    // Calculate gain based on connections to target community
    for (let j = 0; j < n; j++) {
        if (communities[j] === targetCommunity && j !== nodeIndex) {
            gain += adjacencyMatrix[nodeIndex][j] * resolution;
        }
    }
    
    // Calculate loss from current community
    const currentCommunity = communities[nodeIndex];
    for (let j = 0; j < n; j++) {
        if (communities[j] === currentCommunity && j !== nodeIndex) {
            gain -= adjacencyMatrix[nodeIndex][j] * resolution;
        }
    }
    
    return gain;
}

/**
 * Get unique communities
 */
function getUniqueCommunities(communities) {
    return [...new Set(communities)];
}

/**
 * Group corpuscles by community
 */
function groupByCommunity(corpuscles, communities) {
    const communityMap = new Map();
    
    corpuscles.forEach((corpuscle, index) => {
        const communityId = communities[index];
        if (!communityMap.has(communityId)) {
            communityMap.set(communityId, {
                id: communityId,
                members: []
            });
        }
        communityMap.get(communityId).members.push({
            ...corpuscle,
            index: index
        });
    });
    
    return Array.from(communityMap.values());
}

/**
 * Store community assignments in the knowledge graph
 */
async function storeCommunityAssignments(communities, sparqlHelper, config) {
    console.log(chalk.cyan('💾 Storing community assignments...'));
    
    const timestamp = new Date().toISOString();
    const triples = [];
    
    communities.forEach((community, communityIndex) => {
        const communityURI = `${config.beerqaGraphURI}/community/${Date.now()}_${communityIndex}`;
        
        // Community metadata
        triples.push(`<${communityURI}> a ragno:Community ;`);
        triples.push(`    rdfs:label "Community ${communityIndex + 1}" ;`);
        triples.push(`    ragno:communityId "${communityIndex}" ;`);
        triples.push(`    ragno:memberCount ${community.members.length} ;`);
        triples.push(`    dcterms:created "${timestamp}"^^xsd:dateTime .`);
        
        // Assign members to community
        community.members.forEach(member => {
            const membershipURI = `${member.uri}/membership/community_${communityIndex}`;
            
            triples.push(`<${member.uri}> ragno:belongsToCommunity <${communityURI}> .`);
            triples.push(`<${member.uri}> ragno:hasAttribute <${membershipURI}> .`);
            triples.push(`<${membershipURI}> a ragno:Attribute ;`);
            triples.push(`    ragno:attributeType "community-membership" ;`);
            triples.push(`    ragno:attributeValue "${communityIndex}" ;`);
            triples.push(`    ragno:communityURI <${communityURI}> ;`);
            triples.push(`    dcterms:created "${timestamp}"^^xsd:dateTime .`);
            
            // Flow stage tracking
            const flowAttrURI = `${member.uri}/attr/flow_stage_06`;
            triples.push(`<${member.uri}> ragno:hasAttribute <${flowAttrURI}> .`);
            triples.push(`<${flowAttrURI}> a ragno:Attribute ;`);
            triples.push(`    ragno:attributeType "flow-stage" ;`);
            triples.push(`    ragno:attributeValue "06-community-analysis" ;`);
            triples.push(`    dcterms:created "${timestamp}"^^xsd:dateTime .`);
        });
    });
    
    if (triples.length > 0) {
        const insertQuery = `
PREFIX ragno: <http://purl.org/stuff/ragno/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX dcterms: <http://purl.org/dc/terms/>
PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>

INSERT DATA {
    GRAPH <${config.beerqaGraphURI}> {
        ${triples.join('\n        ')}
    }
}`;

        const result = await sparqlHelper.executeUpdate(insertQuery);
        
        if (result.success) {
            console.log(chalk.green(`   ✅ Stored community assignments for ${communities.length} communities`));
        } else {
            throw new Error(`Failed to store community assignments: ${result.error}`);
        }
    }
}

/**
 * Display community analysis results
 */
function displayCommunities(communities) {
    console.log(chalk.cyan('🏘️  Community Analysis Results:'));
    console.log('');
    
    communities.forEach((community, index) => {
        console.log(chalk.bold.white(`Community ${index + 1} (${community.members.length} members):`));
        
        // Sort members by ranking score if available
        const sortedMembers = community.members.sort((a, b) => (b.ranking || 0) - (a.ranking || 0));
        
        sortedMembers.slice(0, 5).forEach(member => {
            const truncatedLabel = member.label.length > 50 ? 
                member.label.substring(0, 50) + '...' : member.label;
            console.log(`   ${chalk.cyan('•')} ${chalk.white(truncatedLabel)}`);
            console.log(`     ${chalk.gray('Type:')} ${chalk.white(member.type)} ${chalk.gray('Ranking:')} ${chalk.white((member.ranking || 0).toFixed(4))}`);
        });
        
        if (community.members.length > 5) {
            console.log(`   ${chalk.gray(`... and ${community.members.length - 5} more members`)}`);
        }
        console.log('');
    });
}

/**
 * Display completion summary
 */
function displaySummary(communities, corpusclesCount, duration, options) {
    console.log('');
    console.log(chalk.bold.yellow('📊 Stage 6 Completion Summary:'));
    console.log(chalk.white(`   Total corpuscles: ${corpusclesCount}`));
    console.log(chalk.white(`   Communities detected: ${communities.length}`));
    console.log(chalk.white(`   Resolution parameter: ${options.resolution}`));
    console.log(chalk.white(`   Minimum community size: ${options.minCommunitySize}`));
    console.log(chalk.white(`   Processing time: ${(duration / 1000).toFixed(1)}s`));
    
    if (communities.length > 0) {
        const avgCommunitySize = communities.reduce((sum, c) => sum + c.members.length, 0) / communities.length;
        console.log(chalk.white(`   Average community size: ${avgCommunitySize.toFixed(1)}`));
        
        const largestCommunity = Math.max(...communities.map(c => c.members.length));
        console.log(chalk.white(`   Largest community: ${largestCommunity} members`));
    }
    
    console.log('');
    console.log(chalk.gray('Next Step: Stage 7 - ZPT Navigation enhancement'));
    console.log(chalk.gray('Command: node examples/flow/07-zpt-navigation.js'));
    console.log('');
}

/**
 * Main execution function
 */
async function main() {
    try {
        const startTime = Date.now();
        
        displayHeader();
        
        const args = parseArgs();
        
        // Initialize configuration
        console.log(chalk.cyan('🔧 Initializing configuration...'));
        const config = new Config('./config/config.json');
        await config.init();
        
        const workflowConfig = {
            beerqaGraphURI: 'http://purl.org/stuff/beerqa/test',
            wikipediaGraphURI: 'http://purl.org/stuff/wikipedia/research',
            wikidataGraphURI: 'http://purl.org/stuff/wikidata/research'
        };
        
        console.log(chalk.green('   ✓ Configuration loaded'));
        
        // Initialize SPARQL helper
        const sparqlHelper = new SPARQLHelper(
            config.get('sparqlUpdateEndpoint') || 'http://localhost:3030/semem/update',
            {
                auth: config.get('sparqlAuth') || { user: 'admin', password: 'admin123' },
                timeout: 30000
            }
        );
        
        console.log(chalk.green('   ✓ Components initialized'));
        
        // Retrieve graph data
        const { corpuscles, relationships } = await retrieveGraphData(sparqlHelper, workflowConfig, args.limit);
        
        if (corpuscles.length === 0) {
            console.log(chalk.yellow('⚠️  No corpuscles found for community analysis. Run Stages 1-5 first.'));
            return;
        }
        
        // Build adjacency matrix
        const adjacencyMatrix = buildAdjacencyMatrix(corpuscles, relationships);
        
        // Detect communities
        const communities = detectCommunities(corpuscles, adjacencyMatrix, args.resolution, args.minCommunitySize);
        
        if (communities.length === 0) {
            console.log(chalk.yellow('⚠️  No communities detected with current parameters.'));
            return;
        }
        
        // Store community assignments
        await storeCommunityAssignments(communities, sparqlHelper, workflowConfig);
        
        // Display results
        displayCommunities(communities);
        
        // Display summary
        const duration = Date.now() - startTime;
        displaySummary(communities, corpuscles.length, duration, args);
        
        console.log(chalk.bold.green('🎉 Stage 6: Community analysis completed successfully!'));
        console.log('');
        
    } catch (error) {
        console.error(chalk.red('❌ Stage 6 failed:'), error.message);
        process.exit(1);
    }
}

// Handle uncaught errors
process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});

// Run the example
if (import.meta.url === `file://${process.argv[1]}`) {
    main();
}