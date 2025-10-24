# Claude : Manual Documentation Ingestion - Diagnosis and Issues

**Date:** 2025-10-24
**Status:** Issues Identified, Awaiting Fix

## Summary

Created `utils/IngestManual.js` to ingest markdown documentation into Semem. The HTTP ingestion worked (files were POSTed successfully), but the digestion failed - data wasn't actually stored in SPARQL, and metadata (especially titles) wasn't preserved properly.

## What Was Built

### 1. Plan Document (`docs/SELF-DOC-PLAN.md`)
Comprehensive implementation plan including:
- CLI argument design using Node's built-in `parseArgs`
- HTTP integration via `/tell` endpoint
- Recursive markdown file discovery
- Retry logic with exponential backoff
- Progress tracking and summary statistics

### 2. Ingestion Utility (`utils/IngestManual.js`)
Complete CLI tool with:
- **Arguments**: `--host`, `--dir`, `--dry-run`, `--verbose`, `--help`
- **Features**:
  - Recursive `.md` file discovery
  - Title extraction from first `#` header
  - HTTP POST to `/tell` endpoint with metadata
  - Retry with exponential backoff (3 attempts)
  - Progress tracking and error reporting
- **File made executable** with proper shebang

### 3. Test Run
Successfully ingested files from `docs/manual/`:
- Files discovered: 53 markdown documents
- HTTP POSTs returned success
- BUT: No actual data in SPARQL store

## Issues Discovered

### Issue #1: Metadata Not Preserved (Title shows as "Untitled")

**Evidence:**
```bash
curl http://localhost:4101/tell -X POST \
  -H "Content-Type: application/json" \
  -d '{"content":"test content","type":"document","metadata":{"title":"Test Doc"}}'
```

**Response shows:**
- `"metadata":{}` - metadata object is empty!
- `"prompt":"Document: Untitled"` - title not extracted from metadata

**Root Cause** (`src/mcp/tools/verbs/strategies/tell/DocumentTellStrategy.js:63`):
```javascript
const prompt = `Document: ${metadata.title || 'Untitled'}`;
```
The metadata IS being read, but the response doesn't include it properly. Metadata is passed to `storeInteraction()` but not returned in the response structure.

### Issue #2: No Synthesis from Retrieved Chunks

When asking "what is Semem?", the system responds:
> "Based on the given memory context, I see that you have a series of documents labeled as 'Untitled' with a chunk number ranging from 12 to 3. Unfortunately, the memory context doesn't provide any information about the content of these documents."

**This indicates:**
1. Chunks ARE being retrieved (numbered 3-12)
2. But chunks are labeled "Untitled" (Issue #1)
3. **Most critically**: The LLM is not synthesizing content from the chunks

**Root Cause** (`src/mcp/tools/verbs/commands/AskCommand.js:276-278`):
```javascript
const contextText = searchResults.map(result =>
  result.content || result.prompt || result.response
).join('\n\n');
```

The context extraction is looking for `content`, `prompt`, or `response` fields. Need to verify what fields the SPARQL store actually returns for chunks.

### Issue #3: Data Not Actually Stored in SPARQL

**Evidence:**
```bash
curl -s "http://localhost:3030/semem/query" \
  --data-urlencode "query=SELECT ?s ?p ?o WHERE { ?s <http://purl.org/stuff/sem/prompt> ?prompt } LIMIT 5" \
  -H "Accept: application/sparql-results+json"
```

**Result:** Empty! No data in SPARQL store despite tell endpoint returning `"success":true`.

**Configuration** (`config/config.json:2-12`):
```json
{
  "storage": {
    "type": "sparql",
    "options": {
      "query": "http://localhost:3030/semem/sparql",
      "update": "http://localhost:3030/semem/update",
      "data": "http://localhost:3030/semem/data",
      "graphName": "http://hyperdata.it/content"
    }
  }
}
```

**Hypothesis:** The tell operation is storing to session cache (`"sessionCached":true` in response) but NOT persisting to SPARQL. This could be:
- A bug in MemoryManager's `storeInteraction()` method
- Storage backend not properly initialized
- Write operation silently failing

## Impact Analysis

| Issue | Severity | Impact |
|-------|----------|--------|
| Metadata not preserved | **High** | User can't identify which document chunks came from |
| No content synthesis | **Critical** | System is completely non-functional for answering questions |
| No SPARQL persistence | **Critical** | Data is lost after session ends; system appears to work but doesn't |

## Next Steps

### Immediate Fixes Needed

1. **Fix SPARQL Persistence** (CRITICAL)
   - Investigate `MemoryManager.storeInteraction()` at `src/MemoryManager.js`
   - Check if `SPARQLStore` write operations are actually being called
   - Verify SPARQL UPDATE endpoint is accessible and accepting data
   - Add logging to trace where data flow stops

2. **Fix Metadata Preservation** (HIGH)
   - Ensure metadata (especially `title`) flows through:
     - HTTP endpoint → SimpleVerbsService → TellCommand → DocumentTellStrategy → storeInteraction
   - Store metadata in SPARQL with dcterms:title predicate
   - Include title in chunk metadata: `metadata.title || 'Untitled'` should never be 'Untitled'

3. **Fix Context Retrieval** (HIGH)
   - Verify what fields SPARQL store returns for memory items
   - Update `AskCommand.js:276-278` to correctly extract chunk content
   - Ensure chunks include reference to parent document title
   - Test synthesis with real document chunks

### Testing Strategy

1. **Unit test SPARQL persistence**:
   ```javascript
   // Store test content
   await tell({ content: "test", type: "document", metadata: { title: "Test Title" } });

   // Verify in SPARQL
   const results = await sparqlQuery("SELECT ?title WHERE { ?s dcterms:title ?title }");
   assert(results.includes("Test Title"));
   ```

2. **Integration test full cycle**:
   ```bash
   # Ingest document
   ./utils/IngestManual.js --dir test-docs/

   # Query and verify synthesis
   curl http://localhost:4101/ask -X POST \
     -d '{"question":"what is in the test document?","mode":"standard"}'

   # Should return synthesized answer from document content
   ```

3. **End-to-end workbench test**:
   - Navigate to workbench UI
   - Ask question about ingested documentation
   - Verify proper answer with source attribution

## Files Modified/Created

- ✅ `docs/SELF-DOC-PLAN.md` - Implementation plan
- ✅ `utils/IngestManual.js` - Ingestion utility (works, but exposes backend bugs)
- ⚠️  MCP tell/ask flow - Works for simple cases, fails for chunked documents
- ❌ SPARQL persistence - Appears broken or not properly initialized

## Lessons Learned

1. **Surface-level success can mask deeper failures**: The tell endpoint returns success but doesn't actually persist data
2. **Metadata flow is fragile**: Title metadata gets lost somewhere in the tell strategy pipeline
3. **Integration testing is essential**: Need tests that verify SPARQL persistence, not just API responses
4. **Context extraction assumptions**: Can't assume field names without checking what SPARQL returns

## References

- `src/mcp/tools/verbs/strategies/tell/DocumentTellStrategy.js` - Chunking and storage logic
- `src/mcp/tools/verbs/commands/AskCommand.js` - Context retrieval and synthesis
- `src/mcp/lib/safe-operations.js` - Storage wrapper methods
- `src/services/memory/MemoryDomainManager.js` - Memory retrieval logic
- `src/MemoryManager.js` - Core storage coordination

---

**Next Action:** User needs to decide priority - fix SPARQL persistence first (so data actually persists), or fix metadata/synthesis (so retrieval works properly). Both are critical for a functional system.
