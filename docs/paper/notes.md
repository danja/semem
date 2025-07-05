Replace hardcoded credentials in critical files:
    - src/Config.js
    - src/api/http/middleware/_auth-middleware.js
    - src/api/http/server/WebSocketServer.js
  2. Update all 66 files to use environment variables instead

  ---

BEERQA run

Processing 1/10:
❓ Question: What are chares?
   Question URI: http://purl.org/stuff/beerqa/test/corpuscle/2de665d74cad75ed1d272a388fe4068d5778762b
   Related Entities: 28
     unknown: 28 relationships
     Fetching content for 28 related entities...
Executing SPARQL SELECT query...
SPARQL SELECT completed successfully (12ms)
Executing SPARQL SELECT query...
SPARQL SELECT completed successfully (18ms)
     ✓ Retrieved content for 25 entities
     Building augmented context...
     ✓ Built context with 28 related pieces
     Generating LLM response...
     ✓ Generated response (247 chars)

📋 ANSWER:
Based on the provided context, "Chares" is related to "Char" and "Char siu". However, the context does not provide specific information about what "Chares" are. Therefore, I cannot provide a detailed answer to this question with the given context.
---
Sample Wikipedia Research Results:
   1. Geometric Langlands correspondence
      Search Query: correspondence
      Has Corpuscle: Yes
      Corpuscle: Geometric Langlands correspondence

   2. Clueless
      Search Query: Cher
      Has Corpuscle: Yes
      Corpuscle: Clueless
---

  const beerConcepts = ['brewing', 'fermentation', 'alcohol', 'flavor', 'aroma', 'bitterness', 'sweetness'];

---
Sample Question (first processed):
📝 Selected Question:
   Question: What are chares?
   Corpuscle URI: http://purl.org/stuff/beerqa/test/corpuscle/2de665d74cad75ed1d272a388fe4068d5778762b
   Source: beerqa_test_questions_v1.0
   Question ID: 2de665d74cad75ed1d272a388fe4068d5778762b

📊 Augmentation Results:
   Embedding Generated: Yes
   Embedding Dimensions: 1536
   Concepts Extracted: Yes
   Number of Concepts: 1
   Triples Added: 21
   Processing Time: 31.52s

🧠 Extracted Concepts:
   1. what
  
  ---


Full Provenance Chain:

  1. Document Source: eLife paper "Wikidata as a knowledge graph for the life sciences" by Andra Waagmeester et al.
  2. Document Processing: Paper was chunked and stored in MCP memory graph as ragno:TextElements
  3. Semantic Memory: semem_retrieve_memories found relevant chunks about medical/biomedical datasets
  4. Answer Generation: semem_answer used these chunks as context to generate the comprehensive response
  5. Knowledge Integration: The answer combined document content with LLM knowledge to produce the detailed list

  Key Document Chunks Used:
  - Chunks from life sciences paper describing Wikidata's biomedical repositories
  - Content mentioning "genomics, proteomics, genetic variants, pathways, chemical compounds, and diseases"
  - References to FAIR principles and biomedical knowledge curation

  RDF Provenance Trail:
  Question: http://example.org/docqa/question/[timestamp]
  ├── Source: "mcp-bridge"
  ├── Processing: semem semantic memory pipeline
  ├── Context: Document chunks in http://example.org/mcp/memory
  │   └── Content: "Wikidata as a knowledge graph for the life sciences"
  │   └── Authors: Andra Waagmeester, Gregory Stupp, Sebastian Burgstaller-Muehlbacher et al.
  └── Answer: Generated using document context + LLM knowledge

  The answer was grounded in actual research literature about Wikidata's biomedical applications, not just LLM training data.

  curl -X POST -H "Content-Type: application/sparql-query" -d "                                                                                │
│   PREFIX ragno: <http://purl.org/stuff/ragno/>                                                                                                 │
│   PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>                                                                                         │
│   PREFIX dcterms: <http://purl.org/dc/terms/>                                                                                                  │
│                                                                                                                                                │
│   SELECT ?question ?questionText ?created ?source ?processingStage                                                                             │
│   WHERE {                                                                                                                                      │
│       GRAPH <http://tensegrity.it/semem> {                                                                                                     │
│           ?question a ragno:Corpuscle ;                                                                                                        │
│                    rdfs:label ?questionText .                                                                                                  │
│                                                                                                                                                │
│           OPTIONAL { ?question dcterms:created ?created }                                                                                      │
│           OPTIONAL { ?question ragno:source ?source }                                                                                          │
│           OPTIONAL { ?question ragno:processingStage ?processingStage }                                                                        │
│       }                                                                                                                                        │
│   }                                                                                                                                            │
│   ORDER BY DESC(?created)                                                                                                                      │
│   LIMIT 10                                                                                                                                     │
│   " "http://localhost:3030/semem/query"                                                                                                        │
│   Query semem graph for recent questions 
---
Document QA Pipeline Workflow Steps

  Stage 1: Document Ingestion (01-ingest-documents.js)

  1. PDF Processing: Convert PDFs to markdown using @opendocsg/pdf2md
  2. Text Chunking: Split documents into 800-1200 character chunks using fixed-size strategy
  3. Embedding Generation: Pre-compute embeddings for all chunks during ingestion
  4. RDF Storage: Store chunks in SPARQL with Ragno ontology compliance and hash-based URIs
  5. Provenance Tracking: Add full PROV-O metadata for each chunk

  Stage 2: Question Processing (02-process-questions.js)

  1. Question Input: Accept questions from command line, JSON file, MCP memory, or demo defaults
  2. Embedding Generation: Create vector embeddings for each question
  3. Concept Extraction: Use LLM to extract semantic concepts from questions
  4. Question Storage: Store questions as ragno:Corpuscle with metadata in SPARQL
  5. Multi-Source Handling: Process questions from MCP bridge alongside manual inputs

  Stage 3: Context Retrieval (03-retrieve-context.js)

  1. SPARQL Query: Retrieve chunks with pre-computed embeddings using filters
  2. Similarity Calculation: Compute cosine similarity between question and chunk embeddings (70% weight)
  3. Keyword Matching: Analyze keyword overlap between question and chunks (30% weight)
  4. Relevance Scoring: Combine semantic and keyword scores with configurable thresholds
  5. Ranking & Filtering: Sort by relevance and apply chunk limits with batch processing for large datasets

  Stage 4: Answer Generation (04-generate-answers.js)

  1. Context Assembly: Combine relevant chunks into structured context for LLM
  2. Prompt Engineering: Create context-aware prompts with retrieved document chunks
  3. LLM Inference: Generate answers using multi-provider support (Mistral, Claude, Ollama)
  4. Style Application: Apply answer formatting (brief, comprehensive, detailed)
  5. Citation Tracking: Include source chunk references with relevance scores

  Complete Pipeline (run-document-qa.js)

  - Unified Execution: Run all 4 stages sequentially with single command
  - Parameter Propagation: Pass configuration options through entire pipeline
  - MCP Integration: Automatically process questions from MCP bridge
  - Performance Optimization: Apply batch limits and filtering for large datasets

  The pipeline transforms raw PDFs into a semantic knowledge base that can answer questions with cited sources from the document content.

---
 /semem:semem-memory-qa question:"How does Wikidata support FAIR principles?" 

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
---

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


    /semem:semem-memory-qa question:"How does Wikidata support FAIR principles?" 