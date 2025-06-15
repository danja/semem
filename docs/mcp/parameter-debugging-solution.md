# MCP Parameter Debugging Solution

## Problem Identified

The Semem MCP server was experiencing parameter passing issues where tool handlers were not receiving the expected user parameters. Through comprehensive debugging, we identified the root cause:

**The MCP SDK was passing internal protocol metadata instead of user parameters to tool handlers.**

## Debugging Process

### 1. Enhanced Logging Setup

Created comprehensive debugging infrastructure in `mcp/lib/debug-utils.js`:
- Protocol-level message logging
- Parameter structure inspection
- Tool call performance monitoring
- Error tracking with stack traces

### 2. Diagnostic Tools

Implemented a diagnostic tool (`mcp_debug_params`) that:
- Accepts various parameter types for testing
- Logs detailed parameter structure information
- Provides recommendations for proper parameter handling
- Works correctly, proving the MCP client-server communication is functional

### 3. Root Cause Analysis

Debug logs revealed:

**Expected behavior:**
```javascript
// User calls: { text: "some text" }
// Handler should receive: [{ text: "some text" }]
```

**Actual behavior:**
```javascript
// User calls: { text: "some text" }  
// Handler receives: [{ signal: {}, sessionId: "...", requestId: 5, ... }]
```

The MCP SDK was passing protocol metadata objects instead of user arguments.

## Solution Approaches

### Approach 1: Parameter Extraction Fix (Attempted)

Initial attempt to update tool handlers to handle the MCP protocol format correctly by examining the actual structure passed by the SDK.

### Approach 2: Tool Registration Format Fix (IMPLEMENTED - SOLUTION)

**ROOT CAUSE IDENTIFIED AND FIXED**: The issue was using the wrong MCP SDK API pattern.

**Problem**: The Semem server was using the old/incorrect `server.tool()` API:
```javascript
server.tool(name, schema, handler)
```

**Solution**: Switch to the HTTP version pattern used by the reference implementation:
```javascript
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  // Handle tools based on name and extract parameters from args
})
```

**Key Changes Made**:
1. Changed from `McpServer` to `Server` import
2. Used `setRequestHandler(CallToolRequestSchema, ...)` instead of `server.tool()`
3. Extract parameters from `request.params.arguments` instead of function parameters
4. Updated both tools and resources to use HTTP pattern

## Testing Infrastructure

### Automated Testing
- `mcp/test-parameters.js` - Comprehensive parameter testing script
- Tests all tool variations with different parameter combinations
- Provides detailed success/failure reporting

### MCP Inspector Integration
- `mcp/run-inspector.sh` - Script to launch MCP Inspector for visual debugging
- Allows real-time inspection of protocol messages
- Web UI for testing tools manually

## Key Findings

1. **Diagnostic tool works perfectly** - Protocol communication is functional
2. **Memory tools fail consistently** - Parameter extraction issue
3. **MCP SDK passes protocol metadata** - Not user parameters
4. **Tool registration may need updating** - Possible API change in SDK

## Recommended Next Steps

### Immediate Actions

1. **Check MCP SDK Documentation**
   - Verify current tool registration API
   - Check for breaking changes in recent SDK versions
   - Review official examples for proper parameter handling

2. **Update Tool Registration**
   - Modify tool registration to match current SDK expectations
   - Test with official MCP SDK examples
   - Ensure parameter schemas are correctly defined

3. **SDK Version Compatibility**
   - Check if using compatible MCP SDK version
   - Consider upgrading/downgrading if necessary
   - Test with known working SDK versions

### Long-term Solutions

1. **Implement Protocol-Level Debugging**
   - Continue using the debugging infrastructure
   - Monitor protocol messages for changes
   - Maintain comprehensive test suite

2. **Documentation and Examples**
   - Document working parameter patterns
   - Create reference implementations
   - Maintain debugging playbook

## Files Modified/Created

### Debugging Infrastructure
- `mcp/lib/debug-utils.js` - Comprehensive debugging utilities
- `mcp/index.js` - Enhanced with protocol logging
- `mcp/tools/memory-tools-fixed.js` - Updated parameter handling

### Testing Tools
- `mcp/test-parameters.js` - Automated parameter testing
- `mcp/run-inspector.sh` - MCP Inspector integration

### Documentation
- `docs/mcp/parameter-debugging-solution.md` - This document

## Usage

### Run Debugging Tests
```bash
# Automated testing
node mcp/test-parameters.js

# Visual debugging with MCP Inspector
./mcp/run-inspector.sh
```

### Enable Debug Logging
```bash
export MCP_DEBUG=true
export MCP_DEBUG_LEVEL=debug
node mcp/index.js
```

## Conclusion

**PROBLEM SOLVED**: The MCP parameter passing issue has been completely resolved.

**Root Cause**: The Semem MCP server was using an incompatible tool registration API (`server.tool()`) instead of the correct HTTP version pattern (`setRequestHandler(CallToolRequestSchema, ...)`).

**Solution Implemented**: Updated the server to use the reference implementation pattern where:
1. Tools are registered via `setRequestHandler(CallToolRequestSchema, handler)`
2. Parameters are extracted from `request.params.arguments`
3. Tool handlers receive a request object, not direct function parameters

**Test Results**: 
- Parameter passing now works correctly ✅
- Schema validation works properly ✅
- Tools receive expected parameter objects ✅
- All basic memory tools function correctly ✅

The debugging infrastructure successfully identified the root cause and remains valuable for ongoing MCP development and troubleshooting.