# MCP Server Synchronization Analysis

## Current State Analysis

### Server Implementations
1. **Stdio Server** (`mcp/stdio-server.js`) - Uses `createServer()`
2. **HTTP Server** (`mcp/http-server.js`) - Uses `createServer()`
3. **Unused Isolated Server** - Uses `createIsolatedServer()`

### Tool Registration Discrepancy

#### `createServer()` (Used by both stdio and HTTP)
**Simple Verbs** (✅ Enabled):
- `semem-tell` - Store information/interactions
- `semem-ask` - Query knowledge base
- `semem-augment` - Enhance content
- `semem-zoom` - Change abstraction level
- `semem-pan` - Apply content filters
- `semem-tilt` - Change representation style
- `semem-inspect` - Debug memory/cache
- `semem-remember` - Store memories
- `semem-forget` - Remove memories
- `semem-recall` - Retrieve memories
- `semem-project-context` - Project context
- `semem-fade-memory` - Fade memory visibility

**Advanced Tools** (❌ Commented Out):
- `zpt_preview` - Preview ZPT navigation results
- `zpt_get_schema` - Get ZPT parameter schema
- `zpt_validate_params` - Validate ZPT parameters
- `zpt_get_options` - Get ZPT navigation options
- `zpt_analyze_corpus` - Analyze corpus structure
- Research workflow tools
- Ragno tools
- SPARQL tools
- VSOM tools

#### `createIsolatedServer()` (Unused)
**All Tools** (✅ Enabled):
- Simple Verbs (same as above)
- ZPT tools (zpt_preview, zpt_get_schema, etc.)
- Research workflow tools
- Ragno tools
- SPARQL tools
- VSOM tools

### Comments in Code
```javascript
// TODO: Fix these using setRequestHandler pattern
// registerZPTTools(server);
// registerResearchWorkflowTools(server);
// registerRagnoTools(server);
// registerSPARQLTools(server);
// registerVSOMTools(server);
```

## Issue Identification

1. **Missing Advanced Tools**: Both stdio and HTTP servers are missing important specialized tools
2. **Simple Verbs vs Advanced Tools**: Simple verbs provide basic ZPT functionality (zoom/pan/tilt) but lack specialized features like zpt_preview
3. **Synchronization Gap**: createIsolatedServer has all tools but is unused
4. **TODO Not Addressed**: The setRequestHandler pattern issue hasn't been resolved

## Impact Assessment

**Currently Working**:
- Basic memory operations (tell/ask/augment)
- Basic ZPT navigation (zoom/pan/tilt)
- Resource endpoints
- Prompt workflows

**Missing Functionality**:
- Advanced ZPT features (preview, validation, corpus analysis)
- Research workflow automation
- Direct SPARQL query tools
- Ragno corpus decomposition tools
- VSOM visualization tools

## Recommended Fixes

1. **Enable all tools in createServer()** - Uncomment the tool registrations
2. **Fix setRequestHandler pattern** - Ensure all tools use proper registration pattern
3. **Remove createIsolatedServer()** - Consolidate to single server function
4. **Test tool availability** - Verify all tools work in both stdio and HTTP modes