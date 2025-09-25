#!/usr/bin/env node

/**
 * 05-RealZPTNavigationDemo.js - Semantic ZPT Navigation with Real Augmented Data
 * 
 * This demo implements the full ZPT navigation pipeline:
 * 1. Corpus augmentation with Ragno (concept extraction, embeddings)
 * 2. ZPT parameter interpretation using semantic measures
 * 3. Navigation filtering based on actual similarity and concepts
 * 4. Retrieval based on zoom/tilt/pan parameters
 */

import chalk from 'chalk';
import fetch from 'node-fetch';
import Config from '../../src/Config.js';
import { ZPTDataFactory } from '../../src/zpt/ontology/ZPTDataFactory.js';
import { NamespaceUtils, getSPARQLPrefixes } from '../../src/zpt/ontology/ZPTNamespaces.js';
import LLMHandler from '../../src/handlers/LLMHandler.js';
import { Embeddings } from '../../src/core/Embeddings.js';
import EmbeddingsAPIBridge from '../../src/services/EmbeddingsAPIBridge.js';

class RealZPTNavigationDemo {
    constructor() {
        this.config = null;
        this.queryEndpoint = null;
        this.updateEndpoint = null;
        this.dataFactory = null;
        this.llmHandler = null;
        this.embeddingHandler = null;
        this.sessionURI = null;
        this.augmentedCorpuscles = [];
        this.extractedConcepts = new Map();
        this.corpuscleEmbeddings = new Map();
    }

    async initialize() {
        console.log(chalk.yellow('⚙️  Initializing Real ZPT Navigation System...'));

        // Load configuration
        this.config = new Config('config/config.json');
        await this.config.init();

        // Setup endpoints
        const sparqlEndpoints = this.config.get('sparqlEndpoints');
        const endpoint = sparqlEndpoints[0];
        this.queryEndpoint = `${endpoint.urlBase}${endpoint.query}`;
        this.updateEndpoint = `${endpoint.urlBase}${endpoint.update}`;

        // Initialize embedding connector - override to use local Ollama
        const embeddingProvider = 'ollama'; // Force Ollama for this demo
        const embeddingModel = 'nomic-embed-text:v1.5'; // Use available local model
        const chatModel = this.config.get('chatModel') || 'qwen2:1.5b';
        
        // Import EmbeddingConnectorFactory
        const { default: EmbeddingConnectorFactory } = await import('../../src/connectors/EmbeddingConnectorFactory.js');
        const { default: CacheManager } = await import('../../src/handlers/CacheManager.js');
        
        // Configure embedding connector
        let providerConfig = {};
        if (embeddingProvider === 'ollama') {
            const ollamaBaseUrl = this.config.get('ollama.baseUrl') || 'http://localhost:11434';
            providerConfig = {
                provider: 'ollama',
                baseUrl: ollamaBaseUrl,
                model: embeddingModel
            };
        }
        
        const embeddingConnector = EmbeddingConnectorFactory.createConnector(providerConfig);
        
        // Initialize cache manager
        const cacheManager = new CacheManager({
            maxSize: 1000,
            ttl: 3600000 // 1 hour
        });

        // Initialize handlers
        this.embeddingHandler = new Embeddings(embeddingConnector, embeddingModel, 1536, cacheManager);

        this.llmHandler = new LLMHandler(embeddingConnector, chatModel);

        // Initialize ZPT data factory
        this.dataFactory = new ZPTDataFactory({
            navigationGraph: 'http://purl.org/stuff/navigation'
        });

        console.log(chalk.green('✅ Real ZPT navigation system initialized'));
    }

    async executeSPARQLQuery(sparql, description = '') {
        try {
            if (description) {
                console.log(chalk.gray(`   🔍 ${description}...`));
            }

            const response = await fetch(this.queryEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/sparql-query',
                    'Accept': 'application/sparql-results+json'
                },
                body: sparql
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            console.log(chalk.yellow(`   ⚠️  ${description} failed: ${error.message}`));
            return { results: { bindings: [] } };
        }
    }

    async executeSPARQLUpdate(sparql, description = '') {
        try {
            if (description) {
                console.log(chalk.gray(`   📝 ${description}...`));
            }

            const response = await fetch(this.updateEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/sparql-update'
                },
                body: sparql
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            if (description) {
                console.log(chalk.green(`   ✅ ${description} successful`));
            }
            return response;
        } catch (error) {
            console.log(chalk.yellow(`   ⚠️  ${description} failed: ${error.message}`));
            return null;
        }
    }

    /**
     * Phase 1: Augment corpus with semantic data
     */
    async phase1_AugmentCorpusData() {
        console.log(chalk.bold.cyan('\n🔬 Phase 1: Corpus Augmentation with Semantic Data'));
        console.log('='.repeat(70));

        // Get BeerQA corpuscles
        const corpuscleQuery = getSPARQLPrefixes(['ragno']) + `
SELECT ?corpuscle ?content WHERE {
    GRAPH <http://purl.org/stuff/beerqa> {
        ?corpuscle a ragno:Corpuscle ;
                   ragno:content ?content .
    }
}
ORDER BY ?corpuscle
LIMIT 10`;

        const result = await this.executeSPARQLQuery(corpuscleQuery, 'Retrieving BeerQA corpuscles');
        const corpuscles = result.results.bindings;

        console.log(chalk.white(`📊 Processing ${corpuscles.length} corpuscles for augmentation\n`));

        for (let i = 0; i < corpuscles.length; i++) {
            const corpuscle = corpuscles[i];
            const corpuscleURI = corpuscle.corpuscle.value;
            const content = corpuscle.content.value;

            console.log(chalk.white(`${i + 1}. Processing: ${corpuscleURI}`));

            // Extract text content for processing
            const questionMatch = content.match(/Question:\s*([^?]+\?)/i);
            const answerMatch = content.match(/Answer:\s*([^\n]+)/i);
            const contextMatch = content.match(/Context:\s*([\s\S]*)/i);

            let textToProcess = '';
            if (questionMatch) textToProcess += questionMatch[1] + ' ';
            if (answerMatch) textToProcess += answerMatch[1] + ' ';
            if (contextMatch) textToProcess += contextMatch[1].substring(0, 200);

            textToProcess = textToProcess.trim();

            if (textToProcess.length > 10) {
                // Extract concepts using LLM
                console.log(chalk.gray(`   🧠 Extracting concepts...`));
                try {
                    const concepts = await this.llmHandler.extractConcepts(textToProcess);
                    this.extractedConcepts.set(corpuscleURI, concepts);
                    console.log(chalk.gray(`   ✅ Extracted ${concepts.length} concepts`));
                    
                    // Show sample concepts
                    const sampleConcepts = concepts.slice(0, 3).map(c => c.term || c).join(', ');
                    console.log(chalk.gray(`      Sample: ${sampleConcepts}`));
                } catch (error) {
                    console.log(chalk.yellow(`   ⚠️  Concept extraction failed: ${error.message}`));
                    this.extractedConcepts.set(corpuscleURI, []);
                }

                // Generate embeddings
                console.log(chalk.gray(`   🎯 Generating embeddings...`));
                try {
                    const embedding = await this.embeddingHandler.generateEmbedding(textToProcess);
                    this.corpuscleEmbeddings.set(corpuscleURI, embedding);
                    console.log(chalk.gray(`   ✅ Generated ${embedding.length}-dimensional embedding`));
                } catch (error) {
                    console.log(chalk.yellow(`   ⚠️  Embedding generation failed: ${error.message}`));
                    this.corpuscleEmbeddings.set(corpuscleURI, []);
                }

                this.augmentedCorpuscles.push({
                    uri: corpuscleURI,
                    content: content,
                    textContent: textToProcess,
                    concepts: this.extractedConcepts.get(corpuscleURI) || [],
                    embedding: this.corpuscleEmbeddings.get(corpuscleURI) || []
                });
            }

            // Small delay to prevent overwhelming the services
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        console.log(chalk.green(`\n✅ Augmented ${this.augmentedCorpuscles.length} corpuscles with semantic data`));
        return this.augmentedCorpuscles.length;
    }

    /**
     * Phase 2: Store augmented data in knowledge graph
     */
    async phase2_StoreAugmentedData() {
        console.log(chalk.bold.cyan('\n💾 Phase 2: Storing Augmented Semantic Data'));
        console.log('='.repeat(70));

        let storedCount = 0;

        for (const corpuscle of this.augmentedCorpuscles) {
            console.log(chalk.white(`Storing augmented data for: ${corpuscle.uri}`));

            // Store concepts
            if (corpuscle.concepts.length > 0) {
                for (let i = 0; i < corpuscle.concepts.length; i++) {
                    const concept = corpuscle.concepts[i];
                    const conceptTerm = typeof concept === 'string' ? concept : (concept.term || concept.concept || 'unknown');
                    const conceptURI = `${corpuscle.uri}/concept/${i + 1}`;

                    const conceptInsert = getSPARQLPrefixes(['ragno']) + `
INSERT DATA {
    GRAPH <http://purl.org/stuff/beerqa> {
        <${conceptURI}> a ragno:Concept ;
                        ragno:conceptTerm "${conceptTerm.replace(/"/g, '\\"')}" ;
                        ragno:extractedFrom <${corpuscle.uri}> .
        <${corpuscle.uri}> ragno:hasConcept <${conceptURI}> .
    }
}`;

                    await this.executeSPARQLUpdate(conceptInsert, `Storing concept: ${conceptTerm}`);
                }
            }

            // Store embedding (as a simplified representation)
            if (corpuscle.embedding.length > 0) {
                const embeddingDimensions = corpuscle.embedding.length;
                const embeddingMagnitude = Math.sqrt(corpuscle.embedding.reduce((sum, val) => sum + val * val, 0));
                
                const embeddingInsert = getSPARQLPrefixes(['ragno']) + `
INSERT DATA {
    GRAPH <http://purl.org/stuff/beerqa> {
        <${corpuscle.uri}> ragno:hasEmbedding <${corpuscle.uri}/embedding> .
        <${corpuscle.uri}/embedding> a ragno:Embedding ;
                                    ragno:dimensions "${embeddingDimensions}"^^<http://www.w3.org/2001/XMLSchema#integer> ;
                                    ragno:magnitude "${embeddingMagnitude}"^^<http://www.w3.org/2001/XMLSchema#float> .
    }
}`;

                await this.executeSPARQLUpdate(embeddingInsert, 'Storing embedding metadata');
            }

            storedCount++;
        }

        console.log(chalk.green(`✅ Stored augmented data for ${storedCount} corpuscles`));
        return storedCount;
    }

    /**
     * Phase 3: Create ZPT navigation session with real semantic queries
     */
    async phase3_CreateSemanticNavigationSession() {
        console.log(chalk.bold.cyan('\n🗺️  Phase 3: Semantic Navigation Session Creation'));
        console.log('='.repeat(70));

        const sessionConfig = {
            agentURI: 'http://example.org/agents/real_zpt_navigator',
            startTime: new Date(),
            purpose: 'Semantic ZPT navigation with augmented corpus data'
        };

        const session = this.dataFactory.createNavigationSession(sessionConfig);
        this.sessionURI = session.uri.value;

        // Store session
        const sessionTriples = this.generateTriplesFromQuads(session.quads);
        const sessionInsert = getSPARQLPrefixes(['zpt', 'prov']) + `
INSERT DATA {
    GRAPH <http://purl.org/stuff/navigation> {
${sessionTriples}
    }
}`;

        await this.executeSPARQLUpdate(sessionInsert, 'Storing semantic navigation session');

        console.log(chalk.green(`✅ Created semantic navigation session: ${session.uri.value}`));
        return session;
    }

    /**
     * Phase 4: Demonstrate real ZPT navigation with semantic filtering
     */
    async phase4_SemanticZPTNavigation() {
        console.log(chalk.bold.cyan('\n🎯 Phase 4: Real ZPT Navigation with Semantic Filtering'));
        console.log('='.repeat(70));

        // Define realistic navigation scenarios based on actual content
        const navigationScenarios = [
            {
                name: 'Historical Entity Discovery',
                query: 'historical events and wars',
                zoomLevel: 'entity',
                tiltProjection: 'keywords',
                panDomains: ['topic'],
                conceptFilters: ['war', 'history', 'battle', 'conflict', 'executive', 'order']
            },
            {
                name: 'Entertainment Knowledge Exploration',
                query: 'film and movie industry',
                zoomLevel: 'unit',
                tiltProjection: 'embedding',
                panDomains: ['entity', 'topic'],
                conceptFilters: ['film', 'movie', 'director', 'actor', 'science fiction']
            },
            {
                name: 'Biographical Information Mining',
                query: 'biographical and personal information',
                zoomLevel: 'community',
                tiltProjection: 'graph',
                panDomains: ['topic'],
                conceptFilters: ['age', 'older', 'born', 'person', 'individual']
            }
        ];

        const navigationResults = [];

        for (const scenario of navigationScenarios) {
            console.log(chalk.white(`\n🔍 ${scenario.name}`));
            console.log(chalk.gray(`   Query: "${scenario.query}"`));
            console.log(chalk.gray(`   ZPT Parameters: zoom=${scenario.zoomLevel}, tilt=${scenario.tiltProjection}`));

            // Generate query embedding for similarity comparison
            const queryEmbedding = await this.embeddingHandler.generateEmbedding(scenario.query);
            
            // Apply ZPT navigation logic
            const filteredCorpuscles = await this.applyZPTNavigation(scenario, queryEmbedding);
            
            // Create navigation view
            const viewConfig = {
                query: scenario.query,
                zoom: NamespaceUtils.resolveStringToURI('zoom', scenario.zoomLevel).value,
                tilt: NamespaceUtils.resolveStringToURI('tilt', scenario.tiltProjection).value,
                pan: { domains: scenario.panDomains.map(d => NamespaceUtils.resolveStringToURI('pan', d).value) },
                sessionURI: this.sessionURI,
                selectedCorpuscles: filteredCorpuscles.map(c => c.uri)
            };

            const view = this.dataFactory.createNavigationView(viewConfig);
            
            // Store view
            const viewTriples = this.generateTriplesFromQuads(view.quads);
            const viewInsert = getSPARQLPrefixes(['zpt']) + `
INSERT DATA {
    GRAPH <http://purl.org/stuff/navigation> {
${viewTriples}
    }
}`;

            await this.executeSPARQLUpdate(viewInsert, `Storing navigation view: ${scenario.name}`);

            navigationResults.push({
                scenario: scenario,
                view: view,
                results: filteredCorpuscles
            });

            // Display results
            console.log(chalk.green(`   ✅ Found ${filteredCorpuscles.length} relevant corpuscles:`));
            filteredCorpuscles.slice(0, 3).forEach((corpuscle, index) => {
                console.log(chalk.gray(`     ${index + 1}. Similarity: ${corpuscle.similarity.toFixed(3)}`));
                console.log(chalk.gray(`        Concepts: ${corpuscle.matchingConcepts.join(', ')}`));
                const questionMatch = corpuscle.content.match(/Question:\s*([^?]+\?)/i);
                if (questionMatch) {
                    console.log(chalk.gray(`        Question: ${questionMatch[1].substring(0, 80)}...`));
                }
            });
        }

        console.log(chalk.green(`\n✅ Completed ${navigationResults.length} semantic navigation scenarios`));
        return navigationResults;
    }

    /**
     * Apply actual ZPT navigation logic with semantic filtering
     */
    async applyZPTNavigation(scenario, queryEmbedding) {
        const filteredCorpuscles = [];

        for (const corpuscle of this.augmentedCorpuscles) {
            let score = 0;
            let matchingConcepts = [];

            // Apply tilt projection (how we analyze the content)
            if (scenario.tiltProjection === 'embedding' && corpuscle.embedding.length > 0) {
                // Calculate cosine similarity
                const similarity = this.calculateCosineSimilarity(queryEmbedding, corpuscle.embedding);
                score += similarity * 0.6; // 60% weight for embedding similarity
            }

            if (scenario.tiltProjection === 'keywords' || scenario.tiltProjection === 'graph') {
                // Concept matching
                const conceptScore = this.calculateConceptSimilarity(scenario.conceptFilters, corpuscle.concepts);
                score += conceptScore.score * 0.4; // 40% weight for concept matching
                matchingConcepts = conceptScore.matches;
            }

            // Apply zoom level (level of granularity)
            if (scenario.zoomLevel === 'entity') {
                // Entity-level: focus on specific terms and concepts
                if (matchingConcepts.length > 0) score *= 1.2;
            } else if (scenario.zoomLevel === 'unit') {
                // Unit-level: broader semantic units
                if (corpuscle.textContent.length > 100) score *= 1.1;
            } else if (scenario.zoomLevel === 'community') {
                // Community-level: thematic clustering
                if (corpuscle.concepts.length > 2) score *= 1.15;
            }

            // Apply pan domains (constraint filtering)
            if (scenario.panDomains.includes('topic')) {
                // Topic-based filtering - boost if relevant concepts found
                if (matchingConcepts.length > 0) score *= 1.1;
            }

            // Only include if above threshold
            if (score > 0.1) {
                filteredCorpuscles.push({
                    uri: corpuscle.uri,
                    content: corpuscle.content,
                    similarity: score,
                    matchingConcepts: matchingConcepts,
                    concepts: corpuscle.concepts
                });
            }
        }

        // Sort by similarity score and return top results
        return filteredCorpuscles
            .sort((a, b) => b.similarity - a.similarity)
            .slice(0, 5);
    }

    /**
     * Calculate cosine similarity between two vectors
     */
    calculateCosineSimilarity(vec1, vec2) {
        if (vec1.length !== vec2.length || vec1.length === 0) return 0;

        let dotProduct = 0;
        let norm1 = 0;
        let norm2 = 0;

        for (let i = 0; i < vec1.length; i++) {
            dotProduct += vec1[i] * vec2[i];
            norm1 += vec1[i] * vec1[i];
            norm2 += vec2[i] * vec2[i];
        }

        if (norm1 === 0 || norm2 === 0) return 0;
        return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
    }

    /**
     * Calculate concept similarity between query filters and corpuscle concepts
     */
    calculateConceptSimilarity(filters, concepts) {
        const matches = [];
        let totalScore = 0;

        for (const filter of filters) {
            for (const concept of concepts) {
                const conceptTerm = typeof concept === 'string' ? concept : (concept.term || concept.concept || '');
                if (conceptTerm.toLowerCase().includes(filter.toLowerCase()) || 
                    filter.toLowerCase().includes(conceptTerm.toLowerCase())) {
                    matches.push(conceptTerm);
                    totalScore += 1;
                }
            }
        }

        return {
            score: Math.min(totalScore / filters.length, 1), // Normalize to 0-1
            matches: [...new Set(matches)] // Remove duplicates
        };
    }

    /**
     * Phase 5: Demonstrate cross-graph semantic analysis
     */
    async phase5_CrossGraphSemanticAnalysis() {
        console.log(chalk.bold.cyan('\n📊 Phase 5: Cross-Graph Semantic Analysis'));
        console.log('='.repeat(70));

        // Semantic concept distribution analysis
        const conceptAnalysisQuery = getSPARQLPrefixes(['ragno', 'zpt']) + `
SELECT ?concept (COUNT(?corpuscle) AS ?frequency) WHERE {
    GRAPH <http://purl.org/stuff/beerqa> {
        ?corpuscle ragno:hasConcept ?conceptNode .
        ?conceptNode ragno:conceptTerm ?concept .
    }
}
GROUP BY ?concept
ORDER BY DESC(?frequency)
LIMIT 10`;

        const conceptResult = await this.executeSPARQLQuery(conceptAnalysisQuery, 'Analyzing concept distribution');
        const concepts = conceptResult.results.bindings;

        if (concepts.length > 0) {
            console.log(chalk.white('\n🧠 Most Frequent Extracted Concepts:'));
            concepts.forEach((concept, index) => {
                console.log(chalk.gray(`  ${index + 1}. "${concept.concept.value}" (${concept.frequency.value} occurrences)`));
            });
        }

        // Navigation effectiveness analysis
        const navigationAnalysisQuery = getSPARQLPrefixes(['zpt']) + `
SELECT ?view ?query (COUNT(?selectedCorpuscle) AS ?relevantResults) WHERE {
    GRAPH <http://purl.org/stuff/navigation> {
        ?view a zpt:NavigationView ;
              zpt:answersQuery ?query ;
              zpt:selectedCorpuscle ?selectedCorpuscle .
    }
}
GROUP BY ?view ?query
ORDER BY DESC(?relevantResults)`;

        const navResult = await this.executeSPARQLQuery(navigationAnalysisQuery, 'Analyzing navigation effectiveness');
        const navAnalysis = navResult.results.bindings;

        if (navAnalysis.length > 0) {
            console.log(chalk.white('\n🎯 Navigation Query Effectiveness:'));
            navAnalysis.forEach((result, index) => {
                console.log(chalk.gray(`  ${index + 1}. "${result.query.value}": ${result.relevantResults.value} relevant results`));
            });
        }

        return { concepts: concepts.length, navigationQueries: navAnalysis.length };
    }

    /**
     * Display comprehensive results summary
     */
    displaySemanticNavigationSummary(navigationResults, analysisResults) {
        console.log(chalk.bold.cyan('\n🎉 Real ZPT Navigation Demo Summary'));
        console.log('='.repeat(70));

        console.log(chalk.bold.green('✅ Semantic Augmentation Pipeline:'));
        console.log(chalk.white('🔬 Corpus Augmentation'));
        console.log(chalk.gray(`   • Processed ${this.augmentedCorpuscles.length} corpuscles`));
        console.log(chalk.gray(`   • Extracted concepts using LLM analysis`));
        console.log(chalk.gray(`   • Generated vector embeddings for similarity`));
        console.log(chalk.gray(`   • Stored augmented data in knowledge graph`));

        console.log(chalk.white('\n🎯 Semantic Navigation'));
        console.log(chalk.gray(`   • Created ${navigationResults.length} navigation scenarios`));
        console.log(chalk.gray('   • Applied ZPT parameters with semantic meaning:'));
        console.log(chalk.gray('     - Zoom: Entity granularity filtering'));
        console.log(chalk.gray('     - Tilt: Embedding vs. keyword-based analysis'));
        console.log(chalk.gray('     - Pan: Topic domain constraints'));
        console.log(chalk.gray('   • Used cosine similarity for embedding comparison'));
        console.log(chalk.gray('   • Applied concept matching for keyword analysis'));

        console.log(chalk.white('\n📊 Semantic Analysis Results'));
        console.log(chalk.gray(`   • Analyzed ${analysisResults.concepts} unique concepts`));
        console.log(chalk.gray(`   • Evaluated ${analysisResults.navigationQueries} navigation queries`));
        console.log(chalk.gray('   • Demonstrated cross-graph semantic queries'));

        console.log(chalk.bold.cyan('\n💡 Real ZPT Capabilities Demonstrated:'));
        console.log(chalk.white('🔍 Semantic Understanding:'), chalk.gray('Concept extraction and embedding generation'));
        console.log(chalk.white('🎯 Intelligent Filtering:'), chalk.gray('Similarity-based relevance scoring'));
        console.log(chalk.white('📐 Parameter Interpretation:'), chalk.gray('ZPT dimensions affect navigation logic'));
        console.log(chalk.white('🗺️  Corpus Navigation:'), chalk.gray('Structured exploration based on semantic properties'));
        console.log(chalk.white('📊 Cross-Graph Analysis:'), chalk.gray('Integration of navigation metadata with corpus data'));

        console.log(chalk.bold.green('\n🚀 Real ZPT Navigation System: FUNCTIONAL'));
        console.log(chalk.white('The ZPT ontology now provides semantic navigation capabilities'));
        console.log(chalk.white('with concept extraction, similarity measures, and intelligent filtering.'));
    }

    /**
     * Helper: Generate SPARQL triples from RDF quads
     */
    generateTriplesFromQuads(quads) {
        return quads.map(quad => {
            const obj = this.formatRDFObject(quad.object);
            return `        <${quad.subject.value}> <${quad.predicate.value}> ${obj} .`;
        }).join('\n');
    }

    /**
     * Helper: Format RDF object for SPARQL
     */
    formatRDFObject(object) {
        if (object.termType === 'Literal') {
            let formatted = `"${object.value.replace(/"/g, '\\"')}"`;
            if (object.datatype) {
                formatted += `^^<${object.datatype.value}>`;
            } else if (object.language) {
                formatted += `@${object.language}`;
            }
            return formatted;
        } else {
            return `<${object.value}>`;
        }
    }
}

/**
 * Main execution function
 */
async function main() {
    console.log(chalk.bold.blue('╔══════════════════════════════════════════════════════════════╗'));
    console.log(chalk.bold.blue('║') + chalk.bold.white('          🧠 REAL ZPT NAVIGATION DEMO                   ') + chalk.bold.blue('║'));
    console.log(chalk.bold.blue('║') + chalk.gray('    Semantic augmentation, similarity & intelligent filtering  ') + chalk.bold.blue('║'));
    console.log(chalk.bold.blue('╚══════════════════════════════════════════════════════════════╝'));

    const demo = new RealZPTNavigationDemo();

    try {
        console.log(chalk.white('🚀 Starting real ZPT navigation demonstration...\n'));

        await demo.initialize();
        const augmentedCount = await demo.phase1_AugmentCorpusData();
        
        if (augmentedCount === 0) {
            console.log(chalk.red('\n❌ No corpus data could be augmented. Check LLM/embedding services.'));
            process.exit(1);
        }

        await demo.phase2_StoreAugmentedData();
        await demo.phase3_CreateSemanticNavigationSession();
        const navigationResults = await demo.phase4_SemanticZPTNavigation();
        const analysisResults = await demo.phase5_CrossGraphSemanticAnalysis();

        demo.displaySemanticNavigationSummary(navigationResults, analysisResults);

        console.log(chalk.green('\n🎯 Real ZPT navigation demonstration completed successfully!'));

    } catch (error) {
        console.log(chalk.red('\n❌ Real ZPT demo failed:'), error.message);
        console.log(chalk.gray('Stack trace:'), error.stack);
        process.exit(1);
    }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log(chalk.yellow('\n🛑 Real ZPT demo interrupted by user'));
    process.exit(0);
});

// Run the demo
if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(error => {
        console.error(chalk.red('Fatal error:'), error.message);
        process.exit(1);
    });
}

export { RealZPTNavigationDemo };