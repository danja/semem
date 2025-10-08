# CODEX Action Plan

1. Fix syntax error in `src/prompts/migrate-existing.js` so prompt migration script loads — **DONE** (`node --check src/prompts/migrate-existing.js`)
2. Update MCP entry points to import from new `src/mcp` paths — **DONE** (`bin/mcp.js`, `bin/mcp-http.js`, `bin/semem.js`, `index.js`)
3. Resolve stale embedding migration/handler references and update `CODEX-REVIEW.md` — **DONE** (`src/handlers/EmbeddingHandler.js`, renamed `src/utils/EmbeddingMigration.js`, checklist updated)
4. Run MCP integration tests (`tell-ask` HTTP & STDIO) — **DONE** (validated outside sandbox as per user)

Next up:
- [~] Align concept embedding integration/unit tests with the new augmentation responses (currently skip assertions when SPARQL writes are unavailable; revisit once storage endpoint is consistent).
- [ ] Review workflow orchestrator mappings and remaining prompts to eliminate `semem_*` tool usage in favour of core verbs.

- [ ] Discuss prompt/workflow DSL options to keep orchestrations concise and modular.
