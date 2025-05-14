export default {
    openapi: '3.0.3',
    info: {
        title: 'Semem API',
        version: '1.0.0',
        description: 'Semantic Memory Management System API',
        license: {
            name: 'MIT'
        }
    },
    servers: [
        {
            url: 'https://api.example.com/v1',
            description: 'Production server'
        },
        {
            url: 'http://localhost:3000/v1',
            description: 'Development server'
        }
    ],
    components: {
        securitySchemes: {
            apiKey: {
                type: 'apiKey',
                in: 'header',
                name: 'X-API-Key'
            }
        },
        schemas: {
            Error: {
                type: 'object',
                properties: {
                    success: {
                        type: 'boolean',
                        example: false
                    },
                    error: {
                        type: 'string',
                        example: 'validation_error'
                    },
                    message: {
                        type: 'string',
                        example: 'Invalid input provided'
                    },
                    requestId: {
                        type: 'string',
                        example: 'req_123456'
                    },
                    timestamp: {
                        type: 'string',
                        format: 'date-time'
                    },
                    details: {
                        type: 'object'
                    }
                },
                required: ['success', 'error', 'message']
            },
            Memory: {
                type: 'object',
                properties: {
                    id: {
                        type: 'string',
                        format: 'uuid'
                    },
                    prompt: {
                        type: 'string'
                    },
                    output: {
                        type: 'string'
                    },
                    concepts: {
                        type: 'array',
                        items: {
                            type: 'string'
                        }
                    },
                    timestamp: {
                        type: 'integer',
                        format: 'int64'
                    },
                    accessCount: {
                        type: 'integer'
                    },
                    similarity: {
                        type: 'number',
                        format: 'float'
                    }
                },
                required: ['id', 'prompt', 'output']
            },
            EmbeddingResult: {
                type: 'object',
                properties: {
                    embedding: {
                        type: 'array',
                        items: {
                            type: 'number'
                        }
                    },
                    model: {
                        type: 'string'
                    },
                    dimension: {
                        type: 'integer'
                    }
                },
                required: ['embedding', 'dimension']
            },
            ConceptResult: {
                type: 'object',
                properties: {
                    concepts: {
                        type: 'array',
                        items: {
                            type: 'string'
                        }
                    },
                    text: {
                        type: 'string'
                    }
                },
                required: ['concepts']
            },
            ChatResponse: {
                type: 'object',
                properties: {
                    response: {
                        type: 'string'
                    },
                    memoryIds: {
                        type: 'array',
                        items: {
                            type: 'string',
                            format: 'uuid'
                        }
                    },
                    conversationId: {
                        type: 'string',
                        format: 'uuid'
                    }
                },
                required: ['response']
            },
            SearchResult: {
                type: 'object',
                properties: {
                    results: {
                        type: 'array',
                        items: {
                            $ref: '#/components/schemas/Memory'
                        }
                    },
                    count: {
                        type: 'integer'
                    }
                },
                required: ['results', 'count']
            },
            ContentSearchResult: {
                type: 'object',
                properties: {
                    results: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                id: {
                                    type: 'string'
                                },
                                title: {
                                    type: 'string'
                                },
                                content: {
                                    type: 'string'
                                },
                                similarity: {
                                    type: 'number'
                                },
                                type: {
                                    type: 'string'
                                },
                                metadata: {
                                    type: 'object'
                                }
                            }
                        }
                    },
                    count: {
                        type: 'integer'
                    }
                },
                required: ['results', 'count']
            },
            SuccessResponse: {
                type: 'object',
                properties: {
                    success: {
                        type: 'boolean',
                        example: true
                    },
                    id: {
                        type: 'string',
                        format: 'uuid'
                    }
                },
                required: ['success']
            },
            APIResponse: {
                type: 'object',
                properties: {
                    success: {
                        type: 'boolean'
                    },
                    data: {
                        type: 'object'
                    },
                    error: {
                        type: 'string'
                    },
                    message: {
                        type: 'string'
                    },
                    timestamp: {
                        type: 'string',
                        format: 'date-time'
                    }
                },
                required: ['success']
            }
        }
    },
    security: [
        {
            apiKey: []
        }
    ],
    paths: {
        '/memory': {
            post: {
                summary: 'Store an interaction in memory',
                description: 'Stores a prompt/response pair with associated metadata in semantic memory',
                operationId: 'storeMemory',
                tags: ['Memory'],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    prompt: {
                                        type: 'string',
                                        description: 'The user input or query'
                                    },
                                    response: {
                                        type: 'string',
                                        description: 'The response or answer'
                                    },
                                    metadata: {
                                        type: 'object',
                                        description: 'Additional metadata for the interaction'
                                    }
                                },
                                required: ['prompt', 'response']
                            }
                        }
                    }
                },
                responses: {
                    '201': {
                        description: 'Memory stored successfully',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        id: {
                                            type: 'string',
                                            format: 'uuid'
                                        },
                                        success: {
                                            type: 'boolean'
                                        }
                                    }
                                }
                            }
                        }
                    },
                    '400': {
                        description: 'Invalid request',
                        content: {
                            'application/json': {
                                schema: {
                                    $ref: '#/components/schemas/Error'
                                }
                            }
                        }
                    },
                    '401': {
                        description: 'Unauthorized',
                        content: {
                            'application/json': {
                                schema: {
                                    $ref: '#/components/schemas/Error'
                                }
                            }
                        }
                    }
                }
            }
        },
        '/memory/search': {
            get: {
                summary: 'Search memory based on semantic similarity',
                description: 'Retrieves memories that are semantically similar to the query',
                operationId: 'searchMemory',
                tags: ['Memory'],
                parameters: [
                    {
                        name: 'query',
                        in: 'query',
                        description: 'Text to search for in memory',
                        required: true,
                        schema: {
                            type: 'string'
                        }
                    },
                    {
                        name: 'threshold',
                        in: 'query',
                        description: 'Similarity threshold (0.0-1.0)',
                        required: false,
                        schema: {
                            type: 'number',
                            minimum: 0,
                            maximum: 1,
                            default: 0.7
                        }
                    },
                    {
                        name: 'limit',
                        in: 'query',
                        description: 'Maximum number of results to return',
                        required: false,
                        schema: {
                            type: 'integer',
                            minimum: 1,
                            maximum: 100,
                            default: 10
                        }
                    }
                ],
                responses: {
                    '200': {
                        description: 'Search results',
                        content: {
                            'application/json': {
                                schema: {
                                    $ref: '#/components/schemas/SearchResult'
                                }
                            }
                        }
                    },
                    '400': {
                        description: 'Invalid request',
                        content: {
                            'application/json': {
                                schema: {
                                    $ref: '#/components/schemas/Error'
                                }
                            }
                        }
                    },
                    '401': {
                        description: 'Unauthorized',
                        content: {
                            'application/json': {
                                schema: {
                                    $ref: '#/components/schemas/Error'
                                }
                            }
                        }
                    }
                }
            }
        },
        '/memory/embedding': {
            post: {
                summary: 'Generate an embedding vector for text',
                description: 'Creates a vector embedding representation of the provided text',
                operationId: 'generateEmbedding',
                tags: ['Memory'],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    text: {
                                        type: 'string',
                                        description: 'Text to generate embedding for'
                                    },
                                    model: {
                                        type: 'string',
                                        description: 'Embedding model to use (default model will be used if not specified)'
                                    }
                                },
                                required: ['text']
                            }
                        }
                    }
                },
                responses: {
                    '200': {
                        description: 'Generated embedding',
                        content: {
                            'application/json': {
                                schema: {
                                    $ref: '#/components/schemas/EmbeddingResult'
                                }
                            }
                        }
                    },
                    '400': {
                        description: 'Invalid request',
                        content: {
                            'application/json': {
                                schema: {
                                    $ref: '#/components/schemas/Error'
                                }
                            }
                        }
                    },
                    '401': {
                        description: 'Unauthorized',
                        content: {
                            'application/json': {
                                schema: {
                                    $ref: '#/components/schemas/Error'
                                }
                            }
                        }
                    }
                }
            }
        },
        '/memory/concepts': {
            post: {
                summary: 'Extract concepts from text',
                description: 'Analyzes text to extract key concepts using LLM',
                operationId: 'extractConcepts',
                tags: ['Memory'],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    text: {
                                        type: 'string',
                                        description: 'Text to extract concepts from'
                                    }
                                },
                                required: ['text']
                            }
                        }
                    }
                },
                responses: {
                    '200': {
                        description: 'Extracted concepts',
                        content: {
                            'application/json': {
                                schema: {
                                    $ref: '#/components/schemas/ConceptResult'
                                }
                            }
                        }
                    },
                    '400': {
                        description: 'Invalid request',
                        content: {
                            'application/json': {
                                schema: {
                                    $ref: '#/components/schemas/Error'
                                }
                            }
                        }
                    },
                    '401': {
                        description: 'Unauthorized',
                        content: {
                            'application/json': {
                                schema: {
                                    $ref: '#/components/schemas/Error'
                                }
                            }
                        }
                    }
                }
            }
        },
        '/chat': {
            post: {
                summary: 'Generate a chat response using memory',
                description: 'Generates a response to a prompt, using semantic memory for context',
                operationId: 'generateChatResponse',
                tags: ['Chat'],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    prompt: {
                                        type: 'string',
                                        description: 'The user input or query'
                                    },
                                    conversationId: {
                                        type: 'string',
                                        format: 'uuid',
                                        description: 'Optional ID to maintain conversation history'
                                    },
                                    useMemory: {
                                        type: 'boolean',
                                        description: 'Whether to use memory for context',
                                        default: true
                                    },
                                    temperature: {
                                        type: 'number',
                                        description: 'Temperature for response generation (0.0-2.0)',
                                        minimum: 0,
                                        maximum: 2,
                                        default: 0.7
                                    }
                                },
                                required: ['prompt']
                            }
                        }
                    }
                },
                responses: {
                    '200': {
                        description: 'Generated response',
                        content: {
                            'application/json': {
                                schema: {
                                    $ref: '#/components/schemas/ChatResponse'
                                }
                            }
                        }
                    },
                    '400': {
                        description: 'Invalid request',
                        content: {
                            'application/json': {
                                schema: {
                                    $ref: '#/components/schemas/Error'
                                }
                            }
                        }
                    },
                    '401': {
                        description: 'Unauthorized',
                        content: {
                            'application/json': {
                                schema: {
                                    $ref: '#/components/schemas/Error'
                                }
                            }
                        }
                    }
                }
            }
        },
        '/chat/stream': {
            post: {
                summary: 'Stream a chat response using memory',
                description: 'Streams a response to a prompt, using semantic memory for context',
                operationId: 'streamChatResponse',
                tags: ['Chat'],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    prompt: {
                                        type: 'string',
                                        description: 'The user input or query'
                                    },
                                    conversationId: {
                                        type: 'string',
                                        format: 'uuid',
                                        description: 'Optional ID to maintain conversation history'
                                    },
                                    useMemory: {
                                        type: 'boolean',
                                        description: 'Whether to use memory for context',
                                        default: true
                                    },
                                    temperature: {
                                        type: 'number',
                                        description: 'Temperature for response generation (0.0-2.0)',
                                        minimum: 0,
                                        maximum: 2,
                                        default: 0.7
                                    }
                                },
                                required: ['prompt']
                            }
                        }
                    }
                },
                responses: {
                    '200': {
                        description: 'Streamed response',
                        content: {
                            'text/event-stream': {
                                schema: {
                                    type: 'string'
                                }
                            }
                        }
                    },
                    '400': {
                        description: 'Invalid request',
                        content: {
                            'application/json': {
                                schema: {
                                    $ref: '#/components/schemas/Error'
                                }
                            }
                        }
                    },
                    '401': {
                        description: 'Unauthorized',
                        content: {
                            'application/json': {
                                schema: {
                                    $ref: '#/components/schemas/Error'
                                }
                            }
                        }
                    }
                }
            }
        },
        '/completion': {
            post: {
                summary: 'Generate text completion with memory context',
                description: 'Generates a text completion using semantic memory for context',
                operationId: 'generateCompletion',
                tags: ['Chat'],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    prompt: {
                                        type: 'string',
                                        description: 'The text prompt to complete'
                                    },
                                    max_tokens: {
                                        type: 'integer',
                                        description: 'Maximum number of tokens to generate',
                                        default: 100
                                    },
                                    temperature: {
                                        type: 'number',
                                        description: 'Temperature for completion generation (0.0-2.0)',
                                        minimum: 0,
                                        maximum: 2,
                                        default: 0.7
                                    }
                                },
                                required: ['prompt']
                            }
                        }
                    }
                },
                responses: {
                    '200': {
                        description: 'Generated completion',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        completion: {
                                            type: 'string'
                                        },
                                        memoryIds: {
                                            type: 'array',
                                            items: {
                                                type: 'string',
                                                format: 'uuid'
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    },
                    '400': {
                        description: 'Invalid request',
                        content: {
                            'application/json': {
                                schema: {
                                    $ref: '#/components/schemas/Error'
                                }
                            }
                        }
                    },
                    '401': {
                        description: 'Unauthorized',
                        content: {
                            'application/json': {
                                schema: {
                                    $ref: '#/components/schemas/Error'
                                }
                            }
                        }
                    }
                }
            }
        },
        '/search': {
            get: {
                summary: 'Search content using semantic similarity',
                description: 'Performs semantic search over indexed content',
                operationId: 'searchContent',
                tags: ['Search'],
                parameters: [
                    {
                        name: 'query',
                        in: 'query',
                        description: 'Text to search for',
                        required: true,
                        schema: {
                            type: 'string'
                        }
                    },
                    {
                        name: 'limit',
                        in: 'query',
                        description: 'Maximum number of results to return',
                        required: false,
                        schema: {
                            type: 'integer',
                            minimum: 1,
                            maximum: 100,
                            default: 5
                        }
                    },
                    {
                        name: 'types',
                        in: 'query',
                        description: 'Content types to include in search (comma-separated)',
                        required: false,
                        schema: {
                            type: 'string'
                        }
                    },
                    {
                        name: 'threshold',
                        in: 'query',
                        description: 'Similarity threshold (0.0-1.0)',
                        required: false,
                        schema: {
                            type: 'number',
                            minimum: 0,
                            maximum: 1,
                            default: 0.7
                        }
                    }
                ],
                responses: {
                    '200': {
                        description: 'Search results',
                        content: {
                            'application/json': {
                                schema: {
                                    $ref: '#/components/schemas/ContentSearchResult'
                                }
                            }
                        }
                    },
                    '400': {
                        description: 'Invalid request',
                        content: {
                            'application/json': {
                                schema: {
                                    $ref: '#/components/schemas/Error'
                                }
                            }
                        }
                    },
                    '401': {
                        description: 'Unauthorized',
                        content: {
                            'application/json': {
                                schema: {
                                    $ref: '#/components/schemas/Error'
                                }
                            }
                        }
                    }
                }
            }
        },
        '/index': {
            post: {
                summary: 'Index content for search',
                description: 'Adds content to the search index with embeddings',
                operationId: 'indexContent',
                tags: ['Search'],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    content: {
                                        type: 'string',
                                        description: 'Content to index'
                                    },
                                    type: {
                                        type: 'string',
                                        description: 'Type of content (article, document, etc.)'
                                    },
                                    title: {
                                        type: 'string',
                                        description: 'Title of the content'
                                    },
                                    metadata: {
                                        type: 'object',
                                        description: 'Additional metadata for the content'
                                    }
                                },
                                required: ['content', 'type']
                            }
                        }
                    }
                },
                responses: {
                    '201': {
                        description: 'Content indexed successfully',
                        content: {
                            'application/json': {
                                schema: {
                                    $ref: '#/components/schemas/SuccessResponse'
                                }
                            }
                        }
                    },
                    '400': {
                        description: 'Invalid request',
                        content: {
                            'application/json': {
                                schema: {
                                    $ref: '#/components/schemas/Error'
                                }
                            }
                        }
                    },
                    '401': {
                        description: 'Unauthorized',
                        content: {
                            'application/json': {
                                schema: {
                                    $ref: '#/components/schemas/Error'
                                }
                            }
                        }
                    }
                }
            }
        },
        '/metrics': {
            get: {
                summary: 'Get API metrics',
                description: 'Returns metrics about API usage and performance',
                operationId: 'getMetrics',
                tags: ['System'],
                responses: {
                    '200': {
                        description: 'API metrics',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: {
                                            type: 'boolean'
                                        },
                                        data: {
                                            type: 'object',
                                            properties: {
                                                timestamp: {
                                                    type: 'integer'
                                                },
                                                memory: {
                                                    type: 'object'
                                                },
                                                chat: {
                                                    type: 'object'
                                                },
                                                search: {
                                                    type: 'object'
                                                },
                                                system: {
                                                    type: 'object'
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    },
                    '401': {
                        description: 'Unauthorized',
                        content: {
                            'application/json': {
                                schema: {
                                    $ref: '#/components/schemas/Error'
                                }
                            }
                        }
                    }
                }
            }
        },
        '/health': {
            get: {
                summary: 'Health check',
                description: 'Returns the health status of the API',
                operationId: 'healthCheck',
                tags: ['System'],
                responses: {
                    '200': {
                        description: 'Health status',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        status: {
                                            type: 'string',
                                            enum: ['healthy', 'degraded', 'unhealthy']
                                        },
                                        timestamp: {
                                            type: 'integer'
                                        },
                                        uptime: {
                                            type: 'number'
                                        },
                                        version: {
                                            type: 'string'
                                        },
                                        components: {
                                            type: 'object'
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
};