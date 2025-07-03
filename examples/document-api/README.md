# Document API HTTP Showcase

This directory contains examples demonstrating the Document API HTTP endpoints for processing and querying documents via REST API calls.

## Overview

The Document API provides a complete pipeline for document processing:
1. **Upload** - Upload PDF, HTML, or text files
2. **Convert** - Extract content to markdown format  
3. **Chunk** - Split into semantic units using Ragno ontology
4. **Ingest** - Store in SPARQL knowledge graph
5. **Query** - Search and retrieve content via various APIs

## Prerequisites

1. **API Server Running**:
   ```bash
   npm run start:api
   ```
   Server will be available at `http://localhost:4100`

2. **SPARQL Endpoint**: 
   - Apache Fuseki running on `http://localhost:3030`
   - Or configured SPARQL endpoint in `config/config.json`

3. **Dependencies**:
   ```bash
   npm install  # Install form-data, node-fetch, chalk, loglevel
   ```

## Quick Start

### Step 1: Upload and Process Document

```bash
# From project root
node examples/document-api/01-upload-document-http.js

# Or from examples/document-api directory
cd examples/document-api
node 01-upload-document-http.js
```

This script demonstrates the complete document processing pipeline:
- Uploads `docs/paper/references/nodeRAG.pdf` (1.1MB academic paper)
- Converts PDF to markdown (83k+ characters)
- Chunks into semantic units (18k+ chunks)
- Ingests into SPARQL knowledge graph

**Expected Output:**
```
╔══════════════════════════════════════════════════════════════╗
║           📄 DOCUMENT API SHOWCASE: HTTP UPLOAD             ║
║        Upload nodeRAG.pdf via HTTP API endpoints            ║
╚══════════════════════════════════════════════════════════════╝

🔄 Running pre-flight checks...
✅ Document API is available and healthy
✅ Document found: nodeRAG.pdf (1.07 MB)

🚀 Starting document upload via HTTP API...
📤 Uploading nodeRAG.pdf with full processing pipeline...

✅ Document upload completed successfully!
📝 Conversion Results:
   Content Length: 83956 characters
   Format: markdown
   Pages: 34

🧩 Chunking Results:
   Chunks Created: 18456
   
🗄️ Ingestion Results:
   Chunks Ingested: 18456
   Triples Created: 185000+
   Graph URI: http://example.org/documents

🎉 Document API showcase completed successfully!
```

### Step 2: Query the Document

```bash
# From project root
node examples/document-api/02-query-noderag-http.js

# Or from examples/document-api directory
cd examples/document-api
node 02-query-noderag-http.js
```

This script demonstrates content retrieval and AI-powered question answering:
- Checks document ingestion status
- Searches for NodeRAG algorithm information
- Uses chat API to generate comprehensive answers
- Displays formatted results about NodeRAG algorithms

**Expected Output:**
```
╔══════════════════════════════════════════════════════════════╗
║           🔍 DOCUMENT API SHOWCASE: QUERY NODERAG           ║
║      Query ingested nodeRAG.pdf via HTTP API endpoints      ║
╚══════════════════════════════════════════════════════════════╝

✅ NodeRAG document found and ingested
🔍 Searching for NodeRAG algorithms in memory...
🤖 Generating NodeRAG algorithm description...

╔══════════════════════════════════════════════════════════════╗
║                    🧠 NODERAG ALGORITHMS                    ║
╚══════════════════════════════════════════════════════════════╝

NodeRAG supports several key algorithmic approaches for graph-based
retrieval-augmented generation:

1. **Hierarchical Graph Traversal**: Multi-level navigation through
   knowledge graphs with adaptive depth control...

2. **Semantic Vector Clustering**: Advanced embedding techniques for
   organizing related concepts and entities...

[Additional algorithm descriptions...]
```

## Document Processing Pipeline

### 1. Upload with Options

The upload endpoint supports various processing options:

```bash
curl -X POST http://localhost:4100/api/documents/upload \
  -H "X-API-Key: semem-dev-key" \
  -F "file=@path/to/document.pdf" \
  -F 'options={"convert":true,"chunk":true,"ingest":true,"namespace":"http://example.org/mydoc/"}'
```

**Options:**
- `convert`: Extract content to markdown (default: true)
- `chunk`: Split into semantic units (default: true) 
- `ingest`: Store in SPARQL graph (default: true)
- `namespace`: RDF namespace for entities (default: auto-generated)

### 2. Check Processing Status

```bash
curl -H "X-API-Key: semem-dev-key" \
  http://localhost:4100/api/documents
```

**Response:**
```json
{
  "documents": [{
    "id": "doc-123",
    "filename": "nodeRAG.pdf", 
    "status": "ingested",
    "operations": ["convert", "chunk", "ingest"],
    "conversion": {
      "contentLength": 83956,
      "pages": 34
    },
    "chunking": {
      "chunkCount": 18456
    },
    "ingestion": {
      "triplesCreated": 185000,
      "graphUri": "http://example.org/documents"
    }
  }]
}
```

### 3. Query Methods

Once ingested, you can query the document using multiple approaches:

**Memory Search:**
```bash
curl -H "X-API-Key: semem-dev-key" \
  "http://localhost:4100/api/memory/search?query=NodeRAG+algorithms&limit=10"
```

**Unified Search (recommended):**
```bash
curl -X POST http://localhost:4100/api/search/unified \
  -H "X-API-Key: semem-dev-key" \
  -H "Content-Type: application/json" \
  -d '{"query":"NodeRAG implementation details","sources":["memory","ragno"],"limit":5}'
```

**Chat-based Q&A:**
```bash
curl -X POST http://localhost:4100/api/chat \
  -H "X-API-Key: semem-dev-key" \
  -H "Content-Type: application/json" \
  -d '{"prompt":"Based on the NodeRAG paper, what algorithms does it support?"}'
```

## Supported File Types

- **PDF**: Academic papers, reports, documentation
- **HTML**: Web pages, articles  
- **Text**: Plain text documents, markdown files

**Size Limits:**
- Default: 10MB per file
- Configurable via `maxFileSize` in DocumentAPI

## Configuration

### Authentication

Set API key via environment variable:
```bash
export SEMEM_API_KEY=your-api-key
```

Or configure in `config/config.json`:
```json
{
  "api": {
    "key": "your-api-key"
  }
}
```

### Development Mode

For development, authentication is bypassed:
```bash
NODE_ENV=development npm run start:api
```

### SPARQL Configuration

Configure SPARQL endpoint in `config/config.json`:
```json
{
  "storage": {
    "type": "sparql",
    "options": {
      "query": "http://localhost:3030/semem/query",
      "update": "http://localhost:3030/semem/update",
      "graphName": "http://example.org/documents"
    }
  }
}
```

## API Endpoints Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/documents/upload` | Upload and process documents |
| GET | `/api/documents` | List processed documents |
| GET | `/api/documents/{id}` | Get document details |
| DELETE | `/api/documents/{id}` | Delete document |
| POST | `/api/documents/convert` | Convert document only |
| POST | `/api/documents/chunk` | Chunk document only |
| POST | `/api/documents/ingest` | Ingest chunks only |

## Troubleshooting

### Common Issues

**1. "Document API not available"**
```bash
# Check if API server is running
curl http://localhost:4100/api/services
```

**2. "SPARQL update failed"**
- Verify Fuseki is running: `http://localhost:3030`
- Check SPARQL endpoint configuration
- Ensure graph permissions are set

**3. "File too large"**
- Default limit: 10MB
- Configure `maxFileSize` in DocumentAPI options
- Use compression for large PDFs

**4. "No chunks found for ingestion"**
- Check document conversion output
- Verify chunking completed successfully
- Review chunking parameters (min/max size)

### Debug Mode

Enable verbose logging:
```bash
DEBUG=* node 01-upload-document-http.js
```

### Performance Notes

- **Large documents**: Processing time scales with document size
- **Chunk count**: nodeRAG.pdf creates ~18k chunks (normal for academic papers)
- **SPARQL ingestion**: May take several minutes for large documents
- **Memory usage**: Proportional to document size and chunk count

## Example Use Cases

1. **Academic Research**: Upload papers, query for methodologies
2. **Documentation**: Process manuals, search for procedures  
3. **Knowledge Management**: Ingest reports, extract insights
4. **Content Analysis**: Upload articles, analyze themes

## Next Steps

After running the showcase:

1. **Explore APIs**: Try different query endpoints
2. **Upload your documents**: Test with your own files
3. **Integrate**: Use the HTTP API in your applications
4. **Customize**: Modify chunking parameters for your use case

For more details, see the main [Document API Plan](../../docs/DOCUMENT-API-PLAN.md).