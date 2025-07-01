#!/usr/bin/env node

/**
 * Flow Stage 5: Rank Corpuscles
 * 
 * Analyze graph structure and rank corpuscles by importance using Flow components.
 * Maps to: graph analysis and ranking in the original workflow
 * 
 * Usage: node examples/flow/05-rank-corpuscles.js [--limit N] [--algorithm ALGO]
 */

import path from 'path';
import logger from 'loglevel';
import chalk from 'chalk';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Import Flow components
import Config from '../../src/Config.js';
import SPARQLHelper from '../beerqa/SPARQLHelper.js';

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
    console.log(chalk.bold.blue('╔══════════════════════════════════════════════════════════════╗'));
    console.log(chalk.bold.blue('║') + chalk.bold.white('             📊 FLOW STAGE 5: RANK CORPUSCLES                ') + chalk.bold.blue('║'));
    console.log(chalk.bold.blue('║') + chalk.gray('         Analyze graph structure and rank importance          ') + chalk.bold.blue('║'));
    console.log(chalk.bold.blue('╚══════════════════════════════════════════════════════════════╝'));
    console.log('');
}

/**
 * Parse command line arguments
 */
function parseArgs() {
    const args = process.argv.slice(2);
    const options = { 
        limit: null,
        algorithm: 'pagerank'
    };
    
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        switch (arg) {
            case '--limit':
                options.limit = parseInt(args[++i], 10);
                break;
            case '--algorithm':
                options.algorithm = args[++i];
                break;
            case '--help':
            case '-h':
                console.log(chalk.bold.white('Usage: node 05-rank-corpuscles.js [options]'));
                console.log('');
                console.log(chalk.white('Options:'));
                console.log('  --limit N       Limit number of corpuscles to process (default: all)');
                console.log('  --algorithm A   Ranking algorithm: pagerank, degree, betweenness (default: pagerank)');
                console.log('  --help, -h      Show this help');
                console.log('');
                process.exit(0);
                break;
        }
    }
    
    return options;
}

/**
 * Retrieve corpuscles and relationships for ranking
 */
async function retrieveGraphData(sparqlHelper, config, limit) {
    console.log(chalk.cyan('📖 Retrieving graph data for ranking...'));
    
    // Get corpuscles
    const corpuscleQuery = `
PREFIX ragno: <http://purl.org/stuff/ragno/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

SELECT ?corpuscle ?label ?type
WHERE {
    {
        GRAPH <${config.beerqaGraphURI}> {
            ?corpuscle a ragno:Corpuscle ;
                       rdfs:label ?label ;
                       ragno:corpuscleType ?type .
        }
    }
    UNION
    {
        GRAPH <${config.wikipediaGraphURI}> {
            ?corpuscle a ragno:Corpuscle ;
                       rdfs:label ?label ;
                       ragno:corpuscleType ?type .
        }
    }
}
${limit ? `LIMIT ${limit}` : ''}`;

    const corpuscleResult = await sparqlHelper.executeSelect(corpuscleQuery);
    
    // Get relationships
    const relationshipQuery = `
PREFIX ragno: <http://purl.org/stuff/ragno/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

SELECT ?relationship ?subject ?predicate ?object ?confidence ?sourceCorpuscle
WHERE {
    GRAPH <${config.beerqaGraphURI}> {
        ?relationship a ragno:Relationship ;
                      ragno:subject ?subject ;
                      ragno:predicate ?predicate ;
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
            type: binding.type.value
        }));
        
        const relationships = relationshipResult.data.results.bindings.map(binding => ({
            uri: binding.relationship.value,
            subject: binding.subject.value,
            predicate: binding.predicate.value,
            object: binding.object.value,
            confidence: parseFloat(binding.confidence.value),
            sourceCorpuscle: binding.sourceCorpuscle.value
        }));
        
        console.log(chalk.green(`   ✓ Found ${corpuscles.length} corpuscles and ${relationships.length} relationships`));
        return { corpuscles, relationships };
    } else {
        console.log(chalk.yellow('   ⚠️  No graph data found for ranking'));
        return { corpuscles: [], relationships: [] };
    }
}

/**
 * Calculate PageRank scores for corpuscles
 */
function calculatePageRank(corpuscles, relationships, iterations = 20, dampingFactor = 0.85) {
    console.log(chalk.cyan('🧮 Calculating PageRank scores...'));
    
    // Build adjacency matrix
    const corpuscleIndex = new Map();
    corpuscles.forEach((corpuscle, index) => {
        corpuscleIndex.set(corpuscle.uri, index);
    });
    
    const n = corpuscles.length;
    const adjacencyMatrix = Array(n).fill().map(() => Array(n).fill(0));
    const outDegree = Array(n).fill(0);
    
    // Build matrix from relationships
    relationships.forEach(rel => {
        const sourceIndex = corpuscleIndex.get(rel.sourceCorpuscle);
        // Find corpuscles that contain the subject and object entities
        corpuscles.forEach((corpuscle, targetIndex) => {
            if (sourceIndex !== undefined && sourceIndex !== targetIndex) {
                // Simple heuristic: if corpuscle label contains entity, create link
                if (corpuscle.label.toLowerCase().includes(rel.subject.toLowerCase()) ||
                    corpuscle.label.toLowerCase().includes(rel.object.toLowerCase())) {
                    adjacencyMatrix[sourceIndex][targetIndex] = rel.confidence;
                    outDegree[sourceIndex]++;
                }
            }
        });
    });
    
    // Normalize adjacency matrix
    for (let i = 0; i < n; i++) {
        if (outDegree[i] > 0) {
            for (let j = 0; j < n; j++) {
                adjacencyMatrix[i][j] /= outDegree[i];
            }
        }
    }
    
    // Initialize PageRank scores
    let scores = Array(n).fill(1.0 / n);
    
    // Iterate PageRank algorithm
    for (let iter = 0; iter < iterations; iter++) {
        const newScores = Array(n).fill((1 - dampingFactor) / n);
        
        for (let i = 0; i < n; i++) {
            for (let j = 0; j < n; j++) {
                if (adjacencyMatrix[j][i] > 0) {
                    newScores[i] += dampingFactor * scores[j] * adjacencyMatrix[j][i];
                }
            }
        }
        
        scores = newScores;
    }
    
    console.log(chalk.green(`   ✓ PageRank calculation completed (${iterations} iterations)`));
    return scores;
}

/**
 * Calculate degree centrality scores
 */
function calculateDegreeCentrality(corpuscles, relationships) {
    console.log(chalk.cyan('🧮 Calculating degree centrality...'));
    
    const degreeMap = new Map();
    corpuscles.forEach(corpuscle => {
        degreeMap.set(corpuscle.uri, 0);
    });
    
    // Count connections for each corpuscle
    relationships.forEach(rel => {
        const sourceCorpuscle = rel.sourceCorpuscle;
        if (degreeMap.has(sourceCorpuscle)) {
            degreeMap.set(sourceCorpuscle, degreeMap.get(sourceCorpuscle) + 1);
        }
        
        // Also count corpuscles that contain the entities
        corpuscles.forEach(corpuscle => {
            if (corpuscle.label.toLowerCase().includes(rel.subject.toLowerCase()) ||
                corpuscle.label.toLowerCase().includes(rel.object.toLowerCase())) {
                degreeMap.set(corpuscle.uri, degreeMap.get(corpuscle.uri) + 0.5);
            }
        });
    });
    
    const maxDegree = Math.max(...degreeMap.values());
    const scores = corpuscles.map(corpuscle => 
        maxDegree > 0 ? degreeMap.get(corpuscle.uri) / maxDegree : 0
    );
    
    console.log(chalk.green('   ✓ Degree centrality calculation completed'));
    return scores;
}

/**
 * Calculate ranking scores using specified algorithm
 */
function calculateRankingScores(corpuscles, relationships, algorithm) {
    switch (algorithm) {
        case 'pagerank':
            return calculatePageRank(corpuscles, relationships);
        case 'degree':
            return calculateDegreeCentrality(corpuscles, relationships);
        case 'betweenness':
            // Simplified betweenness - just use degree for now
            console.log(chalk.yellow('   ⚠️  Using degree centrality as betweenness approximation'));
            return calculateDegreeCentrality(corpuscles, relationships);
        default:
            console.log(chalk.yellow(`   ⚠️  Unknown algorithm ${algorithm}, using PageRank`));
            return calculatePageRank(corpuscles, relationships);
    }
}

/**
 * Store ranking scores in the knowledge graph
 */
async function storeRankingScores(corpuscles, scores, algorithm, sparqlHelper, config) {
    console.log(chalk.cyan('💾 Storing ranking scores...'));
    
    const timestamp = new Date().toISOString();
    const triples = [];
    
    corpuscles.forEach((corpuscle, index) => {
        const score = scores[index];
        const rankingAttrURI = `${corpuscle.uri}/attr/ranking_${algorithm}`;
        
        triples.push(`<${corpuscle.uri}> ragno:hasAttribute <${rankingAttrURI}> .`);
        triples.push(`<${rankingAttrURI}> a ragno:Attribute ;`);
        triples.push(`    ragno:attributeType "ranking-${algorithm}" ;`);
        triples.push(`    ragno:attributeValue "${score.toFixed(6)}" ;`);
        triples.push(`    ragno:rankingAlgorithm "${algorithm}" ;`);
        triples.push(`    dcterms:created "${timestamp}"^^xsd:dateTime .`);
        
        // Flow stage tracking
        const flowAttrURI = `${corpuscle.uri}/attr/flow_stage_05`;
        triples.push(`<${corpuscle.uri}> ragno:hasAttribute <${flowAttrURI}> .`);
        triples.push(`<${flowAttrURI}> a ragno:Attribute ;`);
        triples.push(`    ragno:attributeType "flow-stage" ;`);
        triples.push(`    ragno:attributeValue "05-rank-corpuscles" ;`);
        triples.push(`    dcterms:created "${timestamp}"^^xsd:dateTime .`);
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
            console.log(chalk.green(`   ✅ Stored ranking scores for ${corpuscles.length} corpuscles`));
        } else {
            throw new Error(`Failed to store ranking scores: ${result.error}`);
        }
    }
}

/**
 * Display top-ranked corpuscles
 */
function displayTopRanked(corpuscles, scores, algorithm, topN = 10) {
    console.log(chalk.cyan(`🏆 Top ${topN} Ranked Corpuscles (${algorithm}):`));
    
    // Create array of corpuscles with scores and sort by score
    const rankedCorpuscles = corpuscles.map((corpuscle, index) => ({
        ...corpuscle,
        score: scores[index]
    })).sort((a, b) => b.score - a.score);
    
    for (let i = 0; i < Math.min(topN, rankedCorpuscles.length); i++) {
        const corpuscle = rankedCorpuscles[i];
        console.log(`   ${chalk.bold.yellow(`${i + 1}.`)} ${chalk.white(corpuscle.label.substring(0, 60))}${corpuscle.label.length > 60 ? '...' : ''}`);
        console.log(`      ${chalk.gray('Score:')} ${chalk.white(corpuscle.score.toFixed(6))} ${chalk.gray('Type:')} ${chalk.white(corpuscle.type)}`);
    }
    console.log('');
}

/**
 * Display completion summary
 */
function displaySummary(corpuscles, relationships, algorithm, duration) {
    console.log('');
    console.log(chalk.bold.yellow('📊 Stage 5 Completion Summary:'));
    console.log(chalk.white(`   Corpuscles ranked: ${corpuscles.length}`));
    console.log(chalk.white(`   Relationships analyzed: ${relationships.length}`));
    console.log(chalk.white(`   Ranking algorithm: ${algorithm}`));
    console.log(chalk.white(`   Processing time: ${(duration / 1000).toFixed(1)}s`));
    console.log('');
    console.log(chalk.gray('Next Step: Stage 6 - Community analysis'));
    console.log(chalk.gray('Command: node examples/flow/06-community-analysis.js'));
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
            console.log(chalk.yellow('⚠️  No corpuscles found for ranking. Run Stages 1-4 first.'));
            return;
        }
        
        // Calculate ranking scores
        const scores = calculateRankingScores(corpuscles, relationships, args.algorithm);
        
        // Store ranking scores
        await storeRankingScores(corpuscles, scores, args.algorithm, sparqlHelper, workflowConfig);
        
        // Display top-ranked corpuscles
        displayTopRanked(corpuscles, scores, args.algorithm);
        
        // Display summary
        const duration = Date.now() - startTime;
        displaySummary(corpuscles, relationships, args.algorithm, duration);
        
        console.log(chalk.bold.green('🎉 Stage 5: Corpuscle ranking completed successfully!'));
        console.log('');
        
    } catch (error) {
        console.error(chalk.red('❌ Stage 5 failed:'), error.message);
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