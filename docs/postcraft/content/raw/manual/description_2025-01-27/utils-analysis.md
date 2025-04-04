# Utilities Layer Analysis

## EmbeddingValidator.js
**Purpose**: Validates and standardizes vector embeddings across different models.

```javascript
// Key functionality
export class EmbeddingValidator {
    constructor(config = {}) {
        this.dimensionMap = {
            'nomic-embed-text': 768,
            'qwen2:1.5b': 1536,
            'llama2': 4096,
            'default': 1536,
            ...config.dimensions
        }
    }

    // Get correct dimension for model
    getDimension(model) {
        return this.dimensionMap[model] || this.dimensionMap.default
    }

    // Validate embedding format and dimensions
    validateEmbedding(embedding, expectedDimension) {
        if (!Array.isArray(embedding)) {
            throw new TypeError('Embedding must be an array')
        }
        if (!embedding.every(x => typeof x === 'number' && !isNaN(x))) {
            throw new TypeError('Embedding must contain only valid numbers')
        }
        if (embedding.length !== expectedDimension) {
            throw new Error(`Dimension mismatch: expected ${expectedDimension}`)
        }
        return true
    }

    // Standardize embedding dimensions
    standardizeEmbedding(embedding, targetDimension) {
        if (embedding.length === targetDimension) return embedding
        if (embedding.length < targetDimension) {
            return [...embedding, ...new Array(targetDimension - embedding.length).fill(0)]
        }
        return embedding.slice(0, targetDimension)
    }
}
```

## FusekiDiscovery.js
**Purpose**: Handles SPARQL endpoint discovery and configuration.

```javascript
export class FusekiDiscovery {
    constructor(baseUrl, credentials) {
        this.baseUrl = baseUrl
        this.auth = Buffer.from(`${credentials.user}:${credentials.password}`).toString('base64')
    }

    // Discover available endpoints
    async discoverEndpoints(dataset) {
        const endpoints = {
            base: `${this.baseUrl}/${dataset}`,
            query: null,
            update: null,
            gsp: null,
            upload: null
        }

        // Test endpoints
        if (await this.testSparqlEndpoint(`${endpoints.base}`)) {
            endpoints.query = endpoints.base
            endpoints.update = endpoints.base
        }

        if (await this.testGSPEndpoint(`${endpoints.base}/data`)) {
            endpoints.gsp = `${endpoints.base}/data`
        }

        return { 
            success: true, 
            endpoints: this.cleanEndpoints(endpoints) 
        }
    }

    // Verify endpoint functionality
    async testSparqlEndpoint(url) {
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': `Basic ${this.auth}`,
                    'Content-Type': 'application/sparql-query'
                },
                body: 'ASK { ?s ?p ?o }'
            })
            return response.ok
        } catch {
            return false
        }
    }
}
```

## SPARQLHelpers.js
**Purpose**: Provides utility functions for SPARQL operations.

```javascript
export class SPARQLHelpers {
    // Create authentication header
    static createAuthHeader(user, password) {
        return `Basic ${Buffer.from(`${user}:${password}`).toString('base64')}`
    }

    // Execute SPARQL queries
    static async executeSPARQLQuery(endpoint, query, auth) {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/sparql-query',
                'Accept': 'application/sparql-results+json',
                'Authorization': auth
            },
            body: query
        })

        if (!response.ok) {
            throw new Error(`SPARQL query failed: ${response.status}`)
        }

        return response.json()
    }

    // Execute SPARQL updates
    static async executeSPARQLUpdate(endpoint, update, auth) {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/sparql-update',
                'Authorization': auth
            },
            body: update
        })

        if (!response.ok) {
            throw new Error(`SPARQL update failed: ${response.status}`)
        }

        return response
    }

    // Get dataset endpoint URL
    static getDatasetEndpoint(baseUrl, dataset, operation) {
        return `${baseUrl}/${dataset}/${operation}`
    }
}
```

## Integration Patterns

### Embedding Validation
```javascript
// Usage in EmbeddingHandler
class EmbeddingHandler {
    constructor(llmProvider, model, dimension, cacheManager) {
        this.validator = new EmbeddingValidator({ dimensions: { [model]: dimension } })
    }

    async generateEmbedding(text) {
        const embedding = await this.llmProvider.generateEmbedding(this.model, text)
        this.validator.validateEmbedding(embedding, this.dimension)
        return this.validator.standardizeEmbedding(embedding, this.dimension)
    }
}
```

### SPARQL Integration
```javascript
// Usage in SPARQLStore
class SPARQLStore {
    constructor(endpoint, options) {
        this.auth = SPARQLHelpers.createAuthHeader(options.user, options.password)
        this.endpoints = await new FusekiDiscovery(endpoint.base, options)
            .discoverEndpoints(options.dataset)
    }

    async executeQuery(query) {
        return SPARQLHelpers.executeSPARQLQuery(
            this.endpoints.query,
            query,
            this.auth
        )
    }
}
```

## Error Handling
```javascript
// Common error handling pattern
async function withErrorHandling(operation) {
    try {
        return await operation()
    } catch (error) {
        logger.error(`Operation failed: ${error.message}`)
        if (error.response) {
            logger.debug('Response:', await error.response.text())
        }
        throw error
    }
}
```

## Best Practices

1. **Embedding Validation**
   - Always validate before processing
   - Use standardization for consistency
   - Cache validation results when possible

2. **SPARQL Operations**
   - Use helper methods consistently
   - Handle authentication securely
   - Implement proper error handling

3. **Endpoint Discovery**
   - Cache discovery results
   - Implement fallback mechanisms
   - Validate endpoint functionality