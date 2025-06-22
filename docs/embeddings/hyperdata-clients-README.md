# hyperdata-clients

[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/danja/hyperdata-clients)

Yet another node API client library for interacting with AI providers using a common interface.

_I wanted my own so I knew how it worked_

```sh
npm run ask mistral 'In brief, how many AGIs will it take to change a lightbulb?'
...
Using API: mistral
Model: default
Prompt: In brief, how many AGIs will it take to change a lightbulb?
Using mistral key from: .env file

...it's uncertain how many would be needed to change a lightbulb...
```

import { OpenAI, Claude, KeyManager } from 'hyperdata-clients';

## Status: 2025-06-04 doc fixes, barrel file, version bump.

Working for me against :

- Ollama (local)
- Mistral (free & speedy, needs API key)
- OpenAI (requires $s and API key)

Various other clients sketched out, will likely need tweaking.

Only tested on recent Ubuntu.

There's a very basic CLI for checking the thing (see below), also runnable hardcoded examples eg.

```sh
node examples/MistralMinimal.js
```

```javascript
import { createClient, createEmbeddingClient } from 'hyperdata-clients';

// For API clients
const openAIClient = await createClient('openai', { apiKey: 'your-api-key' });

// For embedding clients
const nomicClient = await createEmbeddingClient('nomic', { apiKey: 'your-nomic-key' });
const ollamaEmbedding = await createEmbeddingClient('ollama');

// For MCP clients (untested)
const mcpClient = await createClient('mcp', { /* mcp config */ });
```

## Features

- Support for multiple AI providers
- Dedicated embedding model support
- Environment-based configuration
- Secure API key management
- Consistent interface across providers
- Type definitions included
- Extensive test coverage

### Chat Providers
- Ollama 
- OpenAI
- Claude 
- Mistral
- Groq
- Perplexity
- HuggingFace

### Embedding Providers
- Nomic (via Atlas API)
- Ollama (local embeddings)

## Installation

Prequisites : recent node

```sh
git clone https://github.com/danja/hyperdata-clients.git
cd hyperdata-clients
npm install
```

## CLI

Really minimal for testing purposes :

```bash
# Basic usage
npm run ask [provider] [options] "your prompt"

# or more directly
node examples/minimal.js [provider] [options] "your prompt"

# Mistral
npm run ask mistral --model 'open-codestral-mamba' 'tell me about yourself'

# Example with Ollama running locally, it'll default model to qwen2:1.5b
npm run ask ollama 'how are you?'

# requires an API key
node examples/minimal.js openai 'what are you?'
```

## Embedding Models

The library provides dedicated support for text embeddings through specialized embedding clients:

```javascript
import { createEmbeddingClient } from 'hyperdata-clients';

// Using Nomic Atlas API (requires NOMIC_API_KEY)
const nomicClient = await createEmbeddingClient('nomic');
const embeddings = await nomicClient.embed([
    'The quick brown fox jumps over the lazy dog',
    'Artificial intelligence is transforming technology'
]);

// Using local Ollama (requires Ollama running with nomic-embed-text-v1.5)
const ollamaClient = await createEmbeddingClient('ollama');
const singleEmbedding = await ollamaClient.embedSingle('Hello world');

// Example output: embeddings are arrays of numbers
console.log(`Generated ${embeddings.length} embeddings`);
console.log(`Each embedding has ${embeddings[0].length} dimensions`);
```

### Embedding Example

```bash
# Run the embedding demo
node examples/embedding.js
```

The embedding clients support:
- **Batch processing**: Embed multiple texts at once
- **Single text convenience**: `embedSingle()` method for individual texts  
- **Model selection**: Custom model via options
- **Error handling**: Consistent error handling across providers

## Architecture

![docs/images/structure.png]

## Documentation

Comprehensive API documentation is available in the `docs` directory. To generate or update the documentation:

```sh
# Install dependencies (if not already installed)
npm install

# Generate documentation
npm run docs

# The documentation will be available in docs/jsdoc/index.html
```

The documentation includes:
- API reference for all components
- Getting started guide
- Code examples
- Configuration options

## Testing

The project includes an extensive test suite to ensure reliability and compatibility across different providers. To run the tests:

```sh
# Run all tests
npm test

# Run tests with coverage report
npm run coverage

# Run tests in watch mode during development
npm run test:ui
```

### Test Coverage

Test coverage reports are generated in the `coverage` directory after running the coverage command. This includes:
- Line coverage
- Function coverage
- Branch coverage

## Contributing

Contributions are welcome! Please ensure all tests pass and add new tests for any new features or bug fixes.

MIT License
