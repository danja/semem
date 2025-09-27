# MCP Index.js Refactoring Plan

## Current State Analysis

The `mcp/index.js` file has grown to **2,878 lines** and suffers from multiple architectural issues:

### Critical Issues Identified:
1. **Massive Monolithic File**: Single file handling server setup, tool registration, tool implementation, resources, and prompts
2. **Dual Tool Registration**: Conflicting patterns using both `server.tool()` in modules and `server.setRequestHandler(CallToolRequestSchema)` with inline if-else chain
3. **47+ Inline Tool Implementations**: Giant switch statement implementing tools that should be modularized
4. **Deprecated Tools**: Multiple deprecated tools still implemented (semem_store_interaction, semem_retrieve_memories, etc.)
5. **Code Duplication**: Repeated service initialization, SafeOperations imports, error handling patterns
6. **Mixed Responsibilities**: Violates single responsibility principle

## Refactoring Strategy

### Phase 1: File Structure Reorganization

**Create new files:**
```
src/mcp/ (updated for consistency with project structure)
├── index.js (simplified entry point ~200 lines)
├── server/
│   ├── server-factory.js (server creation & config)
│   ├── handlers/
│   │   ├── prompt-handlers.js
│   │   ├── resource-handlers.js
│   │   └── tool-router.js (unified tool routing)
├── tools/
│   ├── core/ (7 core tools only)
│   │   ├── core-tools.js (tell, ask, augment, zoom, pan, tilt, inspect)
│   │   └── core-service.js (shared core tool logic)
│   └── modules/ (existing modular tools)
│       ├── sparql-tools.js ✓ (keep existing)
│       ├── ragno-tools.js ✓ (keep existing)
│       ├── vsom-tools.js ✓ (keep existing)
│       └── zpt-tools.js ✓ (keep existing)
```

**Note:** File structure updated to use `src/mcp/` instead of `mcp/` for consistency with the project's overall architecture where source code is organized under `src/`.

### Phase 2: Tool Consolidation Strategy

**Core Tools (7 essential tools):**
- `tell` - Store information (absorb: semem_store_interaction, uploadDocument, sparql_ingest_documents)
- `ask` - Query information (absorb: semem_retrieve_memories, semem_answer, semem_ask)
- `augment` - Process/enhance data (absorb: semem_extract_concepts, semem_generate_embedding, remember)
- `zoom` - Navigation granularity ✓
- `pan` - Navigation filtering ✓
- `tilt` - Navigation perspective ✓
- `inspect` - System introspection ✓

**Memory Tools → Core Integration:**
- `remember` → `augment` with memory domain
- `forget`/`fade_memory` → `augment` with fade operations
- `recall` → `ask` with memory domain
- `project_context` → `augment` with project management

**Specialized Tools → Module Delegation:**
- All `sparql_*` tools → sparql-tools.js module (existing)
- All `ragno_*` tools → ragno-tools.js module (existing)
- All `zpt_*` tools → zpt-tools.js module (existing)
- All `vsom_*` tools → vsom-tools.js module (existing)

**Deprecated Tools → Remove:**
- `semem_store_interaction` → Use `tell`
- `semem_retrieve_memories` → Use `ask`
- `semem_answer` → Use `ask`
- `semem_ask` → Use `ask`

### Phase 3: Unified Tool Registration

**Replace dual registration with single pattern:**

```javascript
// New unified approach in tool-router.js
class ToolRouter {
  constructor() {
    this.coreTools = new CoreToolsService();
    this.modules = new Map();
  }

  async route(toolName, args) {
    // Route to core tools first
    if (this.coreTools.handles(toolName)) {
      return this.coreTools.execute(toolName, args);
    }

    // Route to specialized modules
    for (const [prefix, module] of this.modules) {
      if (toolName.startsWith(prefix)) {
        return module.execute(toolName, args);
      }
    }

    throw new Error(`Unknown tool: ${toolName}`);
  }
}
```

### Phase 4: Implementation Details

**Core Tools Enhancement:**

```javascript
// core-tools.js
export class CoreToolsService {
  async tell(args) {
    // Unified tell implementation
    // - Handle basic content storage
    // - Handle document upload (from uploadDocument)
    // - Handle SPARQL ingestion (from sparql_ingest_documents)
    // - Handle interaction storage (from semem_store_interaction)
  }

  async ask(args) {
    // Unified ask implementation
    // - Handle basic querying
    // - Handle memory retrieval (from semem_retrieve_memories)
    // - Handle answer generation (from semem_answer, semem_ask)
    // - Handle recall (from recall)
  }

  async augment(args) {
    // Unified augment implementation
    // - Handle concept extraction (from semem_extract_concepts)
    // - Handle embedding generation (from semem_generate_embedding)
    // - Handle memory operations (from remember, forget, fade_memory)
    // - Handle project context (from project_context)
    // - Handle all existing augment operations
  }
}
```

**Service Abstraction:**

```javascript
// core-service.js - shared utilities
export class CoreService {
  static async initializeServices() { /* shared logic */ }
  static createSafeOperations(memoryManager) { /* shared logic */ }
  static formatResponse(data, success = true) { /* shared logic */ }
  static validateArgs(args, schema) { /* shared logic */ }
}
```

### Phase 5: Migration Steps

1. **Create new file structure** (server/, tools/core/, tools/modules/)
2. **Extract and consolidate core tools** into CoreToolsService
3. **Create unified ToolRouter** replacing massive if-else chain
4. **Remove deprecated tools** and update documentation
5. **Migrate specialized tools** to use consistent module pattern
6. **Simplify index.js** to pure server setup and routing
7. **Update tests** to work with new structure
8. **Update documentation** reflecting 7 core tools

### Phase 6: Benefits Achieved

- **File size reduction**: index.js from 2,878 → ~200 lines
- **Eliminated redundancy**: Single tool registration pattern
- **Clear separation**: Core tools vs specialized modules
- **Easier maintenance**: Each tool type in dedicated file
- **Better testing**: Isolated, testable components
- **Simplified API**: 7 core tools + module-specific tools
- **Performance**: Lazy loading of specialized modules
- **Consistency**: Unified error handling and response formatting

### Phase 7: Quality Assurance

- All existing functionality preserved through core tool absorption
- No breaking changes to API contracts
- All tests pass with new structure
- Documentation updated to reflect simplified tool set
- Performance benchmarks confirm no regression

## Implementation Status

This plan was approved and implementation is in progress. The refactoring will be done incrementally to ensure system stability and maintain backward compatibility throughout the process.