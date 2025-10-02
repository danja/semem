# Ask Operation Workflow

This document traces the complete workflow of an Ask operation from the Semem workbench UI through all system components to the final response generation.

## Overview

The Ask operation allows users to query stored knowledge using natural language questions. The system supports multiple enhancement modes (HyDE, Wikipedia, Wikidata) and combines semantic search with LLM-generated responses using an advanced hybrid context system with ZPT (Zoom/Pan/Tilt) navigation integration.

## Recent Enhancements (August 2025)

**Major architectural improvements have been implemented:**

1. **Unified Search Architecture**: Intelligent combination of personal context with external enhancements via UnifiedSearchAPI (HTTP) and verb commands (MCP)
2. **Adaptive Search Engine**: Context-aware threshold calculation with multi-pass search and progressive relaxation
3. **Dual-Store Search**: MemoryManager now searches both in-memory store AND SPARQL store for comprehensive results
4. **ZPT Navigation Integration**: Pan filters (domains, keywords, entities, temporal) now influence search thresholds and result prioritization
5. **Improved Context Flow**: Results now properly flow from MemoryManager → AdaptiveSearchEngine → UnifiedSearch → Simple-verbs → UI

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

**File**: `src/mcp/tools/verbs/commands/AskCommand.js`

The Ask operation uses unified search architecture for intelligent context processing:

#### Step 1: Unified Search Invocation
```javascript
// The verb command routes to appropriate search strategy:
// - HTTP API uses UnifiedSearchAPI
// - MCP STDIO uses verb-based command architecture

const result = await this.execute({
  question,
  mode,
  useContext,
  useHyDE,
  useWikipedia,
  useWikidata
});
```

#### Step 2: Context Processing Flow

**Within Unified Search System**:

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

#### Path A: Unified Search Processing (Default Mode)
```
UI → API → MCP → SimpleVerbs → UnifiedSearch/VerbCommands → {
  Enhancement Search (Wikidata/Wikipedia/HyDE) +
  AdaptiveSearchEngine → MemoryManager → [MemoryStore + SPARQLStore]
} → Unified Response
```
- **Combines** external knowledge WITH local context
- Uses context-aware adaptive thresholds
- Multi-pass search with ZPT filtering
- Search method: "unified_search"
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

**Solution Implemented**: The unified search architecture intelligently combines both sources:

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
  "searchMethod": "unified_search",
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

✅ **Unified Search Architecture**: ✅ COMPLETED - UnifiedSearchAPI and verb commands combine external knowledge with local context
✅ **Context Weighting**: ✅ COMPLETED - Intelligent context analysis and weighting based on query relevance
✅ **Fallback Logic**: ✅ COMPLETED - Multiple fallback paths ensure robust operation
✅ **Adaptive Thresholds**: ✅ COMPLETED - Context-aware threshold calculation with ZPT integration
✅ **Multi-Pass Search**: ✅ COMPLETED - Progressive threshold relaxation for comprehensive results
✅ **Dual-Store Search**: ✅ COMPLETED - MemoryManager searches both memory and SPARQL stores  

## Concept-Following Enhancement (Planned)

The Ask tool is being enhanced with intelligent concept-following capabilities that automatically discover and include related information based on concept relationships stored in the new ragno embedding format.

### Architecture Overview

The enhanced Ask tool will follow this multi-hop navigation flow:

```
User Query → Concept Extraction → Primary Search → Link Discovery → Context Expansion → LLM Generation
```

**Example Flow:**
```
Query: "What is machine learning?"
  ↓
Concepts: ["machine learning", "artificial intelligence"]  
  ↓
Linked Concepts: ["ADHD diagnosis", "neural networks", "deep learning"]
  ↓
Expanded Context: Original content + linked resource content
  ↓
Enhanced Response: "Machine learning is... Additionally, it's being used in areas like ADHD diagnosis..."
```

### Concept Link Discovery Strategies

#### 1. Embedding Similarity Links
- Uses vector embeddings stored in new ragno format: `ragno:hasEmbedding → ragno:vectorContent`
- Finds concepts with high cosine similarity (>0.8 threshold)
- Leverages existing FAISS indexing for fast retrieval

#### 2. Co-occurrence Links
- Discovers concepts mentioned together in documents
- Uses SPARQL queries to find shared contextual relationships
- Builds association networks from document co-mention patterns

#### 3. Explicit Relationship Links
- Follows `ragno:connectsTo` relationships
- Traces entity-relationship-entity patterns
- Uses structured knowledge graph connections

### Enhanced Ask Parameters (Planned)

```javascript
await mcp.ask({
  question: "What is ADHD?",
  mode: "comprehensive",
  useContext: true,
  followConcepts: true,        // NEW: Enable concept-following
  maxDepth: 2,                 // NEW: Maximum link depth
  linkingStrategies: ["embedding", "cooccurrence"], // NEW: Link discovery methods
  maxLinkedConcepts: 10,       // NEW: Limit linked concepts
  relevanceThreshold: 0.7      // NEW: Minimum relevance for links
})
```

### Implementation Components (Planned)

#### ConceptLinker Service
```javascript
class ConceptLinker {
  async findLinkedConcepts(concept, strategies = ['embedding', 'cooccurrence']) {
    // Multi-strategy concept discovery using ragno embeddings
    // Returns array of linked concepts with relevance scores
  }
  
  async discoverRelationships(conceptA, conceptB) {
    // Analyze relationship strength using vector similarity
    // Returns relationship metadata and confidence scores  
  }
  
  async buildConceptGraph(seedConcepts, maxDepth = 2) {
    // Create navigable concept graph from seed concepts
    // Prevents infinite loops and manages recursion depth
  }
}
```

#### ContextExpander Service  
```javascript
class ContextExpander {
  async expandWithLinkedContent(concepts, maxDepth = 2) {
    // Recursively gather content from linked concepts
    // Integrates with existing UnifiedSearch system
  }
  
  async rankRelevance(linkedConcepts, originalQuery) {
    // Score and prioritize concepts using embedding similarity
    // Integrates with AdaptiveSearchEngine thresholds
  }
}
```

### Enhanced Response Format (Planned)

```json
{
  "success": true,
  "verb": "ask", 
  "question": "What is machine learning?",
  "answer": "Machine learning is a subset of AI... It's also being used in ADHD diagnosis research...",
  "searchMethod": "hybrid_context_with_concept_following",
  "conceptsFollowed": [
    {
      "concept": "ADHD diagnosis",
      "linkType": "embedding_similarity", 
      "relevanceScore": 0.85,
      "sourceDocuments": ["doc1.md", "research_paper.pdf"],
      "linkDepth": 1
    }
  ],
  "contextSources": [
    {
      "type": "primary",
      "concepts": ["machine learning", "artificial intelligence"],
      "documentCount": 5
    },
    {
      "type": "linked",
      "concepts": ["ADHD diagnosis", "neural networks"], 
      "documentCount": 3,
      "linkDepth": 1
    }
  ],
  "linkingStrategy": {
    "strategiesUsed": ["embedding", "cooccurrence"],
    "totalLinksFollowed": 4,
    "processingTime": "1.2s"
  }
}
```

### Integration with New Ragno Format

The concept-following enhancement leverages the new ragno embedding storage:

```sparql
# Enhanced concept storage with embeddings
?concept a ragno:Concept ;
         skos:prefLabel "machine learning" ;
         ragno:hasEmbedding ?embeddingUri ;
         dcterms:created "2025-01-27T10:00:00Z"^^xsd:dateTime .

?embeddingUri a ragno:IndexElement ;
              ragno:embeddingModel "nomic-embed-text" ;
              ragno:subType ragno:ConceptEmbedding ;
              ragno:embeddingDimension 1536 ;
              ragno:vectorContent "[0.1,0.2,0.3,...]" .
```

### Performance Optimizations (Planned)

1. **Async Background Processing**: Non-blocking concept discovery
2. **Caching Layer**: In-memory concept relationship cache
3. **Circuit Breaker Pattern**: Graceful degradation when SPARQL is slow
4. **Streaming Expansion**: Real-time concept discovery for better UX

### Implementation Plan

**Phase 1: SPARQL Performance Fixes** (High Priority)
- Resolve initialization timeouts that currently block MCP requests
- Implement connection pooling and async initialization

**Phase 2: Concept Linking Infrastructure** (High Priority)
- Build ConceptLinker and ContextExpander services
- Integrate with existing UnifiedSearch architecture

**Phase 3: Enhanced Ask Implementation** (Medium Priority)
- Add concept-following parameters to Ask operation
- Implement multi-hop concept navigation

**Phase 4: Advanced Features** (Low Priority)
- Concept relationship visualization
- Adaptive link strategy selection
- Interactive concept exploration

## Future Improvements

1. **Concept-Following Enhancement**: Intelligent multi-hop concept navigation using ragno embeddings
2. **Enhancement Debugging**: Better visibility into enhancement decisions and context selection
3. **Performance Optimization**: Cache enhancement results and optimize multi-pass search
4. **Learning System**: Implement threshold learning based on user feedback and result quality
5. **Advanced ZPT**: Temporal filtering and community-based search scoping
6. **Result Ranking**: ML-based result ranking considering user preferences and context relevance
7. **Real-time Concept Updates**: Dynamic concept relationship learning from user interactions