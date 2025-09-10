# Semem Technical Manual

**Semantic Web Memory for Intelligent Agents**

## Introduction

Semem is a sophisticated Node.js toolkit that bridges artificial intelligence and semantic web technologies, providing intelligent memory management and knowledge graph processing capabilities for AI applications. This manual serves as the definitive technical reference for users, developers, and researchers working with Semem's advanced semantic memory systems.

### Core Architecture

Semem integrates three foundational systems:

- **🧠 Semantic Memory System**: Advanced vector embeddings with intelligent context retrieval, featuring conversational AI interfaces and adaptive search algorithms
- **🕸️ Knowledge Graph Processing**: Comprehensive RDF/SPARQL-based knowledge representation and augmentation using the [Ragno Ontology](https://github.com/danja/ragno)
- **🧭 Multi-Dimensional Navigation**: ZPT (Zoom-Pan-Tilt) knowledge exploration system based on the [ZPT Ontology](https://github.com/danja/zpt)

### Primary Interfaces

#### Web Workbench
The **Semem Workbench** provides a comprehensive web-based interface featuring:
- **Interactive Chat**: Natural language conversation with automatic context enhancement
- **Semantic Verbs**: Structured operations (Tell, Ask, Augment, Navigate, Inspect, Console)
- **Document Processing**: Support for PDF, text, and markdown file ingestion
- **External Enhancement**: Automatic integration with Wikipedia, Wikidata, and HyDE systems

#### Model Context Protocol (MCP) Server

**NB. some of the docs are out of date. For sanity's sake the MCP has been streamlined down to 7 core tools, most of the others are deprecated.**

The **MCP Protocol Server** enables seamless AI integration through:
- **35+ Specialized Tools**: Comprehensive toolkit for memory operations, knowledge graph construction, and navigation
- **15 Resource Endpoints**: Real-time access to system documentation and operational status
- **Memory Workflows**: Persistent conversation memory with intelligent context management
- **Knowledge Construction**: Automated entity extraction, relationship modeling, and community detection
- **3D Navigation**: Multi-dimensional exploration of knowledge spaces with filtering and projection capabilities

#### Additional Interfaces
- **HTTP REST API**: 43 endpoints for programmatic access to all system capabilities
- **Direct SDK**: Node.js library for embedded applications
- **Command-Line Tools**: Utilities for batch processing and system administration

### Key Capabilities

- **Persistent Memory**: Conversations and knowledge persist across sessions with intelligent decay and prioritization
- **Adaptive Search**: Context-aware retrieval with quality scoring and multi-source enhancement
- **Knowledge Augmentation**: Automatic concept extraction, entity linking, and relationship discovery
- **Scalable Storage**: Support for in-memory, JSON file, and SPARQL triple store backends
- **Multi-Provider LLM Support**: Compatible with Mistral, Claude, Ollama, OpenAI, and other providers

## Manual Contents

### I. System Configuration and Deployment

**[System Configuration](config.md)** - Complete setup guide covering config.json and environment variables, storage backend configuration (memory, JSON, SPARQL), LLM provider integration (Mistral, Claude, Ollama, Nomic), and production deployment patterns.

**[Server Architecture](servers.md)** - Multi-server deployment guide detailing the API Server (port 4100), MCP Server (port 4101), and Workbench UI (port 4102), including proxy configuration and service orchestration.

**[LLM Provider Configuration](provider-config.md)** - Comprehensive guide to configuring language model and embedding providers with authentication, capability detection, and fallback strategies.

**[SPARQL Service Setup](sparql-service.md)** - SPARQL endpoint configuration, troubleshooting guide, and triple store integration patterns for knowledge persistence.

**[SPARQL Integration](sparql.md)** - Advanced SPARQL usage in Semem including custom queries, data import/export utilities, backup strategies, and migration workflows.

**[SPARQL CONSTRUCT Queries](sparql-construct.md)** - Comprehensive documentation of all 11 CONSTRUCT queries for knowledge extraction, including entities, relationships, concepts, documents, embeddings, interactions, provenance, navigation, and community clustering.

**[Prompt Management](prompt-management.md)** - Centralized system for managing chat completion prompts, templates, and context injection strategies.

### II. User Interfaces and Interaction

**[Web Workbench Guide](workbench-howto.md)** - Complete user manual for the web-based workbench interface, covering semantic memory verbs (Tell, Ask, Augment, Navigate, Inspect), interactive chat system, and enhanced search capabilities.

**[MCP Protocol Tutorial](mcp-tutorial.md)** - Workflow-focused guide for AI integration through the Model Context Protocol, covering 35+ specialized tools, memory management workflows, knowledge graph construction, and real-world applications.

**[MCP Tools Reference](mcp-list.md)** - Complete technical reference for all MCP tools and resources, detailing capabilities across semantic memory, Ragno knowledge graphs, ZPT navigation, and system administration.

**[HTTP REST API](http-api-endpoints.md)** - Comprehensive documentation of all 43 API endpoints with OpenAPI schemas, authentication patterns, and usage examples for programmatic integration.

**[GUI Components](gui.md)** - Advanced web interface documentation covering VSOM visualization, SPARQL browser, interactive console, and administrative monitoring tools.

### III. Knowledge Processing and Enhancement

**[Context Management](context-management.md)** - Advanced guide to Semem's HybridContextManager, adaptive search algorithms, context merging strategies, and intelligent response synthesis.

**[Knowledge Enhancement](enhancements.md)** - External knowledge integration covering Wikipedia, Wikidata, and HyDE (Hypothetical Document Embeddings) with multi-source coordination and best practices.

**[Document Ingestion](ingest.md)** - SPARQL-based document ingestion system with configurable query templates, CLI tools, batch processing capabilities, and MCP integration.

**[Memory Systems](memory.md)** - Persistent memory architecture covering conversation continuity, document storage, context-aware interactions, and memory decay strategies.

### IV. Knowledge Graph Processing (Ragno)

**[Ragno Knowledge Graphs](ragno.md)** - Technical documentation for knowledge graph construction, corpus decomposition, entity extraction, relationship modeling, and community detection algorithms.

**[Ragno RDF Integration](ragno-rdf.md)** - RDF and SPARQL technical reference covering ontology definitions, query patterns, data modeling conventions, and semantic web integration.

### V. Multi-Dimensional Navigation (ZPT)

**[ZPT Navigation System](zpt.md)** - Complete ZPT (Zoom-Pan-Tilt) documentation covering workbench integration, abstraction levels, domain filtering, perspective transformation, and advanced usage patterns.

**[ZPT MCP Integration](zpt-mcp.md)** - User guide for 3-dimensional knowledge exploration through MCP tools, covering navigation workflows, multi-dimensional filtering, and exploration scenarios.

**[ZPT Architecture](zpt-json.md)** - Technical analysis of ZPT subsystem internals including parameter processing, selection algorithms, transformation layers, and API implementation details.

### VI. Core Operations and Workflows

**[Tell Operation](tell.md)** - Comprehensive documentation of the Tell workflow covering content storage, type classification, document processing, concept extraction, and technical architecture.

**[Ask Operation](../ASK.md)** - Enhanced Ask workflow covering query processing, HyDE integration, Wikipedia/Wikidata enhancement, adaptive search, and context-aware response generation.

**[Augment Operation](augment.md)** - Complete Augment workflow documentation detailing concept extraction, attribute analysis, relationship discovery, lazy processing, and Ragno integration.

### VII. Visualization and Analytics

**[VSOM Visualization](vsom.md)** - Vector Self-Organizing Map system for knowledge visualization, pattern recognition, and interactive exploration of semantic spaces.

**[Usage Hints and Tips](hints.md)** - Practical guidance for optimizing search results, understanding similarity thresholds, zoom level behaviors, and effective workbench usage patterns.

### VIII. Development and Extension

**[Development Infrastructure](infrastructure.md)** - Coding guidelines, architectural patterns, and best practices for extending Semem functionality with new components and integrations.

**[Testing Framework](tests.md)** - Comprehensive testing infrastructure covering unit tests, integration tests, service dependencies, SPARQL test stores, and automated test execution.

**[System Connectors](connectors.md)** - Implementation patterns for LLM provider connectors including authentication, capability detection, error handling, and fallback strategies.

### IX. Advanced Topics and Algorithms

**[Core Algorithms](algorithms.md)** - Mathematical foundations and algorithmic details underlying Semem's semantic processing capabilities.

**[Context Window Management](context-window.md)** - Advanced context window strategies, text chunking algorithms, and memory optimization techniques.

**[Vector Index Caching](index-cache.md)** - Performance optimization through intelligent vector index caching and memory management strategies.

**[Corpus Decomposition](decompose.md)** - Advanced text processing for breaking documents into semantic units with boundary detection and coherence preservation.

**[Corpuscle Ranking](corpuscle-ranking.md)** - Sophisticated ranking algorithms for semantic corpuscles based on relevance, importance, and contextual significance.

**[Graph Analytics](graph-analytics.md)** - Knowledge graph analysis techniques including community detection, centrality measures, and structural pattern recognition.

**[Workflow Optimization](flow-optimize.md)** - Performance tuning strategies for large-scale knowledge processing and memory management workflows.

### X. Examples and Tutorials

**[Code Examples](../../examples/README.md)** - Practical code examples, command-line demonstrations, and integration patterns for common use cases.

## Architecture Overview

Semem's layered architecture enables flexible deployment and integration:

- **Interface Layer**: Direct SDK usage, HTTP REST API, MCP protocol server, web UI ([servers.md](servers.md))
- **Core Services**: Memory management, LLM handling, embedding generation, context management
- **Knowledge Systems**: Ragno (graph construction), ZPT (navigation), storage backends
- **Integration**: SPARQL endpoints, external LLM providers, vector databases ([config.md](config.md))

## Getting Started

1. **Quick Setup**: Follow [config.md](config.md) for initial configuration
2. **Choose Interface**: 
   - **New Users**: Start with conversational chat in the workbench ([workbench-howto.md](workbench-howto.md))
   - **Enhanced Knowledge**: Use enhancements for external knowledge integration ([enhancements.md](enhancements.md))
   - **Developers**: Use HTTP API ([http-api-endpoints.md](http-api-endpoints.md))
   - **AI Integration**: Use MCP protocol ([mcp-tutorial.md](mcp-tutorial.md))
   - **Advanced UI**: Use full web interface ([gui.md](gui.md))
3. **Explore Capabilities**: Start with natural language chat, then explore semantic memory verbs and knowledge navigation

## See Also

### Research and References
- **[Ragno Ontology](https://github.com/danja/ragno)** - Knowledge graph modeling framework
- **[ZPT Ontology](https://github.com/danja/zpt)** - 3D navigation concepts
- **[NodeRAG Paper](https://arxiv.org/abs/2504.11544)** - Graph retrieval augmentation techniques
- **[HyDE Paper](https://arxiv.org/abs/2212.10496)** - Hypothetical document embeddings

### Community and Updates
- **[Tensegrity Blog](https://tensegrity.it)** - Development updates and research insights
- **[GitHub Repository](https://github.com/danja/semem)** - Source code and issue tracking
- **[CURRENT-ACTIVITIES.md](../../docs/CURRENT-ACTIVITY.md)** - Active development status

---

*Semem the Manual*
