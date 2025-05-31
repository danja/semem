// Core Interfaces
export interface LLMProvider {
    generateEmbedding(model: string, input: string): Promise<number[]>;
    generateChat(model: string, messages: ChatMessage[], options?: LLMOptions): Promise<string>;
    generateCompletion(model: string, prompt: string, options?: LLMOptions): Promise<string>;
    initialize?(): Promise<void>;
    dispose?(): Promise<void>;
}

export interface StorageProvider {
    loadHistory(): Promise<[Interaction[], Interaction[]]>;
    saveMemoryToHistory(store: MemoryStore): Promise<void>;
    beginTransaction(): Promise<void>;
    commitTransaction(): Promise<void>;
    rollbackTransaction(): Promise<void>;
    verify(): Promise<boolean>;
    close(): Promise<void>;
}

export interface APIProvider {
    initialize(): Promise<void>;
    executeOperation(operation: string, params: Record<string, any>): Promise<any>;
    getMetrics(): Promise<APIMetrics>;
    shutdown(): Promise<void>;
    initialized: boolean;
}

// Data Types
export interface Interaction {
    id: string;
    prompt: string;
    output: string;
    embedding: number[];
    timestamp: number;
    accessCount: number;
    concepts: string[];
    decayFactor: number;
    metadata?: Record<string, any>;
}

export interface MemoryStore {
    shortTermMemory: Interaction[];
    longTermMemory: Interaction[];
    embeddings: number[][];
    timestamps: number[];
    accessCounts: number[];
    conceptsList: string[][];
}

export interface ChatMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

// Configuration Types
export interface ConfigDefaults {
    storage: StorageConfig;
    models: ModelsConfig;
    memory: MemoryConfig;
    sparqlEndpoints: SPARQLEndpoint[];
}

export interface StorageConfig {
    type: 'memory' | 'json' | 'sparql' | 'inmemory';
    options: {
        path?: string;
        endpoint?: string;
        apiKey?: string;
        timeout?: number;
        graphName?: string;
        user?: string;
        password?: string;
    };
}

export interface ModelsConfig {
    chat: ModelConfig;
    embedding: ModelConfig;
}

export interface ModelConfig {
    provider: string;
    model: string;
    options?: Record<string, any>;
}

export interface MemoryConfig {
    dimension: number;
    similarityThreshold: number;
    contextWindow: number;
    decayRate: number;
}

export interface SPARQLEndpoint {
    label: string;
    user: string;
    password: string;
    urlBase: string;
    dataset: string;
    query: string;
    update: string;
    upload?: string;
    gspRead?: string;
    gspWrite?: string;
}

// API Types
export interface APIMetrics {
    timestamp: number;
    status: 'active' | 'inactive';
    memoryUsage: NodeJS.MemoryUsage;
    uptime: number;
    operations?: Record<string, OperationMetrics>;
}

export interface OperationMetrics {
    count: number;
    errors: number;
    duration?: number;
    latency?: number;
}

export interface LLMOptions {
    temperature?: number;
    max_tokens?: number;
    top_p?: number;
    [key: string]: any;
}

// Handler Types
export interface EmbeddingHandlerConfig {
    provider: LLMProvider;
    model: string;
    dimension: number;
    cacheManager?: CacheManager;
}

export interface CacheManager {
    get(key: string): any;
    set(key: string, value: any): void;
    dispose(): void;
}

// Context Types
export interface ContextOptions {
    maxTokens: number;
    maxTimeWindow?: number;
    relevanceThreshold?: number;
    maxContextSize?: number;
    overlapRatio?: number;
}

export interface ContextWindow {
    text: string;
    start: number;
    end: number;
    tokenEstimate?: number;
}

// Search Types
export interface SearchResult {
    uri: string;
    title: string;
    content: string;
    score: number;
    type?: string;
    metadata?: Record<string, any>;
}

export interface SearchOptions {
    threshold?: number;
    limit?: number;
    types?: string[];
}

// Error Types
export class SememError extends Error {
    constructor(
        message: string,
        public readonly code: string,
        public readonly details?: any
    ) {
        super(message);
        this.name = 'SememError';
    }
}

export class EmbeddingError extends SememError {
    constructor(message: string, details?: any) {
        super(message, 'EMBEDDING_ERROR', details);
        this.name = 'EmbeddingError';
    }
}

export class StorageError extends SememError {
    constructor(message: string, details?: any) {
        super(message, 'STORAGE_ERROR', details);
        this.name = 'StorageError';
    }
}

export class ConfigError extends SememError {
    constructor(message: string, details?: any) {
        super(message, 'CONFIG_ERROR', details);
        this.name = 'ConfigError';
    }
}

// Utility Types
export type RetrievalResult = {
    similarity: number;
    interaction: Interaction;
    concepts: string[];
};

export type Vector = number[];

export type PromptTemplate = {
    chat: (system: string, context: string, query: string) => ChatMessage[];
    completion: (context: string, query: string) => string;
    extractConcepts: (text: string) => string;
};

// Factory Types
export interface ConnectorFactory {
    create(type: string, config: any): Promise<LLMProvider>;
}

export interface StoreFactory {
    create(type: string, config: any): Promise<StorageProvider>;
}