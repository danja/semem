# Current Activity

Still moving fast. I think I'd better trim this down to an overview, shift the details over to [blog](https://tensegrity.it). After this -

Pulling together continues. To that end I've set up a couple more examples under `examples/beerqa` that populate the store with data from the [BeerQA](https://github.com/beerqa/IRRR/blob/main/scripts/download_qa_data.sh) dataset. That's intended for domain-independent QA so is a reasonable fit for getting this thing going. Right now the data is pretty much just bunged in, though embeddings & similarity search are already working.

One key part that wasn't actually in place before was the proper mapping of the ZPT navigation to RDF, it was all effectively hidden in programmatic code. Have made a spike on the code, untested as yet, and the queries & application yet to do.


---

Increased human intervention!

Docs : I'm in the process of pulling together up-to-date material under `docs/manual`.

A lot of code has been created ahead of me actually trying it out. So right now the priority is getting things into a more finished state. Debugging, rationalizing. Three avenues of exploration -

1. MCP wiring using STDIO is working with :
```sh
claude mcp add semem npx semem-mcp
```
(It may also work using the npm package `semem`)

so Claude code can be asked to use the tools, resources & prompts.

2. HTTP API

See docs/manual/http-api-endpoints.md

The HTTP server is proving difficult to debug. Ok, I admit I haven't looked at the code properly myself. Claude is finding it difficult.

3. The UI is only minimally functional. One key part is the SPARQL editor/visualizer. This should allow exploration of the knowledgebase via CONSTRUCT queries rendered as live graph diagrams. Impementation is virtually all straight from [atuin](https://github.com/danja/atuin) via the npm package.

4. Demos

The files under `examples` which exercise various components of the system are intentionally verbose in the output. Explore, explore.

There are many components that seem to work in isolation, but experimentation is needed to see how they can best be used in workflows. 

Using MCP in a Claude Code session, Claude does quite a good job of following a sequence.

(My long-term plan is to run workflows using [Transmissions](https://github.com/danja/transmissions), calling the HTTP API).

## Core

The ZPT functionality has been scaffolded, but only just went live against SPARQL data, so will need a lot of testing (and sanity checking).
docs/zpt/PLAN.md

## HTTP API

Most things are exposed, but the API is barely tested at all. There are demo files (quasi-integration tests) in `examples/http-api`.

*src/services is redundant now after updating src/api..?*

## MCP

There are about 60 tools/prompts/resources, it's certain only a fraction of these are worth exposing over MCP. Many will be buggy and suboptimal for their intended use. There is a lot under `examples/mcp` but chances are most things are broken.

Source is under `mcp` (TODO : move). The mcp material under `src/servers` is probably all cruft.

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