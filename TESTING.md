# Testing Semem UI and Chat API

This document provides instructions for testing the UI and Chat API of the Semem system.

## Prerequisites

Before testing, make sure you have:

1. Properly set up environment variables or a config file
2. SPARQL endpoint running (Apache Fuseki recommended)
3. LLM service available (Claude API access or Ollama with required models)

## Starting the Server

```bash
# Start with default configuration
node ui-server.js

# Or with a custom configuration file
node ui-server.js config.json
```

## Testing the API Directly

You can test the API endpoints directly using the provided test script:

```bash
# Make sure the script is executable
chmod +x test-chat-api.js

# Run the test script
./test-chat-api.js
```

This script will:
1. Check the API health
2. Test the standard chat endpoint
3. Test chat with search context interjection 
4. Test the streaming chat endpoint

## Testing in the Browser

1. Open your browser and navigate to http://localhost:4100
2. Navigate to the "Chat" tab
3. Enter a message and press Send

### Advanced Browser Testing

For more advanced testing in the browser, open the developer console and include our test script:

```javascript
// Load the test script
const script = document.createElement('script');
script.src = 'test-chat.js';
document.head.appendChild(script);

// After it loads, run the test
setTimeout(() => testChat(), 500);
```

This will:
1. Add the search context checkbox to the UI
2. Submit a test message that will use search context interjection
3. Display the results including any sources found

## LLM Provider Priority

The system will try to use LLM providers in this order:

1. Claude via hyperdata-clients (requires CLAUDE_API_KEY in environment)
2. Ollama (requires local Ollama server running)
3. Claude via direct API (requires CLAUDE_API_KEY in environment)
4. OpenAI (not fully implemented)

## Configuration Options

You can modify `config.sample.json` and save it as `config.json` to customize the system, including:

- SPARQL endpoints to use (with fallback)
- LLM providers and their priorities
- Port and graph name settings

## Troubleshooting

If tests fail, check:

1. Environment variables (especially API keys)
2. SPARQL endpoint availability and connection
3. LLM service availability and connection
4. Server logs for detailed error messages