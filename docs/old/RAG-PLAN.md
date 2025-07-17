# Claude : RAG Implementation Plan

*Generated: 2025-01-09*

## Overview

This document outlines the implementation plan for a naive Retrieval Augmented Generation (RAG) system within the semem ecosystem. The RAG system will demonstrate how to combine semantic search capabilities with large language models to provide contextually enhanced responses.

## System Architecture

### Components

1. **Configuration System**
   - Uses existing `config/config.json` and `.env` files
   - Priority-based provider selection for LLM and embedding services
   - SPARQL endpoint configuration with authentication

2. **Data Layer**
   - SPARQL store containing document chunks with embeddings
   - Leverages existing document processing pipeline
   - Uses ragno ontology for RDF data structure

3. **Search Layer**
   - FAISS index for vector similarity search
   - Embedding generation for query text
   - Cosine similarity ranking of document chunks

4. **Generation Layer**
   - LLM handler with configured provider (Mistral/Claude/Ollama)
   - Context augmentation with retrieved chunks
   - Response generation with enhanced context

## Implementation Steps

### Phase 1: Foundation Setup
- ✅ Load configuration from `config/config.json`
- ✅ Initialize SPARQL connection using existing service layer
- ✅ Set up embedding provider using priority-based selection
- ✅ Initialize LLM handler with configured provider

### Phase 2: Data Loading
- ✅ Query SPARQL store for document chunks with embeddings
- ✅ Parse and validate embedding vectors
- ✅ Build FAISS index for similarity search
- ✅ Create mapping between index positions and document URIs

### Phase 3: Query Processing
- ✅ Accept user question via command line
- ✅ Generate embedding for question using configured provider
- ✅ Perform FAISS similarity search
- ✅ Retrieve top 3 most similar chunks

### Phase 4: Response Generation
- ✅ Format question with retrieved context
- ✅ Create enhanced prompt for LLM
- ✅ Generate response using LLM handler
- ✅ Return final augmented response

## Technical Details

### Data Flow
1. User provides question
2. Question → Embedding (via configured provider)
3. Embedding → FAISS search → Top 3 similar chunks
4. Question + Chunks → Enhanced prompt
5. Enhanced prompt → LLM → Final response

### Key Libraries
- `faiss-node` - Vector similarity search
- `Config.js` - Configuration management
- `SPARQLHelper.js` - SPARQL query execution
- `EmbeddingConnectorFactory.js` - Embedding provider abstraction
- `LLMHandler.js` - LLM interaction

### Configuration Requirements
- SPARQL endpoint (Fuseki) with document chunks
- Embedding provider (Ollama/Nomic) with API keys
- LLM provider (Mistral/Claude/Ollama) with API keys
- Graph URI containing processed document chunks

## Expected Data Structure

### SPARQL Store Requirements
```turtle
# Document chunks with embeddings
<http://purl.org/stuff/instance/chunk-123> a ragno:TextElement ;
    ragno:content "Document chunk content..." ;
    ragno:embedding "[0.1234, -0.5678, 0.9012, ...]" ;
    dcterms:extent 450 ;
    prov:wasDerivedFrom <http://purl.org/stuff/instance/text-source> .
```

### FAISS Index Structure
- Dimension: 1536 (nomic-embed-text) or configured dimension
- Index Type: IndexFlatIP (Inner Product similarity)
- Mapping: Index position → Document URI

## Usage Examples

### Basic Usage
```bash
node examples/document/RAG.js "What is machine learning?"
```

### With Custom Graph
```bash
node examples/document/RAG.js "How does beer brewing work?" --graph http://purl.org/stuff/beerqa
```

### Interactive Mode
```bash
node examples/document/RAG.js --interactive
```

## Prerequisites

1. **Document Processing Pipeline**
   - Run `LoadPDFs.js` to load documents
   - Run `ChunkDocuments.js` to create chunks
   - Run `MakeEmbeddings.js` to generate embeddings

2. **Configuration**
   - Valid `config/config.json` with SPARQL and provider settings
   - API keys in `.env` file for cloud providers
   - Running SPARQL endpoint (Fuseki) with document data

3. **Services**
   - Ollama running locally (fallback provider)
   - SPARQL endpoint accessible and authenticated

## Error Handling

- Graceful fallback to Ollama when cloud providers fail
- Validation of embedding dimensions and FAISS index compatibility
- SPARQL query error handling with informative messages
- Empty result handling when no similar chunks found

## Success Metrics

- Successfully loads configuration without hardcoding
- Builds FAISS index from SPARQL store data
- Performs semantic search on user questions
- Generates contextually relevant responses
- Handles provider failures gracefully
- Integrates seamlessly with existing document pipeline

## Future Enhancements

1. **Query Expansion**: Use LLM to expand queries before search
2. **Reranking**: Post-process search results for better relevance
3. **Context Optimization**: Smart context window management
4. **Caching**: Cache embeddings and search results
5. **Evaluation**: Metrics for retrieval and generation quality

This implementation serves as a foundation for more sophisticated RAG systems within the semem ecosystem while maintaining compatibility with existing infrastructure and configuration patterns.