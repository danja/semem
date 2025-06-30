# Semem Algorithms Reference

This guide provides a comprehensive overview of the algorithms currently available in the Semem semantic memory system. Each algorithm includes purpose, key features, and usage guidance.

## Graph Analytics Algorithms

### K-core Decomposition
**Location**: `src/ragno/algorithms/GraphAnalytics.js`
**Example**: `examples/beerqa/ragno/CorpuscleRanking.js`

**Purpose**: Identifies structurally important nodes in knowledge graphs by computing core numbers.

**How it works**: Recursively removes nodes with degree less than k, revealing structural hierarchy. As [NodeRAG paper](https://arxiv.org/abs/2504.11544)

**Key Parameters**:
- No configuration required (parameter-free algorithm)
- Automatic core number assignment (0 to max core)

**Use cases**:
- Ranking Wikipedia articles by structural importance
- Identifying central concepts in knowledge graphs
- Quality assessment of relationship networks

**Output**: Core numbers for each node, structural importance rankings

**Performance**: O(n + m) time complexity, suitable for graphs up to 10,000 nodes

**Keywords**: `rank`, `structure`, `importance`, `core`

---

### Betweenness Centrality
**Location**: `src/ragno/algorithms/GraphAnalytics.js`
**Example**: `examples/beerqa/ragno/CorpuscleRanking.js`

**Purpose**: Identifies nodes that serve as bridges between different parts of the graph.

**How it works**: [Brandes' algorithm](https://en.wikipedia.org/wiki/Brandes'_algorithm) computing shortest paths through each node.

**Key Parameters**:
- Automatically disabled for graphs >100 nodes (performance optimization)
- Normalized scores (0.0 to 1.0)

**Use cases**:
- Finding connector concepts between topics
- Identifying knowledge brokers in semantic networks
- Detecting critical pathways in reasoning chains

**Output**: Centrality scores, bridge node identification

**Performance**: O(n³) complexity, recommended for graphs <100 nodes

**Keywords**: `centrality`, `bridge`, `importance`, `connectivity`

---

### Connected Components
**Location**: `src/ragno/algorithms/GraphAnalytics.js`
**Example**: `examples/beerqa/ragno/CorpuscleRanking.js`

**Purpose**: Identifies disconnected regions in knowledge graphs.

**How it works**: [Depth-first search](https://en.wikipedia.org/wiki/Depth-first_search) to find connected subgraphs.

**Key Parameters**:
- No configuration required
- Automatic component size reporting

**Use cases**:
- Quality assessment of knowledge integration
- Identifying isolated topic areas
- Graph connectivity analysis

**Output**: Component assignments, component sizes, connectivity metrics

**Performance**: O(n + m) linear time, scales to large graphs

**Keywords**: `components`, `connectivity`, `clusters`, `groups`

## Community Detection Algorithms

### Leiden Algorithm
**Location**: `src/ragno/algorithms/CommunityDetection.js`
**Example**: `examples/beerqa/ragno/CommunityAnalysis.js`

**Purpose**: Detects thematic communities in knowledge graphs using advanced modularity optimization.

**How it works**: Three-phase [Leiden algorithm](https://en.wikipedia.org/wiki/Leiden_algorithm) improving upon Louvain method with guaranteed connectivity.

**Key Parameters**:
- `resolution`: 1.0 (higher = smaller communities)
- `minCommunitySize`: 3 (minimum nodes per community)
- `maxIterations`: 100 (convergence control)

**Use cases**:
- Organizing knowledge into thematic clusters
- Topic discovery in document collections
- Creating semantic neighborhoods

**Output**: Community assignments, modularity scores, community statistics

**Performance**: Near-linear time for sparse graphs, optimized for knowledge graphs

**Example Usage**:
```javascript
const communities = await communityDetection.detectCommunities({
    resolution: 1.2,  // Smaller communities
    minCommunitySize: 5
});
```

**Keywords**: `leiden`, `community`, `modularity`, `clustering`

## Semantic Search Algorithms

### Personalized PageRank (PPR)
**Location**: `src/ragno/algorithms/PersonalizedPageRank.js`
**Example**: `examples/beerqa/ragno/SemanticSearch.js`

**Purpose**: Semantic search and relevance ranking through graph traversal.

**How it works**: Random walk with teleportation from query entities, respecting semantic relationships. [NodeRAG paper](https://arxiv.org/abs/2504.11544)

**Key Parameters**:
- `alpha`: 0.15 (teleportation probability)
- `maxIterations`: 50 (convergence control)
- `convergenceThreshold`: 1e-6 (precision control)
- `entryPoints`: Query entities (multiple supported)

**Search Modes**:
- **Shallow PPR**: 2-3 iterations for quick discovery
- **Deep PPR**: 10+ iterations for comprehensive analysis
- **Type-aware**: Respects ragno ontology constraints

**Use cases**:
- Semantic similarity search
- Related concept discovery
- Multi-hop reasoning in knowledge graphs

**Output**: Relevance-ranked entities, cross-type discoveries, semantic pathways

**Performance**: Configurable depth vs. speed tradeoff

**Keywords**: `pagerank`, `ranking`, `traversal`, `relevance`

---

### HyDE (Hypothetical Document Embeddings)
**Location**: `src/ragno/algorithms/Hyde.js`
**Example**: `examples/beerqa/QuestionResearch.js`

**Purpose**: Improves retrieval by generating hypothetical relevant content using LLMs.

**How it works**: Generates plausible answers to queries, then searches for content similar to hypotheses. [Precise Zero-Shot Dense Retrieval without Relevance Labels](https://arxiv.org/abs/2212.10496)

**Key Parameters**:
- `maxTokens`: 512 (hypothesis length)
- `temperature`: 0.7 (creativity control)
- `numHypotheses`: 3 (multiple hypotheses per query)
- `confidenceThreshold`: 0.5 (quality filter)

**Use cases**:
- Improving retrieval for complex questions
- Concept expansion and discovery
- Query augmentation for sparse knowledge graphs

**Output**: Hypothetical semantic units, extracted entities, confidence scores

**Integration**: Creates `ragno:maybe` relationships for uncertain content

**Example Usage**:
```javascript
const hypotheses = await hyde.generateHypotheses(
    "What factors influence plant growth?",
    { numHypotheses: 3, temperature: 0.8 }
);
```

**Keywords**: `hyde`, `hypothetical`, `generation`, `retrieval`

## Visual Analytics Algorithms

### VSOM (Visual* Self-Organizing Maps)
**Location**: `src/ragno/algorithms/VSOM.js`
**Example**: `examples/ragno/VSOM.js`

**Purpose**: Creates visual knowledge maps through unsupervised clustering of semantic embeddings.

**How it works**: [Self-organizing map](https://en.wikipedia.org/wiki/Self-organizing_map) algorithm mapping high-dimensional embeddings to 2D coordinates.

**Key Components**:

#### VSOM Core Engine
- **Vectorized operations**: Batch distance calculations (cosine, Euclidean, Manhattan)
- **BMU finding**: Efficient Best Matching Unit computation
- **Learning**: Neighborhood-based weight updates

#### VSOM Topology
- **Grid types**: Rectangular, hexagonal
- **Boundary conditions**: Bounded, toroidal
- **Coordinate systems**: Cartesian transformations

#### VSOM Training
- **Adaptive rates**: Learning rate decay (0.1 → 0.01)
- **Radius scheduling**: Neighborhood radius decay
- **Convergence**: Progress tracking and stopping criteria

**Key Parameters**:
- `mapSize`: [20, 20] (grid dimensions)
- `embeddingDim`: 1536 (input vector size)
- `distanceMetric`: 'cosine' (similarity measure)
- `learningRate`: 0.1 (initial learning rate)
- `maxEpochs`: 100 (training duration)

**Use cases**:
- Knowledge visualization and exploration
- Concept space mapping
- Similarity-based clustering
- Interactive knowledge browsing

**Output**: 2D coordinates, cluster assignments, topology mappings

**Performance**: Optimized for embeddings up to 2048 dimensions

**Keywords**: `som`, `visual`, `clustering`, `topology`, `vectorize`, `distance`, `bmu`, `learning`, `topology`, `grid`, `neighbors`, `boundary`, `training`, `learning`, `convergence`, `optimization`

\* I can't remember where I got this version of the algorithm from, the 'V' stood for 'vectorized', which in retrospect is a bit odd as Kohonen's SOM operates on vectors anyway...

## Navigation Algorithms

### ZPT (Zoom Pan Tilt) Navigation
**Location**: `src/zpt/`
**Example**: `examples/zpt/ZPTNavigationDemo.js`

**Purpose**: Multi-scale semantic navigation through knowledge spaces using spatial metaphors. See [ZPT Ontology](https://github.com/danja/zpt).

**Navigation Dimensions**:

#### Zoom Levels
- **Corpus**: Entire dataset overview (10 results)
- **Community**: Thematic clusters (50 results)  
- **Unit**: Semantic units (200 results)
- **Entity**: Individual concepts (500 results)
- **Text**: Raw text elements (1000 results)
- **Micro**: Sub-entity details (2000 results)

#### Pan Domains
- **Topic**: Subject-based filtering
- **Geographic**: Spatial constraints
- **Temporal**: Time-based filtering
- **Entity**: Type-specific focus

#### Tilt Projections
- **Keywords**: Keyword-based representation
- **Embeddings**: Vector space projections
- **Graph**: Structural relationship views
- **Temporal**: Time-based organization

**Key Parameters**:
- `zoom`: Scale level selection
- `pan`: Domain filtering options
- `tilt`: Representation mode
- `query`: Navigation seed concepts

**Use cases**:
- Interactive knowledge exploration
- Multi-perspective data analysis
- Adaptive content presentation
- Semantic drilling and browsing

**Example Usage**:
```javascript
const results = await zptNavigate({
    query: "machine learning",
    zoom: "entity",
    pan: { topic: "artificial intelligence" },
    tilt: "embedding"
});
```

**Keywords**: `zpt`, `navigate`, `scale`, `filter`, `project`, `zoom`, `scale`, `granularity`, `level`, `pan`, `filter`, `domain`, `scope`, `tilt`, `projection`, `representation`, `view`

## Ranking and Importance Algorithms

### Corpuscle Ranking
**Location**: `examples/beerqa/ragno/CorpuscleRanking.js`
**Example**: `examples/beerqa/ragno/CorpuscleRanking.js`

**Purpose**: Ranks knowledge units by combining structural and semantic importance.

**How it works**: Composite scoring combining K-core decomposition with centrality analysis. [NodeRAG paper](https://arxiv.org/abs/2504.11544), [Degeneracy](https://en.wikipedia.org/wiki/Degeneracy_(graph_theory))

**Scoring Formula**:
- **Composite Score** = (K-core × 0.6) + (Centrality × 0.4)
- **Normalization**: Scores scaled to 0.0-10.0 range

**Key Parameters**:
- `enableKCore`: true (K-core analysis)
- `enableCentrality`: true (centrality analysis)
- `exportTopK`: 20 (export top rankings)

**Use cases**:
- Content prioritization
- Quality assessment
- Knowledge curation
- Attention direction

**Output**: Ranked corpuscles, composite scores, structural metrics

**Keywords**: `corpuscle`, `rank`, `composite`, `score`

---

### Entity Ranking
**Location**: `examples/beerqa/ragno/EntityRanking.js`
**Example**: `examples/beerqa/ragno/EntityRanking.js`

**Purpose**: Ranks Wikipedia entities by structural importance in knowledge graphs.

**Features**: Adapted K-core and [centrality analysis](https://en.wikipedia.org/wiki/Centrality) for Wikipedia entity networks.

**Output**: Entity importance rankings, structural significance scores

**Keywords**: `entity`, `rank`, `wikipedia`, `importance`

## Integration and Orchestration

### Unified Algorithm Suite
**Location**: `src/ragno/algorithms/index.js`
**Example**: `examples/mcp/IntegratedWorkflowDemo.js`

**Purpose**: Orchestrates multiple algorithms in coordinated pipelines.

**Pipeline Phases**:
1. **Phase 1**: RDF to graph conversion
2. **Phase 2**: Basic statistics computation  
3. **Phase 3**: Structural analysis (K-core, centrality, components)
4. **Phase 4**: Community detection
5. **Phase 5**: Results export (optional)

**Features**:
- **Cross-algorithm integration**: Results shared between algorithms
- **Performance monitoring**: Timing and memory tracking
- **Flexible execution**: Configurable phase selection
- **RDF export**: Native ragno ontology output

**Example Usage**:
```javascript
const results = await ragnoAlgorithms.runPipeline({
    phases: ['statistics', 'structure', 'communities'],
    exportResults: true
});
```

**Keywords**: `unified`, `suite`, `pipeline`, `orchestration`

## Performance and Optimization

### Scalability Guidelines

**Small Graphs** (< 100 nodes):
- All algorithms available
- Full centrality analysis enabled
- Rich visualization possible

**Medium Graphs** (100-1000 nodes):
- K-core and community detection recommended
- Centrality analysis disabled for performance
- VSOM clustering effective

**Large Graphs** (1000+ nodes):
- K-core decomposition and connected components
- Community detection with higher resolution
- Batch processing recommended

### Memory Optimization

**Algorithm Selection**:
- **Memory Efficient**: K-core, connected components
- **Memory Intensive**: Betweenness centrality, full VSOM
- **Configurable**: PPR depth, community resolution

**Batch Processing**:
- **SPARQL Export**: 10 items per batch
- **VSOM Training**: 100 samples per batch
- **PPR Traversal**: Configurable iteration limits

**Keywords**: `performance`, `optimize`, `scale`, `memory`

## Configuration Examples

### Basic Graph Analytics
```javascript
const analytics = new GraphAnalytics({
    enableKCore: true,
    enableCentrality: false,  // Large graph optimization
    enableComponents: true
});
```

### Community Detection with Custom Parameters
```javascript
const communities = await communityDetection.detectCommunities({
    algorithm: 'leiden',
    resolution: 1.5,          // Smaller communities
    minCommunitySize: 5,      // Larger minimum size
    maxIterations: 200        // More thorough optimization
});
```

### VSOM with Custom Topology
```javascript
const vsom = new VSOM({
    mapSize: [30, 30],        // Larger map
    topology: 'hexagonal',    // Hexagonal grid
    boundary: 'toroidal',     // Wrap-around edges
    distanceMetric: 'cosine'  // Cosine similarity
});
```

### ZPT Navigation Configuration
```javascript
const navigation = await zptNavigate({
    query: "semantic web",
    zoom: "community",
    pan: { 
        topic: "knowledge representation",
        temporal: { after: "2020-01-01" }
    },
    tilt: "graph",
    transform: { limit: 100 }
});
```

**Keywords**: `configure`, `setup`, `examples`, `parameters`

## Algorithm Selection Guide

### For Knowledge Exploration:
- **ZPT Navigation**: Multi-scale browsing
- **VSOM**: Visual clustering and mapping
- **PPR**: Semantic similarity search

### For Content Analysis:
- **Community Detection**: Topic organization
- **K-core Decomposition**: Structural importance
- **Connected Components**: Quality assessment

### For Question Answering:
- **HyDE**: Query expansion
- **Corpuscle Ranking**: Content prioritization
- **Semantic Search**: Relevant content discovery

### For Visualization:
- **VSOM**: 2D knowledge maps
- **Community Detection**: Thematic grouping
- **ZPT**: Interactive exploration interfaces

**Keywords**: `select`, `choose`, `guide`, `recommendation`

## Integration with Semem Systems

All algorithms integrate with:
- **SPARQL Storage**: Direct RDF input/output
- **Config.js**: Centralized configuration management
- **Ragno Ontology**: Semantic data modeling
- **LLM Handlers**: Natural language processing
- **Embedding Systems**: Vector representation processing

For specific implementation details and usage examples, see the individual algorithm documentation and the BeerQA enhanced workflow examples.

**Keywords**: `integrate`, `semem`, `system`, `workflow`

---

**Document Keywords**: `algorithms`, `analytics`, `graph`, `semantic`, `machine-learning`