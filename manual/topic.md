# Topic Command

The `/topic` command derives a subject label and keywords from recent interaction and current ZPT context, then applies that label as a Pan filter for subsequent retrieval.

## Purpose

- Summarize the recent dialog into a topic label.
- Extract keywords (and concepts) to seed the Pan filter.
- Provide a lightweight way to steer memory search without manual filter setup.

## How It Works

1. Collects a small window of recent prompt/response pairs.
2. Extracts keywords using the local keyword extractor.
3. Extracts concepts via the LLM handler.
4. Calls the LLM with a topic-derivation prompt and expects JSON:
   - `label`: short subject label
   - `keywords`: list of keywords
5. Applies `pan` with `domains: [label]` and `keywords`.

Workbench document uploads will automatically call `/topic` using document content (or the first chunk) to align the session pan filter with the newly ingested material.

## Usage

In the workbench chat input:

```
/topic
```

You can also provide source text directly:

```
/topic <text to summarize>
```

## Response

The command returns a system message confirming the topic selection. The pan filter is then active for the session until changed or cleared.

## Related

- `docs/manual/zpt.md`
- `docs/manual/zpt-mcp.md`
- `docs/manual/context-management.md`
