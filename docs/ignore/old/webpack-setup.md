# Webpack Frontend Setup

## Overview

The Semem browser UI has been migrated to use webpack for module bundling and build optimization while maintaining ES modules throughout the codebase.

## Directory Structure

```
src/frontend/
├── index.js                 # Main entry point
├── index.template.html      # HTML template for webpack
├── js/
│   ├── app.js              # Application initialization
│   ├── components/         # Reusable UI components
│   │   ├── tabs.js         # Tab navigation
│   │   └── settings.js     # Settings form functionality
│   ├── services/           # API services
│   │   └── apiService.js   # API health checks and core services
│   └── utils/              # Utility functions
│       ├── api.js          # API utilities and fetch helpers
│       ├── debug.js        # Debug utilities
│       └── errorHandler.js # Error handling utilities
└── styles/
    └── main.css            # Main stylesheet
```

## Key Features

- **ES Modules**: Full ES6 module support with import/export
- **Code Splitting**: Automatic vendor bundle separation
- **Hot Reloading**: Development server with hot module replacement
- **Modern Transpilation**: Babel transpilation for browser compatibility
- **CSS Processing**: Integrated CSS handling with style-loader
- **Source Maps**: Development and production source maps
- **Content Hashing**: Cache-busting with content hashes in filenames

## Build Scripts

```bash
# Development build
npm run build:dev

# Production build
npm run build

# Watch mode (rebuild on changes)
npm run build:watch

# Development server with hot reloading
npm run dev:server

# Start application with dev build
npm run start:dev
```

## Development Workflow

### For Development:
1. Run `npm run dev:server` for hot-reloading development server on port 9000
2. Or run `npm run build:dev && npm start` to build and run on the API server

### For Production:
1. Run `npm run build` to create optimized production build
2. Run `npm start` to serve the application

## Configuration

### Webpack Config (`webpack.config.js`)
- **Entry**: `src/frontend/index.js`
- **Output**: `public/dist/` with content hashing
- **Loaders**: Babel for JS, style-loader + css-loader for CSS
- **Plugins**: HtmlWebpackPlugin for HTML generation
- **Dev Server**: Proxy to API server on port 4100

### Babel Config (`.babelrc`)
- **Preset**: @babel/preset-env for modern browser support
- **Modules**: ES modules preserved for webpack
- **Targets**: > 1% browser usage, last 2 versions

## API Integration

The webpack setup maintains seamless integration with the existing API server:

- **Development**: Webpack dev server proxies API requests to localhost:4100
- **Production**: Built files served directly by API server from `public/dist/`
- **Configuration**: Settings form loads config from `/api/config` endpoint
- **Health Checks**: API health monitoring preserved

## Module Structure

### Entry Point (`src/frontend/index.js`)
- Imports main CSS
- Sets up error handling
- Initializes application on DOM ready

### Application (`src/frontend/js/app.js`)
- Coordinates all component initialization
- Sets up debug utilities
- Handles API health checks
- Manages loading states

### Components
- **Modular Design**: Each UI component in separate file
- **ES Module Exports**: Clean import/export structure
- **Dependency Injection**: API utilities passed as imports

### Utilities
- **API Utils**: Centralized fetch helpers and config
- **Error Handling**: Global error capture and display
- **Debug Tools**: Development debugging utilities

## Benefits

1. **Modern Development**: ES6 modules, async/await, modern JS features
2. **Faster Development**: Hot reloading and automatic rebuilds
3. **Optimized Production**: Minification, code splitting, compression
4. **Better Maintainability**: Modular code structure
5. **Improved Loading**: Chunked bundles and caching strategies
6. **Development Tools**: Source maps and debugging support

## Migration Notes

- **Backward Compatibility**: Existing API endpoints unchanged
- **Configuration Flow**: Server config → localStorage → UI still works
- **Settings Persistence**: localStorage-based settings preserved
- **ES Module Support**: Full ES6 import/export throughout

The webpack setup provides a modern, maintainable frontend build system while preserving all existing functionality and configuration flows.