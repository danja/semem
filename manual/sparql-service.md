# SPARQL Service Layer

The SPARQL service layer in `src/services/sparql/` provides a comprehensive abstraction for working with SPARQL endpoints in the semem system. It offers query templating, caching, execution utilities, and standardized error handling for all SPARQL operations.

## Architecture Overview

The SPARQL service layer consists of four main components:

```
src/services/sparql/
├── index.js              # Module exports and factory functions
├── SPARQLHelper.js       # Low-level SPARQL execution utilities
├── SPARQLQueryService.js # High-level query management and templating
└── QueryCache.js         # Intelligent caching with file watching
```

## Components

### SPARQLHelper.js

The **SPARQLHelper** is a low-level utility class for creating and executing SPARQL queries. It handles the HTTP communication with SPARQL endpoints and provides query templating methods.

#### Key Features:

- **Query Templates**: Pre-built templates for common SPARQL operations
- **HTTP Execution**: Handles POST requests to SPARQL UPDATE and SELECT endpoints
- **Authentication**: Built-in Basic Auth support
- **Error Handling**: Standardized error responses with timing metrics
- **Batch Operations**: Execute multiple queries in sequence
- **String Safety**: Escape utilities for safe literal creation

#### Usage Example:

```javascript
import SPARQLHelper from './src/services/sparql/SPARQLHelper.js';

const helper = new SPARQLHelper('http://localhost:3030/dataset/update', {
    auth: { user: 'admin', password: 'admin123' },
    timeout: 30000
});

// Create and execute an INSERT query
const triples = `
    <http://example.org/person/1> rdf:type ragno:Entity .
    <http://example.org/person/1> rdfs:label "John Doe" .
`;

const query = helper.createInsertDataQuery('http://example.org/graph', triples);
const result = await helper.executeUpdate(query);

if (result.success) {
    console.log('Data inserted successfully');
} else {
    console.error('Insert failed:', result.error);
}
```

#### Query Template Methods:

- `createInsertDataQuery(graph, triples)` - INSERT DATA template
- `createInsertQuery(graph, insertTriples, whereClause)` - INSERT with WHERE
- `createDeleteInsertQuery(graph, deleteTriples, insertTriples, whereClause)` - UPDATE template
- `createClearGraphQuery(graph)` - CLEAR GRAPH template
- `createDropGraphQuery(graph)` - DROP GRAPH template

#### Execution Methods:

- `executeUpdate(query)` - Execute SPARQL UPDATE
- `executeSelect(query)` - Execute SPARQL SELECT  
- `executeUpdates(queries)` - Batch execute multiple UPDATEs

#### Utility Methods:

- `SPARQLHelper.escapeString(str)` - Escape string literals
- `SPARQLHelper.createLiteral(value, datatype, lang)` - Create typed literals
- `SPARQLHelper.createURI(uri)` - Create URI literals
- `SPARQLHelper.getExecutionStats(results)` - Analyze batch results

### SPARQLQueryService.js

The **SPARQLQueryService** provides high-level query management with file-based templating, parameter substitution, and intelligent caching.

#### Key Features:

- **File-Based Queries**: Load SPARQL queries from `.sparql` files
- **Template Parameters**: Support for `${parameter}` substitution
- **Prefix Management**: Automatic prefix injection
- **Query Mappings**: Named query aliases for easier access
- **Cache Integration**: Automatic caching with file modification detection
- **Formatting Utilities**: Helper methods for common SPARQL patterns

#### Directory Structure Expected:

```
sparql/
├── queries/
│   ├── retrieval/
│   │   ├── questions-with-relationships.sparql
│   │   └── entity-content-retrieval.sparql
│   ├── management/
│   │   ├── insert-data.sparql
│   │   └── relationship-creation.sparql
│   └── search/
│       └── semantic-search.sparql
├── templates/
│   └── prefixes.sparql
└── config/
    └── query-mappings.json
```

#### Usage Example:

```javascript
import { SPARQLQueryService } from './src/services/sparql/SPARQLQueryService.js';

const queryService = new SPARQLQueryService({
    queryPath: './sparql/queries',
    templatePath: './sparql/templates'
});

// Load and execute a parameterized query
const query = await queryService.getQuery('questions-with-relationships', {
    graphURI: 'http://purl.org/stuff/beerqa/test',
    limit: 10
});

console.log(query); // Fully resolved SPARQL query with prefixes and parameters
```

#### Built-in Query Mappings:

- **Retrieval**: `questions-with-relationships`, `entity-content-retrieval`, `navigation-questions`
- **Management**: `insert-data`, `clear-graph`, `relationship-creation`
- **Search**: `semantic-search`, `ppr-concepts`, `importance-rankings`
- **Visualization**: `knowledge-graph-construct`

#### Formatting Utilities:

- `formatEntityList(entityURIs)` - Format URI list for SPARQL
- `formatLimit(limit)` - Generate LIMIT clause
- `formatFilter(conditions)` - Generate FILTER clause
- `formatOptional(clauses)` - Generate OPTIONAL blocks
- `formatUnion(clauses)` - Generate UNION queries
- `formatXSDDateTime(date)` - Format dates for SPARQL

### QueryCache.js

The **QueryCache** provides intelligent caching with automatic invalidation based on file modifications and TTL policies.

#### Key Features:

- **LRU Eviction**: Least Recently Used cache eviction
- **File Watching**: Automatic invalidation when query files change
- **TTL Support**: Time-based cache expiration (default 1 hour)
- **Size Limits**: Configurable maximum cache size
- **Statistics**: Cache hit/miss and performance metrics

#### Usage Example:

```javascript
import { QueryCache } from './src/services/sparql/QueryCache.js';

const cache = new QueryCache({
    maxSize: 100,           // Maximum 100 cached queries
    ttl: 3600000,          // 1 hour TTL
    enableFileWatch: true  // Auto-invalidate on file changes
});

// Cache is typically used internally by SPARQLQueryService
const cachedQuery = await cache.get('my-query', '/path/to/query.sparql');
if (!cachedQuery) {
    const queryContent = await fs.readFile('/path/to/query.sparql', 'utf8');
    await cache.set('my-query', queryContent, '/path/to/query.sparql');
}
```

#### Configuration Options:

- `maxSize` - Maximum cache entries (default: 100)
- `ttl` - Time to live in milliseconds (default: 1 hour)
- `checkInterval` - File modification check interval (default: 1 minute)
- `enableFileWatch` - Enable file modification detection (default: true)

## Integration Patterns

### Basic SPARQL Operations

For simple SPARQL operations, use **SPARQLHelper** directly:

```javascript
import SPARQLHelper from './src/services/sparql/SPARQLHelper.js';

const helper = new SPARQLHelper(endpoint, { auth: credentials });

// Simple insert
const insertQuery = helper.createInsertDataQuery(graphURI, triples);
await helper.executeUpdate(insertQuery);

// Simple select
const selectQuery = `SELECT * WHERE { ?s ?p ?o } LIMIT 10`;
const result = await helper.executeSelect(selectQuery);
```

### Complex Query Management

For complex applications with many queries, use **SPARQLQueryService**:

```javascript
import { createQueryService } from './src/services/sparql/index.js';

const queryService = createQueryService({
    queryPath: './queries',
    cacheOptions: { maxSize: 50, ttl: 1800000 }
});

// Load parameterized queries
const searchQuery = await queryService.getQuery('semantic-search', {
    searchTerm: 'beer brewing',
    graphURI: 'http://purl.org/stuff/beerqa',
    limit: 20
});
```

### Factory Functions

The `index.js` provides convenient factory functions:

```javascript
import { 
    createQueryService, 
    getDefaultQueryService, 
    resetDefaultQueryService 
} from './src/services/sparql/index.js';

// Create new service instance
const service = createQueryService(options);

// Get singleton instance (lazy initialization)
const defaultService = getDefaultQueryService(options);

// Reset singleton (useful for testing)
resetDefaultQueryService();
```

## Standard Prefixes

All queries automatically include these standard prefixes:

```sparql
PREFIX ragno: <http://purl.org/stuff/ragno/>
PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
PREFIX dcterms: <http://purl.org/dc/terms/>
PREFIX prov: <http://www.w3.org/ns/prov#>
PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
PREFIX owl: <http://www.w3.org/2002/07/owl#>
```

## Error Handling

All SPARQL operations return standardized result objects:

```javascript
// Success response
{
    success: true,
    status: 200,
    statusText: 'OK',
    data: results,        // For SELECT queries
    response: text,       // For UPDATE queries
    responseTime: 1234    // Milliseconds
}

// Error response
{
    success: false,
    status: 400,
    statusText: 'Bad Request',
    error: 'Parse error: Line 4, column 34: Unresolved prefixed name',
    responseTime: 567
}
```

## Performance Considerations

### Caching Strategy

- **Query Templates**: Cached with file modification detection
- **TTL Policy**: 1-hour default expiration
- **LRU Eviction**: Automatic cleanup of old entries
- **Size Limits**: Configurable maximum cache size

### Batch Operations

Use `executeUpdates()` for multiple related operations:

```javascript
const queries = [
    helper.createInsertDataQuery(graph, triples1),
    helper.createInsertDataQuery(graph, triples2),
    helper.createInsertDataQuery(graph, triples3)
];

const results = await helper.executeUpdates(queries);
const stats = SPARQLHelper.getExecutionStats(results);
console.log(`Success rate: ${stats.successRate}%`);
```

### Connection Management

- **Persistent Connections**: HTTP keep-alive for better performance
- **Timeout Configuration**: Configurable per-request timeouts
- **Authentication Caching**: Credentials cached for the session
- **Endpoint Auto-detection**: Automatic conversion from UPDATE to SELECT endpoints

## Security Features

### Input Sanitization

Always use the provided escape utilities:

```javascript
const userInput = 'John "The Hacker" O\'Malley';
const safeValue = SPARQLHelper.escapeString(userInput);
const safeLiteral = SPARQLHelper.createLiteral(userInput);
```

### Authentication

Built-in Basic Authentication support:

```javascript
const helper = new SPARQLHelper(endpoint, {
    auth: {
        user: process.env.SPARQL_USER,
        password: process.env.SPARQL_PASSWORD
    }
});
```

### Parameter Validation

Template parameters are validated and safely substituted:

```javascript
// Safe parameter substitution
const query = await queryService.getQuery('search-entities', {
    entityType: 'ragno:Entity',  // Will be safely substituted
    limit: 10                    // Numeric values are safe
});
```

## Usage in Semem Components

The SPARQL service layer is used throughout semem for:

- **Memory Storage**: SPARQLStore uses SPARQLHelper for all RDF operations
- **Query Operations**: All examples use SPARQLQueryService for complex queries
- **Graph Analytics**: Relationship and ranking algorithms use batch operations
- **Data Import/Export**: Corpus ingestion uses templated bulk insert operations

This abstraction layer ensures consistent SPARQL handling, proper error management, and optimized performance across the entire semem system.