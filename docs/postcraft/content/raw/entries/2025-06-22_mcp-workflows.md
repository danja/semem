# Semem/Claude MCP Workflows

At least some of the Semem tools are now exposed over MCP.  They can be made available in Claude Code by using :
```sh
claude mcp add semem npx semem-mcp
```

Right now I really need to take a step back. I've got a lot of example files that have run at least once:
```sh
find ~/hyperdata/semem/examples -type f | wc -l
79
```
There's a good chance many of those no longer work following recent changes in places like the config. I got a bit impatient with tests.
```sh
Test Files  84 failed | 72 passed | 8 skipped (164)
Tests  589 failed | 1001 passed | 98 skipped (1688)
Errors  3 errors
```
Hmm, I see some are trying to call the Semem HTTP server. Ok, with it running :
```sh
Test Files  84 failed | 72 passed | 8 skipped (164)
Tests  590 failed | 1000 passed | 98 skipped (1688)
Errors  2 errors
```

Claude had a go at orchestrating workflows. I was curious to see if this might be a good approach because issuing a simple(ish) command like :
```prompt
run the enhanced-research-workflow tool on the content of brain-gpt-paper.md
```
\- would be a neat kind of interaction. But Claude got stuck at this level. After trying and failing to run the workflow directly, it went on to run the individual tools it uses. I asked for the list, below. This is informative. A little confusing because the naming has got a bit obfuscated that to some (unnecessary) name mapping Claude inserted in there. But I should be able to pick out the pieces, look at doing the same workflow using Semem's HTTP API, orchestrated by [Transmissions](https://github.com/danja/transmissions).

<blockquote>
Tool List in the Workflow

According to the search results, the enhanced-research-workflow tries to execute these tools in sequence:

1. semem_switch_storage_backend - Initialize SPARQL storage
2. research_ingest_documents - Enhanced document ingestion (custom tool)
3. semem_extract_concepts - Extract domain-focused concepts
4. ragno_decompose_corpus - Build knowledge graph with embeddings
5. ragno_analyze_graph - Comprehensive graph analysis
6. research_generate_insights - Generate insights (custom tool)
7. hybrid_search - Setup hybrid search capabilities (custom tool)
8. semem_generate_response - Generate executive summary
9. capture_user_feedback - Initialize feedback learning (custom tool)

Tool Mapping System

The workflow uses a tool mapping system located in:
File: /flow/hyperdata/semem/mcp/lib/workflow-orchestrator.js

This orchestrator maps workflow tool names to actual MCP tool implementations using the TOOL_MAPPING object and adds the mcp__semem__ prefix for standard tools.

Custom Tool Implementations

The custom tools (like research_ingest_documents, research_generate_insights, etc.) are implemented in:
File: /flow/hyperdata/semem/mcp/tools/research-workflow-tools.js

The error you encountered ("Required tool not available") occurs because the workflow orchestrator expects these custom tools to be available, but they may not be
properly registered or implemented in the current MCP server setup.
</blockquote>
There's also a log on my desktop under :
```
~/.cache/claude-cli-nodejs/-flow-hyperdata-semem/mcp-logs-semem
```
