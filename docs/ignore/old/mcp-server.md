# Semem MCP Server

This document describes the Semem Model Context Protocol (MCP) server, which exposes Semem's semantic memory capabilities through Anthropic's MCP specification.

## What is MCP?

Model Context Protocol (MCP) is an open standard developed by Anthropic that enables AI applications to access external context, tools, and resources in a standardized way. It uses a client-server architecture where:

- **MCP clients** are AI models or applications that need to access data or functionality
- **MCP servers** provide standardized interfaces to various data sources and tools

MCP allows language models to seamlessly interact with external systems like databases, knowledge bases, and APIs through a standardized JSON-RPC protocol.

## MCP Server Architecture

The Semem MCP server implements the MCP 2025-03-26 specification and exposes the following MCP primitives:

### 1. Tools

Tools are functions that models can call to perform specific actions. The Semem MCP server provides the following tools:

- `memory.add`: Add a user-assistant interaction to the memory system
- `memory.retrieve`: Retrieve relevant memories based on a query
- `memory.search`: Search memory using vector similarity
- `embeddings.create`: Generate vector embeddings for text
- `concepts.extract`: Extract key concepts from text

### 2. Resources

Resources are data sources that provide information without side effects. The Semem MCP server exposes:

- `memory.stats`: Statistics about the memory system
- `memory.config`: Configuration of the memory system
- `server.info`: Information about the MCP server

### 3. Prompts

Prompts are predefined templates for using tools or resources efficiently. The server provides:

- `memory.search_template`: Template for searching semantic memory
- `memory.add_template`: Template for adding interactions to memory
- `concepts.extract_template`: Template for extracting key concepts from text

## Getting Started

### Prerequisites

- Node.js 20.11.0 or higher
- Semem dependencies configured (see main README)
- Running SPARQL endpoint if using SPARQL storage

### Installation

1. Make sure you have installed all Semem dependencies:

```bash
npm install
```

2. Configure environment variables in your `.env` file:

```
# MCP Server configuration
MCP_PORT=4040
LOG_LEVEL=info
```

3. Make the server executable:

```bash
chmod +x mcp-server.js
```

### Running the MCP Server

Start the MCP server:

```bash
./mcp-server.js
```

Or using npm:

```bash
node mcp-server.js
```

The server will start on port 4040 (or the port specified in your `.env` file with the MCP_PORT environment variable).

## Using the MCP Server

### MCP Discovery

To discover the capabilities of the MCP server, make a GET request to the MCP endpoint:

```bash
curl http://localhost:4040/mcp
```

This will return a JSON object describing the server's capabilities, including available tools, resources, and prompts.

### JSON-RPC Methods

The MCP server implements the following JSON-RPC methods:

#### 1. List Available Tools

```json
{
  "jsonrpc": "2.0",
  "id": "1",
  "method": "mcp.tools.list",
  "params": {
    "session_id": "optional-session-id"
  }
}
```

#### 2. List Available Resources

```json
{
  "jsonrpc": "2.0",
  "id": "2",
  "method": "mcp.resources.list",
  "params": {
    "session_id": "optional-session-id"
  }
}
```

#### 3. List Available Prompts

```json
{
  "jsonrpc": "2.0",
  "id": "3",
  "method": "mcp.prompts.list",
  "params": {
    "session_id": "optional-session-id"
  }
}
```

#### 4. Execute a Tool

```json
{
  "jsonrpc": "2.0",
  "id": "4",
  "method": "mcp.tools.execute",
  "params": {
    "session_id": "optional-session-id",
    "tool_id": "memory.add",
    "tool_params": {
      "user_input": "What is semantic memory?",
      "assistant_response": "Semantic memory stores general knowledge about the world."
    }
  }
}
```

#### 5. Get a Resource

```json
{
  "jsonrpc": "2.0",
  "id": "5",
  "method": "mcp.resources.get",
  "params": {
    "session_id": "optional-session-id",
    "resource_id": "memory.stats",
    "resource_params": {}
  }
}
```

#### 6. Get a Prompt Template

```json
{
  "jsonrpc": "2.0",
  "id": "6",
  "method": "mcp.prompts.get",
  "params": {
    "session_id": "optional-session-id",
    "prompt_id": "memory.search_template"
  }
}
```

### Example Client

The repository includes an example MCP client in `examples/MCPClientExample.js` that demonstrates how to interact with the MCP server.

To run the example:

```bash
node examples/MCPClientExample.js
```

## Integrating with AI Models

### Claude and Other MCP-Compatible Models

Claude 3.5 Sonnet and other MCP-compatible models can interact with the Semem MCP server directly. When configuring your Claude client:

1. Register the Semem MCP server URL
2. The model will be able to:
   - Retrieve information from semantic memory
   - Store new interactions in memory
   - Generate embeddings
   - Extract concepts

### Custom Client Integration

For custom integration:

1. Make HTTP requests to the MCP server endpoint
2. Use the JSON-RPC 2.0 protocol
3. Handle responses and errors appropriately

## Security Considerations

The MCP server provides access to your semantic memory system, which may contain sensitive information. Consider the following security measures:

1. **Authentication**: Implement proper authentication for the MCP server
2. **HTTPS**: Use HTTPS in production to encrypt communications
3. **Rate Limiting**: Implement rate limiting to prevent abuse
4. **Permissions**: Configure appropriate access controls

## Advanced Configuration

The MCP server supports advanced configuration through environment variables:

```
# Advanced MCP Server configuration
MCP_PORT=4040                 # Server port
LOG_LEVEL=info                # Logging level (debug, info, warn, error)
MCP_SESSION_TIMEOUT=3600000   # Session timeout in ms (default: 1 hour)
MCP_MAX_BATCH_SIZE=10         # Maximum batch request size
```

## Troubleshooting

### Common Issues

1. **Connection Refused**: Make sure the MCP server is running on the specified port
2. **Invalid Request**: Check that your JSON-RPC request follows the correct format
3. **Method Not Found**: Verify that you're using a supported MCP method
4. **Tool/Resource Not Found**: Check that the tool or resource ID is correct

### Logging

The MCP server uses the loglevel package for logging. Set the LOG_LEVEL environment variable to control logging verbosity:

- `debug`: Detailed debugging information
- `info`: General operational information
- `warn`: Warning messages
- `error`: Error messages only

## Contributing

Contributions to the Semem MCP server are welcome. Please follow the contribution guidelines in the main README.

## License

The Semem MCP server is licensed under the MIT license. See the LICENSE file for details.