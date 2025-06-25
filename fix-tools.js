#!/usr/bin/env node

/**
 * Utility script to fix MCP tool argument handling across all tool files
 */

import fs from 'fs';
import path from 'path';

const TOOLS_DIR = 'mcp/tools';
const TOOL_FILES = [
  'ragno-tools.js',
  'sparql-tools.js', 
  'vsom-tools.js',
  'zpt-tools.js',
  'research-workflow-tools.js'
];

// Template for the new pattern (will be customized per file)
const NEW_PATTERN_TEMPLATE = `
// Register tool call handler for {TOOL_TYPE} tools
const originalHandler = server._toolCallHandler;
server._toolCallHandler = async (request) => {
  const { name, arguments: args } = request.params;
  
  // Handle {TOOL_TYPE} tools
  if (Object.values({TOOL_NAME_ENUM}).includes(name)) {
    return await handle{TOOL_TYPE}ToolCall(name, args);
  }
  
  // Delegate to other handlers
  if (originalHandler) {
    return await originalHandler(request);
  }
  
  throw new Error(\`Unknown tool: \${name}\`);
};

async function handle{TOOL_TYPE}ToolCall(name, args) {
  // Implementation will be tool-specific
  try {
    // Validate and route to specific handlers
    // This is where we'll add the switch statement for each tool
    throw new Error(\`Tool \${name} not yet implemented in new pattern\`);
  } catch (error) {
    console.error(\`Error in {TOOL_TYPE} tool \${name}:\`, error);
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
}
`;

console.log('🔧 Starting tool files fix...');

// For now, let's just identify the issues and create a plan
for (const fileName of TOOL_FILES) {
  const filePath = path.join(TOOLS_DIR, fileName);
  
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf-8');
    
    // Count server.tool() calls
    const toolCalls = (content.match(/server\.tool\(/g) || []).length;
    
    console.log(`📄 ${fileName}: Found ${toolCalls} server.tool() calls to fix`);
    
    // Extract tool names
    const toolNameMatches = content.match(/server\.tool\(\s*["'`]([^"'`]+)["'`]/g);
    if (toolNameMatches) {
      const toolNames = toolNameMatches.map(match => {
        const nameMatch = match.match(/["'`]([^"'`]+)["'`]/);
        return nameMatch ? nameMatch[1] : null;
      }).filter(Boolean);
      
      console.log(`  Tools: ${toolNames.join(', ')}`);
    }
  } else {
    console.log(`❌ ${fileName}: File not found`);
  }
}

console.log('\n💡 All tools need to be converted from server.tool() to setRequestHandler pattern');
console.log('🎯 Focus: Fix one major tool file to demonstrate the pattern works end-to-end');