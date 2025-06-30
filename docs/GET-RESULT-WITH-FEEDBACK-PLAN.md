# GetResultWithFeedback.js Implementation Plan

## Overview
Create an iterative question-answering system that automatically generates follow-up questions when information is incomplete, feeds them back into the knowledge discovery pipeline, and iterates until comprehensive answers are achieved.

## Core Architecture

### 1. Feedback Detection System
- **Response Analysis**: Parse LLM responses to detect phrases indicating missing information:
  - "additional information would be helpful"
  - "not possible to determine" 
  - "would need to know"
  - "cannot determine"
- **Question Extraction**: Use LLM to extract specific follow-up questions from incomplete responses
- **Completeness Scoring**: Rate answer completeness (0-100%) based on question complexity and available context

### 2. Iterative Pipeline
```
Original Question → WikidataGetResult → 
  ↓ (if incomplete)
Generate Follow-up Questions → Store as New Questions → 
  ↓
Research Phase (WikidataResearch + QuestionResearch) → 
  ↓
Navigation Phase (WikidataNavigate) → 
  ↓ 
Enhanced Answer Generation → 
  ↓
Merge with Original Answer → Final Response
```

### 3. Key Components

#### A. Enhanced Prompt System
- Modify prompts to explicitly request follow-up questions when information is missing:
  ```
  "If information is incomplete, generate 2-3 specific follow-up questions that would help complete the answer. Format as: FOLLOW-UP QUESTIONS: 1. Question 2. Question 3. Question"
  ```

#### B. Question Storage & Management
- Store generated questions in BeerQA graph with metadata:
  - Original question reference
  - Iteration level (0=original, 1=first feedback, etc.)
  - Question type (clarification, fact-finding, relationship)
  - Priority score

#### C. Research Enhancement
- Expand WikidataResearch.js to handle follow-up questions
- Enhanced concept extraction for derived questions
- Cross-reference between original and follow-up question entities

#### D. Answer Synthesis
- Merge information from multiple iterations
- Maintain source attribution across iterations
- Generate comprehensive final answers

## Implementation Files

### 1. `GetResultWithFeedback.js` (Main orchestrator)
- Iterative question-answering loop
- Progress tracking and convergence detection
- Final answer synthesis

### 2. `FeedbackAnalyzer.js` (Response analysis)
- Detect incomplete responses using pattern matching and LLM analysis
- Extract follow-up questions from incomplete answers
- Score answer completeness (0.0-1.0 scale)
- Categorize question types (person, location, temporal, factual, etc.)

### 3. `QuestionGenerator.js` (Question creation)
- Generate targeted follow-up questions with metadata
- Store questions with proper RDF metadata in BeerQA graph
- Manage question dependencies and iteration tracking
- Priority scoring and question categorization

### 4. Enhanced `WikidataGetResult.js`
- Add feedback-aware prompts requesting follow-up questions
- Support iteration metadata and context accumulation
- Enable answer merging across iterations
- Export functions for reuse in iterative system

## Implementation Status

### ✅ Completed Components

#### FeedbackAnalyzer.js
- **Pattern Detection**: 17 incompleteness patterns (e.g., "additional information would be helpful")
- **LLM Analysis**: Completeness scoring with structured response parsing
- **Question Extraction**: Automatic generation of 2-3 follow-up questions
- **Question Categorization**: 7 types (person, location, temporal, classification, quantitative, factual, general)
- **Priority Calculation**: Smart priority scoring based on term overlap and question type

#### QuestionGenerator.js
- **RDF Storage**: Store questions with full metadata in BeerQA graph
- **Iteration Tracking**: Support for multi-level iteration dependencies
- **Research Management**: Mark questions as researched with results tracking
- **Statistics**: Comprehensive tracking of generation and research progress
- **SPARQL Integration**: Full SPARQL query support for question lifecycle

#### GetResultWithFeedback.js
- **Iterative Processing**: Complete feedback loop with configurable max iterations
- **Multi-source Integration**: Combines Wikidata, Wikipedia, and BeerQA contexts
- **Answer Synthesis**: LLM-based synthesis of multi-iteration results
- **Progress Tracking**: Detailed statistics and iteration monitoring
- **Research Integration**: Automatic follow-up question research via WikidataResearch.js

#### Enhanced WikidataGetResult.js
- **Feedback-aware Prompts**: Modified to request follow-up questions
- **Function Exports**: All key functions exported for reuse
- **Backward Compatibility**: Maintains original CLI functionality

## Configuration Options
- **Max iterations**: 3 (configurable)
- **Completeness threshold**: 80% (configurable)
- **Max follow-up questions**: 2 per iteration (configurable)
- **Research depth**: Focused strategy for targeted research
- **Context limits**: Increased to 4000 tokens for iterative context

## Success Metrics
- **Answer completeness improvement** per iteration
- **Knowledge gap closure rate** through follow-up research
- **Entity discovery enhancement** via iterative research
- **Source diversity increase** across iterations

## Usage Example
```bash
# Run iterative question answering with feedback loops
node examples/beerqa-wikidata/GetResultWithFeedback.js

# Output includes:
# - Initial enhanced answers
# - Completeness analysis (0-100% score)
# - Generated follow-up questions with priorities
# - Iterative research results
# - Final synthesized comprehensive answers
```

## Technical Architecture

### Data Flow
1. **Initial Answer**: Generate using enhanced Wikidata approach
2. **Analysis**: Detect incompleteness patterns and score completeness
3. **Question Generation**: Extract 2-3 targeted follow-up questions
4. **Storage**: Store questions with RDF metadata in knowledge graph
5. **Research**: Perform Wikidata research for follow-up questions
6. **Iteration**: Repeat with enhanced context until complete or max iterations
7. **Synthesis**: Generate final comprehensive answer from all iterations

### RDF Schema Extensions
- `beerqa:iterationLevel`: Track question generation levels
- `beerqa:parentQuestion`: Link follow-up to original questions
- `beerqa:completenessScore`: Store analysis results
- `beerqa:researchCompleted`: Track research status
- `beerqa:questionType`: Categorize question types for better processing

### Integration Points
- **WikidataResearch.js**: Research follow-up questions
- **WikidataNavigate.js**: Enhanced navigation with follow-up entities
- **SPARQLHelper.js**: All SPARQL operations for question management
- **LLMHandler**: Analysis, question generation, and answer synthesis

## Benefits

### 1. **Comprehensive Answers**
Transform incomplete responses into thorough, well-researched answers through intelligent iteration.

### 2. **Knowledge Base Growth**
Each iteration adds new entities and relationships to the knowledge graph, creating a richer semantic memory.

### 3. **Adaptive Research**
System learns what information is missing and automatically targets research to fill specific gaps.

### 4. **Quality Improvement**
Iterative refinement leads to higher quality answers with better source attribution and completeness.

### 5. **Automated Discovery**
Reduces manual intervention by automatically identifying and researching knowledge gaps.

This system represents a significant advancement in automated knowledge discovery, creating a self-improving question-answering pipeline that builds comprehensive understanding through intelligent iteration and feedback.