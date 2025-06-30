/**
 * WikidataResearch.js - Main workflow for Wikidata-enhanced research
 * 
 * This script orchestrates the complete research workflow by:
 * 1. Extracting concepts from Wikipedia corpus 
 * 2. Searching Wikidata for related entities
 * 3. Converting Wikidata entities to Ragno format
 * 4. Storing enhanced knowledge graph data
 * 5. Creating cross-references between Wikipedia and Wikidata
 * 
 * Usage: node examples/beerqa-wikidata/WikidataResearch.js <question>
 */

import dotenv from 'dotenv';
import logger from 'loglevel';
import path from 'path';
import { fileURLToPath } from 'url';
import Config from '../../src/Config.js';
import LLMHandler from '../../src/handlers/LLMHandler.js';
import WikidataSearch from '../../src/aux/wikidata/WikidataSearch.js';
import WikidataToRagno from '../../src/aux/wikidata/WikidataToRagno.js';
import QueryTemplateManager from '../../src/aux/wikidata/QueryTemplateManager.js';
import SPARQLHelper from './SPARQLHelper.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// Set log level
logger.setLevel(process.env.LOG_LEVEL || 'info');

export default class WikidataResearch {
    constructor(options = {}) {
        this.options = {
            maxEntitiesPerConcept: 3,
            maxWikidataSearchResults: 15,
            minEntityConfidence: 0.4,
            enableHierarchySearch: true,
            enableCrossReferences: true,
            batchSize: 10,
            storageGraph: 'http://purl.org/stuff/wikidata/research',
            ...options
        };

        this.stats = {
            conceptsExtracted: 0,
            entitiesFound: 0,
            entitiesConverted: 0,
            crossReferencesCreated: 0,
            executionTime: 0,
            errors: []
        };
    }

    /**
     * Initialize the research workflow
     * @returns {Promise<void>}
     */
    async initialize() {
        try {
            logger.info('Initializing Wikidata Research workflow...');

            // Load Config.js for proper configuration
            const configPath = path.join(process.cwd(), 'config/config.json');
            const configObj = new Config(configPath);
            await configObj.init();
            
            this.config = configObj;
            const storageOptions = configObj.get('storage.options');

            // Initialize LLM handler for concept extraction following BeerQA pattern
            const llmProviders = configObj.get('llmProviders') || [];
            const chatProvider = llmProviders
                .filter(p => p.capabilities?.includes('chat'))
                .sort((a, b) => (a.priority || 999) - (b.priority || 999))[0];

            if (!chatProvider) {
                throw new Error('No chat LLM provider configured');
            }

            // Create LLM connector based on provider type
            let llmConnector;
            if (chatProvider.type === 'mistral' && process.env.MISTRAL_API_KEY) {
                const { default: MistralConnector } = await import('../../src/connectors/MistralConnector.js');
                llmConnector = new MistralConnector({
                    apiKey: process.env.MISTRAL_API_KEY,
                    model: chatProvider.chatModel
                });
            } else if (chatProvider.type === 'claude' && process.env.CLAUDE_API_KEY) {
                const { default: ClaudeConnector } = await import('../../src/connectors/ClaudeConnector.js');
                llmConnector = new ClaudeConnector({
                    apiKey: process.env.CLAUDE_API_KEY,
                    model: chatProvider.chatModel
                });
            } else {
                // Fallback to Ollama
                const { default: OllamaConnector } = await import('../../src/connectors/OllamaConnector.js');
                llmConnector = new OllamaConnector({
                    baseUrl: 'http://localhost:11434',
                    model: 'qwen2:1.5b'
                });
            }

            this.llmHandler = new LLMHandler(llmConnector, chatProvider.chatModel || 'qwen2:1.5b');

            // Initialize Wikidata components
            this.wikidataSearch = new WikidataSearch({
                maxResults: this.options.maxWikidataSearchResults,
                minConfidence: this.options.minEntityConfidence
            });

            this.wikidataConverter = new WikidataToRagno({
                graphURI: this.options.storageGraph
            });

            this.queryTemplateManager = new QueryTemplateManager();
            await this.queryTemplateManager.preloadTemplates();

            // Initialize SPARQL helper for data storage
            if (storageOptions?.update) {
                this.sparqlHelper = new SPARQLHelper(storageOptions.update, {
                    auth: {
                        user: storageOptions.user,
                        password: storageOptions.password
                    }
                });
            }

            logger.info('Wikidata Research workflow initialized successfully');

        } catch (error) {
            logger.error('Failed to initialize Wikidata Research workflow:', error.message);
            throw error;
        }
    }

    /**
     * Execute the complete research workflow
     * @param {string} question - Research question
     * @param {Object} options - Execution options
     * @returns {Promise<Object>} Research results
     */
    async executeResearch(question, options = {}) {
        const startTime = Date.now();
        const executionOptions = {
            includeWikipediaContext: true,
            expandHierarchy: this.options.enableHierarchySearch,
            storeResults: true,
            ...options
        };

        try {
            logger.info(`Starting Wikidata research for: "${question}"`);

            // Step 1: Extract concepts from the question
            logger.info('Step 1: Extracting concepts from question...');
            const concepts = await this.extractConcepts(question);
            this.stats.conceptsExtracted = concepts.length;
            logger.info(`Extracted ${concepts.length} concepts`);

            // Step 2: Search Wikidata for entities matching concepts
            logger.info('Step 2: Searching Wikidata for related entities...');
            const wikidataEntities = await this.searchWikidataEntities(concepts);
            this.stats.entitiesFound = wikidataEntities.length;
            logger.info(`Found ${wikidataEntities.length} Wikidata entities`);

            // Step 3: Convert entities to Ragno format
            logger.info('Step 3: Converting entities to Ragno format...');
            const ragnoEntities = await this.convertEntitiesToRagno(wikidataEntities);
            this.stats.entitiesConverted = ragnoEntities.length;
            logger.info(`Converted ${ragnoEntities.length} entities to Ragno format`);

            // Step 4: Create cross-references with existing Wikipedia data
            let crossReferences = [];
            if (executionOptions.includeWikipediaContext) {
                logger.info('Step 4: Creating cross-references with Wikipedia data...');
                crossReferences = await this.createCrossReferences(ragnoEntities);
                this.stats.crossReferencesCreated = crossReferences.length;
                logger.info(`Created ${crossReferences.length} cross-references`);
            }

            // Step 5: Store results in knowledge graph
            if (executionOptions.storeResults && this.sparqlHelper) {
                logger.info('Step 5: Storing results in knowledge graph...');
                await this.storeResults(ragnoEntities, crossReferences);
                logger.info('Results stored successfully');
            }

            this.stats.executionTime = Date.now() - startTime;

            const results = {
                success: true,
                question: question,
                concepts: concepts,
                wikidataEntities: wikidataEntities,
                ragnoEntities: ragnoEntities,
                crossReferences: crossReferences,
                stats: this.getStats(),
                executionTime: this.stats.executionTime
            };

            logger.info(`Research completed successfully in ${this.stats.executionTime}ms`);
            return results;

        } catch (error) {
            this.stats.errors.push({
                timestamp: new Date().toISOString(),
                error: error.message,
                question: question
            });

            logger.error('Research workflow failed:', error.message);
            
            return {
                success: false,
                error: error.message,
                question: question,
                stats: this.getStats(),
                executionTime: Date.now() - startTime
            };
        }
    }

    /**
     * Extract concepts from question using LLM
     * @param {string} question - Research question
     * @returns {Promise<Array>} Extracted concepts
     * @private
     */
    async extractConcepts(question) {
        try {
            const prompt = `Extract key concepts from this question for semantic search. Return concepts as a JSON array with objects containing "value", "type", and "confidence" (0-1).

Question: "${question}"

Focus on entities, topics, and domain-specific terms that would be useful for finding related information in Wikidata. Include confidence scores based on how important each concept is for answering the question.

Example format:
[
  {"value": "beer", "type": "product", "confidence": 0.9},
  {"value": "brewing", "type": "process", "confidence": 0.8},
  {"value": "hops", "type": "ingredient", "confidence": 0.7}
]`;

            const response = await this.llmHandler.generateResponse(prompt);
            
            // Parse JSON response
            const jsonMatch = response.match(/\[[\s\S]*\]/);
            if (!jsonMatch) {
                throw new Error('No valid JSON found in concept extraction response');
            }

            const concepts = JSON.parse(jsonMatch[0]);
            
            // Validate and filter concepts
            return concepts
                .filter(concept => 
                    concept.value && 
                    concept.confidence >= (this.options.minEntityConfidence - 0.1)
                )
                .sort((a, b) => b.confidence - a.confidence);

        } catch (error) {
            logger.error('Concept extraction failed:', error.message);
            // Fallback: extract simple keywords
            return this.extractSimpleKeywords(question);
        }
    }

    /**
     * Fallback keyword extraction
     * @param {string} question - Research question
     * @returns {Array} Simple keyword concepts
     * @private
     */
    extractSimpleKeywords(question) {
        const stopWords = new Set(['what', 'how', 'why', 'when', 'where', 'who', 'is', 'are', 'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by']);
        
        const words = question.toLowerCase()
            .replace(/[^\w\s]/g, ' ')
            .split(/\s+/)
            .filter(word => word.length > 2 && !stopWords.has(word));

        return words.map(word => ({
            value: word,
            type: 'keyword',
            confidence: 0.5
        }));
    }

    /**
     * Search Wikidata for entities related to concepts
     * @param {Array} concepts - Extracted concepts
     * @returns {Promise<Array>} Wikidata entities
     * @private
     */
    async searchWikidataEntities(concepts) {
        const allEntities = [];

        for (const concept of concepts) {
            try {
                // Search by concept text
                const textSearch = await this.wikidataSearch.searchByText(concept.value, {
                    limit: this.options.maxEntitiesPerConcept
                });

                if (textSearch.success) {
                    // Add concept information to entities
                    const entitiesWithConcept = textSearch.entities.map(entity => ({
                        ...entity,
                        sourceConcept: concept,
                        searchType: 'concept-text'
                    }));
                    
                    allEntities.push(...entitiesWithConcept);
                }

                // Add delay for rate limiting
                await this.sleep(200);

            } catch (error) {
                logger.warn(`Failed to search for concept "${concept.value}":`, error.message);
                this.stats.errors.push({
                    concept: concept.value,
                    error: error.message
                });
            }
        }

        // Remove duplicates based on entity ID
        const uniqueEntities = this.removeDuplicateEntities(allEntities);
        
        // Sort by confidence and limit results
        return uniqueEntities
            .sort((a, b) => b.confidence - a.confidence)
            .slice(0, this.options.maxWikidataSearchResults);
    }

    /**
     * Convert Wikidata entities to Ragno format
     * @param {Array} wikidataEntities - Wikidata entities
     * @returns {Promise<Array>} Ragno entities
     * @private
     */
    async convertEntitiesToRagno(wikidataEntities) {
        const ragnoEntities = [];

        for (const entity of wikidataEntities) {
            try {
                const conversionResult = this.wikidataConverter.convertEntity(entity, {
                    includeProperties: true,
                    includeRelationships: true,
                    generateEmbeddings: false
                });

                if (conversionResult.success) {
                    ragnoEntities.push({
                        entityURI: conversionResult.entityURI,
                        triples: conversionResult.ragnoTriples,
                        originalEntity: entity,
                        sourceConcept: entity.sourceConcept
                    });
                }

            } catch (error) {
                logger.warn(`Failed to convert entity ${entity.id}:`, error.message);
                this.stats.errors.push({
                    entityId: entity.id,
                    error: error.message
                });
            }
        }

        return ragnoEntities;
    }

    /**
     * Create cross-references with existing Wikipedia entities
     * @param {Array} ragnoEntities - Ragno entities
     * @returns {Promise<Array>} Cross-references
     * @private
     */
    async createCrossReferences(ragnoEntities) {
        if (!this.options.enableCrossReferences) {
            return [];
        }

        const crossReferences = [];

        // Find related Wikipedia entities in the knowledge graph
        for (const ragnoEntity of ragnoEntities) {
            try {
                // Search for Wikipedia entities with similar labels/concepts
                const wikipediaEntities = await this.findRelatedWikipediaEntities(ragnoEntity);

                for (const wikipediaEntity of wikipediaEntities) {
                    const crossRef = this.wikidataConverter.createCrossReference(
                        ragnoEntity.entityURI,
                        wikipediaEntity.uri,
                        'wikidata-wikipedia-link',
                        {
                            weight: 0.8,
                            description: `Cross-reference between Wikidata entity and Wikipedia article`
                        }
                    );

                    if (crossRef.success) {
                        crossReferences.push({
                            relationshipURI: crossRef.relationshipURI,
                            triples: crossRef.triples,
                            wikidataEntity: ragnoEntity.entityURI,
                            wikipediaEntity: wikipediaEntity.uri
                        });
                    }
                }

            } catch (error) {
                logger.warn(`Failed to create cross-references for ${ragnoEntity.entityURI}:`, error.message);
            }
        }

        return crossReferences;
    }

    /**
     * Find related Wikipedia entities in the knowledge graph
     * @param {Object} ragnoEntity - Ragno entity
     * @returns {Promise<Array>} Related Wikipedia entities
     * @private
     */
    async findRelatedWikipediaEntities(ragnoEntity) {
        if (!this.sparqlHelper) {
            return [];
        }

        try {
            const label = ragnoEntity.originalEntity.label;
            const description = ragnoEntity.originalEntity.description || '';

            const query = `
PREFIX ragno: <http://purl.org/stuff/ragno/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>

SELECT DISTINCT ?entity ?label WHERE {
    GRAPH <http://purl.org/stuff/wikipedia/research> {
        ?entity rdf:type ragno:Entity .
        ?entity rdfs:label ?label .
        
        FILTER(
            CONTAINS(LCASE(?label), LCASE("${label.substring(0, 20)}")) ||
            CONTAINS(LCASE("${label}"), LCASE(?label))
        )
    }
}
LIMIT 5`;

            const result = await this.sparqlHelper.executeSelect(query);

            if (result.success && result.data.results?.bindings) {
                return result.data.results.bindings.map(binding => ({
                    uri: binding.entity.value,
                    label: binding.label.value
                }));
            }

        } catch (error) {
            logger.warn('Wikipedia entity search failed:', error.message);
        }

        return [];
    }

    /**
     * Store results in the knowledge graph
     * @param {Array} ragnoEntities - Ragno entities
     * @param {Array} crossReferences - Cross-references
     * @returns {Promise<void>}
     * @private
     */
    async storeResults(ragnoEntities, crossReferences) {
        if (!this.sparqlHelper) {
            logger.warn('No SPARQL helper available for storing results');
            return;
        }

        try {
            // Batch entities for storage
            const entityBatches = this.createBatches(ragnoEntities, this.options.batchSize);

            for (let i = 0; i < entityBatches.length; i++) {
                const batch = entityBatches[i];
                const allTriples = batch.flatMap(entity => entity.triples);
                
                const triplesText = allTriples.join('\n        ');
                const insertQuery = this.sparqlHelper.createInsertDataQuery(
                    this.options.storageGraph,
                    triplesText
                );


                const result = await this.sparqlHelper.executeUpdate(insertQuery);
                
                if (!result.success) {
                    logger.error(`Failed to store entity batch ${i + 1}:`, result.error);
                }

                logger.info(`Stored entity batch ${i + 1}/${entityBatches.length}`);
            }

            // Store cross-references
            if (crossReferences.length > 0) {
                const crossRefBatches = this.createBatches(crossReferences, this.options.batchSize);

                for (let i = 0; i < crossRefBatches.length; i++) {
                    const batch = crossRefBatches[i];
                    const allTriples = batch.flatMap(ref => ref.triples);
                    
                    const insertQuery = this.sparqlHelper.createInsertDataQuery(
                        this.options.storageGraph,
                        allTriples.join('\n        ')
                    );

                    const result = await this.sparqlHelper.executeUpdate(insertQuery);
                    
                    if (!result.success) {
                        logger.error(`Failed to store cross-reference batch ${i + 1}:`, result.error);
                    }
                }

                logger.info(`Stored ${crossReferences.length} cross-references`);
            }

        } catch (error) {
            logger.error('Failed to store results:', error.message);
            throw error;
        }
    }

    /**
     * Remove duplicate entities based on ID
     * @param {Array} entities - Entities array
     * @returns {Array} Unique entities
     * @private
     */
    removeDuplicateEntities(entities) {
        const seen = new Set();
        return entities.filter(entity => {
            if (seen.has(entity.id)) {
                return false;
            }
            seen.add(entity.id);
            return true;
        });
    }

    /**
     * Create batches from array
     * @param {Array} array - Input array
     * @param {number} batchSize - Batch size
     * @returns {Array} Array of batches
     * @private
     */
    createBatches(array, batchSize) {
        const batches = [];
        for (let i = 0; i < array.length; i += batchSize) {
            batches.push(array.slice(i, i + batchSize));
        }
        return batches;
    }

    /**
     * Sleep utility
     * @param {number} ms - Milliseconds to sleep
     * @private
     */
    async sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Get execution statistics
     * @returns {Object} Statistics
     */
    getStats() {
        return {
            ...this.stats,
            conversionStats: this.wikidataConverter.getStats(),
            searchStats: this.wikidataSearch.getStats()
        };
    }

    /**
     * Cleanup resources
     */
    async cleanup() {
        // Cleanup any resources if needed
        logger.info('Wikidata Research workflow cleanup completed');
    }
}

// CLI execution
if (import.meta.url === `file://${process.argv[1]}`) {
    const question = process.argv[2];
    
    if (!question) {
        console.error('Usage: node WikidataResearch.js <question>');
        process.exit(1);
    }

    const research = new WikidataResearch();
    
    try {
        await research.initialize();
        const results = await research.executeResearch(question);
        
        console.log('\n=== WIKIDATA RESEARCH RESULTS ===');
        console.log(`Question: ${results.question}`);
        console.log(`Success: ${results.success}`);
        console.log(`Execution Time: ${results.executionTime}ms`);
        console.log(`Concepts Found: ${results.concepts?.length || 0}`);
        console.log(`Wikidata Entities: ${results.wikidataEntities?.length || 0}`);
        console.log(`Ragno Entities: ${results.ragnoEntities?.length || 0}`);
        console.log(`Cross-References: ${results.crossReferences?.length || 0}`);
        
        if (results.success) {
            console.log('\n=== TOP CONCEPTS ===');
            results.concepts?.slice(0, 5).forEach((concept, i) => {
                console.log(`${i + 1}. ${concept.value} (${concept.type}, confidence: ${concept.confidence})`);
            });

            console.log('\n=== TOP ENTITIES ===');
            results.wikidataEntities?.slice(0, 5).forEach((entity, i) => {
                console.log(`${i + 1}. ${entity.label} (${entity.id}, confidence: ${entity.confidence})`);
                if (entity.description) {
                    console.log(`   ${entity.description}`);
                }
            });
        } else {
            console.error(`Error: ${results.error}`);
        }
        
    } catch (error) {
        console.error('Research failed:', error.message);
        process.exit(1);
    } finally {
        await research.cleanup();
    }
}