# Semem MCP Tutorial: Complete User Guide

**A comprehensive step-by-step tutorial for using Semem with MCP-enabled systems**

## Table of Contents

1. [Introduction](#introduction)
2. [Prerequisites](#prerequisites)
3. [Quick Start](#quick-start)
4. [Understanding Semem's MCP Capabilities](#understanding-semems-mcp-capabilities)
5. [Basic Memory Operations](#basic-memory-operations)
6. [Knowledge Graph Construction](#knowledge-graph-construction)
7. [Advanced Workflow Orchestration](#advanced-workflow-orchestration)
8. [3D Navigation and Analysis](#3d-navigation-and-analysis)
9. [Integrated Multi-System Workflows](#integrated-multi-system-workflows)
10. [Real-World Use Cases](#real-world-use-cases)
11. [Troubleshooting](#troubleshooting)
12. [Advanced Configuration](#advanced-configuration)

---

## Introduction

Semem is a powerful Node.js toolkit that combines semantic memory management, knowledge graph construction, and 3D spatial navigation into a unified system accessible through the Model Context Protocol (MCP). This tutorial will guide you through using Semem's capabilities in any MCP-enabled environment, from Claude Desktop to custom AI applications.

### What You'll Learn

- How to set up and connect to Semem's MCP server
- Using 32+ tools for memory, knowledge graphs, and navigation
- Executing 8 pre-built workflow prompts for complex operations
- Building your own workflows combining multiple Semem systems
- Real-world applications and best practices

### Key Capabilities Overview

**🧠 Semantic Memory**: Intelligent storage and retrieval with vector embeddings  
**🕸️ Knowledge Graphs**: RDF-based entity extraction and relationship modeling  
**🎯 3D Navigation**: Spatial analysis and multi-dimensional content exploration  
**🔌 Workflow Orchestration**: Pre-built prompts for complex multi-step operations

---

## Prerequisites

### System Requirements

- **Node.js**: Version 20.11.0 or higher
- **Memory**: 4GB+ RAM recommended for large documents
- **Storage**: 1GB+ free space for embeddings and knowledge graphs

### Required Services

1. **Ollama** (recommended for local processing):
   ```bash
   # Install Ollama from https://ollama.ai
   ollama pull qwen2:1.5b         # For chat/text generation
   ollama pull nomic-embed-text   # For embeddings (1536 dimensions)
   ```

2. **Optional - SPARQL Endpoint** (for advanced features):
   ```bash
   # Using Docker
   docker run -d --name fuseki -p 3030:3030 stain/jena-fuseki
   ```

### MCP-Enabled Client

Choose one of:
- **Claude Desktop** (most popular)
- **Continue.dev** VS Code extension
- **Custom MCP client** using the SDK
- **Any application** supporting MCP JSON-RPC 2.0

---

## Quick Start

### Step 1: Install and Setup Semem

```bash
# Clone the repository
git clone https://github.com/danja/semem.git
cd semem

# Install dependencies
npm install

# Configure environment
cp example.env .env
# Edit .env with your API keys if using cloud LLMs
```

### Step 2: Start the MCP Server

```bash
# Start the MCP server
npm run mcp-server-new

# Server will start on stdio transport
# You should see: "✅ Semem MCP server running on stdio transport"
```

### Step 3: Connect Your MCP Client

#### For Claude Code

Run:
```sh
claude mcp add semem node mcp/index.js
```
Then start Claude.

To check operation, try the prompt :
> use extract_concepts on "the cat sat on the mat"

 semem:prompt_list()
  semem:prompt_get(name: "research-workflow")

 mcp__semem__prompt_execute with name="research-workflow"

 mcp__semem__prompt_execute with name="research-workflow" on the content of docs/mcp/dotarag-paper.md

#### For Claude Desktop

Add to your Claude Desktop configuration file:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`  
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "semem": {
      "command": "node",
      "args": ["/path/to/semem/mcp/index.js"],
      "env": {
        "NODE_ENV": "production"
      }
    }
  }
}
```

#### For Other MCP Clients

Connect to the stdio transport or use the HTTP server:

```bash
# For HTTP transport (alternative)
MCP_PORT=3002 node mcp/http-server.js
# Connect to: http://localhost:3002/mcp
```

### Step 4: Verify Connection

Once connected, you should see Semem's tools available in your MCP client:

- **35+ tools** including memory, knowledge graph, and navigation operations
- **8 prompt workflows** for complex multi-step operations
- **15 resources** for documentation and system status

---

## Understanding Semem's MCP Capabilities

### Tool Categories

Semem provides tools organized into logical categories:

#### 🧠 **Memory Management Tools** (5 tools)
- `semem_store_interaction` - Store conversations with embeddings
- `semem_retrieve_memories` - Search similar memories
- `semem_generate_response` - Context-aware response generation
- `semem_generate_embedding` - Vector embedding generation
- `semem_extract_concepts` - Concept extraction from text

#### 🕸️ **Knowledge Graph Tools** (8 tools)
- `ragno_decompose_corpus` - Convert text to RDF entities
- `ragno_create_entity` - Create individual entities
- `ragno_sparql_query` - Query the knowledge graph
- `ragno_analyze_graph` - Graph analytics and metrics
- And more...

#### 🎯 **3D Navigation Tools** (6 tools)
- `zpt_select_corpuscles` - Multi-dimensional content selection
- `zpt_chunk_content` - Advanced content chunking
- `zpt_validate_filters` - Filter validation
- And more...

#### 🚀 **Workflow Orchestration** (3 prompt tools)
- `prompt_list` - List available workflow templates
- `prompt_get` - Get detailed workflow information
- `prompt_execute` - Execute multi-step workflows

#### 📊 **System Management** (6+ tools)
- Storage backend switching
- Backup and restore operations
- Performance monitoring
- Configuration management

### Pre-Built Workflow Prompts

Semem includes 8 sophisticated prompt templates that orchestrate multiple tools:

#### **Memory Workflows**
1. **`semem-research-analysis`** - Analyze research documents with semantic context
2. **`semem-memory-qa`** - Answer questions using semantic memory
3. **`semem-concept-exploration`** - Deep exploration of concept relationships

#### **Knowledge Graph Workflows**  
4. **`ragno-corpus-to-graph`** - Build knowledge graphs from text
5. **`ragno-entity-analysis`** - Analyze entities with contextual relationships

#### **3D Navigation Workflows**
6. **`zpt-navigate-explore`** - Interactive 3D knowledge space navigation

#### **Integrated Workflows**
7. **`semem-full-pipeline`** - Complete memory → graph → navigation pipeline
8. **`research-workflow`** - Academic research document processing

---

## Basic Memory Operations

### Storing Your First Memory

Let's start with basic memory operations. Use the `semem_store_interaction` tool:

```json
{
  "tool": "semem_store_interaction",
  "arguments": {
    "prompt": "What are the key principles of sustainable software development?",
    "response": "Sustainable software development focuses on: 1) Long-term maintainability through clean code practices, 2) Resource efficiency to minimize computational overhead, 3) Scalable architecture that grows with requirements, 4) Environmental consciousness in deployment choices, 5) Documentation and knowledge sharing for team continuity.",
    "metadata": {
      "topic": "software_engineering",
      "source": "expert_interview",
      "date": "2024-01-15"
    }
  }
}
```

**Expected Response:**
```json
{
  "success": true,
  "interactionId": "uuid-12345",
  "embedding": "[1536-dimensional vector]",
  "concepts": ["sustainable development", "software engineering", "maintainability"],
  "message": "Interaction stored successfully with embeddings and concepts"
}
```

### Retrieving Related Memories

Search for related memories using `semem_retrieve_memories`:

```json
{
  "tool": "semem_retrieve_memories",
  "arguments": {
    "query": "software maintainability practices",
    "threshold": 0.7,
    "limit": 5
  }
}
```

**Expected Response:**
```json
{
  "success": true,
  "memories": [
    {
      "id": "uuid-12345",
      "prompt": "What are the key principles of sustainable software development?",
      "response": "Sustainable software development focuses on...",
      "similarity": 0.89,
      "concepts": ["sustainable development", "software engineering"]
    }
  ],
  "count": 1
}
```

### Generating Context-Aware Responses

Use `semem_generate_response` for responses enriched with memory context:

```json
{
  "tool": "semem_generate_response",
  "arguments": {
    "prompt": "How can I improve the maintainability of legacy code?",
    "contextLimit": 3,
    "includeMemories": true
  }
}
```

This tool will:
1. Search your memory for relevant context
2. Assemble the most similar memories
3. Generate a response using both the prompt and retrieved context
4. Return a comprehensive, context-aware answer

---

## Knowledge Graph Construction

### Building Your First Knowledge Graph

Use Ragno tools to build structured knowledge graphs from text documents.

#### Step 1: Decompose Text into RDF Entities

```json
{
  "tool": "ragno_decompose_corpus",
  "arguments": {
    "textChunks": [
      {
        "content": "Apple Inc. is a multinational technology company founded by Steve Jobs, Steve Wozniak, and Ronald Wayne in 1976.",
        "source": "company_profile"
      },
      {
        "content": "The iPhone was first released in 2007 and revolutionized the smartphone industry with its touchscreen interface.",
        "source": "product_history"
      }
    ],
    "options": {
      "extractRelationships": true,
      "generateSummaries": true,
      "minEntityConfidence": 0.8
    }
  }
}
```

**Expected Response:**
```json
{
  "success": true,
  "entities": [
    {
      "uri": "http://example.org/entity/apple_inc",
      "name": "Apple Inc.",
      "type": "Organization",
      "confidence": 0.95,
      "mentions": 1
    },
    {
      "uri": "http://example.org/entity/steve_jobs",
      "name": "Steve Jobs",
      "type": "Person",
      "confidence": 0.92,
      "mentions": 1
    }
  ],
  "relationships": [
    {
      "subject": "http://example.org/entity/steve_jobs",
      "predicate": "founded",
      "object": "http://example.org/entity/apple_inc",
      "confidence": 0.88
    }
  ],
  "summary": "Knowledge graph created with 5 entities and 3 relationships"
}
```

#### Step 2: Query Your Knowledge Graph

Use `ragno_sparql_query` to explore the created graph:

```json
{
  "tool": "ragno_sparql_query",
  "arguments": {
    "query": "SELECT ?person ?company WHERE { ?person <founded> ?company . }",
    "options": {
      "limit": 10,
      "format": "json"
    }
  }
}
```

#### Step 3: Analyze Graph Structure

Get comprehensive analytics with `ragno_analyze_graph`:

```json
{
  "tool": "ragno_analyze_graph",
  "arguments": {
    "analysisTypes": ["statistics", "centrality", "communities"],
    "options": {
      "topK": 10,
      "includeDetails": true
    }
  }
}
```

This provides insights into:
- **Graph statistics**: Node/edge counts, density, clustering
- **Centrality analysis**: Most important entities
- **Community detection**: Natural groupings in your data

---

## Advanced Workflow Orchestration

### Using Pre-Built Prompt Workflows

The most powerful feature of Semem is its workflow orchestration through prompt templates.

#### Discovering Available Workflows

```json
{
  "tool": "prompt_list",
  "arguments": {
    "category": "memory"
  }
}
```

**Response shows all available workflow templates grouped by category.**

#### Example 1: Research Document Analysis

The `semem-research-analysis` workflow provides comprehensive document analysis:

```json
{
  "tool": "prompt_execute",
  "arguments": {
    "name": "semem-research-analysis",
    "arguments": {
      "document_text": "Machine learning has revolutionized artificial intelligence through deep learning architectures. Transformer models, introduced in 'Attention Is All You Need', have become the foundation for modern language models like GPT and BERT. These models demonstrate remarkable capabilities in natural language understanding and generation.",
      "analysis_depth": "deep",
      "context_threshold": 0.8
    }
  }
}
```

**This workflow automatically:**
1. **Stores** the document in semantic memory
2. **Extracts** key concepts and entities
3. **Retrieves** related documents from memory
4. **Analyzes** relationships and connections
5. **Generates** comprehensive insights

**Expected Response:**
```json
{
  "success": true,
  "promptName": "semem-research-analysis",
  "executionId": "exec-789",
  "steps": 4,
  "results": [
    {
      "tool": "semem_store_interaction",
      "result": true,
      "output": "Document stored with ID: doc-456"
    },
    {
      "tool": "semem_extract_concepts",
      "result": true,
      "output": "Extracted 8 concepts including 'machine learning', 'transformers'"
    }
  ],
  "summary": {
    "keyInsights": "Document focuses on transformer architectures...",
    "relatedDocuments": 3,
    "conceptsExtracted": 8,
    "executionTime": "2.3s"
  }
}
```

#### Example 2: Knowledge Graph from Text Corpus

The `ragno-corpus-to-graph` workflow builds complete knowledge graphs:

```json
{
  "tool": "prompt_execute",
  "arguments": {
    "name": "ragno-corpus-to-graph",
    "arguments": {
      "corpus_chunks": [
        "Tesla Inc. is an electric vehicle and clean energy company founded by Elon Musk.",
        "The Model S was Tesla's first mass-produced electric sedan, launched in 2012.",
        "SpaceX, also founded by Elon Musk, focuses on space exploration and satellite internet."
      ],
      "entity_confidence": 0.8,
      "extract_relationships": true
    }
  }
}
```

**This workflow:**
1. **Processes** each text chunk
2. **Extracts** entities and relationships
3. **Builds** RDF knowledge graph
4. **Validates** entity confidence scores
5. **Exports** in multiple formats

#### Example 3: Complete Research Pipeline

The most comprehensive workflow combines all systems:

```json
{
  "tool": "prompt_execute",
  "arguments": {
    "name": "research-workflow",
    "arguments": {
      "research_documents": [
        "Quantum computing leverages quantum mechanical phenomena to solve complex problems...",
        "Recent advances in quantum algorithms show promise for cryptography and optimization..."
      ],
      "domain_focus": "quantum_computing",
      "analysis_goals": ["concept_extraction", "relationship_mapping", "trend_analysis"]
    }
  }
}
```

**This orchestrates:**
- **Memory storage** and retrieval across documents
- **Knowledge graph** construction with entity relationships  
- **3D navigation** for spatial analysis
- **Integrated insights** combining all perspectives

---

## 3D Navigation and Analysis

### Understanding ZPT (Zoom, Pan, Tilt)

ZPT provides a cinematic approach to knowledge navigation, treating content as a 3D space you can explore.

#### Basic Content Selection

```json
{
  "tool": "zpt_select_corpuscles",
  "arguments": {
    "zoom": "entity",
    "tilt": "embedding", 
    "selectionType": "embedding",
    "criteria": {
      "query": "artificial intelligence applications",
      "threshold": 0.75
    },
    "limit": 20
  }
}
```

**Parameters Explained:**
- **Zoom**: Level of detail (`document`, `paragraph`, `sentence`, `entity`)
- **Tilt**: Perspective (`temporal`, `spatial`, `embedding`, `frequency`)
- **Selection**: How to choose content (`keyword`, `embedding`, `graph`, `hybrid`)

#### Advanced Content Chunking

```json
{
  "tool": "zpt_chunk_content",
  "arguments": {
    "content": "Large document text here...",
    "chunkingStrategy": "semantic",
    "chunkSize": 500,
    "overlap": 50,
    "preserveStructure": true
  }
}
```

#### Interactive Navigation Workflow

Use the `zpt-navigate-explore` prompt for guided 3D exploration:

```json
{
  "tool": "prompt_execute",
  "arguments": {
    "name": "zpt-navigate-explore",
    "arguments": {
      "query": "blockchain technology applications",
      "zoom_level": 5,
      "tilt_style": "auto",
      "filters": {
        "type": "concept",
        "relevance": 0.7,
        "timeframe": "recent"
      }
    }
  }
}
```

---

## Integrated Multi-System Workflows

### The Power of Integration

Semem's strength lies in combining memory, knowledge graphs, and navigation into unified workflows.

#### Full Pipeline Workflow

The `semem-full-pipeline` prompt demonstrates complete integration:

```json
{
  "tool": "prompt_execute",
  "arguments": {
    "name": "semem-full-pipeline",
    "arguments": {
      "input_data": "Artificial intelligence is transforming healthcare through predictive analytics, diagnostic assistance, and personalized treatment recommendations. Machine learning algorithms can analyze medical images, predict patient outcomes, and optimize treatment protocols.",
      "pipeline_stages": ["memory", "graph", "navigation"],
      "output_formats": ["json", "rdf", "summary"]
    }
  }
}
```

**This comprehensive workflow:**

1. **Memory Stage:**
   - Stores text in semantic memory
   - Generates embeddings
   - Extracts concepts

2. **Graph Stage:**
   - Creates RDF entities (AI, healthcare, machine learning)
   - Builds relationships (AI → transforms → healthcare)
   - Validates entity confidence

3. **Navigation Stage:**
   - Applies ZPT analysis
   - Creates spatial representations
   - Enables 3D exploration

4. **Integration:**
   - Links memory embeddings to graph entities
   - Provides multi-perspective analysis
   - Generates comprehensive insights

### Custom Workflow Combinations

You can chain individual tools to create custom workflows:

```json
// Step 1: Store research document
{
  "tool": "semem_store_interaction",
  "arguments": {
    "prompt": "Research question about climate change",
    "response": "Detailed climate research findings..."
  }
}

// Step 2: Build knowledge graph from same content
{
  "tool": "ragno_decompose_corpus", 
  "arguments": {
    "textChunks": [{"content": "Detailed climate research findings..."}]
  }
}

// Step 3: Navigate and explore relationships
{
  "tool": "zpt_select_corpuscles",
  "arguments": {
    "zoom": "entity",
    "criteria": {"query": "climate change impacts"}
  }
}

// Step 4: Generate insights combining all perspectives
{
  "tool": "semem_generate_response",
  "arguments": {
    "prompt": "What are the key insights from this climate research?",
    "includeMemories": true,
    "contextLimit": 5
  }
}
```

---

## Real-World Use Cases

### Use Case 1: Academic Research Assistant

**Scenario**: A researcher analyzing papers about renewable energy technologies.

**Workflow**:
```json
{
  "tool": "prompt_execute",
  "arguments": {
    "name": "research-workflow",
    "arguments": {
      "research_documents": [
        "Solar panel efficiency has improved significantly with perovskite technologies...",
        "Wind energy storage solutions using advanced battery systems...",
        "Hydroelectric power integration with smart grid technologies..."
      ],
      "domain_focus": "renewable_energy",
      "analysis_goals": ["technology_trends", "efficiency_metrics", "integration_challenges"]
    }
  }
}
```

**Benefits**:
- Automatically extracts key technologies and concepts
- Builds knowledge graph of relationships between technologies
- Identifies research trends and gaps
- Provides comprehensive literature analysis

### Use Case 2: Corporate Knowledge Management

**Scenario**: A company wants to make internal documentation searchable and connected.

**Setup Process**:

1. **Batch Upload Documents**:
```json
{
  "tool": "ragno_decompose_corpus",
  "arguments": {
    "textChunks": [
      {"content": "Product roadmap Q1 2024...", "source": "product_team"},
      {"content": "Security protocols and procedures...", "source": "security_team"},
      {"content": "Customer support best practices...", "source": "support_team"}
    ],
    "options": {
      "extractRelationships": true,
      "generateSummaries": true
    }
  }
}
```

2. **Enable Semantic Search**:
```json
{
  "tool": "semem_retrieve_memories",
  "arguments": {
    "query": "security authentication procedures",
    "threshold": 0.7,
    "limit": 10
  }
}
```

3. **Navigate Information Spaces**:
```json
{
  "tool": "prompt_execute",
  "arguments": {
    "name": "zpt-navigate-explore",
    "arguments": {
      "query": "customer support escalation",
      "filters": {"department": "support", "priority": "high"}
    }
  }
}
```

### Use Case 3: Educational Content Analysis

**Scenario**: An educator analyzing curriculum relationships and student learning paths.

**Implementation**:
```json
{
  "tool": "prompt_execute",
  "arguments": {
    "name": "semem-concept-exploration",
    "arguments": {
      "concept": "machine learning fundamentals",
      "exploration_depth": 3,
      "include_relationships": true
    }
  }
}
```

**Results**:
- Maps prerequisite relationships between concepts
- Identifies learning progression pathways
- Suggests related topics and extensions
- Provides adaptive learning recommendations

### Use Case 4: Legal Document Analysis

**Scenario**: Law firm analyzing case precedents and legal relationships.

**Approach**:
```json
{
  "tool": "prompt_execute",
  "arguments": {
    "name": "semem-full-pipeline",
    "arguments": {
      "input_data": "Supreme Court ruling on privacy rights in digital communications...",
      "pipeline_stages": ["memory", "graph"],
      "output_formats": ["json", "legal_summary"]
    }
  }
}
```

**Capabilities**:
- Extracts legal entities (cases, statutes, precedents)
- Maps citation relationships
- Identifies legal principle connections
- Enables precedent research and analysis

---

## Troubleshooting

### Common Connection Issues

#### Problem: MCP Server Won't Start

**Symptoms**: Server fails to initialize or exits immediately

**Solutions**:
1. Check Node.js version: `node --version` (requires 20.11.0+)
2. Verify Ollama is running: `ollama list`
3. Check configuration: Ensure `config/config.json` is valid
4. Review logs: Look for specific error messages

```bash
# Debug mode
LOG_LEVEL=debug node mcp/index.js
```

#### Problem: Client Can't Connect

**Symptoms**: MCP client shows "Connection failed" or timeout errors

**Solutions**:
1. Verify server is running: Should show "✅ Semem MCP server running"
2. Check file paths in client configuration
3. Ensure proper permissions on script files
4. Try alternative transport (HTTP instead of stdio)

#### Problem: Tools Not Appearing

**Symptoms**: Connected but no tools visible in client

**Solutions**:
1. Restart Claude Desktop completely
2. Verify MCP configuration syntax
3. Check server logs for tool registration errors
4. Test with simple tool call to verify connection

### Performance Issues

#### Problem: Slow Response Times

**Symptoms**: Tools take longer than 30 seconds to respond

**Solutions**:
1. **Reduce embedding dimensions**: Use smaller models
2. **Limit context size**: Reduce `contextLimit` in queries
3. **Optimize SPARQL queries**: Add LIMIT clauses
4. **Use local models**: Prefer Ollama over API calls

```json
{
  "tool": "semem_retrieve_memories",
  "arguments": {
    "query": "your search",
    "limit": 5,        // Reduced from default 10
    "threshold": 0.8   // Higher threshold = fewer results
  }
}
```

#### Problem: Memory Usage Growing

**Symptoms**: Server memory usage increases over time

**Solutions**:
1. **Clear cache periodically**: Restart server regularly
2. **Use smaller chunk sizes**: Reduce document size limits
3. **Configure garbage collection**: Set Node.js flags

```bash
# Start with memory optimization
node --max-old-space-size=4096 mcp/index.js
```

### Tool-Specific Issues

#### Problem: Knowledge Graph Construction Fails

**Symptoms**: `ragno_decompose_corpus` returns empty results

**Solutions**:
1. **Check entity confidence**: Lower `minEntityConfidence` threshold
2. **Verify text quality**: Ensure meaningful content
3. **Adjust chunk size**: Text might be too small/large

```json
{
  "tool": "ragno_decompose_corpus",
  "arguments": {
    "textChunks": [...],
    "options": {
      "minEntityConfidence": 0.5,  // Lowered from 0.8
      "maxEntitiesPerUnit": 30     // Increased limit
    }
  }
}
```

#### Problem: Prompt Workflows Fail Partially

**Symptoms**: Workflow completes some steps but fails others

**Check the response for**:
- `partialCompletion: true` indicates some steps succeeded
- `results` array shows which steps failed
- Error messages in individual step results

**Recovery strategies**:
1. **Retry with adjusted parameters**
2. **Execute individual tools** to isolate issues
3. **Check prerequisites** (models, endpoints)

### Debug Tools and Resources

#### System Status Check

```json
{
  "tool": "semem_get_status",
  "arguments": {}
}
```

This provides comprehensive system information:
- Memory manager status
- Model availability
- Storage backend health
- Performance metrics

#### Configuration Verification

```json
{
  "tool": "semem_get_config",
  "arguments": {}
}
```

Shows current configuration including:
- Storage settings
- Model endpoints
- Feature flags
- Performance tuning

---

## Advanced Configuration

### Custom Storage Backends

#### JSON Storage (Simple)

```json
{
  "storage": {
    "type": "json",
    "options": {
      "filePath": "./data/my_memories.json",
      "autoSave": true,
      "backupInterval": 3600
    }
  }
}
```

#### SPARQL Storage (Advanced)

```json
{
  "storage": {
    "type": "sparql",
    "options": {
      "endpoint": "http://localhost:3030/dataset/query",
      "graphName": "http://my-domain.org/knowledge",
      "user": "admin",
      "password": "secure_password",
      "timeout": 10000
    }
  }
}
```

### LLM Provider Configuration

#### Multiple Providers Setup

```json
{
  "llmProviders": [
    {
      "type": "ollama",
      "baseUrl": "http://localhost:11434",
      "chatModel": "qwen2:1.5b",
      "embeddingModel": "nomic-embed-text",
      "priority": 1,
      "capabilities": ["chat", "embedding"]
    },
    {
      "type": "claude",
      "apiKey": "${CLAUDE_API_KEY}",
      "chatModel": "claude-3-sonnet-20240229",
      "priority": 2,
      "capabilities": ["chat"]
    }
  ]
}
```

### Performance Tuning

#### Memory Optimization

```json
{
  "memory": {
    "dimension": 1536,          // Embedding dimensions
    "similarityThreshold": 0.7, // Default similarity cutoff
    "contextWindow": 5,         // Number of context items
    "cacheSize": 1000,         // Maximum cached items
    "decayRate": 0.0001        // Memory importance decay
  }
}
```

#### ZPT Navigation Tuning

```json
{
  "zpt": {
    "defaultChunkSize": 500,
    "maxChunkOverlap": 50,
    "embeddingBatchSize": 32,
    "cacheEnabled": true,
    "parallelProcessing": true
  }
}
```

### Security Configuration

#### Access Control

```json
{
  "security": {
    "enableAuth": true,
    "allowedOrigins": ["http://localhost:3000"],
    "rateLimiting": {
      "enabled": true,
      "maxRequests": 100,
      "windowMs": 60000
    },
    "apiKeys": {
      "required": false,
      "keys": ["${API_KEY_1}", "${API_KEY_2}"]
    }
  }
}
```

#### Data Privacy

```json
{
  "privacy": {
    "anonymizePersonalData": true,
    "retentionPeriod": "365d",
    "encryptSensitiveData": true,
    "auditLogging": true
  }
}
```

---

## Getting Help and Support

### Documentation Resources

- **API Reference**: `/docs/api/` - Complete tool and resource documentation
- **Architecture Guide**: `/docs/architecture.md` - System design and components
- **Algorithm Documentation**: `/docs/ragno/` - Advanced algorithms and research

### Community and Support

- **GitHub Issues**: Report bugs and request features
- **Discussion Forums**: Community support and use cases
- **Example Repository**: Real-world implementation examples

### Contributing

Semem is open source and welcomes contributions:

1. **Bug Reports**: Clear reproduction steps and system information
2. **Feature Requests**: Use cases and implementation suggestions  
3. **Code Contributions**: Follow existing patterns and include tests
4. **Documentation**: Improve tutorials and API documentation

---

## Conclusion

This tutorial has covered the comprehensive capabilities of Semem's MCP integration, from basic memory operations to sophisticated multi-system workflows. The combination of semantic memory, knowledge graphs, and 3D navigation provides unprecedented flexibility for information processing and analysis.

### Key Takeaways

- **Start Simple**: Begin with basic memory operations before advancing to complex workflows
- **Use Prompt Templates**: Leverage pre-built workflows for common tasks
- **Combine Systems**: The real power comes from integrating memory, graphs, and navigation
- **Customize Configuration**: Adapt settings to your specific use case and performance requirements
- **Monitor Performance**: Use built-in tools to optimize and troubleshoot

### Next Steps

1. **Experiment** with the provided examples in your domain
2. **Build Custom Workflows** combining multiple tools
3. **Integrate** with your existing systems and data
4. **Contribute** improvements and new capabilities
5. **Share** your use cases with the community

Semem transforms individual AI tools into a comprehensive knowledge processing platform. Through MCP integration, these capabilities become accessible to any AI application, enabling new possibilities for intelligent information management and analysis.

---

*For the latest updates and additional resources, visit the [Semem documentation](../README.md) and [GitHub repository](https://github.com/danja/semem).*