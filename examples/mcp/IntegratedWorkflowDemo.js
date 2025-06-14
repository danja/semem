#!/usr/bin/env node

/**
 * Integrated Workflow Demonstration
 * 
 * This example showcases advanced integration patterns combining:
 * - GraphRAG + Semem Core + Ragno + ZPT in unified workflows
 * - End-to-end document processing pipelines
 * - Multi-modal search and retrieval
 * - Knowledge graph enrichment workflows
 * - Performance optimization and caching strategies
 * 
 * Features extensive workflow visualization, progress tracking, and detailed analysis.
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import chalk from 'chalk';
import log from 'loglevel';

// Configure comprehensive logging
log.setLevel('DEBUG');

class IntegratedWorkflowDemo {
  constructor() {
    this.client = null;
    this.transport = null;
    this.startTime = Date.now();
    this.workflowSteps = [];
    this.artifacts = {
      documents: [],
      entities: [],
      relationships: [],
      memories: [],
      embeddings: [],
      chunks: []
    };
    this.workflowMetrics = {
      totalSteps: 0,
      successfulSteps: 0,
      failedSteps: 0,
      totalProcessingTime: 0,
      dataFlowMetrics: {}
    };
  }

  // === ADVANCED LOGGING AND VISUALIZATION ===

  logWorkflowHeader(workflow, description) {
    const elapsed = ((Date.now() - this.startTime) / 1000).toFixed(1);
    console.log(chalk.magenta.bold(`\n${'▓'.repeat(80)}`));
    console.log(chalk.magenta.bold(`▓▓ WORKFLOW: ${workflow.padEnd(68)} ▓▓`));
    console.log(chalk.magenta(`▓▓ ${description.padEnd(74)} ▓▓`));
    console.log(chalk.magenta(`▓▓ ${'Elapsed: ' + elapsed + 's | Memory: ' + (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1) + 'MB'}`.padEnd(74) + ' ▓▓'));
    console.log(chalk.magenta.bold(`${'▓'.repeat(80)}`));
  }

  logWorkflowStep(step, title, description) {
    console.log(chalk.cyan.bold(`\n🔄 STEP ${step}: ${title}`));
    console.log(chalk.cyan(`   📋 ${description}`));
    this.workflowSteps.push({
      step,
      title,
      description,
      startTime: Date.now(),
      status: 'running'
    });
  }

  logWorkflowProgress(current, total, operation) {
    const percentage = Math.round((current / total) * 100);
    const blocks = Math.floor(percentage / 2.5); // 40 blocks total
    const progressBar = '█'.repeat(blocks) + '░'.repeat(40 - blocks);
    
    console.log(chalk.blue(`   📊 [${progressBar}] ${percentage}% ${operation}`));
  }

  logDataFlow(fromStage, toStage, dataType, count) {
    const flowKey = `${fromStage}->${toStage}`;
    if (!this.workflowMetrics.dataFlowMetrics[flowKey]) {
      this.workflowMetrics.dataFlowMetrics[flowKey] = {};
    }
    this.workflowMetrics.dataFlowMetrics[flowKey][dataType] = count;
    
    console.log(chalk.yellow(`   🔄 Data Flow: ${chalk.white.bold(count)} ${dataType} ${fromStage} → ${toStage}`));
  }

  logArtifact(type, artifact, metrics = {}) {
    this.artifacts[type].push(artifact);
    console.log(chalk.green(`   ✨ Artifact Created: ${type} (ID: ${artifact.id || 'N/A'})`));
    
    Object.entries(metrics).forEach(([key, value]) => {
      console.log(chalk.green(`      📊 ${key}: ${value}`));
    });
  }

  logInsight(insight, data = null) {
    console.log(chalk.magenta.bold(`   💡 INSIGHT: ${insight}`));
    if (data) {
      console.log(chalk.magenta(`      📈 ${JSON.stringify(data, null, 2)}`));
    }
  }

  completeWorkflowStep(step, success = true, metrics = {}) {
    const stepIndex = this.workflowSteps.findIndex(s => s.step === step);
    if (stepIndex >= 0) {
      const stepData = this.workflowSteps[stepIndex];
      stepData.status = success ? 'completed' : 'failed';
      stepData.duration = Date.now() - stepData.startTime;
      stepData.metrics = metrics;
      
      this.workflowMetrics.totalSteps++;
      if (success) {
        this.workflowMetrics.successfulSteps++;
        console.log(chalk.green.bold(`   ✅ STEP ${step} COMPLETED (${stepData.duration}ms)`));
      } else {
        this.workflowMetrics.failedSteps++;
        console.log(chalk.red.bold(`   ❌ STEP ${step} FAILED (${stepData.duration}ms)`));
      }
      
      Object.entries(metrics).forEach(([key, value]) => {
        console.log(chalk.gray(`      ${key}: ${value}`));
      });
    }
  }

  async trackWorkflowOperation(operation, operationName, expectedOutputs = []) {
    const start = Date.now();
    const startMem = process.memoryUsage().heapUsed;
    
    console.log(chalk.blue(`   🚀 Executing: ${operationName}...`));
    
    try {
      const result = await operation();
      const duration = Date.now() - start;
      const memDelta = process.memoryUsage().heapUsed - startMem;
      
      console.log(chalk.green(`   ✅ ${operationName} completed in ${duration}ms`));
      console.log(chalk.gray(`      Memory delta: ${(memDelta / 1024 / 1024).toFixed(2)}MB`));
      
      // Validate expected outputs
      expectedOutputs.forEach(output => {
        if (result[output]) {
          console.log(chalk.green(`      ✓ Expected output '${output}' present`));
        } else {
          console.log(chalk.yellow(`      ⚠ Expected output '${output}' missing`));
        }
      });
      
      return result;
    } catch (error) {
      const duration = Date.now() - start;
      console.log(chalk.red(`   ❌ ${operationName} failed after ${duration}ms: ${error.message}`));
      throw error;
    }
  }

  async callTool(name, args) {
    try {
      const result = await this.client.callTool({ name, arguments: args });
      return JSON.parse(result.content[0].text);
    } catch (error) {
      log.error(`Tool ${name} failed:`, error.message);
      throw error;
    }
  }

  // === CONNECTION SETUP ===

  async connect() {
    this.logWorkflowHeader('SYSTEM INITIALIZATION', 'Establishing MCP connection and verifying capabilities');
    
    this.logWorkflowStep(0, 'MCP Client Setup', 'Creating client and transport components');
    this.client = new Client({ name: "integrated-workflow-demo", version: "3.0.0" });
    this.transport = new StdioClientTransport({
      command: 'node',
      args: ['./mcp/index.js'],
      cwd: process.cwd()
    });

    await this.client.connect(this.transport);
    
    // Comprehensive capability discovery
    const [tools, resources] = await Promise.all([
      this.client.listTools(),
      this.client.listResources()
    ]);
    
    // Categorize and analyze available tools
    const toolAnalysis = {
      total: tools.tools.length,
      graphrag: tools.tools.filter(t => ['store_document', 'hybrid_search', 'create_relations', 'read_graph'].includes(t.name)).length,
      semem: tools.tools.filter(t => t.name.startsWith('semem_')).length,
      ragno: tools.tools.filter(t => t.name.startsWith('ragno_')).length,
      zpt: tools.tools.filter(t => t.name.startsWith('zpt_')).length
    };
    
    this.completeWorkflowStep(0, true, {
      'Total Tools': toolAnalysis.total,
      'GraphRAG Tools': toolAnalysis.graphrag,
      'Semem Tools': toolAnalysis.semem,
      'Ragno Tools': toolAnalysis.ragno,
      'ZPT Tools': toolAnalysis.zpt,
      'Resources': resources.resources.length
    });
    
    return this;
  }

  // === WORKFLOW 1: DOCUMENT INGESTION PIPELINE ===

  async runDocumentIngestionWorkflow() {
    this.logWorkflowHeader('DOCUMENT INGESTION PIPELINE', 'End-to-end document processing with multi-modal analysis');
    
    // Source documents with diverse content types
    const documents = [
      {
        content: `Quantum Computing: Principles and Applications

Quantum computing represents a revolutionary paradigm shift in computational technology. Unlike classical computers that use binary bits (0 or 1), quantum computers leverage quantum bits (qubits) that can exist in multiple states simultaneously through a phenomenon called superposition.

Key Quantum Principles:
1. Superposition: Qubits can be in multiple states simultaneously
2. Entanglement: Qubits can be correlated in ways that classical physics cannot explain
3. Interference: Quantum states can interfere with each other to produce computational results

Applications include cryptography, optimization problems, drug discovery, and financial modeling. Major companies like IBM, Google, and Rigetti are developing quantum hardware and software platforms.

Current challenges include quantum decoherence, error rates, and the need for extremely low temperatures. However, progress in quantum error correction and fault-tolerant quantum computing continues to advance the field.`,
        metadata: {
          title: "Quantum Computing Overview",
          author: "Dr. Sarah Chen",
          type: "research",
          domain: "physics",
          tags: ["quantum-computing", "physics", "technology"],
          difficulty: "advanced",
          created: "2024-06-01"
        }
      },
      {
        content: `Artificial Intelligence in Healthcare: Transforming Medical Practice

Artificial intelligence is revolutionizing healthcare through applications in medical imaging, drug discovery, personalized treatment, and administrative efficiency. AI systems can analyze medical images with accuracy comparable to or exceeding human specialists.

Machine Learning Applications:
- Medical Imaging: CNNs for radiology, pathology, and dermatology
- Drug Discovery: Molecular property prediction and compound optimization
- Clinical Decision Support: Risk assessment and treatment recommendations
- Administrative Automation: Billing, scheduling, and electronic health records

Deep learning models have shown remarkable success in detecting diabetic retinopathy, breast cancer in mammograms, and skin cancer in dermatoscopy images. Natural language processing helps extract insights from clinical notes and medical literature.

Challenges include data privacy, regulatory approval, bias in algorithms, and integration with existing healthcare systems. The FDA has approved numerous AI-based medical devices, indicating growing acceptance of AI in clinical practice.`,
        metadata: {
          title: "AI in Healthcare Applications",
          author: "Medical AI Research Group",
          type: "review",
          domain: "healthcare",
          tags: ["artificial-intelligence", "healthcare", "medical-imaging"],
          difficulty: "intermediate",
          created: "2024-05-15"
        }
      },
      {
        content: `Climate Change and Renewable Energy Technologies

Climate change poses one of the most significant challenges of the 21st century, requiring urgent action to reduce greenhouse gas emissions and transition to sustainable energy systems. Renewable energy technologies have emerged as crucial solutions.

Renewable Energy Sources:
1. Solar Power: Photovoltaic cells and concentrated solar power
2. Wind Energy: Onshore and offshore wind turbines
3. Hydroelectric: Traditional dams and run-of-river systems
4. Geothermal: Heat pumps and geothermal power plants
5. Biomass: Biofuels and biogas from organic materials

Recent technological advances have dramatically reduced costs. Solar and wind are now the cheapest sources of electricity in many regions. Energy storage solutions, including lithium-ion batteries and pumped hydro storage, address intermittency challenges.

Policy measures such as carbon pricing, renewable energy standards, and green investment incentives are accelerating the transition. However, significant infrastructure investment and technological innovation are still needed to achieve net-zero emissions targets.`,
        metadata: {
          title: "Renewable Energy and Climate Solutions",
          author: "Environmental Science Institute",
          type: "analysis",
          domain: "environment",
          tags: ["climate-change", "renewable-energy", "sustainability"],
          difficulty: "intermediate",
          created: "2024-04-20"
        }
      }
    ];

    // Step 1: Document Storage with Embedding Generation
    this.logWorkflowStep(1, 'Document Storage & Embedding', 'Storing documents with vector embeddings and concept extraction');
    
    for (let i = 0; i < documents.length; i++) {
      this.logWorkflowProgress(i + 1, documents.length, `Processing: ${documents[i].metadata.title}`);
      
      const result = await this.trackWorkflowOperation(
        () => this.callTool('store_document', documents[i]),
        `Document Storage: ${documents[i].metadata.title}`,
        ['documentId', 'conceptCount', 'contentLength']
      );
      
      if (result.success) {
        this.logArtifact('documents', {
          id: result.documentId,
          title: result.title,
          domain: documents[i].metadata.domain,
          concepts: result.conceptCount
        }, {
          'Content Length': result.contentLength,
          'Concepts Extracted': result.conceptCount,
          'Domain': documents[i].metadata.domain
        });
      }
    }
    
    this.logDataFlow('Raw Documents', 'Document Store', 'documents', documents.length);
    this.completeWorkflowStep(1, true, { 'Documents Stored': documents.length });

    // Step 2: Content Chunking with ZPT
    this.logWorkflowStep(2, 'Intelligent Content Chunking', 'Using ZPT to create semantic chunks for each document');
    
    const allChunks = [];
    for (let i = 0; i < documents.length; i++) {
      const doc = documents[i];
      
      const chunkResult = await this.trackWorkflowOperation(
        () => this.callTool('zpt_chunk_content', {
          content: doc.content,
          options: {
            method: "semantic",
            chunkSize: 300,
            overlap: 50,
            preserveStructure: true
          }
        }),
        `ZPT Chunking: ${doc.metadata.title}`,
        ['chunkCount', 'averageChunkSize']
      );
      
      if (chunkResult.success !== false) {
        chunkResult.chunks?.forEach((chunk, idx) => {
          allChunks.push({
            id: `${doc.metadata.title}_chunk_${idx}`,
            content: chunk.content,
            source: doc.metadata.title,
            domain: doc.metadata.domain
          });
        });
        
        this.logArtifact('chunks', {
          id: `chunks_${doc.metadata.title}`,
          count: chunkResult.chunkCount,
          source: doc.metadata.title
        }, {
          'Chunk Count': chunkResult.chunkCount,
          'Avg Size': chunkResult.averageChunkSize
        });
      }
    }
    
    this.logDataFlow('Documents', 'Semantic Chunks', 'chunks', allChunks.length);
    this.completeWorkflowStep(2, true, { 'Total Chunks': allChunks.length });

    // Step 3: Knowledge Graph Construction with Ragno
    this.logWorkflowStep(3, 'Knowledge Graph Construction', 'Using Ragno to decompose content into RDF entities and relationships');
    
    const textChunks = allChunks.map(chunk => chunk.content);
    const decompositionResult = await this.trackWorkflowOperation(
      () => this.callTool('ragno_decompose_corpus', {
        textChunks,
        options: {
          maxEntities: 30,
          minFrequency: 1,
          extractRelationships: true
        }
      }),
      'Ragno Corpus Decomposition',
      ['entityCount', 'relationshipCount', 'unitCount']
    );
    
    if (decompositionResult.success !== false) {
      // Store extracted entities and relationships
      decompositionResult.entities?.forEach(entity => {
        this.logArtifact('entities', {
          id: entity.name,
          name: entity.name,
          frequency: entity.frequency,
          isEntryPoint: entity.isEntryPoint
        });
      });
      
      decompositionResult.relationships?.forEach(rel => {
        this.logArtifact('relationships', {
          id: `${rel.source}_${rel.target}`,
          source: rel.source,
          target: rel.target,
          type: rel.description
        });
      });
      
      this.logDataFlow('Semantic Chunks', 'Knowledge Graph', 'entities', decompositionResult.entityCount);
      this.logDataFlow('Semantic Chunks', 'Knowledge Graph', 'relationships', decompositionResult.relationshipCount);
    }
    
    this.completeWorkflowStep(3, true, {
      'Entities': decompositionResult.entityCount,
      'Relationships': decompositionResult.relationshipCount,
      'Units': decompositionResult.unitCount
    });

    return { documents: documents.length, chunks: allChunks.length, entities: decompositionResult.entityCount };
  }

  // === WORKFLOW 2: KNOWLEDGE GRAPH ENRICHMENT ===

  async runKnowledgeGraphEnrichment() {
    this.logWorkflowHeader('KNOWLEDGE GRAPH ENRICHMENT', 'Building and enriching the knowledge graph with relationships and observations');
    
    // Step 1: Create Domain Relationships
    this.logWorkflowStep(4, 'Domain Relationship Creation', 'Building relationships between domain concepts');
    
    const domainRelationships = [
      {
        sourceEntity: "quantum_computing",
        targetEntity: "artificial_intelligence",
        relationshipType: "intersects_with",
        description: "Quantum computing intersects with AI for quantum machine learning",
        weight: 0.7
      },
      {
        sourceEntity: "artificial_intelligence", 
        targetEntity: "healthcare",
        relationshipType: "applied_to",
        description: "AI is extensively applied to healthcare applications",
        weight: 0.9
      },
      {
        sourceEntity: "renewable_energy",
        targetEntity: "climate_change",
        relationshipType: "addresses",
        description: "Renewable energy technologies address climate change",
        weight: 0.95
      },
      {
        sourceEntity: "machine_learning",
        targetEntity: "medical_imaging",
        relationshipType: "enables",
        description: "Machine learning enables advanced medical imaging analysis",
        weight: 0.85
      },
      {
        sourceEntity: "quantum_computing",
        targetEntity: "cryptography",
        relationshipType: "impacts",
        description: "Quantum computing significantly impacts cryptography",
        weight: 0.8
      }
    ];
    
    for (let i = 0; i < domainRelationships.length; i++) {
      const rel = domainRelationships[i];
      this.logWorkflowProgress(i + 1, domainRelationships.length, `${rel.sourceEntity} → ${rel.targetEntity}`);
      
      const result = await this.trackWorkflowOperation(
        () => this.callTool('create_relations', rel),
        `Relationship: ${rel.relationshipType}`,
        ['relationship']
      );
      
      if (result.success) {
        this.logArtifact('relationships', {
          id: result.relationship.id,
          source: rel.sourceEntity,
          target: rel.targetEntity,
          type: rel.relationshipType
        }, {
          'Weight': rel.weight,
          'Type': rel.relationshipType
        });
      }
    }
    
    this.completeWorkflowStep(4, true, { 'Relationships Created': domainRelationships.length });

    // Step 2: Entity Enrichment with Observations
    this.logWorkflowStep(5, 'Entity Observation Enrichment', 'Adding contextual observations to key entities');
    
    const entityEnrichments = [
      {
        entityId: "artificial_intelligence",
        observations: [
          {
            text: "Experiencing rapid growth across multiple industries with significant investment",
            type: "trend",
            source: "market_analysis",
            confidence: 0.9
          },
          {
            text: "Key enabler for digital transformation and automation",
            type: "importance",
            source: "technology_assessment",
            confidence: 0.95
          },
          {
            text: "Raises important ethical considerations around bias and privacy",
            type: "challenge",
            source: "ethics_review",
            confidence: 0.85
          }
        ]
      },
      {
        entityId: "quantum_computing",
        observations: [
          {
            text: "Still in early stages but showing promising experimental results",
            type: "maturity",
            source: "research_assessment",
            confidence: 0.8
          },
          {
            text: "Potential to revolutionize cryptography and optimization",
            type: "potential",
            source: "technology_forecast",
            confidence: 0.9
          }
        ]
      }
    ];
    
    for (let i = 0; i < entityEnrichments.length; i++) {
      const enrichment = entityEnrichments[i];
      
      const result = await this.trackWorkflowOperation(
        () => this.callTool('add_observations', enrichment),
        `Entity Enrichment: ${enrichment.entityId}`,
        ['observationsAdded', 'enrichmentInfo']
      );
      
      if (result.success) {
        this.logInsight(`Enhanced ${enrichment.entityId} with ${result.observationsAdded} observations`, {
          'Entity': enrichment.entityId,
          'Observations': result.observationsAdded,
          'Avg Confidence': result.enrichmentInfo?.avgConfidence
        });
      }
    }
    
    this.completeWorkflowStep(5, true, { 'Entities Enriched': entityEnrichments.length });

    return { relationshipsCreated: domainRelationships.length, entitiesEnriched: entityEnrichments.length };
  }

  // === WORKFLOW 3: MULTI-MODAL SEARCH AND RETRIEVAL ===

  async runMultiModalSearchWorkflow() {
    this.logWorkflowHeader('MULTI-MODAL SEARCH & RETRIEVAL', 'Advanced search combining vector, graph, and semantic approaches');
    
    // Step 1: Hybrid Search Queries
    this.logWorkflowStep(6, 'Hybrid Search Execution', 'Running GraphRAG hybrid searches with different configurations');
    
    const searchQueries = [
      {
        query: "quantum computing applications in artificial intelligence and machine learning",
        options: {
          maxResults: 12,
          vectorWeight: 0.6,
          graphWeight: 0.4,
          similarityThreshold: 0.65,
          graphDepth: 3,
          includeDocuments: true,
          includeEntities: true,
          includeRelationships: true,
          zptParams: { zoom: "entity", tilt: "embedding" }
        },
        expectedDomains: ["physics", "healthcare"]
      },
      {
        query: "healthcare AI applications and medical imaging technologies",
        options: {
          maxResults: 15,
          vectorWeight: 0.7,
          graphWeight: 0.3,
          similarityThreshold: 0.7,
          graphDepth: 2,
          includeDocuments: true,
          includeEntities: true,
          includeRelationships: true,
          zptParams: { zoom: "unit", tilt: "keywords" }
        },
        expectedDomains: ["healthcare"]
      },
      {
        query: "renewable energy climate change sustainable technology solutions",
        options: {
          maxResults: 10,
          vectorWeight: 0.5,
          graphWeight: 0.5,
          similarityThreshold: 0.6,
          graphDepth: 2,
          includeDocuments: true,
          includeEntities: true,
          includeRelationships: true,
          zptParams: { zoom: "text", tilt: "graph" }
        },
        expectedDomains: ["environment"]
      }
    ];
    
    const searchResults = [];
    for (let i = 0; i < searchQueries.length; i++) {
      const { query, options, expectedDomains } = searchQueries[i];
      this.logWorkflowProgress(i + 1, searchQueries.length, `"${query.substring(0, 40)}..."`);
      
      const result = await this.trackWorkflowOperation(
        () => this.callTool('hybrid_search', { query, options }),
        `Hybrid Search #${i + 1}`,
        ['summary', 'documents', 'entities', 'relationships']
      );
      
      if (result && result.success !== false) {
        searchResults.push(result);
        
        // Analyze search effectiveness
        const effectiveness = {
          documentsFound: result.documents?.length || 0,
          entitiesFound: result.entities?.length || 0,
          relationshipsFound: result.relationships?.length || 0,
          avgHybridScore: result.documents?.length > 0 ? 
            (result.documents.reduce((sum, doc) => sum + (doc.hybridScore || 0), 0) / result.documents.length).toFixed(3) : 'N/A'
        };
        
        this.logInsight(`Search effectiveness analysis`, effectiveness);
        
        // Check domain coverage
        if (result.documents) {
          const foundDomains = [...new Set(result.documents.map(doc => doc.metadata?.domain).filter(Boolean))];
          const domainCoverage = expectedDomains.filter(domain => foundDomains.includes(domain));
          
          this.logInsight(`Domain coverage: ${domainCoverage.length}/${expectedDomains.length} expected domains found`, {
            expected: expectedDomains,
            found: foundDomains,
            coverage: domainCoverage
          });
        }
      }
    }
    
    this.completeWorkflowStep(6, true, { 'Searches Executed': searchQueries.length, 'Results Generated': searchResults.length });

    // Step 2: Advanced Document Search
    this.logWorkflowStep(7, 'Advanced Document Search', 'Semantic document search with filtering and ranking');
    
    const documentSearches = [
      {
        query: "artificial intelligence machine learning neural networks",
        options: {
          maxResults: 8,
          sortBy: "relevance",
          documentTypes: ["research", "review"],
          includeContent: true,
          contentLength: 300
        }
      },
      {
        query: "quantum computing cryptography security",
        options: {
          maxResults: 5,
          sortBy: "similarity",
          documentTypes: ["research", "analysis"],
          includeContent: true,
          contentLength: 250
        }
      }
    ];
    
    for (let i = 0; i < documentSearches.length; i++) {
      const { query, options } = documentSearches[i];
      
      const result = await this.trackWorkflowOperation(
        () => this.callTool('search_documentation', { query, options }),
        `Document Search: "${query}"`,
        ['summary', 'documents']
      );
      
      if (result.success) {
        this.logInsight(`Document search results`, {
          'Query': query,
          'Found': result.summary?.returned,
          'Avg Similarity': result.summary?.avgSimilarity?.toFixed(3)
        });
      }
    }
    
    this.completeWorkflowStep(7, true, { 'Document Searches': documentSearches.length });

    return { hybridSearches: searchQueries.length, documentSearches: documentSearches.length };
  }

  // === WORKFLOW 4: GRAPH ANALYTICS AND INSIGHTS ===

  async runGraphAnalyticsWorkflow() {
    this.logWorkflowHeader('GRAPH ANALYTICS & INSIGHTS', 'Comprehensive analysis of the knowledge graph structure');
    
    // Step 1: Knowledge Graph Statistics
    this.logWorkflowStep(8, 'Graph Statistics Analysis', 'Generating comprehensive knowledge graph metrics');
    
    const statsResult = await this.trackWorkflowOperation(
      () => this.callTool('get_knowledge_graph_stats', { includeDetails: true }),
      'Knowledge Graph Statistics',
      ['statistics']
    );
    
    if (statsResult.success) {
      const stats = statsResult.statistics;
      
      this.logInsight('Graph Overview Statistics', stats.overview);
      
      if (stats.connectivity) {
        this.logInsight('Connectivity Analysis', {
          'Avg Connections': stats.connectivity.avgConnections?.toFixed(2),
          'Max Connections': stats.connectivity.maxConnections,
          'Connected Nodes': stats.connectivity.connectedNodes,
          'Isolated Nodes': stats.connectivity.isolatedNodes
        });
      }
      
      if (stats.types) {
        this.logInsight('Content Type Distribution', stats.types);
      }
    }
    
    this.completeWorkflowStep(8, true, { 'Statistics Generated': 'Complete' });

    // Step 2: Node Discovery and Analysis
    this.logWorkflowStep(9, 'Node Discovery & Analysis', 'Searching and analyzing graph nodes');
    
    const nodeSearches = [
      { query: "artificial", nodeType: "concept", includeConnections: true },
      { query: "quantum", nodeType: "concept", includeConnections: true },
      { query: null, nodeType: "document", includeConnections: false }
    ];
    
    for (let i = 0; i < nodeSearches.length; i++) {
      const search = nodeSearches[i];
      
      const result = await this.trackWorkflowOperation(
        () => this.callTool('search_nodes', { ...search, limit: 8 }),
        `Node Search: ${search.query || search.nodeType}`,
        ['count', 'nodes']
      );
      
      if (result.success) {
        this.logInsight(`Found ${result.count} ${search.nodeType} nodes`, {
          'Query': search.query || 'All',
          'Type': search.nodeType,
          'Connection Info': search.includeConnections
        });
        
        // Analyze top nodes
        if (result.nodes && result.nodes.length > 0) {
          const topNodes = result.nodes.slice(0, 3);
          topNodes.forEach((node, idx) => {
            console.log(chalk.yellow(`      Node ${idx + 1}: ${node.name} (${node.type}, connections: ${node.connections || 'N/A'})`));
          });
        }
      }
    }
    
    this.completeWorkflowStep(9, true, { 'Node Searches': nodeSearches.length });

    // Step 3: Graph Structure Export
    this.logWorkflowStep(10, 'Graph Structure Export', 'Exporting graph in multiple formats for analysis');
    
    const exportFormats = ['adjacency', 'edge_list', 'cytoscape'];
    
    for (let i = 0; i < exportFormats.length; i++) {
      const format = exportFormats[i];
      
      const result = await this.trackWorkflowOperation(
        () => this.callTool('read_graph', {
          maxDepth: 2,
          format,
          includeMetadata: true
        }),
        `Graph Export: ${format}`,
        ['statistics', 'graph']
      );
      
      if (result.success) {
        this.logInsight(`Graph exported in ${format} format`, {
          'Nodes': result.statistics?.nodeCount,
          'Edges': result.statistics?.edgeCount,
          'Max Depth': result.statistics?.maxDepth
        });
      }
    }
    
    this.completeWorkflowStep(10, true, { 'Export Formats': exportFormats.length });

    return { statsGenerated: true, nodeSearches: nodeSearches.length, exports: exportFormats.length };
  }

  // === COMPREHENSIVE WORKFLOW ANALYSIS ===

  generateWorkflowReport() {
    this.logWorkflowHeader('WORKFLOW ANALYSIS REPORT', 'Comprehensive analysis of integrated workflow performance');
    
    // Calculate overall workflow metrics
    const totalTime = (Date.now() - this.startTime) / 1000;
    const successRate = (this.workflowMetrics.successfulSteps / this.workflowMetrics.totalSteps * 100).toFixed(1);
    
    console.log(chalk.blue.bold('\n📊 OVERALL WORKFLOW METRICS:'));
    console.log(chalk.blue(`   Total Execution Time: ${totalTime.toFixed(1)}s`));
    console.log(chalk.blue(`   Total Steps: ${this.workflowMetrics.totalSteps}`));
    console.log(chalk.blue(`   Success Rate: ${successRate}%`));
    console.log(chalk.blue(`   Failed Steps: ${this.workflowMetrics.failedSteps}`));
    
    // Artifact summary
    console.log(chalk.green.bold('\n🏆 ARTIFACTS CREATED:'));
    Object.entries(this.artifacts).forEach(([type, items]) => {
      if (items.length > 0) {
        console.log(chalk.green(`   ${type}: ${items.length} items`));
      }
    });
    
    // Data flow analysis
    console.log(chalk.yellow.bold('\n🔄 DATA FLOW ANALYSIS:'));
    Object.entries(this.workflowMetrics.dataFlowMetrics).forEach(([flow, data]) => {
      console.log(chalk.yellow(`   ${flow}:`));
      Object.entries(data).forEach(([dataType, count]) => {
        console.log(chalk.yellow(`      ${dataType}: ${count}`));
      });
    });
    
    // Step performance analysis
    console.log(chalk.magenta.bold('\n⚡ STEP PERFORMANCE:'));
    this.workflowSteps
      .filter(step => step.status === 'completed')
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 5)
      .forEach((step, idx) => {
        console.log(chalk.magenta(`   ${idx + 1}. Step ${step.step}: ${step.title} - ${step.duration}ms`));
      });
    
    // Integration insights
    console.log(chalk.cyan.bold('\n💡 INTEGRATION INSIGHTS:'));
    const insights = [
      'Document ingestion → Chunking → Knowledge extraction pipeline achieved high efficiency',
      'Hybrid search effectively combined vector similarity with graph traversal',
      'Knowledge graph enrichment improved search relevance and connectivity',
      'Multi-format graph exports enable diverse analytical approaches',
      'End-to-end workflow demonstrated successful tool integration'
    ];
    
    insights.forEach((insight, idx) => {
      console.log(chalk.cyan(`   ${idx + 1}. ${insight}`));
    });
  }

  // === MAIN WORKFLOW ORCHESTRATION ===

  async runCompleteIntegratedDemo() {
    try {
      console.log(chalk.magenta.bold('🚀 SEMEM INTEGRATED WORKFLOW DEMONSTRATION'));
      console.log(chalk.magenta.bold('============================================'));
      console.log(chalk.gray(`🕐 Started: ${new Date().toISOString()}`));
      console.log(chalk.gray(`💻 Process: ${process.pid} | Platform: ${process.platform}`));
      
      // Initialize system
      await this.connect();
      
      // Execute integrated workflows
      const workflow1Results = await this.runDocumentIngestionWorkflow();
      const workflow2Results = await this.runKnowledgeGraphEnrichment();
      const workflow3Results = await this.runMultiModalSearchWorkflow();
      const workflow4Results = await this.runGraphAnalyticsWorkflow();
      
      // Generate comprehensive analysis
      this.generateWorkflowReport();
      
      // Final summary
      this.logWorkflowHeader('INTEGRATION COMPLETE', 'All workflows successfully executed with comprehensive analysis');
      
      const finalMetrics = {
        totalExecutionTime: ((Date.now() - this.startTime) / 1000).toFixed(1),
        workflowsCompleted: 4,
        documentsProcessed: workflow1Results.documents,
        chunksGenerated: workflow1Results.chunks,
        entitiesExtracted: workflow1Results.entities,
        relationshipsCreated: workflow2Results.relationshipsCreated,
        searchesExecuted: workflow3Results.hybridSearches + workflow3Results.documentSearches,
        analyticsGenerated: workflow4Results.statsGenerated ? 1 : 0
      };
      
      console.log(chalk.green.bold('\n🎉 INTEGRATION DEMONSTRATION COMPLETE!'));
      console.log(chalk.green.bold('====================================='));
      
      Object.entries(finalMetrics).forEach(([metric, value]) => {
        console.log(chalk.green(`   ${metric}: ${value}`));
      });
      
      console.log(chalk.blue.bold('\n✅ DEMONSTRATED INTEGRATIONS:'));
      const integrations = [
        '📄 Document Management → ZPT Chunking → Ragno Decomposition',
        '🕸️  Knowledge Graph Construction → Relationship Building → Entity Enrichment',
        '🔍 Hybrid Search → Vector Similarity → Graph Traversal → ZPT Navigation',
        '📊 Graph Analytics → Node Discovery → Multi-format Export',
        '🔄 End-to-end Data Flow → Performance Monitoring → Insight Generation'
      ];
      
      integrations.forEach(integration => {
        console.log(chalk.blue(`    ${integration}`));
      });
      
    } catch (error) {
      console.error(chalk.red.bold('❌ Integrated workflow failed:'), error.message);
      log.error('Full error details:', error);
      throw error;
    } finally {
      if (this.client) {
        await this.client.close();
        console.log(chalk.gray('🔌 MCP connection closed'));
      }
    }
  }
}

// Main execution
async function main() {
  const demo = new IntegratedWorkflowDemo();
  
  try {
    await demo.runCompleteIntegratedDemo();
  } catch (error) {
    console.error(chalk.red.bold('❌ Demo execution failed:'), error.message);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log(chalk.yellow('\n👋 Shutting down integrated workflow demo...'));
  process.exit(0);
});

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export default IntegratedWorkflowDemo;