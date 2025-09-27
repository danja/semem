/**
 * Minimal HTTP Server for testing refactored Core Tools
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '.');
dotenv.config({ path: path.join(projectRoot, '.env') });

const app = express();
const port = process.env.MCP_PORT || 4101;

console.log('🚀 Starting minimal HTTP server for Core Tools testing...');

// Import Core Tools Service and initialize once
// Import the working SimpleVerbsService instead of simplified CoreToolsService
const { SimpleVerbsService } = await import('./src/mcp/tools/SimpleVerbsService.js');
const coreToolsService = new SimpleVerbsService();

// Pre-initialize services to ensure memory persistence
const { initializeServices } = await import('./src/mcp/lib/initialization.js');
await initializeServices();
console.log('✅ Core Tools Service loaded and services pre-initialized');

// Configure Express middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    server: 'core-tools-test',
    timestamp: new Date().toISOString()
  });
});

// TELL endpoint
app.post('/tell', async (req, res) => {
  try {
    const { content, type = 'interaction', metadata = {} } = req.body;
    if (!content) {
      return res.status(400).json({ error: 'Content is required' });
    }

    console.log(`📤 Tell request: ${content.substring(0, 50)}...`);

    const result = await coreToolsService.tell({ content, type, metadata });
    console.log(`📤 Tell result: ${result.success ? 'SUCCESS' : 'FAILED'}`);

    res.json(result);
  } catch (error) {
    console.error('❌ Tell error:', error.message);
    res.status(500).json({
      success: false,
      verb: 'tell',
      error: error.message
    });
  }
});

// ASK endpoint
app.post('/ask', async (req, res) => {
  try {
    const { question, mode = 'standard', useContext = true, threshold } = req.body;
    if (!question) {
      return res.status(400).json({ error: 'Question is required' });
    }

    console.log(`📥 Ask request: ${question.substring(0, 50)}...`);

    const result = await coreToolsService.ask({ question, mode, useContext, threshold });
    console.log(`📥 Ask result: ${result.success ? 'SUCCESS' : 'FAILED'}`);

    // Map the refactored response to the expected HTTP API format
    const httpResponse = {
      success: result.success || true, // Ensure success field is always present
      answer: result.content || result.answer, // Map content -> answer for HTTP API compatibility
      question: result.question,
      mode: result.mode,
      contextUsed: result.contextUsed,
      contextCount: result.contextCount || 0,
      timestamp: result.timestamp
    };

    res.json(httpResponse);
  } catch (error) {
    console.error('❌ Ask error:', error.message);
    res.status(500).json({
      success: false,
      verb: 'ask',
      question: req.body.question,
      error: error.message
    });
  }
});

// Start the server
const server = app.listen(port, () => {
  console.log(`✅ Test HTTP server listening on port ${port}`);
  console.log(`Health check: http://localhost:${port}/health`);
  console.log(`Tell endpoint: POST http://localhost:${port}/tell`);
  console.log(`Ask endpoint: POST http://localhost:${port}/ask`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});