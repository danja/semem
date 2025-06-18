# End-to-End Semem Demonstration

This directory contains a complete, working demonstration of Semem's semantic memory capabilities using a modular architecture. Each module can be run independently or as part of the complete workflow.

## ✅ **WORKING DEMONSTRATION**

The system demonstrates a complete semantic memory pipeline:

1. **Document Ingestion** → SPARQL triplestore
2. **Knowledge Graph Construction** → Entity extraction + embeddings 
3. **Semantic Search** → Cross-domain knowledge discovery

**Total execution time**: ~20 seconds for complete workflow

## 🚀 **Quick Start**

### Prerequisites
- Ollama running with `nomic-embed-text:latest` and `qwen2:1.5b` models
- SPARQL endpoint (Fuseki) configured in config
- Node.js 20.11.0+

### Run Complete Workflow
```bash
# Run all implemented modules (1-3)
node examples/end-to-end/Run.js

# Run specific module range
node examples/end-to-end/Run.js --steps 1-3

# Run individual module
node examples/end-to-end/Run.js --module search
```

### Run Individual Modules
```bash
# Test each module independently
node examples/end-to-end/Ingest.js
node examples/end-to-end/EnrichSimple.js  
node examples/end-to-end/Search.js
```

## 📊 **Results Demonstrated**

### Module 1: SPARQL Document Ingestion
- **Input**: 3 documents from `examples/data/` (2530 words)
- **Output**: Structured RDF data in SPARQL triplestore
- **Verification**: Query confirms all documents stored correctly

### Module 2: Knowledge Graph Construction  
- **Input**: Documents from SPARQL store
- **Process**: LLM-based entity extraction using Ollama
- **Output**: 9 entities with 1536D vector embeddings
- **Storage**: Entities stored as RDF with semantic metadata

### Module 3: Semantic Search & Cross-Domain Inference
- **Input**: 5 semantic search queries
- **Process**: Vector similarity search across documents and entities
- **Output**: Ranked results with similarity scores (avg: 0.611)
- **Discovery**: 1 cross-domain connection identified
- **Insights**: Demonstrates knowledge bridging between neuroscience, urban planning, and climate science

## 🏗️ **Architecture Benefits**

### Modular Design
- **Independent Testing**: Each module can be developed and tested separately
- **Robust Error Handling**: Failures isolated to specific modules
- **Flexible Execution**: Run complete workflow or individual components
- **Clear Dependencies**: Explicit dependency management and validation

### Real Operation Demonstration
- **No Mocks/Fallbacks**: Uses actual Ollama LLM and embedding services
- **Production-Ready Components**: SPARQLStore, EmbeddingHandler, real vector operations
- **Scalable Patterns**: Modular approach supports easy extension

### Performance Optimized
- **Fast Execution**: Simplified for speed while maintaining functionality
- **Timeout Protection**: Prevents hanging operations
- **Efficient Chunking**: Optimized text processing for quick turnaround

## 📁 **File Structure**

```
examples/end-to-end/
├── README.md                  # This file
├── WORKFLOW.md               # Detailed implementation plan
├── Run.js                    # Workflow orchestrator  
├── Ingest.js                 # Module 1: Document ingestion
├── EnrichSimple.js           # Module 2: Entity extraction
└── Search.js                 # Module 3: Semantic search
```

## 🎯 **Next Steps**

The core semantic memory pipeline (Modules 1-3) is complete and working. Phase 2 development focuses on:

- **Module 4**: Advanced SPARQL queries and reasoning
- **Module 5**: Graph analytics and community detection  
- **Module 6**: Personalized PageRank analysis

## 🔧 **Configuration**

The system uses the standard Semem configuration from `config/config.json` with:
- SPARQL endpoint settings
- Ollama service configuration  
- Embedding model specifications
- Graph URIs and authentication

See the main Semem documentation for configuration details.