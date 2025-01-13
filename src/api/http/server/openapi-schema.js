export default {
    openapi: '3.0.0',
    info: {
        title: 'Semem API',
        version: '1.0.0',
        description: 'Semantic Memory Management System API'
    },
    servers: [
        {
            url: 'http://localhost:3000',
            description: 'Development server'
        }
    ],
    components: {
        schemas: {
            Interaction: {
                type: 'object',
                required: ['prompt', 'output', 'embedding'],
                properties: {
                    id: { type: 'string', format: 'uuid' },
                    prompt: { type: 'string' },
                    output: { type: 'string' },
                    embedding: {
                        type: 'array',
                        items: { type: 'number' }
                    },
                    timestamp: { type: 'integer' },
                    accessCount: { type: 'integer' },
                    concepts: {
                        type: 'array',
                        items: { type: 'string' }
                    },
                    decayFactor: { type: 'number' }
                }
            },
            Query: {
                type: 'object',
                properties: {
                    text: { type: 'string' },
                    concepts: {
                        type: 'array',
                        items: { type: 'string' }
                    },
                    similarity: { type: 'number', minimum: 0, maximum: 100 },
                    limit: { type: 'integer', minimum: 1 },
                    offset: { type: 'integer', minimum: 0 }
                }
            },
            APIResponse: {
                type: 'object',
                required: ['success'],
                properties: {
                    success: { type: 'boolean' },
                    data: { type: 'object' },
                    error: { type: 'string' },
                    metadata: {
                        type: 'object',
                        properties: {
                            timestamp: { type: 'integer' },
                            version: { type: 'string' }
                        }
                    }
                }
            },
            Metrics: {
                type: 'object',
                properties: {
                    timestamp: { type: 'integer' },
                    status: {
                        type: 'string',
                        enum: ['active', 'inactive']
                    },
                    memoryUsage: {
                        type: 'object',
                        properties: {
                            heapTotal: { type: 'number' },
                            heapUsed: { type: 'number' },
                            external: { type: 'number' }
                        }
                    },
                    uptime: { type: 'number' }
                }
            }
        },
        securitySchemes: {
            apiKey: {
                type: 'apiKey',
                in: 'header',
                name: 'X-API-Key'
            }
        }
    },
    paths: {
        '/api/chat': {
            post: {
                summary: 'Chat with the system',
                tags: ['Chat'],
                security: [{ apiKey: [] }],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['prompt'],
                                properties: {
                                    prompt: { type: 'string' },
                                    model: { type: 'string' },
                                    options: { type: 'object' }
                                }
                            }
                        }
                    }
                },
                responses: {
                    '200': {
                        description: 'Successful response',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/APIResponse' }
                            }
                        }
                    }
                }
            }
        },
        '/api/store': {
            post: {
                summary: 'Store an interaction',
                tags: ['Storage'],
                security: [{ apiKey: [] }],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: { $ref: '#/components/schemas/Interaction' }
                        }
                    }
                },
                responses: {
                    '200': {
                        description: 'Successfully stored',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/APIResponse' }
                            }
                        }
                    }
                }
            }
        },
        '/api/query': {
            get: {
                summary: 'Query stored interactions',
                tags: ['Storage'],
                security: [{ apiKey: [] }],
                parameters: [
                    {
                        name: 'text',
                        in: 'query',
                        schema: { type: 'string' }
                    },
                    {
                        name: 'concepts',
                        in: 'query',
                        schema: {
                            type: 'array',
                            items: { type: 'string' }
                        }
                    },
                    {
                        name: 'similarity',
                        in: 'query',
                        schema: { type: 'number' }
                    },
                    {
                        name: 'limit',
                        in: 'query',
                        schema: { type: 'integer' }
                    },
                    {
                        name: 'offset',
                        in: 'query',
                        schema: { type: 'integer' }
                    }
                ],
                responses: {
                    '200': {
                        description: 'Query results',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/APIResponse' }
                            }
                        }
                    }
                }
            }
        },
        '/api/metrics': {
            get: {
                summary: 'Get system metrics',
                tags: ['Monitoring'],
                security: [{ apiKey: [] }],
                responses: {
                    '200': {
                        description: 'System metrics',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/Metrics' }
                            }
                        }
                    }
                }
            }
        },
        '/health': {
            get: {
                summary: 'Health check',
                tags: ['Monitoring'],
                responses: {
                    '200': {
                        description: 'System health status',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        status: { type: 'string' },
                                        timestamp: { type: 'integer' },
                                        uptime: { type: 'number' }
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