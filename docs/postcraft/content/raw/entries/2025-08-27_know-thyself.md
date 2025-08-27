# Semem, Know Thyself

In use, [Semem]() is mostly intended to manage memories accumulated on the fly, relevant to the task at hand. A combination of uploaded docs, interaction history and inferences made. But background knowledge is desirable. Ok, there will be plenty provided by the LLM in use by Semem and there are external connectors to query Wikipedia and Wikidata. But that leaves the question of more local, maybe project-specific info. How does that get into the system? What if we want Semem to be aware of its own documentation?

## SPARQL Store as Integration Point

Semem has facilities for querying SPARQL stores - it's a big part of the core functionality, that's where the knowledge graphs live. So if the material of interest can be placed in such a store, it should be relatively straightforward to access.

Another project in the [Tensegrity Stack](https://github.com/danja/tensegrity) is [Transmissions](https://github.com/danja/transmissions), my pipeliney thing. And guess what, I've already got a pipeline for walking a directory tree, looking for markdown files and POSTing them into a SPARQL store.

Claude Code has helped me put together the code to pull data from a remote SPARQL store into that of Semem. In this particular instance Semem is using a local Fuseki store, the same one I'm using with Transmissions locally. Named graphs are used to keep things independent. This does mean there'll be redundancy, but I think it'll be worth it for the sake of loose coupling.

```sh
node examples/ingestion/SPARQLIngest.js \
  --endpoint "http://localhost:3030/semem/query" \
  --template blog-articles \
  --graph "http://tensegrity.it/semem"
```

## Markdown to SPARQL Store

Note to self, these are the bits I've created (in the Semem codebase) for the Transmissions side of the operation.

* `./del-semem-graph.sh` - utility to clear the graph, this is handy for testing
* `docs/tt.ttl` - the configuration (paths, graph names etc) for the Transmission
* `docs/endpoints.json` - the store defn
* `scripts/transmissions.sh` - this runs the Transmission pipeline `md-to-sparqlstore`, all it contains is :
```sh
cd ~/hyperdata/transmissions # my local path
./trans -v md-to-sparqlstore ~/hyperdata/semem/docs
```

The Transmissions part worked ok (confirmed by querying the store via Fuseki's UI). Right now the ingestion part is running. It is taking *a very long time*.

I've far from finished confirming that all the parts of the system are working correctly. A meta-issue is that the **operations are really slow**. This is understandable - there's a lot going on, what with SPARQL queries, embeddings being juggled as well as remote LLM chat completion calls (I'm using Mistral free tier). My next step has to be to set up some metrics, locate the bottlenecks... Ha, is a bit obvious without looking - remote LLM calls. I need to figure out which of these have to happen in real time, which I can have running in the background (queue/scheduler needed).
