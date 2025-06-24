# HyDE and Seek

I have been developing recently by doing feature spikes then consolidating. It's dawned on me, quite a way down the road, that in Semem I did too much of the spike before the consolidate.

Yesterday I wanted to try Semem MCP with the online Claude chat ('Pro'). For this I needed to have the MCP server live online. But hit a snag - the default config uses Ollama locally for chat & embeddings. My server is weedy, Ollama would be too much. So I signed up for a Nomic account to use their free tier for embeddedings, flipped the priority completion LLM to Mistral's API.

I should have anticipated issues in this part of the config. I'd got the embeddings provider pretty much hardcoded. So I cycled back through [hyperdata-clients](https://github.com/danja/hyperdata-clients) to add a common interface, using a factory. (in the same way the chat LLM interface works).

So far so good. I was able to get embeddings using the Nomic API working in one of the examples.

But then as I went to an example that needed chat, it threw up loads of issues around the config setup. It tried to load the Mistral model through Ollama. Oops.

So to resolve this I went to an example that I knew had worked, `HyDE`, that uses responses from prompts as hypotheticals in subsequent similarity search.  
