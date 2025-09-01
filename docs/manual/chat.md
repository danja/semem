# Chat Interface

The Semem Chat interface provides an intuitive way to interact with the semantic memory system through natural language and slash commands. It's integrated into the Workbench UI and accessible via the MCP HTTP API.

## Overview

The chat interface serves as the primary user interaction point for the Semem system, offering:

- **Natural Language Processing**: Intelligent interpretation of user intentions
- **Slash Commands**: Direct access to core system functions
- **Automatic File/URL Ingestion**: Smart routing for document processing
- **Real-time Feedback**: Immediate responses with detailed system information

## Accessing the Chat Interface

### Via Workbench UI
Start the workbench and navigate to `http://localhost:4102`:
```bash
./start.sh
```

The chat interface is prominently positioned at the top center of the workbench screen, labeled "Semem".

### Via HTTP API
Direct API access at the `/chat` endpoint:
```bash
curl -X POST http://localhost:4201/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "/help"}'
```

## Slash Commands

### /help
Shows available commands and usage examples.
```
/help
```

### /ask [query]
Search your semantic memory for information.
```
/ask What did I learn about machine learning?
/ask Show me documents about semantic web
/ask Find information related to knowledge graphs
```

### /tell [information]
Store new information in your semantic memory.

#### Basic Usage
```
/tell The project deadline is next Friday
/tell Meeting notes: discussed API integration and testing strategy
```

#### Automatic File/URL Ingestion
The `/tell` command automatically detects and processes files and URLs:

**URL Processing:**
```
/tell https://example.com/research-paper.pdf
/tell Process this document: https://docs.google.com/document/d/123abc
```

**File Path Processing:**
```
/tell ./reports/quarterly-analysis.xlsx
/tell /absolute/path/to/document.pdf
/tell ~/Documents/meeting-notes.md
```

**Mixed Content:**
```
/tell Analyze https://example.com/data.csv and compare with ./local/backup.json
```

## Natural Language Interface

Beyond slash commands, the chat interface uses LLM inference to interpret natural language and route to appropriate system functions.

### Examples

**Natural Ask Queries:**
```
What information do we have about the project timeline?
Can you find documents related to user authentication?
Show me everything about semantic web technologies
```

**Natural Tell Commands:**
```
Remember that the API key expires on December 15th
The client prefers REST over GraphQL for the integration
Store this information: the database migration is scheduled for next week
```

## Response Types

### Command Responses
- **Success Messages**: Confirmation of successful operations
- **Error Messages**: Clear error descriptions with suggestions
- **System Information**: Detailed routing and processing information

### Routing Information
Each response includes routing details:
- `routing: 'tell_command'` - Standard tell operation
- `routing: 'tell_ingest_url'` - URL processed for document ingestion
- `routing: 'tell_ingest_file'` - File path detected and referenced
- `routing: 'ask_command'` - Memory search performed

### Example Response Structure
```json
{
  "success": true,
  "messageType": "tell_ingest_result",
  "content": "URL processed and content ingested: \"https://example.com/doc.pdf\"",
  "routing": "tell_ingest_url",
  "target": "https://example.com/doc.pdf",
  "timestamp": "2025-01-01T12:00:00.000Z"
}
```

## File and URL Processing

### Supported URL Formats
- HTTP/HTTPS URLs: `http://example.com/doc.pdf`
- URLs with query parameters: `https://site.com/file.pdf?version=1.2`
- URLs with fragments: `https://docs.com/page#section1`

### Supported File Path Formats
- Relative paths: `./documents/file.pdf`, `../data/report.xlsx`
- Absolute paths: `/home/user/document.txt`
- Home directory paths: `~/Documents/notes.md`
- Windows paths: `C:\Users\Name\file.docx`

### Processing Behavior
- **URLs**: Full document processing via DocumentProcessor
- **File Paths**: Reference storage with metadata (use upload-document endpoint for full processing)
- **Priority**: URLs are processed first when both URLs and file paths are present

## Configuration

### System Prompts
Chat behavior is configured via system prompts in `prompts/system/chat.md`. The system prompt defines:
- Response tone and style
- Command routing logic
- Natural language interpretation guidelines

### LLM Integration
The chat interface uses the configured LLM providers from your `config.json`:
- Supports Mistral, Claude, and Ollama providers
- Automatic fallback to available providers
- Priority-based provider selection

## Error Handling

### Common Issues
- **LLM Service Not Available**: Check provider configuration in `config.json`
- **File Not Found**: Verify file paths exist before processing
- **URL Processing Errors**: Network connectivity or invalid URLs
- **Authentication Errors**: Check API keys for external providers

### Fallback Behavior
- Document processing failures fall back to regular tell operations
- Provider unavailability triggers graceful degradation
- Network errors are reported with actionable error messages

## Integration with Other Systems

### MCP (Model Context Protocol)
The chat interface is fully integrated with MCP, allowing:
- Tool calling for complex operations
- Resource access and management
- Cross-system communication

### SPARQL Storage
All chat interactions can be stored in the SPARQL backend:
- Message history preservation
- Semantic relationship extraction
- Full-text search capabilities

### SimpleVerbs Service
Core operations (tell, ask, augment) are handled through the SimpleVerbs architecture:
- Consistent API across all interfaces
- Centralized business logic
- Extensible service framework

## Best Practices

### Effective Usage
1. **Use Descriptive Context**: Provide clear, specific information in tell commands
2. **Leverage Auto-Detection**: Let the system automatically route files and URLs
3. **Natural Language**: Don't hesitate to use conversational language
4. **Check Responses**: Review routing information to understand system behavior

### Performance Considerations
- Large file processing may take time
- URL ingestion depends on network speed and remote server response
- Complex queries benefit from specific terminology

### Security Notes
- URL processing validates remote content
- File paths are checked for existence and accessibility
- API keys and sensitive information are never logged or stored in plain text

## Troubleshooting

### Common Problems

**Chat Not Responding:**
- Check server status at `http://localhost:4201/health`
- Verify LLM provider configuration
- Review server logs for error messages

**File Processing Issues:**
- Ensure file paths are correct and accessible
- Check file permissions
- Verify supported file formats

**URL Ingestion Problems:**
- Test URL accessibility in browser
- Check network connectivity
- Verify remote server allows automated access

### Debug Mode
Enable debug logging by setting environment variables:
```bash
NODE_ENV=development
DEBUG=semem:chat
```

## API Reference

### Chat Endpoint
```
POST /chat
Content-Type: application/json

{
  "message": "string",
  "context": {} // optional
}
```

### Response Format
```json
{
  "success": boolean,
  "messageType": string,
  "content": string,
  "routing": string,
  "timestamp": string,
  "originalMessage": string, // optional
  "target": string, // optional for file/URL processing
  "processingResult": object // optional
}
```

See also:
- [Tell Operations](tell.md)
- [Ask Operations](ask.md) 
- [Workbench How-To](workbench-howto.md)
- [HTTP API Endpoints](http-api-endpoints.md)