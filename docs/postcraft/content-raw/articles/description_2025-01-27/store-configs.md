# Storage Configuration Guide

## Development Environment
```javascript
{
    storage: {
        type: 'memory',  // Use in-memory storage
        options: {
            maxSize: 1000,
            enableMetrics: true
        }
    },
    models: {
        chat: {
            provider: 'ollama',
            model: 'qwen2:1.5b'
        },
        embedding: {
            provider: 'ollama',
            model: 'nomic-embed-text'
        }
    }
}
```
Best for: Local development, testing, rapid prototyping

## Small Production System
```javascript
{
    storage: {
        type: 'json',  // File-based storage
        options: {
            path: 'data/memory.json',
            backupInterval: 3600000,  // 1 hour
            maxBackups: 24
        }
    },
    models: {
        chat: {
            provider: 'ollama',
            model: 'qwen2:1.5b'
        },
        embedding: {
            provider: 'ollama',
            model: 'nomic-embed-text'
        }
    }
}
```
Best for: Small deployments, single-server setups

## Enterprise System
```javascript
{
    storage: {
        type: 'sparql',
        options: {
            graphName: 'http://example.org/memory',
            endpoint: {
                query: 'http://localhost:3030/ds/query',
                update: 'http://localhost:3030/ds/update'
            },
            cache: {
                enabled: true,
                ttl: 300000,  // 5 minutes
                maxSize: 10000
            },
            auth: {
                user: 'admin',
                passwordEnv: 'SPARQL_PASSWORD'
            },
            transaction: {
                timeout: 30000,
                retries: 3
            }
        }
    },
    models: {
        chat: {
            provider: 'anthropic',
            model: 'claude-3-opus-20240229'
        },
        embedding: {
            provider: 'ollama',
            model: 'nomic-embed-text'
        }
    }
}
```
Best for: Large-scale deployments, distributed systems

## High-Performance Setup
```javascript
{
    storage: {
        type: 'cached-sparql',
        options: {
            graphName: 'http://example.org/memory',
            endpoint: {
                query: 'http://localhost:3030/ds/query',
                update: 'http://localhost:3030/ds/update'
            },
            cache: {
                enabled: true,
                ttl: 60000,  // 1 minute
                maxSize: 50000,
                cleanupInterval: 30000
            },
            performance: {
                batchSize: 1000,
                parallelQueries: 4,
                timeout: 5000
            }
        }
    },
    models: {
        chat: {
            provider: 'anthropic',
            model: 'claude-3-opus-20240229',
            temperature: 0.7
        },
        embedding: {
            provider: 'ollama',
            model: 'nomic-embed-text',
            batchSize: 32
        }
    }
}
```
Best for: High-throughput applications

## Testing Environment
```javascript
{
    storage: {
        type: 'memory',
        options: {
            mockLatency: 100,  // Simulate network delay
            mockErrors: 0.01,  // 1% error rate
            validateData: true
        }
    },
    models: {
        chat: {
            provider: 'mock',
            model: 'test-model'
        },
        embedding: {
            provider: 'mock',
            model: 'test-embed'
        }
    }
}
```
Best for: Testing, CI/CD pipelines