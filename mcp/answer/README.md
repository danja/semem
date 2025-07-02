# Semem Answer MCP Tools

This directory contains MCP-capable versions of the Semem iterative feedback question answering system, based on `examples/flow/10-iterative-feedback.js`.

## Files

### `Answer.js` - Stdio MCP Server
- **Purpose**: Standalone MCP server using stdio transport
- **Tool**: `semem:answer`
- **Usage**: Direct stdio connection for MCP clients
- **Features**: Iterative feedback, Wikidata integration, multiple quality modes

### `AnswerHTTP.js` - HTTP MCP Server with Streaming
- **Purpose**: HTTP-based MCP server with streaming capabilities  
- **Tool**: `semem:answer`
- **Usage**: HTTP endpoints with optional streaming updates
- **Features**: SSE streaming, direct REST API, iterative feedback

## Tool: `semem:answer`

### Description
Answer a question using iterative feedback and the complete Semem knowledge processing pipeline.

### Parameters
```json
{
  "question": "Your question here?",
  "mode": "standard"  // "basic", "standard", or "comprehensive"
}
```

### Modes
- **basic**: 2 iterations, no Wikidata research
- **standard**: 3 iterations, with Wikidata research (default)
- **comprehensive**: 5 iterations, with full Wikidata research

### Response Format
```json
{
  "success": true,
  "question": "What is the capital of France?",
  "answer": "Comprehensive answer with iterative improvements...",
  "metadata": {
    "iterations": 3,
    "initialAnswer": "Basic answer...",
    "completenessImprovement": {
      "initial": 0.4,
      "final": 0.8,
      "improvement": 0.4
    },
    "followUpQuestions": 5,
    "entitiesDiscovered": 20,
    "mode": "standard",
    "duration": 8200
  }
}
```

## Usage Examples

### Stdio MCP Server
```bash
# Start the stdio server
node mcp/answer/Answer.js

# The server will provide the semem:answer tool via stdio transport
```

### HTTP MCP Server
```bash
# Start the HTTP server
node mcp/answer/AnswerHTTP.js

# Server runs on port 3002 (configurable via ANSWER_HTTP_PORT)
# Endpoints:
# - http://localhost:3002/mcp (MCP over SSE)
# - http://localhost:3002/answer (Direct REST API)
# - http://localhost:3002/health (Health check)
```

### Direct REST API Usage
```bash
# Basic question
curl -X POST http://localhost:3002/answer \
  -H "Content-Type: application/json" \
  -d '{"question": "What is quantum computing?"}'

# Comprehensive mode
curl -X POST http://localhost:3002/answer \
  -H "Content-Type: application/json" \
  -d '{"question": "Explain machine learning", "mode": "comprehensive"}'

# With streaming updates
curl -X POST http://localhost:3002/answer \
  -H "Content-Type: application/json" \
  -d '{"question": "What is AI?", "streaming": true}'
```

### Integration with Main MCP Server

The `semem:answer` tool is also available in the main MCP server (`mcp/index.js`):

```javascript
// The tool is automatically registered and available
// Use via any MCP client connected to the main server
```

## Architecture

Both servers follow the same core architecture:

1. **Configuration**: Load config from `./config/config.json`
2. **LLM Handler**: Initialize with provider priority (Mistral → Claude → Ollama)
3. **SPARQL Connection**: Connect to knowledge graph database
4. **Feedback Workflow**: Execute iterative feedback pipeline
5. **Response**: Return enhanced answer with metadata

### Flow Integration

The answer tools use the complete Flow pipeline:
- Stage 9: Enhanced answer generation with Wikidata
- Stage 10: Iterative feedback and refinement
- Full knowledge graph integration
- Embedding-based semantic search
- Community analysis and ranking

### Dependencies

- Flow Components (`src/compose/workflows/FeedbackWorkflow.js`)
- LLM Handlers (`src/handlers/LLMHandler.js`)
- Connectors (Mistral, Claude, Ollama)
- SPARQL Helper (`examples/beerqa/SPARQLHelper.js`)
- MCP SDK (`@modelcontextprotocol/sdk`)

## Configuration

### Environment Variables
```bash
# LLM API Keys
MISTRAL_API_KEY=your_mistral_key
CLAUDE_API_KEY=your_claude_key

# HTTP Server Port (AnswerHTTP.js only)
ANSWER_HTTP_PORT=3002
```

### Config.json Requirements
```json
{
  "llmProviders": [
    {
      "type": "mistral",
      "priority": 1,
      "capabilities": ["chat"],
      "chatModel": "mistral-large"
    }
  ],
  "sparqlUpdateEndpoint": "http://localhost:3030/semem/update",
  "sparqlAuth": {
    "user": "admin", 
    "password": "admin123"
  }
}
```

## Error Handling

All servers include comprehensive error handling:
- Invalid parameters → Clear error messages
- Configuration failures → Startup errors
- LLM failures → Graceful degradation
- SPARQL failures → Connection errors
- Workflow failures → Detailed error context

## Monitoring

### Health Checks
```bash
# HTTP server health check
curl http://localhost:3002/health
```

### Debug Logging
All servers use `mcpDebugger` for structured logging:
- Tool calls and parameters
- Configuration loading
- LLM initialization 
- Workflow progress
- Error details

## Testing

Test the tools with sample questions:

```bash
# Simple factual question
{"question": "What is the capital of Japan?"}

# Complex analytical question  
{"question": "How do neural networks learn?", "mode": "comprehensive"}

# Knowledge base specific question
{"question": "What topics are covered in the corpus?"}
```

The answer quality improves with higher modes and more iterations, providing progressively more comprehensive and well-researched responses.