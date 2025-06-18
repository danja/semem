#!/usr/bin/env node

/**
 * End-to-End Module 4: SPARQL Querying and Reasoning
 * 
 * This module demonstrates advanced SPARQL capabilities including:
 * - Complex queries across multiple RDF vocabularies
 * - Inference and reasoning over the knowledge graph
 * - Advanced graph traversal and relationship discovery
 * - Statistical analysis of the semantic network
 */

import chalk from 'chalk';
import Config from '../../src/Config.js';

export default class QueryModule {
    constructor(config = null) {
        this.config = config;
        this.sparqlEndpoint = null;
        this.queryResults = [];
        this.results = {
            queriesExecuted: 0,
            totalTriples: 0,
            entitiesAnalyzed: 0,
            relationshipsFound: 0,
            inferredConnections: 0,
            domainCoverage: 0,
            graphDensity: 0,
            graphURI: 'http://semem.hyperdata.it/end-to-end',
            ragnoGraphURI: 'http://purl.org/stuff/ragno/corpus/end-to-end',
            success: false,
            error: null
        };
        
        // Advanced SPARQL queries for demonstration
        this.querySet = [
            {
                name: "Knowledge Graph Statistics",
                description: "Basic statistics about the knowledge graph",
                query: this.getStatisticsQuery(),
                processor: this.processStatistics.bind(this)
            },
            {
                name: "Entity-Document Relationships",
                description: "Analyze relationships between entities and their source documents",
                query: this.getEntityDocumentQuery(),
                processor: this.processEntityDocuments.bind(this)
            },
            {
                name: "Cross-Domain Entity Discovery",
                description: "Find entities that span multiple domains",
                query: this.getCrossDomainQuery(),
                processor: this.processCrossDomain.bind(this)
            },
            {
                name: "Semantic Similarity Analysis",
                description: "Analyze semantic relationships using embeddings",
                query: this.getSimilarityQuery(),
                processor: this.processSimilarity.bind(this)
            },
            {
                name: "Knowledge Graph Inference",
                description: "Infer new relationships based on existing patterns",
                query: this.getInferenceQuery(),
                processor: this.processInference.bind(this)
            }
        ];
    }

    async initialize() {
        console.log(chalk.bold.blue('📊 Module 4: SPARQL Querying and Reasoning'));
        console.log(chalk.gray('   Advanced queries and inference over the knowledge graph\n'));

        // Load configuration if not provided
        if (!this.config) {
            this.config = new Config();
            await this.config.init();
        }

        await this.initializeSparqlEndpoint();

        console.log(chalk.green('✅ Module 4 initialization complete\n'));
    }

    async initializeSparqlEndpoint() {
        // Get SPARQL endpoint configuration
        const sparqlEndpoints = this.config.get('sparqlEndpoints');
        if (!sparqlEndpoints || sparqlEndpoints.length === 0) {
            throw new Error('No SPARQL endpoints configured. Please check your config.');
        }

        this.sparqlEndpoint = sparqlEndpoints[0];
        
        console.log(`✅ SPARQL endpoint initialized: ${chalk.bold(this.sparqlEndpoint.urlBase)}`);
        console.log(`📊 Graph URI: ${chalk.bold(this.results.graphURI)}`);
        console.log(`🕸️ Ragno graph: ${chalk.bold(this.results.ragnoGraphURI)}`);
    }

    async execute() {
        try {
            await this.executeAdvancedQueries();
            await this.performInferenceAnalysis();
            await this.generateQueryReport();
            
            this.results.success = true;
            console.log(chalk.bold.green('✅ Module 4 Complete: Advanced SPARQL querying and reasoning demonstrated\n'));
            
        } catch (error) {
            this.results.error = error.message;
            this.results.success = false;
            console.log(chalk.red(`❌ Module 4 Failed: ${error.message}\n`));
            throw error;
        }
    }

    async executeAdvancedQueries() {
        console.log('🔍 Executing advanced SPARQL queries...\n');

        for (const querySpec of this.querySet) {
            console.log(`  📊 ${chalk.cyan(querySpec.name)}`);
            console.log(`     ${chalk.gray(querySpec.description)}`);
            
            try {
                const result = await this.executeSparqlSelect(querySpec.query);
                
                if (result.results?.bindings && result.results.bindings.length > 0) {
                    const processedResult = await querySpec.processor(result.results.bindings);
                    
                    this.queryResults.push({
                        name: querySpec.name,
                        description: querySpec.description,
                        resultCount: result.results.bindings.length,
                        processed: processedResult,
                        success: true
                    });
                    
                    console.log(`     ✅ ${result.results.bindings.length} results\n`);
                } else {
                    console.log(`     📭 No results found\n`);
                    this.queryResults.push({
                        name: querySpec.name,
                        description: querySpec.description,
                        resultCount: 0,
                        processed: null,
                        success: false
                    });
                }
                
                this.results.queriesExecuted++;
                
            } catch (error) {
                console.log(`     ❌ Query failed: ${error.message}\n`);
                this.queryResults.push({
                    name: querySpec.name,
                    description: querySpec.description,
                    error: error.message,
                    success: false
                });
            }
        }

        console.log(`✅ Executed ${this.results.queriesExecuted} advanced queries\n`);
    }

    async performInferenceAnalysis() {
        console.log('🧠 Performing knowledge graph inference analysis...');

        try {
            // Analyze entity co-occurrence patterns
            const cooccurrenceQuery = `
                PREFIX semem: <http://semem.hyperdata.it/vocab/>
                PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
                
                SELECT ?entity1 ?entity2 ?doc1 ?doc2 (COUNT(*) as ?cooccurrences)
                WHERE {
                    GRAPH <${this.results.graphURI}> {
                        ?item1 semem:hasMetadata ?meta1 .
                        ?meta1 semem:type "ragno:Entity" ;
                               semem:sourceDocument ?doc1 .
                        ?item1 semem:prompt ?entity1 .
                        
                        ?item2 semem:hasMetadata ?meta2 .
                        ?meta2 semem:type "ragno:Entity" ;
                               semem:sourceDocument ?doc2 .
                        ?item2 semem:prompt ?entity2 .
                        
                        FILTER(?entity1 != ?entity2)
                        FILTER(?doc1 = ?doc2)
                    }
                }
                GROUP BY ?entity1 ?entity2 ?doc1 ?doc2
                ORDER BY DESC(?cooccurrences)
                LIMIT 10
            `;

            const cooccurrenceResult = await this.executeSparqlSelect(cooccurrenceQuery);
            
            if (cooccurrenceResult.results?.bindings?.length > 0) {
                console.log('  🔗 Entity co-occurrence patterns:');
                cooccurrenceResult.results.bindings.forEach((binding, index) => {
                    const entity1 = binding.entity1?.value;
                    const entity2 = binding.entity2?.value;
                    const doc = binding.doc1?.value?.split('/').pop();
                    const count = binding.cooccurrences?.value;
                    
                    console.log(`    ${index + 1}. ${chalk.cyan(entity1)} ↔ ${chalk.cyan(entity2)}`);
                    console.log(`       └─ in document: ${chalk.gray(doc)} (${count} connections)`);
                });
                
                this.results.relationshipsFound = cooccurrenceResult.results.bindings.length;
            }

            // Infer potential cross-domain connections
            const crossDomainInferenceQuery = `
                PREFIX semem: <http://semem.hyperdata.it/vocab/>
                
                SELECT DISTINCT ?entity1 ?doc1 ?entity2 ?doc2
                WHERE {
                    GRAPH <${this.results.graphURI}> {
                        ?item1 semem:hasMetadata ?meta1 .
                        ?meta1 semem:type "ragno:Entity" ;
                               semem:sourceDocument ?doc1 .
                        ?item1 semem:prompt ?entity1 .
                        
                        ?item2 semem:hasMetadata ?meta2 .
                        ?meta2 semem:type "ragno:Entity" ;
                               semem:sourceDocument ?doc2 .
                        ?item2 semem:prompt ?entity2 .
                        
                        FILTER(?doc1 != ?doc2)
                        FILTER(CONTAINS(LCASE(?entity1), "learning") || 
                               CONTAINS(LCASE(?entity1), "memory") ||
                               CONTAINS(LCASE(?entity1), "planning") ||
                               CONTAINS(LCASE(?entity1), "climate") ||
                               CONTAINS(LCASE(?entity1), "sustainable"))
                    }
                }
                LIMIT 5
            `;

            const inferenceResult = await this.executeSparqlSelect(crossDomainInferenceQuery);
            
            if (inferenceResult.results?.bindings?.length > 0) {
                console.log('\n  💡 Inferred cross-domain connections:');
                inferenceResult.results.bindings.forEach((binding, index) => {
                    const entity1 = binding.entity1?.value;
                    const entity2 = binding.entity2?.value;
                    const doc1 = binding.doc1?.value?.split('/').pop();
                    const doc2 = binding.doc2?.value?.split('/').pop();
                    
                    console.log(`    ${index + 1}. ${chalk.yellow(entity1)} → ${chalk.yellow(entity2)}`);
                    console.log(`       └─ bridging: ${chalk.gray(doc1)} ↔ ${chalk.gray(doc2)}`);
                });
                
                this.results.inferredConnections = inferenceResult.results.bindings.length;
            }

        } catch (error) {
            console.log(`  ❌ Inference analysis failed: ${error.message}`);
        }

        console.log(`\n✅ Inference analysis complete\n`);
    }

    async generateQueryReport() {
        console.log('📋 Generating SPARQL analysis report...');

        console.log(`\n  📈 ${chalk.bold('Query Execution Summary:')}`);
        console.log(`     • Total queries executed: ${chalk.green(this.results.queriesExecuted)}`);
        console.log(`     • Successful queries: ${chalk.green(this.queryResults.filter(r => r.success).length)}`);
        console.log(`     • Failed queries: ${chalk.red(this.queryResults.filter(r => !r.success).length)}`);

        console.log(`\n  🕸️ ${chalk.bold('Knowledge Graph Analysis:')}`);
        console.log(`     • Total triples: ${chalk.green(this.results.totalTriples)}`);
        console.log(`     • Entities analyzed: ${chalk.green(this.results.entitiesAnalyzed)}`);
        console.log(`     • Relationships found: ${chalk.green(this.results.relationshipsFound)}`);
        console.log(`     • Inferred connections: ${chalk.green(this.results.inferredConnections)}`);

        if (this.queryResults.length > 0) {
            console.log(`\n  🎯 ${chalk.bold('Query Results Summary:')}`);
            this.queryResults.forEach((result, index) => {
                const status = result.success ? '✅' : '❌';
                const count = result.resultCount || 0;
                console.log(`     ${index + 1}. ${status} ${result.name}: ${count} results`);
                if (result.error) {
                    console.log(`        └─ ${chalk.red('Error:')} ${result.error}`);
                }
            });
        }

        console.log(`\n✅ SPARQL querying and reasoning capabilities demonstrated\n`);
    }

    // Query definitions
    getStatisticsQuery() {
        return `
            PREFIX semem: <http://semem.hyperdata.it/vocab/>
            PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
            
            SELECT 
                (COUNT(DISTINCT ?doc) as ?documents)
                (COUNT(DISTINCT ?entity) as ?entities)
                (COUNT(*) as ?totalTriples)
            WHERE {
                GRAPH <${this.results.graphURI}> {
                    { ?doc a semem:Document }
                    UNION
                    { ?entity semem:hasMetadata ?meta .
                      ?meta semem:type "ragno:Entity" }
                }
            }
        `;
    }

    getEntityDocumentQuery() {
        return `
            PREFIX semem: <http://semem.hyperdata.it/vocab/>
            PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
            
            SELECT ?entity ?sourceDoc ?confidence
            WHERE {
                GRAPH <${this.results.graphURI}> {
                    ?item semem:hasMetadata ?meta .
                    ?meta semem:type "ragno:Entity" ;
                          semem:sourceDocument ?sourceDoc ;
                          semem:confidence ?confidence .
                    ?item semem:prompt ?entity .
                }
            }
            ORDER BY DESC(?confidence)
            LIMIT 10
        `;
    }

    getCrossDomainQuery() {
        return `
            PREFIX semem: <http://semem.hyperdata.it/vocab/>
            
            SELECT DISTINCT ?entity (GROUP_CONCAT(DISTINCT ?sourceDoc; separator=", ") as ?documents)
            WHERE {
                GRAPH <${this.results.graphURI}> {
                    ?item semem:hasMetadata ?meta .
                    ?meta semem:type "ragno:Entity" ;
                          semem:sourceDocument ?sourceDoc .
                    ?item semem:prompt ?entity .
                }
            }
            GROUP BY ?entity
            HAVING (COUNT(DISTINCT ?sourceDoc) > 1)
        `;
    }

    getSimilarityQuery() {
        return `
            PREFIX semem: <http://semem.hyperdata.it/vocab/>
            
            SELECT ?entity1 ?entity2
            WHERE {
                GRAPH <${this.results.graphURI}> {
                    ?item1 semem:hasMetadata ?meta1 .
                    ?meta1 semem:type "ragno:Entity" .
                    ?item1 semem:prompt ?entity1 ;
                           semem:embedding ?embedding1 .
                    
                    ?item2 semem:hasMetadata ?meta2 .
                    ?meta2 semem:type "ragno:Entity" .
                    ?item2 semem:prompt ?entity2 ;
                           semem:embedding ?embedding2 .
                    
                    FILTER(?entity1 < ?entity2)
                }
            }
            LIMIT 5
        `;
    }

    getInferenceQuery() {
        return `
            PREFIX semem: <http://semem.hyperdata.it/vocab/>
            PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
            
            SELECT ?pattern ?count
            WHERE {
                {
                    SELECT ("Entity-Document Co-occurrence" AS ?pattern) (COUNT(*) AS ?count)
                    WHERE {
                        GRAPH <${this.results.graphURI}> {
                            ?entity semem:hasMetadata ?meta .
                            ?meta semem:type "ragno:Entity" ;
                                  semem:sourceDocument ?doc .
                        }
                    }
                }
                UNION
                {
                    SELECT ("Documents with Entities" AS ?pattern) (COUNT(DISTINCT ?doc) AS ?count)
                    WHERE {
                        GRAPH <${this.results.graphURI}> {
                            ?doc a semem:Document .
                            ?entity semem:hasMetadata ?meta .
                            ?meta semem:sourceDocument ?docName .
                            FILTER(CONTAINS(STR(?doc), ?docName))
                        }
                    }
                }
            }
        `;
    }

    // Result processors
    async processStatistics(bindings) {
        const stats = bindings[0];
        this.results.totalTriples = parseInt(stats.totalTriples?.value || 0);
        this.results.entitiesAnalyzed = parseInt(stats.entities?.value || 0);
        
        console.log(`     └─ Documents: ${stats.documents?.value || 0}`);
        console.log(`     └─ Entities: ${stats.entities?.value || 0}`);
        console.log(`     └─ Total triples: ${stats.totalTriples?.value || 0}`);
        
        return {
            documents: parseInt(stats.documents?.value || 0),
            entities: parseInt(stats.entities?.value || 0),
            triples: parseInt(stats.totalTriples?.value || 0)
        };
    }

    async processEntityDocuments(bindings) {
        console.log(`     └─ Top entities by confidence:`);
        bindings.slice(0, 5).forEach((binding, index) => {
            const entity = binding.entity?.value;
            const confidence = parseFloat(binding.confidence?.value || 0).toFixed(2);
            const doc = binding.sourceDoc?.value?.split(' ').slice(0, 3).join(' ');
            console.log(`        ${index + 1}. ${chalk.cyan(entity)} (${confidence}) from "${doc}..."`);
        });
        
        return bindings.map(b => ({
            entity: b.entity?.value,
            confidence: parseFloat(b.confidence?.value || 0),
            sourceDocument: b.sourceDoc?.value
        }));
    }

    async processCrossDomain(bindings) {
        console.log(`     └─ Cross-domain entities:`);
        bindings.forEach((binding, index) => {
            const entity = binding.entity?.value;
            const docs = binding.documents?.value?.split(', ').length;
            console.log(`        ${index + 1}. ${chalk.cyan(entity)} spans ${docs} documents`);
        });
        
        return bindings.map(b => ({
            entity: b.entity?.value,
            documentCount: b.documents?.value?.split(', ').length || 0
        }));
    }

    async processSimilarity(bindings) {
        console.log(`     └─ Entity pairs with embeddings:`);
        bindings.forEach((binding, index) => {
            const entity1 = binding.entity1?.value;
            const entity2 = binding.entity2?.value;
            console.log(`        ${index + 1}. ${chalk.cyan(entity1)} ↔ ${chalk.cyan(entity2)}`);
        });
        
        return bindings.map(b => ({
            entity1: b.entity1?.value,
            entity2: b.entity2?.value
        }));
    }

    async processInference(bindings) {
        console.log(`     └─ Inference patterns:`);
        bindings.forEach((binding, index) => {
            const pattern = binding.pattern?.value;
            const count = binding.count?.value;
            console.log(`        ${index + 1}. ${chalk.cyan(pattern)}: ${count}`);
        });
        
        return bindings.map(b => ({
            pattern: b.pattern?.value,
            count: parseInt(b.count?.value || 0)
        }));
    }

    async executeSparqlSelect(query) {
        const queryEndpoint = `${this.sparqlEndpoint.urlBase}${this.sparqlEndpoint.query}`;
        
        const response = await fetch(queryEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/sparql-query',
                'Accept': 'application/sparql-results+json',
                'Authorization': `Basic ${Buffer.from(`${this.sparqlEndpoint.user}:${this.sparqlEndpoint.password}`).toString('base64')}`
            },
            body: query
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`SPARQL SELECT failed: ${response.status} - ${errorText}`);
        }

        return await response.json();
    }

    async cleanup() {
        console.log('🧹 Module 4 cleanup complete');
    }

    getResults() {
        return {
            ...this.results,
            queryResults: this.queryResults.map(r => ({
                name: r.name,
                success: r.success,
                resultCount: r.resultCount || 0,
                error: r.error
            }))
        };
    }
}

// Allow running as standalone module
if (import.meta.url === `file://${process.argv[1]}`) {
    console.log(chalk.bold.cyan('🚀 Running Query Module Standalone...\n'));
    
    const module = new QueryModule();
    
    module.initialize()
        .then(() => module.execute())
        .then(() => module.cleanup())
        .then(() => {
            console.log(chalk.bold.green('✨ Query module completed successfully!'));
            console.log('📊 Results:', JSON.stringify(module.getResults(), null, 2));
            process.exit(0);
        })
        .catch((error) => {
            console.error(chalk.red('💥 Query module failed:'), error);
            process.exit(1);
        });
}