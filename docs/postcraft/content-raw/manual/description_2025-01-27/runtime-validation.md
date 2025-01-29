# Runtime Type Validation System

## Core Validation Functions

### Interaction Validation
```javascript
export function validateInteraction(interaction) {
    // Type check
    if (!interaction || typeof interaction !== 'object') {
        throw new TypeError('Interaction must be an object')
    }

    // Required fields
    const required = ['id', 'prompt', 'output', 'embedding']
    for (const field of required) {
        if (!(field in interaction)) {
            throw new TypeError(`Missing required field: ${field}`)
        }
    }

    // Embedding validation
    if (!Array.isArray(interaction.embedding)) {
        throw new TypeError('Embedding must be an array')
    }
    if (!interaction.embedding.every(x => typeof x === 'number' && !isNaN(x))) {
        throw new TypeError('Embedding must contain only valid numbers')
    }

    // Concepts validation
    if (interaction.concepts && !Array.isArray(interaction.concepts)) {
        throw new TypeError('Concepts must be an array')
    }
    if (interaction.concepts?.some(c => typeof c !== 'string')) {
        throw new TypeError('Concepts must be strings')
    }

    // Numeric fields
    if (typeof interaction.timestamp !== 'number') {
        throw new TypeError('Timestamp must be a number')
    }
    if (typeof interaction.accessCount !== 'number' || interaction.accessCount < 0) {
        throw new TypeError('AccessCount must be a non-negative number')
    }
    if (typeof interaction.decayFactor !== 'number' || 
        interaction.decayFactor < 0 || 
        interaction.decayFactor > 1) {
        throw new TypeError('DecayFactor must be between 0 and 1')
    }
}
```

### Configuration Validation
```javascript
export function validateConfig(config) {
    // LLM Provider validation
    if (!config.llmProvider) {
        throw new TypeError('LLMProvider is required')
    }
    const requiredMethods = [
        'generateEmbedding',
        'generateChat',
        'generateCompletion'
    ]
    for (const method of requiredMethods) {
        if (typeof config.llmProvider[method] !== 'function') {
            throw new TypeError(`LLMProvider must implement ${method}()`)
        }
    }

    // Model validation
    if (!config.chatModel || typeof config.chatModel !== 'string') {
        throw new TypeError('Invalid chat model specification')
    }
    if (!config.embeddingModel || typeof config.embeddingModel !== 'string') {
        throw new TypeError('Invalid embedding model specification')
    }

    // Optional config validation
    if (config.dimension !== undefined) {
        if (typeof config.dimension !== 'number' || config.dimension <= 0) {
            throw new TypeError('Dimension must be a positive number')
        }
    }

    // Nested config validation
    if (config.contextOptions) {
        validateContextOptions(config.contextOptions)
    }
    if (config.cacheOptions) {
        validateCacheOptions(config.cacheOptions)
    }
}
```

## Validation Integration

### Constructor Integration
```javascript
export class MemoryManager {
    constructor(config) {
        validateConfig(config)
        this.config = config
        
        // Initialize with validated config
        this.dimension = config.dimension || 1536
        this.llmProvider = config.llmProvider
        // ...
    }

    async addInteraction(interaction) {
        validateInteraction(interaction)
        // Process validated interaction
        await this.store.saveMemoryToHistory({
            shortTermMemory: [...this.store.shortTermMemory, interaction],
            longTermMemory: this.store.longTermMemory
        })
    }
}
```

### Method Guards
```javascript
export function methodGuard(target, propertyKey, descriptor) {
    const originalMethod = descriptor.value
    descriptor.value = function (...args) {
        // Validate this instance
        if (!(this instanceof target)) {
            throw new TypeError(`Method must be called on ${target.name} instance`)
        }
        
        // Validate initialization
        if (!this.initialized) {
            throw new Error('Instance not initialized')
        }
        
        return originalMethod.apply(this, args)
    }
    return descriptor
}

// Usage
class MemoryStore {
    @methodGuard
    async saveMemoryToHistory(memoryStore) {
        // Method is protected by validation
    }
}
```

## Type Guards

### Custom Type Guards
```javascript
export function isInteraction(value): value is Interaction {
    try {
        validateInteraction(value)
        return true
    } catch {
        return false
    }
}

export function isValidEmbedding(value): value is number[] {
    return Array.isArray(value) && 
           value.every(x => typeof x === 'number' && !isNaN(x))
}
```

### Guard Usage
```javascript
function processInteractions(items: unknown[]): Interaction[] {
    return items.filter(isInteraction)
}

function calculateSimilarity(embedding: unknown): number {
    if (!isValidEmbedding(embedding)) {
        throw new TypeError('Invalid embedding format')
    }
    // Process valid embedding
}
```

## Error Handling

### Validation Errors
```javascript
export class ValidationError extends Error {
    constructor(message, field) {
        super(message)
        this.name = 'ValidationError'
        this.field = field
    }
}

function validateWithContext(validation, value, context) {
    try {
        validation(value)
    } catch (error) {
        throw new ValidationError(
            `${context}: ${error.message}`,
            context
        )
    }
}
```

### Error Recovery
```javascript
async function safeValidation(value, validation, fallback) {
    try {
        validation(value)
        return value
    } catch (error) {
        logger.warn(`Validation failed: ${error.message}`)
        return fallback
    }
}
```

## Performance Considerations

1. Cache validation results where appropriate
2. Use TypeScript for compile-time checks
3. Only validate at system boundaries
4. Batch validations when possible
5. Profile validation overhead