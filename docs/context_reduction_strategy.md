# Context Reduction Strategy - Semem Codebase

## Core Principle
Keep **one representative** of each pattern type, eliminate redundancy, preserve architecture understanding.

## File Selection Strategy

### Essential (Always Include)
- **Core orchestrator**: `MemoryManager.js` 
- **Base classes**: `BaseStore.js`, `BaseAPI.js`
- **Configuration**: `Config.js`, `config.json`, `package.json`
- **Documentation**: `README.md`, `CLAUDE.md`, setup files

### Pattern Representatives (One Each)
- **Storage**: `JSONStore.js` (shows transactions), `SPARQLStore.js` (shows validation)
- **Connectors**: `OllamaConnector.js` (local), `ClaudeConnector.js` (API)
- **APIs**: `MemoryAPI.js` (shows operation routing)
- **Examples**: `OllamaExample.js`, `ClaudeExample.js` (different providers)

### Eliminate Entirely
- **Redundant examples**: 15+ examples → 2 representatives
- **Multiple servers**: `start-all.js`, `server-manager.js`, `ui-server.js` → keep `api-server.js`
- **Duplicate APIs**: `ActiveHandler.js`, `PassiveHandler.js`, `SelfieHandler.js` → base pattern sufficient
- **Frontend/CLI/Scripts**: Non-core interfaces
- **Middleware/Utils**: Implementation details, not architecture

## Size Reduction Results
- Original: ~4,500 lines across 100+ files
- Optimized: ~1,100 lines across 25 files  
- **75% reduction** while preserving development context

## Selection Criteria Checklist
✅ **Keep if**: Shows unique pattern, base class, or core workflow  
❌ **Remove if**: Duplicate pattern, implementation detail, or UI/tooling  
⚠️ **Consider**: Does it demonstrate error handling, async patterns, or configuration?

## Implementation
Use explicit `include` array in repomix config instead of wildcards. Add comprehensive `ignore.customPatterns` for eliminated categories.

## Validation
Reduced context should still enable:
- Understanding architecture layers
- Implementing new storage backends  
- Adding LLM providers
- Creating API endpoints
- Following configuration patterns