# VSOM (Visual Self-Organizing Map) in Semem

## Overview

VSOM is a **Vectorized Self-Organizing Map** implementation that transforms high-dimensional entity embeddings from knowledge graphs into organized 2D spatial clusters for visualization and analysis.

VSOM is part of the Ragno knowledge graph processing system within Semem and provides intelligent spatial organization of semantic entities, enabling both automated clustering and interactive visual exploration of knowledge structures.

## Standalone VSOM UI (VSOM Workbench)

The standalone VSOM workbench available at `src/frontend/vsom-standalone` provides a browser-based way to explore live MCP data. Recent updates focus on usability and deterministic graph rendering:

- **Knowledge Graph Summary** – the data panel now shows total node/edge counts plus the most common node types so you can see at a glance whether the proxy is talking to Fuseki.
- **Deterministic Layout** – the client derives repeatable positions from the inspected knowledge graph (instead of random scatter) so refreshes no longer scramble the map.
- **Connection Reuse** – existing graph edges are reused where possible, so the visualization highlights real relationships rather than synthesized similarity edges.
- **Contextual Interaction Feed** – the right panel presents the same ranked nodes that power the visualization, giving a textual way to inspect what each bubble represents.
- **Adaptive Bounds** – layout bounds are computed from the node coordinates (not random padding), keeping the map centred regardless of data size.

You can start the standalone server with `node src/frontend/vsom-standalone/server.js` (or via `./start.sh`) and visit `http://localhost:4103`. The UI proxies to the MCP HTTP server on port 4101, so be sure the MCP service is running first.

## What is VSOM?

VSOM transforms high-dimensional entity embeddings (typically 1536 dimensions from nomic-embed-text) into a 2D grid structure where semantically similar entities are positioned close to each other, enabling:

- **Entity clustering** based on semantic similarity
- **Visual knowledge exploration** through spatial organization
- **Knowledge graph analysis** with neighborhood preservation
- **RDF integration** with semantic web standards

## Core Purpose

The primary goal is to take complex high-dimensional semantic relationships and transform them into an intuitive 2D spatial map where "nearby" means "semantically similar".

## Complete Workflow: Step-by-Step

### STEP 1: Input Data

**What goes in:**
- **Entities**: Objects with URIs, content, and semantic embeddings
- **Embeddings**: 1536-dimensional vectors (from nomic-embed-text model)  
- **Configuration**: Map parameters (size, topology, training settings)

**Input sources:**
```javascript
// Entity arrays with embeddings
{"type": "entities", "entities": [
  {"uri": "http://example.org/entity1", "content": "AI research", "embedding": [0.1, 0.2, ...]},
  {"uri": "http://example.org/entity2", "content": "Machine learning", "embedding": [0.15, 0.18, ...]}
]}

// SPARQL endpoints
{"type": "sparql", "endpoint": "http://localhost:3030/dataset/query", "query": "SELECT * WHERE {...}"}

// Sample data generation
{"type": "sample", "count": 50}
```

**Data Sources:**
- Direct entity arrays with pre-computed embeddings
- SPARQL endpoints for knowledge graph data
- Generated sample data for testing
- Vector indices from existing systems

### STEP 2: Map Initialization

**Core Components Setup:**
- **VSOMCore**: Manages weight matrices and distance calculations
- **VSOMTopology**: Handles map structure (rectangular/hexagonal grids)
- **VSOMTraining**: Controls learning schedules and convergence

**Operations:**
- Create a 2D grid (default 20×20 = 400 nodes)
- Initialize random weight vectors for each grid node (1536 dimensions each)
- Set up topology (rectangular/hexagonal)
- Configure distance metrics (cosine similarity)

**Algorithm Parameters:**
```javascript
{
  mapSize: [20, 20],              // 400 nodes total
  embeddingDimension: 1536,       // Input vector size
  topology: 'rectangular',        // Grid layout
  distanceMetric: 'cosine',       // Similarity measure
  maxIterations: 1000,            // Training steps
  initialLearningRate: 0.1,       // Starting learning rate
  finalLearningRate: 0.01,        // Ending learning rate
  initialRadius: 5.0,             // Starting neighborhood size
  finalRadius: 0.5                // Ending neighborhood size
}
```

### STEP 3: Training Process

**Core Algorithm (iterative):**

For each training iteration:

1. **Find Best Matching Unit (BMU)**: For each input entity, calculate cosine similarity between its embedding and all grid node weights, select the closest node

2. **Update Neighborhood**: Update weights of the BMU and surrounding nodes based on:
   - Distance from BMU (Gaussian decay)
   - Current learning rate (decreases over time)
   - Neighborhood radius (shrinks over time)

3. **Weight Update Formula**:
   ```
   new_weight = old_weight + learning_rate × neighborhood_factor × (input_vector - old_weight)
   ```

4. **Decay Parameters**: Gradually reduce learning rate and neighborhood radius to achieve convergence

**Iterative Learning Steps:**

1. **Weight Initialization**: Random weight vectors for each map node
2. **BMU Finding**: For each input entity, find Best Matching Unit (closest node)
3. **Neighborhood Updates**: Update weights of BMU and surrounding nodes
4. **Schedule Decay**: Gradually reduce learning rate and neighborhood radius
5. **Convergence Check**: Monitor quantization error for stability

**Training Algorithms:**
- **Learning Rate Schedules**: Exponential, linear, inverse, step decay
- **Neighborhood Functions**: Gaussian, Mexican hat, bubble, linear
- **Distance Metrics**: Cosine, Euclidean, Manhattan
- **Batch Processing**: Configurable batch sizes for efficiency

### STEP 4: Quality Monitoring

**Performance Measures:**
- **Quantization Error**: Average distance between entities and their BMUs
- **Topographic Error**: Measure of neighborhood preservation
- **Convergence Detection**: Statistical analysis of error stability
- **Training Progress**: Real-time monitoring with callbacks

**Metrics tracked:**
- **Quantization Error**: Average distance between entities and their BMUs
- **Topographic Error**: Measure of neighborhood preservation  
- **Convergence Detection**: Statistical analysis of error stability
- **Training Progress**: Real-time monitoring with iteration callbacks

### STEP 5: Clustering Generation

**Post-Training Analysis:**
- **Similarity-Based Clustering**: Group adjacent nodes with similar weights
- **Configurable Thresholds**: Adjustable similarity requirements
- **Minimum Cluster Size**: Filter out small, insignificant clusters
- **Cluster Validation**: Quality assessment of generated clusters

**Post-training operations:**
- Group adjacent grid nodes with similar weight vectors
- Apply similarity thresholds (configurable)
- Filter clusters by minimum size requirements
- Calculate cluster centroids and statistics

**Clustering algorithm:**
```javascript
clusters = []
for each unvisited_node:
    if similarity(node, neighbors) > threshold:
        cluster = expandCluster(node, threshold)
        if cluster.size >= minClusterSize:
            clusters.push(cluster)
```

### STEP 6: Output Generation

#### **A. Entity Mappings**
```javascript
{
  entityIndex: 0,
  entity: originalEntityObject,
  mapPosition: [12, 8],           // 2D grid coordinates
  nodeIndex: 172,                 // Linear index (y*width + x)
  distance: 0.234,                // Distance to BMU
  clusterID: 3                    // Assigned cluster
}
```

#### **B. Cluster Information**  
```javascript
{
  id: 3,
  members: [172, 173, 193, 194],  // Grid node indices
  centroid: [0.15, 0.23, ...],    // Average weight vector
  entities: [entity1, entity2],    // Assigned entities
  memberCount: 4,
  confidence: 0.876
}
```

#### **C. Visualization Coordinates**
```javascript
{
  grid: {
    nodes: [
      {nodeIndex: 0, coords: [0,0], weights: [...], entity: null},
      {nodeIndex: 1, coords: [1,0], weights: [...], entity: entityObj}
    ]
  },
  clusters: [...],
  qualityMetrics: {
    quantizationError: 0.234,
    topographicError: 0.045
  }
}
```

### STEP 7: RDF Integration

**Semantic Web Export:**
- **Cluster Definitions**: `ragno:Cluster` types with member counts
- **Entity Assignments**: `ragno:cluster` properties linking entities to clusters
- **Map Positions**: `ragno:mapPosition` coordinates for visualization
- **Confidence Scores**: `ragno:clusterConfidence` based on BMU distances

**Semantic web export:**
- Generate RDF triples using Ragno vocabulary
- Export cluster definitions as `ragno:Cluster` types
- Link entities to clusters via `ragno:cluster` properties
- Include spatial coordinates and confidence scores

**RDF Triples Generated:**
```turtle
:cluster_0 a ragno:Cluster ;
           ragno:memberCount "5"^^xsd:integer ;
           ragno:clusterCentroid "0.1,0.2,..."^^ragno:Vector .

:entity_1 ragno:cluster :cluster_0 ;
          ragno:mapPosition "12,8"^^xsd:string ;
          ragno:clusterConfidence "0.876"^^xsd:decimal .
```

### STEP 8: Frontend Integration

**Web Interface Components:**
- **Grid Visualization**: Interactive 2D map display
- **Training Controls**: Start/stop training with progress monitoring
- **Feature Maps**: U-Matrix and component plane visualizations
- **Cluster Analysis**: Visual cluster inspection and statistics
- **Data Loading**: Support for multiple input formats

**What comes out:**
- **Interactive 2D grid**: Visual map showing entity positions
- **Cluster visualizations**: Color-coded regions showing semantic groups
- **Training controls**: Real-time parameter adjustment and monitoring
- **Feature maps**: U-Matrix showing distances between neighboring nodes
- **Export capabilities**: Save coordinates, clusters, and RDF data

**UI Workflow:**
1. Load data (entities, SPARQL, or samples)
2. Configure training parameters
3. Start training with real-time progress
4. View results in different visualization modes
5. Export clusters and coordinates

## Key Algorithmic Steps in Detail

### **Training Loop (Core Algorithm)**
```javascript
for (iteration = 0; iteration < maxIterations; iteration++) {
  // 1. Calculate current parameters
  learningRate = exponentialDecay(iteration)
  neighborhoodRadius = exponentialDecay(iteration)
  
  // 2. Process all training data
  for (entity of shuffledEntities) {
    // 3. Find Best Matching Unit
    bmuIndex = findClosestNode(entity.embedding)
    bmuCoords = indexToCoordinates(bmuIndex)
    
    // 4. Update weights in neighborhood
    for (node of allNodes) {
      distance = calculateMapDistance(bmuCoords, node.coords)
      neighborhoodWeight = gaussianFunction(distance, neighborhoodRadius)
      
      if (neighborhoodWeight > threshold) {
        // 5. Apply weight update
        for (dim = 0; dim < embeddingDimension; dim++) {
          weightDelta = learningRate * neighborhoodWeight * 
                       (entity.embedding[dim] - node.weights[dim])
          node.weights[dim] += weightDelta
        }
      }
    }
  }
  
  // 6. Check convergence and log progress
}
```

### **Clustering Algorithm**
```javascript
// Post-training cluster generation
clusters = []
visited = new Set()

for (node of allNodes) {
  if (!visited.has(node)) {
    cluster = expandCluster(node, similarityThreshold, visited)
    if (cluster.size >= minClusterSize) {
      clusters.push(cluster)
    }
  }
}
```

## Integration with Semem Ecosystem

### **Data Flow Integration**
1. **Entity Sources**: Ragno entity extraction → VSOM clustering
2. **Embedding Pipeline**: LLM embeddings → VSOM training data
3. **SPARQL Storage**: Cluster results → RDF triples → SPARQL endpoints
4. **Visualization**: Cluster coordinates → Frontend display

### **API Endpoints**
- `POST /api/vsom/create` - Create new VSOM instance
- `POST /api/vsom/load-data` - Load training data
- `POST /api/vsom/train` - Start training process
- `GET /api/vsom/grid` - Get current map state
- `GET /api/vsom/clusters` - Get clustering results
- `GET /api/vsom/features` - Get feature maps (U-Matrix)

## Performance Characteristics

### **Computational Complexity**
- **Training**: O(I × N × M × D) where I=iterations, N=entities, M=map nodes, D=dimensions
- **Memory Usage**: O(M × D) for weight storage + O(N × D) for entity embeddings
- **Scalability**: Supports thousands of entities on standard hardware

### **Quality Metrics**
- **Quantization Error**: Measures how well entities are represented
- **Topographic Error**: Measures neighborhood preservation
- **Convergence Time**: Typically 100-1000 iterations depending on data size

## Key Benefits

1. **Dimensionality Reduction**: 1536D embeddings → 2D spatial organization
2. **Semantic Clustering**: Automatically groups related entities  
3. **Visual Exploration**: Interactive browsing of knowledge relationships
4. **Quality Assessment**: Metrics for evaluating clustering effectiveness
5. **Standards Integration**: RDF output for semantic web interoperability

## Use Cases in Practice

1. **Knowledge Discovery**: Find related concepts in large knowledge graphs
2. **Entity Organization**: Automatically organize extracted entities by topic
3. **Visual Exploration**: Interactive browsing of semantic relationships
4. **Cluster Analysis**: Identify coherent semantic groups for further analysis
5. **Quality Assessment**: Evaluate entity extraction and embedding quality
6. **Research Exploration**: Visual browsing of academic papers and concepts
7. **Data Quality**: Assess entity extraction and embedding quality
8. **Interactive Analysis**: Drill down into semantic neighborhoods

## Example Usage

### Loading Data
```javascript
// Load entities with embeddings
const entityData = {
  "type": "entities",
  "entities": [
    {
      "uri": "http://example.org/ai",
      "content": "Artificial Intelligence research",
      "embedding": [0.1, 0.2, 0.3, ...]  // 1536-dimensional vector
    },
    {
      "uri": "http://example.org/ml", 
      "content": "Machine Learning algorithms",
      "embedding": [0.15, 0.18, 0.25, ...]
    }
  ]
}
```

### Training Configuration
```javascript
const config = {
  mapSize: [20, 20],
  maxIterations: 500,
  initialLearningRate: 0.1,
  topology: 'rectangular'
}
```

### Results
After training, you get:
- 2D spatial coordinates for each entity
- Cluster assignments based on semantic similarity
- Quality metrics showing training effectiveness
- Interactive visualization for exploration

## Conclusion

VSOM essentially transforms complex high-dimensional semantic relationships into an intuitive 2D spatial map where "nearby" means "semantically similar", enabling both automated analysis and human exploration of knowledge structures. It provides a complete pipeline from high-dimensional semantic embeddings to interpretable 2D spatial organization, making it invaluable for knowledge discovery, entity organization, and interactive analysis within the Semem ecosystem.
