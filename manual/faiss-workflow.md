# FAISS Workflow Documentation

This document describes the operation of FAISS (Facebook AI Similarity Search) indexing, embeddings, filtering, and search within the Semem system.

## Overview

FAISS is used in Semem to provide fast vector similarity search for stored content. It works alongside SPARQL storage to enable rapid semantic search across large collections of documents and interactions.

## Architecture

### Components

1. **SPARQLStore**: Primary storage that manages both SPARQL persistence and FAISS indexing
2. **SearchService**: Unified search interface that queries both FAISS and SPARQL
3. **EmbeddingService**: Generates vector embeddings using external APIs (Nomic, Ollama)
4. **Mapping System**: Maintains alignment between FAISS indices and memory arrays

### Data Flow

```
Content → Embedding Generation → SPARQL Storage → FAISS Indexing → Search Index
```

## FAISS Index Management

### Index Creation

The FAISS index is created during SPARQLStore initialization:

```javascript
// Initialize FAISS index with embedding dimension
this.index = new faiss.IndexFlatL2(this.dimension); // 768D for Nomic embeddings
```

### Index Types

- **IndexFlatL2**: Uses L2 (Euclidean) distance for similarity calculation
- **Dimension**: Fixed at 768 for Nomic embeddings, 1536 for Ollama embeddings

### Index Rebuilding

The FAISS index is rebuilt from SPARQL data when the server starts:

```javascript
// Rebuild FAISS index with ONLY valid embeddings
if (this.embeddings.length > 0) {
    this.index = new faiss.IndexFlatL2(this.dimension);

    // Create mapping arrays to track valid embeddings
    this.faissToMemoryMap = [];  // Maps FAISS index → shortTermMemory index
    this.memoryToFaissMap = new Array(this.embeddings.length).fill(-1);
}
```

## Embedding Processing

### Validation Pipeline

1. **Dimension Check**: Ensures embeddings match expected dimension (768D)
2. **Content Validation**: Verifies embeddings contain valid numeric values
3. **Zero Vector Detection**: Filters out all-zero embeddings

### Invalid Embedding Handling

Invalid embeddings are **skipped entirely** rather than replaced with defaults:

```javascript
if (Array.isArray(embedding) && embedding.length === this.dimension) {
    const hasValidNumbers = embedding.some(val =>
        typeof val === 'number' && !isNaN(val) && val !== 0
    );
    if (hasValidNumbers) {
        isValidEmbedding = true;
    }
}

if (isValidEmbedding) {
    // Add to FAISS and update mapping
} else {
    // Skip and log
    console.log(`⚠️ [SPARQLStore] Skipping invalid embedding ${i}`);
}
```

## Mapping System

### Purpose

Since invalid embeddings are skipped, FAISS indices don't align 1:1 with memory arrays. The mapping system maintains correct relationships.

### Mapping Arrays

```javascript
// Maps FAISS index → shortTermMemory index
this.faissToMemoryMap = [];

// Maps shortTermMemory index → FAISS index (-1 if no FAISS entry)
this.memoryToFaissMap = new Array(this.embeddings.length).fill(-1);
```

### Mapping Updates

When new content is added:

```javascript
const newFaissIndex = afterTotal - 1; // Latest FAISS index
const newMemoryIndex = this.shortTermMemory.length - 1; // Latest memory index

// Record bidirectional mapping
this.faissToMemoryMap[newFaissIndex] = newMemoryIndex;
this.memoryToFaissMap[newMemoryIndex] = newFaissIndex;
```

## Search Workflow

### 1. Query Embedding Generation

```javascript
const queryEmbedding = await embeddingService.generateEmbedding(question);
```

### 2. FAISS Search Execution

```javascript
const k = Math.min(limit * 2, this.faissIndex.ntotal());
const results = this.faissIndex.search(queryEmbedding, k);
```

### 3. Distance to Similarity Conversion

FAISS returns L2 distances; these are converted to similarities:

```javascript
convertDistanceToSimilarity(distance) {
    // Convert L2 distance to cosine-like similarity (0-1 range)
    return 1 / (1 + distance);
}
```

### 4. Result Mapping

Using the mapping system to retrieve correct content:

```javascript
if (this.memoryStore.faissToMemoryMap && faissIndex < this.memoryStore.faissToMemoryMap.length) {
    const memoryIndex = this.memoryStore.faissToMemoryMap[faissIndex];
    const memoryItem = this.memoryStore.shortTermMemory[memoryIndex];

    if (memoryItem) {
        content = memoryItem.content || memoryItem.prompt;
    }
}
```

### 5. Threshold Filtering

Results are filtered by similarity threshold:

```javascript
if (similarity >= threshold) {
    faissResults.push({
        id: `faiss_${faissIndex}`,
        prompt: prompt,
        response: response,
        content: content,
        similarity: similarity,
        metadata: { format: 'faiss', index: faissIndex, distance: distance }
    });
}
```

## Storage Workflow

### New Content Storage

1. **Generate Embedding**: Create vector representation
2. **Store in SPARQL**: Persist to triple store
3. **Add to Memory**: Update in-memory arrays
4. **Index in FAISS**: Add to search index
5. **Update Mappings**: Record FAISS ↔ Memory relationships

### Critical Implementation Note

The `storeWithMemory()` method **does NOT** call `_ensureMemoryLoaded()` after storing new content, as this would rebuild the FAISS index and lose the newly added content.

```javascript
// AVOID: This would overwrite the FAISS index
// await this._ensureMemoryLoaded();

// INSTEAD: Preserve FAISS state and update mappings
logger.info(`[PHASE2] Skipping _ensureMemoryLoaded() to preserve FAISS state`);
```

## Performance Characteristics

### Index Size Optimization

- **Valid Embeddings Only**: Typical reduction from 106 total memories to ~52 valid embeddings
- **Memory Efficiency**: Skips invalid embeddings rather than storing defaults
- **Search Speed**: Faster searches due to smaller index size

### Search Performance

- **Parallel Search**: FAISS and SPARQL searches run concurrently
- **Batch Processing**: Searches for `k = limit * 2` results for filtering
- **Threshold Optimization**: Early filtering reduces result processing overhead

## Configuration

### Similarity Thresholds

Default thresholds in `config/preferences.js`:

```javascript
SPARQL_CONFIG: {
    SIMILARITY: {
        DEFAULT_THRESHOLD: 0.1  // Lowered for better recall
    }
}
```

### Embedding Dimensions

- **Nomic API**: 768 dimensions
- **Ollama**: 1536 dimensions (fallback)

## Debugging and Monitoring

### Logging Phases

1. **Phase 1**: Entry point analysis and SPARQL storage
2. **Phase 2**: Memory state preservation
3. **Phase 3**: FAISS indexing with mapping updates
4. **Phase 4**: Search execution and result mapping

### Key Log Messages

```
🔧 [SPARQLStore] Rebuilt FAISS index: 52 valid embeddings added, 54 invalid embeddings skipped
🔍 [SPARQLStore] FAISS[0] → shortTermMemory[49]: "content preview..."
🔗 [PHASE3] Updated mappings: FAISS[55] ↔ memory[109]
✅ [SearchService] FAISS[1] → memory[0]: "content preview..."
```

## Common Issues and Solutions

### Issue: Search Returns Wrong Content

**Cause**: FAISS index corruption from invalid embeddings
**Solution**: Mapping system ensures correct content retrieval

### Issue: New Content Not Found

**Cause**: Memory reload overwrites FAISS index
**Solution**: Skip `_ensureMemoryLoaded()` in `storeWithMemory()`

### Issue: Embedding Dimension Mismatch

**Cause**: Mixed embedding providers (768D vs 1536D)
**Solution**: Consistent provider configuration, skip invalid dimensions

### Issue: Zero Similarity Results

**Cause**: All-zero or invalid embeddings
**Solution**: Embedding validation pipeline filters invalid vectors

## Best Practices

1. **Consistent Embedding Provider**: Use single provider (Nomic) for all embeddings
2. **Threshold Tuning**: Adjust similarity thresholds based on use case
3. **Index Monitoring**: Track valid vs invalid embedding ratios
4. **Mapping Verification**: Ensure FAISS indices map to correct content
5. **Periodic Cleanup**: Remove invalid embeddings from SPARQL store

## Future Improvements

1. **Index Persistence**: Save/load FAISS index to avoid rebuilding
2. **Incremental Updates**: Add embeddings without full index rebuild
3. **Advanced Index Types**: Consider HNSW for larger datasets
4. **Embedding Recomputation**: Background job to fix invalid embeddings
5. **Similarity Metrics**: Experiment with cosine vs L2 distance