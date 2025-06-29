# NodeRAG Algorithms for Ragno Implementation (Node.js ES Modules)

This document provides comprehensive descriptions of the algorithms used in NodeRAG, translated to use Ragno ontology terms for implementation by developers working with Ragno-structured knowledge stores using Node.js ES modules.

## NodeRAG to Ragno Term Mapping

| NodeRAG Term | Ragno Term | Description |
|--------------|------------|-------------|
| T (Text) | `ragno:TextElement` | Original text chunks from source documents |
| S (Semantic Unit) | `ragno:Unit` | Independent semantic events summarized from text |
| A (Attribute) | `ragno:Attribute` | Properties of important entities |
| H (High-Level Element) | `ragno:CommunityElement` | Community-level insights and summaries |
| O (High Level Overview) | `ragno:Attribute` | Titles/keywords (non-retrievable, entry points) |
| R (Relationship) | `ragno:Relationship` | First-class relationship nodes between entities |
| N (Entity) | `ragno:Entity` | Named entities (non-retrievable, entry points) |

## 1. K-core Decomposition Algorithm

### Purpose
Identifies structurally important entities that are central to graph cohesion by finding nodes in densely connected subgraphs.

### Ragno Implementation

```javascript
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

/**
 * Identifies important ragno:Entity nodes based on k-core decomposition.
 * @param {RagnoGraph} ragnoGraph - Graph containing ragno elements
 * @returns {Set<string>} Set of important ragno:Entity URIs
 */
export function kCoreDecomposition(ragnoGraph) {
    // Get all ragno:Entity nodes
    const entityNodes = ragnoGraph.getNodesByType('ragno:Entity');
    
    // Calculate default k threshold
    const totalNodes = ragnoGraph.nodeCount();
    const avgDegree = ragnoGraph.nodes()
        .reduce((sum, node) => sum + ragnoGraph.degree(node), 0) / totalNodes;
    const kDefault = Math.floor(Math.log(totalNodes) * Math.sqrt(avgDegree));
    
    // Extract k-core subgraph
    const importantEntities = new Set();
    
    for (const entity of entityNodes) {
        // Count connections to ragno:Unit and ragno:Relationship nodes
        const neighbors = ragnoGraph.neighbors(entity);
        const relevantDegree = neighbors.filter(neighbor => {
            const nodeType = ragnoGraph.getNodeType(neighbor);
            return ['ragno:Unit', 'ragno:Relationship'].includes(nodeType);
        }).length;
        
        if (relevantDegree >= kDefault) {
            importantEntities.add(entity);
        }
    }
    
    return importantEntities;
}
```

### Key Considerations
- Focus on connections between `ragno:Entity` nodes and `ragno:Unit`/`ragno:Relationship` nodes
- The k-core identifies entities that are structurally central to the knowledge graph
- These entities will later have `ragno:Attribute` nodes generated for them

## 2. Betweenness Centrality Algorithm

### Purpose
Identifies entities that serve as critical bridges for information flow between different parts of the knowledge graph.

### Ragno Implementation

```javascript
/**
 * Identifies important ragno:Entity nodes based on betweenness centrality.
 * @param {RagnoGraph} ragnoGraph - Graph containing ragno elements
 * @returns {Set<string>} Set of important ragno:Entity URIs
 */
export function betweennessCentralitySelection(ragnoGraph) {
    const entityNodes = ragnoGraph.getNodesByType('ragno:Entity');
    const allNodes = ragnoGraph.nodes();
    
    // Calculate betweenness centrality using shortest-path sampling
    const centralityScores = new Map();
    
    for (const entity of entityNodes) {
        // Use approximate betweenness centrality (k=10 samples)
        const sampleSize = Math.min(10, allNodes.length);
        const sources = sampleNodes(allNodes, sampleSize);
        const targets = sampleNodes(allNodes, sampleSize);
        
        const centrality = approximateBetweennessCentrality(
            ragnoGraph, entity, sources, targets
        );
        centralityScores.set(entity, centrality);
    }
    
    // Calculate threshold
    const scores = Array.from(centralityScores.values());
    const avgCentrality = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    const scaleFactor = Math.floor(Math.log10(allNodes.length));
    const threshold = avgCentrality * scaleFactor;
    
    // Select high-centrality entities
    const importantEntities = new Set();
    for (const [entity, score] of centralityScores) {
        if (score > threshold) {
            importantEntities.add(entity);
        }
    }
    
    return importantEntities;
}

/**
 * Randomly samples nodes from array
 * @param {Array} nodes - Array of node URIs
 * @param {number} sampleSize - Number of nodes to sample
 * @returns {Array} Sampled nodes
 */
function sampleNodes(nodes, sampleSize) {
    const shuffled = [...nodes].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, sampleSize);
}

/**
 * Approximates betweenness centrality for a specific node
 * @param {RagnoGraph} graph - The graph
 * @param {string} targetNode - Node to calculate centrality for
 * @param {Array} sources - Source nodes for sampling
 * @param {Array} targets - Target nodes for sampling
 * @returns {number} Approximated betweenness centrality
 */
function approximateBetweennessCentrality(graph, targetNode, sources, targets) {
    let centralityScore = 0;
    let pathCount = 0;
    
    for (const source of sources) {
        for (const target of targets) {
            if (source !== target) {
                const shortestPaths = graph.findShortestPaths(source, target);
                const pathsThroughNode = shortestPaths.filter(path => 
                    path.includes(targetNode)
                );
                
                if (shortestPaths.length > 0) {
                    centralityScore += pathsThroughNode.length / shortestPaths.length;
                    pathCount++;
                }
            }
        }
    }
    
    return pathCount > 0 ? centralityScore / pathCount : 0;
}
```

### Key Considerations
- Measures how often `ragno:Entity` nodes lie on shortest paths between other nodes
- Identifies entities that connect different regions of the knowledge graph
- Combined with k-core results to get comprehensive set of important entities

## 3. Attribute Generation for Important Entities

### Purpose
Creates `ragno:Attribute` nodes for important entities by summarizing their connected `ragno:Unit` and `ragno:Relationship` nodes.

### Ragno Implementation

```javascript
/**
 * Generates ragno:Attribute nodes for important ragno:Entity instances.
 * @param {RagnoGraph} ragnoGraph - The knowledge graph
 * @param {Set<string>} importantEntities - Set of important ragno:Entity URIs
 * @param {LLMService} llmService - Service for LLM-based summarization
 * @returns {Promise<Map<string, string>>} Map of ragno:Entity to ragno:Attribute URIs
 */
export async function generateEntityAttributes(ragnoGraph, importantEntities, llmService) {
    const entityAttributes = new Map();
    
    for (const entity of importantEntities) {
        // Gather connected ragno:Unit and ragno:Relationship nodes
        const connectedUnits = [];
        const connectedRelationships = [];
        
        const neighbors = ragnoGraph.neighbors(entity);
        for (const neighbor of neighbors) {
            const nodeType = ragnoGraph.getNodeType(neighbor);
            const content = ragnoGraph.getNodeContent(neighbor);
            
            if (nodeType === 'ragno:Unit') {
                connectedUnits.push(content);
            } else if (nodeType === 'ragno:Relationship') {
                connectedRelationships.push(content);
            }
        }
        
        // Generate attribute summary using LLM
        const context = {
            entity: ragnoGraph.getNodeContent(entity),
            semanticUnits: connectedUnits,
            relationships: connectedRelationships
        };
        
        const attributeContent = await llmService.generateEntitySummary(context);
        
        // Create ragno:Attribute node
        const attributeUri = ragnoGraph.createNode({
            type: 'ragno:Attribute',
            content: attributeContent,
            prefLabel: `${ragnoGraph.getPrefLabel(entity)} Attributes`
        });
        
        // Connect entity to attribute using ragno:hasAttribute
        ragnoGraph.addTriple(entity, 'ragno:hasAttribute', attributeUri);
        
        entityAttributes.set(entity, attributeUri);
    }
    
    return entityAttributes;
}
```

## 4. Community Detection (Leiden Algorithm)

### Purpose
Identifies communities in the graph for generating `ragno:CommunityElement` nodes that provide high-level insights.

### Ragno Implementation

```javascript
import { LeidenAlgorithm } from 'leiden-algorithm';

/**
 * Performs community detection using Leiden algorithm on ragno graph.
 * @param {RagnoGraph} ragnoGraph - The knowledge graph
 * @returns {Map<string, Set<string>>} Map of community ID to member node URIs
 */
export function detectCommunities(ragnoGraph) {
    // Prepare graph for community detection
    const nodes = ragnoGraph.nodes();
    const edges = ragnoGraph.edges();
    
    // Create adjacency matrix representation
    const nodeIndex = new Map();
    nodes.forEach((node, i) => nodeIndex.set(node, i));
    
    const adjacencyMatrix = Array(nodes.length).fill(null)
        .map(() => Array(nodes.length).fill(0));
    
    for (const [source, target] of edges) {
        const sourceIdx = nodeIndex.get(source);
        const targetIdx = nodeIndex.get(target);
        adjacencyMatrix[sourceIdx][targetIdx] = 1;
        adjacencyMatrix[targetIdx][sourceIdx] = 1;
    }
    
    // Run Leiden algorithm
    const leiden = new LeidenAlgorithm();
    const communities = leiden.findCommunities(adjacencyMatrix);
    
    // Convert back to ragno node URIs
    const communityMap = new Map();
    communities.forEach((communityId, nodeIdx) => {
        const nodeUri = nodes[nodeIdx];
        if (!communityMap.has(communityId)) {
            communityMap.set(communityId, new Set());
        }
        communityMap.get(communityId).add(nodeUri);
    });
    
    return communityMap;
}

/**
 * Generates ragno:CommunityElement nodes for detected communities.
 * @param {RagnoGraph} ragnoGraph - The knowledge graph
 * @param {Map<string, Set<string>>} communities - Community assignments
 * @param {LLMService} llmService - Service for LLM-based summarization
 * @returns {Promise<Map<string, string>>} Map of community ID to ragno:CommunityElement URI
 */
export async function generateCommunityElements(ragnoGraph, communities, llmService) {
    const communityElements = new Map();
    
    for (const [communityId, memberNodes] of communities) {
        // Gather content from community members
        const memberContent = [];
        for (const node of memberNodes) {
            const nodeType = ragnoGraph.getNodeType(node);
            if (['ragno:Unit', 'ragno:Attribute', 'ragno:Relationship'].includes(nodeType)) {
                memberContent.push(ragnoGraph.getNodeContent(node));
            }
        }
        
        // Generate high-level summary using LLM
        const summary = await llmService.generateCommunitySummary(memberContent);
        
        // Create ragno:CommunityElement
        const communityElementUri = ragnoGraph.createNode({
            type: 'ragno:CommunityElement',
            content: summary,
            prefLabel: `Community ${communityId} Summary`
        });
        
        // Create ragno:Community collection
        const communityUri = ragnoGraph.createNode({
            type: 'ragno:Community',
            prefLabel: `Community ${communityId}`
        });
        
        // Link community element to community
        ragnoGraph.addTriple(communityUri, 'ragno:hasCommunityElement', communityElementUri);
        
        // Add members to community
        for (const member of memberNodes) {
            ragnoGraph.addTriple(member, 'ragno:inCommunity', communityUri);
        }
        
        communityElements.set(communityId, communityElementUri);
    }
    
    return communityElements;
}
```

## 5. Semantic Matching within Community

### Purpose
Establishes semantic connections between `ragno:CommunityElement` nodes and related `ragno:Unit`/`ragno:Attribute` nodes within the same community.

### Ragno Implementation

```javascript
import { KMeans } from 'ml-kmeans';

/**
 * Performs semantic matching within communities using K-means clustering.
 * @param {RagnoGraph} ragnoGraph - The knowledge graph
 * @param {EmbeddingService} embeddingService - Service for generating embeddings
 * @param {Map<string, Set<string>>} communities - Community assignments
 * @returns {Promise<void>}
 */
export async function semanticMatchingWithinCommunity(ragnoGraph, embeddingService, communities) {
    // Get nodes eligible for semantic matching
    const eligibleNodes = ragnoGraph.nodes().filter(node => {
        const nodeType = ragnoGraph.getNodeType(node);
        return ['ragno:Unit', 'ragno:Attribute', 'ragno:CommunityElement'].includes(nodeType);
    });
    
    // Generate embeddings for eligible nodes
    const nodeEmbeddings = new Map();
    for (const node of eligibleNodes) {
        const content = ragnoGraph.getNodeContent(node);
        const embedding = await embeddingService.getEmbedding(content);
        nodeEmbeddings.set(node, embedding);
    }
    
    // Calculate number of clusters
    const k = Math.floor(Math.sqrt(eligibleNodes.length));
    
    // Prepare data for K-means
    const embeddings = Array.from(nodeEmbeddings.values());
    const nodeUris = Array.from(nodeEmbeddings.keys());
    
    // Perform K-means clustering
    const kmeans = new KMeans(embeddings, k);
    const clusters = kmeans.clusters;
    
    // Group nodes by cluster and community
    const clusterMap = new Map();
    clusters.forEach((clusterId, nodeIdx) => {
        const nodeUri = nodeUris[nodeIdx];
        if (!clusterMap.has(clusterId)) {
            clusterMap.set(clusterId, []);
        }
        clusterMap.get(clusterId).push(nodeUri);
    });
    
    // Establish semantic edges within communities
    for (const [communityId, communityMembers] of communities) {
        for (const [clusterId, clusterMembers] of clusterMap) {
            // Find nodes that are in both the same community and cluster
            const intersection = clusterMembers.filter(node => 
                communityMembers.has(node)
            );
            
            if (intersection.length > 1) {
                // Connect ragno:Unit and ragno:Attribute nodes to ragno:CommunityElement nodes
                const units = intersection.filter(node => 
                    ragnoGraph.getNodeType(node) === 'ragno:Unit'
                );
                const attributes = intersection.filter(node => 
                    ragnoGraph.getNodeType(node) === 'ragno:Attribute'
                );
                const communityElements = intersection.filter(node => 
                    ragnoGraph.getNodeType(node) === 'ragno:CommunityElement'
                );
                
                // Create semantic connections
                for (const communityElement of communityElements) {
                    for (const unit of units) {
                        ragnoGraph.addTriple(unit, 'ragno:connectsTo', communityElement);
                    }
                    for (const attribute of attributes) {
                        ragnoGraph.addTriple(attribute, 'ragno:connectsTo', communityElement);
                    }
                }
            }
        }
    }
}
```

## 6. HNSW Semantic Edges Integration

### Purpose
Integrates Hierarchical Navigable Small World (HNSW) algorithm to add semantic similarity edges between nodes with rich content.

### Ragno Implementation

```javascript
import { HierarchicalNSW } from 'hnswlib-node';

/**
 * Integrates HNSW semantic edges into the ragno graph.
 * @param {RagnoGraph} ragnoGraph - The knowledge graph
 * @param {EmbeddingService} embeddingService - Service for generating embeddings
 * @returns {Promise<void>}
 */
export async function integrateHNSWSemanticEdges(ragnoGraph, embeddingService) {
    // Get nodes suitable for embedding
    const embeddableNodes = ragnoGraph.nodes().filter(node => {
        const nodeType = ragnoGraph.getNodeType(node);
        return ['ragno:TextElement', 'ragno:Attribute', 'ragno:Unit', 'ragno:CommunityElement']
            .includes(nodeType);
    });
    
    if (embeddableNodes.length === 0) return;
    
    // Generate embeddings
    const embeddings = [];
    const nodeMap = new Map();
    
    for (let i = 0; i < embeddableNodes.length; i++) {
        const node = embeddableNodes[i];
        const content = ragnoGraph.getNodeContent(node);
        const embedding = await embeddingService.getEmbedding(content);
        
        embeddings.push(embedding);
        nodeMap.set(i, node);
    }
    
    // Initialize HNSW index
    const dimension = embeddings[0].length;
    const maxElements = embeddableNodes.length;
    const hnswIndex = new HierarchicalNSW('cosine', dimension);
    hnswIndex.initIndex(maxElements);
    
    // Add embeddings to HNSW index
    for (let i = 0; i < embeddings.length; i++) {
        hnswIndex.addPoint(embeddings[i], i);
    }
    
    // Extract base layer (L0) connections
    const k = Math.min(10, embeddableNodes.length - 1); // Number of neighbors to consider
    
    for (let i = 0; i < embeddableNodes.length; i++) {
        const neighbors = hnswIndex.searchKnn(embeddings[i], k + 1); // +1 because it includes self
        const sourceNode = nodeMap.get(i);
        
        for (const neighborResult of neighbors) {
            const neighborIdx = neighborResult.label;
            if (neighborIdx !== i) { // Skip self-connection
                const targetNode = nodeMap.get(neighborIdx);
                const similarity = 1 - neighborResult.distance; // Convert distance to similarity
                
                // Add semantic edge with weight
                ragnoGraph.addTriple(sourceNode, 'ragno:connectsTo', targetNode, {
                    weight: similarity,
                    type: 'semantic'
                });
            }
        }
    }
}
```

## 7. Dual Search Algorithm

### Purpose
Implements entry point identification using both exact matching for entity names and vector similarity for rich content nodes.

### Ragno Implementation

```javascript
/**
 * Performs dual search to identify entry points in the ragno graph.
 * @param {RagnoGraph} ragnoGraph - The knowledge graph
 * @param {string} query - User query
 * @param {LLMService} llmService - Service for entity extraction
 * @param {EmbeddingService} embeddingService - Service for vector similarity
 * @param {number} k - Number of similar nodes to retrieve
 * @returns {Promise<Set<string>>} Set of entry point node URIs
 */
export async function dualSearch(ragnoGraph, query, llmService, embeddingService, k = 5) {
    const entryPoints = new Set();
    
    // Extract entities from query using LLM
    const extractedEntities = await llmService.extractEntities(query);
    
    // Exact matching for ragno:Entity and title-like ragno:Attribute nodes
    const entityNodes = ragnoGraph.getNodesByType('ragno:Entity');
    const titleAttributes = ragnoGraph.nodes().filter(node => {
        const nodeType = ragnoGraph.getNodeType(node);
        return nodeType === 'ragno:Attribute' && ragnoGraph.isEntryPoint(node);
    });
    
    const exactMatchCandidates = [...entityNodes, ...titleAttributes];
    
    for (const node of exactMatchCandidates) {
        const nodeLabel = ragnoGraph.getPrefLabel(node);
        const nodeContent = ragnoGraph.getNodeContent(node);
        
        // Check for exact string matches
        for (const entity of extractedEntities) {
            if (nodeLabel.toLowerCase().includes(entity.toLowerCase()) ||
                nodeContent.toLowerCase().includes(entity.toLowerCase())) {
                entryPoints.add(node);
                break;
            }
        }
    }
    
    // Vector similarity search for content-rich nodes
    const contentNodes = ragnoGraph.nodes().filter(node => {
        const nodeType = ragnoGraph.getNodeType(node);
        return ['ragno:Unit', 'ragno:Attribute', 'ragno:CommunityElement']
            .includes(nodeType);
    });
    
    // Generate query embedding
    const queryEmbedding = await embeddingService.getEmbedding(query);
    
    // Calculate similarities and get top-k
    const similarities = [];
    for (const node of contentNodes) {
        const content = ragnoGraph.getNodeContent(node);
        const nodeEmbedding = await embeddingService.getEmbedding(content);
        const similarity = cosineSimilarity(queryEmbedding, nodeEmbedding);
        similarities.push({ node, similarity });
    }
    
    // Sort by similarity and take top-k
    similarities.sort((a, b) => b.similarity - a.similarity);
    const topSimilar = similarities.slice(0, k);
    
    for (const { node } of topSimilar) {
        entryPoints.add(node);
    }
    
    return entryPoints;
}

/**
 * Calculates cosine similarity between two vectors.
 * @param {Array<number>} a - First vector
 * @param {Array<number>} b - Second vector
 * @returns {number} Cosine similarity score
 */
function cosineSimilarity(a, b) {
    const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
    const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
    const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
    
    return dotProduct / (magnitudeA * magnitudeB);
}
```

## 8. Shallow Personalized PageRank (PPR)

### Purpose
Identifies relevant cross-nodes by performing a limited-iteration random walk from entry points to find multi-hop relevant nodes.

### Ragno Implementation

```javascript
/**
 * Performs shallow Personalized PageRank from entry points.
 * @param {RagnoGraph} ragnoGraph - The knowledge graph
 * @param {Set<string>} entryPoints - Entry point node URIs
 * @param {number} alpha - Teleport probability (default: 0.5)
 * @param {number} iterations - Number of iterations (default: 2)
 * @param {number} topK - Number of top nodes to return per type
 * @returns {Set<string>} Set of cross-node URIs
 */
export function shallowPersonalizedPageRank(ragnoGraph, entryPoints, alpha = 0.5, iterations = 2, topK = 5) {
    const nodes = ragnoGraph.nodes();
    const nodeCount = nodes.length;
    
    // Initialize personalization vector
    const personalizationVector = new Map();
    nodes.forEach(node => personalizationVector.set(node, 0));
    
    const entryPointWeight = 1 / entryPoints.size;
    entryPoints.forEach(node => {
        personalizationVector.set(node, entryPointWeight);
    });
    
    // Initialize PageRank scores
    let currentScores = new Map(personalizationVector);
    
    // Create normalized adjacency matrix
    const adjacencyMatrix = new Map();
    nodes.forEach(node => {
        const neighbors = ragnoGraph.neighbors(node);
        const degree = neighbors.length;
        adjacencyMatrix.set(node, new Map());
        
        if (degree > 0) {
            neighbors.forEach(neighbor => {
                adjacencyMatrix.get(node).set(neighbor, 1 / degree);
            });
        }
    });
    
    // Perform iterations
    for (let iter = 0; iter < iterations; iter++) {
        const newScores = new Map();
        
        nodes.forEach(node => {
            // PPR formula: π(t) = α * p + (1 - α) * P^T * π(t-1)
            let score = alpha * personalizationVector.get(node);
            
            // Add contributions from incoming edges
            nodes.forEach(sourceNode => {
                const outgoingEdges = adjacencyMatrix.get(sourceNode);
                if (outgoingEdges.has(node)) {
                    const transitionProb = outgoingEdges.get(node);
                    score += (1 - alpha) * transitionProb * currentScores.get(sourceNode);
                }
            });
            
            newScores.set(node, score);
        });
        
        currentScores = newScores;
    }
    
    // Group nodes by type and select top-k from each type
    const nodesByType = new Map();
    nodes.forEach(node => {
        const nodeType = ragnoGraph.getNodeType(node);
        if (!nodesByType.has(nodeType)) {
            nodesByType.set(nodeType, []);
        }
        nodesByType.get(nodeType).push({
            node,
            score: currentScores.get(node)
        });
    });
    
    const crossNodes = new Set();
    
    // Select top-k nodes from each type
    nodesByType.forEach((typeNodes, nodeType) => {
        typeNodes.sort((a, b) => b.score - a.score);
        const topNodes = typeNodes.slice(0, topK);
        
        topNodes.forEach(({ node }) => {
            // Exclude original entry points
            if (!entryPoints.has(node)) {
                crossNodes.add(node);
            }
        });
    });
    
    return crossNodes;
}
```

## 9. Retrieval Filtering

### Purpose
Filters the final retrieval results to include only nodes suitable for retrieval context.

### Ragno Implementation

```javascript
/**
 * Filters retrieval nodes to include only retrievable content.
 * @param {RagnoGraph} ragnoGraph - The knowledge graph
 * @param {Set<string>} entryPoints - Entry point nodes
 * @param {Set<string>} crossNodes - Cross nodes from PPR
 * @returns {Object} Filtered retrieval results
 */
export function filterRetrievalNodes(ragnoGraph, entryPoints, crossNodes) {
    const allCandidates = new Set([...entryPoints, ...crossNodes]);
    
    // Define retrievable node types
    const retrievableTypes = [
        'ragno:TextElement',
        'ragno:Unit', 
        'ragno:Attribute',
        'ragno:CommunityElement',
        'ragno:Relationship'
    ];
    
    // Define non-retrievable entry point types
    const entryPointTypes = [
        'ragno:Entity'
        // Note: Some ragno:Attribute nodes may be entry points (titles/keywords)
    ];
    
    const retrievalResults = {
        retrievableNodes: new Set(),
        entryPointNodes: new Set(),
        metadata: new Map()
    };
    
    for (const node of allCandidates) {
        const nodeType = ragnoGraph.getNodeType(node);
        const content = ragnoGraph.getNodeContent(node);
        const isEntryPoint = ragnoGraph.isEntryPoint(node);
        
        if (retrievableTypes.includes(nodeType) && content && content.length > 0) {
            retrievalResults.retrievableNodes.add(node);
            
            // Add metadata for retrieval context
            retrievalResults.metadata.set(node, {
                type: nodeType,
                prefLabel: ragnoGraph.getPrefLabel(node),
                contentLength: content.length,
                isFromEntryPoints: entryPoints.has(node),
                isFromCrossNodes: crossNodes.has(node)
            });
        } else if (entryPointTypes.includes(nodeType) || isEntryPoint) {
            retrievalResults.entryPointNodes.add(node);
        }
    }
    
    return retrievalResults;
}

/**
 * Formats retrieval results for LLM consumption.
 * @param {RagnoGraph} ragnoGraph - The knowledge graph
 * @param {Object} retrievalResults - Filtered retrieval results
 * @returns {string} Formatted retrieval context
 */
export function formatRetrievalContext(ragnoGraph, retrievalResults) {
    const { retrievableNodes, metadata } = retrievalResults;
    
    const contextSections = [];
    
    // Group by node type for better organization
    const nodesByType = new Map();
    for (const node of retrievableNodes) {
        const nodeType = ragnoGraph.getNodeType(node);
        if (!nodesByType.has(nodeType)) {
            nodesByType.set(nodeType, []);
        }
        nodesByType.get(nodeType).push(node);
    }
    
    // Format each type section
    const typeOrder = [
        'ragno:CommunityElement',
        'ragno:Unit',
        'ragno:Attribute', 
        'ragno:TextElement',
        'ragno:Relationship'
    ];
    
    for (const nodeType of typeOrder) {
        if (nodesByType.has(nodeType)) {
            const typeNodes = nodesByType.get(nodeType);
            const typeName = nodeType.replace('ragno:', '');
            
            contextSections.push(`\n=== ${typeName} Information ===`);
            
            for (const node of typeNodes) {
                const nodeMetadata = metadata.get(node);
                const content = ragnoGraph.getNodeContent(node);
                const prefLabel = nodeMetadata.prefLabel;
                
                contextSections.push(`\n**${prefLabel}**`);
                contextSections.push(content);
            }
        }
    }
    
    return contextSections.join('\n');
}
```

## Implementation Notes

### Required Dependencies

```javascript
// package.json dependencies
{
  "dependencies": {
    "leiden-algorithm": "^1.0.0",
    "ml-kmeans": "^6.0.0", 
    "hnswlib-node": "^1.4.0"
  }
}
```

### Usage Example

```javascript
import { RagnoGraph } from './ragno-graph.js';
import { LLMService } from './llm-service.js';
import { EmbeddingService } from './embedding-service.js';
import * as NodeRAGAlgorithms from './noderag-algorithms.js';

const ragnoGraph = new RagnoGraph();
const llmService = new LLMService();
const embeddingService = new EmbeddingService();

// Load your ragno-structured data
await ragnoGraph.loadFromTurtle('knowledge-base.ttl');

// Execute NodeRAG pipeline
const importantEntitiesKCore = NodeRAGAlgorithms.kCoreDecomposition(ragnoGraph);
const importantEntitiesCentrality = NodeRAGAlgorithms.betweennessCentralitySelection(ragnoGraph);
const importantEntities = new Set([...importantEntitiesKCore, ...importantEntitiesCentrality]);

await NodeRAGAlgorithms.generateEntityAttributes(ragnoGraph, importantEntities, llmService);

const communities = NodeRAGAlgorithms.detectCommunities(ragnoGraph);
await NodeRAGAlgorithms.generateCommunityElements(ragnoGraph, communities, llmService);

await NodeRAGAlgorithms.semanticMatchingWithinCommunity(ragnoGraph, embeddingService, communities);
await NodeRAGAlgorithms.integrateHNSWSemanticEdges(ragnoGraph, embeddingService);

// Query processing
const query = "What are the applications of machine learning?";
const entryPoints = await NodeRAGAlgorithms.dualSearch(ragnoGraph, query, llmService, embeddingService);
const crossNodes = NodeRAGAlgorithms.shallowPersonalizedPageRank(ragnoGraph, entryPoints);
const retrievalResults = NodeRAGAlgorithms.filterRetrievalNodes(ragnoGraph, entryPoints, crossNodes);
const context = NodeRAGAlgorithms.formatRetrievalContext(ragnoGraph, retrievalResults);
```

This implementation provides a comprehensive translation of NodeRAG algorithms using Ragno ontology terms, designed for Node.js ES modules development.