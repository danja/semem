# Semantic Memory Workbench HOWTO

## Starting the Workbench

### Automatic Start (Recommended)
```bash
./start.sh
```
This starts all servers including the Semantic Memory Workbench at `http://localhost:8081`

### Manual Start
If you need to start just the workbench server:
```bash
cd src/frontend/workbench
PORT=8081 node server.js
```

### Stopping Servers
```bash
./stop.sh
```
This stops all servers including the workbench.

## Quick Start

The Semantic Memory Workbench provides an intuitive web interface for managing semantic memory using the 7 Simple Verbs methodology. Once started, access it at `http://localhost:8081`.

## Interface Overview

### Main Navigation
- **🧠 Semantic Memory**: Core operations (Tell, Ask, Navigate)
- **📊 System Monitor**: Performance and health metrics
- **⚙️ Settings**: Model and endpoint configuration

### Session Dashboard (Top Header)
- **Session Cache**: Real-time statistics for interactions, concepts, embeddings
- **Performance**: Operation counts and session timing
- **Connection**: Server connectivity status
- **ZPT State**: Current Zoom-Pan-Tilt navigation parameters

## Core Operations

### 📝 Tell - Store Knowledge
Store information in semantic memory:

1. **Content**: Enter text, concepts, or documents
2. **Type**: Choose Concept, Interaction, or Document
3. **Tags**: Add optional metadata tags
4. **Concept Preview**: See extracted concepts (when server connected)
5. **Store**: Click "💾 Store Content" to save

**Example**: Enter "Machine learning is a subset of AI" to store a concept.

### ❓ Ask - Query Knowledge
Search your semantic memory:

1. **Query**: Enter natural language questions
2. **Search**: Click "🔍 Search Knowledge" to retrieve answers
3. **Results**: View contextual responses based on stored knowledge

**Example**: Ask "What is machine learning?" to retrieve related stored concepts.

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
- **Semem MCP Server**: `http://localhost:4100` (default)
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
- Verify MCP server is running on port 4100
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

### Browser Compatibility
- **Required**: Modern browsers with ES modules support
- **Recommended**: Chrome 80+, Firefox 72+, Safari 13.1+, Edge 80+
- **Not Supported**: Internet Explorer

## Advanced Usage

### Integration with Backend
The workbench communicates with the MCP server via HTTP proxy:
- **POST /tell**: Store content and concepts in semantic memory
- **POST /ask**: Query knowledge with contextual responses
- **POST /augment**: Extract concepts and analyze text
- **POST /zoom, /pan, /tilt**: ZPT navigation operations
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
