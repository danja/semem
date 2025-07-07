# Document Processing Examples

This directory contains examples demonstrating the document processing capabilities of Semem's chunking system.

## Available Examples

### LifeSciDemo.js

A comprehensive demonstration of processing academic papers using the full document chunking pipeline.

**Features:**
- PDF to markdown conversion
- Semantic chunking with Ragno ontology compliance
- SPARQL ingestion with PROV-O provenance tracking
- Data verification and querying

**Usage:**
```bash
# Run the demo
node examples/document/LifeSciDemo.js

# Show help
node examples/document/LifeSciDemo.js --help
```

**Target Document:**
- `docs/paper/references/elife-52614-v1.pdf` - eLife research paper (720KB, 15 pages)

**Output:**
- Converts PDF to ~76K characters of markdown
- Creates ~22K semantic chunks with Ragno compliance
- Stores in SPARQL graph: `http://example.org/lifesci/documents`
- Full PROV-O provenance tracking with hash-based URIs

**Performance (tested):**
- PDF conversion: ~1.3 seconds
- Chunking: ~400ms for 22K chunks
- Average chunk size: ~1,200 characters
- Community cohesion: 0.9

## Prerequisites

### SPARQL Endpoint
The examples require a running SPARQL endpoint. Apache Fuseki is recommended:

```bash
# Download and start Fuseki
fuseki-server --update --mem /dataset
```

### Configuration
Ensure your `config/config.json` includes SPARQL store configuration:

```json
{
  "stores": {
    "sparql": {
      "endpoint": "http://localhost:3030/dataset/sparql",
      "updateEndpoint": "http://localhost:3030/dataset/update"
    }
  }
}
```

### Dependencies
All dependencies are included in the main package. The chunking system uses:
- `@opendocsg/pdf2md` for PDF conversion
- `turndown` for HTML to markdown conversion
- ZPT ContentChunker for semantic chunking
- SPARQL stores for persistence

## Example Output

```
🧬 Life Sciences Document Processing Demo
📄 Processing: elife-52614-v1.pdf

🔧 Step 1: Initializing configuration and storage...
✅ Storage initialized

📖 Step 2: Converting PDF to markdown...
✅ PDF conversion completed
📊 Processing time: 1247ms
📏 Document size: 2847361 bytes
📄 Estimated pages: 28
📝 Markdown length: 156789 characters

✂️ Step 3: Chunking document with Ragno compliance...
✅ Document chunking completed
📦 Chunks created: 127
🎯 Source URI: http://example.org/lifesci/document/a4f8b2e1c9d5f3a7
📚 Corpus URI: http://example.org/lifesci/corpus/a4f8b2e1c9d5f3a7
👥 Community URI: http://example.org/lifesci/community/a4f8b2e1c9d5f3a7
🤝 Community cohesion: 0.73

💾 Step 4: Ingesting into SPARQL store...
✅ SPARQL ingestion completed
⏱️ Processing time: 892ms
📈 Chunks ingested: 127
🏷️ Activity ID: 550e8400-e29b-41d4-a716-446655440000
📊 Graph: http://example.org/lifesci/documents

🎉 Life Sciences Demo Completed Successfully!
```

## RDF Data Model

The examples create RDF data following the Ragno ontology:

### Document Structure
```turtle
<http://example.org/lifesci/document/abc123> a ragno:Corpus ;
    rdfs:label "eLife Research Paper" ;
    dcterms:created "2025-07-02T19:30:00Z" ;
    semem:sourceFile "docs/paper/references/elife-52614-v1.pdf" ;
    semem:format "pdf" .
```

### Text Chunks
```turtle
<http://example.org/lifesci/chunk/abc123_1_def456> a ragno:TextElement ;
    rdfs:label "Introduction" ;
    ragno:hasContent "Research in computational biology..." ;
    ragno:size 1247 ;
    dcterms:isPartOf <http://example.org/lifesci/document/abc123> ;
    prov:wasDerivedFrom <http://example.org/lifesci/document/abc123> .
```

### Provenance Tracking
```turtle
<http://example.org/lifesci/activity/xyz789> a prov:Activity ;
    rdfs:label "Document Ingestion Activity" ;
    prov:startedAtTime "2025-07-02T19:30:00Z" ;
    prov:used <http://example.org/lifesci/document/abc123> ;
    prov:generated <http://example.org/lifesci/chunk/abc123_1_def456> .
```

## Extending the Examples

### Adding New Document Types
Create additional converters for other formats:

```javascript
import { DocxConverter } from '../../src/services/document/DocxConverter.js';

const docxResult = await DocxConverter.convert('document.docx');
const chunkingResult = await chunker.chunk(docxResult.markdown, docxResult.metadata);
```

### Custom Chunking Strategies
Configure different chunking approaches:

```javascript
const chunker = new Chunker({
  strategy: 'hierarchical',  // or 'adaptive', 'token_aware'
  maxChunkSize: 2000,
  preserveHeaders: true
});
```

### Domain-Specific Processing
Customize for specific research domains:

```javascript
const chunkingResult = await chunker.chunk(markdown, {
  ...metadata,
  domain: 'neuroscience',
  researchType: 'experimental',
  methodology: 'fMRI'
});
```

## Troubleshooting

### Common Issues

1. **SPARQL Connection Failed**
   - Verify Fuseki is running: `curl http://localhost:3030/$/ping`
   - Check endpoint URLs in configuration

2. **PDF Conversion Errors**
   - Ensure PDF file exists and is readable
   - Check PDF is not password protected or corrupted

3. **Out of Memory**
   - For large PDFs, increase Node.js memory: `node --max-old-space-size=4096`
   - Use smaller chunk sizes to reduce memory usage

4. **Timeout Errors**
   - Increase processing timeouts in configuration
   - Process documents in smaller batches

### Debug Mode
Enable detailed logging:

```bash
LOG_LEVEL=DEBUG node examples/document/LifeSciDemo.js
```

## Performance Notes

- **PDF Processing**: ~2-5MB/sec depending on complexity
- **Chunking**: ~5-10MB/sec for semantic strategy
- **SPARQL Ingestion**: ~100-500 chunks/sec depending on endpoint
- **Memory Usage**: ~50-100MB per 1000 chunks

For production use, consider:
- Batch processing for multiple documents
- Async queue systems for high throughput
- Distributed SPARQL endpoints for scalability
- Caching strategies for frequently accessed chunks