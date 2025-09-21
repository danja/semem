# MCP Architecture Supersession Analysis

This document analyzes the evolution of Semem's MCP server architecture and identifies which components have been superseded.

## Overview

The legacy MCP server (`src/servers/mcp.js`) has been completely superseded by the new modular architecture in the `mcp/` directory. This analysis compares the dependencies and architectural patterns to understand the evolution.

## Legacy MCP Server Dependencies (`src/servers/mcp.js`)

### Direct Service Imports

```javascript
import LLMHandler from '../handlers/LLMHandler.js'           // ✅ Still used
import EmbeddingHandler from '../handlers/EmbeddingHandler.js' // ❌ SUPERSEDED
import CacheManager from '../handlers/CacheManager.js'        // ❌ SUPERSEDED
import SPARQLHelpers from '../services/sparql/SPARQLHelper.js' // ❌ SUPERSEDED
import SearchService from '../services/search/SearchService.js' // ⚠️ Limited use
import EmbeddingService from '../services/embeddings/EmbeddingService.js' // ⚠️ Limited use
import SPARQLService from '../services/embeddings/SPARQLService.js' // ❌ SUPERSEDED
```

### Connector/Provider Imports

```javascript
import Config from '../Config.js'                    // ✅ Still used
import OllamaConnector from '../connectors/OllamaConnector.js'    // ✅ Still used
import ClaudeConnector from '../connectors/ClaudeConnector.js'    // ✅ Still used
import MistralConnector from '../connectors/MistralConnector.js'  // ✅ Still used
import EmbeddingConnectorFactory from '../connectors/EmbeddingConnectorFactory.js' // ✅ Still used
```

## Current Architecture Replacements

### Service Layer Evolution

| Legacy Component | Current Replacement | Location |
|------------------|---------------------|----------|
| `EmbeddingHandler` | `MemoryManager` + SPARQLStore `Vectors` module | `src/MemoryManager.js` + `src/stores/modules/Vectors.js` |
| `CacheManager` | SPARQLStore `SPARQLCache` module | `src/stores/modules/SPARQLCache.js` |
| `SPARQLHelpers` | SPARQLStore `SPARQLExecute` module + `SPARQLQueryService` | `src/stores/modules/SPARQLExecute.js` + `src/services/sparql/SPARQLQueryService.js` |
| `SearchService` | SPARQLStore `Search` module + enhanced context services | `src/stores/modules/Search.js` |

### Architectural Pattern Change

```
OLD: Direct service imports → Manual orchestration
NEW: MemoryManager → SPARQLStore (modular) → Enhanced services
```

## SPARQLStore Module Supersession

The new SPARQLStore provides modular components that replace the functionality previously handled by individual services:

- **`SPARQLExecute`** → Replaces SPARQLHelpers functionality
- **`Vectors`** → Replaces EmbeddingHandler for vector operations
- **`Search`** → Replaces SearchService with enhanced similarity search
- **`SPARQLCache`** → Replaces CacheManager with SPARQL-optimized caching
- **`Store`** → Unified storage operations
- **`ZPT`** → Navigation functionality (completely new)
- **`Graph`** → Graph operations (completely new)

## Evolution Summary

### ✅ Completely Superseded

1. **`EmbeddingHandler`** → SPARQLStore `Vectors` module + MemoryManager
2. **`CacheManager`** → SPARQLStore `SPARQLCache` module
3. **`SPARQLHelpers`** → SPARQLStore `SPARQLExecute` module
4. **`SPARQLService`** → SPARQLQueryService + SPARQLStore modules

### ⚠️ Partially Superseded

1. **`SearchService`** → SPARQLStore `Search` module (enhanced, but old version still used in HTTP server)
2. **`EmbeddingService`** → Integrated into MemoryManager/SPARQLStore (but HTTP server still uses old version)

### ✅ Still Current

1. **`LLMHandler`** → Used in current MCP but via MemoryManager
2. **`Config`** → Central to both architectures
3. **Connectors** → Still the primary LLM/embedding provider interface

## Current MCP Architecture

The new MCP server architecture uses:

- **Entry Points**:
  - `mcp/index.js` (stdio MCP server)
  - `mcp/stdio-server.js` (stdio wrapper)
  - `mcp/http-server.js` (HTTP MCP server)

- **Service Initialization**: `mcp/lib/initialization.js` creates `MemoryManager` instances

- **Core Services**: All functionality provided through `MemoryManager` → `SPARQLStore` → Specialized modules

- **Tool Registry**: `mcp/tools/simple-verbs.js` provides high-level semantic operations (`tell`, `ask`, `zoom`, `pan`, `tilt`, etc.)

## Migration Implications

### Safe to Remove

The following files can be safely removed as they are no longer used:

- `src/servers/mcp.js` (legacy MCP server)

### Dependencies Still in Use

All modules imported by the legacy MCP server are still used elsewhere in the codebase:

- **LLMHandler**: 12+ references across the codebase
- **EmbeddingHandler**: 7+ references across the codebase
- **All connectors**: Essential for LLM/embedding provider integration
- **Config**: Central configuration system

### File Status

- **`src/servers/mcp.js`**: ❌ **OBSOLETE** - Missing imports, cannot run, superseded functionality
- **`mcp/` directory**: ✅ **CURRENT** - Complete modular implementation
- **Package.json scripts**: ✅ **UPDATED** - Point to new MCP implementation

## Conclusion

The old `src/servers/mcp.js` dependencies have been largely superseded by a higher-level abstraction pattern:

- **Old approach**: Direct service composition in MCP server
- **New approach**: Services composed through MemoryManager → SPARQLStore → Specialized modules

The architectural evolution shows a move from manual service orchestration to a modular, composable system that provides better separation of concerns and enhanced functionality through the SPARQLStore module system.

**Result**: `src/servers/mcp.js` represents an obsolete architectural pattern that has been fully replaced by the modular, MemoryManager-based approach in the current MCP implementation.