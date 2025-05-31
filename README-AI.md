# Semem - AI Development Guide

## Architecture Overview

**Core Pattern**: Layered architecture with dependency injection via constructors and factory patterns.

```
MemoryManager (orchestrator)
├── Handlers (embedding, LLM, cache)
├── Stores (memory, JSON, SPARQL) 
├── Connectors (Ollama, Claude, Mistral)
└── Context/Utils (window management, templates)
```

## Key Classes

- **MemoryManager**: Main coordinator, handles initialization/disposal lifecycle
- **BaseStore**: Abstract storage interface - extend for new backends
- **BaseAPI**: Abstract API interface - extend for new endpoints  
- **EmbeddingHandler**: Vector operations with validation/standardization
- **LLMHandler**: Chat/completion with prompt templating
- **Config**: Hierarchical config merging (defaults → file → env → user)

## Development Patterns

### Error Handling
- Custom error classes with type/cause properties
- Graceful degradation with fallbacks
- Proper cleanup in disposal/shutdown methods

### Async Patterns  
- Constructor → async initialize() → operations → dispose()
- Promise-based with proper error propagation
- Timeout/retry logic for external services

### Configuration
- Environment variables override config files
- Validation in `validateConfig()` 
- Provider fallback chains by priority

### Storage Interface
```javascript
// All stores implement:
async loadHistory() → [shortTerm[], longTerm[]]
async saveMemoryToHistory(memoryStore)
async beginTransaction/commitTransaction/rollbackTransaction
```

### API Interface
```javascript
// All APIs implement:
async initialize()
async executeOperation(operation, params)
async getMetrics()
async shutdown()
```

## File Structure

### Core Files
- `src/MemoryManager.js` - Main orchestrator
- `src/Config.js` - Configuration management
- `src/stores/BaseStore.js` - Storage interface
- `src/api/common/BaseAPI.js` - API interface

### Implementation Examples
- `src/stores/JSONStore.js` - File-based storage with transactions
- `src/stores/SPARQLStore.js` - RDF/SPARQL storage with validation
- `src/connectors/OllamaConnector.js` - Local LLM integration
- `src/api/features/MemoryAPI.js` - Memory operations API

## Configuration

### Environment Variables
- `CLAUDE_API_KEY`, `OLLAMA_API_BASE` - Provider credentials
- `LOG_LEVEL` - Logging verbosity
- `NODE_ENV` - Environment mode

### Config Files
- `config/config.json` - Production configuration
- `config.sample.json` - Template with all options
- `.env` - Local development overrides

## Testing Strategy

- **Unit Tests**: Core classes with mocked dependencies
- **Integration Tests**: End-to-end with real services
- **LLM Tests**: Separate test suite for external dependencies
- Use `vitest` framework with coverage reporting

## Development Workflow

1. **Setup**: Copy `example.env` → `.env`, configure API keys
2. **Core Changes**: Modify base classes, update implementing classes
3. **New Stores**: Extend `BaseStore`, implement interface methods
4. **New APIs**: Extend `BaseAPI`, register in `APIRegistry`
5. **Testing**: Run `npm test` (excludes LLM tests), `npm run test:llms` for full suite

## Key Conventions

- **ES Modules**: Use `import/export`, no CommonJS
- **Error First**: Validate inputs, fail fast with descriptive errors  
- **Disposal**: Always implement cleanup (close connections, clear timers)
- **Logging**: Use `loglevel` with appropriate levels
- **Immutability**: Clone objects when modifying, avoid mutation
- **Type Safety**: JSDoc annotations, runtime validation

## Common Tasks

### Adding New Storage Backend
1. Extend `BaseStore` class
2. Implement required methods with proper error handling
3. Add configuration options to `Config.defaults`
4. Register in storage factory/selection logic

### Adding New LLM Provider  
1. Create connector implementing required methods
2. Add provider config to `llmProviders` array
3. Update `Config.js` transformation logic
4. Test with representative models

### Adding New API Endpoint
1. Extend `BaseAPI` class
2. Implement `executeOperation` with operation routing
3. Register in `APIRegistry` 
4. Add HTTP routes in server configuration

## Dependencies

**Core**: `faiss-node` (vectors), `loglevel` (logging), `uuid` (IDs)
**Storage**: Direct HTTP for SPARQL, filesystem for JSON
**LLM**: `hyperdata-clients` (unified interface), provider SDKs
**Server**: `express`, `cors`, `helmet`, `compression`