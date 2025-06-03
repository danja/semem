#!/usr/bin/env node

/**
 * Demo: Basic Memory Storage and Retrieval
 * Tests core memory functionality with storage and retrieval of interactions
 * 
 * Path: ./demos/01-memory-basic.js
 * Run: node demos/01-memory-basic.js
 * 
 * Expected: Successfully stores and retrieves interactions from memory
 */

import MemoryManager from '../src/MemoryManager.js';
import JSONStore from '../src/stores/JSONStore.js';
import OllamaConnector from '../src/connectors/OllamaConnector.js';
import logger from 'loglevel';

logger.setLevel('info');

async function testBasicMemory() {
    console.log('=== DEMO: Basic Memory Storage & Retrieval ===\n');
    
    let memoryManager = null;
    
    try {
        // Initialize components
        console.log('1. Initializing components...');
        const storage = new JSONStore('./demos/data/basic-memory.json');
        const llmProvider = new OllamaConnector();
        
        memoryManager = new MemoryManager({
            llmProvider,
            chatModel: 'qwen2:1.5b',
            embeddingModel: 'nomic-embed-text',
            storage
        });
        
        console.log('   ✓ Memory manager initialized');
        
        // Store some interactions
        console.log('\n2. Storing sample interactions...');
        
        const interactions = [
            {
                prompt: "What is artificial intelligence?",
                response: "Artificial intelligence (AI) is the simulation of human intelligence in machines that are programmed to think and learn like humans.",
                concepts: ["AI", "machine learning", "intelligence"]
            },
            {
                prompt: "How does machine learning work?",
                response: "Machine learning is a subset of AI that enables computers to learn and improve from experience without being explicitly programmed.",
                concepts: ["machine learning", "algorithms", "data"]
            },
            {
                prompt: "What is the difference between AI and ML?",
                response: "AI is the broader concept of machines being able to carry out tasks intelligently, while ML is a specific approach to achieve AI through data-driven learning.",
                concepts: ["AI", "machine learning", "comparison"]
            }
        ];
        
        for (const interaction of interactions) {
            console.log(`   Storing: "${interaction.prompt}"`);
            
            // Generate embedding for the interaction
            const embedding = await memoryManager.generateEmbedding(
                `${interaction.prompt} ${interaction.response}`
            );
            
            // Store the interaction
            await memoryManager.addInteraction(
                interaction.prompt,
                interaction.response,
                embedding,
                interaction.concepts
            );
            
            console.log('   ✓ Stored successfully');
        }
        
        // Test retrieval
        console.log('\n3. Testing memory retrieval...');
        
        const queries = [
            "Tell me about artificial intelligence",
            "How do computers learn?",
            "What's the relationship between AI and ML?"
        ];
        
        for (const query of queries) {
            console.log(`\n   Query: "${query}"`);
            
            const relevantMemories = await memoryManager.retrieveRelevantInteractions(query);
            
            console.log(`   Found ${relevantMemories.length} relevant memories:`);
            
            relevantMemories.slice(0, 2).forEach((memory, idx) => {
                console.log(`     ${idx + 1}. Similarity: ${memory.similarity?.toFixed(2) || 'N/A'}`);
                console.log(`        Prompt: "${memory.interaction?.prompt || memory.prompt}"`);
                console.log(`        Concepts: [${(memory.interaction?.concepts || memory.concepts || []).join(', ')}]`);
            });
        }
        
        console.log('\n4. Testing response generation with memory...');
        
        const testPrompt = "Can you explain machine learning using what you know?";
        console.log(`   Prompt: "${testPrompt}"`);
        
        const relevantContext = await memoryManager.retrieveRelevantInteractions(testPrompt);
        const response = await memoryManager.generateResponse(testPrompt, [], relevantContext);
        
        console.log(`   Response: "${response}"`);
        console.log(`   Used ${relevantContext.length} memories for context`);
        
        console.log('\n✅ DEMO COMPLETED SUCCESSFULLY');
        console.log('\nWhat was tested:');
        console.log('- Memory initialization with Ollama connector');
        console.log('- Storage of interactions with embeddings and concepts');
        console.log('- Semantic retrieval based on similarity');
        console.log('- Response generation using memory context');
        console.log('- JSON file persistence');
        
    } catch (error) {
        console.error('\n❌ DEMO FAILED:', error.message);
        console.error('Stack:', error.stack);
        
        console.log('\nTroubleshooting:');
        console.log('- Ensure Ollama is running: ollama serve');
        console.log('- Ensure models are available: ollama pull qwen2:1.5b && ollama pull nomic-embed-text');
        console.log('- Check network connectivity to Ollama (default: http://localhost:11434)');
        
    } finally {
        if (memoryManager) {
            try {
                await memoryManager.dispose();
                console.log('Memory manager disposed cleanly');
            } catch (disposeError) {
                console.error('Error disposing memory manager:', disposeError);
            }
        }
    }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\nReceived SIGINT, shutting down...');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\nReceived SIGTERM, shutting down...');
    process.exit(0);
});

testBasicMemory();