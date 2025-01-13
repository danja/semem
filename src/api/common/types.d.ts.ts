import { EventEmitter } from 'events';

export interface APIConfig {
    storage?: StorageConfig;
    models?: ModelConfig;
    metrics?: MetricsConfig;
}

export interface StorageConfig {
    type: 'memory' | 'json' | 'sparql';
    options: {
        path?: string;
        endpoint?: string;
        graphName?: string;
    };
}

export interface ModelConfig {
    chat: {
        provider: 'ollama' | 'openai';
        model: string;
        options?: Record<string, any>;
    };
    embedding: {
        provider: 'ollama' | 'openai';
        model: string;
        options?: Record<string, any>;
    };
}

export interface MetricsConfig {
    enabled: boolean;
    interval?: number;
    storageEndpoint?: string;
}

export interface Interaction {
    id: string;
    prompt: string;
    output: string;
    embedding: number[];
    timestamp: number;
    accessCount: number;
    concepts: string[];
    decayFactor: number;
}

export interface Query {
    text?: string;
    concepts?: string[];
    similarity?: number;
    limit?: number;
    offset?: number;
}

export interface MetricEvent {
    name: string;
    value: number | string | boolean;
    timestamp: number;
    labels?: Record<string, string>;
}

export interface APIMetrics {
    timestamp: number;
    status: 'active' | 'inactive';
    memoryUsage: NodeJS.MemoryUsage;
    uptime: number;
}

export declare class BaseAPI extends EventEmitter {
    protected config: APIConfig;
    protected logger: any;
    protected initialized: boolean;

    constructor(config?: APIConfig);
    
    initialize(): Promise<void>;
    shutdown(): Promise<void>;
    
    executeOperation(operation: string, params: Record<string, any>): Promise<any>;
    storeInteraction(interaction: Interaction): Promise<void>;
    retrieveInteractions(query: Query): Promise<Interaction[]>;
    getMetrics(): Promise<APIMetrics>;

    protected _validateParams(params: unknown, schema: unknown): void;
    protected _emitMetric(name: string, value: MetricEvent['value']): void;
}

export declare class APIRegistry {
    private static instance: APIRegistry;
    private apis: Map<string, BaseAPI>;
    private metrics: Map<string, MetricEvent>;
    
    register(name: string, apiClass: typeof BaseAPI, config?: APIConfig): Promise<BaseAPI>;
    get(name: string): BaseAPI;
    unregister(name: string): Promise<void>;
    getAll(): Map<string, BaseAPI>;
    getMetrics(): Record<string, any>;
    shutdownAll(): Promise<void>;
}

// CLI Types
export interface CommandOptions {
    operation: string;
    params: Record<string, any>;
    format?: 'text' | 'json';
    color?: boolean;
}

// HTTP Types
export interface APIResponse<T = any> {
    success: boolean;
    data?: T;
    error?: string;
    metadata?: {
        timestamp: number;
        version: string;
    };
}

// REPL Types
export interface REPLContext {
    api: BaseAPI;
    history: string[];
    mode: 'chat' | 'rdf';
}

// Feature Set Types
export interface SelfieMetrics {
    storage: {
        size: number;
        operations: number;
        latency: number;
    };
    performance: {
        memory: NodeJS.MemoryUsage;
        cpu: number;
        uptime: number;
    };
    errors: Array<{
        type: string;
        count: number;
        lastOccurred: number;
    }>;
}