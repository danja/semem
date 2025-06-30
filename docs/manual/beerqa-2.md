# BeerQA Enhanced Workflow (v2)

**Status 2025-06-30:** Enhanced workflow integrating NodeRAG formal relationship infrastructure with improved configuration management and graph analytics capabilities.

**tl;dr** :
* `node examples/beerqa/BeerTestQuestions.js`
* `node examples/beerqa/AugmentQuestion.js`
* `node examples/beerqa/QuestionResearch.js`
* `node examples/beerqa/ragno/RelationshipBuilder.js`
* `node examples/beerqa/ragno/CorpuscleRanking.js`
* `node examples/beerqa/ragno/CommunityAnalysis.js`
* `node examples/beerqa/Navigate.js`
* `node examples/beerqa/GetResult.js`

## Overview

The enhanced BeerQA workflow builds upon the original 7-stage pipeline by adding formal NodeRAG relationship infrastructure, graph analytics, and improved configuration patterns. This version creates `ragno:Relationship` entities that enable advanced graph operations like community detection, corpuscle ranking, and structured answer generation.

The workflow combines the manual data creation stages (questions → concepts → Wikipedia research) with formal graph analytics (relationships → communities → rankings → final results) to provide a more robust question-answering pipeline.

## Architecture

The enhanced workflow operates on three primary RDF graphs:
- **BeerQA Graph** (`http://purl.org/stuff/beerqa/test`): Questions, formal relationships, and metadata
- **Wikipedia Graph** (`http://purl.org/stuff/wikipedia/research`): Wikipedia corpuscles and content  
- **Navigation Graph** (configurable): ZPT navigation results and analytics

All scripts now use centralized Config.js patterns and the config-extras.json file for consistent graph URI management.

**Scripts should be run frmo the root dir of the project, some include paths.**

## Enhanced Workflow Stages

### Stage 1: Foundation Data Creation

#### 1.1 Question Initialization
**Command**: `node examples/beerqa/BeerTestQuestions.js`

**Operations**:
- Loads test questions from `data/beerqa/beerqa_test_questions_v1.0.json`
- Creates `ragno:Corpuscle` instances with proper Config.js integration
- Stores in BeerQA graph with consistent URI patterns

**Config Pattern**:
```javascript
const config = new Config('../../config/config.json');
await config.init();
const storageOptions = config.get('storage.options');
```

**Expected Results**: 100 question corpuscles loaded

#### 1.2 Question Augmentation  
**Command**: `node examples/beerqa/AugmentQuestion.js`

**Operations**:
- Adds 1536-dimensional embeddings using nomic-embed-text
- Extracts semantic concepts via LLM analysis
- Uses Config.js for SPARQL endpoint and LLM provider configuration

**Expected Results**: Questions enriched with embeddings and concepts (typically 1-3 concepts per question)

#### 1.3 Wikipedia Research
**Command**: `node examples/beerqa/QuestionResearch.js`

**Operations**:
- Researches extracted concepts via Wikipedia API
- Creates Wikipedia corpuscles with embeddings
- Stores in Wikipedia research graph
- Uses dynamic content creation rather than static loading

**Expected Results**: 5-10 Wikipedia corpuscles per processed question

**Keywords**: `ingest`, `initialize`, `load`, `augment`, `enrich`, `embed`, `extract`, `research`, `search`, `ingest`, `discover`

### Stage 2: Formal Relationship Infrastructure

#### 2.1 Relationship Builder
**Command**: `node examples/beerqa/ragno/RelationshipBuilder.js`

**Purpose**: Creates formal `ragno:Relationship` entities between questions and Wikipedia content

**Operations**:
- **Similarity Relationships**: Embedding-based connections (cosine similarity > 0.1)
- **Entity Relationships**: Named entity matching between questions and content
- **Semantic Relationships**: Concept-based semantic connections
- **Community Bridge Relationships**: Cross-topic bridges for graph connectivity

**RDF Structure**:
```turtle
<relationship-uri> a ragno:Relationship ;
                   ragno:hasSourceEntity <question-uri> ;
                   ragno:hasTargetEntity <wikipedia-corpuscle> ;
                   ragno:relationshipType "similarity" ;
                   ragno:weight 0.75 ;
                   ragno:description "Embedding similarity: 0.75" ;
                   ragno:created "2025-06-30T..." .
```

**Configuration**:
- Similarity threshold: 0.1 (configurable)
- Max relationships per question: 50
- Enables multiple relationship types simultaneously

**Expected Results**: 10-20 formal relationships per question with Wikipedia content

**Potential Issues**:
- Requires both questions and Wikipedia data to exist
- Graph URI alignment critical (BeerQA vs Wikipedia graphs)
- Performance scales with number of questions × Wikipedia corpuscles

**Keywords**: `link`, `connect`, `relate`, `analyze`, `score`

### Stage 3: Graph Analytics

#### 3.1 Corpuscle Ranking
**Command**: `node examples/beerqa/ragno/CorpuscleRanking.js`

Note that given the complexity of the centrality algorithm, this is disabled if there are more than 1000 nodes to address, this is set early in the code with ` this.GRAPH_NODES_MAX = 1000`.

**Purpose**: Analyzes graph structure to rank corpuscles by importance

**Operations**:
- **K-core Decomposition**: Identifies structurally important nodes
- **Centrality Analysis**: Calculates betweenness centrality (graphs < 1000 nodes)
- **Composite Scoring**: Weighted combination (K-core: 60%, Centrality: 40%)
- **SPARQL Export**: Stores rankings as ragno:Attribute entities

**Analytics Process**:
1. Build graph from existing relationships
2. Run graph algorithms (K-core, centrality)
3. Calculate composite importance scores
4. Export top-K rankings to SPARQL store

**Expected Results**: Ranked list of most structurally important corpuscles

**Potential Issues**:
- Centrality skipped for large graphs (>1000 nodes) due to computational cost
- Requires existing relationship infrastructure
- Graph connectivity affects algorithm effectiveness

**Keywords**: `analyze`, `rank`, `score`, `measure`

#### 3.2 Community Analysis
**Command**: `node examples/beerqa/ragno/CommunityAnalysis.js`

**Purpose**: Detects communities in the knowledge graph using Leiden algorithm

**Operations**:
- **Community Detection**: Leiden algorithm with configurable resolution
- **LLM Summarization**: Generates natural language summaries for communities
- **Question Linking**: Associates questions with relevant communities
- **Community Export**: Creates ragno:Community and ragno:CommunityElement structures

**Configuration**:
- Algorithm: Leiden (default)
- Minimum community size: 3
- Maximum communities: 20
- Generate summaries: enabled

**Expected Results**: 5-15 communities with natural language descriptions

**Potential Issues**:
- Small graphs may not have sufficient connectivity for meaningful communities
- LLM summarization requires working chat provider
- Community quality depends on relationship infrastructure quality

**Keywords**: `cluster`, `group`, `detect`, `summarize`, `analyze`, `rank`, `cluster`, `measure`

### Stage 4: Enhanced Navigation and Results

#### 4.1 ZPT Navigation (Enhanced)
**Command**: `node examples/beerqa/Navigate.js`

**Purpose**: Semantic navigation using formal relationship infrastructure

**Operations**:
- Uses existing formal relationships as navigation foundation
- Applies ZPT parameters for enhanced discovery
- Creates additional navigation-specific relationships
- Supports multiple navigation scenarios per question

**ZPT Parameters**:
- **Zoom**: entity, unit, community levels
- **Tilt**: embedding, keywords, graph projections  
- **Pan**: topic, entity, temporal domains

**Expected Results**: Enhanced relationship network for improved answer quality

**Keywords**: `navigate`, `traverse`, `discover`, `filter`

#### 4.2 Final Results (Enhanced)
**Command**: `node examples/beerqa/GetResult.js`

**Purpose**: Context-augmented answer generation using formal relationships

**Operations**:
- Retrieves questions with formal ragno:Relationship entities
- Builds context from relationship-linked content
- Uses ContextManager for optimal context window utilization
- Generates answers with source attribution

**Context Building**:
1. Query formal relationships by weight/type
2. Fetch content for related entities
3. Sort by relationship strength
4. Apply context window management
5. Generate LLM response with augmented context

**Expected Results**: Structured answers with relationship-based context and source attribution

**Keywords**: `retrieve`, `contextualize`, `generate`, `answer`, `navigate`, `retrieve`, `generate`, `answer`

## Configuration Management

### Config.js Integration

All enhanced scripts use consistent Config.js patterns:

```javascript
// Standard initialization
const config = new Config('../../config/config.json');
await config.init();
const storageOptions = config.get('storage.options');

// SPARQL configuration
const sparqlHelper = new SPARQLHelper(storageOptions.update, {
    auth: { user: storageOptions.user, password: storageOptions.password }
});
```

**Keywords**: `configure`, `initialize`, `setup`

### Graph URI Configuration

The `config-extras.json` file provides centralized graph URI management:

```json
{
  "graphs": {
    "beerqa": "http://purl.org/stuff/beerqa/test",
    "wikipedia": "http://purl.org/stuff/wikipedia/research",
    "navigation": "http://purl.org/stuff/navigation/beerqa"
  },
  "thresholds": {
    "similarity": 0.3,
    "strongSimilarity": 0.7,
    "conceptMatch": 0.5
  }
}
```

**Keywords**: `configure`, `manage`, `align`

### LLM Provider Configuration

Uses priority-based provider selection from config.json:

```json
{
  "llmProviders": [
    {
      "type": "ollama",
      "chatModel": "qwen2:1.5b",
      "embeddingModel": "nomic-embed-text",
      "priority": 2,
      "capabilities": ["embedding", "chat"]
    }
  ]
}
```

**Keywords**: `configure`, `select`, `prioritize`, `configure`, `setup`, `manage`

## Execution Sequence

### Complete Workflow
```bash
# Stage 1: Foundation Data
cd examples/beerqa
node BeerTestQuestions.js        # Load 100 questions
node AugmentQuestion.js          # Add embeddings + concepts  
node QuestionResearch.js         # Research concepts → Wikipedia

# Stage 2: Formal Infrastructure  
cd ragno
node RelationshipBuilder.js     # Create formal relationships

# Stage 3: Graph Analytics
node CorpuscleRanking.js        # Rank by structural importance
node CommunityAnalysis.js       # Detect communities

# Stage 4: Enhanced Results
cd ..
node GetResult.js               # Generate final answers
```

**Keywords**: `execute`, `sequence`, `pipeline`

### Incremental Testing
```bash
# Test specific components
node examples/beerqa/ragno/RelationshipBuilder.js  # Relationships only
node examples/beerqa/GetResult.js                  # Final results only
```

**Keywords**: `test`, `debug`, `validate`, `execute`, `run`, `workflow`

## Performance Characteristics

### Enhanced Workflow Timings
- **RelationshipBuilder**: 30-60 seconds (depends on question/Wikipedia corpus size)
- **CorpuscleRanking**: 1-2 seconds (100 corpuscles, 600 relationships)
- **CommunityAnalysis**: 5-10 seconds (includes LLM summarization)
- **GetResult**: 10-20 seconds per question (with formal relationships)

**Keywords**: `measure`, `timing`, `performance`

### Storage Requirements
- **Formal Relationships**: ~500-1000 bytes per relationship
- **Graph Analytics**: ~200-500 bytes per ranking/community annotation
- **Total Enhancement**: ~2-5x base workflow storage

**Keywords**: `store`, `persist`, `scale`

### Memory Usage
- **Graph Analytics**: O(n²) for centrality, O(n) for K-core
- **Relationship Building**: Linear in question × corpuscle count
- **Community Detection**: Depends on graph connectivity

**Keywords**: `memory`, `scale`, `optimize`, `measure`, `benchmark`, `optimize`

## Known Issues and Troubleshooting

### Configuration Issues
**Keywords**: `configure`, `debug`, `fix`

**Problem**: `config.get is not a function`
**Solution**: Ensure Config.js initialization pattern:
```javascript
const config = new Config(configPath);
await config.init();  // Must call init()
```

**Problem**: Relationships stored in wrong graph
**Solution**: Check graph URI alignment in RelationshipBuilder.js (should use beerqaGraphURI for storage)

### Model Availability
**Keywords**: `model`, `availability`, `setup`

**Problem**: `model "mistral-small-latest" not found`
**Solution**: Verify Ollama models available:
```bash
ollama list
# Ensure qwen2:1.5b and nomic-embed-text are available
ollama pull qwen2:1.5b
ollama pull nomic-embed-text
```

**Problem**: LLM provider selection issues
**Solution**: Check llmProviders configuration priority and capabilities in config.json

### Graph Analytics Issues
**Keywords**: `analyze`, `debug`, `tune`

**Problem**: Community analysis finds 0 communities
**Solution**: 
- Lower minimum community size (default: 3)
- Check relationship infrastructure exists
- Verify graph connectivity

**Problem**: Centrality analysis skipped
**Solution**: Expected for graphs >100 nodes due to computational cost

### Relationship Infrastructure Issues
**Keywords**: `link`, `debug`, `validate`

**Problem**: GetResult.js finds 0 relationships
**Solution**:
- Verify RelationshipBuilder.js completed successfully
- Check graph URI alignment (BeerQA vs Wikipedia)
- Confirm relationships stored in correct graph

**Problem**: Low relationship counts
**Solution**:
- Lower similarity threshold in RelationshipBuilder.js
- Increase max relationships per question
- Verify embedding quality for questions and Wikipedia content

### SPARQL/Storage Issues
**Keywords**: `sparql`, `storage`, `debug`

**Problem**: SPARQL authentication failures
**Solution**: Verify config.json storage.options user/password settings

**Problem**: Graph URI mismatches
**Solution**: Use config-extras.json for consistent URI management across all scripts

**Keywords**: `debug`, `troubleshoot`, `fix`, `configure`, `debug`, `fix`, `model`, `availability`, `setup`, `analyze`, `debug`, `tune`, `link`, `debug`, `validate`, `sparql`, `storage`, `debug`

## Quality Assessment

### Relationship Quality Indicators
- **Coverage**: Most questions should have 5-20 relationships
- **Diversity**: Mix of similarity, entity, and semantic relationship types
- **Weights**: Reasonable distribution (0.1-1.0 range)

**Keywords**: `assess`, `measure`, `validate`

### Analytics Quality Indicators  
- **K-core Distribution**: Should span multiple core values (1-6+)
- **Community Sizes**: Communities should have 3+ members
- **Ranking Diversity**: Top rankings shouldn't be dominated by single type

**Keywords**: `analyze`, `measure`, `validate`

### Answer Quality Indicators
- **Context Sources**: Questions should have 3+ context sources
- **Relationship Usage**: Answers should utilize formal relationships
- **Source Attribution**: Responses should reference Wikipedia sources

**Keywords**: `answer`, `validate`, `assess`, `assess`, `validate`, `measure`

## Future Enhancements

### Planned Improvements
- **Batch Processing**: Parallel question processing
- **Quality Metrics**: Automated relationship and answer quality assessment
- **Configuration UI**: Web interface for parameter tuning
- **Performance Monitoring**: Detailed timing and quality metrics

**Keywords**: `improve`, `optimize`, `extend`

### Integration Opportunities
- **External Knowledge Sources**: Beyond Wikipedia integration
- **Advanced Analytics**: PageRank, community evolution analysis
- **Answer Validation**: Cross-reference with multiple sources
- **Interactive Navigation**: User-guided ZPT parameter adjustment

**Keywords**: `integrate`, `extend`, `connect`, `enhance`, `improve`, `extend`

## System Requirements

- **Node.js**: 20.11.0+ with ES modules
- **SPARQL Endpoint**: Apache Fuseki with authentication
- **Ollama**: Models qwen2:1.5b, nomic-embed-text
- **Memory**: 2-4GB RAM for graph analytics on 100+ corpuscles
- **Storage**: 10-50MB for complete enhanced workflow data
- **Network**: Wikipedia API access (rate limited to 1 req/sec)

**Keywords**: `requirements`, `setup`, `dependencies`