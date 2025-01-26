npm test -- tests/unit/ProcessorSettings.spec.js

# Core System

- npm test -- tests/unit/Config.spec.js
- npm test -- tests/unit/api/BaseAPI.spec.js
- npm test -- tests/unit/api/APIRegistry.spec.js
- npm test -- tests/unit/api/APILogger.spec.js
- npm test -- tests/unit/api/MetricsCollector.spec.js

# Storage & Memory

- npm test -- tests/unit/cached-sparql-store-spec.js
- npm test -- tests/unit/sparql-store-spec.js
- npm test -- tests/integration/sparql/sparql-store-integration-spec.js
- npm test -- tests/integration/sparql/sparql-advanced-backup-spec.js
- npm test -- tests/integration/sparql/sparql-basic-backup-spec.js
- npm test -- tests/integration/sparql/sparql-federation-spec.js

# Handlers

- npm test -- tests/unit/handlers/LLMHandler.spec.js
- npm test -- tests/unit/handlers/EmbeddingHandler.spec.js
- npm test -- tests/unit/handlers/PassiveHandler.spec.js
- npm test -- tests/unit/handlers/ActiveHandler.spec.js
- npm test -- tests/unit/handlers/SelfieHandler.spec.js
- npm test -- tests/integration/llms/LLMHandler.integration.spec.js

# Context & Windows

- npm test -- tests/unit/ContextManager.spec.js
- npm test -- tests/unit/ContextWindowManager.spec.js
- npm test -- tests/integration/ContextManager.integration.spec.js

# User Interfaces

- npm test -- tests/unit/api/REPLHandler.spec.js
- npm test -- tests/unit/api/CLIHandler.spec.js
- npm test -- tests/integration/http/HTTPServer.integration.spec.js
- npm test -- tests/integration/http/websocket-integration.spec.js

# Utilities

- npm test -- tests/unit/utils/EmbeddingValidator.spec.js
- npm test -- tests/unit/utils/SPARQLHelpers.spec.js
