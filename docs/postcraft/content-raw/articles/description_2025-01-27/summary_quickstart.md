# Semem Quick Start Guide

## Prerequisites
- Node.js 20.11.0+
- Ollama with required models
- Apache Jena Fuseki (for SPARQL storage)
- Git

## Installation
```bash
# Clone repository
git clone https://github.com/organization/semem
cd semem

# Install dependencies
npm install

# Pull required Ollama models
ollama pull nomic-embed-text
ollama pull qwen2:1.5b
```

## Basic Configuration
Create .env file:
```env
SPARQL_USER=admin
SPARQL_PASSWORD=admin123
SPARQL_ENDPOINT=http://localhost:4030
```

## Quick Test
```bash
# Start Fuseki (using Docker)
cd packages/tbox
docker-compose up -d

# Run basic test
cd ../semem
npm test -- tests/unit/Config.spec.js
```

## Running Examples
```bash
# Basic Ollama example
node examples/OllamaExample.js

# SPARQL storage example
node examples/SPARQLExample.js

# Combined example
node examples/OllamaClaudeExample.js
```

## Development Server
```bash
# Start development server
npm run dev

# Run all tests
npm test
```

## Basic Usage
```javascript
import MemoryManager from './src/MemoryManager.js';
import Config from './src/Config.js';
import OllamaConnector from './src/connectors/OllamaConnector.js';

// Initialize
const config = Config.create({
    storage: {
        type: 'sparql',
        options: {
            graphName: 'http://example.org/memory'
        }
    }
});

const llmProvider = new OllamaConnector();
const memoryManager = new MemoryManager({
    llmProvider,
    chatModel: 'qwen2:1.5b',
    embeddingModel: 'nomic-embed-text'
});

// Use system
const response = await memoryManager.generateResponse(
    "What's the weather like?",
    [],  // recent interactions
    []   // relevant memories
);
console.log(response);
```

## Next Steps
1. Review [System Overview](overview.md)
2. Check [Configuration Guide](config.md)
3. Explore [API Documentation](api.md)
4. Run [Example Applications](examples/)