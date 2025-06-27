# Ragno Module

Ragno (Retrieval-Augmented Graph Network Optimization) is the knowledge graph and semantic reasoning engine of Semem. It provides advanced graph analytics, community detection, and semantic relationship modeling using RDF/SPARQL technologies.

## Core Architecture

### Knowledge Graph Components

#### Entities (`Entity.js`)
- **Entity**: Core knowledge graph nodes representing concepts, objects, or ideas
- RDF-based modeling with semantic web standards
- Support for hierarchical relationships and inheritance
- Rich metadata and property management
- Entry point detection for navigation

#### Relationships (`Relationship.js`) 
- **Relationship**: First-class relationship objects between entities
- Typed relationships with semantic meaning
- Bidirectional relationship management
- Confidence scoring and provenance tracking
- Temporal relationship modeling

#### Semantic Units (`SemanticUnit.js`)
- **SemanticUnit**: Independent semantic chunks from corpus decomposition
- Text-to-knowledge extraction and analysis
- Concept extraction and entity linking
- Summary generation and key phrase identification
- Source document attribution

#### Attributes (`Attribute.js`)
- **Attribute**: Dynamic property system for entities
- LLM-generated attribute discovery
- Semantic attribute categorization
- Value type inference and validation
- Contextual attribute relationships

### Graph Management (`core/`)

#### RDF Graph Manager
- **RDFGraphManager**: Central RDF dataset management
- SPARQL query execution and optimization
- Graph serialization and persistence
- Transaction support for graph operations
- Performance monitoring and caching

#### Namespace Manager
- **NamespaceManager**: RDF namespace and URI management
- Vocabulary integration (Schema.org, FOAF, etc.)
- Custom ontology support
- Prefix management and resolution
- Namespace conflict resolution

### Advanced Analytics (`algorithms/`)

#### Community Detection
- **CommunityDetection**: Louvain algorithm implementation
- Hierarchical clustering analysis
- Community quality metrics
- Dynamic community evolution tracking
- Cross-community relationship analysis

#### Graph Analytics
- **GraphAnalytics**: Comprehensive graph analysis suite
- Centrality measures (PageRank, Betweenness, Closeness)
- Path analysis and shortest paths
- Graph density and connectivity metrics
- Structural hole detection

#### Personalized PageRank
- **PersonalizedPageRank**: Context-aware ranking algorithm
- Entity importance calculation
- Topic-specific authority scoring
- Multi-dimensional ranking
- Real-time rank updating

#### VSOM (Vector Self-Organizing Maps)
- **VSOMCore**: Neural network-based clustering
- **VSOMTopology**: Topological relationship modeling
- **VSOMTraining**: Adaptive learning algorithms
- High-dimensional data visualization
- Concept space organization

#### HyDE (Hypothetical Document Embeddings)
- **Hyde**: Query expansion and refinement
- Synthetic document generation
- Embedding space optimization
- Query-document matching improvement
- Retrieval performance enhancement

### Search & Retrieval (`search/`)

#### Dual Search System
- **DualSearch**: Hybrid search combining multiple strategies
- Vector similarity search
- Graph traversal search
- Keyword matching
- Semantic relationship following
- Result fusion and ranking

#### Vector Index
- **VectorIndex**: High-performance vector similarity search
- HNSW (Hierarchical Navigable Small World) indexing
- Approximate nearest neighbor search
- Dynamic index updating
- Memory-efficient storage

### Data Processing

#### Corpus Decomposition (`decomposeCorpus.js`)
- Intelligent text segmentation
- Entity extraction and linking
- Relationship discovery
- Semantic unit creation
- Knowledge graph construction

#### Embedding Enrichment (`enrichWithEmbeddings.js`)
- Vector embedding generation
- Multi-modal embedding support
- Embedding quality assessment
- Dimensionality optimization
- Embedding space analysis

#### Attribute Augmentation (`augmentWithAttributes.js`)
- LLM-powered attribute discovery
- Contextual attribute generation
- Attribute validation and scoring
- Dynamic schema evolution
- Attribute relationship mapping

### SPARQL Integration

#### Export Utilities
- **exportAttributesToSPARQL**: Attribute data export
- **exportCommunityAttributesToSPARQL**: Community-based exports
- **exportSimilarityLinksToSPARQL**: Similarity relationship exports
- Batch processing support
- Error handling and recovery
- Progress tracking and reporting

### API Layer (`api/`)

#### Graph API
- **GraphAPI**: RESTful graph operations
- Entity CRUD operations
- Relationship management
- Query execution interface
- Bulk data operations

#### Enhanced Search API
- **SearchAPIEnhanced**: Advanced search capabilities
- Multi-modal query processing
- Result explanation and provenance
- Search analytics and optimization
- Personalized search results

#### Ragno API Server
- **RagnoAPIServer**: Dedicated graph server
- High-performance graph operations
- Real-time graph updates
- Concurrent query processing
- Distributed graph support

## Usage Patterns

### Knowledge Graph Construction
```javascript
import { decomposeCorpus } from './ragno/decomposeCorpus.js';
import { RDFGraphManager } from './ragno/core/RDFGraphManager.js';

// Decompose text into knowledge graph
const textChunks = [{ content: "AI is transforming healthcare..." }];
const { entities, relationships, units } = await decomposeCorpus(
  textChunks, 
  llmHandler,
  { extractRelationships: true }
);

// Store in RDF graph
const graphManager = new RDFGraphManager();
await graphManager.addEntities(entities);
await graphManager.addRelationships(relationships);
```

### Semantic Search
```javascript
import { DualSearch } from './ragno/search/DualSearch.js';

const search = new DualSearch(graphManager);
const results = await search.query("machine learning applications", {
  vectorThreshold: 0.7,
  maxResults: 20,
  includeRelationships: true
});
```

### Community Analysis
```javascript
import { CommunityDetection } from './ragno/algorithms/CommunityDetection.js';

const detector = new CommunityDetection(graphManager);
const communities = await detector.detectCommunities({
  algorithm: 'louvain',
  resolution: 1.0,
  minCommunitySize: 5
});
```

### VSOM Visualization
```javascript
import { VSOMCore } from './ragno/algorithms/vsom/VSOMCore.js';

const vsom = new VSOMCore({
  dimensions: 2,
  topology: 'hexagonal',
  learningRate: 0.1
});

await vsom.train(entityEmbeddings);
const coordinates = vsom.getCoordinates();
```

## Performance Characteristics

- **Scalability**: Handles millions of entities and relationships
- **Real-time**: Sub-second query response times
- **Memory Efficiency**: Optimized data structures and caching
- **Parallelization**: Multi-threaded processing support
- **Persistence**: Durable storage with backup and recovery

## Integration Points

- **Memory System**: Seamless integration with Semem's memory management
- **Search Services**: Powers semantic search capabilities
- **Frontend**: Provides data for visualization components
- **APIs**: Exposes graph functionality via REST endpoints
- **Analytics**: Feeds data to monitoring and analytics systems