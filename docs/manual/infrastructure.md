# Semem Infrastructure Guide

A concise guide to system infrastructure patterns and best practices for contributors.

## Table of Contents

1. [Configuration Management](#configuration-management)
2. [Provider System](#provider-system)
3. [SPARQL Service Layer](#sparql-service-layer)
4. [Prompt Management](#prompt-management)
5. [Common Patterns](#common-patterns)
6. [Implementation Guidelines](#implementation-guidelines)

---

## Configuration Management

### Core Pattern

All classes should use the `Config.js` system for configuration management:

```javascript
import Config from '../Config.js';

class YourClass {
    constructor(configPath = null) {
        this.config = null;
    }

    async init() {
        // Standard config loading pattern
        const configPath = this.configPath || 
            (process.cwd().endsWith('/examples/document') 
                ? '../../config/config.json' 
                : 'config/config.json');
        
        this.config = new Config(configPath);
        await this.config.init();
    }
}
```

### Configuration Structure

Standard `config.json` sections:

```json
{
  "storage": {
    "type": "sparql",
    "options": {
      "query": "http://localhost:3030/dataset/query",
      "update": "http://localhost:3030/dataset/update",
      "graphName": "http://example.org/graph"
    }
  },
  "llmProviders": [
    {
      "type": "mistral",
      "apiKey": "${MISTRAL_API_KEY}",
      "chatModel": "mistral-small-latest",
      "priority": 1,
      "capabilities": ["chat"]
    }
  ],
  "servers": {
    "api": 4100,
    "ui": 4120
  },
  "templatesPath": "prompts/templates"
}
```

### Environment Variables

Use `.env` for secrets and runtime configuration:

```bash
# API Keys
MISTRAL_API_KEY=your_mistral_key
CLAUDE_API_KEY=your_claude_key
NOMIC_API_KEY=your_nomic_key

# Service URLs
OLLAMA_HOST=http://localhost:11434

# Config overrides (SEMEM_ prefix)
SEMEM_STORAGE_TYPE=sparql
SEMEM_SERVERS_API=4200
```

---

## Provider System

### LLM Provider Pattern

Standard pattern for LLM provider configuration:

```javascript
import MistralConnector from '../connectors/MistralConnector.js';
import ClaudeConnector from '../connectors/ClaudeConnector.js';
import OllamaConnector from '../connectors/OllamaConnector.js';

/**
 * Create LLM connector based on configuration priority
 */
async createLLMConnector(config) {
    try {
        const llmProviders = config.get('llmProviders') || [];
        
        // Priority-based selection
        const sortedProviders = llmProviders
            .filter(p => p.capabilities?.includes('chat'))
            .sort((a, b) => (a.priority || 999) - (b.priority || 999));
        
        // Try providers in order
        for (const provider of sortedProviders) {
            if (provider.type === 'mistral' && provider.apiKey) {
                return new MistralConnector();
            } else if (provider.type === 'claude' && provider.apiKey) {
                return new ClaudeConnector();
            } else if (provider.type === 'ollama') {
                return new OllamaConnector();
            }
        }
        
        // Fallback to Ollama
        return new OllamaConnector();
    } catch (error) {
        console.warn('Failed to create LLM connector, using Ollama:', error.message);
        return new OllamaConnector();
    }
}
```

### Embedding Provider Pattern

```javascript
import EmbeddingConnectorFactory from '../connectors/EmbeddingConnectorFactory.js';

/**
 * Create embedding connector using factory pattern
 */
async createEmbeddingConnector(config) {
    try {
        const embeddingProviders = config.get('llmProviders') || [];
        
        const sortedProviders = embeddingProviders
            .filter(p => p.capabilities?.includes('embedding'))
            .sort((a, b) => (a.priority || 999) - (b.priority || 999));
        
        for (const provider of sortedProviders) {
            if (provider.type === 'nomic' && provider.apiKey) {
                return EmbeddingConnectorFactory.createConnector({
                    provider: 'nomic',
                    apiKey: provider.apiKey,
                    model: provider.embeddingModel
                });
            } else if (provider.type === 'ollama') {
                return EmbeddingConnectorFactory.createConnector({
                    provider: 'ollama',
                    baseUrl: provider.baseUrl || 'http://localhost:11434',
                    model: provider.embeddingModel || 'nomic-embed-text'
                });
            }
        }
        
        // Fallback to Ollama
        return EmbeddingConnectorFactory.createConnector({
            provider: 'ollama',
            baseUrl: 'http://localhost:11434',
            model: 'nomic-embed-text'
        });
    } catch (error) {
        console.warn('Failed to create embedding connector, using Ollama:', error.message);
        return EmbeddingConnectorFactory.createConnector({
            provider: 'ollama',
            baseUrl: 'http://localhost:11434',
            model: 'nomic-embed-text'
        });
    }
}
```

---

## SPARQL Service Layer

### Service Initialization Pattern

All classes should use the SPARQL service layer for queries:

```javascript
import { SPARQLQueryService } from '../services/sparql/index.js';
import SPARQLHelper from '../services/sparql/SPARQLHelper.js';

class YourClass {
    async init() {
        // Initialize SPARQL services
        this.queryService = new SPARQLQueryService({
            queryPath: process.cwd().endsWith('/examples/document') 
                ? '../../sparql/queries' 
                : 'sparql/queries'
        });
        
        const storageConfig = this.config.get('storage');
        this.sparqlHelper = new SPARQLHelper(storageConfig.options.update, {
            user: storageConfig.options.user,
            password: storageConfig.options.password
        });
    }
}
```

### Query Template Pattern

**DO NOT** use hardcoded SPARQL queries. Use templates:

```javascript
// ❌ DON'T DO THIS - Hardcoded query
const query = `
    SELECT * WHERE {
        GRAPH <${graphURI}> {
            ?s ?p ?o .
        }
    }
`;

// ✅ DO THIS - Template-based query
const queryParams = {
    graphURI: targetGraph,
    entityURI: entityURI,
    limit: 'LIMIT 50'
};

const query = await this.queryService.getQuery('entity-details', queryParams);
const result = await this.sparqlHelper.executeSelect(query);
```

### Query File Structure

Place queries in `sparql/queries/` with descriptive names:

```
sparql/
├── queries/
│   ├── entity-details.sparql
│   ├── list-concepts.sparql
│   ├── merge-concepts.sparql
│   └── corpuscle-details.sparql
└── config/
    └── query-mappings.json
```

### Query Mapping Registration

Add new queries to `sparql/config/query-mappings.json`:

```json
{
  "entity-details": "entity-details.sparql",
  "list-concepts": "list-concepts.sparql",
  "merge-concepts": "merge-concepts.sparql",
  "corpuscle-details": "corpuscle-details.sparql"
}
```

---

## Prompt Management

### Unified Prompt System Pattern

Use the modern prompt management system:

```javascript
import { 
    getPromptManager, 
    PromptContext, 
    PromptOptions 
} from '../prompts/index.js';

class YourClass {
    async init() {
        // Initialize prompt manager
        this.promptManager = getPromptManager();
        
        // Register custom templates if needed
        await this.registerCustomTemplates();
    }
    
    async extractConcepts(text) {
        // Create prompt context
        const context = new PromptContext({
            arguments: { text: text },
            model: this.chatModel,
            temperature: 0.2
        });

        // Create prompt options
        const options = new PromptOptions({
            format: 'completion',
            temperature: 0.2,
            retries: 3
        });

        // Generate prompt using template
        const result = await this.promptManager.generatePrompt(
            'concept-extraction-enhanced', 
            context, 
            options
        );
        
        return result.content;
    }
}
```

### Legacy Compatibility

Existing code continues to work unchanged:

```javascript
// This pattern still works
import PromptTemplates from '../PromptTemplates.js';

const template = PromptTemplates.getTemplateForModel('mistral');
const messages = await template.chat(
    'You are a helpful assistant.',
    'Context about the topic',
    'What is your question?'
);
```

---

## Common Patterns

### Standard Class Structure

```javascript
import Config from '../Config.js';
import { SPARQLQueryService } from '../services/sparql/index.js';
import SPARQLHelper from '../services/sparql/SPARQLHelper.js';
import { getPromptManager } from '../prompts/index.js';

class StandardClass {
    constructor(configPath = null) {
        this.config = null;
        this.queryService = null;
        this.sparqlHelper = null;
        this.promptManager = null;
        this.llmProvider = null;
        this.embeddingHandler = null;
        this.initialized = false;
    }

    async init() {
        if (this.initialized) return;

        // 1. Initialize configuration
        await this.initializeConfig();
        
        // 2. Initialize SPARQL services
        await this.initializeSPARQLServices();
        
        // 3. Initialize prompt management
        await this.initializePromptManager();
        
        // 4. Initialize LLM and embedding providers
        await this.initializeLLMHandler();
        await this.initializeEmbeddingHandler();

        this.initialized = true;
    }

    async initializeConfig() {
        const configPath = this.configPath || 
            (process.cwd().endsWith('/examples/document') 
                ? '../../config/config.json' 
                : 'config/config.json');
        
        this.config = new Config(configPath);
        await this.config.init();
    }

    async initializeSPARQLServices() {
        this.queryService = new SPARQLQueryService({
            queryPath: process.cwd().endsWith('/examples/document') 
                ? '../../sparql/queries' 
                : 'sparql/queries'
        });

        const storageConfig = this.config.get('storage');
        this.sparqlHelper = new SPARQLHelper(storageConfig.options.update, {
            user: storageConfig.options.user,
            password: storageConfig.options.password
        });
    }

    async initializePromptManager() {
        this.promptManager = getPromptManager();
    }

    async cleanup() {
        // Clean up in reverse order
        if (this.embeddingHandler) {
            await this.embeddingHandler.cleanup();
        }
        
        if (this.queryService) {
            this.queryService.cleanup();
        }
        
        // Force exit pattern for scripts
        setTimeout(() => {
            process.exit(0);
        }, 100);
    }
}
```

### Error Handling Pattern

```javascript
async function main() {
    let instance = null;
    
    try {
        instance = new YourClass();
        await instance.init();
        
        // Do work
        const result = await instance.process();
        
        console.log('✅ Processing completed successfully');
        return result;
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        
        if (process.env.LOG_LEVEL === 'debug') {
            console.error('Stack:', error.stack);
        }
        
        process.exit(1);
    } finally {
        // Always cleanup
        if (instance) {
            await instance.cleanup();
        }
    }
}
```

---

## Implementation Guidelines

### 1. Configuration

- **ALWAYS** use `Config.js` for configuration management
- **NEVER** hardcode API keys - use environment variables
- **ALWAYS** support both relative and absolute config paths
- **USE** `${VAR_NAME}` substitution in config files

### 2. Provider Management

- **ALWAYS** use priority-based provider selection
- **ALWAYS** provide fallback to Ollama
- **NEVER** assume specific providers are available
- **ALWAYS** handle provider initialization failures gracefully

### 3. SPARQL Operations

- **ALWAYS** use `SPARQLQueryService` for complex queries
- **NEVER** hardcode SPARQL queries in JavaScript
- **ALWAYS** use parameterized query templates
- **ALWAYS** register new queries in `query-mappings.json`

### 4. Prompt Management

- **PREFER** unified prompt system for new code
- **MAINTAIN** backward compatibility with existing code
- **ALWAYS** use appropriate prompt templates for different models
- **NEVER** hardcode prompts in business logic

### 5. Resource Management

- **ALWAYS** implement proper cleanup methods
- **ALWAYS** handle process termination gracefully
- **USE** `setTimeout(() => process.exit(0), 100)` pattern for scripts
- **ALWAYS** clean up in reverse initialization order

### 6. Error Handling

- **ALWAYS** provide informative error messages
- **NEVER** mask underlying errors with generic messages
- **ALWAYS** include troubleshooting guidance
- **USE** debug logging for detailed error information

### 7. Path Management

- **ALWAYS** handle both development and production paths
- **USE** `process.cwd().endsWith('/examples/document')` pattern
- **NEVER** assume specific working directories
- **ALWAYS** use proper path resolution

### 8. Testing and Validation

- **ALWAYS** validate configuration before use
- **ALWAYS** test provider connectivity
- **ALWAYS** provide dry-run modes for destructive operations
- **ALWAYS** include comprehensive help messages

---

## Quick Reference

### Essential Imports

```javascript
// Configuration
import Config from '../Config.js';

// SPARQL Services
import { SPARQLQueryService } from '../services/sparql/index.js';
import SPARQLHelper from '../services/sparql/SPARQLHelper.js';

// Prompt Management
import { getPromptManager, PromptContext, PromptOptions } from '../prompts/index.js';

// Provider System
import MistralConnector from '../connectors/MistralConnector.js';
import ClaudeConnector from '../connectors/ClaudeConnector.js';
import OllamaConnector from '../connectors/OllamaConnector.js';
import EmbeddingConnectorFactory from '../connectors/EmbeddingConnectorFactory.js';

// Handlers
import LLMHandler from '../handlers/LLMHandler.js';
import EmbeddingHandler from '../handlers/EmbeddingHandler.js';
```

### Standard Initialization Order

1. **Configuration** - Load and validate config
2. **SPARQL Services** - Initialize query service and helper
3. **Prompt Management** - Initialize prompt manager
4. **Provider Selection** - Create LLM and embedding providers
5. **Handler Creation** - Initialize handlers with providers
6. **Validation** - Verify all components are ready

### Cleanup Order

1. **Handlers** - Cleanup LLM and embedding handlers
2. **Providers** - Cleanup connectors
3. **Services** - Cleanup SPARQL services
4. **Process Exit** - Force exit with timeout

This guide ensures consistent, maintainable, and robust infrastructure patterns across the Semem codebase.