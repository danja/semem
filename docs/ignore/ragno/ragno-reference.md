# Ragno Quick Reference Guide

## NodeRAG to Ragno Mapping

| NodeRAG | Ragno Class | Retrievable | Entry Point |
|---------|-------------|-------------|-------------|
| Text (T) | ragno:TextElement | ✓ | Via similarity |
| Semantic Unit (S) | ragno:Unit | ✓ | Via similarity |
| Attribute (A) | ragno:Attribute | ✓ | Via similarity |
| High-Level Element (H) | ragno:CommunityElement | ✓ | Via similarity |
| High-Level Overview (O) | ragno:Attribute (subType: Overview) | ✗ | Via exact match |
| Relationship (R) | ragno:Relationship | ✓ | ✗ |
| Entity (N) | ragno:Entity | ✗ | Via exact match |

## Algorithm Flow

```
1. DECOMPOSITION
   Input: Text → Output: Entities + Units + Relationships

2. AUGMENTATION
   ├─ Node Importance → Attributes
   └─ Community Detection → CommunityElements + Overviews

3. ENRICHMENT
   ├─ Text Insertion → TextElements
   ├─ Embedding → Vector representations
   └─ HNSW → Semantic edges

4. SEARCH
   ├─ Dual Search → Entry points
   ├─ Shallow PPR → Cross nodes
   └─ Filter → Retrieval nodes
```

## Key SPARQL Patterns

### Create Element
```sparql
INSERT DATA {
    ex:elem1 a ragno:Unit ;
             ragno:content "..." ;
             skos:prefLabel "..." ;
             ragno:inCorpus ex:corpus .
}
```

### Find Connected Elements
```sparql
SELECT ?connected WHERE {
    ex:entity1 ?p ?connected .
    FILTER(?p IN (ragno:hasUnit, ragno:hasAttribute, skos:related))
}
```

### Retrieve by Type
```sparql
SELECT ?elem ?content WHERE {
    ?elem a ?type ;
          ragno:content ?content .
    FILTER(?type IN (ragno:Unit, ragno:Attribute, ...))
}
```

## Key Properties

### Structural
- `ragno:hasUnit` - Entity → Unit
- `ragno:hasAttribute` - Entity → Attribute  
- `ragno:hasTextElement` - Unit → TextElement
- `ragno:connectsTo` - Element → Element
- `ragno:inCommunity` - Element → Community

### Metadata
- `ragno:isEntryPoint` - Boolean
- `ragno:hasPPRScore` - Float
- `ragno:hasSimilarityScore` - Float
- `ragno:hasWeight` - Float (on edges)

### Content
- `ragno:content` - Text content
- `skos:prefLabel` - Display label
- `ragno:subType` - Fine-grained typing

## Algorithm Parameters

### Decomposition
- Chunk size: 512 tokens
- Overlap: 64 tokens

### Augmentation
- K-core: `floor(log(|V|) * sqrt(avgDegree))`
- Betweenness scale: `floor(log10(|V|))`
- Community min size: 3

### Search
- PPR α: 0.5
- PPR iterations: 2
- Vector similarity k: 10
- Top-k per type: 5

## Implementation Checklist

- [ ] Set up triple store (Blazegraph/Fuseki)
- [ ] Configure LLM access (GPT-4)
- [ ] Implement embedding generation
- [ ] Build HNSW index
- [ ] Create SPARQL query templates
- [ ] Implement graph algorithms
  - [ ] K-core decomposition
  - [ ] Betweenness centrality
  - [ ] Leiden clustering
  - [ ] Personalized PageRank
- [ ] Set up caching layer
- [ ] Create API endpoints
- [ ] Build monitoring dashboard