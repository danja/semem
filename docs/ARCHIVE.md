# Archive Log

This document tracks files and modules that have been archived from the active codebase.

## 2025-01-10: Major Architecture Transition Cleanup

### Rationale
Based on ERF (Entity Relationship Framework) codebase analysis showing 100 dead/isolated files, we archived legacy code from two major architectural transitions:

1. **Old API System → MCP (Model Context Protocol)**
   The original HTTP/WebSocket API system was replaced by the MCP verb-based system

2. **Multiple Storage Backends → SPARQL Only**
   Per CLAUDE.md: "The memory and json storage backends are being phased out, sparql storage should be used throughout"

3. **Experimental Workflows**
   Early research/prototype code that is no longer actively maintained

### Health Metrics Before Archiving
- Overall Health Score: 60/100
- Dead Files: 100
- Isolated Files: 100
- Connected Files: 376/398 (94%)
- Unused Exports: 227

### Archived Components

#### 1. Old API System (`archive/2025-01-old-api-system/`)

**HTTP Server Infrastructure:**
- `HTTPServer.js` - Original HTTP server (replaced by MCP)
- `HTTPServer-older.js` - Even older version
- `WebSocketServer.js` - WebSocket implementation
- `MessageQueue.js` - Message queue system
- `openapi-schema.js` - OpenAPI schema definitions

**Processors (Pattern replaced by MCP verbs):**
- `ActiveHandlerProcessor.js`
- `PassiveHandlerProcessor.js`
- `SelfieHandlerProcessor.js`
- `ChatAPIProcessor.js`
- `MemoryAPIProcessor.js`
- `SearchAPIProcessor.js`
- `Processor.js` - Base processor class

**Feature Handlers (Replaced by MCP tools):**
- `ActiveHandler.js`
- `PassiveHandler.js`
- `SelfieHandler.js`
- `ChatAPI.js`
- `MemoryAPI.js`
- `SearchAPI.js`
- `DocumentAPI.js`
- `RagnoAPI.js`
- `UnifiedSearchAPI.js`
- `VSOMAPI.js`
- `WikidataAPI.js`
- `WikipediaAPI.js`
- `ZptAPI.js`

**Supporting Files:**
- `APILogger.js` - Old logging system
- `MetricsCollector.js` - Metrics collection
- `CLIHandler.js` - CLI interface (replaced)
- `REPLHandler.js` - REPL interface (replaced)
- `SememClient.js` - Old HTTP client

**Why Archived:**
The entire API system was replaced by the MCP (Model Context Protocol) verb-based architecture. The new system uses 12 core verbs (tell, ask, augment, inspect, state, zoom, pan, tilt, remember, recall, chat, chat-enhanced) instead of the old HTTP/REST API endpoints. This is a cleaner, more focused architecture for agent memory operations.

**Current Replacement:**
- MCP Server: `src/mcp/http-server.js`
- MCP STDIO: `src/mcp/index.js`
- Verb Commands: `src/mcp/tools/verbs/commands/`
- Simple Verbs: `src/mcp/tools/simple-verbs.js`

#### 2. Old Storage Backends (`archive/2025-01-old-storage-backends/`)

**Deprecated Store Implementations:**
- `InMemoryStore.js` - Transient in-memory storage
- `JSONStore.js` - JSON file-based persistence
- `MemoryStore.js` - In-process memory management
- `RagnoMemoryStore.js` - Ragno-specific memory store

**Why Archived:**
Per project documentation (CLAUDE.md): "The memory and json storage backends are being phased out, sparql storage should be used throughout". The codebase has standardized on SPARQLStore for all persistence operations, providing RDF-based storage with semantic query capabilities.

**Current Replacement:**
- `src/stores/SPARQLStore.js` - Primary storage backend
- `src/stores/CachedSPARQLStore.js` - Optimized with caching

#### 3. Experimental Workflows (`archive/2025-01-experimental-workflows/`)

**Workflow Prototypes:**
- `workflows/BaseWorkflow.js` - Base workflow class
- `workflows/BeerQAWorkflow.js` - Beer question-answering experiment
- `workflows/FeedbackWorkflow.js` - Feedback iteration workflow
- `workflows/WikidataWorkflow.js` - Wikidata integration workflow

**Feedback System:**
- `feedback/FollowUpGenerator.js`
- `feedback/IterationManager.js`
- `feedback/ResponseAnalyzer.js`

**SPARQL Templates:**
- `TemplateManager.js` - Template management
- `beerqa.js` - BeerQA template
- `feedback.js` - Feedback template

**Research/Auxiliary:**
- `ResearchService.js` - Research service prototype
- `WikidataNavigator.js` - Wikidata navigation
- `UnitsToCorpuscles.js` - Unit conversion utility

**Why Archived:**
These were experimental features and research prototypes that are not currently maintained or integrated into the active MCP verb system. They represent early explorations of workflow patterns and feedback loops that may inform future development but are not part of the current architecture.

### Files NOT Archived (False Positives in ERF Analysis)

The following files were flagged as isolated by ERF but are actually in active use:

**Frontend JavaScript (loaded via HTML `<script>` tags):**
- `src/frontend/workbench/public/js/*` - Workbench UI
- `src/frontend/vsom-standalone/public/js/*` - VSOM visualization

ERF doesn't detect HTML script tag imports, so these appear isolated but are entry points for the frontend applications.

**Utility Scripts:**
- `utils/Export.js`, `utils/Import.js` - Standalone utilities
- Test files in `docs/postcraft/` - Documentation/examples

### Verification and Corrections

**Initial archiving (2025-01-10 21:30):**
1. ERF analysis confirmed files were unreachable from entry points
2. Archived 47 files across 3 categories
3. ❌ Server startup failed - API server still depends on feature files

**Correction (2025-01-10 23:32):**
- **Restored**: All 13 API feature files from `archive/2025-01-old-api-system/features/` → `src/api/features/`
- **Reason**: API server (`src/servers/api-server.js`) actively imports these modules (MemoryAPI, ChatAPI, SearchAPI, etc.)
- **Kept archived**: HTTP server infrastructure, processors, supporting files (17 files remain archived)
- **Result**: ✅ All integration tests passing

**Actually archived (final count):**
- Old API infrastructure: 17 files (HTTP server files, processors, handlers, clients)
- Old storage backends: 4 files (InMemory, JSON, Memory, RagnoMemory stores)
- Experimental workflows: 13 files (workflows, feedback, templates, research)
- **Total**: 34 files archived, 13 feature files restored to active use

### Recovery

To restore any archived file:
```bash
# Example: restore a specific file
cp archive/2025-01-old-api-system/http-server/HTTPServer.js src/api/http/server/

# Example: restore entire category
cp -r archive/2025-01-old-storage-backends/* src/stores/
```

### Expected Impact

**Positive:**
- Reduced codebase complexity
- Clearer architecture (single API pattern, single storage backend)
- Fewer files to maintain and test
- Improved ERF health score (expected to increase from 60/100)

**Neutral:**
- Historical code still available in archive for reference
- No impact on active functionality

### Related Documentation

- ERF Analysis: Generated 2025-01-10 using `mcp__erf__erf_health` and related tools
- Architecture Notes: `CLAUDE.md` - "MCP system has been restructured around 12 core verbs"
- Storage Backend: `CLAUDE.md` - "memory and json storage backends are being phased out"

---

## Archive Guidelines

When archiving code:

1. **Create dated directory:** `archive/YYYY-MM-description/`
2. **Document rationale:** Update this file with why and what
3. **Verify no active use:** Check imports, run tests
4. **Keep in git:** Archived files remain in version control
5. **Reference in CLAUDE.md:** Update if architectural patterns change

## Restoration Process

If archived code is needed:
1. Copy from archive to original location
2. Update imports if file paths changed
3. Run tests to verify integration
4. Document restoration in this file
