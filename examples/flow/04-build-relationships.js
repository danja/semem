#!/usr/bin/env node

/**
 * Flow Stage 4: Build Relationships
 * 
 * Create formal relationship infrastructure between entities using Flow components.
 * Maps to: relationship detection and graph building in the original workflow
 * 
 * Usage: node examples/flow/04-build-relationships.js [--limit N]
 */

import path from 'path';
import logger from 'loglevel';
import chalk from 'chalk';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Import Flow components
import Config from '../../src/Config.js';
import LLMHandler from '../../src/handlers/LLMHandler.js';
import OllamaConnector from '../../src/connectors/OllamaConnector.js';
import ClaudeConnector from '../../src/connectors/ClaudeConnector.js';
import MistralConnector from '../../src/connectors/MistralConnector.js';
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
    console.log(chalk.bold.green('╔══════════════════════════════════════════════════════════════╗'));
    console.log(chalk.bold.green('║') + chalk.bold.white('           🔗 FLOW STAGE 4: BUILD RELATIONSHIPS              ') + chalk.bold.green('║'));
    console.log(chalk.bold.green('║') + chalk.gray('       Create formal relationship infrastructure             ') + chalk.bold.green('║'));
    console.log(chalk.bold.green('╚══════════════════════════════════════════════════════════════╝'));
    console.log('');
}

/**
 * Parse command line arguments
 */
function parseArgs() {
    const args = process.argv.slice(2);
    const options = { limit: null };
    
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        switch (arg) {
            case '--limit':
                options.limit = parseInt(args[++i], 10);
                break;
            case '--help':
            case '-h':
                console.log(chalk.bold.white('Usage: node 04-build-relationships.js [options]'));
                console.log('');
                console.log(chalk.white('Options:'));
                console.log('  --limit N       Limit number of corpuscles to process (default: all)');
                console.log('  --help, -h      Show this help');
                console.log('');
                process.exit(0);
                break;
        }
    }
    
    return options;
}

/**
 * Initialize LLM handler with proper Flow patterns
 */
async function initializeLLMHandler(config) {
    console.log(chalk.cyan('🔧 Initializing LLM handler...'));

    const llmProviders = config.get('llmProviders') || [];
    const chatProvider = llmProviders
        .filter(p => p.capabilities?.includes('chat'))
        .sort((a, b) => (a.priority || 999) - (b.priority || 999))[0];

    if (!chatProvider) {
        throw new Error('No chat LLM provider configured');
    }

    let llmConnector;
    if (chatProvider.type === 'mistral' && process.env.MISTRAL_API_KEY) {
        llmConnector = new MistralConnector(process.env.MISTRAL_API_KEY);
    } else if (chatProvider.type === 'claude' && process.env.CLAUDE_API_KEY) {
        llmConnector = new ClaudeConnector(process.env.CLAUDE_API_KEY);
    } else {
        llmConnector = new OllamaConnector('http://localhost:11434', 'qwen2:1.5b');
        chatProvider.chatModel = 'qwen2:1.5b';
    }

    const llmHandler = new LLMHandler(llmConnector, chatProvider.chatModel);
    
    // Extract rate limiting configuration
    const rateLimitDelay = chatProvider.rateLimit?.delayMs || 0;
    if (rateLimitDelay > 0) {
        console.log(chalk.yellow(`   ⏱️  Rate limiting: ${rateLimitDelay}ms delay between calls`));
    }
    
    console.log(chalk.green(`   ✅ LLM handler: ${chatProvider.type}`));
    return { llmHandler, rateLimitDelay, providerType: chatProvider.type };
}

/**
 * Retrieve corpuscles with entities for relationship building
 */
async function retrieveCorpusclesWithEntities(sparqlHelper, config, limit) {
    console.log(chalk.cyan('📖 Retrieving corpuscles with entities...'));
    
    const selectQuery = `
PREFIX ragno: <http://purl.org/stuff/ragno/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

SELECT ?corpuscle ?label ?entity ?entityLabel
WHERE {
    {
        GRAPH <${config.beerqaGraphURI}> {
            ?corpuscle a ragno:Corpuscle ;
                       rdfs:label ?label ;
                       ragno:hasAttribute ?conceptAttr .
            
            ?conceptAttr ragno:attributeType "concept" ;
                        ragno:attributeValue ?entity .
            
            BIND(?entity AS ?entityLabel)
        }
    }
    UNION
    {
        GRAPH <${config.wikipediaGraphURI}> {
            ?corpuscle a ragno:Corpuscle ;
                       rdfs:label ?label .
            ?entity ragno:belongsToCorpuscle ?corpuscle ;
                    rdfs:label ?entityLabel .
        }
    }
    
    # Only process corpuscles that haven't been processed for relationships yet
    MINUS {
        ?corpuscle ragno:hasAttribute ?attr .
        ?attr ragno:attributeType "flow-stage" ;
             ragno:attributeValue "04-build-relationships" .
    }
}
${limit ? `LIMIT ${limit * 10}` : ''}`;

    const result = await sparqlHelper.executeSelect(selectQuery);
    
    if (result.success && result.data.results.bindings.length > 0) {
        // Group entities by corpuscle
        const corpuscleMap = new Map();
        
        result.data.results.bindings.forEach(binding => {
            const corpuscleURI = binding.corpuscle.value;
            const entity = binding.entity.value;
            const entityLabel = binding.entityLabel.value;
            const label = binding.label.value;
            
            if (!corpuscleMap.has(corpuscleURI)) {
                corpuscleMap.set(corpuscleURI, {
                    uri: corpuscleURI,
                    label: label,
                    entities: []
                });
            }
            
            corpuscleMap.get(corpuscleURI).entities.push({
                value: entity,
                label: entityLabel
            });
        });
        
        const corpuscles = Array.from(corpuscleMap.values());
        const limitedCorpuscles = limit ? corpuscles.slice(0, limit) : corpuscles;
        
        console.log(chalk.green(`   ✓ Found ${limitedCorpuscles.length} corpuscles with entities for relationship building`));
        return limitedCorpuscles;
    } else {
        console.log(chalk.yellow('   ⚠️  No corpuscles with entities found for relationship building'));
        return [];
    }
}

/**
 * Build relationships between entities using LLM analysis
 */
async function buildRelationships(corpuscles, llmHandler, rateLimitDelay, providerType, sparqlHelper, config) {
    console.log(chalk.cyan('🔗 Building relationships between entities...'));
    
    const relationshipStats = {
        corpusclesProcessed: 0,
        relationshipsCreated: 0,
        errors: 0
    };
    
    const timestamp = new Date().toISOString();
    
    for (let i = 0; i < corpuscles.length; i++) {
        const corpuscle = corpuscles[i];
        
        console.log(chalk.white(`   Processing ${i + 1}/${corpuscles.length}: "${corpuscle.label.substring(0, 50)}..."`));
        console.log(chalk.gray(`      Entities: ${corpuscle.entities.map(e => e.label).join(', ')}`));
        
        try {
            // Only build relationships if we have multiple entities
            if (corpuscle.entities.length > 1) {
                const entityPairs = [];
                
                // Generate all pairs of entities
                for (let j = 0; j < corpuscle.entities.length; j++) {
                    for (let k = j + 1; k < corpuscle.entities.length; k++) {
                        entityPairs.push([corpuscle.entities[j], corpuscle.entities[k]]);
                    }
                }
                
                console.log(chalk.gray(`      Analyzing ${entityPairs.length} entity pairs for relationships`));
                
                for (const [entity1, entity2] of entityPairs) {
                    try {
                        // Apply rate limiting delay if configured
                        if (rateLimitDelay > 0) {
                            console.log(chalk.gray(`         ⏱️  Rate limit delay: ${rateLimitDelay}ms`));
                            await new Promise(resolve => setTimeout(resolve, rateLimitDelay));
                        }
                        
                        // Use LLM to determine relationship
                        const relationshipPrompt = `Analyze the relationship between "${entity1.label}" and "${entity2.label}" in the context: "${corpuscle.label}"

Return only a single relationship type from: related_to, causes, part_of, instance_of, similar_to, opposite_to, or none.`;

                        const relationshipType = await llmHandler.generateResponse(relationshipPrompt, '', { maxTokens: 50 });
                        
                        if (relationshipType && relationshipType.trim() !== 'none') {
                            await storeRelationship(entity1, entity2, relationshipType.trim(), corpuscle, sparqlHelper, config);
                            relationshipStats.relationshipsCreated++;
                            console.log(chalk.green(`         ✓ ${entity1.label} --${relationshipType.trim()}--> ${entity2.label}`));
                        }
                        
                    } catch (relationshipError) {
                        console.log(chalk.red(`         ❌ Relationship analysis failed: ${relationshipError.message}`));
                        relationshipStats.errors++;
                    }
                }
            }
            
            // Mark corpuscle as processed
            await markCorpuscleProcessed(corpuscle, sparqlHelper, config);
            relationshipStats.corpusclesProcessed++;
            
        } catch (error) {
            console.log(chalk.red(`      ❌ Corpuscle processing failed: ${error.message}`));
            relationshipStats.errors++;
        }
    }
    
    return relationshipStats;
}

/**
 * Store relationship in the knowledge graph
 */
async function storeRelationship(entity1, entity2, relationshipType, sourceCorpuscle, sparqlHelper, config) {
    const timestamp = new Date().toISOString();
    const relationshipURI = `${config.beerqaGraphURI}/relationship/${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const insertQuery = `
PREFIX ragno: <http://purl.org/stuff/ragno/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX dcterms: <http://purl.org/dc/terms/>
PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>

INSERT DATA {
    GRAPH <${config.beerqaGraphURI}> {
        <${relationshipURI}> a ragno:Relationship ;
            rdfs:label "${escapeRDFString(entity1.label + ' ' + relationshipType + ' ' + entity2.label)}" ;
            ragno:subject "${escapeRDFString(entity1.label)}" ;
            ragno:predicate "${escapeRDFString(relationshipType)}" ;
            ragno:object "${escapeRDFString(entity2.label)}" ;
            ragno:confidence "0.8"^^xsd:float ;
            ragno:sourceCorpuscle <${sourceCorpuscle.uri}> ;
            dcterms:created "${timestamp}"^^xsd:dateTime ;
            ragno:processingStage "relationship-built" .
        
        # Flow stage tracking
        <${relationshipURI}> ragno:hasAttribute <${relationshipURI}/attr/flow_stage> .
        <${relationshipURI}/attr/flow_stage> a ragno:Attribute ;
            ragno:attributeType "flow-stage" ;
            ragno:attributeValue "04-build-relationships" ;
            dcterms:created "${timestamp}"^^xsd:dateTime .
    }
}`;

    const result = await sparqlHelper.executeUpdate(insertQuery);
    
    if (!result.success) {
        throw new Error(`Failed to store relationship: ${result.error}`);
    }
}

/**
 * Mark corpuscle as processed for relationships
 */
async function markCorpuscleProcessed(corpuscle, sparqlHelper, config) {
    const timestamp = new Date().toISOString();
    const flowAttrURI = `${corpuscle.uri}/attr/flow_stage_04`;
    
    const insertQuery = `
PREFIX ragno: <http://purl.org/stuff/ragno/>
PREFIX dcterms: <http://purl.org/dc/terms/>
PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>

INSERT DATA {
    GRAPH <${config.beerqaGraphURI}> {
        <${corpuscle.uri}> ragno:hasAttribute <${flowAttrURI}> .
        <${flowAttrURI}> a ragno:Attribute ;
            ragno:attributeType "flow-stage" ;
            ragno:attributeValue "04-build-relationships" ;
            dcterms:created "${timestamp}"^^xsd:dateTime .
        
        <${corpuscle.uri}> ragno:processingStage "relationships-built" .
    }
}`;

    const result = await sparqlHelper.executeUpdate(insertQuery);
    
    if (!result.success) {
        throw new Error(`Failed to mark corpuscle as processed: ${result.error}`);
    }
}

/**
 * Escape special characters in RDF strings
 */
function escapeRDFString(str) {
    return str
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"')
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '\\r')
        .replace(/\t/g, '\\t');
}

/**
 * Display completion summary
 */
function displaySummary(relationshipStats, duration) {
    console.log('');
    console.log(chalk.bold.yellow('📊 Stage 4 Completion Summary:'));
    console.log(chalk.white(`   Corpuscles processed: ${relationshipStats.corpusclesProcessed}`));
    console.log(chalk.white(`   Relationships created: ${relationshipStats.relationshipsCreated}`));
    console.log(chalk.white(`   Processing errors: ${relationshipStats.errors}`));
    console.log(chalk.white(`   Processing time: ${(duration / 1000).toFixed(1)}s`));
    
    if (relationshipStats.corpusclesProcessed > 0) {
        console.log(chalk.white(`   Average relationships per corpuscle: ${(relationshipStats.relationshipsCreated / relationshipStats.corpusclesProcessed).toFixed(1)}`));
    }
    
    console.log('');
    console.log(chalk.gray('Next Step: Stage 5 - Rank corpuscles by importance'));
    console.log(chalk.gray('Command: node examples/flow/05-rank-corpuscles.js'));
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
        
        // Initialize components
        const { llmHandler, rateLimitDelay, providerType } = await initializeLLMHandler(config);
        const sparqlHelper = new SPARQLHelper(
            config.get('sparqlUpdateEndpoint') || 'http://localhost:3030/semem/update',
            {
                auth: config.get('sparqlAuth') || { user: 'admin', password: 'admin123' },
                timeout: 30000
            }
        );
        
        console.log(chalk.green('   ✓ Components initialized'));
        
        // Retrieve corpuscles with entities
        const corpuscles = await retrieveCorpusclesWithEntities(sparqlHelper, workflowConfig, args.limit);
        
        if (corpuscles.length === 0) {
            console.log(chalk.yellow('⚠️  No corpuscles with entities found. Run Stages 1-3 first.'));
            return;
        }
        
        // Build relationships
        const relationshipStats = await buildRelationships(corpuscles, llmHandler, rateLimitDelay, providerType, sparqlHelper, workflowConfig);
        
        // Display summary
        const duration = Date.now() - startTime;
        displaySummary(relationshipStats, duration);
        
        console.log(chalk.bold.green('🎉 Stage 4: Relationship building completed successfully!'));
        console.log('');
        
    } catch (error) {
        console.error(chalk.red('❌ Stage 4 failed:'), error.message);
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