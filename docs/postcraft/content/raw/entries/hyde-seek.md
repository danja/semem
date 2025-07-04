# HyDE and Seek

I have been developing recently by doing feature spikes then consolidating. It's dawned on me, quite a way down the road, that in Semem I did too much of the spike before the consolidate.

Yesterday I wanted to try Semem MCP with the online Claude chat ('Pro'). For this I needed to have the MCP server live online. But hit a snag - the default config uses Ollama locally for chat & embeddings. My server is weedy, Ollama would be too much. So I signed up for a Nomic account to use their free tier for embeddedings, flipped the priority completion LLM to Mistral's API.

I should have anticipated issues in this part of the config. I'd got the embeddings provider pretty much hardcoded. So I cycled back through [hyperdata-clients](https://github.com/danja/hyperdata-clients) to add a common interface, using a factory. (in the same way the chat LLM interface works).

So far so good. I was able to get embeddings using the Nomic API working in one of the examples.

But then as I went to an example that needed chat, it threw up loads of issues around the config setup. It tried to load the Mistral model through Ollama. Oops.

So to resolve this I went to an example that I knew had worked, `HyDE`, that uses responses from prompts as hypotheticals in subsequent similarity search. Long story short, it took a lot of cycles with Claude Code to get this working again *properly*.

But this involved changes to core code - `Config`, `MemoryManager`... and now there are several breaking tests. Time to cycle back through them.

Ok, tests fixed - they had a lot of hardcoding of strings. Next I need to cycle through the other examples to check. I need to do that anyway to see what each is actually doing. But there are 84 examples in total, I may leave it for today.
