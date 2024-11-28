# Memory System Documentation

## MemoryStore (memoryStore.js)
Core memory management implementation handling storage, retrieval, and processing of memories.

### Key Components
- FAISS index for similarity search
- Graph-based concept relationships
- Clustering mechanism
- Decay/reinforcement system

### Features
- Vector similarity search
- Hierarchical memory clustering
- Spreading activation
- Memory lifecycle management

### Implementation Details
- Uses Float32Array for embeddings
- Implements k-means clustering
- Manages memory transitions
- Handles concept graph updates

## MemoryManager (memoryManager.js)
High-level interface coordinating all memory operations.

### Key Features
- LLM integration (OpenAI/Ollama)
- Embedding generation
- Concept extraction
- Response generation

### Implementation Details
- Model initialization and management
- Embedding standardization
- Context building
- Storage coordination

### Usage Patterns
- Interactive response generation
- Memory persistence
- Concept management
- Configuration handling
