export interface LLMProvider {
    generateEmbedding(model: string, input: string): Promise<number[]>
    generateChat(model: string, messages: ChatMessage[], options?: Record<string, any>): Promise<string>
    generateCompletion(model: string, prompt: string, options?: Record<string, any>): Promise<string>
}

export interface ChatMessage {
    role: 'system' | 'user' | 'assistant'
    content: string
}

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