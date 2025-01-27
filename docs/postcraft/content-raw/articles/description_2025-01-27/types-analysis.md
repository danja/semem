# Type System Analysis

## Overview
The `src/types` directory contains both TypeScript (.ts) and JavaScript (.js) type definitions, providing type safety through TypeScript and runtime type checking through JavaScript.

## MemoryTypes.ts
Core type definitions for memory operations.

### Provider Interfaces
```typescript
export interface LLMProvider {
    generateEmbedding(model: string, input: string): Promise<number[]>
    generateChat(model: string, messages: ChatMessage[], options?: Record<string, any>): Promise<string>
    generateCompletion(model: string, prompt: string, options?: Record<string, any>): Promise<string>
}

export interface ChatMessage {
    role: 'system' | 'user' | 'assistant'
    content: string
}
```

### Configuration Types
```typescript
export interface CacheOptions {
    maxSize: number
    ttl: number
}

export interface ContextOptions {
    maxTokens: number
    overlapRatio?: number
}

export interface MemoryConfig {
    llmProvider: LLMProvider
    chatModel?: string
    embeddingModel?: string
    storage?: StorageProvider
    dimension?: number
    contextOptions?: ContextOptions
    cacheOptions?: CacheOptions
}
```

### Storage Types
```typescript
export interface StorageProvider {
    loadHistory(): Promise<[Interaction[], Interaction[]]>
    saveMemoryToHistory(store: MemoryStore): Promise<void>
    close?(): Promise<void>
}

export interface MemoryStore {
    shortTermMemory: Interaction[]
    longTermMemory: Interaction[]
    embeddings: number[][]
    timestamps: number[]
    accessCounts: number[]
    conceptsList: string[][]
}
```

### Data Types
```typescript
export interface Interaction {
    id: string
    prompt: string
    output: string
    embedding: number[]
    timestamp: number
    accessCount: number
    concepts: string[]
    decayFactor: number
}

export enum MemoryType {
    ShortTerm = 'short-term',
    LongTerm = 'long-term'
}
```

## MemoryTypes.js
Runtime type checking and validation.

### Type Constructors
```javascript
export class Interaction {
    constructor({
        id,
        prompt,
        output,
        embedding,
        timestamp = Date.now(),
        accessCount = 1,
        concepts = [],
        decayFactor = 1.0
    }) {
        this.id = id
        this.prompt = prompt
        this.output = output
        this.embedding = embedding
        this.timestamp = timestamp
        this.accessCount = accessCount
        this.concepts = concepts
        this.decayFactor = decayFactor
    }
}

export class MemoryConfig {
    constructor({
        llmProvider,
        chatModel = 'qwen2:1.5b',
        embeddingModel = 'nomic-embed-text',
        storage = null,
        dimension = 1536,
        contextOptions = { maxTokens: 8192 },
        cacheOptions = { maxSize: 1000, ttl: 3600000 }
    }) {
        this.llmProvider = llmProvider
        this.chatModel = chatModel
        this.embeddingModel = embeddingModel
        this.storage = storage
        this.dimension = dimension
        this.contextOptions = contextOptions
        this.cacheOptions = cacheOptions
    }
}
```

### Constants
```javascript
export const MemoryTypes = {
    SHORT_TERM: 'short-term',
    LONG_TERM: 'long-term'
}
```

## Usage Patterns

### Type Validation
```javascript
// Runtime type checking
function validateInteraction(interaction) {
    if (!(interaction instanceof Interaction)) {
        throw new TypeError('Expected Interaction instance')
    }
    
    if (!Array.isArray(interaction.embedding) || 
        !interaction.embedding.every(x => typeof x === 'number')) {
        throw new TypeError('Invalid embedding format')
    }
    
    if (!Array.isArray(interaction.concepts) || 
        !interaction.concepts.every(x => typeof x === 'string')) {
        throw new TypeError('Invalid concepts format')
    }
}

// Configuration validation
function validateConfig(config) {
    if (!(config instanceof MemoryConfig)) {
        throw new TypeError('Expected MemoryConfig instance')
    }
    
    if (!config.llmProvider || 
        typeof config.llmProvider.generateChat !== 'function') {
        throw new TypeError('Invalid LLM provider')
    }
}
```

### TypeScript Integration
```typescript
// Type-safe API methods
async function addInteraction(interaction: Interaction): Promise<void> {
    validateInteraction(interaction)  // Runtime check
    await this.store.saveMemoryToHistory({
        shortTermMemory: [...this.store.shortTermMemory, interaction],
        longTermMemory: this.store.longTermMemory
    })
}

// Type-safe configuration
function createMemoryManager(config: MemoryConfig): MemoryManager {
    validateConfig(config)  // Runtime check
    return new MemoryManager(config)
}
```

## Best Practices

1. Always use TypeScript interfaces for API boundaries
2. Include runtime type checking for critical operations
3. Use enums for fixed value sets
4. Provide sensible defaults in constructors
5. Keep type definitions synchronized between .ts and .js files
6. Document type constraints and validation rules
7. Use type guards for runtime safety

## Type Extensions
When adding new functionality:
1. Add TypeScript interface
2. Add corresponding JavaScript class
3. Update existing interfaces if needed
4. Add validation functions
5. Update documentation