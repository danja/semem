# Enhanced SPARQL CONSTRUCT API

## Overview

The `handleSparqlConstruct` method in `UIServer.js` has been updated to return structured JSON responses that facilitate integration between turtle editors and graph visualization components in the frontend.

## API Endpoint

```
POST /api/sparql/construct
```

## Request Format

```json
{
    "query": "CONSTRUCT { ... } WHERE { ... }",
    "endpoint": "http://localhost:3030/semem/query", // optional
    "format": "turtle" // optional, defaults to "turtle"
}
```

## Response Format

The enhanced endpoint returns a comprehensive JSON response with the following structure:

```json
{
    "success": true,
    "query": "CONSTRUCT { ... } WHERE { ... }",
    "endpoint": "http://localhost:3030/semem/query",
    "rdf": {
        "data": "@prefix rdf: ... \n<subject> <predicate> <object> .",
        "format": "turtle",
        "size": 1234,
        "encoding": "utf-8"
    },
    "graph": {
        "nodes": [
            {
                "id": "<http://example.org/entity1>",
                "label": "Entity 1",
                "type": "entity",
                "uri": "http://example.org/entity1",
                "properties": {
                    "title": "Sample Entity"
                }
            }
        ],
        "edges": [
            {
                "id": "edge-0",
                "source": "<http://example.org/entity1>",
                "target": "<http://example.org/entity2>",
                "predicate": "<http://purl.org/stuff/ragno/relatedTo>",
                "label": "Related To",
                "uri": "http://purl.org/stuff/ragno/relatedTo"
            }
        ],
        "nodeCount": 15,
        "edgeCount": 8,
        "namespaces": [
            {
                "prefix": "ragno",
                "uri": "http://purl.org/stuff/ragno/"
            }
        ]
    },
    "metadata": {
        "timestamp": "2025-06-16T18:34:27.000Z",
        "executionTime": 234,
        "queryType": "CONSTRUCT",
        "resultFormat": "turtle"
    },
    "events": {
        "triggerTurtleEditor": {
            "type": "rdf-data-loaded",
            "data": {
                "content": "RDF turtle data...",
                "format": "turtle",
                "source": "sparql-construct"
            }
        },
        "triggerGraphVisualization": {
            "type": "graph-data-updated",
            "data": {
                "nodes": [...],
                "edges": [...],
                "layout": "force-directed",
                "source": "sparql-construct"
            }
        }
    }
}
```

## Frontend Integration

### Event Bus Pattern

The response includes event objects that can be directly used with an event bus system:

```javascript
// Handle SPARQL CONSTRUCT response
async function handleConstructResponse(response) {
    const result = await response.json();
    
    // Load RDF data into turtle editor
    if (result.events?.triggerTurtleEditor) {
        eventBus.emit(
            result.events.triggerTurtleEditor.type,
            result.events.triggerTurtleEditor.data
        );
    }
    
    // Update graph visualization
    if (result.events?.triggerGraphVisualization) {
        eventBus.emit(
            result.events.triggerGraphVisualization.type,
            result.events.triggerGraphVisualization.data
        );
    }
}
```

### Direct Data Access

You can also access the data directly for custom integrations:

```javascript
// Access raw RDF data for turtle editor
const turtleData = result.rdf.data;
turtleEditor.setValue(turtleData);

// Access graph data for visualization
const nodes = result.graph.nodes;
const edges = result.graph.edges;
graphVisualizer.setData({ nodes, edges });
```

## Key Features

### 1. RDF Data Processing
- Returns RDF in Turtle format
- Provides metadata about data size and encoding
- Maintains original query and endpoint information

### 2. Graph Analysis
- Automatically parses RDF to extract nodes and edges
- Identifies node types (entity, relationship, semantic-unit, etc.)
- Extracts human-readable labels from URIs
- Counts nodes, edges, and namespaces

### 3. Event Bus Integration
- Provides ready-to-use event objects
- Supports decoupled frontend architecture
- Enables seamless component communication

### 4. Performance Tracking
- Records execution time
- Includes timestamps for caching decisions
- Provides metadata for debugging

## Error Handling

Errors return a structured response:

```json
{
    "success": false,
    "error": "SPARQL CONSTRUCT query failed",
    "message": "Detailed error description",
    "timestamp": "2025-06-16T18:34:27.000Z"
}
```

## Usage Examples

See `SPARQLConstructExample.js` for comprehensive usage examples, including:
- Basic CONSTRUCT queries
- Entity and relationship extraction
- Semantic unit queries
- Error handling patterns
- Frontend integration examples

## Node Type Classification

The system automatically classifies nodes based on URI patterns:

- `entity`: Ragno entities
- `semantic-unit`: Ragno semantic units  
- `relationship`: Ragno relationships
- `schema`: RDF Schema elements
- `ontology`: OWL ontology elements
- `person`: FOAF person entities
- `concept`: SKOS concepts
- `resource`: Generic resources

This classification helps with visualization styling and user interface decisions.