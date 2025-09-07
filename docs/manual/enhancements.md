# Knowledge Enhancements

Knowledge enhancements extend your personal semantic memory by integrating external knowledge sources. When your local knowledge base doesn't contain relevant information, enhancements automatically search Wikipedia, Wikidata, and use advanced query expansion techniques to provide comprehensive answers.

## Overview

The enhancement system provides three complementary knowledge sources:

1. **Wikipedia**: General knowledge articles and encyclopedic information
2. **Wikidata**: Structured knowledge entities, relationships, and factual data
3. **HyDE (Hypothetical Document Embeddings)**: Advanced query expansion for better semantic matching

These enhancements work seamlessly with your personal knowledge base, only activating when local context is insufficient.

## How Concept Extraction Supports Enhancements

**Important**: The system's primary retrieval mechanism uses **embedding-based semantic similarity**, not concept matching. Extracted concepts serve specific purposes:

- **Enhancement Triggers**: Concepts extracted from your queries are used to search external sources (Wikipedia, Wikidata)
- **Metadata Storage**: Concepts are stored as searchable metadata alongside your content
- **UI Filtering**: You can search within extracted concepts using the workbench interface
- **External Research**: Concepts drive the research queries sent to external knowledge graphs

**Your personal knowledge retrieval** uses vector embeddings for semantic similarity, while **external enhancements** use extracted concepts to formulate precise search queries.

## Using Enhancements in the Workbench

### Chat Interface (Primary Method)

The chat interface provides the most natural way to access enhanced knowledge:

1. **Ask Naturally**: Type your question in conversational language
   ```
   "What is the capital of Kazakhstan?"
   "Tell me about quantum computing"
   "Who invented the transistor?"
   ```

2. **Automatic Detection**: When no relevant information is found in your personal knowledge base, the system:
   - Provides a general knowledge answer
   - Asks if you want enhanced search: *"Would you like me to search external sources for more comprehensive information?"*

3. **Trigger Enhancement**: Respond positively to activate all enhancements:
   ```
   You: "yes" / "sure" / "okay" / "please" / "go ahead"
   ```

4. **Enhanced Results**: Receive comprehensive answers combining all three enhancement sources

**Example Chat Flow**:
```
You: "What is the population of Estonia?"

Chat: "Based on my general knowledge: Estonia has approximately 1.3 million people...
       I couldn't find relevant information in your personal knowledge base. 
       Would you like me to search external sources for more comprehensive information?"

You: "yes"

Chat: "Based on enhanced search: Estonia's population is approximately 1.34 million as of 2024, 
       making it one of the least populous countries in Europe. The capital Tallinn has about 
       440,000 residents..."
```

### Ask Verb Interface

The Ask verb provides explicit control over individual enhancements:

1. **Enter Your Query**: Type your question in the query field
2. **Select Enhancement Options**: Check the boxes for desired sources:
   - ☐ **HyDE**: Hypothetical Document Embeddings
   - ☐ **Wikipedia**: Wikipedia knowledge integration  
   - ☐ **Wikidata**: Wikidata entities and relationships
3. **Execute Search**: Click "🔍 Search Memory"
4. **Review Results**: Enhanced answers appear with source attribution

**Best Practice**: Enable all three for comprehensive coverage, or select specific sources based on your query type:
- **Factual queries**: Wikipedia + Wikidata
- **Conceptual queries**: Wikipedia + HyDE
- **Entity relationships**: Wikidata + HyDE

## Enhancement Workflows

### Wikipedia Integration

Wikipedia enhancement provides access to the world's largest encyclopedia for general knowledge queries.

**When Wikipedia Activates**:
- Queries about historical events, people, places, concepts
- Scientific and technical topics
- Cultural and social phenomena
- Current events and notable topics

**Wikipedia Workflow**:
1. **Query Processing**: Your question is analyzed and key terms extracted
2. **Wikipedia Search**: Searches Wikipedia articles using extracted terms
3. **Content Retrieval**: Relevant article sections are retrieved
4. **Summary Generation**: Key information is extracted and summarized
5. **Integration**: Wikipedia content is combined with personal knowledge and other enhancements

**Example Wikipedia Queries**:
- "What caused the fall of the Roman Empire?"
- "Explain photosynthesis"
- "Who is Marie Curie?"
- "What is the history of the internet?"

**Wikipedia Results Include**:
- Article summaries and key facts
- Historical context and background
- Related concepts and cross-references
- Current and accurate information from Wikipedia

### Wikidata Integration

Wikidata enhancement provides structured, factual knowledge through the world's largest knowledge graph.

**When Wikidata Activates**:
- Queries about specific entities (people, places, organizations)
- Factual questions requiring precise data
- Relationship queries between entities
- Statistical and quantitative information

**Wikidata Workflow**:
1. **Entity Recognition**: Identifies entities in your query (people, places, concepts)
2. **SPARQL Query Generation**: Creates structured queries for Wikidata
3. **Knowledge Graph Search**: Searches Wikidata's structured knowledge base
4. **Relationship Mapping**: Identifies connections between entities
5. **Fact Extraction**: Retrieves precise factual information
6. **Structured Response**: Presents facts in organized, readable format

**Example Wikidata Queries**:
- "When was Einstein born?"
- "What is the population of Tokyo?"
- "Who directed The Godfather?"
- "What are the official languages of Switzerland?"

**Wikidata Results Include**:
- Precise factual data (dates, numbers, statistics)
- Entity relationships and connections
- Multilingual information
- Structured properties and attributes
- Authority identifiers and references

### HyDE (Hypothetical Document Embeddings)

HyDE enhancement uses advanced query expansion to improve semantic matching and find relevant information even when query terms don't directly match source content.

**When HyDE Activates**:
- Complex conceptual queries
- Abstract or theoretical questions
- Queries requiring semantic understanding
- When direct keyword matching fails

**HyDE Workflow**:
1. **Query Analysis**: Analyzes the semantic intent of your question
2. **Concept Extraction**: Extracts key concepts from your query using LLM
3. **Hypothetical Document Generation**: Creates hypothetical documents that would answer your query
4. **Embedding Generation**: Converts hypothetical documents to semantic vectors
5. **Semantic Search**: Uses embeddings to find semantically similar content (not concept matching)
6. **Relevance Scoring**: Ranks results by vector similarity scores
7. **Enhanced Matching**: Finds relevant information beyond keyword matching

**Example HyDE Queries**:
- "How do neural networks learn patterns?"
- "What are the philosophical implications of artificial intelligence?"
- "Explain the relationship between consciousness and free will"
- "How does economic inequality affect social stability?"

**HyDE Benefits**:
- **Semantic Understanding**: Matches meaning through embeddings, not discrete concepts
- **Conceptual Bridging**: Connects related concepts across domains via vector similarity
- **Query Expansion**: Finds relevant information using broader semantic context
- **Abstract Reasoning**: Handles complex, multi-layered questions

**Technical Note**: HyDE ultimately relies on embedding similarity for matching, with extracted concepts serving as intermediate steps in the query expansion process.

## Enhancement Coordination

### Multi-Source Integration

When all enhancements are active, the system coordinates responses to provide comprehensive coverage:

1. **Wikipedia** provides general knowledge and context
2. **Wikidata** contributes factual precision and structured data
3. **HyDE** ensures semantic completeness and conceptual understanding

**Example Coordinated Response**:
```
Query: "Tell me about Marie Curie's Nobel Prizes"

Wikipedia: Biographical context, historical significance, scientific contributions
Wikidata: Precise dates (1903, 1911), award categories (Physics, Chemistry), co-recipients
HyDE: Conceptual connections to radioactivity research, gender barriers in science
```

### Quality Assurance

The enhancement system includes quality controls:
- **Source Verification**: All information includes source attribution
- **Confidence Scoring**: Results include relevance and confidence indicators
- **Redundancy Checking**: Prevents duplicate information across sources
- **Coherence Validation**: Ensures consistent information across enhancements

## Architecture: How Personal vs. Enhanced Search Works

### Personal Knowledge Base Search

**Primary Method**: Vector embedding similarity
- Your stored content is converted to high-dimensional vectors (embeddings)
- Query embeddings are compared using cosine similarity
- Most relevant content retrieved based on semantic similarity scores
- **Concepts are stored as metadata** but not used for retrieval ranking

**ZPT Navigation**: RDF entity type filtering
- Navigates using SPARQL queries on RDF types (`ragno:Entity`, `semem:Interaction`)
- Filters by zoom level (entity, unit, text, community, corpus)
- Pan filters apply domain/keyword text matching, not concept matching
- Tilt perspectives use embedding, keyword, graph, or temporal projections

### Enhancement Search

**Concept-Driven External Search**:
1. **Concept Extraction**: LLM extracts 3-5 key concepts from your query
2. **External Queries**: Concepts used to formulate searches for:
   - Wikipedia article searches using extracted terms
   - Wikidata SPARQL queries for specific entities
   - HyDE hypothetical document generation
3. **Result Integration**: External results combined with personal knowledge
4. **Final Ranking**: Uses embeddings for semantic coherence

**Why This Architecture**:
- **Embeddings** provide better semantic matching than discrete concept lists
- **Concepts** are human-readable and work well for external API queries
- **Combined approach** leverages strengths of both methods

## MCP Integration

For developers and advanced users, enhancements are also available through the MCP (Model Context Protocol) interface.

### MCP Enhancement Access

**Simple Verbs API**:
```javascript
// Enable specific enhancements
await simpleVerbsService.ask({
  question: "Your question here",
  useWikipedia: true,
  useWikidata: true,
  useHyDE: true
});
```

**Direct MCP Tools**:
- Individual enhancement services can be called directly
- Custom enhancement workflows can be built
- Integration with external systems and workflows

### Configuration and Setup

**Required Components**:
- **Internet Connection**: For Wikipedia and Wikidata access
- **Embedding Service**: For HyDE functionality (Ollama or cloud providers)
- **LLM Service**: For query processing and response generation

**Configuration Options**:
- Enhancement timeout settings
- Result limit controls
- Source priority weighting
- Cache expiration policies

## Performance and Limitations

### Performance Characteristics

**Response Times**:
- **Personal Knowledge**: < 1 second
- **Wikipedia**: 2-5 seconds
- **Wikidata**: 1-3 seconds  
- **HyDE**: 3-7 seconds
- **Combined**: 5-10 seconds

**Optimization**:
- Results are cached for repeated queries
- Common queries have faster response times
- Enhancement coordination minimizes redundant requests

### Current Limitations

**Wikipedia**:
- Limited to publicly available Wikipedia content
- Subject to Wikipedia's content policies and biases
- May not include very recent information

**Wikidata**:
- Structured data may not cover all topics comprehensively
- Query complexity limited by SPARQL capabilities
- Entity recognition dependent on Wikidata coverage

**HyDE**:
- Requires high-quality embedding models
- Performance varies with query complexity
- May generate semantically related but factually incorrect connections

## Best Practices

### When to Use Enhancements

**Use Enhancements For**:
- Queries outside your personal knowledge domain
- Fact-checking and verification needs
- Research and exploration tasks
- Educational and learning contexts
- Queries that need current/factual information from authoritative sources

**Personal Knowledge Sufficient For**:
- Project-specific information
- Personal notes and reflections
- Organizational knowledge
- Domain-specific expertise you've stored
- Content where semantic similarity matching works well

**Understanding the Search Flow**:
1. **Personal search** uses embedding similarity on your stored content
2. **If insufficient context found**, system offers enhanced search
3. **Enhanced search** extracts concepts and queries external sources
4. **Final answer** integrates personal + enhanced content using embeddings

### Optimization Tips

1. **Start with Chat**: Use natural language for best automatic routing
2. **Be Specific**: More specific queries get better enhancement results
3. **Combine Sources**: Enable all enhancements for comprehensive coverage
4. **Verify Critical Facts**: Cross-reference important information
5. **Store Useful Results**: Use `/tell` to save enhanced information for future use

### Privacy Considerations

**External Queries**:
- Enhancement queries are sent to external services (Wikipedia, Wikidata)
- Personal information from your knowledge base is NOT shared externally
- Only your current query is processed by external sources
- No conversation history or personal context is transmitted

The enhancement system provides powerful knowledge expansion while preserving the privacy and security of your personal semantic memory.