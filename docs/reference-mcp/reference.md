# Building and Testing an MCP Server in JavaScript for Graph Knowledge Base Integration

## Introduction

The Model Context Protocol (MCP) allows applications to provide context for Large Language Models (LLMs) in a standardized way, separating the concerns of providing context from the actual LLM interaction[4]. This guide will walk you through building and testing an MCP server in JavaScript that connects to a graph knowledge base via HTTP APIs.

## Prerequisites

Before starting, ensure you have the following installed:

- Node.js (version 22.7.5 or later recommended)[17]
- npm or yarn package manager
- Access to a graph database with HTTP API endpoints

## Step 1: Project Setup and Installation

### Initialize Your Project

First, create a new Node.js project and install the required dependencies:

```bash
mkdir mcp-graph-server
cd mcp-graph-server
npm init -y
```

### Install Dependencies

Install the core MCP SDK and additional packages needed for HTTP requests and schema validation[1][4]:

```bash
npm install @modelcontextprotocol/sdk zod
npm install --save-dev typescript @types/node
```

Create a `package.json` with the following configuration[1]:

```json
{
  "name": "mcp-graph-server",
  "version": "1.0.0",
  "type": "module",
  "main": "index.js",
  "scripts": {
    "start": "node index.js",
    "build": "tsc",
    "dev": "node --watch index.js"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.11.0",
    "zod": "^3.24.4"
  }
}
```

## Step 2: Core Server Implementation

### Create the Main Server File

Create an `index.js` file with the basic MCP server structure[1][4]:

```javascript
#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

// Create MCP server instance
const server = new McpServer({
  name: "Graph Knowledge Base Server",
  version: "1.0.0",
  instructions: "A server that provides access to graph knowledge base via HTTP APIs"
});

// Graph API configuration
const GRAPH_API_BASE_URL = process.env.GRAPH_API_URL || 'http://localhost:7474';
const GRAPH_API_AUTH = process.env.GRAPH_API_AUTH || '';

// HTTP client helper function
async function makeGraphRequest(endpoint, method = 'GET', data = null) {
  const url = `${GRAPH_API_BASE_URL}${endpoint}`;
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(GRAPH_API_AUTH && { 'Authorization': GRAPH_API_AUTH })
    }
  };
  
  if (data && (method === 'POST' || method === 'PUT')) {
    options.body = JSON.stringify(data);
  }
  
  try {
    const response = await fetch(url, options);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    throw new Error(`Graph API request failed: ${error.message}`);
  }
}
```

## Step 3: Implement Graph Database Tools

### Query Tool Implementation

Add tools that interact with your graph knowledge base[4][9]:

```javascript
// Tool for querying nodes
server.tool(
  "query_nodes",
  {
    query: z.string().describe("Search query for nodes"),
    nodeType: z.string().optional().describe("Type of nodes to search"),
    limit: z.number().optional().default(10).describe("Maximum number of results")
  },
  async ({ query, nodeType, limit }) => {
    try {
      const endpoint = `/api/v1/nodes/search`;
      const requestData = {
        query,
        type: nodeType,
        limit
      };
      
      const result = await makeGraphRequest(endpoint, 'POST', requestData);
      
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2)
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error querying nodes: ${error.message}`
          }
        ],
        isError: true
      };
    }
  }
);

// Tool for querying relationships
server.tool(
  "query_relationships",
  {
    sourceNode: z.string().describe("Source node identifier"),
    relationshipType: z.string().optional().describe("Type of relationship"),
    direction: z.enum(['incoming', 'outgoing', 'both']).default('both')
  },
  async ({ sourceNode, relationshipType, direction }) => {
    try {
      const endpoint = `/api/v1/relationships`;
      const params = new URLSearchParams({
        source: sourceNode,
        direction,
        ...(relationshipType && { type: relationshipType })
      });
      
      const result = await makeGraphRequest(`${endpoint}?${params}`);
      
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2)
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error querying relationships: ${error.message}`
          }
        ],
        isError: true
      };
    }
  }
);
```

### Graph Analysis Tools

Implement more advanced graph analysis capabilities[11][24]:

```javascript
// Tool for path finding between nodes
server.tool(
  "find_path",
  {
    startNode: z.string().describe("Starting node identifier"),
    endNode: z.string().describe("Target node identifier"),
    maxDepth: z.number().optional().default(5).describe("Maximum path depth")
  },
  async ({ startNode, endNode, maxDepth }) => {
    try {
      const endpoint = `/api/v1/paths/shortest`;
      const requestData = {
        start: startNode,
        end: endNode,
        maxDepth
      };
      
      const result = await makeGraphRequest(endpoint, 'POST', requestData);
      
      return {
        content: [
          {
            type: "text",
            text: `Path from ${startNode} to ${endNode}:\n${JSON.stringify(result, null, 2)}`
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error finding path: ${error.message}`
          }
        ],
        isError: true
      };
    }
  }
);

// Tool for graph statistics
server.tool(
  "graph_stats",
  {},
  async () => {
    try {
      const endpoint = `/api/v1/stats`;
      const result = await makeGraphRequest(endpoint);
      
      return {
        content: [
          {
            type: "text",
            text: `Graph Statistics:\n${JSON.stringify(result, null, 2)}`
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error retrieving graph statistics: ${error.message}`
          }
        ],
        isError: true
      };
    }
  }
);
```

## Step 4: Add Resource Support

Implement resources for accessing graph data[4]:

```javascript
// Static resource for graph schema
server.resource(
  "graph-schema",
  "schema://graph/model",
  async (uri) => {
    try {
      const result = await makeGraphRequest('/api/v1/schema');
      return {
        contents: [
          {
            uri: uri.href,
            text: JSON.stringify(result, null, 2),
            mimeType: "application/json"
          }
        ]
      };
    } catch (error) {
      return {
        contents: [
          {
            uri: uri.href,
            text: `Error retrieving schema: ${error.message}`,
            mimeType: "text/plain"
          }
        ]
      };
    }
  }
);
```

## Step 5: Server Transport Setup

Complete the server setup with transport configuration[1][4]:

```javascript
// Start the server
async function main() {
  const transport = new StdioServerTransport();
  
  try {
    await server.connect(transport);
    console.error("Graph Knowledge Base MCP Server started successfully");
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.error("Shutting down server...");
  process.exit(0);
});

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
```

## Step 6: Testing Your MCP Server

### Using the MCP Inspector

The MCP Inspector is the primary tool for testing and debugging MCP servers[17][20]:

```bash
# Build your server first (if using TypeScript)
npm run build

# Run the inspector
npx @modelcontextprotocol/inspector node index.js
```

The inspector provides a web interface (default port 6274) where you can[17][20]:

- Test server connection and capabilities
- Execute tools with custom inputs
- View tool schemas and responses
- Test resources and prompts
- Monitor server logs and errors

### Custom Ports Configuration

If you need to customize the inspector ports[17]:

```bash
CLIENT_PORT=8080 SERVER_PORT=9000 npx @modelcontextprotocol/inspector node index.js
```

### Manual Testing with Node.js

Create a simple test script `test-server.js` for automated testing[15]:

```javascript
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

async function testServer() {
  const client = new Client({ name: "test-client", version: "1.0.0" }, {});
  const transport = new StdioClientTransport({
    command: 'node',
    args: ['index.js']
  });
  
  try {
    await client.connect(transport);
    
    // Test initialization
    const initResponse = await client.initialize({});
    console.log("Server capabilities:", initResponse.capabilities);
    
    // Test tools
    if (initResponse.capabilities.tools) {
      const tools = await client.listTools();
      console.log("Available tools:", tools.tools.map(t => t.name));
      
      // Test query_nodes tool
      const queryResult = await client.callTool({
        name: "query_nodes",
        arguments: {
          query: "test query",
          limit: 5
        }
      });
      console.log("Query result:", queryResult);
    }
    
    await client.close();
  } catch (error) {
    console.error("Test failed:", error);
  }
}

testServer();
```

### Unit Testing Framework

For comprehensive testing, use a testing framework like Jest or Mocha[15][18]:

```javascript
// test/server.test.js
import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';

describe('MCP Graph Server', () => {
  let client;
  let transport;
  
  beforeAll(async () => {
    // Setup test client
  });
  
  afterAll(async () => {
    // Cleanup
  });
  
  test('should initialize successfully', async () => {
    const response = await client.initialize({});
    expect(response.capabilities.tools).toBeDefined();
  });
  
  test('should query nodes correctly', async () => {
    const result = await client.callTool({
      name: "query_nodes",
      arguments: { query: "test", limit: 1 }
    });
    expect(result.content).toBeDefined();
  });
});
```

### Testing Graph API Integration

Test your HTTP API integration separately[15]:

```javascript
// test/graph-api.test.js
async function testGraphConnection() {
  try {
    const response = await fetch(`${GRAPH_API_BASE_URL}/api/v1/health`);
    console.log("Graph API status:", response.status);
    
    const data = await response.json();
    console.log("Graph API response:", data);
  } catch (error) {
    console.error("Graph API connection failed:", error);
  }
}
```

## Step 7: Configuration and Deployment

### Environment Configuration

Create a `.env` file for configuration[2]:

```env
GRAPH_API_URL=http://localhost:7474
GRAPH_API_AUTH=Bearer your-auth-token
MCP_SERVER_PORT=3000
DEBUG=true
```

### Claude Desktop Integration

To use your server with Claude Desktop, add it to the configuration[2]:

```json
{
  "mcpServers": {
    "graph-knowledge-server": {
      "command": "node",
      "args": ["path/to/your/index.js"],
      "env": {
        "GRAPH_API_URL": "http://localhost:7474"
      }
    }
  }
}
```

## Step 8: Advanced Features

### Error Handling and Logging

Implement comprehensive error handling[18]:

```javascript
function createErrorResponse(error, context = '') {
  const errorMessage = `${context}: ${error.message}`;
  console.error(errorMessage, error.stack);
  
  return {
    content: [
      {
        type: "text",
        text: errorMessage
      }
    ],
    isError: true
  };
}
```

### Caching and Rate Limiting

Add caching for frequently accessed data and implement rate limiting for API calls[15]:

```javascript
const cache = new Map();
const CACHE_TTL = 300000; // 5 minutes

async function cachedGraphRequest(endpoint, method = 'GET', data = null) {
  const cacheKey = `${method}:${endpoint}:${JSON.stringify(data)}`;
  
  if (cache.has(cacheKey)) {
    const cached = cache.get(cacheKey);
    if (Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.data;
    }
  }
  
  const result = await makeGraphRequest(endpoint, method, data);
  cache.set(cacheKey, { data: result, timestamp: Date.now() });
  
  return result;
}
```

## Best Practices and Security

### Security Considerations

- Always validate input parameters using Zod schemas[4]
- Implement proper authentication for graph API access[17]
- Use environment variables for sensitive configuration[2]
- Implement request timeouts and retry mechanisms[9]

### Performance Optimization

- Cache frequently accessed graph data[15]
- Implement pagination for large result sets[23]
- Use connection pooling for HTTP requests[9]
- Monitor server performance and resource usage[18]

## Troubleshooting Common Issues

### Connection Issues

- Verify graph database is accessible and running
- Check authentication credentials and permissions
- Validate network connectivity and firewall settings

### Tool Execution Failures

- Review tool parameter validation schemas
- Check HTTP API endpoint URLs and methods
- Examine server logs for detailed error messages

### Inspector Connection Problems

- Ensure correct Node.js version (^22.7.5)[17]
- Verify server builds successfully
- Check for port conflicts

This comprehensive guide provides you with everything needed to build and test a robust MCP server in JavaScript that integrates with graph knowledge bases via HTTP APIs. The server will be ready for integration with AI applications and can be extended with additional tools and features as needed.

[1] https://snyk.io/articles/how-to-build-an-mcp-server-in-node-js-to-provide-up-to-date-api/
[2] https://www.leanware.co/insights/how-to-build-mcp-server
[3] https://github-wiki-see.page/m/melvincarvalho/mcpjs/wiki/MCP
[4] https://www.npmjs.com/package/@modelcontextprotocol/sdk?activeTab=readme
[5] https://www.thewindowsclub.com/create-mcp-server-using-fastmcp
[6] https://simplescraper.io/blog/how-to-mcp
[7] https://www.youtube.com/watch?v=MC2BwMGFRx4
[8] https://www.arsturn.com/blog/creating-a-restful-api-for-your-mcp-server-a-comprehensive-guide
[9] https://www.npmjs.com/package/@mcp-devtools/http-client?activeTab=code
[10] https://www.npmjs.com/package/@mcp-devtools/http-client?activeTab=readme
[11] https://www.falkordb.com/blog/mcp-integration-falkordb-graphrag/
[12] https://ubos.tech/mcp/javascript-mcp-server-2/
[13] https://github.com/melvincarvalho/mcpjs
[14] https://www.youtube.com/watch?v=i029kVz6DqA
[15] https://milvus.io/ai-quick-reference/whats-the-best-way-to-test-an-model-context-protocol-mcp-server-locally
[16] https://github.com/nandkumar1000/MCP-Server-Tester
[17] https://github.com/williamnguyen68/inspectorMCP
[18] https://markaicode.com/model-context-protocol-testing-strategy-2025/
[19] https://playbooks.com/mcp/studentofjs-frontend-testing
[20] https://mcp-framework.com/docs/debugging/
[21] https://learn.microsoft.com/en-us/power-platform/test-engine/ai-mcp
[22] https://learn.microsoft.com/en-us/graph/api/application-post-applications?view=graph-rest-1.0&tabs=http
[23] https://neo4j.com/docs/getting-started/data-import/json-rest-api-import/
[24] https://blog.milvus.io/ai-quick-reference/what-is-a-knowledge-graph-api
[25] https://learn.microsoft.com/en-us/graph/use-the-api
[26] https://neo4j.com/docs/browser-manual/current/operations/rest-requests/
[27] https://developers.arcgis.com/rest/services-reference/enterprise/kgs-hosted-server-admin/
[28] https://composio.dev/blog/mcp-server-step-by-step-guide-to-building-from-scrtch/
[29] https://modelcontextprotocol.io/quickstart/server
[30] https://www.kdnuggets.com/building-a-simple-mcp-server
[31] https://github.com/modelcontextprotocol/typescript-sdk
[32] https://github.com/zcaceres/fetch-mcp
[33] https://github.com/modelcontextprotocol/inspector
[34] https://modelcontextprotocol.io/docs/tools/inspector
[35] https://github.com/r-huijts/mcp-server-tester
[36] https://graphdb.ontotext.com/documentation/11.0/using-the-graphdb-rest-api.html
[37] https://neo4j.com/docs/http-api/current/query/
[38] https://neo4j.com/docs/getting-started/appendix/example-data/
[39] https://www.tellura.co.uk/graphdb-apis/