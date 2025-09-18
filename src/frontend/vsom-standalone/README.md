# VSOM Standalone - Visual Self-Organizing Map for Navigation

A standalone web application for visualizing semantic memory interactions using Visual Self-Organizing Maps (VSOM). This application provides an interactive navigation interface for exploring interactions and ZPT (Zoom/Pan/Tilt) settings.

## Features

- **Interactive VSOM Grid**: Visualizes interactions as nodes positioned by semantic similarity
- **ZPT Navigation Controls**: Zoom/Pan/Tilt controls for different abstraction levels and filters
- **Real-time Data Display**: Shows session statistics and interaction details
- **Responsive Design**: Works on desktop and mobile devices
- **API Integration**: Connects to MCP HTTP server for data

## Quick Start

### Prerequisites

- Node.js 20.11.0 or higher
- Running MCP HTTP server (default: http://localhost:4101)

### Starting the Server

```bash
# From the semem root directory
node src/frontend/vsom-standalone/server.js
```

The application will be available at: **http://localhost:4103**

### Configuration

The application uses the main `config/config.json` file via the Config system:
- **MCP Server**: Configured via `servers.mcp` (default: 4101)
- **API Server**: Configured via `servers.api` (default: 4100)  
- **Workbench UI**: Configured via `servers.workbench` (default: 4102)

Environment variables:
- `PORT`: VSOM standalone server port (default: 4103)
- `MCP_HTTP_URL`: Override MCP server URL (default: uses config)
- `NODE_ENV`: Environment (development/production)

## Architecture

### Components

1. **VSOMGrid** - Main visualization component using SVG
2. **ZPTControls** - Navigation controls for Zoom/Pan/Tilt
3. **DataPanel** - Statistics and interaction list display

### Services

1. **VSOMApiService** - API communication with MCP server
2. **DataProcessor** - Transforms interaction data for VSOM visualization
3. **VSOMUtils** - Utility functions for formatting and calculations

## ZPT Navigation

### Zoom Levels
- **Entity**: Individual interactions as separate nodes
- **Unit**: Semantic units grouping related interactions
- **Text**: Document or conversation-level groupings
- **Community**: Concept communities and topic clusters
- **Corpus**: Corpus-wide overview and statistics

### Pan Filters
- **Domains**: Filter by subject domains (e.g., "AI, technology")
- **Keywords**: Filter by specific keywords (e.g., "machine learning")

### Tilt Styles
- **Keywords**: Focus on concept keywords and topics
- **Embedding**: Use vector embeddings for similarity
- **Graph**: Show relationship networks and connections
- **Temporal**: Arrange by time and sequence

## API Endpoints

The standalone server proxies requests to the MCP server:

- `GET /health` - Server health check
- `GET /api/state` - Current ZPT navigation state
- `POST /api/inspect` - Session and interaction data
- `POST /api/zoom` - Set zoom level
- `POST /api/pan` - Set pan filters
- `POST /api/tilt` - Set tilt style

## Development

### Running Tests

```bash
# Unit tests
npx vitest run src/frontend/vsom-standalone/tests/unit/

# E2E tests (requires server running)
npx playwright test src/frontend/vsom-standalone/tests/e2e/
```

### File Structure

```
src/frontend/vsom-standalone/
├── public/
│   ├── index.html              # Main HTML page
│   ├── styles/
│   │   ├── vsom-standalone.css # Main styles
│   │   └── vsom-components.css # Component styles
│   └── js/
│       ├── vsom-standalone.js  # Main app entry
│       ├── components/         # UI components
│       ├── services/          # Data services
│       └── utils/             # Utility functions
├── server.js                  # Standalone server
├── tests/                     # Unit and E2E tests
└── README.md                  # This file
```

## Usage

1. **Start the application**: Navigate to http://localhost:4103
2. **Connect to data**: Ensure MCP server is running (http://localhost:4101)
3. **Generate interactions**: Use the workbench or API to create interactions
4. **Explore with ZPT**: Use Zoom/Pan/Tilt controls to navigate the data
5. **Visualize**: Watch as interactions appear as nodes on the VSOM grid

## Integration

The VSOM standalone integrates with:

- **MCP HTTP Server**: For data and navigation state
- **Semantic Memory System**: For interaction data and embeddings
- **ZPT Navigation**: For semantic navigation and filtering

## Browser Compatibility

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Performance

- Handles up to 1000 interactions efficiently
- Real-time updates every 30 seconds
- Responsive to viewport changes
- Optimized SVG rendering

## Contributing

When modifying the VSOM standalone:

1. Follow existing patterns from workbench UI
2. Maintain minimal impact on core codebase
3. Add tests for new functionality
4. Update this README for significant changes

## License

Same as the main Semem project (MIT).