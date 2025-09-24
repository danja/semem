# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Semem (Semantic Memory) is a Node.js library for intelligent agent memory management that integrates large language models (LLMs) with semantic web technologies (RDF/SPARQL). It provides a memory system for AI applications with multiple storage backends and LLM provider integrations.

It uses ES modules and Vitest for tests.

Only look at docs when requested. Always ignore all files under docs/ignore

## Architectural Notes

- The memory and json storage backends are being phased out, sparql storage should be used throughout

## Development Guidelines

When creating new code follow the patterns described in `docs/manual/infrastructure.md`

- scripts should be run from the server root

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

### VSOM UI Integration
- VSOM "Load Data" button in UI now functional (src/frontend/js/controllers/VSOMController.js:279-325)
- Supports JSON input formats:
  - Entities: `{"type":"entities","entities":[{"uri":"http://example.org/e1","content":"text","type":"concept"}]}`
  - SPARQL: `{"type":"sparql","endpoint":"http://localhost:3030/dataset/query","query":"SELECT * WHERE {?s ?p ?o} LIMIT 10"}`
  - Sample data: `{"type":"sample","count":50}` (generates test entities)
- Backend API endpoints: `/api/vsom/load-data` and `/api/vsom/generate-sample-data`

---
## Error Handling
- Fallbacks are not to be used. Informative errors should be thrown so the underlying problem can be fixed. No masking!

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
  - When checking implementations, be specific about what you're looking for to get accurate results # Using Gemini CLI for Large Codebase Analysis


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
  # Or use --all_files flag:
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
  
- use ./stop.sh and ./start.sh when testing the servers locally without docker
- sparql queries and llm prompts should not appear inline in the code. They should be placed in the sparql and prompts directories following the same patterns as existing files, with templating if appropriate
- default ports :\
  - 4100: API server
  - 4101: MCP server
  - 4102: Workbench
  - 4103: VSOM standalone
- always work on live data, not simulations. Only use mock implementations in tests, and only there if absolutely appropriate.
- you can check Inspector with Playwright mcp
- no fallbacks. If it's not right, throw an error
- there are three sources of truth : .env for secrets (call dotenv.config() early in files), config/config.json (use Config.js) and config/preferences.js for all the numeric values
- no logging to console, use the proper logging system