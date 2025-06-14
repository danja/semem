# PLAN2: Live MCP Integration for Semem & Ragno

## Objective
Integrate all Semem and Ragno facilities—LLM, embedding, SPARQL, search, augmentation, and community discovery—into the MCP server as live, discoverable, and callable services.

## Steps

1. **Design MCP Service Endpoints**
    - Define new JSON-RPC methods: callLLM, embedText, sparqlQuery, sparqlUpdate, searchGraph, augmentGraph, discoverCommunities, etc.
    - Specify input/output schemas for each.

2. **Wire Up Handlers**
    - Instantiate LLMHandler, EmbeddingHandler, SPARQLHelpers, and search/augmentation modules at server startup.
    - Load config from ragno-config.json.

3. **Implement Service Methods**
    - Implement each JSON-RPC method, invoking the appropriate handler/module.
    - Validate all input/output using mcp-schema.json.

4. **Advertise Services**
    - Update listResources to include all live service endpoints with metadata (type: service, description).

5. **Testing & Client Integration**
    - Extend mcpClient.js and mcpClient.test.js to exercise all new endpoints.
    - Add example requests and usage to docs.

6. **Documentation & Notes**
    - Record progress and design decisions in PLAN2-progress.md.
    - Add notable changes or integration instructions to project README.md.

## Deliverables
- Fully live MCP server exposing all Semem/Ragno facilities.
- Discoverable, schema-validated API for all code, data, and live compute services.
- Updated documentation, tests, and client examples.
