# ZPT-NG Plan (Semem)

This plan proposes next-generation ZPT integration and will be used to track progress.  
Update the checkboxes as work lands.

## Goals
- Make ZPT the default retrieval/navigation pipeline for Ask/Recall and related UI surfaces.
- Canonicalize ZPT vocabulary (zoom/pan/tilt) across API, MCP verbs, UI, tests, and docs.
- Ensure provenance tracking is generated for real navigation activity (sessions/views).
- Align representation outputs to tilt styles (keywords/embedding/graph/temporal).
- Remove fallback behaviors that hide real configuration or runtime errors.

## Current Gaps (Observed)
- Zoom ladders differ across docs/tests/API (entity/unit/text/community/corpus vs molecular/concept/theme).
- ZPT state is tracked, but Ask/Recall do not consistently execute the ZPT navigation pipeline.
- Provenance (NavigationSession/View) is not emitted for most ZPT state changes.
- Pan field names and usage are inconsistent between services and verbs.
- Fallbacks mask failures (contrary to repo guidance).

## Plan

### Phase 1: Vocabulary + Contracts (spec alignment)
- [x] Define canonical zoom ladder and tilt projections in one place.
- [x] Align ZPT schema/option responses with canonical terms.
- [x] Update docs/tests to match canonical terms and examples.
- [x] Add pan scope selector for corpuscle subsets.
- [ ] Add a mapping table for prior terms (if needed) and remove implicit translations.

### Phase 2: Pipeline Integration (Ask/Recall → ZPT)
- [x] Route Ask/Recall context selection through `ZptAPI.navigate`.
- [x] Ensure `zptState.pan` is the single source of truth (domains/keywords/entities/temporal).
- [x] Feed ZPT outputs into response generation (use tilt-specific formatting).
- [x] Remove inline fallbacks; raise actionable errors when required services are missing.

### Phase 3: Provenance + Sessions (ZPT ontology)
- [x] Create NavigationSession/View on each navigation execution (Ask/Recall/zoom/pan/tilt).
- [x] Persist session/view metadata to the navigation graph with PROV-O.
- [x] Expose session/view history endpoints in UI for inspection.

### Phase 4: UI + VSOM Wiring
- [x] Workbench: tie zoom/pan/tilt controls to ZPT navigation pipeline (not just state).
- [x] VSOM: adapt rendering per tilt (graph/temporal/keywords/embedding).
- [x] Standardize labels, tooltips, and help text to canonical terms.

### Phase 5: Tests + Docs
- [x] Update ZPT exercises/tests to match the canonical ladder and pipeline behavior.
- [ ] Add integration coverage for Ask/Recall with ZPT navigation and provenance.
- [ ] Document end-to-end ZPT flow (API → MCP verbs → UI).

## Progress Log
- 2025-??-??: Plan created.
- 2025-??-??: Canonical zoom ladder agreed (unit used, concept merged into unit).
- 2025-??-??: Phase 1 alignment: schemas/options/docs/tests updated for micro/entity/text/unit/community/corpus.
- 2025-??-??: Pan scope filter added for corpuscle subsets (ragno:inCorpuscle).
- 2025-??-??: Ask/Recall now route context selection through ZPT navigation.
- 2025-??-??: Pan normalization/validation/filters aligned on domains/keywords/entities/temporal.
- 2025-??-??: Inline SPARQL template fallbacks removed; missing templates now throw explicit errors.
- 2025-??-??: Navigation sessions/views now require SPARQL persistence with PROV-O metadata.
- 2025-??-??: Workbench navigation history now surfaces ZPT sessions/views.
- 2025-??-??: Workbench zoom/pan/tilt controls now execute ZPT navigation updates.
- 2025-??-??: VSOM tilt styles now drive visualization rendering options.
- 2025-??-??: ZPT labels/tooltips/help text aligned to canonical ladder.
- 2025-??-??: ZPT integration exercises updated to canonical zoom/tilt ladder.
- 2025-??-??: Ask/Recall e2e now asserts ZPT state presence in responses.

## Canonical Zoom Ladder
Most detailed → most abstract:

1. micro
2. entity
3. text
4. unit
5. community
6. corpus

Notes:
- SKOS concepts are represented at the unit level to avoid an ambiguous “concept” rung.
- `ragno:TextElement` stays more granular than `ragno:Unit`.
