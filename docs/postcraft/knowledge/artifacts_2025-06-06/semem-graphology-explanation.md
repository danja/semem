# Graphology in Semem: Concept Graph System

## Overview

Semem uses [Graphology](https://graphology.github.io/), a JavaScript library for graph data structures, to build and maintain a concept relationship network. This enhances memory retrieval beyond simple vector similarity.

## Implementation Details

### Graph Structure (MemoryStore.js)

```javascript
this.graph = new Graph({ 
    multi: true,           // Allows multiple edges between nodes
    allowSelfLoops: false  // Prevents self-referential edges
})
```

### Concept Graph Building

The `updateGraph()` method builds relationships:

1. **Node Creation**: Each concept becomes a graph node
2. **Edge Creation**: Concepts from the same interaction are connected
3. **Weight Management**: Co-occurrence frequency increases edge weights

```javascript
// From the same interaction, concepts are related
concepts = ["AI", "machine learning", "neural networks"]
// Creates edges: AI↔machine learning, AI↔neural networks, etc.
```

### Spreading Activation Algorithm

The `spreadingActivation()` method implements a cognitive science technique:

1. **Initial Activation**: Query concepts start with activation = 1.0
2. **Propagation**: Activation spreads to neighbors with decay
3. **Iteration**: Process repeats for 2 steps (configurable)
4. **Decay Formula**: `newActivation = currentActivation * 0.5 * edgeWeight`

### Example Flow

```
Query: "deep learning algorithms"
Initial concepts: ["deep learning", "algorithms"]

Step 1:
- "deep learning" (1.0) → activates "neural networks" (0.5 * weight)
- "algorithms" (1.0) → activates "optimization" (0.5 * weight)

Step 2:
- "neural networks" (0.5) → activates "AI" (0.25 * weight)
- Activation spreads further with continued decay
```

## Benefits

### 1. **Semantic Expansion**
- Finds related memories even without direct keyword matches
- Example: Query "ML" can retrieve memories about "artificial intelligence"

### 2. **Contextual Retrieval**
- Edge weights capture concept relationships strength
- Frequently co-occurring concepts have stronger connections

### 3. **Efficient Navigation**
- Graph structure enables fast traversal
- Limits propagation depth to prevent computational explosion

## Integration with Memory Retrieval

The concept graph works alongside vector similarity:

1. **Vector Search**: Finds memories with similar embeddings
2. **Graph Activation**: Identifies conceptually related memories
3. **Combined Scoring**: `totalScore = similarity + activationScore`
4. **Result Ranking**: Memories sorted by combined relevance

## Advanced Features

### Dynamic Learning
- Graph evolves as new interactions are added
- Edge weights increase with repeated co-occurrences
- Captures emerging concept relationships

### Memory Clustering
- Graph communities can identify topic clusters
- Enables efficient batch retrieval of related memories

### Pruning Potential
- Low-weight edges could be removed to maintain efficiency
- Inactive nodes could be archived (not currently implemented)