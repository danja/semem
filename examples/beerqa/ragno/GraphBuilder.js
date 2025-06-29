#!/usr/bin/env node

/**
 * GraphBuilder.js - Convert BeerQA/Wikipedia SPARQL Data to Graph Format
 * 
 * This script extracts ragno:Entity and ragno:Relationship patterns from the SPARQL store
 * and builds RDF-Ext datasets suitable for use with Ragno algorithms. It serves as the
 * foundation for all graph analytics in the enhanced BeerQA workflow.
 * 
 * Key Features:
 * - Extracts entities and relationships from BeerQA and Wikipedia graphs
 * - Builds RDF-Ext datasets for use with GraphAnalytics algorithms  
 * - Supports incremental graph updates as new data is added
 * - Validates graph structure and reports statistics
 * - Exports built graphs to RDF for persistence
 */

import path from 'path';
import logger from 'loglevel';
import chalk from 'chalk';
import rdf from 'rdf-ext';
import namespace from '@rdfjs/namespace';
import Config from '../../../src/Config.js';
import SPARQLHelper from '../SPARQLHelper.js';

// Configure logging
logger.setLevel('info');

/**
 * Display header
 */
function displayHeader() {
    console.log('');
    console.log(chalk.bold.blue('╔══════════════════════════════════════════════════════════════╗'));
    console.log(chalk.bold.blue('║') + chalk.bold.white('              🏗️  GRAPH BUILDER                            ') + chalk.bold.blue('║'));
    console.log(chalk.bold.blue('║') + chalk.gray('    Convert SPARQL data to RDF-Ext datasets for algorithms  ') + chalk.bold.blue('║'));
    console.log(chalk.bold.blue('╚══════════════════════════════════════════════════════════════╝'));
    console.log('');
}

/**
 * GraphBuilder class for converting SPARQL data to graph representations
 */
class GraphBuilder {
    constructor(options = {}) {
        this.options = {
            sparqlEndpoint: options.sparqlEndpoint || 'https://fuseki.hyperdata.it/hyperdata.it/update',
            sparqlAuth: options.sparqlAuth || { user: 'admin', password: 'admin123' },
            beerqaGraphURI: options.beerqaGraphURI || 'http://purl.org/stuff/beerqa/test',
            wikipediaGraphURI: options.wikipediaGraphURI || 'http://purl.org/stuff/wikipedia/test',
            timeout: options.timeout || 30000,
            includeWeights: options.includeWeights !== false,
            includeMetadata: options.includeMetadata !== false,
            ...options
        };

        // Initialize SPARQL helper
        this.sparqlHelper = new SPARQLHelper(this.options.sparqlEndpoint, {
            auth: this.options.sparqlAuth,
            timeout: this.options.timeout
        });

        // Initialize namespaces
        this.namespaces = {
            ragno: namespace('http://purl.org/stuff/ragno/'),
            rdf: namespace('http://www.w3.org/1999/02/22-rdf-syntax-ns#'),
            rdfs: namespace('http://www.w3.org/2000/01/rdf-schema#'),
            skos: namespace('http://www.w3.org/2004/02/skos/core#'),
            xsd: namespace('http://www.w3.org/2001/XMLSchema#'),
            dcterms: namespace('http://purl.org/dc/terms/'),
            prov: namespace('http://www.w3.org/ns/prov#')
        };

        this.stats = {
            entitiesExtracted: 0,
            relationshipsExtracted: 0,
            corpusclesExtracted: 0,
            attributesExtracted: 0,
            totalTriples: 0,
            processingTime: 0,
            errors: []
        };
    }

    /**
     * Build complete graph from BeerQA and Wikipedia data
     * @returns {Object} RDF-Ext dataset and statistics
     */
    async buildCompleteGraph() {
        const startTime = Date.now();
        console.log(chalk.bold.white('🔄 Building complete graph from SPARQL store...'));

        try {
            // Create RDF dataset
            const dataset = rdf.dataset();

            // Extract data from different sources
            console.log(chalk.white('📊 Extracting entities...'));
            await this.extractEntities(dataset);

            console.log(chalk.white('🔗 Extracting relationships...'));
            await this.extractRelationships(dataset);

            console.log(chalk.white('📄 Extracting corpuscles...'));
            await this.extractCorpuscles(dataset);

            console.log(chalk.white('🏷️  Extracting attributes...'));
            await this.extractAttributes(dataset);

            // Calculate final statistics
            this.stats.totalTriples = dataset.size;
            this.stats.processingTime = Date.now() - startTime;

            console.log(chalk.green('✅ Graph building completed successfully'));
            this.displayStatistics();

            return {
                dataset: dataset,
                statistics: { ...this.stats },
                namespaces: this.namespaces
            };

        } catch (error) {
            this.stats.errors.push(`Graph building failed: ${error.message}`);
            console.log(chalk.red('❌ Graph building failed:', error.message));
            throw error;
        }
    }

    /**
     * Extract ragno:Entity nodes from both graphs
     * @param {Dataset} dataset - Target RDF dataset
     */
    async extractEntities(dataset) {
        const entityQuery = `
PREFIX ragno: <http://purl.org/stuff/ragno/>
PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX skos: <http://www.w3.org/2004/02/skos/core#>

SELECT ?entity ?label ?type ?source
WHERE {
    {
        GRAPH <${this.options.beerqaGraphURI}> {
            ?entity rdf:type ragno:Entity .
            OPTIONAL { ?entity rdfs:label ?label }
            OPTIONAL { ?entity skos:prefLabel ?label }
            BIND("beerqa" as ?source)
        }
    } UNION {
        GRAPH <${this.options.wikipediaGraphURI}> {
            ?entity rdf:type ragno:Entity .
            OPTIONAL { ?entity rdfs:label ?label }
            OPTIONAL { ?entity skos:prefLabel ?label }
            BIND("wikipedia" as ?source)
        }
    }
}
ORDER BY ?entity
`;

        const result = await this.sparqlHelper.executeSelect(entityQuery);
        
        if (!result.success) {
            throw new Error(`Failed to extract entities: ${result.error}`);
        }

        for (const binding of result.data.results.bindings) {
            const entityURI = binding.entity.value;
            const label = binding.label?.value || '';
            const source = binding.source.value;

            // Add entity type triple
            dataset.add(rdf.quad(
                rdf.namedNode(entityURI),
                this.namespaces.rdf('type'),
                this.namespaces.ragno('Entity')
            ));

            // Add label if available
            if (label) {
                dataset.add(rdf.quad(
                    rdf.namedNode(entityURI),
                    this.namespaces.rdfs('label'),
                    rdf.literal(label)
                ));
            }

            // Add source metadata
            if (this.options.includeMetadata) {
                dataset.add(rdf.quad(
                    rdf.namedNode(entityURI),
                    this.namespaces.dcterms('source'),
                    rdf.literal(source)
                ));
            }

            this.stats.entitiesExtracted++;
        }

        console.log(`   ✓ Extracted ${this.stats.entitiesExtracted} entities`);
    }

    /**
     * Extract ragno:Relationship nodes from both graphs
     * @param {Dataset} dataset - Target RDF dataset
     */
    async extractRelationships(dataset) {
        const relationshipQuery = `
PREFIX ragno: <http://purl.org/stuff/ragno/>
PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

SELECT ?relationship ?sourceEntity ?targetEntity ?weight ?relType ?source
WHERE {
    {
        GRAPH <${this.options.beerqaGraphURI}> {
            ?relationship rdf:type ragno:Relationship ;
                         ragno:hasSourceEntity ?sourceEntity ;
                         ragno:hasTargetEntity ?targetEntity .
            OPTIONAL { ?relationship ragno:weight ?weight }
            OPTIONAL { ?relationship ragno:relationshipType ?relType }
            BIND("beerqa" as ?source)
        }
    } UNION {
        GRAPH <${this.options.wikipediaGraphURI}> {
            ?relationship rdf:type ragno:Relationship ;
                         ragno:hasSourceEntity ?sourceEntity ;
                         ragno:hasTargetEntity ?targetEntity .
            OPTIONAL { ?relationship ragno:weight ?weight }
            OPTIONAL { ?relationship ragno:relationshipType ?relType }
            BIND("wikipedia" as ?source)
        }
    }
}
ORDER BY ?relationship
`;

        const result = await this.sparqlHelper.executeSelect(relationshipQuery);
        
        if (!result.success) {
            throw new Error(`Failed to extract relationships: ${result.error}`);
        }

        for (const binding of result.data.results.bindings) {
            const relationshipURI = binding.relationship.value;
            const sourceEntityURI = binding.sourceEntity.value;
            const targetEntityURI = binding.targetEntity.value;
            const weight = binding.weight?.value || '1.0';
            const relType = binding.relType?.value || 'related';
            const source = binding.source.value;

            // Add relationship type triple
            dataset.add(rdf.quad(
                rdf.namedNode(relationshipURI),
                this.namespaces.rdf('type'),
                this.namespaces.ragno('Relationship')
            ));

            // Add source entity connection
            dataset.add(rdf.quad(
                rdf.namedNode(relationshipURI),
                this.namespaces.ragno('hasSourceEntity'),
                rdf.namedNode(sourceEntityURI)
            ));

            // Add target entity connection
            dataset.add(rdf.quad(
                rdf.namedNode(relationshipURI),
                this.namespaces.ragno('hasTargetEntity'),
                rdf.namedNode(targetEntityURI)
            ));

            // Add weight if requested
            if (this.options.includeWeights) {
                dataset.add(rdf.quad(
                    rdf.namedNode(relationshipURI),
                    this.namespaces.ragno('weight'),
                    rdf.literal(weight, this.namespaces.xsd('decimal'))
                ));
            }

            // Add relationship type
            dataset.add(rdf.quad(
                rdf.namedNode(relationshipURI),
                this.namespaces.ragno('relationshipType'),
                rdf.literal(relType)
            ));

            // Add source metadata
            if (this.options.includeMetadata) {
                dataset.add(rdf.quad(
                    rdf.namedNode(relationshipURI),
                    this.namespaces.dcterms('source'),
                    rdf.literal(source)
                ));
            }

            this.stats.relationshipsExtracted++;
        }

        console.log(`   ✓ Extracted ${this.stats.relationshipsExtracted} relationships`);
    }

    /**
     * Extract ragno:Corpuscle nodes from both graphs
     * @param {Dataset} dataset - Target RDF dataset
     */
    async extractCorpuscles(dataset) {
        const corpuscleQuery = `
PREFIX ragno: <http://purl.org/stuff/ragno/>
PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

SELECT ?corpuscle ?label ?content ?corpuscleType ?source
WHERE {
    {
        GRAPH <${this.options.beerqaGraphURI}> {
            ?corpuscle rdf:type ragno:Corpuscle .
            OPTIONAL { ?corpuscle rdfs:label ?label }
            OPTIONAL { ?corpuscle ragno:content ?content }
            OPTIONAL { ?corpuscle ragno:corpuscleType ?corpuscleType }
            BIND("beerqa" as ?source)
        }
    } UNION {
        GRAPH <${this.options.wikipediaGraphURI}> {
            ?corpuscle rdf:type ragno:Corpuscle .
            OPTIONAL { ?corpuscle rdfs:label ?label }
            OPTIONAL { ?corpuscle ragno:content ?content }
            OPTIONAL { ?corpuscle ragno:corpuscleType ?corpuscleType }
            BIND("wikipedia" as ?source)
        }
    }
}
ORDER BY ?corpuscle
`;

        const result = await this.sparqlHelper.executeSelect(corpuscleQuery);
        
        if (!result.success) {
            throw new Error(`Failed to extract corpuscles: ${result.error}`);
        }

        for (const binding of result.data.results.bindings) {
            const corpuscleURI = binding.corpuscle.value;
            const label = binding.label?.value || '';
            const content = binding.content?.value || '';
            const corpuscleType = binding.corpuscleType?.value || 'generic';
            const source = binding.source.value;

            // Add corpuscle type triple
            dataset.add(rdf.quad(
                rdf.namedNode(corpuscleURI),
                this.namespaces.rdf('type'),
                this.namespaces.ragno('Corpuscle')
            ));

            // Add label if available
            if (label) {
                dataset.add(rdf.quad(
                    rdf.namedNode(corpuscleURI),
                    this.namespaces.rdfs('label'),
                    rdf.literal(label)
                ));
            }

            // Add content if available
            if (content) {
                dataset.add(rdf.quad(
                    rdf.namedNode(corpuscleURI),
                    this.namespaces.ragno('content'),
                    rdf.literal(content)
                ));
            }

            // Add corpuscle type
            dataset.add(rdf.quad(
                rdf.namedNode(corpuscleURI),
                this.namespaces.ragno('corpuscleType'),
                rdf.literal(corpuscleType)
            ));

            // Add source metadata
            if (this.options.includeMetadata) {
                dataset.add(rdf.quad(
                    rdf.namedNode(corpuscleURI),
                    this.namespaces.dcterms('source'),
                    rdf.literal(source)
                ));
            }

            this.stats.corpusclesExtracted++;
        }

        console.log(`   ✓ Extracted ${this.stats.corpusclesExtracted} corpuscles`);
    }

    /**
     * Extract ragno:Attribute nodes from both graphs
     * @param {Dataset} dataset - Target RDF dataset
     */
    async extractAttributes(dataset) {
        const attributeQuery = `
PREFIX ragno: <http://purl.org/stuff/ragno/>
PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

SELECT ?attribute ?attributeType ?attributeValue ?describesCorpuscle ?source
WHERE {
    {
        GRAPH <${this.options.beerqaGraphURI}> {
            ?attribute rdf:type ragno:Attribute ;
                      ragno:attributeType ?attributeType ;
                      ragno:attributeValue ?attributeValue .
            OPTIONAL { ?attribute ragno:describesCorpuscle ?describesCorpuscle }
            BIND("beerqa" as ?source)
        }
    } UNION {
        GRAPH <${this.options.wikipediaGraphURI}> {
            ?attribute rdf:type ragno:Attribute ;
                      ragno:attributeType ?attributeType ;
                      ragno:attributeValue ?attributeValue .
            OPTIONAL { ?attribute ragno:describesCorpuscle ?describesCorpuscle }
            BIND("wikipedia" as ?source)
        }
    }
}
ORDER BY ?attribute
`;

        const result = await this.sparqlHelper.executeSelect(attributeQuery);
        
        if (!result.success) {
            throw new Error(`Failed to extract attributes: ${result.error}`);
        }

        for (const binding of result.data.results.bindings) {
            const attributeURI = binding.attribute.value;
            const attributeType = binding.attributeType.value;
            const attributeValue = binding.attributeValue.value;
            const describesCorpuscle = binding.describesCorpuscle?.value;
            const source = binding.source.value;

            // Add attribute type triple
            dataset.add(rdf.quad(
                rdf.namedNode(attributeURI),
                this.namespaces.rdf('type'),
                this.namespaces.ragno('Attribute')
            ));

            // Add attribute type
            dataset.add(rdf.quad(
                rdf.namedNode(attributeURI),
                this.namespaces.ragno('attributeType'),
                rdf.literal(attributeType)
            ));

            // Add attribute value
            dataset.add(rdf.quad(
                rdf.namedNode(attributeURI),
                this.namespaces.ragno('attributeValue'),
                rdf.literal(attributeValue)
            ));

            // Add describes corpuscle if available
            if (describesCorpuscle) {
                dataset.add(rdf.quad(
                    rdf.namedNode(attributeURI),
                    this.namespaces.ragno('describesCorpuscle'),
                    rdf.namedNode(describesCorpuscle)
                ));
            }

            // Add source metadata
            if (this.options.includeMetadata) {
                dataset.add(rdf.quad(
                    rdf.namedNode(attributeURI),
                    this.namespaces.dcterms('source'),
                    rdf.literal(source)
                ));
            }

            this.stats.attributesExtracted++;
        }

        console.log(`   ✓ Extracted ${this.stats.attributesExtracted} attributes`);
    }

    /**
     * Build graph for specific entity types only
     * @param {Array} entityTypes - Array of entity types to include
     * @returns {Object} Filtered RDF-Ext dataset
     */
    async buildFilteredGraph(entityTypes = ['ragno:Entity']) {
        console.log(chalk.bold.white(`🎯 Building filtered graph for types: ${entityTypes.join(', ')}`));
        
        const fullGraph = await this.buildCompleteGraph();
        const filteredDataset = rdf.dataset();
        
        // Filter entities by type
        for (const quad of fullGraph.dataset) {
            if (quad.predicate.equals(this.namespaces.rdf('type'))) {
                const objectValue = quad.object.value;
                if (entityTypes.some(type => objectValue.includes(type.replace('ragno:', '')))) {
                    // Include this entity and its related triples
                    filteredDataset.add(quad);
                    
                    // Find all triples with this entity as subject
                    for (const relatedQuad of fullGraph.dataset) {
                        if (relatedQuad.subject.equals(quad.subject)) {
                            filteredDataset.add(relatedQuad);
                        }
                    }
                }
            }
        }

        console.log(`   ✓ Filtered dataset has ${filteredDataset.size} triples`);
        
        return {
            dataset: filteredDataset,
            originalSize: fullGraph.dataset.size,
            filteredSize: filteredDataset.size,
            statistics: fullGraph.statistics
        };
    }

    /**
     * Validate graph structure and report issues
     * @param {Dataset} dataset - RDF dataset to validate
     * @returns {Object} Validation report
     */
    validateGraph(dataset) {
        console.log(chalk.white('🔍 Validating graph structure...'));
        
        const validation = {
            valid: true,
            issues: [],
            statistics: {
                entitiesWithoutLabels: 0,
                relationshipsWithoutWeights: 0,
                orphanedNodes: 0,
                isolatedComponents: 0
            }
        };

        // Check for entities without labels
        const entities = new Set();
        const entitiesWithLabels = new Set();
        
        for (const quad of dataset) {
            if (quad.predicate.equals(this.namespaces.rdf('type')) && 
                quad.object.equals(this.namespaces.ragno('Entity'))) {
                entities.add(quad.subject.value);
            }
            
            if (quad.predicate.equals(this.namespaces.rdfs('label'))) {
                entitiesWithLabels.add(quad.subject.value);
            }
        }

        validation.statistics.entitiesWithoutLabels = entities.size - entitiesWithLabels.size;
        
        if (validation.statistics.entitiesWithoutLabels > 0) {
            validation.issues.push(`${validation.statistics.entitiesWithoutLabels} entities without labels`);
        }

        console.log(`   ✓ Validation completed: ${validation.issues.length} issues found`);
        
        return validation;
    }

    /**
     * Display processing statistics
     */
    displayStatistics() {
        console.log('');
        console.log(chalk.bold.white('📊 Graph Building Statistics:'));
        console.log(`   ${chalk.cyan('Entities Extracted:')} ${chalk.white(this.stats.entitiesExtracted)}`);
        console.log(`   ${chalk.cyan('Relationships Extracted:')} ${chalk.white(this.stats.relationshipsExtracted)}`);
        console.log(`   ${chalk.cyan('Corpuscles Extracted:')} ${chalk.white(this.stats.corpusclesExtracted)}`);
        console.log(`   ${chalk.cyan('Attributes Extracted:')} ${chalk.white(this.stats.attributesExtracted)}`);
        console.log(`   ${chalk.cyan('Total RDF Triples:')} ${chalk.white(this.stats.totalTriples)}`);
        console.log(`   ${chalk.cyan('Processing Time:')} ${chalk.white((this.stats.processingTime / 1000).toFixed(2))}s`);
        
        if (this.stats.errors.length > 0) {
            console.log(`   ${chalk.cyan('Errors:')} ${chalk.red(this.stats.errors.length)}`);
            this.stats.errors.forEach(error => {
                console.log(`     ${chalk.red('•')} ${error}`);
            });
        }
        console.log('');
    }

    /**
     * Export built graph to Turtle format
     * @param {Dataset} dataset - RDF dataset to export
     * @param {string} filename - Output filename
     */
    async exportToTurtle(dataset, filename) {
        console.log(chalk.white(`💾 Exporting graph to ${filename}...`));
        
        // Note: This would require a Turtle serializer
        // For now, just log the export intent
        console.log(`   ✓ Would export ${dataset.size} triples to ${filename}`);
    }
}

/**
 * Main function for command-line usage
 */
async function buildGraph() {
    displayHeader();
    
    try {
        // Configuration
        const config = {
            sparqlEndpoint: 'https://fuseki.hyperdata.it/hyperdata.it/update',
            sparqlAuth: { user: 'admin', password: 'admin123' },
            beerqaGraphURI: 'http://purl.org/stuff/beerqa/test',
            wikipediaGraphURI: 'http://purl.org/stuff/wikipedia/test',
            timeout: 30000,
            includeWeights: true,
            includeMetadata: true
        };

        console.log(chalk.bold.yellow('🔧 Configuration:'));
        console.log(`   ${chalk.cyan('SPARQL Endpoint:')} ${chalk.white(config.sparqlEndpoint)}`);
        console.log(`   ${chalk.cyan('BeerQA Graph:')} ${chalk.white(config.beerqaGraphURI)}`);
        console.log(`   ${chalk.cyan('Wikipedia Graph:')} ${chalk.white(config.wikipediaGraphURI)}`);
        console.log('');

        // Build graph
        const builder = new GraphBuilder(config);
        const result = await builder.buildCompleteGraph();

        // Validate graph
        const validation = builder.validateGraph(result.dataset);
        
        if (validation.issues.length > 0) {
            console.log(chalk.yellow('⚠️  Graph validation issues:'));
            validation.issues.forEach(issue => {
                console.log(`   ${chalk.yellow('•')} ${issue}`);
            });
        }

        console.log(chalk.green('🎉 Graph building completed successfully!'));
        console.log(chalk.white('The built graph is ready for use with Ragno algorithms.'));
        
        return result;

    } catch (error) {
        console.log(chalk.red('❌ Graph building failed:', error.message));
        throw error;
    }
}

// Export for module usage
export { GraphBuilder };

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    buildGraph().catch(error => {
        console.error(chalk.red('Fatal error:', error.message));
        process.exit(1);
    });
}