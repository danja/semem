# ZPT Subsystem: Comprehensive Technical Analysis

## Overview

The ZPT (Zoom, Pan, Tilt) subsystem is a sophisticated 3-dimensional navigation system for intelligent knowledge graph exploration within Semem. It provides a unified interface for traversing and extracting information from complex knowledge structures using intuitive spatial metaphors borrowed from camera and mapping systems.

The name "ZPT" reflects the three primary dimensions of navigation:
- **Zoom**: Controls the level of abstraction (detailed → summary → overview)
- **Pan**: Manages content filtering and domain focus (narrow → broad scope)
- **Tilt**: Adjusts representation style and perspective (technical → conversational)

## Architecture Philosophy

### Core Design Principles

1. **3-Dimensional Navigation**: Unlike traditional linear or hierarchical navigation, ZPT provides true 3D movement through knowledge space
2. **Parameter-Driven Behavior**: All operations are controlled through validated parameters, ensuring consistent and predictable results
3. **Stateless Operation**: Each request is self-contained, enabling scaling and caching without session management
4. **Multi-Strategy Selection**: Supports multiple algorithms for content selection based on context and requirements
5. **LLM-Optimized Output**: All transformations are designed for optimal consumption by language models

### System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    ZPT Navigation System                        │
├─────────────────────────────────────────────────────────────────┤
│  REST API → Parameter Processing → Selection → Transformation   │
│      ↓              ↓                 ↓            ↓            │
│  Validation → Filter Building → Corpuscle → Token-Aware        │
│  Rate Limit   Schema Check    Selection    Formatting          │
│  Error Handle Authentication  Algorithm    Chunking            │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                 Knowledge Graph Integration                     │
├─────────────────────────────────────────────────────────────────┤
│  Ragno Store ↔ SPARQL Query ↔ Memory Manager ↔ LLM Handler    │
│       ↓           ↓              ↓                ↓            │
│  Entity/Unit → Graph Traversal → Context Window → Embedding   │
│  Relationship   Connectivity     Management        Similarity  │
│  Corpus        Temporal Filter   Token Counting   Vector Ops   │
└─────────────────────────────────────────────────────────────────┘
```

## Core ZPT Components

### 1. Parameter Processing Layer

**Location**: `src/zpt/ParameterProcessor.js`

The parameter processor handles all incoming navigation requests, providing validation, normalization, and preparation for the selection layer.

**Key Features**:
- **Schema Validation**: Ensures all parameters conform to expected types and ranges
- **Filter Construction**: Builds complex filter objects from simple parameter inputs
- **Selection Criteria**: Translates navigation parameters into selection algorithms
- **Error Handling**: Provides detailed error messages for invalid parameter combinations

**Parameter Schema**:
```javascript
const ZPT_SCHEMA = {
    zoom: {
        type: 'string',
        enum: ['micro', 'detail', 'focus', 'context', 'overview', 'macro'],
        default: 'focus',
        description: 'Level of abstraction for content selection'
    },
    pan: {
        type: 'object',
        properties: {
            domains: { type: 'array', items: { type: 'string' } },
            keywords: { type: 'array', items: { type: 'string' } },
            temporal: { type: 'object', properties: { start: 'date', end: 'date' } },
            entities: { type: 'array', items: { type: 'string' } }
        }
    },
    tilt: {
        type: 'string',
        enum: ['technical', 'analytical', 'narrative', 'conversational', 'summary'],
        default: 'analytical',
        description: 'Output representation style'
    }
}
```

**Validation Process**:
```javascript
// Parameter validation and normalization
validateParameters(params) {
    const validated = {};
    
    // Zoom validation
    if (!ZOOM_LEVELS.includes(params.zoom)) {
        throw new ValidationError(`Invalid zoom level: ${params.zoom}`);
    }
    validated.zoom = params.zoom;
    
    // Pan validation
    validated.pan = this.validatePanParameters(params.pan);
    
    // Tilt validation
    validated.tilt = this.validateTiltParameters(params.tilt);
    
    return validated;
}
```

### 2. Selection Layer

**Location**: `src/zpt/SelectionEngine.js`

The selection engine implements multiple strategies for choosing relevant content from the knowledge graph based on zoom, pan, and tilt parameters.

**Selection Strategies**:

#### A) Embedding Similarity Strategy
```javascript
async selectByEmbeddingSimilarity(query, zoom, pan) {
    const queryEmbedding = await this.embeddingHandler.generateEmbedding(query);
    const candidates = await this.ragnoStore.findSimilarElements(
        queryEmbedding, 
        this.getZoomLimit(zoom),
        this.getPanFilters(pan)
    );
    
    return this.rankBySimilarity(candidates, queryEmbedding);
}
```

#### B) Keyword Matching Strategy
```javascript
async selectByKeywordMatching(keywords, zoom, pan) {
    const sparqlQuery = this.buildKeywordQuery(keywords, zoom, pan);
    const results = await this.sparqlStore.query(sparqlQuery);
    
    return this.rankByRelevance(results, keywords);
}
```

#### C) Graph Connectivity Strategy
```javascript
async selectByConnectivity(entities, zoom, pan) {
    const graph = await this.ragnoStore.getSubgraph(entities, zoom);
    const connected = this.traverseGraph(graph, this.getTraversalDepth(zoom));
    
    return this.filterByPan(connected, pan);
}
```

#### D) Temporal Sequencing Strategy
```javascript
async selectByTemporal(timeRange, zoom, pan) {
    const temporal = await this.ragnoStore.getTemporalElements(timeRange);
    const sequenced = this.orderByTime(temporal);
    
    return this.applyZoomLevel(sequenced, zoom);
}
```

**Zoom Level Mapping**:
```javascript
const ZOOM_MAPPINGS = {
    'micro': {
        maxElements: 5,
        types: ['ragno:TextElement'],
        detail: 'maximum',
        abstraction: 'none'
    },
    'detail': {
        maxElements: 15,
        types: ['ragno:Unit', 'ragno:TextElement'],
        detail: 'high',
        abstraction: 'minimal'
    },
    'focus': {
        maxElements: 25,
        types: ['ragno:Unit', 'ragno:Entity', 'ragno:Relationship'],
        detail: 'medium',
        abstraction: 'moderate'
    },
    'context': {
        maxElements: 50,
        types: ['ragno:Entity', 'ragno:Attribute', 'ragno:CommunityElement'],
        detail: 'medium',
        abstraction: 'moderate'
    },
    'overview': {
        maxElements: 20,
        types: ['ragno:Attribute', 'ragno:CommunityElement'],
        detail: 'low',
        abstraction: 'high'
    },
    'macro': {
        maxElements: 10,
        types: ['ragno:CommunityElement'],
        detail: 'minimal',
        abstraction: 'maximum'
    }
};
```

### 3. Transformation Layer

**Location**: `src/zpt/ContentTransformer.js`

The transformation layer converts selected content into the appropriate format based on tilt parameters and output requirements.

**Token-Aware Chunking Strategies**:

#### Strategy 1: Hierarchical Chunking
```javascript
async hierarchicalChunk(content, maxTokens) {
    const hierarchy = this.buildContentHierarchy(content);
    const chunks = [];
    let currentTokens = 0;
    
    for (const section of hierarchy) {
        const sectionTokens = await this.countTokens(section);
        if (currentTokens + sectionTokens <= maxTokens) {
            chunks.push(section);
            currentTokens += sectionTokens;
        } else {
            // Recursively chunk large sections
            const subChunks = await this.hierarchicalChunk(section, maxTokens - currentTokens);
            chunks.push(...subChunks);
            break;
        }
    }
    
    return chunks;
}
```

#### Strategy 2: Semantic Boundary Chunking
```javascript
async semanticChunk(content, maxTokens) {
    const boundaries = await this.llmHandler.identifySemanticBoundaries(content);
    const chunks = [];
    let currentChunk = [];
    let currentTokens = 0;
    
    for (const segment of boundaries) {
        const segmentTokens = await this.countTokens(segment);
        if (currentTokens + segmentTokens <= maxTokens) {
            currentChunk.push(segment);
            currentTokens += segmentTokens;
        } else {
            chunks.push(currentChunk.join('\n'));
            currentChunk = [segment];
            currentTokens = segmentTokens;
        }
    }
    
    if (currentChunk.length > 0) {
        chunks.push(currentChunk.join('\n'));
    }
    
    return chunks;
}
```

**Tilt Transformation Patterns**:

#### Technical Tilt
```javascript
transformTechnical(content) {
    return {
        format: 'structured',
        sections: this.extractTechnicalSections(content),
        metadata: this.extractMetadata(content),
        references: this.extractReferences(content),
        diagrams: this.extractDiagrams(content)
    };
}
```

#### Conversational Tilt
```javascript
async transformConversational(content) {
    const prompt = `Convert the following technical content into a conversational format 
    suitable for natural dialogue, maintaining accuracy while improving readability:
    
    ${content}`;
    
    return await this.llmHandler.generateResponse(prompt);
}
```

#### Narrative Tilt
```javascript
async transformNarrative(content) {
    const elements = this.extractNarrativeElements(content);
    const timeline = this.buildTimeline(elements);
    const story = await this.constructNarrative(timeline);
    
    return {
        narrative: story,
        timeline: timeline,
        characters: elements.entities,
        events: elements.events
    };
}
```

### 4. API Layer

**Location**: `src/zpt/ZPTServer.js`

The API layer provides RESTful endpoints for external access to ZPT functionality with comprehensive error handling, rate limiting, and metrics collection.

**Endpoint Architecture**:

#### 1. Primary Navigation Endpoint
```javascript
// POST /zpt/navigate
{
    "query": "artificial intelligence research",
    "zoom": "focus",
    "pan": {
        "domains": ["technology", "research"],
        "temporal": {
            "start": "2020-01-01",
            "end": "2024-12-31"
        }
    },
    "tilt": "analytical",
    "maxTokens": 4000,
    "format": "structured"
}
```

#### 2. Preview Endpoint
```javascript
// GET /zpt/preview
// Returns available navigation options for a given query
{
    "availableZooms": ["micro", "detail", "focus", "context"],
    "availableDomains": ["technology", "science", "business"],
    "contentCounts": {
        "micro": 5,
        "detail": 15,
        "focus": 25
    }
}
```

#### 3. Options Endpoint
```javascript
// GET /zpt/options
// Returns full parameter schema and configuration
{
    "schema": { /* ZPT_SCHEMA */ },
    "defaults": { /* default values */ },
    "limits": { /* rate limits and constraints */ }
}
```

**Rate Limiting Implementation**:
```javascript
class RateLimiter {
    constructor(maxRequests = 100, windowMs = 60000) {
        this.maxRequests = maxRequests;
        this.windowMs = windowMs;
        this.requests = new Map();
    }
    
    checkLimit(clientId) {
        const now = Date.now();
        const clientRequests = this.requests.get(clientId) || [];
        
        // Clean old requests
        const validRequests = clientRequests.filter(
            time => now - time < this.windowMs
        );
        
        if (validRequests.length >= this.maxRequests) {
            throw new RateLimitError(`Rate limit exceeded: ${this.maxRequests} requests per minute`);
        }
        
        validRequests.push(now);
        this.requests.set(clientId, validRequests);
    }
}
```

## Key Algorithms and Processing Strategies

### 1. Multi-Modal Content Selection

**Algorithm**: Hybrid Selection with Weighted Scoring

```javascript
async selectContent(query, zoom, pan, tilt) {
    // Parallel execution of multiple strategies
    const [
        embeddingResults,
        keywordResults,
        graphResults,
        temporalResults
    ] = await Promise.all([
        this.selectByEmbeddingSimilarity(query, zoom, pan),
        this.selectByKeywordMatching(this.extractKeywords(query), zoom, pan),
        this.selectByConnectivity(this.extractEntities(query), zoom, pan),
        this.selectByTemporal(this.extractTimeRange(pan), zoom, pan)
    ]);
    
    // Weighted combination based on zoom level
    const weights = this.getWeights(zoom);
    const combined = this.combineResults([
        { results: embeddingResults, weight: weights.embedding },
        { results: keywordResults, weight: weights.keyword },
        { results: graphResults, weight: weights.graph },
        { results: temporalResults, weight: weights.temporal }
    ]);
    
    // Apply tilt-specific filtering
    return this.applyTiltFiltering(combined, tilt);
}
```

**Weight Calculation by Zoom Level**:
```javascript
const ZOOM_WEIGHTS = {
    'micro': { embedding: 0.8, keyword: 0.6, graph: 0.4, temporal: 0.2 },
    'detail': { embedding: 0.7, keyword: 0.8, graph: 0.5, temporal: 0.3 },
    'focus': { embedding: 0.6, keyword: 0.7, graph: 0.7, temporal: 0.4 },
    'context': { embedding: 0.5, keyword: 0.6, graph: 0.8, temporal: 0.6 },
    'overview': { embedding: 0.4, keyword: 0.5, graph: 0.6, temporal: 0.8 },
    'macro': { embedding: 0.3, keyword: 0.4, graph: 0.5, temporal: 0.9 }
};
```

### 2. Adaptive Token Management

**Algorithm**: Dynamic Token Allocation Based on Content Importance

```javascript
async allocateTokens(content, maxTokens, zoom, tilt) {
    // Calculate importance scores for each content piece
    const scored = await Promise.all(
        content.map(async item => ({
            ...item,
            importance: await this.calculateImportance(item, zoom, tilt)
        }))
    );
    
    // Sort by importance
    scored.sort((a, b) => b.importance - a.importance);
    
    // Allocate tokens based on importance
    const allocated = [];
    let remainingTokens = maxTokens;
    
    for (const item of scored) {
        const itemTokens = await this.countTokens(item.content);
        
        if (itemTokens <= remainingTokens) {
            allocated.push(item);
            remainingTokens -= itemTokens;
        } else if (remainingTokens > 100) {
            // Try to fit a summary
            const summary = await this.generateSummary(item.content, remainingTokens);
            allocated.push({ ...item, content: summary });
            break;
        } else {
            break;
        }
    }
    
    return allocated;
}
```

### 3. Context-Aware Transformation

**Algorithm**: Tilt-Specific Content Adaptation

```javascript
async applyTilt(content, tilt, context) {
    const transformer = this.getTiltTransformer(tilt);
    const adapted = [];
    
    for (const item of content) {
        const transformed = await transformer.transform(item, context);
        
        // Apply tilt-specific post-processing
        const postProcessed = await this.postProcessForTilt(transformed, tilt);
        
        adapted.push(postProcessed);
    }
    
    return this.assembleFinalOutput(adapted, tilt);
}
```

## Integration with Semem Ecosystem

### 1. Memory Manager Integration

**Pattern**: Bidirectional Memory Sync

```javascript
class ZPTMemoryIntegration {
    constructor(memoryManager, zptEngine) {
        this.memoryManager = memoryManager;
        this.zptEngine = zptEngine;
    }
    
    async storeNavigationResult(query, params, result) {
        // Store navigation result as memory item
        const memoryItem = {
            prompt: query,
            response: result.content,
            context: result.context,
            metadata: {
                zoom: params.zoom,
                pan: params.pan,
                tilt: params.tilt,
                timestamp: new Date().toISOString(),
                tokenCount: result.tokenCount
            }
        };
        
        await this.memoryManager.store(memoryItem);
    }
    
    async retrieveRelevantMemory(query, params) {
        // Use memory to inform navigation
        const memories = await this.memoryManager.retrieve(query, {
            limit: 10,
            similarity: 0.7
        });
        
        return memories.filter(memory => 
            this.isContextuallyRelevant(memory.metadata, params)
        );
    }
}
```

### 2. SPARQL Store Integration

**Pattern**: Optimized Query Construction

```javascript
class ZPTSPARQLIntegration {
    buildZoomQuery(zoom, pan, entities) {
        const zoomConfig = ZOOM_MAPPINGS[zoom];
        
        return `
            PREFIX ragno: <http://purl.org/stuff/ragno/>
            PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
            
            SELECT DISTINCT ?element ?type ?content ?score WHERE {
                # Type filtering based on zoom level
                VALUES ?type { ${zoomConfig.types.map(t => `<${t}>`).join(' ')} }
                ?element a ?type .
                
                # Content requirement
                ?element ragno:content ?content .
                
                # Entity filtering for pan
                ${this.buildEntityFilter(entities)}
                
                # Domain filtering for pan
                ${this.buildDomainFilter(pan.domains)}
                
                # Temporal filtering for pan
                ${this.buildTemporalFilter(pan.temporal)}
                
                # Scoring based on various factors
                OPTIONAL { ?element semem:frequency ?freq }
                OPTIONAL { ?element ragno:hasWeight ?weight }
                BIND(COALESCE(?freq, 0) + COALESCE(?weight, 0) AS ?score)
            }
            ORDER BY DESC(?score)
            LIMIT ${zoomConfig.maxElements}
        `;
    }
}
```

### 3. LLM Handler Integration

**Pattern**: Context-Aware LLM Operations

```javascript
class ZPTLLMIntegration {
    async generateContextualResponse(content, tilt, originalQuery) {
        const tiltPrompt = this.getTiltPrompt(tilt);
        const contextPrompt = `
            ${tiltPrompt}
            
            Original Query: ${originalQuery}
            
            Content to Transform:
            ${content}
            
            Instructions:
            - Maintain factual accuracy
            - Apply the ${tilt} perspective consistently
            - Ensure coherent flow between sections
            - Include relevant connections and relationships
        `;
        
        return await this.llmHandler.generateResponse(contextPrompt, {
            temperature: this.getTiltTemperature(tilt),
            maxTokens: this.calculateMaxTokens(content.length),
            context: this.buildLLMContext(content)
        });
    }
}
```

### 4. MCP Server Integration

**Pattern**: Protocol-Compliant Service Exposure

```javascript
class ZPTMCPIntegration {
    async handleMCPRequest(request) {
        switch (request.method) {
            case 'zpt/navigate':
                return await this.handleNavigate(request.params);
                
            case 'zpt/preview':
                return await this.handlePreview(request.params);
                
            case 'zpt/schema':
                return this.getSchema();
                
            default:
                throw new Error(`Unknown ZPT method: ${request.method}`);
        }
    }
    
    async handleNavigate(params) {
        const validated = this.validateParams(params);
        const result = await this.zptEngine.navigate(
            validated.query,
            validated.zoom,
            validated.pan,
            validated.tilt
        );
        
        return {
            content: result.content,
            metadata: result.metadata,
            tokens: result.tokenCount,
            timestamp: new Date().toISOString()
        };
    }
}
```

## Configuration and Usage Patterns

### 1. Configuration Schema

**File**: `config/zpt-config.json`

```json
{
    "zpt": {
        "version": "1.0.0",
        "server": {
            "port": 3003,
            "host": "localhost",
            "maxConcurrentRequests": 10,
            "requestTimeout": 30000
        },
        "rateLimit": {
            "maxRequests": 100,
            "windowMs": 60000,
            "keyGenerator": "ip"
        },
        "zoom": {
            "levels": ["micro", "detail", "focus", "context", "overview", "macro"],
            "default": "focus",
            "tokenLimits": {
                "micro": 500,
                "detail": 1500,
                "focus": 3000,
                "context": 5000,
                "overview": 2000,
                "macro": 1000
            }
        },
        "pan": {
            "maxDomains": 5,
            "maxKeywords": 10,
            "maxEntities": 8,
            "temporalRange": {
                "maxYears": 10,
                "defaultRange": "1year"
            }
        },
        "tilt": {
            "styles": ["technical", "analytical", "narrative", "conversational", "summary"],
            "default": "analytical",
            "llmSettings": {
                "technical": { "temperature": 0.1, "structure": "formal" },
                "analytical": { "temperature": 0.3, "structure": "structured" },
                "narrative": { "temperature": 0.7, "structure": "story" },
                "conversational": { "temperature": 0.8, "structure": "dialogue" },
                "summary": { "temperature": 0.2, "structure": "concise" }
            }
        },
        "performance": {
            "caching": {
                "enabled": true,
                "ttl": 3600,
                "maxSize": 1000
            },
            "parallel": {
                "maxWorkers": 4,
                "selectionConcurrency": 3,
                "transformationConcurrency": 2
            }
        }
    }
}
```

### 2. Usage Examples

#### Basic Navigation
```javascript
const zpt = new ZPTEngine(config);

const result = await zpt.navigate('machine learning algorithms', {
    zoom: 'focus',
    pan: {
        domains: ['technology', 'research'],
        temporal: { start: '2020-01-01', end: '2024-12-31' }
    },
    tilt: 'analytical'
});
```

#### Advanced Multi-Parameter Navigation
```javascript
const complexResult = await zpt.navigate('quantum computing applications', {
    zoom: 'context',
    pan: {
        domains: ['physics', 'computing', 'cryptography'],
        keywords: ['quantum', 'entanglement', 'superposition'],
        entities: ['IBM', 'Google', 'quantum-computer'],
        temporal: { start: '2015-01-01' }
    },
    tilt: 'conversational',
    maxTokens: 6000,
    format: 'markdown'
});
```

#### API Usage
```bash
# Navigation request
curl -X POST http://localhost:3003/zpt/navigate \
  -H "Content-Type: application/json" \
  -d '{
    "query": "sustainable energy solutions",
    "zoom": "overview",
    "pan": {
      "domains": ["energy", "environment"],
      "temporal": { "start": "2022-01-01" }
    },
    "tilt": "summary"
  }'

# Preview request
curl -X GET "http://localhost:3003/zpt/preview?query=blockchain%20technology"

# Schema request
curl -X GET http://localhost:3003/zpt/schema
```

### 3. Development Patterns

#### Custom Tilt Implementation
```javascript
class CustomTilt extends BaseTilt {
    constructor(name, config) {
        super(name, config);
    }
    
    async transform(content, context) {
        // Custom transformation logic
        const processed = await this.preProcess(content);
        const styled = await this.applyStyle(processed, context);
        return await this.postProcess(styled);
    }
    
    async applyStyle(content, context) {
        // Implement custom styling logic
        return content;
    }
}

// Register custom tilt
zptEngine.registerTilt('custom', new CustomTilt('custom', customConfig));
```

#### Custom Selection Strategy
```javascript
class CustomSelectionStrategy extends BaseSelectionStrategy {
    async select(query, zoom, pan) {
        // Custom selection logic
        const candidates = await this.getCandidates(query);
        const filtered = this.applyFilters(candidates, pan);
        const ranked = await this.rankByCustomCriteria(filtered, zoom);
        
        return this.limitResults(ranked, zoom);
    }
}

// Register custom strategy
zptEngine.registerSelectionStrategy('custom', new CustomSelectionStrategy());
```

## Performance Characteristics and Optimization

### 1. Caching Strategy

**Multi-Level Caching**:
- **L1 Cache**: Parameter validation results (in-memory, 5-minute TTL)
- **L2 Cache**: Selection results (Redis, 1-hour TTL)
- **L3 Cache**: Transformation results (File system, 24-hour TTL)

### 2. Parallel Processing

**Concurrent Operations**:
- Selection strategies run in parallel
- Transformation operations are batched
- Token counting is asynchronous
- Cache operations are non-blocking

### 3. Resource Management

**Token Optimization**:
- Dynamic token allocation based on content importance
- Intelligent chunking to maximize information density
- Compression of low-priority content
- Streaming output for large results

### 4. Monitoring and Metrics

**Key Metrics**:
- Request rate and response time per endpoint
- Cache hit/miss ratios for each cache level
- Token utilization efficiency
- Selection strategy effectiveness
- Transformation quality scores

## Conclusion

The ZPT subsystem represents a sophisticated approach to knowledge graph navigation that combines intuitive spatial metaphors with advanced AI techniques. Its 3-dimensional navigation model (Zoom, Pan, Tilt) provides users with unprecedented control over how they explore and extract information from complex knowledge structures.

Key strengths include:

1. **Intuitive Interface**: The camera/mapping metaphors make complex navigation accessible
2. **Multi-Strategy Selection**: Combines multiple algorithms for robust content discovery
3. **LLM-Optimized Output**: All transformations are designed for optimal AI consumption
4. **Seamless Integration**: Deep integration with Ragno and broader Semem ecosystem
5. **Performance Optimization**: Multi-level caching and parallel processing for scalability
6. **Extensible Architecture**: Plugin system for custom tilts and selection strategies

The system effectively bridges the gap between human spatial reasoning and AI-powered content processing, providing a powerful platform for building intelligent knowledge exploration tools that can adapt to diverse user needs and contexts.