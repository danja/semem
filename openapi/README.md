# Semem API OpenAPI Specification

This directory contains the complete OpenAPI 3.0.3 specification for the Semem API, organized following OpenAPI best practices and conventions.

## Structure

```
openapi/
├── openapi.yaml                 # Main OpenAPI specification file
├── components/                  # Reusable components
│   ├── schemas/                # Data schemas and models
│   │   ├── index.yaml         # Main schema definitions
│   │   ├── service.yaml       # Service-specific schemas
│   │   └── metrics.yaml       # Metrics schemas
│   ├── parameters/            # Reusable parameters
│   │   └── index.yaml         # Parameter definitions
│   ├── responses/             # Reusable responses
│   │   └── index.yaml         # Response definitions
│   ├── examples/              # Example data
│   │   └── index.yaml         # API examples
│   └── securitySchemes/       # Authentication schemes
│       └── index.yaml         # Security definitions
└── paths/                     # API endpoint definitions
    ├── system/                # System endpoints
    │   ├── health.yaml
    │   ├── config.yaml
    │   ├── services.yaml
    │   └── metrics.yaml
    ├── memory/                # Memory API endpoints
    │   ├── store.yaml
    │   ├── search.yaml
    │   ├── embedding.yaml
    │   └── concepts.yaml
    ├── chat/                  # Chat API endpoints
    │   ├── completion.yaml
    │   ├── stream.yaml
    │   └── text-completion.yaml
    ├── search/                # Search API endpoints
    │   ├── search.yaml
    │   └── index.yaml
    ├── ragno/                 # Knowledge Graph API endpoints
    │   ├── decompose.yaml
    │   ├── search.yaml
    │   ├── stats.yaml
    │   ├── entities.yaml
    │   ├── export.yaml
    │   ├── enrich.yaml
    │   ├── communities.yaml
    │   └── pipeline.yaml
    ├── zpt/                   # ZPT Navigation API endpoints
    │   ├── navigate.yaml
    │   ├── preview.yaml
    │   ├── options.yaml
    │   ├── schema.yaml
    │   └── health.yaml
    └── unified-search/        # Unified Search API endpoints
        ├── unified.yaml
        ├── analyze.yaml
        ├── services.yaml
        └── strategies.yaml
```

## Features

This OpenAPI specification provides comprehensive documentation for:

### API Services
- **Memory API**: Semantic memory storage and retrieval
- **Chat API**: Conversational AI with memory integration
- **Search API**: Content search and indexing
- **Ragno API**: Knowledge graph operations and entity management
- **ZPT API**: Zero-Point Traversal corpus navigation
- **Unified Search API**: Cross-service intelligent search

### System Endpoints
- Health monitoring and status checks
- Configuration management
- Service discovery
- Metrics and monitoring

### Authentication
- API key-based authentication
- Configurable for development and production environments
- Rate limiting and security measures

### Comprehensive Documentation
- Detailed endpoint descriptions
- Request/response schemas with validation
- Extensive examples for all operations
- Error handling and status codes
- Parameter documentation with constraints

## Usage

### Viewing the Documentation

1. **Swagger UI**: Use any OpenAPI-compatible tool to view the specification
   ```bash
   # Using npx swagger-ui-serve (if available)
   npx swagger-ui-serve openapi.yaml
   ```

2. **Online Tools**: 
   - Upload `openapi.yaml` to [Swagger Editor](https://editor.swagger.io/)
   - Use [Redoc](https://redocly.github.io/redoc/) for alternative documentation

3. **VS Code**: Install the OpenAPI extension for inline documentation viewing

### Code Generation

Generate client libraries for various programming languages:

```bash
# Install OpenAPI Generator
npm install -g @openapitools/openapi-generator-cli

# Generate JavaScript client
openapi-generator-cli generate -i openapi.yaml -g javascript -o ./clients/javascript

# Generate Python client
openapi-generator-cli generate -i openapi.yaml -g python -o ./clients/python

# Generate TypeScript client
openapi-generator-cli generate -i openapi.yaml -g typescript-axios -o ./clients/typescript
```

### Validation

Validate the OpenAPI specification:

```bash
# Using Spectral (OpenAPI linter)
npm install -g @stoplight/spectral-cli
spectral lint openapi.yaml

# Using swagger-codegen validate
swagger-codegen validate -i openapi.yaml
```

## API Overview

### Base Configuration
- **Server**: `http://localhost:4100/api` (development)
- **Authentication**: API Key via `X-API-Key` header
- **Rate Limiting**: 100 requests per 15 minutes
- **Content Type**: `application/json`

### Key Endpoints

#### Memory Management
- `POST /api/memory` - Store interactions
- `GET /api/memory/search` - Search memories
- `POST /api/memory/embedding` - Generate embeddings
- `POST /api/memory/concepts` - Extract concepts

#### Conversational AI
- `POST /api/chat` - Chat completion
- `POST /api/chat/stream` - Streaming chat
- `POST /api/completion` - Text completion

#### Knowledge Graph
- `POST /api/graph/decompose` - Text to graph decomposition
- `POST /api/graph/search` - Graph search
- `GET /api/graph/stats` - Graph statistics
- `GET /api/graph/entities` - Browse entities

#### Corpus Navigation
- `POST /api/navigate` - ZPT navigation
- `GET /api/navigate/options` - Navigation options
- `POST /api/navigate/preview` - Navigation preview

#### Unified Search
- `POST /api/search/unified` - Cross-service search
- `POST /api/search/analyze` - Query analysis
- `GET /api/search/services` - Service availability

## Contributing

When updating the API specification:

1. **Maintain Structure**: Follow the established directory structure
2. **Update Examples**: Ensure examples reflect actual API behavior
3. **Validate Changes**: Run validation tools before committing
4. **Document Changes**: Update relevant sections in this README
5. **Test Integration**: Verify generated clients work correctly

## Related Documentation

- [Semem Main Documentation](../README.md)
- [API Implementation](../src/api/)
- [Example Demos](../examples/http-api/)
- [Configuration Guide](../CLAUDE.md)

## Notes

- This specification is generated based on the actual API implementation
- All endpoints include comprehensive error handling
- Examples use realistic data from the Semem domain
- Security considerations are documented throughout
- The specification supports both development and production environments