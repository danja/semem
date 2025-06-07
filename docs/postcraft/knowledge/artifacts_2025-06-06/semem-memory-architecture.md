# Semem Memory Architecture

## Overview

Semem implements a dual-memory system inspired by cognitive science, with distinct short-term and long-term memory stores that work together to provide context-aware responses.

## Memory Types

### Short-Term Memory
- **Purpose**: Stores recent interactions for immediate context
- **Structure**: Array of interaction objects in `MemoryStore.shortTermMemory`
- **Features**:
  - Dynamic decay factor (starts at 1.0)
  - Access count tracking
  - Timestamp-based aging
  - Concept associations

### Long-Term Memory
- **Purpose**: Stores frequently accessed or important interactions
- **Structure**: Array in `MemoryStore.longTermMemory`
- **Promotion Criteria**: Interactions with `accessCount > 10`

## Memory Lifecycle

### 1. **Addition** (MemoryManager.addInteraction)
```javascript
// New interactions always start in short-term memory
{
  id: uuidv4(),
  prompt: "user input",
  output: "system response",
  embedding: [vector],
  timestamp: Date.now(),
  accessCount: 1,
  concepts: ["extracted", "concepts"],
  decayFactor: 1.0
}
```

### 2. **Retrieval** (MemoryStore.retrieve)
- Similarity search using cosine similarity on embeddings
- Time decay: `decayFactor * e^(-0.0001 * timeDiff)`
- Reinforcement: `log(1 + accessCount)`
- Adjusts decay factors:
  - Retrieved items: `decayFactor *= 1.1`
  - Non-retrieved items: `decayFactor *= 0.9`

### 3. **Classification** (MemoryStore.classifyMemory)
- Runs periodically during retrieval
- Moves high-access items (>10 accesses) to long-term memory
- Prevents duplicates using ID checking

### 4. **Persistence**
Storage backends handle both memory types:
- **JSONStore**: Saves as `{shortTermMemory: [], longTermMemory: []}`
- **SPARQLStore**: Uses `mcp:memoryType` property ("short-term" or "long-term")

## Advanced Features

### Concept Graph
- Builds relationships between concepts using Graphology
- Enables spreading activation for related memory retrieval
- Weights edges by co-occurrence frequency

### Semantic Clustering
- Uses k-means clustering on embeddings
- Groups similar memories for efficient retrieval
- Maintains cluster centroids for fast similarity search

### Context Window Management
- `ContextManager` integrates both memory types
- Prioritizes by relevance and recency
- Manages token limits for LLM context