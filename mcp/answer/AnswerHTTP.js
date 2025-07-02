/**
 * AnswerHTTP.js - MCP HTTP server with streaming for semem:answer tool
 * 
 * Provides iterative feedback-based question answering using the complete Flow pipeline.
 * Based on examples/flow/10-iterative-feedback.js but exposed as an MCP HTTP server with streaming.
 */

import dotenv from 'dotenv';
dotenv.config();

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { 
  CallToolRequestSchema,
  ListToolsRequestSchema
} from '@modelcontextprotocol/sdk/types.js';
import express from 'express';
import cors from 'cors';

// Import Flow components
import Config from '../../src/Config.js';
import LLMHandler from '../../src/handlers/LLMHandler.js';
import OllamaConnector from '../../src/connectors/OllamaConnector.js';
import ClaudeConnector from '../../src/connectors/ClaudeConnector.js';
import MistralConnector from '../../src/connectors/MistralConnector.js';
import FeedbackWorkflow from '../../src/compose/workflows/FeedbackWorkflow.js';
import SPARQLHelper from '../../examples/beerqa/SPARQLHelper.js';

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
 * Process a single question with iterative feedback and streaming updates
 */
async function processQuestionWithFeedback(question, llmHandler, sparqlHelper, config, mode = 'standard', streamCallback = null) {
    mcpDebugger.info(`Processing question with iterative feedback: "${question.substring(0, 50)}..."`);
    
    const feedbackWorkflow = new FeedbackWorkflow();
    
    const resources = {
        llmHandler,
        sparqlHelper,
        config: config
    };
    
    const feedbackOptions = getFeedbackOptionsForMode(mode);
    mcpDebugger.info(`Using ${mode} mode with ${feedbackOptions.maxIterations} max iterations`);
    
    // Stream initial status
    if (streamCallback) {
        streamCallback({
            type: 'status',
            message: `Starting ${mode} mode processing with ${feedbackOptions.maxIterations} max iterations`,
            stage: 'initialization'
        });
    }
    
    try {
        // Create a wrapper to capture workflow progress
        const progressTracker = {
            onIterationStart: (iteration) => {
                if (streamCallback) {
                    streamCallback({
                        type: 'progress',
                        message: `Starting iteration ${iteration}`,
                        stage: 'iteration',
                        iteration: iteration
                    });
                }
            },
            onIterationComplete: (iteration, result) => {
                if (streamCallback) {
                    streamCallback({
                        type: 'progress',
                        message: `Completed iteration ${iteration}`,
                        stage: 'iteration_complete',
                        iteration: iteration,
                        result: result
                    });
                }
            },
            onWikidataResearch: (entities) => {
                if (streamCallback) {
                    streamCallback({
                        type: 'progress',
                        message: `Researching ${entities} Wikidata entities`,
                        stage: 'wikidata_research',
                        entities: entities
                    });
                }
            },
            onAnswerGeneration: () => {
                if (streamCallback) {
                    streamCallback({
                        type: 'progress',
                        message: 'Generating enhanced answer',
                        stage: 'answer_generation'
                    });
                }
            }
        };
        
        // Execute iterative feedback workflow
        const feedbackResult = await feedbackWorkflow.execute(
            { 
                question: { text: question },
                enableIterativeFeedback: true,
                enableWikidataResearch: feedbackOptions.enableWikidataResearch,
                progressTracker: progressTracker
            },
            resources,
            feedbackOptions
        );
        
        if (feedbackResult.success) {
            const data = feedbackResult.data;
            
            mcpDebugger.info(`Completed ${data.workflow.iterationsPerformed} iterations`);
            mcpDebugger.info(`Completeness improvement: ${(data.completenessImprovement.improvement * 100).toFixed(1)}%`);
            
            // Stream completion status
            if (streamCallback) {
                streamCallback({
                    type: 'completion',
                    message: `Processing complete: ${data.workflow.iterationsPerformed} iterations`,
                    stage: 'complete',
                    improvement: data.completenessImprovement.improvement
                });
            }
            
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
        
        // Stream error
        if (streamCallback) {
            streamCallback({
                type: 'error',
                message: `Processing failed: ${error.message}`,
                stage: 'error',
                error: error.message
            });
        }
        
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
    mcpDebugger.info('Creating Answer HTTP MCP server...');
    
    const server = new Server(
        {
            name: "semem-answer-http",
            version: "1.0.0",
            instructions: "Provides iterative feedback-based question answering using the complete Semem Flow pipeline with HTTP streaming"
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
                    description: 'Answer a question using iterative feedback and the complete Semem knowledge processing pipeline with streaming updates',
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
                            },
                            streaming: {
                                type: 'boolean',
                                default: true,
                                description: 'Enable streaming progress updates'
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
                const { question, mode = 'standard', streaming = true } = args;
                
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
                
                // Collection for streaming updates
                const streamingUpdates = [];
                const streamCallback = streaming ? (update) => {
                    streamingUpdates.push({
                        timestamp: new Date().toISOString(),
                        ...update
                    });
                } : null;
                
                // Process question with iterative feedback
                const result = await processQuestionWithFeedback(
                    question, 
                    llmHandler, 
                    sparqlHelper, 
                    workflowConfig, 
                    mode,
                    streamCallback
                );
                
                if (result.success) {
                    return {
                        content: [{
                            type: "text",
                            text: JSON.stringify({
                                success: true,
                                question: result.question,
                                answer: result.answer,
                                metadata: result.metadata,
                                streaming: streaming,
                                updates: streaming ? streamingUpdates : undefined
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
                                error: result.error,
                                streaming: streaming,
                                updates: streaming ? streamingUpdates : undefined
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
    
    mcpDebugger.info('Answer HTTP MCP server created successfully');
    return server;
}

/**
 * Create Express app with MCP and direct endpoints
 */
async function createApp() {
    const app = express();
    
    // Enable CORS and JSON parsing
    app.use(cors());
    app.use(express.json());
    
    // Create MCP server
    const mcpServer = await createServer();
    
    // Create SSE transport for MCP
    const transport = new SSEServerTransport('/mcp', mcpServer);
    
    // Mount MCP SSE endpoint
    app.use('/mcp', transport.router);
    
    // Health check endpoint
    app.get('/health', (req, res) => {
        res.json({
            status: 'healthy',
            service: 'semem-answer-http',
            version: '1.0.0',
            timestamp: new Date().toISOString()
        });
    });
    
    // Direct answer endpoint (non-MCP)
    app.post('/answer', async (req, res) => {
        try {
            const { question, mode = 'standard', streaming = false } = req.body;
            
            if (!question || typeof question !== 'string' || !question.trim()) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid question parameter. It must be a non-empty string.'
                });
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
            
            if (streaming) {
                // Set up SSE for streaming
                res.writeHead(200, {
                    'Content-Type': 'text/event-stream',
                    'Cache-Control': 'no-cache',
                    'Connection': 'keep-alive',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Headers': 'Cache-Control'
                });
                
                const streamCallback = (update) => {
                    res.write(`data: ${JSON.stringify({
                        timestamp: new Date().toISOString(),
                        ...update
                    })}\\n\\n`);
                };
                
                // Process question with streaming
                const result = await processQuestionWithFeedback(
                    question, 
                    llmHandler, 
                    sparqlHelper, 
                    workflowConfig, 
                    mode,
                    streamCallback
                );
                
                // Send final result
                res.write(`data: ${JSON.stringify({
                    type: 'final',
                    timestamp: new Date().toISOString(),
                    result: result
                })}\\n\\n`);
                
                res.end();
            } else {
                // Regular JSON response
                const result = await processQuestionWithFeedback(
                    question, 
                    llmHandler, 
                    sparqlHelper, 
                    workflowConfig, 
                    mode
                );
                
                res.json(result);
            }
            
        } catch (error) {
            mcpDebugger.error('Error in direct answer endpoint:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    });
    
    return app;
}

/**
 * Main entry point
 */
async function main() {
    try {
        mcpDebugger.info('🚀 Starting Semem Answer HTTP MCP Server...');

        // Create Express app with MCP integration
        const app = await createApp();
        
        const port = process.env.ANSWER_HTTP_PORT || 3002;
        
        app.listen(port, () => {
            mcpDebugger.info(`✅ Semem Answer HTTP MCP server running on port ${port}`);
            mcpDebugger.info(`   MCP endpoint: http://localhost:${port}/mcp`);
            mcpDebugger.info(`   Direct answer endpoint: http://localhost:${port}/answer`);
            mcpDebugger.info(`   Health check: http://localhost:${port}/health`);
        });

    } catch (error) {
        mcpDebugger.error('❌ Failed to start Answer HTTP server', {
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

export { createServer, createApp };