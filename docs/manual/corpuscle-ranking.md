# Corpuscle Ranking

The CorpuscleRanking system analyzes the structural importance of corpuscles (semantic units) in the semem knowledge graph using graph analytics algorithms. It provides meaningful rankings based on network topology, relationship strength, and content characteristics.

## Overview

CorpuscleRanking identifies the most structurally important corpuscles by analyzing their position and connections within the semantic network. This helps prioritize content for retrieval, identify key concepts, and understand information flow patterns.

## Operation Flow

### 1. Data Prerequisite Validation
The system first validates that required data exists:
- **BeerQA Questions**: Test questions with extracted concepts
- **Wikipedia Corpuscles**: Research content from Wikipedia ingestion
- **Relationships**: Semantic connections between corpuscles (created by RelationshipBuilder)
- **Embeddings**: Vector representations for similarity calculations

If prerequisites are missing, the system provides specific recommendations (e.g., "Run RelationshipBuilder.js").

### 2. Graph Construction
Builds a network representation from the RDF data:
- **Nodes**: Corpuscles from both BeerQA and Wikipedia graphs
- **Edges**: Relationship instances with weights and types
- **Structure Analysis**: Degree distribution, density, and connectivity patterns

### 3. Graph Analytics

#### K-Core Decomposition
The k-core algorithm identifies densely connected subgraphs by iteratively removing nodes with degree less than k until no such nodes remain. A node's k-core value represents the highest k for which it belongs to a k-core subgraph - nodes with higher k-core values are more central to the network's dense connectivity structure. This reveals which corpuscles are embedded in tightly interconnected semantic clusters versus those on the periphery.

Identifies the "core" structure of the network:
- **Standard K-Core**: When nodes have diverse connectivity, uses traditional k-core algorithm
- **Filtered K-Core**: When all nodes have identical degrees, creates weight-filtered subgraph
- **Alternative Metrics**: When k-core is uniform, switches to composite structural scoring:
  - Weighted Degree (50%): Sum of edge weights normalized by connections
  - Local Clustering (30%): How well-connected a node's neighbors are  
  - Raw Degree (20%): Simple connection count

#### Betweenness Centrality
Measures how often a corpuscle lies on shortest paths between other corpuscles:
- Identifies "bridge" nodes that connect different topic areas
- Limited to graphs with ≤1000 nodes for performance
- Highlights corpuscles important for information flow

### 4. Content-Based Enhancement
For sparse graphs (density <10%), adds content-based metrics:
- **Text Length**: Amount of content in the corpuscle
- **Word Count**: Vocabulary richness
- **Lexical Diversity**: Unique words / total words ratio
- **Source Weight**: BeerQA questions weighted higher (1.2x) than general content

### 5. Composite Ranking
Combines multiple metrics based on graph characteristics:

**Dense Graphs**: K-core (60%) + Centrality (40%)  
**Sparse Graphs**: Structure (40%) + Centrality (30%) + Content (30%)  
**Uniform K-core**: Alternative Structural (60%) + Centrality (40%)

### 6. Export and Display
Results are stored back to the SPARQL store and displayed with:
- **Ranking Position**: 1, 2, 3...
- **Composite Score**: Final weighted ranking value
- **Component Scores**: Individual metric contributions
- **Human Explanation**: Interpretation of why corpuscle ranks highly

## Example Output

```
🏆 Top Corpuscle Rankings:
1. question_brewing_process
   Composite: 0.8234
   Structural: 0.7543
   Centrality: 0.1245
   Analysis: beerqa corpuscle with 8 connections, structural score 0.75 (high structural importance), moderate betweenness centrality

2. wikipedia_fermentation
   Composite: 0.7891
   K-core: 4.0000
   Centrality: 0.2156
   Content: 0.0234
   Analysis: wikipedia corpuscle with 12 connections, k-core 4.0 (highly connected), high betweenness centrality
```

## Quality Indicators

The system provides diagnostic information:
- **Graph Density**: Percentage of possible edges that exist
- **Relationship Types**: Diversity of connection types (similarity, entity-based, semantic)
- **K-core Diversity**: Whether ranking can differentiate between corpuscles
- **Weight Distribution**: Range and variance of relationship strengths

## Usage Context

CorpuscleRanking is typically used after:
1. **BeerTestQuestions.js** - Creates test questions
2. **AugmentQuestion.js** - Extracts concepts from questions  
3. **QuestionResearch.js** - Ingests Wikipedia content
4. **RelationshipBuilder.js** - Creates semantic relationships

The rankings help identify:
- **Key Concepts**: Corpuscles central to the knowledge domain
- **Bridge Topics**: Content connecting different subject areas
- **Important Questions**: Test questions with high semantic connectivity
- **Research Priorities**: Wikipedia content most relevant to the question set

## Technical Features

- **SPARQL Service Integration**: Uses templated queries with caching and prefix management
- **Graph Filtering**: Automatically handles uniform connectivity issues
- **Alternative Metrics**: Switches methods when standard algorithms aren't discriminative
- **Performance Optimization**: Batched operations and configurable limits
- **Error Recovery**: Graceful handling of missing data with actionable recommendations

The system adapts its ranking strategy based on the actual structure of your semantic network, ensuring meaningful results regardless of graph topology.