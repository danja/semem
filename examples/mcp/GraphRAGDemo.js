#!/usr/bin/env node

/**
 * GraphRAG Features Demonstration
 * 
 * This example showcases the new GraphRAG-compatible tools added to Semem MCP server:
 * - Document management (store, list, delete)
 * - Relationship management (create, search, delete)
 * - Hybrid search (vector + graph traversal)
 * - Graph analytics and traversal
 * - Enhanced retrieval and observations
 * 
 * Features verbose logging with chalk colors and detailed progress tracking.
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import chalk from 'chalk';
import log from 'loglevel';

// Configure logging
log.setLevel('DEBUG');

class GraphRAGDemo {
  constructor() {
    this.client = null;
    this.transport = null;
    this.startTime = Date.now();
    this.documentIds = [];
    this.relationshipIds = [];
    this.entityIds = [];
  }

  // === UTILITY METHODS ===

  logHeader(title) {
    const elapsed = ((Date.now() - this.startTime) / 1000).toFixed(1);
    console.log(chalk.cyan.bold(`\n${'='.repeat(60)}`));
    console.log(chalk.cyan.bold(`🔬 ${title.toUpperCase()}`));
    console.log(chalk.gray(`   Time elapsed: ${elapsed}s`));
    console.log(chalk.cyan.bold(`${'='.repeat(60)}`));
  }

  logStep(step, description) {
    console.log(chalk.yellow.bold(`\n${step} ${description}`));
  }

  logSuccess(message, data = null) {
    console.log(chalk.green(`   ✅ ${message}`));
    if (data) {
      console.log(chalk.gray(`   📊 ${JSON.stringify(data, null, 2)}`));
    }
  }

  logInfo(message, data = null) {
    console.log(chalk.blue(`   ℹ️  ${message}`));
    if (data) {
      console.log(chalk.gray(`   📋 ${typeof data === 'object' ? JSON.stringify(data, null, 2) : data}`));
    }
  }

  logWarning(message) {
    console.log(chalk.orange(`   ⚠️  ${message}`));
  }

  logError(message, error = null) {
    console.log(chalk.red(`   ❌ ${message}`));
    if (error) {
      console.log(chalk.red(`   🚨 ${error}`));
    }
  }

  async measurePerformance(operation, operationName) {
    const start = Date.now();
    this.logInfo(`Starting ${operationName}...`);
    
    try {
      const result = await operation();
      const duration = Date.now() - start;
      this.logSuccess(`${operationName} completed in ${duration}ms`, { duration, success: true });
      return result;
    } catch (error) {
      const duration = Date.now() - start;
      this.logError(`${operationName} failed after ${duration}ms`, error.message);
      throw error;
    }
  }

  async callTool(name, args) {
    log.debug(`Calling tool: ${name}`, args);
    
    try {
      const result = await this.client.callTool({ name, arguments: args });
      const parsedResult = JSON.parse(result.content[0].text);
      
      if (parsedResult.success) {
        log.debug(`Tool ${name} succeeded`, parsedResult);
        return parsedResult;
      } else {
        log.warn(`Tool ${name} returned failure`, parsedResult);
        return parsedResult;
      }
    } catch (error) {
      log.error(`Tool ${name} failed:`, error.message);
      throw error;
    }
  }

  // === CONNECTION MANAGEMENT ===

  async connect() {
    this.logHeader('MCP Connection Setup');
    
    this.logStep('1️⃣', 'Initializing MCP client...');
    this.client = new Client({ 
      name: "graphrag-demo-client", 
      version: "1.0.0" 
    });
    
    this.logStep('2️⃣', 'Setting up stdio transport...');
    this.transport = new StdioClientTransport({
      command: 'node',
      args: ['./mcp/index.js'],
      cwd: process.cwd()
    });

    this.logStep('3️⃣', 'Connecting to Semem MCP server...');
    await this.client.connect(this.transport);
    this.logSuccess('Connected to Semem MCP server!');
    
    // List available tools and resources
    this.logStep('4️⃣', 'Discovering server capabilities...');
    const tools = await this.client.listTools();
    const resources = await this.client.listResources();
    
    this.logSuccess(`Found ${tools.tools.length} tools and ${resources.resources.length} resources`);
    
    // Show GraphRAG tools specifically
    const graphragTools = tools.tools.filter(tool => 
      ['store_document', 'list_documents', 'create_relations', 'hybrid_search', 
       'search_nodes', 'read_graph', 'get_knowledge_graph_stats', 
       'search_documentation', 'add_observations'].includes(tool.name)
    );
    
    this.logInfo(`GraphRAG Tools Available (${graphragTools.length}/9):`, 
      graphragTools.map(t => `${t.name}: ${t.description || 'No description'}`));
    
    return this;
  }

  async disconnect() {
    if (this.client) {
      await this.client.close();
      this.logSuccess('Disconnected from MCP server');
    }
  }

  // === DOCUMENT MANAGEMENT DEMONSTRATION ===

  async demonstrateDocumentManagement() {
    this.logHeader('Document Management (GraphRAG Core)');
    
    const documents = [
      {
        content: "Artificial Intelligence (AI) is the simulation of human intelligence in machines. It encompasses machine learning, natural language processing, computer vision, and robotics. AI systems can perform tasks that typically require human cognition.",
        metadata: {
          title: "Introduction to Artificial Intelligence",
          author: "AI Research Lab",
          type: "research",
          tags: ["ai", "machine-learning", "technology"],
          created: "2024-01-15"
        }
      },
      {
        content: "Machine Learning is a subset of artificial intelligence that enables computers to learn and improve from experience without being explicitly programmed. It includes supervised learning, unsupervised learning, and reinforcement learning approaches.",
        metadata: {
          title: "Machine Learning Fundamentals", 
          author: "ML Engineering Team",
          type: "tutorial",
          tags: ["machine-learning", "algorithms", "data-science"],
          created: "2024-02-10"
        }
      },
      {
        content: "Deep Learning uses neural networks with multiple layers to model and understand complex patterns in data. It has revolutionized fields like computer vision, natural language processing, and speech recognition through architectures like CNNs, RNNs, and Transformers.",
        metadata: {
          title: "Deep Learning and Neural Networks",
          author: "Neural Network Lab", 
          type: "research",
          tags: ["deep-learning", "neural-networks", "transformers"],
          created: "2024-03-05"
        }
      }
    ];

    // Store documents
    this.logStep('1️⃣', 'Storing documents with metadata and embeddings...');
    for (let i = 0; i < documents.length; i++) {
      const doc = documents[i];
      this.logInfo(`Storing document ${i + 1}: "${doc.metadata.title}"`);
      
      const result = await this.measurePerformance(
        () => this.callTool('store_document', doc),
        `Document storage #${i + 1}`
      );
      
      if (result && result.success) {
        this.documentIds.push(result.documentId);
        this.logSuccess(`Document stored with ID: ${result.documentId}`);
        this.logInfo('Document details:', {
          id: result.documentId,
          title: result.title,
          contentLength: result.contentLength,
          conceptCount: result.conceptCount
        });
      }
    }

    // List documents
    this.logStep('2️⃣', 'Listing stored documents...');
    const listResult = await this.measurePerformance(
      () => this.callTool('list_documents', { limit: 10, offset: 0 }),
      'Document listing'
    );
    
    if (listResult && listResult.success) {
      this.logSuccess(`Retrieved ${listResult.returned} of ${listResult.total} documents`);
      listResult.documents.forEach((doc, i) => {
        this.logInfo(`Document ${i + 1}:`, {
          id: doc.documentId,
          title: doc.title,
          author: doc.author,
          type: doc.type,
          tags: doc.tags,
          conceptCount: doc.conceptCount
        });
      });
    }

    // Filter documents by type
    this.logStep('3️⃣', 'Filtering documents by type...');
    const filterResult = await this.measurePerformance(
      () => this.callTool('list_documents', { 
        filter: { type: "research" },
        limit: 5 
      }),
      'Document filtering'
    );
    
    if (filterResult && filterResult.success) {
      this.logSuccess(`Found ${filterResult.returned} research documents`);
      filterResult.documents.forEach(doc => {
        this.logInfo(`Research doc: ${doc.title} by ${doc.author}`);
      });
    }
  }

  // === RELATIONSHIP MANAGEMENT DEMONSTRATION ===

  async demonstrateRelationshipManagement() {
    this.logHeader('Relationship Management (Graph Building)');
    
    const relationships = [
      {
        sourceEntity: "artificial_intelligence",
        targetEntity: "machine_learning",
        relationshipType: "includes",
        description: "Artificial Intelligence includes Machine Learning as a core subset",
        weight: 0.9
      },
      {
        sourceEntity: "machine_learning", 
        targetEntity: "deep_learning",
        relationshipType: "includes",
        description: "Machine Learning includes Deep Learning as an advanced technique",
        weight: 0.8
      },
      {
        sourceEntity: "deep_learning",
        targetEntity: "neural_networks", 
        relationshipType: "uses",
        description: "Deep Learning uses Neural Networks as its foundation",
        weight: 0.95
      },
      {
        sourceEntity: "artificial_intelligence",
        targetEntity: "natural_language_processing",
        relationshipType: "includes",
        description: "AI includes NLP for language understanding",
        weight: 0.85
      },
      {
        sourceEntity: "neural_networks",
        targetEntity: "transformers",
        relationshipType: "evolves_to", 
        description: "Neural Networks evolved to Transformer architectures",
        weight: 0.75
      }
    ];

    // Create relationships
    this.logStep('1️⃣', 'Creating entity relationships...');
    for (let i = 0; i < relationships.length; i++) {
      const rel = relationships[i];
      this.logInfo(`Creating relationship ${i + 1}: ${rel.sourceEntity} → ${rel.targetEntity} (${rel.relationshipType})`);
      
      const result = await this.measurePerformance(
        () => this.callTool('create_relations', rel),
        `Relationship creation #${i + 1}`
      );
      
      if (result && result.success) {
        this.relationshipIds.push(result.relationship.id);
        this.logSuccess(`Relationship created with ID: ${result.relationship.id}`);
        this.logInfo('Relationship details:', {
          id: result.relationship.id,
          type: result.relationship.relationshipType,
          weight: result.relationship.weight,
          description: result.relationship.description
        });
        
        // Track entities
        this.entityIds.push(rel.sourceEntity, rel.targetEntity);
      }
    }

    // Remove duplicates from entity list
    this.entityIds = [...new Set(this.entityIds)];
    this.logInfo(`Tracked ${this.entityIds.length} unique entities:`, this.entityIds);

    // Search relationships by entity
    this.logStep('2️⃣', 'Searching relationships by entity...');
    const searchEntity = "artificial_intelligence";
    const searchResult = await this.measurePerformance(
      () => this.callTool('search_relations', {
        entityId: searchEntity,
        direction: "both",
        limit: 10
      }),
      `Relationship search for ${searchEntity}`
    );
    
    if (searchResult && searchResult.success) {
      this.logSuccess(`Found ${searchResult.count} relationships for ${searchEntity}`);
      searchResult.relationships.forEach((rel, i) => {
        this.logInfo(`Relationship ${i + 1}:`, {
          source: rel.source,
          target: rel.target,
          type: rel.relationshipType,
          weight: rel.weight
        });
      });
    }

    // Search by relationship type
    this.logStep('3️⃣', 'Searching relationships by type...');
    const typeSearchResult = await this.measurePerformance(
      () => this.callTool('search_relations', {
        relationshipType: "includes",
        limit: 5
      }),
      'Relationship search by type'
    );
    
    if (typeSearchResult && typeSearchResult.success) {
      this.logSuccess(`Found ${typeSearchResult.count} "includes" relationships`);
      typeSearchResult.relationships.forEach(rel => {
        this.logInfo(`${rel.source} includes ${rel.target} (weight: ${rel.weight})`);
      });
    }
  }

  // === HYBRID SEARCH DEMONSTRATION ===

  async demonstrateHybridSearch() {
    this.logHeader('Hybrid Search (Core GraphRAG Feature)');
    
    const queries = [
      {
        query: "machine learning algorithms and neural networks",
        options: {
          maxResults: 15,
          vectorWeight: 0.7,
          graphWeight: 0.3,
          similarityThreshold: 0.6,
          graphDepth: 2,
          includeDocuments: true,
          includeEntities: true,
          includeRelationships: true
        }
      },
      {
        query: "artificial intelligence research applications",
        options: {
          maxResults: 20,
          vectorWeight: 0.5,
          graphWeight: 0.5,
          similarityThreshold: 0.7,
          graphDepth: 3,
          includeDocuments: true,
          includeEntities: true,
          includeRelationships: true,
          zptParams: {
            zoom: "entity",
            tilt: "embedding"
          }
        }
      }
    ];

    for (let i = 0; i < queries.length; i++) {
      const { query, options } = queries[i];
      
      this.logStep(`${i + 1}️⃣`, `Hybrid search: "${query}"`);
      this.logInfo('Search configuration:', {
        vectorWeight: options.vectorWeight,
        graphWeight: options.graphWeight,
        graphDepth: options.graphDepth,
        threshold: options.similarityThreshold
      });
      
      const result = await this.measurePerformance(
        () => this.callTool('hybrid_search', { query, options }),
        `Hybrid search #${i + 1}`
      );
      
      if (result && result.success !== false) {
        this.logSuccess('Hybrid search completed successfully');
        
        // Log summary statistics
        this.logInfo('Search Results Summary:', result.summary);
        
        // Show top documents
        if (result.documents && result.documents.length > 0) {
          this.logInfo(`Top ${Math.min(3, result.documents.length)} Documents:`);
          result.documents.slice(0, 3).forEach((doc, idx) => {
            this.logInfo(`Document ${idx + 1}:`, {
              title: doc.title,
              similarity: doc.similarity?.toFixed(3),
              hybridScore: doc.hybridScore?.toFixed(3),
              concepts: doc.concepts?.slice(0, 3)
            });
          });
        }
        
        // Show related entities
        if (result.entities && result.entities.length > 0) {
          this.logInfo(`Related Entities (${result.entities.length}):`, 
            result.entities.map(e => `${e.name} (${e.type})`));
        }
        
        // Show relationships
        if (result.relationships && result.relationships.length > 0) {
          this.logInfo(`Related Relationships (${result.relationships.length}):`);
          result.relationships.slice(0, 3).forEach(rel => {
            this.logInfo(`${rel.source} → ${rel.target} (${rel.relationshipType})`);
          });
        }
        
        // ZPT integration results
        if (result.zptResults) {
          this.logInfo('ZPT Navigation Results:', {
            corpuscleCount: result.zptResults.corpuscleCount,
            hasError: !!result.zptResults.error
          });
        }
      }
    }
  }

  // === GRAPH ANALYTICS DEMONSTRATION ===

  async demonstrateGraphAnalytics() {
    this.logHeader('Graph Analytics & Traversal');
    
    // Get knowledge graph statistics
    this.logStep('1️⃣', 'Analyzing knowledge graph statistics...');
    const statsResult = await this.measurePerformance(
      () => this.callTool('get_knowledge_graph_stats', { includeDetails: true }),
      'Knowledge graph analysis'
    );
    
    if (statsResult && statsResult.success) {
      this.logSuccess('Graph statistics retrieved');
      this.logInfo('Overview Statistics:', statsResult.statistics.overview);
      
      if (statsResult.statistics.types) {
        this.logInfo('Content Types:', statsResult.statistics.types);
      }
      
      if (statsResult.statistics.connectivity) {
        this.logInfo('Connectivity Metrics:', statsResult.statistics.connectivity);
      }
    }

    // Search for nodes
    this.logStep('2️⃣', 'Searching graph nodes...');
    const nodeSearchResult = await this.measurePerformance(
      () => this.callTool('search_nodes', {
        query: "artificial",
        nodeType: "concept", 
        limit: 10,
        includeConnections: true
      }),
      'Node search'
    );
    
    if (nodeSearchResult && nodeSearchResult.success) {
      this.logSuccess(`Found ${nodeSearchResult.count} nodes matching "artificial"`);
      nodeSearchResult.nodes.forEach((node, i) => {
        this.logInfo(`Node ${i + 1}:`, {
          id: node.id,
          name: node.name,
          type: node.type,
          connections: node.connections
        });
      });
    }

    // Read graph structure
    this.logStep('3️⃣', 'Reading graph structure...');
    if (this.entityIds.length > 0) {
      const rootNodes = this.entityIds.slice(0, 2); // Use first 2 entities as roots
      
      const graphResult = await this.measurePerformance(
        () => this.callTool('read_graph', {
          rootNodes,
          maxDepth: 2,
          format: "adjacency",
          includeMetadata: true
        }),
        'Graph structure reading'
      );
      
      if (graphResult && graphResult.success) {
        this.logSuccess('Graph structure retrieved');
        this.logInfo('Graph Statistics:', graphResult.statistics);
        
        // Show sample adjacencies
        const graphData = graphResult.graph;
        const nodeIds = Object.keys(graphData).slice(0, 3);
        
        this.logInfo('Sample Graph Structure:');
        nodeIds.forEach(nodeId => {
          const node = graphData[nodeId];
          this.logInfo(`${nodeId} (${node.node.type}):`, {
            connections: node.connections.length,
            sample_connections: node.connections.slice(0, 2)
          });
        });
      }
    }
  }

  // === ENHANCED RETRIEVAL DEMONSTRATION ===

  async demonstrateEnhancedRetrieval() {
    this.logHeader('Enhanced Retrieval & Observations');
    
    // Semantic document search
    this.logStep('1️⃣', 'Advanced document search...');
    const searchResult = await this.measurePerformance(
      () => this.callTool('search_documentation', {
        query: "deep learning neural network architectures",
        options: {
          maxResults: 5,
          sortBy: "relevance",
          documentTypes: ["research", "tutorial"],
          includeContent: true,
          contentLength: 200
        }
      }),
      'Document search'
    );
    
    if (searchResult && searchResult.success) {
      this.logSuccess(`Found ${searchResult.summary.returned} relevant documents`);
      this.logInfo('Search Summary:', searchResult.summary);
      
      searchResult.documents.forEach((doc, i) => {
        this.logInfo(`Document ${i + 1}:`, {
          title: doc.title,
          similarity: doc.similarity?.toFixed(3),
          type: doc.metadata.type,
          concepts: doc.concepts?.slice(0, 3)
        });
      });
    }

    // Add observations to entities
    this.logStep('2️⃣', 'Adding entity observations...');
    if (this.entityIds.length > 0) {
      const entityId = this.entityIds[0]; // Use first entity
      
      const observations = [
        {
          text: "This entity is fundamental to modern AI research and applications",
          type: "importance",
          source: "research_analysis", 
          confidence: 0.9
        },
        {
          text: "Rapidly evolving field with new breakthroughs emerging frequently",
          type: "trend",
          source: "market_analysis",
          confidence: 0.85
        },
        {
          text: "Critical for understanding the broader AI ecosystem and relationships",
          type: "context",
          source: "domain_expert",
          confidence: 0.88
        }
      ];
      
      const obsResult = await this.measurePerformance(
        () => this.callTool('add_observations', {
          entityId,
          observations,
          overwrite: false
        }),
        'Entity enrichment'
      );
      
      if (obsResult && obsResult.success) {
        this.logSuccess(`Added ${obsResult.observationsAdded} observations to ${entityId}`);
        this.logInfo('Enrichment Details:', {
          entityId: obsResult.entityId,
          observationCount: obsResult.observationsAdded,
          relatedMemories: obsResult.relatedMemories,
          avgConfidence: obsResult.enrichmentInfo.avgConfidence
        });
      }
    }
  }

  // === MAIN DEMONSTRATION FLOW ===

  async runFullDemo() {
    try {
      console.log(chalk.magenta.bold('🚀 SEMEM GRAPHRAG DEMONSTRATION'));
      console.log(chalk.magenta.bold('====================================='));
      console.log(chalk.gray(`Started at: ${new Date().toISOString()}`));
      
      // Connect to server
      await this.connect();
      
      // Run all demonstrations
      await this.demonstrateDocumentManagement();
      await this.demonstrateRelationshipManagement(); 
      await this.demonstrateHybridSearch();
      await this.demonstrateGraphAnalytics();
      await this.demonstrateEnhancedRetrieval();
      
      // Final summary
      this.logHeader('Demo Completion Summary');
      const totalTime = ((Date.now() - this.startTime) / 1000).toFixed(1);
      
      this.logSuccess(`🎉 GraphRAG demonstration completed in ${totalTime}s`);
      this.logInfo('Resources Created:', {
        documents: this.documentIds.length,
        relationships: this.relationshipIds.length,
        entities: this.entityIds.length
      });
      
      this.logInfo('Features Demonstrated:', [
        '✅ Document storage with metadata and embeddings',
        '✅ Relationship creation and graph building', 
        '✅ Hybrid vector + graph search',
        '✅ Graph analytics and traversal',
        '✅ Advanced document retrieval',
        '✅ Entity enrichment with observations'
      ]);
      
      console.log(chalk.green.bold('\n🏆 All GraphRAG features successfully demonstrated!'));
      
    } catch (error) {
      this.logError('Demo failed', error.message);
      log.error('Full error details:', error);
      throw error;
    } finally {
      await this.disconnect();
    }
  }
}

// Main execution
async function main() {
  const demo = new GraphRAGDemo();
  
  try {
    await demo.runFullDemo();
  } catch (error) {
    console.error(chalk.red.bold('❌ Demo execution failed:'), error.message);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log(chalk.yellow('\n👋 Shutting down GraphRAG demo...'));
  process.exit(0);
});

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export default GraphRAGDemo;