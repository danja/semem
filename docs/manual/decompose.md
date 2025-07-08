# Document Decomposition with decomposeCorpus

This document explains how semantic decomposition is integrated into the Semem document processing pipeline using the `decomposeCorpus` function from the Ragno module.

## Overview

The `Decompose.js` script applies semantic decomposition to processed document chunks, creating a knowledge graph with entities, relationships, and semantic units. This extends the document processing pipeline beyond simple concept extraction to full semantic understanding.

## Why Use LLM for Decomposition?

Even though document chunks already have concepts extracted by `ExtractConcepts.js`, `decomposeCorpus` performs additional AI-powered tasks that require natural language understanding:

### 1. Semantic Unit Extraction
- **Purpose**: Breaks down text chunks into independent semantic units
- **LLM Task**: Identifies "complete thoughts, events, or concepts that can stand alone"
- **Output**: Array of semantic unit texts that are more granular than original chunks
- **Fallback**: Simple sentence splitting if LLM fails

```javascript
// Example LLM prompt for semantic unit extraction
const prompt = `Break down the following text into independent semantic units. Each unit should represent a complete thought, event, or concept that can stand alone. Return as a JSON array of strings.

Text: "${text}"

Return format: ["unit1", "unit2", "unit3"]`
```

### 2. Entity Extraction with Properties
- **Purpose**: Extracts entities (people, places, organizations, concepts) from each semantic unit
- **LLM Task**: Determines entity type, relevance score, confidence, and whether it's an "entry point"
- **Output**: Structured entity data with semantic properties
- **Fallback**: Regex pattern matching for capitalized words

```javascript
// Example LLM prompt for entity extraction
const prompt = `Extract the key entities (people, places, organizations, concepts) from this text. For each entity, provide name, type, relevance score (0-1), and whether it's an entry point (important/central entity).

Text: "${unitText}"

Return as JSON array:
[{"name": "entity1", "type": "person", "relevance": 0.9, "isEntryPoint": true, "confidence": 0.8}]`
```

### 3. Relationship Extraction
- **Purpose**: Identifies relationships between entities within the same semantic unit
- **LLM Task**: Determines relationship type, weight, and descriptive content
- **Output**: Relationship graph connecting entities
- **Scope**: Only processes units that contain multiple entities

```javascript
// Example LLM prompt for relationship extraction
const prompt = `Identify relationships between these entities in the given text. Return relationships as JSON array with source, target, type, content, and weight (0-1).

Entities: ["Entity1", "Entity2", "Entity3"]
Text: "${unit.getContent()}"

Return format:
[{"source": "Entity1", "target": "Entity2", "type": "collaborates_with", "content": "relationship description", "weight": 0.8}]`
```

## Difference from Concept Extraction

| Aspect | ExtractConcepts.js | Decompose.js |
|--------|-------------------|--------------|
| **Purpose** | Topic labeling | Knowledge graph construction |
| **Output** | Concept labels grouped in corpuscles | Entities with relationships and semantic units |
| **Granularity** | Chunk-level concepts | Sub-chunk semantic units with entity mentions |
| **Relationships** | None | Explicit entity-to-entity relationships |
| **Structure** | Flat concept lists | Hierarchical knowledge graph |
| **Use Case** | Content categorization | Semantic reasoning and inference |

## Integration with Document Pipeline

The decomposition step fits into the document processing workflow as follows:

```
1. LoadPDFs.js      → Documents and text elements
2. ChunkDocuments.js → Semantic chunks with OLO indexing
3. MakeEmbeddings.js → Vector embeddings for similarity search
4. ExtractConcepts.js → Concept labels and corpuscle collections
5. Decompose.js     → Knowledge graph with entities and relationships ← NEW
6. Query/Analysis   → Complete semantic understanding
```

## Prerequisites

Before running `Decompose.js`, ensure:

1. **Chunks have embeddings** - Run `MakeEmbeddings.js` first
2. **Chunks have concepts** - Run `ExtractConcepts.js` first
3. **LLM provider configured** - Mistral, Claude, or Ollama with appropriate model
4. **SPARQL endpoint** - For storing RDF results

## RDF Structure Created

The decomposition process creates the following RDF structures:

### Semantic Units
```turtle
<http://purl.org/stuff/instance/unit_0_0> a ragno:SemanticUnit ;
    rdfs:label "First semantic unit" ;
    ragno:content "Independent semantic content..." ;
    ragno:summary "Summary of the unit" ;
    prov:wasDerivedFrom <http://purl.org/stuff/instance/chunk-abcd1234> ;
    ragno:hasEntityMention <http://purl.org/stuff/instance/entity-xyz> .
```

### Entities with Properties
```turtle
<http://purl.org/stuff/instance/entity-xyz> a ragno:Entity ;
    rdfs:label "machine learning" ;
    ragno:subType "concept" ;
    ragno:isEntryPoint true ;
    ragno:confidence 0.8 ;
    ragno:relevance 0.9 ;
    ragno:frequency 3 .
```

### Relationships
```turtle
<http://purl.org/stuff/instance/rel_0> a ragno:Relationship ;
    ragno:hasSource <http://purl.org/stuff/instance/entity-xyz> ;
    ragno:hasTarget <http://purl.org/stuff/instance/entity-abc> ;
    ragno:relationshipType "related" ;
    ragno:weight 0.8 ;
    ragno:content "Relationship description" ;
    ragno:bidirectional false .
```

### Processing Markers
```turtle
# Mark chunks as having semantic units
<http://purl.org/stuff/instance/chunk-abcd1234> semem:hasSemanticUnits true .
```

## Configuration Options

The decomposition process accepts several options:

```javascript
const decompositionResults = await decomposeCorpus(textChunks, llmHandler, {
    extractRelationships: true,        // Enable relationship extraction
    generateSummaries: true,           // Generate unit summaries
    minEntityConfidence: 0.4,          // Minimum confidence threshold
    maxEntitiesPerUnit: 15,            // Maximum entities per semantic unit
    chunkOverlap: 0.1                  // Overlap between adjacent units
});
```

## Usage Examples

### Basic Usage
```bash
# Process all ready chunks
node examples/document/Decompose.js

# Process limited number of chunks
node examples/document/Decompose.js --limit 10

# Use specific graph
node examples/document/Decompose.js --graph "http://example.org/docs"
```

### Programmatic Usage
```javascript
import { decomposeCorpus } from './src/ragno/decomposeCorpus.js';
import LLMHandler from './src/handlers/LLMHandler.js';

const textChunks = [
    { content: "Text content...", source: "chunk-uri" }
];

const results = await decomposeCorpus(textChunks, llmHandler);
console.log(`Created ${results.units.length} semantic units`);
console.log(`Found ${results.entities.length} entities`);
console.log(`Discovered ${results.relationships.length} relationships`);
```

## Performance Considerations

- **LLM calls**: Each chunk requires multiple LLM calls (units, entities, relationships)
- **Processing time**: Proportional to number of chunks and their complexity
- **Token usage**: Monitor LLM token consumption for cost management
- **Memory usage**: Large datasets may require chunked processing

## Error Handling

The decomposition process includes comprehensive fallbacks:

1. **LLM failures**: Falls back to rule-based extraction methods
2. **Parse errors**: Uses ParseHelper for response cleaning
3. **Network issues**: Retries with exponential backoff
4. **SPARQL errors**: Detailed error reporting with troubleshooting hints

## Troubleshooting

Common issues and solutions:

### No chunks found for processing
- Ensure MakeEmbeddings.js and ExtractConcepts.js have run successfully
- Check SPARQL queries are finding the expected data
- Verify graph URI matches configuration

### LLM connection failures
- Check LLM provider configuration and API keys
- Verify Ollama service is running (for local deployment)
- Test connectivity to remote LLM services

### Memory issues with large datasets
- Use `--limit` parameter to process chunks in batches
- Monitor system memory during processing
- Consider increasing Node.js heap size: `--max-old-space-size=8192`

### SPARQL storage errors
- Verify SPARQL endpoint is accessible and has write permissions
- Check authentication credentials
- Ensure sufficient disk space for RDF storage

## SPARQL Queries for Analysis

After decomposition, use these queries to analyze results:

### Semantic Units Overview
```sparql
PREFIX ragno: <http://purl.org/stuff/ragno/>
PREFIX semem: <http://semem.hyperdata.it/>

SELECT ?textElement (COUNT(?unit) AS ?semanticUnits) WHERE {
    GRAPH <http://tensegrity.it/semem> {
        ?textElement semem:hasSemanticUnits true .
        ?unit a ragno:SemanticUnit ;
              prov:wasDerivedFrom ?textElement .
    }
}
GROUP BY ?textElement
```

### Entity Relationships
```sparql
PREFIX ragno: <http://purl.org/stuff/ragno/>

SELECT ?entity1 ?relationship ?entity2 ?weight WHERE {
    GRAPH <http://tensegrity.it/semem> {
        ?rel a ragno:Relationship ;
             ragno:hasSource ?entity1 ;
             ragno:hasTarget ?entity2 ;
             ragno:relationshipType ?relationship ;
             ragno:weight ?weight .
    }
}
ORDER BY DESC(?weight)
```

### Knowledge Graph Statistics
```sparql
PREFIX ragno: <http://purl.org/stuff/ragno/>

SELECT 
    (COUNT(DISTINCT ?unit) AS ?totalUnits)
    (COUNT(DISTINCT ?entity) AS ?totalEntities) 
    (COUNT(DISTINCT ?relationship) AS ?totalRelationships)
WHERE {
    GRAPH <http://tensegrity.it/semem> {
        ?unit a ragno:SemanticUnit .
        ?entity a ragno:Entity .
        ?relationship a ragno:Relationship .
    }
}
```

## See Also

- [Document Processing Pipeline](../examples/document/README.md)
- [Ragno Ontology](ragno-rdf.md)
- [LLM Configuration](provider-config.md)
- [SPARQL Storage](../manual/config.md)