# SPARQL in Semem

**Overview of SPARQL usage in Semem and data import/export utilities**

## SPARQL's Role in Semem

Semem uses SPARQL (SPARQL Protocol and RDF Query Language) as its primary knowledge storage and retrieval system. SPARQL provides a powerful, standardized way to store, query, and manipulate RDF data that represents the system's semantic knowledge.

### Core SPARQL Usage Patterns

**Storage Backend**  
SPARQL serves as Semem's primary persistent storage backend, storing all semantic data as RDF triples in named graphs. This provides a flexible, interoperable foundation that can integrate with existing semantic web infrastructure.

**Knowledge Representation**  
All Semem data is modeled as RDF using several key ontologies:
- **semem:** namespace for interactions, embeddings, and memory metadata
- **ragno:** namespace for knowledge graph entities, relationships, and corpus structure
- **zpt:** namespace for 3D navigation state (Zoom, Pan, Tilt) used in the workbench interface
- **Standard vocabularies** like SKOS, Dublin Core, and RDF Schema

**Graph Organization**  
Semem organizes data into logical named graphs:
- Content graphs store user interactions and document chunks
- Knowledge graphs contain extracted entities and relationships
- Navigation graphs track ZPT (Zoom, Pan, Tilt) state for workbench interface
- Metadata graphs track system configuration and statistics

**Query Capabilities**  
SPARQL enables sophisticated queries that combine:
- Vector similarity search with semantic filtering
- Graph traversal and relationship exploration
- Temporal queries based on timestamps and decay factors
- Statistical aggregation for system health monitoring

### Integration with Vector Search

**Hybrid Storage System**  
Semem combines SPARQL's semantic capabilities with vector similarity search:
- RDF triples store structured metadata and relationships
- Embedding vectors enable semantic similarity matching
- Combined queries provide both precision and recall

**Cosine Similarity Integration**  
Custom SPARQL functions calculate cosine similarity between embedding vectors stored as RDF literals, enabling semantic search directly within SPARQL queries.

**Multi-Modal Search**  
SPARQL queries can simultaneously filter by:
- Semantic properties (entity types, relationships, metadata)  
- Temporal constraints (creation time, access patterns)
- Vector similarity (content similarity, concept matching)

### Knowledge Graph Processing

**Entity and Relationship Storage**  
The Ragno knowledge graph framework stores extracted entities and their relationships as RDF, enabling:
- Complex graph traversals and pattern matching
- Community detection and graph analytics
- Integration with external knowledge bases

**Concept Networks**  
Extracted concepts form interconnected networks stored in SPARQL, supporting:
- Hierarchical concept organization
- Cross-reference discovery
- Semantic expansion of queries

**Corpus Decomposition**  
Large documents are decomposed into semantic units stored as RDF, preserving:
- Document structure and provenance
- Inter-chunk relationships
- Aggregation and summary capabilities

## Data Import/Export System

Semem provides comprehensive utilities for backing up and transferring SPARQL data between different stores and deployments.

### Export Utility (`utils/Export.js`)

**Purpose**  
Creates complete backups of Semem's SPARQL store data with full graph structure preservation and metadata tracking.

**Key Features**
- **Complete Data Export**: Uses SPARQL CONSTRUCT queries to export all triples
- **Graph Preservation**: Maintains named graph structure with metadata
- **Format Support**: Outputs in Turtle (.ttl), N-Triples (.nt), or RDF/XML formats
- **Statistics Generation**: Counts interactions, concepts, units, embeddings automatically
- **Metadata Headers**: Includes export timestamp, source endpoint, and data statistics

**Usage Examples**
```bash
# Export all data with default settings
node utils/Export.js

# Export specific graph only
node utils/Export.js --graph "http://hyperdata.it/content"

# Custom output location and format
node utils/Export.js --output backups/semem-backup.ttl --format ttl

# Export from remote endpoint
node utils/Export.js --endpoint "http://production.server/sparql"
```

**Output Structure**  
Generated files include comprehensive metadata headers with statistics and provenance information, followed by the complete RDF data in the chosen format.

### Import Utility (`utils/Import.js`)

**Purpose**  
Imports RDF data into SPARQL stores with efficient batch processing and data validation capabilities.

**Key Features**
- **Batch Processing**: Handles large datasets efficiently with configurable batch sizes
- **Graph Management**: Auto-detects target graphs or allows manual specification
- **Clear Operations**: Optional clearing of target graphs before import
- **Error Recovery**: Robust error handling with continuation on batch failures
- **Validation**: Optional post-import verification with triple counting
- **Performance Tracking**: Detailed statistics including import rates and timing

**Usage Examples**
```bash
# Import from default export file
node utils/Import.js

# Clear target graph and validate after import
node utils/Import.js --clear --validate

# Custom batch size and target graph
node utils/Import.js --batch 500 --graph "http://hyperdata.it/content"

# Import to different endpoint
node utils/Import.js --endpoint "http://localhost:3030/dataset/update"
```

**Batch Processing**  
Large imports are processed in configurable batches (default: 1000 triples) to avoid memory issues and provide progress feedback. Failed batches are logged but don't stop the overall import process.

### Data Migration Workflows

**Complete System Backup**
```bash
# 1. Export everything from production
node utils/Export.js --output data/production-backup.ttl

# 2. Import to development with clean slate
node utils/Import.js --input data/production-backup.ttl --clear --validate
```

**Selective Graph Transfer**
```bash
# Export specific content graph
node utils/Export.js --graph "http://hyperdata.it/content" --output data/content-only.ttl

# Import to different graph name
node utils/Import.js --input data/content-only.ttl --graph "http://hyperdata.it/development"
```

**Cross-Server Migration**
```bash
# Export from source server
node utils/Export.js --endpoint "https://source.server/sparql" --output data/migration.ttl

# Import to target server
node utils/Import.js --input data/migration.ttl --endpoint "https://target.server/update"
```

### Best Practices

**Regular Backups**  
Schedule regular exports to maintain data safety and enable rollback capabilities. Include timestamp information to track backup currency.

**Validation**  
Always use the `--validate` flag for critical imports to ensure data integrity and completeness.

**Batch Size Tuning**  
Adjust batch sizes based on server capabilities and network conditions. Smaller batches (100-500) for slower connections, larger batches (2000+) for high-performance local transfers.

**Graph Naming**  
Use consistent graph naming conventions to avoid conflicts and enable selective operations.

## Technical Implementation

The export/import system integrates directly with Semem's configuration system, automatically detecting SPARQL endpoints and authentication settings from the main configuration. Both utilities provide comprehensive logging and error reporting to support troubleshooting and monitoring.

The CONSTRUCT queries used for export are optimized to preserve all relationship information while maintaining efficiency for large datasets. The import system uses prepared SPARQL UPDATE queries with proper transaction handling to ensure data consistency.

This SPARQL-based architecture provides Semem with a robust, standards-compliant foundation for semantic knowledge management while maintaining compatibility with the broader semantic web ecosystem.