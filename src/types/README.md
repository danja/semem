# Semem TypeScript Definitions

This directory contains comprehensive TypeScript definitions for all core components of the Semem semantic memory system.

## 📁 File Structure

```
src/types/
├── index.ts          # Main export file - import everything from here
├── core.d.ts         # Core system components (MemoryManager, LLMHandler, etc.)
├── ragno.d.ts        # Ragno knowledge graph components  
├── zpt.d.ts          # ZPT navigation and transformation
├── mcp-schema.ts     # MCP (Model Context Protocol) integration
├── api.ts            # API and HTTP server types
├── MemoryTypes.ts    # Legacy memory types (for compatibility)
└── README.md         # This file
```

## 🚀 Quick Start

### Basic Usage

```typescript
// Import core types
import { 
  MemoryManager, 
  MemoryManagerConfig,
  LLMHandler,
  EmbeddingHandler 
} from './types/index.js';

// Create a memory manager with proper typing
const config: MemoryManagerConfig = {
  llmProvider: myProvider,
  chatModel: 'qwen2:1.5b',
  embeddingModel: 'nomic-embed-text',
  dimension: 1536
};

const manager = new MemoryManager(config);
```

### Knowledge Graph Usage

```typescript
// Import Ragno types
import { 
  Entity, 
  SemanticUnit, 
  Relationship,
  decomposeCorpus,
  DecompositionOptions 
} from './types/index.js';

// Use corpus decomposition with types
const options: DecompositionOptions = {
  extractRelationships: true,
  maxEntitiesPerChunk: 10,
  minConfidence: 0.7
};

const result = await decomposeCorpus(textChunks, llmHandler, options);
```

### ZPT Navigation Usage

```typescript
// Import ZPT types
import { 
  ZPTParameters, 
  CorpuscleSelector,
  NavigationRequest 
} from './types/index.js';

// Define navigation parameters with type safety
const parameters: ZPTParameters = {
  zoom: {
    level: 'entity',
    granularity: 4,
    targetTypes: ['ragno:Entity']
  },
  tilt: {
    representation: 'embedding',
    outputFormat: 'vector',
    processingType: 'similarity'
  },
  transform: {
    maxTokens: 4000,
    format: 'markdown',
    tokenizer: 'cl100k_base',
    includeMetadata: true,
    chunkStrategy: 'semantic',
    tokenBudget: { content: 3200, metadata: 600, overhead: 200 },
    chunkSize: { target: 1000, overlap: 50 }
  }
};
```

## 📋 Core Components

### MemoryManager
The main class for semantic memory operations:

```typescript
interface MemoryManagerConfig {
  llmProvider: LLMProvider;
  embeddingProvider?: LLMProvider;
  chatModel?: string;
  embeddingModel?: string;
  storage?: StorageProvider;
  dimension?: number;
  contextOptions?: ContextOptions;
  cacheOptions?: CacheOptions;
}

class MemoryManager extends EventEmitter {
  // Core methods
  init(): Promise<void>;
  addInteraction(prompt: string, response: string, embedding?: Vector, concepts?: string[]): Promise<void>;
  retrieveRelevantInteractions(query: string, threshold?: number, excludeLastN?: number): Promise<RetrievalResult[]>;
  generateResponse(prompt: string, context?: Interaction[], memory?: RetrievalResult[]): Promise<string>;
  dispose(): Promise<void>;
}
```

### Storage Providers
Different storage backends with consistent interface:

```typescript
abstract class BaseStore implements StorageProvider {
  abstract loadHistory(): Promise<[Interaction[], Interaction[]]>;
  abstract saveMemoryToHistory(memoryStore: MemoryStore): Promise<void>;
  abstract close(): Promise<void>;
}

// Implementations
class InMemoryStore extends BaseStore { /* ... */ }
class JSONStore extends BaseStore { /* ... */ }  
class SPARQLStore extends BaseStore { /* ... */ }
```

### LLM Connectors
Provider implementations for different LLM services:

```typescript
abstract class ClientConnector implements LLMProvider {
  abstract generateEmbedding(model: string, input: string): Promise<Vector>;
  abstract generateChat(model: string, messages: ChatMessage[], options?: LLMOptions): Promise<string>;
  abstract generateCompletion(model: string, prompt: string, options?: LLMOptions): Promise<string>;
}

// Implementations
class OllamaConnector extends ClientConnector { /* ... */ }
class ClaudeConnector extends ClientConnector { /* ... */ }
class MistralConnector extends ClientConnector { /* ... */ }
```

## 🕸️ Ragno Knowledge Graph

### Core RDF Elements
```typescript
abstract class RDFElement {
  readonly id: string;
  readonly uri: NamedNode;
  readonly dataset: Dataset;
  
  setProperty(property: NamedNode | string, value: Term | string | number): void;
  exportToDataset(dataset?: Dataset): Dataset;
}

class Entity extends RDFElement {
  getPrefLabel(): string;
  isEntryPoint(): boolean;
  getSubType(): string;
  connectTo(target: Entity, relationshipType: string): Relationship;
}

class SemanticUnit extends RDFElement {
  getContent(): string;
  getEntities(): Entity[];
  addEntity(entity: Entity): void;
}

class Relationship extends RDFElement {
  getSource(): Entity;
  getTarget(): Entity;
  getRelationshipType(): string;
}
```

### Corpus Decomposition
```typescript
function decomposeCorpus(
  textChunks: TextChunk[],
  llmHandler: LLMHandler,
  options?: DecompositionOptions
): Promise<DecompositionResult>;

interface DecompositionResult {
  units: SemanticUnit[];
  entities: Entity[];
  relationships: Relationship[];
  dataset: Dataset;
  metadata: ProcessingMetadata;
}
```

## 🎯 ZPT Navigation

### Parameter System
```typescript
interface ZPTParameters {
  zoom: ZoomConfig;     // Granularity: entity, unit, text, community, corpus
  pan?: PanConfig;      // Filtering: topic, entity, temporal, spatial
  tilt: TiltConfig;     // Representation: keywords, embedding, graph, temporal
  transform: TransformConfig; // Output: json, markdown, structured, conversational
}
```

### Content Processing Pipeline
```typescript
class CorpuscleSelector {
  select(parameters: ZPTParameters): Promise<{
    corpuscles: Corpuscle[];
    metadata: SelectionMetadata;
  }>;
}

class TiltProjector {
  project(corpuscles: Corpuscle[], tilt: TiltConfig): Promise<ProjectionResult>;
}

class CorpuscleTransformer {
  transform(
    corpuscles: Corpuscle[],
    projectionResult: ProjectionResult,
    transform: TransformConfig
  ): Promise<TransformationResult>;
}
```

## 🔧 Development Guidelines

### Type Safety Best Practices

1. **Always use the provided interfaces:**
   ```typescript
   // Good ✅
   const config: MemoryManagerConfig = { /* ... */ };
   
   // Bad ❌  
   const config = { /* ... */ };
   ```

2. **Leverage union types for parameters:**
   ```typescript
   type ZoomLevel = 'entity' | 'unit' | 'text' | 'community' | 'corpus';
   type TiltRepresentation = 'keywords' | 'embedding' | 'graph' | 'temporal';
   ```

3. **Use generic types where appropriate:**
   ```typescript
   interface SearchResult<T = any> {
     entity: Entity;
     score: number;
     metadata?: T;
   }
   ```

### Error Handling

```typescript
// Custom error types with proper inheritance
class SememError extends Error {
  constructor(message: string, public readonly code: string, public readonly details?: any) {
    super(message);
    this.name = 'SememError';
  }
}

class EmbeddingError extends SememError {
  constructor(message: string, details?: any) {
    super(message, 'EMBEDDING_ERROR', details);
  }
}
```

### Event Handling

```typescript
// Strongly typed events
interface MemoryManagerEvents {
  'initialized': () => void;
  'interaction-added': (interaction: Interaction) => void;
  'memories-retrieved': (results: RetrievalResult[]) => void;
  'error': (error: Error) => void;
}

// Type-safe event emission
manager.on('interaction-added', (interaction: Interaction) => {
  console.log('Added:', interaction.prompt);
});
```

## 🧪 Testing with Types

```typescript
// Test helpers with proper typing
import { MemoryManager, MockLLMProvider } from './types/index.js';

describe('MemoryManager', () => {
  let manager: MemoryManager;
  let mockProvider: MockLLMProvider;
  
  beforeEach(() => {
    mockProvider = new MockLLMProvider();
    manager = new MemoryManager({ llmProvider: mockProvider });
  });
  
  it('should add interaction with proper types', async () => {
    const result = await manager.addInteraction('test', 'response');
    expect(result).toBeUndefined(); // void return type
  });
});
```

## 📚 API Documentation

### JSDoc Integration

The TypeScript definitions include comprehensive JSDoc comments that work with IDEs:

```typescript
/**
 * Generate response using LLM with optional memory context
 * @param prompt - User input prompt
 * @param contextInteractions - Previous interactions for context
 * @param memoryContext - Retrieved memory context
 * @param contextWindowSize - Maximum context window size
 * @param options - LLM generation options
 * @returns Promise resolving to generated response
 */
generateResponse(
  prompt: string,
  contextInteractions?: Interaction[],
  memoryContext?: RetrievalResult[],
  contextWindowSize?: number,
  options?: LLMOptions
): Promise<string>;
```

### IDE Support

These definitions provide:
- ✅ **IntelliSense/Auto-completion** in VS Code, WebStorm, etc.
- ✅ **Type checking** during development
- ✅ **Refactoring support** with confidence
- ✅ **Documentation on hover** with JSDoc comments
- ✅ **Error detection** before runtime

## 🔄 Migration Guide

### From JavaScript to TypeScript

1. **Import the types:**
   ```typescript
   import { MemoryManager, MemoryManagerConfig } from './types/index.js';
   ```

2. **Add type annotations to your variables:**
   ```typescript
   // Before
   const manager = new MemoryManager({ /* config */ });
   
   // After  
   const manager: MemoryManager = new MemoryManager({ /* config */ });
   ```

3. **Use interface types for configuration:**
   ```typescript
   const config: MemoryManagerConfig = {
     llmProvider: myProvider,
     chatModel: 'qwen2:1.5b',
     dimension: 1536
   };
   ```

### Backward Compatibility

All existing JavaScript code will continue to work. The TypeScript definitions are purely additive and don't change runtime behavior.

## 🎯 Benefits

### For Developers
- **Better IDE experience** with autocomplete and error detection
- **Safer refactoring** with compile-time type checking  
- **Self-documenting code** with interface definitions
- **Reduced runtime errors** through static analysis

### For the Project
- **Improved maintainability** with clear interfaces
- **Better onboarding** for new developers
- **Consistent API usage** across the codebase
- **Future-proofing** for TypeScript migration

## 📖 Further Reading

- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [ESM + TypeScript Guide](https://www.typescriptlang.org/docs/handbook/esm-node.html)
- [Declaration Files](https://www.typescriptlang.org/docs/handbook/declaration-files/introduction.html)
- [JSDoc Reference](https://jsdoc.app/)