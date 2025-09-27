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
        const { question, mode = 'standard', useContext = true, threshold } = req.body;
        if (!question) {
          return res.status(400).json({ error: 'Question is required' });
        }

        mcpDebugger.info(`📥 Refactored Ask request: ${question.substring(0, 50)}...`);

        const result = await simpleVerbsService.ask({ question, mode, useContext, threshold });
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

    mcpDebugger.info('✅ [REFACTORED-REST] Simple Verbs REST endpoints configured');

    // Start the server
    const server = app.listen(port, () => {
      mcpDebugger.info(`✅ REFACTORED HTTP server listening on port ${port}`);
      mcpDebugger.info(`Health check: http://localhost:${port}/health`);
      mcpDebugger.info(`MCP endpoint: POST http://localhost:${port}/mcp`);
      mcpDebugger.info(`Tell endpoint: POST http://localhost:${port}/tell`);
      mcpDebugger.info(`Ask endpoint: POST http://localhost:${port}/ask`);
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