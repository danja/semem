/**
 * Answer.js - MCP stdio server for semem:answer tool
 * 
 * Provides iterative feedback-based question answering using the complete Flow pipeline.
 * Based on examples/flow/10-iterative-feedback.js but exposed as an MCP tool.
 */

import dotenv from 'dotenv';
dotenv.config();

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { 
  CallToolRequestSchema,
  ListToolsRequestSchema
} from '@modelcontextprotocol/sdk/types.js';

// Import Flow components
import Config from '../../src/Config.js';
import LLMHandler from '../../src/handlers/LLMHandler.js';
import OllamaConnector from '../../src/connectors/OllamaConnector.js';
import ClaudeConnector from '../../src/connectors/ClaudeConnector.js';
import MistralConnector from '../../src/connectors/MistralConnector.js';
import FeedbackWorkflow from '../../src/compose/workflows/FeedbackWorkflow.js';
import SPARQLHelper from '../../src/services/sparql/SPARQLHelper.js';

// Import debugging utilities
import { mcpDebugger } from '../lib/debug-utils.js';

/**
 * Initialize LLM handler following Flow patterns
 */
async function initializeLLMHandler(config) {
    mcpDebugger.info('Initializing LLM handler for answer service...');

    const llmProviders = config.get('llmProviders') || [];
    const chatProvider = llmProviders
        .filter(p => p.capabilities?.includes('chat'))
        .sort((a, b) => (a.priority || 999) - (b.priority || 999))[0];

    if (!chatProvider) {
        throw new Error('No chat LLM provider configured');
    }

    mcpDebugger.info(`Selected provider: ${chatProvider.type} (priority ${chatProvider.priority})`);

    let llmConnector;
    
    if (chatProvider.type === 'mistral' && process.env.MISTRAL_API_KEY) {
        llmConnector = new MistralConnector(process.env.MISTRAL_API_KEY);
    } else if (chatProvider.type === 'claude' && process.env.CLAUDE_API_KEY) {
        llmConnector = new ClaudeConnector(process.env.CLAUDE_API_KEY);
    } else {
        mcpDebugger.info('API key not found, falling back to Ollama');
        llmConnector = new OllamaConnector('http://localhost:11434', 'qwen2:1.5b');
        chatProvider.chatModel = 'qwen2:1.5b';
    }

    const llmHandler = new LLMHandler(llmConnector, chatProvider.chatModel);
    mcpDebugger.info(`LLM handler initialized with ${chatProvider.type} provider`);
    return llmHandler;
}

/**
 * Get feedback options for different modes
 */
function getFeedbackOptionsForMode(mode) {
    const options = {
        basic: {
            maxIterations: 2,
            feedbackThreshold: 0.3,
            enableWikidataResearch: false,
            feedbackMode: 'basic'
        },
        standard: {
            maxIterations: 3,
            feedbackThreshold: 0.5,
            enableWikidataResearch: true,
            feedbackMode: 'iterative'
        },
        comprehensive: {
            maxIterations: 5,
            feedbackThreshold: 0.7,
            enableWikidataResearch: true,
            feedbackMode: 'comprehensive'
        }
    };
    
    return options[mode] || options.standard;
}

/**
 * Process a single question with iterative feedback
 */
async function processQuestionWithFeedback(question, llmHandler, sparqlHelper, config, mode = 'standard') {
    mcpDebugger.info(`Processing question with iterative feedback: "${question.substring(0, 50)}..."`);
    
    const feedbackWorkflow = new FeedbackWorkflow();
    
    const resources = {
        llmHandler,
        sparqlHelper,
        config: config
    };
    
    const feedbackOptions = getFeedbackOptionsForMode(mode);
    mcpDebugger.info(`Using ${mode} mode with ${feedbackOptions.maxIterations} max iterations`);
    
    try {
        // Execute iterative feedback workflow
        const feedbackResult = await feedbackWorkflow.execute(
            { 
                question: { text: question },
                enableIterativeFeedback: true,
                enableWikidataResearch: feedbackOptions.enableWikidataResearch
            },
            resources,
            feedbackOptions
        );
        
        if (feedbackResult.success) {
            const data = feedbackResult.data;
            
            mcpDebugger.info(`Completed ${data.workflow.iterationsPerformed} iterations`);
            mcpDebugger.info(`Completeness improvement: ${(data.completenessImprovement.improvement * 100).toFixed(1)}%`);
            
            return {
                success: true,
                question: question,
                answer: data.finalAnswer,
                metadata: {
                    iterations: data.workflow.iterationsPerformed,
                    initialAnswer: data.initialAnswer,
                    completenessImprovement: data.completenessImprovement,
                    followUpQuestions: data.totalResearchQuestions,
                    entitiesDiscovered: data.totalEntitiesDiscovered,
                    mode: mode,
                    duration: data.workflow.totalDuration || 0
                }
            };
        } else {
            throw new Error(feedbackResult.error || 'Feedback workflow failed');
        }
        
    } catch (error) {
        mcpDebugger.error('Error in question processing:', error);
        return {
            success: false,
            question: question,
            error: error.message
        };
    }
}

/**
 * Create and configure MCP server
 */
async function createServer() {
    mcpDebugger.info('Creating Answer MCP server...');
    
    const server = new Server(
        {
            name: "semem-answer",
            version: "1.0.0",
            instructions: "Provides iterative feedback-based question answering using the complete Semem Flow pipeline"
        },
        {
            capabilities: {
                tools: {}
            }
        }
    );

    // Register tools list handler
    server.setRequestHandler(ListToolsRequestSchema, async () => {
        return {
            tools: [
                {
                    name: 'semem:answer',
                    description: 'Answer a question using iterative feedback and the complete Semem knowledge processing pipeline',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            question: { 
                                type: 'string', 
                                description: 'The question to answer'
                            },
                            mode: {
                                type: 'string',
                                enum: ['basic', 'standard', 'comprehensive'],
                                default: 'standard',
                                description: 'Answer quality mode: basic (2 iterations), standard (3 iterations), comprehensive (5 iterations)'
                            }
                        },
                        required: ['question']
                    }
                }
            ]
        };
    });

    // Register tool call handler
    server.setRequestHandler(CallToolRequestSchema, async (request) => {
        const { name, arguments: args } = request.params;
        mcpDebugger.info(`Tool call: ${name}`, args);
        
        try {
            if (name === 'semem:answer') {
                const { question, mode = 'standard' } = args;
                
                if (!question || typeof question !== 'string' || !question.trim()) {
                    throw new Error('Invalid question parameter. It must be a non-empty string.');
                }
                
                // Initialize configuration
                const config = new Config('./config/config.json');
                await config.init();
                
                const workflowConfig = {
                    beerqaGraphURI: 'http://purl.org/stuff/beerqa/test',
                    wikipediaGraphURI: 'http://purl.org/stuff/wikipedia/research',
                    wikidataGraphURI: 'http://purl.org/stuff/wikidata/research'
                };
                
                // Initialize LLM handler
                const llmHandler = await initializeLLMHandler(config);
                
                const sparqlHelper = new SPARQLHelper(
                    config.get('sparqlUpdateEndpoint') || 'http://localhost:3030/semem/update',
                    {
                        auth: config.get('sparqlAuth') || { user: 'admin', password: 'admin123' },
                        timeout: 30000
                    }
                );
                
                // Process question with iterative feedback
                const result = await processQuestionWithFeedback(
                    question, 
                    llmHandler, 
                    sparqlHelper, 
                    workflowConfig, 
                    mode
                );
                
                if (result.success) {
                    return {
                        content: [{
                            type: "text",
                            text: JSON.stringify({
                                success: true,
                                question: result.question,
                                answer: result.answer,
                                metadata: result.metadata
                            }, null, 2)
                        }]
                    };
                } else {
                    return {
                        content: [{
                            type: "text",
                            text: JSON.stringify({
                                success: false,
                                question: result.question,
                                error: result.error
                            }, null, 2)
                        }],
                        isError: true
                    };
                }
            }
            
            throw new Error(`Unknown tool: ${name}`);
            
        } catch (error) {
            mcpDebugger.error(`Error in tool ${name}:`, error);
            return {
                content: [{
                    type: "text",
                    text: JSON.stringify({
                        success: false,
                        error: error.message,
                        tool: name
                    }, null, 2)
                }],
                isError: true
            };
        }
    });
    
    mcpDebugger.info('Answer MCP server created successfully');
    return server;
}

/**
 * Main entry point
 */
async function main() {
    try {
        mcpDebugger.info('🚀 Starting Semem Answer MCP Server...');

        // Create server
        const server = await createServer();

        // Create transport
        const transport = new StdioServerTransport();

        // Connect server to transport
        await server.connect(transport);

        mcpDebugger.info('✅ Semem Answer MCP server running on stdio transport');

    } catch (error) {
        mcpDebugger.error('❌ Failed to start Answer server', {
            error: error.message,
            stack: error.stack
        });
        process.exit(1);
    }
}

// Only run if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(console.error);
}

export { createServer };