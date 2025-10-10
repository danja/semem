# Endpoint Topology

Semem exposes three HTTP services that cooperate to deliver the workbench
experience. The table below shows their default ports (see `config/config.json`
under `servers.*` if you need to change them).

| Service          | Default Port | Purpose                              |
|------------------|--------------|--------------------------------------|
| API server       | 4100         | Storage / search / document pipeline |
| MCP HTTP server  | 4101         | 12 MCP verbs over HTTP               |
| Workbench server | 4102         | Static UI + reverse proxy            |

All paths shown in the sections below are absolute – prepend the relevant
scheme/host (`http://localhost:<port>`) for local installs or the production
hosts from `CLAUDE.md`.

---

## Workbench Server (Port 4102)

The Workbench serves static files and forwards API calls to the other services.

| Path on Workbench | Action | Forwarded To | Notes |
|-------------------|--------|--------------|-------|
| `/` and any non-`/api` route | Serves `public/index.html` | – | SPA fallback |
| `/config` | Returns runtime config used by the UI | – | Includes `apiUrl: "/api"` and MCP endpoint |
| `/health` | Basic health payload | – | Indicates MCP target host |
| `/workflow-logs/stream` | Proxies SSE log stream | `http://localhost:4100/api/logs/stream` | Pure pass-through |
| `/api/documents/*` | **Rewritten** to `/api/documents/*` | API server (`http://localhost:4100`) | Used by the new multipart upload flow |
| `/api/upload/*` | **Rewritten** to `/api/upload/*` | API server (`http://localhost:4100`) | Legacy Base64 upload compatibility |
| Any other `/api/*` | Forwarded as-is (without `/api` prefix) | MCP server (`http://localhost:4101`) | `/api/tell` → MCP `/tell`, etc. |

> **Important:** The Workbench strips the `/api` prefix before proxying to the
> MCP server, but rewrites the document routes so the API server still receives
> `/api/documents/...` and `/api/upload/...`.

---

## API Server (Port 4100, Base Path `/api`)

The API server exposes a rich REST surface. Highlights:

### Memory & Search

| Endpoint | Description |
|----------|-------------|
| `POST /api/memory` | Store interactions directly in memory |
| `GET /api/memory/search` | Search stored items |
| `POST /api/memory/embedding` | Generate embeddings |
| `POST /api/memory/concepts` | Extract concepts |
| `POST /api/search` | Low-level search API |
| `POST /api/index` | Add content to search index |
| `POST /api/search/unified` | Unified hybrid search |
| `POST /api/search/analyze` | Search diagnostics |

### Workbench Bridging Verbs

These mirror the MCP verbs but are exposed through the API server for the
Workbench and automation clients:

| Endpoint | Notes |
|----------|-------|
| `POST /api/tell` | Store content |
| `POST /api/ask` | Retrieve content |
| `POST /api/augment` | Run augment strategies |
| `POST /api/zoom` | ZPT zoom changes |
| `POST /api/pan` | ZPT pan changes |
| `POST /api/tilt` | ZPT tilt changes |
| `POST /api/state` | System state operations |
| `POST /api/inspect` | Inspection helpers |

### Document Pipeline

| Endpoint | Status | Description |
|----------|--------|-------------|
| `POST /api/documents/upload` | **Primary** | Accepts multipart uploads (used by the Workbench UI). |
| `POST /api/documents/convert` | Active | Convert document content. |
| `POST /api/documents/chunk` | Active | Chunk converted documents. |
| `POST /api/documents/ingest` | Active | Ingest chunks into SPARQL. |
| `GET /api/documents` | Active | List tracked documents. |
| `GET /api/documents/:id` | Active | Retrieve metadata for a document. |
| `GET /api/documents/:id/status` | Active | Processing status. |
| `DELETE /api/documents/:id` | Active | Remove a document entry. |

### Other Feature Areas

The API server also exposes endpoints for Ragno graph operations, VSOM, Wikidata
integration, unified search, and more. See `src/servers/api-server.js` under
`setupRoutes()` for the full list if you need an exhaustive inventory.

---

## MCP HTTP Server (Port 4101)

The MCP server implements the 12 Model Context Protocol verbs directly. The
Workbench reaches these via the `/api` proxy, e.g. `POST http://localhost:4102/api/tell`
becomes `POST http://localhost:4101/tell`.

| Endpoint | Verb |
|----------|------|
| `POST /tell` | tell |
| `POST /ask` | ask |
| `POST /augment` | augment |
| `POST /inspect` | inspect |
| `POST /state` | state |
| `POST /remember` | remember |
| `POST /recall` | recall |
| `POST /zoom` | zoom |
| `POST /pan` | pan |
| `POST /tilt` | tilt |
| `POST /chat` | chat |
| `POST /chat/enhanced` | chat-enhanced |
| `POST /zpt/navigate` | ZPT navigation helper |
| `POST /train-vsom` | VSOM training helper |
| `POST /mcp` | Raw MCP protocol endpoint |

> Some verbs are thin wrappers that dispatch into shared services (see
> `src/mcp/http-server.js`). The HTTP layout is stable but callers should prefer
> the API server when they require additional orchestration (chunking, ingestion,
> etc.).

---

## Legacy Paths Summary

No legacy document-upload routes remain; all clients should post multipart data
to `/api/documents/upload`.

