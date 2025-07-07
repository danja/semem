# Document Processing Examples

This directory contains scripts for processing PDF documents and creating semantic chunks for the Semem knowledge management system.

**Important**: All scripts should be run from the project root directory, not from within the `examples/document/` directory.

## Scripts Overview

### ClearGraph.js

Clears all data from the configured SPARQL graph, useful for resetting the store before processing new documents.

**Usage:**
```bash
# Clear the default graph from config
node examples/document/ClearGraph.js

# Show help
node examples/document/ClearGraph.js --help
```

### LoadPDFs.js

Loads PDF files from a directory, converts them to markdown, and stores them in a SPARQL store as RDF data following the Ragno ontology.

**Features:**
- Converts PDFs to markdown using existing document services
- Caches markdown files locally for efficiency
- Checks for existing documents to avoid duplicates
- Creates proper RDF structure with `ragno:Unit` and `ragno:TextElement`
- Uses URIMinter utility for generating content-based URIs
- Integrates with Config.js for SPARQL endpoint configuration

**Usage:**
```bash
# Process all PDFs with default settings (run from project root)
node examples/document/LoadPDFs.js

# Process specific PDFs with custom cache directory
node examples/document/LoadPDFs.js --docs "data/pdfs/*.pdf" --cache "/tmp/my-cache"

# Limit processing to 5 documents
node examples/document/LoadPDFs.js --limit 5

# Use custom SPARQL graph
node examples/document/LoadPDFs.js --graph "http://example.org/my-documents"

# Show help
node examples/document/LoadPDFs.js --help
```

**Command Line Options:**
- `--docs <pattern>` - Source pattern for documents (default: `data/pdfs/*.pdf`)
- `--cache <dir>` - Cache directory for markdown files (default: `data/cache`)
- `--limit <number>` - Limit number of documents to process (default: 0, no limit)
- `--graph <uri>` - Target graph URI (default: from config)

**RDF Structure Created:**
```turtle
# Document Reference (ragno:Unit)
<http://purl.org/stuff/instance/unit-abcd1234> a ragno:Unit ;
    rdfs:label "Research Paper Title" ;
    dcterms:created "2025-07-07T13:30:00Z" ;
    semem:sourceFile "data/pdfs/research-paper.pdf" ;
    ragno:hasTextElement <http://purl.org/stuff/instance/text-abcd1234> .

# Markdown Content (ragno:TextElement)
<http://purl.org/stuff/instance/text-abcd1234> a ragno:TextElement ;
    rdfs:label "Research Paper Title markdown" ;
    dcterms:created "2025-07-07T13:30:00Z" ;
    ragno:content "# Research Paper Content..." ;
    dcterms:extent 12470 ;
    prov:wasDerivedFrom <http://purl.org/stuff/instance/unit-abcd1234> .
```

### ChunkDocuments.js

Processes `ragno:TextElement` instances that haven't been chunked yet, creating semantic chunks with proper OLO (Ordered Lists Ontology) indexing.

**Features:**
- Finds unprocessed `ragno:TextElement` instances
- Uses `src/services/document/Chunker.js` for semantic chunking
- Creates OLO-compliant ordered lists with slots and indexing
- Stores chunks as both `ragno:Unit` and `ragno:TextElement` instances (so they can receive embeddings)
- Maintains references back to source TextElements
- Marks processed TextElements with `semem:hasChunks` flag

**Usage:**
```bash
# Process up to 10 TextElements (default, run from project root)
node examples/document/ChunkDocuments.js

# Process up to 5 TextElements
node examples/document/ChunkDocuments.js --limit 5

# Use custom SPARQL graph
node examples/document/ChunkDocuments.js --graph "http://example.org/my-documents"

# Show help
node examples/document/ChunkDocuments.js --help
```

**Command Line Options:**
- `--limit <number>` - Maximum number of TextElements to process (default: 10)
- `--graph <uri>` - Target graph URI (default: from config)

**RDF Structure Created:**
```turtle
# Mark TextElement as processed
<http://purl.org/stuff/instance/text-abcd1234> semem:hasChunks true ;
    semem:hasChunkList <http://purl.org/stuff/instance/chunklist-efgh5678> .

# Ordered List for chunks (OLO)
<http://purl.org/stuff/instance/chunklist-efgh5678> a olo:OrderedList ;
    olo:length 3 ;
    dcterms:title "Chunks for text-abcd1234" ;
    prov:wasDerivedFrom <http://purl.org/stuff/instance/text-abcd1234> ;
    olo:slot <http://purl.org/stuff/instance/slot-1>, 
             <http://purl.org/stuff/instance/slot-2>,
             <http://purl.org/stuff/instance/slot-3> .

# Individual chunks as both Units and TextElements (for embeddings)
<http://purl.org/stuff/instance/chunk-1234> a ragno:Unit, ragno:TextElement ;
    ragno:content "First chunk content..." ;
    dcterms:extent 456 ;
    olo:index 1 ;
    prov:wasDerivedFrom <http://purl.org/stuff/instance/text-abcd1234> ;
    dcterms:created "2025-07-07T13:30:00Z" .

# OLO Slots with indexing
<http://purl.org/stuff/instance/slot-1> a olo:Slot ;
    olo:index 1 ;
    olo:item <http://purl.org/stuff/instance/chunk-1234> ;
    olo:ordered_list <http://purl.org/stuff/instance/chunklist-efgh5678> ;
    olo:next <http://purl.org/stuff/instance/slot-2> .
```

### MakeEmbeddings.js

Finds `ragno:TextElement` instances that don't have embeddings and creates vector embeddings for their content using the configured embedding provider. This includes both original document TextElements and chunk TextElements created by ChunkDocuments.js.

**Features:**
- Finds `ragno:TextElement` instances without `ragno:embedding` property (both documents and chunks)
- Uses configurable embedding providers (Ollama, Nomic, etc.)
- Stores embeddings as comma-separated strings in SPARQL store
- Based on `examples/basic/MemoryEmbeddingSPARQL.js` patterns
- Follows semem configuration system for embedding providers

**Usage:**
```bash
# Process all TextElements that need embeddings (default, run from project root)
node examples/document/MakeEmbeddings.js

# Process up to 5 TextElements
node examples/document/MakeEmbeddings.js --limit 5

# Use custom SPARQL graph
node examples/document/MakeEmbeddings.js --graph "http://example.org/my-documents"

# Show help
node examples/document/MakeEmbeddings.js --help
```

**Command Line Options:**
- `--limit <number>` - Maximum number of TextElements to process (default: 0, no limit)
- `--graph <uri>` - Target graph URI (default: from config)

**RDF Structure Created:**
```turtle
# TextElement with embedding
<http://purl.org/stuff/instance/text-abcd1234> a ragno:TextElement ;
    ragno:content "Document content here..." ;
    ragno:embedding "0.1234,-0.5678,0.9012,..." .
```

### ExtractConcepts.js

Finds `ragno:TextElement` instances (chunks) that don't have concepts extracted yet, uses the configured LLM to extract concepts from their content, and stores the results as `ragno:Unit` instances with concept labels and `ragno:Corpuscle` collections.

**Features:**
- Finds `ragno:TextElement` instances without concepts extracted (only processes chunks, not original documents)
- Uses configured LLM providers (Mistral, Claude, Ollama) with proper priority ordering
- Extracts concepts using LLM and stores them as `ragno:Unit` instances
- Creates `ragno:Corpuscle` collections that group all concepts from each TextElement
- Marks processed TextElements with `semem:hasConcepts` flag
- Follows proper LLM provider configuration patterns from `docs/manual/provider-config.md`

**Usage:**
```bash
# Process all TextElements that need concept extraction (default, run from project root)
node examples/document/ExtractConcepts.js

# Process up to 5 TextElements
node examples/document/ExtractConcepts.js --limit 5

# Use custom SPARQL graph
node examples/document/ExtractConcepts.js --graph "http://example.org/my-documents"

# Show help
node examples/document/ExtractConcepts.js --help
```

**Command Line Options:**
- `--limit <number>` - Maximum number of TextElements to process (default: 0, no limit)
- `--graph <uri>` - Target graph URI (default: from config)

**RDF Structure Created:**
```turtle
# Mark TextElement as having concepts extracted
<http://purl.org/stuff/instance/chunk-abcd1234> semem:hasConcepts true ;
    semem:hasCorpuscle <http://purl.org/stuff/instance/corpuscle-xyz789> .

# Corpuscle collection grouping concepts
<http://purl.org/stuff/instance/corpuscle-xyz789> a ragno:Corpuscle ;
    rdfs:label "Concepts from chunk-abcd1234" ;
    dcterms:created "2025-07-07T13:30:00Z" ;
    prov:wasDerivedFrom <http://purl.org/stuff/instance/chunk-abcd1234> ;
    skos:member <http://purl.org/stuff/instance/concept-001>,
                <http://purl.org/stuff/instance/concept-002>,
                <http://purl.org/stuff/instance/concept-003> .

# Individual concept units
<http://purl.org/stuff/instance/concept-001> a ragno:Unit ;
    rdfs:label "machine learning" ;
    dcterms:created "2025-07-07T13:30:00Z" ;
    prov:wasDerivedFrom <http://purl.org/stuff/instance/chunk-abcd1234> ;
    ragno:inCorpuscle <http://purl.org/stuff/instance/corpuscle-xyz789> .
```

## Sample SPARQL Queries

### Document Statistics Query (for LoadPDFs.js results)

Query to show documents loaded by LoadPDFs.js with basic statistics:

```sparql
PREFIX ragno: <http://purl.org/stuff/ragno/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX dcterms: <http://purl.org/dc/terms/>
PREFIX semem: <http://semem.hyperdata.it/>
PREFIX prov: <http://www.w3.org/ns/prov#>

SELECT ?document ?title ?created ?sourceFile ?textSize ?hasChunks
WHERE {
  GRAPH <http://tensegrity.it/semem> {
    ?document a ragno:Unit ;
              rdfs:label ?title ;
              dcterms:created ?created ;
              semem:sourceFile ?sourceFile ;
              ragno:hasTextElement ?textElement .
    
    ?textElement dcterms:extent ?textSize .
    
    OPTIONAL { 
      ?textElement semem:hasChunks ?hasChunks 
    }
  }
}
ORDER BY DESC(?created)
```

**Expected Output:**
```
| document                                    | title              | created             | sourceFile                    | textSize | hasChunks |
|--------------------------------------------|--------------------|---------------------|-------------------------------|----------|-----------|
| http://purl.org/stuff/instance/unit-abc123 | "Research Paper"   | 2025-07-07T13:30:00Z | data/pdfs/research.pdf | 12470    | true      |
| http://purl.org/stuff/instance/unit-def456 | "Technical Report" | 2025-07-07T13:25:00Z | data/pdfs/report.pdf   | 8920     |           |
```

### Chunk Statistics Query (for ChunkDocuments.js results)

Query to show chunking statistics and OLO structure created by ChunkDocuments.js:

```sparql
PREFIX ragno: <http://purl.org/stuff/ragno/>
PREFIX olo: <http://purl.org/ontology/olo/core#>
PREFIX dcterms: <http://purl.org/dc/terms/>
PREFIX semem: <http://semem.hyperdata.it/>
PREFIX prov: <http://www.w3.org/ns/prov#>

SELECT ?textElement ?chunkList ?totalChunks ?avgChunkSize ?firstChunk ?lastChunk
WHERE {
  GRAPH <http://tensegrity.it/semem> {
    ?textElement a ragno:TextElement ;
                 semem:hasChunks true ;
                 semem:hasChunkList ?chunkList .
    
    ?chunkList a olo:OrderedList ;
               olo:length ?totalChunks .
    
    # Find first chunk (index 1)
    ?firstSlot olo:ordered_list ?chunkList ;
               olo:index 1 ;
               olo:item ?firstChunk .
    
    # Find last chunk (highest index)
    ?lastSlot olo:ordered_list ?chunkList ;
              olo:index ?totalChunks ;
              olo:item ?lastChunk .
    
    # Calculate average chunk size
    {
      SELECT ?chunkList (AVG(?chunkSize) AS ?avgChunkSize) WHERE {
        ?slot olo:ordered_list ?chunkList ;
              olo:item ?chunk .
        ?chunk dcterms:extent ?chunkSize .
      }
      GROUP BY ?chunkList
    }
  }
}
ORDER BY ?textElement
```

**Expected Output:**
```
| textElement                                   | chunkList                                       | totalChunks | avgChunkSize | firstChunk                                   | lastChunk                                    |
|-----------------------------------------------|-------------------------------------------------|-------------|--------------|----------------------------------------------|----------------------------------------------|
| http://purl.org/stuff/instance/text-abc123   | http://purl.org/stuff/instance/chunklist-xyz789 | 5           | 892.4        | http://purl.org/stuff/instance/chunk-001    | http://purl.org/stuff/instance/chunk-005    |
| http://purl.org/stuff/instance/text-def456   | http://purl.org/stuff/instance/chunklist-uvw234 | 3           | 1247.7       | http://purl.org/stuff/instance/chunk-010    | http://purl.org/stuff/instance/chunk-012    |
```

### Embedding Status Query (for MakeEmbeddings.js results)

Query to show TextElements and their embedding status:

```sparql
PREFIX ragno: <http://purl.org/stuff/ragno/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX dcterms: <http://purl.org/dc/terms/>
PREFIX prov: <http://www.w3.org/ns/prov#>

SELECT ?textElement ?sourceUnit ?contentLength ?hasEmbedding ?embeddingLength
WHERE {
  GRAPH <http://tensegrity.it/semem> {
    ?textElement a ragno:TextElement ;
                 ragno:content ?content ;
                 prov:wasDerivedFrom ?sourceUnit .
    
    BIND(STRLEN(?content) AS ?contentLength)
    
    OPTIONAL { 
      ?textElement ragno:embedding ?embedding .
      BIND(true AS ?hasEmbedding)
      BIND(SIZE(SPLIT(?embedding, ",")) AS ?embeddingLength)
    }
    
    FILTER (!BOUND(?hasEmbedding) || ?hasEmbedding = true)
  }
}
ORDER BY DESC(?hasEmbedding) ?textElement
```

**Expected Output:**
```
| textElement                                   | sourceUnit                                   | contentLength | hasEmbedding | embeddingLength |
|-----------------------------------------------|----------------------------------------------|---------------|--------------|-----------------|
| http://purl.org/stuff/instance/text-abc123   | http://purl.org/stuff/instance/unit-xyz789  | 12470         | true         | 1536           |
| http://purl.org/stuff/instance/text-def456   | http://purl.org/stuff/instance/unit-uvw234  | 8920          | true         | 1536           |
| http://purl.org/stuff/instance/text-ghi789   | http://purl.org/stuff/instance/unit-rst567  | 5643          |              |                |
```

### Concept Extraction Query (for ExtractConcepts.js results)

Query to show extracted concepts and their corpuscle groupings:

```sparql
PREFIX ragno: <http://purl.org/stuff/ragno/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX semem: <http://semem.hyperdata.it/>
PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
PREFIX dcterms: <http://purl.org/dc/terms/>
PREFIX prov: <http://www.w3.org/ns/prov#>

SELECT ?textElement ?corpuscle ?conceptCount ?concepts
WHERE {
  GRAPH <http://tensegrity.it/semem> {
    ?textElement semem:hasConcepts true ;
                 semem:hasCorpuscle ?corpuscle .
    
    ?corpuscle a ragno:Corpuscle ;
               rdfs:label ?corpuscleLabel .
    
    # Count concepts in corpuscle
    {
      SELECT ?corpuscle (COUNT(?concept) AS ?conceptCount) 
             (GROUP_CONCAT(?conceptLabel; separator=", ") AS ?concepts) WHERE {
        ?corpuscle skos:member ?concept .
        ?concept a ragno:Unit ;
                 rdfs:label ?conceptLabel .
      }
      GROUP BY ?corpuscle
    }
  }
}
ORDER BY ?textElement
```

**Expected Output:**
```
| textElement                                           | corpuscle                                             | conceptCount | concepts                                    |
|-------------------------------------------------------|-------------------------------------------------------|--------------|---------------------------------------------|
| http://purl.org/stuff/instance/chunk-abc123_1_xyz789 | http://purl.org/stuff/instance/corpuscle-def456      | 7            | machine learning, neural networks, AI      |
| http://purl.org/stuff/instance/chunk-abc123_2_uvw234 | http://purl.org/stuff/instance/corpuscle-ghi789      | 4            | deep learning, transformers, attention     |
```

## Workflow

The typical workflow for processing documents is:

1. **Clear Graph** (optional): Use `node examples/document/ClearGraph.js` to clear any existing data from the target graph
2. **Load Documents**: Use `node examples/document/LoadPDFs.js` to convert PDFs to RDF and store as `ragno:Unit` and `ragno:TextElement` instances
3. **Chunk Documents**: Use `node examples/document/ChunkDocuments.js` to process `ragno:TextElement` instances and create semantic chunks with OLO indexing (chunks are stored as both `ragno:Unit` and `ragno:TextElement`)
4. **Create Embeddings**: Use `node examples/document/MakeEmbeddings.js` to generate vector embeddings for all `ragno:TextElement` instances (both original documents and chunks)
5. **Extract Concepts**: Use `node examples/document/ExtractConcepts.js` to extract semantic concepts from chunk TextElements using configured LLM providers
6. **Query Results**: Use the provided SPARQL queries to analyze the processed documents, embeddings, chunks, and extracted concepts

**Example Complete Workflow:**
```bash
# Run from project root directory
node examples/document/ClearGraph.js
node examples/document/LoadPDFs.js --limit 5
node examples/document/ChunkDocuments.js --limit 20
node examples/document/MakeEmbeddings.js --limit 50
node examples/document/ExtractConcepts.js --limit 10
```

## Configuration

All scripts use the semem configuration system:
- Configuration file: `config/config.json`
- Environment variables: `.env` file for credentials
- SPARQL endpoints: Configured in the config file with environment variable substitution
- Embedding providers: Configurable (Ollama, Nomic) with model selection and API keys

## Dependencies

- Node.js 20.11.0+
- SPARQL endpoint (Apache Fuseki recommended)
- PDF processing: `@opendocsg/pdf2md`
- Semem core libraries: Config, SPARQLStore, document services

## Error Handling

Both scripts include comprehensive error handling:
- Existence checks to avoid duplicate processing
- Graceful fallbacks for SPARQL query failures
- Detailed logging and progress reporting
- Timeout protection for long-running operations