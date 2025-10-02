# Lazy Batch Processing Workflow

## Overview

The semem system supports a two-phase ingestion workflow for handling large collections of documents:

1. **Phase 1: Lazy Storage** - Quickly store content without processing (no embeddings, no concept extraction)
2. **Phase 2: Batch Augmentation** - Process stored lazy content in batches

This workflow provides significant performance benefits for bulk ingestion scenarios.

## Performance Comparison

| Mode | Speed per Item | Use Case |
|------|---------------|----------|
| Full Processing | ~60 seconds | Single items, immediate processing needed |
| Lazy Storage | ~167ms | Bulk ingestion (360x faster) |

## Phase 1: Lazy Storage

### Using BookmarkIngest with --lazy Flag

```bash
# Ingest large collection with lazy processing
node utils/BookmarkIngest.js \
  --endpoint "http://localhost:3030/test/query" \
  --graph "http://hyperdata.it/content" \
  --limit 100 \
  --lazy
```

### What Happens During Lazy Storage

Content is stored in the SPARQL graph with:
- `semem:processingStatus "lazy"` - marks content as unprocessed
- `ragno:content` - the full content
- `rdfs:label` - title/label
- `dcterms:created` - creation timestamp
- `ragno:subType` - content type (document, concept, interaction)
- Metadata fields

**What is NOT created:**
- No embeddings generated
- No concepts extracted
- No similarity relationships

## Phase 2: Batch Augmentation

### Querying Lazy Content

Use the QueryLazyContent utility to see what needs processing:

```bash
# Show first 10 lazy items
node utils/QueryLazyContent.js

# Show more with full content
node utils/QueryLazyContent.js --limit 50 --verbose
```

### Manual Augmentation (MCP)

For individual items, use the MCP `augment` verb:

```bash
# Via HTTP API
curl -X POST http://localhost:4101/augment \
  -H "Content-Type: application/json" \
  -d '{
    "content": "your content here",
    "options": {
      "extractConcepts": true,
      "generateEmbedding": true
    }
  }'
```

### Batch Augmentation Utility

**✅ IMPLEMENTED**: `utils/AugmentLazyContent.js` utility for batch processing:

```bash
# Process all lazy content (default: 10 items, batch size 5)
node utils/AugmentLazyContent.js

# Process with custom limits and batch size
node utils/AugmentLazyContent.js --limit 20 --batch-size 10

# Dry run to preview
node utils/AugmentLazyContent.js --dry-run --limit 5

# Process specific item by ID
node utils/AugmentLazyContent.js --id "semem:123456"

# Process by type
node utils/AugmentLazyContent.js --type document --limit 20

# Verbose output
node utils/AugmentLazyContent.js --verbose --limit 5
```

**Features**:
- Batch processing with configurable batch size
- Progress tracking and statistics
- Error handling with detailed reporting
- Dry-run mode for preview
- Filter by content type
- Process specific items by ID

## SPARQL Queries for Lazy Content

### Find All Lazy Content

```sparql
PREFIX semem: <http://purl.org/stuff/semem/>
PREFIX ragno: <http://purl.org/stuff/ragno/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX dcterms: <http://purl.org/dc/terms/>

SELECT ?element ?content ?label ?type ?created
FROM <http://tensegrity.it/semem>
WHERE {
    ?element semem:processingStatus "lazy" ;
             ragno:content ?content .
    OPTIONAL { ?element rdfs:label ?label }
    OPTIONAL { ?element ragno:subType ?type }
    OPTIONAL { ?element dcterms:created ?created }
}
ORDER BY DESC(?created)
LIMIT 10
```

### Count Lazy Items by Type

```sparql
PREFIX semem: <http://purl.org/stuff/semem/>
PREFIX ragno: <http://purl.org/stuff/ragno/>

SELECT ?type (COUNT(?element) as ?count)
FROM <http://tensegrity.it/semem>
WHERE {
    ?element semem:processingStatus "lazy" ;
             ragno:subType ?type .
}
GROUP BY ?type
ORDER BY DESC(?count)
```

### Update Lazy to Processed

After augmentation, update the processing status:

```sparql
PREFIX semem: <http://purl.org/stuff/semem/>
PREFIX ragno: <http://purl.org/stuff/ragno/>
PREFIX skos: <http://www.w3.org/2004/02/skos/core#>

DELETE {
    GRAPH <http://tensegrity.it/semem> {
        <semem:ELEMENT_ID> semem:processingStatus "lazy" .
    }
}
INSERT {
    GRAPH <http://tensegrity.it/semem> {
        <semem:ELEMENT_ID> semem:processingStatus "processed" ;
                           ragno:embedding """[0.1, 0.2, ...]""" ;
                           skos:related <concept1>, <concept2> .
    }
}
WHERE {
    GRAPH <http://tensegrity.it/semem> {
        <semem:ELEMENT_ID> semem:processingStatus "lazy" .
    }
}
```

## Workflow Example

### Complete Bookmark Ingestion Workflow

```bash
# Step 1: Dry run to preview
node utils/BookmarkIngest.js \
  --endpoint "http://localhost:3030/test/query" \
  --dry-run --limit 5

# Step 2: Lazy ingest all bookmarks (fast - ~167ms per item)
node utils/BookmarkIngest.js \
  --endpoint "http://localhost:3030/test/query" \
  --limit 100 \
  --lazy

# Step 3: Check what was stored
node utils/QueryLazyContent.js --limit 10

# Step 4: Batch augment (process in batches of 10)
node utils/AugmentLazyContent.js --batch-size 10 --limit 100

# Step 5: Verify processing complete
node utils/QueryLazyContent.js  # Should show 0 items
```

**Performance Notes**:
- Phase 1 (lazy storage): ~167ms per bookmark
- Phase 2 (augmentation): ~2-5 seconds per item
- Total time for 100 bookmarks: ~17 seconds (lazy) + ~5 minutes (augment) = ~5.3 minutes
- vs. Full processing: ~100 minutes for 100 bookmarks

## Error Handling

### Failed Augmentation

If augmentation fails for an item, it remains with `processingStatus "lazy"`:

1. Query for lazy items
2. Check logs for failures
3. Retry individual items or fix data issues
4. Re-run augmentation

### Partial Processing

Items can have different processing states:
- `"lazy"` - Stored, not processed
- `"processed"` - Fully augmented with embeddings and concepts
- `"failed"` - Augmentation attempted but failed (TODO: implement)

## Best Practices

1. **Use lazy mode for bulk ingestion** - 360x faster than full processing
2. **Dry run first** - Always preview before ingesting large collections
3. **Batch augmentation** - Process lazy content in small batches (10-20 items)
4. **Monitor progress** - Use QueryLazyContent.js to track remaining items
5. **Handle failures gracefully** - Retry failed augmentations separately

## Implementation Status

### ✅ Completed
- Lazy storage implementation in SPARQLStore
- BookmarkIngest.js with --lazy flag
- QueryLazyContent.js utility
- AugmentLazyContent.js batch processing utility
- SPARQL templates for lazy storage
- Error handling and reporting
- Batch processing with configurable batch size
- Dry-run mode for all utilities
- Filter by type and ID

### 🚧 Future Enhancements
- [ ] Processing status "failed" for persistent error tracking
- [ ] Progress tracking and resume capability for interrupted augmentation
- [ ] Scheduling/cron support for background augmentation
- [ ] Enhanced performance metrics and reporting dashboard
- [ ] Automatic retry logic with exponential backoff

## Related Documentation

- [Tell Verb Documentation](./tell.md) - MCP tell operation with lazy option
- [Augment Verb Documentation](./augment.md) - MCP augment operation
- [SPARQL Service](./sparql-service.md) - SPARQL store operations
- [Bookmark Ingestion](../postcraft/content/raw/entries/2025-09-30_claude_bookmark-ingestion.md) - Implementation details