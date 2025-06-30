# BeerQA Enhanced Workflow v2 + Wikidata Integration

**Status 2025-06-30:** Complete enhanced workflow integrating BeerQA Enhanced Workflow v2 with Wikidata global knowledge graph capabilities.

**tl;dr** :
* `node examples/beerqa/BeerTestQuestions.js`
* `node examples/beerqa/AugmentQuestion.js`
* `node examples/beerqa/QuestionResearch.js`
* `node examples/beerqa/ragno/RelationshipBuilder.js`
* `node examples/beerqa/ragno/CorpuscleRanking.js`
* `node examples/beerqa/ragno/CommunityAnalysis.js`
* `node examples/beerqa/Navigate.js`
* `node examples/beerqa/GetResult.js`
* `node examples/beerqa-wikidata/WikidataNavigate.js`
* `node examples/beerqa-wikidata/WikidataGetResult.js`

## Overview

This workflow builds upon the BeerQA Enhanced Workflow v2 by adding Wikidata integration capabilities. It combines local Wikipedia knowledge with global Wikidata entities to create a hybrid semantic memory system that provides more comprehensive and accurate question answering.

The workflow maintains all the formal relationship infrastructure and graph analytics from v2 while extending the knowledge base with Wikidata's vast global knowledge graph containing 100+ million entities.

## Architecture

The enhanced workflow operates on four primary RDF graphs:
- **BeerQA Graph** (`http://purl.org/stuff/beerqa/test`): Questions, formal relationships, and metadata
- **Wikipedia Graph** (`http://purl.org/stuff/wikipedia/research`): Wikipedia corpuscles and content  
- **Wikidata Graph** (`http://purl.org/stuff/wikidata/research`): Global Wikidata entities and properties
- **Navigation Graph** (`http://purl.org/stuff/navigation/enhanced`): Enhanced ZPT navigation results

All scripts use centralized Config.js patterns for consistent configuration management.

**Scripts should be run from the root dir of the project, some include paths.**

## Complete Enhanced Workflow Sequence

### Stage 1: Foundation Data Creation

#### 1.1 Question Initialization
**Command**: `node examples/beerqa/BeerTestQuestions.js`

**Operations**:
- Loads test questions from `data/beerqa/beerqa_test_questions_v1.0.json`
- Creates `ragno:Corpuscle` instances with proper Config.js integration
- Stores in BeerQA graph with consistent URI patterns

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

**Expected Results**: Formal relationship entities connecting questions to relevant Wikipedia content

#### 2.2 Corpuscle Ranking
**Command**: `node examples/beerqa/ragno/CorpuscleRanking.js`

**Purpose**: Applies PageRank-style ranking to corpuscles based on relationship weights

**Operations**:
- Calculates importance scores for Wikipedia corpuscles
- Uses relationship weights as graph edge weights
- Applies personalized PageRank from question nodes
- Stores ranking scores as `ragno:hasPPRScore` properties

**Expected Results**: Wikipedia corpuscles ranked by relevance to question corpus

#### 2.3 Community Analysis
**Command**: `node examples/beerqa/ragno/CommunityAnalysis.js`

**Purpose**: Performs graph analytics to identify knowledge communities

**Operations**:
- Detects communities using Leiden algorithm
- Creates `ragno:Community` entities
- Links corpuscles to communities via `ragno:inCommunity`
- Generates community-level analytics

**Expected Results**: Knowledge communities identified and linked to corpuscles

### Stage 3: Navigation and Results

#### 3.1 ZPT Navigation
**Command**: `node examples/beerqa/Navigate.js`

**Purpose**: Performs Zero-Point Traversal semantic navigation

**Operations**:
- Uses ZPT parameters (zoom/tilt/pan) for semantic navigation
- Creates navigation relationships between questions and related corpuscles
- Applies similarity thresholds for relationship creation
- Stores results in navigation graph

**Expected Results**: Navigation relationships created for question-corpuscle pairs

#### 3.2 Answer Generation (Original)
**Command**: `node examples/beerqa/GetResult.js`

**Purpose**: Generates answers using original BeerQA workflow

**Operations**:
- Retrieves context from navigation relationships
- Aggregates Wikipedia content for each question
- Uses LLM completion with Wikipedia context
- Generates final answers with source attribution

**Expected Results**: Context-augmented answers using Wikipedia knowledge

### Stage 4: Wikidata Enhancement (New)

#### 4.1 Enhanced Navigation with Wikidata
**Command**: `node examples/beerqa-wikidata/WikidataNavigate.js`

**Purpose**: Extends navigation with Wikidata global knowledge entities

**Operations**:
- Performs Wikidata research for each question using WikidataResearch workflow
- Combines Wikipedia and Wikidata entities into enhanced corpus
- Creates enhanced relationships with source attribution (Wikipedia/Wikidata)
- Applies similarity scoring across multi-source corpus
- Stores enhanced relationships in navigation graph

**Key Features**:
- **Multi-Source Corpus**: Wikipedia + Wikidata entities
- **Source Attribution**: Tracks entity origins (Wikipedia/Wikidata/fresh research)
- **Enhanced Similarity**: Embedding-based relationships across knowledge sources
- **Formal Relationships**: Creates `ragno:Relationship` entities with weights and descriptions

**Expected Results**: Enhanced navigation relationships incorporating global Wikidata knowledge

#### 4.2 Enhanced Answer Generation
**Command**: `node examples/beerqa-wikidata/WikidataGetResult.js`

**Purpose**: Generates context-augmented answers using multi-source knowledge

**Operations**:
- Retrieves enhanced relationships from navigation graph
- Aggregates context from Wikipedia, Wikidata, and BeerQA sources
- Builds comprehensive context with source attribution
- Uses LLM completion with enriched multi-source context
- Generates enhanced answers with clear source citations

**Context Sources**:
- **Wikidata Knowledge**: Authoritative global definitions and properties
- **Wikipedia Context**: Detailed content and explanations
- **BeerQA Context**: Domain-specific knowledge and relationships

**Expected Results**: Comprehensive answers combining local and global knowledge with source attribution

## Optional: Target Discovery

#### Target Discovery (if needed)
**Command**: `node examples/beerqa/enhanced/EnhancedDiscoverTargets.js`

**When to Use**: If you encounter "No questions with related pages found" errors

**Purpose**: Discovers and creates target relationships for enhanced navigation

## Prerequisites

### Environment Setup
```bash
# Required environment variables in .env
MISTRAL_API_KEY=your_mistral_key
CLAUDE_API_KEY=your_claude_key
SPARQL_USER=admin
SPARQL_PASSWORD=admin123
```

### Services
- **Apache Fuseki**: SPARQL endpoint running on localhost:3030
- **Ollama**: Local LLM/embedding service (with nomic-embed-text model)
- **API Access**: Mistral or Claude API keys for enhanced LLM capabilities

### Configuration
Ensure `config/config.json` is properly configured with:
- SPARQL storage endpoints
- LLM provider configurations
- Embedding service settings

## Performance Metrics

### Expected Performance
- **Total Execution Time**: 15-30 minutes for complete workflow
- **Wikidata Enhancement**: Additional 5-10 minutes for global knowledge integration
- **Entity Discovery**: 15+ Wikidata entities per question
- **Context Enhancement**: 3-8x more context sources than original workflow

### Quality Improvements
- **Global Knowledge Access**: Authoritative definitions from Wikidata
- **Multi-Source Context**: Wikipedia + Wikidata + BeerQA integration
- **Enhanced Accuracy**: Precise entity resolution for specialized concepts
- **Source Attribution**: Clear provenance for all knowledge sources

## Troubleshooting

### Common Issues

**"No navigable questions found"**
- Ensure Stage 1 (Foundation Data Creation) completed successfully
- Verify questions have embeddings from AugmentQuestion.js

**"No navigation corpus found"**
- Ensure QuestionResearch.js completed and created Wikipedia corpuscles
- Check Wikipedia graph contains entities with embeddings

**"No questions with related pages found"**
- Run `node examples/beerqa/enhanced/EnhancedDiscoverTargets.js`
- Verify relationship infrastructure from Stage 2 completed

**Wikidata Rate Limiting**
- Workflow automatically applies 1-second delays
- Monitor logs for rate limit warnings
- Increase delays in WikidataConnector.js if needed

### Validation Commands
```bash
# Check question count
curl -X POST http://localhost:3030/semem/query \
  -H "Content-Type: application/sparql-query" \
  -d "SELECT (COUNT(*) AS ?count) WHERE { GRAPH <http://purl.org/stuff/beerqa/test> { ?s a ragno:Corpuscle } }"

# Check Wikipedia corpus
curl -X POST http://localhost:3030/semem/query \
  -H "Content-Type: application/sparql-query" \
  -d "SELECT (COUNT(*) AS ?count) WHERE { GRAPH <http://purl.org/stuff/wikipedia/research> { ?s a ragno:Entity } }"

# Check Wikidata entities
curl -X POST http://localhost:3030/semem/query \
  -H "Content-Type: application/sparql-query" \
  -d "SELECT (COUNT(*) AS ?count) WHERE { GRAPH <http://purl.org/stuff/wikidata/research> { ?s a ragno:Entity } }"
```

## Integration Benefits

This enhanced workflow provides:

1. **Global Knowledge Access**: Any question can leverage Wikidata's comprehensive knowledge base
2. **Enhanced Context Quality**: Multi-source context provides richer, more accurate responses  
3. **Specialized Domain Coverage**: Precise entity resolution for technical and scientific concepts
4. **Scalable Architecture**: Template-based system supports future knowledge source integrations
5. **Source Attribution**: Clear provenance tracking for all knowledge sources
6. **Formal Relationships**: Structured graph representation enabling advanced analytics

The workflow successfully bridges local domain expertise with global knowledge resources, creating a more comprehensive and accurate question-answering system while maintaining the formal relationship infrastructure that enables advanced graph analytics and community detection.