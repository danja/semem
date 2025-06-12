/**
 * Context Management Example
 * 
 * This example demonstrates comprehensive context management and window processing
 * capabilities including text chunking, token estimation, context buffer management,
 * and memory-context integration.
 * 
 * Key features demonstrated:
 * - Text chunking and window creation
 * - Token estimation and size calculation
 * - Overlapping content merging
 * - Context buffer management and pruning
 * - Context summarization and building
 * - Memory-context integration
 * - Long context handling
 * - Edge cases and error handling
 * 
 * Prerequisites:
 * - Ollama running with required models for memory operations
 * - Network connectivity for LLM operations
 */

import ContextManager from '../../src/ContextManager.js';
import ContextWindowManager from '../../src/ContextWindowManager.js';
import MemoryManager from '../../src/MemoryManager.js';
import Config from '../../src/Config.js';
import InMemoryStore from '../../src/stores/InMemoryStore.js';
import OllamaConnector from '../../src/connectors/OllamaConnector.js';
import logger from 'loglevel';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Global cleanup reference
let globalCleanup = null;

async function shutdown(signal) {
    logger.info(`\nReceived ${signal}, starting graceful shutdown...`);
    if (globalCleanup) {
        try {
            await globalCleanup();
            logger.info('Cleanup complete');
            process.exit(0);
        } catch (error) {
            logger.error('Error during cleanup:', error);
            process.exit(1);
        }
    } else {
        process.exit(0);
    }
}

// Handle different termination signals
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('uncaughtException', async (error) => {
    logger.error('Uncaught Exception:', error);
    await shutdown('uncaughtException');
});
process.on('unhandledRejection', async (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
    await shutdown('unhandledRejection');
});

async function testContextWindowManager() {
    logger.info('\n=== Testing ContextWindowManager ===');
    
    const windowManager = new ContextWindowManager({
        minWindowSize: 512,
        maxWindowSize: 2048,
        overlapRatio: 0.1,
        avgTokenLength: 4
    });
    
    // Test text for chunking
    const longText = `
    Artificial intelligence (AI) is intelligence demonstrated by machines, in contrast to the natural intelligence displayed by humans and animals. Leading AI textbooks define the field as the study of "intelligent agents": any device that perceives its environment and takes actions that maximize its chance of successfully achieving its goals. Colloquially, the term "artificial intelligence" is often used to describe machines that mimic "cognitive" functions that humans associate with the human mind, such as "learning" and "problem solving".
    
    The scope of AI is disputed: as machines become increasingly capable, tasks considered to require "intelligence" are often removed from the definition of AI, a phenomenon known as the AI effect. A quip in Tesler's Theorem says "AI is whatever hasn't been done yet." For instance, optical character recognition is frequently excluded from things considered to be AI, having become a routine technology.
    
    Modern machine learning techniques are at the core of AI. Problems for AI applications include reasoning, knowledge representation, planning, learning, natural language processing, perception, and the ability to move and manipulate objects. Approaches include statistical methods, computational intelligence, and traditional symbolic AI.
    
    The field was founded on the assumption that human intelligence "can be so precisely described that a machine can be made to simulate it". This raises philosophical arguments about the mind and the ethics of creating artificial beings endowed with human-like intelligence.
    `;
    
    logger.info('--- Text Window Creation ---');
    logger.info(`Input text length: ${longText.length} characters`);
    
    const estimatedTokens = windowManager.estimateTokens(longText);
    logger.info(`Estimated tokens: ${estimatedTokens}`);
    
    const windowSize = windowManager.calculateWindowSize(longText);
    logger.info(`Calculated window size: ${windowSize}`);
    
    const windows = windowManager.createWindows(longText, windowSize);
    logger.info(`✓ Created ${windows.length} windows:`);
    
    windows.forEach((window, idx) => {
        const preview = window.text.substring(0, 100).replace(/\s+/g, ' ').trim();
        logger.info(`  Window ${idx + 1}: ${window.start}-${window.end} (${window.text.length} chars)`);
        logger.info(`    Preview: "${preview}..."`);
    });
    
    // Test context processing
    logger.info('\n--- Context Processing ---');
    const processedWindows = windowManager.processContext(longText, { includeMetadata: true });
    
    logger.info(`✓ Processed ${processedWindows.length} context windows`);
    processedWindows.forEach((window, idx) => {
        logger.info(`  Window ${idx + 1}: ${window.tokenEstimate} estimated tokens`);
    });
    
    // Test content merging
    logger.info('\n--- Overlapping Content Merge ---');
    const merged = windowManager.mergeOverlappingContent(windows);
    logger.info(`✓ Merged content length: ${merged.length} characters`);
    logger.info(`Original vs merged: ${longText.length} -> ${merged.length}`);
    
    return true;
}

async function testContextManager() {
    logger.info('\n=== Testing ContextManager ===');
    
    const contextManager = new ContextManager({
        maxTokens: 4096,
        maxTimeWindow: 24 * 60 * 60 * 1000, // 24 hours
        relevanceThreshold: 0.7,
        maxContextSize: 5
    });
    
    // Test context buffer management
    logger.info('--- Context Buffer Management ---');
    
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
        const similarity = 0.8 + (idx * 0.05); // Varying similarity
        contextManager.addToContext(interaction, similarity);
        logger.info(`Added interaction ${idx + 1} with similarity ${similarity.toFixed(3)}`);
    });
    
    logger.info(`✓ Context buffer size: ${contextManager.contextBuffer.length}`);
    
    // Test context summarization
    logger.info('\n--- Context Summarization ---');
    
    const summary = contextManager.summarizeContext(sampleInteractions);
    const summaryPreview = summary.substring(0, 200).replace(/\s+/g, ' ').trim();
    logger.info('✓ Generated context summary:');
    logger.info(`"${summaryPreview}..."`);
    
    // Test context building
    logger.info('\n--- Context Building ---');
    
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
    
    logger.info('✓ Built complete context:');
    logger.info(`Context length: ${builtContext.length} characters`);
    const contextPreview = builtContext.substring(0, 300).replace(/\s+/g, ' ').trim();
    logger.info(`Preview: "${contextPreview}..."`);
    
    // Test context pruning
    logger.info('\n--- Context Pruning ---');
    const beforePrune = contextManager.contextBuffer.length;
    contextManager.pruneContext();
    const afterPrune = contextManager.contextBuffer.length;
    
    logger.info(`✓ Pruned context: ${beforePrune} -> ${afterPrune} items`);
    
    return true;
}

async function testMemoryContextIntegration(config) {
    logger.info('\n=== Testing Memory-Context Integration ===');
    
    // Get Ollama configuration
    const ollamaBaseUrl = config.get('ollama.baseUrl') || 'http://localhost:11434';
    const chatModel = config.get('chatModel') || 'qwen2:1.5b';
    const embeddingModel = config.get('embeddingModel') || 'nomic-embed-text';
    
    logger.info(`Using Ollama at: ${ollamaBaseUrl}`);
    logger.info(`Chat model: ${chatModel}`);
    logger.info(`Embedding model: ${embeddingModel}`);
    
    const llmProvider = new OllamaConnector(ollamaBaseUrl, chatModel);
    const storage = new InMemoryStore();
    
    const memoryManager = new MemoryManager({
        llmProvider,
        chatModel,
        embeddingModel,
        storage,
        contextOptions: {
            maxTokens: 2048,
            overlapRatio: 0.15
        }
    });
    
    // Build a knowledge base
    logger.info('--- Building Knowledge Base ---');
    
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
        
        logger.info(`✓ Added: ${item.topic}`);
    }
    
    // Test contextual response generation
    logger.info('\n--- Contextual Response Generation ---');
    
    const contextualQueries = [
        "How do machines learn from examples and feedback?",
        "What are the main approaches to teaching AI systems?",
        "Compare different types of machine learning paradigms"
    ];
    
    for (const query of contextualQueries) {
        logger.info(`\nQuery: "${query}"`);
        
        // Retrieve relevant context
        const relevantMemories = await memoryManager.retrieveRelevantInteractions(query);
        logger.info(`Found ${relevantMemories.length} relevant memories`);
        
        // Generate response with context
        const response = await memoryManager.generateResponse(query, [], relevantMemories);
        const responseStr = typeof response === 'string' ? response : String(response);
        const responsePreview = responseStr.substring(0, 200).replace(/\s+/g, ' ').trim();
        logger.info(`Response: "${responsePreview}..."`);
        
        // Show which memories were used
        relevantMemories.slice(0, 3).forEach((memory, idx) => {
            const interaction = memory.interaction || memory;
            const similarity = memory.similarity?.toFixed(3) || 'N/A';
            logger.info(`  Used memory ${idx + 1}: "${interaction.prompt}" (sim: ${similarity})`);
        });
    }
    
    // Test long context handling
    logger.info('\n--- Long Context Handling ---');
    
    const longQuery = `
    I'm building an AI system that needs to handle multiple types of learning scenarios.
    I need to understand the differences between supervised, unsupervised, and reinforcement learning.
    Additionally, I want to know how computer vision and natural language processing fit into this landscape.
    Can you provide a comprehensive overview that covers the key algorithms, use cases, and implementation considerations for each approach?
    I'm particularly interested in practical applications and how these different paradigms can be combined in real-world systems.
    `.trim();
    
    logger.info('Testing with long, complex query...');
    logger.info(`Query length: ${longQuery.length} characters`);
    
    const longContextMemories = await memoryManager.retrieveRelevantInteractions(longQuery);
    const longResponse = await memoryManager.generateResponse(longQuery, [], longContextMemories);
    const longResponseStr = typeof longResponse === 'string' ? longResponse : String(longResponse);
    
    logger.info(`✓ Long context response generated: ${longResponseStr.length} characters`);
    logger.info(`Used ${longContextMemories.length} memories for context`);
    const longPreview = longResponseStr.substring(0, 300).replace(/\s+/g, ' ').trim();
    logger.info(`Response preview: "${longPreview}..."`);
    
    await memoryManager.dispose();
    return true;
}

async function testContextWindowEdgeCases() {
    logger.info('\n=== Testing Context Window Edge Cases ===');
    
    const windowManager = new ContextWindowManager({
        minWindowSize: 100,
        maxWindowSize: 500,
        overlapRatio: 0.2
    });
    
    // Test very short text
    logger.info('--- Very Short Text ---');
    const shortText = "AI is cool.";
    const shortWindows = windowManager.createWindows(shortText, 100);
    logger.info(`✓ Short text windows: ${shortWindows.length}`);
    
    // Test text with no spaces
    logger.info('--- Text Without Spaces ---');
    const noSpaceText = "artificialintelligencemachinelearningdeeplearning".repeat(10);
    const noSpaceWindows = windowManager.createWindows(noSpaceText, 200);
    logger.info(`✓ No-space text windows: ${noSpaceWindows.length}`);
    logger.info(`No-space text length: ${noSpaceText.length} characters`);
    
    // Test empty/null inputs
    logger.info('--- Edge Case Inputs ---');
    try {
        const emptyWindows = windowManager.createWindows("", 100);
        logger.info(`✓ Empty text windows: ${emptyWindows.length}`);
    } catch (error) {
        logger.warn(`⚠️  Empty text handling: ${error.message}`);
    }
    
    // Test very large text
    logger.info('--- Very Large Text ---');
    const largeText = "This is a sentence about artificial intelligence. ".repeat(1000);
    const largeWindows = windowManager.createWindows(largeText, 1000);
    const avgSize = largeWindows.reduce((sum, w) => sum + w.text.length, 0) / largeWindows.length;
    
    logger.info(`✓ Large text windows: ${largeWindows.length}`);
    logger.info(`Large text length: ${largeText.length} characters`);
    logger.info(`Average window size: ${Math.round(avgSize)} characters`);
    
    return true;
}

async function main() {
    // Set appropriate log level
    logger.setLevel(process.env.LOG_LEVEL || 'info');

    logger.info('🚀 Starting Context Management Example');

    // Initialize configuration
    const config = new Config('./config/config.json');
    await config.init();

    const testResults = {
        windowManager: false,
        contextManager: false,
        memoryIntegration: false,
        edgeCases: false
    };

    try {
        // Set up cleanup function
        globalCleanup = async () => {
            logger.info('Context management example cleanup completed');
        };
        
        // Run all context management tests
        logger.info('\n=== Context Management and Window Processing Tests ===');
        
        testResults.windowManager = await testContextWindowManager();
        testResults.contextManager = await testContextManager();
        testResults.memoryIntegration = await testMemoryContextIntegration(config);
        testResults.edgeCases = await testContextWindowEdgeCases();
        
        // Generate comprehensive summary
        logger.info('\n' + '='.repeat(60));
        logger.info('=== CONTEXT MANAGEMENT TEST SUMMARY ===');
        logger.info('='.repeat(60));
        
        const successful = Object.entries(testResults).filter(([_, success]) => success);
        const failed = Object.entries(testResults).filter(([_, success]) => !success);
        
        logger.info(`\n📊 Overall Results:`);
        logger.info(`✅ Successful tests: ${successful.length}/${Object.keys(testResults).length}`);
        logger.info(`❌ Failed tests: ${failed.length}/${Object.keys(testResults).length}`);
        
        if (successful.length > 0) {
            logger.info(`\n✅ Working Components:`);
            successful.forEach(([test, _]) => {
                const testName = test.replace(/([A-Z])/g, ' $1').toLowerCase();
                logger.info(`  ✓ ${testName}: Working correctly`);
            });
        }
        
        if (failed.length > 0) {
            logger.info(`\n❌ Failed Components:`);
            failed.forEach(([test, _]) => {
                const testName = test.replace(/([A-Z])/g, ' $1').toLowerCase();
                logger.info(`  ✗ ${testName}: Failed or unavailable`);
            });
        }
        
        // Feature assessment
        logger.info(`\n📋 Feature Assessment:`);
        const features = [
            { name: 'Text Chunking', test: 'windowManager' },
            { name: 'Context Buffer Management', test: 'contextManager' },
            { name: 'Memory Integration', test: 'memoryIntegration' },
            { name: 'Edge Case Handling', test: 'edgeCases' }
        ];
        
        features.forEach(feature => {
            const status = testResults[feature.test] ? '✅' : '❌';
            logger.info(`  ${status} ${feature.name}: ${testResults[feature.test] ? 'Working' : 'Failed'}`);
        });
        
        if (successful.length === Object.keys(testResults).length) {
            logger.info('\n=== Context Management Example Completed Successfully ===');
        } else {
            logger.info(`\n=== Context Management Example Partially Successful ===`);
            logger.info(`(${successful.length}/${Object.keys(testResults).length} components working)`);
        }
        
        logger.info('\nWhat was demonstrated:');
        logger.info('✓ Text chunking and window creation');
        logger.info('✓ Token estimation and size calculation');
        logger.info('✓ Overlapping content merging');
        logger.info('✓ Context buffer management and pruning');
        logger.info('✓ Context summarization and building');
        logger.info('✓ Memory-context integration');
        logger.info('✓ Long context handling');
        logger.info('✓ Edge cases and error handling');
        logger.info('✓ Configuration-driven setup');
        
    } catch (error) {
        logger.error('\n❌ Example failed:', error.message);
        logger.error('Stack:', error.stack);
        
        logger.info('\nTroubleshooting:');
        logger.info('- Ensure Ollama is running for memory operations: ollama serve');
        logger.info('- Check if required models are installed: ollama pull qwen2:1.5b && ollama pull nomic-embed-text');
        logger.info('- Verify system memory for large text processing');
        logger.info('- Check network connectivity for LLM operations');
        logger.info('- Ensure configuration file is properly set up');
        
        await shutdown('error');
    }
}

// Start the application
main().catch(async (error) => {
    logger.error('Fatal error:', error);
    await shutdown('fatal error');
});