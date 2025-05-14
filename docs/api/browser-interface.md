# Semem Browser Interface

The Semem API includes a browser-based interface that allows you to interact with all API endpoints through a user-friendly web UI. This document explains how to use the interface.

## Getting Started

To access the browser interface:

1. Start the Semem API server:

```bash
# Start the server
node api-server.js
```

2. Open your browser and navigate to:

```
http://localhost:3000
```

The server runs on port 3000 by default, but this can be changed with the `PORT` environment variable in your `.env` file.

## Interface Features

The browser interface provides tabbed access to all Semem API categories:

### 1. Search Tab

The Search tab allows you to search for content using semantic similarity:

- Enter your search query
- Adjust the number of results to return
- Set similarity threshold (0.0-1.0)
- Specify content types to include (optional)
- View formatted search results with similarity scores

### 2. Memory Tab

The Memory tab has two sections:

#### Store Memory
- Store interactions (prompt/response pairs) in semantic memory
- Add optional metadata as JSON
- Get confirmation with memory ID and extracted concepts

#### Search Memory
- Search memory for semantically similar interactions
- Adjust result count and similarity threshold
- View detailed memory search results

### 3. Chat Tab

The Chat tab provides conversation functionality with two modes:

#### Standard Chat
- Standard chat with memory context
- Adjust temperature for response generation
- Toggle memory usage on/off
- View conversation history

#### Streaming Chat
- Same functionality as standard chat, but with streaming responses
- See responses token by token as they're generated

### 4. Embeddings Tab

The Embeddings tab allows you to generate vector embeddings for text:

- Input text to embed
- Optionally specify embedding model
- View embedding statistics (dimensions, model)
- See preview of the embedding vector
- Copy the full vector to clipboard

### 5. Concepts Tab

The Concepts tab provides concept extraction functionality:

- Input text to analyze
- Generate key concepts using LLM extraction
- View extracted concepts as tags

### 6. Index Tab

The Index tab lets you add content to the search index:

- Add content with title and type
- Provide optional metadata as JSON
- Get confirmation with index ID

## API Connection Status

The footer shows the current API connection status:
- 🟢 Green - API Connected
- 🟡 Yellow - Checking API
- 🔴 Red - API Unavailable/Disconnected

## Console Logging

The interface includes extensive console logging for debugging purposes:
- API request/response details
- Error messages and stack traces
- Connection status changes

For detailed API information, refer to the OpenAPI specification and API implementation documentation.

## Development Mode

When running the server, authentication is bypassed for the browser interface in development mode. In production, you would need to provide API keys for authentication.

## Customization

The interface is built with vanilla JavaScript and can be customized by modifying files in the `public/` directory:
- `index.html` - HTML structure
- `styles.css` - CSS styling
- `script.js` - JavaScript functionality

## Troubleshooting

### API Connection Issues

If you see a red indicator with "API Unavailable" in the footer:

1. **Check Server Status**: Verify the Semem API server is running with `node api-server.js`.  
2. **Port Conflicts**: Ensure port 3000 (or your configured port) isn't being used by another application.
3. **CORS Issues**: The server is configured to allow all origins in development mode. If you're testing in production, verify CORS settings.
4. **Missing Dependencies**: Run `npm install` to ensure all required packages are installed.

### Server Startup Issues

If you encounter errors when starting the API server:

1. **Module Export Errors**: If you see errors about missing exports, check that you're using the correct import syntax for the module.
2. **Constructor Parameter Errors**: Components like CacheManager and others require specific parameters. Check the error message for details.
3. **Registry Errors**: The API uses a registry pattern for component management. Make sure components are properly registered.
4. **Memory or Embedding Issues**: Ensure that the OllamaConnector is properly initialized and that Ollama service is running.

### Ollama Issues

If memory or chat API endpoints fail with Ollama-related errors:

1. **Check Ollama Service**: Ensure Ollama is running on your machine.
2. **Model Availability**: Verify you have the required models installed:
   ```bash
   ollama list
   # If missing, install the models:
   ollama pull nomic-embed-text
   ollama pull qwen2:1.5b
   ```
3. **API Base URL**: Check that the `OLLAMA_API_BASE` in your .env matches where Ollama is running (default: http://localhost:11434).

### Browser Console Errors

The interface includes extensive console logging for troubleshooting:

1. Open your browser's developer tools (F12 or right-click + Inspect)
2. Go to the Console tab to check for specific errors
3. Look for API request failures, parsing errors, or connection issues

#### API Port Configuration

The browser interface now automatically detects if it's running on a different port than the default API port (3000). If it detects a different port, it will automatically set the API base URL to port 3000.

This auto-detection helps in development scenarios where you might be running the browser interface on a different port than the API server.

If you need to manually configure the API server address, you can update the `apiConfig.baseUrl` in the `script.js` file:

```javascript
// API configuration
const apiConfig = {
    baseUrl: '' // Empty string means same origin (default)
    // For specific servers, use absolute URL, e.g.: 'http://localhost:3000'
};
```

- When `baseUrl` is empty, the interface will:
  1. Use the same origin by default
  2. If the browser port differs from 3000, automatically set `baseUrl` to `http://hostname:3000`

- You can manually set `baseUrl` to a specific address when:
  - The API is on a different host (`'http://api-server:3000'`)
  - The API uses a non-standard port (`'http://localhost:4100'`)
  - The API is served over HTTPS (`'https://api.example.com'`)

#### Common Browser Console Errors

**Health check failed**: This usually indicates the API server isn't running or isn't accessible at the expected URL. The interface will show specific error messages:

- **API Timeout**: The connection timed out, suggesting the server might be overloaded or not running
- **API Unreachable**: A network error occurred while connecting to the server
- **API Unavailable**: General connection failure

To resolve these issues:
   - Make sure you started the server with `node api-server.js` or using the restart script `./restart-server.sh`
   - Confirm the server is running on port 3000 (check console logs)
   - Look for more detailed error messages in the browser console
   - Use the "Retry" button to check the connection again after fixing issues

**404 Not Found for API endpoints**: This can happen if:
- The server is running but the API routes aren't properly defined
- You're accessing the wrong server port
- The server is not correctly set up with the API handlers

### No Authentication Required in Development

For security, the API requires authentication in production environments. In development mode, authentication is automatically bypassed.

To use the API in production:
1. Set `NODE_ENV=production` in your .env file
2. Include the `X-API-Key` header in API requests with a valid API key
3. Configure a secure API key in your .env file