# Index Cache Management

## Overview

The Semem system uses a persistent vector index cache to store and manage document embeddings for semantic search. This cache consists of two main components that work together to provide fast search capabilities while maintaining data persistence across system restarts.

## Components

### 1. Binary Vector Index (`ragno-vector.index`)
- **Technology**: HNSW (Hierarchical Navigable Small World) algorithm
- **Purpose**: Stores the actual vector embeddings and index structure for fast similarity search
- **Format**: Binary file optimized for performance
- **Location**: `./data/ragno-vector.index`

### 2. Metadata Cache (`ragno-metadata.json`)
- **Purpose**: Stores all associated metadata that the binary index cannot handle
- **Format**: JSON file for human readability and debugging
- **Location**: `./data/ragno-metadata.json`

## Metadata Structure

The `ragno-metadata.json` file contains the following top-level sections:

### `options`
HNSW vector index configuration parameters:
```json
{
  "dimension": 768,
  "maxElements": 100000,
  "efConstruction": 200,
  "mMax": 16,
  "efSearch": 100,
  "seed": 100
}
```

### `nodeMetadata`
Complete metadata for each indexed document:
```json
{
  "0": {
    "uri": "http://purl.org/stuff/instance/chunk/...",
    "type": "http://purl.org/stuff/ragno/Unit",
    "content": "Full text content of the document...",
    "embedding": [0.011817932, 0.09082031, ...]
  }
}
```

### `uriToNodeId`
Maps document URIs to internal node IDs for fast lookup:
```json
{
  "http://purl.org/stuff/instance/chunk/...": 0,
  "http://purl.org/stuff/instance/chunk/...": 1
}
```

### `typeToNodes`
Groups nodes by their RDF type for efficient type-based filtering:
```json
{
  "http://purl.org/stuff/ragno/Unit": [0, 1, 2, ...],
  "http://purl.org/stuff/ragno/Entity": [150, 151, ...]
}
```

### `nextNodeId`
Counter for assigning new node IDs when adding documents:
```json
{
  "nextNodeId": 196
}
```

### `stats`
Usage statistics and performance metrics:
```json
{
  "totalNodes": 196,
  "nodesByType": {},
  "lastIndexTime": "2025-07-10T15:51:18.692Z",
  "searchCount": 203,
  "averageSearchTime": 0.4433497536945814
}
```

## Implementation

### Save Operation
Located in `/src/ragno/search/VectorIndex.js`:

```javascript
async saveIndex(indexPath, metadataPath) {
    // Save binary HNSW index
    this.index.writeIndex(indexPath)
    
    // Save metadata
    const metadataObj = {
        options: this.options,
        nodeMetadata: Object.fromEntries(this.nodeMetadata),
        uriToNodeId: Object.fromEntries(this.uriToNodeId),
        typeToNodes: Object.fromEntries(
            Array.from(this.typeToNodes.entries()).map(([type, nodeSet]) => 
                [type, Array.from(nodeSet)]
            )
        ),
        nextNodeId: this.nextNodeId,
        stats: this.stats
    }
    
    await fs.writeFile(metadataPath, JSON.stringify(metadataObj, null, 2))
}
```

### Load Operation
```javascript
async loadIndex(indexPath, metadataPath) {
    // Load binary HNSW index
    this.index.readIndex(indexPath)
    
    // Load and restore metadata
    const metadataContent = await fs.readFile(metadataPath, 'utf-8')
    const metadataObj = JSON.parse(metadataContent)
    
    // Restore internal state
    this.options = { ...this.options, ...metadataObj.options }
    this.nodeMetadata = new Map(Object.entries(metadataObj.nodeMetadata))
    this.uriToNodeId = new Map(Object.entries(metadataObj.uriToNodeId))
    this.typeToNodes = new Map(
        Object.entries(metadataObj.typeToNodes).map(([type, nodeArray]) => 
            [type, new Set(nodeArray)]
        )
    )
    this.nextNodeId = metadataObj.nextNodeId
    this.stats = metadataObj.stats
}
```

## Configuration

The index cache paths can be configured in the RagnoSearch options:

```javascript
const ragnoSearch = new RagnoSearch({
    indexPath: './data/ragno-vector.index',      // Binary index
    metadataPath: './data/ragno-metadata.json', // Metadata cache
    indexPersistence: true,                      // Enable saving/loading
    autoIndex: true                              // Auto-save on changes
})
```

## Benefits

### Performance
- **Fast startup**: Avoids recomputing embeddings and rebuilding index
- **Incremental updates**: Only new documents need processing
- **Optimized search**: Pre-built HNSW index provides sub-millisecond search

### Reliability
- **State persistence**: System maintains search capability across restarts
- **Crash recovery**: Index can be restored from last saved state
- **Debugging**: Human-readable metadata for troubleshooting

### Scalability
- **Memory efficient**: Large indices don't need to fit entirely in memory
- **Distributed deployment**: Index files can be shared across instances
- **Version control**: Metadata changes can be tracked and compared

## Maintenance

### Monitoring
Check index statistics:
```bash
# View current stats
jq '.stats' ./data/ragno-metadata.json

# Check index size
ls -lh ./data/ragno-*
```

### Rebuilding
If the index becomes corrupted or needs optimization:
```bash
# Remove existing index
rm ./data/ragno-vector.index ./data/ragno-metadata.json

# Restart system to rebuild from source documents
node examples/document/Search.js "test query"
```

### Backup
Critical for production deployments:
```bash
# Backup both files together
cp ./data/ragno-vector.index ./backup/
cp ./data/ragno-metadata.json ./backup/
```

## Troubleshooting

### Common Issues

**Index files out of sync**:
- Symptom: Search errors or missing results
- Solution: Remove both files and rebuild

**Memory usage growing**:
- Symptom: Increasing memory consumption
- Solution: Check `stats.totalNodes` and consider index optimization

**Slow search performance**:
- Symptom: High `averageSearchTime`
- Solution: Verify `efSearch` parameter and index size

### Debug Commands
```bash
# Check index integrity
node -e "
const fs = require('fs');
const data = JSON.parse(fs.readFileSync('./data/ragno-metadata.json'));
console.log('Nodes:', data.stats.totalNodes);
console.log('Types:', Object.keys(data.typeToNodes));
console.log('Performance:', data.stats.averageSearchTime + 'ms');
"
```

## See Also

- [Vector Search Configuration](./vector-search.md)
- [Document Processing Pipeline](./document-processing.md)
- [Performance Tuning](./performance.md)