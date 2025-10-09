# Workflow Orchestration

## Overview
- Workflows are declarative JSON files in `src/workflows/`.
- Each workflow lists ordered `steps`; every step calls a MCP verb (typically `augment` or `tell`).
- `WorkflowRunner` (`src/workflows/WorkflowRunner.js`) loads a workflow, validates its schema with Zod, resolves `${...}` placeholders against a shared context, and executes steps via `SimpleVerbsService`.
- Step results are stored under both `results[stepId]` and `context['$' + stepId]`, allowing later steps to reference earlier output directly.
- Failures bubble immediately unless a step sets `continueOnError: true`; errors include workflow/step metadata to aid debugging.

## Built-In Workflows
- `file-document-ingestion.json` orchestrates the full PDF ingestion pipeline:
  1. `augment/load_document` loads a local file into memory (preserves Buffer, metadata).
  2. `augment/convert_pdf` uses the shared `PDFConverter` to produce markdown + metadata.
  3. `augment/chunk_markdown` delegates to `Chunker` using config defaults (`sparqlIngestion.chunking`).
  4. `augment/ingest_chunks` persists the chunked corpus via `Ingester`, targeting the configured SPARQL graph.
- `sparql-document-ingestion.json` fetches remote documents with `augment/sparql_fetch` and persists summaries with `tell`.

## Augment Strategies for Workflows
- `load_document`: reads a file path into a buffer, infers MIME type, and returns metadata (`src/mcp/tools/verbs/strategies/augment/LoadDocumentStrategy.js`).
- `convert_pdf`: wraps the existing `PDFConverter` to emit markdown while preserving source metadata (`ConvertPDFStrategy.js`).
- `chunk_markdown`: invokes `Chunker` with config-driven defaults to produce Ragno-compliant chunks (`ChunkMarkdownStrategy.js`).
- `ingest_chunks`: reuses `Ingester` to store chunk results in the active SPARQL store, honoring `config.get('graphName')` or explicit overrides (`IngestChunksStrategy.js`).
- The augment schema (`src/mcp/tools/VerbSchemas.js`) recognises these operations, so workflow validation catches typos before execution.

## Running Workflows
```bash
node -e "import('./src/workflows/index.js').then(async ({ WorkflowRunner }) => {
  const runner = new WorkflowRunner();
  const result = await runner.runWorkflow('file-document-ingestion', {
    filePath: 'data/pdfs/memento.pdf'
  });
  console.log(JSON.stringify(result, null, 2));
})"
```
- The runner logs lifecycle details via the unified logger (`WorkflowRunner` logger name `WorkflowRunner`), so check `logs/` for step-by-step execution records.
- Ensure services are running (`./start.sh`) so the ingest step can reach the configured Fuseki endpoint.

## Adding New Workflows
- Place JSON definitions in `src/workflows/`. Each file should include `name`, `description`, optional `parameters`, and a `steps` array.
- Each step requires:
  * `verb`: MCP verb to execute (validated at runtime).
  * Optional `operation`: for `augment` or other verbs supporting sub-commands.
  * `args`: object of arguments. Use `${...}` placeholders to reference workflow parameters (`${filePath}`) or prior step results (`${convert.markdown}`).
- Update `docs/ORCHESTRATION-IDEAS.md` with new scenarios if the workflow represents a reusable pattern.
- Prefer reusing existing strategies/commands; when new functionality is needed, add a strategy under `src/mcp/tools/verbs/strategies/` and register it in the corresponding command.

## Testing & Verification
- Primary verification is through live workflows (see command above) and MCP E2E suites:
  * `INTEGRATION_TESTS=true npx vitest run tests/integration/mcp/tell-ask-e2e.integration.test.js --reporter=verbose`
  * `INTEGRATION_TESTS=true npx vitest run tests/integration/mcp/tell-ask-stdio-e2e.integration.test.js --reporter=verbose`
- Follow policy in `AGENTS.md`: avoid mocks except for trivial arithmetic-style unit checks; workflows should exercise real services.

## Outstanding Work
- HTTP MCP ask currently returns intermittent 500 responses from downstream services; once upstream is stable, re-run the HTTP E2E suite to confirm the ingest workflow supplies usable context.
- `Config.js` still needs a cleanup pass to consolidate SPARQL defaults (tracked separately).
