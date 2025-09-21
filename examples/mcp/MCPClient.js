#!/usr/bin/env node

/**
 * Semem MCP Client Example
 * 
 * This example demonstrates how to use the Semem MCP server to:
 * 1. Store and retrieve semantic memories
 * 2. Process text with Ragno knowledge graph decomposition
 * 3. Use ZPT for intelligent content chunking and selection
 * 4. Build a complete semantic processing pipeline
 */

import path from 'path';
import { fileURLToPath } from 'url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

class SememMCPClient {
  constructor() {
    this.client = null;
    this.transport = null;
  }

  async connect() {
    console.log('🔌 Connecting to Semem MCP Server...');
    
    this.client = new Client({ name: "semem-example-client", version: "1.0.0" });
        const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const projectRoot = path.resolve(__dirname, '../..'); // Resolves to the 'semem' directory

    this.transport = new StdioClientTransport({
      command: 'node',
      args: ['./mcp/index.js'],
      cwd: projectRoot
    });

    await this.client.connect(this.transport);
    console.log('✅ Connected to MCP server!');
    
    // List available tools
    const tools = await this.client.listTools();
    console.log(`📚 Available tools: ${tools.tools.length}`);
    tools.tools.forEach(tool => {
      console.log(`   - ${tool.name}: ${tool.description || 'No description'}`);
    });
    
    return this;
  }

  async disconnect() {
    if (this.client) {
      await this.client.close();
      console.log('🔌 Disconnected from MCP server');
    }
  }

  async callTool(name, args) {
    try {
      const result = await this.client.callTool({ name, arguments: args });
      return JSON.parse(result.content[0].text);
    } catch (error) {
      console.error(`❌ Error calling ${name}:`, error.message);
      return null;
    }
  }

  // === DEMONSTRATION METHODS ===

  async demonstrateSemanticMemory() {
    console.log('\n🧠 === SEMANTIC MEMORY DEMONSTRATION ===');
    
    // Store some interactions about AI topics
    const conversations = [
      {
        prompt: "What is machine learning?",
        response: "Machine learning is a subset of artificial intelligence that enables computers to learn and improve from experience without being explicitly programmed. It uses algorithms to analyze data, identify patterns, and make predictions or decisions.",
        metadata: { topic: "AI/ML", difficulty: "beginner" }
      },
      {
        prompt: "Explain neural networks",
        response: "Neural networks are computing systems inspired by biological neural networks. They consist of interconnected nodes (neurons) that process information through weighted connections. Deep neural networks with multiple layers can learn complex patterns and representations.",
        metadata: { topic: "AI/ML", difficulty: "intermediate" }
      },
      {
        prompt: "What are transformers in AI?",
        response: "Transformers are a neural network architecture that revolutionized natural language processing. They use attention mechanisms to process sequences of data in parallel, enabling models like GPT and BERT to understand context and relationships in text more effectively.",
        metadata: { topic: "AI/ML", difficulty: "advanced" }
      }
    ];

    // Store interactions
    console.log('📝 Storing conversations...');
    for (const conv of conversations) {
      const result = await this.callTool('semem_store_interaction', conv);
      if (result) {
        console.log(`   ✅ Stored: "${conv.prompt.substring(0, 30)}..."`);
      }
    }

    // Test embedding generation
    console.log('\n🔢 Generating embeddings...');
    const embeddingResult = await this.callTool('semem_generate_embedding', {
      text: "Deep learning and artificial intelligence"
    });
    if (embeddingResult) {
      console.log(`   ✅ Generated ${embeddingResult.embeddingLength}-dimensional embedding`);
      console.log(`   📊 First 5 dimensions: [${embeddingResult.embedding.slice(0, 5).join(', ')}]`);
    }

    // Test concept extraction
    console.log('\n🏷️ Extracting concepts...');
    const conceptResult = await this.callTool('semem_extract_concepts', {
      text: "Artificial intelligence and machine learning are transforming healthcare, finance, and autonomous vehicles through deep neural networks and reinforcement learning algorithms."
    });
    if (conceptResult) {
      console.log(`   ✅ Extracted ${conceptResult.conceptCount} concepts:`);
      conceptResult.concepts.forEach(concept => console.log(`      - ${concept}`));
    }

    // Test memory retrieval
    console.log('\n🔍 Retrieving relevant memories...');
    const memoryResult = await this.callTool('semem_retrieve_memories', {
      query: "deep learning neural networks",
      threshold: 0.6,
      limit: 2
    });
    if (memoryResult && memoryResult.memories) {
      console.log(`   ✅ Found ${memoryResult.count} relevant memories:`);
      memoryResult.memories.forEach((memory, i) => {
        const similarity = memory.similarity !== undefined ? memory.similarity.toFixed(3) : 'N/A';
        console.log(`      ${i + 1}. Similarity: ${similarity}`);
        console.log(`         Q: ${memory.prompt || 'No prompt'}`);
        const response = memory.response || memory.answer || memory.text || 'No response';
        console.log(`         A: ${response.substring(0, 100)}...`);
      });
    }

    // Test memory-enhanced response generation
    console.log('\n🤖 Generating memory-enhanced response...');
    const responseResult = await this.callTool('semem_generate_response', {
      prompt: "How do neural networks relate to machine learning?",
      useMemory: true,
      temperature: 0.7
    });
    if (responseResult) {
      console.log(`   ✅ Generated response using ${responseResult.retrievalCount} memories and ${responseResult.contextCount} context items`);
      console.log(`   📝 Response: ${responseResult.response}`);
    }
  }

  async demonstrateKnowledgeGraph() {
    console.log('\n🕸️ === KNOWLEDGE GRAPH (RAGNO) DEMONSTRATION ===');

    // Create individual entities
    console.log('🏗️ Creating knowledge entities...');
    const entities = [
      { name: "Artificial Intelligence", isEntryPoint: true, subType: "technology", frequency: 10 },
      { name: "Machine Learning", isEntryPoint: true, subType: "technology", frequency: 8 },
      { name: "Neural Networks", isEntryPoint: false, subType: "algorithm", frequency: 6 },
      { name: "Deep Learning", isEntryPoint: false, subType: "technique", frequency: 5 }
    ];

    for (const entity of entities) {
      const result = await this.callTool('ragno_create_entity', entity);
      if (result && result.created) {
        console.log(`   ✅ Created entity: ${result.entity.name} (${result.entity.subType})`);
      }
    }

    // Create semantic units
    console.log('\n📄 Creating semantic units...');
    const units = [
      {
        text: "Machine learning algorithms enable computers to automatically improve their performance on a specific task through experience.",
        summary: "ML enables automatic performance improvement",
        source: "ai-textbook",
        position: 0,
        length: 108
      },
      {
        text: "Neural networks are inspired by the biological neural networks that constitute animal brains.",
        summary: "Neural networks inspired by biology",
        source: "ai-textbook", 
        position: 108,
        length: 88
      }
    ];

    for (const unit of units) {
      const result = await this.callTool('ragno_create_semantic_unit', unit);
      if (result && result.created) {
        console.log(`   ✅ Created semantic unit: "${result.unit.summary}"`);
      }
    }

    // Demonstrate corpus decomposition
    console.log('\n🔬 Decomposing text corpus...');
    const textChunks = [
      "Artificial intelligence represents a transformative technology that enables machines to perform tasks typically requiring human intelligence.",
      "Machine learning, a subset of AI, allows systems to automatically learn and improve from experience without explicit programming.",
      "Deep learning utilizes neural networks with multiple layers to model and understand complex patterns in large datasets.",
      "Natural language processing enables computers to understand, interpret, and generate human language in meaningful ways.",
      "Computer vision allows machines to interpret and understand visual information from the world, mimicking human sight."
    ];

    const decompositionResult = await this.callTool('ragno_decompose_corpus', {
      textChunks,
      options: {
        maxEntities: 20,
        minFrequency: 1,
        extractRelationships: true
      }
    });

    if (decompositionResult) {
      console.log(`   ✅ Decomposition complete!`);
      console.log(`   📊 Statistics:`);
      console.log(`      - ${decompositionResult.unitCount} semantic units`);
      console.log(`      - ${decompositionResult.entityCount} entities`);
      console.log(`      - ${decompositionResult.relationshipCount} relationships`);
      
      if (decompositionResult.entities.length > 0) {
        console.log(`   🏷️ Top entities:`);
        decompositionResult.entities.forEach(entity => {
          console.log(`      - ${entity.name} (freq: ${entity.frequency}, entry: ${entity.isEntryPoint})`);
        });
      }

      if (decompositionResult.relationships.length > 0) {
        console.log(`   🔗 Sample relationships:`);
        decompositionResult.relationships.forEach(rel => {
          console.log(`      - ${rel.source} → ${rel.target} (${rel.description})`);
        });
      }
    }
  }

  async demonstrateZPTProcessing() {
    console.log('\n🎯 === ZPT (CONTENT PROCESSING) DEMONSTRATION ===');

    // Demonstrate content chunking with different strategies
    const longText = `
Artificial intelligence has emerged as one of the most transformative technologies of the 21st century. From healthcare to finance, from transportation to entertainment, AI is reshaping every industry and aspect of our daily lives.

Machine learning, the core subset of AI, enables computers to learn patterns from data without explicit programming. This capability has led to breakthroughs in image recognition, natural language processing, and predictive analytics.

Deep learning, utilizing neural networks with multiple layers, has revolutionized our ability to process complex, unstructured data. These networks can identify intricate patterns in images, understand context in text, and even generate human-like content.

The applications of AI are vast and growing. In healthcare, AI assists in medical diagnosis and drug discovery. In finance, it powers algorithmic trading and fraud detection. Autonomous vehicles rely on AI for navigation and safety systems.

However, the rapid advancement of AI also brings challenges. Ethical considerations around bias, privacy, and job displacement require careful attention. The development of artificial general intelligence (AGI) raises questions about control and alignment with human values.

As we move forward, the key lies in responsible AI development that maximizes benefits while minimizing risks. This requires collaboration between technologists, policymakers, and society as a whole.
    `.trim();

    console.log('✂️ Testing different chunking strategies...');
    
    const chunkingMethods = [
      { method: "fixed", chunkSize: 300, overlap: 50 },
      { method: "semantic", chunkSize: 400, overlap: 75 },
      { method: "adaptive", chunkSize: 350, overlap: 60 }
    ];

    for (const options of chunkingMethods) {
      const result = await this.callTool('zpt_chunk_content', {
        content: longText,
        options: { ...options, preserveStructure: true }
      });

      if (result) {
        console.log(`   📋 ${options.method.toUpperCase()} chunking:`);
        console.log(`      - Original length: ${result.originalLength} chars`);
        console.log(`      - Generated chunks: ${result.chunkCount}`);
        console.log(`      - Sample chunks:`);
        result.chunks.forEach((chunk, i) => {
          console.log(`        ${i + 1}. "${chunk.content}" ${chunk.metadata ? JSON.stringify(chunk.metadata) : ''}`);
        });
      }
    }

    // Demonstrate corpuscle selection
    console.log('\n🎯 Testing content selection strategies...');
    
    const selectionStrategies = [
      {
        zoom: "entity",
        pan: { topic: "artificial-intelligence" },
        tilt: "keywords",
        selectionType: "keywords",
        criteria: { keywords: ["artificial intelligence", "machine learning"], threshold: 0.8 },
        limit: 3
      },
      {
        zoom: "text",
        pan: { topic: "healthcare" },
        tilt: "embedding",
        selectionType: "embedding", 
        criteria: { query: "AI applications in healthcare", similarity: 0.7 },
        limit: 2
      }
    ];

    for (const params of selectionStrategies) {
      const result = await this.callTool('zpt_select_corpuscles', params);
      
      if (result) {
        console.log(`   🔍 ${params.selectionType.toUpperCase()} selection (zoom: ${params.zoom}, tilt: ${params.tilt}):`);
        console.log(`      - Found ${result.resultCount} relevant corpuscles`);
        console.log(`      - Results: ${JSON.stringify(result.results.slice(0, 2), null, 2)}`);
      }
    }
  }

  async demonstrateIntegratedWorkflow() {
    console.log('\n🔄 === INTEGRATED WORKFLOW DEMONSTRATION ===');
    console.log('Combining all three API categories in a complete pipeline...');

    // Step 1: Chunk content using ZPT
    const sourceText = "Quantum computing represents a paradigm shift in computational power. Unlike classical computers that use bits, quantum computers use quantum bits or qubits that can exist in multiple states simultaneously. This superposition, along with entanglement and interference, enables quantum computers to solve certain problems exponentially faster than classical computers.";

    console.log('1️⃣ Chunking source content...');
    const chunkResult = await this.callTool('zpt_chunk_content', {
      content: sourceText,
      options: { method: "semantic", chunkSize: 150, overlap: 30 }
    });

    let chunks = [];
    if (chunkResult && chunkResult.chunks) {
      chunks = chunkResult.chunks.map(c => c.content);
      console.log(`   ✅ Created ${chunks.length} semantic chunks`);
    }

    // Step 2: Process chunks through Ragno for knowledge extraction
    if (chunks.length > 0) {
      console.log('2️⃣ Extracting knowledge graph...');
      const ragnoResult = await this.callTool('ragno_decompose_corpus', {
        textChunks: chunks,
        options: { maxEntities: 10, extractRelationships: true }
      });

      if (ragnoResult) {
        console.log(`   ✅ Extracted ${ragnoResult.entityCount} entities and ${ragnoResult.relationshipCount} relationships`);
        console.log('   🏷️ Key entities:', ragnoResult.entities.map(e => e.name).join(', '));
      }
    }

    // Step 3: Store processed information in semantic memory
    console.log('3️⃣ Storing in semantic memory...');
    const storeResult = await this.callTool('semem_store_interaction', {
      prompt: "What is quantum computing?",
      response: sourceText,
      metadata: { 
        topic: "quantum-computing", 
        processing: "integrated-workflow",
        chunks: chunks.length 
      }
    });

    if (storeResult) {
      console.log('   ✅ Stored in semantic memory');
    }

    // Step 4: Query the enhanced memory system
    console.log('4️⃣ Querying enhanced memory...');
    const queryResult = await this.callTool('semem_retrieve_memories', {
      query: "quantum computing superposition",
      threshold: 0.5,
      limit: 1
    });

    if (queryResult && queryResult.memories && queryResult.memories.length > 0) {
      console.log('   ✅ Retrieved relevant memory with enhanced context');
      console.log(`   📝 Retrieved: "${queryResult.memories[0].prompt}"`);
    }

    console.log('\n🎉 Integrated workflow complete! All three API categories working together.');
  }

  async checkSystemStatus() {
    console.log('\n📊 === SYSTEM STATUS ===');
    
    try {
      const resources = await this.client.listResources();
      console.log('📚 Available resources:', resources.resources.map(r => r.name));

      const statusResource = resources.resources.find(r => r.uri === "semem://status");
      if (statusResource) {
        const status = await this.client.readResource({ uri: "semem://status" });
        const statusData = JSON.parse(status.contents[0].text);
        
        console.log('🔍 System Status:');
        console.log(`   - Memory Manager: ${statusData.services?.memoryManagerInitialized ? '✅' : '❌'}`);
        console.log(`   - Config: ${statusData.services?.configInitialized ? '✅' : '❌'}`);
        console.log(`   - Timestamp: ${statusData.server?.timestamp}`);
      }
    } catch (error) {
      console.log('❌ Could not retrieve system status:', error.message);
    }
  }
}

// Main execution
async function main() {
  console.log('🚀 Semem MCP Client Example');
  console.log('============================');
  
  const client = new SememMCPClient();
  
  try {
    // Connect to server
    await client.connect();
    
    // Check system status
    await client.checkSystemStatus();
    
    // Run demonstrations
    await client.demonstrateSemanticMemory();
    await client.demonstrateKnowledgeGraph();
    await client.demonstrateZPTProcessing();
    await client.demonstrateIntegratedWorkflow();
    
    console.log('\n🎯 === SUMMARY ===');
    console.log('✅ Demonstrated Semem Core: Memory storage, retrieval, embeddings, concepts');
    console.log('✅ Demonstrated Ragno: Entity creation, semantic units, corpus decomposition');  
    console.log('✅ Demonstrated ZPT: Content chunking, corpuscle selection');
    console.log('✅ Demonstrated Integration: End-to-end semantic processing pipeline');
    
  } catch (error) {
    console.error('❌ Example failed:', error);
  } finally {
    await client.disconnect();
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n👋 Shutting down example...');
  process.exit(0);
});

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export default SememMCPClient;