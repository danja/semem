# Connectors Module

The Connectors module provides unified interfaces for integrating with various Large Language Model (LLM) providers and embedding services. The architecture has evolved to use the `hyperdata-clients` library for standardized provider implementations with modern configuration-driven selection.

## Architecture

### Current Implementation

The connector system has been modernized to use:

- **hyperdata-clients**: External library providing standardized client implementations
- **Configuration-driven selection**: Priority-based provider selection from `config.json`
- **Specialized embedding support**: Dedicated embedding connector factory and handlers
- **Fallback mechanisms**: Automatic provider fallback with graceful degradation

### Base Classes

- **ClientConnector**: Wrapper around `hyperdata-clients` providing a unified interface
- **EmbeddingConnectorFactory**: Factory pattern for creating embedding-specific connectors
- **EmbeddingHandler**: High-level handler with caching, validation, and fallback support

### Supported Providers

#### Chat/Completion Providers
- **Mistral AI**: Primary chat provider using `hyperdata-clients`
- **Claude (Anthropic)**: Secondary chat provider with advanced reasoning capabilities
- **Ollama**: Local model execution for privacy and offline operation

#### Embedding Providers
- **Nomic Atlas**: Cloud-based embedding service (primary)
- **Ollama**: Local embedding models (fallback)

## Configuration

### Provider Configuration (config.json)

```json
{
  "llmProviders": [
    {
      "type": "mistral",
      "implementation": "hyperdata-clients",
      "apiKey": "${MISTRAL_API_KEY}",
      "chatModel": "mistral-small-latest",
      "priority": 1,
      "capabilities": ["chat"],
      "description": "Using hyperdata-clients implementation"
    },
    {
      "type": "claude",
      "implementation": "hyperdata-clients", 
      "apiKey": "${CLAUDE_API_KEY}",
      "chatModel": "claude-3-opus-20240229",
      "priority": 2,
      "capabilities": ["chat"],
      "description": "Using hyperdata-clients implementation"
    },
    {
      "type": "nomic",
      "apiKey": "${NOMIC_API_KEY}",
      "embeddingModel": "nomic-embed-text-v1.5",
      "priority": 1,
      "capabilities": ["embedding"],
      "description": "Nomic Atlas API for cloud-based embeddings"
    },
    {
      "type": "ollama",
      "baseUrl": "http://localhost:11434",
      "chatModel": "qwen2:1.5b",
      "embeddingModel": "nomic-embed-text",
      "priority": 2,
      "capabilities": ["embedding", "chat"],
      "description": "Local Ollama for embeddings and chat - fallback option"
    }
  ]
}
```

### Environment Variables

```bash
# API Keys
MISTRAL_API_KEY=your-mistral-api-key
CLAUDE_API_KEY=your-claude-api-key  
NOMIC_API_KEY=your-nomic-api-key

# Ollama Configuration
OLLAMA_BASE_URL=http://localhost:11434
```

## Features

### Unified Interface via ClientConnector

```javascript
import ClientConnector from './src/connectors/ClientConnector.js'

// Initialize with provider and model
const connector = new ClientConnector('mistral', 'mistral-small-latest')
await connector.initialize()

// Chat completion
const response = await connector.generateChat(
  'mistral-small-latest',
  [{ role: 'user', content: 'Hello, world!' }],
  { temperature: 0.7 }
)

// Embedding generation
const embedding = await connector.generateEmbedding(
  'nomic-embed-text-v1.5', 
  'Text to embed'
)
```

### Embedding-Specific Factory

```javascript
import EmbeddingConnectorFactory from './src/connectors/EmbeddingConnectorFactory.js'

// Create embedding connector
const embeddingConnector = EmbeddingConnectorFactory.createConnector({
  provider: 'nomic',
  model: 'nomic-embed-text-v1.5',
  options: {
    apiKey: process.env.NOMIC_API_KEY
  }
})

// Generate embeddings
const embedding = await embeddingConnector.generateEmbedding(
  'nomic-embed-text-v1.5',
  'Text to embed'
)

// Batch embeddings
const embeddings = await embeddingConnector.generateEmbedding(
  'nomic-embed-text-v1.5',
  ['Text 1', 'Text 2', 'Text 3']
)
```

### Advanced Embedding Handler

```javascript
import EmbeddingHandler from './src/handlers/EmbeddingHandler.js'

// Create handler with resilience features
const handler = new EmbeddingHandler(
  embeddingConnector,
  'nomic-embed-text-v1.5',
  1536, // dimension
  cacheManager,
  {
    enableFallbacks: true,
    maxRetries: 3,
    timeoutMs: 30000,
    fallbackEmbeddingStrategy: 'text_hash'
  }
)

// Generate with automatic fallback
const embedding = await handler.generateEmbedding('Text to embed')
```

## Provider-Specific Features

### Mistral Connector
- **Primary chat provider**: Fast, cost-effective chat completions
- **Multilingual support**: European languages optimization
- **Function calling**: Tool use capabilities
- **hyperdata-clients integration**: Standardized API interface

### Claude Connector  
- **Advanced reasoning**: Complex problem-solving capabilities
- **Large context windows**: Up to 200K tokens
- **Safety measures**: Constitutional AI for responsible outputs
- **Vision capabilities**: Image analysis and understanding

### Nomic Connector
- **Cloud-based embeddings**: High-quality semantic vectors
- **Batch processing**: Efficient multi-text embedding generation
- **1536-dimension vectors**: Standard embedding dimensionality
- **Atlas API integration**: Direct connection to Nomic's embedding service

### Ollama Connector
- **Local deployment**: Complete privacy and offline operation
- **Custom models**: Support for locally installed models
- **Dual capability**: Both chat and embedding generation
- **Resource optimization**: Efficient local resource usage

## Embedding Support System

### Multi-Provider Architecture

The embedding system supports multiple providers with automatic fallback:

1. **Primary**: Nomic Atlas API (cloud-based, high-quality)
2. **Fallback**: Ollama (local, privacy-focused)
3. **Emergency**: Hash-based embeddings (deterministic fallback)

### Embedding Handler Features

- **Caching**: Automatic caching of generated embeddings
- **Validation**: Dimension and format validation
- **Standardization**: Automatic dimension padding/truncation
- **Resilience**: Retry logic with exponential backoff
- **Fallback strategies**: Multiple fallback embedding generation methods

### Fallback Strategies

```javascript
// Available fallback strategies
const strategies = {
  'zero_vector': 'All zeros (safe default)',
  'random_vector': 'Random values (for testing)',
  'text_hash': 'Deterministic hash-based embedding'
}
```

## Usage Patterns

### Configuration-Driven Selection

```javascript
// Automatic provider selection based on priority
const providers = config.llmProviders
  .filter(p => p.capabilities.includes('chat'))
  .sort((a, b) => a.priority - b.priority)

const primaryProvider = providers[0] // Mistral (priority 1)
const fallbackProvider = providers[1] // Claude (priority 2)
```

### Embedding Factory Pattern

```javascript
// Get supported providers
const supportedProviders = EmbeddingConnectorFactory.getSupportedProviders()
// Returns: ['ollama', 'nomic']

// Check provider support
const isSupported = EmbeddingConnectorFactory.isProviderSupported('nomic')
// Returns: true

// Get default configuration
const defaultConfig = EmbeddingConnectorFactory.getDefaultConfig('nomic')
```

## Error Handling & Resilience

### EmbeddingHandler Error Types

- **CONFIGURATION_ERROR**: Invalid provider or configuration
- **VALIDATION_ERROR**: Invalid input or embedding format
- **PROVIDER_ERROR**: Provider-specific failures
- **EMBEDDING_ERROR**: General embedding operation failures

### Automatic Fallback Flow

1. **Primary attempt**: Try configured embedding provider
2. **Retry logic**: Exponential backoff with timeout
3. **Provider fallback**: Switch to secondary provider
4. **Emergency fallback**: Generate hash-based embedding
5. **Graceful degradation**: System continues with fallback embeddings

## Monitoring & Metrics

### Provider Health Tracking
- **Availability monitoring**: Real-time provider status
- **Response time tracking**: Performance metrics per provider
- **Error rate analysis**: Failure rate monitoring
- **Fallback frequency**: Resilience system usage

### Cost Optimization
- **Token usage tracking**: Monitor API consumption
- **Provider selection**: Automatic cost-effective routing
- **Local fallback**: Reduce cloud API costs
- **Batch processing**: Efficient multi-request handling

## Migration Notes

### From Legacy Architecture

The connector system has been modernized:

- **Old**: Direct provider implementations with manual configuration
- **New**: `hyperdata-clients` integration with config-driven selection
- **Benefits**: Standardized interfaces, better error handling, automatic fallbacks

### Breaking Changes

- Connector constructors now use `hyperdata-clients` factory pattern
- Configuration moved from code to `config.json`
- Embedding operations separated into dedicated handlers
- Provider selection now priority-based rather than manual

## Extension Points

### Adding New Providers

1. **Add to config.json**: Configure provider with capabilities and priority
2. **Implement connector**: Extend base connector for provider-specific features
3. **Update factory**: Add provider to `EmbeddingConnectorFactory` if embedding support needed
4. **Test integration**: Verify provider works with existing handler infrastructure

### Custom Embedding Strategies

```javascript
// Extend EmbeddingHandler for custom fallback strategies
class CustomEmbeddingHandler extends EmbeddingHandler {
  generateFallbackEmbedding(text, strategy) {
    if (strategy === 'custom_strategy') {
      return this.customEmbeddingLogic(text)
    }
    return super.generateFallbackEmbedding(text, strategy)
  }
}
```

## Security Considerations

- **API keys**: Securely stored in environment variables with `${VAR}` substitution
- **Local models**: Ollama provides completely local operation for sensitive data
- **Request sanitization**: All inputs validated before provider calls
- **Error information**: Sensitive details filtered from error messages
- **Audit logging**: Provider usage tracked for compliance