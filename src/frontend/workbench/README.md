# Semantic Memory Workbench

A modern web interface for the Semantic Memory (Semem) system, implementing the **7 Simple Verbs** methodology for intuitive knowledge management and navigation.

## Overview

The Semantic Memory Workbench provides a user-friendly interface for interacting with the Semem MCP (Model Context Protocol) server. It implements the ZPT (Zoom-Pan-Tilt) navigation paradigm for exploring knowledge spaces with different levels of abstraction and filtering.

### 7 Simple Verbs

1. **Tell** - Store knowledge and concepts in semantic memory
2. **Ask** - Query stored knowledge with contextual search
3. **Navigate** - Control perspective with ZPT (Zoom-Pan-Tilt) controls
4. **Augment** - Extract concepts and analyze content
5. **Inspect** - Debug and monitor system state

Secondary verbs (expandable panels):
- **Zoom** - Set abstraction level (entity, unit, text, community, corpus)
- **Pan** - Apply domain and keyword filters
- **Tilt** - Choose view representation (keywords, embedding, graph, temporal)

## Quick Start

### Prerequisites

- Node.js 18+ with ES modules support
- Semem MCP server dependencies installed
- Required API keys configured (MISTRAL_API_KEY, CLAUDE_API_KEY, etc.)

### Starting the Workbench

```bash
# From the semem project root
./src/frontend/workbench/start.sh
```

This will:
1. Start the MCP HTTP server on port 3000
2. Start the Workbench server on port 8081
3. Test API connectivity
4. Display access URLs and process information

### Access URLs

- **Workbench UI**: http://localhost:8081
- **MCP Inspector**: http://localhost:3000/inspector
- **Health Checks**:
  - Workbench: http://localhost:8081/health
  - MCP Server: http://localhost:3000/health

### Stopping the Workbench

```bash
# Stop all services
./src/frontend/workbench/stop.sh

# Stop and clean up logs
./src/frontend/workbench/stop.sh --clean-logs
```

## Architecture

### Components

- **Express Server** (`server.js`) - Serves static files and proxies API requests
- **Frontend Application** (`public/js/workbench.js`) - Main application orchestration
- **API Service** (`public/js/services/ApiService.js`) - MCP HTTP communication
- **State Manager** (`public/js/services/StateManager.js`) - ZPT navigation and session state
- **DOM Utilities** (`public/js/utils/DomUtils.js`) - Helper functions for UI interactions

### File Structure

```
src/frontend/workbench/
├── server.js                 # Express server with MCP proxy
├── start.sh                  # Startup script
├── stop.sh                   # Shutdown script
├── public/
│   ├── index.html            # Main UI structure
│   ├── styles/
│   │   ├── workbench.css     # Base styles and layout
│   │   └── components.css    # Component-specific styles
│   └── js/
│       ├── workbench.js      # Main application
│       ├── services/
│       │   ├── ApiService.js # MCP API client
│       │   └── StateManager.js # State management
│       └── utils/
│           └── DomUtils.js   # DOM helper functions
└── README.md                 # This file
```

## API Endpoints

The workbench proxies requests to the MCP server through `/api/*` routes:

### Simple Verbs REST API

#### Tell - Store Content
```http
POST /api/tell
Content-Type: application/json

{
  "content": "JavaScript is a programming language",
  "type": "concept",           // "concept" | "interaction" | "document"
  "metadata": {
    "tags": ["programming", "web"]
  }
}
```

#### Ask - Query Knowledge
```http
POST /api/ask
Content-Type: application/json

{
  "question": "What is JavaScript?",
  "mode": "standard",          // "basic" | "standard" | "comprehensive"
  "useContext": true
}
```

#### Augment - Analyze Content
```http
POST /api/augment
Content-Type: application/json

{
  "target": "Text to analyze for concepts",
  "operation": "auto",         // "auto" | "concepts" | "attributes" | "relationships"
  "options": {}
}
```

### ZPT Navigation API

#### Zoom - Set Abstraction Level
```http
POST /api/zoom
Content-Type: application/json

{
  "level": "unit",             // "entity" | "unit" | "text" | "community" | "corpus"
  "query": "optional query"
}
```

#### Pan - Apply Filters
```http
POST /api/pan
Content-Type: application/json

{
  "domains": ["AI", "technology"],
  "keywords": ["machine learning", "neural networks"],
  "entities": ["specific entity names"],
  "temporal": {},
  "query": "optional query"
}
```

#### Tilt - Set View Style
```http
POST /api/tilt
Content-Type: application/json

{
  "style": "graph",            // "keywords" | "embedding" | "graph" | "temporal"
  "query": "optional query"
}
```

### State and Health

#### Get Current State
```http
GET /api/state
```

#### Health Check
```http
GET /api/health
```

## Usage Guide

### Basic Workflow

1. **Start the workbench** using the start script
2. **Open the web interface** at http://localhost:8081
3. **Store knowledge** using the Tell interface:
   - Enter content in the textarea
   - Select type (concept, interaction, document)
   - Add optional tags
   - Click "Store Memory"
4. **Query knowledge** using the Ask interface:
   - Enter your question
   - Select mode (basic, standard, comprehensive)
   - Enable/disable context usage
   - Click "Search Memory"
5. **Navigate the knowledge space** using ZPT controls:
   - **Zoom**: Choose abstraction level (entity → unit → text → community → corpus)
   - **Pan**: Apply domain and keyword filters
   - **Tilt**: Select view representation style
6. **Analyze content** using the Augment panel (expandable)
7. **Monitor state** using the Inspect panel (expandable)

### ZPT Navigation

The workbench implements the ZPT (Zoom-Pan-Tilt) navigation paradigm:

- **Zoom** controls the level of abstraction
  - **Entity**: Individual semantic entities
  - **Unit**: Independent semantic units
  - **Text**: Full text documents
  - **Community**: Groups of related entities
  - **Corpus**: Entire knowledge collection

- **Pan** applies subject domain filters
  - **Domains**: Subject areas (AI, science, technology)
  - **Keywords**: Specific terms to filter by
  - **Entities**: Named entities to focus on
  - **Temporal**: Time-based filtering (future feature)

- **Tilt** changes the view representation
  - **Keywords**: Text-based keyword view
  - **Embedding**: Vector similarity view
  - **Graph**: Relationship network view
  - **Temporal**: Time-based sequence view

### Session Monitoring

The dashboard header displays real-time information:
- **Interactions**: Number of API calls made
- **Concepts**: Number of concepts extracted
- **Duration**: Session uptime
- **ZPT State**: Current zoom/pan/tilt settings
- **Connection Status**: API server connectivity

## Configuration

### Environment Variables

```bash
# Server ports
PORT=8081                    # Workbench server port
MCP_PORT=3000               # MCP server port
MCP_SERVER=http://localhost:3000  # MCP server URL

# API Keys (for MCP server)
MISTRAL_API_KEY=your_key_here
CLAUDE_API_KEY=your_key_here
```

### Custom Startup

```bash
# Custom ports
MCP_PORT=3001 WORKBENCH_PORT=8082 ./src/frontend/workbench/start.sh

# Or start servers separately
MCP_PORT=3001 node mcp/http-server.js &
PORT=8082 MCP_SERVER=http://localhost:3001 cd src/frontend/workbench && node server.js
```

## Development

### File Organization

The workbench follows ES module patterns with clear separation of concerns:

- **server.js**: Express server with proxy middleware
- **workbench.js**: Main application orchestration
- **services/**: Business logic and external communication
- **utils/**: Reusable helper functions
- **styles/**: CSS organization (base + components)

### Code Patterns

- **ES Modules**: Modern import/export syntax
- **Vanilla JavaScript**: No framework dependencies
- **Progressive Enhancement**: Works with JavaScript disabled
- **Responsive Design**: CSS Grid and mobile-friendly
- **Semantic HTML**: Accessible markup structure
- **Error Handling**: Comprehensive error reporting and recovery

### Adding Features

To add new functionality:

1. **API Integration**: Extend `ApiService.js` with new methods
2. **State Management**: Add state properties to `StateManager.js`
3. **UI Components**: Add HTML structure and CSS styles
4. **Event Handling**: Wire up interactions in `workbench.js`
5. **Documentation**: Update this README and inline comments

## Troubleshooting

### Common Issues

**Port Already in Use**
```bash
# Kill processes on specific ports
./src/frontend/workbench/stop.sh

# Or manually
fuser -k 8081/tcp
fuser -k 3000/tcp
```

**API Connection Failed**
- Check that MCP server is running: `curl http://localhost:3000/health`
- Verify proxy configuration in `server.js`
- Check network connectivity and firewall settings

**JavaScript Errors**
- Open browser developer tools (F12)
- Check console for error messages
- Verify all script files are loading correctly

**Memory/Performance Issues**
- Monitor session statistics in the dashboard
- Check log files: `mcp-server.log`, `workbench-server.log`
- Restart services periodically for long-running sessions

### Log Files

```bash
# Monitor logs in real-time
tail -f mcp-server.log workbench-server.log

# View recent entries
tail -50 mcp-server.log
tail -50 workbench-server.log
```

### Debug Mode

Enable detailed logging by setting environment variables:

```bash
MCP_DEBUG=true MCP_DEBUG_LEVEL=debug ./src/frontend/workbench/start.sh
```

## Contributing

When contributing to the workbench:

1. Follow the existing ES module patterns
2. Maintain separation between services, utilities, and UI logic
3. Add appropriate error handling and user feedback
4. Update documentation for new features
5. Test with both successful and error scenarios

## License

Part of the Semantic Memory (Semem) project. See project root for license information.