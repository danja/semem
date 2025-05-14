/**
 * MCP Client Example
 * 
 * This file demonstrates how to interact with the Semem MCP server
 * using the Model Context Protocol.
 */

// Try to import node-fetch directly, with fallback for older Node.js versions
let fetch;
try {
  // For Node.js 18+ with native fetch
  fetch = globalThis.fetch;
} catch (err) {
  try {
    // For Node.js < 18 using node-fetch
    const module = await import('node-fetch');
    fetch = module.default;
  } catch (err2) {
    console.error('Error: fetch is not available. Please install node-fetch or use Node.js 18+');
    process.exit(1);
  }
}

import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// MCP server endpoint
const MCP_SERVER_URL = process.env.MCP_SERVER_URL || 'http://localhost:4040/mcp';

// Session ID for the client
const SESSION_ID = process.env.MCP_SESSION_ID || 'example-session';

/**
 * Make an MCP JSON-RPC call to the server
 * 
 * @param {string} method - The MCP method to call
 * @param {Object} params - Parameters for the method call
 * @returns {Promise<Object>} - The server response
 */
async function mcpCall(method, params = {}) {
  // Add session ID to params
  const requestParams = {
    ...params,
    session_id: SESSION_ID
  };
  
  // Create JSON-RPC request
  const request = {
    jsonrpc: '2.0',
    id: Date.now().toString(),
    method,
    params: requestParams
  };
  
  // Send request to MCP server
  const response = await fetch(MCP_SERVER_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(request)
  });
  
  // Parse JSON response
  const jsonResponse = await response.json();
  
  // Check for errors
  if (jsonResponse.error) {
    throw new Error(`MCP error: ${jsonResponse.error.message}`);
  }
  
  return jsonResponse.result;
}

/**
 * Discover available MCP capabilities
 */
async function discoverMCP() {
  try {
    // Get server discovery information
    const response = await fetch(MCP_SERVER_URL);
    const serverInfo = await response.json();
    
    console.log('MCP Server Information:');
    console.log(`- Name: ${serverInfo.name}`);
    console.log(`- Version: ${serverInfo.version}`);
    console.log(`- Protocol: ${serverInfo.protocol_version}`);
    console.log('');
    
    // List available tools
    const tools = await mcpCall('mcp.tools.list');
    console.log('Available MCP Tools:');
    tools.tools.forEach(tool => {
      console.log(`- ${tool.id}: ${tool.description}`);
    });
    console.log('');
    
    // List available resources
    const resources = await mcpCall('mcp.resources.list');
    console.log('Available MCP Resources:');
    resources.resources.forEach(resource => {
      console.log(`- ${resource.id}: ${resource.description}`);
    });
    console.log('');
    
    // List available prompts
    const prompts = await mcpCall('mcp.prompts.list');
    console.log('Available MCP Prompts:');
    prompts.prompts.forEach(prompt => {
      console.log(`- ${prompt.id}: ${prompt.title} - ${prompt.description}`);
    });
    console.log('');
  } catch (error) {
    console.error('Error discovering MCP capabilities:', error);
  }
}

/**
 * Example: Add an interaction to memory
 */
async function addInteractionExample() {
  try {
    console.log('Adding interaction to memory...');
    
    const result = await mcpCall('mcp.tools.execute', {
      tool_id: 'memory.add',
      tool_params: {
        user_input: 'What is semantic memory?',
        assistant_response: 'Semantic memory is a type of declarative memory that includes general knowledge about the world, facts, concepts, and relationships that are not tied to personal experiences or specific events.'
      }
    });
    
    console.log('Result:', result);
    console.log('');
  } catch (error) {
    console.error('Error adding interaction:', error);
  }
}

/**
 * Example: Retrieve memory
 */
async function retrieveMemoryExample() {
  try {
    console.log('Retrieving relevant memories...');
    
    const result = await mcpCall('mcp.tools.execute', {
      tool_id: 'memory.retrieve',
      tool_params: {
        query: 'Tell me about memory systems',
        limit: 3
      }
    });
    
    console.log('Retrieved memories:');
    if (result.memories && result.memories.length > 0) {
      result.memories.forEach((memory, index) => {
        console.log(`Memory ${index + 1}:`);
        console.log(`- User: ${memory.user}`);
        console.log(`- Assistant: ${memory.assistant}`);
        console.log(`- Similarity: ${memory.similarity}`);
        console.log('');
      });
    } else {
      console.log('No relevant memories found');
    }
    console.log('');
  } catch (error) {
    console.error('Error retrieving memories:', error);
  }
}

/**
 * Example: Generate embeddings
 */
async function generateEmbeddingExample() {
  try {
    console.log('Generating embedding for text...');
    
    const result = await mcpCall('mcp.tools.execute', {
      tool_id: 'embeddings.create',
      tool_params: {
        text: 'Semantic memory is a form of long-term memory that involves the recall of ideas, concepts and facts.'
      }
    });
    
    // Only show a portion of the embedding for display
    const embeddingPreview = result.embedding.slice(0, 5);
    
    console.log(`Embedding generated (showing first 5 of ${result.embedding.length} dimensions):`);
    console.log(embeddingPreview);
    console.log('');
  } catch (error) {
    console.error('Error generating embedding:', error);
  }
}

/**
 * Example: Get memory statistics
 */
async function getMemoryStatsExample() {
  try {
    console.log('Getting memory statistics...');
    
    const result = await mcpCall('mcp.resources.get', {
      resource_id: 'memory.stats'
    });
    
    console.log('Memory statistics:');
    console.log(result.stats);
    console.log('');
  } catch (error) {
    console.error('Error getting memory stats:', error);
  }
}

/**
 * Example: Get a prompt template
 */
async function getPromptTemplateExample() {
  try {
    console.log('Getting prompt template for memory search...');
    
    const result = await mcpCall('mcp.prompts.get', {
      prompt_id: 'memory.search_template'
    });
    
    console.log('Prompt template:');
    console.log(`Title: ${result.title}`);
    console.log(`Description: ${result.description}`);
    console.log('Template:');
    console.log(result.template);
    console.log('');
  } catch (error) {
    console.error('Error getting prompt template:', error);
  }
}

/**
 * Run all examples
 */
async function runExamples() {
  try {
    console.log('=== SEMEM MCP CLIENT EXAMPLE ===\n');
    
    // Run example flows
    await discoverMCP();
    await addInteractionExample();
    await retrieveMemoryExample();
    await generateEmbeddingExample();
    await getMemoryStatsExample();
    await getPromptTemplateExample();
    
    console.log('=== ALL EXAMPLES COMPLETED ===');
  } catch (error) {
    console.error('Error running examples:', error);
  }
}

// Run the examples
runExamples();