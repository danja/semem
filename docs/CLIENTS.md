# Client Endpoint Usage

This document records the HTTP endpoints exercised by the two browser-based
clients included with Semem: the **Workbench UI** and the **VSOM standalone UI**.
Use it as a quick reference when changing routes or proxy behaviour.

---

## Workbench UI (`src/frontend/workbench`)

### Configuration

| Operation | Endpoint (Workbench → Target) | Notes |
|-----------|--------------------------------|-------|
| Load runtime config | `GET /config` (served locally) | Returns `{ apiUrl: "/api", apiKey, mcpServer }` |

### Tell / Ask / Augment / Navigation

The Workbench speaks to the MCP HTTP server through its `/api` proxy:

| UI Action | Workbench Request | MCP Endpoint |
|-----------|-------------------|--------------|
| Store content (“Tell”) | `POST /api/tell` | `POST /tell` |
| Ask a question | `POST /api/ask` | `POST /ask` |
| Run augment workflows | `POST /api/augment` | `POST /augment` |
| Inspect session state | `POST /api/inspect` | `POST /inspect` |
| Update ZPT zoom/pan/tilt | `POST /api/zoom`, `/api/pan`, `/api/tilt` | `POST /zoom`, `/pan`, `/tilt` |
| State management | `POST /api/state` | `POST /state` |
| VSOM training helper | `POST /api/train-vsom` | `POST /train-vsom` |
| ZPT navigation helper | `POST /api/zpt/navigate` | `POST /zpt/navigate` |
| Chat channel | `POST /api/chat`, `/api/chat/enhanced` | `POST /chat`, `/chat/enhanced` |

> The Workbench routes **all other** `/api/*` calls to the MCP server except for
> the document and legacy upload paths below.

### Document Upload Pipeline

| UI Action | Workbench Request | Target Endpoint | Notes |
|-----------|-------------------|-----------------|-------|
| Upload document (Tell panel, chat attachment) | `POST /api/documents/upload` | API server `POST /api/documents/upload` | Multipart/form-data payload |

### Workflow Logs Stream

| UI Feature | Endpoint | Notes |
|------------|----------|-------|
| Console live logs | `GET /workflow-logs/stream` | Proxied to API server `/api/logs/stream` |

---

## VSOM Standalone UI (`src/frontend/vsom-standalone`)

The VSOM app proxies all `/api/*` calls to a configurable backend (defaults to
the MCP server) via `src/frontend/vsom-standalone/server.js`.

### Core Calls

| UI Action | Request | Target | Notes |
|-----------|---------|--------|-------|
| Tell / Ask | `POST /api/tell`, `POST /api/ask` | MCP `/tell`, `/ask` | Mirrors Workbench behaviour |
| Augment operations | `POST /api/augment` | MCP `/augment` | Used for document chunking/processing |
| VSOM training | `POST /api/train-vsom` | MCP `/train-vsom` | Initiates training jobs |
| Navigation helpers | `POST /api/zpt/navigate` | MCP `/zpt/navigate` | 3D navigation |

### VSOM-Specific APIs (from API server)

Depending on configuration, the proxy can also forward VSOM-specific endpoints
hosted on the API server:

| Endpoint | Purpose |
|----------|---------|
| `POST /api/vsom/create` | Create new VSOM instance |
| `POST /api/vsom/load-data` | Load data into VSOM |
| `POST /api/vsom/load-docqa` | Load DocQA datasets |
| `POST /api/vsom/generate-sample-data` | Generate sample data |
| `POST /api/vsom/train` | Start VSOM training |
| `POST /api/vsom/stop-training` | Stop training |
| `GET /api/vsom/grid` | Fetch VSOM grid |
| `GET /api/vsom/features` | Retrieve features |
| `POST /api/vsom/cluster` | Run clustering |
| `GET /api/vsom/training-status` | Check training status |
| `GET /api/vsom/instances` | List instances |
| `DELETE /api/vsom/instances/:instanceId` | Delete instance |

> These endpoints map directly to `src/servers/api-server.js` VSOM routes. The
> VSOM UI proxy includes `/api/vsom/*` in its `context` list so calls resolve to
> the API server automatically.

---

## Legacy Awareness

* All documented paths are current and should remain stable. When deprecating a
  route, update this file so client developers know which calls need migration.
