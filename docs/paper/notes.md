semem:semem_answer (MCP)(question: "How does Wikidata support FAIR principles?", mode: "standard")
  ⎿  {                                                          
       "success": true,
       "question": "How does Wikidata support FAIR principles?",
     … +101 lines (ctrl+r to expand)

● Wikidata supports FAIR principles through:

  Findable: Persistent QIDs, rich metadata, search engine indexing, and SPARQL queries
  Accessible: Open access, API availability, data dumps, and user-friendly interfacesInteroperable: RDF format, linked data principles,
  external identifiers, and vocabulary alignment
  Reusable: CC0 licensing, comprehensive documentation, and community contributions

  The system demonstrates how Wikidata enables effective data discovery, access, integration, and reuse across scientific and knowledge
  domains.


Steps Executed by /semem:semem-memory-qa question:"How does Wikidata support FAIR principles?"

  1. Command Recognition & Parsing

  - Claude Desktop parses /semem:semem-memory-qa as MCP prompt
  - Extracts parameters: question:"How does Wikidata support FAIR principles?"
  - Routes to Semem MCP server via Model Context Protocol

  2. MCP Prompt Workflow Execution

  The prompt registry (mcp/prompts/registry.js:246-297) defines a 3-step workflow:

  Step 2a: Generate Embedding
  - Tool: semem_generate_embedding
  - Input: text: "How does Wikidata support FAIR principles?"
  - Execution: mcp/tools/memory-tools.js:209-230
  - Output: 1536-dimensional vector embedding

  Step 2b: Retrieve Similar Memories
  - Tool: semem_retrieve_memories
  - Input: query, limit: 5, threshold: 0.6
  - Execution: mcp/tools/memory-tools.js:274-304
  - Process: Generates query embedding → searches SPARQL store → returns similar interactions

  Step 2c: Generate Contextual Response
  - Tool: semem_generate_response
  - Input: prompt, retrieved memories as context, options
  - Execution: mcp/tools/memory-tools.js:310-331
  - Process: LLM generates response using retrieved context

  3. Infrastructure Services (per tool call)

  Configuration & Initialization:
  - Loads config from /config/config.json
  - Initializes LLM providers (Mistral → Claude → Ollama fallback)
  - Sets up embedding providers (priority-based selection)
  - Connects to SPARQL endpoint (Fuseki on localhost:3030)

  Memory Manager Services:
  - MemoryManager: Coordinates operations
  - SafeOperations: Provides error-safe wrappers
  - SPARQLStore: Handles RDF-based storage/retrieval
  - EmbeddingHandler: Manages vector operations
  - LLMHandler: Orchestrates language model calls

  4. Storage Operations

  - Vector Search: Cosine similarity search in SPARQL store
  - Context Retrieval: Fetches relevant prior interactions
  - Metadata Extraction: Concepts, timestamps, similarity scores

  5. Response Generation

  - Context Assembly: Combines retrieved memories with current question
  - LLM Invocation: Generates comprehensive answer using context
  - Response Formatting: Returns structured JSON with metadata

  6. Result Delivery

  - MCP Response: Formatted as MCP tool result
  - Claude Desktop: Displays final answer to user
  - Metadata: Includes iteration count, entity discovery, processing duration

  This pipeline demonstrates semantic memory retrieval where past interactions inform current responses, creating a knowledge-building system
   that improves over time.