# Agent Contract for Chat-Oriented Clients

This contract describes how an external chat agent can call Semem over HTTP. The agent should mirror the Semem Workbench client: send JSON over HTTPS, handle errors explicitly (no fallbacks), and let Semem perform storage, search, and RDF/SPARQL operations (including Wikidata lookups) on its behalf.

## Endpoints and Hosts
- Base MCP HTTP server: `https://mcp.tensegrity.it`
- Workbench UI (proxy to MCP): `https://semem.tensegrity.it`
- SPARQL/Fuseki (RDF + Wikidata-backed data): `https://semem-fuseki.tensegrity.it/`
- API server (legacy HTTP surface): `https://api.tensegrity.it`

## Transport and Conventions
- Method: `POST` for all MCP verbs.
- Headers: `Content-Type: application/json`; include auth headers if provisioned for your deployment.
- Body: JSON object validated by Zod per verb schema; undefined/empty fields are rejected (no implicit defaults).
- Errors: non-2xx responses always indicate a failure that must be surfaced to the caller; do not retry with fallbacks.

## HTTP Verbs (live on `https://mcp.tensegrity.it`)
- `/tell`: Persist content into semantic memory (embedding + RDF metadata stored via SPARQL). Provide the user/system prompt, response, and any domain metadata Semem should keep.
- `/ask`: Query stored knowledge with semantic retrieval. Provide the question and optional context hints; Semem handles similarity search + SPARQL as configured.
- `/augment`: Extract concepts/relationships from text chunks and write them to the RDF graph. Supply the text payload; Semem returns structured units/entities/relationships and persists them.
- `/inspect`: Check system state/health and active configuration; use for readiness before issuing work.
- `/state`: Read or mutate runtime state/configuration (values must be present in `config/config.json` and `config/preferences.js`; no inline constants).
- `/zpt/navigate`: 3D navigation (zoom/pan/tilt) across semantic space; include verb (`zoom`, `pan`, or `tilt`) plus the target granularity/direction.
- `/chat`: Basic chat completion routed through the configured LLM provider set.
- `/chat/enhanced`: Chat with external-service augmentation (Semem orchestrates additional retrieval/processing before replying).

> Remaining core verbs (`remember`, `recall`, `zoom`, `pan`, `tilt`, `state`, `inspect`, `augment`, `ask`, `tell`, `chat`, `chat-enhanced`) are exposed through MCP; the HTTP surface above is the supported set for agents connecting like the Workbench.

## Wikidata and SPARQL Access
- Preferred path: let Semem perform Wikidata/SPARQL interactions via `/ask` or `/augment`; Semem manages RDF graph updates and similarity indexing.
- Direct SPARQL: use `https://semem-fuseki.tensegrity.it/` if you need low-level SPARQL. Align queries with the Ragno vocabulary (http://purl.org/stuff/ragno/) and existing Semem datasets to keep data coherent.

## Interaction Expectations for the Agent
- Treat Semem as the source of truth for storage and retrieval; do not cache embeddings or RDF locally.
- Always include sufficient identifiers/metadata in requests so stored items can be retrieved by `ask`/`remember`/`recall` flows.
- Do not mask errors: surface Semem failures to the caller so configuration/environment issues can be fixed.
- Follow existing port and host conventions; do not hardcode alternate URLs. Use configuration injection on the agent side if hosts differ per environment.
