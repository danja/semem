# CODEX Review Proposals

- [x] Fix template literal parsing bug in `src/prompts/migrate-existing.js:215`: the conditional placeholder now renders safely and passes `node --check`.
- [x] Update MCP entry points to reference the new `src/mcp` structure rather than the flagged-for-removal `_mcp` paths. `bin/mcp-http.js`, `bin/mcp.js`, `bin/semem.js`, and `index.js` now target `src/mcp/**`.
- [x] Resolve missing Embedding handler export: reinstated a compatibility handler in `src/handlers/EmbeddingHandler.js`, restored exports, and aligned migration scripts with the renamed `src/utils/EmbeddingMigration.js`.
- [x] Revisit the embedding migration utilities: the CLI (`scripts/migrate-embeddings.js`) still targets live SPARQL data and relies on `src/utils/EmbeddingMigration.js` for dimension cleanup, so we’re keeping both in place and noting the TODO for eventual retirement once vector ingests are stable.
- [x] Audit MCP legacy compatibility layers: normalized augmentation response types in `LegacyOperationsStrategy` (no more `*_legacy` suffix) and left TODO to migrate callers off that strategy entirely.
- [x] Clean up deprecated MCP tool shims: the router now exposes only the verb-based tools, logs warnings for legacy aliases, and no longer loads the old module bundles.
- [x] Updated concept embedding integration/unit tests to consume the new verb response shape (top-level totals, no `*_legacy` augmentation types).
- [x] Extended augment options schema with `includeEmbeddings` and enriched concept embedding responses (`totalProcessed`, `targetGraph`) so verb outputs match the modern tests/clients.
- [x] Moved concept embedding SPARQL write into `sparql/templates/store/insert-concept-embedding.sparql` and load it via `SPARQLTemplateLoader` to eliminate inline queries.
- [x] Slimmed `ToolRouter` to core verbs plus chat shims; legacy `semem_*` tool names now map through workflow orchestration rather than bespoke router branches.
- [x] Removed unused legacy argument transformers from `ToolRouter`; only `/chat` and `/chat/enhanced` remain as thin aliases over `ask`.
- [~] Confirm we still need PromptManager’s legacy adapters. `src/prompts/compatibility.js` calls into the adapters for `PromptTemplates`, `PromptFormatter`, and `MCP`, so a wider migration plan is needed before removing them.
- [~] Evaluate `EmbeddingService`’s legacy constructor path (`src/services/embeddings/EmbeddingService.js:23`). `SearchService`, `SearchServer`, and several test helpers still instantiate the service without a `Config`, so we need to refactor those callers before dropping the fallback.
- [x] Audit leftover `_mcp` imports as likely-dead entry points: `compare-search.js`, `fix-embedding-dimensions.js`, `test-dogfort.js`, and the MCP test suites now import from `src/mcp/**`.
