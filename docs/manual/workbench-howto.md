# Semantic Memory Workbench HOWTO

## Starting the Workbench

### Automatic Start (Recommended)
```bash
./start.sh
```
This starts all servers including the Semantic Memory Workbench at `http://localhost:4102`

### Manual Start
If you need to start just the workbench server:
```bash
cd src/frontend/workbench
node server.js  # Uses port 4102 from config.json
```

### Stopping Servers
```bash
./stop.sh
```
This stops all servers including the workbench.

## Quick Start

The Semantic Memory Workbench provides an intuitive web interface for managing semantic memory using the 7 Simple Verbs methodology. Once started, access it at `http://localhost:4102`.

## Interface Overview

### Main Components
- **💬 Chat Interface**: Interactive conversational AI with semantic memory integration (left panel)
- **🧠 Semantic Memory Verbs**: Core operations organized as interactive columns (Tell, Ask, Augment, Navigate, Inspect)
- **📊 Session Dashboard**: Performance and health metrics (top header)

### Chat Interface (Left Panel)
- **Interactive Conversation**: Natural language chat with semantic memory awareness
- **Slash Commands**: Quick access to specific operations (/ask, /tell, /help)
- **Contextual Responses**: Answers informed by your stored knowledge
- **Enhanced Search**: Automatic fallback to external sources when no local context found

### Session Dashboard (Top Header)
- **Session Cache**: Real-time statistics for interactions, concepts, embeddings
- **Performance**: Operation counts and session timing
- **Connection**: Server connectivity status
- **ZPT State**: Current Zoom-Pan-Tilt navigation parameters

## Core Operations

### 💬 Chat - Interactive AI Assistant

The Chat interface provides a conversational way to interact with your semantic memory system. It's located in the left panel and offers both natural language conversation and command-based operations.

#### Natural Language Conversation
Simply type naturally and the AI will:
- **Understand Intent**: Automatically determine if you want to store information, ask questions, or have a general conversation
- **Use Your Knowledge**: Answers are informed by your personal knowledge base
- **Provide Context**: Responses include relevant information from your stored content
- **Fallback Intelligence**: When no relevant personal knowledge is found, provides general knowledge answers and offers enhanced search

#### Slash Commands
Use specific commands for direct operations:
- **`/ask [question]`**: Search your semantic memory
  - Example: `/ask What did I learn about machine learning?`
- **`/tell [information]`**: Store new information
  - Example: `/tell The meeting is scheduled for tomorrow at 2pm`
- **`/help`**: Show available commands and usage examples

#### Enhanced Search Feature
When the system can't find relevant information in your personal knowledge base:

1. **Fallback Response**: Provides answer based on general knowledge
2. **Enhancement Offer**: Asks if you want to search external sources
3. **Automatic Enhancement**: Responds "yes" to trigger search across:
   - **Wikipedia**: General knowledge articles
   - **Wikidata**: Structured knowledge entities
   - **HyDE**: Hypothetical Document Embeddings for better query expansion

**Example Enhanced Search Flow**:
```
You: "What is the capital of Kazakhstan?"
Chat: "Based on my general knowledge: Nur-Sultan (formerly Astana)...
       I couldn't find relevant information in your personal knowledge base. 
       Would you like me to search external sources for more comprehensive information?"
You: "yes"
Chat: "Based on enhanced search: Nur-Sultan, now officially called Astana again as of 2022..."
```

#### Usage Tips
- **Conversational**: Type naturally - "Tell me about..." or "What do you know about..."
- **Commands**: Use `/` prefix for specific operations
- **Context**: Your chat history provides context for follow-up questions
- **Enhanced Search**: Always available when personal knowledge is insufficient

### 📝 Tell - Store Knowledge
Store information in semantic memory:

1. **Content**: Enter text, concepts, or documents
2. **Type**: Choose Concept, Interaction, or Document  
3. **Tags**: Add optional metadata tags
4. **Concept Preview**: See extracted concepts (when server connected)
5. **Store**: Click "💾 Store Content" to save

> 📖 **Detailed Documentation**: For comprehensive Tell workflow details, architecture, and technical implementation, see [`docs/manual/tell.md`](tell.md) and the [Tell workflow diagram](tell.png).

#### 📄 Document Upload (Document Type)
When "Document" type is selected, additional upload controls appear:

1. **Select Type**: Choose "Document" from the type dropdown
2. **Upload File**: Click "📁 Select File" or drag-and-drop to upload area
3. **Supported Formats**: 
   - **PDF** (.pdf) - Processed via PDFConverter to markdown
   - **Text** (.txt) - Plain text documents  
   - **Markdown** (.md) - Markdown formatted documents
4. **Automatic Processing**:
   - File type automatically detected from extension
   - Content converted and processed via DocumentProcessor
   - Stored as `ragno:Unit` with `ragno:TextElement` entities in SPARQL
5. **Progress Tracking**: All upload steps logged to Console panel

**Example**: Upload a research paper PDF to add its content to your knowledge base.

**Text/Concept Example**: Enter "Machine learning is a subset of AI" to store a concept.

### ❓ Ask - Query Knowledge
Search your semantic memory with optional external enhancements:

1. **Query**: Enter natural language questions
2. **Enhancement Options**: Choose external knowledge sources:
   - **HyDE**: Hypothetical Document Embeddings for better query expansion
   - **Wikipedia**: Search Wikipedia for additional information
   - **Wikidata**: Query structured knowledge entities
3. **Search**: Click "🔍 Search Memory" to retrieve answers
4. **Results**: View contextual responses based on stored knowledge and enhancements

**Example**: Ask "What is machine learning?" to retrieve related stored concepts, or enable Wikipedia for broader context.

> 📖 **Detailed Documentation**: For comprehensive Ask workflow details, enhanced search features, and technical implementation, see [`docs/ASK.md`](../ask.md) and the [Ask workflow diagram](ask.png).

### 🧭 Navigate - Control Perspective
Adjust how you view the knowledge space using ZPT (Zoom-Pan-Tilt):

#### 🔍 Zoom - Abstraction Level
- **Entity**: Individual concepts and objects
- **Unit**: Semantic chunks and paragraphs  
- **Text**: Document-level view
- **Community**: Related concept clusters
- **Corpus**: Entire knowledge collection

#### 🎯 Pan - Domain Filters
- **Domains**: Filter by subject areas (e.g., "technology, science")
- **Keywords**: Filter by specific terms (e.g., "machine learning, AI")

#### 👁️ Tilt - View Style
- **Keywords**: Text-based concept view
- **Embedding**: Vector similarity view
- **Graph**: Network visualization
- **Temporal**: Time-based organization

## Settings Configuration

### 🤖 Models
Configure AI providers for chat completion and embeddings:

**Chat Models**:
- **Ollama**: Local models (qwen2:1.5b, llama3:8b)
- **Mistral AI**: Cloud service (mistral-small-latest, mistral-large-latest)
- **Anthropic Claude**: API access (claude-3-haiku, claude-3-sonnet)

**Embedding Models**:
- **Ollama**: Local embeddings (nomic-embed-text, all-minilm)
- **Nomic AI**: Cloud embeddings

### 🔗 Endpoints
Manage API endpoints:
- **Semem MCP Server**: `http://localhost:4101` (default)
- **Health Check**: Server connectivity monitoring

### 💾 Storage & Other Options
- **Backend Configuration**: SPARQL vs Memory storage
- **UI Preferences**: Theme, auto-save, performance monitoring
- **Memory Management**: Cache size limits, cleanup policies

## Advanced Operations

### 🔬 Augment - Concept Extraction
Analyze and extract semantic concepts from text:
1. **Expand Panel**: Click "Augment" panel header to open
2. **Enter Text**: Add content to analyze in the text area
3. **Extract**: Click "Extract Concepts" to identify key concepts
4. **Review Results**: See extracted entities and relationships

> 📖 **Detailed Documentation**: For comprehensive Augment workflow details, operation types, and technical implementation, see [`docs/manual/augment.md`](augment.md) and the [Augment workflow diagram](augment.png).

### 🗂️ Memory Explorer - Browse Stored Data
Explore your semantic memory:
1. **Recent**: View recently stored interactions and concepts
2. **Concepts**: Browse all extracted concepts by category
3. **Relationships**: See connections between stored entities

### 🔍 Inspect - Debug and Monitor
Debug session state and performance:
1. **Session Cache**: View current memory cache statistics
2. **Performance**: Monitor operation timing and efficiency
3. **Debug**: Access detailed system information

## Keyboard Shortcuts

- **Ctrl+1**: Switch to Semantic Memory tab
- **Ctrl+2**: Switch to System Monitor tab  
- **Ctrl+3**: Switch to Settings tab
- **Escape**: Clear/reset current tab content
- **F5/Ctrl+R**: Refresh workbench (prevented default browser refresh)

## Session Management

### Automatic Features
- **State Persistence**: Tab positions and form content saved automatically
- **Connection Monitoring**: Server health checked every 30 seconds
- **Performance Tracking**: Operation timing and statistics
- **Cache Management**: Interaction history and concept storage

### Manual Controls
- **🔄 Refresh**: Update session cache and connection status
- **🗑️ Clear**: Reset session cache and stored data
- **📤 Export Settings**: Backup configuration to JSON file
- **📥 Import Settings**: Restore configuration from backup

## Troubleshooting

### Common Issues

**Server Connection Failed**
- Verify MCP server is running on port 4101
- Check workbench server proxy configuration
- Use dashboard refresh to retry connection

**Interface Elements Not Loading**
- Ensure JavaScript is enabled in browser
- Check browser console for ES module errors
- Verify workbench server is serving files correctly

**Settings Not Persisting**
- Check browser localStorage permissions
- Use "💾 Save Changes" button in Settings
- Export settings as backup before changes

**Performance Issues**
- Monitor "Session Time" and "Operations" in dashboard
- Clear session cache with "🗑️" button
- Reduce result limits in Settings → Memory

**Document Upload Failures**
- Check file size limits (large PDFs may take longer to process)
- Verify file format is supported (.pdf, .txt, .md only)
- Monitor Console panel for detailed error messages
- Ensure SPARQL backend is available and connected

**Chat Not Responding**
- Verify MCP server is running and connected (check connection status in header)
- Ensure LLM provider is configured in Settings → Models
- Check that API keys are properly configured in environment variables
- Try refreshing the page or reconnecting to the server

**Enhanced Search Not Working**
- Verify internet connection for external knowledge sources
- Check that enhancement options are enabled in Ask verb or chat responds "yes"
- Monitor network tab for failed requests to Wikipedia/Wikidata APIs
- Ensure embedding provider is configured for HyDE functionality

### Browser Compatibility
- **Required**: Modern browsers with ES modules support
- **Recommended**: Chrome 80+, Firefox 72+, Safari 13.1+, Edge 80+
- **Not Supported**: Internet Explorer

## Advanced Usage

### Integration with Backend
The workbench communicates with the MCP server via HTTP proxy:
- **POST /chat**: Interactive conversation with semantic memory integration
- **POST /chat/enhanced**: Enhanced queries with external knowledge sources
- **POST /tell**: Store content and concepts in semantic memory
- **POST /ask**: Query knowledge with contextual responses and optional enhancements
- **POST /augment**: Extract concepts and analyze text
- **POST /upload-document**: Process and store PDF, TXT, MD documents
- **POST /zpt/navigate**: ZPT navigation operations with zoom/pan/tilt parameters
- **GET /health**: Check server connectivity and status

### Custom Configuration
Settings are stored in `localStorage` and synchronized with backend `Config.js`:
- **Frontend Settings**: UI preferences, session state
- **Backend Configuration**: Model providers, SPARQL endpoints, storage backends

### Development and Testing
- **Unit Tests**: Run `npm run test:frontend` for component tests
- **E2E Tests**: Run `npm run test:e2e -- tests/ui/e2e/frontend/WorkbenchSimplified.e2e.js`
- **Browser Console**: Access developer tools for JavaScript debugging
- **Network Tab**: Monitor API requests to MCP server
- **Performance Tab**: Profile UI performance and memory usage

---

*This interface provides a comprehensive semantic memory management system following the 7 Simple Verbs methodology for intelligent agent memory operations.*
