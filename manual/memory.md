# Memory Management in Semem

## Overview

Semem's memory system provides persistent, context-aware conversation memory that grows more useful over time. Unlike traditional chatbots that forget previous conversations, Semem maintains a continuous memory across sessions, storing conversations, documents, and extracted concepts in a queryable knowledge graph.

The memory system uses vector embeddings for semantic similarity and the ZPT (Zoom-Pan-Tilt) navigation paradigm to surface relevant context based on your current perspective and focus.

## Core Concepts

### Persistent Memory
All interactions are stored permanently in the knowledge graph. "Forgetting" happens through navigation away from irrelevant content, not deletion. This means you can always recover previous context by adjusting your navigation parameters.

### Contextual Relevance
The system calculates relevance scores for memories based on:
- **Semantic similarity** to your current query
- **Temporal factors** (recent conversations weighted higher)
- **Domain matching** (project-specific, personal, etc.)
- **Explicit importance** (user-marked important memories)

### ZPT Navigation
Memory retrieval is controlled through the ZPT paradigm:
- **Zoom**: Controls abstraction level (individual concepts → full conversations → topic communities)
- **Pan**: Filters by domain (personal, project-specific, temporal ranges)
- **Tilt**: Changes view style (keywords, embeddings, relationships, temporal)

## Using Memory in the Workbench

### Asking Questions

The primary way to access your memory is through the **Ask** section:

1. **Enter your question** in the Question field
2. **Choose processing mode**:
   - **Basic**: Quick search with minimal processing
   - **Standard**: Balanced approach with context integration (recommended)
   - **Comprehensive**: Deep analysis with maximum context
3. **Enable "Use Context"** (checked by default) to include memory context
4. **Optional enhancements**:
   - **HyDE**: Uses hypothetical document embeddings for better retrieval
   - **Wikipedia**: Integrates Wikipedia knowledge
   - **Wikidata**: Adds structured knowledge from Wikidata
5. **Click "Search Memory"**

Example queries that work well with memory:
- "What did we discuss about ADHD last week?"
- "Show me our previous conversations about machine learning"
- "What were the main points from the research papers I shared?"
- "Summarize our project decisions from the last month"

### Storing Information

Use the **Tell** section to explicitly store important information:

1. **Enter content** in the Content field
2. **Select type**:
   - **Concept**: For storing ideas, definitions, or insights
   - **Interaction**: For conversation summaries or Q&A pairs
   - **Document**: For longer text content or external documents
3. **Add tags** (optional) to help with organization and retrieval
4. **Enable "Lazy Storage"** if you want to store without immediate concept extraction
5. **Click "Store Memory"**

### Navigation Controls

Use the **Navigate** section to control which memories are visible:

#### Zoom (Abstraction Level)
- **Entity**: Individual concepts and facts
- **Unit**: Semantic chunks and conversation segments
- **Text**: Full documents and long conversations
- **Community**: Topic clusters and related concept groups
- **Corpus**: Entire knowledge base view

#### Pan (Domain Filters)
- **Domains**: Filter by specific areas (e.g., "project:research", "personal")
- **Keywords**: Filter by specific terms or topics

#### Tilt (View Style)
- **Keywords**: Text-based summaries and keyword extraction
- **Embedding**: Vector similarity-based retrieval
- **Graph**: Relationship-based navigation
- **Temporal**: Time-based organization
- **Memory**: Optimized for conversational context

### Memory Inspection

The **Inspect** section provides tools for understanding your memory:

- **Session Info**: Current session statistics and state
- **Concepts**: Browse extracted concepts and their relationships
- **All Data**: Overview of entire knowledge base

## Advanced Features

### Document Augmentation

The **Augment** section includes a "Chunk Documents" operation that processes stored documents into searchable semantic chunks:

1. **Select "Chunk Documents"** from the Operation dropdown
2. **Adjust chunking parameters**:
   - **Max/Min Chunk Size**: Control chunk granularity
   - **Overlap Size**: Amount of text shared between chunks
   - **Strategy**: Semantic (context-aware) or Fixed (size-based)
   - **Min Content Length**: Minimum document size to process
3. **Click "Analyze"** to process documents in your knowledge base

### Cross-Session Memory

Your memory persists across browser sessions and system restarts. When you return to the workbench:

1. **Previous conversations** are automatically available
2. **Stored documents** remain accessible
3. **Extracted concepts** continue to inform new queries
4. **Navigation settings** can be restored or adjusted

## Memory Organization Strategies

### Project-Based Organization

Use domain filtering to organize memories by project:

```
Pan Domains: project:research
Pan Keywords: machine-learning, neural-networks
```

This focuses memory on your research project while filtering out personal or other project memories.

### Temporal Navigation

Access memories from specific time periods:

```
Pan: Set temporal filters for "last month" or "2024-Q1"
Zoom: Community level for topic summaries
Tilt: Temporal view for chronological organization
```

### Topic Exploration

Discover connections across your knowledge:

```
Zoom: Entity level for concept relationships
Pan: Broad keyword filters like "creativity, cognition"
Tilt: Graph view to see relationship networks
```

## Best Practices

### Effective Questioning
- **Be specific**: "What were the key findings about ADHD treatment efficacy?" vs. "Tell me about ADHD"
- **Reference context**: "Based on our previous discussion about neural attention..."
- **Use temporal context**: "What did I learn about this topic last week?"

### Strategic Storage
- **Store decisions**: Important conclusions, choices made, rationale
- **Store insights**: Novel connections, realizations, "aha moments"
- **Store references**: Key quotes, paper citations, useful links
- **Use descriptive tags**: Help future retrieval with relevant keywords

### Navigation Tuning
- **Start broad, then narrow**: Begin with Corpus/Community zoom, then focus
- **Adjust for task**: Research phase (Entity level) vs. Writing phase (Text level)
- **Use multiple views**: Switch between Keywords and Graph tilt for different perspectives

## Console Monitoring

The Console section shows real-time memory operations:

- **Memory storage events**: When new information is stored
- **Query processing**: How your questions are processed
- **Context retrieval**: Which memories are being accessed
- **Navigation changes**: When ZPT settings are adjusted

Watch the console to understand how the system is interpreting and responding to your interactions.

## Memory Privacy and Domains

The system supports domain-based memory organization:

- **Personal domain**: Private thoughts and notes
- **Project domains**: Work-related content organized by project
- **Shared domains**: Collaborative knowledge spaces
- **Archive domains**: Older content with reduced visibility

Navigation controls determine which domains are visible, providing natural privacy through perspective rather than access controls.

## Troubleshooting

### Memory Not Found
If expected memories aren't appearing:

1. **Check navigation settings**: Ensure domains and keywords aren't too restrictive
2. **Expand zoom level**: Try Community or Corpus level for broader view
3. **Adjust time filters**: Remove temporal restrictions in Pan settings
4. **Use broader keywords**: Expand keyword filters or remove them entirely

### Poor Relevance
If retrieved memories aren't relevant:

1. **Try different tilt styles**: Switch between Keywords, Embedding, and Graph views
2. **Adjust zoom level**: Entity level for specific facts, Text level for full context
3. **Refine pan filters**: Add more specific domain or keyword filters
4. **Use enhancement options**: Enable HyDE for better semantic matching

### Slow Responses
If memory queries are slow:

1. **Check system status**: Look at server logs and connection status
2. **Simplify navigation**: Reduce complexity of pan filters
3. **Use Basic mode**: For faster, simpler queries
4. **Monitor console**: Watch for timeout or connection errors

## Technical Notes

The memory system runs on:
- **SPARQL triple store**: For persistent, queryable storage
- **Vector embeddings**: For semantic similarity (1536 dimensions)
- **LLM processing**: For concept extraction and response generation
- **Real-time updates**: Changes reflected immediately in navigation

Memory operations integrate with all major LLM providers (Mistral, Claude, Ollama) and support both local and cloud deployments.

---

*For developers: See [mcp-tutorial.md](mcp-tutorial.md) for programmatic memory access via MCP protocol, and [http-api-endpoints.md](http-api-endpoints.md) for direct API usage.*