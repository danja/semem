# Document Processing Examples

This directory contains scripts for processing PDF documents in theSemem knowledge management system.

**Example Workflow:**

*Run from project root directory*
```bash
# Initialise Corpus
node examples/document/ClearGraph.js
node examples/document/LoadPDFs.js 

# Basic Processing
node examples/document/ChunkDocuments.js 
node examples/document/MakeEmbeddings.js 

# Enhance Graph
node examples/document/ExtractConcepts.js 
node examples/document/Decompose.js 
node examples/document/SOM.js 
node examples/document/EnhanceCorpuscles.js

# RAG Question Answering
node examples/document/RAG.js "What is machine learning?"
node examples/document/RAG.js --interactive

# Advanced Search System
node examples/document/Search.js "machine learning"
node examples/document/Search.js --interactive

# Ask Ragno - Interactive Q&A System
node examples/document/AskRagno.js "What is machine learning?"
node examples/document/AskRagno.js --interactive
```


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

### ListConcepts.js

Lists and analyzes extracted concepts from the knowledge graph, providing insights into the concept extraction results. This script traces concepts back to their source documents through the full path: Concept → Chunk → TextElement → Unit → Document.

**Features:**
- Lists all concept corpuscles created by ExtractConcepts.js with full document traceability
- Organizes concepts by source document (PDF file) rather than individual chunks
- Supports three output formats: detailed, summary, and compact
- Shows concept metadata including embeddings, creation dates, and relationships
- Provides comprehensive statistics about concept extraction results
- Follows the complete path from concepts back to original PDF documents
- Proper connection cleanup to avoid hanging processes

**Usage:**
```bash
# List concepts with default settings (50 concepts, detailed format)
node examples/document/ListConcepts.js

# List concepts from specific graph with limit
node examples/document/ListConcepts.js --graph "http://example.org/my-docs" --limit 20

# Summary format grouped by document
node examples/document/ListConcepts.js --format summary --limit 10

# Compact format for processing (just concept text)
node examples/document/ListConcepts.js --format compact --limit 100

# Show help
node examples/document/ListConcepts.js --help
```

**Command Line Options:**
- `--limit <number>` - Maximum number of concepts to display (default: 50)
- `--graph <uri>` - Graph URI to query (default: from config)
- `--format <format>` - Output format: detailed, summary, compact (default: detailed)
- `--help, -h` - Show help message

**Output Formats:**
- **Detailed**: Full concept information including URIs, embeddings, creation dates, and document traceability
- **Summary**: Concepts grouped by source document with document titles and file paths
- **Compact**: Just concept text content (one per line) suitable for further processing

**Sample Output (Summary Format):**
```
📚 Document: beerQA
📁 File: data/pdfs/beerQA.pdf
📝 Concepts (8):
   • BeerQA
   • Wikipedia corpora versions
   • benchmark
   • competitive performance
   • iterative fashion
   • knowledge bases

📚 Document: elife-52614-v1
📁 File: data/pdfs/elife-52614-v1.pdf
📝 Concepts (5):
   • protein structures
   • molecular dynamics
   • machine learning
   • neural networks
   • deep learning

📊 Summary Statistics:
   Total concepts: 13
   Source documents: 2
   Concepts with embeddings: 13
   Concepts with units: 13
   Concepts in collections: 13
   Concepts with document titles: 13
```

**Prerequisites:**
- Concepts must be extracted using ExtractConcepts.js
- Document processing pipeline must be complete: LoadPDFs.js → ChunkDocuments.js → MakeEmbeddings.js → ExtractConcepts.js
- SPARQL endpoint with document data and concept corpuscles

**Technical Details:**
- Uses SPARQLQueryService with the list-concepts.sparql query template
- Traces concept lineage through the full document hierarchy
- Supports both semem: and semem2: namespaces for sourceFile properties
- Properly handles SPARQL connection cleanup to avoid hanging processes
- Groups concepts by document for better organization and analysis

### MergeConcepts.js

Finds duplicate concepts (same exact label) within the same source document and merges them into a single concept. This helps consolidate concept extraction results and reduce redundancy by combining all intermediate text elements from duplicate concepts into a merged concept while removing the redundant concept corpuscles.

**Features:**
- Finds concepts with identical labels that originated from the same source document
- Uses the three-tier concept model: `ragno:Unit` (concept) → `ragno:Corpuscle` (container) → Collection Corpuscle
- Creates merged concept units and corpuscles that consolidate all relationships
- Removes duplicate concept corpuscles and their associated concept units
- Preserves all intermediate text elements and provenance information
- Supports dry-run mode for previewing merges without making changes
- Proper connection cleanup to avoid hanging processes

**Usage:**
```bash
# Merge duplicate concepts (default: up to 50 groups)
node examples/document/MergeConcepts.js

# Preview what would be merged without making changes
node examples/document/MergeConcepts.js --dry-run

# Process specific number of concept groups
node examples/document/MergeConcepts.js --limit 20

# Use custom SPARQL graph
node examples/document/MergeConcepts.js --graph "http://example.org/my-docs"

# Show help
node examples/document/MergeConcepts.js --help
```

**Command Line Options:**
- `--limit <number>` - Maximum number of concept groups to process (default: 50)
- `--graph <uri>` - Graph URI to query (default: from config)
- `--dry-run` - Show what would be merged without making changes
- `--help, -h` - Show help message

**Sample Output:**
```
📚 Document: Research Paper on AI
📁 File: data/pdfs/ai-research.pdf
🔗 Concept: "machine learning"
🏷️  Label: "Concept: machine learning"
🔢 Duplicates: 3 copies
🎯 Concept units: 3
📄 Source chunks: 3
📋 Intermediate elements: 3
   ✅ Successfully merged into: merged-concept-corpuscle-abc123
   🗑️  Removed 2 duplicate concepts
```

**Prerequisites:**
- Concepts must be extracted using ExtractConcepts.js
- Document processing pipeline must be complete
- SPARQL endpoint with document data and concept corpuscles

**Technical Details:**
- Uses SPARQLQueryService with the merge-concepts.sparql query template
- Groups concepts by exact label match within the same source document
- Creates merged concept units as `ragno:Unit` (not `skos:Concept`)
- Maintains proper provenance chains with `prov:wasDerivedFrom`
- Uses `ragno:mergedFrom` property to track original duplicate sources
- Deletes both concept units and corpuscles during cleanup

### Decompose.js

Finds `ragno:TextElement` instances (chunks) that have embeddings and concepts extracted, applies `decomposeCorpus` to create semantic units, entities, and relationships, and stores the results in SPARQL following the Ragno ontology.

**Features:**
- Finds processed `ragno:TextElement` instances that have both embeddings and concepts extracted
- Uses configured LLM providers (Mistral, Claude, Ollama) with proper priority ordering
- Applies `src/ragno/decomposeCorpus.js` to create semantic decomposition
- Creates `ragno:SemanticUnit`, `ragno:Entity`, and `ragno:Relationship` instances
- Builds knowledge graph with entity relationships across document chunks
- Marks processed TextElements with `semem:hasSemanticUnits` flag
- Stores all results in RDF dataset following Ragno ontology patterns

**Usage:**
```bash
# Process all chunks ready for decomposition (default, run from project root)
node examples/document/Decompose.js

# Process up to 5 chunks
node examples/document/Decompose.js --limit 5

# Use custom SPARQL graph
node examples/document/Decompose.js --graph "http://example.org/my-documents"

# Show help
node examples/document/Decompose.js --help
```

**Command Line Options:**
- `--limit <number>` - Maximum number of chunks to process (default: 0, no limit)
- `--graph <uri>` - Target graph URI (default: from config)

**Prerequisites:**
- Chunks must have embeddings (run MakeEmbeddings.js first)
- Chunks must have concepts extracted (run ExtractConcepts.js first)

**RDF Structure Created:**
```turtle
# Mark TextElement as having semantic units
<http://purl.org/stuff/instance/chunk-abcd1234> semem:hasSemanticUnits true .

# Semantic units created from chunks
<http://purl.org/stuff/instance/unit_0_0> a ragno:SemanticUnit ;
    rdfs:label "First semantic unit" ;
    ragno:content "Independent semantic content..." ;
    ragno:summary "Summary of the unit" ;
    prov:wasDerivedFrom <http://purl.org/stuff/instance/chunk-abcd1234> ;
    ragno:hasEntityMention <http://purl.org/stuff/instance/entity-xyz> .

# Entities extracted from semantic units
<http://purl.org/stuff/instance/entity-xyz> a ragno:Entity ;
    rdfs:label "machine learning" ;
    ragno:subType "concept" ;
    ragno:isEntryPoint true ;
    ragno:frequency 3 .

# Relationships between entities
<http://purl.org/stuff/instance/rel_0> a ragno:Relationship ;
    ragno:hasSource <http://purl.org/stuff/instance/entity-xyz> ;
    ragno:hasTarget <http://purl.org/stuff/instance/entity-abc> ;
    ragno:relationshipType "related" ;
    ragno:weight 0.8 ;
    ragno:content "Relationship description" .
```

### SOM.js

Finds `ragno:Corpuscle` instances created by ExtractConcepts.js, extracts concept-based features (TF-IDF, diversity, structural), applies VSOM (Vectorized Self-Organizing Map) clustering to create semantic neighborhoods, and stores cluster assignments and relationships back to SPARQL.

**Features:**
- Creates cluster-based features without using LLM or embedding tools
- Extracts TF-IDF-style concept frequency vectors from corpuscle concepts
- Calculates concept diversity and structural features (concept length, uniqueness)
- Applies hexagonal VSOM topology for natural clustering
- Creates pairwise relationships between corpuscles in same clusters
- Stores cluster assignments, SOM positions, and feature metadata
- Follows Ragno ontology patterns for cluster and relationship modeling

**Usage:**
```bash
# Process all corpuscles with default 10x10 SOM (run from project root)
node examples/document/SOM.js

# Process up to 20 corpuscles with 8x8 SOM
node examples/document/SOM.js --limit 20 --map-size 8x8

# Use custom SPARQL graph
node examples/document/SOM.js --graph "http://example.org/my-documents"

# Show help
node examples/document/SOM.js --help
```

**Command Line Options:**
- `--limit <number>` - Maximum number of corpuscles to process (default: 0, no limit)
- `--graph <uri>` - Target graph URI (default: from config)
- `--map-size <WxH>` - SOM map dimensions (default: 10x10)

**Prerequisites:**
- Corpuscles must exist (run ExtractConcepts.js first)
- At least 2 corpuscles with 2+ concepts each for meaningful clustering

**RDF Structure Created:**
```turtle
# Cluster assignment for corpuscle
<http://purl.org/stuff/instance/corpuscle-xyz789> ragno:cluster <http://purl.org/stuff/instance/som_cluster_0> ;
    ragno:clusterDistance 0.123456 ;
    ragno:clusterIndex 0 ;
    ragno:somPosition "2,3" ;
    ragno:conceptDiversity 0.856234 ;
    ragno:avgConceptLength 12.45 ;
    ragno:uniqueConceptRatio 0.789123 .

# Cluster instance (created by VSOM)
<http://purl.org/stuff/instance/som_cluster_0> a ragno:Cluster ;
    ragno:clusterSize 5 ;
    ragno:averageDistance 0.234567 ;
    ragno:mapPosition "2,3" ;
    dcterms:created "2025-07-08T13:30:00Z" .

# Relationships between corpuscles in same cluster
<http://purl.org/stuff/instance/som_rel_0> a ragno:Relationship ;
    ragno:hasSource <http://purl.org/stuff/instance/corpuscle-xyz789> ;
    ragno:hasTarget <http://purl.org/stuff/instance/corpuscle-abc456> ;
    ragno:relationshipType "som-cluster-member" ;
    ragno:weight 0.876543 ;
    ragno:clusterIndex 0 ;
    dcterms:created "2025-07-08T13:30:00Z" .

# Global SOM analysis metadata
<http://purl.org/stuff/instance/som_analysis_1625754600000> a ragno:AnalysisResult ;
    ragno:analysisType "som-clustering" ;
    ragno:totalCorpuscles 25 ;
    ragno:totalClusters 6 ;
    ragno:clusteredCorpuscles 22 ;
    ragno:avgClusterSize 3.67 ;
    ragno:relationshipsCreated 45 ;
    dcterms:created "2025-07-08T13:30:00Z" .
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

### Semantic Decomposition Query (for Decompose.js results)

Query to show semantic decomposition results including units, entities, and relationships:

```sparql
PREFIX ragno: <http://purl.org/stuff/ragno/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX semem: <http://semem.hyperdata.it/>
PREFIX prov: <http://www.w3.org/ns/prov#>
PREFIX dcterms: <http://purl.org/dc/terms/>

SELECT ?textElement ?semanticUnits ?entities ?relationships
WHERE {
  GRAPH <http://tensegrity.it/semem> {
    ?textElement semem:hasSemanticUnits true .
    
    # Count semantic units derived from this text element
    {
      SELECT ?textElement (COUNT(?unit) AS ?semanticUnits) WHERE {
        ?unit a ragno:SemanticUnit ;
              prov:wasDerivedFrom ?textElement .
      }
      GROUP BY ?textElement
    }
    
    # Count entities mentioned in units from this text element
    {
      SELECT ?textElement (COUNT(DISTINCT ?entity) AS ?entities) WHERE {
        ?unit a ragno:SemanticUnit ;
              prov:wasDerivedFrom ?textElement ;
              ragno:hasEntityMention ?entity .
      }
      GROUP BY ?textElement
    }
    
    # Count relationships involving entities from this text element
    {
      SELECT ?textElement (COUNT(?relationship) AS ?relationships) WHERE {
        ?unit a ragno:SemanticUnit ;
              prov:wasDerivedFrom ?textElement ;
              ragno:hasEntityMention ?entity .
        ?relationship a ragno:Relationship ;
                      ragno:hasSource ?entity .
      }
      GROUP BY ?textElement
    }
  }
}
ORDER BY ?textElement
```

**Expected Output:**
```
| textElement                                           | semanticUnits | entities | relationships |
|-------------------------------------------------------|---------------|----------|---------------|
| http://purl.org/stuff/instance/chunk-abc123_1_xyz789 | 3             | 8        | 5             |
| http://purl.org/stuff/instance/chunk-abc123_2_uvw234 | 2             | 6        | 3             |
```

### SOM Clustering Query (for SOM.js results)

Query to show corpuscle cluster assignments and analysis from SOM clustering:

```sparql
PREFIX ragno: <http://purl.org/stuff/ragno/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX dcterms: <http://purl.org/dc/terms/>
PREFIX prov: <http://www.w3.org/ns/prov#>

SELECT ?corpuscle ?corpuscleLabel ?cluster ?clusterIndex ?clusterDistance ?somPosition ?conceptDiversity
WHERE {
    GRAPH <http://tensegrity.it/semem> {
        ?corpuscle a ragno:Corpuscle ;
                   rdfs:label ?corpuscleLabel ;
                   ragno:cluster ?cluster ;
                   ragno:clusterIndex ?clusterIndex ;
                   ragno:clusterDistance ?clusterDistance ;
                   ragno:somPosition ?somPosition ;
                   ragno:conceptDiversity ?conceptDiversity .
    }
}
ORDER BY ?clusterIndex ?clusterDistance
```

**Expected Output:**
```
| corpuscle                                           | corpuscleLabel                | cluster                                       | clusterIndex | clusterDistance | somPosition | conceptDiversity |
|-----------------------------------------------------|-------------------------------|-----------------------------------------------|--------------|-----------------|-------------|------------------|
| http://purl.org/stuff/instance/corpuscle-xyz789    | "Concepts from chunk-abc123"  | http://purl.org/stuff/instance/som_cluster_0  | 0            | 0.123456        | "2,3"       | 0.856234         |
| http://purl.org/stuff/instance/corpuscle-abc456    | "Concepts from chunk-def456"  | http://purl.org/stuff/instance/som_cluster_0  | 0            | 0.187654        | "2,4"       | 0.734567         |
```

### SOM Cluster Relationships Query (for SOM.js results)

Query to show relationships created between corpuscles in the same SOM clusters:

```sparql
PREFIX ragno: <http://purl.org/stuff/ragno/>
PREFIX dcterms: <http://purl.org/dc/terms/>

SELECT ?relationship ?sourceCorpuscle ?targetCorpuscle ?weight ?clusterIndex
WHERE {
    GRAPH <http://tensegrity.it/semem> {
        ?relationship a ragno:Relationship ;
                     ragno:relationshipType "som-cluster-member" ;
                     ragno:hasSource ?sourceCorpuscle ;
                     ragno:hasTarget ?targetCorpuscle ;
                     ragno:weight ?weight ;
                     ragno:clusterIndex ?clusterIndex .
    }
}
ORDER BY ?clusterIndex DESC(?weight)
```

**Expected Output:**
```
| relationship                                        | sourceCorpuscle                                 | targetCorpuscle                                 | weight   | clusterIndex |
|-----------------------------------------------------|-------------------------------------------------|-------------------------------------------------|----------|--------------|
| http://purl.org/stuff/instance/som_rel_0           | http://purl.org/stuff/instance/corpuscle-xyz789 | http://purl.org/stuff/instance/corpuscle-abc456 | 0.876543 | 0            |
| http://purl.org/stuff/instance/som_rel_1           | http://purl.org/stuff/instance/corpuscle-def123 | http://purl.org/stuff/instance/corpuscle-ghi789 | 0.654321 | 1            |
```

### EnhanceCorpuscles.js

Analyzes existing corpuscles from the document processing pipeline using graph analytics algorithms to add enhanced relationships and features. Creates new enhanced corpuscles based on structural importance and semantic clustering derived from K-core decomposition and centrality analysis.

**Features:**
- Queries existing corpuscles with embeddings and concepts from document pipeline
- Builds graph from concept relationships and semantic similarity between corpuscle embeddings
- Applies K-core decomposition and betweenness centrality analysis via GraphAnalytics.js
- Creates enhanced corpuscles with structural importance metrics (k-core levels, centrality scores)
- Generates new relationships based on graph analysis and community detection
- Exports enhanced corpus back to SPARQL store following Ragno ontology patterns
- Uses config-defined graph URI for seamless integration with document workflow

**Usage:**
```bash
# Process all corpuscles with default settings (run from project root)
node examples/document/EnhanceCorpuscles.js

# Process up to 50 corpuscles with custom similarity threshold
node examples/document/EnhanceCorpuscles.js --limit 50 --similarity-threshold 0.7

# Use custom SPARQL graph
node examples/document/EnhanceCorpuscles.js --graph "http://example.org/my-documents"

# Disable specific algorithms
node examples/document/EnhanceCorpuscles.js --no-centrality --no-community-detection

# Show help
node examples/document/EnhanceCorpuscles.js --help
```

**Command Line Options:**
- `--limit <number>` - Maximum number of corpuscles to process (default: 0, no limit)
- `--graph <uri>` - Target graph URI (default: from config)
- `--similarity-threshold <number>` - Minimum cosine similarity for concept relationships (default: 0.6)
- `--min-corpuscle-connections <number>` - Minimum connections required for analysis (default: 2)
- `--max-graph-nodes <number>` - Maximum nodes in concept graph (default: 1000)
- `--no-k-core` - Disable K-core decomposition analysis
- `--no-centrality` - Disable betweenness centrality analysis
- `--no-community-detection` - Disable community detection algorithms
- `--no-export` - Skip exporting results to SPARQL store
- `--no-enhanced-corpuscles` - Skip creating new enhanced corpuscles

**Prerequisites:**
- Corpuscles must exist with embeddings (run ExtractConcepts.js first)
- Source chunks must have embeddings via `prov:wasDerivedFrom` relationships
- Sufficient corpuscles (minimum 2) with concepts for meaningful graph analysis

**Pipeline Integration:**
- Expects data from: LoadPDFs.js → ChunkDocuments.js → MakeEmbeddings.js → ExtractConcepts.js
- Can be run after: Decompose.js and SOM.js (complementary graph analysis)
- Produces: Enhanced corpuscles with graph-based features and relationships

**RDF Structure Created:**
```turtle
# Enhanced corpuscle with graph analytics features
<http://purl.org/stuff/instance/enhanced_corpuscle_concept_machine_learning> a ragno:Corpuscle ;
    rdfs:label "Enhanced: machine learning" ;
    dcterms:created "2025-07-08T13:30:00Z" ;
    ragno:enhancementType "concept-based" ;
    ragno:kCoreLevel 3 ;
    ragno:centralityScore 0.0234567 ;
    ragno:conceptFrequency 5 ;
    ragno:avgSimilarity 0.7123456 ;
    prov:wasDerivedFrom <http://purl.org/stuff/instance/corpuscle-original123> ;
    skos:member <http://purl.org/stuff/instance/concept-machine-learning> .

# Concept relationships based on embedding similarity
<http://purl.org/stuff/instance/concept_rel_0> a ragno:Relationship ;
    ragno:hasSource <http://purl.org/stuff/instance/concept-machine-learning> ;
    ragno:hasTarget <http://purl.org/stuff/instance/concept-neural-networks> ;
    ragno:relationshipType "concept-similarity" ;
    ragno:weight 0.8234567 ;
    ragno:similarity 0.8234567 ;
    dcterms:created "2025-07-08T13:30:00Z" .

# Graph analysis metadata
<http://purl.org/stuff/instance/graph_analysis_1625754600000> a ragno:AnalysisResult ;
    ragno:analysisType "graph-enhancement" ;
    ragno:totalCorpuscles 34 ;
    ragno:totalConcepts 11 ;
    ragno:totalRelationships 1122 ;
    ragno:enhancedCorpuscles 9 ;
    ragno:maxKCore 3 ;
    ragno:avgCentrality 0.0156789 ;
    dcterms:created "2025-07-08T13:30:00Z" .
```

### Enhanced Corpuscle Analysis Query (for EnhanceCorpuscles.js results)

Query to show enhanced corpuscles with their graph analytics features:

```sparql
PREFIX ragno: <http://purl.org/stuff/ragno/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX dcterms: <http://purl.org/dc/terms/>
PREFIX prov: <http://www.w3.org/ns/prov#>

SELECT ?enhancedCorpuscle ?label ?enhancementType ?kCoreLevel ?centralityScore ?conceptFrequency ?avgSimilarity ?originalCorpuscle
WHERE {
    GRAPH <http://tensegrity.it/semem> {
        ?enhancedCorpuscle a ragno:Corpuscle ;
                          rdfs:label ?label ;
                          ragno:enhancementType ?enhancementType ;
                          ragno:kCoreLevel ?kCoreLevel ;
                          ragno:centralityScore ?centralityScore ;
                          ragno:conceptFrequency ?conceptFrequency ;
                          ragno:avgSimilarity ?avgSimilarity ;
                          prov:wasDerivedFrom ?originalCorpuscle .
    }
}
ORDER BY DESC(?kCoreLevel) DESC(?centralityScore)
```

**Expected Output:**
```
| enhancedCorpuscle                                               | label                           | enhancementType | kCoreLevel | centralityScore | conceptFrequency | avgSimilarity | originalCorpuscle                               |
|-----------------------------------------------------------------|---------------------------------|-----------------|------------|-----------------|------------------|--------------|-------------------------------------------------|
| http://purl.org/stuff/instance/enhanced_corpuscle_concept_ml   | "Enhanced: machine learning"    | "concept-based" | 3          | 0.0234567       | 5                | 0.7123456     | http://purl.org/stuff/instance/corpuscle-abc123 |
| http://purl.org/stuff/instance/enhanced_corpuscle_concept_ai   | "Enhanced: artificial intelligence" | "concept-based" | 2          | 0.0198765       | 3                | 0.6987654     | http://purl.org/stuff/instance/corpuscle-def456 |
```

### RAG.js

Implements a complete Retrieval Augmented Generation (RAG) system that performs semantic search over processed document chunks and generates contextually augmented responses using configured LLM providers.

**Features:**
- Loads configuration from `config/config.json` with proper path resolution for examples/document
- Connects to SPARQL endpoint using configured storage options
- Retrieves document chunks with embeddings using SPARQL template system
- Builds FAISS index for efficient similarity search over vector embeddings
- Generates query embeddings using configured embedding providers (Nomic, Ollama)
- Performs semantic search to find top-k most relevant document chunks
- Augments user questions with retrieved context for improved LLM responses
- Uses priority-based LLM provider selection (Mistral, Claude, Ollama fallback)
- Supports both single question and interactive modes
- Handles embedding dimension detection and mismatch resolution
- Provides comprehensive logging and error handling

**Usage:**
```bash
# Answer a single question (run from project root)
node examples/document/RAG.js "What is machine learning?"

# Answer a question with specific graph
node examples/document/RAG.js "How does neural network training work?" --graph "http://example.org/my-docs"

# Interactive mode for multiple questions
node examples/document/RAG.js --interactive

# Show help
node examples/document/RAG.js --help
```

**Command Line Options:**
- `--graph <uri>` - Named graph URI to search (default: from config)
- `--interactive` - Interactive mode for multiple questions
- `--help, -h` - Show help message

**Prerequisites:**
- Document processing pipeline completed:
  1. `LoadPDFs.js` - Load documents into SPARQL store
  2. `ChunkDocuments.js` - Create semantic chunks
  3. `MakeEmbeddings.js` - Generate embeddings for chunks
- SPARQL endpoint running with document data
- Configured LLM and embedding providers in config.json
- Environment variables set in `.env` file

**Architecture:**
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   User Query    │───▶│  Query Embedding │───▶│  FAISS Search   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                                        │
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│ LLM Generation  │◀───│ Context Augment │◀───│ Top-K Retrieval │
└─────────────────┘    └─────────────────┘    └─────────────────┘
        │
        ▼
┌─────────────────┐
│ Final Response  │
└─────────────────┘
```

**Technical Details:**
- **SPARQL Integration**: Uses `SPARQLQueryService` and `SPARQLHelper` with `rag-document-chunks.sparql` template
- **Vector Search**: FAISS IndexFlatIP for inner product similarity search
- **Embedding Models**: Supports Nomic (768-dim) and Ollama (1536-dim) with automatic dimension detection
- **LLM Providers**: Priority-based selection from Mistral → Claude → Ollama fallback
- **Context Window**: Retrieves top-3 chunks with full content for context augmentation
- **Error Handling**: Graceful fallbacks for missing embeddings, API failures, and dimension mismatches

**Configuration Requirements:**
```json
{
  "storage": {
    "type": "sparql",
    "options": {
      "query": "http://localhost:3030/semem/query",
      "graphName": "http://tensegrity.it/semem",
      "user": "${SPARQL_USER}",
      "password": "${SPARQL_PASSWORD}"
    }
  },
  "embeddingProvider": "nomic",
  "embeddingModel": "nomic-embed-text:v1.5",
  "llmProviders": [
    {
      "type": "mistral",
      "apiKey": "${MISTRAL_API_KEY}",
      "chatModel": "mistral-small-latest",
      "priority": 1,
      "capabilities": ["chat"]
    }
  ]
}
```

**Sample Output:**
```
🤖 RAG Interactive Mode
Type your questions, or "quit" to exit.
==================================================

❓ Your question: What is machine learning?

🔍 PERFORMING SEMANTIC SEARCH
========================================
📝 Query: "What is machine learning?"
🎯 Limit: 3 results
✅ Found 3 results
1. "e4e5c93c523b84d8_0_59d635888bdc695f" (score: 0.8234)
2. "e4e5c93c523b84d8_12_e383a9aaa6f44aa9" (score: 0.7891)
3. "e4e5c93c523b84d8_24_72ccfc3d9f52cd5d" (score: 0.7456)

🧠 GENERATING AUGMENTED RESPONSE
========================================
📝 Augmented prompt created (2847 characters)
✅ Response generated successfully

🤖 Response:
Machine learning is a subset of artificial intelligence that involves developing algorithms and models that enable computers to learn and make decisions from data without being explicitly programmed for each specific task...
```

**Error Handling:**
- **No Embeddings**: Gracefully handles missing or empty embeddings with helpful error messages
- **API Failures**: Falls back through provider priority chain (Mistral → Claude → Ollama)
- **Dimension Mismatch**: Automatically adjusts FAISS index to match stored embedding dimensions
- **Empty Results**: Provides clear feedback when no relevant context is found
- **Configuration Errors**: Validates SPARQL endpoints and provider configurations

### Search.js

Implements a comprehensive document search system that combines multiple search strategies to find relevant content across processed document collections. Unlike RAG.js which focuses on question answering, Search.js provides advanced search capabilities with filtering, ranking, and multiple search modes.

**Features:**
- **Multi-Mode Search**: Supports dual, exact, similarity, and traversal search modes
- **RagnoSearch Integration**: Uses the full RagnoSearch system with vector similarity, SPARQL exact matching, and Personalized PageRank traversal
- **Advanced Filtering**: Relevance filtering, type-based filtering, deduplication, and result ranking
- **Multiple Output Formats**: Detailed, summary, and URI-only result formats
- **Interactive CLI**: Full-featured command-line interface with persistent sessions
- **URI-based Search**: Can search starting from specific entity URIs for graph traversal
- **Performance Monitoring**: Built-in search statistics and timing metrics
- **Configuration Flexibility**: Supports custom search parameters, thresholds, and result limits

**Usage:**
```bash
# Basic text search (run from project root)
node examples/document/Search.js "machine learning algorithms"

# Interactive mode for multiple searches
node examples/document/Search.js --interactive

# Search with custom parameters
node examples/document/Search.js "neural networks" --limit 10 --threshold 0.7 --mode dual

# URI-based search for graph traversal
node examples/document/Search.js "http://purl.org/stuff/instance/entity-ml" --mode traversal

# Different output formats
node examples/document/Search.js "AI" --format summary
node examples/document/Search.js "AI" --format uris

# Custom graph and search options
node examples/document/Search.js "deep learning" --graph "http://example.org/my-docs" --verbose

# Show help
node examples/document/Search.js --help
```

**Command Line Options:**
- `--interactive, -i` - Interactive mode for multiple searches
- `--mode <type>` - Search mode: dual, exact, similarity, traversal (default: dual)
- `--limit <number>` - Maximum number of results (default: 10)
- `--threshold <number>` - Relevance threshold 0-1 (default: 0.5)
- `--format <type>` - Output format: detailed, summary, uris (default: detailed)
- `--graph <uri>` - Target graph URI (default: from config)
- `--verbose, -v` - Enable verbose logging
- `--help, -h` - Show help message

**Search Modes:**
- **Dual**: Combines exact SPARQL matching with vector similarity search (recommended)
- **Exact**: SPARQL-only search for precise term matching
- **Similarity**: Vector-only search for semantic similarity
- **Traversal**: Graph traversal using Personalized PageRank from starting entities

**Architecture:**
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   User Query    │───▶│ Query Analysis  │───▶│ Search Strategy │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                                        │
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│ Formatted       │◀───│ Filter & Rank   │◀───│ Multi-Source    │
│ Results         │    │ Results         │    │ Search          │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │                        │
                              ▼                        ▼
                    ┌─────────────────┐    ┌─────────────────┐
                    │ Relevance       │    │ • SPARQL Exact  │
                    │ Filtering       │    │ • Vector Search │
                    └─────────────────┘    │ • PPR Traversal │
                                          └─────────────────┘
```

**Sample Output:**
```
🔍 Document Search System
========================

📝 Query: "machine learning algorithms"
🎯 Mode: dual | Limit: 10 | Threshold: 0.5

🔍 SEARCH RESULTS
=================
✅ Found 7 results in 1,247ms

📄 Result 1 (Score: 0.891)
┌─ URI: http://purl.org/stuff/instance/entity-ml-algorithms
├─ Type: ragno:Entity
├─ Content: Machine learning algorithms are computational methods that enable systems to learn patterns from data...
└─ Source: http://purl.org/stuff/instance/chunk-abc123

📄 Result 2 (Score: 0.834)
┌─ URI: http://purl.org/stuff/instance/unit-neural-nets
├─ Type: ragno:SemanticUnit
├─ Content: Neural network algorithms form the foundation of deep learning approaches...
└─ Source: http://purl.org/stuff/instance/chunk-def456

📊 SEARCH STATISTICS
====================
• Total searches: 1
• Successful searches: 1
• Average search time: 1,247ms
• Last search: dual mode, 7 results
```

**Prerequisites:**
- Complete document processing pipeline:
  1. `LoadPDFs.js` - Document ingestion
  2. `ChunkDocuments.js` - Text chunking
  3. `MakeEmbeddings.js` - Vector embeddings
  4. `ExtractConcepts.js` or `Decompose.js` - Entity extraction
- SPARQL endpoint with document data
- Configured embedding providers for similarity search
- LLM providers for entity extraction (if using traversal mode)

**Technical Integration:**
- **RagnoSearch System**: Full integration with dual search capabilities
- **Vector Index**: HNSW-based similarity search with configurable dimensions
- **SPARQL Templates**: Uses optimized query templates for different search types
- **SearchFilters**: Advanced result filtering and ranking algorithms
- **Graph Traversal**: Personalized PageRank for entity-centric search
- **Performance**: Built-in caching and optimization for repeated searches

**Comparison with RAG.js:**

| Feature | Search.js | RAG.js |
|---------|-----------|---------|
| **Purpose** | Document discovery & exploration | Question answering with context |
| **Search Modes** | 4 modes (dual, exact, similarity, traversal) | Similarity search only |
| **Output** | Search results with metadata | Generated text responses |
| **Interaction** | Search interface with filtering | RAG pipeline with augmentation |
| **Use Cases** | Content discovery, research, exploration | Q&A, chatbot, knowledge retrieval |
| **Result Types** | Documents, entities, semantic units | Contextual text generation |

**Use Cases:**
- **Research & Discovery**: Find related documents and concepts across large collections
- **Content Exploration**: Navigate through semantic relationships between entities
- **Quality Assessment**: Evaluate document processing results and entity extraction
- **Graph Navigation**: Explore knowledge graph connections starting from specific entities
- **Performance Analysis**: Monitor search system performance and result quality

### AskRagno.js

Implements a comprehensive question-answering system that combines question storage, semantic search, and contextual answer generation. Unlike RAG.js which focuses on retrieval augmented generation, AskRagno provides persistent question storage and advanced search integration.

**Features:**
- **Question Storage**: Questions stored as corpuscles in SPARQL store for future reference
- **Semantic Search**: Integration with DocumentSearchSystem for comprehensive context retrieval
- **Context Augmentation**: Uses ContextManager to build comprehensive context from search results
- **Multi-Provider LLM**: Priority-based LLM provider selection (Mistral → Claude → Ollama)
- **Interactive Mode**: CLI interface supporting both single questions and continuous Q&A sessions
- **Performance Monitoring**: Built-in statistics tracking and response time monitoring

**Usage:**
```bash
# Ask a single question (run from project root)
node examples/document/AskRagno.js "What is machine learning?"

# Interactive mode for multiple questions
node examples/document/AskRagno.js --interactive

# Custom graph and verbose logging
node examples/document/AskRagno.js "How do neural networks work?" --graph "http://example.org/my-docs" --verbose

# Show help
node examples/document/AskRagno.js --help
```

**Command Line Options:**
- `--graph <uri>` - Named graph URI to use (default: from config)
- `--interactive` - Interactive mode for multiple questions
- `--verbose` - Enable verbose logging
- `--help, -h` - Show help message

**Architecture:**
```
User Question → Store as Corpuscle → Search for Context → Build Augmented Prompt → Generate Answer
```

**Sample Output:**
```
🤖 AskRagno Interactive Mode
Ask your questions and get contextually augmented answers!
==================================================

❓ Your question: What is machine learning?

🔍 PROCESSING QUESTION
========================================
📝 Step 1: Storing question as corpuscle...
✅ Question stored: http://purl.org/stuff/instance/corpuscle-abc123

🔍 Step 2: Searching for relevant information...
✅ Found 3 relevant results

🧠 Step 3: Building context from search results...
✅ Context built (2847 characters)

💬 Step 4: Generating answer with LLM...
✅ Answer generated (456 characters)

🤖 Answer:
========================================
Machine learning is a subset of artificial intelligence that enables computers to learn from data without being explicitly programmed. It uses algorithms that iteratively learn from data, allowing systems to find insights and make predictions about new data based on patterns discovered in training data.
========================================
📊 Response time: 3,247ms | Context sources: 3
🔗 Question stored: http://purl.org/stuff/instance/corpuscle-abc123
```

**Prerequisites:**
- Document processing pipeline completed:
  1. `LoadPDFs.js` - Document ingestion
  2. `ChunkDocuments.js` - Text chunking
  3. `MakeEmbeddings.js` - Vector embeddings
  4. `ExtractConcepts.js` - Concept extraction
- SPARQL endpoint running with document data
- Configured LLM providers in config.json
- Environment variables set in .env file

**Technical Integration:**
- **Question Storage**: Uses TextToCorpuscle patterns for persistent question storage
- **Search Integration**: Full DocumentSearchSystem integration with dual search capabilities
- **Context Building**: ContextManager for intelligent context augmentation
- **LLM Integration**: Multi-provider support with graceful fallback handling
- **Resource Management**: Proper cleanup and connection management

**Comparison with RAG.js and Search.js:**

| Feature | AskRagno.js | RAG.js | Search.js |
|---------|-------------|---------|-----------|
| **Purpose** | Interactive Q&A with persistence | Document-based question answering | Document discovery & exploration |
| **Question Storage** | Persistent as corpuscles | Ephemeral | N/A |
| **Search Integration** | Full DocumentSearchSystem | FAISS similarity only | Advanced multi-mode search |
| **Context Building** | ContextManager integration | Basic context augmentation | No context building |
| **LLM Integration** | Multi-provider with fallback | Single provider | Entity extraction only |
| **Interactive Mode** | Full CLI with statistics | Basic interactive | Advanced interactive |
| **Use Cases** | Q&A systems, chatbots, knowledge bases | Quick document Q&A | Research, content discovery |

**Performance Characteristics:**
- Response times typically under 5 seconds
- Supports concurrent question processing
- Built-in performance monitoring and statistics
- Proper resource cleanup and connection management

**Error Handling:**
- Graceful handling of service failures (SPARQL, search, LLM)
- Continues processing with partial results
- Clear error messages for configuration issues
- Proper cleanup even during error conditions

## Workflow

The typical workflow for processing documents is:

1. **Clear Graph** (optional): Use `node examples/document/ClearGraph.js` to clear any existing data from the target graph
2. **Load Documents**: Use `node examples/document/LoadPDFs.js` to convert PDFs to RDF and store as `ragno:Unit` and `ragno:TextElement` instances
3. **Chunk Documents**: Use `node examples/document/ChunkDocuments.js` to process `ragno:TextElement` instances and create semantic chunks with OLO indexing (chunks are stored as both `ragno:Unit` and `ragno:TextElement`)
4. **Create Embeddings**: Use `node examples/document/MakeEmbeddings.js` to generate vector embeddings for all `ragno:TextElement` instances (both original documents and chunks)
5. **Extract Concepts**: Use `node examples/document/ExtractConcepts.js` to extract semantic concepts from chunk TextElements using configured LLM providers
6. **Semantic Decomposition**: Use `node examples/document/Decompose.js` to apply semantic decomposition to processed chunks, creating entities, relationships, and semantic units
7. **SOM Clustering**: Use `node examples/document/SOM.js` to apply Self-Organizing Map clustering to corpuscles, creating concept-based clusters and relationships without using LLM or embedding tools
8. **Enhance Corpuscles**: Use `node examples/document/EnhanceCorpuscles.js` to analyze corpuscles using graph analytics, adding structural importance features and creating enhanced corpuscles based on K-core decomposition and centrality analysis
9. **RAG Question Answering**: Use `node examples/document/RAG.js` to perform Retrieval Augmented Generation over the processed document chunks, providing semantic search and contextually enhanced responses
10. **Advanced Search**: Use `node examples/document/Search.js` to perform comprehensive document search with multiple modes, filtering, and graph traversal capabilities
11. **Interactive Q&A**: Use `node examples/document/AskRagno.js` to ask questions with persistent storage, advanced search integration, and contextual answer generation
12. **Query Results**: Use the provided SPARQL queries to analyze the processed documents, embeddings, chunks, concepts, semantic decomposition, SOM clusters, and enhanced corpuscles


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