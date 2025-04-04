# Semem Documentation

## Overview
Semem is a semantic memory management system for LLMs, providing context-aware interactions using vector embeddings and concept graphs.

## Installation
```bash
npm install semem
```

## Basic Usage
```javascript
import { MemoryManager, JSONStorage } from 'semem';
import OllamaAPI from './ollama-api.js';

const ollama = new OllamaAPI();
const storage = new JSONStorage('memory.json');

const manager = new MemoryManager({
    llmProvider: ollama,
    chatModel: 'llama2',
    embeddingModel: 'nomic-embed-text',
    storage
});
```

## Components

### OllamaAPI
Wrapper for Ollama's REST API endpoints:
- Chat generation
- Embeddings generation (supports 8192 context window)
- Completions

### MemoryManager
Core component handling:
- Interaction storage
- Context management
- Response generation
- Concept extraction

### ContextWindowManager
Handles large context processing:
- Adaptive window sizing
- Overlap management
- Context merging

## Configuration

### Default Configuration
```javascript
const config = new Config({
    storage: {
        type: 'json',
        options: { 
            path: 'memory.json' 
        }
    },
    models: {
        chat: {
            provider: 'ollama',
            model: 'llama2'
        },
        embedding: {
            provider: 'ollama',
            model: 'nomic-embed-text'
        }
    },
    memory: {
        dimension: 1536,
        similarityThreshold: 40,
        contextWindow: 3,
        decayRate: 0.0001
    }
});
```

### Context Options
```javascript
const contextOptions = {
    maxTokens: 8192,  // For nomic-embed-text
    maxTimeWindow: 24 * 60 * 60 * 1000, // 24 hours
    overlapRatio: 0.1, // 10% window overlap
    minWindowSize: 1024
};
```

## Testing

### Unit Tests
Located in `spec/unit/`:
```javascript
// spec/unit/memoryManager.spec.js
describe('MemoryManager', () => {
    let manager;
    
    beforeEach(() => {
        manager = new MemoryManager({...});
    });

    it('should generate embeddings', async () => {
        const embedding = await manager.getEmbedding('test text');
        expect(embedding.length).toBe(1536);
    });
});
```

### Integration Tests
Located in `spec/integration/`:
```javascript
// spec/integration/ollama.spec.js
describe('OllamaAPI Integration', () => {
    let api;
    
    beforeEach(() => {
        api = new OllamaAPI();
    });

    it('should generate embeddings', async () => {
        const embedding = await api.generateEmbedding(
            'nomic-embed-text',
            'Test text'
        );
        expect(embedding.length).toBe(1536);
    });
});
```

### Running Tests
```bash
npm test                 # Run all tests
npm test:unit           # Run unit tests only
npm test:integration    # Run integration tests only
```

## Error Handling

### API Errors
```javascript
try {
    const response = await manager.generateResponse(prompt);
} catch (error) {
    if (error.name === 'OllamaAPIError') {
        // Handle API-specific errors
    } else if (error.name === 'StorageError') {
        // Handle storage-related errors
    }
}
```

### Context Handling
```javascript
// Automatically handles context window limits
const response = await manager.generateResponse(prompt, [], retrievals);
```

## Storage Options

### JSON Storage
```javascript
import { JSONStorage } from 'semem';
const storage = new JSONStorage('memory.json');
```

### Remote Storage
```javascript
import { RemoteStorage } from 'semem';
const storage = new RemoteStorage({
    endpoint: 'https://api.example.com/memory',
    apiKey: 'your-api-key'
});
```

### Custom Storage
```javascript
import { BaseStorage } from 'semem';

class CustomStorage extends BaseStorage {
    async loadHistory() {
        // Implementation
    }
    
    async saveMemoryToHistory(memoryStore) {
        // Implementation
    }
}
```

## Next Steps

1. Test Implementation
   - Create test fixtures
   - Add unit tests for core components
   - Add integration tests
   - Add performance tests

2. Additional Features
   - Token counting implementation
   - Custom tokenization support
   - Priority-based window selection
   - Performance optimizations

3. Storage Extensions
   - Redis implementation
   - MongoDB implementation
   - GraphDB support

4. Documentation
   - API reference
   - Performance guidelines
   - Deployment guide
   - Security considerations
