/**
 * Basic Memory Storage and Retrieval Example
 * 
 * This example demonstrates core memory functionality with storage and retrieval
 * of interactions using MemoryManager with JSONStore and OllamaConnector.
 * 
 * Key features demonstrated:
 * - Memory initialization with Ollama connector
 * - Storage of interactions with embeddings and concepts
 * - Semantic retrieval based on similarity
 * - Response generation using memory context
 * - JSON file persistence
 */

import MemoryManager from '../../src/MemoryManager.js';
import JSONStore from '../../src/stores/JSONStore.js';
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

async function main() {
    // Set appropriate log level
    logger.setLevel(process.env.LOG_LEVEL || 'info');

    logger.info('🚀 Starting Basic Memory Storage & Retrieval Example');
    
    let memoryManager = null;
    
    try {
        // Initialize components
        logger.info('\n=== Initializing Components ===');
        const storage = new JSONStore('./examples/data/basic-memory.json');
        const llmProvider = new OllamaConnector();
        
        memoryManager = new MemoryManager({
            llmProvider,
            chatModel: 'qwen2:1.5b',
            embeddingModel: 'nomic-embed-text',
            storage
        });
        
        logger.info('✓ Memory manager initialized with Ollama connector');
        logger.info('✓ Using JSONStore for persistence');
        
        // Set up cleanup function
        globalCleanup = async () => {
            if (memoryManager) {
                try {
                    await memoryManager.dispose();
                    logger.info('Memory manager disposed cleanly');
                } catch (disposeError) {
                    logger.error('Error disposing memory manager:', disposeError);
                }
            }
        };
        
        // Store sample interactions
        logger.info('\n=== Storing Sample Interactions ===');
        
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
            logger.info(`Storing: "${interaction.prompt}"`);
            
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
            
            logger.info('✓ Stored successfully');
        }
        
        // Test retrieval
        logger.info('\n=== Testing Memory Retrieval ===');
        
        const queries = [
            "Tell me about artificial intelligence",
            "How do computers learn?",
            "What's the relationship between AI and ML?"
        ];
        
        for (const query of queries) {
            logger.info(`\nQuery: "${query}"`);
            
            const relevantMemories = await memoryManager.retrieveRelevantInteractions(query);
            
            logger.info(`Found ${relevantMemories.length} relevant memories:`);
            
            relevantMemories.slice(0, 2).forEach((memory, idx) => {
                const similarity = memory.similarity?.toFixed(3) || 'N/A';
                const prompt = memory.interaction?.prompt || memory.prompt;
                const concepts = (memory.interaction?.concepts || memory.concepts || []).join(', ');
                
                logger.info(`  ${idx + 1}. Similarity: ${similarity}`);
                logger.info(`     Prompt: "${prompt}"`);
                logger.info(`     Concepts: [${concepts}]`);
            });
        }
        
        // Test response generation with memory
        logger.info('\n=== Testing Response Generation with Memory ===');
        
        const testPrompt = "Can you explain machine learning using what you know?";
        logger.info(`Prompt: "${testPrompt}"`);
        
        const relevantContext = await memoryManager.retrieveRelevantInteractions(testPrompt);
        const response = await memoryManager.generateResponse(testPrompt, [], relevantContext);
        
        logger.info(`Response: "${response}"`);
        logger.info(`Used ${relevantContext.length} memories for context`);
        
        logger.info('\n=== Example Completed Successfully ===');
        logger.info('\nWhat was demonstrated:');
        logger.info('✓ Memory initialization with Ollama connector');
        logger.info('✓ Storage of interactions with embeddings and concepts');
        logger.info('✓ Semantic retrieval based on similarity');
        logger.info('✓ Response generation using memory context');
        logger.info('✓ JSON file persistence');
        
    } catch (error) {
        logger.error('\n❌ Example failed:', error.message);
        logger.error('Stack:', error.stack);
        
        logger.info('\nTroubleshooting:');
        logger.info('- Ensure Ollama is running: ollama serve');
        logger.info('- Ensure models are available: ollama pull qwen2:1.5b && ollama pull nomic-embed-text');
        logger.info('- Check network connectivity to Ollama (default: http://localhost:11434)');
        
        await shutdown('error');
    }
}

// Start the application
main().catch(async (error) => {
    logger.error('Fatal error:', error);
    await shutdown('fatal error');
});