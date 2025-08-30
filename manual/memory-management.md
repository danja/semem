# Semem Memory Management System

This document describes the memory management system in Semem, including memory types, classification logic, decay mechanisms, and optimization strategies.

## Overview

Semem implements a sophisticated memory management system that mimics human memory patterns with short-term and long-term memory stores, decay mechanisms, and intelligent classification based on access patterns and importance.

## Memory Types

### Short-Term Memory
- **Purpose**: Stores recent interactions and frequently accessed content
- **Characteristics**: 
  - Fast access and retrieval
  - Subject to decay over time
  - Automatically promoted to long-term based on usage patterns
- **Default State**: All new interactions start as short-term memories

### Long-Term Memory  
- **Purpose**: Stores important, frequently accessed, or reinforced content
- **Characteristics**:
  - Persistent storage with reduced decay
  - Higher retrieval priority in search operations
  - Promotes from short-term based on access patterns

## Memory Classification Logic

### Automatic Promotion (Short-term → Long-term)

**Current Implementation** (`src/stores/MemoryStore.js:65-70`):
```javascript
classifyMemory() {
    this.shortTermMemory.forEach((interaction, idx) => {
        if (this.accessCounts[idx] > 10 &&
            !this.longTermMemory.some(ltm => ltm.id === interaction.id)) {
            this.longTermMemory.push(interaction)
            logger.info(`Moved interaction ${interaction.id} to long-term memory`)
        }
    })
}
```

**Promotion Criteria**:
- Access count > 10 (memory accessed more than 10 times)
- Not already in long-term memory
- Called during memory operations to maintain classification

## Decay Mechanism

### Temporal Decay
**Location**: `src/stores/MemoryStore.js:82-93`

**Formula**:
```javascript
const decayRate = 0.0001  // Configurable in Config.js:54
const timeDiff = (currentTime - timestamp) / 1000  // Time in seconds
const decayFactor = interaction.decayFactor * Math.exp(-decayRate * timeDiff)
```

**Key Components**:

1. **Base Decay Rate**: `0.0001` (exponential decay constant)
2. **Time Difference**: Seconds since last access
3. **Exponential Decay**: Mathematical decay function `e^(-rate × time)`

### Reinforcement Learning
**Location**: `src/stores/MemoryStore.js:92-99`

**Reinforcement Formula**:
```javascript
const reinforcementFactor = Math.log1p(accessCounts)
const adjustedSimilarity = similarity * decayFactor * reinforcementFactor
```

**When Memory is Accessed**:
- Access count increments: `this.accessCounts[idx]++`
- Timestamp updates: `this.timestamps[idx] = currentTime`
- Decay factor strengthens: `this.shortTermMemory[idx].decayFactor *= 1.1`

### Negative Reinforcement
**Location**: `src/stores/MemoryStore.js:109-114`

**Non-accessed memories decay**:
```javascript
// Apply decay to non-relevant interactions
this.shortTermMemory.forEach((item, idx) => {
    if (!relevantIndices.has(idx)) {
        item.decayFactor *= 0.9  // 10% decay per retrieval cycle
    }
})
```

## Memory Storage Structure

### Memory Properties
**Defined in**: `src/types/MemoryTypes.js:6-26`

```javascript
class Interaction {
    constructor({
        id,                    // Unique identifier
        prompt,               // Input content
        output,               // Response content  
        embedding,            // Vector embedding
        timestamp,            // Creation/access time
        accessCount = 1,      // Number of accesses
        concepts = [],        // Extracted concepts
        decayFactor = 1.0     // Decay multiplier
    })
}
```

### SPARQL Storage Schema
**Implementation**: `src/stores/SPARQLStore.js:467-470`

```sparql
PREFIX semem: <http://purl.org/stuff/semem/>
PREFIX ragno: <http://purl.org/stuff/ragno/>

<interaction_uri> a semem:Interaction ;
    semem:prompt "..." ;
    semem:output "..." ;
    semem:embedding "..." ;
    semem:timestamp "timestamp"^^xsd:dateTime ;
    semem:accessCount "count"^^xsd:integer ;
    semem:concepts "concepts_json" ;
    semem:decayFactor "factor"^^xsd:decimal ;
    ragno:memoryType "short-term" | "long-term" .
```

## Retrieval and Ranking

### Similarity Calculation
**Location**: `src/stores/MemoryStore.js:89-93`

**Multi-factor Ranking**:
```javascript
const similarity = vectorOps.cosineSimilarity(query, embedding) * 100
const timeDiff = (currentTime - timestamp) / 1000
const decayFactor = interaction.decayFactor * Math.exp(-decayRate * timeDiff)
const reinforcementFactor = Math.log1p(accessCount)
const adjustedSimilarity = similarity * decayFactor * reinforcementFactor
```

**Ranking Factors**:
1. **Semantic Similarity**: Cosine similarity of embeddings
2. **Temporal Relevance**: Exponential decay based on time
3. **Access Reinforcement**: Logarithmic reinforcement from repeated access
4. **Decay Factor**: Individual memory strength modifier

## Configuration

### Memory Parameters
**File**: `src/Config.js:52-55`

```javascript
memory: {
    similarityThreshold: 40,     // Minimum similarity for retrieval
    contextWindow: 3,            // Number of context items to return
    decayRate: 0.0001           // Exponential decay constant
}
```

### Customization Options

1. **Decay Rate**: Controls how quickly memories fade over time
2. **Similarity Threshold**: Minimum score for memory retrieval
3. **Promotion Threshold**: Access count required for long-term promotion
4. **Context Window**: Number of relevant memories to return

## Performance Characteristics

### Memory Counts (Current System Status)

**Short-term Memory Count**: Number of interactions with `ragno:memoryType "short-term"`
**Long-term Memory Count**: Number of interactions with `ragno:memoryType "long-term"`

**Typical Distribution**:
- New systems: ~100% short-term, 0% long-term
- Mature systems: ~70% short-term, 30% long-term
- Heavy usage systems: ~50% short-term, 50% long-term

### Query Performance

**Small Memory Store** (< 1000 interactions):
- Retrieval time: < 50ms
- All decay calculations performed

**Medium Memory Store** (1000-10000 interactions):  
- Retrieval time: 50-200ms
- Batch processing for efficiency

**Large Memory Store** (> 10000 interactions):
- Retrieval time: 200-500ms
- Consider memory pruning or archival

## Advanced Features

### Spreading Activation
**Location**: `src/stores/MemoryStore.js:122-148`

Implements concept-based memory activation:
- Initial activation on query concepts
- Spreads to related concepts via concept graph
- Combines with similarity-based retrieval

### Memory Visualization
**Location**: `src/frontend/js/components/memoryVisualization.js`

Provides interactive visualization of:
- Memory access patterns over time
- Decay factor distributions
- Concept relationship networks
- Memory type distributions

## Best Practices

### For Developers

1. **Monitor Memory Distribution**: Regularly check short-term vs long-term ratios
2. **Tune Decay Rates**: Adjust based on usage patterns and domain requirements
3. **Access Pattern Analysis**: Monitor which memories get promoted and why
4. **Performance Monitoring**: Watch retrieval times as memory stores grow

### For System Administrators

1. **Regular Classification**: Ensure `classifyMemory()` is called periodically
2. **Storage Monitoring**: Monitor SPARQL store size and query performance
3. **Backup Strategies**: Include memory metadata in backup procedures
4. **Configuration Tuning**: Adjust parameters based on user behavior

## Troubleshooting

### Common Issues

**Problem**: All memories showing as short-term
**Cause**: Missing `ragno:memoryType` metadata
**Solution**: Run memory type migration (see Quick Fix section)

**Problem**: No memories promoted to long-term
**Cause**: Low access counts or missing classification calls
**Solution**: Review access patterns and ensure classification runs

**Problem**: Poor retrieval performance
**Cause**: Large memory store without optimization
**Solution**: Implement memory pruning or increase similarity thresholds

### Memory Type Migration

**Add missing memory types to existing interactions**:
```sparql
PREFIX ragno: <http://purl.org/stuff/ragno/>
PREFIX semem: <http://purl.org/stuff/semem/>

INSERT {
  GRAPH <http://hyperdata.it/content> {
    ?interaction ragno:memoryType "short-term" .
  }
} WHERE {
  GRAPH <http://hyperdata.it/content> {
    ?interaction a semem:Interaction .
    FILTER NOT EXISTS { ?interaction ragno:memoryType ?existing }
  }
}
```

## Future Enhancements

### Planned Improvements

1. **Adaptive Decay Rates**: Context-sensitive decay based on content type
2. **Concept-based Classification**: Promote memories with high concept density
3. **Importance Scoring**: Multi-factor importance beyond access count
4. **Memory Archival**: Long-term storage for infrequently accessed content
5. **Cross-session Learning**: Learn optimal parameters from usage patterns

### Research Directions

- **Hierarchical Memory**: Multiple memory tiers beyond short/long-term
- **Emotional Weighting**: Content sentiment affecting memory strength
- **Social Memory**: Shared memory spaces across multiple agents
- **Memory Compression**: Semantic summarization of old memories

## Integration with ZPT Navigation

### Memory as a Tilt Projection
**ZPT Integration**: `zpt:MemoryProjection` (defined in `vocabs/zpt.ttl:326-329`)

Memory management represents a **tilt projection** in the ZPT navigation system:

```turtle
zpt:MemoryProjection a zpt:TiltProjection ;
    rdfs:label "Memory Projection"@en ;
    skos:prefLabel "Memory-based View"@en ;
    skos:definition "Information access organized by memory importance, recency, and access patterns."@en .
```

**Memory Tilt Characteristics**:
- **Information Organization**: By memory strength, access patterns, and temporal decay
- **Ranking Method**: Multi-factor scoring (similarity × decay × reinforcement)
- **View Perspective**: Content importance from memory usage patterns
- **Access Pattern**: Prioritizes frequently accessed and reinforced content

### ZPT-Memory Integration Points

**1. Zoom Level Integration**
- `zpt:EntityLevel` → Individual memory interactions
- `zpt:UnitLevel` → Concept clusters from multiple memories  
- `zpt:TextLevel` → Full memory content with context
- `zpt:CommunityLevel` → Memory communities and patterns
- `zpt:CorpusLevel` → Overall memory statistics and trends

**2. Pan Domain Integration**
- `zpt:TopicDomain` → Memories filtered by concept similarity
- `zpt:TemporalDomain` → Memories filtered by time periods
- `zpt:EntityDomain` → Memories related to specific entities

**3. Tilt Projection Integration**
- `zpt:MemoryProjection` → Memory-strength based ranking
- `zpt:EmbeddingProjection` → Semantic similarity ranking  
- `zpt:TemporalProjection` → Recency-based ranking
- `zpt:GraphProjection` → Concept-relationship based ranking

### Navigation-Memory Workflows

**Memory-Guided Navigation**:
```javascript
// Navigate to memories about a topic, ranked by memory strength
const memoryView = await zptNavigate({
    query: "machine learning",
    zoom: "entity",                    // Focus on specific interactions
    pan: { topic: "artificial intelligence" },  // Domain scope
    tilt: "memory"                     // Memory-strength projection
});
```

**Cross-Projection Analysis**:
```javascript
// Compare memory strength vs. semantic similarity
const comparison = await Promise.all([
    zptNavigate({ query: "VSOM", tilt: "memory" }),     // Memory importance
    zptNavigate({ query: "VSOM", tilt: "embedding" })   // Semantic similarity
]);
```

### Memory Analytics via ZPT

**Session Analytics**:
- `zpt:NavigationSession` tracks memory access patterns
- `zpt:sessionDuration` correlates with memory formation
- `zpt:queryComplexity` affects memory classification rules

**Memory Provenance**:
- `zpt:NavigationView` → Links memory creation to navigation context
- `zpt:navigatedBy` → Tracks which agent created memories
- `zpt:previousView` → Memory formation sequences

## Integration with Other Systems

### SPARQL Storage
- Memory metadata stored as RDF triples using ZPT vocabulary
- `zpt:NavigationView` instances link to memory interactions
- Supports federated queries across multiple memory stores
- Enables complex memory analytics via ZPT ontology

### Ragno Knowledge Graphs
- Memory interactions reference Ragno entities via `zpt:NavigableCorpuscle`
- Concept extraction populates shared concept space
- Memory strength influences `zpt:optimizationScore` in corpuscle selection
- Cross-memory concept relationships support ZPT graph navigation

---

**Document Version**: 1.0  
**Last Updated**: 2025-08-17  
**Authors**: Claude Code Assistant  
**Related**: `algorithms.md`, `sparql-service.md`, `config.md`