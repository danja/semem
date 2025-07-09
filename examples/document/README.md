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
10. **Query Results**: Use the provided SPARQL queries to analyze the processed documents, embeddings, chunks, concepts, semantic decomposition, SOM clusters, and enhanced corpuscles


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