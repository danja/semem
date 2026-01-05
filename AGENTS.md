# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

There should be no inline fallbacks as this leads to indeterminate code. If the value is not successfully retrieved from config then that is an error that needs fixing.

## Project Overview

Semem (Semantic Memory) is a Node.js library for intelligent agent memory management that integrates large language models (LLMs) with semantic web technologies (RDF/SPARQL). It provides a memory system for AI applications with multiple storage backends and LLM provider integrations.

It uses ES modules and Vitest for tests.

Only look at docs when requested. Always ignore all files under docs/ignore

## Architectural Notes

- The memory and json storage backends are being phased out, sparql storage should be used throughout
- The MCP (Model Context Protocol) system has been restructured around 13 core verbs instead of the previous complex tool hierarchy

## Development Guidelines

When creating new code follow the patterns described in `docs/manual/infrastructure.md`

- scripts should be run from the server root
- Mocking is only allowed for trivial arithmetic-style unit checks (e.g. “does a + b equal c?”); every other test must assume the live services defined in `config/config.json` are reachable and interact with them directly.

## Configuration Management

Configuration constants are centralized in `config/preferences.js` to avoid hardcoded values throughout the codebase. This file contains:

- **SEARCH_CONFIG**: Quality thresholds, scoring weights, and boost factors for AdaptiveSearchEngine
- **SPARQL_CONFIG**: Similarity search defaults and data health assessment thresholds  
- **MEMORY_CONFIG**: Decay factors and persistence settings

The configuration uses detailed comments explaining each constant's purpose. When adding new configurable values, add them to the appropriate section in `preferences.js` rather than hardcoding in source files.

## Remote Server Deployment

The production instance of Semem runs on Docker with the following endpoints:

- **Workbench UI**: https://semem.tensegrity.it/
- **Fuseki SPARQL**: https://semem-fuseki.tensegrity.it/
- **MCP Server**: https://mcp.tensegrity.it/
- **API Server**: https://api.tensegrity.it/

This deployment provides a fully functional remote instance for testing and demonstration purposes.

## Blog Guidelines

- Progress reports and plans should be saved as md files under docs/postcraft/content/raw/entries/ 
- Naming scheme follows format: `YYYY-MM-DD_claude_title.md`
- Main title should start with "# Claude :"
- Document should be rendered in the style of a development worklog
- If the document exceeds a page or two, or if the primary topic of activity changes, create a new document


## Architecture

Semem has a layered architecture with the following key components:

1. **Memory Management Layer**
   - `MemoryManager`: Core class that coordinates memory operations
   - `ContextManager`: Manages context retrieval and window sizing
   - `ContextWindowManager`: Handles text chunking and window management

2. **Storage Layer**
   - `BaseStore`: Abstract base class for all storage backends
   - `MemoryStore`: In-process memory management
   - `InMemoryStore`: Transient in-memory storage
   - `JSONStore`: Persistent storage using JSON files
   - `SPARQLStore`: RDF-based storage with SPARQL endpoints
   - `CachedSPARQLStore`: Optimized version with caching

3. **Handlers Layer**
   - `EmbeddingHandler`: Manages vector embeddings generation and processing
   - `LLMHandler`: Orchestrates language model interactions
   - `CacheManager`: Provides caching for improved performance

4. **API Layer**
   - Multiple interface types (HTTP, CLI, REPL)
   - `APIRegistry`: Central service registry
   - Request handling via active/passive handlers

5. **Connector Layer**
   - `ClientConnector`: Base connector class
   - Provider-specific connectors (Ollama, Claude, etc.)

6. **Ragno Layer (Knowledge Graph Integration)**
   - `Entity`: RDF-based entities extracted from text
   - `Unit`: Independent semantic units from corpus decomposition
   - `Relationship`: First-class relationship nodes between entities
   - `RDFGraphManager`: Manages RDF graph operations
   - `decomposeCorpus`: Main function for text-to-RDF decomposition
   - Uses Ragno vocabulary (http://purl.org/stuff/ragno/) for RDF modeling

7. **MCP Layer (Model Context Protocol)**
   - 13 core verbs: `tell`, `ask`, `augment`, `zoom`, `pan`, `tilt`, `inspect`, `remember`, `forget`, `recall`, `project_context`, `fade_memory`, `train-vsom`
   - HTTP server: `src/mcp/http-server.js` - provides REST API endpoints
   - STDIO server: `src/mcp/index.js` - provides MCP protocol communication
   - Unified validation using Zod schemas for all verb parameters
   - Direct HTTP endpoints: `/tell`, `/ask`, `/augment`, `/zoom`, `/pan`, `/tilt`, `/inspect`, `/remember`, `/forget`, `/recall`

8. **VSOM Layer (Visual Self-Organizing Map)**
   - Standalone server: `src/frontend/vsom-standalone/server.js` - serves VSOM UI and proxies to MCP
   - API proxy configuration routes requests to appropriate backend services
   - ZPT (Zoom, Pan, Tilt) 3-dimensional navigation system
   - Integration with MCP verbs for semantic visualization and spatial navigation
   - Runs on port 4103 by default

## Working with the Codebase

- Always initialize Config instances before use
- Properly dispose of resources when finished (especially MemoryManager)
- Use appropriate storage backend for the specific use case
- Respect semantic versioning in any changes or contributions
- Follow the existing coding patterns for new functionality

## Common Issues and Solutions

If problems are enountered in the following areas, refer to documentation :

- Read `docs/manual/config.md` for issues related to general setup
- Read `docs/manual/provider-config.md` for issues relating to embedding and llm chat completion services
- Read `docs/manual/prompt-management.md` for issues related to chat completion prompts
- Read `docs/manual/sparql-service.md` for issues related to SPARQL
- Read `docs/manual/mcp-list.md` for current MCP verb documentation
- Read `docs/manual/mcp-tutorial.md` for MCP integration guidance 

### LLM Connector and Model Configuration (from api-server.js)
The semem system uses a priority-based LLM provider configuration pattern:

**Config.js Access Pattern:**
```javascript
const llmProviders = config.get('llmProviders') || [];
```

**Provider Selection:**
1. Filter by capabilities: `providers.filter(p => p.capabilities?.includes('chat'))`
2. Sort by priority: `sort((a, b) => (a.priority || 999) - (b.priority || 999))`
3. Try providers in order, fallback to Ollama

**Connector Creation Functions:**
- `createLLMConnector(config)` - for chat providers (MistralConnector, ClaudeConnector, OllamaConnector)
- `createEmbeddingConnector(config)` - for embedding providers via EmbeddingConnectorFactory
- `getModelConfig(config)` - extracts model names from highest priority providers

**Model Name Resolution:**
- Chat: `chatProvider?.chatModel || 'qwen2:1.5b'`
- Embedding: `embeddingProvider?.embeddingModel || 'nomic-embed-text'`

**Handler Initialization:**
```javascript
const modelConfig = await getModelConfig(config);
const llmHandler = new LLMHandler(llmProvider, modelConfig.chatModel);
```

**Priority Examples in config.json:**
- Mistral: priority 1 (highest)
- Claude: priority 2  
- Ollama: priority 2 (fallback, no API key required)

### LLMHandler Method Names
- Use `generateResponse(prompt, context, options)` for chat completion
- Use `extractConcepts(text)` for concept extraction
- Do NOT use `generateCompletion()` - this method doesn't exist

### Entity Constructor Patterns
- Entity constructor: `new Entity({ name, isEntryPoint, subType, ... })`
- Do NOT pass `rdfManager` as first parameter to Entity constructor
- Entity methods: `getPrefLabel()`, `isEntryPoint()`, `getSubType()`

### SPARQLStore Methods
- Use `store(data)` to save entities/memory items with embeddings
- Use `search(queryEmbedding, limit, threshold)` for similarity search
- Data format: `{ id, prompt, response, embedding, concepts, metadata }`
- SPARQLStore supports cosine similarity search with embedded vectors

### Ragno Integration
- Use `decomposeCorpus(textChunks, llmHandler, options)` for text decomposition
- Returns: `{ units, entities, relationships, dataset }`
- Ragno classes follow RDF-Ext patterns with proper ontology compliance
- All Ragno elements export to RDF dataset via `exportToDataset(dataset)`

### Ollama Models
- Used as a fallback when remote services aren't available
- Embedding model: `nomic-embed-text` (1536 dimensions)
- Chat model: `qwen2:1.5b` (commonly available, fast)
- Verify models are installed: `ollama list`

### MCP Core Verbs
- **tell**: Store content in semantic memory
- **ask**: Query stored knowledge with context
- **augment**: Extract concepts and relationships
- **zoom**: Navigate content at different granularities (micro/entity/text/unit/community/corpus)
- **pan**: Navigate content using multi-dimensional filters (domains/keywords/entities/corpuscle/temporal)
- **tilt**: Present content at different styles (keywords/embedding/graph/temporal/concept)
- **inspect**: Examine system state (session/concepts/all)
- **remember**: Store in specific memory domains with importance weighting
- **forget**: Reduce memory visibility using fade/remove methods
- **recall**: Retrieve from specific memory domains with filtering
- **project_context**: Manage project-specific memory domains
- **fade_memory**: Gradually reduce memory visibility for context transitions
- **train-vsom**: Train Visual Self-Organizing Map for data visualization

### VSOM Integration
- VSOM standalone server: `src/frontend/vsom-standalone/server.js`
- Proxies API requests to MCP server on port 4101
- Uses direct HTTP endpoints (`/tell`, `/ask`, etc.) instead of MCP protocol
- Comprehensive e2e test coverage in `tests/integration/vsom/`
- ZPT navigation system integrated with MCP verbs for 3D semantic exploration

### Dogalog Integration
- **Endpoint**: `POST http://localhost:4101/dogalog/chat`
- **Purpose**: Provides AI assistance for Dogalog Prolog-based audio programming IDE
- **Request format**: `{ prompt: string, code?: string }`
- **Response format**: `{ message: string, codeSuggestion?: string, querySuggestion?: string }`
- **Characteristics**: Stateless, always returns HTTP 200, Dogalog-specific prompts
- **Implementation**:
  - Response parser: `src/utils/DogalogResponseParser.js` - extracts Prolog code/query suggestions
  - Context builder: `src/mcp/lib/PrologContextBuilder.js` - builds domain-aware prompts
  - Templates: `prompts/templates/mcp/dogalog-with-code.md`, `dogalog-no-code.md`
- **Testing**:
  - Unit tests: `tests/unit/utils/DogalogResponseParser.test.js`, `tests/unit/mcp/PrologContextBuilder.test.js`
  - Integration test: `tests/integration/dogalog/dogalog-chat-e2e.integration.test.js`
- **Documentation**: See `docs/DOGALOG-ENDPOINT-PLAN.md` for full implementation details

---
## Error Handling
- Fallbacks are not to be used. Informative errors should be thrown so the underlying problem can be fixed. No masking!

## Logging Guidelines
- **NEVER use console.log, console.error, or any console.* methods** - these pollute the STDIO stream and break MCP protocol communication
- Always use the unified logger: `import { createUnifiedLogger } from './utils/LoggingConfig.js'` then `const logger = createUnifiedLogger('ComponentName');`
- Use appropriate log levels: `logger.debug()`, `logger.info()`, `logger.warn()`, `logger.error()`
- The logging system automatically handles STDIO-aware output and prevents protocol pollution

## Testing Guidelines
- Use Vitest for all tests with ES modules
- Integration tests should work against live services and real data (no mocking except when absolutely necessary)
- E2E tests follow pattern: `tests/integration/{component}/{component}-e2e.integration.test.js`
- VSOM e2e tests: `tests/integration/vsom/` with comprehensive coverage of API proxy, ZPT navigation, and MCP integration
- MCP tests: `tests/integration/mcp/` covering all 13 core verbs
- Run integration tests with: `INTEGRATION_TESTS=true npx vitest run tests/integration/`
- Test environment uses real SPARQL endpoint and live LLM/embedding services

## Using MCP ERF Tools for Codebase Analysis

The ERF (Entity Relationship Framework) MCP tools provide powerful static analysis capabilities for understanding codebase structure and health:

**Available Tools:**
- `mcp__erf__erf_analyze` - Generate comprehensive codebase statistics (files, modules, functions, imports, exports)
- `mcp__erf__erf_health` - Get overall health score (0-100) with connectivity, structure, and quality metrics
- `mcp__erf__erf_dead_code` - Find unreachable files and unused exports
- `mcp__erf__erf_isolated` - Identify code subgraphs with no connection to entry points
- `mcp__erf__erf_hubs` - Find hub files (core infrastructure that many files depend on)
- `mcp__erf__erf_functions` - Analyze function/method distribution and complexity

**When to Use ERF Tools:**
- **Before major refactoring** - Use `erf_health` to get baseline metrics, `erf_hubs` to identify critical files needing extra testing
- **During code cleanup** - Use `erf_dead_code` and `erf_isolated` to find candidates for removal
- **After architecture changes** - Use `erf_analyze` to verify import/export structure, check connectivity
- **Identifying technical debt** - Use `erf_health` to track missing imports, isolated files over time
- **Understanding unfamiliar codebases** - Use `erf_hubs` to find the most important files to study first

**Example Results from Semem:**
- Health Score: 63/100 (Good) - 567/589 files connected, 22 isolated, 53 missing imports
- Top Hubs: Config.js (125 dependents), SPARQLHelper.js (77 dependents), Utils.js (50 dependents)
- Dead Code: 0 dead files, 302 unused exports, 100% reachability
- Functions: 5833 functions across 589 files (avg 9.9 per file)

These tools are **faster and more accurate than text search** for architectural questions, and complement Gemini CLI which is better for semantic code understanding.

# Using Gemini CLI for Large Codebase Analysis

  When analyzing large codebases or multiple files that might exceed context limits, use the Gemini CLI with its massive
  context window. Use `gemini -p` to leverage Google Gemini's large context capacity.


  ## File and Directory Inclusion Syntax

  Use the `@` syntax to include files and directories in your Gemini prompts. The paths should be relative to WHERE you run the
   gemini command:

  ### Examples:

  **Single file analysis:**
  ```bash
  gemini -p "@src/main.py Explain this file's purpose and structure"

  Multiple files:
  gemini -p "@package.json @src/index.js Analyze the dependencies used in the code"

  Entire directory:
  gemini -p "@src/ Summarize the architecture of this codebase"

  Multiple directories:
  gemini -p "@src/ @tests/ Analyze test coverage for the source code"

  Current directory and subdirectories:
  gemini -p "@./ Give me an overview of this entire project"
  
#
 Or use --all_files flag:
  gemini --all_files -p "Analyze the project structure and dependencies"

  Implementation Verification Examples

  Check if a feature is implemented:
  gemini -p "@src/ @lib/ Has dark mode been implemented in this codebase? Show me the relevant files and functions"

  Verify authentication implementation:
  gemini -p "@src/ @middleware/ Is JWT authentication implemented? List all auth-related endpoints and middleware"

  Check for specific patterns:
  gemini -p "@src/ Are there any React hooks that handle WebSocket connections? List them with file paths"

  Verify error handling:
  gemini -p "@src/ @api/ Is proper error handling implemented for all API endpoints? Show examples of try-catch blocks"

  Check for rate limiting:
  gemini -p "@backend/ @middleware/ Is rate limiting implemented for the API? Show the implementation details"

  Verify caching strategy:
  gemini -p "@src/ @lib/ @services/ Is Redis caching implemented? List all cache-related functions and their usage"

  Check for specific security measures:
  gemini -p "@src/ @api/ Are SQL injection protections implemented? Show how user inputs are sanitized"

  Verify test coverage for features:
  gemini -p "@src/payment/ @tests/ Is the payment processing module fully tested? List all test cases"

  When to Use Gemini CLI

  Use gemini -p when:
  - Analyzing entire codebases or large directories
  - Comparing multiple large files
  - Need to understand project-wide patterns or architecture
  - Current context window is insufficient for the task
  - Working with files totaling more than 100KB
  - Verifying if specific features, patterns, or security measures are implemented
  - Checking for the presence of certain coding patterns across the entire codebase

  Important Notes

  - Paths in @ syntax are relative to your current working directory when invoking gemini
  - The CLI will include file contents directly in the context
  - No need for --yolo flag for read-only analysis
  - Gemini's context window can handle entire codebases that would overflow Claude's context
  - When checking implementations, be specific about what you're looking for to get accurate results

## Quick Reference

- use ./stop.sh and ./start.sh when testing the servers locally without docker
- sparql queries and llm prompts should not appear inline in the code. They should be placed in the sparql and prompts directories following the same patterns as existing files, with templating if appropriate
- default ports :
  - 4100: API server
  - 4101: MCP server
  - 4102: Workbench
  - 4103: VSOM standalone
- always work on live data, not simulations. Only use mock implementations in tests, and only there if absolutely appropriate.
- you can check Inspector with Playwright mcp
- no fallbacks. If it's not right, throw an error
- there are three sources of truth : .env for secrets (call dotenv.config() early in files), config/config.json (use Config.js) and config/preferences.js for all the numeric values
- no logging to console, use the proper logging system
- MCP system uses 12 core verbs, not the old complex tool hierarchy
- VSOM integration complete with comprehensive e2e test coverage
- All API calls from VSOM go through HTTP proxy to MCP server endpoints
- Content-Type header duplication bug fixed in VSOM proxy configuration

## Refactoring

* before deleting any code files they should first be moved to the archive dir and tests run. Only if the tests pass should the files be deleted.

## Check any potentially breaking changes with essential e2e tests 

First stop/start the servers with `stop.sh` and `start.sh`, then -

* export INTEGRATION_TESTS=true && npx vitest run tests/integration/mcp/tell-ask-e2e.integration.test.js --reporter=verbose 
* export INTEGRATION_TESTS=true && npx vitest run tests/integration/mcp/tell-ask-stdio-e2e.integration.test.js --reporter=verbose
- browser code is vanilla JS