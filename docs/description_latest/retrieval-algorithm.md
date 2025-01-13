# Memory Retrieval Algorithm

The retrieval system uses a sophisticated multi-stage approach:

1. **Vector Similarity**
   - Generates embedding for query
   - Performs cosine similarity comparison
   - Applies decay factor based on time
   - Considers access count reinforcement

2. **Concept Matching**
   - Extracts concepts from query
   - Activates related concepts in graph
   - Uses spreading activation for concept relationships
   - Combines with vector similarity scores

3. **Semantic Clustering**
   - Groups related memories
   - Maintains cluster centroids
   - Updates clusters dynamically
   - Provides fallback recommendations

4. **Context Building**
   - Selects most relevant memories
   - Manages context window size
   - Handles content overlap
   - Builds coherent context for LLM

The final relevance score is calculated as:
```
relevance = (similarity * decay * reinforcement) + conceptScore
```

Where:
- similarity: cosine similarity between embeddings
- decay: exponential decay based on time
- reinforcement: logarithmic function of access count
- conceptScore: spreading activation score from concept graph