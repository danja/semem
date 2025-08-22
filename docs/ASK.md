# Ask Operation Workflow

This document traces the complete workflow of an Ask operation from the Semem workbench UI through all system components to the final response generation.

## Overview

The Ask operation allows users to query stored knowledge using natural language questions. The system supports multiple enhancement modes (HyDE, Wikipedia, Wikidata) and combines semantic search with LLM-generated responses.

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

### 6. Simple Verbs Service

**File**: `mcp/tools/simple-verbs.js` (lines 641-870)

The main Ask logic with multiple processing steps:

#### Step 1: Enhancement Processing
```javascript
const hasEnhancements = useHyDE || useWikipedia || useWikidata;
if (hasEnhancements && this.enhancementCoordinator) {
  enhancementResult = await this.enhancementCoordinator.enhanceQuery(question, {
    useHyDE, useWikipedia, useWikidata, mode
  });
}
```

**Enhancement Path** (when Wikidata/Wikipedia/HyDE enabled):
- If enhancement succeeds with `enhancedAnswer`, returns immediately
- Search method: `"enhanced_generation"`
- Bypasses local context search

#### Step 2: Embedding Generation
```javascript
const queryEmbedding = await this.safeOps.generateEmbedding(question);
```

#### Step 3: Session Cache Search
```javascript
sessionResults = await this.stateManager.searchSessionCache(question, queryEmbedding, 3, 0.4);
```

#### Step 4: Persistent Storage Search
```javascript
if (sessionResults.length < 3) {
  const searchResults = await this.safeOps.searchSimilar(question, 5, 0.3);
  persistentResults = searchResults || [];
}
```

**Regular Search Path** (no enhancements or enhancement fails):
- Searches session cache first
- Then searches persistent storage (chunks + interactions)
- Search method: `"hybrid_semantic_search"`
- Finds local context from chunked documents

#### Step 5: Response Generation
```javascript
if (allResults.length > 0) {
  const context = allResults.map(r => r.prompt + ': ' + r.response).join('\n\n');
  result.answer = await this.safeOps.generateResponse(question, context);
}
```

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

### 9. Response Flow Paths

#### Path A: Enhanced Response (with Wikidata/Wikipedia/HyDE)
```
UI → API → MCP → SimpleVerbs → EnhancementCoordinator → LLM → Response
```
- Uses external knowledge sources
- Generates complete answer
- **Bypasses local context**
- Search method: "enhanced_generation"

#### Path B: Regular Response (no enhancements or enhancement fails)  
```
UI → API → MCP → SimpleVerbs → SessionCache + SPARQLStore → LLM → Response
```
- Searches local knowledge (chunks + interactions)
- Uses semantic similarity search
- Includes personal/local context
- Search method: "hybrid_semantic_search"

## Key Insights

### Enhancement vs Local Context Issue

Currently, the system treats enhancements and local context as **alternatives** rather than **complementary sources**:

- **With Wikidata**: Gets generic knowledge, misses personal context
- **Without Wikidata**: Gets personal context, misses broader knowledge

### Response Structure

A successful Ask response includes:
```json
{
  "success": true,
  "verb": "ask", 
  "question": "What is ADHD?",
  "answer": "Generated response...",
  "usedContext": true,
  "contextItems": 3,
  "enhancementType": "combined",
  "enhancements": ["wikidata"],
  "searchMethod": "enhanced_generation",
  "zptState": { "zoom": "entity", "pan": {}, "tilt": "keywords" }
}
```

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

## Future Improvements

1. **Hybrid Enhancement**: Combine external knowledge with local context
2. **Context Weighting**: Balance enhancement vs local content
3. **Fallback Logic**: Use local context when enhancements fail
4. **Enhancement Debugging**: Better visibility into enhancement decisions
5. **Performance Optimization**: Cache enhancement results