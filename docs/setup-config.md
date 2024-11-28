# Setup and Configuration Guide

## Basic Configuration
```javascript
import { Config, MemoryManager } from 'semem';

const config = new Config({
    storage: {
        type: 'json',
        options: {
            path: 'data/memory.json'
        }
    },
    models: {
        chat: {
            provider: 'openai',
            model: 'gpt-4-turbo-preview'
        },
        embedding: {
            provider: 'openai',
            model: 'text-embedding-3-small'
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

## Storage Configuration

### JSON Storage
```javascript
import { JSONStorage } from 'semem';

const storage = new JSONStorage('data/memory.json');
```

### Remote Storage
```javascript
import { RemoteStorage } from 'semem';

const storage = new RemoteStorage({
    endpoint: 'https://api.example.com/memory',
    apiKey: process.env.STORAGE_API_KEY,
    timeout: 5000,
    retries: 3
});
```

## Performance Tuning
```javascript
const config = new Config({
    memory: {
        // Reduce dimension for faster processing
        dimension: 1024,
        
        // Increase threshold for more precise matching
        similarityThreshold: 50,
        
        // Reduce window size for faster response
        contextWindow: 2,
        
        // Adjust decay rate for memory persistence
        decayRate: 0.0005
    }
});
```

## Error Handling
```javascript
try {
    const manager = new MemoryManager({
        apiKey: process.env.OPENAI_API_KEY,
        storage,
        onError: (error) => {
            console.error('Memory manager error:', error);
            // Implement error handling
        }
    });
} catch (error) {
    console.error('Initialization error:', error);
}
```

## Logging Configuration
```javascript
import { logger } from 'semem';

// Set log level
logger.level = process.env.NODE_ENV === 'production' ? 'info' : 'debug';

// Add custom logging
logger.on('error', (error) => {
    // Custom error handling
});
```
