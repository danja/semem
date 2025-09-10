# SPARQL CONSTRUCT Queries for Semem Knowledge Base

This document describes the CONSTRUCT queries designed to extract different views and aspects of the Semem knowledge base. Each query creates a focused RDF graph representing a specific perspective on the stored semantic knowledge.

## SPARQL Directory Structure

The Semem project contains the following SPARQL query directories:

- **`sparql/construct/`** - CONSTRUCT queries for knowledge extraction (documented in this file)
- **`sparql/queries/`** - SELECT queries for data retrieval and analysis
- **`sparql/queries/search/`** - Specialized search queries including semantic search
- **`sparql/queries/admin/`** - Administrative and maintenance queries
- **`sparql/templates/`** - Template queries with placeholder variables

All queries use template variables (e.g., `${graphURI}`) that should be replaced with actual values before execution.

## Query Overview

| Query | Purpose | Output Focus | Status |
|-------|---------|--------------|--------|
| `01-extract-entities.sparql` | Extract all elements with metadata | Element-centric view with properties, domains, and content | ✅ **Working** - Updated for actual data structure |
| `02-extract-relationships.sparql` | Extract connection networks | Graph view of element-to-interaction connections | ✅ **Working** - Updated for ragno:connectsTo relationships |
| `03-extract-concepts.sparql` | Extract concept hierarchy | Concept-based knowledge organization | ✅ **Working** - Updated for skos:Concept with interaction anchoring and relationship mapping |
| `04-extract-documents.sparql` | Extract document structure | Document decomposition and text element hierarchy | ✅ **Working** - Updated for ragno:Unit+ragno:TextElement chunks from interactions |
| `05-extract-embeddings.sparql` | Extract embedding space | Vector space view with clustering information | ✅ **Working** - Updated for multiple embedding properties (ragno:hasEmbedding, semem:embedding, ragno:embedding) |
| `06-extract-memory-interactions.sparql` | Extract user interactions | Conversation history and semantic memory operations | ✅ **Working** - Updated for semem:Interaction with temporal chains and concept links |
| `07-extract-knowledge-domains.sparql` | Extract domain organization | Domain-specific content clustering | ⚠️ **Partial** - Domain structure working, but test data lacks semem:domain properties |
| `08-extract-provenance-chains.sparql` | Extract processing provenance | Content derivation and transformation tracking | ✅ **Working** - Updated for prov:wasDerivedFrom chains from interactions to chunks |
| `09-extract-zpt-navigation.sparql` | Extract ZPT navigation structure | Multi-dimensional knowledge space navigation | ✅ **Working** - Updated for ZPT coordinate system with zoom/pan/tilt dimensions |
| `10-extract-community-clusters.sparql` | Extract semantic communities | Community detection and cluster analysis | ✅ **Working** - Updated for connection-based clustering around interaction anchors |
| `11-extract-interactions.sparql` | Extract user interactions with full metadata | Complete interaction view with prompts, outputs, concepts, and domain classification | ✅ **Working** - New query tailored to actual semem:Interaction structure |

## Usage

### Basic Usage

Replace `${graphURI}` with your actual graph URI (e.g., `http://hyperdata.it/content`):

```sparql
# Example for extracting entities
PREFIX ragno: <http://purl.org/stuff/ragno/>
# ... (query content)
WHERE {
    GRAPH <http://hyperdata.it/content> {
        # ... query logic
    }
}
```

### Via HTTP/cURL

```bash
# Extract entities
curl -X POST http://localhost:3030/semem/query \
  -H "Content-Type: application/sparql-query" \
  -d @01-extract-entities.sparql

# Extract relationships  
curl -X POST http://localhost:3030/semem/query \
  -H "Content-Type: application/sparql-query" \
  -d @02-extract-relationships.sparql
```

### Via Semem API

```javascript
// Using Semem SPARQLService
import SPARQLService from '../src/services/embeddings/SPARQLService.js';

const sparqlService = new SPARQLService({
    queryEndpoint: 'http://localhost:3030/semem/query',
    graphName: 'http://hyperdata.it/content'
});

const entityQuery = fs.readFileSync('sparql/construct/01-extract-entities.sparql', 'utf8');
const results = await sparqlService.executeQuery(entityQuery);
```

## Query Descriptions

### 1. Entity Extraction (`01-extract-entities.sparql`)

**Purpose**: Creates a clean entity-centric view of the knowledge base.

**Key Features**:
- Extracts all `ragno:Entity` instances with core properties
- Infers domain classification based on content analysis
- Traces entities back to source documents
- Includes centrality scores and confidence measures
- Orders by importance (centrality) and creation time

**Output Properties**:
- `ragno:Entity` type classification
- Entity content and labels
- Domain inference (climate-science, urban-planning, neuroscience, general)
- Embedding and weight information
- Source document traceability

### 2. Relationship Extraction (`02-extract-relationships.sparql`)

**Purpose**: Extracts the relationship network between entities.

**Key Features**:
- Finds all `ragno:Relationship` instances
- Creates simplified direct relationships for traversal
- Includes relationship types and weights
- Filters self-relationships
- Provides navigation scores

**Output Properties**:
- Source and target entity connections
- Relationship types and descriptions
- Connection weights and scores
- Concept matching information

### 3. Concept Extraction (`03-extract-concepts.sparql`)

**Purpose**: Extracts concept-based knowledge from corpuscles.

**Key Features**:
- Identifies concept corpuscles (labels starting with "Concept:")
- Cleans concept labels and organizes hierarchy
- Links concepts to source documents
- Tracks concept collections and units
- Provides processing stage information

**Output Properties**:
- Clean concept labels and content
- Concept hierarchy relationships
- Source document traceability
- Processing metadata

### 4. Document Structure (`04-extract-documents.sparql`)

**Purpose**: Provides hierarchical view of document decomposition.

**Key Features**:
- Extracts document units with metadata
- Shows text element breakdown
- Tracks chunk creation and organization
- Calculates processing stage progression
- Counts elements for summary statistics

**Output Properties**:
- Document hierarchy (Document → TextElement → Chunk)
- Processing stage tracking
- Element counts and statistics
- Source file information

### 5. Embedding Space (`05-extract-embeddings.sparql`)

**Purpose**: Creates vector space view of embedded content.

**Key Features**:
- Finds all elements with embeddings
- Calculates content metrics and dimensions
- Creates simple clustering based on type and time
- Provides embedding metadata
- Orders by content type and creation

**Output Properties**:
- Embedding vectors and dimensions
- Content length and metrics
- Clustering information
- Model metadata

### 6. Memory Interactions (`06-extract-memory-interactions.sparql`)

**Purpose**: Extracts semantic memory operations and conversations.

**Key Features**:
- Identifies tell/ask/augment operations
- Parses prompt and response structures
- Tracks session-based interactions
- Links interactions to generated concepts
- Creates interaction chains

**Output Properties**:
- Interaction types and content
- Prompt/response parsing
- Session tracking
- Concept generation links
- Temporal interaction chains

### 7. Knowledge Domains (`07-extract-knowledge-domains.sparql`)

**Purpose**: Creates domain-centric content organization.

**Key Features**:
- Defines major knowledge domains
- Assigns content to domains based on keywords
- Calculates domain relevance scores
- Counts domain-specific content
- Provides domain visualization metadata

**Output Properties**:
- Domain classification and colors
- Content assignment and relevance
- Domain statistics
- Keyword associations

### 8. Provenance Chains (`08-extract-provenance-chains.sparql`)

**Purpose**: Tracks content derivation and processing flows.

**Key Features**:
- Maps complete provenance chains
- Identifies processing stages
- Calculates derivation levels
- Creates processing flow visualization
- Links to original sources

**Output Properties**:
- Derivation paths and levels
- Processing stage identification
- Root source tracking
- Transformation metadata

### 9. ZPT Navigation (`09-extract-zpt-navigation.sparql`)

**Purpose**: Creates multi-dimensional knowledge space navigation.

**Key Features**:
- Defines Zoom/Pan/Tilt coordinate system
- Assigns content to ZPT coordinates
- Creates navigation pathways
- Calculates discoverability scores
- Provides multi-perspective views

**Output Properties**:
- ZPT coordinate assignments
- Navigation paths and weights
- Content discoverability
- Multi-dimensional filtering

### 10. Community Clusters (`10-extract-community-clusters.sparql`)

**Purpose**: Extracts semantic communities and clustering.

**Key Features**:
- Identifies semantic clusters
- Calculates community cohesion
- Tracks member roles and scores
- Maps inter-community connections
- Monitors community evolution

**Output Properties**:
- Community membership and roles
- Cohesion and stability metrics
- Inter-community relationships
- Evolution tracking

## Common Patterns

### Variable Substitution

All queries use `${graphURI}` as a template variable:

```bash
# Replace in script
sed 's/${graphURI}/http:\/\/hyperdata.it\/content/g' 01-extract-entities.sparql > query.sparql

# Or use environment variable
export GRAPH_URI="http://hyperdata.it/content"
envsubst < 01-extract-entities.sparql > query.sparql
```

### Combining Queries

Queries can be combined for comprehensive views:

```sparql
# Combined entity and relationship view
CONSTRUCT {
    # Include patterns from both queries
}
WHERE {
    { 
        # Entity extraction patterns
    }
    UNION
    {
        # Relationship extraction patterns  
    }
}
```

### Filtering and Limiting

Add filters for specific subsets:

```sparql
# Add after WHERE clause
FILTER(CONTAINS(LCASE(?content), "climate"))
LIMIT 100
```

## Integration with Semem

These queries are designed to work with:

- **Ragno ontology**: Core knowledge graph model
- **ZPT navigation**: Multi-dimensional knowledge space
- **Semantic memory**: Tell/ask/augment operations
- **Provenance tracking**: PROV-O based derivation chains
- **Community detection**: Clustering and relationship analysis

## Output Formats

Queries can be executed with different output formats:

- **Turtle/TTL**: Human-readable RDF
- **JSON-LD**: JSON-based linked data
- **N-Triples**: Simple triple format
- **RDF/XML**: XML-based RDF

## Performance Considerations

- Queries are optimized for typical Semem knowledge base sizes (10K-100K triples)
- Use `LIMIT` clauses for large datasets
- Consider materialized views for frequently accessed patterns
- Index on key properties: `ragno:content`, `dcterms:created`, `prov:wasDerivedFrom`

## Working Queries (Tested 2025-09-09)

The following queries have been tested against a live Semem SPARQL endpoint and work with the actual data structure:

### ✅ **01-extract-entities.sparql** - Element Extraction
- **Status**: Working - Updated for ragno:Element + skos:Concept structure
- **Returns**: 27+ elements including concepts and enhancement queries
- **Key Features**: Extracts prefLabels, content, connections, and domain inference
- **Sample Output**: Concepts like "Semem", "visualization", "tune" with full metadata

### ✅ **02-extract-relationships.sparql** - Connection Networks  
- **Status**: Working - Updated for ragno:connectsTo relationships
- **Returns**: Element-to-interaction connections with simplified traversal properties
- **Key Features**: Maps concept-interaction relationships with connection types
- **Sample Output**: Concepts connected to specific interactions with bidirectional links

### ✅ **03-extract-concepts.sparql** - Concept Hierarchy (Updated)
- **Status**: Working - Updated for skos:Concept with interaction anchoring and relationship mapping
- **Returns**: Enhanced concept nodes with semantic classification, relationship networks, and interaction context
- **Key Features**: Concept type classification (visual, musical, simple, compound), interaction anchoring, inter-concept relationships, semantic domain assignment
- **Sample Output**:
  - 20 concepts enhanced as ragno:ConceptNode with skos:Concept preservation  
  - Rich relationship networks showing concept-to-concept connections via shared interactions
  - Semantic domains (music, visualization, personal, general) and concept types
  - Full interaction context with source prompts and outputs

### ✅ **04-extract-documents.sparql** - Document Structure (Updated)
- **Status**: Working - Updated for ragno:Unit+ragno:TextElement chunks from interactions
- **Returns**: Document hierarchy showing interactions and their chunked decomposition
- **Key Features**: Shows semem:Interaction → ragno:Unit+ragno:TextElement derivation with chunk indexing, embeddings, and content
- **Sample Output**: "Document: ADHD and Me" interaction with 4 indexed chunks showing full content and metadata

### ✅ **05-extract-embeddings.sparql** - Embedding Space (Updated)
- **Status**: Working - Updated for multiple embedding properties
- **Returns**: Vector space view with 1536-dimensional embeddings and clustering information
- **Key Features**: Extracts ragno:hasEmbedding, semem:embedding, and ragno:embedding with content length analysis and cluster assignments
- **Sample Output**: Interactions and chunks with full embedding vectors, processing metadata, and cluster classifications

### ✅ **06-extract-memory-interactions.sparql** - Memory Operations (Updated)
- **Status**: Working - Updated for semem:Interaction with temporal chains and concept links
- **Returns**: Semantic memory operations with conversation history and concept extraction
- **Key Features**: Temporal interaction chains (followedBy), concept counting, domain classification, session tracking
- **Sample Output**: Interaction chains showing conversation flow with concept analysis and connection networks

### ⚠️ **07-extract-knowledge-domains.sparql** - Domain Organization (Partial)
- **Status**: Partial - Domain structure working, but test data lacks semem:domain properties
- **Returns**: Knowledge domains with metadata, colors, and content counts (currently showing 0 counts)
- **Key Features**: Domain framework ready with "Music & Audio Visualization", "Songwriting & Lyrics" etc. with full descriptions
- **Note**: Query structure works correctly but needs data with explicit domain assignments

### ✅ **08-extract-provenance-chains.sparql** - Provenance Tracking (Updated)
- **Status**: Working - Updated for prov:wasDerivedFrom chains from interactions to chunks
- **Returns**: Content derivation paths showing knowledge flow from interactions through processing stages
- **Key Features**: Processing level calculation, derivation path strings, step descriptions, source tracking
- **Sample Output**: 4 chunks at Level 1 derived from interaction with "Text decomposition into semantic chunks" processing

### ✅ **09-extract-zpt-navigation.sparql** - ZPT Navigation (Updated)
- **Status**: Working - Updated for ZPT coordinate system with zoom/pan/tilt dimensions
- **Returns**: Multi-dimensional knowledge space navigation with ZPT coordinates for all content elements
- **Key Features**: 5 zoom levels (corpus→interaction→chunk→concept→element), 4 pan domains, 4 tilt perspectives, navigation scoring
- **Sample Output**: 
  - Interactions with high discoverability (score 5.0) in vector tilt view
  - Chunks with embeddings (score 3.5) in content-type pan domain
  - Concepts with graph connections across semantic domains
  - Complete navigation paths with weights and descriptions

### ✅ **10-extract-community-clusters.sparql** - Community Detection (Updated)
- **Status**: Working - Updated for connection-based clustering around interaction anchors
- **Returns**: Semantic communities with membership analysis and inter-community connections
- **Key Features**: Connection-based clustering, member roles (core/active/peripheral), cohesion scoring, community metadata
- **Sample Output**:
  - "Songwriting Community" (10 concepts) with lyrics, song, verse, chorus concepts
  - "General Content Community" (10 concepts) with visualization, music, technical concepts
  - Member roles and scores, community stability metrics, interaction anchors

### ✅ **11-extract-interactions.sparql** - Full Interaction Analysis (New)
- **Status**: Working - Custom query for semem:Interaction structure
- **Returns**: Complete interaction metadata including prompts, outputs, concepts, timestamps
- **Key Features**: Domain classification, concept clustering, full conversation context
- **Sample Output**: 
  - "Music-visualization" domain: Hillside Media Visualizer interaction
  - "Songwriting" domain: Italian song translation interaction
  - Full prompts, outputs, concept arrays, and metadata

## Additional Working Queries (Non-Construct)

These related queries from `sparql/queries/` have also been updated and tested:

### ✅ **list-concepts.sparql** - Concept Listing
- **Returns**: All 20 skos:Concept instances with connection information
- **Sample Output**: Concepts like "Hillside", "visualization", "lyrics" with interaction links

### ✅ **semantic-search.sparql** - Vector Similarity Search  
- **Returns**: Interactions with 1536-dimension embedding vectors for similarity matching
- **Key Features**: Multiple search strategies (ragno:embedding, semem:embedding, indirect via concepts)

### Example Usage for Working Queries

```bash
# Extract all elements (concepts, enhancements)
curl -X POST http://localhost:3030/semem/query \
  -H "Content-Type: application/sparql-query" \
  -H "Accept: text/turtle" \
  --data-binary @01-extract-entities.sparql

# Extract connection networks
curl -X POST http://localhost:3030/semem/query \
  -H "Content-Type: application/sparql-query" \
  -H "Accept: text/turtle" \
  --data-binary @02-extract-relationships.sparql

# Extract full interactions with AI analysis
curl -X POST http://localhost:3030/semem/query \
  -H "Content-Type: application/sparql-query" \
  -H "Accept: text/turtle" \
  --data-binary @11-extract-interactions.sparql
```

## Troubleshooting

### Common Issues

1. **Empty Results**: Check graph URI and ensure data exists
2. **Timeout**: Add LIMIT clauses or filter conditions
3. **Memory Issues**: Process in batches or use streaming
4. **Missing Properties**: Check ontology alignment and data completeness
5. **Data Structure Mismatch**: Many original queries expect different ontology patterns than actual data

### Current Data Structure (2025-09-09)

The actual Semem knowledge base contains:
- **ragno:Element** (27) - Concepts and enhancement queries
- **skos:Concept** (20) - Semantic concepts  
- **semem:Interaction** (2) - User interactions with full metadata
- **ragno:TextElement** (5) - Text processing elements
- **ragno:Unit** (4) - Corpus units

### Debugging

```sparql
# Count total triples in graph
SELECT (COUNT(*) AS ?tripleCount) 
WHERE { GRAPH <${graphURI}> { ?s ?p ?o } }

# Check available types
SELECT DISTINCT ?type (COUNT(?s) AS ?count)
WHERE { GRAPH <${graphURI}> { ?s a ?type } }
GROUP BY ?type
ORDER BY DESC(?count)

# Test connectivity patterns
SELECT ?source ?prop ?target WHERE { 
  GRAPH <${graphURI}> { 
    ?source ?prop ?target .
    FILTER(CONTAINS(STR(?prop), "connect") || CONTAINS(STR(?prop), "relat"))
  } 
} LIMIT 10
```