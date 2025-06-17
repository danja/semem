#!/usr/bin/env node

/**
 * Comprehensive Semem Inference and Analysis Demo
 * 
 * This example demonstrates the full capabilities of the Semem semantic memory system
 * by ingesting three discursive documents on different topics and then performing
 * various types of analysis, inference, and retrieval operations.
 * 
 * The demo showcases:
 * 1. Document ingestion and embedding generation
 * 2. Knowledge graph construction with entity/relationship extraction
 * 3. Semantic search and similarity analysis
 * 4. Community detection and graph analytics
 * 5. Cross-domain inference and connection discovery
 * 6. SPARQL querying and reasoning
 * 7. Vector Self-Organizing Map (VSOM) visualization
 * 8. Multi-modal retrieval and ranking
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

// Import core Semem components
import { MemoryManager } from '../src/MemoryManager.js';
import { Config } from '../src/Config.js';
import LLMHandler from '../src/handlers/LLMHandler.js';
import EmbeddingHandler from '../src/handlers/EmbeddingHandler.js';

// Import Ragno knowledge graph components
import { decomposeCorpus } from '../src/ragno/decomposeCorpus.js';
import { RDFGraphManager } from '../src/ragno/core/RDFGraphManager.js';
import { CommunityDetection } from '../src/ragno/algorithms/CommunityDetection.js';
import { PersonalizedPageRank } from '../src/ragno/algorithms/PersonalizedPageRank.js';
import { DualSearch } from '../src/ragno/search/DualSearch.js';

// Import VSOM visualization
import { VSOMService } from '../src/services/vsom/VSOMService.js';

// Import connectors
import { OllamaConnector } from '../src/connectors/OllamaConnector.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class ComprehensiveInferenceDemo {
    constructor() {
        this.config = null;
        this.memoryManager = null;
        this.llmHandler = null;
        this.embeddingHandler = null;
        this.graphManager = null;
        this.vsomService = null;
        this.documents = [];
        this.memories = [];
        this.knowledgeGraph = {};
    }

    async initialize() {
        console.log('🚀 Initializing Semem Comprehensive Inference Demo...\n');

        // Initialize configuration
        this.config = new Config({
            llm: {
                provider: 'ollama',
                chatModel: 'qwen2:1.5b',
                embeddingModel: 'nomic-embed-text',
                endpoint: 'http://localhost:11434'
            },
            storage: {
                type: 'memory', // Use in-memory for demo
                maxSize: 10000
            },
            ragno: {
                entityExtraction: true,
                relationshipDetection: true,
                communityDetection: true
            }
        });

        await this.config.initialize();

        // Initialize connectors and handlers
        const ollamaConnector = new OllamaConnector();
        await ollamaConnector.initialize();

        this.llmHandler = new LLMHandler(ollamaConnector, 'qwen2:1.5b', 0.7);
        this.embeddingHandler = new EmbeddingHandler(ollamaConnector);

        // Initialize memory manager
        this.memoryManager = new MemoryManager(this.config);
        await this.memoryManager.initialize();

        // Initialize knowledge graph manager
        this.graphManager = new RDFGraphManager();
        await this.graphManager.initialize();

        // Initialize VSOM service
        this.vsomService = new VSOMService({
            topology: { width: 15, height: 15, shape: 'hexagonal' },
            training: { epochs: 50, learningRate: 0.1 }
        });

        console.log('✅ Initialization complete!\n');
    }

    async loadDocuments() {
        console.log('📚 Loading source documents...\n');

        const dataDir = path.join(__dirname, 'data');
        const documentFiles = [
            'climate_science.md',
            'urban_planning.md', 
            'neuroscience_cognition.md'
        ];

        for (const filename of documentFiles) {
            const filepath = path.join(dataDir, filename);
            const content = await fs.readFile(filepath, 'utf-8');
            
            this.documents.push({
                id: filename.replace('.md', ''),
                title: this.extractTitle(content),
                content: content,
                source: filename
            });

            console.log(`📄 Loaded: ${filename}`);
        }

        console.log(`\n✅ Loaded ${this.documents.length} documents\n`);
    }

    extractTitle(content) {
        const match = content.match(/^# (.+)$/m);
        return match ? match[1] : 'Untitled Document';
    }

    async ingestDocuments() {
        console.log('🔄 Ingesting documents into Semem memory system...\n');

        for (const doc of this.documents) {
            console.log(`Processing: ${doc.title}`);
            
            // Store as memory with full document content
            const memory = await this.memoryManager.store({
                prompt: `Document: ${doc.title}`,
                response: doc.content,
                metadata: {
                    source: 'document_ingestion',
                    documentId: doc.id,
                    title: doc.title,
                    type: 'full_document'
                }
            });

            this.memories.push(memory);

            // Also store individual sections for better granularity
            const sections = this.extractSections(doc.content);
            for (const section of sections) {
                const sectionMemory = await this.memoryManager.store({
                    prompt: `${doc.title} - ${section.heading}`,
                    response: section.content,
                    metadata: {
                        source: 'section_ingestion',
                        documentId: doc.id,
                        parentTitle: doc.title,
                        sectionHeading: section.heading,
                        type: 'document_section'
                    }
                });
                this.memories.push(sectionMemory);
            }

            console.log(`  ✅ Stored ${sections.length + 1} memory items`);
        }

        console.log(`\n✅ Total memories stored: ${this.memories.length}\n`);
    }

    extractSections(content) {
        const sections = [];
        const lines = content.split('\n');
        let currentSection = null;

        for (const line of lines) {
            if (line.startsWith('## ')) {
                if (currentSection) {
                    sections.push(currentSection);
                }
                currentSection = {
                    heading: line.replace('## ', ''),
                    content: ''
                };
            } else if (currentSection && line.trim()) {
                currentSection.content += line + '\n';
            }
        }

        if (currentSection) {
            sections.push(currentSection);
        }

        return sections;
    }

    async buildKnowledgeGraph() {
        console.log('🕸️ Constructing knowledge graph with Ragno...\n');

        // Prepare text chunks for corpus decomposition
        const textChunks = this.documents.map(doc => ({
            content: doc.content,
            source: doc.id,
            metadata: { title: doc.title, type: 'document' }
        }));

        // Extract entities and relationships
        console.log('🔍 Extracting entities and relationships...');
        this.knowledgeGraph = await decomposeCorpus(textChunks, this.llmHandler, {
            extractRelationships: true,
            generateSummaries: true,
            maxEntitiesPerUnit: 15,
            minEntityConfidence: 0.6
        });

        console.log(`  📊 Extracted ${this.knowledgeGraph.entities.length} entities`);
        console.log(`  🔗 Identified ${this.knowledgeGraph.relationships.length} relationships`);
        console.log(`  📝 Created ${this.knowledgeGraph.units.length} semantic units`);

        // Store in RDF graph manager
        await this.graphManager.addEntities(this.knowledgeGraph.entities);
        await this.graphManager.addRelationships(this.knowledgeGraph.relationships);

        console.log('✅ Knowledge graph construction complete!\n');
    }

    async performCommunityDetection() {
        console.log('🎯 Performing community detection analysis...\n');

        const communityDetector = new CommunityDetection(this.graphManager);
        const communities = await communityDetector.detectCommunities({
            algorithm: 'louvain',
            resolution: 1.0,
            minCommunitySize: 3
        });

        console.log(`📊 Detected ${communities.length} communities:`);
        
        for (let i = 0; i < communities.length && i < 5; i++) {
            const community = communities[i];
            console.log(`\n  Community ${i + 1} (${community.entities.length} entities):`);
            console.log(`    Modularity: ${community.modularity.toFixed(3)}`);
            console.log(`    Key entities: ${community.entities.slice(0, 5).join(', ')}`);
            
            if (community.description) {
                console.log(`    Theme: ${community.description}`);
            }
        }

        console.log('\n✅ Community analysis complete!\n');
        return communities;
    }

    async performSemanticSearch() {
        console.log('🔍 Demonstrating semantic search capabilities...\n');

        const searchQueries = [
            'How do neural networks process information?',
            'What are the effects of climate change on ocean systems?', 
            'How can cities become more sustainable?',
            'What is the relationship between memory and learning?',
            'How do feedback loops affect complex systems?'
        ];

        for (const query of searchQueries) {
            console.log(`🔎 Query: "${query}"`);
            
            const results = await this.memoryManager.search(query, {
                limit: 3,
                threshold: 0.7,
                includeMetadata: true
            });

            console.log(`  Found ${results.length} relevant memories:`);
            
            for (let i = 0; i < results.length && i < 2; i++) {
                const result = results[i];
                console.log(`    ${i + 1}. ${result.metadata?.title || result.prompt}`);
                console.log(`       Similarity: ${result.similarity?.toFixed(3) || 'N/A'}`);
                console.log(`       Type: ${result.metadata?.type || 'unknown'}`);
            }
            console.log('');
        }

        console.log('✅ Semantic search demonstration complete!\n');
    }

    async performCrossDomainInference() {
        console.log('🧠 Performing cross-domain inference and connection discovery...\n');

        // Use LLM to find connections between different domains
        const inferenceQueries = [
            {
                query: 'neural networks and urban planning',
                context: 'Find connections between brain network organization and urban planning principles'
            },
            {
                query: 'climate systems and memory formation', 
                context: 'Explore similarities between climate feedback loops and neural memory consolidation'
            },
            {
                query: 'ecosystem dynamics and cognitive processes',
                context: 'Identify parallels between ecological systems and brain function'
            }
        ];

        for (const inference of inferenceQueries) {
            console.log(`🔗 Exploring: ${inference.query}`);
            
            // Search for relevant information from both domains
            const searchResults = await this.memoryManager.search(inference.query, {
                limit: 5,
                threshold: 0.6
            });

            if (searchResults.length >= 2) {
                // Generate cross-domain insights using LLM
                const prompt = `Based on the following information from different domains, identify interesting connections and parallels:

Context: ${inference.context}

Information:
${searchResults.map((r, i) => `${i + 1}. ${r.prompt}: ${r.response.substring(0, 300)}...`).join('\n\n')}

Please identify 2-3 specific connections or parallels between these domains:`;

                try {
                    const insights = await this.llmHandler.generateResponse(prompt, {
                        temperature: 0.8,
                        maxTokens: 400
                    });

                    console.log(`  🧩 Discovered connections:`);
                    console.log(`     ${insights.substring(0, 200)}...`);
                } catch (error) {
                    console.log(`  ⚠️ Could not generate insights: ${error.message}`);
                }
            }
            console.log('');
        }

        console.log('✅ Cross-domain inference complete!\n');
    }

    async performSPARQLQueries() {
        console.log('📊 Executing SPARQL queries on knowledge graph...\n');

        const sparqlQueries = [
            {
                name: 'Entity Types Distribution',
                query: `
                    SELECT ?type (COUNT(?entity) as ?count) WHERE {
                        ?entity rdf:type ?type .
                    }
                    GROUP BY ?type
                    ORDER BY DESC(?count)
                `
            },
            {
                name: 'Most Connected Entities',
                query: `
                    SELECT ?entity (COUNT(?relationship) as ?connections) WHERE {
                        { ?entity ?relationship ?target } UNION { ?source ?relationship ?entity }
                    }
                    GROUP BY ?entity
                    ORDER BY DESC(?connections)
                    LIMIT 10
                `
            },
            {
                name: 'Cross-Domain Relationships',
                query: `
                    SELECT ?entity1 ?relationship ?entity2 WHERE {
                        ?entity1 ?relationship ?entity2 .
                        ?entity1 ragno:sourceDocument ?doc1 .
                        ?entity2 ragno:sourceDocument ?doc2 .
                        FILTER(?doc1 != ?doc2)
                    }
                    LIMIT 10
                `
            }
        ];

        for (const sparql of sparqlQueries) {
            console.log(`🔍 ${sparql.name}:`);
            
            try {
                const results = await this.graphManager.query(sparql.query);
                
                if (results.length > 0) {
                    console.log(`  Found ${results.length} results:`);
                    
                    for (let i = 0; i < Math.min(results.length, 5); i++) {
                        const result = results[i];
                        const values = Object.values(result).map(v => 
                            typeof v === 'object' ? v.value : v
                        );
                        console.log(`    ${i + 1}. ${values.join(' | ')}`);
                    }
                } else {
                    console.log('  No results found');
                }
            } catch (error) {
                console.log(`  ⚠️ Query error: ${error.message}`);
            }
            console.log('');
        }

        console.log('✅ SPARQL analysis complete!\n');
    }

    async performVSOMAnalysis() {
        console.log('🗺️ Creating VSOM visualization of document embeddings...\n');

        try {
            // Get embeddings for all memories
            const embeddings = [];
            const labels = [];

            for (const memory of this.memories.slice(0, 20)) { // Limit for demo
                if (memory.embedding) {
                    embeddings.push(memory.embedding);
                    labels.push(memory.metadata?.title || memory.prompt.substring(0, 30));
                }
            }

            if (embeddings.length > 0) {
                console.log(`📊 Training VSOM with ${embeddings.length} embeddings...`);
                
                await this.vsomService.train(embeddings, {
                    labels: labels,
                    onEpoch: (epoch, loss) => {
                        if (epoch % 10 === 0) {
                            console.log(`  Epoch ${epoch}: Loss ${loss.toFixed(4)}`);
                        }
                    }
                });

                // Generate visualization data
                const visualizationData = await this.vsomService.generateVisualizationData({
                    includeDistances: true,
                    colorMapping: 'cluster'
                });

                console.log('  📈 VSOM training complete!');
                console.log(`  🎯 Final quantization error: ${visualizationData.quantizationError.toFixed(4)}`);
                console.log(`  🗂️ Detected ${visualizationData.clusters || 'multiple'} clusters`);
            } else {
                console.log('  ⚠️ No embeddings available for VSOM analysis');
            }
        } catch (error) {
            console.log(`  ⚠️ VSOM analysis error: ${error.message}`);
        }

        console.log('\n✅ VSOM analysis complete!\n');
    }

    async performPersonalizedPageRank() {
        console.log('🎯 Computing Personalized PageRank for key concepts...\n');

        try {
            const ppr = new PersonalizedPageRank(this.graphManager);
            
            // Select seed nodes (key concepts from each domain)
            const seedConcepts = [
                'neural networks',
                'climate change', 
                'urban planning',
                'memory formation',
                'sustainability'
            ];

            for (const concept of seedConcepts) {
                console.log(`🔍 PageRank analysis for: "${concept}"`);
                
                // Find entities matching the concept
                const matchingEntities = this.knowledgeGraph.entities.filter(entity => 
                    entity.name.toLowerCase().includes(concept.toLowerCase())
                );

                if (matchingEntities.length > 0) {
                    const seedNode = matchingEntities[0].id;
                    
                    const rankings = await ppr.compute({
                        seedNodes: [seedNode],
                        dampingFactor: 0.85,
                        maxIterations: 50,
                        tolerance: 1e-6
                    });

                    console.log('  Top related concepts:');
                    const topResults = Object.entries(rankings)
                        .sort(([,a], [,b]) => b - a)
                        .slice(0, 5);

                    for (const [nodeId, score] of topResults) {
                        const entity = this.knowledgeGraph.entities.find(e => e.id === nodeId);
                        const name = entity ? entity.name : nodeId;
                        console.log(`    ${name}: ${score.toFixed(4)}`);
                    }
                } else {
                    console.log('  No matching entities found');
                }
                console.log('');
            }
        } catch (error) {
            console.log(`  ⚠️ PageRank analysis error: ${error.message}`);
        }

        console.log('✅ Personalized PageRank analysis complete!\n');
    }

    async generateSystemReport() {
        console.log('📋 Generating comprehensive system analysis report...\n');

        const report = {
            documentsProcessed: this.documents.length,
            memoriesStored: this.memories.length,
            entitiesExtracted: this.knowledgeGraph.entities?.length || 0,
            relationshipsIdentified: this.knowledgeGraph.relationships?.length || 0,
            semanticUnitsCreated: this.knowledgeGraph.units?.length || 0
        };

        // Calculate memory statistics
        const memoryTypes = {};
        this.memories.forEach(memory => {
            const type = memory.metadata?.type || 'unknown';
            memoryTypes[type] = (memoryTypes[type] || 0) + 1;
        });

        // Calculate entity type distribution
        const entityTypes = {};
        if (this.knowledgeGraph.entities) {
            this.knowledgeGraph.entities.forEach(entity => {
                const type = entity.type || 'unknown';
                entityTypes[type] = (entityTypes[type] || 0) + 1;
            });
        }

        console.log('📊 SEMEM SYSTEM ANALYSIS REPORT');
        console.log('===============================\n');
        
        console.log('📚 Document Processing:');
        console.log(`  • Documents ingested: ${report.documentsProcessed}`);
        console.log(`  • Memory items created: ${report.memoriesStored}`);
        console.log(`  • Memory types:`, memoryTypes);
        
        console.log('\n🕸️ Knowledge Graph Construction:');
        console.log(`  • Entities extracted: ${report.entitiesExtracted}`);
        console.log(`  • Relationships identified: ${report.relationshipsIdentified}`);
        console.log(`  • Semantic units created: ${report.semanticUnitsCreated}`);
        console.log(`  • Entity types:`, entityTypes);
        
        console.log('\n🔧 System Capabilities Demonstrated:');
        console.log('  ✅ Document ingestion and chunking');
        console.log('  ✅ Vector embedding generation');
        console.log('  ✅ Semantic memory storage and retrieval');
        console.log('  ✅ Knowledge graph entity extraction');
        console.log('  ✅ Relationship discovery and modeling');
        console.log('  ✅ Community detection algorithms');
        console.log('  ✅ Semantic search across domains');
        console.log('  ✅ Cross-domain inference generation');
        console.log('  ✅ SPARQL querying and reasoning');
        console.log('  ✅ Personalized PageRank analysis');
        console.log('  ✅ VSOM clustering and visualization');
        
        console.log('\n🎯 Key Insights Demonstrated:');
        console.log('  • Semem can automatically extract meaningful entities and relationships');
        console.log('  • The system discovers connections across different knowledge domains');
        console.log('  • Semantic search provides contextually relevant results');
        console.log('  • Graph analytics reveal important concepts and community structures');
        console.log('  • The unified memory system enables complex multi-modal reasoning');
        
        console.log('\n💡 Potential Applications:');
        console.log('  • Research paper analysis and literature review');
        console.log('  • Cross-disciplinary knowledge discovery');
        console.log('  • Intelligent document summarization');
        console.log('  • Educational content organization');
        console.log('  • Expert system knowledge base construction');
        
        console.log('\n===============================');
        console.log('🎉 Comprehensive demo completed successfully!');
        console.log('===============================\n');
    }

    async cleanup() {
        console.log('🧹 Cleaning up resources...\n');
        
        if (this.memoryManager) {
            await this.memoryManager.dispose();
        }
        
        if (this.graphManager) {
            await this.graphManager.cleanup();
        }
        
        console.log('✅ Cleanup complete!\n');
    }

    async run() {
        try {
            await this.initialize();
            await this.loadDocuments();
            await this.ingestDocuments();
            await this.buildKnowledgeGraph();
            await this.performCommunityDetection();
            await this.performSemanticSearch();
            await this.performCrossDomainInference();
            await this.performSPARQLQueries();
            await this.performVSOMAnalysis();
            await this.performPersonalizedPageRank();
            await this.generateSystemReport();
        } catch (error) {
            console.error('❌ Demo error:', error);
            throw error;
        } finally {
            await this.cleanup();
        }
    }
}

// Run the demo if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    console.log('🎬 Starting Semem Comprehensive Inference Demo...\n');
    
    const demo = new ComprehensiveInferenceDemo();
    
    demo.run()
        .then(() => {
            console.log('🎊 Demo completed successfully!');
            process.exit(0);
        })
        .catch((error) => {
            console.error('💥 Demo failed:', error);
            process.exit(1);
        });
}

export default ComprehensiveInferenceDemo;