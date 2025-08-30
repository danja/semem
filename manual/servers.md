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
- **Document Upload**: `POST /upload-document` for PDF, TXT, MD file processing
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
           /api/* requests (/api/upload-document, /api/tell, etc.)
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

## Document Upload Architecture

The **MCP Server** provides document upload functionality through the DocumentProcessor:

**Supported File Types:**
- `.pdf` - PDF documents (processed via PDFConverter)
- `.txt` - Plain text files
- `.md` - Markdown documents

**Processing Pipeline:**
1. **File Upload**: Browser sends file as data URL to workbench
2. **Type Detection**: Automatic inference from filename extension  
3. **MCP Processing**: Document converted and processed via DocumentProcessor
4. **SPARQL Storage**: Stored as `ragno:Unit` with `ragno:TextElement` entities
5. **User Feedback**: Progress logged to workbench Console panel

**API Endpoint:**
```
POST /upload-document
Content-Type: application/json

{
  "fileUrl": "data:text/plain;base64,SGVsbG8gV29ybGQ=",
  "filename": "document.txt", 
  "mediaType": "text/plain",
  "documentType": "text",
  "metadata": { "title": "Document Title" }
}
```

## External Dependencies

- **SPARQL Store** (Port 3030): Apache Jena Fuseki for RDF storage
- **Ollama** (Port 11434): Local LLM service (fallback)