# API Layer Analysis

## Common Components (api/common/)

### BaseAPI.js
**Purpose**: Abstract base class defining the API interface contract.
- Key Methods:
  - `initialize()`: Setup for API instance
  - `shutdown()`: Cleanup resources
  - `executeOperation(operation, params)`: Execute API operations
  - `_emitMetric(name, value)`: Emit performance metrics

### APIRegistry.js
**Purpose**: Singleton registry managing API instances and lifecycle.
- Key Methods:
  - `register(name, apiClass, config)`: Register new API implementation
  - `get(name)`: Retrieve API instance
  - `unregister(name)`: Remove and cleanup API
  - `getMetrics()`: Collect metrics from all APIs

### RDFParser.js
**Purpose**: Parses and processes RDF/SPARQL operations.
- Key Methods:
  - `parse(input)`: Parse RDF/SPARQL commands
  - `parseCommand(command)`: Process individual commands
  - `buildSimpleQuery(text, options)`: Generate SPARQL queries
  - `expandPrefixes(text)`: Handle prefix resolution

### RDFValidator.js
**Purpose**: Validates RDF data and SHACL constraints.
- Key Methods:
  - `validateShape(data, shape)`: Validate against SHACL shapes
  - `generateSHACL(shape)`: Generate SHACL constraints
  - `validateConstraint(data, constraint)`: Individual constraint validation

## Feature Handlers (api/features/)

### ActiveHandler.js
**Purpose**: Handles complex operations requiring multiple service coordination.
- Key Methods:
  - `handleInteraction(params)`: Process user interactions
  - `handleSearch(params)`: Search operations
  - `handleAnalysis(params)`: Content analysis
- Core Interactions:
  - Uses MemoryManager for retrieval
  - Coordinates with LLMHandler for responses
  - Manages context through ContextManager

### PassiveHandler.js
**Purpose**: Handles basic storage and retrieval operations.
- Key Methods:
  - `handleChat(params)`: Direct LLM interactions
  - `handleQuery(params)`: SPARQL query execution
  - `handleStore(params)`: Data storage
- Core Interactions:
  - Direct interaction with storage layer
  - Basic LLM operations

### SelfieHandler.js
**Purpose**: System monitoring and metrics collection.
- Key Methods:
  - `collectMetrics()`: Gather system metrics
  - `trackError(type, error)`: Error tracking
  - `setupMetricInstruments()`: Initialize monitoring
- Core Interactions:
  - Monitors all API operations
  - Tracks system health

## Interface Handlers (api/cli/, api/repl/, api/http/)

### CLIHandler.js
**Purpose**: Command-line interface implementation.
- Key Methods:
  - `setupCommands()`: Register CLI commands
  - `executeOperation(command, args)`: Process commands
  - `formatOutput(result)`: Format responses
- Core Interactions:
  - Routes commands to appropriate handlers
  - Manages command history

### REPLHandler.js
**Purpose**: Interactive shell environment.
- Key Methods:
  - `processInput(input)`: Handle user input
  - `handleChat(input)`: Process chat mode
  - `handleRDF(input)`: Process RDF mode
- Core Interactions:
  - Maintains interactive session
  - Mode-specific processing

### HTTPServer.js
**Purpose**: REST API and WebSocket server.
- Key Methods:
  - `setupRoutes()`: Configure API endpoints
  - `setupMiddleware()`: Configure middleware
  - `handleWebSocket(socket)`: WebSocket handling
- Core Interactions:
  - REST endpoint routing
  - WebSocket real-time updates
  - Authentication/Authorization

## Support Components

### APILogger.js
**Purpose**: Centralized logging system.
- Key Methods:
  - `createLogEntry(level, ...args)`: Format log entries
  - `getEntries(options)`: Retrieve logs
  - `createChild(name)`: Create scoped logger

### MetricsCollector.js
**Purpose**: Performance and operation metrics collection.
- Key Methods:
  - `collect(name, value, labels)`: Record metrics
  - `getSummary(name)`: Calculate statistics
  - `pruneMetrics()`: Clean old metrics