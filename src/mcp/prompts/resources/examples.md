# Semem MCP Prompts - Usage Examples

## Basic Examples

### 1. Research Document Analysis

Analyze a research paper and get insights with context from your memory:

```json
{
  "method": "prompts/execute",
  "params": {
    "name": "semem-research-analysis",
    "arguments": {
      "document_text": "Machine learning has evolved significantly in recent years, with deep learning techniques showing remarkable success in natural language processing tasks. The transformer architecture, introduced in 'Attention Is All You Need', has become the foundation for modern language models like GPT and BERT.",
      "analysis_depth": "deep",
      "context_threshold": 0.8
    }
  }
}
```

**Expected workflow**:
1. Store the document text in semantic memory
2. Extract key concepts (machine learning, deep learning, transformers, etc.)
3. Retrieve similar content from existing memory
4. Generate insights connecting new content with stored knowledge

### 2. Memory-Based Q&A

Ask questions using your accumulated semantic memory:

```json
{
  "method": "prompts/execute",
  "params": {
    "name": "semem-memory-qa",
    "arguments": {
      "question": "What are the main advantages of transformer architectures over RNNs?",
      "context_limit": 8,
      "similarity_threshold": 0.7
    }
  }
}
```

**Expected workflow**:
1. Generate embedding for the question
2. Search semantic memory for relevant content
3. Assemble context from retrieved memories
4. Generate a comprehensive answer

### 3. Knowledge Graph Construction

Build a knowledge graph from a collection of documents:

```json
{
  "method": "prompts/execute",
  "params": {
    "name": "ragno-corpus-to-graph",
    "arguments": {
      "corpus_chunks": [
        "Apple Inc. is a technology company founded by Steve Jobs, Steve Wozniak, and Ronald Wayne in 1976.",
        "The iPhone was first released in 2007 and revolutionized the smartphone industry.",
        "Tim Cook became CEO of Apple in 2011, succeeding Steve Jobs."
      ],
      "entity_confidence": 0.8,
      "extract_relationships": true
    }
  }
}
```

**Expected workflow**:
1. Decompose text into semantic units
2. Extract entities (Apple Inc., Steve Jobs, iPhone, etc.)
3. Build relationships (founded_by, succeeded_by, released_in)
4. Export as RDF knowledge graph

## Advanced Examples

### 4. Complete Research Pipeline

Process research documents through the full Semem pipeline:

```json
{
  "method": "prompts/execute",
  "params": {
    "name": "research-workflow",
    "arguments": {
      "research_documents": [
        "Neural networks are computational models inspired by biological neural networks...",
        "Convolutional neural networks excel at image recognition tasks...",
        "Recurrent neural networks are designed for sequential data..."
      ],
      "domain_focus": "machine_learning",
      "analysis_goals": ["concept_extraction", "relationship_mapping", "trend_analysis"]
    }
  }
}
```

**Expected workflow**:
1. Ingest all research documents
2. Extract key concepts from each document
3. Build knowledge graph connecting concepts
4. Generate insights about trends and relationships

### 5. Full Pipeline with Custom Stages

Run only specific stages of the full pipeline:

```json
{
  "method": "prompts/execute",
  "params": {
    "name": "semem-full-pipeline",
    "arguments": {
      "input_data": "Quantum computing leverages quantum mechanical phenomena to process information in fundamentally different ways than classical computers.",
      "pipeline_stages": ["memory", "graph"],
      "output_formats": ["json", "rdf", "summary"]
    }
  }
}
```

**Expected workflow**:
1. Store in semantic memory (memory stage)
2. Build knowledge graph (graph stage)
3. Skip 3D navigation (not in pipeline_stages)
4. Return results in multiple formats

### 6. Entity Analysis with Context

Deep dive into a specific entity:

```json
{
  "method": "prompts/execute",
  "params": {
    "name": "ragno-entity-analysis",
    "arguments": {
      "entity_name": "transformer architecture",
      "context_radius": 3,
      "include_embeddings": true
    }
  }
}
```

**Expected workflow**:
1. Find the "transformer architecture" entity
2. Discover relationships within 3 hops
3. Enrich with contextual information
4. Include vector embeddings for similarity analysis

## Real-World Use Cases

### Use Case 1: Academic Literature Review

**Scenario**: A researcher wants to analyze a collection of papers about renewable energy.

```json
{
  "method": "prompts/execute",
  "params": {
    "name": "research-workflow",
    "arguments": {
      "research_documents": [
        "Solar energy conversion efficiency has improved dramatically...",
        "Wind turbine technology advances focus on offshore installations...",
        "Battery storage solutions are crucial for renewable energy adoption..."
      ],
      "domain_focus": "renewable_energy",
      "analysis_goals": ["technology_trends", "efficiency_metrics", "adoption_barriers"]
    }
  }
}
```

### Use Case 2: Corporate Knowledge Management

**Scenario**: A company wants to make their internal documentation searchable and connected.

```json
{
  "method": "prompts/execute",
  "params": {
    "name": "semem-full-pipeline",
    "arguments": {
      "input_data": "Our product roadmap for Q1 includes three major features: enhanced security protocols, improved user interface, and mobile app optimization. The security protocols will implement OAuth 2.0 and multi-factor authentication.",
      "pipeline_stages": ["memory", "graph", "navigation"],
      "output_formats": ["json", "searchable_index"]
    }
  }
}
```

### Use Case 3: Educational Content Analysis

**Scenario**: An educator wants to understand concept relationships in their curriculum.

```json
{
  "method": "prompts/execute",
  "params": {
    "name": "semem-concept-exploration",
    "arguments": {
      "concept": "machine learning algorithms",
      "exploration_depth": 4,
      "include_relationships": true
    }
  }
}
```

## Error Handling Examples

### Handling Missing Arguments

```json
{
  "method": "prompts/execute",
  "params": {
    "name": "semem-memory-qa"
    // Missing required "question" argument
  }
}
```

**Expected response**:
```json
{
  "success": false,
  "error": "Argument validation failed: Required argument 'question' is missing",
  "promptName": "semem-memory-qa"
}
```

### Handling Invalid Prompt Names

```json
{
  "method": "prompts/execute",
  "params": {
    "name": "nonexistent-prompt",
    "arguments": {}
  }
}
```

**Expected response**:
```json
{
  "success": false,
  "error": "Prompt not found: nonexistent-prompt"
}
```

## Performance Optimization Examples

### Optimizing Memory Retrieval

```json
{
  "method": "prompts/execute",
  "params": {
    "name": "semem-memory-qa",
    "arguments": {
      "question": "What is deep learning?",
      "context_limit": 3,           // Reduce for faster response
      "similarity_threshold": 0.8   // Increase for more relevant results
    }
  }
}
```

### Optimizing Graph Construction

```json
{
  "method": "prompts/execute",
  "params": {
    "name": "ragno-corpus-to-graph",
    "arguments": {
      "corpus_chunks": ["..."],
      "entity_confidence": 0.9,     // Higher confidence = fewer, more certain entities
      "extract_relationships": false // Skip relationships for faster processing
    }
  }
}
```

## Integration Examples

### Chaining Prompts

Execute multiple prompts in sequence for complex workflows:

1. **First**: Build knowledge graph from documents
2. **Second**: Analyze specific entities from the graph
3. **Third**: Ask questions using the enriched memory

```json
// Step 1: Build graph
{
  "method": "prompts/execute",
  "params": {
    "name": "ragno-corpus-to-graph",
    "arguments": {
      "corpus_chunks": ["document1", "document2", "document3"]
    }
  }
}

// Step 2: Analyze key entity
{
  "method": "prompts/execute",
  "params": {
    "name": "ragno-entity-analysis",
    "arguments": {
      "entity_name": "extracted_key_entity"
    }
  }
}

// Step 3: Ask questions
{
  "method": "prompts/execute",
  "params": {
    "name": "semem-memory-qa",
    "arguments": {
      "question": "How does this entity relate to other concepts?"
    }
  }
}
```

---

These examples demonstrate the flexibility and power of the Semem MCP prompt system. Start with basic examples and gradually explore more complex workflows as you become familiar with the system.