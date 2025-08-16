# Ask Panel Enhancements

This document describes the enhancement features added to the Semem Ask panel, providing users with additional knowledge sources to improve response quality.

## Overview

The Ask panel now supports three enhancement options that can be used individually or in combination:

- **HyDE (Hypothetical Document Embeddings)**: Generates hypothetical documents to improve semantic search
- **Wikipedia**: Integrates Wikipedia search for factual knowledge
- **Wikidata**: Extracts structured entities and relationships from Wikidata

## User Interface

### Enhancement Checkboxes

The Ask panel includes a new "Enhancement Options" section with three checkboxes:

```html
<div class="form-group enhancement-options">
    <label class="form-label">Enhancement Options</label>
    <div class="checkbox-row">
        <label class="checkbox-label">
            <input type="checkbox" id="use-hyde" name="useHyDE">
            <span class="checkbox-text">HyDE</span>
            <span class="checkbox-hint">Hypothetical Document Embeddings</span>
        </label>
        <label class="checkbox-label">
            <input type="checkbox" id="use-wikipedia" name="useWikipedia">
            <span class="checkbox-text">Wikipedia</span>
            <span class="checkbox-hint">Wikipedia knowledge integration</span>
        </label>
        <label class="checkbox-label">
            <input type="checkbox" id="use-wikidata" name="useWikidata">
            <span class="checkbox-text">Wikidata</span>
            <span class="checkbox-hint">Wikidata entities and relationships</span>
        </label>
    </div>
</div>
```

### User Experience

- Checkboxes are unchecked by default
- Multiple enhancements can be selected simultaneously
- Checkbox state persists during the session
- Works alongside existing "Use Context" functionality

## API Integration

### MCP Simple Verbs Interface

The `ask` method in the MCP Simple Verbs interface has been extended with new parameters:

```javascript
const AskSchema = z.object({
  question: z.string().min(1, "Question cannot be empty"),
  mode: z.enum(['basic', 'standard', 'comprehensive']).optional().default('standard'),
  useContext: z.boolean().optional().default(true),
  useHyDE: z.boolean().optional().default(false),
  useWikipedia: z.boolean().optional().default(false),
  useWikidata: z.boolean().optional().default(false)
});
```

### API Request Format

When enhancement options are selected, the API request includes the enhancement flags:

```json
{
  "question": "What is machine learning?",
  "mode": "standard",
  "useContext": true,
  "useHyDE": true,
  "useWikipedia": true,
  "useWikidata": false
}
```

## Enhancement Services

### HyDE Service

**Purpose**: Improves semantic search by generating hypothetical documents that represent what an ideal answer might look like.

**Process**:
1. Generate a hypothetical document based on the user's question
2. Extract concepts from the hypothetical document
3. Store the document and concepts in SPARQL with embeddings
4. Use the hypothetical context to enhance the final response

**Configuration**:
```javascript
{
  maxHypotheticalLength: 2000,
  conceptExtractionEnabled: true,
  storageGraph: 'http://hyperdata.it/content',
  maxConcepts: 10
}
```

### Wikipedia Service

**Purpose**: Integrates Wikipedia knowledge to provide factual information and context.

**Process**:
1. Search Wikipedia using the user's question
2. Fetch article content for relevant results
3. Store articles in SPARQL with embeddings
4. Include Wikipedia context in the enhanced response

**Configuration**:
```javascript
{
  apiEndpoint: 'https://en.wikipedia.org/api/rest_v1',
  searchEndpoint: 'https://en.wikipedia.org/w/api.php',
  maxResults: 5,
  rateLimit: 200,
  storageGraph: 'http://hyperdata.it/content'
}
```

### Wikidata Service

**Purpose**: Extracts structured entities and relationships to provide semantic context.

**Process**:
1. Search Wikidata entities based on the user's question
2. Fetch detailed entity information and relationships
3. Store entities and relationships in SPARQL
4. Include structured data context in the enhanced response

**Configuration**:
```javascript
{
  wikidataEndpoint: 'https://query.wikidata.org/sparql',
  searchEndpoint: 'https://www.wikidata.org/w/api.php',
  maxEntities: 10,
  maxRelationships: 20,
  rateLimit: 500,
  storageGraph: 'http://hyperdata.it/content'
}
```

### Enhancement Coordinator

**Purpose**: Orchestrates multiple enhancement services and combines their results.

**Features**:
- Concurrent or sequential execution of enhancement services
- Context combination with weighted priorities
- Error handling and fallback mechanisms
- Performance monitoring and statistics

**Configuration**:
```javascript
{
  maxCombinedContextLength: 8000,
  enableConcurrentProcessing: true,
  contextWeights: {
    hyde: 0.3,
    wikipedia: 0.4,
    wikidata: 0.3
  },
  fallbackOnError: true
}
```

## SPARQL Integration

### Storage Templates

Enhancement data is stored using SPARQL templates located in `sparql/queries/management/`:

- `store-hyde-hypothetical.sparql`: Stores HyDE hypothetical documents
- `store-wikipedia-article.sparql`: Stores Wikipedia articles
- `store-wikidata-entity.sparql`: Stores Wikidata entities
- `store-wikidata-relationship.sparql`: Stores Wikidata relationships

### Retrieval Templates

Enhancement context can be retrieved using templates in `sparql/queries/retrieval/`:

- `retrieve-hyde-context.sparql`: Retrieves HyDE context
- `retrieve-wikipedia-context.sparql`: Retrieves Wikipedia context
- `retrieve-wikidata-context.sparql`: Retrieves Wikidata context

### Query Mappings

New mappings have been added to `sparql/config/query-mappings.json`:

```json
{
  "store-hyde-hypothetical": "management/store-hyde-hypothetical.sparql",
  "store-wikipedia-article": "management/store-wikipedia-article.sparql",
  "store-wikidata-entity": "management/store-wikidata-entity.sparql",
  "store-wikidata-relationship": "management/store-wikidata-relationship.sparql",
  "retrieve-hyde-context": "retrieval/retrieve-hyde-context.sparql",
  "retrieve-wikipedia-context": "retrieval/retrieve-wikipedia-context.sparql",
  "retrieve-wikidata-context": "retrieval/retrieve-wikidata-context.sparql",
  "enhancement-semantic-search": "search/enhancement-semantic-search.sparql"
}
```

## Response Enhancement

### Enhanced Prompt Structure

When enhancements are used, the response includes context from multiple sources:

```
You are answering a question using multiple knowledge enhancement sources: [sources]. 
Provide a comprehensive, accurate response that synthesizes information from all available sources.

ORIGINAL QUESTION: [user question]

[HyDE HYPOTHETICAL DOCUMENT section if HyDE is used]
[WIKIPEDIA CONTEXT section if Wikipedia is used]  
[WIKIDATA ENTITIES section if Wikidata is used]
[WIKIDATA RELATIONSHIPS section if Wikidata is used]

INSTRUCTIONS:
- Synthesize information from all enhancement sources
- Provide specific facts and examples from the enhanced context
- Cite sources when referencing specific information
- If information conflicts, acknowledge and explain differences
- Prioritize accuracy and provide specific details when available

COMPREHENSIVE ANSWER:
```

### Metadata

Enhanced responses include metadata about the enhancement process:

```json
{
  "enhancementType": "combined",
  "metadata": {
    "servicesUsed": ["hyde", "wikipedia", "wikidata"],
    "weights": {
      "hyde": 0.3,
      "wikipedia": 0.4, 
      "wikidata": 0.3
    },
    "contextLength": 2847,
    "enhancementTime": 1543
  },
  "stats": {
    "successfulServices": 3,
    "failedServices": 0,
    "totalServices": 3
  }
}
```

## Testing

### Unit Tests

- `tests/unit/services/enhancement/HyDEService.test.js`: Tests HyDE service functionality
- `tests/unit/services/enhancement/WikipediaService.test.js`: Tests Wikipedia service functionality  
- `tests/unit/services/enhancement/WikidataService.test.js`: Tests Wikidata service functionality
- `tests/unit/services/enhancement/EnhancementCoordinator.test.js`: Tests service coordination

### Integration Tests

- `tests/integration/services/enhancement/EnhancementSimpleIntegration.test.js`: Tests full enhancement pipeline
- `tests/integration/mcp/EnhancementMCPIntegration.test.js`: Tests MCP interface integration

### End-to-End Tests

- `tests/e2e/enhancement-checkboxes.spec.js`: Tests frontend checkbox functionality and API integration

## Performance Considerations

### Concurrent Processing

When multiple enhancements are selected, they execute concurrently by default to minimize response time:

```javascript
const results = await Promise.allSettled([
  hydePromise,
  wikipediaPromise, 
  wikidataPromise
]);
```

### Caching

- Wikipedia and Wikidata services implement result caching to reduce API calls
- HyDE documents are stored with embeddings for future retrieval
- SPARQL queries use prepared statements for performance

### Rate Limiting

- Wikipedia API: 200ms between requests
- Wikidata API: 500ms between requests  
- Configurable rate limits to respect service limits

## Error Handling

### Graceful Degradation

- Individual service failures don't prevent overall response generation
- Partial results are combined when some services fail
- Fallback to original question when all enhancements fail (configurable)

### Error Reporting

```json
{
  "success": true,
  "individualResults": {
    "successful": [
      {"serviceName": "hyde", "result": {...}},
      {"serviceName": "wikipedia", "result": {...}}
    ],
    "failed": [
      {"serviceName": "wikidata", "error": "Network timeout"}
    ]
  }
}
```

## Configuration

### Service Configuration

Enhancement services can be configured through the main config:

```json
{
  "enhancements": {
    "hyde": {
      "enabled": true,
      "maxHypotheticalLength": 2000,
      "conceptExtractionEnabled": true
    },
    "wikipedia": {
      "enabled": true,
      "maxResults": 5,
      "rateLimit": 200
    },
    "wikidata": {
      "enabled": true,
      "maxEntities": 10,
      "maxRelationships": 20
    },
    "coordinator": {
      "enableConcurrentProcessing": true,
      "maxCombinedContextLength": 8000,
      "fallbackOnError": true
    }
  }
}
```

## Future Enhancements

### Planned Features

1. **Custom Enhancement Sources**: Allow users to configure additional knowledge sources
2. **Enhancement Preferences**: User-specific enhancement settings and weights
3. **Enhanced Analytics**: Detailed metrics on enhancement effectiveness
4. **Smart Enhancement Selection**: Automatic enhancement recommendation based on question type

### Extensibility

The enhancement system is designed for extensibility:

- New enhancement services can be added by implementing the base service interface
- SPARQL templates support custom storage and retrieval patterns
- Frontend checkboxes can be dynamically generated from service configuration
- MCP interface automatically includes new enhancement parameters

## Troubleshooting

### Common Issues

1. **Enhancements not working**: Check that enhancement services are enabled in configuration
2. **Slow responses**: Disable concurrent processing or reduce context length limits
3. **API errors**: Verify network connectivity and API key configuration
4. **SPARQL storage failures**: Check SPARQL endpoint configuration and permissions

### Debugging

Enable debug logging for enhancement services:

```bash
export MCP_DEBUG=true
export MCP_DEBUG_LEVEL=debug
```

### Monitoring

Use service health endpoints to monitor enhancement service status:

```javascript
const health = coordinator.getServiceHealth();
console.log(health.overall.healthyServices, '/', health.overall.totalServices);
```