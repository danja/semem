# Semem NPM Package Usage

This document describes how to use the Semem package when installed via npm, including access to all MCP (Model Context Protocol) functionality.

## Installation

```bash
npm install semem
```

## Basic Usage

### Core Components

```javascript
import { 
  MemoryManager, 
  Config, 
  LLMHandler, 
  EmbeddingHandler,
  SPARQLStore 
} from 'semem';

// Initialize configuration
const config = new Config();
await config.initialize();

// Create memory manager
const memoryManager = new MemoryManager(config);
await memoryManager.initialize();

// Use the memory system
await memoryManager.storeInteraction("What is AI?", "AI is artificial intelligence...");
const memories = await memoryManager.retrieveMemories("artificial intelligence", 5);
```

### Ragno (Knowledge Graph) Integration

```javascript
import { Entity, decomposeCorpus } from 'semem/ragno';

// Decompose text into knowledge graph
const textChunks = [
  { content: "Paris is the capital of France.", source: "geography" }
];

const llmHandler = new LLMHandler(config);
const result = await decomposeCorpus(textChunks, llmHandler);

// Access extracted entities
console.log(result.entities); // Entity objects
console.log(result.relationships); // Relationship objects
console.log(result.units); // Semantic units
```

### ZPT (Zero-shot Prompt Templates)

```javascript
import { CorpuscleSelector } from 'semem/zpt';

// Use ZPT functionality
const selector = new CorpuscleSelector(config);
```

## MCP (Model Context Protocol) Integration

### Direct MCP Server Usage

```javascript
import { MCP } from 'semem';

// Create MCP server instance
const server = await MCP.createServer();

// Initialize workflow orchestrator
await MCP.workflowOrchestrator.initialize(server);

// Access prompt registry
const prompts = MCP.promptRegistry.listPrompts();
console.log('Available prompts:', prompts.map(p => p.name));
```

### Enhanced Workflow Orchestration

```javascript
import { MCP } from 'semem';

// Initialize services
await MCP.initializeServices();

// Execute enhanced research workflow
const result = await MCP.executePromptWorkflow(
  MCP.enhancedResearchWorkflow,
  {
    documents: ['path/to/document.pdf'],
    query: 'What are the key findings?',
    context: { domain: 'research' }
  },
  MCP.createSafeToolExecutor(server)
);

console.log('Research results:', result);
```

### Safe Operations

```javascript
import { MCP } from 'semem';

// Use safe memory operations
const storeResult = await MCP.safeMemoryStore({
  prompt: "What is machine learning?",
  response: "Machine learning is a subset of AI...",
  metadata: { topic: 'AI' }
});

const memories = await MCP.safeMemoryRetrieve(
  "machine learning concepts", 
  5, 
  0.7
);

// Extract concepts safely
const concepts = await MCP.safeMemoryExtractConcepts(
  "Natural language processing enables computers to understand human language"
);
```

### Custom Workflow Creation

```javascript
import { MCP } from 'semem';

// Create custom workflow template
const customWorkflow = {
  name: 'custom-analysis',
  description: 'Custom analysis workflow',
  arguments: [
    { name: 'data', description: 'Data to analyze', required: true }
  ],
  workflow: [
    {
      tool: 'semem_extract_concepts',
      arguments: { text: '${data}' }
    },
    {
      tool: 'ragno_decompose_corpus', 
      arguments: { 
        textChunks: [{ content: '${data}', source: 'input' }]
      }
    }
  ]
};

// Register and execute
MCP.promptRegistry.registerPrompt(customWorkflow);
const result = await MCP.executePromptWorkflow(
  customWorkflow,
  { data: 'Your analysis text here' },
  MCP.createSafeToolExecutor(server)
);
```

## Configuration

### Environment Variables

Create a `.env` file with your API keys:

```env
# LLM Provider Keys
OPENAI_API_KEY=your_openai_key
ANTHROPIC_API_KEY=your_anthropic_key
MISTRAL_API_KEY=your_mistral_key

# Ollama Configuration (if using local models)
OLLAMA_BASE_URL=http://localhost:11434

# SPARQL Endpoint (if using SPARQL storage)
SPARQL_ENDPOINT=http://localhost:3030/dataset
SPARQL_UPDATE_ENDPOINT=http://localhost:3030/dataset/update

# MCP Configuration
MCP_USE_HTTP_TOOLS=true
MCP_DEBUG=true
```

### Programmatic Configuration

```javascript
import { Config } from 'semem';

const config = new Config({
  llm: {
    provider: 'ollama',
    model: 'qwen2:1.5b',
    baseURL: 'http://localhost:11434'
  },
  embedding: {
    provider: 'ollama', 
    model: 'nomic-embed-text',
    dimensions: 1536
  },
  storage: {
    type: 'CachedSPARQL',
    sparqlEndpoint: 'http://localhost:3030/dataset',
    sparqlUpdateEndpoint: 'http://localhost:3030/dataset/update'
  }
});

await config.initialize();
```

## Advanced Usage

### Complete Integration Example

```javascript
import { 
  MemoryManager, 
  Config, 
  LLMHandler,
  CachedSPARQLStore,
  MCP 
} from 'semem';

async function setupEnhancedMemorySystem() {
  // Initialize configuration
  const config = new Config();
  await config.initialize();
  
  // Setup SPARQL storage with caching
  const store = new CachedSPARQLStore(config);
  await store.initialize();
  
  // Create memory manager
  const memoryManager = new MemoryManager(config, store);
  await memoryManager.initialize();
  
  // Setup MCP server for advanced workflows
  const mcpServer = await MCP.createServer();
  await MCP.workflowOrchestrator.initialize(mcpServer);
  
  // Execute enhanced research workflow
  const researchResult = await MCP.executePromptWorkflow(
    MCP.enhancedResearchWorkflow,
    {
      documents: ['research-paper.pdf'],
      query: 'Summarize key methodologies',
      goals: ['methodology-extraction', 'comparative-analysis']
    },
    MCP.createSafeToolExecutor(mcpServer)
  );
  
  return {
    memoryManager,
    mcpServer,
    store,
    researchResult
  };
}

// Usage
const system = await setupEnhancedMemorySystem();
console.log('Enhanced memory system ready');
```

## Module Exports

### Main Package (`semem`)
- Core components: `MemoryManager`, `Config`, `ContextManager`
- Handlers: `LLMHandler`, `EmbeddingHandler`, `CacheManager`
- Storage: `BaseStore`, `InMemoryStore`, `JSONStore`, `SPARQLStore`, `CachedSPARQLStore`
- Connectors: `ClientConnector`, `OllamaConnector`, `ClaudeConnector`, `MistralConnector`
- Utilities: `Utils`
- MCP Integration: `MCP` namespace

### Ragno Module (`semem/ragno`)
- `Entity`, `SemanticUnit`, `Relationship`
- `decomposeCorpus`
- `RDFGraphManager`

### ZPT Module (`semem/zpt`)
- `CorpuscleSelector`
- ZPT utilities and templates

### MCP Module (`semem/mcp`)
- All MCP functionality directly accessible
- Workflow orchestration
- Enhanced templates
- Safe operations

## Error Handling

```javascript
import { MCP } from 'semem';

try {
  const result = await MCP.safeMemoryStore({
    prompt: "Test prompt",
    response: "Test response"
  });
  
  if (!result.success) {
    console.error('Storage failed:', result.error);
  }
} catch (error) {
  console.error('Unexpected error:', error);
}
```

## TypeScript Support

The package includes TypeScript definitions:

```typescript
import { 
  MemoryManager, 
  Config,
  IMemoryItem,
  ISearchResult 
} from 'semem';

const manager: MemoryManager = new MemoryManager(config);
const results: ISearchResult[] = await manager.retrieveMemories("query", 5);
```

This comprehensive integration allows full access to Semem's capabilities including the enhanced MCP workflow system, making it suitable for building intelligent agent applications with semantic memory and knowledge graph capabilities.