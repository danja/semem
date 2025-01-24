export const MemoryTypes = {
    SHORT_TERM: 'short-term',
    LONG_TERM: 'long-term'
}

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