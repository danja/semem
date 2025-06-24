#!/usr/bin/env node

/**
 * Ragno Corpus Decomposition Demonstration
 * 
 * This example showcases the Ragno knowledge graph construction capabilities:
 * - Text corpus decomposition into RDF semantic units
 * - Entity extraction with relationship mapping
 * - Knowledge graph construction and validation
 * - RDF export in multiple formats (Turtle, N-Triples, JSON-LD)
 * 
 * Features comprehensive corpus processing, visual progress tracking, and performance analysis.
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import chalk from 'chalk';
import log from 'loglevel';

// Configure comprehensive logging
log.setLevel('DEBUG');

class RagnoCorpusDecompositionDemo {
  constructor() {
    this.client = null;
    this.transport = null;
    this.startTime = Date.now();
    this.operationCount = 0;
    this.corpusData = [];
    this.extractedEntities = [];
    this.decompositionResults = [];
    this.performanceMetrics = {
      decompositions: [],
      entityExtractions: [],
      exports: [],
      queries: []
    };
  }

  // === ENHANCED LOGGING UTILITIES ===

  logBanner(title, subtitle = null) {
    const elapsed = ((Date.now() - this.startTime) / 1000).toFixed(1);
    console.log(chalk.magenta.bold(`\n${'▓'.repeat(70)}`));
    console.log(chalk.magenta.bold(`▓▓ ${title.padEnd(64)} ▓▓`));
    if (subtitle) {
      console.log(chalk.magenta(`▓▓ ${subtitle.padEnd(64)} ▓▓`));
    }
    console.log(chalk.magenta.bold(`▓▓ ${'Time: ' + elapsed + 's | Operation: ' + ++this.operationCount}`.padEnd(64) + ' ▓▓'));
    console.log(chalk.magenta.bold(`${'▓'.repeat(70)}`));
  }

  logStep(step, description) {
    console.log(chalk.yellow.bold(`\n🔶 Step ${step}: ${description}`));
  }

  logProgress(current, total, item = '') {
    const percentage = Math.round((current / total) * 100);
    const filled = Math.round(percentage / 5);
    const bar = '█'.repeat(filled) + '░'.repeat(20 - filled);
    console.log(chalk.blue(`   📊 [${bar}] ${percentage}% ${item}`));
  }

  logSuccess(message, data = null) {
    console.log(chalk.green(`   ✅ ${message}`));
    if (data && typeof data === 'object') {
      const preview = JSON.stringify(data, null, 2).slice(0, 150);
      console.log(chalk.gray(`   📋 ${preview}${preview.length >= 150 ? '...' : ''}`));
    }
  }

  logWarning(message) {
    console.log(chalk.yellow(`   ⚠️  ${message}`));
  }

  logError(message, error = null) {
    console.log(chalk.red(`   ❌ ${message}`));
    if (error) {
      console.log(chalk.red(`   📝 ${error.message}`));
    }
  }

  logPerformance(operation, duration, details = {}) {
    const emoji = duration < 1000 ? '⚡' : duration < 5000 ? '🚀' : '🐌';
    console.log(chalk.magenta(`   ${emoji} ${operation}: ${duration}ms`));
    if (Object.keys(details).length > 0) {
      console.log(chalk.gray(`   📈 ${JSON.stringify(details)}`));
    }
  }

  logKnowledgeGraph(entities, relationships) {
    console.log(chalk.cyan('\n🕸️  Knowledge Graph Structure:'));
    console.log(chalk.white(`   📦 Entities: ${entities}`));
    console.log(chalk.white(`   🔗 Relationships: ${relationships}`));
    console.log(chalk.white(`   🎯 Graph density: ${relationships > 0 ? (relationships / entities).toFixed(2) : 0} rels/entity`));
  }

  // === RAGNO CONCEPT EXPLANATIONS ===

  explainRagnoConcepts() {
    this.logBanner('Ragno Knowledge Graph Concepts', 'Understanding Text-to-RDF Transformation');

    console.log(chalk.cyan('\n💡 Ragno Pipeline Overview:'));
    console.log(chalk.white('   Ragno transforms unstructured text into structured RDF knowledge graphs'));
    console.log(chalk.white('   using semantic analysis and entity relationship extraction.\\n'));

    console.log(chalk.yellow('🔄 Decomposition Process:'));
    console.log(chalk.white('   1️⃣  Text Segmentation → Break text into semantic units'));
    console.log(chalk.white('   2️⃣  Entity Extraction → Identify entities, concepts, and attributes'));
    console.log(chalk.white('   3️⃣  Relationship Mapping → Discover connections between entities'));
    console.log(chalk.white('   4️⃣  RDF Generation → Create semantic web-compatible triples'));
    console.log(chalk.white('   5️⃣  Graph Validation → Ensure consistency and completeness\\n'));

    console.log(chalk.green('🧬 Ragno Ontology Elements:'));
    console.log(chalk.white('   🏷️  ragno:Entity → Named entities (people, places, organizations)'));
    console.log(chalk.white('   📦 ragno:SemanticUnit → Coherent chunks of related information'));
    console.log(chalk.white('   🔗 ragno:Relationship → First-class relationship objects'));
    console.log(chalk.white('   📄 ragno:TextElement → Original text segments with metadata'));
    console.log(chalk.white('   🎯 ragno:Attribute → Entity properties and characteristics'));
  }

  // === SAMPLE CORPUS GENERATION ===

  generateSampleCorpus() {
    this.logBanner('Sample Corpus Generation', 'Creating diverse text for knowledge graph construction');

    this.corpusData = [
      {
        source: 'ai-research',
        content: `Artificial Intelligence has revolutionized multiple industries. OpenAI developed GPT-4, 
                 a large language model that demonstrates remarkable capabilities in natural language processing. 
                 The model was trained on diverse text data and can perform tasks like code generation, 
                 mathematical reasoning, and creative writing. Sam Altman, CEO of OpenAI, announced the model 
                 in March 2023, marking a significant milestone in AI development.`
      },
      {
        source: 'climate-science',
        content: `Climate change represents one of the most pressing challenges of our time. The Intergovernmental 
                 Panel on Climate Change (IPCC) has published extensive research showing global temperature increases 
                 due to greenhouse gas emissions. Renewable energy technologies like solar panels and wind turbines 
                 are becoming increasingly cost-effective. Tesla, led by Elon Musk, has accelerated electric vehicle 
                 adoption, contributing to reduced carbon emissions in transportation.`
      },
      {
        source: 'quantum-computing',
        content: `Quantum computing harnesses quantum mechanical phenomena to process information in fundamentally 
                 new ways. IBM's quantum processors have achieved quantum supremacy in specific computational tasks. 
                 Google's Sycamore processor demonstrated quantum advantage in 2019. These systems use qubits 
                 instead of classical bits, enabling exponential speedups for certain algorithms. Applications 
                 include cryptography, drug discovery, and financial modeling.`
      },
      {
        source: 'biotechnology',
        content: `CRISPR-Cas9 gene editing technology has transformed biotechnology and medicine. Jennifer Doudna 
                 and Emmanuelle Charpentier won the Nobel Prize for developing this precise gene editing tool. 
                 The technology allows scientists to modify DNA sequences with unprecedented accuracy. Applications 
                 include treating genetic diseases, improving crop yields, and developing new therapeutic approaches. 
                 Biotech companies like Moderna used mRNA technology to develop COVID-19 vaccines.`
      }
    ];

    console.log(chalk.white(`\n📚 Generated corpus with ${this.corpusData.length} documents:`));
    this.corpusData.forEach((doc, index) => {
      console.log(chalk.cyan(`   ${index + 1}. ${doc.source}: ${doc.content.length} characters`));
    });

    this.logSuccess(`Corpus prepared with ${this.corpusData.reduce((sum, doc) => sum + doc.content.length, 0)} total characters`);
  }

  // === MCP CONNECTION MANAGEMENT ===

  async initializeConnection() {
    this.logBanner('MCP Connection Initialization', 'Connecting to Semem MCP Server for Ragno operations');

    try {
      log.info('Creating stdio transport...');
      this.transport = new StdioClientTransport({
        command: 'node',
        args: ['mcp/index.js']
      });

      log.info('Creating MCP client...');
      this.client = new Client({
        name: 'ragno-corpus-decomposition-demo',
        version: '1.0.0'
      }, {
        capabilities: {
          tools: {},
          resources: {}
        }
      });

      const startTime = Date.now();
      await this.client.connect(this.transport);
      const connectionTime = Date.now() - startTime;

      this.logSuccess('MCP connection established');
      this.logPerformance('Connection', connectionTime);

      // Test connection and list available Ragno tools
      const tools = await this.client.listTools();
      const ragnoTools = tools.tools.filter(tool => tool.name.startsWith('ragno_'));

      this.logSuccess(`Found ${ragnoTools.length} Ragno tools available`);
      ragnoTools.forEach(tool => {
        console.log(chalk.gray(`   🔧 ${tool.name}: ${tool.description.slice(0, 80)}...`));
      });

    } catch (error) {
      this.logError('Failed to initialize MCP connection', error);
      throw error;
    }
  }

  // === CORPUS DECOMPOSITION DEMONSTRATIONS ===

  async demonstrateCorpusDecomposition() {
    this.logBanner('Corpus Decomposition', 'Transforming text corpus into RDF knowledge graph');

    this.logStep(1, 'Preparing text chunks for decomposition');

    const textChunks = this.corpusData.map((doc, index) => ({
      content: doc.content,
      source: doc.source
    }));

    console.log(chalk.white(`   📊 Prepared ${textChunks.length} text chunks for processing`));

    this.logStep(2, 'Executing corpus decomposition with entity extraction');

    try {
      const startTime = Date.now();
      const result = await this.client.callTool({
        name: 'ragno_decompose_corpus',
        arguments: {
          textChunks: textChunks,
          options: {
            extractRelationships: true,
            generateSummaries: true,
            maxEntitiesPerUnit: 20,
            minEntityConfidence: 0.5
          }
        }
      });
      const duration = Date.now() - startTime;

      if (result.content && result.content[0]) {
        const decomposition = JSON.parse(result.content[0].text);
        this.logSuccess('Corpus decomposition completed');
        this.logPerformance('Decomposition', duration, { chunks: textChunks.length });

        if (decomposition.success) {
          const { units, entities, relationships, dataset } = decomposition;

          console.log(chalk.white('\n🎯 Decomposition Results:'));
          console.log(chalk.green(`   📦 Semantic Units: ${units?.length || 0}`));
          console.log(chalk.green(`   🏷️  Entities: ${entities?.length || 0}`));
          console.log(chalk.green(`   🔗 Relationships: ${relationships?.length || 0}`));
          console.log(chalk.green(`   📊 RDF Triples: ${dataset?.size || 0}`));

          this.logKnowledgeGraph(entities?.length || 0, relationships?.length || 0);

          // Sample entities
          if (entities && entities.length > 0) {
            console.log(chalk.cyan('\n🏷️  Sample Entities:'));
            entities.slice(0, 5).forEach((entity, index) => {
              console.log(chalk.white(`   ${index + 1}. ${entity.name || entity.id} (${entity.type || 'Entity'})`));
            });
          }

          // Sample relationships
          if (relationships && relationships.length > 0) {
            console.log(chalk.cyan('\n🔗 Sample Relationships:'));
            relationships.slice(0, 3).forEach((rel, index) => {
              console.log(chalk.white(`   ${index + 1}. ${rel.subject || 'Subject'} → ${rel.predicate || 'relates to'} → ${rel.object || 'Object'}`));
            });
          }

          this.decompositionResults.push({
            units: units?.length || 0,
            entities: entities?.length || 0,
            relationships: relationships?.length || 0,
            triples: dataset?.size || 0,
            duration
          });

          this.extractedEntities = entities || [];
        }
      }

      this.performanceMetrics.decompositions.push({ duration, chunks: textChunks.length });

    } catch (error) {
      this.logError('Corpus decomposition failed', error);
    }
  }

  async demonstrateEntityRetrieval() {
    this.logBanner('Entity Retrieval', 'Exploring extracted entities with filtering and pagination');

    this.logStep(1, 'Retrieving all entities from the knowledge graph');

    try {
      const startTime = Date.now();
      const result = await this.client.callTool({
        name: 'ragno_get_entities',
        arguments: {
          filters: {
            limit: 20,
            minFrequency: 1,
            includeMetadata: true
          }
        }
      });
      const duration = Date.now() - startTime;

      if (result.content && result.content[0]) {
        const entityData = JSON.parse(result.content[0].text);
        this.logSuccess('Entity retrieval completed');
        this.logPerformance('Entity retrieval', duration);

        if (entityData.success && entityData.entities) {
          console.log(chalk.white(`\\n📊 Retrieved ${entityData.entities.length} entities`));

          // Group entities by type
          const entityTypes = {};
          entityData.entities.forEach(entity => {
            const type = entity.type || 'Unknown';
            entityTypes[type] = (entityTypes[type] || 0) + 1;
          });

          console.log(chalk.cyan('\\n📈 Entity Distribution:'));
          Object.entries(entityTypes).forEach(([type, count]) => {
            console.log(chalk.white(`   ${type}: ${count} entities`));
          });

          // Show detailed entity information
          console.log(chalk.cyan('\\n🏷️  Detailed Entity Information:'));
          entityData.entities.slice(0, 5).forEach((entity, index) => {
            console.log(chalk.white(`   ${index + 1}. ${entity.name || entity.id}`));
            console.log(chalk.gray(`      Type: ${entity.type || 'N/A'}`));
            console.log(chalk.gray(`      Frequency: ${entity.frequency || 'N/A'}`));
            if (entity.attributes && entity.attributes.length > 0) {
              console.log(chalk.gray(`      Attributes: ${entity.attributes.slice(0, 3).join(', ')}`));
            }
          });
        }
      }

      this.performanceMetrics.entityExtractions.push({ duration });

    } catch (error) {
      this.logError('Entity retrieval failed', error);
    }
  }

  async demonstrateGraphStatistics() {
    this.logBanner('Knowledge Graph Statistics', 'Analyzing graph structure and characteristics');

    this.logStep(1, 'Retrieving comprehensive graph statistics');

    try {
      const startTime = Date.now();
      const result = await this.client.callTool({
        name: 'ragno_get_graph_stats',
        arguments: {
          detailed: true
        }
      });
      const duration = Date.now() - startTime;

      if (result.content && result.content[0]) {
        const stats = JSON.parse(result.content[0].text);
        this.logSuccess('Graph statistics retrieved');
        this.logPerformance('Statistics retrieval', duration);

        if (stats.success && stats.statistics) {
          console.log(chalk.white('\\n📊 Knowledge Graph Statistics:'));

          if (stats.statistics.basic) {
            console.log(chalk.green('\\n📈 Basic Metrics:'));
            Object.entries(stats.statistics.basic).forEach(([metric, value]) => {
              console.log(chalk.white(`   ${metric}: ${value}`));
            });
          }

          if (stats.statistics.detailed) {
            console.log(chalk.green('\\n🔍 Detailed Analysis:'));
            if (stats.statistics.detailed.entityTypes) {
              console.log(chalk.cyan('   Entity Types:'));
              Object.entries(stats.statistics.detailed.entityTypes).forEach(([type, count]) => {
                console.log(chalk.white(`     ${type}: ${count}`));
              });
            }

            if (stats.statistics.detailed.relationshipTypes) {
              console.log(chalk.cyan('   Relationship Types:'));
              Object.entries(stats.statistics.detailed.relationshipTypes).forEach(([type, count]) => {
                console.log(chalk.white(`     ${type}: ${count}`));
              });
            }
          }

          if (stats.statistics.performance) {
            console.log(chalk.green('\\n⚡ Performance Metrics:'));
            Object.entries(stats.statistics.performance).forEach(([metric, value]) => {
              console.log(chalk.white(`   ${metric}: ${value}`));
            });
          }
        }
      }

    } catch (error) {
      this.logError('Graph statistics retrieval failed', error);
    }
  }

  async demonstrateRDFExport() {
    this.logBanner('RDF Export', 'Exporting knowledge graph in multiple semantic web formats');

    const formats = [
      { name: 'turtle', description: 'Turtle (TTL) - Human-readable RDF format' },
      { name: 'ntriples', description: 'N-Triples - Simple line-based RDF format' },
      { name: 'jsonld', description: 'JSON-LD - JSON-based linked data format' }
    ];

    for (const format of formats) {
      this.logStep(formats.indexOf(format) + 1, `Exporting graph as ${format.description}`);

      try {
        const startTime = Date.now();
        const result = await this.client.callTool({
          name: 'ragno_export_rdf',
          arguments: {
            format: format.name,
            includeEmbeddings: false,
            includeStatistics: true
          }
        });
        const duration = Date.now() - startTime;

        if (result.content && result.content[0]) {
          const exportData = JSON.parse(result.content[0].text);
          this.logSuccess(`RDF export completed in ${format.name} format`);
          this.logPerformance(`${format.name} export`, duration);

          if (exportData.success && exportData.rdf) {
            console.log(chalk.white(`   📄 Export size: ${exportData.rdf.length} characters`));
            console.log(chalk.gray(`   📝 Sample: ${exportData.rdf.slice(0, 100)}...`));

            if (exportData.statistics) {
              console.log(chalk.cyan(`   📊 Triples exported: ${exportData.statistics.tripleCount || 'N/A'}`));
            }
          }
        }

        this.performanceMetrics.exports.push({ format: format.name, duration });

      } catch (error) {
        this.logError(`RDF export failed for ${format.name}`, error);
      }
    }
  }

  async demonstrateSPARQLQueries() {
    this.logBanner('SPARQL Querying', 'Exploring knowledge graph with semantic web queries');

    const queries = [
      {
        name: 'Entity Count',
        description: 'Count all entities in the graph',
        sparql: `
          PREFIX ragno: <http://purl.org/stuff/ragno/>
          SELECT (COUNT(DISTINCT ?entity) AS ?count) WHERE {
            ?entity a ragno:Entity .
          }`
      },
      {
        name: 'Entity Types',
        description: 'List different entity types',
        sparql: `
          PREFIX ragno: <http://purl.org/stuff/ragno/>
          PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
          SELECT DISTINCT ?type (COUNT(?entity) AS ?count) WHERE {
            ?entity a ragno:Entity ;
                   rdf:type ?type .
          } GROUP BY ?type ORDER BY DESC(?count)`
      },
      {
        name: 'Relationships',
        description: 'Find entity relationships',
        sparql: `
          PREFIX ragno: <http://purl.org/stuff/ragno/>
          SELECT DISTINCT ?subject ?predicate ?object WHERE {
            ?rel a ragno:Relationship ;
                 ragno:hasSubject ?subject ;
                 ragno:hasPredicate ?predicate ;
                 ragno:hasObject ?object .
          } LIMIT 10`
      }
    ];

    for (const query of queries) {
      this.logStep(queries.indexOf(query) + 1, `${query.name}: ${query.description}`);

      try {
        const startTime = Date.now();
        const result = await this.client.callTool({
          name: 'ragno_query_sparql',
          arguments: {
            query: query.sparql,
            options: {
              limit: 100,
              format: 'json'
            }
          }
        });
        const duration = Date.now() - startTime;

        if (result.content && result.content[0]) {
          const queryResult = JSON.parse(result.content[0].text);
          this.logSuccess(`SPARQL query executed: ${query.name}`);
          this.logPerformance(`${query.name} query`, duration);

          if (queryResult.success && queryResult.results) {
            console.log(chalk.white(`   📊 Results: ${queryResult.results.length || 0} rows`));

            if (queryResult.results.length > 0) {
              console.log(chalk.cyan('   📋 Sample results:'));
              queryResult.results.slice(0, 3).forEach((row, index) => {
                console.log(chalk.gray(`     ${index + 1}. ${JSON.stringify(row)}`));
              });
            }
          }
        }

        this.performanceMetrics.queries.push({ name: query.name, duration });

      } catch (error) {
        this.logError(`SPARQL query failed: ${query.name}`, error);
      }
    }
  }

  // === PERFORMANCE SUMMARY ===

  generatePerformanceSummary() {
    this.logBanner('Performance Summary', 'Ragno Corpus Decomposition Demo Results');

    const totalDuration = Date.now() - this.startTime;
    const totalDecompositions = this.decompositionResults.length;

    console.log(chalk.white('\\n📊 Overall Statistics:'));
    console.log(chalk.green(`   ✅ Total demo duration: ${(totalDuration / 1000).toFixed(1)}s`));
    console.log(chalk.green(`   ✅ Corpus documents processed: ${this.corpusData.length}`));
    console.log(chalk.green(`   ✅ Decompositions completed: ${totalDecompositions}`));
    console.log(chalk.green(`   ✅ Operations completed: ${this.operationCount}`));

    if (this.decompositionResults.length > 0) {
      const result = this.decompositionResults[0];
      console.log(chalk.white('\\n🕸️  Knowledge Graph Results:'));
      console.log(chalk.cyan(`   📦 Semantic Units: ${result.units}`));
      console.log(chalk.cyan(`   🏷️  Entities: ${result.entities}`));
      console.log(chalk.cyan(`   🔗 Relationships: ${result.relationships}`));
      console.log(chalk.cyan(`   📊 RDF Triples: ${result.triples}`));
    }

    if (this.performanceMetrics.decompositions.length > 0) {
      const decompositionTimes = this.performanceMetrics.decompositions.map(d => d.duration);
      const avgDecomposition = decompositionTimes.reduce((a, b) => a + b, 0) / decompositionTimes.length;

      console.log(chalk.white('\\n⚡ Performance Metrics:'));
      console.log(chalk.cyan(`   Corpus decomposition: ${avgDecomposition.toFixed(0)}ms`));

      if (this.performanceMetrics.exports.length > 0) {
        const exportTimes = this.performanceMetrics.exports.map(e => e.duration);
        const avgExport = exportTimes.reduce((a, b) => a + b, 0) / exportTimes.length;
        console.log(chalk.cyan(`   Average RDF export: ${avgExport.toFixed(0)}ms`));
      }
    }

    console.log(chalk.magenta.bold('\\n🎉 Ragno Corpus Decomposition Demo Complete!'));
    console.log(chalk.white('   Next steps: Try RagnoSearchAndRetrieval.js for advanced graph querying'));
  }

  // === CLEANUP ===

  async cleanup() {
    if (this.client) {
      try {
        await this.client.close();
        log.info('MCP client connection closed');
      } catch (error) {
        log.error('Error closing MCP client:', error);
      }
    }
  }

  // === MAIN DEMO ORCHESTRATION ===

  async runFullDemo() {
    try {
      console.log(chalk.green('🕸️  Welcome to the Ragno Corpus Decomposition Demo! 🕸️'));
      console.log(chalk.white('This demo will show you how to transform text into knowledge graphs.\\n'));

      // Educational overview
      this.explainRagnoConcepts();

      // Generate sample corpus
      this.generateSampleCorpus();

      // Initialize connection
      await this.initializeConnection();

      // Corpus decomposition
      await this.demonstrateCorpusDecomposition();

      // Entity retrieval
      await this.demonstrateEntityRetrieval();

      // Graph statistics
      await this.demonstrateGraphStatistics();

      // RDF export
      await this.demonstrateRDFExport();

      // SPARQL queries
      await this.demonstrateSPARQLQueries();

      // Performance summary
      this.generatePerformanceSummary();

    } catch (error) {
      this.logError('Demo failed with critical error', error);
      process.exit(1);
    } finally {
      await this.cleanup();
    }
  }
}

// === SCRIPT EXECUTION ===

if (import.meta.url === `file://${process.argv[1]}`) {
  const demo = new RagnoCorpusDecompositionDemo();
  demo.runFullDemo().catch(error => {
    console.error(chalk.red('Fatal error:'), error);
    process.exit(1);
  });
}

export default RagnoCorpusDecompositionDemo;