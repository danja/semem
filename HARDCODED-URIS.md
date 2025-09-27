# Hardcoded URIs in Semem Codebase

This document catalogs all hardcoded URIs found in JavaScript files that should be moved to `config.json` for proper configuration management. There should be no inline fallbacks as this leads to indeterminate code. If the value is not successfully retrieved from config then that is an error that needs fixing.

## Summary

- **Total files with hardcoded URIs**: 79+ in src/, 50+ in mcp/
- **Main categories**: Ontology namespaces, graph URIs, fallback endpoints, default instances
- **Priority**: Critical URIs are those used as fallbacks or defaults in core functionality

## Critical Hardcoded URIs (Fallbacks & Defaults)

### Core Storage & Graph URIs

#### Store.js (`src/stores/modules/Store.js`)
```javascript
// Line 340: Default interaction URI fallback
const entityUri = data.id.startsWith('http') ? `<${data.id}>` : `<http://purl.org/stuff/semem/interaction/${data.id}>`;

// Line 617: Concept URI generation
return `http://purl.org/stuff/ragno/concept/${sanitized}`;
```

#### Config.js (`src/Config.js`)
```javascript
// Multiple fallback graph URIs used when config is missing
```

#### Document Chunker (`src/services/document/Chunker.js`)
```javascript
// Line 18: Default base namespace
baseNamespace: options.baseNamespace || 'http://example.org/semem/',

// Line 391: Fallback namespace
baseNamespace: 'http://example.org/semem/'
```

### MCP Server Defaults

#### SimpleVerbsService.js (`mcp/tools/SimpleVerbsService.js`)
```javascript
// Line 698-699: Concept and embedding URI generation
const conceptUri = URIMinter.mintURI('http://purl.org/stuff/instance/', 'concept', concept);
const embeddingUri = URIMinter.mintURI('http://purl.org/stuff/instance/', 'embedding', concept);

// Line 900: Base namespace fallback
baseNamespace: 'http://purl.org/stuff/instance/'

// Line 963: Synthetic URI generation
const syntheticURI = `http://purl.org/stuff/instance/text-element-${contentHash}`;
```

#### ZPT Tools (`mcp/tools/zpt-tools.js`)
```javascript
// Line 103: Navigation graph default
navigationGraph: 'http://purl.org/stuff/navigation'

// Line 163: Agent URI default
agentURI: 'http://example.org/agents/mcp_zpt_navigator',

// Line 406-442: Various entity URI patterns
id: `http://purl.org/stuff/ragno/entity/${safeQuery.toLowerCase().replace(/\s+/g, '-')}`
id: `http://purl.org/stuff/ragno/community/${safeQuery.toLowerCase().replace(/\s+/g, '-')}`
id: `http://purl.org/stuff/ragno/unit/${safeQuery.toLowerCase().replace(/\s+/g, '-')}`
```

#### Document Tools (`mcp/tools/document-tools.js`)
```javascript
// Line 292: Default graph URI
'http://purl.org/stuff/semem/documents';

// Line 295-296: URI minting
const unitURI = URIMinter.mintURI('http://purl.org/stuff/instance/', 'unit', filename);
const textURI = URIMinter.mintURI('http://purl.org/stuff/instance/', 'text', content);

// Line 505: Fallback graph
graph = 'http://hyperdata.it/content'
```

### Server & API Defaults

#### Workbench Server (`src/frontend/workbench/server.js`)
```javascript
// Line 23: MCP server URL fallback
const MCP_SERVER_URL = process.env.MCP_SERVER || `http://localhost:${MCP_PORT}`;

// Line 49: Logs proxy target
target: 'http://localhost:4100/api/logs/stream',
```

#### VSOM Standalone (`src/frontend/vsom-standalone/server.js`)
```javascript
// Line 120-121: API server URL fallbacks
const apiServerUrl = process.env.API_HTTP_URL || `http://localhost:${apiPort}/api`;
const mcpServerUrl = process.env.MCP_HTTP_URL || `http://localhost:${mcpPort}`;
```

## Ontology Namespace URIs (Systematic Usage)

### RDF/OWL Standard Namespaces
Used throughout the codebase in SPARQL queries:
- `http://www.w3.org/1999/02/22-rdf-syntax-ns#` (rdf:)
- `http://www.w3.org/2000/01/rdf-schema#` (rdfs:)
- `http://www.w3.org/2001/XMLSchema#` (xsd:)
- `http://www.w3.org/2004/02/skos/core#` (skos:)
- `http://purl.org/dc/terms/` (dcterms:)
- `http://www.w3.org/ns/prov#` (prov:)

### Semem Project Namespaces
Used extensively across all modules:
- `http://purl.org/stuff/semem/` (semem:)
- `http://purl.org/stuff/ragno/` (ragno:)
- `http://purl.org/stuff/zpt/` (zpt:)
- `http://purl.org/stuff/instance/` (instance URIs)

### Project-Specific Graph URIs
- `http://hyperdata.it/content` (main content graph)
- `http://tensegrity.it/semem` (session graph)
- `http://purl.org/stuff/navigation` (navigation graph)
- `http://example.org/semem/` (examples/testing)

## Files with Hardcoded URIs (Complete List)

### src/ Directory (79 files)
```
src/stores/modules/Store.js ⭐ CRITICAL
src/stores/modules/Graph.js
src/stores/modules/Search.js
src/stores/modules/SPARQLExecute.js
src/services/memory/MemoryDomainManager.js
src/services/document/Chunker.js ⭐ CRITICAL
src/services/document/Ingester.js
src/services/sparql/SPARQLHelper.js
src/services/search/SearchService.js
src/servers/api-server.js
src/frontend/workbench/server.js ⭐ CRITICAL
src/frontend/vsom-standalone/server.js ⭐ CRITICAL
src/Config.js ⭐ CRITICAL
src/ragno/Entity.js
src/ragno/SemanticUnit.js
src/ragno/core/RDFGraphManager.js
src/ragno/core/NamespaceManager.js
src/ragno/algorithms/Hyde.js
src/ragno/algorithms/VSOM.js
src/ragno/algorithms/PersonalizedPageRank.js
src/ragno/algorithms/GraphAnalytics.js
src/ragno/algorithms/CommunityDetection.js
src/zpt/ontology/ZPTNamespaces.js
src/zpt/ontology/ZPTQueries.js
src/zpt/ontology/ZPTDataFactory.js
src/zpt/session/ZPTSessionManager.js
src/migration/DataMigration.js
src/migration/directMigration.js
src/migration/runMigration.js
... (50+ additional files)
```

### mcp/ Directory (50+ files)
```
mcp/tools/SimpleVerbsService.js ⭐ CRITICAL
mcp/tools/zpt-tools.js ⭐ CRITICAL
mcp/tools/document-tools.js ⭐ CRITICAL
mcp/tools/ragno-tools.js
mcp/tools/sparql-tools.js
mcp/index.js ⭐ CRITICAL
mcp/http-server.js
mcp/answer/Answer.js
mcp/answer/AnswerHTTP.js
mcp/prompts/registry.js
mcp/lib/workflow-orchestrator.js
... (40+ additional files)
```

## Configuration Solutions

### Recommended config.json Additions

```json
{
  "namespaces": {
    "semem": "http://purl.org/stuff/semem/",
    "ragno": "http://purl.org/stuff/ragno/",
    "zpt": "http://purl.org/stuff/zpt/",
    "instance": "http://purl.org/stuff/instance/",
    "rdf": "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
    "rdfs": "http://www.w3.org/2000/01/rdf-schema#",
    "xsd": "http://www.w3.org/2001/XMLSchema#",
    "skos": "http://www.w3.org/2004/02/skos/core#",
    "dcterms": "http://purl.org/dc/terms/",
    "prov": "http://www.w3.org/ns/prov#"
  },
  "graphs": {
    "content": "http://hyperdata.it/content",
    "session": "http://tensegrity.it/semem",
    "navigation": "http://purl.org/stuff/navigation",
    "documents": "http://purl.org/stuff/semem/documents",
    "examples": "http://example.org/semem/"
  },
  "defaults": {
    "baseNamespace": "http://purl.org/stuff/instance/",
    "agentURI": "http://example.org/agents/semem",
    "mcpServerUrl": "http://localhost:4101",
    "apiServerUrl": "http://localhost:4100"
  }
}
```

### High Priority Fixes

1. **Store.js**: URI generation for interactions and concepts
2. **SimpleVerbsService.js**: Instance URI minting
3. **Chunker.js**: Base namespace fallbacks
4. **ZPT Tools**: Navigation and agent URIs
5. **Server configs**: API endpoint fallbacks

### Impact Assessment

- **Breaking changes**: Moving these to config will require updating all consuming code
- **Fallback safety**: Must NOT!!! ensure graceful degradation when config is missing
- **Testing**: All examples and tests use hardcoded URIs that need updating

## Next Steps

1. Add namespace and graph configuration to config.json
2. Create utility functions to access configured URIs withOUT fallbacks
3. Systematically replace hardcoded URIs with config lookups
4. Update all examples and tests
5. Add validation for required URI configurations

---

**Note**: ⭐ CRITICAL files contain fallback URIs that directly impact system functionality when configuration is missing. THIS IS INTENTIONAL