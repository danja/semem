#!/usr/bin/env node

/**
 * Flow Stage 7: ZPT Navigation
 * 
 * Semantic navigation enhancement using ZPT (Zoom-Pan-Tilt) with Flow components.
 * Maps to: semantic navigation and exploration in the original workflow
 * 
 * Usage: node examples/flow/07-zpt-navigation.js [--limit N] [--zoom LEVEL]
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
    console.log(chalk.bold.cyan('╔══════════════════════════════════════════════════════════════╗'));
    console.log(chalk.bold.cyan('║') + chalk.bold.white('            🧭 FLOW STAGE 7: ZPT NAVIGATION                  ') + chalk.bold.cyan('║'));
    console.log(chalk.bold.cyan('║') + chalk.gray('         Semantic navigation enhancement with ZPT            ') + chalk.bold.cyan('║'));
    console.log(chalk.bold.cyan('╚══════════════════════════════════════════════════════════════╝'));
    console.log('');
}

/**
 * Parse command line arguments
 */
function parseArgs() {
    const args = process.argv.slice(2);
    const options = { 
        limit: null,
        zoom: 'entity',
        tilt: 'keywords',
        pan: {}
    };
    
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        switch (arg) {
            case '--limit':
                options.limit = parseInt(args[++i], 10);
                break;
            case '--zoom':
                options.zoom = args[++i];
                break;
            case '--tilt':
                options.tilt = args[++i];
                break;
            case '--help':
            case '-h':
                console.log(chalk.bold.white('Usage: node 07-zpt-navigation.js [options]'));
                console.log('');
                console.log(chalk.white('Options:'));
                console.log('  --limit N       Limit number of items to process (default: all)');
                console.log('  --zoom LEVEL    Zoom level: entity, unit, text, community, corpus (default: entity)');
                console.log('  --tilt STYLE    Representation style: keywords, embedding, graph, temporal (default: keywords)');
                console.log('  --help, -h      Show this help');
                console.log('');
                console.log(chalk.white('ZPT Navigation Concepts:'));
                console.log('  Zoom: Level of abstraction (entity → unit → text → community → corpus)');
                console.log('  Pan: Content filtering and selection criteria');
                console.log('  Tilt: Representation and visualization style');
                console.log('');
                process.exit(0);
                break;
        }
    }
    
    return options;
}

/**
 * Retrieve navigation data based on zoom level
 */
async function retrieveNavigationData(sparqlHelper, config, zoom, limit) {
    console.log(chalk.cyan(`🔍 Retrieving navigation data (zoom: ${zoom})...`));
    
    let query;
    
    switch (zoom) {
        case 'entity':
            query = `
PREFIX ragno: <http://purl.org/stuff/ragno/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

SELECT ?item ?label ?type ?ranking ?community
WHERE {
    {
        GRAPH <${config.beerqaGraphURI}> {
            ?item a ragno:Entity ;
                  rdfs:label ?label .
            BIND("entity" AS ?type)
            
            OPTIONAL {
                ?item ragno:hasAttribute ?rankAttr .
                ?rankAttr ragno:attributeType ?rankType ;
                         ragno:attributeValue ?ranking .
                FILTER(STRSTARTS(?rankType, "ranking-"))
            }
            
            OPTIONAL {
                ?item ragno:hasAttribute ?commAttr .
                ?commAttr ragno:attributeType "community-membership" ;
                         ragno:attributeValue ?community .
            }
        }
    }
    UNION
    {
        GRAPH <${config.wikipediaGraphURI}> {
            ?item a ragno:Entity ;
                  rdfs:label ?label .
            BIND("wikipedia-entity" AS ?type)
        }
    }
}
${limit ? `LIMIT ${limit}` : ''}`;
            break;
            
        case 'unit':
            query = `
PREFIX ragno: <http://purl.org/stuff/ragno/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

SELECT ?item ?label ?type ?ranking ?community
WHERE {
    GRAPH <${config.wikipediaGraphURI}> {
        ?item a ragno:Unit ;
              rdfs:label ?label ;
              ragno:unitType ?type .
        
        OPTIONAL {
            ?item ragno:hasAttribute ?rankAttr .
            ?rankAttr ragno:attributeType ?rankType ;
                     ragno:attributeValue ?ranking .
            FILTER(STRSTARTS(?rankType, "ranking-"))
        }
    }
}
${limit ? `LIMIT ${limit}` : ''}`;
            break;
            
        case 'community':
            query = `
PREFIX ragno: <http://purl.org/stuff/ragno/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

SELECT ?item ?label ?type ?memberCount
WHERE {
    GRAPH <${config.beerqaGraphURI}> {
        ?item a ragno:Community ;
              rdfs:label ?label ;
              ragno:memberCount ?memberCount .
        BIND("community" AS ?type)
    }
}
${limit ? `LIMIT ${limit}` : ''}`;
            break;
            
        case 'text':
        case 'corpus':
        default:
            query = `
PREFIX ragno: <http://purl.org/stuff/ragno/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

SELECT ?item ?label ?type ?ranking ?community
WHERE {
    {
        GRAPH <${config.beerqaGraphURI}> {
            ?item a ragno:Corpuscle ;
                  rdfs:label ?label ;
                  ragno:corpuscleType ?type .
            
            OPTIONAL {
                ?item ragno:hasAttribute ?rankAttr .
                ?rankAttr ragno:attributeType ?rankType ;
                         ragno:attributeValue ?ranking .
                FILTER(STRSTARTS(?rankType, "ranking-"))
            }
            
            OPTIONAL {
                ?item ragno:hasAttribute ?commAttr .
                ?commAttr ragno:attributeType "community-membership" ;
                         ragno:attributeValue ?community .
            }
        }
    }
    UNION
    {
        GRAPH <${config.wikipediaGraphURI}> {
            ?item a ragno:Corpuscle ;
                  rdfs:label ?label ;
                  ragno:corpuscleType ?type .
        }
    }
}
${limit ? `LIMIT ${limit}` : ''}`;
            break;
    }
    
    const result = await sparqlHelper.executeSelect(query);
    
    if (result.success && result.data.results.bindings.length > 0) {
        const items = result.data.results.bindings.map(binding => ({
            uri: binding.item.value,
            label: binding.label.value,
            type: binding.type.value,
            ranking: binding.ranking ? parseFloat(binding.ranking.value) : 0.0,
            community: binding.community ? binding.community.value : null,
            memberCount: binding.memberCount ? parseInt(binding.memberCount.value) : null
        }));
        
        console.log(chalk.green(`   ✓ Found ${items.length} items at ${zoom} level`));
        return items;
    } else {
        console.log(chalk.yellow(`   ⚠️  No items found at ${zoom} level`));
        return [];
    }
}

/**
 * Apply tilt representation to navigation data
 */
function applyTiltRepresentation(items, tilt) {
    console.log(chalk.cyan(`🎭 Applying ${tilt} representation...`));
    
    const representations = [];
    
    switch (tilt) {
        case 'keywords':
            items.forEach(item => {
                // Extract keywords from labels
                const keywords = extractKeywords(item.label);
                representations.push({
                    ...item,
                    representation: keywords,
                    representationType: 'keywords'
                });
            });
            break;
            
        case 'embedding':
            items.forEach(item => {
                // Placeholder for embedding representation
                representations.push({
                    ...item,
                    representation: `[Embedding vector for: ${item.label.substring(0, 30)}...]`,
                    representationType: 'embedding'
                });
            });
            break;
            
        case 'graph':
            items.forEach(item => {
                // Graph-based representation
                representations.push({
                    ...item,
                    representation: {
                        nodeId: item.uri,
                        nodeLabel: item.label,
                        nodeType: item.type,
                        centrality: item.ranking || 0.0,
                        community: item.community
                    },
                    representationType: 'graph'
                });
            });
            break;
            
        case 'temporal':
            items.forEach(item => {
                // Temporal representation (placeholder)
                representations.push({
                    ...item,
                    representation: {
                        timeframe: 'recent',
                        relevance: item.ranking || 0.0,
                        sequence: items.indexOf(item)
                    },
                    representationType: 'temporal'
                });
            });
            break;
            
        default:
            console.log(chalk.yellow(`   ⚠️  Unknown tilt: ${tilt}, using keywords`));
            return applyTiltRepresentation(items, 'keywords');
    }
    
    console.log(chalk.green(`   ✓ Applied ${tilt} representation to ${representations.length} items`));
    return representations;
}

/**
 * Extract keywords from text
 */
function extractKeywords(text) {
    // Simple keyword extraction
    const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should']);
    
    const words = text.toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter(word => word.length > 2 && !stopWords.has(word));
    
    // Get unique words and limit to top 5
    const uniqueWords = [...new Set(words)];
    return uniqueWords.slice(0, 5);
}

/**
 * Apply pan filtering to navigation data
 */
function applyPanFiltering(representations, panOptions) {
    console.log(chalk.cyan('🔍 Applying pan filtering...'));
    
    let filtered = [...representations];
    
    // Filter by type if specified
    if (panOptions.type) {
        filtered = filtered.filter(item => item.type === panOptions.type);
    }
    
    // Filter by ranking threshold if specified
    if (panOptions.minRanking) {
        filtered = filtered.filter(item => (item.ranking || 0) >= panOptions.minRanking);
    }
    
    // Filter by community if specified
    if (panOptions.community) {
        filtered = filtered.filter(item => item.community === panOptions.community);
    }
    
    // Sort by ranking if available
    filtered.sort((a, b) => (b.ranking || 0) - (a.ranking || 0));
    
    console.log(chalk.green(`   ✓ Filtered to ${filtered.length} items`));
    return filtered;
}

/**
 * Store navigation metadata
 */
async function storeNavigationMetadata(representations, zoom, tilt, sparqlHelper, config) {
    console.log(chalk.cyan('💾 Storing navigation metadata...'));
    
    const timestamp = new Date().toISOString();
    const navigationSessionURI = `${config.beerqaGraphURI}/navigation/${Date.now()}`;
    const triples = [];
    
    // Navigation session metadata
    triples.push(`<${navigationSessionURI}> a ragno:NavigationSession ;`);
    triples.push(`    rdfs:label "ZPT Navigation Session" ;`);
    triples.push(`    ragno:zoomLevel "${zoom}" ;`);
    triples.push(`    ragno:tiltStyle "${tilt}" ;`);
    triples.push(`    ragno:itemCount ${representations.length} ;`);
    triples.push(`    dcterms:created "${timestamp}"^^xsd:dateTime .`);
    
    // Add navigation attributes to items
    representations.forEach((item, index) => {
        const navAttrURI = `${item.uri}/attr/navigation_${Date.now()}`;
        
        triples.push(`<${item.uri}> ragno:hasAttribute <${navAttrURI}> .`);
        triples.push(`<${navAttrURI}> a ragno:Attribute ;`);
        triples.push(`    ragno:attributeType "zpt-navigation" ;`);
        triples.push(`    ragno:attributeValue "${JSON.stringify({zoom, tilt, index}).replace(/"/g, '\\"')}" ;`);
        triples.push(`    ragno:navigationSession <${navigationSessionURI}> ;`);
        triples.push(`    dcterms:created "${timestamp}"^^xsd:dateTime .`);
        
        // Flow stage tracking
        const flowAttrURI = `${item.uri}/attr/flow_stage_07`;
        triples.push(`<${item.uri}> ragno:hasAttribute <${flowAttrURI}> .`);
        triples.push(`<${flowAttrURI}> a ragno:Attribute ;`);
        triples.push(`    ragno:attributeType "flow-stage" ;`);
        triples.push(`    ragno:attributeValue "07-zpt-navigation" ;`);
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
            console.log(chalk.green(`   ✅ Stored navigation metadata for ${representations.length} items`));
        } else {
            throw new Error(`Failed to store navigation metadata: ${result.error}`);
        }
    }
}

/**
 * Display navigation results
 */
function displayNavigationResults(representations, zoom, tilt) {
    console.log(chalk.cyan(`🧭 ZPT Navigation Results (${zoom}/${tilt}):`));
    console.log('');
    
    const topItems = representations.slice(0, 10);
    
    topItems.forEach((item, index) => {
        console.log(chalk.bold.white(`${index + 1}. ${item.label.substring(0, 60)}${item.label.length > 60 ? '...' : ''}`));
        console.log(`   ${chalk.gray('Type:')} ${chalk.white(item.type)} ${chalk.gray('Ranking:')} ${chalk.white((item.ranking || 0).toFixed(4))}`);
        
        if (item.community) {
            console.log(`   ${chalk.gray('Community:')} ${chalk.white(item.community)}`);
        }
        
        if (item.representationType === 'keywords') {
            console.log(`   ${chalk.gray('Keywords:')} ${chalk.white(item.representation.join(', '))}`);
        } else if (item.representationType === 'graph') {
            console.log(`   ${chalk.gray('Centrality:')} ${chalk.white(item.representation.centrality.toFixed(4))}`);
        }
        
        console.log('');
    });
    
    if (representations.length > 10) {
        console.log(chalk.gray(`... and ${representations.length - 10} more items`));
        console.log('');
    }
}

/**
 * Display completion summary
 */
function displaySummary(representations, zoom, tilt, duration) {
    console.log('');
    console.log(chalk.bold.yellow('📊 Stage 7 Completion Summary:'));
    console.log(chalk.white(`   Navigation items: ${representations.length}`));
    console.log(chalk.white(`   Zoom level: ${zoom}`));
    console.log(chalk.white(`   Tilt style: ${tilt}`));
    console.log(chalk.white(`   Processing time: ${(duration / 1000).toFixed(1)}s`));
    
    if (representations.length > 0) {
        const avgRanking = representations.reduce((sum, item) => sum + (item.ranking || 0), 0) / representations.length;
        console.log(chalk.white(`   Average ranking: ${avgRanking.toFixed(4)}`));
        
        const typeDistribution = representations.reduce((acc, item) => {
            acc[item.type] = (acc[item.type] || 0) + 1;
            return acc;
        }, {});
        
        console.log(chalk.white(`   Type distribution:`));
        Object.entries(typeDistribution).forEach(([type, count]) => {
            console.log(chalk.white(`     ${type}: ${count}`));
        });
    }
    
    console.log('');
    console.log(chalk.gray('Next Step: Stage 8 - Wikidata research'));
    console.log(chalk.gray('Command: node examples/flow/08-wikidata-research.js'));
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
        
        // Retrieve navigation data
        const items = await retrieveNavigationData(sparqlHelper, workflowConfig, args.zoom, args.limit);
        
        if (items.length === 0) {
            console.log(chalk.yellow('⚠️  No items found for navigation. Run previous stages first.'));
            return;
        }
        
        // Apply tilt representation
        const representations = applyTiltRepresentation(items, args.tilt);
        
        // Apply pan filtering
        const filteredRepresentations = applyPanFiltering(representations, args.pan);
        
        if (filteredRepresentations.length === 0) {
            console.log(chalk.yellow('⚠️  No items remain after filtering.'));
            return;
        }
        
        // Store navigation metadata
        await storeNavigationMetadata(filteredRepresentations, args.zoom, args.tilt, sparqlHelper, workflowConfig);
        
        // Display results
        displayNavigationResults(filteredRepresentations, args.zoom, args.tilt);
        
        // Display summary
        const duration = Date.now() - startTime;
        displaySummary(filteredRepresentations, args.zoom, args.tilt, duration);
        
        console.log(chalk.bold.green('🎉 Stage 7: ZPT Navigation completed successfully!'));
        console.log('');
        
    } catch (error) {
        console.error(chalk.red('❌ Stage 7 failed:'), error.message);
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