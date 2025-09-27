/**
 * MCP Resource Handlers
 * Extracted from index.js for better organization
 */

import {
  ListResourcesRequestSchema,
  ReadResourceRequestSchema
} from '@modelcontextprotocol/sdk/types.js';
import { mcpDebugger } from '../../lib/debug-utils.js';

export function registerResourceHandlers(server) {
  // List resources handler
  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    try {
      mcpDebugger.info('Listing available resources');

      const resources = [
        {
          uri: 'semem://status',
          mimeType: 'application/json',
          name: 'System Status',
          description: 'Current system status and health metrics'
        },
        {
          uri: 'semem://zpt/navigation',
          mimeType: 'application/json',
          name: 'ZPT Navigation State',
          description: 'Current ZPT navigation context and state'
        },
        {
          uri: 'semem://memory/stats',
          mimeType: 'application/json',
          name: 'Memory Statistics',
          description: 'Memory usage and performance statistics'
        }
      ];

      return { resources };
    } catch (error) {
      mcpDebugger.error('Error listing resources:', error);
      throw error;
    }
  });

  // Read resource handler
  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    try {
      const { uri } = request.params;
      mcpDebugger.info(`Reading resource: ${uri}`);

      let content;
      let mimeType = 'application/json';

      switch (uri) {
        case 'semem://status':
          content = await getSystemStatus();
          break;

        case 'semem://zpt/navigation':
          content = await getZPTNavigationState();
          break;

        case 'semem://memory/stats':
          content = await getMemoryStats();
          break;

        default:
          throw new Error(`Resource not found: ${uri}`);
      }

      return {
        contents: [
          {
            uri,
            mimeType,
            text: JSON.stringify(content, null, 2)
          }
        ]
      };
    } catch (error) {
      mcpDebugger.error('Error reading resource:', error);
      throw error;
    }
  });

  mcpDebugger.info('Resource handlers registered successfully');
}

async function getSystemStatus() {
  try {
    const { initializeServices, getMemoryManager } = await import('../../lib/initialization.js');
    await initializeServices();
    const memoryManager = getMemoryManager();

    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        memoryManager: !!memoryManager,
        store: !!memoryManager?.store,
        embedding: true,
        llm: true
      },
      version: '1.0.0'
    };
  } catch (error) {
    return {
      status: 'error',
      timestamp: new Date().toISOString(),
      error: error.message
    };
  }
}

async function getZPTNavigationState() {
  try {
    // Get current ZPT state if available
    return {
      currentZoom: 'entity',
      currentPan: {},
      currentTilt: 'keywords',
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    return {
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

async function getMemoryStats() {
  try {
    const { initializeServices, getMemoryManager } = await import('../../lib/initialization.js');
    await initializeServices();
    const memoryManager = getMemoryManager();

    // Get basic memory statistics
    const stats = {
      timestamp: new Date().toISOString(),
      storeType: memoryManager?.store?.constructor?.name || 'unknown',
      memoryUsage: process.memoryUsage(),
      uptime: process.uptime()
    };

    return stats;
  } catch (error) {
    return {
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}