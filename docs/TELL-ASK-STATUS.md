# Tell/Ask Workflow Status

## Overview
The `tell` and `ask` workflows are integral to the Workbench UI and MCP server, enabling interaction with stored memories and knowledge. This document outlines the architecture, participating files, and data flow for these workflows.

---

## Participating Files

### Workbench UI
- **`src/frontend/workbench/public/js/services/ApiService.js`**: Handles API requests for `tell` and `ask` operations.
- **`src/frontend/workbench/server.js`**: Proxy middleware for forwarding API requests to the MCP server.
- **`tests/workbench/tell-ask.test.js`**: Playwright test for automating `tell` and `ask` workflows.

### MCP Server
- **`mcp/tools/SimpleVerbsService.js`**: Implements `tell` and `ask` logic.
- **`mcp/tools/VerbSchemas.js`**: Defines schemas for validating `tell` and `ask` payloads.
- **`src/stores/SPARQLStore.js`**: Manages SPARQL data persistence and retrieval.

---

## Data Flow

1. **Tell Workflow**:
   - The Workbench UI sends a `tell` request via `ApiService.js`.
   - The request is proxied to the MCP server by `server.js`.
   - The MCP server validates the payload using `VerbSchemas.js`.
   - The `SimpleVerbsService.js` processes the request and stores the data in `SPARQLStore.js`.

2. **Ask Workflow**:
   - The Workbench UI sends an `ask` request via `ApiService.js`.
   - The request is proxied to the MCP server by `server.js`.
   - The MCP server validates the payload using `VerbSchemas.js`.
   - The `SimpleVerbsService.js` retrieves relevant data from `SPARQLStore.js` and returns the response.

---

## Current Status

### Integration Tests
- **Tested Files**: `tests/integration/mcp/tell-ask-e2e.integration.test.js`
- **Results**: All tests passed successfully.
  - HTTP `tell`/`ask` round trip with random facts.
  - Multiple random facts via HTTP.
  - Storage consistency between HTTP and STDIO verified.

### Observations
- The SPARQL store is functioning correctly, with data being persisted and retrieved as expected.
- The workflows are consistent between the Workbench UI and MCP server.

---

## Architecture

### Enhanced SPARQLStore
- The `SPARQLStore` is the backbone for data persistence, replacing older memory and JSON storage backends.
- Methods like `store()` and `loadHistory()` ensure data consistency and retrieval.

### Proxy Middleware
- The `server.js` file uses `createProxyMiddleware` to forward `/api` requests to the MCP server.
- Ensures seamless communication between the Workbench UI and MCP server.

---

## Next Steps
- Refactor redundant code in `SimpleVerbsService.js`.
- Migrate any remaining memory or JSON storage to SPARQL.
- Enhance logging for better debugging and performance monitoring.
- Document any hardcoded values and move them to configuration files.

---

## References
- **Integration Tests**: `tests/integration/mcp/tell-ask-e2e.integration.test.js`
- **SPARQL Store**: `src/stores/SPARQLStore.js`
- **Proxy Middleware**: `src/frontend/workbench/server.js`