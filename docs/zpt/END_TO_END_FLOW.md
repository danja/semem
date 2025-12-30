# ZPT End-to-End Flow (API -> MCP -> UI)

This document describes how ZPT (zoom/pan/tilt) navigation flows through Semem from API requests to MCP verbs and UI surfaces.

## Goals
- Make ZPT the default navigation layer for Ask/Recall context selection.
- Ensure navigation provenance (sessions/views) is captured and queryable.
- Keep the vocabulary consistent across API, MCP, and UI.

## Canonical Ladder
Most detailed -> most abstract:
1. micro
2. entity
3. text
4. unit
5. community
6. corpus

Notes:
- SKOS concepts are represented at the unit level to avoid a separate concept rung.
- The term "unit" is the canonical name for that rung (avoid "concept").
- "Corpuscle" is used for scoped subsets of corpus content (not a zoom level).

## Core Components
- ZptAPI: API server integration for navigation, sessions, views, and ontology validation.
- SimpleVerbsService: MCP HTTP verbs (tell/ask/recall) and zpt navigation wiring.
- ZPT selection/transform pipeline: CorpuscleSelector -> TiltProjector -> CorpuscleTransformer.
- ZPT ontology integration: sessions and views stored with PROV metadata.

## Flow Overview
1) Request arrives (HTTP or MCP)
- MCP HTTP: POST /tell, /ask, /recall, /zpt/navigate on port 4101.
- API server: /api/navigate/* and /api/ask or /api/recall on port 4100.

2) ZPT parameters validated and normalized
- Zoom uses canonical ladder (micro/entity/text/unit/community/corpus).
- Pan accepts domains/keywords/entities/temporal and a scope selector for corpuscle subsets.
- Tilt selects representation style (keywords/embedding/graph/temporal).

3) Navigation is executed
- CorpuscleSelector performs semantic selection against SPARQL storage.
- TiltProjector determines representation (keywords/embedding/graph/temporal).
- CorpuscleTransformer formats output for the caller (structured/markdown/json).

4) Ask/Recall response generation
- Ask/Recall routes context selection through ZPT navigation.
- Responses include `zptState` with zoom/pan/tilt/sessionId/timestamp.

5) Provenance persistence
- Each navigation call writes a NavigationSession and NavigationView to the navigation graph.
- Sessions and views are queryable via /api/navigate/sessions and /api/navigate/views.

## HTTP Entry Points
- MCP server (port 4101)
  - POST /tell
  - POST /ask
  - POST /recall
  - POST /zpt/navigate
  - GET /state

- API server (port 4100)
  - POST /api/ask (bridges to memory + ZPT)
  - POST /api/recall
  - POST /api/navigate
  - GET /api/navigate/sessions
  - GET /api/navigate/views
  - POST /api/navigate/analyze
  - GET /api/navigate/ontology/terms

## UI Surfaces
- Workbench (port 4102)
  - Controls emit ZPT zoom/pan/tilt parameters.
  - Navigation history surfaces sessions/views (via /api/navigate/* endpoints).

- VSOM Standalone (port 4103)
  - Uses MCP HTTP endpoints for ZPT navigation.
  - Tilt style affects visualization output.

## Configuration Requirements
- Storage must be SPARQL; missing storage is an error.
- `config/config.json` must set:
  - `graphName`
  - `storage.type = sparql`
  - `storage.options.query` and `storage.options.update`
- Secrets and API keys live in `.env` (loaded early with dotenv).

## Testing Notes
- Integration tests run against live services and SPARQL endpoints.
- E2E coverage includes tell/ask/recall and ZPT provenance checks.

