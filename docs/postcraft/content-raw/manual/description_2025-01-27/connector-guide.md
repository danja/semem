# LLM Connector Implementation Guide

## OllamaConnector Analysis

The OllamaConnector provides integration with the Ollama API service, implementing three core methods:

1. `generateEmbedding`: Generates vector embeddings from text input
2. `generateChat`: Handles chat completion using message history
3. `generateCompletion`: Simple text completion

Key features:
- Consistent error handling and logging
- Configurable base URL
- Standard response formatting
- Request options handling

## Creating New Connectors

### Required Interface
Every connector must implement these methods:

```javascript
class ExampleConnector {
    async generateEmbedding(model, input) {
        // Return number[] - embedding vector
    }

    async generateChat(model, messages, options = {}) {
        // messages: Array<{role: string, content: string}>
        // Return string - generated response
    }

    async generateCompletion(model, prompt, options = {}) {
        // Return string - completion text
    }
}
```

### Implementation Guide

1. Create a new file under `src/connectors/` with format `{Provider}Connector.js`

2. Implement required methods:
   - Handle authentication if needed
   - Map to provider's API format
   - Implement error handling
   - Return standardized responses

3. Add configurations:
   - Base URL configuration
   - API key management
   - Model mappings if needed

### Error Handling Pattern
- Catch API-specific errors
- Convert to standard error format
- Log appropriately
- Include request context in errors

### Sample Implementation

```javascript
import logger from 'loglevel'

export default class NewServiceConnector {
    constructor(apiKey, baseUrl = 'https://api.service.com') {
        this.apiKey = apiKey
        this.baseUrl = baseUrl
    }

    async generateEmbedding(model, input) {
        logger.debug(`Generating embedding with model ${model}`)
        try {
            const response = await fetch(`${this.baseUrl}/embeddings`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model,
                    input
                })
            })

            if (!response.ok) {
                throw new Error(`API error: ${response.status}`)
            }

            const data = await response.json()
            return data.embedding
        } catch (error) {
            logger.error('Embedding generation failed:', error)
            throw error
        }
    }

    async generateChat(model, messages, options = {}) {
        // Similar pattern to generateEmbedding
    }

    async generateCompletion(model, prompt, options = {}) {
        // Similar pattern to generateEmbedding
    }
}
```

### Testing Requirements

1. Create unit tests in `tests/unit/connectors/`
2. Create integration tests in `tests/integration/connectors/`
3. Include mock responses for unit tests
4. Test error conditions
5. Test configuration variations

### Adding New Connector

1. Create connector class
2. Add tests
3. Register in Config.js model mappings
4. Update documentation
5. Add example usage