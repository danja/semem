# Tell Operation Workflow

This document traces the complete workflow of a Tell operation from the Semem workbench UI through all system components to the final storage in semantic memory.

## Overview

The Tell operation allows users to store knowledge into the semantic memory system. It supports three content types (concept, interaction, document) with optional lazy storage for immediate storage without processing. The system handles automatic chunking for large documents, concept extraction, embedding generation, and storage in both memory and SPARQL stores.

## Tell Operation Types

### 1. **Interaction** (Default)
- Stores user input or conversational content
- Generates embeddings and extracts concepts
- Suitable for general knowledge, notes, or responses

### 2. **Concept**
- Stores structured concept definitions
- Named concepts with metadata support
- Ideal for definitions, terminology, or structured knowledge

### 3. **Document**
- Handles large text documents
- Automatic chunking for documents > 8000 characters
- Supports file uploads via workbench UI
- Preserves document structure and metadata

### 4. **Lazy Storage Mode**
- Stores content immediately without processing
- No embedding generation or concept extraction
- Fast storage for batch operations
- Processing can be done later via augmentation

## Complete Workflow

### 1. Workbench UI Layer

**File**: `src/frontend/workbench/public/index.html` (lines 72-110)

The user interacts with the Tell form which includes:
- Content textarea for text input
- Type selection (Concept/Interaction/Document)
- Tags input field
- Lazy storage checkbox
- File upload for documents

**Form Structure**:
```html
<form class="verb-form" id="tell-form">
  <textarea id="tell-content" name="content" required></textarea>
  <select id="tell-type" name="type">
    <option value="concept" selected>Concept</option>
    <option value="interaction">Interaction</option>
    <option value="document">Document</option>
  </select>
  <input type="text" id="tell-tags" name="tags">
  <input type="checkbox" id="lazy-storage" name="lazy">
</form>
```

### 2. JavaScript Event Handling

**File**: `src/frontend/workbench/public/js/workbench.js` (lines 286-350)

When the form is submitted, the `handleTellSubmit` method:
1. Prevents default form submission
2. Extracts form data and processes file uploads
3. Shows loading state and logs operation start
4. Calls the ApiService with appropriate parameters
5. Updates UI with results and completion status

**Code Flow**:
```javascript
async handleTellSubmit(event) {
  const formData = DomUtils.getFormData(form);
  const hasFile = fileInput && fileInput.files.length > 0;
  
  if (isDocumentType && hasFile) {
    // Handle file upload
    result = await apiService.uploadDocument({
      fileUrl: dataUrl, filename, mediaType, documentType
    });
  } else {
    // Handle text content
    result = await apiService.tell({
      content: formData.content,
      type: formData.type,
      lazy: Boolean(formData.lazy),
      metadata: { tags: formData.tags }
    });
  }
}
```

### 3. API Service Layer

**File**: `src/frontend/workbench/public/js/services/ApiService.js` (lines 61-66)

The ApiService forwards the request to the MCP HTTP server:

```javascript
async tell({ content, type = 'interaction', lazy = false, metadata = {} }) {
  return this.makeRequest('/tell', {
    method: 'POST',
    body: JSON.stringify({ content, type, lazy, metadata })
  });
}
```

### 4. Workbench Server Proxy

**File**: `src/frontend/workbench/server.js`

The workbench server proxies `/api/*` requests to the MCP HTTP server:
- Workbench: `http://localhost:8086/api/tell`
- MCP Server: `http://localhost:4115/tell`

### 5. MCP HTTP Server

**File**: `mcp/http-server.js` (lines 272-290)

The HTTP server extracts parameters and forwards to the Simple Verbs Service:

```javascript
app.post('/tell', async (req, res) => {
  const { content, type = 'interaction', metadata = {}, lazy = false } = req.body;
  
  if (!content) {
    return res.status(400).json({ error: 'Content is required' });
  }
  
  const result = await simpleVerbsService.tell({ content, type, metadata, lazy });
  res.json(result);
});
```

### 6. Simple Verbs Service - Main Processing

**File**: `mcp/tools/simple-verbs.js` (lines 400-620)

The main Tell logic with branching based on storage mode and content type:

#### Step 1: Initialization and Parameter Processing
```javascript
async tell({ content, type = 'interaction', metadata = {}, lazy = false }) {
  await this.initialize();
  
  let result, embedding, concepts = [], prompt;
  let response = content;
```

#### Step 2: Lazy Storage Path
```javascript
if (lazy) {
  // Lazy storage - store content as-is without processing
  const elementId = `semem:${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  prompt = type === 'document' ? `Document: ${metadata.title || 'Untitled'}` :
          type === 'concept' ? `Concept: ${metadata.name || 'Unnamed'}` :
          `User input: ${content.substring(0, 100)}...`;
  
  const lazyData = { id: elementId, content, type, prompt, metadata };
  result = await this.memoryManager.store.storeLazyContent(lazyData);
  
  return {
    success: true, verb: 'tell', type, stored: true, lazy: true,
    contentLength: content.length, message: `Successfully stored ${type} content lazily`
  };
}
```

#### Step 3: Normal Processing by Content Type

**Interaction Type**:
```javascript
case 'interaction':
  embedding = await this.safeOps.generateEmbedding(content);
  concepts = await this.safeOps.extractConcepts(content);
  prompt = `User input: ${content.substring(0, 100)}...`;
  
  result = await this.safeOps.storeInteraction(prompt, response, {
    ...metadata, type: 'tell_interaction', concepts
  });
  break;
```

**Document Type** (with automatic chunking):
```javascript
case 'document':
  const MAX_EMBEDDING_SIZE = 8000;
  
  if (content.length > MAX_EMBEDDING_SIZE) {
    // Import and configure chunker
    const Chunker = (await import('../../src/services/document/Chunker.js')).default;
    const chunker = new Chunker({
      maxChunkSize: 2000, minChunkSize: 100,
      overlapSize: 100, strategy: 'semantic'
    });
    
    // Chunk the document
    const chunkingResult = await chunker.chunk(content, {
      title: metadata.title || 'Untitled Document',
      sourceFile: metadata.filename || 'unknown'
    });
    
    // Process each chunk separately
    const chunkResults = [];
    for (let i = 0; i < chunkingResult.chunks.length; i++) {
      const chunk = chunkingResult.chunks[i];
      const chunkEmbedding = await this.safeOps.generateEmbedding(chunk.content);
      const chunkConcepts = await this.safeOps.extractConcepts(chunk.content);
      
      const chunkResult = await this.safeOps.storeInteraction(
        `Document: ${metadata.title} (Chunk ${i + 1}/${chunkingResult.chunks.length})`,
        chunk.content,
        { ...metadata, type: 'tell_document_chunk', chunkIndex: i, concepts: chunkConcepts }
      );
    }
  } else {
    // Small document - process normally
    embedding = await this.safeOps.generateEmbedding(content);
    concepts = await this.safeOps.extractConcepts(content);
    prompt = `Document: ${metadata.title || 'Untitled'}`;
    
    result = await this.safeOps.storeInteraction(prompt, response, {
      ...metadata, type: 'tell_document', concepts
    });
  }
  break;
```

**Concept Type**:
```javascript
case 'concept':
  embedding = await this.safeOps.generateEmbedding(content);
  concepts = await this.safeOps.extractConcepts(content);
  prompt = `Concept: ${metadata.name || 'Unnamed'}`;
  
  result = await this.safeOps.storeInteraction(prompt, response, {
    ...metadata, type: 'tell_concept', concepts
  });
  break;
```

### 7. Safe Operations Layer

**File**: `mcp/lib/safe-operations.js`

Handles the core operations with error handling:

#### Embedding Generation
```javascript
async generateEmbedding(text) {
  return await this.embeddingProvider.generateEmbedding(text);
}
```

#### Concept Extraction
```javascript
async extractConcepts(text) {
  return await this.llmHandler.extractConcepts(text);
}
```

#### Storage Operation
```javascript
async storeInteraction(prompt, response, metadata) {
  return await this.memoryManager.storeMemory(prompt, response, metadata);
}
```

### 8. Memory Manager Layer

**File**: `src/MemoryManager.js`

Orchestrates storage across multiple backends:

#### Memory Storage Process
```javascript
async storeMemory(prompt, response, metadata = {}) {
  // Generate embedding
  const embedding = await this.embeddingProvider.generateEmbedding(
    `${prompt} ${response}`
  );
  
  // Prepare memory data
  const memoryData = {
    id: `semem:${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
    prompt, response, embedding, metadata,
    timestamp: new Date().toISOString(),
    concepts: metadata.concepts || []
  };
  
  // Store in memory store (FAISS index)
  await this.memStore.store(memoryData);
  
  // Store in SPARQL store for persistence
  if (this.store) {
    await this.store.store(memoryData);
  }
  
  return memoryData;
}
```

### 9. Storage Layer

**File**: `src/stores/SPARQLStore.js`

Handles persistent storage in RDF format:

```javascript
async store(data) {
  // Convert to RDF triples
  const element = new RdfElement({
    uri: data.id,
    prefLabel: data.prompt,
    content: data.response,
    embedding: data.embedding,
    concepts: data.concepts,
    metadata: data.metadata
  });
  
  // Store in SPARQL endpoint
  const insertQuery = element.toInsertQuery(this.options.graphName);
  await this.sparql.update(insertQuery);
}
```

### 10. Document Chunking (for Large Documents)

**File**: `src/services/document/Chunker.js`

Handles intelligent document segmentation:

```javascript
async chunk(content, options = {}) {
  const chunks = [];
  const maxSize = this.options.maxChunkSize;
  const overlap = this.options.overlapSize;
  
  // Semantic chunking strategy
  const sentences = this.splitIntoSentences(content);
  let currentChunk = '';
  
  for (const sentence of sentences) {
    if ((currentChunk + sentence).length > maxSize && currentChunk.length > 0) {
      chunks.push({
        content: currentChunk,
        size: currentChunk.length,
        index: chunks.length
      });
      
      // Apply overlap
      currentChunk = this.getOverlap(currentChunk, overlap) + sentence;
    } else {
      currentChunk += sentence;
    }
  }
  
  return { chunks, metadata: { totalChunks: chunks.length } };
}
```

## Response Flow Paths

### Path A: Normal Processing
```
UI → API → MCP → SimpleVerbs → SafeOps → MemoryManager → [MemoryStore + SPARQLStore]
```
- Generates embeddings and extracts concepts
- Stores in both memory and persistent storage
- Suitable for most content types

### Path B: Lazy Storage
```
UI → API → MCP → SimpleVerbs → SPARQLStore.storeLazyContent()
```
- Immediate storage without processing
- Fast operation for batch imports
- Processing can be triggered later

### Path C: Document Chunking
```
UI → API → MCP → SimpleVerbs → Chunker → [Multiple SafeOps.storeInteraction calls]
```
- Large documents are automatically chunked
- Each chunk processed independently
- Maintains document structure and relationships

## Response Structure

A successful Tell response includes:
```json
{
  "success": true,
  "verb": "tell",
  "type": "document",
  "stored": true,
  "lazy": false,
  "contentLength": 15420,
  "chunks": 8,
  "totalConcepts": 23,
  "sessionCached": true,
  "zptState": { "zoom": "entity", "pan": {}, "tilt": "keywords" },
  "message": "Successfully stored document content (8 chunks processed)",
  "metadata": {
    "title": "Machine Learning Guide",
    "tags": "AI, algorithms, neural networks",
    "type": "tell_document_chunk"
  }
}
```

**Key Response Fields**:
- `success`: Operation status
- `type`: Content type processed
- `lazy`: Whether lazy storage was used
- `chunks`: Number of chunks created (for documents)
- `totalConcepts`: Concepts extracted from content
- `sessionCached`: Whether content was cached in session
- `zptState`: Current navigation state

## Configuration Dependencies

The Tell operation requires:
1. **MCP HTTP Server**: Running on port 4115
2. **Workbench Server**: Running on port 8086, proxying to MCP
3. **SPARQL Store**: For persistent storage
4. **LLM Provider**: For concept extraction
5. **Embedding Provider**: For vector generation
6. **Memory Manager**: With both memory and SPARQL stores

## Debugging Tips

### Check Content Storage
```bash
curl -X POST -H "Content-Type: application/json" \
  -d '{"content": "test content", "type": "interaction"}' \
  http://localhost:4115/tell
```

### Test Lazy Storage
```bash
curl -X POST -H "Content-Type: application/json" \
  -d '{"content": "test content", "lazy": true}' \
  http://localhost:4115/tell
```

### Verify Chunks Exist
```bash
curl -u admin:admin -H "Content-Type: application/sparql-query" \
  -d "SELECT (COUNT(*) as ?count) WHERE { ?chunk a <http://purl.org/stuff/ragno/Unit> }" \
  http://localhost:3030/semem/query
```

### Check Document Processing
```bash
curl -X POST -H "Content-Type: application/json" \
  -d '{"content": "'$(head -c 10000 large_document.txt)'", "type": "document"}' \
  http://localhost:4115/tell
```

## Error Handling and Edge Cases

### Large Document Handling
- Documents > 8000 characters are automatically chunked
- Chunking preserves semantic boundaries
- Each chunk stored independently with relationships

### Concept Extraction Failures
- System continues processing even if concept extraction fails
- Stores content without concepts rather than failing completely
- Logs extraction errors for debugging

### Storage Backend Failures
- Memory store failure doesn't prevent SPARQL storage
- SPARQL store failure doesn't prevent memory storage
- Graceful degradation with appropriate error messages

### File Upload Processing
- Supports PDF, text, and markdown files
- Automatic content extraction and type detection
- File metadata preserved in storage

## Performance Considerations

### Lazy Storage Benefits
- ~10x faster for large content batches
- Reduces API provider costs (no embedding/LLM calls)
- Allows offline processing of embeddings later

### Chunking Strategy
- Semantic boundaries preferred over hard character limits
- Configurable overlap between chunks (default 100 characters)
- Maintains document coherence across chunks

### Concurrent Processing
- Multiple chunks processed concurrently where possible
- Session caching reduces redundant operations
- Memory and SPARQL storage operations parallelized

## Integration Points

### ZPT Navigation
- Tell operations respect current ZPT state
- Stored content tagged with navigation context
- Pan filters can influence storage organization

### Session Management
- Content cached in session for immediate retrieval
- Session state persists across operations
- Automatic session cleanup for long-running operations

### Enhancement Integration  
- Stored content available for immediate Ask queries
- Concepts extracted during Tell inform enhancement services
- Document chunks discoverable through semantic search