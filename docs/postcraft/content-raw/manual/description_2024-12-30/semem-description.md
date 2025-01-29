# Current Semem Capabilities

Semem is a semantic memory system that currently provides:

1. **Memory Management**
   - Vector embeddings generation via Ollama (nomic-embed-text model)
   - Concept extraction from text
   - Similarity-based memory retrieval
   - Short-term and long-term memory segregation

2. **Storage Options**
   - In-memory storage
   - JSON file persistence
   - SPARQL endpoint integration
   - Caching layer for SPARQL operations

3. **LLM Integration**
   - Ollama API support for chat and embeddings
   - Configurable model selection
   - Context window management
   - Prompt templating system

4. **Data Structures**
   - Interaction storage with embeddings
   - Concept mapping
   - Decay factors for memory relevance
   - Transaction support for SPARQL operations

The system can currently:
- Generate embeddings for text input
- Store and retrieve memories with vector similarity
- Handle conversation context
- Persist data across multiple storage backends
- Integrate with SPARQL endpoints for semantic data storage

Key limitations:
- SPARQL integration needs authentication fixes
- Vector similarity search needs Faiss implementation completion
- Limited to basic interaction patterns
- No visualization components yet
