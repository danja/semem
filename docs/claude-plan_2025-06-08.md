# Ragno RDF-Ext Implementation Plan
*Created: 2025-06-08*
*Status: In Progress*

## Overview

This document outlines the comprehensive implementation plan for transforming the Ragno knowledge graph system from a simple object-oriented approach to a full RDF-Ext based implementation following the ragno ontology specification.

## Current State Analysis

### ✅ What We Have:
- Basic ragno pipeline modules (decomposition, augmentation, communities, embeddings)
- Simple JavaScript classes (Entity, Relationship, SemanticUnit, Attribute)
- Working RagnoPipelineDemo.js with LLM integration
- Ragno ontology specification in TTL format (`docs/ragno/ragno.ttl`)
- Configuration system with `config/ragno-config.json`
- Integration with Semem's SPARQLStore, LLMHandler, and EmbeddingHandler

### ❌ Missing from Reference Checklist:
- **RDF-Ext graph structure** (currently uses simple objects)
- **Relationships as RDF resources** (currently just JavaScript objects)
- **Graph algorithms** (K-core, betweenness centrality, Leiden clustering, PPR)
- **HNSW vector indexing** for similarity search
- **Dual search system** (exact match + vector similarity)
- **Production API endpoints** and caching

## Implementation Strategy

### Phase 1: RDF-Ext Foundation ✅ COMPLETED
**Dependencies Installed:**
```json
{
  "rdf-ext": "^2.5.2",
  "@rdfjs/namespace": "^2.0.1", 
  "hnswlib-node": "^3.0.0",
  "rdf-parse": "^4.0.0"
}
```

**Key Components to Create:**
- `src/ragno/core/RDFGraphManager.js` - Central RDF-Ext integration
- `src/ragno/core/NamespaceManager.js` - Ragno ontology namespace handling
- `src/ragno/models/RDFElement.js` - Base class for all ragno elements

### Phase 2: Relationship as RDF Resources
**Objective:** Transform the current simple Relationship class to follow ragno ontology

**Current Implementation:**
```javascript
// Simple JavaScript object
class Relationship {
  constructor({ description, source, target }) {
    this.description = description;
    this.source = source;
    this.target = target;
  }
}
```

**Target Implementation:**
```javascript
// RDF resource following ragno ontology
class Relationship extends RDFElement {
  constructor({ description, sourceEntity, targetEntity, dataset, uri }) {
    super(dataset, uri || generateURI('relationship'));
    this.addTriple('rdf:type', 'ragno:Relationship');
    this.addTriple('ragno:hasSourceEntity', sourceEntity);
    this.addTriple('ragno:hasTargetEntity', targetEntity);
    this.addTriple('ragno:content', description);
  }
}
```

**Files to Create/Modify:**
- `src/ragno/models/Relationship.js` - RDF-based relationship implementation
- `src/ragno/models/Entity.js` - Enhanced with RDF structure
- `src/ragno/models/SemanticUnit.js` - RDF-compliant unit representation
- `src/ragno/models/Attribute.js` - RDF attribute implementation

### Phase 3: Graph Algorithms
**New Files:**
- `src/ragno/algorithms/GraphAnalytics.js` - K-core, betweenness centrality
- `src/ragno/algorithms/CommunityDetection.js` - Leiden clustering implementation
- `src/ragno/algorithms/PersonalizedPageRank.js` - PPR for search traversal

**Key Algorithms:**
1. **K-core Decomposition** - Node importance calculation
2. **Betweenness Centrality** - Graph centrality metrics
3. **Leiden Clustering** - Community detection algorithm
4. **Personalized PageRank** - Cross-node traversal for search

### Phase 4: Vector Search Engine
**New Files:**
- `src/ragno/search/VectorIndex.js` - HNSW integration
- `src/ragno/search/DualSearch.js` - Combined exact + similarity search
- `src/ragno/search/SearchAPI.js` - REST endpoints

**Vector Search Implementation:**
```javascript
// HNSW index for retrievable node types
const retrievableTypes = [
  'ragno:TextElement',
  'ragno:Unit', 
  'ragno:Attribute',
  'ragno:CommunityElement'
];

// Dual search combining exact match + vector similarity
async function dualSearch(query, sparqlEndpoint, embeddingService) {
  // Extract query entities using LLM
  const queryEntities = await llmHandler.extractEntities(query);
  const queryEmbedding = await embeddingService.generateEmbedding(query);
  
  // Exact matching via SPARQL for entities and overviews
  const exactMatches = await exactMatchSearch(queryEntities);
  
  // Vector similarity search for retrievable elements
  const similarityMatches = await vectorSimilaritySearch(queryEmbedding);
  
  // Combine results with PPR scores
  return combineSearchResults(exactMatches, similarityMatches);
}
```

### Phase 5: Pipeline Integration
**Updated Files:**
- `src/ragno/decomposeCorpus.js` - Use RDF-Ext graph construction
- `src/ragno/augmentWithAttributes.js` - Generate RDF attributes
- `src/ragno/aggregateCommunities.js` - Create RDF communities
- `src/ragno/enrichWithEmbeddings.js` - Build vector index

**RDF Graph Construction Example:**
```turtle
# Entity with relationships as resources
ex:entity1 a ragno:Entity ;
    ragno:isEntryPoint true ;
    skos:prefLabel "Geoffrey Hinton" .

ex:rel1 a ragno:Relationship ;
    ragno:hasSourceEntity ex:entity1 ;
    ragno:hasTargetEntity ex:entity2 ;
    ragno:content "developed" ;
    ragno:hasWeight 0.8 .

ex:unit1 a ragno:Unit ;
    ragno:content "Geoffrey Hinton developed backpropagation..." ;
    ragno:connectsTo ex:entity1 .
```

### Phase 6: API & Production Features
**New Files:**
- `src/ragno/api/GraphAPI.js` - REST endpoints for graph operations
- `src/ragno/api/SearchAPI.js` - Search and retrieval endpoints
- `src/ragno/monitoring/GraphMetrics.js` - Performance monitoring
- `src/ragno/cache/GraphCache.js` - Caching layer

**API Endpoints:**
- `GET /ragno/graph/stats` - Graph statistics
- `POST /ragno/search/dual` - Dual search interface
- `GET /ragno/entities/{id}` - Entity details with relationships
- `POST /ragno/decompose` - Text decomposition endpoint
- `GET /ragno/export/{format}` - Graph export (Turtle, JSON-LD, N-Triples)

## Ragno Ontology Integration

### Core Classes Implementation:
```turtle
ragno:Entity rdfs:subClassOf ragno:Element ;
    rdfs:comment "A named entity extracted from text" .

ragno:Relationship rdfs:subClassOf ragno:Element ;
    rdfs:comment "A relationship between entities, represented as a node" .

ragno:Unit rdfs:subClassOf ragno:Element ;
    rdfs:comment "A semantic unit representing an independent event" .

ragno:Attribute rdfs:subClassOf ragno:Element ;
    rdfs:comment "Properties of important entities" .

ragno:CommunityElement rdfs:subClassOf ragno:Element ;
    rdfs:comment "Insights summarizing graph communities" .

ragno:TextElement rdfs:subClassOf ragno:Element ;
    rdfs:comment "Original text chunks" .
```

### Property Implementation:
```turtle
ragno:hasSourceEntity rdfs:domain ragno:Relationship ;
    rdfs:range ragno:Entity .

ragno:hasTargetEntity rdfs:domain ragno:Relationship ;
    rdfs:range ragno:Entity .

ragno:hasWeight rdfs:domain owl:ObjectProperty ;
    rdfs:range xsd:float .

ragno:isEntryPoint rdfs:domain ragno:Element ;
    rdfs:range xsd:boolean .

ragno:content rdfs:domain ragno:Element ;
    rdfs:range xsd:string .
```

## Search Flow Implementation

### Dual Search Algorithm:
1. **Query Processing**: Extract entities, generate embedding
2. **Exact Match**: Search ragno:Entity nodes with exact label matching
3. **Vector Similarity**: Search retrievable types (Unit, Attribute, CommunityElement)
4. **PPR Traversal**: Cross-node discovery using graph structure
5. **Result Assembly**: Combine and rank results by type and relevance

### Personalized PageRank:
```javascript
async function shallowPPR(entryPoints, sparqlEndpoint, alpha = 0.5, iterations = 2) {
  // Build adjacency information via SPARQL
  const adjacencyQuery = `
    PREFIX ragno: <http://purl.org/stuff/ragno/>
    
    SELECT ?source ?target ?weight
    WHERE {
      ?relationship a ragno:Relationship .
      ?relationship ragno:hasSourceEntity ?source .
      ?relationship ragno:hasTargetEntity ?target .
      OPTIONAL { ?relationship ragno:hasWeight ?weight }
    }
  `;
  
  const edges = await SPARQLHelpers.executeSPARQLQuery(sparqlEndpoint, adjacencyQuery);
  
  // Iterative PPR computation
  let currentVector = initializePPRVector(entryPoints);
  for (let i = 0; i < iterations; i++) {
    currentVector = computePPRIteration(currentVector, adjacencyMatrix, alpha);
  }
  
  return selectCrossTypeTopK(currentVector, k = 5);
}
```

## Integration Points

### Semem Integration:
- **MemoryManager**: Enhanced with graph-based retrieval
- **SPARQLStore**: Direct RDF-Ext to SPARQL synchronization
- **EmbeddingHandler**: Vector indexing for graph nodes
- **LLMHandler**: Enhanced concept extraction for graph construction

### MCP Server Integration:
- **Graph Operations**: Expose RDF operations as MCP tools
- **Search Interface**: Semantic search via MCP
- **Graph Exploration**: Interactive graph traversal
- **Export Functions**: Multiple RDF serialization formats

## Configuration Updates

### Enhanced ragno-config.json:
```json
{
  "ragno": {
    "version": "0.3.0",
    "rdf": {
      "uriBase": "http://example.org/ragno/",
      "serialization": "turtle",
      "validation": true
    },
    "graph": {
      "maxNodes": 100000,
      "maxEdges": 500000,
      "cacheSize": 10000
    },
    "search": {
      "dualSearch": {
        "exactMatchTypes": ["ragno:Entity", "ragno:Attribute"],
        "vectorSimilarityTypes": ["ragno:Unit", "ragno:Attribute", "ragno:CommunityElement"],
        "vectorSimilarityK": 10,
        "queryExpansion": true
      },
      "ppr": {
        "alpha": 0.5,
        "iterations": 2,
        "topKPerType": 5
      }
    },
    "algorithms": {
      "kCore": {
        "threshold": "floor(log(|V|) * sqrt(avgDegree))"
      },
      "leiden": {
        "resolution": 1.0,
        "minCommunitySize": 3
      }
    }
  }
}
```

## Testing Strategy

### Unit Tests:
- RDF resource creation and serialization
- Graph algorithm correctness
- SPARQL query generation
- Vector search accuracy

### Integration Tests:
- End-to-end pipeline from text to searchable graph
- Performance benchmarks with large datasets
- SPARQL store synchronization
- MCP server functionality

### Validation Tests:
- Ragno ontology compliance
- Reference implementation comparison
- Data integrity across operations

## Success Metrics

1. **Functionality**: Complete ragno reference checklist ✓
2. **Performance**: Handle 10k+ documents with sub-second search
3. **Integration**: Seamless operation with existing Semem components
4. **Standards**: Full ragno ontology compliance
5. **Testing**: 95%+ test coverage with integration tests

## Implementation Timeline

- **Week 1**: Phase 1 (RDF-Ext Foundation) ✅ COMPLETED
- **Week 2**: Phase 2 (RDF Relationships) 🔄 IN PROGRESS
- **Week 3**: Phase 3 (Graph Algorithms)
- **Week 4**: Phase 4 (Vector Search)
- **Week 5**: Phase 5 (Pipeline Integration)
- **Week 6**: Phase 6 (API & Production)
- **Week 7**: Testing & Optimization
- **Week 8**: Documentation & Deployment

## Next Steps

1. ✅ Install RDF-Ext dependencies
2. 🔄 Create RDFGraphManager core infrastructure
3. ⏳ Implement NamespaceManager
4. ⏳ Create RDFElement base class
5. ⏳ Transform Relationship class to RDF resource
6. ⏳ Update pipeline modules for RDF-Ext integration

---

*This plan transforms the current Ragno prototype into a production-ready, ontology-compliant knowledge graph system that fully integrates with Semem's existing infrastructure while providing advanced graph reasoning capabilities.*