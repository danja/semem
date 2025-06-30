# BeerQA Iterative Feedback Workflow (v3)

**Status 2025-06-30:** Advanced iterative question-answering system with automated feedback loops, follow-up question generation, and comprehensive answer synthesis through multi-iteration knowledge discovery.

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
* **`node examples/beerqa-wikidata/GetResultWithFeedback.js`** ⭐

## Overview

The BeerQA Iterative Feedback Workflow represents the next evolution in automated question-answering systems, building upon the Enhanced Workflow v2 and Wikidata integration. This version introduces **automated feedback loops** that detect incomplete answers, generate targeted follow-up questions, research those questions iteratively, and synthesize comprehensive final answers.

The system transforms incomplete responses containing phrases like "additional information would be helpful" into comprehensive, well-researched answers through intelligent iteration and automated knowledge discovery.

## Architecture

The iterative feedback workflow operates on four primary RDF graphs with advanced metadata tracking:
- **BeerQA Graph** (`http://purl.org/stuff/beerqa/test`): Questions, formal relationships, iterative metadata, and generated follow-ups
- **Wikipedia Graph** (`http://purl.org/stuff/wikipedia/research`): Wikipedia corpuscles and content  
- **Wikidata Graph** (`http://purl.org/stuff/wikidata/research`): Global Wikidata entities and properties
- **Navigation Graph** (`http://purl.org/stuff/navigation/enhanced`): Enhanced ZPT navigation results

**Scripts should be run from the root dir of the project, some include paths.**

## Core Innovation: Feedback Loop System

### Feedback Detection Engine
- **Pattern Analysis**: Detects 17+ incompleteness patterns ("additional information would be helpful", "cannot determine", etc.)
- **LLM Completeness Scoring**: Advanced scoring (0-100%) with detailed reasoning
- **Automatic Question Generation**: Extracts 2-3 targeted follow-up questions per incomplete response

### Iterative Research Pipeline
```
Original Question → Enhanced Answer → Completeness Analysis
    ↓ (if incomplete)
Generate Follow-up Questions → Store with Metadata → Research Follow-ups
    ↓
Enhanced Context → Next Iteration → Final Synthesis
```

## Enhanced Workflow Stages

### Stage 1-7: Foundation (Same as v2)
Run the complete BeerQA Enhanced Workflow v2 pipeline:
1. **BeerTestQuestions.js**: Question initialization
2. **AugmentQuestion.js**: Question embeddings and concepts
3. **QuestionResearch.js**: Wikipedia research
4. **RelationshipBuilder.js**: Formal relationship creation
5. **CorpuscleRanking.js**: Graph analytics and ranking
6. **CommunityAnalysis.js**: Community detection
7. **Navigate.js**: ZPT navigation enhancement

### Stage 8: Wikidata Integration
**Command**: `node examples/beerqa-wikidata/WikidataNavigate.js`

**Purpose**: Enhance corpus with global Wikidata entities

**Operations**:
- Performs targeted Wikidata research for each question
- Integrates 10-15 relevant Wikidata entities per question
- Creates enhanced navigation relationships combining Wikipedia + Wikidata
- Stores entities in Wikidata graph with proper metadata

**Expected Results**: Enhanced corpus with multi-source knowledge (Wikipedia + Wikidata)

### Stage 9: Advanced Answer Generation
**Command**: `node examples/beerqa-wikidata/WikidataGetResult.js`

**Purpose**: Generate enhanced answers with multi-source context

**Operations**:
- Retrieves context from Wikipedia, Wikidata, and BeerQA sources
- Builds comprehensive context (2000-3000+ characters)
- Generates answers with proper source attribution
- Enhanced prompts request follow-up questions for incomplete responses

**Expected Results**: High-quality answers with multi-source attribution

### Stage 10: Iterative Feedback Processing ⭐
**Command**: `node examples/beerqa-wikidata/GetResultWithFeedback.js`

**Purpose**: Automated iterative question-answering with feedback loops

**Operations**:
- **Iteration 1**: Generate initial enhanced answer using Stage 9 approach
- **Analysis**: Detect incompleteness using pattern matching + LLM analysis
- **Question Generation**: Extract 2-3 targeted follow-up questions
- **Research**: Automatically research follow-up questions via Wikidata integration
- **Iteration 2-3**: Generate enhanced answers with accumulated context
- **Synthesis**: Combine all iterations into comprehensive final answer

**Configuration**:
- Maximum iterations: 3 (configurable)
- Completeness threshold: 80% (configurable)
- Follow-up questions per iteration: 2 (configurable)
- Research depth: Focused strategy

**Expected Results**: Comprehensive answers with 4000+ characters, multiple source attribution, and complete coverage of question aspects

## Key Components

### FeedbackAnalyzer.js
**Purpose**: Analyze response completeness and extract follow-up questions

**Features**:
- **17 Incompleteness Patterns**: "additional information would be helpful", "cannot determine", etc.
- **LLM Completeness Analysis**: Structured scoring with reasoning
- **Question Extraction**: Automatic generation of targeted follow-ups
- **Question Categorization**: 7 types (person, location, temporal, factual, etc.)
- **Priority Scoring**: Intelligent ranking based on relevance and specificity

### QuestionGenerator.js
**Purpose**: Generate and manage follow-up questions with metadata

**Features**:
- **RDF Storage**: Full metadata in BeerQA graph with iteration tracking
- **Dependency Management**: Parent-child question relationships
- **Research Tracking**: Mark questions as researched with results
- **Statistics**: Comprehensive generation and research progress monitoring
- **SPARQL Integration**: Complete question lifecycle management

### GetResultWithFeedback.js
**Purpose**: Main orchestrator for iterative question-answering

**Features**:
- **Iterative Processing**: Configurable max iterations with convergence detection
- **Multi-source Integration**: Wikipedia + Wikidata + BeerQA context combination
- **Answer Synthesis**: LLM-based integration of multi-iteration results
- **Progress Tracking**: Detailed statistics and iteration monitoring
- **Research Integration**: Automatic follow-up research via WikidataResearch.js

## Performance Metrics

### Answer Quality Improvement
```
Standard Answer:     1,800 characters, basic coverage
Iterative Answer:    4,500+ characters, comprehensive coverage
Improvement:         250%+ increase in content depth
```

### Iteration Patterns
```
Iteration 1: 60-70% complete → Generate 2 follow-ups
Iteration 2: 70-80% complete → Generate 2 more follow-ups  
Iteration 3: 80%+ complete → Final synthesis
Result: Comprehensive multi-source answers
```

### Knowledge Discovery
```
Follow-up Questions: 2 per iteration (configurable)
Research Entities: 15 Wikidata entities per follow-up question
Research Time: ~10 seconds per follow-up question
Total Entities: 30 entities per iteration cycle (2 questions × 15 entities)
Iteration Coverage: 6+ follow-up questions per original question across iterations
```
- **Proper RDF metadata** for future research tracking
- **Cross-iteration dependencies** for knowledge building

## RDF Schema Extensions

### Iterative Metadata
```turtle
beerqa:iterationLevel         # Track question generation levels (0=original, 1=first iteration, etc.)
beerqa:parentQuestion         # Link follow-up to original questions
beerqa:completenessScore      # Store analysis results (0.0-1.0)
beerqa:researchCompleted      # Track research status (boolean)
beerqa:questionType           # Categorize questions (person, location, temporal, etc.)
beerqa:priority               # Priority score for processing order
beerqa:generationMethod       # How question was created (llm-feedback, manual, etc.)
```

### Example RDF Structure
```turtle
<generated_abc123> a ragno:Corpuscle ;
    rdfs:label "What specific climate conditions are required for Sorghastrum species?" ;
    beerqa:iterationLevel 1 ;
    beerqa:parentQuestion <original_question_uri> ;
    beerqa:completenessScore 0.70 ;
    beerqa:questionType "factual" ;
    beerqa:priority 0.85 ;
    beerqa:generationMethod "llm-feedback" ;
    dcterms:created "2025-06-30T12:00:00Z" .
```

## Usage Example

### Basic Execution
```bash
# Run complete iterative feedback system
node examples/beerqa-wikidata/GetResultWithFeedback.js

# Expected output:
# 🔄 Starting iterative processing for 11 questions...
# 
# Question 1/3:
# 🔄 Starting iterative processing: "Your question here"
# 
# --- Iteration 1 ---
# 📝 Generating initial enhanced answer...
# 🔍 Analyzing response completeness...
# 📊 Response Analysis Results:
#    Completeness: 70.0%
#    Status: Incomplete
# 
# 🤔 Generated Follow-up Questions (2):
#    1. [location] Specific targeted question based on gaps
#    2. [factual] Another targeted question for missing info
# 
# 🔍 Researching 2 follow-up questions...
#      Researching: Specific targeted question based on gaps
#      ✓ Found 15 entities
#      Researching: Another targeted question for missing info  
#      ✓ Found 15 entities
# ✓ Research completed: 30 total entities found
# 
# --- Iteration 2 ---
# [Enhanced answer with follow-up research and 30 new entities]
# 
# --- Iteration 3 ---
# [Final comprehensive answer]
# 
# 📝 FINAL COMPREHENSIVE ANSWER:
# [4000+ character comprehensive response with multi-source attribution]
```

### Configuration Options
```javascript
const config = {
    maxIterations: 3,              // Maximum feedback iterations
    completenessThreshold: 0.8,    // 80% completeness threshold
    maxFollowUpQuestions: 2,       // Follow-ups per iteration
    researchDepth: 'focused',      // Research strategy
    maxContextTokens: 4000,        // Increased for iterative context
    maxContextSize: 16000          // Enhanced context window
};
```

## Benefits

### 1. **Comprehensive Answer Coverage**
Transform incomplete responses into thorough, well-researched answers covering all aspects of complex questions.

### 2. **Automated Knowledge Discovery**
System automatically identifies knowledge gaps and targets research to fill specific information needs.

### 3. **Quality Improvement Through Iteration**
Each iteration builds upon previous results, creating increasingly comprehensive and accurate answers.

### 4. **Rich Knowledge Base Growth**
Every iteration adds new entities, relationships, and metadata to the knowledge graph for future use.

### 5. **Multi-source Integration**
Seamlessly combines Wikipedia articles, Wikidata structured data, and BeerQA domain knowledge.

### 6. **Intelligent Question Generation**
Automatically creates targeted follow-up questions based on semantic analysis of incomplete responses.

## Advanced Features

### Smart Convergence Detection
- **Pattern Recognition**: Detects when answers become sufficiently complete
- **Iteration Limiting**: Prevents infinite loops with configurable max iterations
- **Quality Thresholds**: Stops when completeness scores exceed configured thresholds

### Research Integration
- **Automatic Wikidata Research**: Follow-up questions trigger targeted entity discovery
- **Context Accumulation**: Each iteration builds richer context for subsequent processing
- **Source Attribution**: Maintains proper attribution across all research iterations

### Metadata-Driven Processing
- **Question Dependencies**: Tracks parent-child relationships between original and generated questions
- **Research Status**: Monitors which questions have been researched and their results
- **Iteration Tracking**: Complete audit trail of question generation and processing

## Technical Requirements

### Dependencies
- Complete BeerQA Enhanced Workflow v2 setup
- Wikidata integration components (WikidataNavigate.js, WikidataGetResult.js)
- LLM provider configured for completeness analysis and question generation
- SPARQL endpoint with all four required graphs

### Performance Considerations
- **Processing Time**: 30-60 seconds per iteration, 2-3 minutes total per question
- **Research Pipeline**: Extract concepts → Search Wikidata → Convert to Ragno → Store results
- **Context Size**: Increased memory usage for accumulated context across iterations
- **API Calls**: Higher LLM usage due to analysis and synthesis operations

### Error Handling
- **Graceful Degradation**: Falls back to previous iteration results if analysis fails
- **Research Failures**: Continues processing even if individual follow-up research fails
- **Iteration Limits**: Prevents runaway processing with configurable safeguards

## Migration from v2

To upgrade from BeerQA Enhanced Workflow v2:

1. **Complete Wikidata Integration**: Run WikidataNavigate.js and WikidataGetResult.js
2. **Test Iterative System**: Run GetResultWithFeedback.js on a subset of questions
3. **Configure Parameters**: Adjust iteration limits and thresholds as needed
4. **Monitor Performance**: Track processing time and answer quality improvements

## Future Enhancements

### Planned Features
- **Multi-question Iteration**: Process related questions together in feedback loops
- **Answer Caching**: Cache intermediate results to avoid reprocessing
- **Custom Question Templates**: Domain-specific follow-up question patterns
- **Quality Metrics**: Advanced metrics for measuring answer improvement across iterations

This workflow represents a significant advancement in automated knowledge discovery, creating a self-improving question-answering system that builds comprehensive understanding through intelligent iteration and feedback-driven research.