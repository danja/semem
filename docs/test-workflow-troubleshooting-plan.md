# Test Workflow Troubleshooting Plan

## Overview

The test workflow in `docs/test-workflow.md` describes a complete document ingestion and questioning flow that should demonstrate context-aware responses. However, the individual operations appear to work but don't produce the expected end-to-end results. This plan outlines systematic troubleshooting steps.

## Enhanced Logging Added

### Console Logging Locations

1. **Chunking Operations** (`mcp/tools/simple-verbs.js`):
   - Document discovery and SPARQL querying
   - Individual document processing
   - Chunk generation and storage
   - SPARQL update execution

2. **Question Answering Flow** (`src/services/context/HybridContextManager.js`):
   - Query processing initiation
   - Concurrent search execution (enhancements + local context)
   - Adaptive search with ZPT state
   - Response synthesis

### Workbench Console Output

The workbench UI already has extensive logging through:
- `ConsoleComponent.js` for structured logging
- Browser console for real-time debugging
- API operation tracking with timestamps

## Troubleshooting Steps

### 1. Verify Document Ingestion
Run the ingestion command and verify documents are stored:

```bash
node examples/ingestion/SPARQLIngest.js --endpoint "https://fuseki.hyperdata.it/danny.ayers.name/query" --template blog-articles --limit 5
```

**Check:**
- Documents successfully ingested into SPARQL store
- Content length and structure
- Graph URI consistency

### 2. Test Chunking Operation

Using the workbench UI:
1. Navigate to Augment section
2. Select "Chunk Documents" operation
3. Monitor console output for:
   - `🔄 [CHUNK_DOCUMENTS] Finding unprocessed text elements...`
   - `✅ [CHUNK_DOCUMENTS] Found text elements to process: X`
   - `🧩 [CHUNK_DOCUMENTS] Processing document: URI (X chars)`
   - `✂️ [CHUNK_DOCUMENTS] Created X chunks`
   - `💾 [CHUNK_DOCUMENTS] Storing chunks to SPARQL...`
   - `✅ [CHUNK_DOCUMENTS] Successfully stored X chunks with embeddings`

**Troubleshoot if failing:**
- Check SPARQL endpoint connectivity
- Verify authentication credentials
- Examine chunk generation logic
- Confirm embedding generation

### 3. Test Question Answering

Ask the question "What is ADHD?" and monitor console output:

#### Expected Console Flow:
1. **Query Initiation:**
   - `🔥 [HYBRID_CONTEXT] Starting query processing`

2. **Concurrent Search:**
   - `🚀 [HYBRID_CONTEXT] Starting concurrent search for enhancements and local context`
   - `🔍 [HYBRID_CONTEXT] Starting adaptive local context search`
   - `🎯 [HYBRID_CONTEXT] Executing adaptive search with ZPT state`

3. **Search Completion:**
   - `✅ [HYBRID_CONTEXT] Adaptive search completed`
   - `🚀 [HYBRID_CONTEXT] Concurrent search completed`

4. **Response Synthesis:**
   - `🤝 [HYBRID_CONTEXT] Synthesizing unified response`
   - `✅ [HYBRID_CONTEXT] Response synthesis completed`

### 4. Diagnostic Queries

If the workflow fails, run these diagnostic queries:

#### Check Chunked Documents
```sparql
PREFIX ragno: <http://purl.org/stuff/ragno/>
SELECT (COUNT(*) as ?count) WHERE {
  GRAPH <http://hyperdata.it/content> {
    ?s a ragno:Unit ;
       ragno:content ?content ;
       ragno:hasEmbedding ?embedding .
  }
}
```

#### Check Text Elements
```sparql
PREFIX ragno: <http://purl.org/stuff/ragno/>
SELECT ?uri ?content WHERE {
  GRAPH <http://hyperdata.it/content> {
    ?uri a ragno:TextElement ;
         ragno:content ?content .
  }
} LIMIT 5
```

#### Check Embeddings
```sparql
PREFIX ragno: <http://purl.org/stuff/ragno/>
SELECT (COUNT(*) as ?count) WHERE {
  GRAPH <http://hyperdata.it/content> {
    ?s ragno:hasEmbedding ?embedding .
  }
}
```

### 5. Common Failure Points

#### A. Chunking Issues
- **Symptom:** No chunks created despite documents found
- **Check:** Document content length vs `minContentLength` setting
- **Fix:** Adjust chunking parameters or verify document content

#### B. Embedding Generation
- **Symptom:** Chunks created but no embeddings
- **Check:** Ollama service running and model availability
- **Fix:** `ollama list` to verify `nomic-embed-text` model

#### C. Context Search Issues
- **Symptom:** No context found for questions
- **Check:** Embedding similarity thresholds
- **Fix:** Review AdaptiveSearchEngine configuration

#### D. Response Generation
- **Symptom:** Context found but no coherent answer
- **Check:** LLM service availability and prompt structure
- **Fix:** Verify chat model availability and response synthesis

### 6. End-to-End Verification

**Success Criteria:**
1. Documents ingested and visible in SPARQL
2. Chunking operation creates searchable units with embeddings
3. Question "What is ADHD?" finds relevant context from ingested documents
4. Response contains specific information from the original documents
5. Console logs show successful completion of all steps

### 7. Additional Debugging Tools

#### Enable Debug Mode
```bash
export MCP_DEBUG=true
export MCP_DEBUG_LEVEL=debug
```

#### SPARQL Query Testing
Use Fuseki web interface to manually test queries:
- https://fuseki.hyperdata.it/#/dataset/danny.ayers.name/query

#### Browser DevTools
- Network tab to monitor API calls
- Console tab for JavaScript errors
- Application tab to check local storage/session

## Expected Outcome

After successful troubleshooting, the complete workflow should:
1. Ingest 5 blog articles from the specified endpoint
2. Create searchable chunks with embeddings
3. Answer "What is ADHD?" with context from the ingested articles
4. Display specific information that can be traced back to the source documents

The enhanced console logging will provide visibility into each step of the process, making it easier to identify where the workflow breaks down and implement targeted fixes.