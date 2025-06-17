# API Module

The API module provides comprehensive interfaces for interacting with the Semem semantic memory system. It implements multiple interaction paradigms including HTTP REST APIs, command-line interfaces, and REPL environments.

## Architecture

The API module follows a layered architecture:

### Core Components

- **APIRegistry**: Central service registry managing API lifecycle and dependencies
- **BaseAPI**: Abstract base class providing common functionality for all API implementations
- **MetricsCollector**: Performance monitoring and analytics collection
- **APILogger**: Structured logging system for API operations

### Interface Types

#### HTTP Server (`http/`)
- **HTTPServer**: Express.js-based REST API server
- **WebSocketServer**: Real-time bidirectional communication
- **Middleware**: Authentication, error handling, and request logging
- **Client**: JavaScript client SDK for browser and Node.js environments

#### Command Line Interface (`cli/`)
- **CLIHandler**: Interactive command-line interface for system administration
- Supports batch operations and scripting

#### REPL Interface (`repl/`)
- **REPLHandler**: Read-Eval-Print-Loop for interactive development and debugging

### Feature APIs (`features/`)

#### Core Features
- **MemoryAPI**: CRUD operations for semantic memories
- **ChatAPI**: Conversational interface with LLM integration
- **SearchAPI**: Vector similarity and semantic search capabilities

#### Handler Types
- **ActiveHandler**: Proactive system behaviors and automation
- **PassiveHandler**: Reactive event processing
- **SelfieHandler**: Self-monitoring and introspection capabilities

### Request Processing (`processors/`)

The processor layer implements the Command pattern for request handling:

- **Processor**: Base processor interface
- **MemoryAPIProcessor**: Memory operation processing and validation
- **ChatAPIProcessor**: Conversation flow management
- **SearchAPIProcessor**: Query optimization and result ranking
- **ActiveHandlerProcessor**: Proactive task execution
- **PassiveHandlerProcessor**: Event-driven response handling

### Common Utilities (`common/`)

- **CustomValidators**: Input validation and sanitization
- **RDFParser**: RDF/Turtle data format parsing
- **RDFValidator**: Semantic data validation
- **TypeDefinitions**: TypeScript type definitions for API contracts

## Usage Patterns

### REST API
```javascript
// Initialize HTTP server
const server = new HTTPServer(config);
await server.start();

// Memory operations
POST /api/memory - Store new memory
GET /api/memory/:id - Retrieve memory
PUT /api/memory/:id - Update memory
DELETE /api/memory/:id - Remove memory

// Search operations
POST /api/search - Semantic search
GET /api/search/similar/:id - Find similar memories
```

### CLI Interface
```bash
# Start interactive CLI
semem cli

# Batch operations
semem memory store --prompt "question" --response "answer"
semem search --query "semantic memory" --limit 10
```

### Programmatic API
```javascript
import { APIRegistry } from './src/api/common/APIRegistry.js';

const registry = new APIRegistry();
await registry.initialize();

const memoryAPI = registry.getService('MemoryAPI');
const result = await memoryAPI.store({ prompt, response });
```

## Authentication & Security

- JWT-based authentication for HTTP APIs
- Role-based access control (RBAC)
- Request rate limiting and throttling
- Input validation and sanitization
- CORS configuration for browser clients

## Monitoring & Observability

- Structured logging with correlation IDs
- Performance metrics collection
- Error tracking and alerting
- Request/response tracing
- Health check endpoints

## Extension Points

The API module is designed for extensibility:

- **Custom Processors**: Implement domain-specific request handling
- **Middleware**: Add cross-cutting concerns (caching, transformation)
- **Custom Validators**: Implement business-specific validation rules
- **Protocol Adapters**: Support additional communication protocols