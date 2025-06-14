# ZPT Implementation Plan

## Overview

ZPT provides parameter-driven navigation through a Ragno corpus using three dimensions (zoom/pan/tilt) to select corpuscles. A transformation layer prepares the selected content for LLM consumption by managing size and structure constraints.

## Core Concepts

### Navigation Parameters

1. **Zoom** - Abstraction level
   - `entity`: Specific ragno:Entity elements
   - `unit`: ragno:Unit semantic units
   - `text`: ragno:TextElement full content
   - `community`: ragno:Community summaries
   - `corpus`: ragno:Corpus overview

2. **Pan** - Domain filtering
   - `topic`: Subject area constraints
   - `entity`: Specific entity scope
   - `temporal`: Time period bounds
   - `geographic`: Location constraints

3. **Tilt** - Representation format
   - `embedding`: Vector representations
   - `keywords`: Term-based summaries
   - `graph`: Structural relationships
   - `temporal`: Time-ordered sequences

### LLM Transformation Layer

Converts raw corpuscles into LLM-optimized formats:
- Token count management
- Context window fitting
- Structured prompt formatting
- Metadata preservation

## Architecture Components

### 1. Parameter Processing
```
src/zpt/parameters/
├── ParameterValidator.js    # Validate zoom/pan/tilt inputs
├── ParameterNormalizer.js   # Standardize parameter formats
├── FilterBuilder.js         # Convert to Ragno queries
└── SelectionCriteria.js    # Build selection rules
```

### 2. Corpuscle Selection
```
src/zpt/selection/
├── CorpuscleSelector.js     # Parameter-based selection
├── ZoomLevelMapper.js       # Map zoom to element types
├── PanDomainFilter.js       # Apply domain constraints
└── TiltProjector.js         # Generate representations
```

### 3. LLM Transformation
```
src/zpt/transform/
├── CorpuscleTransformer.js  # Main transformation engine
├── TokenCounter.js          # Token usage estimation
├── ContentChunker.js        # Split/merge for size limits
├── PromptFormatter.js       # LLM-friendly structuring
└── MetadataEncoder.js       # Preserve navigation context
```

### 4. API Layer
```
src/zpt/api/
├── NavigationEndpoint.js    # RESTful navigation handler
├── RequestParser.js         # Parse navigation parameters
├── ResponseFormatter.js     # Format transformed output
└── ErrorHandler.js          # Validation and error responses
```

## Key Features

### 1. Stateless Navigation API
```http
POST /api/navigate
{
  "zoom": "unit",
  "pan": {
    "topic": "machine-learning",
    "temporal": {
      "start": "2024-01-01",
      "end": "2024-12-31"
    }
  },
  "tilt": "keywords",
  "transform": {
    "maxTokens": 4000,
    "format": "markdown",
    "includeMetadata": true
  }
}
```

### 2. Parameter-Driven Selection
```javascript
// Direct parameter mapping
const selector = new CorpuscleSelector(ragnoCorpus);
const corpuscles = selector.select({
  zoom: 'unit',
  pan: { topic: 'neural-networks' },
  tilt: 'embedding'
});
```

### 3. LLM Transformation Pipeline
```javascript
// Transform for LLM consumption
const transformer = new CorpuscleTransformer({
  maxTokens: 4000,
  tokenizer: 'cl100k_base',
  format: 'structured'
});

const llmReady = transformer.transform(corpuscles, {
  preserveStructure: true,
  addNavContext: true,
  chunkStrategy: 'semantic'
});
```

### 4. Response Formats

#### Structured Response
```json
{
  "navigation": {
    "zoom": "unit",
    "pan": { "topic": "machine-learning" },
    "tilt": "keywords"
  },
  "content": {
    "summary": "Extracted keywords and key concepts",
    "items": [...],
    "tokenCount": 3847
  },
  "metadata": {
    "corpuscleCount": 12,
    "sourceElements": ["entity:123", "unit:456"],
    "timestamp": "2025-06-12T10:30:00Z"
  }
}
```

## Implementation Strategy

### Phase 1: Parameter System (Week 1)
1. Design parameter schemas
2. Implement validators and normalizers
3. Create filter builders

### Phase 2: Selection Engine (Week 2)
1. Build corpuscle selector
2. Implement dimension mappers
3. Create projection system

### Phase 3: LLM Transform (Week 3)
1. Implement token counting
2. Build content chunking
3. Create format templates

### Phase 4: API Development (Week 4)
1. RESTful endpoints
2. Request/response handling
3. Error management

## Technical Specifications

### Parameter Schema
```javascript
{
  zoom: {
    type: 'enum',
    values: ['entity', 'unit', 'text', 'community', 'corpus'],
    required: true
  },
  pan: {
    type: 'object',
    properties: {
      topic: { type: 'string' },
      entity: { type: 'array', items: 'string' },
      temporal: {
        type: 'object',
        properties: {
          start: { type: 'date' },
          end: { type: 'date' }
        }
      },
      geographic: { type: 'object' }
    }
  },
  tilt: {
    type: 'enum',
    values: ['embedding', 'keywords', 'graph', 'temporal'],
    required: true
  },
  transform: {
    type: 'object',
    properties: {
      maxTokens: { type: 'number', default: 4000 },
      format: { type: 'enum', values: ['json', 'markdown', 'structured'] },
      tokenizer: { type: 'string', default: 'cl100k_base' }
    }
  }
}
```

### Transformation Strategies

1. **Token Budget Management**
   - Estimate tokens before selection
   - Prioritize by relevance within budget
   - Provide continuation tokens if needed

2. **Content Structuring**
   - Hierarchical organization for context
   - Preserve semantic boundaries
   - Include navigation breadcrumbs

3. **Metadata Encoding**
   - Inline context markers
   - Source attribution
   - Navigation state preservation

### API Endpoints

- `POST /api/navigate` - Single navigation request
- `GET /api/navigate/options` - Available parameter values
- `POST /api/navigate/preview` - Preview without full transform
- `GET /api/navigate/schema` - Parameter schema documentation

## Performance Considerations

1. **Caching**: Cache transformed results by parameter hash
2. **Streaming**: Support streaming for large responses
3. **Parallel Processing**: Process multiple corpuscles concurrently
4. **Token Estimation**: Fast approximate counting before full processing

## Configuration

```javascript
{
  "zpt": {
    "transform": {
      "defaultMaxTokens": 4000,
      "defaultFormat": "structured",
      "chunkOverlap": 100,
      "metadataTokenBudget": 200
    },
    "cache": {
      "ttl": 3600,
      "maxSize": "1GB"
    }
  }
}
```