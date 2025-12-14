/**
 * Refactored MCP HTTP Server
 * Uses the new refactored structure with proper MCP protocol support
 * Maintains full compatibility with original functionality while using clean architecture
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';
import session from 'express-session';
import { randomUUID } from 'crypto';
import { createHttpTerminator } from 'http-terminator';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createMCPServer } from './server/server-factory.js';
import { mcpDebugger } from './lib/debug-utils.js';
import Config from '../../src/Config.js';
import DogalogResponseParser from '../utils/DogalogResponseParser.js';
import { PrologContextBuilder } from './lib/PrologContextBuilder.js';

// Load environment variables first
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');
dotenv.config({ path: path.join(projectRoot, '.env') });

mcpDebugger.info('🚀 REFACTORED HTTP SERVER: Starting script execution...');

// Initialize config to get port from config.json
let port = process.env.PORT || process.env.MCP_PORT || 4101;
try {
  const configPath = process.env.SEMEM_CONFIG_PATH || path.join(projectRoot, 'config/config.json');
  const config = new Config(configPath);
  await config.init();
  port = process.env.PORT || process.env.MCP_PORT || config.get('servers.mcp') || config.get('port') || 4101;
  mcpDebugger.info(`🔧 REFACTORED HTTP SERVER: Using port ${port} from config`);
} catch (error) {
  mcpDebugger.warn('⚠️ REFACTORED HTTP SERVER: Could not load config, using default port:', error.message);
}

const app = express();
let httpTerminator = null;

mcpDebugger.info(`🚀 REFACTORED HTTP SERVER: Variables initialized, port: ${port}`);

/**
 * Request handler that creates a new transport for each request
 * Following the exact pattern from the original working server
 */
async function handleMCPRequest(req, res, body, sessionTransports, sessionServers) {
  try {
    // Check for existing session ID (following reference pattern)
    const sessionId = req.headers['mcp-session-id'];
    let transport = sessionTransports.get(sessionId);

    if (sessionId && transport) {
      // Reuse existing transport for this session
      mcpDebugger.info(`🔄 [REFACTORED-SESSION-${sessionId}] Reusing existing transport`);
    } else if (!sessionId) {
      // New initialization request (no session ID header)
      mcpDebugger.info('🔧 [REFACTORED-INIT] New initialization request - creating server and transport...');

      // Create a new server instance for this session using refactored server factory
      const server = await createMCPServer();
      mcpDebugger.info('✅ [REFACTORED-INIT] Server created using refactored factory');

      // Create a new transport for this session
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (sid) => {
          mcpDebugger.info(`🔗 [REFACTORED-INIT] Session initialized with ID: ${sid}`);
          sessionTransports.set(sid, transport);
          sessionServers.set(sid, server);
        }
      });

      // CRITICAL: Connect server to transport BEFORE handling request
      mcpDebugger.info('🔗 [REFACTORED-INIT] Connecting server to transport...');
      await server.connect(transport);
      mcpDebugger.info('✅ [REFACTORED-INIT] Server connected to transport');

      await transport.handleRequest(req, res, body);
      return; // Already handled
    } else {
      // Invalid request - session ID provided but no transport found
      res.status(400).json({
        jsonrpc: '2.0',
        error: {
          code: -32000,
          message: 'Bad Request: Invalid session ID provided',
        },
        id: req?.body?.id,
      });
      return;
    }

    // Handle the request with the session-specific transport
    await transport.handleRequest(req, res, body);
  } catch (error) {
    mcpDebugger.error('[REFACTORED-MCP] Request handling failed:', error);
    res.status(500).json({
      jsonrpc: '2.0',
      error: {
        code: -32603,
        message: 'Internal Error',
        data: error.message
      },
      id: req?.body?.id
    });
  }
}

/**
 * Handle slash commands in chat - refactored version
 */
async function handleSlashCommand(command, simpleVerbsService) {
  const commandParts = command.split(' ');
  const cmd = commandParts[0].toLowerCase();
  const args = commandParts.slice(1).join(' ').trim();

  switch (cmd) {
    case '/help':
      return {
        success: true,
        messageType: 'help',
        content: `Available Commands:
/help          - Show this help message
/ask [query]   - Search your semantic memory for information
/tell [info]   - Store new information in your semantic memory

Examples:
/ask What did I learn about machine learning?
/tell The meeting is scheduled for tomorrow at 2pm

You can also chat naturally - I'll understand your intentions and route appropriately.`,
        timestamp: new Date().toISOString()
      };

    case '/ask':
      if (!args) {
        return {
          success: false,
          messageType: 'error',
          content: 'Please provide a question after /ask. Example: /ask What is machine learning?',
          timestamp: new Date().toISOString()
        };
      }

      try {
        const result = await simpleVerbsService.ask({
          question: args,
          mode: 'standard',
          useContext: true
        });

        return {
          success: true,
          messageType: 'ask_result',
          content: result.content || result.answer || 'No answer found for your question.',
          originalMessage: command,
          routing: 'ask_command',
          timestamp: new Date().toISOString()
        };
      } catch (error) {
        return {
          success: false,
          messageType: 'error',
          content: `Error processing ask command: ${error.message}`,
          timestamp: new Date().toISOString()
        };
      }

    case '/tell':
      if (!args) {
        return {
          success: false,
          messageType: 'error',
          content: 'Please provide information after /tell. Example: /tell The project deadline is next Friday.',
          timestamp: new Date().toISOString()
        };
      }

      try {
        const result = await simpleVerbsService.tell({
          content: args,
          type: 'interaction',
          metadata: { source: 'chat_command', command: '/tell' }
        });

        return {
          success: true,
          messageType: 'tell_result',
          content: `✅ Information stored successfully: "${args.substring(0, 100)}${args.length > 100 ? '...' : ''}"`,
          originalMessage: command,
          routing: 'tell_command',
          stored: result.stored || result.success,
          timestamp: new Date().toISOString()
        };
      } catch (error) {
        return {
          success: false,
          messageType: 'error',
          content: `Error processing tell command: ${error.message}`,
          timestamp: new Date().toISOString()
        };
      }

    default:
      return {
        success: false,
        messageType: 'error',
        content: `Unknown command: ${cmd}. Type /help for available commands.`,
        timestamp: new Date().toISOString()
      };
  }
}

async function startRefactoredServer() {
  try {
    mcpDebugger.info('🚀 [REFACTORED-START] Starting Refactored MCP HTTP Server...');

    // Session management - we'll create transport instances per request
    mcpDebugger.info('🔧 [REFACTORED-START] Setting up session management...');
    const sessionTransports = new Map();
    const sessionServers = new Map();

    mcpDebugger.info('✅ [REFACTORED-START] Session management configured');

    // Server instances will be created per session automatically using refactored factory
    mcpDebugger.info('🔧 [REFACTORED-START] Server instances will be created per session using refactored architecture...');

    // Configure Express middleware
    mcpDebugger.info('🔧 [REFACTORED-START] Configuring Express middleware...');
    app.use(cors());

    // Session middleware for tracking conversation context
    app.use(session({
      secret: process.env.SESSION_SECRET || 'semem-refactored-session-' + randomUUID(),
      resave: false,
      saveUninitialized: false,
      cookie: { secure: false, maxAge: 1000 * 60 * 60 } // 1 hour
    }));

    app.use(express.json({ limit: '50mb' }));
    app.use(express.text({ type: 'text/plain', limit: '50mb' }));

    mcpDebugger.info('✅ [REFACTORED-START] Express middleware configured');

    // MCP endpoint - following exact original pattern
    mcpDebugger.info('🔧 [REFACTORED-START] Setting up MCP endpoint...');
    app.post('/mcp', async (req, res) => {
      await handleMCPRequest(req, res, req.body, sessionTransports, sessionServers);
    });
    mcpDebugger.info('✅ [REFACTORED-START] MCP endpoint configured');

    // Health check endpoint
    mcpDebugger.info('🔧 [REFACTORED-START] Setting up health endpoint...');
    app.get('/health', (req, res) => {
      res.json({
        status: 'ok',
        server_state: {
          active_sessions: sessionTransports.size,
          session_based: true,
          architecture: 'refactored-per-request-isolation'
        },
        timestamp: new Date().toISOString()
      });
    });
    mcpDebugger.info('✅ [REFACTORED-START] Health endpoint configured');

    // Simple Verbs REST endpoints - using refactored SimpleVerbsService
    mcpDebugger.info('🔧 [REFACTORED-START] Setting up Simple Verbs REST endpoints...');

    // Import Refactored Simple Verbs Service
    let SimpleVerbsService;
    try {
      const simpleVerbsModule = await import('./tools/SimpleVerbsService.js');
      SimpleVerbsService = simpleVerbsModule.SimpleVerbsService;
      mcpDebugger.info('✅ [REFACTORED-REST] Loaded refactored SimpleVerbsService');
    } catch (error) {
      mcpDebugger.error('❌ [REFACTORED-REST] Failed to load refactored SimpleVerbsService:', error.message);
      throw error;
    }

    // Create a single instance of the service for REST endpoints
    const simpleVerbsService = new SimpleVerbsService();
    await simpleVerbsService.initialize();
    mcpDebugger.info('✅ [REFACTORED-REST] SimpleVerbsService initialized');

    // Tell endpoint
    app.post('/tell', async (req, res) => {
      try {
        const { content, type = 'interaction', metadata = {} } = req.body;
        if (!content) {
          return res.status(400).json({ error: 'Content is required' });
        }

        mcpDebugger.info(`📤 Refactored Tell request: ${content.substring(0, 50)}...`);

        const result = await simpleVerbsService.tell({ content, type, metadata });
        mcpDebugger.info(`📤 Refactored Tell result: ${result.success ? 'SUCCESS' : 'FAILED'}`);

        res.json(result);
      } catch (error) {
        mcpDebugger.error('❌ Refactored Tell error:', error.message);
        res.status(500).json({
          success: false,
          verb: 'tell',
          error: error.message
        });
      }
    });

    // Ask endpoint
    app.post('/ask', async (req, res) => {
      try {
        const { question, mode = 'standard', useContext = true, useHyDE = false, useWikipedia = false, useWikidata = false, useWebSearch = false, threshold } = req.body;
        if (!question) {
          return res.status(400).json({ error: 'Question is required' });
        }

        mcpDebugger.info(`📥 Refactored Ask request: ${question.substring(0, 50)}...`);
        mcpDebugger.info(`📥 Enhancement flags: HyDE=${useHyDE}, Wikipedia=${useWikipedia}, Wikidata=${useWikidata}, WebSearch=${useWebSearch}`);

        const result = await simpleVerbsService.ask({ question, mode, useContext, useHyDE, useWikipedia, useWikidata, useWebSearch, threshold });
        mcpDebugger.info(`📥 Refactored Ask result: ${result.success ? 'SUCCESS' : 'FAILED'}`);

        // Map the refactored response to the expected HTTP API format
        const httpResponse = {
          success: result.success || true,
          answer: result.content || result.answer,
          question: result.question,
          mode: result.mode,
          contextUsed: result.contextUsed,
          contextCount: result.contextCount || 0,
          timestamp: result.timestamp
        };

        res.json(httpResponse);
      } catch (error) {
        mcpDebugger.error('❌ Refactored Ask error:', error.message);
        res.status(500).json({
          success: false,
          verb: 'ask',
          question: req.body.question,
          error: error.message
        });
      }
    });

    // Chat endpoint - for workbench chat interface compatibility
    app.post('/chat', async (req, res) => {
      try {
        const { message, context = {} } = req.body;
        if (!message) {
          return res.status(400).json({ error: 'Message is required' });
        }

        mcpDebugger.info(`💬 Refactored Chat request: ${message.substring(0, 50)}...`);

        // Check for slash commands
        const trimmedMessage = message.trim();
        if (trimmedMessage.startsWith('/')) {
          const commandResult = await handleSlashCommand(trimmedMessage, simpleVerbsService);
          return res.json(commandResult);
        }

        // Use the ask functionality for basic chat
        const result = await simpleVerbsService.ask({
          question: message,
          mode: 'standard',
          useContext: true
        });

        // Format response for chat interface compatibility
        const chatResponse = {
          success: result.success || true,
          content: result.content || result.answer,
          messageType: 'chat',
          routing: 'semantic_memory',
          timestamp: result.timestamp || new Date().toISOString()
        };

        mcpDebugger.info(`💬 Refactored Chat result: ${chatResponse.success ? 'SUCCESS' : 'FAILED'}`);
        res.json(chatResponse);
      } catch (error) {
        mcpDebugger.error('❌ Refactored Chat error:', error.message);
        res.status(500).json({
          success: false,
          content: 'I encountered an error processing your message. Please try again.',
          messageType: 'error',
          error: error.message
        });
      }
    });

    // Enhanced chat endpoint - for advanced queries
    app.post('/chat/enhanced', async (req, res) => {
      try {
        const { query, useHyDE = false, useWikipedia = false, useWikidata = false } = req.body;
        if (!query) {
          return res.status(400).json({ error: 'Query is required' });
        }

        mcpDebugger.info(`🚀 Refactored Enhanced Chat: ${query.substring(0, 50)}...`);

        // Use the ask functionality with enhancements
        const result = await simpleVerbsService.ask({
          question: query,
          mode: 'comprehensive',
          useContext: true,
          useHyDE,
          useWikipedia,
          useWikidata
        });

        // Format response for enhanced chat interface
        const enhancedResponse = {
          success: result.success || true,
          content: result.content || result.answer,
          messageType: 'enhanced_chat',
          routing: 'enhanced_semantic_memory',
          enhancements: { useHyDE, useWikipedia, useWikidata },
          timestamp: result.timestamp || new Date().toISOString()
        };

        mcpDebugger.info(`🚀 Refactored Enhanced Chat result: ${enhancedResponse.success ? 'SUCCESS' : 'FAILED'}`);
        res.json(enhancedResponse);
      } catch (error) {
        mcpDebugger.error('❌ Refactored Enhanced Chat error:', error.message);
        res.status(500).json({
          success: false,
          content: 'I encountered an error processing your enhanced query. Please try again.',
          messageType: 'error',
          error: error.message
        });
      }
    });

    // Dogalog chat endpoint - for Dogalog Prolog IDE integration
    app.post('/dogalog/chat', async (req, res) => {
      try {
        const { prompt, code } = req.body;

        // Validate required prompt
        if (!prompt || typeof prompt !== 'string' || prompt.trim() === '') {
          return res.status(200).json({
            message: 'Please provide a prompt.'
          });
        }

        mcpDebugger.info(`🎵 Dogalog chat request: ${prompt.substring(0, 50)}...`);

        // Build Prolog-aware question using templates
        const contextBuilder = new PrologContextBuilder();
        const enhancedQuestion = await contextBuilder.buildPrologQuestion(
          prompt.trim(),
          code
        );

        // Route to existing ask verb (stateless, no memory storage)
        const result = await simpleVerbsService.ask({
          question: enhancedQuestion,
          mode: 'standard',
          useContext: false  // Stateless per user preference
        });

        // Extract code and query suggestions
        const suggestions = DogalogResponseParser.extractPrologSuggestions(
          result.content || result.answer || ''
        );

        // Transform to Dogalog format
        const dogalogResponse = {
          message: result.content || result.answer || 'Sorry, I could not generate a response.'
        };

        // Add suggestions if extracted
        if (suggestions.codeSuggestion) {
          dogalogResponse.codeSuggestion = suggestions.codeSuggestion;
        }
        if (suggestions.querySuggestion) {
          dogalogResponse.querySuggestion = suggestions.querySuggestion;
        }

        mcpDebugger.info(`🎵 Dogalog chat response generated (code: ${!!suggestions.codeSuggestion}, query: ${!!suggestions.querySuggestion})`);

        // Always return 200 per Dogalog contract
        res.status(200).json(dogalogResponse);

      } catch (error) {
        mcpDebugger.error('❌ Dogalog chat error:', error.message);
        // Return 200 with error message per Dogalog contract
        res.status(200).json({
          message: `I encountered an error: ${error.message}. Please try again.`
        });
      }
    });

    // Augment endpoint - for document processing and content analysis
    app.post('/augment', async (req, res) => {
      try {
        const { target, operation = 'auto', options = {} } = req.body;

        mcpDebugger.info(`🔬 Refactored Augment: ${operation} operation on target (${target?.length || 'no'} chars)`);

        // Call the augment functionality
        const result = await simpleVerbsService.augment({
          target,
          operation,
          options
        });

        // Format response for augment interface
        const augmentResponse = {
          success: result.success || true,
          operation,
          result: result.result || result,
          metadata: result.metadata || {},
          timestamp: result.timestamp || new Date().toISOString()
        };

        mcpDebugger.info(`🔬 Refactored Augment result: ${augmentResponse.success ? 'SUCCESS' : 'FAILED'} - ${operation}`);
        res.json(augmentResponse);
      } catch (error) {
        mcpDebugger.error('❌ Refactored Augment error:', error.message);
        res.status(500).json({
          success: false,
          error: error.message,
          operation: req.body.operation || 'unknown',
          timestamp: new Date().toISOString()
        });
      }
    });

    // State endpoint - for ZPT navigation state and session info
    app.get('/state', async (req, res) => {
      try {
        mcpDebugger.info('🔍 Refactored State: Getting current ZPT navigation state');

        // Get ZPT state from the state manager
        const zptState = simpleVerbsService.stateManager.getState();

        // Format response for workbench
        const stateResponse = {
          success: true,
          state: {
            zoom: zptState.zoom || 'entity',
            pan: zptState.pan || {},
            tilt: zptState.tilt || 'keywords',
            threshold: 0.3, // Default threshold
            sessionId: zptState.sessionId,
            timestamp: zptState.timestamp || new Date().toISOString()
          },
          session: {
            interactions: simpleVerbsService.stateManager.sessionCache?.interactions?.size || 0,
            concepts: simpleVerbsService.stateManager.sessionCache?.concepts?.size || 0,
            duration: Date.now() - (new Date(zptState.timestamp || Date.now()).getTime())
          },
          timestamp: new Date().toISOString()
        };

        mcpDebugger.info(`🔍 Refactored State result: zoom=${stateResponse.state.zoom}, tilt=${stateResponse.state.tilt}`);
        res.json(stateResponse);
      } catch (error) {
        mcpDebugger.error('❌ Refactored State error:', error.message);
        res.status(500).json({
          success: false,
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }
    });

    // Inspect endpoint - uses InspectCommand for comprehensive analytics
    app.post('/inspect', async (req, res) => {
      try {
        const { what = 'session', details = false } = req.body;

        mcpDebugger.info(`🔍 Refactored Inspect: Inspecting ${what} with details=${details}`);

        // Use the InspectCommand from the verb registry
        const inspectResult = await simpleVerbsService.execute('inspect', {
          what,
          details
        });

        mcpDebugger.info(`🔍 Refactored Inspect result: ${what} inspection completed`);
        res.json(inspectResult);
      } catch (error) {
        mcpDebugger.error('❌ Refactored Inspect error:', error.message);
        res.status(500).json({
          success: false,
          error: error.message,
          what: req.body.what || 'unknown',
          timestamp: new Date().toISOString()
        });
      }
    });

    // Train VSOM endpoint - for training Visual Self-Organizing Map
    app.post('/train-vsom', async (req, res) => {
      try {
        const { epochs = 100, learningRate = 0.1, gridSize = 20 } = req.body;

        mcpDebugger.info(`🧠 Refactored Train VSOM: epochs=${epochs}, learningRate=${learningRate}, gridSize=${gridSize}`);

        // Use the TrainVSOMCommand from the verb registry
        const trainingResult = await simpleVerbsService.execute('train-vsom', {
          epochs,
          learningRate,
          gridSize
        });

        mcpDebugger.info(`🧠 Refactored Train VSOM result: ${trainingResult.success ? 'SUCCESS' : 'FAILED'}`);
        res.json(trainingResult);
      } catch (error) {
        mcpDebugger.error('❌ Refactored Train VSOM error:', error.message);
        res.status(500).json({
          success: false,
          error: error.message,
          trained: false,
          timestamp: new Date().toISOString()
        });
      }
    });

    // ZPT Navigate endpoint - for Zoom-Pan-Tilt knowledge navigation
    app.post('/zpt/navigate', async (req, res) => {
      try {
        const { query, zoom, pan, tilt } = req.body;

        mcpDebugger.info(`🗺️ Refactored ZPT Navigate: zoom=${zoom}, tilt=${tilt}, pan domains=${pan?.domains?.length || 0}`);

        // Get navigation result from the ZPT navigation service
        const navigationResult = await simpleVerbsService.zptService.navigate({
          query: query || 'Navigate knowledge space',
          zoom,
          pan,
          tilt
        });

        // Format response for workbench navigation
        const navigateResponse = {
          success: true,
          navigation: {
            zoom,
            pan,
            tilt,
            query
          },
          result: navigationResult || {
            entities: [],
            relationships: [],
            concepts: [],
            message: 'Navigation executed successfully'
          },
          timestamp: new Date().toISOString()
        };

        mcpDebugger.info(`🗺️ Refactored ZPT Navigate result: ${navigateResponse.success ? 'SUCCESS' : 'FAILED'} - ${zoom}/${tilt}`);
        res.json(navigateResponse);
      } catch (error) {
        mcpDebugger.error('❌ Refactored ZPT Navigate error:', error.message);
        res.status(500).json({
          success: false,
          error: error.message,
          navigation: req.body || {},
          timestamp: new Date().toISOString()
        });
      }
    });

    mcpDebugger.info('✅ [REFACTORED-REST] Simple Verbs REST endpoints configured');

    // Start the server
    const server = app.listen(port, () => {
      mcpDebugger.info(`✅ REFACTORED HTTP server listening on port ${port}`);
      mcpDebugger.info(`Health check: http://localhost:${port}/health`);
      mcpDebugger.info(`MCP endpoint: POST http://localhost:${port}/mcp`);
      mcpDebugger.info(`Tell endpoint: POST http://localhost:${port}/tell`);
      mcpDebugger.info(`Ask endpoint: POST http://localhost:${port}/ask`);
      mcpDebugger.info(`Chat endpoint: POST http://localhost:${port}/chat`);
      mcpDebugger.info(`Enhanced Chat endpoint: POST http://localhost:${port}/chat/enhanced`);
      mcpDebugger.info(`Augment endpoint: POST http://localhost:${port}/augment`);
      mcpDebugger.info(`State endpoint: GET http://localhost:${port}/state`);
      mcpDebugger.info(`Inspect endpoint: POST http://localhost:${port}/inspect`);
      mcpDebugger.info(`ZPT Navigate endpoint: POST http://localhost:${port}/zpt/navigate`);
      mcpDebugger.info('🎯 REFACTORED HTTP SERVER: Setup complete with full architecture');
    });

    // Create HTTP terminator for graceful shutdown
    httpTerminator = createHttpTerminator({ server });

    // Graceful shutdown handlers
    process.on('SIGTERM', async () => {
      mcpDebugger.info('SIGTERM received, shutting down refactored server...');
      try {
        await httpTerminator.terminate();
        mcpDebugger.info('Refactored server closed');
        process.exit(0);
      } catch (error) {
        mcpDebugger.error('Error during shutdown:', error);
        process.exit(1);
      }
    });

    process.on('SIGINT', async () => {
      mcpDebugger.info('SIGINT received, shutting down refactored server...');
      try {
        await httpTerminator.terminate();
        mcpDebugger.info('Refactored server closed');
        process.exit(0);
      } catch (error) {
        mcpDebugger.error('Error during shutdown:', error);
        process.exit(1);
      }
    });

  } catch (error) {
    mcpDebugger.error('❌ [REFACTORED-START] Failed to start refactored server:', error);
    process.exit(1);
  }
}

// Start the refactored server
await startRefactoredServer();