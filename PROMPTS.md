# PROMPTS.md

## Purpose

This file contains example prompts for external LLMs (e.g., OpenAI, Anthropic, local models) to interact with Semem facilities via the MCP (Memory Control Protocol) server. These prompts are designed to help LLMs generate JSON-RPC requests that invoke Semem and Ragno pipeline services, including search, augmentation, embedding, and community detection.

---

## Example Prompts

### 1. Semantic Search
```
You are a memory agent. Given a user query, generate a JSON-RPC 2.0 request to the MCP server to perform a semantic search using the `searchGraph` method. Use the query as `queryText` and set `limit` to 5. Return only the JSON-RPC request.

```

### 2. LLM Completion
```
Generate a JSON-RPC request to call the `callLLM` method on the MCP server. Use the following prompt: "Summarize the key findings from the provided context." Provide an empty context array. Use systemPrompt: "You are a helpful assistant."
```

### 3. Embedding Generation
```
Create a JSON-RPC request to the MCP server for the `embedText` method. The text to embed is: "Semantic memory enables contextual retrieval."
```

### 4. SPARQL Query
```
Formulate a JSON-RPC request to the MCP server using the `sparqlQuery` method. The query should select all distinct entities of type `ragno:Attribute` from the default graph. Use endpoint: "http://localhost:4030/semem/query" and basic auth: user "admin", password "admin123".
```

### 5. Graph Augmentation
```
Given a JSON object representing a knowledge graph (entities, units, relationships), generate a JSON-RPC request for the `augmentGraph` method on the MCP server. The graph object should be passed as the `graph` parameter.
```

### 6. Community Detection
```
Generate a JSON-RPC request to the MCP server for the `discoverCommunities` method, passing a graph object as the `graph` parameter. The response should include detected communities and LLM-generated summaries.
```

---

## Guidance
- Always return a valid JSON-RPC 2.0 request object.
- Use method names exactly as specified (e.g., `searchGraph`, `callLLM`).
- For authentication, include credentials in the params if required by the endpoint.
- For graph operations, use the schema expected by Semem/Ragno (entities, units, relationships arrays).
- Do not include explanations or extra text—return only the JSON-RPC request.
