# Current Activity

Increased human intervention!

A lot of code has been created ahead of me actually trying it out. So right now the priority is getting things into a more finished state. Debugging, rationalizing. Three avenues of exploration -

1. MCP wiring using STDIO is working with :
```sh
claude mcp add semem npx semem-mcp
```
(It may also work using the npm package `semem`)

so Claude code can be asked to use the tools, resources & prompts.

The HTTP server is proving difficult to debug. Ok, I admit I haven't looked at the code properly myself. Claude is finding it difficult.

2. The UI is only minimally functional. One key part is the SPARQL editor/visualizer. I put together [Atuin](https://github.com/danja/atuin) with exactly this kind of scenario in mind. Despite my best efforts to make it easy to reuse (as an npm package which exposes about everything) it has still been a struggle with Claude Code.

3. Demos

The files under `examples` which exercise various components of the system are intentionally verbose in the output. Explore, explore.

There are many components that seem to work in isolation, but experimentation is needed to see how they can best be used in workflows. Using MCP in a Claude Code session, Claude does quite a good job of following a sequence.

(My long-term plan is to run workflows using [Transmissions](https://github.com/danja/transmissions), calling the HTTP API).

## Core

The ZPT functionality has been scaffolded, but only just went live against SPARQL data, so will need a lot of testing (and sanity checking).
docs/zpt/PLAN.md

## HTTP API

Most things are exposed, but the API is barely tested at all. There are demo files (quasi-integration tests) in `examples/http-api`.

## MCP

There are about 60 tools/prompts/resources, it's certain only a fraction of these are worth exposing over MCP. Many will be buggy and suboptimal for their intended use. There is a lot under `examples/mcp` but chances are most things are broken.

...
```sh
  Using model configuration: { chatModel: 'mistral-small-latest', embeddingModel: 'nomic-embed-text-v1.5' }

  The MCP service is now running with the correct remote provider configuration - Mistral for chat operations and Nomic for embeddings, exactly as specified in your config.json
  priorities.
```
> call a couple of appropriate mcp tools to demonstrate
```sh
  claude:Task (MCP)(description: "Test MCP memory operations", prompt: "Use the semem MCP tools to demonstrate the memory system working with remote providers. First use
                   semem:memory_store to store a test memory about \"semantic web technologies and RDF\", then use semem:memory_search to find related memories. This will verify that both
                    the Mistral chat provider and Nomic embedding provider are working correctly through the MCP interface.")

● claude:Task (MCP)(description: "Test Ragno knowledge extraction", prompt: "Use the semem MCP ragno tools to demonstrate knowledge graph functionality. Use ragno:decompose_corpus to
                   extract entities and relationships from a short text about \"Machine learning algorithms use mathematical models to identify patterns in data.\" This will test the LLM
                   provider integration for concept extraction and relationship identification.")
```

  echo '{"method": "tools/list"}' | npx @modelcontextprotocol/cli call mcp://localhost:3000
  
## UI

It should also be possible to have fun with this.

## Things for later

I do have plans