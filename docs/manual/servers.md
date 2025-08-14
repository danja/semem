# Server Architecture

Semem runs multiple specialized servers that work together to provide different functionality:

## Server Components

### API Server (Port 4100)
- **Purpose**: General-purpose REST API for programmatic access
- **Location**: `src/servers/api-server.js`
- **Provides**: Memory management, search, document processing, VSOM visualization
- **Used by**: External applications, testing, direct API clients

### MCP Server (Port 4101) 
- **Purpose**: Model Context Protocol server + Simple Verbs REST API
- **Location**: `mcp/http-server.js`
- **Provides**: Tell/Ask/Navigate/Augment/Zoom/Pan/Tilt operations via MCP and REST
- **Used by**: MCP clients, workbench UI, LLM integrations

### Workbench UI (Port 4102)
- **Purpose**: Web-based user interface for interactive semantic memory operations
- **Location**: `src/frontend/workbench/`
- **Provides**: Static HTML/CSS/JS frontend + API proxy
- **Used by**: End users via web browser

## Proxy Architecture

The **Workbench UI** acts as both a static file server and an API proxy:

```
Browser -> Workbench UI (4102) -> MCP Server (4101)
           /api/* requests
```

**Why a proxy is needed:**
- Avoids CORS issues when frontend JavaScript calls APIs
- Keeps all user requests on a single port (4102)
- Allows workbench to serve static files while forwarding API calls

**Configuration:**
- Proxy target set via `MCP_SERVER` environment variable
- Configured automatically in `start-all.js` based on config ports
- Frontend makes requests to `/api/*` which get proxied to the MCP server

## Starting Servers

Use the provided scripts to start all servers with correct port configuration:

```bash
./start.sh    # Start all servers
./stop.sh     # Stop all servers
```

Ports are read from `config/config.json` under the `servers` section.

## External Dependencies

- **SPARQL Store** (Port 3030): Apache Jena Fuseki for RDF storage
- **Ollama** (Port 11434): Local LLM service (fallback)