# INTERACTIONS.md

This document shows a sample conversation between a user (or LLM agent) and the MCP REPL (`examples/REPL.js`). It demonstrates discoverability, parameter entry, error handling, and interaction with live MCP endpoints.

---

**User starts the REPL:**

```shell
$ node examples/REPL.js
```

**REPL:**
```
Available MCP actions:
- callLLM: Call LLMHandler (Call LLM for completions, summaries, or concept extraction. Params: {prompt, context, systemPrompt})
- embedText: Generate Embedding (Generate embeddings for text. Params: {text})
- sparqlQuery: SPARQL SELECT Query (Run a SPARQL SELECT query. Params: {endpoint, query, auth})
- sparqlUpdate: SPARQL UPDATE (Run a SPARQL UPDATE. Params: {endpoint, query, auth})
- searchGraph: Semantic Search (Semantic search using embeddings and Faiss. Params: {queryText, limit})
- augmentGraph: Graph Attribute Augmentation (Augment a graph with LLM-generated attribute summaries. Params: {graph, options})
- discoverCommunities: Community Detection (Detect and summarize communities in a graph. Params: {graph, options})

Type the method name (e.g. 'searchGraph'), or 'help' for suggestions, or 'exit' to quit.
MCP> 
```

---

**User:** `searchGraph`

**REPL:**
```
Enter params as JSON for searchGraph (or leave blank for defaults):
Params> { "queryText": "What are the main themes in the latest research articles?", "limit": 3 }
Result: {
  "jsonrpc": "2.0",
  "id": 1234,
  "result": [
    {
      "score": 0.91,
      "text": "Recent research on graph neural networks focuses on ..."
    },
    {
      "score": 0.88,
      "text": "Key themes include explainability, scalability, ..."
    },
    {
      "score": 0.85,
      "text": "Applications to chemistry and social networks ..."
    }
  ]
}
MCP> 
```

---

**User:** `augmentGraph`

**REPL:**
```
Enter params as JSON for augmentGraph (or leave blank for defaults):
Params> { "graph": { "entities": [ { "name": "Alice" }, { "name": "Bob" } ], "units": [ { "text": "Alice is a data scientist.", "entities": ["Alice"] }, { "text": "Bob is a software engineer.", "entities": ["Bob"] } ], "relationships": [ { "source": "Alice", "target": "Bob", "description": "Colleagues" } ] } }
Result: {
  "jsonrpc": "2.0",
  "id": 5678,
  "result": {
    "attributes": [
      {
        "text": "Alice is a data scientist who collaborates with Bob.",
        "summary": "Alice is a data scientist who collaborates with Bob.",
        "entity": "Alice",
        "provenance": "augmented by LLM"
      },
      {
        "text": "Bob is a software engineer working with Alice.",
        "summary": "Bob is a software engineer working with Alice.",
        "entity": "Bob",
        "provenance": "augmented by LLM"
      }
    ]
  }
}
MCP> 
```

---

**User:** `unknownMethod`

**REPL:**
```
Unknown method: unknownMethod

Available MCP actions:
- callLLM: Call LLMHandler (...)
- ...

Type the method name (e.g. 'searchGraph'), or 'help' for suggestions, or 'exit' to quit.
MCP> 
```

---

**User:** `help`

**REPL:**
```
Available MCP actions:
- callLLM: Call LLMHandler (...)
- ...

Type the method name (e.g. 'searchGraph'), or 'help' for suggestions, or 'exit' to quit.
MCP> 
```

---

**User:** `exit`

**REPL:**
```
[REPL exits]
```

---

This interaction demonstrates a natural, discoverable, and robust conversation between a user/agent and the MCP REPL, including error handling, guidance, and live endpoint invocation.
