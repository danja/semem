# SPARQL Document Ingestion Implementation Summary

## ✅ Implementation Status

A comprehensive SPARQL-to-MCP document ingestion system has been implemented for semem, providing flexible document ingestion from any SPARQL endpoint.

**Note to self**
cd ~/hyperdata/transmissions # my local path
./trans link-finder
./trans bookmark-get
node utils/BookmarkIngest.js \
  --endpoint "http://localhost:3030/semem/query" \
  --graph "http://hyperdata.it/content" \
  --limit 10
node utils/ProcessBookmarksToMemory.js \
  --limit 50 --batch-size 10
node utils/SPARQLIngest.js \
  --endpoint "https://fuseki.hyperdata.it/danny.ayers.name/query" \
  --template blog-articles \
  --graph "http://hyperdata.it/content" \
  --user admin --password admin123  

## 🏗️ Core Components

### 1. SPARQLDocumentIngester Class
**Location**: `src/services/ingestion/SPARQLDocumentIngester.js`
- Executes SPARQL queries against any endpoint with authentication support
- Configurable field mappings and variable substitution in templates
- Batch processing with progress reporting and error handling
- Dry run capability for testing queries without ingestion
- Comprehensive statistics tracking and timeout management

### 2. SPARQL Query Templates
**Location**: `config/sparql-templates/`
- **blog-articles.sparql**: Template for blog article ingestion
- **generic-documents.sparql**: Flexible pattern for various document types
- **wikidata-entities.sparql**: Wikidata entity extraction template
- **bookmarks.sparql**: Template for bookmark content ingestion
- Variable substitution system with `{{variable}}` syntax

### 3. MCP Tool Integration
**Location**: `mcp/tools/document-tools.js`
- **sparql_ingest_documents**: MCP tool for Claude Code integration
- Full parameter validation and error handling
- Dry run and lazy processing support
- Graph parameter support for SPARQL updates
- Integration with semem's tell method for document storage

### 4. CLI Tools
**Location**: `utils/`
- **SPARQLIngest.js**: General-purpose SPARQL document ingestion
  - Interactive and batch processing modes
  - Built-in help and template listing
  - Authentication support for protected endpoints
  - Graph parameter support matching MCP tool
  - Verbose logging and comprehensive error reporting
- **BookmarkIngest.js**: Specialized bookmark content ingestion
  - Uses bookmark vocabulary (http://purl.org/stuff/bm/)
  - Supports lazy and full processing modes
  - 360x faster lazy mode for bulk ingestion
  - **Note**: Creates raw RDF bookmarks that need post-processing
- **ProcessBookmarksToMemory.js**: Convert raw bookmarks to searchable memory items
  - Finds unprocessed bookmarks in the graph
  - Automatically chunks large content before processing
  - Processes through tell verb to create semem:MemoryItem entities
  - Generates embeddings for semantic search
  - Marks bookmarks as processed to avoid duplicates
- **QueryLazyContent.js**: Query and inspect lazy-stored content
  - View content waiting for augmentation
  - Filter by type and limit results

### 5. Configuration System
**Location**: `config/config.json`
- New `sparqlIngestion` section with preset endpoints
- Configurable field mappings and processing options
- Built-in configuration for the blog example you provided

## 🚀 Usage Examples

### Command Line Interface

#### General Document Ingestion

```bash
# Preview blog articles
node utils/SPARQLIngest.js \
  --endpoint "https://fuseki.hyperdata.it/danny.ayers.name/query" \
  --graph "http://danny.ayers.name/" \
  --template blog-articles --dry-run --limit 5

# Full ingestion with authentication
node utils/SPARQLIngest.js \
  --endpoint "https://fuseki.hyperdata.it/danny.ayers.name/query" \
  --template blog-articles --limit 10 \
  --graph "http://hyperdata.it/content" \
  --user admin --password secret

# Interactive mode for testing
node utils/SPARQLIngest.js --interactive
```

#### Bookmark Ingestion (Two-Phase Process)

**Phase 1: Ingest Raw Bookmarks**

```bash
# Preview bookmarks first
node utils/BookmarkIngest.js \
  --endpoint "http://localhost:3030/semem/query" \
  --graph "http://hyperdata.it/content" \
  --dry-run --limit 5

# Ingest raw bookmark RDF (creates bm:Bookmark entities)
node utils/BookmarkIngest.js \
  --endpoint "http://localhost:3030/semem/query" \
  --graph "http://hyperdata.it/content" \
  --limit 100
```

**Phase 2: Process Bookmarks to Searchable Memory**

```bash
# Preview what will be processed
node utils/ProcessBookmarksToMemory.js \
  --limit 10 --dry-run --verbose

# Process bookmarks to create searchable memory items
# (chunks large content, generates embeddings, extracts concepts)
node utils/ProcessBookmarksToMemory.js \
  --limit 50 --batch-size 10

# Process with verbose output
node utils/ProcessBookmarksToMemory.js \
  --limit 20 --verbose
```

**Important**: After Phase 2, bookmarks become searchable via the `ask` verb!

#### Query Lazy Content

```bash
# Show first 10 lazy items
node utils/QueryLazyContent.js

# Show more with full content
node utils/QueryLazyContent.js --limit 50 --verbose
```

### MCP Integration

```json
{
  "tool": "sparql_ingest_documents",
  "parameters": {
    "endpoint": "https://fuseki.hyperdata.it/danny.ayers.name/query",
    "template": "blog-articles",
    "limit": 10,
    "graph": "http://hyperdata.it/content",
    "dryRun": true,
    "auth": {
      "user": "admin", 
      "password": "secret"
    }
  }
}
```

### Programmatic Usage

```javascript
import SPARQLDocumentIngester from './src/services/ingestion/SPARQLDocumentIngester.js';

const ingester = new SPARQLDocumentIngester({
  endpoint: 'https://fuseki.hyperdata.it/danny.ayers.name/query',
  auth: { user: 'admin', password: 'secret' }
});

// Test with dry run
const preview = await ingester.dryRun('blog-articles', { limit: 5 });

// Full ingestion via MCP tell method
const result = await ingester.ingestFromTemplate('blog-articles', {
  limit: 50,
  tellFunction: mcpTellFunction
});
```

## 🧪 Testing Results

The implementation has been tested and verified:

✅ **Template Loading**: Successfully loads and parses SPARQL templates  
✅ **Document Transformation**: Correctly transforms SPARQL results to semem document format  
✅ **MCP Integration**: Tool properly registered and accessible  
✅ **CLI Functionality**: Help, dry runs, and basic operations working  
✅ **Configuration**: Config system properly extended with ingestion settings  

## 📁 Files Created/Modified

### New Files:
- `src/services/ingestion/SPARQLDocumentIngester.js` - Core ingestion service
- `src/services/ingestion/MemoryItemProcessor.js` - Processes raw bookmarks to searchable memory items
- `config/sparql-templates/blog-articles.sparql` - Blog template
- `config/sparql-templates/generic-documents.sparql` - Generic document template
- `config/sparql-templates/wikidata-entities.sparql` - Wikidata template
- `sparql/queries/find-unprocessed-bookmarks.sparql` - Query to find bookmarks needing processing
- `utils/ProcessBookmarksToMemory.js` - CLI tool for bookmark-to-memory conversion
- `examples/ingestion/SPARQLIngest.js` - CLI tool
- `examples/ingestion/README.md` - Comprehensive documentation
- `examples/ingestion/test-sparql-ingestion.js` - Test script

### Modified Files:
- `config/config.json` - Added sparqlIngestion configuration, updated graphName to http://hyperdata.it/content, increased Groq rate limit to 500ms
- `mcp/tools/document-tools.js` - Added createSparqlIngestTool function, removed hardcoded graph URI
- `mcp/index.js` - Registered sparql_ingest_documents tool
- `src/handlers/LLMHandler.js` - Added configurable rate limit delay support

## 🎯 Key Features

### Easy to Use
- Simple CLI with `--help` and `--interactive` modes
- Preset endpoints in configuration for common sources
- Dry run capability to test before ingesting

### Flexible and Configurable
- Template-based SPARQL queries with variable substitution
- Configurable field mappings for different content schemas
- Support for any SPARQL endpoint with/without authentication

### Integrated with Semem
- Uses MCP tell method for consistent document storage
- Supports both full and lazy processing modes
- Follows existing semem patterns for configuration and error handling

### Production Ready
- Comprehensive error handling and timeout management
- Progress reporting and batch processing
- Authentication support for protected endpoints
- Extensive logging and debugging capabilities

## 🔗 Integration with Your Blog Example

The implementation directly supports your blog example from `docs/query-from-blog.md`:

```bash
node examples/ingestion/SPARQLIngest.js \
  --endpoint "https://fuseki.hyperdata.it/danny.ayers.name/query" \
  --template blog-articles \
  --limit 10 \
  --user "${SPARQL_USER}" --password "${SPARQL_PASSWORD}"
```

The `blog-articles.sparql` template uses exactly the query pattern you specified, mapping the results to semem's document structure via the MCP tell method.

## 🔄 Lazy Processing Workflow

For bulk ingestion scenarios, semem supports a two-phase workflow:

1. **Phase 1: Lazy Storage** (~167ms per item) - Store content quickly without processing
2. **Phase 2: Batch Augmentation** - Process stored content later in batches

This provides a 360x performance improvement for bulk ingestion.

**See**: [Lazy Batch Processing Documentation](./lazy-batch-processing.md) for complete workflow details.

### Performance Comparison

| Mode | Speed | Use Case |
|------|-------|----------|
| Dry Run | Instant | Preview before ingestion |
| Lazy | ~167ms/item | Bulk ingestion, process later |
| Full | ~60s/item | Complete processing immediately |

## 🔄 Bookmark Processing Workflow (Updated)

The bookmark ingestion system now uses a two-phase approach:

### Phase 1: Raw Bookmark Ingestion
- **Tool**: `BookmarkIngest.js`
- **Purpose**: Quickly ingest bookmark RDF from SPARQL endpoints
- **Output**: Creates `bm:Bookmark` entities with content in the graph
- **Speed**: Fast - no processing overhead

### Phase 2: Memory Item Processing
- **Tool**: `ProcessBookmarksToMemory.js`
- **Purpose**: Convert raw bookmarks to searchable memory items
- **Process**:
  1. Queries for unprocessed bookmarks (`semem:processedToMemory != true`)
  2. Automatically chunks large content (threshold: 5000 chars)
  3. Processes each chunk through `tell` verb
  4. Generates embeddings and extracts concepts
  5. Marks bookmark as processed
- **Output**: Creates `semem:MemoryItem` entities searchable via `ask` verb
- **Speed**: Slower but makes content semantically searchable

### Why Two Phases?

1. **Separation of Concerns**: Raw data ingestion vs semantic processing
2. **Flexibility**: Ingest all bookmarks first, process selectively later
3. **Error Recovery**: Failed processing doesn't lose raw bookmark data
4. **Performance**: Can ingest thousands of bookmarks, then process in batches
5. **Reprocessing**: Can reprocess bookmarks without re-ingesting from source

## ✨ Next Steps

The system is ready for immediate use! You can:

1. **Test with your blog**: Use the CLI or MCP tool with your Fuseki endpoint
2. **Ingest bookmarks**: Use two-phase bookmark workflow (BookmarkIngest.js → ProcessBookmarksToMemory.js)
3. **Use lazy mode**: For bulk ingestion, use --lazy flag for 360x speedup
4. **Add custom templates**: Create new `.sparql` files for other content sources
5. **Extend field mappings**: Customize how SPARQL results map to document properties
6. **Integrate with pipelines**: Use ingested documents with existing semem processing workflows
7. **Query and search**: Use `ask` verb to search processed bookmark content

## 📚 Related Documentation

- [Lazy Batch Processing](./lazy-batch-processing.md) - Complete workflow for bulk ingestion
- [Tell Verb](./tell.md) - MCP tell operation documentation
- [Augment Verb](./augment.md) - MCP augment operation for processing
- [SPARQL Service](./sparql-service.md) - SPARQL store operations

The implementation provides a complete, flexible, and easy-to-use solution for reading content from SPARQL stores and passing it to the MCP tell method as requested!