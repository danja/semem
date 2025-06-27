# Ragno Subsystem: Comprehensive Technical Analysis

## Overview

Ragno is a sophisticated semantic memory subsystem within Semem that implements a **heterogeneous knowledge graph** architecture. It bridges traditional semantic web technologies (RDF/SPARQL) with modern LLM capabilities to create an adaptive, intelligent memory system that can evolve and learn from experience.

The name "Ragno" (Italian for "spider") reflects its web-like graph structure and its ability to weave together different types of knowledge into a cohesive semantic memory.

## Architecture Philosophy

### Core Design Principles

1. **Heterogeneous Graph Structure**: Unlike traditional homogeneous graphs, Ragno uses multiple specialized node types, each serving distinct functions in knowledge representation and retrieval
2. **RDF-Native Design**: All components are built on RDF/SKOS standards, ensuring interoperability and semantic consistency
3. **LLM-Enhanced Content**: Leverages large language models for content generation, entity extraction, and relationship inference
4. **Multi-Modal Search**: Combines exact matching, vector similarity, and graph traversal for comprehensive retrieval
5. **Temporal Awareness**: Tracks entity evolution, access patterns, and relationship dynamics over time

### System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Ragno Knowledge Graph                        │
├─────────────────────────────────────────────────────────────────┤
│  Text Corpus → Decomposition → Augmentation → Community        │
│       ↓             ↓              ↓           Detection        │
│  Raw Documents → Semantic     → Attributes  →    Search &      │
│                  Units         Communities      Retrieval      │
│                  Entities                                       │
│                  Relationships                                  │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                 RDF/SPARQL Persistence Layer                   │
├─────────────────────────────────────────────────────────────────┤
│  SPARQLStore ↔ Graphology ↔ RagnoMemoryStore ↔ MemoryManager  │
│       ↓           ↓              ↓                ↓            │
│  Batch Sync → In-Memory → Temporal Tracking → Context Window   │
│  Transactions   Graphs     Frequency Counters   Management     │
└─────────────────────────────────────────────────────────────────┘
```

## Core RDF-Based Components

### Entity (`src/ragno/Entity.js`)

**RDF Type**: `ragno:Entity` (extends `skos:Concept`)

Entities represent named knowledge anchors in the graph - people, places, concepts, or objects that serve as central nodes for knowledge organization.

**Key Properties**:
- `skos:prefLabel`: Primary name/label
- `skos:altLabel`: Alternative names and aliases
- `ragno:isEntryPoint`: Boolean indicating if entity serves as a search starting point
- `ragno:hasSubType`: Categorization (person, location, concept, etc.)
- `semem:frequency`: Access frequency counter
- `semem:firstSeen`: Initial discovery timestamp
- `semem:lastAccessed`: Most recent access timestamp

**Temporal Features**:
```javascript
// Entity frequency tracking
entity.incrementFrequency(); // Updates counter and lastAccessed
entity.getFrequency(); // Returns current access count
entity.getFirstSeen(); // Returns initial discovery time
```

**Example RDF Structure**:
```turtle
ex:john_doe a ragno:Entity ;
    skos:prefLabel "John Doe" ;
    skos:altLabel "John", "J. Doe" ;
    ragno:isEntryPoint true ;
    ragno:hasSubType "person" ;
    semem:frequency 15 ;
    semem:firstSeen "2024-01-01T10:00:00Z"^^xsd:dateTime ;
    semem:lastAccessed "2024-06-14T15:30:00Z"^^xsd:dateTime .
```

### SemanticUnit (`src/ragno/SemanticUnit.js`)

**RDF Type**: `ragno:Unit` (extends `skos:Concept`)

Semantic units represent coherent, independent pieces of information extracted from text - typically events, facts, or complete thoughts that can stand alone.

**Key Properties**:
- `ragno:content`: Full text content of the unit
- `ragno:summary`: LLM-generated summary
- `ragno:hasSourceDocument`: Link to originating document
- `ragno:mentionsEntity`: References to entities mentioned in the unit
- `ragno:hasRelevanceScore`: Relevance score for entity mentions

**Processing Pipeline**:
1. **Text Segmentation**: LLM identifies coherent semantic boundaries
2. **Entity Extraction**: Identifies and links mentioned entities
3. **Relevance Scoring**: Calculates importance of entity mentions
4. **Summary Generation**: Creates concise summaries for large units

**Example RDF Structure**:
```turtle
ex:unit_123 a ragno:Unit ;
    ragno:content "John Doe presented the quarterly results to the board..." ;
    ragno:summary "Quarterly results presentation by John Doe" ;
    ragno:hasSourceDocument ex:doc_456 ;
    ragno:mentionsEntity ex:john_doe ;
    ragno:hasRelevanceScore 0.89 .
```

### Relationship (`src/ragno/Relationship.js`)

**RDF Type**: `ragno:Relationship` (extends `skos:Concept`)

Relationships are first-class nodes that explicitly model connections between entities, providing rich context and evidence for these connections.

**Key Properties**:
- `ragno:hasSourceEntity`: Source entity in the relationship
- `ragno:hasTargetEntity`: Target entity in the relationship
- `ragno:hasWeight`: Strength/confidence of the relationship
- `ragno:content`: Textual description of the relationship
- `ragno:hasRelationshipType`: Classification (works_with, located_in, etc.)
- `prov:wasDerivedFrom`: Evidence units supporting the relationship

**Bidirectional Creation**:
```javascript
// Creates both A→B and B→A relationships
const relationship = new Relationship({
    sourceEntity: entityA,
    targetEntity: entityB,
    content: "John works with Jane on the AI project",
    weight: 0.85
});
```

**Example RDF Structure**:
```turtle
ex:rel_789 a ragno:Relationship ;
    ragno:hasSourceEntity ex:john_doe ;
    ragno:hasTargetEntity ex:jane_smith ;
    ragno:hasWeight 0.85 ;
    ragno:content "John works with Jane on the AI project" ;
    ragno:hasRelationshipType "works_with" ;
    prov:wasDerivedFrom ex:unit_123, ex:unit_456 .
```

### Attribute (`src/ragno/Attribute.js`)

**RDF Type**: `ragno:Attribute` (extends `skos:Concept`)

Attributes are LLM-generated summaries and characteristics of important entities, providing rich contextual information for retrieval and understanding.

**Key Properties**:
- `ragno:describesEntity`: Entity being described
- `ragno:content`: Generated attribute content
- `ragno:hasAttributeType`: Category (overview, characteristics, relationships, etc.)
- `ragno:confidence`: Confidence score for the generated content
- `ragno:keywords`: Extracted keywords for search optimization
- `ragno:temporal`: Boolean indicating time-specific relevance

**Attribute Types**:
- **overview**: General description and context
- **characteristics**: Key traits and properties
- **relationships**: Important connections and associations
- **activities**: Actions and behaviors
- **context**: Environmental and situational factors

**Example RDF Structure**:
```turtle
ex:attr_345 a ragno:Attribute ;
    ragno:describesEntity ex:john_doe ;
    ragno:content "Senior software engineer specializing in AI and machine learning..." ;
    ragno:hasAttributeType "overview" ;
    ragno:confidence 0.92 ;
    ragno:keywords "engineer", "AI", "machine learning" ;
    ragno:temporal false .
```

## Key Algorithms and Processing Pipelines

### 1. Corpus Decomposition Pipeline

**Function**: `decomposeCorpus(textChunks, llmHandler, options)`

This is the primary entry point for converting raw text into structured knowledge graph elements.

**Pipeline Steps**:

1. **Semantic Unit Extraction**:
   ```javascript
   // LLM prompt for unit extraction
   const prompt = `Extract coherent semantic units from this text.
   Each unit should represent a complete thought, event, or fact.
   Return as JSON array with content and summary.`;
   ```

2. **Entity Recognition**:
   ```javascript
   // Extract entities from each unit
   const entities = await llmHandler.generateResponse(
       "Extract named entities (people, places, organizations, concepts)",
       unitContent
   );
   ```

3. **Relationship Detection**:
   ```javascript
   // Identify relationships between entities
   const relationships = await detectRelationships(entities, units);
   ```

4. **RDF Graph Construction**:
   ```javascript
   // Build complete RDF dataset
   const dataset = await buildRDFDataset(units, entities, relationships);
   ```

**Output Structure**:
```javascript
{
    units: [SemanticUnit...],
    entities: [Entity...],
    relationships: [Relationship...],
    dataset: RDF.Dataset
}
```

### 2. Attribute Augmentation Pipeline

**Function**: `augmentWithAttributes(dataset, llmHandler, options)`

Enhances important entities with LLM-generated attributes to improve retrieval and understanding.

**Importance Analysis Algorithm**:

1. **K-core Decomposition**:
   ```javascript
   // Calculate k-core values for structural importance
   const k_default = Math.floor(Math.log(nodeCount) * Math.sqrt(avgDegree));
   const kcoreValues = kcore(graph);
   ```

2. **Centrality Calculation** (for graphs ≤ 500 nodes):
   ```javascript
   // Betweenness centrality for bridge nodes
   const centrality = betweennessCentrality(graph);
   ```

3. **Hybrid Importance Scoring**:
   ```javascript
   // Weighted combination of metrics
   const importance = 
       (degree * 0.4) + 
       (kcoreNormalized * 0.4) + 
       (centralityNormalized * 0.2);
   ```

**Attribute Generation Process**:
1. Select top-K most important entities
2. Gather contextual information (connected units, relationships)
3. Generate multiple attribute types using LLM
4. Extract keywords and assign confidence scores
5. Create RDF attributes and link to evidence

### 3. Community Detection Algorithm

**Function**: `aggregateCommunities(dataset, options)`

Groups related entities and elements into communities using the Leiden algorithm.

**Leiden Clustering Process**:

1. **Graph Preparation**:
   ```javascript
   // Build adjacency matrix from RDF relationships
   const adjacencyMatrix = buildAdjacencyFromRDF(dataset);
   ```

2. **Community Detection**:
   ```javascript
   // Leiden algorithm with modularity optimization
   const communities = leiden(adjacencyMatrix, {
       resolution: 1.0,
       randomSeed: 42
   });
   ```

3. **Quality Filtering**:
   ```javascript
   // Filter communities by size and quality metrics
   const validCommunities = communities.filter(community => 
       community.size >= 3 && 
       community.modularity >= 0.1 &&
       community.cohesion >= 0.3
   );
   ```

4. **Summary Generation**:
   ```javascript
   // LLM-generated community summaries
   const summary = await llmHandler.generateResponse(
       "Create a concise summary of this community",
       communityContext
   );
   ```

### 4. Dual Search Algorithm

**Function**: `DualSearch.search(query, options)`

Combines exact matching and vector similarity for comprehensive retrieval.

**Search Strategy**:

1. **Query Processing**:
   ```javascript
   // Extract entities from natural language query
   const queryEntities = await llmHandler.extractConcepts(query);
   const queryEmbedding = await embeddingHandler.generateEmbedding(query);
   ```

2. **Parallel Search Execution**:
   ```javascript
   const [exactResults, vectorResults] = await Promise.all([
       exactSearch(queryEntities, sparqlStore),
       vectorSearch(queryEmbedding, vectorIndex)
   ]);
   ```

3. **Personalized PageRank Traversal**:
   ```javascript
   // Shallow PPR for graph discovery
   const pprResults = await personalizedPageRank(
       exactResults, 
       graph, 
       { alpha: 0.15, iterations: 2 }
   );
   ```

4. **Result Combination and Ranking**:
   ```javascript
   // Weighted scoring: Exact(1.0), Vector(0.8), PPR(0.6)
   const rankedResults = combineAndRank([
       { results: exactResults, weight: 1.0 },
       { results: vectorResults, weight: 0.8 },
       { results: pprResults, weight: 0.6 }
   ]);
   ```

## Temporal Memory Integration

### Memory Store Synchronization

**RagnoMemoryStore** (`src/stores/RagnoMemoryStore.js`) provides bidirectional synchronization between in-memory Graphology graphs and persistent SPARQL storage.

**Synchronization Pattern**:
```javascript
class RagnoMemoryStore {
    async sync() {
        // Batch process updates to minimize SPARQL calls
        const batch = this.pendingUpdates.splice(0, 50);
        
        // Group by operation type
        const updates = groupBy(batch, 'operation');
        
        // Execute in transaction
        await this.sparqlStore.transaction(async (store) => {
            await this.processBatch(updates.INSERT, store);
            await this.processBatch(updates.UPDATE, store);
            await this.processBatch(updates.DELETE, store);
        });
    }
}
```

### Temporal Tracking Mechanisms

**Entity Frequency Tracking**:
```javascript
// Automatic frequency updates on access
entity.access(); // Increments frequency, updates lastAccessed
entity.getAccessPattern(); // Returns temporal access statistics
```

**Relationship Evolution**:
```javascript
// Track relationship strength changes over time
relationship.updateWeight(newWeight, timestamp);
relationship.getWeightHistory(); // Returns temporal weight changes
```

**Community Dynamics**:
```javascript
// Monitor community membership changes
community.trackMembershipChange(entity, 'added', timestamp);
community.getStabilityMetrics(); // Returns community evolution stats
```

### Integration with Semem Memory Management

**Memory Manager Coordination**:
```javascript
class MemoryManager {
    async retrieveContext(prompt, options) {
        // Use Ragno's dual search for context retrieval
        const ragnoResults = await this.ragnoStore.search(prompt, {
            maxResults: options.maxTokens / 100,
            includeAttributes: true
        });
        
        // Combine with traditional memory items
        return this.combineContextSources(ragnoResults, memoryItems);
    }
}
```

**Context Window Management**:
```javascript
class ContextManager {
    async buildContext(prompt, windowSize) {
        // Priority-based context selection using Ragno importance scores
        const entities = await this.ragnoStore.getImportantEntities(prompt);
        const context = await this.ragnoStore.expandContext(entities, windowSize);
        
        return this.formatContextWindow(context);
    }
}
```

## RDF Vocabulary and SPARQL Integration

### Ragno Ontology Structure

**Namespace**: `http://purl.org/stuff/ragno/`

**Class Hierarchy**:
```turtle
# Core element types
ragno:Element rdfs:subClassOf skos:Concept .
ragno:Entity rdfs:subClassOf ragno:Element .
ragno:Unit rdfs:subClassOf ragno:Element .
ragno:Attribute rdfs:subClassOf ragno:Element .
ragno:Relationship rdfs:subClassOf ragno:Element .

# Collection types
ragno:Corpus rdfs:subClassOf skos:Collection .
ragno:Community rdfs:subClassOf skos:Collection .
ragno:Corpuscle rdfs:subClassOf skos:Collection .

# Specialized element types
ragno:TextElement rdfs:subClassOf ragno:Element .
ragno:CommunityElement rdfs:subClassOf ragno:Element .
ragno:IndexElement rdfs:subClassOf ragno:Element .
```

**Key Properties**:
```turtle
# Structural relationships
ragno:hasSourceEntity rdfs:domain ragno:Relationship ;
                      rdfs:range ragno:Entity .
ragno:hasTargetEntity rdfs:domain ragno:Relationship ;
                      rdfs:range ragno:Entity .
ragno:describesEntity rdfs:domain ragno:Attribute ;
                      rdfs:range ragno:Entity .

# Content properties
ragno:content rdfs:domain ragno:Element ;
              rdfs:range xsd:string .
ragno:hasWeight rdfs:domain ragno:Relationship ;
                rdfs:range xsd:decimal .
ragno:confidence rdfs:domain ragno:Attribute ;
                 rdfs:range xsd:decimal .

# Graph traversal properties
ragno:connectsTo rdfs:domain ragno:Element ;
                 rdfs:range ragno:Element .
ragno:inCommunity rdfs:domain ragno:Element ;
                  rdfs:range ragno:Community .

# Search and ranking properties
ragno:hasPPRScore rdfs:domain ragno:Element ;
                  rdfs:range xsd:decimal .
ragno:hasSimilarityScore rdfs:domain ragno:Element ;
                         rdfs:range xsd:decimal .
ragno:isEntryPoint rdfs:domain ragno:Entity ;
                   rdfs:range xsd:boolean .
```

### SPARQL Query Patterns

**Entity Retrieval by Label**:
```sparql
PREFIX ragno: <http://purl.org/stuff/ragno/>
PREFIX skos: <http://www.w3.org/2004/02/skos/core#>

SELECT ?entity ?label ?frequency WHERE {
    ?entity a ragno:Entity ;
            skos:prefLabel ?label ;
            semem:frequency ?frequency .
    FILTER(CONTAINS(LCASE(?label), LCASE(?searchTerm)))
}
ORDER BY DESC(?frequency)
LIMIT 10
```

**Relationship Traversal**:
```sparql
PREFIX ragno: <http://purl.org/stuff/ragno/>

SELECT ?target ?relationship ?weight WHERE {
    ?relationship a ragno:Relationship ;
                  ragno:hasSourceEntity ?sourceEntity ;
                  ragno:hasTargetEntity ?target ;
                  ragno:hasWeight ?weight .
    FILTER(?sourceEntity = ?givenEntity)
}
ORDER BY DESC(?weight)
```

**Attribute Retrieval with Evidence**:
```sparql
PREFIX ragno: <http://purl.org/stuff/ragno/>
PREFIX prov: <http://www.w3.org/ns/prov#>

SELECT ?attribute ?content ?confidence ?evidence WHERE {
    ?attribute a ragno:Attribute ;
               ragno:describesEntity ?entity ;
               ragno:content ?content ;
               ragno:confidence ?confidence .
    OPTIONAL {
        ?attribute prov:wasDerivedFrom ?evidence .
    }
}
ORDER BY DESC(?confidence)
```

**Community Member Retrieval**:
```sparql
PREFIX ragno: <http://purl.org/stuff/ragno/>

SELECT ?member ?type WHERE {
    ?member ragno:inCommunity ?community .
    ?member a ?type .
    FILTER(?community = ?givenCommunity)
}
```

### Batch Processing and Transactions

**Bulk Insert Pattern**:
```javascript
async function bulkInsertEntities(entities, sparqlStore) {
    const batchSize = 50;
    const batches = chunk(entities, batchSize);
    
    for (const batch of batches) {
        const insertQuery = `
            PREFIX ragno: <http://purl.org/stuff/ragno/>
            PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
            
            INSERT DATA {
                ${batch.map(entity => entity.toTurtle()).join('\n')}
            }
        `;
        
        await sparqlStore.execute(insertQuery);
    }
}
```

**Frequency Update Transaction**:
```javascript
async function updateEntityFrequency(entityURI, increment, sparqlStore) {
    const updateQuery = `
        PREFIX ragno: <http://purl.org/stuff/ragno/>
        PREFIX semem: <http://purl.org/stuff/semem/>
        
        DELETE { 
            <${entityURI}> semem:frequency ?oldFreq ;
                          semem:lastAccessed ?oldTime .
        }
        INSERT { 
            <${entityURI}> semem:frequency ?newFreq ;
                          semem:lastAccessed "${new Date().toISOString()}"^^xsd:dateTime .
        }
        WHERE {
            <${entityURI}> semem:frequency ?oldFreq ;
                          semem:lastAccessed ?oldTime .
            BIND(?oldFreq + ${increment} AS ?newFreq)
        }
    `;
    
    await sparqlStore.execute(updateQuery);
}
```

## Integration with Semem Architecture

### Storage Backend Integration

**SPARQLStore Compatibility**:
```javascript
class SPARQLStore {
    async storeRagnoElement(element) {
        // Convert Ragno element to RDF triples
        const triples = element.toRDF();
        
        // Include embedding if available
        if (element.embedding) {
            triples.push({
                subject: element.uri,
                predicate: 'semem:hasEmbedding',
                object: JSON.stringify(element.embedding)
            });
        }
        
        // Store with provenance
        await this.insertTriples(triples, element.getProvenance());
    }
}
```

**CachedSPARQLStore Optimization**:
```javascript
class CachedSPARQLStore extends SPARQLStore {
    async getRagnoEntities(query) {
        const cacheKey = `ragno:entities:${hashQuery(query)}`;
        
        // Check cache first
        let results = await this.cache.get(cacheKey);
        if (!results) {
            results = await super.getRagnoEntities(query);
            await this.cache.set(cacheKey, results, '1h');
        }
        
        return results;
    }
}
```

### LLM Integration Points

**Entity Extraction Handler**:
```javascript
class LLMHandler {
    async extractRagnoEntities(text, options = {}) {
        const prompt = `
        Extract named entities from the following text.
        Return as JSON array with format: [{"name": "entity name", "type": "person|place|organization|concept", "confidence": 0.0-1.0}]
        
        Text: ${text}
        `;
        
        const response = await this.generateResponse(prompt);
        return this.parseEntityResponse(response);
    }
    
    async generateEntityAttributes(entity, context, attributeType) {
        const prompt = `
        Generate a ${attributeType} attribute for the entity "${entity.name}".
        Context: ${context}
        
        Provide:
        1. Content: Detailed description
        2. Keywords: 3-5 relevant keywords
        3. Confidence: 0.0-1.0 confidence score
        `;
        
        return await this.generateResponse(prompt);
    }
}
```

**Relationship Detection**:
```javascript
async function detectRelationships(entities, units, llmHandler) {
    const relationships = [];
    
    for (const unit of units) {
        const entityPairs = combinations(unit.mentionedEntities, 2);
        
        for (const [entityA, entityB] of entityPairs) {
            const prompt = `
            Analyze the relationship between "${entityA.name}" and "${entityB.name}" 
            in this context: "${unit.content}"
            
            If a relationship exists, provide:
            1. Relationship type (works_with, located_in, part_of, etc.)
            2. Relationship description
            3. Confidence score (0.0-1.0)
            4. Bidirectional (true/false)
            `;
            
            const response = await llmHandler.generateResponse(prompt);
            const relationship = this.parseRelationshipResponse(response);
            
            if (relationship && relationship.confidence > 0.5) {
                relationships.push(new Relationship({
                    sourceEntity: entityA,
                    targetEntity: entityB,
                    ...relationship
                }));
            }
        }
    }
    
    return relationships;
}
```

### API and Service Integration

**SearchAPI Enhancement**:
```javascript
class SearchAPI {
    async search(query, options = {}) {
        // Use Ragno's dual search for enhanced results
        const ragnoResults = await this.ragnoStore.dualSearch(query, {
            maxResults: options.limit || 10,
            includeAttributes: true,
            includeRelationships: true
        });
        
        // Combine with traditional memory search
        const memoryResults = await this.memoryStore.search(query, options);
        
        // Merge and rank results
        return this.mergeSearchResults(ragnoResults, memoryResults);
    }
}
```

**GraphAPI Exposure**:
```javascript
class GraphAPI {
    async getEntityGraph(entityURI, depth = 2) {
        const graph = await this.ragnoStore.expandEntityGraph(entityURI, depth);
        
        return {
            nodes: graph.nodes.map(node => ({
                id: node.uri,
                type: node.type,
                label: node.prefLabel,
                attributes: node.attributes
            })),
            edges: graph.edges.map(edge => ({
                source: edge.source,
                target: edge.target,
                type: edge.type,
                weight: edge.weight
            }))
        };
    }
    
    async getCommunityStructure() {
        const communities = await this.ragnoStore.getCommunities();
        
        return communities.map(community => ({
            id: community.uri,
            summary: community.summary,
            members: community.members.length,
            keywords: community.keywords,
            modularity: community.modularity
        }));
    }
}
```

**MCP Server Integration**:
```javascript
class MCPServer {
    async handleRagnoRequest(request) {
        switch (request.method) {
            case 'ragno/search':
                return await this.ragnoStore.search(request.params.query, request.params.options);
                
            case 'ragno/decompose':
                return await decomposeCorpus(request.params.text, this.llmHandler);
                
            case 'ragno/entity':
                return await this.ragnoStore.getEntity(request.params.uri);
                
            case 'ragno/relationships':
                return await this.ragnoStore.getRelationships(request.params.entityURI);
                
            case 'ragno/communities':
                return await this.ragnoStore.getCommunities();
                
            default:
                throw new Error(`Unknown Ragno method: ${request.method}`);
        }
    }
}
```

## Performance Characteristics and Scalability

### Graph Scale Limitations

- **Centrality Analysis**: Limited to ≤500 nodes for betweenness centrality
- **Community Detection**: Efficient for graphs up to ~10,000 nodes
- **PPR Traversal**: Shallow traversal (2 iterations) for real-time performance
- **Attribute Generation**: Batch processing with configurable concurrency

### Optimization Strategies

**Batch Processing**:
- Sync operations: 50-item batches with 5-second intervals
- SPARQL queries: Bulk operations for related entities
- LLM calls: Grouped requests for similar operations

**Caching Layers**:
- Entity frequency cache: In-memory counters with periodic persistence
- Embedding cache: Vector storage with TTL expiration
- SPARQL result cache: Configurable TTL based on query patterns

**Vector Storage**:
- HNSW index: M=16, efConstruction=200, efSearch=50
- Embedding dimensions: 768 (Ollama nomic-embed-text)
- Similarity threshold: 0.7 (configurable)

## Conclusion

Ragno represents a sophisticated fusion of semantic web technologies with modern AI capabilities, creating a temporal-aware knowledge graph system that can adapt and evolve. Its integration with Semem provides a powerful foundation for intelligent agent memory that combines the precision of symbolic reasoning with the flexibility of neural processing.

Key strengths include:

1. **Semantic Interoperability**: Full RDF/SKOS compliance enables integration with other semantic systems
2. **Temporal Awareness**: Comprehensive tracking of knowledge evolution and access patterns
3. **Multi-Modal Search**: Combines exact matching, vector similarity, and graph traversal
4. **LLM Enhancement**: Automated content generation and relationship inference
5. **Scalable Architecture**: Modular design supporting various storage backends and processing scales

The system effectively bridges the gap between traditional knowledge graphs and modern language models, providing a robust platform for building intelligent systems that can learn, remember, and reason about complex information over time.