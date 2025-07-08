# Graph Analytics

The `src/ragno/algorithms/GraphAnalytics.js` module provides comprehensive graph analysis algorithms optimized for RDF-based knowledge graphs following the Ragno ontology. These algorithms enable deep structural analysis of knowledge graphs created by the document processing pipeline.

## Overview

GraphAnalytics implements several key algorithms from graph theory and network analysis, specifically adapted for semantic knowledge graphs. The module converts RDF datasets into efficient graph representations and applies various centrality and connectivity algorithms to identify important entities, knowledge clusters, and information flow patterns.

## Core Algorithms

### 1. K-core Decomposition

**Method**: `computeKCore(graph)`

**Purpose**: Identifies node importance by finding maximal subgraphs where each vertex has at least k neighbors.

**Algorithm**: Iterative node removal based on degree thresholds.

**Use Cases**:
- Finding dense subgraphs and core structures in the knowledge graph
- Identifying highly interconnected concept clusters
- Ranking entity importance based on local connectivity

**Output**:
- `coreNumbers`: Map of node URI → core number
- `coreStats`: Distribution of nodes across core levels
- `maxCore`: Highest core number in the graph

**Example**:
```javascript
const analytics = new GraphAnalytics();
const graph = analytics.buildGraphFromRDF(dataset);
const kcoreResults = analytics.computeKCore(graph);

// Get nodes in the highest core
const topCoreNodes = analytics.getTopKNodes(kcoreResults.coreNumbers, 10);
```

### 2. Betweenness Centrality

**Method**: `computeBetweennessCentrality(graph, options)`

**Algorithm**: Brandes' algorithm implementation with BFS and accumulation phases.

**Purpose**: Identifies bridge nodes that lie on shortest paths between other nodes.

**Use Cases**:
- Finding nodes that control information flow in the network
- Identifying key concepts that connect different knowledge domains
- Detecting bottlenecks in knowledge propagation

**Output**:
- `centrality`: Map of node URI → normalized centrality score
- `maxCentrality`: Highest centrality score
- `minCentrality`: Lowest centrality score
- `avgCentrality`: Average centrality across all nodes

**Example**:
```javascript
const centralityResults = analytics.computeBetweennessCentrality(graph);

// Get most central entities
const bridgeNodes = analytics.getTopKNodes(centralityResults.centrality, 5);
console.log('Key bridge entities:', bridgeNodes);
```

### 3. Connected Components

**Method**: `findConnectedComponents(graph)`

**Algorithm**: Depth-First Search (DFS) traversal.

**Purpose**: Finds disconnected subgraphs within the knowledge graph.

**Use Cases**:
- Identifying isolated clusters of knowledge
- Detecting separate knowledge domains
- Finding unconnected concept groups

**Output**:
- `components`: Array of component objects with id, nodes, and size
- `nodeToComponent`: Map of node URI → component ID
- `largestComponent`: The largest connected component

**Example**:
```javascript
const componentResults = analytics.findConnectedComponents(graph);

console.log(`Found ${componentResults.components.length} components`);
console.log(`Largest component has ${componentResults.largestComponent.size} nodes`);
```

### 4. Graph Statistics

**Method**: `computeGraphStatistics(graph)`

**Purpose**: Provides comprehensive structural analysis of the knowledge graph.

**Metrics Computed**:
- Node and edge counts
- Degree distribution (min, max, average)
- Edge weight statistics
- Graph density
- Total weight

**Use Cases**:
- Understanding overall graph structure
- Comparing different knowledge graphs
- Monitoring graph evolution over time

**Output**:
```javascript
{
  nodeCount: 1250,
  edgeCount: 3420,
  density: 0.0044,
  avgDegree: 5.47,
  maxDegree: 45,
  minDegree: 1,
  avgWeight: 0.75,
  maxWeight: 1.0,
  minWeight: 0.1,
  totalWeight: 2565.0
}
```

## RDF Integration

### Graph Construction

**Method**: `buildGraphFromRDF(dataset, options)`

The module automatically converts RDF datasets into efficient graph representations:

**Node Extraction**:
- Recognizes `ragno:Entity` types as graph nodes
- Excludes `ragno:Relationship` instances (they become edges)
- Extracts node properties and metadata

**Edge Construction**:
- Uses `ragno:hasSourceEntity` and `ragno:hasTargetEntity` predicates
- Supports weighted edges via `ragno:hasWeight` property
- Maintains both directed and undirected graph views

**Options**:
- `undirected`: Creates bidirectional edges for undirected analysis

### Ragno Ontology Support

The module is specifically designed for the Ragno vocabulary:

**Input Predicates**:
- `rdf:type` with `ragno:Entity` for node identification
- `ragno:hasSourceEntity` for relationship sources
- `ragno:hasTargetEntity` for relationship targets
- `ragno:hasWeight` for edge weights

**Output Predicates**:
- `ragno:hasCoreNumber` for k-core results
- `ragno:hasBetweennessCentrality` for centrality scores
- `ragno:GraphAnalysis` for analysis metadata

## Usage Examples

### Complete Analysis Pipeline

```javascript
import GraphAnalytics from './src/ragno/algorithms/GraphAnalytics.js';
import rdf from 'rdf-ext';

// Initialize analytics
const analytics = new GraphAnalytics({
  maxIterations: 1000,
  convergenceThreshold: 1e-6,
  logProgress: true
});

// Load RDF dataset (from SPARQL store, file, etc.)
const dataset = await loadRagnoDataset();

// Build graph representation
const graph = analytics.buildGraphFromRDF(dataset);

// Run all analyses
const kcoreResults = analytics.computeKCore(graph);
const centralityResults = analytics.computeBetweennessCentrality(graph);
const componentResults = analytics.findConnectedComponents(graph);
const statsResults = analytics.computeGraphStatistics(graph);

// Get top entities by different metrics
const coreEntities = analytics.getTopKNodes(kcoreResults.coreNumbers, 10);
const bridgeEntities = analytics.getTopKNodes(centralityResults.centrality, 10);

console.log('Most densely connected entities:', coreEntities);
console.log('Key bridge entities:', bridgeEntities);
console.log('Graph overview:', statsResults);

// Export results back to RDF
const resultDataset = rdf.dataset();
analytics.exportResultsToRDF(kcoreResults, resultDataset);
analytics.exportResultsToRDF(centralityResults, resultDataset);
```

### Integration with Document Pipeline

The GraphAnalytics module works seamlessly with the document processing pipeline:

```javascript
// After running the document pipeline:
// 1. LoadPDFs.js - creates ragno:Unit instances
// 2. ChunkDocuments.js - creates chunks with OLO indexing
// 3. MakeEmbeddings.js - adds vector embeddings
// 4. ExtractConcepts.js - creates ragno:Corpuscle and concept entities
// 5. Decompose.js - creates ragno:Entity instances and relationships

// Now analyze the resulting knowledge graph:
const dataset = await sparqlStore.getDataset();
const analytics = new GraphAnalytics();
const graph = analytics.buildGraphFromRDF(dataset);

// Find most important concepts
const analysis = analytics.computeBetweennessCentrality(graph);
const keyConceptURIs = analytics.getTopKNodes(analysis.centrality, 20);

// Identify knowledge clusters
const components = analytics.findConnectedComponents(graph);
console.log(`Knowledge organized into ${components.components.length} clusters`);
```

## Configuration Options

### Constructor Options

```javascript
const analytics = new GraphAnalytics({
  maxIterations: 1000,        // Maximum iterations for iterative algorithms
  convergenceThreshold: 1e-6, // Convergence threshold for centrality
  logProgress: false          // Enable progress logging
});
```

### Graph Building Options

```javascript
const graph = analytics.buildGraphFromRDF(dataset, {
  undirected: true  // Create undirected graph for certain analyses
});
```

## Performance Considerations

### Algorithm Complexity

- **K-core**: O(m) where m is the number of edges
- **Betweenness Centrality**: O(nm + n²log n) where n is nodes, m is edges
- **Connected Components**: O(n + m)
- **Graph Statistics**: O(n + m)

### Memory Usage

The module creates in-memory graph representations:
- Adjacency lists for efficient traversal
- Node and edge maps for property storage
- Temporary data structures during computation

For large graphs (>100K nodes), consider:
- Processing in batches
- Using streaming algorithms
- Implementing disk-based storage

### Optimization Tips

1. **Use specific graph queries** to focus on relevant subgraphs
2. **Cache graph representations** when running multiple analyses
3. **Monitor memory usage** with large knowledge graphs
4. **Consider sampling** for very large graphs

## Error Handling

The module includes robust error handling:

```javascript
try {
  const results = analytics.computeBetweennessCentrality(graph);
} catch (error) {
  console.error('Analysis failed:', error.message);
  // Fallback to simpler algorithms or subgraph analysis
}
```

Common issues:
- **Empty graphs**: Returns zero/empty results gracefully
- **Disconnected graphs**: Handles multiple components correctly
- **Invalid weights**: Defaults to weight 1.0 for missing values
- **Memory limits**: Provides progress callbacks for monitoring

## Integration with Semem

GraphAnalytics integrates with the broader Semem ecosystem:

### SPARQL Integration

```javascript
// Query results can be stored back to SPARQL
const sparqlTriples = [];
for (const [nodeUri, score] of centralityResults.centrality) {
  sparqlTriples.push(`<${nodeUri}> ragno:betweennessCentrality ${score} .`);
}

await sparqlHelper.executeUpdate(
  sparqlHelper.createInsertDataQuery(graphUri, sparqlTriples.join('\n'))
);
```

### Memory Management

```javascript
// Clean up resources
analytics.getStatistics(); // Get final stats
// Graph objects are garbage collected automatically
```

### Logging

GraphAnalytics uses the Semem logging system:

```javascript
import { logger } from '../../Utils.js';
logger.setLevel('debug'); // Enable detailed progress logging
```

## Future Extensions

Planned algorithm additions:
- PageRank centrality
- Community detection (Louvain algorithm)
- Graph clustering coefficients
- Shortest path algorithms
- Temporal graph analysis for knowledge evolution

The modular design allows easy extension with additional algorithms while maintaining the RDF-first approach and Ragno ontology compatibility.