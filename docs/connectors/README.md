# Connectors Module

The Connectors module provides unified interfaces for integrating with various Large Language Model (LLM) providers and external services. It implements the Adapter pattern to normalize different provider APIs into a consistent interface.

## Architecture

### Base Classes

- **ClientConnector**: Abstract base class defining the common interface for all LLM providers
- Standardizes authentication, request formatting, and response handling
- Provides error handling and retry mechanisms
- Implements rate limiting and connection pooling

### Supported Providers

#### Claude (Anthropic)
- **ClaudeConnector**: Integration with Anthropic's Claude models
- Supports conversation history and system prompts
- Implements streaming responses for real-time interactions
- Advanced safety filtering and content moderation

#### Ollama (Local Models)
- **OllamaConnector**: Local model execution via Ollama
- Supports custom model installations and management
- Optimized for privacy-focused deployments
- GPU acceleration support when available

#### Mistral AI
- **MistralConnector**: Integration with Mistral's model suite
- Multilingual capabilities and European data residency
- Function calling and tool use capabilities
- Cost-optimized model selection

## Features

### Unified Interface
```javascript
// All connectors implement the same interface
const connector = new ClaudeConnector(config);
await connector.initialize();

// Chat completion
const response = await connector.generateChat(
  'claude-3-sonnet',
  [{ role: 'user', content: 'Hello, world!' }],
  { temperature: 0.7 }
);

// Embedding generation
const embedding = await connector.generateEmbedding(
  'text-embedding-3-small',
  'Text to embed'
);
```

### Configuration Management
- Environment-based configuration
- API key rotation and security
- Model-specific parameter tuning
- Connection timeout and retry policies

### Error Handling
- Graceful degradation when providers are unavailable
- Automatic fallback to alternative providers
- Detailed error logging and monitoring
- Circuit breaker pattern for stability

### Performance Optimization
- Request batching for efficiency
- Response caching for repeated queries
- Connection pooling and keep-alive
- Streaming responses for large outputs

## Provider-Specific Features

### Claude Connector
- Advanced reasoning capabilities
- Large context windows (up to 200K tokens)
- Constitutional AI safety measures
- Vision capabilities for image analysis

### Ollama Connector
- Complete local deployment
- Custom model fine-tuning
- Privacy-preserving operation
- Resource usage optimization

### Mistral Connector
- European data sovereignty
- Multilingual optimization
- Function calling capabilities
- Competitive pricing models

## Usage Patterns

### Provider Selection
```javascript
import { getConnector } from './src/connectors/index.js';

// Automatic provider selection based on availability
const connector = await getConnector('auto');

// Specific provider selection
const claude = await getConnector('claude');
const ollama = await getConnector('ollama');
```

### Fallback Configuration
```javascript
const config = {
  primary: 'claude',
  fallbacks: ['mistral', 'ollama'],
  retryPolicy: {
    maxRetries: 3,
    backoffFactor: 2
  }
};
```

### Streaming Responses
```javascript
const stream = await connector.generateChatStream(model, messages);
for await (const chunk of stream) {
  console.log(chunk.content);
}
```

## Security Considerations

- API keys stored securely with encryption
- Request/response data sanitization
- Audit logging for compliance
- Rate limiting to prevent abuse
- Network security for local deployments

## Monitoring & Metrics

- Provider availability tracking
- Response time monitoring
- Token usage analytics
- Error rate analysis
- Cost optimization insights

## Extension Points

The connector architecture supports easy extension:

- **Custom Providers**: Implement new LLM provider integrations
- **Middleware**: Add request/response transformation layers
- **Plugins**: Extend functionality with additional capabilities
- **Protocol Support**: Add new communication protocols (gRPC, WebSocket)