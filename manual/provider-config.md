# Provider Configuration Guide

This document describes how to implement LLM chat and embedding provider configuration in Semem classes using the modern configuration-driven approach.

## Overview

The Semem system uses a priority-based provider configuration system that automatically selects the best available LLM and embedding providers based on configuration settings and API key availability. This approach ensures graceful fallbacks and consistent behavior across all components.

## Configuration Files

### config.json Structure

The provider configuration is defined in `config/config.json` with the following structure:

```json
{
  "llmProviders": [
    {
      "type": "mistral",
      "priority": 1,
      "capabilities": ["chat"],
      "chatModel": "mistral-small-latest",
      "apiKey": "${MISTRAL_API_KEY}"
    },
    {
      "type": "claude",
      "priority": 2,
      "capabilities": ["chat"],
      "chatModel": "claude-3-haiku-20240307",
      "apiKey": "${ANTHROPIC_API_KEY}"
    },
    {
      "type": "ollama",
      "priority": 2,
      "capabilities": ["chat"],
      "chatModel": "qwen2:1.5b",
      "baseUrl": "${OLLAMA_HOST}"
    }
  ],
  "embeddingProviders": [
    {
      "type": "nomic",
      "priority": 1,
      "capabilities": ["embedding"],
      "embeddingModel": "nomic-embed-text-v1.5",
      "apiKey": "${NOMIC_API_KEY}"
    },
    {
      "type": "ollama",
      "priority": 2,
      "capabilities": ["embedding"],
      "embeddingModel": "nomic-embed-text",
      "baseUrl": "${OLLAMA_HOST}"
    }
  ]
}
```

### .env File

API keys and service URLs are defined in `.env`:

```env
MISTRAL_API_KEY=your_mistral_api_key_here
ANTHROPIC_API_KEY=your_anthropic_api_key_here
NOMIC_API_KEY=your_nomic_api_key_here
OLLAMA_HOST=http://localhost:11434
```

## Implementation Pattern

### Basic Setup

All classes should follow this pattern for provider configuration:

```javascript
import path from 'path';
import Config from '../Config.js';
import LLMHandler from '../handlers/LLMHandler.js';
import EmbeddingHandler from '../handlers/EmbeddingHandler.js';
import EmbeddingConnectorFactory from '../connectors/EmbeddingConnectorFactory.js';
import OllamaConnector from '../connectors/OllamaConnector.js';
import ClaudeConnector from '../connectors/ClaudeConnector.js';
import MistralConnector from '../connectors/MistralConnector.js';

class YourClass {
    constructor(options = {}) {
        this.options = options;
        this.config = null;
        this.llmHandler = null;
        this.embeddingHandler = null;
    }

    /**
     * Initialize the class with proper configuration
     */
    async initialize() {
        // Load configuration
        const configPath = path.join(process.cwd(), 'config/config.json');
        this.config = new Config(configPath);
        await this.config.init();

        // Initialize providers
        const llmProvider = await this.createLLMConnector(this.config);
        const embeddingProvider = await this.createEmbeddingConnector(this.config);
        const modelConfig = await this.getModelConfig(this.config);

        // Initialize handlers
        const dimension = this.config.get('memory.dimension') || 1536;
        
        this.embeddingHandler = new EmbeddingHandler(
            embeddingProvider,
            modelConfig.embeddingModel,
            dimension
        );

        this.llmHandler = new LLMHandler(llmProvider, modelConfig.chatModel);
    }

    // ... provider creation methods (see below)
}
```

### LLM Provider Creation

```javascript
/**
 * Create LLM connector based on configuration priority
 */
async createLLMConnector(config) {
    try {
        // Get llmProviders with priority ordering
        const llmProviders = config.get('llmProviders') || [];
        
        // Sort by priority (lower number = higher priority)
        const sortedProviders = llmProviders
            .filter(p => p.capabilities?.includes('chat'))
            .sort((a, b) => (a.priority || 999) - (b.priority || 999));
        
        // Try providers in priority order
        for (const provider of sortedProviders) {
            if (provider.type === 'mistral' && provider.apiKey) {
                return new MistralConnector();
            } else if (provider.type === 'claude' && provider.apiKey) {
                return new ClaudeConnector();
            } else if (provider.type === 'ollama') {
                return new OllamaConnector();
            }
        }
        
        // Default fallback
        return new OllamaConnector();
        
    } catch (error) {
        console.warn('Failed to load provider configuration, defaulting to Ollama:', error.message);
        return new OllamaConnector();
    }
}
```

### Embedding Provider Creation

```javascript
/**
 * Create embedding connector using configuration-driven factory pattern
 */
async createEmbeddingConnector(config) {
    try {
        const embeddingProviders = config.get('embeddingProviders') || [];
        const sortedProviders = embeddingProviders
            .sort((a, b) => (a.priority || 999) - (b.priority || 999));
        
        for (const provider of sortedProviders) {
            if (provider.type === 'nomic' && provider.apiKey) {
                return EmbeddingConnectorFactory.createConnector({
                    provider: 'nomic',
                    apiKey: provider.apiKey,
                    model: provider.embeddingModel || 'nomic-embed-text-v1.5'
                });
            } else if (provider.type === 'ollama') {
                return EmbeddingConnectorFactory.createConnector({
                    provider: 'ollama',
                    baseUrl: provider.baseUrl || 'http://localhost:11434',
                    model: provider.embeddingModel || 'nomic-embed-text'
                });
            }
        }
        
        // Default fallback
        return EmbeddingConnectorFactory.createConnector({
            provider: 'ollama',
            baseUrl: 'http://localhost:11434',
            model: 'nomic-embed-text'
        });
        
    } catch (error) {
        console.warn('Failed to create configured embedding connector, falling back to Ollama:', error.message);
        return EmbeddingConnectorFactory.createConnector({
            provider: 'ollama',
            baseUrl: 'http://localhost:11434',
            model: 'nomic-embed-text'
        });
    }
}
```

### Model Configuration

```javascript
/**
 * Get working model names from configuration
 */
async getModelConfig(config) {
    try {
        // Get highest priority providers
        const llmProviders = config.get('llmProviders') || [];
        const chatProvider = llmProviders
            .filter(p => p.capabilities?.includes('chat'))
            .sort((a, b) => (a.priority || 999) - (b.priority || 999))[0];
        const embeddingProvider = llmProviders
            .filter(p => p.capabilities?.includes('embedding'))
            .sort((a, b) => (a.priority || 999) - (b.priority || 999))[0];
        
        return {
            chatModel: chatProvider?.chatModel || 'qwen2:1.5b',
            embeddingModel: embeddingProvider?.embeddingModel || 'nomic-embed-text'
        };
    } catch (error) {
        console.warn('Failed to get model config from configuration, using defaults:', error.message);
        return {
            chatModel: 'qwen2:1.5b',
            embeddingModel: 'nomic-embed-text'
        };
    }
}
```

## Usage Examples

### Simple Script

```javascript
#!/usr/bin/env node

import YourClass from './YourClass.js';

async function main() {
    const processor = new YourClass({
        // any options
    });
    
    await processor.initialize();
    
    // Now you can use processor.llmHandler and processor.embeddingHandler
    const response = await processor.llmHandler.generateResponse(
        "Hello, world!",
        "",
        { temperature: 0.7 }
    );
    
    const embedding = await processor.embeddingHandler.generateEmbedding("Hello, world!");
}

main().catch(console.error);
```

### With Error Handling

```javascript
async initialize() {
    try {
        const configPath = path.join(process.cwd(), 'config/config.json');
        this.config = new Config(configPath);
        await this.config.init();

        const llmProvider = await this.createLLMConnector(this.config);
        const embeddingProvider = await this.createEmbeddingConnector(this.config);
        const modelConfig = await this.getModelConfig(this.config);

        this.embeddingHandler = new EmbeddingHandler(
            embeddingProvider,
            modelConfig.embeddingModel,
            this.config.get('memory.dimension') || 1536
        );

        this.llmHandler = new LLMHandler(llmProvider, modelConfig.chatModel);
        
        console.log('✅ Providers initialized successfully');
        
    } catch (error) {
        console.error('❌ Failed to initialize providers:', error.message);
        throw error;
    }
}
```

## Key Benefits

1. **Priority-based Selection**: Automatically uses the best available provider based on configuration and API key availability
2. **Graceful Fallbacks**: Falls back to Ollama (local) when cloud providers are unavailable
3. **Consistent Configuration**: All classes use the same configuration pattern
4. **Environment Separation**: API keys stored securely in `.env` files
5. **Easy Maintenance**: Provider changes only require config file updates

## Migration from Old Pattern

### Before (Old Pattern)
```javascript
// ❌ Old hardcoded approach
const ollamaConnector = new OllamaConnector('http://localhost:11434', 'qwen2:1.5b');
const llmHandler = new LLMHandler(ollamaConnector, 'qwen2:1.5b', 0.7);
```

### After (New Pattern)
```javascript
// ✅ New configuration-driven approach
const llmProvider = await this.createLLMConnector(this.config);
const modelConfig = await this.getModelConfig(this.config);
const llmHandler = new LLMHandler(llmProvider, modelConfig.chatModel);
```

## Best Practices

1. **Always initialize Config first**: Load and initialize the Config object before creating providers
2. **Use async/await**: All provider creation methods are async
3. **Handle errors gracefully**: Wrap provider creation in try-catch blocks
4. **Log provider selection**: Include logging to show which providers are being used
5. **Test fallbacks**: Ensure your code works when API keys are missing
6. **Keep methods separate**: Don't inline provider creation - use the helper methods
7. **Follow the pattern**: All classes should implement the same three helper methods

This pattern is used throughout the codebase in:
- `src/servers/api-server.js` (reference implementation)
- `examples/beerqa/AugmentQuestion.js`
- `examples/beerqa/QuestionResearch.js` 
- `examples/beerqa/GetResult.js`
- `examples/beerqa/AddWikipediaEmbeddings.js`
- `src/aux/wikipedia/UnitsToCorpuscles.js`

When implementing new classes or updating existing ones, follow this pattern to ensure consistency and reliability across the entire Semem system.