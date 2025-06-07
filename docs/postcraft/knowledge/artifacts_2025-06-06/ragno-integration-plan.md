# Ragno-SPARQL Integration Plan for Semem

## Overview

This plan outlines the integration of Semem's in-memory concept graph with SPARQL persistence using the Ragno ontology, creating a persistent, queryable semantic knowledge base.

## Current State Analysis

### What We Have
- **In-Memory**: Graphology concept graph with weighted edges
- **SPARQL**: Interactions stored with concepts as JSON strings
- **MCP Namespace**: Basic interaction properties

### What We Need
- **Persistent Graph**: Concepts and relationships as RDF resources
- **Ragno Integration**: Map Semem structures to Ragno classes
- **Bidirectional Sync**: Memory ↔ SPARQL synchronization

## Conceptual Mapping

### Semem → Ragno Mapping

| Semem Component | Ragno Class | Purpose |
|-----------------|-------------|----------|
| Concept | ragno:Entity | Named concepts extracted from text |
| Concept Edge | ragno:Relationship | Weighted co-occurrence relationships |
| Interaction | ragno:Unit | Semantic memory units |
| Memory Corpus | ragno:Corpus | Complete memory collection |
| Concept Cluster | ragno:Community | Semantically related concept groups |
| Embedding | ragno:IndexElement | Vector representations |

### Property Mapping

| Semem Property | Ragno Property | Notes |
|----------------|----------------|-------|
| Edge weight | ragno:hasWeight | Co-occurrence frequency |
| Concept text | skos:prefLabel | Human-readable label |
| Access count | ragno:accessCount | New property needed |
| Decay factor | ragno:decayFactor | New property needed |
| Timestamp | dcterms:created | Standard timestamp |

## Architecture Design

### 1. **Namespace Configuration**
```javascript
// src/stores/RagnoSPARQLStore.js
const NAMESPACES = {
  ragno: 'http://purl.org/stuff/ragno/',
  mcp: 'http://purl.org/stuff/mcp/',
  skos: 'http://www.w3.org/2004/02/skos/core#',
  dcterms: 'http://purl.org/dc/terms/'
};
```

### 2. **Triple Patterns**

#### Concept Entity
```turtle
ex:concept_ai a ragno:Entity ;
    skos:prefLabel "AI"@en ;
    ragno:subType ex:ExtractedConcept ;
    ragno:isEntryPoint true ;
    mcp:frequency 42 ;
    dcterms:created "2024-01-15T10:30:00Z"^^xsd:dateTime .
```

#### Concept Relationship
```turtle
ex:rel_ai_ml a ragno:Relationship ;
    ragno:hasSourceEntity ex:concept_ai ;
    ragno:hasTargetEntity ex:concept_ml ;
    ragno:hasWeight 8.5 ;
    mcp:cooccurrenceCount 17 ;
    dcterms:modified "2024-01-15T10:30:00Z"^^xsd:dateTime .
```

#### Memory Unit (Interaction)
```turtle
ex:interaction_123 a ragno:Unit ;
    ragno:content "User asked about AI" ;
    mcp:prompt "What is AI?" ;
    mcp:response "AI is..." ;
    ragno:hasEmbedding ex:embedding_123 ;
    ragno:connectsTo ex:concept_ai, ex:concept_ml ;
    mcp:accessCount 5 ;
    mcp:decayFactor 0.95 .
```

### 3. **Graph Operations**

#### Query Operations
- Find concepts by label
- Get concept relationships with weights
- Retrieve interactions by concept
- Calculate concept centrality
- Find concept communities

#### Update Operations
- Increment edge weights
- Update access counts
- Adjust decay factors
- Add new concepts
- Merge duplicate concepts

## Implementation Phases

### Phase 1: Foundation (Week 1-2)
1. Create `RagnoSPARQLStore` extending `SPARQLStore`
2. Add Ragno namespace configuration
3. Implement concept entity CRUD operations
4. Create relationship triple patterns
5. Unit tests for basic operations

### Phase 2: Graph Sync (Week 3-4)
1. Implement `ConceptGraphSynchronizer` class
2. Bidirectional sync: Graphology ↔ SPARQL
3. Batch update optimization
4. Conflict resolution strategy
5. Integration tests

### Phase 3: Query Enhancement (Week 5-6)
1. SPARQL query builders for graph algorithms
2. Concept similarity queries
3. Path finding between concepts
4. Community detection queries
5. Performance optimization

### Phase 4: Migration & Integration (Week 7-8)
1. Migration script for existing data
2. Update `MemoryManager` to use new store
3. Backward compatibility layer
4. Documentation and examples
5. Performance benchmarks

## Benefits

### Immediate
- **Persistence**: Concept graph survives restarts
- **Querying**: SPARQL graph queries for analytics
- **Interoperability**: RDF standard compliance

### Long-term
- **Reasoning**: OWL inference on concept relationships
- **Federation**: Link to external knowledge bases
- **Visualization**: Graph visualization tools compatibility
- **Scale**: Distributed SPARQL endpoints

## Risk Mitigation

### Performance
- **Risk**: SPARQL slower than in-memory
- **Mitigation**: Hybrid approach with caching, batch updates

### Complexity
- **Risk**: Increased system complexity
- **Mitigation**: Clean abstraction layers, comprehensive tests

### Migration
- **Risk**: Data loss during migration
- **Mitigation**: Versioned backups, gradual rollout

## Success Metrics

1. **Functional**: All current features work with SPARQL backend
2. **Performance**: <100ms for concept retrieval
3. **Reliability**: Zero data loss during sync
4. **Scalability**: Handle 1M+ concepts
5. **Usability**: Clean API for developers