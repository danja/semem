# Build Configuration

This document describes the updated build configuration for the Semem project.

## Overview

The build system has been updated to focus on the **Semantic Memory Workbench** (`src/frontend/workbench/`) as the primary frontend interface, replacing the previous complex UI system.

## Build Structure

### Entry Points
- **Main Entry**: `src/frontend/workbench/public/js/workbench.js`
- **Output Directory**: `dist/workbench/`

### Available Scripts

```bash
# Build commands
npm run build:workbench    # Production build
npm run build:dev         # Development build  
npm run dev               # Development server with hot reload

# Server commands
npm run start:workbench   # Start workbench server (port 8081)
npm run start:mcp         # Start MCP server (port 4105)
```

### Development Workflow

1. **Start the MCP server** (provides backend API):
   ```bash
   npm run start:mcp
   ```

2. **Start development server** (with webpack dev server):
   ```bash
   npm run dev
   ```
   This starts the webpack dev server on port 9000 with:
   - Hot module replacement
   - Proxy to MCP server on port 4105
   - Automatic rebuilds on file changes

### Production Build

```bash
npm run build:workbench
```

This creates optimized, minified assets in `dist/workbench/` including:
- `workbench.js` - Main application bundle
- `index.html` - Application entry point
- `styles/` - CSS files
- `js/` - JavaScript modules and services

### Proxy Configuration

The webpack dev server proxies the following routes to the MCP server:
- `/api/*` - General API endpoints
- `/tell` - Tell semantic verb
- `/ask` - Ask semantic verb  
- `/augment` - Augment semantic verb
- `/zoom`, `/pan`, `/tilt` - ZPT navigation
- `/zpt/*` - ZPT navigation endpoints
- `/inspect` - System inspection
- `/state` - State management

## Architecture Changes

### Removed
- Old frontend UI system (`src/frontend/index.js` and related)
- Unused MCP server files (`mcp-new.js`, `mcp-server.js`, `mcp-server-fixed.js`)
- Legacy build configurations

### Active Components
- **Workbench UI**: Modern semantic memory interface
- **MCP Server**: `mcp/http-server.js` with Simple Verbs REST API
- **Webpack**: Focused on workbench bundling and development

## File Structure

```
dist/
└── workbench/              # Built workbench application
    ├── index.html          # Main HTML file
    ├── workbench.js        # Main application bundle
    ├── styles/             # CSS files
    └── js/                 # JavaScript modules

src/frontend/workbench/     # Source workbench files
├── public/
│   ├── index.html         # HTML template
│   ├── js/                # JavaScript source
│   └── styles/            # CSS source
└── server.js              # Workbench server

mcp/                        # MCP server and tools
└── http-server.js         # Active MCP server
```

This configuration provides a clean, focused development experience centered on the semantic memory workbench interface.