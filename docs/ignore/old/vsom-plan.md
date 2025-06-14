# VSOM Implementation Plan

**Status**: Phase 1 Complete ✅ | **Showcase**: examples/VSOM.js ready for testing  
**Last Updated**: 2025-06-09  
**Primary Use Case**: Entity Clustering  

## Overview

Implementation plan for Vectorized Self-Organizing Map (VSOM) algorithm under `src/ragno/algorithms` with support for both in-memory resources and SPARQL query results. VSOM will provide entity clustering, visualization, and semantic organization capabilities for the Ragno knowledge graph system.

## Progress Tracking

### ✅ Planning Phase (Complete)
- [x] Research existing codebase architecture
- [x] Design VSOM integration points
- [x] Define RDF schema extensions
- [x] Plan file structure and API
- [x] Document implementation phases

### 🔄 Implementation Phases

#### **Phase 1: Core VSOM Engine** ✅ (Complete)
- [x] Implement `VSOMCore.js` - Core algorithm engine
- [x] Implement `VSOMTopology.js` - Map topology management  
- [x] Implement `VSOMTraining.js` - Training procedures
- [x] Implement main `VSOM.js` class
- [x] Basic entity loading from in-memory sources
- [x] Training procedures and convergence detection
- [x] Integration with algorithms suite (`index.js`)

#### **Phase 2: Data Integration** (Not Started)
- [ ] Implement `VSOMDataLoader.js` - Data input abstraction
- [ ] SPARQL query integration
- [ ] VectorIndex interfacing
- [ ] Embedding pipeline integration
- [ ] Batch processing capabilities
- [ ] Integration tests

#### **Phase 3: RDF Export and Clustering** (Not Started)
- [ ] Cluster identification algorithms
- [ ] RDF property generation (`ragno:cluster`, `ragno:mapPosition`, etc.)
- [ ] Integration with ragno namespace
- [ ] Export to RDF datasets
- [ ] Clustering validation

#### **Phase 4: Advanced Features** (Not Started)
- [ ] Implement `VSOMVisualization.js` - Visualization helpers
- [ ] Visualization export capabilities
- [ ] Integration with Hyde algorithm
- [ ] Integration with GraphAnalytics
- [ ] Performance optimization

#### **Phase 5: Production Features** ✅ (Core Complete)
- [x] Configuration management
- [x] Error handling and validation  
- [x] Create `examples/VSOM.js` showcase
- [x] Documentation and examples
- [ ] Performance benchmarking (future work)
- [ ] Unit tests (future work)

## Architecture

### File Structure

```
src/ragno/algorithms/
├── VSOM.js                    # Main VSOM implementation
├── vsom/
│   ├── VSOMCore.js           # Core algorithm engine
│   ├── VSOMTopology.js       # Map topology management
│   ├── VSOMTraining.js       # Training procedures
│   ├── VSOMVisualization.js  # Visualization helpers
│   └── VSOMDataLoader.js     # Data input abstraction
└── index.js                  # Updated to include VSOM
```

### Key Classes and Methods

#### VSOM.js Main Class
```javascript
class VSOM {
  constructor(options = {})
  
  // Data input methods
  async loadFromEntities(entities, embeddingHandler)
  async loadFromSPARQL(endpoint, query, embeddingHandler)
  async loadFromVectorIndex(vectorIndex, filters)
  
  // Training methods
  async train(iterations, learningRate, neighborhoodRadius)
  async trainBatch(data, batchSize)
  
  // Analysis methods
  getClusters(threshold)
  getNodeMappings()
  getTopology()
  
  // Export methods
  exportToRDF(dataset, namespaces)
  exportClusters(format)
  exportVisualization(type)
  
  // Integration with existing algorithms
  integrateWithHyde(hydeResults)
  integrateWithGraphAnalytics(graphResults)
}
```

## Data Integration Points

### 1. Entity Clustering (Primary Use Case)
```javascript
// Load entities with embeddings
const entities = await loadEntitiesFromSPARQL(sparqlEndpoint, entityQuery)
const vsom = new VSOM({ mapSize: [20, 20], dimension: 1536 })
await vsom.loadFromEntities(entities, embeddingHandler)
await vsom.train(1000, 0.1, 5.0)

// Export clusters to RDF with ragno:cluster property
const clusters = vsom.getClusters(0.8)
await vsom.exportToRDF(dataset, namespaces)
```

### 2. SPARQL Integration
```sparql
# Query entities with embeddings for clustering
SELECT ?entity ?label ?embedding ?type WHERE {
  ?entity a ragno:Entity ;
          rdfs:label ?label ;
          ragno:embedding ?embedding ;
          ragno:type ?type .
  FILTER(?type = "hypothetical-entity" || ?type = "extracted-concept")
}
```

### 3. In-Memory Resources
- Direct entity arrays from knowledge graph
- Cached embeddings from `VectorIndex`
- Results from previous algorithm runs
- Integration with existing `EmbeddingHandler`

## RDF Integration

### New Ragno Properties
- `ragno:cluster` - Cluster assignment
- `ragno:mapPosition` - Position on VSOM map (x,y coordinates)
- `ragno:clusterCentroid` - Cluster center in vector space
- `ragno:topologicalDistance` - Distance on map topology
- `ragno:clusterConfidence` - Clustering confidence score

### Export Format Example
```turtle
@prefix ragno: <http://purl.org/stuff/ragno/> .

ex:entity1 a ragno:Entity ;
    ragno:cluster ex:cluster_5 ;
    ragno:mapPosition "12,8"^^xsd:string ;
    ragno:clusterConfidence "0.85"^^xsd:decimal .

ex:cluster_5 a ragno:Cluster ;
    ragno:clusterCentroid "0.1,0.3,..."^^ragno:Vector ;
    ragno:memberCount "15"^^xsd:integer .
```

## Integration with Existing Systems

### Algorithm Suite Integration
- Update `src/ragno/algorithms/index.js` to include VSOM
- Add methods: `runEntityClustering()`, `runVSOMAnalysis()`
- Integrate with `getAllStatistics()` and `exportAllResultsToRDF()`

### Embedding Pipeline Integration
- Use existing `EmbeddingHandler` for vector generation
- Interface with `VectorIndex` for efficient nearest neighbor operations
- Support batch embedding generation for large entity sets

### Hyde Algorithm Synergy
- Cluster hypothetical entities separately from factual ones
- Use `ragno:maybe` property to filter entity types
- Visualize confidence distributions across clusters

## Configuration and Options

```javascript
const vsomConfig = {
  // Map topology
  mapSize: [20, 20],          // Grid dimensions
  topology: 'rectangular',    // 'rectangular', 'hexagonal'
  
  // Training parameters
  maxIterations: 1000,
  initialLearningRate: 0.1,
  finalLearningRate: 0.01,
  initialRadius: 5.0,
  finalRadius: 0.5,
  
  // Vectorization
  batchSize: 100,
  useGPU: false,
  
  // Data handling
  embeddingDimension: 1536,
  distanceMetric: 'cosine',
  
  // Clustering
  clusterThreshold: 0.8,
  minClusterSize: 3,
  
  // Export options
  exportVisualization: true,
  rdfExport: true
}
```

## Example Usage Scenarios

### 1. Entity Clustering (Primary)
```javascript
// Cluster entities from knowledge graph
const vsom = new VSOM(vsomConfig)
await vsom.loadFromSPARQL(endpoint, entityQuery, embeddingHandler)
await vsom.train(1000, 0.1, 5.0)
const clusters = vsom.getClusters(0.8)
await vsom.exportToRDF(dataset, namespaces)
```

### 2. Hypothesis Mapping
```javascript
// Cluster hypothetical content from Hyde
const hydeResults = await hyde.generateHypotheses(queries, llmHandler, dataset)
const vsom = new VSOM({ ...vsomConfig, mapSize: [15, 15] })
await vsom.loadFromEntities(hydeResults.entities, embeddingHandler)
await vsom.integrateWithHyde(hydeResults)
```

### 3. Knowledge Graph Layout
```javascript
// Create spatial layout for graph visualization
const vsom = new VSOM({ ...vsomConfig, topology: 'hexagonal' })
await vsom.loadFromVectorIndex(vectorIndex, { type: 'all' })
const layout = vsom.exportVisualization('coordinates')
```

## Core VSOM Features

### Map Topology
- 2D/3D grid structures with configurable dimensions
- Rectangular and hexagonal topologies
- Configurable boundary conditions (toroidal, bounded)

### Distance Metrics
- Cosine similarity (primary for embeddings)
- Euclidean distance
- Manhattan distance

### Learning Functions
- Gaussian neighborhood function
- Linear and exponential decay schedules
- Adaptive learning rate adjustment

### Batch Processing
- Vectorized updates for computational efficiency
- Support for large datasets
- Memory-efficient streaming

### Convergence Detection
- Monitor training progress
- Automatic stopping criteria
- Quality metrics and validation

## Dependencies and Requirements

### Existing Dependencies
- `rdf-ext` - RDF processing
- `hnswlib-node` - Vector similarity search (via VectorIndex)
- `loglevel` - Logging

### New Dependencies (if needed)
- Matrix operations library (consider `ml-matrix` or native JS)
- Visualization helpers (for coordinate export)

## Testing Strategy

### Unit Tests
- Core VSOM algorithm correctness
- Topology management
- Training convergence
- Data loading and validation

### Integration Tests
- SPARQL query integration
- RDF export validation
- Embedding pipeline integration
- Algorithm suite integration

### Performance Tests
- Large dataset handling
- Memory usage optimization
- Training time benchmarks

## Future Enhancements

### Potential Extensions
- 3D map topologies
- Dynamic map sizing
- Online learning capabilities
- GPU acceleration
- Real-time visualization
- Interactive exploration tools

### Integration Opportunities
- Community detection synergy
- Personalized PageRank integration
- Graph analytics correlation
- Search result clustering

## Notes and Considerations

### Technical Considerations
- Memory efficiency for large entity sets
- Embedding dimensionality handling
- Numerical stability in training
- Convergence criteria tuning

### Design Decisions
- Follow existing Ragno algorithm patterns
- Maintain RDF-first approach
- Ensure seamless integration with existing tools
- Prioritize entity clustering use case

### Implementation Guidelines
- Use existing namespace management
- Follow error handling patterns
- Maintain consistent logging approach
- Ensure compatibility with existing APIs

---

**Next Steps**: Begin Phase 1 implementation with `VSOMCore.js` and basic `VSOM.js` class structure.