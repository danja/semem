# Semem Configuration Guide

## Basic Configuration
The configuration system uses a hierarchical structure with sensible defaults that can be overridden.

### Storage Configuration
```javascript
{
    storage: {
        type: 'json',  // 'json', 'memory', or 'sparql'
        options: {
            path: 'memory.json',  // For JSON storage
            // OR for SPARQL:
            graphName: 'http://example.org/memory',
            endpoint: 'http://localhost:4030'
        }
    }
}
```

### Model Configuration
```javascript
{
    models: {
        chat: {
            provider: 'ollama',  // 'ollama' or 'openai'
            model: 'llama2',
            options: {
                temperature: 0.7
            }
        },
        embedding: {
            provider: 'ollama',
            model: 'nomic-embed-text',
            options: {
                dimension: 1536
            }
        }
    }
}
```

### Memory Parameters
```javascript
{
    memory: {
        dimension: 1536,
        similarityThreshold: 40,
        contextWindow: 3,
        decayRate: 0.0001
    }
}
```

### SPARQL Endpoint Configuration
```javascript
{
    sparqlEndpoints: [{
        label: "main",
        user: "admin",
        password: "admin123",
        urlBase: "http://localhost:4030",
        query: "/query",
        update: "/update"
    }]
}
```

## Advanced Options
- Cache configuration for SPARQL store
- Transaction handling settings
- Context window parameters
- Backup and recovery settings