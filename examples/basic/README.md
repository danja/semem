# Basic Semem Examples

This directory contains simple, focused examples that demonstrate core Semem functionality without complex dependencies.

## Examples

### Ingest.js - Basic SPARQL Document Ingestion

A straightforward example demonstrating:
- Reading documents from `examples/data/` directory
- Storing them in a SPARQL triplestore using INSERT DATA queries
- Retrieving and verifying data using SELECT queries
- Basic content-based search queries

**Features:**
- ✅ No complex dependencies (no embeddings, no LLM processing)
- ✅ Direct SPARQL operations with proper escaping
- ✅ Comprehensive verification with statistics
- ✅ Error handling and clear progress reporting
- ✅ Content-based search demonstration

**Usage:**
```bash
node examples/basic/Ingest.js
```

**What it does:**
1. Loads all `.md` files from `examples/data/`
2. Extracts title and counts words for each document
3. Stores documents in SPARQL using RDF vocabulary:
   - `semem:Document` type
   - `rdfs:label` for title
   - `semem:content` for full text
   - `semem:wordCount` for word count
   - `semem:ingestionDate` for timestamp
4. Verifies ingestion with multiple SELECT queries:
   - Document count
   - Document details ordered by word count
   - Statistical aggregation (total, average, min/max words)
   - Content search (documents containing "climate")

**SPARQL Vocabulary:**
- **Graph URI**: `http://semem.hyperdata.it/basic-ingest`
- **Namespace**: `http://semem.hyperdata.it/vocab/`
- **Document URI pattern**: `http://semem.hyperdata.it/document/{filename-without-extension}`

**Sample Output:**
```
📊 Statistics:
  Total documents: 3
  Total words: 2530  
  Average words: 843
  Range: 663 - 1021 words

🔎 Found 2 documents containing "climate":
  🔹 urban_planning.md: "Sustainable Urban Planning in the 21st Century" (846 words)
  🔹 climate_science.md: "Climate Science and Ocean Dynamics" (663 words)
```

This example serves as a reliable foundation for understanding Semem's SPARQL integration and can be used as a starting point for building more complex semantic applications.