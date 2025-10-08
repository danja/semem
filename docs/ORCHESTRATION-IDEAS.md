# Workflow Orchestration Ideas for Semem

## Goals
- Keep orchestration simple and maintainable.
- Support extensibility (e.g. future planner/TODO system).
- Avoid reintroducing monolithic switch-logic.
- Provide an abstraction layer so we could plug in a richer engine later (e.g. a transmissions-lite core).

## Proposed Layers

### 1. **Verb Command Layer (existing)**
- Continue using the Command/Strategy pattern (`TellCommand`, `AskCommand`, etc.).
- Each verb remains an isolated, testable unit with its own strategies.

### 2. **Workflow Definition Layer (new)**
- Define workflows in a concise JSON/YAML/Zod schema, e.g.
  ```json
  {
    "name": "research-analysis",
    "steps": [
      { "verb": "tell", "args": { "content": "${document}" } },
      { "verb": "augment", "args": { "operation": "extract_concepts", "text": "${document}" } },
      { "verb": "ask", "args": { "question": "${question}", "useContext": true } }
    ]
  }
  ```
- Place definitions in `src/workflows/*.json` (or similar).
- Use Zod schemas to validate both the workflow structure and the resolved arguments.

### 3. **Workflow Runner**
- Minimal runtime engine: iterate `steps`, resolve variables from a shared context, call verbs via `SimpleVerbsService`.
- Allow conditions (`if`), branching (`switch`), and simple loops if needed, but keep it small.
- Provide hook points (before/after each step) for logging/metrics.
- Context object holds results (`context.results['step_1']`) to feed into later steps.

### 4. **Adapters to core verbs**
- Workflow runner only references verbs via an abstraction (e.g. `verbRegistry.execute(verbName, args)`), same as the current router.
- Optionally expose an interface so a future transmissions-lite engine could consume the same workflow descriptions.

### 5. **Extensibility (Planner/TODO integration)**
- Reserve a namespace for planner-related verbs (`plan`, `schedule`, `assign`), even if they’re stubs now.
- Document how to add a new verb: implement command + strategy, register via `VerbCommandRegistry`, reference in workflows.

## Transition Plan
1. Convert existing prompt workflows from legacy names to verb-based definitions (already in progress).
2. Introduce `workflows/` directory with declarative definitions for common scenarios (research analysis, ingestion, etc.).
3. Build a lightweight runner that uses `SimpleVerbsService` under the hood.
4. Update prompts to consume the JSON/Zod workflow definitions instead of inline arrays.
5. Iterate on features (conditions, loops) only as needed to keep the runner lean.

## Future-proofing
- Keep the workflow schema generic enough that a transmissions-lite adapter could load it (e.g. same field names, ability to reference external processors).
- Maintain clear separation between orchestration (runner + definitions) and execution (verbs/commands).
- Document the DSL so future contributors can add workflows without touching code.

## Sample Ingestion Workflows


### SPARQL to Memory Pipeline
```json
{
  "name": "sparql-document-ingestion",
  "description": "Fetch documents via SPARQL and push summaries into memory",
  "steps": [
    {
      "verb": "augment",
      "operation": "sparql_fetch",
      "args": {
        "template": "document-query",
        "variables": {
          "graph": "${graph}",
          "limit": "${limit}"
        }
      }
    },
    {
      "verb": "tell",
      "args": {
        "content": "${step_1.content}",
        "metadata": {
          "title": "${step_1.title}",
          "uri": "${step_1.uri}",
          "source": "sparql"
        },
        "type": "document",
        "lazy": true
      }
    }
  ]
}
```

### File → Markdown → Chunk → Ingest Pipeline
```json
{
  "name": "file-document-ingestion",
  "description": "Process local documents into Ragno corpus and store in SPARQL",
  "steps": [
    {
      "verb": "augment",
      "operation": "load_document",
      "args": {
        "path": "${filePath}"
      }
    },
    {
      "verb": "augment",
      "operation": "convert_pdf",
      "args": {
        "buffer": "${step_1.buffer}",
        "metadata": { "sourceFile": "${filePath}" }
      }
    },
    {
      "verb": "augment",
      "operation": "chunk_markdown",
      "args": {
        "markdown": "${step_2.markdown}",
        "metadata": "${step_2.metadata}"
      }
    },
    {
      "verb": "augment",
      "operation": "ingest_chunks",
      "args": {
        "chunkData": "${step_3}"
      }
    }
  ]
}
```

### File + Memory Summary Workflow
```json
{
  "name": "file-ingestion-with-summary",
  "description": "Process document into SPARQL and store summary in memory",
  "steps": [
    {
      "verb": "augment",
      "operation": "load_document",
      "args": { "path": "${filePath}" }
    },
    {
      "verb": "augment",
      "operation": "convert_pdf",
      "args": { "buffer": "${step_1.buffer}" }
    },
    {
      "verb": "augment",
      "operation": "chunk_markdown",
      "args": {
        "markdown": "${step_2.markdown}",
        "metadata": "${step_2.metadata}"
      }
    },
    {
      "verb": "augment",
      "operation": "ingest_chunks",
      "args": {
        "chunkData": "${step_3}"
      }
    },
    {
      "verb": "ask",
      "args": {
        "question": "Summarize ${step_2.metadata.sourceFile}"
      }
    },
    {
      "verb": "tell",
      "args": {
        "content": "${step_5.answer}",
        "metadata": {
          "source": "summary",
          "document": "${step_2.metadata.sourceFile}"
        }
      }
    }
  ]
}
```
