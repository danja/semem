# Complete Semem MCP Tool & Resource Reference

This comprehensive reference provides ready-to-use prompts for testing and demonstrating all **32 MCP tools** and **15 resources** across semantic memory management, knowledge graph operations, and 3D navigation.

## 📚 Quick Navigation

- [🧠 Core Memory Management (5 tools)](#core-memory-management)
- [💾 Storage Backend Management (6 tools)](#storage-backend-management) 
- [🎯 Context Management (4 tools)](#context-management)
- [⚙️ System Configuration & Monitoring (4 tools)](#system-configuration--monitoring)
- [🕸️ Ragno Knowledge Graph (8 tools)](#ragno-knowledge-graph)
- [🧭 ZPT 3D Navigation (6 tools)](#zpt-3d-navigation)
- [📊 System Resources (7 resources)](#system-resources)
- [🕸️ Ragno Resources (4 resources)](#ragno-resources)
- [🧭 ZPT Resources (4 resources)](#zpt-resources)

---

## 🧠 Core Memory Management

### `semem_store_interaction` - Store interactions with embedding generation

#### Basic Usage
```
Store a new interaction about artificial intelligence with automatic concept extraction
```

#### Advanced Usage with Metadata
```
Store interaction: "What is machine learning?" with response "Machine learning is a subset of AI..." and metadata: {"domain": "technology", "complexity": "beginner"}
```

#### Educational Context
```
Store an educational interaction about climate change with detailed explanation and examples for future reference
```

### `semem_retrieve_memories` - Semantic memory search and retrieval

#### Basic Similarity Search
```
Retrieve memories similar to "artificial intelligence" with threshold 0.7 and limit 10
```

#### High-Precision Search
```
Find memories about "quantum computing" with similarity threshold 0.9 to get only the most relevant results
```

#### Broad Exploration
```
Search memories related to "technology trends" with threshold 0.5 and limit 20 for comprehensive exploration
```

### `semem_generate_embedding` - Generate vector embeddings for text

#### Single Text Embedding
```
Generate embedding for the text "Machine learning algorithms process data to find patterns"
```

#### Concept Embedding
```
Create vector embedding for the concept "sustainable energy solutions" for similarity comparisons
```

#### Technical Documentation
```
Generate embedding for this technical description: "LSTM networks use gating mechanisms to control information flow"
```

### `semem_generate_response` - LLM response generation with memory context

#### Context-Aware Response
```
Generate response to "Explain neural networks" using memory context from previous AI discussions
```

#### Creative Writing with Memory
```
Generate a creative story about space exploration using stored memories about astronomy and science fiction
```

#### Technical Explanation
```
Create a detailed explanation of blockchain technology incorporating relevant stored knowledge
```

### `semem_extract_concepts` - Extract semantic concepts from text

#### Academic Text Analysis
```
Extract key concepts from: "The quantum mechanical properties of superconductors enable zero electrical resistance"
```

#### Business Document Processing
```
Analyze and extract concepts from a business proposal about renewable energy investments
```

#### Research Paper Summary
```
Extract semantic concepts from research abstract about artificial intelligence in healthcare
```

---

## 💾 Storage Backend Management

### `semem_switch_storage_backend` - Switch between storage backends

#### Switch to SPARQL Backend
```
Switch storage backend to SPARQL with endpoint configuration for semantic web integration
```

#### Development Mode Switch
```
Switch to InMemory backend for rapid development and testing without persistence
```

#### Production Configuration
```
Switch to CachedSPARQL backend with optimized settings for production workloads
```

### `semem_backup_memory` - Backup memory to JSON/RDF formats

#### JSON Backup
```
Create backup of current memory in JSON format including embeddings for complete preservation
```

#### RDF Backup for Semantic Web
```
Backup memory as RDF/Turtle format for semantic web applications and interoperability
```

#### Lightweight Backup
```
Create backup in JSON format without embeddings for quick storage and transfer
```

### `semem_load_memory` - Load memory from backup files

#### Restore from Backup
```
Load memory from backup file with merge option to preserve existing data
```

#### Fresh Start Load
```
Load memory from backup file with replace option for clean state restoration
```

#### Format-Specific Loading
```
Load memory from RDF/Turtle backup file to restore semantic web format data
```

### `semem_storage_stats` - Get storage statistics and health

#### Basic Statistics
```
Get current storage statistics including memory count, size, and performance metrics
```

#### Health Check
```
Retrieve comprehensive storage health information with error rates and optimization recommendations
```

#### Performance Analysis
```
Analyze storage performance with detailed timing, cache hit rates, and throughput metrics
```

### `semem_migrate_storage` - Migrate data between storage backends

#### Development to Production Migration
```
Migrate data from InMemory to SPARQL backend for production deployment
```

#### Backend Optimization
```
Migrate from basic SPARQL to CachedSPARQL backend for improved performance
```

#### Cross-Platform Migration
```
Migrate memory data from JSON to SPARQL backend with configuration optimization
```

### `semem_clear_storage` - Clear storage with confirmation

#### Safe Clearing with Backup
```
Clear storage with automatic backup creation for safe data removal
```

#### Development Reset
```
Clear storage for development reset (confirm: true) without backup for clean slate
```

#### Production Maintenance
```
Clear storage with explicit confirmation and backup for production maintenance
```

---

## 🎯 Context Management

### `semem_get_context` - Retrieve current context window information

#### Context Overview
```
Get current context window information including active memories and token usage
```

#### Detailed Context Analysis
```
Retrieve comprehensive context details with relevance scores and temporal data
```

#### Context Performance Check
```
Analyze context window performance with memory distribution and efficiency metrics
```

### `semem_update_context_config` - Update context window settings

#### Optimize for Performance
```
Update context configuration: maxTokens 8000, relevanceThreshold 0.8, maxContextSize 15
```

#### High-Precision Context
```
Configure context for high precision: maxTokens 4000, relevanceThreshold 0.9, maxContextSize 10
```

#### Large Context Window
```
Set up large context window: maxTokens 16000, relevanceThreshold 0.6, maxContextSize 20
```

### `semem_prune_context` - Prune context based on relevance and age

#### Relevance-Based Pruning
```
Prune context keeping only items with relevance score above 0.7 for focused processing
```

#### Time-Based Pruning
```
Prune context removing items older than 24 hours (86400000ms) for fresh context
```

#### Combined Pruning Strategy
```
Prune context with minimum relevance 0.6 and maximum age 1 hour for balanced optimization
```

### `semem_summarize_context` - Generate summaries of current context

#### Context Summary
```
Generate comprehensive summary of current context window for overview understanding
```

#### Key Points Extraction
```
Create focused summary highlighting key themes and concepts from active context
```

#### Context Insights
```
Generate analytical summary with insights about context patterns and relationships
```

---

## ⚙️ System Configuration & Monitoring

### `semem_get_config` - Get current system configuration

#### Complete Configuration
```
Get current system configuration across all components and modules
```

#### Storage Configuration
```
Retrieve storage-specific configuration settings and backend information
```

#### LLM Provider Configuration
```
Get LLM provider settings including model configurations and capabilities
```

### `semem_update_config` - Update system configuration settings

#### Storage Configuration Update
```
Update storage configuration: section "storage", updates {"timeout": 10000, "retries": 5}
```

#### Memory Configuration
```
Update memory settings: section "memory", updates {"similarityThreshold": 0.8, "contextWindow": 5}
```

#### Model Configuration
```
Update model configuration: section "models", updates {"temperature": 0.7, "maxTokens": 2000}
```

### `semem_get_metrics` - Get detailed system metrics and performance

#### Performance Metrics
```
Get comprehensive performance metrics including response times, cache rates, and throughput
```

#### Memory Usage Analysis
```
Retrieve detailed memory usage metrics with breakdown by component and operation type
```

#### System Health Metrics
```
Analyze system health with error rates, success rates, and resource utilization
```

### `semem_health_check` - Comprehensive health check

#### Complete Health Check
```
Perform comprehensive health check of all system components and dependencies
```

#### Storage Health Validation
```
Check storage backend health including connectivity, performance, and data integrity
```

#### Service Dependencies Check
```
Validate health of all service dependencies including LLM providers and external APIs
```

---

## 🕸️ Ragno Knowledge Graph

### `ragno_decompose_corpus` - Transform text corpus into RDF knowledge graph

#### Basic Corpus Decomposition
```
Decompose text corpus about artificial intelligence with entity extraction and relationship mapping
```

#### Advanced Decomposition with Options
```
Transform research papers into knowledge graph with extractRelationships: true, generateSummaries: true, maxEntitiesPerUnit: 25
```

#### Domain-Specific Processing
```
Decompose medical research corpus with high entity confidence (0.8) and detailed relationship extraction
```

### `ragno_search_dual` - Combined exact + vector + PersonalizedPageRank search

#### Multi-Modal Search
```
Search for "machine learning algorithms" using dual search with combined exact matching, vector similarity, and graph traversal
```

#### High-Precision Discovery
```
Find entities related to "quantum computing" with exactMatchThreshold 0.9 and vectorSimilarityThreshold 0.8
```

#### Exploratory Graph Search
```
Explore "climate change" with PersonalizedPageRank depth 4 and combined result limit 25
```

### `ragno_get_entities` - Retrieve entities from knowledge graph

#### All Entities Overview
```
Retrieve all entities from knowledge graph with metadata and frequency information
```

#### Filtered Entity Search
```
Get entities with minimum frequency 3, specific type "Person", and limit 50 for targeted analysis
```

#### Entry Point Entities
```
Find entry point entities only with high-frequency threshold for knowledge graph navigation
```

### `ragno_vector_search` - HNSW-based vector similarity search

#### Semantic Similarity Search
```
Find entities semantically similar to "artificial intelligence research" with threshold 0.7 and k=15
```

#### Concept Clustering
```
Search for concepts related to "sustainable energy" with similarity threshold 0.8 and metadata inclusion
```

#### Technical Term Discovery
```
Find entities similar to "quantum entanglement" with high precision (threshold 0.9) and k=10
```

### `ragno_export_rdf` - Export knowledge graph in multiple RDF formats

#### Turtle Export with Statistics
```
Export complete knowledge graph as Turtle format with statistics and embeddings included
```

#### JSON-LD for Web Applications
```
Export graph as JSON-LD format optimized for web applications and linked data consumption
```

#### N-Triples for Processing
```
Export as N-Triples format for data processing and analysis workflows
```

### `ragno_query_sparql` - Execute SPARQL queries against graph

#### Entity Count Query
```
Execute SPARQL: "SELECT (COUNT(?entity) AS ?count) WHERE { ?entity a ragno:Entity }" with limit 1000
```

#### Relationship Discovery
```
Query relationships: "SELECT ?subject ?predicate ?object WHERE { ?rel a ragno:Relationship; ragno:hasSubject ?subject }"
```

#### Complex Graph Analysis
```
Find entity types and frequencies with SPARQL aggregation and ordering for comprehensive analysis
```

### `ragno_analyze_graph` - Graph analysis (centrality, communities, connectivity)

#### Complete Graph Analysis
```
Perform comprehensive graph analysis including centrality, communities, statistics, and connectivity
```

#### Community Detection
```
Analyze graph communities with detailed results and top 15 communities for cluster understanding
```

#### Centrality Analysis
```
Calculate centrality metrics for all entities with top 20 most central nodes for importance ranking
```

### `ragno_get_graph_stats` - Basic and detailed knowledge graph statistics

#### Basic Statistics
```
Get basic knowledge graph statistics including node count, edge count, and connectivity metrics
```

#### Detailed Analysis with Distributions
```
Retrieve detailed statistics with entity type distributions, relationship patterns, and performance metrics
```

#### Performance Statistics
```
Analyze graph performance with query times, indexing efficiency, and optimization recommendations
```

---

## 🧭 ZPT 3D Navigation

### `zpt_navigate` - 3-dimensional knowledge graph navigation

#### Basic Entity Navigation
```
Navigate "artificial intelligence" with entity zoom, keywords tilt, and 2000 token limit for quick overview
```

#### Relationship Exploration
```
Explore "machine learning algorithms" with unit zoom, graph tilt, and structured format for relationship mapping
```

#### Temporal Analysis Navigation
```
Navigate "climate change research" with community zoom, temporal tilt, and date range 2020-2024
```

#### Complex Multi-Dimensional Navigation
```
Navigate "renewable energy" with unit zoom, embedding tilt, entity filter ["Tesla", "SolarCity"], temporal range 2022-2024
```

#### Geographic Context Navigation
```
Navigate "urban development" with text zoom, keywords tilt, geographic filter bbox [-122.5, 37.2, -121.9, 37.6]
```

### `zpt_preview` - Preview ZPT navigation options

#### Quick Preview
```
Preview navigation options for "quantum computing" at entity level to understand available content
```

#### Comprehensive Preview
```
Preview "biotechnology trends" with unit zoom and topic filtering for scope estimation
```

#### Multi-Parameter Preview
```
Preview "AI research" with entity filtering and temporal constraints to estimate processing requirements
```

### `zpt_get_schema` - Get complete ZPT parameter schema

#### Complete Schema
```
Get complete ZPT parameter schema with validation rules, examples, and error code documentation
```

#### Parameter Documentation
```
Retrieve ZPT schema for understanding available zoom levels, pan filters, and tilt styles
```

#### Validation Reference
```
Get schema documentation for parameter validation and error handling implementation
```

### `zpt_validate_params` - Validate ZPT parameters

#### Valid Parameter Check
```
Validate parameters: query "neural networks", zoom "unit", pan {"temporal": {"start": "2023-01-01"}}, tilt "graph"
```

#### Error Detection
```
Validate invalid parameters: query "", zoom "invalid_level", tilt "nonexistent_style" for error handling
```

#### Complex Parameter Validation
```
Validate complex navigation with geographic filters, entity constraints, and transformation options
```

### `zpt_get_options` - Get available parameter values for corpus

#### Current Corpus Options
```
Get available navigation options for current corpus context to understand exploration possibilities
```

#### Query-Specific Options
```
Get navigation options for "artificial intelligence" query to see relevant domains and entities
```

#### Full Corpus Capabilities
```
Retrieve complete navigation options with full context for comprehensive corpus understanding
```

### `zpt_analyze_corpus` - Analyze corpus structure for optimization

#### Structure Analysis
```
Analyze corpus structure for navigation optimization with detailed statistics and recommendations
```

#### Performance Analysis
```
Get corpus performance analysis with recommendations for optimal navigation parameters
```

#### Navigation Recommendations
```
Analyze corpus and get recommendations for effective navigation strategies and parameter tuning
```

---

## 📊 System Resources

### `semem://status` - System status and service health

#### Access Example
```
Read semem://status for current system health and service availability
```

### `semem://docs/api` - Complete API documentation

#### Documentation Access
```
Read semem://docs/api for comprehensive API documentation and usage examples
```

### `semem://graph/schema` - RDF graph schema and ontology

#### Schema Information
```
Read semem://graph/schema for RDF ontology structure and semantic relationships
```

### `semem://config/current` - Current system configuration

#### Configuration Review
```
Read semem://config/current for active system settings and component configurations
```

### `semem://storage/backends` - Storage backend capabilities

#### Backend Information
```
Read semem://storage/backends for available storage options and their capabilities
```

### `semem://metrics/dashboard` - System metrics and performance

#### Performance Dashboard
```
Read semem://metrics/dashboard for real-time system performance and usage statistics
```

### `semem://examples/workflows` - Common workflow examples

#### Workflow Templates
```
Read semem://examples/workflows for common usage patterns and integration examples
```

---

## 🕸️ Ragno Resources

### `semem://ragno/ontology` - Complete Ragno ontology in Turtle format

#### Ontology Access
```
Read semem://ragno/ontology for complete RDF ontology definition in Turtle format
```

### `semem://ragno/pipeline` - Complete Ragno knowledge graph pipeline guide

#### Pipeline Documentation
```
Read semem://ragno/pipeline for comprehensive guide to knowledge graph construction workflow
```

### `semem://ragno/examples` - Knowledge graph construction examples

#### Example Workflows
```
Read semem://ragno/examples for practical knowledge graph construction and analysis examples
```

### `semem://ragno/sparql/queries` - Pre-built SPARQL query templates

#### Query Templates
```
Read semem://ragno/sparql/queries for ready-to-use SPARQL queries for common graph operations
```

---

## 🧭 ZPT Resources

### `semem://zpt/schema` - Complete JSON schema for ZPT navigation

#### Parameter Schema
```
Read semem://zpt/schema for complete JSON schema of ZPT navigation parameters with validation rules
```

### `semem://zpt/examples` - Comprehensive ZPT navigation examples

#### Navigation Examples
```
Read semem://zpt/examples for comprehensive navigation patterns and usage examples
```

### `semem://zpt/guide` - ZPT concepts and spatial metaphors guide

#### Conceptual Guide
```
Read semem://zpt/guide for understanding ZPT 3D navigation concepts and spatial metaphors
```

### `semem://zpt/performance` - ZPT performance optimization strategies

#### Performance Guide
```
Read semem://zpt/performance for optimization strategies, caching patterns, and performance tuning
```

---

## 🚀 Common Usage Patterns

### Getting Started Workflow
```
1. Check system status: semem://status
2. Store initial interaction: semem_store_interaction
3. Retrieve similar memories: semem_retrieve_memories
4. Get system metrics: semem_get_metrics
```

### Knowledge Graph Construction
```
1. Prepare text corpus for processing
2. Decompose corpus: ragno_decompose_corpus
3. Retrieve entities: ragno_get_entities
4. Analyze graph: ragno_analyze_graph
5. Export results: ragno_export_rdf
```

### 3D Navigation Exploration
```
1. Preview navigation: zpt_preview
2. Validate parameters: zpt_validate_params
3. Navigate with ZPT: zpt_navigate
4. Analyze corpus: zpt_analyze_corpus
```

### System Administration
```
1. Health check: semem_health_check
2. Get configuration: semem_get_config
3. Storage statistics: semem_storage_stats
4. Backup memory: semem_backup_memory
```

### Research Workflow
```
1. Store research context: semem_store_interaction
2. Build knowledge graph: ragno_decompose_corpus
3. Navigate for insights: zpt_navigate
4. Export findings: ragno_export_rdf
```

---

## 🔧 Advanced Integration Patterns

### Memory + Knowledge Graph Integration
```
1. Store memories with semem_store_interaction
2. Build knowledge graph with ragno_decompose_corpus
3. Search with ragno_search_dual for enhanced retrieval
4. Navigate with zpt_navigate for intuitive exploration
```

### Performance Optimization Workflow
```
1. Analyze performance: semem_get_metrics
2. Optimize storage: semem_switch_storage_backend
3. Tune context: semem_update_context_config
4. Monitor health: semem_health_check
```

### Research Data Pipeline
```
1. Decompose research corpus: ragno_decompose_corpus
2. Extract key entities: ragno_get_entities
3. Navigate for insights: zpt_navigate
4. Query with SPARQL: ragno_query_sparql
5. Export for analysis: ragno_export_rdf
```

---

## 📝 Notes

- **Parameter Validation**: Always validate complex parameters with appropriate validation tools
- **Performance**: Use preview tools before full processing for resource estimation
- **Error Handling**: Check tool responses for success status and error messages
- **Resource Access**: Resources provide documentation and examples for tool usage
- **Integration**: Combine tools for powerful workflows across memory, knowledge graphs, and navigation

**Total Available**: 32 tools + 15 resources = 47 MCP capabilities for comprehensive semantic memory and knowledge graph operations.