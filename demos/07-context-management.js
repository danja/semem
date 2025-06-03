#!/usr/bin/env node

/**
 * Demo: Context Management and Window Processing
 * Tests context window management, text chunking, and memory context building
 * 
 * Path: ./demos/07-context-management.js
 * Run: node demos/07-context-management.js
 * 
 * Expected: Successfully demonstrates context window processing and memory integration
 */

import ContextManager from '../src/ContextManager.js';
import ContextWindowManager from '../src/ContextWindowManager.js';
import MemoryManager from '../src/MemoryManager.js';
import InMemoryStore from '../src/stores/InMemoryStore.js';
import OllamaConnector from '../src/connectors/OllamaConnector.js';
import logger from 'loglevel';

logger.setLevel('info');

async function testContextWindowManager() {
    console.log('1. Testing ContextWindowManager...');
    
    const windowManager = new ContextWindowManager({
        minWindowSize: 512,
        maxWindowSize: 2048,
        overlapRatio: 0.1,
        avgTokenLength: 4
    });
    
    // Test text chunking
    const longText = `
    Artificial intelligence (AI) is intelligence demonstrated by machines, in contrast to the natural intelligence displayed by humans and animals. Leading AI textbooks define the field as the study of "intelligent agents": any device that perceives its environment and takes actions that maximize its chance of successfully achieving its goals. Colloquially, the term "artificial intelligence" is often used to describe machines that mimic "cognitive" functions that humans associate with the human mind, such as "learning" and "problem solving".
    
    The scope of AI is disputed: as machines become increasingly capable, tasks considered to require "intelligence" are often removed from the definition of AI, a phenomenon known as the AI effect. A quip in Tesler's Theorem says "AI is whatever hasn't been done yet." For instance, optical character recognition is frequently excluded from things considered to be AI, having become a routine technology.
    
    Modern machine learning techniques are at the core of AI. Problems for AI applications include reasoning, knowledge representation, planning, learning, natural language processing, perception, and the ability to move and manipulate objects. Approaches include statistical methods, computational intelligence, and traditional symbolic AI.
    
    The field was founded on the assumption that human intelligence "can be so precisely described that a machine can be made to simulate it". This raises philosophical arguments about the mind and the ethics of creating artificial beings endowed with human-like intelligence.
    `;
    
    console.log('   Testing text window creation...');
    console.log(`   Input text length: ${longText.length} characters`);
    
    const estimatedTokens = windowManager.estimateTokens(longText);
    console.log(`   Estimated tokens: ${estimatedTokens}`);
    
    const windowSize = windowManager.calculateWindowSize(longText);
    console.log(`   Calculated window size: ${windowSize}`);
    
    const windows = windowManager.createWindows(longText, windowSize);
    console.log(`   ✓ Created ${windows.length} windows:`);
    
    windows.forEach((window, idx) => {
        console.log(`     Window ${idx + 1}: ${window.start}-${window.end} (${window.text.length} chars)`);
        console.log(`       Preview: "${window.text.substring(0, 100)}..."`);
    });
    
    // Test context processing
    console.log('\n   Testing context processing...');
    const processedWindows = windowManager.processContext(longText, { includeMetadata: true });
    
    console.log(`   ✓ Processed ${processedWindows.length} context windows`);
    processedWindows.forEach((window, idx) => {
        console.log(`     Window ${idx + 1}: ${window.tokenEstimate} estimated tokens`);
    });
    
    // Test content merging
    console.log('\n   Testing overlapping content merge...');
    const merged = windowManager.mergeOverlappingContent(windows);
    console.log(`   ✓ Merged content length: ${merged.length} characters`);
    console.log(`   Original vs merged: ${longText.length} -> ${merged.length}`);
    
    return true;
}

async function testContextManager() {
    console.log('\n2. Testing ContextManager...');
    
    const contextManager = new ContextManager({
        maxTokens: 4096,
        maxTimeWindow: 24 * 60 * 60 * 1000, // 24 hours
        relevanceThreshold: 0.7,
        maxContextSize: 5
    });
    
    // Test context buffer management
    console.log('   Testing context buffer management...');
    
    const sampleInteractions = [
        {
            id: '1',
            prompt: "What is machine learning?",
            output: "Machine learning is a subset of AI that enables computers to learn from data.",
            concepts: ["machine learning", "AI", "data"],
            timestamp: Date.now() - 1000
        },
        {
            id: '2', 
            prompt: "How do neural networks work?",
            output: "Neural networks process information through interconnected nodes in layers.",
            concepts: ["neural networks", "layers", "processing"],
            timestamp: Date.now() - 500
        },
        {
            id: '3',
            prompt: "What is deep learning?",
            output: "Deep learning uses multiple layers of neural networks for complex pattern recognition.",
            concepts: ["deep learning", "neural networks", "patterns"],
            timestamp: Date.now()
        }
    ];
    
    // Add interactions to context
    sampleInteractions.forEach((interaction, idx) => {
        const similarity = 0.8 + (idx * 0.1); // Varying similarity
        contextManager.addToContext(interaction, similarity);
        console.log(`   Added interaction ${idx + 1} with similarity ${similarity}`);
    });
    
    console.log(`   ✓ Context buffer size: ${contextManager.contextBuffer.length}`);
    
    // Test context summarization
    console.log('\n   Testing context summarization...');
    
    const summary = contextManager.summarizeContext(sampleInteractions);
    console.log('   ✓ Generated context summary:');
    console.log(`   "${summary.substring(0, 200)}..."`);
    
    // Test context building
    console.log('\n   Testing context building...');
    
    const currentPrompt = "Tell me about artificial intelligence and its applications";
    const retrievals = sampleInteractions.map(interaction => ({
        interaction,
        similarity: 0.85
    }));
    
    const builtContext = contextManager.buildContext(
        currentPrompt,
        retrievals,
        [],
        { systemContext: "You are an AI assistant with knowledge of machine learning." }
    );
    
    console.log('   ✓ Built complete context:');
    console.log(`   Context length: ${builtContext.length} characters`);
    console.log(`   Preview: "${builtContext.substring(0, 300)}..."`);
    
    // Test context pruning
    console.log('\n   Testing context pruning...');
    const beforePrune = contextManager.contextBuffer.length;
    contextManager.pruneContext();
    const afterPrune = contextManager.contextBuffer.length;
    
    console.log(`   ✓ Pruned context: ${beforePrune} -> ${afterPrune} items`);
    
    return true;
}

async function testMemoryContextIntegration() {
    console.log('\n3. Testing Memory-Context Integration...');
    
    const llmProvider = new OllamaConnector();
    const storage = new InMemoryStore();
    
    const memoryManager = new MemoryManager({
        llmProvider,
        chatModel: 'qwen2:1.5b',
        embeddingModel: 'nomic-embed-text',
        storage,
        contextOptions: {
            maxTokens: 2048,
            overlapRatio: 0.15
        }
    });
    
    // Build a knowledge base
    console.log('   Building knowledge base...');
    
    const knowledgeItems = [
        {
            topic: "Supervised Learning",
            content: "Supervised learning uses labeled training data to learn a mapping from inputs to outputs. Common algorithms include linear regression, decision trees, and support vector machines."
        },
        {
            topic: "Unsupervised Learning", 
            content: "Unsupervised learning finds hidden patterns in data without labeled examples. Clustering, dimensionality reduction, and association rules are key techniques."
        },
        {
            topic: "Reinforcement Learning",
            content: "Reinforcement learning teaches agents to make decisions through trial and error, using rewards and punishments to guide learning."
        },
        {
            topic: "Computer Vision",
            content: "Computer vision enables machines to interpret visual information from images and videos using convolutional neural networks and feature detection."
        },
        {
            topic: "Natural Language Processing",
            content: "NLP helps computers understand and generate human language through tokenization, parsing, semantic analysis, and transformer models."
        }
    ];
    
    for (const item of knowledgeItems) {
        const fullText = `${item.topic}: ${item.content}`;
        const embedding = await memoryManager.generateEmbedding(fullText);
        const concepts = await memoryManager.extractConcepts(fullText);
        
        await memoryManager.addInteraction(
            `What is ${item.topic}?`,
            item.content,
            embedding,
            concepts
        );
        
        console.log(`   ✓ Added: ${item.topic}`);
    }
    
    // Test contextual response generation
    console.log('\n   Testing contextual response generation...');
    
    const contextualQueries = [
        "How do machines learn from examples and feedback?",
        "What are the main approaches to teaching AI systems?",
        "Compare different types of machine learning paradigms"
    ];
    
    for (const query of contextualQueries) {
        console.log(`\n     Query: "${query}"`);
        
        // Retrieve relevant context
        const relevantMemories = await memoryManager.retrieveRelevantInteractions(query);
        console.log(`     Found ${relevantMemories.length} relevant memories`);
        
        // Generate response with context
        const response = await memoryManager.generateResponse(query, [], relevantMemories);
        console.log(`     Response: "${response.substring(0, 200)}..."`);
        
        // Show which memories were used
        relevantMemories.slice(0, 3).forEach((memory, idx) => {
            const interaction = memory.interaction || memory;
            console.log(`       Used memory ${idx + 1}: "${interaction.prompt}" (sim: ${memory.similarity?.toFixed(2)})`);
        });
    }
    
    // Test long context handling
    console.log('\n   Testing long context handling...');
    
    const longQuery = `
    I'm building an AI system that needs to handle multiple types of learning scenarios.
    I need to understand the differences between supervised, unsupervised, and reinforcement learning.
    Additionally, I want to know how computer vision and natural language processing fit into this landscape.
    Can you provide a comprehensive overview that covers the key algorithms, use cases, and implementation considerations for each approach?
    I'm particularly interested in practical applications and how these different paradigms can be combined in real-world systems.
    `;
    
    console.log('     Testing with long, complex query...');
    
    const longContextMemories = await memoryManager.retrieveRelevantInteractions(longQuery);
    const longResponse = await memoryManager.generateResponse(longQuery, [], longContextMemories);
    
    console.log(`     ✓ Long context response generated: ${longResponse.length} characters`);
    console.log(`     Used ${longContextMemories.length} memories for context`);
    console.log(`     Response preview: "${longResponse.substring(0, 300)}..."`);
    
    await memoryManager.dispose();
    return true;
}

async function testContextWindowEdgeCases() {
    console.log('\n4. Testing context window edge cases...');
    
    const windowManager = new ContextWindowManager({
        minWindowSize: 100,
        maxWindowSize: 500,
        overlapRatio: 0.2
    });
    
    // Test very short text
    console.log('   Testing very short text...');
    const shortText = "AI is cool.";
    const shortWindows = windowManager.createWindows(shortText, 100);
    console.log(`   ✓ Short text windows: ${shortWindows.length}`);
    
    // Test text with no spaces
    console.log('   Testing text without spaces...');
    const noSpaceText = "artificialintelligencemachinelearningdeeplearning".repeat(10);
    const noSpaceWindows = windowManager.createWindows(noSpaceText, 200);
    console.log(`   ✓ No-space text windows: ${noSpaceWindows.length}`);
    
    // Test empty/null inputs
    console.log('   Testing edge case inputs...');
    try {
        const emptyWindows = windowManager.createWindows("", 100);
        console.log(`   ✓ Empty text windows: ${emptyWindows.length}`);
    } catch (error) {
        console.log(`   ⚠️  Empty text handling: ${error.message}`);
    }
    
    // Test very large text
    console.log('   Testing very large text...');
    const largeText = "This is a sentence about artificial intelligence. ".repeat(1000);
    const largeWindows = windowManager.createWindows(largeText, 1000);
    console.log(`   ✓ Large text windows: ${largeWindows.length}`);
    console.log(`   Average window size: ${largeWindows.reduce((sum, w) => sum + w.text.length, 0) / largeWindows.length}`);
    
    return true;
}

async function testContextManagement() {
    console.log('=== DEMO: Context Management and Window Processing ===\n');
    
    const testResults = {
        windowManager: false,
        contextManager: false,
        memoryIntegration: false,
        edgeCases: false
    };
    
    try {
        testResults.windowManager = await testContextWindowManager();
        testResults.contextManager = await testContextManager();
        testResults.memoryIntegration = await testMemoryContextIntegration();
        testResults.edgeCases = await testContextWindowEdgeCases();
        
        // Summary
        console.log('\n=== CONTEXT MANAGEMENT TEST SUMMARY ===');
        
        const successful = Object.entries(testResults).filter(([_, success]) => success);
        const failed = Object.entries(testResults).filter(([_, success]) => !success);
        
        console.log(`\n✅ Successful tests (${successful.length}):`);
        successful.forEach(([test, _]) => {
            console.log(`   - ${test}: Working correctly`);
        });
        
        if (failed.length > 0) {
            console.log(`\n❌ Failed tests (${failed.length}):`);
            failed.forEach(([test, _]) => {
                console.log(`   - ${test}: Failed or unavailable`);
            });
        }
        
        if (successful.length === Object.keys(testResults).length) {
            console.log('\n✅ DEMO COMPLETED SUCCESSFULLY');
        } else {
            console.log(`\n⚠️ DEMO PARTIALLY SUCCESSFUL (${successful.length}/${Object.keys(testResults).length})`);
        }
        
        console.log('\nWhat was tested:');
        console.log('- Text chunking and window creation');
        console.log('- Token estimation and size calculation');
        console.log('- Overlapping content merging');
        console.log('- Context buffer management and pruning');
        console.log('- Context summarization and building');
        console.log('- Memory-context integration');
        console.log('- Long context handling');
        console.log('- Edge cases and error handling');
        
    } catch (error) {
        console.error('\n❌ DEMO FAILED:', error.message);
        console.error('Stack:', error.stack);
        
        console.log('\nTroubleshooting:');
        console.log('- Ensure Ollama is running for memory operations');
        console.log('- Check if required models are installed');
        console.log('- Verify system memory for large text processing');
        console.log('- Check for network connectivity issues');
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

testContextManagement();