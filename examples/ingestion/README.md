# SPARQL Document Ingestion

This directory contains tools for ingesting documents from SPARQL endpoints into the semem semantic memory system.

## Overview

The SPARQL Document Ingestion system allows you to:
- Query any SPARQL endpoint for content
- Transform results into documents using configurable templates
- Ingest documents via the MCP tell method with full or lazy processing
- Use predefined templates for common content types (blog articles, generic documents, Wikidata entities)

## Architecture

```
SPARQL Endpoint → Query Template → Document Transformation → MCP Tell Method → Semem Storage
```

### Components

1. **SPARQLDocumentIngester** (`src/services/ingestion/SPARQLDocumentIngester.js`)
   - Core service for executing SPARQL queries and transforming results
   - Handles authentication, timeouts, and error recovery
   - Configurable field mappings and batch processing

2. **SPARQL Templates** (`config/sparql-templates/`)
   - Reusable SPARQL query templates with variable substitution
   - Pre-built templates for common content patterns
   - Easy to extend with custom templates

3. **MCP Tool** (`mcp/tools/document-tools.js`)
   - `sparql_ingest_documents` tool for MCP integration
   - Supports dry runs, lazy processing, and progress reporting

4. **CLI Tool** (`examples/ingestion/SPARQLIngest.js`)
   - Command-line interface for interactive and batch processing
   - Interactive mode for testing and building queries

## Quick Start

### 1. CLI Usage

```bash
# Preview blog articles (dry run)
node examples/ingestion/SPARQLIngest.js \
  --endpoint "https://fuseki.hyperdata.it/danny.ayers.name/query" \
  --template blog-articles \
  --dry-run --limit 5

# Ingest blog articles 
node examples/ingestion/SPARQLIngest.js \
  --endpoint "https://fuseki.hyperdata.it/danny.ayers.name/query" \
  --template blog-articles \
  --limit 5

# Ingest documents with lazy processing
node examples/ingestion/SPARQLIngest.js \
  --endpoint "http://localhost:3030/dataset/query" \
  --template generic-documents \
  --limit 20 --lazy

# Interactive mode
node examples/ingestion/SPARQLIngest.js --interactive
```

### 2. MCP Integration

Use the `sparql_ingest_documents` tool from any MCP client:

```json
{
  "endpoint": "https://fuseki.hyperdata.it/danny.ayers.name/query",
  "template": "blog-articles",
  "limit": 10,
  "dryRun": true
}
```

### 3. Programmatic Usage

```javascript
import SPARQLDocumentIngester from './src/services/ingestion/SPARQLDocumentIngester.js';

const ingester = new SPARQLDocumentIngester({
  endpoint: 'https://example.org/sparql',
  auth: { user: 'admin', password: 'secret' }
});

// Dry run to preview results
const preview = await ingester.dryRun('blog-articles', { limit: 5 });

// Full ingestion
const result = await ingester.ingestFromTemplate('blog-articles', {
  limit: 50,
  tellFunction: myTellFunction,
  progressCallback: (progress) => console.log(progress)
});
```

## Templates

### Available Templates

1. **blog-articles** - Schema.org Article pattern
   - Designed for blog posts and articles
   - Fields: uri, title, content, created, modified, slug, relative

2. **generic-documents** - Flexible document pattern  
   - Works with Dublin Core, Schema.org, and RDFS patterns
   - Fields: uri, title, content, created, modified, description, author

3. **wikidata-entities** - Wikidata entity pattern
   - Extracts entities with labels and descriptions
   - Fields: uri, title, content (description), instanceof

### Creating Custom Templates

1. Create a new `.sparql` file in `config/sparql-templates/`
2. Use `{{variable}}` syntax for substitution
3. Ensure SELECT returns expected field names
4. Add template to MCP tool enum if needed

Example template:
```sparql
PREFIX foaf: <http://xmlns.com/foaf/0.1/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

SELECT ?uri ?title ?content WHERE {
  ?uri a foaf:Person ;
       foaf:name ?title ;
       rdfs:comment ?content .
}
LIMIT {{limit}}
```

## Configuration

### Preset Endpoints

Configure commonly-used endpoints in `config/config.json`:

```json
{
  "sparqlIngestion": {
    "presetEndpoints": {
      "my-endpoint": {
        "url": "https://example.org/sparql",
        "template": "generic-documents",
        "auth": {
          "user": "${SPARQL_USER}",
          "password": "${SPARQL_PASSWORD}"
        },
        "fieldMappings": {
          "uri": "resource",
          "title": "label",
          "content": "description"
        }
      }
    }
  }
}
```

### Field Mappings

Customize how SPARQL result variables map to document fields:

```json
{
  "fieldMappings": {
    "uri": "resource",        // Required: document URI
    "title": "headline",      // Required: document title  
    "content": "body",        // Required: main content
    "created": "dateCreated", // Optional: creation date
    "author": "creator"       // Optional: author
  }
}
```

## Processing Modes

### Full Processing (default)
- Generates embeddings and extracts concepts immediately
- Best for small to medium datasets
- Higher resource usage but immediate searchability

### Lazy Processing (`--lazy` or `lazy: true`)
- Stores content without immediate processing
- Faster ingestion for large datasets
- Process later using `mcp tell` with `augment` operation

## Error Handling

The ingestion system includes comprehensive error handling:

- **Network errors**: Automatic retries with exponential backoff
- **Authentication failures**: Clear error messages with auth guidance
- **SPARQL errors**: Query validation and syntax error reporting
- **Content validation**: Filtering of empty or invalid content
- **Partial failures**: Continue processing even if some documents fail

## Examples

### Blog Ingestion (from docs/query-from-blog.md)

```bash
# Using the provided blog example
node examples/ingestion/SPARQLIngest.js \
  --endpoint "https://fuseki.hyperdata.it/danny.ayers.name/query" \
  --template blog-articles \
  --limit 10 \
  --user admin --password secret
```

### Wikidata Ingestion

```bash
# Ingest Wikidata entities (no auth required)
node examples/ingestion/SPARQLIngest.js \
  --endpoint "https://query.wikidata.org/sparql" \
  --template wikidata-entities \
  --limit 25
```

### Custom Endpoint

```bash
# Test custom endpoint with dry run
node examples/ingestion/SPARQLIngest.js \
  --endpoint "http://localhost:3030/mydata/query" \
  --template generic-documents \
  --dry-run --verbose
```

## Troubleshooting

### Common Issues

1. **Authentication failures**
   - Verify credentials in environment variables
   - Check endpoint authentication requirements
   - Try without auth for public endpoints

2. **Empty results**
   - Use `--dry-run` to preview query results
   - Check SPARQL query syntax in template
   - Verify endpoint URL and graph names

3. **Field mapping errors**
   - Check SPARQL result variable names
   - Ensure required fields (uri, title, content) are mapped
   - Use custom field mappings for non-standard schemas

4. **Timeout errors**
   - Increase timeout in configuration
   - Reduce batch size for large datasets
   - Use limit to test with smaller result sets

### Debugging

Enable verbose logging for detailed information:

```bash
node examples/ingestion/SPARQLIngest.js --verbose [other options]
```

Check MCP logs for integration issues:
```bash
DEBUG=* node mcp/http-server.js
```

## Integration with Semem Pipeline

After ingestion, documents can be processed through the standard semem pipeline:

1. **Document Chunking**: `examples/document/ChunkDocuments.js`
2. **Embedding Generation**: `examples/document/MakeEmbeddings.js`  
3. **Concept Extraction**: `examples/document/ExtractConcepts.js`
4. **Semantic Decomposition**: `examples/document/Decompose.js`
5. **Analysis and Search**: `examples/document/Search.js`, `examples/document/RAG.js`

The ingested documents follow the same RDF patterns as uploaded documents, ensuring seamless integration with the existing processing pipeline.

## API Reference

### SPARQLDocumentIngester

**Constructor Options:**
- `endpoint` (string): SPARQL query endpoint URL
- `auth` (object): Authentication credentials `{user, password}`
- `templateDir` (string): Directory containing SPARQL templates
- `fieldMappings` (object): Custom field mappings
- `timeout` (number): Request timeout in milliseconds
- `batchSize` (number): Documents to process per batch

**Methods:**
- `loadTemplate(name)`: Load SPARQL template from file
- `executeSparqlQuery(query, variables)`: Execute SPARQL query with variable substitution
- `transformToDocument(binding)`: Transform SPARQL result to document object
- `ingestFromTemplate(template, options)`: Full ingestion with MCP integration
- `dryRun(template, options)`: Preview without ingestion

### MCP Tool Parameters

- `endpoint` (required): SPARQL endpoint URL
- `template` (required): Template name
- `limit` (optional): Maximum documents (default: 50)
- `lazy` (optional): Use lazy processing (default: false)
- `dryRun` (optional): Preview mode (default: false)
- `auth` (optional): Authentication credentials
- `variables` (optional): Template variables
- `fieldMappings` (optional): Custom field mappings