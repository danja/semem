# CODEX Action Plan

1. Fix syntax error in `src/prompts/migrate-existing.js` so prompt migration script loads — **DONE** (`node --check src/prompts/migrate-existing.js`)
2. Update MCP entry points to import from new `src/mcp` paths — **DONE** (`bin/mcp.js`, `bin/mcp-http.js`, `bin/semem.js`, `index.js`)
3. Resolve stale embedding migration/handler references and update `CODEX-REVIEW.md` — **DONE** (`src/handlers/EmbeddingHandler.js`, renamed `src/utils/EmbeddingMigration.js`, checklist updated)
4. Run MCP integration tests (`tell-ask` HTTP & STDIO) — BLOCKED (`fetch failed` on localhost:4101 and STDIO harness timed out)
