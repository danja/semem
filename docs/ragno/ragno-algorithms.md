# Ragno Graph Algorithms Documentation

## Overview

This document translates NodeRAG algorithms into Ragno ontology terminology, providing implementation-ready specifications for graph-based knowledge retrieval.

## 1. Graph Decomposition

### Algorithm: Corpus Decomposition
Transforms text into initial heterogeneous graph structure.

**Input:** Text chunks  
**Output:** Graph G₁ containing ragno:Unit, ragno:Entity, and ragno:Relationship instances

```
PROCEDURE decomposeCorpus(textChunks):
    G₀ = empty graph
    
    FOR EACH chunk IN textChunks:
        // Extract semantic units
        units = LLM.extractSemanticUnits(chunk)
        
        FOR EACH unit IN units:
            // Create ragno:Unit instance
            unitNode = createNode(type: ragno:Unit)
            unitNode.ragno:content = unit.text
            unitNode.skos:prefLabel = unit.summary
            unitNode.ragno:hasSourceDocument = chunk.source
            
            // Extract entities from unit
            entities = LLM.extractEntities(unit)
            FOR EACH entity IN entities:
                entityNode = findOrCreateNode(
                    type: ragno:Entity,
                    skos:prefLabel: entity.name
                )
                entityNode.ragno:isEntryPoint = true
                
                // Connect entity to unit
                createEdge(entityNode, unitNode, ragno:hasUnit)
            
            // Extract relationships
            relationships = LLM.extractRelationships(unit)
            FOR EACH rel IN relationships:
                relNode = createNode(type: ragno:Relationship)
                relNode.ragno:content = rel.description
                relNode.ragno:hasSourceEntity = rel.source
                relNode.ragno:hasTargetEntity = rel.target
                
                // Connect to entities
                createEdge(rel.source, relNode, skos:related)
                createEdge(relNode, rel.target, skos:related)
    
    RETURN G₁ = G₀ ∪ {all created nodes and edges}
```

## 2. Graph Augmentation

### 2.1 Node Importance Based Augmentation

**Algorithm:** Important Entity Attribute Generation

```
PROCEDURE augmentWithAttributes(G₁):
    // Select important entities
    N* = selectImportantEntities(G₁)
    
    FOR EACH entity IN N*:
        // Gather context
        units = getConnectedNodes(entity, ragno:hasUnit)
        relationships = getConnectedNodes(entity, ragno:Relationship)
        
        // Generate attribute summary
        attributeContent = LLM.generateAttributeSummary(
            entity, units, relationships
        )
        
        // Create attribute node
        attrNode = createNode(type: ragno:Attribute)
        attrNode.ragno:content = attributeContent
        attrNode.skos:prefLabel = f"{entity.label} attributes"
        
        // Connect to entity
        createEdge(entity, attrNode, ragno:hasAttribute)
    
    RETURN G₂ = G₁ ∪ {attribute nodes and edges}

FUNCTION selectImportantEntities(G):
    k_default = floor(log(|V|) × sqrt(avgDegree(G)))
    K_core = {v ∈ V | degree(v) ≥ k_default}
    
    // Betweenness centrality
    B_centrality = {}
    FOR EACH v IN V:
        B_centrality[v] = betweennessCentrality(G, v, samples=10)
    
    avg_betweenness = mean(B_centrality.values())
    scale = floor(log10(|V|))
    B_important = {v | B_centrality[v] > avg_betweenness × scale}
    
    RETURN K_core ∪ B_important
```

### 2.2 Community Detection Based Aggregation

**Algorithm:** Community Element Generation

```
PROCEDURE aggregateCommunities(G₂):
    // Detect communities using Leiden algorithm
    communities = leidenClustering(G₂)
    
    FOR EACH community IN communities:
        // Aggregate community content
        communityContent = aggregateNodeContent(community.nodes)
        
        // Generate community insights
        insights = LLM.extractCommunityInsights(communityContent)
        
        FOR EACH insight IN insights:
            // Create community element
            commElem = createNode(type: ragno:CommunityElement)
            commElem.ragno:content = insight.content
            commElem.skos:prefLabel = insight.title
            
            // Create overview (non-retrievable index)
            overview = createNode(type: ragno:Attribute)
            overview.ragno:subType = ex:Overview
            overview.ragno:content = insight.keywords
            overview.skos:prefLabel = insight.title
            overview.ragno:isEntryPoint = true
            
            // Connect overview to community element
            createEdge(overview, commElem, skos:related)
            
            // Semantic matching within community
            relatedNodes = semanticMatchingInCommunity(
                commElem, community.nodes
            )
            
            FOR EACH node IN relatedNodes:
                createEdge(node, commElem, ragno:connectsTo)
    
    RETURN G₃ = G₂ ∪ {community elements and connections}
```

## 3. Graph Enrichment

### 3.1 Text Element Insertion

```
PROCEDURE insertTextElements(G₃, originalChunks):
    FOR EACH chunk IN originalChunks:
        // Create text element
        textElem = createNode(type: ragno:TextElement)
        textElem.ragno:content = chunk.text
        textElem.skos:prefLabel = f"Text chunk {chunk.id}"
        textElem.ragno:hasSourceDocument = chunk.source
        
        // Connect to relevant units
        relevantUnits = findRelevantUnits(G₃, chunk)
        FOR EACH unit IN relevantUnits:
            createEdge(unit, textElem, ragno:hasTextElement)
    
    RETURN G₄ = G₃ ∪ {text elements and edges}
```

### 3.2 Embedding Generation

```
PROCEDURE generateEmbeddings(G₄):
    // Select retrievable nodes for embedding
    retrievableTypes = [ragno:TextElement, ragno:Attribute, 
                       ragno:Unit, ragno:CommunityElement]
    
    FOR EACH node IN G₄.nodes:
        IF node.type IN retrievableTypes:
            node.embedding = generateEmbedding(node.ragno:content)
```

### 3.3 HNSW Semantic Edge Construction

```
PROCEDURE buildHNSWEdges(G₄):
    // Build HNSW index
    embeddedNodes = {n | n ∈ G₄.nodes AND hasEmbedding(n)}
    hnswIndex = HNSW.build(embeddedNodes)
    
    // Extract base layer connections
    L₀ = hnswIndex.getBaseLayer()
    
    // Add semantic edges to graph
    FOR EACH edge IN L₀.edges:
        existingEdge = G₄.getEdge(edge.source, edge.target)
        IF existingEdge EXISTS:
            existingEdge.ragno:hasWeight += 1
        ELSE:
            semanticEdge = createEdge(
                edge.source, edge.target, 
                ragno:connectsTo
            )
            semanticEdge.ragno:hasWeight = 1
            semanticEdge.ragno:subType = ex:SemanticEdge
    
    RETURN G₅ = G₄ ∪ L₀
```

## 4. Graph Searching

### 4.1 Dual Search

```
PROCEDURE dualSearch(G, query):
    // Extract entities from query
    queryEntities = LLM.extractEntities(query)
    queryEmbedding = generateEmbedding(query)
    
    entryPoints = []
    
    // Exact matching for entities and overviews
    FOR EACH node IN G.nodes:
        IF node.type IN [ragno:Entity, ragno:Attribute]:
            IF node.ragno:subType == ex:Overview:
                IF exactMatch(queryEntities, node.skos:prefLabel):
                    entryPoints.add(node)
    
    // Vector similarity for content nodes
    retrievableTypes = [ragno:Unit, ragno:Attribute, 
                       ragno:CommunityElement]
    candidates = {n | n.type IN retrievableTypes}
    
    topK = HNSW.search(queryEmbedding, candidates, k=10)
    entryPoints.extend(topK)
    
    RETURN entryPoints
```

### 4.2 Shallow Personalized PageRank

```
PROCEDURE shallowPPR(G, entryPoints, α=0.5, iterations=2):
    // Initialize PPR vector
    p = zeros(|G.nodes|)
    FOR EACH node IN entryPoints:
        p[node] = 1.0 / |entryPoints|
    
    // Normalized adjacency matrix
    P = normalizedAdjacency(G)
    
    // Iterative PPR computation
    π = p
    FOR i IN 1..iterations:
        π = α × p + (1 - α) × P^T × π
    
    // Select top-k nodes per type
    crossNodes = []
    FOR EACH nodeType IN G.nodeTypes:
        typeNodes = {n | n.type == nodeType}
        topKType = selectTopK(typeNodes, π, k=5)
        crossNodes.extend(topKType)
    
    RETURN crossNodes
```

### 4.3 Filter Retrieval Nodes

```
PROCEDURE filterRetrievalNodes(entryPoints, crossNodes):
    allNodes = entryPoints ∪ crossNodes
    
    // Define retrievable types
    retrievableTypes = [ragno:TextElement, ragno:Unit, 
                       ragno:Attribute, ragno:CommunityElement, 
                       ragno:Relationship]
    
    retrievalNodes = []
    FOR EACH node IN allNodes:
        IF node.type IN retrievableTypes:
            retrievalNodes.add(node)
    
    RETURN retrievalNodes
```

## Implementation Notes

### LLM Integration Points
- Semantic unit extraction
- Entity and relationship extraction  
- Attribute summary generation
- Community insight generation
- Query entity extraction

### Graph Algorithm Requirements
- K-core decomposition
- Betweenness centrality
- Leiden clustering
- HNSW indexing
- Personalized PageRank

### Performance Considerations
- Batch LLM calls where possible
- Cache entity lookups
- Parallelize community processing
- Use approximate algorithms for large graphs