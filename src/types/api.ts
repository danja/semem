// HTTP API Request/Response Types

export interface APIResponse<T = any> {
    success: boolean;
    data?: T;
    error?: string;
    message?: string;
    timestamp?: string;
    requestId?: string;
}

export interface ErrorResponse {
    success: false;
    error: string;
    message: string;
    requestId: string;
    timestamp: string;
    details?: any;
}

// Memory API Types
export interface StoreMemoryRequest {
    prompt: string;
    response: string;
    metadata?: Record<string, any>;
}

export interface StoreMemoryResponse {
    id: string;
    concepts: string[];
    timestamp: number;
    success: true;
}

export interface SearchMemoryRequest {
    query: string;
    threshold?: number;
    limit?: number;
}

export interface SearchMemoryResponse {
    results: MemorySearchResult[];
    count: number;
}

export interface MemorySearchResult {
    id: string;
    prompt: string;
    output: string;
    concepts: string[];
    timestamp: number;
    accessCount: number;
    similarity: number;
}

export interface GenerateEmbeddingRequest {
    text: string;
    model?: string;
}

export interface GenerateEmbeddingResponse {
    embedding: number[];
    model: string;
    dimension: number;
}

export interface ExtractConceptsRequest {
    text: string;
}

export interface ExtractConceptsResponse {
    concepts: string[];
    text: string;
}

// Chat API Types
export interface ChatRequest {
    prompt: string;
    conversationId?: string;
    useMemory?: boolean;
    temperature?: number;
}

export interface ChatResponse {
    response: string;
    conversationId: string;
    memoryIds: string[];
}

export interface CompletionRequest {
    prompt: string;
    max_tokens?: number;
    temperature?: number;
}

export interface CompletionResponse {
    completion: string;
    memoryIds: string[];
}

// Search API Types
export interface SearchContentRequest {
    query: string;
    limit?: number;
    types?: string;
    threshold?: number;
}

export interface SearchContentResponse {
    results: ContentSearchResult[];
    count: number;
}

export interface ContentSearchResult {
    id: string;
    title: string;
    content: string;
    similarity: number;
    type: string;
    metadata: Record<string, any>;
}

export interface IndexContentRequest {
    content: string;
    type: string;
    title?: string;
    metadata?: Record<string, any>;
}

export interface IndexContentResponse {
    id: string;
    success: true;
}

// System API Types
export interface HealthResponse {
    status: 'healthy' | 'degraded' | 'unhealthy';
    timestamp: number;
    uptime: number;
    version: string;
    components: Record<string, ComponentHealth>;
}

export interface ComponentHealth {
    status: 'healthy' | 'degraded' | 'unhealthy';
    message?: string;
    lastCheck?: number;
}

export interface MetricsResponse {
    timestamp: number;
    apiCount: number;
    memory?: ComponentMetrics;
    chat?: ComponentMetrics;
    search?: ComponentMetrics;
    system?: SystemMetrics;
}

export interface ComponentMetrics {
    operations: Record<string, OperationStats>;
    service?: string;
    indexSize?: number;
}

export interface OperationStats {
    count: number;
    errors: number;
    duration?: number;
}

export interface SystemMetrics {
    uptime: number;
    memoryUsage: NodeJS.MemoryUsage;
    cpuUsage: NodeJS.CpuUsage;
}

// Streaming Types
export interface StreamChunk {
    chunk?: string;
    done?: boolean;
    error?: string;
}

// Validation Types
export interface ValidationError {
    field: string;
    message: string;
    value?: any;
}

export interface ValidationResult {
    valid: boolean;
    errors: ValidationError[];
}

// Configuration API Types
export interface ConfigResponse {
    storage: {
        availableTypes: string[];
        current: string;
    };
    models: {
        chat: ModelConfig;
        embedding: ModelConfig;
    };
    sparqlEndpoints: PublicSPARQLEndpoint[];
    llmProviders: PublicLLMProvider[];
    defaultChatModel?: string;
    defaultEmbeddingModel?: string;
}

export interface PublicSPARQLEndpoint {
    label: string;
    urlBase: string;
    dataset: string;
    queryEndpoint: string;
    updateEndpoint: string;
    auth?: {
        user: string;
        // password excluded for security
    };
}

export interface PublicLLMProvider {
    type: string;
    implementation?: string;
    capabilities: string[];
    description: string;
    priority: number;
    chatModel?: string;
    embeddingModel?: string;
    // apiKey excluded for security
}

// Request Context Types
export interface RequestContext {
    id: string;
    timestamp: number;
    user?: {
        id: string;
        permissions: string[];
    };
    apiClient?: {
        key: string;
        timestamp: number;
    };
}

// Middleware Types
export interface AuthenticatedRequest extends Express.Request {
    id: string;
    user?: RequestContext['user'];
    apiClient?: RequestContext['apiClient'];
}

// Express types extension
declare global {
    namespace Express {
        interface Request {
            id?: string;
            user?: RequestContext['user'];
            apiClient?: RequestContext['apiClient'];
        }
    }
}