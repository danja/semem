# Ragno - Knowledge Graph Library

Ragno is a comprehensive knowledge graph library that provides RDF-based semantic modeling, entity extraction, relationship management, and advanced graph algorithms for building intelligent applications.

## Key Features

- **RDF-Native Architecture**: Built on RDF-Ext with full SPARQL support
- **Semantic Web Compliance**: Follows W3C standards (RDF, SKOS, PROV-O)
- **Entity & Relationship Management**: First-class entities and relationships
- **Advanced Algorithms**: HyDE, PersonalizedPageRank, Community Detection
- **Vector Embeddings**: Integrated support for similarity search
- **Metadata Management**: Flexible RDF-based metadata storage system

## Core Components

### Models
- **RDFElement**: Base class for all RDF resources with metadata interface
- **Entity**: Named entities with frequency tracking and confidence scoring
- **SemanticUnit**: Text segments with provenance and entity connections
- **Relationship**: Typed relationships between entities and units
- **Attribute**: Graph attributes for community and similarity analysis

### Algorithms
- **Hyde**: Hypothetical Document Embeddings for query enhancement
- **PersonalizedPageRank**: Graph importance scoring
- **CommunityDetection**: Graph clustering and community analysis
- **VSOM**: Self-Organizing Maps for visualization
- **DualSearch**: Combined exact and vector similarity search

### Core Infrastructure
- **NamespaceManager**: RDF namespace and URI management
- **RDFGraphManager**: RDF dataset operations and SPARQL integration
- **VectorIndex**: High-performance similarity search with FAISS/HNSW

## Metadata Storage System

Ragno provides a powerful metadata storage system built into the RDFElement base class that stores arbitrary metadata as RDF triples with proper type conversion.

### Usage Example

```javascript
import { SemanticUnit, Entity } from 'semem/ragno'

// Create objects with metadata
const unit = new SemanticUnit({
  content: 'Example text',
  metadata: {
    confidence: 0.87,
    source: 'document.pdf',
    verified: true,
    tags: ['important', 'research']
  }
})

// Access metadata
const metadata = unit.getMetadata()
console.log(metadata.confidence) // 0.87

// Set individual properties
unit.setMetadataProperty('score', 95)
unit.setMetadataProperty('lastUpdated', new Date())

// Metadata persists through SPARQL storage
const dataset = rdf.dataset()
unit.exportToDataset(dataset)
// RDF triples include typed metadata properties
```

### Reusable Metadata Storage for Other Applications

The metadata storage system implemented in `models/RDFElement.js` is designed to be **highly reusable** and can be adapted for various use cases beyond Ragno:

#### Key Reusable Components

1. **Type-Safe RDF Storage**: Automatic conversion between JavaScript types and RDF literals with proper XSD datatypes
2. **Namespace-Aware Properties**: Flexible property URI generation using namespace managers
3. **Custom Property Filtering**: Separates standard properties from custom metadata
4. **SPARQL Persistence**: Full round-trip support for metadata through RDF datasets

#### Adaptation Examples

**Document Management System**:
```javascript
// Extend RDFElement for document metadata
class Document extends RDFElement {
  constructor(options) {
    super({...options, type: 'document'})
    if (options.metadata) {
      this.setAllMetadata(options.metadata) // version, author, keywords, etc.
    }
  }
}
```

**User Profile System**:
```javascript
// Store user preferences and settings
class UserProfile extends RDFElement {
  constructor(options) {
    super({...options, type: 'profile'})
    this.setAllMetadata(options.preferences || {})
  }
  
  updatePreference(key, value) {
    this.setMetadataProperty(key, value)
  }
}
```

**Content Annotation**:
```javascript
// Annotate any content with structured metadata
class Annotation extends RDFElement {
  constructor(target, annotations) {
    super({type: 'annotation'})
    this.setMetadataProperty('target', target)
    this.setAllMetadata(annotations)
  }
}
```

#### Integration Points

- **Custom Namespaces**: Modify `NamespaceManager` for domain-specific vocabularies
- **Type Handlers**: Extend type conversion in `setMetadataProperty()` for custom data types
- **Property Validation**: Add validation logic in `setAllMetadata()` for business rules
- **Query Optimization**: Use `getAllCustomMetadata()` patterns for efficient metadata retrieval

#### Benefits for Reuse

- **Standards Compliance**: Built on W3C RDF standards for interoperability
- **Performance**: Optimized for both in-memory and SPARQL storage
- **Flexibility**: No assumptions about specific metadata schemas
- **Persistence**: Automatic serialization/deserialization through RDF
- **Querying**: Full SPARQL query support for complex metadata searches

The metadata system provides a solid foundation for any application requiring structured, persistent, and queryable metadata storage with RDF compliance.

## Getting Started

```javascript
import { decomposeCorpus, Hyde, DualSearch } from 'semem/ragno'

// Decompose text into knowledge graph
const result = await decomposeCorpus(textChunks, llmHandler)

// Generate hypothetical documents
const hyde = new Hyde()
const hypotheses = await hyde.generateHypotheses(query, llmHandler, dataset)

// Search with dual approach
const search = new DualSearch(rdfManager)
const results = await search.query(searchQuery)
```

## Architecture

Ragno follows a layered architecture:

1. **RDF Layer**: Core RDF modeling with metadata support
2. **Algorithm Layer**: Graph algorithms and AI integration  
3. **Search Layer**: Vector and semantic search capabilities
4. **API Layer**: REST and programmatic interfaces
5. **Storage Layer**: SPARQL and vector database backends

For detailed examples and API documentation, see the `examples/ragno/` directory.