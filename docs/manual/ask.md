# Ask Operation Workflow

This document traces the complete workflow of an Ask operation from the Semem workbench UI through all system components to the final response generation.

## Overview

The Ask operation allows users to query stored knowledge using natural language questions. The system supports multiple enhancement modes (HyDE, Wikipedia, Wikidata) and combines semantic search with LLM-generated responses using an advanced hybrid context system with ZPT (Zoom/Pan/Tilt) navigation integration.

## Recent Enhancements (August 2025)

**Major architectural improvements have been implemented:**

1. **Enhanced Hybrid Context Processing**: New `HybridContextManager` that intelligently combines personal context with external enhancements
2. **Adaptive Search Engine**: Context-aware threshold calculation with multi-pass search and progressive relaxation  
3. **Dual-Store Search**: MemoryManager now searches both in-memory store AND SPARQL store for comprehensive results
4. **ZPT Navigation Integration**: Pan filters (domains, keywords, entities, temporal) now influence search thresholds and result prioritization
5. **Improved Context Flow**: Results now properly flow from MemoryManager → AdaptiveSearchEngine → HybridContextManager → Simple-verbs → UI

## Complete Workflow

### 1. Workbench UI Layer

**File**: `src/frontend/workbench/public/index.html` (lines 172-238)

The user interacts with the Ask form which includes:
- Question textarea
- Mode selection (basic/standard/comprehensive)
- Context usage checkbox
- Enhancement options (HyDE, Wikipedia, Wikidata)

**Form Structure**:
```html
<form class="verb-form" id="ask-form">
  <textarea id="ask-question" name="question" required></textarea>
  <select id="ask-mode" name="mode">
    <option value="standard" selected>Standard</option>
  </select>
  <input type="checkbox" id="use-context" name="useContext" checked>
  <input type="checkbox" id="use-wikidata" name="useWikidata">
  <!-- ... other enhancement options -->
</form>
```

### 2. JavaScript Event Handling

**File**: `src/frontend/workbench/public/js/workbench.js` (lines 645-675)

When the form is submitted, the `handleAskSubmit` method:
1. Prevents default form submission
2. Extracts form data including enhancement options
3. Shows loading state
4. Calls the ApiService

**Code Flow**:
```javascript
async handleAskSubmit(event) {
  const formData = DomUtils.getFormData(form);
  const result = await apiService.ask({
    question: formData.question,
    mode: formData.mode || 'standard',
    useContext: Boolean(formData.useContext),
    useHyDE: Boolean(formData.useHyDE),
    useWikipedia: Boolean(formData.useWikipedia),
    useWikidata: Boolean(formData.useWikidata)
  });
}
```

### 3. API Service Layer

**File**: `src/frontend/workbench/public/js/services/ApiService.js` (lines 101-113)

The ApiService forwards the request to the MCP HTTP server:

```javascript
async ask({ question, mode = 'standard', useContext = true, useHyDE = false, useWikipedia = false, useWikidata = false }) {
  return this.makeRequest('/ask', {
    method: 'POST',
    body: JSON.stringify({ 
      question, mode, useContext,
      useHyDE, useWikipedia, useWikidata
    })
  });
}
```

### 4. Workbench Server Proxy

**File**: `src/frontend/workbench/server.js` (lines 39-61)

The workbench server proxies `/api/*` requests to the MCP HTTP server:
- Workbench: `http://localhost:4102/api/ask`
- MCP Server: `http://localhost:4101/ask`

### 5. MCP HTTP Server

**File**: `mcp/http-server.js` (lines 291-308)

The HTTP server extracts parameters and forwards to the Simple Verbs Service:

```javascript
app.post('/ask', async (req, res) => {
  const { question, mode = 'standard', useContext = true, useHyDE = false, useWikipedia = false, useWikidata = false } = req.body;
  const result = await simpleVerbsService.ask({ question, mode, useContext, useHyDE, useWikipedia, useWikidata });
  res.json(result);
});
```

### 6. Simple Verbs Service (Enhanced Architecture)

**File**: `mcp/tools/simple-verbs.js` (lines 641-870)

The Ask operation now uses the new **HybridContextManager** for intelligent context processing:

#### Step 1: HybridContextManager Invocation
```javascript
if (useContext && this.hybridContextManager) {
  const hybridResult = await this.hybridContextManager.processQuery(question, {
    useContext: true,
    useHyDE, useWikipedia, useWikidata, mode
  });
  
  if (hybridResult.success) {
    return {
      success: true,
      answer: hybridResult.answer,
      contextItems: hybridResult.localContextResults?.length || 0,
      memories: hybridResult.localContextResults?.length || 0,
      searchMethod: "hybrid_context_processing"
    };
  }
}
```

#### Step 2: Hybrid Context Processing Flow

**Within HybridContextManager**:

1. **Concurrent Search Execution**:
   - Enhancement search (if requested): Wikidata/Wikipedia/HyDE
   - Local context search using `AdaptiveSearchEngine`

2. **AdaptiveSearchEngine Process**:
   ```javascript
   // Dynamic threshold calculation based on query analysis
   const thresholdConfig = await this.thresholdCalculator.calculateOptimalThreshold(
     query, zptState, { passNumber: 1, previousResults: [] }
   );
   
   // Multi-pass search with progressive relaxation
   for (let pass = 1; pass <= maxPasses; pass++) {
     const results = await this.safeOperations.searchSimilar(
       query, searchLimit, currentThreshold
     );
     
     if (results.length >= targetResultCount || pass === maxPasses) {
       return results;
     }
     
     // Relax threshold for next pass
     currentThreshold *= 0.85;
   }
   ```

3. **Dual-Store Search** (within MemoryManager):
   ```javascript
   // Search both memory store and SPARQL store
   const memStoreResults = await this.memStore.retrieve(queryEmbedding, queryConcepts, similarityThreshold, excludeLastN);
   
   let sparqlResults = [];
   if (this.store && typeof this.store.search === 'function') {
     sparqlResults = await this.store.search(queryEmbedding, searchLimit, threshold);
   }
   
   // Combine and deduplicate results
   const combinedResults = [...memStoreResults, ...sparqlResults];
   ```

4. **Context Analysis and Weighting**:
   ```javascript
   const contextAnalysis = this._analyzeContextRelevance(
     query, enhancementResult, localContextResult, zptState
   );
   ```

5. **Intelligent Context Merging**:
   ```javascript
   const mergedContext = this._mergeContexts(
     enhancementResult, localContextResult, contextAnalysis, zptState
   );
   ```

6. **Unified Response Synthesis**:
   ```javascript
   const unifiedResponse = await this._synthesizeResponse(
     query, mergedContext, contextAnalysis, enhancementResult, localContextResult
   );
   ```

#### Step 3: Fallback Mechanisms
- If HybridContextManager fails, falls back to simple context search
- If enhancements fail, continues with local context
- Multiple quality checks ensure robust operation

### 7. Enhancement Coordinator

**File**: `src/services/enhancement/EnhancementCoordinator.js`

When enhancements are requested:
1. Initializes requested services (Wikidata, Wikipedia, HyDE)
2. Processes query through enhancement services
3. Combines results and generates enhanced response
4. Returns complete answer, bypassing local search

### 8. Storage Layer Search

**File**: `src/stores/SPARQLStore.js` (lines 1360-1420)

The search method queries both:
- `ragno:Element` (regular interactions) 
- `ragno:Unit` (document chunks)

```sql
SELECT ?entity ?prompt ?content ?embedding ?timestamp ?type
FROM <http://hyperdata.it/content>
WHERE {
  {
    # Search in regular ragno:Element objects
    ?entity a ragno:Element ;
        skos:prefLabel ?prompt ;
        ragno:content ?content ;
        ragno:embedding ?embedding .
  } UNION {
    # Search in ragno:Unit chunks
    ?entity a ragno:Unit ;
        ragno:content ?content .
    ?entity ragno:hasEmbedding ?embeddingUri .
    ?embeddingUri ragno:vectorContent ?embedding .
  }
}
```

### 9. Enhanced Response Flow Paths

#### Path A: Hybrid Context Processing (NEW - Default Mode)
```
UI → API → MCP → SimpleVerbs → HybridContextManager → {
  Enhancement Search (Wikidata/Wikipedia/HyDE) +
  AdaptiveSearchEngine → MemoryManager → [MemoryStore + SPARQLStore]
} → Unified Response
```
- **Combines** external knowledge WITH local context
- Uses context-aware adaptive thresholds
- Multi-pass search with ZPT filtering
- Search method: "hybrid_context_processing"
- **Result**: Rich responses combining personal and external knowledge

#### Path B: Enhancement-Only Response (Fallback)
```
UI → API → MCP → SimpleVerbs → EnhancementCoordinator → LLM → Response
```
- Uses external knowledge sources only
- Generates complete answer
- **Bypasses local context** (legacy behavior)
- Search method: "enhanced_generation"

#### Path C: Local-Only Response (Fallback)  
```
UI → API → MCP → SimpleVerbs → SessionCache + SPARQLStore → LLM → Response
```
- Searches local knowledge only (chunks + interactions)
- Uses semantic similarity search
- Includes personal/local context only
- Search method: "hybrid_semantic_search"

## Key Insights

### Enhancement vs Local Context Issue (RESOLVED)

**Previous Issue**: The system treated enhancements and local context as **alternatives** rather than **complementary sources**.

**Solution Implemented**: The new **HybridContextManager** intelligently combines both sources:

- **With Wikidata + Local Context**: Gets comprehensive knowledge combining external AND personal sources
- **Fallback Logic**: If one source fails, continues with the other
- **Context Weighting**: Balances enhancement vs local content based on query analysis
- **ZPT Integration**: Pan filters influence search scope and result prioritization

### New Architectural Benefits

1. **Comprehensive Coverage**: Searches both memory store and SPARQL store simultaneously
2. **Adaptive Thresholds**: Context-aware threshold calculation based on query complexity and ZPT state  
3. **Multi-Pass Search**: Progressive threshold relaxation ensures relevant results are found
4. **Enhanced Context Flow**: Results properly flow through all system layers to reach the UI
5. **Intelligent Synthesis**: Combines enhancement and local context for richer responses

### Response Structure (Updated)

A successful Ask response includes:
```json
{
  "success": true,
  "verb": "ask", 
  "question": "radio precursors of earthquakes",
  "answer": "From your experience, you've mentioned several phenomena...",
  "contextItems": 5,
  "sessionResults": 0,
  "persistentResults": 0,
  "memories": 5,
  "searchMethod": "hybrid_context_processing",
  "localContextResults": [
    { "prompt": "Enhancement Query: what precedes earthquakes?", "response": "...", "similarity": 0.776 },
    { "prompt": "Earthquake prediction research", "response": "...", "similarity": 0.721 }
  ],
  "enhancementResults": [],
  "zptState": { "zoom": "entity", "pan": {}, "tilt": "keywords" }
}
```

**Key Changes**:
- `contextItems` and `memories` now show actual count from search results
- `localContextResults` array contains the actual context items found
- `enhancementResults` array contains enhancement service results  
- `searchMethod` indicates which processing path was used

### Configuration Dependencies

The Ask operation requires:
1. **MCP HTTP Server**: Running on port 4101
2. **Workbench Server**: Running on port 4102, proxying to MCP
3. **SPARQL Store**: With chunked documents and embeddings
4. **Enhancement Services**: API keys for external services
5. **LLM Provider**: For response generation
6. **Embedding Provider**: For semantic search

## Debugging Tips

### Check Enhancement Status
```bash
curl -X POST -H "Content-Type: application/json" \
  -d '{"question": "test", "useWikidata": true}' \
  http://localhost:4101/ask
```

### Check Local Context Search  
```bash
curl -X POST -H "Content-Type: application/json" \
  -d '{"question": "test", "useContext": true}' \
  http://localhost:4101/ask
```

### Verify Chunks Exist
```bash
curl -u admin:admin -H "Content-Type: application/sparql-query" \
  -d "SELECT (COUNT(*) as ?count) WHERE { ?chunk a <http://purl.org/stuff/ragno/Unit> }" \
  http://localhost:3030/semem/query
```

## Implemented Improvements (August 2025)

✅ **Hybrid Enhancement**: ✅ COMPLETED - HybridContextManager combines external knowledge with local context  
✅ **Context Weighting**: ✅ COMPLETED - Intelligent context analysis and weighting based on query relevance  
✅ **Fallback Logic**: ✅ COMPLETED - Multiple fallback paths ensure robust operation  
✅ **Adaptive Thresholds**: ✅ COMPLETED - Context-aware threshold calculation with ZPT integration  
✅ **Multi-Pass Search**: ✅ COMPLETED - Progressive threshold relaxation for comprehensive results  
✅ **Dual-Store Search**: ✅ COMPLETED - MemoryManager searches both memory and SPARQL stores  

## Future Improvements

1. **Enhancement Debugging**: Better visibility into enhancement decisions and context selection
2. **Performance Optimization**: Cache enhancement results and optimize multi-pass search
3. **Learning System**: Implement threshold learning based on user feedback and result quality
4. **Advanced ZPT**: Temporal filtering and community-based search scoping
5. **Result Ranking**: ML-based result ranking considering user preferences and context relevance