# Current Activity

Increased human intervention!

A lot of code has been created ahead of me actually trying it out. So right now the priority is getting things into a more finished state. Debugging, rationalizing. Three avenues of exploration -

1. MCP wiring is working with :
```sh
claude mcp add semem npx semem-mcp
```
(It may also work using the npm package `semem`)

so Claude code can be asked to use the tools, resources & prompts.

2. The UI is only minimally functional. One key part is the SPARQL editor/visualizer. I put together [Atuin](https://github.com/danja/atuin) with exactly this kind of scenario in mind. Despite my best efforts to make it easy to reuse (as an npm package which exposes about everything) it has still been a struggle with Claude Code.

3. Demos

The files under `examples` which exercise various components of the system are intentionally verbose in the output. Explore, explore.

There are many components that seem to work in isolation, but experimentation is needed to see how they can best be used in workflows. Using MCP in a Claude Code session, Claude does quite a good job of following a sequence.

(My long-term plan is to run workflows using [Transmissions](https://github.com/danja/transmissions), calling the HTTP API).

## Core

The ZPT functionality has been scaffolded, but only just went live against SPARQL data, so will need a lot of testing (and sanity checking).
docs/zpt/PLAN.md

## HTTP API

Need to find out which pieces of functionality aren't yet exposed - and expose them.

## MCP

There are about 60 tools/prompts/resources, it's certain only a fraction of these are worth exposing over MCP. Many will be buggy and suboptimal for their intended use.

## UI

It should also be possible to have fun with this.

## Things for later

I do have plans