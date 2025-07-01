# Flow Components Workflow

**Status 2025-07-01:** Complete refactored workflow system using standardized component APIs, comprehensive type definitions, and modular architecture patterns.

**tl;dr** :
* `node examples/flow/run-pipeline.js` (Complete 10-stage pipeline)
* `node examples/flow/01-load-questions.js` through `node examples/flow/10-iterative-feedback.js` (Individual stages)
* `node examples/flow/run-pipeline.js --stages 8-10 --mode comprehensive` (Final stages only)
* `node examples/flow/10-iterative-feedback.js --question "What is quantum computing?" --mode comprehensive` (Single question feedback)

**Ask Arbitrary Questions** (after processing your knowledge base):
* `node examples/flow/09-enhanced-answers.js --question "Your question here?"` (Comprehensive answers with Wikidata)
* `node examples/flow/10-iterative-feedback.js --question "Your question here?"` (Most thorough with feedback loops)

## Overview

The Flow Components system is a complete refactoring of the original BeerQA and Wikidata workflows into a clean, modular architecture. It transforms complex example scripts into reusable components with standardized APIs, comprehensive testing, and TypeScript support.

The system follows the `operation(input, resources, options)` API pattern throughout, enabling easy composition of complex workflows from simple, well-tested components. Each component handles a specific aspect of the knowledge processing pipeline while maintaining clean separation of concerns.

## Architecture

The Flow system operates on three layers:

- **Core Components Layer** (`src/compose/`, `src/aux/`): Reusable workflow, feedback, and research components
- **Utility Layer** (`src/utils/`): Common operations like graph management and SPARQL templates  
- **Examples Layer** (`examples/flow/`): Simplified demonstrations of component composition

All components use centralized configuration management through `Config.js` and support multiple storage backends with consistent graph URI patterns.

**Scripts should be run from the root directory of the project.**

## Flow Component Categories

### Workflow Components (`src/compose/workflows/`)

High-level orchestration components that combine multiple operations into complete processing pipelines.

#### BaseWorkflow
**Purpose**: Abstract base class providing common workflow patterns

**Operations**:
- Input validation and resource checking
- Standardized error handling and metadata generation
- Common logging and timing utilities
- Result formatting with success/error patterns

**API Pattern**:
```javascript
await workflow.execute(input, resources, options)
```

**Configuration Integration**:
```javascript
const workflowConfig = this._mergeConfig(options, {
    maxContextTokens: 6000,
    answerStyle: 'comprehensive',
    enhancementLevel: 'standard'
});
```

#### BeerQAWorkflow
**Purpose**: Standard BeerQA question-answering pipeline

**Operations**:
- **Question Processing**: Validates and normalizes question input
- **Context Retrieval**: Queries knowledge graphs for relevant content using embeddings
- **Answer Generation**: Uses LLM with augmented context to generate responses
- **Result Packaging**: Formats answers with metadata and source attribution

**Input Structure**:
```javascript
{
    question: { text: "What is quantum computing?", uri: "optional" }
}
```

**Expected Results**: Generated answer with context sources and relationship data

**Keywords**: `query`, `retrieve`, `contextualize`, `generate`, `answer`

#### WikidataWorkflow
**Purpose**: Enhanced BeerQA with external Wikidata knowledge integration

**Operations**:
- **Standard Processing**: Executes base BeerQA workflow first
- **Concept Extraction**: Uses LLM to identify key concepts from the question
- **Wikidata Research**: Searches and converts external entities using WikidataResearcher
- **Knowledge Integration**: Enhances answers with Wikidata findings
- **Enhanced Generation**: Creates comprehensive responses with external validation

**Enhancement Levels**:
- **Basic**: Simple keyword-based research (2 concepts)
- **Standard**: Balanced approach with multiple search angles
- **Comprehensive**: Full concept analysis with related entity exploration

**Expected Results**: Enhanced answer with Wikidata entity integration and source attribution

**Keywords**: `enhance`, `research`, `integrate`, `validate`, `enrich`

#### FeedbackWorkflow  
**Purpose**: Complete iterative feedback system for answer improvement

**Operations**:
- **Initial Enhancement**: Runs WikidataWorkflow for baseline answer
- **Completeness Analysis**: Uses ResponseAnalyzer to identify gaps and improvements
- **Question Generation**: Creates targeted follow-up research questions
- **Iterative Research**: Conducts additional research to fill identified gaps
- **Progressive Improvement**: Refines answers through multiple feedback iterations
- **Final Synthesis**: Generates comprehensive final response

**Workflow Modes**:
- **Fast**: 1 iteration, 1 follow-up question, basic enhancement
- **Standard**: 3 iterations, 2 follow-up questions per iteration
- **Comprehensive**: 4 iterations, 3 follow-up questions, comprehensive enhancement

**Expected Results**: Progressively improved answer with detailed iteration tracking

**Keywords**: `iterate`, `improve`, `analyze`, `research`, `synthesize`

### Feedback Components (`src/compose/feedback/`)

Specialized components for iterative answer improvement and quality analysis.

#### ResponseAnalyzer
**Purpose**: Analyzes answer completeness and identifies improvement opportunities

**Operations**:
- **Pattern Matching**: Uses heuristics to identify common incompleteness patterns
- **LLM Analysis**: Employs language models for sophisticated completeness assessment  
- **Gap Identification**: Locates specific areas where more information is needed
- **Scoring**: Provides numerical completeness scores (0.0-1.0)
- **Improvement Suggestions**: Generates specific recommendations for enhancement

**Analysis Methods**:
- `pattern-matching`: Fast heuristic analysis
- `llm-based`: Deep semantic analysis using language models
- `hybrid`: Combines both approaches for balanced accuracy/speed

**Expected Results**: Completeness score with detailed gap analysis and improvement suggestions

**Keywords**: `analyze`, `score`, `evaluate`, `assess`, `identify`

#### FollowUpGenerator
**Purpose**: Generates targeted research questions to address completeness gaps

**Operations**:
- **Gap Analysis**: Processes identified completeness gaps from ResponseAnalyzer
- **Question Synthesis**: Creates specific, actionable research questions
- **Priority Ranking**: Orders questions by expected improvement contribution
- **Research Coordination**: Manages question research status and results
- **Progress Tracking**: Monitors which questions have been researched

**Question Types**:
- **Definitional**: "What exactly is X?"
- **Relational**: "How does X relate to Y?"
- **Contextual**: "What is the broader context of X?"
- **Functional**: "How does X work?"

**Expected Results**: Prioritized list of research questions with metadata

**Keywords**: `generate`, `question`, `prioritize`, `target`, `research`

#### IterationManager
**Purpose**: Orchestrates complete iterative feedback loops

**Operations**:
- **Iteration Coordination**: Manages multiple feedback cycles
- **Threshold Monitoring**: Tracks progress toward completeness goals
- **Research Integration**: Coordinates follow-up question research with WikidataResearcher
- **Progressive Improvement**: Builds enhanced answers through iterations
- **Convergence Detection**: Identifies when further iterations provide minimal benefit

**Stopping Conditions**:
- Completeness threshold reached (default: 0.8)
- Maximum iterations performed (configurable)
- Minimal improvement detected
- Research quality insufficient

**Expected Results**: Complete iteration history with final improved answer

**Keywords**: `orchestrate`, `iterate`, `coordinate`, `improve`, `converge`

### Wikidata Components (`src/aux/wikidata/`)

Specialized components for external knowledge integration and cross-referencing.

#### WikidataResearcher
**Purpose**: Complete Wikidata research workflow with standardized API

**Operations**:
- **Concept Extraction**: Uses LLM to identify research concepts from questions
- **Entity Search**: Searches Wikidata for relevant entities using multiple strategies
- **RDF Conversion**: Converts Wikidata entities to Ragno format for graph storage
- **Knowledge Storage**: Stores research results in configured knowledge graphs
- **Statistics Tracking**: Monitors research performance and quality metrics

**Research Process**:
1. Extract key concepts from input text
2. Search Wikidata for entities matching each concept
3. Convert found entities to Ragno RDF format
4. Store entities with source metadata in knowledge graph
5. Return comprehensive research results with statistics

**Configuration Options**:
- `maxWikidataSearchResults`: Maximum entities to search (default: 15)
- `minEntityConfidence`: Minimum confidence threshold (default: 0.4)
- `enableHierarchySearch`: Enable entity hierarchy exploration
- `storeResults`: Automatically store research results

**Expected Results**: Converted Ragno entities with storage confirmation and metadata

**Keywords**: `research`, `extract`, `search`, `convert`, `store`

#### WikidataNavigator
**Purpose**: Enhanced ZPT navigation with Wikidata cross-referencing

**Operations**:
- **Navigation Enhancement**: Integrates Wikidata entities into ZPT navigation contexts
- **Cross-Reference Creation**: Links local entities with global Wikidata knowledge
- **Similarity Matching**: Uses embedding and text similarity for entity matching
- **Context Building**: Creates enhanced navigation contexts with mixed entity types
- **Relationship Generation**: Establishes formal relationships between entity sets

**Enhancement Process**:
1. Conduct Wikidata research for navigation context
2. Create cross-references between local and Wikidata entities
3. Build enhanced navigation context with combined entity set
4. Generate formal relationships for graph storage
5. Provide comprehensive navigation results

**Cross-Reference Types**:
- **Semantic Similarity**: Embedding-based entity matching
- **Text Similarity**: Label and description matching
- **Concept Overlap**: Shared semantic concepts

**Expected Results**: Enhanced navigation context with cross-referenced entity relationships

**Keywords**: `navigate`, `enhance`, `cross-reference`, `match`, `contextualize`

### Utility Components (`src/utils/`, `src/compose/sparql/`)

Supporting components that provide common functionality across the system.

#### GraphManager (`src/utils/`)
**Purpose**: Standard RDF graph operations with consistent error handling

**Operations**:
- **Graph Clearing**: Removes all triples from specified graphs
- **Graph Dropping**: Completely removes graph containers
- **Statistics Retrieval**: Counts triples, entities, and relationships
- **Health Checking**: Validates graph accessibility and integrity

**Expected Results**: Standardized operation results with metadata

**Keywords**: `manage`, `clear`, `drop`, `statistics`, `health`

#### TemplateManager (`src/compose/sparql/`)
**Purpose**: SPARQL query template management with parameter substitution

**Operations**:
- **Template Caching**: Manages reusable SPARQL query templates
- **Parameter Substitution**: Safe replacement of template variables
- **Built-in Templates**: Common patterns for BeerQA and feedback workflows
- **Validation**: Ensures parameter completeness and query syntax

**Template Categories**:
- **BeerQA**: Question retrieval, context building, answer generation
- **Feedback**: Completeness analysis, follow-up tracking, iteration management
- **Analytics**: Relationship analysis, statistics, quality metrics

**Expected Results**: Parameterized SPARQL queries ready for execution

**Keywords**: `template`, `substitute`, `parameterize`, `cache`, `validate`

## Configuration Management

### Standard Configuration Pattern

All components use consistent Config.js integration:

```javascript
// Component initialization
const config = new Config('./config/config.json');
await config.init();

// Resource creation
const resources = {
    llmHandler: await initializeLLMHandler(config),
    sparqlHelper: new SPARQLHelper(
        config.get('sparqlUpdateEndpoint'),
        { auth: config.get('sparqlAuth') }
    ),
    config: {
        beerqaGraphURI: 'http://purl.org/stuff/beerqa/test',
        wikidataGraphURI: 'http://purl.org/stuff/wikidata/research',
        wikipediaGraphURI: 'http://purl.org/stuff/wikipedia/research'
    }
};
```

**Keywords**: `configure`, `initialize`, `setup`

### LLM Provider Selection

Uses priority-based provider selection with API key validation:

```javascript
// Provider selection logic
const llmProviders = config.get('llmProviders') || [];
const chatProvider = llmProviders
    .filter(p => p.capabilities?.includes('chat'))
    .sort((a, b) => (a.priority || 999) - (b.priority || 999))[0];

// API key validation
if (chatProvider.type === 'mistral' && process.env.MISTRAL_API_KEY) {
    llmConnector = new MistralConnector(process.env.MISTRAL_API_KEY);
} else if (chatProvider.type === 'claude' && process.env.CLAUDE_API_KEY) {
    llmConnector = new ClaudeConnector(process.env.CLAUDE_API_KEY);
} else {
    // Fallback to Ollama
    llmConnector = new OllamaConnector('http://localhost:11434', 'qwen2:1.5b');
}
```

**Keywords**: `provider`, `priority`, `fallback`, `validate`

## 10-Stage Flow Pipeline

The Flow system implements the complete BeerQA iterative feedback workflow as described in `docs/manual/beerqa-feedback.md` through 10 distinct stages, each using Flow components with standardized APIs.

### Pipeline Overview

```bash
# Complete pipeline execution
node examples/flow/run-pipeline.js

# Individual stage execution
node examples/flow/01-load-questions.js
node examples/flow/02-augment-questions.js
node examples/flow/03-research-concepts.js
# ... through stage 10

# Selective stage execution
node examples/flow/run-pipeline.js --stages 1-5 --limit 10
node examples/flow/run-pipeline.js --stages 8-10 --mode comprehensive
```

### Stage 1: Load Questions
**Command**: `node examples/flow/01-load-questions.js [--limit N]`

**Purpose**: Initialize questions from JSON data with proper Flow metadata

**Operations**:
1. **Data Loading**: Reads test questions from `data/beerqa/beerqa_test_questions_v1.0.json`
2. **Corpuscle Creation**: Creates `ragno:Corpuscle` instances with standardized metadata
3. **Graph Storage**: Stores in BeerQA graph with Flow stage tracking
4. **URI Generation**: Creates consistent question URIs for pipeline tracking

**Expected Output**: 100 question corpuscles loaded with metadata

**Keywords**: `initialize`, `load`, `create`, `store`

### Stage 2: Augment Questions  
**Command**: `node examples/flow/02-augment-questions.js [--limit N]`

**Purpose**: Add vector embeddings and extract semantic concepts using Flow components

**Operations**:
1. **Embedding Generation**: Creates 1536-dimensional embeddings using nomic-embed-text
2. **Concept Extraction**: Uses LLM to identify 3-5 key concepts per question
3. **Metadata Storage**: Stores embeddings and concepts as `ragno:Attribute` entities
4. **Stage Tracking**: Updates processing stage to "augmented"

**Expected Output**: Questions enriched with embeddings and semantic concepts

**Keywords**: `augment`, `embed`, `extract`, `enrich`

### Stage 3: Research Concepts
**Command**: `node examples/flow/03-research-concepts.js [--limit N]`

**Purpose**: Research extracted concepts via Wikipedia using Flow components

**Operations**:
1. **Concept Retrieval**: Queries questions with extracted concepts
2. **Wikipedia Search**: Uses WikipediaSearch component for each concept
3. **Content Processing**: Converts search results to corpuscles with embeddings
4. **Knowledge Storage**: Stores Wikipedia content in separate research graph

**Expected Output**: 5-10 Wikipedia corpuscles per processed question

**Keywords**: `research`, `search`, `discover`, `ingest`

### Stage 8: Wikidata Research
**Command**: `node examples/flow/08-wikidata-research.js [--limit N]`

**Purpose**: Enhance corpus with global Wikidata entities using WikidataResearcher

**Operations**:
1. **Question Processing**: Retrieves questions ready for Wikidata research
2. **Entity Discovery**: Uses WikidataResearcher to find 10-15 relevant entities per question
3. **RDF Conversion**: Converts Wikidata entities to Ragno format
4. **Global Storage**: Stores entities in Wikidata research graph with metadata

**Expected Output**: Enhanced corpus with multi-source knowledge (Wikipedia + Wikidata)

**Keywords**: `enhance`, `discover`, `convert`, `globalize`

### Stage 9: Enhanced Answer Generation
**Command**: `node examples/flow/09-enhanced-answers.js [--limit N] [--question "text"]`

**Purpose**: Generate enhanced answers with multi-source context using WikidataWorkflow

**Operations**:
1. **Context Building**: Retrieves context from Wikipedia, Wikidata, and BeerQA sources
2. **Workflow Execution**: Uses WikidataWorkflow component for enhanced processing
3. **Answer Generation**: Creates comprehensive responses with source attribution
4. **Result Storage**: Stores enhanced answers with metadata for further processing

**Expected Output**: High-quality answers with multi-source attribution (2000-3000+ characters)

**Keywords**: `generate`, `enhance`, `contextualize`, `synthesize`

### Stage 10: Iterative Feedback Processing
**Command**: `node examples/flow/10-iterative-feedback.js [--limit N] [--question "text"] [--mode MODE]`

**Purpose**: Automated iterative question-answering with feedback loops using FeedbackWorkflow

**Operations**:
1. **Initial Analysis**: Analyzes enhanced answers for completeness using ResponseAnalyzer
2. **Follow-up Generation**: Creates targeted research questions using FollowUpGenerator
3. **Iterative Research**: Automatically researches follow-up questions via WikidataResearcher
4. **Progressive Improvement**: Refines answers through multiple iterations using IterationManager
5. **Final Synthesis**: Generates comprehensive final responses with all accumulated knowledge

**Feedback Modes**:
- `--mode fast`: 1 iteration, 1 follow-up question, basic enhancement
- `--mode standard`: 3 iterations, 2 follow-up questions per iteration
- `--mode comprehensive`: 4 iterations, 3 follow-up questions, comprehensive enhancement

**Expected Output**: Comprehensive answers with 4000+ characters, multiple source attribution, and complete coverage

**Keywords**: `iterate`, `analyze`, `improve`, `synthesize`, `feedback`

## Pipeline Execution Examples

### Complete Pipeline
```bash
# Run all stages with default settings
node examples/flow/run-pipeline.js

# Limited processing for testing
node examples/flow/run-pipeline.js --limit 3

# Comprehensive feedback mode
node examples/flow/run-pipeline.js --mode comprehensive
```

### Selective Stage Execution
```bash
# Foundation stages only (1-3)
node examples/flow/run-pipeline.js --stages 1-3 --limit 5

# Wikidata and feedback stages (8-10)
node examples/flow/run-pipeline.js --stages 8-10 --mode comprehensive

# Individual stages
node examples/flow/run-pipeline.js --stages 10 --question "What is quantum computing?"
```

### Single Question Processing
```bash
# Process single question through final stages
node examples/flow/09-enhanced-answers.js --question "What is artificial intelligence?"

# Complete iterative feedback for single question
node examples/flow/10-iterative-feedback.js --question "What is quantum computing?" --mode comprehensive
```

## Legacy Example Workflows

The original demonstration examples are still available for component testing:

### Basic Component Demonstration
**Command**: `node examples/flow/basic-beerqa.js`
**Purpose**: Shows BeerQAWorkflow component in isolation

### Wikidata Research Demonstration  
**Command**: `node examples/flow/wikidata-research.js`
**Purpose**: Demonstrates WikidataResearcher component functionality

### Feedback Loop Demonstration
**Command**: `node examples/flow/feedback-loop.js --mode comprehensive`
**Purpose**: Shows FeedbackWorkflow component with mock implementations

## Flow Component Performance

### Component Execution Timings
- **BeerQAWorkflow**: 2-5 seconds (depends on context size)
- **WikidataWorkflow**: 10-30 seconds (includes external research)
- **FeedbackWorkflow**: 1-5 minutes (depends on iteration count)
- **WikidataResearcher**: 5-15 seconds per research operation
- **ResponseAnalyzer**: 1-3 seconds per analysis
- **FollowUpGenerator**: 2-5 seconds per question set

**Keywords**: `performance`, `timing`, `benchmark`

### Memory Requirements
- **Base Components**: 50-100MB RAM
- **Wikidata Research**: +100-200MB for entity processing
- **Feedback Iterations**: Linear growth with iteration count
- **Graph Operations**: Depends on knowledge graph size

**Keywords**: `memory`, `requirements`, `scale`

### Storage Utilization
- **Component Results**: ~1-5KB per operation result
- **Research Data**: ~500-2000 bytes per discovered entity
- **Iteration History**: ~2-10KB per feedback iteration
- **Total Workflow**: ~10-50KB for complete processing

**Keywords**: `storage`, `utilization`, `data`

## Integration Testing

### Test Coverage
The system includes comprehensive integration tests in `tests/integration/`:

- **Mock Components**: Simulated external services for reliable testing
- **API Validation**: Ensures all components follow standard patterns
- **Error Handling**: Tests graceful failure and recovery scenarios
- **Configuration Testing**: Validates different configuration scenarios

**Keywords**: `test`, `validate`, `mock`, `coverage`

### Testing Commands
```bash
# Run all integration tests
npm test -- tests/integration/

# Test specific component
npm test -- tests/integration/workflows/

# Test with coverage
npm test:coverage
```

**Keywords**: `test`, `run`, `coverage`, `validate`

## Type Definitions

### TypeScript Support
Complete type definitions are available in `src/types/`:

- **workflow.d.ts**: Workflow component interfaces and result types
- **feedback.d.ts**: Feedback system types and analysis structures  
- **wikidata.d.ts**: Wikidata integration types and entity formats
- **index.d.ts**: Common types and central exports

**Usage Example**:
```typescript
import { WorkflowResult, FeedbackIteration } from './src/types/index.js';

const result: WorkflowResult<FeedbackWorkflowResult> = await workflow.execute(
    input, 
    resources, 
    options
);
```

**Keywords**: `types`, `typescript`, `interfaces`, `definitions`

### IDE Integration
Type definitions provide:
- **IntelliSense**: Auto-completion for component APIs
- **Error Detection**: Compile-time validation of parameter types
- **Documentation**: Inline API documentation in IDEs
- **Refactoring Support**: Safe renaming and restructuring

**Keywords**: `ide`, `intellisense`, `documentation`, `validation`

## Known Issues and Troubleshooting

### Configuration Issues
**Keywords**: `configure`, `debug`, `fix`

**Problem**: `config.initialize is not a function`
**Solution**: Use correct Config.js initialization pattern:
```javascript
const config = new Config('./config/config.json');
await config.init();  // Must call init(), not initialize()
```

**Problem**: LLM provider selection errors
**Solution**: Verify API keys are available:
```bash
# Check environment variables
echo $MISTRAL_API_KEY
echo $CLAUDE_API_KEY

# Verify Ollama availability
ollama list
ollama pull qwen2:1.5b
ollama pull nomic-embed-text
```

### Component Integration Issues
**Keywords**: `integrate`, `debug`, `validate`

**Problem**: Component resource validation failures
**Solution**: Ensure all required resources are provided:
```javascript
const resources = {
    llmHandler,     // Required for all components
    sparqlHelper,   // Required for storage operations
    config          // Required for graph URIs
    // embeddingHandler - Optional for similarity operations
};
```

**Problem**: Workflow composition errors
**Solution**: Check component API compatibility and input/output formats

### Performance Issues
**Keywords**: `performance`, `optimize`, `debug`

**Problem**: Slow Wikidata research operations
**Solution**: 
- Reduce `maxWikidataSearchResults` in options
- Disable hierarchy search for faster results
- Use caching for repeated research

**Problem**: Memory usage in feedback loops
**Solution**:
- Reduce `maxIterations` for large workflows
- Clear intermediate results between iterations
- Monitor garbage collection patterns

### Storage and SPARQL Issues
**Keywords**: `storage`, `sparql`, `debug`

**Problem**: SPARQL authentication failures
**Solution**: Verify configuration and endpoint availability:
```javascript
const sparqlHelper = new SPARQLHelper(
    config.get('sparqlUpdateEndpoint'),
    {
        auth: config.get('sparqlAuth'),
        timeout: 30000
    }
);
```

**Problem**: Graph URI mismatches between components
**Solution**: Use consistent configuration patterns:
```javascript
const workflowConfig = {
    beerqaGraphURI: 'http://purl.org/stuff/beerqa/test',
    wikidataGraphURI: 'http://purl.org/stuff/wikidata/research',
    wikipediaGraphURI: 'http://purl.org/stuff/wikipedia/research'
};
```

**Keywords**: `debug`, `troubleshoot`, `fix`, `configure`, `storage`, `performance`

## Quality Assessment

### Component Quality Indicators
- **API Consistency**: All components follow `operation(input, resources, options)` pattern
- **Error Handling**: Graceful failure with informative error messages
- **Resource Management**: Proper cleanup and disposal of external connections
- **Type Safety**: Comprehensive TypeScript definitions for all APIs

**Keywords**: `quality`, `assess`, `validate`, `consistency`

### Workflow Quality Indicators
- **Result Completeness**: All workflows return success/error status with metadata
- **Performance Tracking**: Duration and resource usage metrics included
- **Source Attribution**: Clear traceability of information sources
- **Iteration Effectiveness**: Measurable improvement in feedback workflows

**Keywords**: `workflow`, `quality`, `performance`, `attribution`

### Integration Quality Indicators
- **Test Coverage**: >90% coverage of component APIs and error paths
- **Configuration Validation**: Proper handling of missing or invalid configurations
- **Dependency Management**: Clean separation between required and optional dependencies
- **Backward Compatibility**: Existing functionality preserved during refactoring

**Keywords**: `integration`, `test`, `coverage`, `compatibility`

## Future Enhancements

### Planned Component Improvements
- **Streaming APIs**: Support for real-time processing and progress updates
- **Batch Operations**: Parallel processing of multiple questions
- **Result Caching**: Intelligent caching of research and analysis results
- **Quality Metrics**: Automated assessment of component and workflow quality

**Keywords**: `improve`, `stream`, `batch`, `cache`, `metrics`

### Integration Opportunities
- **External Knowledge Sources**: Integration with additional APIs beyond Wikidata
- **Advanced Analytics**: Machine learning-based quality assessment and optimization
- **User Interface**: Web-based workflow composition and monitoring tools
- **API Gateway**: RESTful API endpoints for workflow execution

**Keywords**: `integrate`, `extend`, `analytics`, `interface`, `api`

### Architecture Evolution
- **Microservices**: Component deployment as independent services
- **Event-Driven**: Asynchronous workflow execution with event streams
- **Distributed Processing**: Multi-node execution for large-scale workflows
- **Workflow Orchestration**: Visual workflow design and execution management

**Keywords**: `architecture`, `microservices`, `distributed`, `orchestration`

## System Requirements

- **Node.js**: 20.11.0+ with ES modules support
- **SPARQL Endpoint**: Apache Fuseki or compatible with authentication
- **LLM Providers**: Ollama (local) or API keys for Mistral/Claude
- **Memory**: 2-8GB RAM depending on workflow complexity
- **Storage**: 10-100MB for component results and workflow data
- **Network**: Internet access for Wikidata research and external LLM APIs

**Keywords**: `requirements`, `dependencies`, `system`, `setup`

### Development Dependencies
- **Testing**: Vitest for unit and integration testing
- **TypeScript**: For type checking and IDE support (optional)
- **Linting**: ESLint for code quality (if configured)
- **Documentation**: JSDoc for API documentation generation

**Keywords**: `development`, `testing`, `typescript`, `documentation`