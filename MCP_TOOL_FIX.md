# MCP Tool Argument Handling Fix

## Issue Identified
MCP SDK v1.13.1 has a breaking change where `server.tool()` method does not pass tool arguments correctly to the handler function.

## Root Cause
When using `server.tool(name, description, schema, handler)`, the handler function receives:
```javascript
{
  "signal": {},
  "sessionId": "uuid",
  "requestId": 123,
  "_meta": {...},
  "sendNotification": function,
  "sendRequest": function,
  "authInfo": {...}
}
```

Instead of the expected tool arguments like `{ text: "hello world" }`.

## Working Solution
The reference server pattern using `setRequestHandler(CallToolRequestSchema, handler)` works correctly and receives arguments as `request.params.arguments`.

## Required Change Pattern

### OLD (Broken in v1.13.1):
```javascript
server.tool(
  "tool_name",
  "Description",
  z.object({ text: z.string() }),
  async ({ text }) => {  // ❌ text is undefined
    // Implementation
  }
);
```

### NEW (Working):
```javascript
// In tool registration function:
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  
  if (name === 'tool_name') {
    const validatedArgs = ToolSchema.parse(args);
    const { text } = validatedArgs;  // ✅ text has correct value
    // Implementation
  }
});

// Also need tools list handler:
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "tool_name",
        description: "Description", 
        inputSchema: zodToJsonSchema(ToolSchema)
      }
    ]
  };
});
```

## Alternative Simple Fix (if possible)
Change only the handler function signature:
```javascript
// Instead of: async ({ text }) => 
// Use: async (args) => { const { text } = args; }
```
But this may not work if the args object itself doesn't contain the tool arguments.

## Files to Fix
1. `mcp/tools/memory-tools.js` - 5 tools
2. `mcp/tools/ragno-tools.js` - 8 tools  
3. `mcp/tools/sparql-tools.js` - 8 tools
4. `mcp/tools/vsom-tools.js` - 9 tools
5. `mcp/tools/zpt-tools.js` - 6 tools
6. `mcp/tools/research-workflow-tools.js` - 6 tools

## Test Strategy
Fix one tool at a time and test with:
```bash
SESSION_ID=$(curl -s -X POST -H "Content-Type: application/json" -H "Accept: application/json, text/event-stream" -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}' http://localhost:3000/mcp -D - | grep "mcp-session-id:" | cut -d' ' -f2 | tr -d '\r') && curl -s -X POST -H "Content-Type: application/json" -H "Accept: application/json, text/event-stream" -H "mcp-session-id: $SESSION_ID" -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"TOOL_NAME","arguments":{"PARAM":"VALUE"}}}' http://localhost:3000/mcp
```

## Status
- ❌ Issue confirmed: MCP SDK v1.13.1 `server.tool()` broken
- ✅ Solution verified: `setRequestHandler` pattern works  
- 🔄 Implementation: Fix tools one by one