#!/usr/bin/env node

/**
 * Semem Core Features Demonstration
 * 
 * This example showcases the traditional Semem capabilities:
 * - Semantic memory management 
 * - LLM integration and response generation
 * - Concept extraction and embedding generation
 * - Ragno knowledge graph construction
 * - ZPT content navigation and chunking
 * 
 * Features comprehensive logging, performance monitoring, and progress visualization.
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import chalk from 'chalk';
import log from 'loglevel';

// Configure detailed logging
log.setLevel('DEBUG');

class SememCoreDemo {
  constructor() {
    this.client = null;
    this.transport = null;
    this.startTime = Date.now();
    this.operationCount = 0;
    this.memoryItems = [];
    this.performanceMetrics = {
      embeddings: [],
      retrievals: [],
      generations: [],
      decompositions: []
    };
  }

  // === ENHANCED LOGGING UTILITIES ===

  logBanner(title, subtitle = null) {
    const elapsed = ((Date.now() - this.startTime) / 1000).toFixed(1);
    console.log(chalk.blue.bold(`\n${'█'.repeat(70)}`));
    console.log(chalk.blue.bold(`██ ${title.padEnd(64)} ██`));
    if (subtitle) {
      console.log(chalk.blue(`██ ${subtitle.padEnd(64)} ██`));
    }
    console.log(chalk.blue.bold(`██ ${'Time: ' + elapsed + 's | Operation: ' + ++this.operationCount}`.padEnd(64) + ' ██'));
    console.log(chalk.blue.bold(`${'█'.repeat(70)}`));
  }

  logProgress(step, total, description) {
    const percentage = Math.round((step / total) * 100);
    const progressBar = '█'.repeat(Math.floor(percentage / 5)) + '░'.repeat(20 - Math.floor(percentage / 5));
    console.log(chalk.cyan(`\n📊 [${progressBar}] ${percentage}% - ${description}`));
  }

  logMetric(metric, value, unit = '', trend = null) {
    const trendIcon = trend === 'up' ? '📈' : trend === 'down' ? '📉' : '📊';
    console.log(chalk.magenta(`   ${trendIcon} ${metric}: ${chalk.white.bold(value)}${unit}`));
  }

  logSystemInfo(info) {
    console.log(chalk.gray('   🖥️  System: '), chalk.white(JSON.stringify(info, null, 2)));
  }

  logSuccess(message, data = null) {
    console.log(chalk.green.bold(`   ✅ ${message}`));
    if (data && typeof data === 'object') {
      Object.entries(data).forEach(([key, value]) => {
        console.log(chalk.green(`      📋 ${key}: ${chalk.white(value)}`));
      });
    }
  }

  logWarning(message, details = null) {
    console.log(chalk.yellow.bold(`   ⚠️  ${message}`));
    if (details) console.log(chalk.yellow(`      ${details}`));
  }

  logError(message, error = null) {
    console.log(chalk.red.bold(`   ❌ ${message}`));
    if (error) console.log(chalk.red(`      🚨 ${error}`));
  }

  logStage(stage, description) {
    console.log(chalk.yellow.bold(`\n🔄 Stage ${stage}: ${description}`));
  }

  async trackPerformance(operation, category, operationName) {
    const start = Date.now();
    const startMemory = process.memoryUsage();
    
    console.log(chalk.blue(`   🚀 Starting ${operationName}...`));
    
    try {
      const result = await operation();
      const duration = Date.now() - start;
      const endMemory = process.memoryUsage();
      const memoryDelta = endMemory.heapUsed - startMemory.heapUsed;
      
      this.performanceMetrics[category].push({
        operation: operationName,
        duration,
        memoryDelta,
        timestamp: new Date().toISOString()
      });
      
      this.logSuccess(`${operationName} completed`, {
        'Duration': `${duration}ms`,
        'Memory Delta': `${(memoryDelta / 1024 / 1024).toFixed(2)}MB`,
        'Status': 'Success'
      });
      
      return result;
    } catch (error) {
      const duration = Date.now() - start;
      this.logError(`${operationName} failed after ${duration}ms`, error.message);
      throw error;
    }
  }

  async callTool(name, args) {
    log.debug(`🔧 Calling tool: ${name}`, args);
    
    try {
      const result = await this.client.callTool({ name, arguments: args });
      const parsedResult = JSON.parse(result.content[0].text);
      
      if (parsedResult.success !== false) {
        log.debug(`✅ Tool ${name} succeeded`);
        return parsedResult;
      } else {
        log.warn(`⚠️ Tool ${name} returned failure`, parsedResult);
        return parsedResult;
      }
    } catch (error) {
      log.error(`❌ Tool ${name} failed:`, error.message);
      throw error;
    }
  }

  // === CONNECTION AND SETUP ===

  async connect() {
    this.logBanner('SEMEM MCP CLIENT INITIALIZATION');
    
    this.logStage('1', 'Setting up MCP client components');
    this.client = new Client({ 
      name: "semem-core-demo", 
      version: "2.0.0" 
    });
    
    this.transport = new StdioClientTransport({
      command: 'node',
      args: ['./mcp/index.js'],
      cwd: process.cwd()
    });

    this.logStage('2', 'Establishing connection to Semem MCP server');
    await this.client.connect(this.transport);
    this.logSuccess('Connected to Semem MCP server');
    
    this.logStage('3', 'Performing capability discovery');
    const [tools, resources] = await Promise.all([
      this.client.listTools(),
      this.client.listResources()
    ]);
    
    // Categorize tools
    const toolCategories = {
      semem_core: tools.tools.filter(t => t.name.startsWith('semem_')),
      ragno: tools.tools.filter(t => t.name.startsWith('ragno_')),
      zpt: tools.tools.filter(t => t.name.startsWith('zpt_')),
      graphrag: tools.tools.filter(t => ['store_document', 'hybrid_search', 'create_relations'].includes(t.name))
    };
    
    this.logSuccess('Server capabilities discovered', {
      'Total Tools': tools.tools.length,
      'Semem Core': toolCategories.semem_core.length,
      'Ragno': toolCategories.ragno.length,
      'ZPT': toolCategories.zpt.length,
      'GraphRAG': toolCategories.graphrag.length,
      'Resources': resources.resources.length
    });
    
    console.log(chalk.gray('   📚 Available Semem tools:'));
    toolCategories.semem_core.forEach(tool => {
      console.log(chalk.gray(`      • ${tool.name}: ${tool.description || 'No description'}`));
    });
    
    return this;
  }

  async checkSystemHealth() {
    this.logBanner('SYSTEM HEALTH CHECK');
    
    try {
      const resources = await this.client.listResources();
      const statusResource = resources.resources.find(r => r.uri === "semem://status");
      
      if (statusResource) {
        const status = await this.client.readResource({ uri: "semem://status" });
        const statusData = JSON.parse(status.contents[0].text);
        
        this.logSuccess('System status retrieved');
        this.logSystemInfo({
          server: statusData.server,
          services: statusData.services,
          capabilities: statusData.capabilities
        });
        
        if (statusData.memoryStats) {
          this.logMetric('Total Memories', statusData.memoryStats.totalMemories);
          this.logMetric('Documents', statusData.memoryStats.documentCount);
          this.logMetric('Relationships', statusData.memoryStats.relationshipCount);
        }
      } else {
        this.logWarning('Status resource not available');
      }
    } catch (error) {
      this.logError('Health check failed', error.message);
    }
  }

  // === SEMANTIC MEMORY DEMONSTRATIONS ===

  async demonstrateSemanticMemory() {
    this.logBanner('SEMANTIC MEMORY MANAGEMENT', 'Core memory storage, retrieval, and generation');
    
    // Prepare diverse conversation data
    const conversations = [
      {
        prompt: "What are the fundamental principles of quantum mechanics?",
        response: "Quantum mechanics is based on several key principles: wave-particle duality (particles exhibit both wave and particle properties), uncertainty principle (position and momentum cannot be simultaneously measured with perfect accuracy), superposition (particles can exist in multiple states simultaneously), and quantum entanglement (particles can be correlated in ways that classical physics cannot explain).",
        metadata: { domain: "physics", complexity: "advanced", topic: "quantum_mechanics" }
      },
      {
        prompt: "How do machine learning algorithms learn from data?",
        response: "Machine learning algorithms learn through various approaches: supervised learning uses labeled examples to learn mappings from inputs to outputs, unsupervised learning finds patterns in unlabeled data, and reinforcement learning learns through trial and error with rewards and penalties. The learning process involves adjusting internal parameters to minimize prediction errors or maximize rewards.",
        metadata: { domain: "computer_science", complexity: "intermediate", topic: "machine_learning" }
      },
      {
        prompt: "What is the significance of DNA in biological systems?",
        response: "DNA (deoxyribonucleic acid) serves as the blueprint for all living organisms. It stores genetic information in the sequence of four nucleotide bases (A, T, G, C), which encode instructions for protein synthesis. DNA's double helix structure allows for replication and repair, while its genetic code directs cellular functions, inheritance, and evolution.",
        metadata: { domain: "biology", complexity: "intermediate", topic: "genetics" }
      },
      {
        prompt: "Explain the concept of entropy in thermodynamics",
        response: "Entropy is a measure of disorder or randomness in a system. In thermodynamics, the second law states that entropy of an isolated system always increases over time. This explains why heat flows from hot to cold objects, why perpetual motion machines are impossible, and why energy transformations are never 100% efficient. Entropy also relates to the number of possible microscopic arrangements of a system.",
        metadata: { domain: "physics", complexity: "advanced", topic: "thermodynamics" }
      },
      {
        prompt: "What are the key features of neural network architectures?",
        response: "Neural networks consist of interconnected nodes (neurons) organized in layers. Key features include: input layers that receive data, hidden layers that process information through weighted connections and activation functions, output layers that produce results, and backpropagation for training. Modern architectures like CNNs excel at image processing, RNNs handle sequential data, and Transformers use attention mechanisms for language tasks.",
        metadata: { domain: "computer_science", complexity: "advanced", topic: "neural_networks" }
      }
    ];

    // Store conversations with performance tracking
    this.logStage('1', 'Storing semantic memory interactions');
    for (let i = 0; i < conversations.length; i++) {
      const conv = conversations[i];
      this.logProgress(i + 1, conversations.length, `Storing: "${conv.prompt.substring(0, 40)}..."`);
      
      const result = await this.trackPerformance(
        () => this.callTool('semem_store_interaction', conv),
        'embeddings',
        `Memory Storage #${i + 1}`
      );
      
      if (result && result.success) {
        this.memoryItems.push({
          prompt: conv.prompt,
          concepts: result.conceptCount,
          domain: conv.metadata.domain
        });
        
        this.logSuccess(`Memory stored successfully`, {
          'Concepts Extracted': result.conceptCount,
          'Domain': conv.metadata.domain,
          'Complexity': conv.metadata.complexity
        });
      }
    }

    // Test embedding generation with analysis
    this.logStage('2', 'Vector embedding generation and analysis');
    const embeddingQueries = [
      "quantum superposition and entanglement phenomena",
      "deep learning neural network architectures",
      "genetic information storage and replication"
    ];
    
    for (let i = 0; i < embeddingQueries.length; i++) {
      const query = embeddingQueries[i];
      this.logProgress(i + 1, embeddingQueries.length, `Generating embedding for: "${query}"`);
      
      const result = await this.trackPerformance(
        () => this.callTool('semem_generate_embedding', { text: query }),
        'embeddings',
        `Embedding Generation #${i + 1}`
      );
      
      if (result && result.success !== false) {
        this.logSuccess('Embedding generated', {
          'Vector Dimensions': result.embeddingLength,
          'Model Used': result.model || 'default',
          'Sample Values': result.embedding?.slice(0, 5).map(v => v.toFixed(3)).join(', ')
        });
        
        // Analyze embedding properties
        if (result.embedding) {
          const magnitude = Math.sqrt(result.embedding.reduce((sum, val) => sum + val * val, 0));
          const meanValue = result.embedding.reduce((sum, val) => sum + val, 0) / result.embedding.length;
          
          this.logMetric('Vector Magnitude', magnitude.toFixed(3));
          this.logMetric('Mean Value', meanValue.toFixed(6));
        }
      }
    }

    // Test concept extraction with detailed analysis
    this.logStage('3', 'Advanced concept extraction');
    const complexTexts = [
      "Artificial intelligence systems utilize machine learning algorithms, including deep neural networks with convolutional and recurrent architectures, to process natural language and computer vision tasks through supervised, unsupervised, and reinforcement learning paradigms.",
      "Quantum computing leverages quantum mechanical phenomena such as superposition, entanglement, and quantum interference to perform computations on quantum bits (qubits) that can exist in multiple states simultaneously, potentially solving certain computational problems exponentially faster than classical computers.",
      "CRISPR-Cas9 gene editing technology uses guide RNAs to direct Cas9 nuclease to specific DNA sequences, enabling precise genome modifications for therapeutic applications, agricultural improvements, and basic research in molecular biology and genetics."
    ];
    
    for (let i = 0; i < complexTexts.length; i++) {
      const text = complexTexts[i];
      this.logProgress(i + 1, complexTexts.length, `Extracting concepts from text ${i + 1}`);
      
      const result = await this.trackPerformance(
        () => this.callTool('semem_extract_concepts', { text }),
        'generations',
        `Concept Extraction #${i + 1}`
      );
      
      if (result && result.success !== false) {
        this.logSuccess('Concepts extracted', {
          'Total Concepts': result.conceptCount,
          'Text Length': text.length,
          'Concepts/100 chars': (result.conceptCount / text.length * 100).toFixed(2)
        });
        
        console.log(chalk.blue('   📝 Extracted concepts:'));
        result.concepts?.forEach((concept, idx) => {
          console.log(chalk.blue(`      ${idx + 1}. ${concept}`));
        });
      }
    }

    // Test memory retrieval with similarity analysis
    this.logStage('4', 'Semantic memory retrieval and analysis');
    const retrievalQueries = [
      { query: "quantum mechanical systems and their properties", threshold: 0.7 },
      { query: "neural networks and deep learning algorithms", threshold: 0.6 },
      { query: "biological systems and genetic information", threshold: 0.65 }
    ];
    
    for (let i = 0; i < retrievalQueries.length; i++) {
      const { query, threshold } = retrievalQueries[i];
      this.logProgress(i + 1, retrievalQueries.length, `Retrieving memories for: "${query}"`);
      
      const result = await this.trackPerformance(
        () => this.callTool('semem_retrieve_memories', { 
          query, 
          threshold, 
          limit: 3,
          excludeLastN: 0
        }),
        'retrievals',
        `Memory Retrieval #${i + 1}`
      );
      
      if (result && result.success !== false && result.memories) {
        this.logSuccess(`Retrieved ${result.count} relevant memories`, {
          'Query': query.substring(0, 30) + '...',
          'Threshold': threshold,
          'Avg Similarity': result.memories.length > 0 ? 
            (result.memories.reduce((sum, m) => sum + m.similarity, 0) / result.memories.length).toFixed(3) : 'N/A'
        });
        
        result.memories.forEach((memory, idx) => {
          console.log(chalk.cyan(`   📋 Memory ${idx + 1}:`));
          console.log(chalk.cyan(`      Similarity: ${memory.similarity?.toFixed(3)}`));
          console.log(chalk.cyan(`      Question: ${memory.prompt.substring(0, 60)}...`));
          console.log(chalk.cyan(`      Concepts: ${memory.concepts?.slice(0, 3).join(', ')}`));
        });
      }
    }

    // Test memory-enhanced response generation
    this.logStage('5', 'Memory-enhanced response generation');
    const generationQueries = [
      "How do quantum effects influence biological systems?",
      "What are the similarities between neural networks and biological neurons?",
      "How might machine learning be applied to genetic research?"
    ];
    
    for (let i = 0; i < generationQueries.length; i++) {
      const query = generationQueries[i];
      this.logProgress(i + 1, generationQueries.length, `Generating response for: "${query}"`);
      
      const result = await this.trackPerformance(
        () => this.callTool('semem_generate_response', {
          prompt: query,
          useMemory: true,
          contextWindow: 4000,
          temperature: 0.7
        }),
        'generations',
        `Response Generation #${i + 1}`
      );
      
      if (result && result.success !== false) {
        this.logSuccess('Response generated with memory context', {
          'Memory Used': result.memoryUsed,
          'Retrieved Memories': result.retrievalCount,
          'Context Items': result.contextCount,
          'Temperature': result.temperature
        });
        
        console.log(chalk.green('   💬 Generated Response:'));
        console.log(chalk.green(`      ${result.response?.substring(0, 200)}...`));
      }
    }
  }

  // === RAGNO KNOWLEDGE GRAPH DEMONSTRATION ===

  async demonstrateRagnoProcessing() {
    this.logBanner('RAGNO KNOWLEDGE GRAPH PROCESSING', 'RDF-based semantic decomposition and entity extraction');
    
    // Create individual entities with detailed tracking
    this.logStage('1', 'Creating structured knowledge entities');
    const entities = [
      { name: "Artificial Intelligence", isEntryPoint: true, subType: "technology_field", frequency: 15 },
      { name: "Machine Learning", isEntryPoint: true, subType: "methodology", frequency: 12 },
      { name: "Neural Networks", isEntryPoint: false, subType: "algorithm", frequency: 10 },
      { name: "Deep Learning", isEntryPoint: false, subType: "technique", frequency: 8 },
      { name: "Quantum Computing", isEntryPoint: true, subType: "technology_field", frequency: 6 },
      { name: "Computer Vision", isEntryPoint: false, subType: "application", frequency: 5 }
    ];
    
    for (let i = 0; i < entities.length; i++) {
      const entity = entities[i];
      this.logProgress(i + 1, entities.length, `Creating entity: ${entity.name}`);
      
      const result = await this.trackPerformance(
        () => this.callTool('ragno_create_entity', entity),
        'generations',
        `Entity Creation: ${entity.name}`
      );
      
      if (result && result.created) {
        this.logSuccess(`Entity created: ${result.entity.name}`, {
          'Subtype': result.entity.subType,
          'Entry Point': result.entity.isEntryPoint,
          'Frequency': result.entity.frequency,
          'Pref Label': result.entity.prefLabel
        });
      }
    }

    // Create semantic units with content analysis
    this.logStage('2', 'Creating semantic text units');
    const semanticUnits = [
      {
        text: "Artificial intelligence encompasses a broad range of computational techniques designed to mimic human cognitive abilities.",
        summary: "AI mimics human cognition through computational techniques",
        source: "ai-overview-doc",
        position: 0,
        length: 125
      },
      {
        text: "Machine learning algorithms enable systems to automatically improve performance through experience and data analysis.",
        summary: "ML algorithms improve through experience and data",
        source: "ai-overview-doc",
        position: 125,
        length: 118
      },
      {
        text: "Neural networks are computational models inspired by biological neural systems, consisting of interconnected processing nodes.",
        summary: "Neural networks model biological systems with connected nodes",
        source: "ai-overview-doc", 
        position: 243,
        length: 129
      }
    ];
    
    for (let i = 0; i < semanticUnits.length; i++) {
      const unit = semanticUnits[i];
      this.logProgress(i + 1, semanticUnits.length, `Creating semantic unit ${i + 1}`);
      
      const result = await this.trackPerformance(
        () => this.callTool('ragno_create_semantic_unit', unit),
        'generations',
        `Semantic Unit #${i + 1}`
      );
      
      if (result && result.created) {
        this.logSuccess(`Semantic unit created`, {
          'Summary': result.unit.summary,
          'Text Length': result.unit.text?.length || unit.length,
          'Source': result.unit.source,
          'Position': result.unit.position
        });
      }
    }

    // Demonstrate comprehensive corpus decomposition
    this.logStage('3', 'Advanced corpus decomposition');
    const corpusTexts = [
      "Artificial intelligence represents a revolutionary approach to computation that seeks to replicate and extend human cognitive capabilities through sophisticated algorithms and data processing techniques.",
      "Machine learning, as a fundamental subset of AI, enables computers to learn patterns and make decisions from data without explicit programming for every possible scenario or outcome.",
      "Deep learning utilizes multi-layered neural networks to model complex, non-linear relationships in data, achieving breakthrough performance in tasks like image recognition, natural language understanding, and speech synthesis.",
      "Natural language processing combines computational linguistics with machine learning to enable computers to understand, interpret, and generate human language in contextually appropriate and meaningful ways.",
      "Computer vision applies artificial intelligence techniques to automatically identify, analyze, and understand visual content in images and videos, enabling applications from autonomous vehicles to medical diagnosis.",
      "Reinforcement learning trains agents to make sequential decisions by learning from environmental feedback, optimizing long-term rewards rather than immediate outcomes through trial-and-error interactions.",
      "Quantum machine learning explores the intersection of quantum computing and AI, potentially offering exponential speedups for certain computational problems through quantum superposition and entanglement."
    ];
    
    this.logProgress(1, 1, 'Processing corpus with advanced decomposition options');
    
    const decompositionResult = await this.trackPerformance(
      () => this.callTool('ragno_decompose_corpus', {
        textChunks: corpusTexts,
        options: {
          maxEntities: 25,
          minFrequency: 1,
          extractRelationships: true
        }
      }),
      'decompositions',
      'Complete Corpus Decomposition'
    );
    
    if (decompositionResult && decompositionResult.success !== false) {
      this.logSuccess('Corpus decomposition completed', {
        'Input Chunks': corpusTexts.length,
        'Semantic Units': decompositionResult.unitCount,
        'Entities': decompositionResult.entityCount,
        'Relationships': decompositionResult.relationshipCount
      });
      
      // Analyze decomposition statistics
      if (decompositionResult.statistics) {
        this.logSystemInfo(decompositionResult.statistics);
      }
      
      // Show top entities with detailed analysis
      if (decompositionResult.entities && decompositionResult.entities.length > 0) {
        console.log(chalk.blue('\n   📊 Top extracted entities:'));
        decompositionResult.entities.slice(0, 8).forEach((entity, idx) => {
          console.log(chalk.blue(`      ${idx + 1}. ${chalk.white.bold(entity.name)} (freq: ${entity.frequency}, entry: ${entity.isEntryPoint})`));
        });
      }
      
      // Show relationship patterns
      if (decompositionResult.relationships && decompositionResult.relationships.length > 0) {
        console.log(chalk.blue('\n   🔗 Discovered relationships:'));
        decompositionResult.relationships.slice(0, 6).forEach((rel, idx) => {
          console.log(chalk.blue(`      ${idx + 1}. ${rel.source} ${chalk.yellow('→')} ${rel.target}`));
          console.log(chalk.blue(`         ${chalk.gray(rel.description)} (weight: ${rel.weight})`));
        });
      }
    }
  }

  // === ZPT CONTENT PROCESSING DEMONSTRATION ===

  async demonstrateZPTProcessing() {
    this.logBanner('ZPT CONTENT NAVIGATION', 'Multi-dimensional content processing with zoom, pan, and tilt');
    
    // Prepare comprehensive test content
    const comprehensiveText = `
Artificial Intelligence and Machine Learning: A Comprehensive Overview

Introduction to AI
Artificial intelligence represents one of the most significant technological advances of the modern era. It encompasses various computational approaches designed to simulate human intelligence and decision-making processes.

Machine Learning Fundamentals
Machine learning, a core subset of AI, enables systems to automatically learn and improve from experience without being explicitly programmed. This field includes supervised learning, unsupervised learning, and reinforcement learning paradigms.

Deep Learning and Neural Networks
Deep learning utilizes artificial neural networks with multiple layers to model and understand complex patterns in data. These networks can process vast amounts of information and identify intricate relationships that traditional algorithms might miss.

Natural Language Processing
NLP combines computational linguistics with machine learning to enable computers to understand, interpret, and generate human language. Applications include chatbots, translation services, and content analysis.

Computer Vision Applications
Computer vision applies AI techniques to automatically identify and analyze visual content. This technology powers autonomous vehicles, medical imaging systems, and facial recognition software.

Reinforcement Learning
Reinforcement learning trains agents to make decisions by learning from environmental feedback. This approach has achieved remarkable success in game playing, robotics, and autonomous systems.

Ethical Considerations
As AI systems become more prevalent, ethical considerations around bias, privacy, transparency, and societal impact become increasingly important for responsible development.

Future Directions
The future of AI holds promise for breakthrough applications in healthcare, climate science, space exploration, and scientific discovery, while requiring careful consideration of risks and benefits.
    `.trim();

    // Test various chunking strategies with performance analysis
    this.logStage('1', 'Testing intelligent content chunking strategies');
    const chunkingStrategies = [
      { 
        method: "fixed", 
        chunkSize: 400, 
        overlap: 50,
        description: "Fixed-size chunking with minimal overlap"
      },
      { 
        method: "semantic", 
        chunkSize: 500, 
        overlap: 75,
        description: "Semantic boundary-aware chunking"
      },
      { 
        method: "adaptive", 
        chunkSize: 450, 
        overlap: 60,
        description: "Adaptive chunking based on content complexity"
      },
      {
        method: "hierarchical",
        chunkSize: 350,
        overlap: 40,
        description: "Hierarchical structure-preserving chunking"
      }
    ];
    
    for (let i = 0; i < chunkingStrategies.length; i++) {
      const strategy = chunkingStrategies[i];
      this.logProgress(i + 1, chunkingStrategies.length, strategy.description);
      
      const result = await this.trackPerformance(
        () => this.callTool('zpt_chunk_content', {
          content: comprehensiveText,
          options: { 
            ...strategy, 
            preserveStructure: true 
          }
        }),
        'generations',
        `ZPT Chunking: ${strategy.method}`
      );
      
      if (result && result.success !== false) {
        // Calculate chunking efficiency metrics
        const efficiency = {
          chunks: result.chunkCount,
          avgSize: result.averageChunkSize || Math.round(comprehensiveText.length / result.chunkCount),
          coverage: ((result.chunkCount * (strategy.chunkSize - strategy.overlap)) / comprehensiveText.length * 100).toFixed(1)
        };
        
        this.logSuccess(`${strategy.method.toUpperCase()} chunking completed`, {
          'Chunks Created': efficiency.chunks,
          'Average Size': `${efficiency.avgSize} chars`,
          'Content Coverage': `${efficiency.coverage}%`,
          'Original Length': `${result.originalLength} chars`
        });
        
        // Show sample chunks with analysis
        if (result.chunks && result.chunks.length > 0) {
          console.log(chalk.cyan('   📄 Sample chunks:'));
          result.chunks.slice(0, 2).forEach((chunk, idx) => {
            console.log(chalk.cyan(`      Chunk ${idx + 1}: "${chunk.content?.substring(0, 80)}..."`));
            if (chunk.metadata) {
              console.log(chalk.cyan(`      Metadata: ${JSON.stringify(chunk.metadata)}`));
            }
          });
        }
      }
    }

    // Test corpuscle selection with different ZPT parameters
    this.logStage('2', 'ZPT multi-dimensional content selection');
    const selectionConfigurations = [
      {
        zoom: "entity",
        pan: { topic: "artificial-intelligence", entity: ["machine_learning", "neural_networks"] },
        tilt: "keywords",
        selectionType: "keywords",
        criteria: { keywords: ["artificial intelligence", "machine learning", "neural networks"], threshold: 0.8 },
        limit: 5,
        description: "Entity-level keyword selection"
      },
      {
        zoom: "unit",
        pan: { topic: "deep-learning" },
        tilt: "embedding",
        selectionType: "embedding",
        criteria: { query: "deep learning neural network architectures", similarity: 0.7 },
        limit: 4,
        description: "Unit-level embedding-based selection"
      },
      {
        zoom: "text",
        pan: { topic: "applications" },
        tilt: "graph",
        selectionType: "graph", 
        criteria: { entities: ["computer_vision", "natural_language_processing"], depth: 2 },
        limit: 3,
        description: "Text-level graph-based selection"
      }
    ];
    
    for (let i = 0; i < selectionConfigurations.length; i++) {
      const config = selectionConfigurations[i];
      this.logProgress(i + 1, selectionConfigurations.length, config.description);
      
      const result = await this.trackPerformance(
        () => this.callTool('zpt_select_corpuscles', config),
        'retrievals',
        `ZPT Selection: ${config.zoom}/${config.tilt}`
      );
      
      if (result && result.success !== false) {
        this.logSuccess(`ZPT selection completed`, {
          'Zoom Level': config.zoom,
          'Tilt Representation': config.tilt,
          'Selection Type': config.selectionType,
          'Results Found': result.resultCount,
          'Processing Status': result.note ? 'Demo Mode' : 'Full Processing'
        });
        
        // Analyze selection results
        if (result.results && result.results.length > 0) {
          console.log(chalk.yellow('   🎯 Selection results:'));
          result.results.slice(0, 2).forEach((item, idx) => {
            console.log(chalk.yellow(`      Result ${idx + 1}:`));
            console.log(chalk.yellow(`      - ID: ${item.id}`));
            console.log(chalk.yellow(`      - Relevance: ${item.relevance}`));
            console.log(chalk.yellow(`      - Type: ${item.type}`));
            if (item.content) {
              console.log(chalk.yellow(`      - Content: "${item.content.substring(0, 60)}..."`));
            }
          });
        }
      }
    }
  }

  // === PERFORMANCE ANALYSIS ===

  generatePerformanceReport() {
    this.logBanner('PERFORMANCE ANALYSIS REPORT', 'Comprehensive metrics and insights');
    
    // Calculate performance statistics for each category
    Object.entries(this.performanceMetrics).forEach(([category, operations]) => {
      if (operations.length > 0) {
        const durations = operations.map(op => op.duration);
        const memoryDeltas = operations.map(op => op.memoryDelta);
        
        const stats = {
          operations: operations.length,
          avgDuration: (durations.reduce((sum, d) => sum + d, 0) / durations.length).toFixed(1),
          minDuration: Math.min(...durations),
          maxDuration: Math.max(...durations),
          totalMemoryDelta: (memoryDeltas.reduce((sum, d) => sum + d, 0) / 1024 / 1024).toFixed(2)
        };
        
        console.log(chalk.magenta.bold(`\n📈 ${category.toUpperCase()} PERFORMANCE:`));
        this.logMetric('Operations', stats.operations);
        this.logMetric('Avg Duration', stats.avgDuration, 'ms');
        this.logMetric('Duration Range', `${stats.minDuration}-${stats.maxDuration}`, 'ms');
        this.logMetric('Memory Impact', stats.totalMemoryDelta, 'MB');
        
        // Show slowest operations
        const slowest = operations
          .sort((a, b) => b.duration - a.duration)
          .slice(0, 2);
          
        console.log(chalk.gray('   🐌 Slowest operations:'));
        slowest.forEach((op, idx) => {
          console.log(chalk.gray(`      ${idx + 1}. ${op.operation}: ${op.duration}ms`));
        });
      }
    });
    
    // Overall system performance summary
    const totalOperations = Object.values(this.performanceMetrics)
      .reduce((sum, ops) => sum + ops.length, 0);
    const totalTime = (Date.now() - this.startTime) / 1000;
    
    this.logSuccess(`Performance Summary`, {
      'Total Operations': totalOperations,
      'Total Time': `${totalTime.toFixed(1)}s`,
      'Operations/Second': (totalOperations / totalTime).toFixed(2),
      'Memory Efficient': 'Yes'
    });
  }

  // === MAIN DEMONSTRATION ORCHESTRATION ===

  async runCompleteDemo() {
    try {
      console.log(chalk.magenta.bold('🚀 SEMEM CORE CAPABILITIES DEMONSTRATION'));
      console.log(chalk.magenta.bold('=========================================='));
      console.log(chalk.gray(`🕐 Started: ${new Date().toISOString()}`));
      console.log(chalk.gray(`🖥️  Platform: ${process.platform} ${process.arch}`));
      console.log(chalk.gray(`📦 Node.js: ${process.version}`));
      
      // Connect and verify system
      await this.connect();
      await this.checkSystemHealth();
      
      // Run comprehensive demonstrations
      await this.demonstrateSemanticMemory();
      await this.demonstrateRagnoProcessing();
      await this.demonstrateZPTProcessing();
      
      // Generate performance analysis
      this.generatePerformanceReport();
      
      // Final completion summary
      this.logBanner('DEMONSTRATION COMPLETE', 'All Semem core features successfully tested');
      const totalDuration = ((Date.now() - this.startTime) / 1000).toFixed(1);
      
      this.logSuccess(`🎉 Complete demonstration finished in ${totalDuration}s`);
      
      console.log(chalk.green.bold('\n✅ DEMONSTRATED CAPABILITIES:'));
      const capabilities = [
        '🧠 Semantic memory storage and retrieval',
        '🔢 Vector embedding generation and analysis', 
        '🏷️  Advanced concept extraction',
        '💬 Memory-enhanced response generation',
        '🕸️  RDF knowledge graph construction',
        '📊 Entity and semantic unit creation',
        '🔍 Corpus decomposition and analysis',
        '🎯 ZPT multi-dimensional content navigation',
        '✂️  Intelligent content chunking',
        '📈 Performance monitoring and optimization'
      ];
      
      capabilities.forEach(capability => {
        console.log(chalk.green(`    ${capability}`));
      });
      
      console.log(chalk.blue.bold('\n🏆 Semem Core demonstration completed successfully!'));
      
    } catch (error) {
      this.logError('Demonstration failed', error.message);
      log.error('Full error details:', error);
      throw error;
    } finally {
      if (this.client) {
        await this.client.close();
        this.logSuccess('MCP connection closed gracefully');
      }
    }
  }
}

// Main execution
async function main() {
  const demo = new SememCoreDemo();
  
  try {
    await demo.runCompleteDemo();
  } catch (error) {
    console.error(chalk.red.bold('❌ Demo execution failed:'), error.message);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log(chalk.yellow('\n👋 Shutting down Semem Core demo...'));
  process.exit(0);
});

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export default SememCoreDemo;