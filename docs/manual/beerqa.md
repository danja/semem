# BeerQA Workflow Manual

## Overview

BeerQA is a question-answering system that combines semantic web technologies (RDF/SPARQL), vector embeddings, and large language models to provide contextually-augmented answers. The system processes questions through seven sequential stages, building knowledge graphs from Wikipedia data and using Zoom, Pan, Tilt (ZPT) navigation to discover relevant information.

## Architecture

The workflow operates on two primary RDF graphs:
- **BeerQA Graph** (`http://purl.org/stuff/beerqa/test`): Contains questions, their embeddings, and relationships
- **Wikipedia Graph** (`http://purl.org/stuff/wikipedia/test`): Contains Wikipedia-derived corpuscles and content

All RDF resources use the Ragno vocabulary (`http://purl.org/stuff/ragno/`) for consistent semantic modeling.

## Workflow Stages

### Stage 1: Question Initialization

**File**: `examples/beerqa/BeerTestQuestions.js`

**Purpose**: Creates initial question corpuscles in the knowledge graph

**Operations**:
- Generates `ragno:Corpuscle` instances for test questions
- Associates questions with `rdfs:label` containing question text
- Stores questions in the BeerQA graph

**RDF Resources Created**:
```turtle
<question-uri> a ragno:Corpuscle ;
               rdfs:label "How many letters did Tesla send to Morgan?" .
```

**Potential Issues**:
- Questions must be well-formed and specific
- No validation of question quality or answerability

### Stage 2: Question Augmentation

**File**: `examples/beerqa/AugmentQuestion.js`

**Purpose**: Enhances questions with vector embeddings and extracted concepts

**Operations**:
- Retrieves questions from BeerQA graph via SPARQL SELECT
- Generates 1536-dimensional embeddings using `nomic-embed-text` model
- Extracts semantic concepts using LLM analysis
- Updates question corpuscles with embedding and concept data

**RDF Resources Added**:
```turtle
<question-uri> ragno:hasEmbedding "[-0.123, 0.456, ...]"^^xsd:string ;
               ragno:hasConcept "Tesla", "Morgan", "correspondence" .
```

**Potential Issues**:
- Embedding generation requires service availability
- Concept extraction quality depends on LLM model performance
- Large embedding vectors increase storage requirements

### Stage 3: Concept Research

**File**: `examples/beerqa/QuestionResearch.js`

**Purpose**: Researches extracted concepts via Wikipedia search, with HyDE fallback for missing concepts

**Operations**:
- Queries questions with concepts from BeerQA graph
- For each concept, performs Wikipedia API search
- If no concepts exist, generates hypothetical documents using HyDE algorithm
- Extracts concepts from hypothetical documents (up to 3 retry attempts)
- Creates Wikipedia search units and converts to corpuscles
- Establishes `ragno:maybeRelated` relationships between questions and Wikipedia results

**RDF Resources Created**:
```turtle
<wikipedia-unit> a ragno:Unit ;
                 ragno:hasSourceURI <wikipedia-page-uri> ;
                 skos:prefLabel "Tesla" .

<question-uri> ragno:maybeRelated <wikipedia-corpuscle> .
```

**HyDE Algorithm**:
- Generates detailed hypothetical answers to questions
- Extracts concepts from hypothetical content as substitutes
- Provides fallback when direct concept extraction fails

**Potential Issues**:
- Wikipedia API rate limiting (1 request per second)
- HyDE may generate inaccurate hypothetical content
- Concept extraction failure after 3 retries results in stage failure
- Search results may not be relevant to actual questions

### Stage 4: Target Discovery

**File**: `examples/beerqa/DiscoverTargets.js`

**Purpose**: Identifies Wikipedia targets related to questions through similarity search and concept matching

**Operations**:
- Performs cosine similarity search between question embeddings and Wikipedia corpuscle embeddings
- Matches question concepts with Wikipedia corpuscle concepts  
- Scores targets using weighted combination (70% similarity, 30% concept overlap)
- Creates `ragno:Relationship` entities linking questions to discovered targets

**Similarity Calculation**:
```javascript
cosineSimilarity = dotProduct / (norm(vectorA) * norm(vectorB))
```

**RDF Resources Created**:
```turtle
<relationship-uri> a ragno:Relationship ;
                   ragno:hasSourceEntity <question-uri> ;
                   ragno:hasTargetEntity <wikipedia-corpuscle> ;
                   ragno:relationshipType "similarityBased" ;
                   ragno:weight 0.85 ;
                   ragno:sourceCorpus "Wikipedia" .
```

**Potential Issues**:
- Requires pre-existing embeddings for both questions and Wikipedia corpuscles
- Similarity thresholds are hardcoded and may need adjustment
- High computational cost for large corpuscle collections
- False positives in similarity matching

### Stage 5: Page Ingestion

**File**: `examples/wikipedia/IngestPages.js`

**Purpose**: Fetches Wikipedia page content and converts to markdown with embeddings

**Operations**:
- Queries for Wikipedia corpuscles with `ragno:maybeRelated` relationships
- Fetches full Wikipedia page content via Wikipedia API
- Converts HTML to markdown using `HTML2MD.js`
- Truncates content to 50,000 characters to manage size
- Generates embeddings for markdown content
- Updates corpuscles with `ragno:TextElement` containing markdown content

**RDF Resources Updated**:
```turtle
<wikipedia-corpuscle> ragno:hasTextElement <text-element> .

<text-element> ragno:content "Wikipedia article content in markdown..." ;
               ragno:contentType "text/markdown" ;
               ragno:hasEmbedding "[embedding-vector]" .
```

**Potential Issues**:
- Content truncation may lose important information
- HTML-to-markdown conversion may introduce formatting artifacts
- Large page content increases storage and processing requirements
- Wikipedia API availability and rate limiting

### Stage 6: ZPT Navigation

**File**: `examples/beerqa/Navigate.js`

**Purpose**: Uses Zoom, Pan, Tilt navigation to discover corpuscles best suited for answering questions

**Operations**:
- Applies ZPT navigation with zoom/tilt/pan parameters:
  - **Zoom**: `entity` level for focused corpuscle discovery
  - **Tilt**: `embedding` projection for semantic similarity
  - **Pan**: Filters corpuscles by content availability and relevance
- Scores corpuscles using multiple factors:
  - Embedding similarity (60% weight)
  - Concept overlap (30% weight)  
  - Content length bonus (10% weight)
- Creates high-weight `ragno:Relationship` entities for top-scoring corpuscles

**ZPT Navigation Process**:
1. Query corpus of available corpuscles
2. Apply semantic filters based on question context
3. Calculate composite relevance scores
4. Select top candidates above threshold (0.4)
5. Create weighted relationships to question

**RDF Resources Created**:
```turtle
<zpt-relationship> a ragno:Relationship ;
                   ragno:hasSourceEntity <question-uri> ;
                   ragno:hasTargetEntity <discovered-corpuscle> ;
                   ragno:relationshipType "zptNavigation" ;
                   ragno:weight 0.75 ;
                   ragno:sourceCorpus "ZPT" .
```

**Potential Issues**:
- ZPT parameters are manually configured and may not be optimal
- Scoring algorithm weights are hardcoded
- Requires substantial content and embedding data to be effective
- May miss relevant corpuscles due to threshold settings

### Stage 7: Final Answer Generation

**File**: `examples/beerqa/GetResult.js`

**Purpose**: Generates final answers using context-augmented LLM completion

**Operations**:
- Retrieves questions with their associated relationships
- Fetches content for all related entities (both BeerQA and Wikipedia graphs)
- Uses `ContextManager` to build augmented context from related corpuscles
- Generates LLM responses using question + context via `LLMHandler`
- Returns structured answers with metadata about sources and success

**Context Building Process**:
1. Collect content from related entities based on relationship weights
2. Format content by type (markdown, titles, etc.)
3. Sort by relationship weight for optimal context ordering
4. Build augmented prompt using `ContextManager.buildContext()`
5. Generate response with system prompt emphasizing context usage

**Answer Structure**:
```json
{
  "questionURI": "question-identifier",
  "questionText": "Original question",
  "answer": "Generated response text",
  "contextSourceCount": 5,
  "contextSources": ["Wikipedia", "BeerQA"],
  "relationshipCount": 8,
  "success": true
}
```

**Potential Issues**:
- Context window limitations may truncate important information
- LLM model availability and performance dependencies
- Quality depends on previous stages' relationship discovery
- No fact-checking or answer validation

## Supporting Infrastructure

### SPARQLHelper Class

**File**: `examples/beerqa/SPARQLHelper.js`

Provides SPARQL query/update operations with authentication and error handling. Supports both UPDATE and SELECT operations against Fuseki endpoints.

### Wikipedia Integration

**Files**: 
- `src/aux/wikipedia/Search.js` - Wikipedia API search functionality
- `src/aux/wikipedia/UnitsToCorpuscles.js` - Converts search results to RDF corpuscles
- `src/aux/markup/HTML2MD.js` - HTML to markdown conversion

### Debugging and Maintenance

**Files**:
- `examples/beerqa/CheckTeslaContent.js` - Verifies corpuscle content availability
- `examples/beerqa/DebugContext.js` - Debugs context retrieval for questions
- `examples/beerqa/FixTeslaRelationship.js` - Repairs missing content/relationships

## System Requirements

- **SPARQL Endpoint**: Apache Fuseki with authentication
- **Ollama Service**: For embeddings (`nomic-embed-text`) and chat completion (`qwen2:1.5b`)
- **Node.js**: Version 20.11.0+ with ES modules support
- **Network Access**: Wikipedia API connectivity

## Performance Characteristics

- **Processing Time**: 30-60 seconds per question through full pipeline
- **Storage**: ~2-5KB RDF data per question, 10-50KB per Wikipedia corpuscle
- **Memory**: Embedding vectors require ~6KB each (1536 dimensions × 4 bytes)
- **Network**: Wikipedia API calls limited to 1 request/second

## Known Limitations

1. **Scalability**: Sequential processing limits throughput
2. **Quality Control**: No validation of intermediate results
3. **Error Recovery**: Pipeline failures require manual intervention
4. **Content Truncation**: Large Wikipedia articles are automatically truncated
5. **Model Dependencies**: Tied to specific Ollama models and versions
6. **Static Configuration**: Parameters hardcoded rather than configurable
7. **Language Support**: English Wikipedia and models only

## Future Improvements

- Parallel processing for multiple questions
- Configurable similarity thresholds and scoring weights
- Answer quality assessment and validation
- Support for additional content sources beyond Wikipedia
- Automated error recovery and retry mechanisms
- Performance monitoring and optimization