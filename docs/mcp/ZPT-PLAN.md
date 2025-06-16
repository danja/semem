# ZPT-MCP Integration Implementation Plan

## 📋 Project Overview

**Objective**: Integrate the sophisticated ZPT (3-dimensional knowledge graph navigation) system into the existing MCP platform to provide intuitive spatial exploration of semantic content.

**Current State**: 26 MCP tools + 11 resources (Phases 1 & 2 complete)
**Target State**: 32 MCP tools + 15 resources (with ZPT Phase 3)

## 🎯 ZPT System Capabilities

### 3-Dimensional Navigation Model
- **Zoom**: Controls abstraction level (`entity` → `unit` → `text` → `community` → `corpus`)
- **Pan**: Manages content filtering (topic, temporal, geographic, entity constraints)  
- **Tilt**: Adjusts representation style (`keywords` → `embedding` → `graph` → `temporal`)

### Key Features
- **Stateless Operation**: Each request is self-contained for scalability
- **Multi-Strategy Selection**: Combines embedding similarity, keyword matching, graph connectivity, and temporal sequencing
- **LLM-Optimized Output**: All transformations designed for optimal AI consumption
- **Token-Aware Processing**: Intelligent chunking and content allocation
- **Performance Optimization**: Multi-level caching and parallel processing

## 🛠️ Implementation Plan

### Phase 1: Core ZPT Tools (6 Tools)

#### 1. `zpt_navigate` - Primary 3D Navigation Tool
**Purpose**: Main ZPT navigation with full Zoom/Pan/Tilt processing
**Parameters**:
```javascript
{
  query: string,                    // Navigation query
  zoom: "entity|unit|text|community|corpus",
  pan: {
    topic?: string,                 // Topic filtering
    temporal?: { start?: date, end?: date },
    geographic?: { bbox?: [n,n,n,n] },
    entity?: string[]               // Specific entities
  },
  tilt: "keywords|embedding|graph|temporal",
  transform?: {
    maxTokens?: number,             // Token budget (default: 4000)
    format?: "json|markdown|structured|conversational",
    tokenizer?: "cl100k_base|p50k_base|claude|llama",
    chunkStrategy?: "semantic|adaptive|fixed|sliding",
    includeMetadata?: boolean
  }
}
```
**Returns**: Transformed content + navigation metadata + performance metrics

#### 2. `zpt_preview` - Navigation Preview Tool  
**Purpose**: Quick estimation without full transformation for exploration
**Parameters**:
```javascript
{
  query: string,
  zoom?: "entity|unit|text|community|corpus",
  pan?: { /* same as navigate */ }
}
```
**Returns**: Available content counts, estimated token usage, suggested parameters

#### 3. `zpt_get_schema` - Parameter Schema Tool
**Purpose**: Complete ZPT parameter documentation and validation rules
**Parameters**: None
**Returns**: JSON Schema for all ZPT parameters with examples and constraints

#### 4. `zpt_validate_params` - Parameter Validation Tool
**Purpose**: Validate ZPT parameters with detailed error reporting
**Parameters**:
```javascript
{
  params: {
    query: string,
    zoom: string,
    pan: object,
    tilt: string,
    transform?: object
  }
}
```
**Returns**: Validation result with detailed error messages and suggestions

#### 5. `zpt_get_options` - Available Options Tool
**Purpose**: Get available parameter values for current corpus state
**Parameters**:
```javascript
{
  context?: "current|full",         // Context scope
  query?: string                    // Optional query for contextual options
}
```
**Returns**: Available zoom levels, domains, entities, time ranges based on corpus

#### 6. `zpt_analyze_corpus` - Corpus Analysis Tool
**Purpose**: Analyze corpus structure for ZPT navigation optimization
**Parameters**:
```javascript
{
  analysisType?: "structure|performance|recommendations",
  includeStats?: boolean
}
```
**Returns**: Corpus statistics, performance recommendations, navigation tips

### Phase 2: ZPT Resources (4 Resources)

#### 1. `semem://zpt/schema` - Complete Parameter Schema
- Full JSON schema for all ZPT parameters
- Validation rules and constraints
- Default values and examples
- Error code documentation

#### 2. `semem://zpt/examples` - Navigation Examples  
- Basic navigation patterns
- Advanced filtering scenarios
- Multi-dimensional navigation combinations
- Performance optimization examples

#### 3. `semem://zpt/guide` - ZPT Navigation Guide
- 3D navigation concept explanation
- Zoom/Pan/Tilt parameter guidance
- Best practices and recommendations
- Integration with existing Semem tools

#### 4. `semem://zpt/performance` - Performance Guide
- Caching strategies and optimization
- Token budget management
- Concurrent processing patterns
- Performance monitoring and metrics

## 🏗️ Technical Implementation Strategy

### Integration with Existing MCP Infrastructure

#### Tool Registration Pattern
```javascript
// Follow established MCP patterns from memory-tools-http.js
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: [...existingTools, ...zptTools] };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name.startsWith('zpt_')) {
    return await handleZPTTool(request);
  }
  // ... existing handlers
});
```

#### ZPT Service Integration
```javascript
class ZPTService {
  constructor(memoryManager, ragnoStore, llmHandler) {
    this.memoryManager = memoryManager;
    this.ragnoStore = ragnoStore;
    this.llmHandler = llmHandler;
    this.parameterProcessor = new ParameterProcessor();
    this.corpuscleSelector = new CorpuscleSelector();
    this.corpuscleTransformer = new CorpuscleTransformer();
  }

  async navigate(query, zoom, pan, tilt, transform = {}) {
    // Validate parameters
    const validated = this.parameterProcessor.validateParameters({
      query, zoom, pan, tilt, transform
    });

    // Select content using multi-strategy approach
    const selected = await this.corpuscleSelector.selectContent(
      validated.query, validated.zoom, validated.pan, validated.tilt
    );

    // Transform content for LLM consumption
    const transformed = await this.corpuscleTransformer.transformContent(
      selected, validated.tilt, validated.transform
    );

    // Store navigation result in memory
    await this.storeNavigationResult(query, validated, transformed);

    return transformed;
  }
}
```

### File Structure and Organization

```
mcp/
├── tools/
│   └── zpt-tools.js              # 6 ZPT tools implementation
├── resources/
│   └── zpt-resources.js          # 4 ZPT resources implementation
├── lib/
│   ├── zpt-service.js            # ZPT service orchestration
│   ├── zpt-parameter-processor.js # Parameter validation and processing
│   └── zpt-integration.js        # Integration with existing services
├── test/
│   └── test-zpt-tools.js         # ZPT tool validation and testing
└── examples/
    └── zpt-navigation-examples.js # Usage examples and prompts
```

### Error Handling Strategy

#### Validation Errors
```javascript
class ZPTValidationError extends Error {
  constructor(field, value, constraint) {
    super(`Invalid ${field}: ${value}. ${constraint}`);
    this.field = field;
    this.value = value;
    this.constraint = constraint;
    this.code = 'ZPT_VALIDATION_ERROR';
  }
}
```

#### Service Integration Errors
```javascript
const handleZPTError = (error, toolName) => {
  if (error instanceof ZPTValidationError) {
    return {
      success: false,
      error: 'VALIDATION_ERROR',
      message: error.message,
      field: error.field,
      suggestions: getValidationSuggestions(error.field)
    };
  }
  // ... other error types
};
```

## 🧪 Testing and Validation Strategy

### Testing Framework
```javascript
// Comprehensive tool testing following existing patterns
const testZPTTools = async () => {
  const results = {
    toolsRegistered: 0,
    toolsValidated: 0,
    resourcesRegistered: 0,
    resourcesValidated: 0,
    errors: []
  };

  // Test each ZPT tool
  for (const toolName of ZPT_TOOLS) {
    try {
      await testZPTTool(toolName);
      results.toolsValidated++;
    } catch (error) {
      results.errors.push({ tool: toolName, error: error.message });
    }
  }

  return results;
};
```

### Integration Testing
- **Memory Integration**: Test navigation result storage and retrieval
- **Ragno Integration**: Test corpus selection and graph traversal
- **Context Integration**: Test ZPT-aware context management
- **Performance Testing**: Test caching and concurrent processing

### Example Test Cases
```javascript
const exampleNavigationTests = [
  {
    name: "Basic Entity Navigation",
    params: {
      query: "artificial intelligence",
      zoom: "entity",
      tilt: "keywords"
    },
    expected: { contentType: "entity", format: "keywords" }
  },
  {
    name: "Complex Multi-Parameter Navigation",
    params: {
      query: "machine learning algorithms",
      zoom: "unit",
      pan: { 
        temporal: { start: "2020-01-01", end: "2024-12-31" },
        topic: "deep learning"
      },
      tilt: "embedding",
      transform: { maxTokens: 6000, format: "structured" }
    },
    expected: { tokenCount: "≤6000", format: "structured" }
  }
];
```

## 📈 Performance Optimization

### Caching Strategy
- **L1 Cache**: Parameter validation results (in-memory, 5-minute TTL)
- **L2 Cache**: Selection results (shared cache, 1-hour TTL)
- **L3 Cache**: Transformation results (persistent, 24-hour TTL)

### Parallel Processing
- **Selection Strategies**: Run in parallel for faster results
- **Transformation Pipeline**: Concurrent chunking and formatting
- **Cache Operations**: Non-blocking cache updates

### Resource Management
- **Token Optimization**: Smart allocation based on content importance
- **Memory Efficiency**: Streaming processing for large results
- **Connection Pooling**: Efficient SPARQL and LLM connections

## 🔄 Integration Points

### Existing Tool Synergy
- **`ragno_*` tools**: ZPT provides intuitive interface to Ragno capabilities
- **`semem_*` tools**: Navigation results enhance memory storage
- **Context tools**: ZPT-aware context window optimization

### Enhanced Workflows
```javascript
// Example: Enhanced knowledge discovery workflow
// 1. Use zpt_preview to explore available content
// 2. Use zpt_navigate for detailed exploration
// 3. Use semem_store_interaction to save results
// 4. Use ragno_search_dual for follow-up queries
```

## 📝 Documentation Strategy

### API Documentation
- Complete parameter documentation with examples
- Error code reference with solutions
- Integration patterns with existing tools
- Performance tuning guidelines

### Example Prompts
```markdown
# ZPT Navigation Examples

## Basic Navigation
"Use zpt_navigate to explore 'quantum computing' at entity level with keyword representation"

## Advanced Filtering
"Navigate 'climate change' with temporal filter 2020-2024, entity focus, and embedding representation"

## Performance Optimization
"Preview 'machine learning' navigation options before full processing"
```

## 🎯 Success Criteria

### Functional Requirements
- ✅ 6 ZPT tools implemented and tested
- ✅ 4 ZPT resources available and documented
- ✅ Integration with existing 26 tools maintained
- ✅ No breaking changes to current functionality

### Quality Requirements
- ✅ Comprehensive input validation with helpful error messages
- ✅ Performance metrics and monitoring integration
- ✅ Memory and context management integration
- ✅ Extensive testing and example coverage

### User Experience
- ✅ Intuitive 3D navigation metaphor
- ✅ Clear parameter documentation and guidance
- ✅ Helpful error messages and suggestions
- ✅ Smooth integration with existing workflows

## 🚀 Deployment and Rollout

### Phase 1: Implementation (Day 1)
- Core ZPT service implementation
- 6 ZPT tools with validation
- 4 ZPT resources with documentation

### Phase 2: Testing and Integration (Day 2)  
- Comprehensive testing framework
- Integration with existing tools
- Performance optimization
- Example creation and validation

### Phase 3: Documentation and Examples (Day 3)
- Complete API documentation
- Usage examples and prompts  
- Performance tuning guide
- Integration best practices

## 📊 Expected Impact

### Quantitative Metrics
- **Tool Count**: 26 → 32 (23% increase)
- **Resource Count**: 11 → 15 (36% increase)
- **Navigation Capability**: Linear → 3-dimensional exploration
- **User Experience**: Complex SPARQL → Intuitive spatial navigation

### Qualitative Benefits
- **Accessibility**: Makes knowledge graph exploration intuitive
- **Flexibility**: Multiple navigation strategies for different use cases
- **Performance**: Optimized content selection and transformation
- **Integration**: Seamless workflow with existing Semem capabilities

---

**Status**: Ready for Implementation
**Estimated Completion**: 3 days
**Dependencies**: Existing Semem ZPT codebase, MCP infrastructure
**Risk Level**: Low (leveraging proven ZPT architecture and established MCP patterns)