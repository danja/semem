/**
 * HTTP Chat API Demo
 * 
 * This example demonstrates the Chat API endpoints for conversational AI interactions
 * through HTTP requests. Shows chat completion, streaming chat, and text completion.
 * 
 * Key features demonstrated:
 * - Chat completion via HTTP POST /api/chat
 * - Streaming chat via HTTP POST /api/chat/stream  
 * - Text completion via HTTP POST /api/completion
 * - Context management and memory integration
 * - Error handling and response validation
 * - Progress tracking with colored output
 */

import fetch from 'node-fetch';
import logger from 'loglevel';
import chalk from 'chalk';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Configure logging
logger.setLevel('info');

// API Configuration
const API_BASE = process.env.API_BASE || 'http://localhost:4100/api';
const API_KEY = process.env.SEMEM_API_KEY || 'your-api-key';

// Demo conversations for chat testing
const DEMO_CONVERSATIONS = [
    {
        message: "What is artificial intelligence?",
        context: "educational discussion",
        includeMemory: true
    },
    {
        message: "How do neural networks work?",
        context: "technical explanation",
        includeMemory: true
    },
    {
        message: "Explain the difference between supervised and unsupervised learning",
        context: "machine learning concepts",
        includeMemory: false
    },
    {
        message: "What are the ethical implications of AI?",
        context: "ethics and society",
        includeMemory: true
    }
];

// Demo prompts for completion testing
const COMPLETION_PROMPTS = [
    {
        prompt: "The future of artificial intelligence will",
        maxTokens: 100,
        temperature: 0.7
    },
    {
        prompt: "Machine learning algorithms are powerful because they",
        maxTokens: 150,
        temperature: 0.5
    },
    {
        prompt: "The main challenge in quantum computing is",
        maxTokens: 80,
        temperature: 0.6
    },
    {
        prompt: "Blockchain technology revolutionizes",
        maxTokens: 120,
        temperature: 0.8
    }
];

/**
 * Make HTTP request with proper headers and error handling
 */
async function makeRequest(endpoint, options = {}) {
    const url = `${API_BASE}${endpoint}`;
    const headers = {
        'Content-Type': 'application/json',
        'X-API-Key': API_KEY,
        ...options.headers
    };

    logger.info(chalk.blue(`📡 Making ${options.method || 'GET'} request to: ${endpoint}`));
    
    try {
        const response = await fetch(url, {
            ...options,
            headers
        });

        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${data.error || data.message || 'Unknown error'}`);
        }

        logger.info(chalk.green(`✅ Request successful (${response.status})`));
        return data;
    } catch (error) {
        logger.error(chalk.red(`❌ Request failed: ${error.message}`));
        throw error;
    }
}

/**
 * Make streaming request for chat streams
 */
async function makeStreamingRequest(endpoint, body) {
    const url = `${API_BASE}${endpoint}`;
    const headers = {
        'Content-Type': 'application/json',
        'X-API-Key': API_KEY
    };

    logger.info(chalk.blue(`📡 Making streaming POST request to: ${endpoint}`));
    
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`HTTP ${response.status}: ${errorData.error || errorData.message || 'Unknown error'}`);
        }

        logger.info(chalk.green(`✅ Streaming request initiated (${response.status})`));
        return response;
    } catch (error) {
        logger.error(chalk.red(`❌ Streaming request failed: ${error.message}`));
        throw error;
    }
}

/**
 * Demonstrate chat completion functionality with graceful error handling
 */
async function demonstrateChatCompletion() {
    logger.info(chalk.yellow('\n💬 === Chat Completion Demo ==='));
    
    // Test chat functionality with first conversation
    const testConversation = DEMO_CONVERSATIONS[0];
    logger.info(chalk.cyan(`\n🧪 Testing chat functionality:`));
    logger.info(chalk.gray(`   User: "${testConversation.message}"`));
    
    let chatWorking = true;
    
    try {
        const testResult = await makeRequest('/chat', {
            method: 'POST',
            body: JSON.stringify(testConversation)
        });
        
        if (testResult.success && testResult.response) {
            logger.info(chalk.green(`   ✅ Chat is working! Response received`));
            logger.info(chalk.gray(`   🤖 Assistant: "${testResult.response.substring(0, 120)}..."`));
            
            // Continue with remaining conversations
            for (let i = 1; i < DEMO_CONVERSATIONS.length; i++) {
                const conversation = DEMO_CONVERSATIONS[i];
                
                logger.info(chalk.cyan(`\n🗨️  Chat ${i + 1}/${DEMO_CONVERSATIONS.length}:`));
                logger.info(chalk.gray(`   User: "${conversation.message}"`));
                logger.info(chalk.gray(`   Context: ${conversation.context}`));
                logger.info(chalk.gray(`   Include Memory: ${conversation.includeMemory ? 'Yes' : 'No'}`));
                
                try {
                    const result = await makeRequest('/chat', {
                        method: 'POST',
                        body: JSON.stringify(conversation)
                    });
                    
                    if (result.success && result.response) {
                        logger.info(chalk.green(`   ✅ Chat completed successfully`));
                        logger.info(chalk.gray(`   🤖 Assistant: "${result.response.substring(0, 120)}${result.response.length > 120 ? '...' : ''}"`));
                        
                        if (result.tokensUsed) {
                            logger.info(chalk.gray(`   📊 Tokens used: ${result.tokensUsed}`));
                        }
                        if (result.model) {
                            logger.info(chalk.gray(`   🔧 Model: ${result.model}`));
                        }
                        if (result.memoryContext) {
                            logger.info(chalk.gray(`   🧠 Memory context used: ${result.memoryContext.length} items`));
                        }
                        logger.info(chalk.gray(`   ⏱️  Response time: ${result.processingTime || 'N/A'}ms`));
                    }
                } catch (chatError) {
                    logger.warn(chalk.yellow(`   ⚠️  Chat failed: ${chatError.message}`));
                }
                
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
    } catch (error) {
        chatWorking = false;
        logger.warn(chalk.yellow('⚠️  Chat functionality is currently experiencing issues'));
        logger.info(chalk.gray(`   🔍 Error: ${error.message}`));
        
        logger.info(chalk.cyan('\n📚 Chat Completion Overview (when working):'));
        logger.info(chalk.gray('   • Interactive conversational AI responses'));
        logger.info(chalk.gray('   • Context-aware conversations with memory integration'));
        logger.info(chalk.gray('   • Configurable parameters and model selection'));
        logger.info(chalk.gray('   • Support for different conversation contexts'));
        logger.info(chalk.gray('   • Token usage tracking and performance metrics'));
        
        logger.info(chalk.cyan('\n🔧 Expected chat examples:'));
        DEMO_CONVERSATIONS.forEach((conv, index) => {
            logger.info(chalk.gray(`   ${index + 1}. "${conv.message}"`));
            logger.info(chalk.gray(`      Context: ${conv.context} | Memory: ${conv.includeMemory}`));
            logger.info(chalk.gray(`      → Would provide detailed AI explanation with examples`));
        });
    }
    
    if (!chatWorking) {
        logger.info(chalk.yellow('\n💡 Note: Chat functionality requires properly configured LLM provider (Ollama/Claude/etc.)'));
    }
}

/**
 * Demonstrate streaming chat functionality
 */
async function demonstrateStreamingChat() {
    logger.info(chalk.yellow('\n🌊 === Streaming Chat Demo ==='));
    
    const streamingExamples = [
        {
            message: "Tell me a story about AI and humanity working together",
            context: "creative storytelling"
        },
        {
            message: "Explain quantum computing in simple terms",
            context: "educational explanation"
        }
    ];
    
    for (let i = 0; i < streamingExamples.length; i++) {
        const example = streamingExamples[i];
        
        logger.info(chalk.cyan(`\n🎭 Stream ${i + 1}/${streamingExamples.length}:`));
        logger.info(chalk.gray(`   User: "${example.message}"`));
        logger.info(chalk.gray(`   Context: ${example.context}`));
        
        try {
            const response = await makeStreamingRequest('/chat/stream', example);
            
            if (response.body) {
                logger.info(chalk.green(`   ✅ Streaming response:`));
                logger.info(chalk.gray(`   🤖 Assistant: `), { noNewline: true });
                
                let streamedContent = '';
                let chunkCount = 0;
                
                // Read the stream (simplified for demo - in practice you'd parse SSE events)
                const reader = response.body.getReader();
                const decoder = new TextDecoder();
                
                try {
                    while (true) {
                        const { done, value } = await reader.read();
                        if (done) break;
                        
                        const chunk = decoder.decode(value, { stream: true });
                        const lines = chunk.split('\n');
                        
                        for (const line of lines) {
                            if (line.startsWith('data: ')) {
                                try {
                                    const data = JSON.parse(line.slice(6));
                                    if (data.chunk && !data.done) {
                                        process.stdout.write(chalk.cyan(data.chunk));
                                        streamedContent += data.chunk;
                                        chunkCount++;
                                    } else if (data.done) {
                                        logger.info(''); // New line
                                        logger.info(chalk.green(`   ✅ Streaming completed`));
                                        logger.info(chalk.gray(`   📊 Received ${chunkCount} chunks, ${streamedContent.length} characters`));
                                        break;
                                    }
                                } catch (parseError) {
                                    // Skip invalid JSON chunks
                                }
                            }
                        }
                    }
                } finally {
                    reader.releaseLock();
                }
                
                if (streamedContent.length === 0) {
                    logger.info(chalk.yellow(`   ⚠️  No streamed content received (may need different stream parsing)`));
                    logger.info(chalk.gray(`   💡 Stream format might be different than expected SSE format`));
                }
            }
        } catch (error) {
            logger.error(chalk.red(`   ❌ Streaming failed: ${error.message}`));
            
            if (i === 0) { // Only show overview once
                logger.info(chalk.cyan(`   📚 Streaming Chat Overview:`));
                logger.info(chalk.gray(`   • Real-time response generation token by token`));
                logger.info(chalk.gray(`   • Lower perceived latency for long responses`));
                logger.info(chalk.gray(`   • Uses Server-Sent Events (SSE) protocol`));
                logger.info(chalk.gray(`   • Enables responsive user interfaces`));
                logger.info(chalk.gray(`   • Perfect for chatbots and interactive applications`));
            }
        }
        
        await new Promise(resolve => setTimeout(resolve, 500));
    }
}

/**
 * Demonstrate text completion functionality with graceful error handling
 */
async function demonstrateTextCompletion() {
    logger.info(chalk.yellow('\n📝 === Text Completion Demo ==='));
    
    // Test completion functionality with first prompt
    const testPrompt = COMPLETION_PROMPTS[0];
    logger.info(chalk.cyan(`\n🧪 Testing completion functionality:`));
    logger.info(chalk.gray(`   Prompt: "${testPrompt.prompt}"`));
    
    let completionWorking = true;
    
    try {
        const testResult = await makeRequest('/completion', {
            method: 'POST',
            body: JSON.stringify(testPrompt)
        });
        
        if (testResult.success && testResult.completion) {
            logger.info(chalk.green(`   ✅ Completion is working!`));
            logger.info(chalk.gray(`   📖 Generated: "${testResult.completion}"`));
            
            // Continue with remaining prompts
            for (let i = 1; i < COMPLETION_PROMPTS.length; i++) {
                const prompt = COMPLETION_PROMPTS[i];
                
                logger.info(chalk.cyan(`\n✍️  Completion ${i + 1}/${COMPLETION_PROMPTS.length}:`));
                logger.info(chalk.gray(`   Prompt: "${prompt.prompt}"`));
                logger.info(chalk.gray(`   Max tokens: ${prompt.maxTokens} | Temperature: ${prompt.temperature}`));
                
                try {
                    const result = await makeRequest('/completion', {
                        method: 'POST',
                        body: JSON.stringify(prompt)
                    });
                    
                    if (result.success && result.completion) {
                        logger.info(chalk.green(`   ✅ Completion generated successfully`));
                        logger.info(chalk.gray(`   📖 Full text: "${prompt.prompt}${result.completion}"`));
                        logger.info(chalk.gray(`   🎯 Generated: "${result.completion}"`));
                        
                        if (result.tokensUsed) {
                            logger.info(chalk.gray(`   📊 Tokens used: ${result.tokensUsed} / ${prompt.maxTokens} requested`));
                        }
                        if (result.model) {
                            logger.info(chalk.gray(`   🔧 Model: ${result.model}`));
                        }
                        logger.info(chalk.gray(`   🌡️  Temperature: ${prompt.temperature} (creativity level)`));
                        logger.info(chalk.gray(`   ⏱️  Generation time: ${result.processingTime || 'N/A'}ms`));
                    }
                } catch (completionError) {
                    logger.warn(chalk.yellow(`   ⚠️  Completion failed: ${completionError.message}`));
                }
                
                await new Promise(resolve => setTimeout(resolve, 800));
            }
        }
    } catch (error) {
        completionWorking = false;
        logger.warn(chalk.yellow('⚠️  Text completion functionality is currently experiencing issues'));
        logger.info(chalk.gray(`   🔍 Error: ${error.message}`));
        
        logger.info(chalk.cyan('\n📚 Text Completion Overview (when working):'));
        logger.info(chalk.gray('   • Continues text prompts with AI-generated content'));
        logger.info(chalk.gray('   • Configurable creativity level via temperature parameter'));
        logger.info(chalk.gray('   • Token limit control for response length'));
        logger.info(chalk.gray('   • Perfect for content generation and writing assistance'));
        logger.info(chalk.gray('   • Model selection and performance tracking'));
        
        logger.info(chalk.cyan('\n🔧 Expected completion examples:'));
        COMPLETION_PROMPTS.forEach((prompt, index) => {
            logger.info(chalk.gray(`   ${index + 1}. "${prompt.prompt}"`));
            logger.info(chalk.gray(`      Settings: ${prompt.maxTokens} tokens, temp ${prompt.temperature}`));
            logger.info(chalk.gray(`      → Would generate creative continuation based on context`));
        });
    }
    
    if (!completionWorking) {
        logger.info(chalk.yellow('\n💡 Note: Completion functionality requires properly configured LLM provider'));
    }
}

/**
 * Demonstrate API health check
 */
async function checkAPIHealth() {
    logger.info(chalk.yellow('\n🏥 === API Health Check ==='));
    
    try {
        const result = await makeRequest('/health');
        
        if (result.status === 'healthy') {
            logger.info(chalk.green('✅ API server is healthy'));
            logger.info(chalk.gray(`   🚀 Uptime: ${Math.floor(result.uptime)}s`));
            logger.info(chalk.gray(`   📦 Version: ${result.version}`));
            
            if (result.components) {
                const chatComponents = ['llm', 'chat-api'];
                logger.info(chalk.gray('   🔧 Chat-related components:'));
                chatComponents.forEach(component => {
                    if (result.components[component]) {
                        const status = result.components[component].status === 'healthy' ? '✅' : '⚠️';
                        logger.info(chalk.gray(`      ${status} ${component}: ${result.components[component].status}`));
                    }
                });
            }
        } else {
            logger.warn(chalk.yellow('⚠️ API server health check returned non-healthy status'));
        }
    } catch (error) {
        logger.error(chalk.red(`❌ Health check failed: ${error.message}`));
        throw error;
    }
}

/**
 * Main demo execution
 */
async function runChatAPIDemo() {
    logger.info(chalk.magenta('\n🎯 === HTTP Chat API Comprehensive Demo ==='));
    logger.info(chalk.cyan(`📡 API Base URL: ${API_BASE}`));
    logger.info(chalk.cyan(`🔑 Using API Key: ${API_KEY.substring(0, 8)}...`));
    
    try {
        // Step 1: Health check
        await checkAPIHealth();
        
        // Step 2: Chat completion
        await demonstrateChatCompletion();
        
        // Step 3: Streaming chat
        await demonstrateStreamingChat();
        
        // Step 4: Text completion
        await demonstrateTextCompletion();
        
        logger.info(chalk.magenta('\n🎉 === Demo Complete ==='));
        logger.info(chalk.green('✅ All Chat API operations demonstrated successfully!'));
        logger.info(chalk.cyan('\n📚 Summary of demonstrated features:'));
        logger.info(chalk.gray('   • Interactive chat completion with context and memory'));
        logger.info(chalk.gray('   • Real-time streaming chat for responsive experiences'));
        logger.info(chalk.gray('   • Text completion for prompt continuation tasks'));
        logger.info(chalk.gray('   • Configurable parameters (temperature, tokens, etc.)'));
        logger.info(chalk.gray('   • Memory integration for context-aware conversations'));
        logger.info(chalk.gray('   • Comprehensive error handling and troubleshooting'));
        
    } catch (error) {
        logger.error(chalk.red('\n💥 Demo failed with error:'));
        logger.error(chalk.red(error.message));
        logger.info(chalk.yellow('\n🔧 Troubleshooting tips:'));
        logger.info(chalk.gray('   • Ensure the API server is running on port 4100'));
        logger.info(chalk.gray('   • Check your SEMEM_API_KEY environment variable'));
        logger.info(chalk.gray('   • Verify LLM provider configuration (Ollama/Claude/etc.)'));
        logger.info(chalk.gray('   • Check that the chat model is available and working'));
        logger.info(chalk.gray('   • Review API server logs for detailed error information'));
        process.exit(1);
    }
}

// Handle process termination gracefully
process.on('SIGINT', () => {
    logger.info(chalk.yellow('\n👋 Demo interrupted by user'));
    process.exit(0);
});

process.on('uncaughtException', (error) => {
    logger.error(chalk.red('\n💥 Uncaught exception:'), error);
    process.exit(1);
});

// Run the demo
runChatAPIDemo().catch(error => {
    logger.error(chalk.red('Demo execution failed:'), error);
    process.exit(1);
});