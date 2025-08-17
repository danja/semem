# Navigate Components Exercise Plan

## Overview

This plan systematically exercises the Navigate components of the Semantic Memory Workbench by feeding information using Tell operations, testing different ZPT (Zoom-Pan-Tilt) combinations with Ask queries, and verifying SPARQL persistence.

## Phase 1: Data Preparation Using Tell

### 1.1 Manual Content Documentation Files
Feed the system with information from docs/manual/ files using Tell operations:

- **Tell Operation 1**: Upload `docs/manual/zpt.md` as Document type
  - Expected: ZPT navigation system concepts stored as entities and units
  - SPARQL check: Query for `ragno:Entity` with ZPT-related labels

- **Tell Operation 2**: Upload `docs/manual/ragno.md` as Document type  
  - Expected: Ragno knowledge graph concepts stored
  - SPARQL check: Query for entities related to graph analytics and algorithms

- **Tell Operation 3**: Upload `docs/manual/sparql-service.md` as Document type
  - Expected: SPARQL service layer concepts stored
  - SPARQL check: Query for entities related to query management and templating

- **Tell Operation 4**: Upload `docs/manual/workbench-howto.md` as Document type
  - Expected: Workbench usage patterns and UI concepts stored
  - SPARQL check: Query for entities related to interface operations

### 1.2 Conceptual Knowledge via Text Input
Add structured conceptual knowledge using Tell with Concept type:

- **Tell Concept 1**: "Machine learning algorithms include supervised learning, unsupervised learning, and reinforcement learning approaches."
- **Tell Concept 2**: "Semantic web technologies use RDF triples to represent knowledge in subject-predicate-object form."
- **Tell Concept 3**: "Knowledge graphs enable intelligent agents to reason about relationships between entities and concepts."
- **Tell Concept 4**: "Vector embeddings capture semantic similarity between words and documents in high-dimensional space."

### 1.3 Verification Queries
After each Tell operation, verify storage:
```sparql
# Check entity count in content graph
SELECT (COUNT(*) as ?count) WHERE {
  GRAPH <http://hyperdata.it/content> {
    ?s a ragno:Entity .
  }
}

# Check semantic units
SELECT (COUNT(*) as ?count) WHERE {
  GRAPH <http://hyperdata.it/content> {
    ?s a ragno:Unit .
  }
}

# Check embeddings are present
SELECT (COUNT(*) as ?count) WHERE {
  GRAPH <http://hyperdata.it/content> {
    ?s ragno:hasEmbedding ?embedding .
  }
}
```

## Phase 2: ZPT Combination Testing Matrix

### 2.1 Zoom Level Testing

#### Test Case Z1: Entity Level Navigation
- **Zoom**: entity
- **Pan**: domains: ["ai", "machine-learning"]
- **Tilt**: keywords
- **Ask Query**: "What are the main machine learning concepts?"
- **Expected Behavior**: Return individual ML entities (supervised learning, neural networks, etc.)
- **SPARQL Verification**: Check that navigation metadata is stored with zpt:EntityLevel

#### Test Case Z2: Unit Level Navigation  
- **Zoom**: unit
- **Pan**: keywords: ["semantic", "knowledge"]
- **Tilt**: embedding
- **Ask Query**: "How do semantic technologies work?"
- **Expected Behavior**: Return semantic units/paragraphs about semantic web technologies
- **SPARQL Verification**: Navigation view should reference ragno:Unit instances

#### Test Case Z3: Text Level Navigation
- **Zoom**: text
- **Pan**: temporal: {start: "2023-01-01"}
- **Tilt**: temporal
- **Ask Query**: "What documentation was created recently?"
- **Expected Behavior**: Return text fragments ordered by temporal metadata
- **SPARQL Verification**: Check temporal ordering in navigation results

#### Test Case Z4: Community Level Navigation
- **Zoom**: community
- **Pan**: domains: ["graph", "analytics"]
- **Tilt**: graph
- **Ask Query**: "What are the main topic clusters in graph analytics?"
- **Expected Behavior**: Return community-level concept groups
- **SPARQL Verification**: Navigation should reference community detection results

#### Test Case Z5: Corpus Level Navigation
- **Zoom**: corpus
- **Pan**: {} (no filters)
- **Tilt**: keywords
- **Ask Query**: "What is the overall structure of this knowledge base?"
- **Expected Behavior**: Return high-level corpus overview
- **SPARQL Verification**: Navigation metadata should indicate corpus-wide scope

### 2.2 Pan Filter Testing

#### Test Case P1: Domain Filtering
- **Zoom**: entity
- **Pan**: domains: ["sparql", "database"]
- **Tilt**: keywords
- **Ask Query**: "What database technologies are mentioned?"
- **Expected Behavior**: Filter to database-related entities only

#### Test Case P2: Keyword Filtering
- **Zoom**: unit  
- **Pan**: keywords: ["navigation", "interface"]
- **Tilt**: embedding
- **Ask Query**: "How does the navigation interface work?"
- **Expected Behavior**: Return units containing navigation interface concepts

#### Test Case P3: Temporal Filtering
- **Zoom**: text
- **Pan**: temporal: {start: "2024-01-01", end: "2024-12-31"}
- **Tilt**: temporal
- **Ask Query**: "What content was added in 2024?"
- **Expected Behavior**: Return only content within temporal bounds

#### Test Case P4: Entity Filtering
- **Zoom**: unit
- **Pan**: entity: ["http://purl.org/stuff/ragno/Entity"]
- **Tilt**: graph
- **Ask Query**: "What information relates to the Entity concept?"
- **Expected Behavior**: Return units connected to specific entity URI

### 2.3 Tilt Projection Testing

#### Test Case T1: Keywords Projection
- **Zoom**: entity
- **Pan**: domains: ["ai"]
- **Tilt**: keywords
- **Ask Query**: "List AI-related concepts"
- **Expected Behavior**: Text-based keyword matching and frequency analysis

#### Test Case T2: Embedding Projection
- **Zoom**: unit
- **Pan**: keywords: ["learning"]
- **Tilt**: embedding
- **Ask Query**: "Find content similar to machine learning"
- **Expected Behavior**: Vector similarity-based content selection

#### Test Case T3: Graph Projection
- **Zoom**: entity
- **Pan**: domains: ["graph"]
- **Tilt**: graph
- **Ask Query**: "What concepts are connected to graph analytics?"
- **Expected Behavior**: Graph traversal and connectivity-based selection

#### Test Case T4: Temporal Projection
- **Zoom**: text
- **Pan**: {} 
- **Tilt**: temporal
- **Ask Query**: "Show the evolution of concepts over time"
- **Expected Behavior**: Time-ordered content organization

### 2.4 Cross-Navigation Testing

#### Test Case C1: Zoom Progression
1. **Initial**: zoom: entity, Ask: "What are the main concepts?"
2. **Drill Down**: zoom: unit, Ask: "Give me more detail on [concept from step 1]"
3. **Context**: zoom: community, Ask: "What topics relate to this concept?"
- **Expected**: Consistent context maintenance across zoom levels

#### Test Case C2: Pan Refinement
1. **Broad**: pan: domains: ["technology"], Ask: "What technology concepts exist?"
2. **Narrow**: pan: domains: ["ai", "ml"], Ask: "Focus on AI and ML specifically"
- **Expected**: Refined results maintaining relevance

#### Test Case C3: Tilt Switching
1. **Keywords**: tilt: keywords, Ask: "Find content about embeddings"
2. **Embeddings**: tilt: embedding, Ask: "Find content about embeddings"
3. **Graph**: tilt: graph, Ask: "Find content about embeddings"
- **Expected**: Different perspectives on same query topic

## Phase 3: Expected Behavior Specifications

### 3.1 Navigation Workflow
1. **Parameter Validation**: ZPT parameters validated against ontology
2. **Parameter Normalization**: String parameters converted to URIs
3. **Content Selection**: Based on zoom level and tilt projection method
4. **Result Processing**: Filtered, ranked, and transformed results
5. **Metadata Storage**: Navigation session stored in SPARQL as RDF

### 3.2 Response Characteristics

#### Zoom Level Responses
- **Entity**: Individual concept nodes with properties
- **Unit**: Semantic text passages with context
- **Text**: Raw text fragments with metadata
- **Community**: Concept clusters with relationships
- **Corpus**: High-level structural overview

#### Pan Filter Effects
- **Domains**: Content restricted to specified subject areas
- **Keywords**: Text matching specified terms
- **Temporal**: Content within time boundaries
- **Entity**: Content connected to specific entities

#### Tilt Projection Effects
- **Keywords**: Text frequency and keyword overlap scoring
- **Embedding**: Vector cosine similarity ranking
- **Graph**: Connectivity and centrality-based selection
- **Temporal**: Chronological organization and sequencing

### 3.3 SPARQL Storage Requirements

#### Navigation Sessions
```sparql
# Expected session storage pattern
<session-uri> a zpt:NavigationSession ;
    dcterms:created ?timestamp ;
    prov:wasAssociatedWith <agent-uri> ;
    zpt:hasPurpose "Knowledge exploration" .
```

#### Navigation Views
```sparql
# Expected view storage pattern
<view-uri> a zpt:NavigationView ;
    zpt:hasQuery "query text" ;
    zpt:hasZoom zpt:EntityLevel ;
    zpt:hasPan <pan-object-uri> ;
    zpt:hasTilt zpt:KeywordProjection ;
    zpt:inSession <session-uri> .
```

## Phase 4: Practical Testing Methodology

### 4.1 Test Execution Sequence

#### Step 1: Environment Setup
1. Ensure SPARQL endpoint is running and accessible
2. Verify MCP server is running with ZPT navigation tools
3. Start Semantic Memory Workbench at http://localhost:4102
4. Clear any existing navigation data for clean testing

#### Step 2: Data Loading
1. Execute Phase 1 Tell operations in sequence
2. After each Tell, verify SPARQL storage with verification queries
3. Monitor console logs for processing confirmation
4. Ensure embeddings are generated and stored

#### Step 3: Navigation Testing
1. Execute test cases from Phase 2 in order
2. For each test case:
   - Set Navigate panel to specified ZPT parameters
   - Execute Ask query with those parameters active
   - Record actual results and response time
   - Check SPARQL storage for navigation metadata

#### Step 4: Verification and Comparison
1. Compare actual results against expected behaviors
2. Verify SPARQL persistence using direct queries
3. Check navigation session continuity across tests
4. Measure performance characteristics

### 4.2 Success Criteria

#### Functional Requirements
- [ ] All Tell operations successfully store content with embeddings
- [ ] Each ZPT combination produces relevant, filtered results
- [ ] Navigation metadata is persistently stored in SPARQL
- [ ] Cross-navigation maintains context and session continuity
- [ ] Response times are under 5 seconds for typical queries

#### Data Integrity Requirements  
- [ ] Entity counts match expected values after Tell operations
- [ ] Navigation sessions are properly linked to views
- [ ] ZPT parameters are correctly converted to ontology URIs
- [ ] Embeddings are present for all stored content
- [ ] Navigation metadata survives server restarts

#### Performance Requirements
- [ ] Memory usage remains stable during test execution
- [ ] SPARQL queries complete within timeout limits
- [ ] Cache hit rates improve with repeated similar queries
- [ ] No memory leaks or resource exhaustion

### 4.3 Issue Identification and Resolution

#### Common Issue Categories

**Parameter Validation Failures**
- Symptoms: Navigation requests rejected with validation errors
- Investigation: Check parameter formats against ZPT ontology
- Resolution: Correct parameter syntax or update validation rules

**Content Selection Problems**
- Symptoms: Empty results or irrelevant content returned
- Investigation: Verify corpus data, check selection algorithms
- Resolution: Adjust similarity thresholds, improve content quality

**SPARQL Persistence Issues**
- Symptoms: Navigation metadata not stored or retrievable
- Investigation: Check SPARQL endpoint connectivity, examine INSERT queries
- Resolution: Fix endpoint configuration, verify graph permissions

**Performance Degradation**
- Symptoms: Slow response times, high memory usage
- Investigation: Profile query execution, monitor cache performance
- Resolution: Optimize queries, tune cache parameters, improve indexing

#### Resolution Strategies

**Incremental Testing**
- Test individual components before full integration
- Isolate issues to specific ZPT parameter combinations
- Use SPARQL queries to verify data at each step

**Fallback Mechanisms**
- Implement demo modes for missing components
- Provide alternative selection methods when preferred approaches fail
- Graceful degradation when services are unavailable

**Performance Optimization**
- Implement result caching for repeated navigation patterns
- Optimize SPARQL queries for large corpus operations
- Use batch operations where possible to reduce overhead

## Phase 5: Monitoring and Validation

### 5.1 Real-time Monitoring

#### Navigation Analytics
- Track parameter combination frequency
- Monitor cross-zoom navigation patterns
- Measure query complexity vs result quality
- Analyze navigation session duration and depth

#### Performance Metrics
- Navigation operation timing
- Cache hit rates and effectiveness  
- SPARQL query performance statistics
- Memory usage and optimization trends

### 5.2 Validation Queries

#### Session Integrity Check
```sparql
# Verify all navigation sessions have required metadata
SELECT ?session ?created ?agent WHERE {
  GRAPH <http://purl.org/stuff/navigation> {
    ?session a zpt:NavigationSession ;
             dcterms:created ?created ;
             prov:wasAssociatedWith ?agent .
  }
}
```

#### View Completeness Check  
```sparql
# Verify navigation views have all required components
SELECT ?view ?query ?zoom ?tilt WHERE {
  GRAPH <http://purl.org/stuff/navigation> {
    ?view a zpt:NavigationView ;
          zpt:hasQuery ?query ;
          zpt:hasZoom ?zoom ;
          zpt:hasTilt ?tilt .
  }
}
```

#### Content Integration Check
```sparql
# Verify navigation views reference actual corpus content
SELECT ?view ?corpuscle WHERE {
  GRAPH <http://purl.org/stuff/navigation> {
    ?view zpt:selectedCorpuscles ?corpuscle .
  }
  GRAPH <http://hyperdata.it/content> {
    ?corpuscle ?p ?o .
  }
}
```

### 5.3 Acceptance Testing

Final acceptance requires successful completion of:
1. All functional test cases with expected results
2. SPARQL persistence verification for all operations
3. Performance benchmarks within acceptable ranges
4. No critical errors or system instability
5. Proper cleanup and resource management

This comprehensive testing plan ensures the Navigate components function correctly across all ZPT parameter combinations while maintaining data integrity and performance standards.