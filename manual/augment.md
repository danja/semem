# Augment Operation Workflow

This document traces the complete workflow of an Augment operation from the Semem workbench UI through all system components to the final analysis and processing results.

## Overview

The Augment operation allows users to analyze and enhance stored content through various semantic analysis operations. It supports multiple operation types including concept extraction, attribute analysis, relationship discovery, lazy content processing, and document chunking. The system integrates with the Ragno knowledge graph framework for advanced semantic processing.

## Augment Operation Types

### 1. **Auto** (Default)
- Automatic augmentation combining concept extraction and embedding generation
- Uses ZPT context for enhanced analysis
- General-purpose analysis suitable for most content

### 2. **Extract Concepts**
- Pure concept extraction from target content
- Uses LLM-based analysis to identify key concepts
- Returns structured concept data

### 3. **Analyze Attributes**
- Advanced attribute analysis using Ragno framework
- Augments entities with properties and characteristics
- Falls back to concept extraction if Ragno unavailable

### 4. **Find Relationships**
- Discovers relationships using ZPT navigation context
- Leverages current zoom/pan/tilt state for relationship discovery
- Returns relationship graph data

### 5. **Process Lazy Content**
- Processes previously stored lazy content
- Generates embeddings and extracts concepts for unprocessed items
- Batch processing capability for multiple items

### 6. **Chunk Documents**
- Automatically chunks large documents stored in SPARQL
- Creates semantic units from text elements
- Integrates with Ragno for proper RDF representation

## Complete Workflow

### 1. Workbench UI Layer

**File**: `src/frontend/workbench/public/index.html` (lines 251-275)

The user interacts with the Augment form which includes:
- Target content textarea for analysis input
- Operation selection dropdown (Auto/Extract Concepts/etc.)
- Dynamic form behavior based on operation type

**Form Structure**:
```html
<form class="verb-form" id="augment-form">
  <textarea id="augment-target" name="target" 
    placeholder="Enter text to analyze (or leave empty for 'Process Lazy Content')...">
  </textarea>
  <select id="augment-operation" name="operation">
    <option value="auto" selected>Auto</option>
    <option value="concepts">Extract Concepts</option>
    <option value="attributes">Analyze Attributes</option>
    <option value="relationships">Find Relationships</option>
    <option value="process_lazy">Process Lazy Content</option>
    <option value="chunk_documents">Chunk Documents</option>
  </select>
</form>
```

### 2. JavaScript Event Handling

**File**: `src/frontend/workbench/public/js/workbench.js` (lines 698-750)

When the form is submitted, the `handleAugmentSubmit` method:
1. Prevents default form submission and extracts form data
2. Handles special operations (process_lazy, chunk_documents) differently
3. Validates target content for operations that require it
4. Shows loading state and logs operation start
5. Calls the ApiService with appropriate parameters

**Code Flow**:
```javascript
async handleAugmentSubmit(event) {
  const formData = DomUtils.getFormData(form);
  const isProcessLazy = formData.operation === 'process_lazy';
  const isChunkDocuments = formData.operation === 'chunk_documents';
  const target = isProcessLazy ? 'all' : (isChunkDocuments ? (formData.target || 'all') : formData.target);
  
  // Build options based on operation type
  let options = {};
  if (isProcessLazy) {
    options = { limit: 10 };
  } else if (isChunkDocuments) {
    options = { maxChunkSize: 2000, minChunkSize: 100, overlapSize: 100 };
  }
  
  const result = await apiService.augment({
    target, operation: formData.operation, options
  });
}
```

### 3. API Service Layer

**File**: `src/frontend/workbench/public/js/services/ApiService.js` (lines 123-128)

The ApiService forwards the request to the MCP HTTP server:

```javascript
async augment({ target, operation = 'auto', options = {} }) {
  return this.makeRequest('/augment', {
    method: 'POST',
    body: JSON.stringify({ target, operation, options })
  });
}
```

### 4. Workbench Server Proxy

**File**: `src/frontend/workbench/server.js`

The workbench server proxies `/api/*` requests to the MCP HTTP server:
- Workbench: `http://localhost:8086/api/augment`
- MCP Server: `http://localhost:4115/augment`

### 5. MCP HTTP Server

**File**: `mcp/http-server.js` (lines 311-330)

The HTTP server extracts parameters and forwards to the Simple Verbs Service:

```javascript
app.post('/augment', async (req, res) => {
  const { target, operation = 'auto', options = {} } = req.body;
  
  // Allow empty target for certain operations
  const allowEmptyTarget = ['process_lazy', 'chunk_documents'].includes(operation);
  if (!target && !allowEmptyTarget) {
    return res.status(400).json({ error: 'Target content is required' });
  }
  
  const result = await simpleVerbsService.augment({ 
    target: target || 'all', operation, options 
  });
  res.json(result);
});
```

### 6. Simple Verbs Service - Main Processing

**File**: `mcp/tools/simple-verbs.js` (lines 750-1120)

The main Augment logic with branching based on operation type:

#### Step 1: Initialization and Validation
```javascript
async augment({ target, operation = 'auto', options = {} }) {
  await this.initialize();
  
  // Validate target for operations that require specific content
  const requiresSpecificTarget = ['concepts', 'attributes', 'relationships'].includes(operation);
  if (requiresSpecificTarget && (!target || target === 'all')) {
    throw new Error(`Operation '${operation}' requires specific target content, not 'all'`);
  }
}
```

#### Step 2: Operation Processing by Type

**Concepts Operation**:
```javascript
case 'concepts':
  result = await this.safeOps.extractConcepts(target);
  break;
```

**Attributes Operation**:
```javascript
case 'attributes':
  try {
    const { augmentWithAttributes } = await import('../../src/ragno/augmentWithAttributes.js');
    result = await augmentWithAttributes([{ content: target }], this.memoryManager.llmHandler, options);
  } catch (importError) {
    // Fallback to concept extraction if Ragno is not available
    result = await this.safeOps.extractConcepts(target);
  }
  break;
```

**Relationships Operation**:
```javascript
case 'relationships':
  const navParams = this.stateManager.getNavigationParams(target);
  const navResult = await this.zptService.navigate(navParams);
  
  if (navResult.success) {
    result = {
      relationships: navResult.content?.data || [],
      context: navParams
    };
  } else {
    result = { relationships: [], error: 'No relationships found' };
  }
  break;
```

**Process Lazy Content Operation**:
```javascript
case 'process_lazy':
  if (target === 'all' || target === '') {
    // Find and process all lazy content
    const lazyItems = await this.memoryManager.store.findLazyContent(options.limit || 10);
    const processedItems = [];
    
    for (const item of lazyItems) {
      const embedding = await this.safeOps.generateEmbedding(item.content);
      const concepts = await this.safeOps.extractConcepts(item.content);
      
      await this.memoryManager.store.updateLazyToProcessed(item.id, embedding, concepts);
      processedItems.push({
        id: item.id, type: item.type,
        conceptCount: concepts.length,
        embeddingDimension: embedding.length
      });
    }
    
    result = {
      processedItems, totalProcessed: processedItems.length,
      totalFound: lazyItems.length, augmentationType: 'process_lazy'
    };
  }
  break;
```

**Chunk Documents Operation**:
```javascript
case 'chunk_documents':
  // Import chunking dependencies
  const Chunker = (await import('../../src/services/document/Chunker.js')).default;
  const { SPARQLQueryService } = await import('../../src/services/sparql/index.js');
  
  const chunker = new Chunker({
    maxChunkSize: options.maxChunkSize || 2000,
    minChunkSize: options.minChunkSize || 100,
    overlapSize: options.overlapSize || 100,
    strategy: options.strategy || 'semantic'
  });
  
  // Find unprocessed text elements in SPARQL
  let textElementsToProcess = [];
  if (target === 'all' || target === '') {
    const query = await queryService.getQuery('find-unprocessed-text-elements', {
      graphURI: targetGraph, limit: 1000000,
      minContentLength: options.minContentLength || 2000
    });
    // Execute SPARQL query to find elements
    textElementsToProcess = await this.executeQuery(query);
  }
  
  // Process each document
  for (const element of textElementsToProcess) {
    const chunkingResult = await chunker.chunk(element.content.value, {
      title: `TextElement ${element.textElement.value.split('/').pop()}`,
      sourceUri: element.textElement.value
    });
    
    // Store chunks as RDF triples
    await this.storeChunksAsRDF(chunkingResult, element);
  }
  break;
```

**Auto Operation** (Default):
```javascript
case 'auto':
default:
  const concepts = await this.safeOps.extractConcepts(target);
  const embedding = await this.safeOps.generateEmbedding(target);
  
  result = {
    concepts,
    embedding: {
      dimension: embedding.length,
      preview: embedding.slice(0, 5).map(x => parseFloat(x.toFixed(4)))
    },
    augmentationType: 'auto'
  };
  break;
```

### 7. Safe Operations Layer

**File**: `mcp/lib/safe-operations.js`

Handles the core operations with error handling:

#### Concept Extraction
```javascript
async extractConcepts(text) {
  return await this.llmHandler.extractConcepts(text);
}
```

#### Embedding Generation
```javascript
async generateEmbedding(text) {
  return await this.embeddingProvider.generateEmbedding(text);
}
```

### 8. Ragno Integration Layer

**File**: `src/ragno/augmentWithAttributes.js`

Advanced semantic processing using knowledge graph techniques:

```javascript
async function augmentWithAttributes(entities, llmHandler, options = {}) {
  const enhancedEntities = [];
  
  for (const entity of entities) {
    // Use LLM to identify attributes and properties
    const attributeAnalysis = await llmHandler.generateResponse(
      `Analyze the following content and identify key attributes, properties, and characteristics: ${entity.content}`,
      '', { maxTokens: 500 }
    );
    
    // Parse and structure the attributes
    const attributes = parseAttributeAnalysis(attributeAnalysis);
    
    enhancedEntities.push({
      ...entity,
      attributes,
      augmentationType: 'ragno_attributes'
    });
  }
  
  return enhancedEntities;
}
```

### 9. ZPT Navigation Integration

**File**: `src/services/navigation/ZPTService.js`

For relationship discovery operations:

```javascript
async navigate(params) {
  const { zoom, pan, tilt, query } = params;
  
  // Execute ZPT-guided navigation to find relationships
  const navigationResult = await this.executeNavigation({
    zoomLevel: zoom,
    panFilters: pan,
    tiltProjection: tilt,
    targetQuery: query
  });
  
  return {
    success: navigationResult.success,
    content: { data: navigationResult.relationships },
    context: params
  };
}
```

### 10. Document Chunking Process

**File**: `src/services/document/Chunker.js`

For chunk_documents operations:

```javascript
async chunk(content, options = {}) {
  const chunks = [];
  const sentences = this.splitIntoSentences(content);
  let currentChunk = '';
  
  for (const sentence of sentences) {
    if ((currentChunk + sentence).length > this.options.maxChunkSize && currentChunk.length > 0) {
      chunks.push({
        content: currentChunk.trim(),
        size: currentChunk.length,
        index: chunks.length,
        uri: this.generateChunkURI(options.sourceUri, chunks.length)
      });
      
      // Apply overlap
      currentChunk = this.getOverlap(currentChunk, this.options.overlapSize) + sentence;
    } else {
      currentChunk += sentence;
    }
  }
  
  // Add final chunk
  if (currentChunk.trim().length > 0) {
    chunks.push({
      content: currentChunk.trim(),
      size: currentChunk.length,
      index: chunks.length,
      uri: this.generateChunkURI(options.sourceUri, chunks.length)
    });
  }
  
  return {
    chunks,
    metadata: {
      totalChunks: chunks.length,
      averageChunkSize: chunks.reduce((sum, c) => sum + c.size, 0) / chunks.length,
      strategy: this.options.strategy,
      sourceUri: options.sourceUri
    }
  };
}
```

## Response Flow Paths

### Path A: Simple Analysis Operations (concepts, auto)
```
UI → API → MCP → SimpleVerbs → SafeOps → [LLM/Embedding] → Response
```
- Fast processing for basic concept extraction
- Direct LLM and embedding provider interaction
- Suitable for quick analysis tasks

### Path B: Advanced Ragno Operations (attributes)
```
UI → API → MCP → SimpleVerbs → RagnoServices → LLMHandler → Enhanced Response
```
- Advanced semantic analysis using Ragno framework
- Knowledge graph integration for entity enhancement
- Fallback to simple concept extraction if unavailable

### Path C: ZPT-Guided Operations (relationships)
```
UI → API → MCP → SimpleVerbs → ZPTService → NavigationEngine → Relationship Graph
```
- Uses current ZPT state for context-aware relationship discovery
- Integrates zoom/pan/tilt parameters for focused analysis
- Returns structured relationship data

### Path D: Batch Processing Operations (process_lazy)
```
UI → API → MCP → SimpleVerbs → SPARQLStore → [Batch Processing] → Processed Items
```
- Bulk processing of previously stored lazy content
- Generates missing embeddings and concepts
- Updates storage backend with processed data

### Path E: Document Processing Operations (chunk_documents)
```
UI → API → MCP → SimpleVerbs → SPARQLQuery → Chunker → RDFStorage → Chunked Results
```
- Finds unprocessed documents in SPARQL store
- Applies semantic chunking strategies
- Stores results as RDF triples in knowledge graph

## Response Structure

Response structures vary by operation type:

### Auto/Concepts Response:
```json
{
  "success": true,
  "verb": "augment",
  "operation": "auto",
  "target": "Machine learning is a subset of artificial intelligence...",
  "concepts": ["machine learning", "artificial intelligence", "algorithms", "data analysis"],
  "embedding": {
    "dimension": 1536,
    "preview": [0.1234, -0.5678, 0.9012, -0.3456, 0.7890]
  },
  "augmentationType": "auto",
  "processingTime": 1250,
  "zptState": { "zoom": "entity", "pan": {}, "tilt": "keywords" }
}
```

### Process Lazy Response:
```json
{
  "success": true,
  "verb": "augment",
  "operation": "process_lazy",
  "processedItems": [
    {
      "id": "semem:1703123456_abc123",
      "type": "concept",
      "conceptCount": 5,
      "embeddingDimension": 1536
    }
  ],
  "totalProcessed": 1,
  "totalFound": 3,
  "augmentationType": "process_lazy"
}
```

### Chunk Documents Response:
```json
{
  "success": true,
  "verb": "augment",
  "operation": "chunk_documents",
  "chunkedDocuments": [
    {
      "documentUri": "http://example.org/document1",
      "chunksCreated": 8,
      "totalCharacters": 15420,
      "averageChunkSize": 1927,
      "processingTime": 3200
    }
  ],
  "totalDocumentsProcessed": 1,
  "augmentationType": "chunk_documents"
}
```

### Attributes Response:
```json
{
  "success": true,
  "verb": "augment",
  "operation": "attributes",
  "entities": [
    {
      "content": "Neural networks consist of interconnected nodes...",
      "attributes": [
        { "type": "component", "value": "nodes", "confidence": 0.95 },
        { "type": "property", "value": "interconnected", "confidence": 0.90 },
        { "type": "category", "value": "machine learning", "confidence": 0.85 }
      ],
      "augmentationType": "ragno_attributes"
    }
  ]
}
```

## Configuration Dependencies

The Augment operation requires:
1. **MCP HTTP Server**: Running on port 4115
2. **Workbench Server**: Running on port 8086, proxying to MCP
3. **LLM Provider**: For concept extraction and attribute analysis
4. **Embedding Provider**: For vector generation (auto operation)
5. **SPARQL Store**: For lazy processing and document chunking
6. **Ragno Framework**: For advanced attribute analysis (optional)
7. **ZPT Navigation Service**: For relationship discovery

## Operation-Specific Requirements

### Process Lazy Content
- Requires SPARQL store with lazy content
- `findLazyContent()` and `updateLazyToProcessed()` methods
- Configurable batch size via options.limit

### Chunk Documents  
- Requires SPARQL store with unprocessed text elements
- SPARQLQueryService with 'find-unprocessed-text-elements' query
- Chunker service with configurable strategies
- RDF storage for chunk results

### Analyze Attributes
- Optional Ragno framework integration
- Falls back to concept extraction if Ragno unavailable
- LLM handler for attribute analysis

### Find Relationships
- ZPT navigation service
- Current zoom/pan/tilt state
- Navigation parameter generation

## Debugging Tips

### Test Basic Concept Extraction
```bash
curl -X POST -H "Content-Type: application/json" \
  -d '{"target": "Machine learning uses algorithms to learn patterns", "operation": "concepts"}' \
  http://localhost:4115/augment
```

### Test Auto Operation
```bash
curl -X POST -H "Content-Type: application/json" \
  -d '{"target": "Neural networks process information through layers", "operation": "auto"}' \
  http://localhost:4115/augment
```

### Test Lazy Content Processing
```bash
curl -X POST -H "Content-Type: application/json" \
  -d '{"target": "all", "operation": "process_lazy", "options": {"limit": 5}}' \
  http://localhost:4115/augment
```

### Test Document Chunking
```bash
curl -X POST -H "Content-Type: application/json" \
  -d '{"target": "all", "operation": "chunk_documents", "options": {"maxChunkSize": 1500}}' \
  http://localhost:4115/augment
```

### Check Unprocessed Documents
```bash
curl -u admin:admin -H "Content-Type: application/sparql-query" \
  -d "SELECT (COUNT(*) as ?count) WHERE { ?element a <http://purl.org/stuff/ragno/TextElement> }" \
  http://localhost:3030/semem/query
```

## Error Handling and Edge Cases

### Target Validation
- Operations requiring specific content (concepts, attributes, relationships) validate target presence
- Process lazy and chunk documents allow empty targets (default to 'all')
- Clear error messages for invalid target/operation combinations

### Service Availability
- Ragno framework import failures fall back to basic concept extraction
- ZPT navigation failures return empty relationships with error messages
- SPARQL query failures handled gracefully with informative errors

### Batch Processing Limits
- Lazy processing respects configurable limits to prevent resource exhaustion
- Document chunking includes safety limits for query result sizes
- Individual item failures don't halt entire batch operations

### Memory Management
- Large document processing streams results to prevent memory issues
- Chunking strategies respect size limits and overlap configurations
- Embedding generation batched for efficiency

## Performance Considerations

### Operation Complexity
- **Concepts**: Fast, single LLM call
- **Auto**: Medium, LLM + embedding generation  
- **Attributes**: Slow, advanced LLM analysis with Ragno
- **Relationships**: Variable, depends on ZPT complexity
- **Process Lazy**: Linear with batch size
- **Chunk Documents**: Linear with document count and size

### Optimization Strategies
- Batch processing for lazy content reduces overhead
- Parallel chunking where possible
- Caching of frequently accessed SPARQL queries
- Embedding generation optimization for large batches

### Resource Usage
- Concept extraction: Low CPU, moderate memory
- Attribute analysis: High CPU, high memory (LLM intensive)
- Document chunking: Moderate CPU, low memory (streaming)
- Relationship discovery: Variable based on ZPT complexity

## Integration Points

### ZPT Navigation System
- Current zoom/pan/tilt state influences analysis scope
- Relationship operations leverage navigation context
- Results tagged with current ZPT parameters

### Ragno Knowledge Graph
- Advanced attribute analysis integration
- Proper RDF modeling for enhanced entities
- Fallback mechanisms for framework availability

### Session Management
- Operations respect current session state
- Results cached appropriately for immediate reuse
- Session context preserved across batch operations

### Enhancement Services
- Augmented content available for Ask operations
- Processed lazy content becomes searchable
- Chunked documents discoverable through semantic search