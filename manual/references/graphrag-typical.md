# Graph RAG MCP Server: Typical Tools, Resources, and Prompt Settings

## MCP Tools
Graph RAG MCP servers expose a comprehensive set of tools that enable large language models to interact with the hybrid retrieval system. These tools are categorized into several functional areas:

### Document Management Tools
Document Storage and Processing: The storeDocument tool allows for document ingestion with metadata preservation, while chunkDocument creates manageable text segments with configurable parameters. The embedChunks tool generates vector embeddings for semantic search capabilities.

#### Entity Extraction and Linking 
Advanced implementations include extractTerms for automatic entity identification and linkEntitiesToDocument for creating explicit associations between documents and extracted entities.

#### Document Lifecycle Management
Tools like deleteDocuments and listDocuments provide comprehensive document management capabilities, allowing for cleanup and inventory operations.

### Knowledge Graph Operations

#### Entity Management
The createEntities tool enables the creation of new graph nodes with observations and type classifications. This is complemented by addObservations for enriching existing entities with additional contextual information.

#### Relationship Building
The createRelations tool establishes directed connections between entities, defining how different concepts interact within the knowledge graph. Relationship management is supported through deleteRelations for precise graph maintenance.

#### Graph Maintenance
Advanced tools include deleteEntities and deleteObservations for granular control over graph structure and content.

### Search and Retrieval Tools

#### Hybrid Search Capabilities
The primary hybridSearch tool combines vector similarity with graph traversal to provide contextually aware results. This approach delivers both semantically relevant and relationally meaningful information.

#### Semantic Search
The search_documentation tool provides pure semantic search functionality using document embeddings and vector similarity.

#### Graph-Specific Search
Tools like searchNodes and openNodes enable targeted entity discovery and relationship exploration within the knowledge graph.

#### Comprehensive Retrieval
The readGraph tool provides access to complete knowledge graph structure for complex analytical queries.

### Analytics and Monitoring

#### Knowledge Base Statistics
The getKnowledgeGraphStats tool provides comprehensive metrics about entities, relationships, and overall knowledge base health.

## MCP Resources
MCP resources in Graph RAG servers provide structured access to database schemas, collection information, and system metadata. These resources enable clients to understand the underlying data structure and optimize their queries accordingly.

### Schema Resources

#### Graph Schema Information
Resources typically expose schema details through URIs, providing information about node types, relationship patterns, and property structures.

#### Vector Collection Metadata
Collection information is made available URIs detailing embedding dimensions, distance metrics, and indexing parameters.

### Configuration Resources

#### Database Connection Status
Resources may include real-time connectivity information and health checks for both graph and vector databases.

#### System Configuration
Advanced implementations expose configuration parameters, allowing clients to understand capabilities and limitations.

## Prompt Settings and Configuration

### System Prompt Optimization
Graph RAG MCP servers benefit from carefully crafted system prompts that guide effective utilization of the hybrid retrieval system. Recommended prompt patterns include:

#### Information Storage Guidelines
Prompts should encourage proper document processing workflows, emphasizing the importance of complete processing chains: Store → Chunk → Embed → Extract → Link.

#### Retrieval Strategy Instructions
System prompts should guide the use of hybrid search for comprehensive information retrieval, leveraging both semantic similarity and graph relationships.

#### Memory Maintenance Protocols
Prompts should include guidance for adding observations to enrich entity context and linking documents to relevant entities for improved discoverability.

### Context Operations

#### Context Budget Management
The Model Context Protocol implementation includes sophisticated context balancing mechanisms, typically allocating token budgets across different component types: 30% for graph entities, 20% for graph relationships, and 50% for vector chunks.

#### Context Element Processing
The system formats context from various sources according to MCP specifications, processing graph entities, relationships, and vector chunks into standardized context elements.

#### Dynamic Context Summarization
Advanced implementations generate context summaries for LLMs, providing overviews of available entities, relationships, and document chunks.

