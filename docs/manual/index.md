# Semem Manual

**Semantic Web Memory for Intelligent Agents**

**Status 2025-06-29 :** mostly working, many loose ends, not ready for use in the wild yet

*TODO : Doc for the HyDE algorithm*

## Introduction

This manual provides comprehensive documentation for Semem, a Node.js toolkit that integrates large language models (LLMs) with Semantic Web technologies (RDF/SPARQL) for intelligent memory management and knowledge graph processing. The manual bridges the high-level overview in the [README](../../README.md) with detailed technical documentation, serving as the primary reference for users, developers, and researchers working with Semem.

Semem combines three core systems:
- **🧠 Semantic Memory**: Vector embeddings and intelligent context retrieval
- **🕸️ Knowledge Graphs**: Knowledge graphrepresentation and augmentation based around the [Ragno Ontology](https://github.com/danja/ragno)
- **🧭 Dimensional Navigation**: ZPT (Zoom, Pan, Tilt) knowledge exploration using the [ZPT Ontology](https://github.com/danja/zpt)

The system provides multiple interfaces (direct SDK, HTTP API, MCP protocol, web UI) and supports various deployment scenarios from local development to production semantic web infrastructure.

## Contents

**[algorithms.md](algorithms.md)**

### Demonstrators

Examples are categorised in the `examples` dir. Most should work, though there are a lot, revisions to the core code causes breakage and it takes me a while to get around to checking things.

**[beerqa.md](beerqa.md) [beerqa-2.md](beerqa-2.md) [beerqa-feedback.md](beerqa-feedback.md)** 

*tl;dr* the code under `examples/beerqa` implements a question-answering workflow that combines Semantic Web technologies (RDF/SPARQL), vector embeddings, and large language models to provide contextually-augmented answers. It uses SDK facilities directly through a series of individual node scripts (*less to go wrong*). There's an enhanced version in-progress, see [beerqa-2.md](beerqa-2.md).

### Core Configuration and Setup

**[config.md](config.md)** - Complete system configuration guide covering config.json and .env setup, storage backends (memory, JSON, SPARQL), LLM provider configuration (Mistral, Claude, Ollama, Nomic), server deployment (SDK, HTTP API, MCP, UI), and production deployment patterns.

### Command-Line Demos

**[examples](../../examples/README.md)**

### Integration and Protocols

**[mcp-tutorial.md](mcp-tutorial.md)** - Comprehensive workflow-focused guide for using Semem through the Model Context Protocol (MCP), covering 35+ tools, 15 resources, memory management workflows, knowledge graph construction, 3D navigation, and real-world use cases for academic research, business intelligence, and content analysis.

**[mcp-list.md](mcp-list.md)** - Complete reference for all MCP tools and resources, detailing the 35+ tools across semantic memory, Ragno knowledge graphs, ZPT navigation, and system management, plus 15 resources for documentation and system status.

**[http-api-endpoints.md](http-api-endpoints.md)** - Detailed documentation of all 43 HTTP API endpoints covering system health, memory operations, chat interfaces, Ragno knowledge graph processing, ZPT navigation, VSOM visualization, and administrative functions with OpenAPI schemas and usage examples.

### Knowledge Graph Processing

**[ragno.md](ragno.md)** - Technical documentation for the Ragno knowledge graph system covering corpus decomposition, entity extraction, relationship modeling, community detection, and RDF export following the Ragno ontology for semantic web integration.

**[ragno-rdf.md](ragno-rdf.md)** - RDF and SPARQL technical reference for Ragno knowledge graphs, including ontology definitions, SPARQL query patterns, data modeling conventions, and integration with external semantic web systems and triple stores.

### 3D Knowledge Navigation

**[zpt-mcp.md](zpt-mcp.md)** - User-focused guide for 3-dimensional knowledge graph navigation using MCP tools, covering ZPT concepts (Zoom, Pan, Tilt), navigation workflows, multi-dimensional filtering, and real-world exploration scenarios for research, business analysis, and content discovery.

**[zpt-json.md](zpt-json.md)** - Technical analysis of the ZPT subsystem architecture, including parameter processing, selection algorithms, transformation layers, token management, and API implementation details for developers extending ZPT functionality.

### System Components and User Interfaces

**[connectors.md](connectors.md)** - LLM provider connector documentation covering implementation patterns for Ollama, Claude, Mistral, OpenAI, and other providers, including authentication, capability detection, error handling, and fallback strategies.

**[gui.md](gui.md)** - Web-based user interface documentation covering the VSOM visualization system, SPARQL browser, interactive console, memory management interface, and administrative tools for system monitoring and configuration.

## Architecture Overview

Semem's layered architecture enables flexible deployment and integration:

- **Interface Layer**: Direct SDK usage, HTTP REST API, MCP protocol server, web UI
- **Core Services**: Memory management, LLM handling, embedding generation, context management
- **Knowledge Systems**: Ragno (graph construction), ZPT (navigation), storage backends
- **Integration**: SPARQL endpoints, external LLM providers, vector databases

## Getting Started

1. **Quick Setup**: Follow [config.md](config.md) for initial configuration
2. **Choose Interface**: 
   - **Developers**: Use HTTP API ([http-api-endpoints.md](http-api-endpoints.md))
   - **AI Integration**: Use MCP protocol ([mcp-tutorial.md](mcp-tutorial.md))
   - **Interactive Use**: Use web UI ([gui.md](gui.md))
3. **Explore Capabilities**: Start with basic memory operations, then knowledge graphs and navigation

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
