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
PORT=8081 node server.cjs
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
- **🔧 SPARQL Browser**: RDF editing and SPARQL queries

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
Manage SPARQL endpoints:
- **Local**: `http://localhost:3030/sparql`
- **Wikidata**: `https://query.wikidata.org/sparql`
- **DBpedia**: `https://dbpedia.org/sparql`

### 💾 Storage & Other Options
- **Backend Configuration**: SPARQL vs Memory storage
- **UI Preferences**: Theme, auto-save, performance monitoring
- **Memory Management**: Cache size limits, cleanup policies

## SPARQL Browser

### Basic Mode (Without Atuin)
When Atuin components are not installed:
- **RDF Editor**: Basic text editing for Turtle/RDF content
- **SPARQL Query**: Simple query editor with execute functionality
- **Sample Content**: Pre-loaded example data for testing

### Enhanced Mode (With Atuin)
Install with `npm install atuin evb` for full features:
- **Syntax Highlighting**: Color-coded RDF and SPARQL editing
- **Real-time Validation**: Instant syntax error detection
- **Graph Visualization**: Interactive network graphs of RDF data
- **Query Clips**: Save and reuse common SPARQL queries
- **Endpoint Management**: Visual SPARQL endpoint selection

### Working with RDF Data
1. **Load Sample**: Use pre-loaded semantic web example data
2. **Edit Content**: Modify Turtle RDF syntax in the editor
3. **Validate**: Check syntax before visualization
4. **Visualize**: Generate interactive graph from RDF content
5. **Export**: Save RDF content to `.ttl` files

### SPARQL Queries
1. **Select Endpoint**: Choose from configured SPARQL services
2. **Write Query**: Use SPARQL syntax in the query editor
3. **Execute**: Run query against selected endpoint
4. **View Results**: See JSON results in the results panel

## Keyboard Shortcuts

- **Ctrl+1**: Switch to Semantic Memory tab
- **Ctrl+2**: Switch to System Monitor tab  
- **Ctrl+3**: Switch to Settings tab
- **Ctrl+4**: Switch to SPARQL Browser tab
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
- Verify semantic memory server is running on port 3001
- Check Settings → Endpoints for correct API URL
- Use "🔄 Refresh" to retry connection

**SPARQL Browser Limited Functionality**
- Install Atuin components: `npm install atuin evb`
- Restart browser after installation
- Verify imports in browser developer console

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
The workbench communicates with the semantic memory server via REST API:
- **POST /tell**: Store content and concepts
- **POST /ask**: Query knowledge with context
- **POST /zoom, /pan, /tilt**: ZPT navigation operations
- **GET /inspect**: Retrieve session and memory statistics

### Custom Configuration
Settings are stored in `localStorage` and synchronized with backend `Config.js`:
- **Frontend Settings**: UI preferences, session state
- **Backend Configuration**: Model providers, SPARQL endpoints, storage backends

### Development and Testing
- **Playwright Tests**: Run `npx playwright test tests/ui/e2e/frontend/WorkbenchCore.e2e.js`
- **Browser Console**: Access `window.workbench` for debugging
- **Network Tab**: Monitor API requests and responses
- **Performance Tab**: Profile UI performance and memory usage

---

*This interface provides a comprehensive semantic memory management system following the 7 Simple Verbs methodology for intelligent agent memory operations.*