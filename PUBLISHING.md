# Semem NPM Package Publishing Guide

## 📦 Package Structure

The Semem package is now configured as a proper npm package with the following structure:

```
semem/
├── package.json          # Main package configuration
├── index.js              # Main entry point with essential exports
├── bin/                  # CLI executables
│   ├── semem.js         # Main CLI
│   └── mcp.js           # MCP server binary
├── src/                  # Source code with barrel files
│   ├── core.js          # Core components barrel
│   ├── handlers/index.js # Handlers barrel
│   ├── stores/index.js   # Storage providers barrel
│   ├── connectors/index.js # LLM connectors barrel
│   ├── ragno/index.js    # Knowledge graph barrel
│   ├── zpt/index.js      # ZPT navigation barrel
│   └── utils/index.js    # Utilities barrel
├── mcp/                  # MCP server implementation
│   └── index.js         # MCP server with createMCPServer export
├── dist/types/           # TypeScript declarations
│   ├── index.d.ts       # Main type definitions
│   ├── core.d.ts        # Core component types
│   ├── ragno.d.ts       # Ragno types
│   └── zpt.d.ts         # ZPT types
└── README-npm.md         # NPM package documentation
```

## 🚀 Publishing Steps

### 1. Pre-publishing Checklist

```bash
# Build TypeScript declarations
npm run build:types

# Run tests to ensure everything works
npm test

# Test package structure
node -e "console.log(Object.keys(require('./package.json')))"

# Verify exports work
node -e "const { MemoryManager } = require('./index.js'); console.log(typeof MemoryManager);"
```

### 2. Version Management

```bash
# Update version (patch/minor/major)
npm version patch
npm version minor
npm version major

# Or manually edit package.json version
```

### 3. Publishing to NPM

```bash
# Login to NPM (if not already logged in)
npm login

# Publish to npm registry
npm publish

# For scoped packages or first publish
npm publish --access public
```

### 4. Verify Publication

```bash
# Check package on npmjs.com
open https://www.npmjs.com/package/semem

# Test installation
npm install semem
```

## 🔧 MCP Integration Usage

After publishing, users can integrate with Claude MCP:

```bash
# Install globally for MCP usage
npm install -g semem

# Add to Claude MCP
claude mcp add semem npx semem-mcp

# Or use locally
npx semem-mcp
```

## 📋 Package Configuration Details

### Main Exports (`package.json`)

```json
{
  "main": "index.js",
  "types": "dist/types/index.d.ts",
  "bin": {
    "semem": "bin/semem.js",
    "semem-mcp": "bin/mcp.js"
  },
  "exports": {
    ".": {
      "types": "./dist/types/index.d.ts",
      "import": "./index.js"
    },
    "./ragno": {
      "types": "./dist/types/ragno.d.ts", 
      "import": "./src/ragno/index.js"
    },
    "./zpt": {
      "types": "./dist/types/zpt.d.ts",
      "import": "./src/zpt/index.js"
    }
  }
}
```

### Essential Exports (index.js)

```javascript
// Core Components
export { default as MemoryManager } from './src/MemoryManager.js';
export { default as Config } from './src/Config.js';
export { default as ContextManager } from './src/ContextManager.js';

// Handlers  
export { default as LLMHandler } from './src/handlers/LLMHandler.js';
export { default as EmbeddingHandler } from './src/handlers/EmbeddingHandler.js';

// Storage Providers
export { default as BaseStore } from './src/stores/BaseStore.js';
export { default as InMemoryStore } from './src/stores/InMemoryStore.js';
export { default as JSONStore } from './src/stores/JSONStore.js';
export { default as SPARQLStore } from './src/stores/SPARQLStore.js';

// LLM Connectors
export { default as OllamaConnector } from './src/connectors/OllamaConnector.js';
export { default as ClaudeConnector } from './src/connectors/ClaudeConnector.js';
export { default as MistralConnector } from './src/connectors/MistralConnector.js';

// MCP Integration
export { createMCPServer } from './mcp/index.js';

// Utilities
export * as Utils from './src/Utils.js';
```

## 🎯 Usage Examples

### Basic Usage

```javascript
import { MemoryManager, OllamaConnector } from 'semem';

const manager = new MemoryManager({
  llmProvider: new OllamaConnector(),
  chatModel: 'qwen2:1.5b'
});
```

### Modular Usage

```javascript
// Core only
import { MemoryManager } from 'semem';

// Knowledge graph
import { Entity, decomposeCorpus } from 'semem/ragno';

// Navigation
import { CorpuscleSelector } from 'semem/zpt';

// MCP server
import { createMCPServer } from 'semem';
```

### CLI Usage

```bash
# Start MCP server
semem mcp --transport stdio

# Initialize project
semem init --dir ./my-project

# Start HTTP server  
semem server --port 4100
```

## ✅ Testing Verification

The package has been tested and verified to work with:

- ✅ Core memory management functionality
- ✅ Storage providers (InMemory, JSON, SPARQL)
- ✅ LLM connectors (Ollama, Claude, Mistral)
- ✅ MCP server integration
- ✅ TypeScript declarations
- ✅ CLI binaries
- ✅ Modular imports via barrel files

## 🔍 Post-Publishing

After publishing, monitor:

1. **Download stats** on npmjs.com
2. **Issues and feedback** on GitHub
3. **MCP integration** with Claude users
4. **TypeScript compatibility** reports

## 📚 Documentation

- Main package docs: `README-npm.md`
- Type definitions: `dist/types/README.md`  
- Examples: `examples/` directory
- API docs: Generated with JSDoc

The package is now ready for npm publishing and Claude MCP integration!