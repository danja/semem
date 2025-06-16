# Atuin Integration Guide

This guide provides comprehensive information for third-party developers who want to integrate Atuin's RDF editing and graph visualization capabilities into their existing applications.

## Table of Contents

- [Quick Start](#quick-start)
- [Package Overview](#package-overview)
- [Core Components](#core-components)
- [Event Bus Integration](#event-bus-integration)
- [Integration Patterns](#integration-patterns)
- [CSS and Styling](#css-and-styling)
- [Advanced Features](#advanced-features)
- [Troubleshooting](#troubleshooting)

## Quick Start

### Installation

```bash
npm install atuin evb
```

### Basic Setup

```html
<!DOCTYPE html>
<html>
<head>
    <link rel="stylesheet" href="node_modules/atuin/dist/css/main.css">
    <link rel="stylesheet" href="node_modules/atuin/dist/css/editor.css">
    <link rel="stylesheet" href="node_modules/atuin/dist/css/graph.css">
</head>
<body>
    <div id="message-queue"></div>
    <textarea id="turtle-editor"></textarea>
    <div id="graph-container"></div>
    
    <script type="module">
        import { TurtleEditor, GraphVisualizer } from 'atuin/core';
        import { LoggerService } from 'atuin/services';
        import { eventBus, EVENTS } from 'evb';
        
        // Initialize logger
        const logger = new LoggerService('message-queue');
        
        // Initialize components
        const editor = new TurtleEditor('turtle-editor', logger);
        const graph = new GraphVisualizer('graph-container', logger);
        
        // Components automatically sync via event bus
        editor.setValue('@prefix ex: <http://example.org/> .\nex:subject ex:predicate ex:object .');
    </script>
</body>
</html>
```

## Package Overview

### Module System
Atuin uses **ES modules exclusively** (`"type": "module"`). Ensure your environment supports ES modules.

### Entry Points

```javascript
// Main package
import atuin from 'atuin';

// Core components (individual imports)
import { TurtleEditor } from 'atuin/core/TurtleEditor';
import { SPARQLEditor } from 'atuin/core/SPARQLEditor';
import { GraphVisualizer } from 'atuin/core/GraphVisualizer';

// Grouped imports
import { TurtleEditor, SPARQLEditor, GraphVisualizer } from 'atuin/core';
import services from 'atuin/services';
import ui from 'atuin/ui';
import utils from 'atuin/utils';

// CSS imports
import 'atuin/css/main';
import 'atuin/css/editor';
import 'atuin/css/graph';
```

### Dependencies
Key dependencies your integration needs to be aware of:

- **evb ^0.6.1** - Event bus for component communication
- **CodeMirror 6** - Text editing functionality
- **vis-network ^9.1.6** - Graph visualization
- **N3.js ^1.17.2** - RDF parsing and serialization
- **@rdfjs/* packages** - Standard RDF interfaces

## Core Components

### TurtleEditor

RDF Turtle syntax editor with real-time validation.

```javascript
import { TurtleEditor } from 'atuin/core/TurtleEditor';
import { LoggerService } from 'atuin/services';

const logger = new LoggerService('message-container-id');
const editor = new TurtleEditor('textarea-id', logger);

// API Methods
editor.setValue(content);           // Set editor content
editor.getValue();                  // Get current content
editor.focus();                     // Focus editor
editor.refresh();                   // Refresh display
editor.addChangeCallback(callback); // Add change listener (legacy)

// Event Bus Integration (automatic)
// Emits: EVENTS.MODEL_SYNCED when content changes
```

**Constructor Parameters:**
- `elementId` (string): ID of textarea element
- `logger` (LoggerService): Logger service instance

### SPARQLEditor

SPARQL query editor with syntax highlighting.

```javascript
import { SPARQLEditor } from 'atuin/core/SPARQLEditor';

const sparqlEditor = new SPARQLEditor('sparql-textarea-id', logger);

// API Methods (same as TurtleEditor)
sparqlEditor.setValue(query);
sparqlEditor.getValue();
sparqlEditor.focus();
sparqlEditor.refresh();
```

### GraphVisualizer

Interactive RDF graph visualization using vis-network.

```javascript
import { GraphVisualizer } from 'atuin/core/GraphVisualizer';

const graph = new GraphVisualizer('graph-container-id', logger);

// API Methods
graph.updateGraph(turtleContent);     // Update from Turtle content
graph.setData(nodes, edges);          // Set vis-network data directly
graph.highlightNode(nodeId);          // Highlight specific node
graph.clearHighlight();               // Clear all highlights
graph.fit();                          // Fit graph to container
graph.setOptions(visOptions);         // Update vis-network options

// Event Bus Integration (automatic)
// Listens: EVENTS.MODEL_SYNCED to update graph
// Emits: Node selection events
```

**Constructor Parameters:**
- `containerId` (string): ID of container div element
- `logger` (LoggerService): Logger service instance

### LoggerService

UI messaging system for user notifications.

```javascript
import { LoggerService } from 'atuin/services';

const logger = new LoggerService('message-queue-id');

// API Methods
logger.info(message);        // Info message
logger.warn(message);        // Warning message
logger.error(message);       // Error message
logger.success(message);     // Success message
logger.clear();             // Clear all messages
```

## Event Bus Integration

Atuin uses the [evb](https://github.com/danja/evb) event bus for loose coupling between components.

### Import and Setup

```javascript
import { eventBus, EVENTS } from 'evb';
```

### Key Events

```javascript
// Content synchronization
EVENTS.MODEL_SYNCED           // 'rdf:model:synced'
EVENTS.ENDPOINT_UPDATED       // 'endpoint:updated'
EVENTS.SPARQL_QUERY_COMPLETED // 'sparql:query:completed'

// UI events
EVENTS.VIEW_CHANGED           // 'ui:view:changed'
EVENTS.NOTIFICATION_SHOW      // 'ui:notification:show'

// Error handling
EVENTS.ERROR_OCCURRED         // 'error:occurred'
```

### Publishing Events

```javascript
// Notify of content changes
eventBus.emit(EVENTS.MODEL_SYNCED, turtleContent);

// Notify of endpoint changes
eventBus.emit(EVENTS.ENDPOINT_UPDATED, {
    endpoints: endpointArray,
    activeEndpoint: activeEndpointUrl
});
```

### Subscribing to Events

```javascript
// Listen for content changes
eventBus.on(EVENTS.MODEL_SYNCED, (content) => {
    console.log('RDF content updated:', content);
    // Update your components
});

// Listen for SPARQL query completion
eventBus.on(EVENTS.SPARQL_QUERY_COMPLETED, (results) => {
    console.log('Query results:', results);
});

// Cleanup (important for preventing memory leaks)
eventBus.off(EVENTS.MODEL_SYNCED, callbackFunction);
// or remove all listeners
eventBus.removeAllListeners();
```

### Event Payload Structures

```javascript
// MODEL_SYNCED event
{
    event: 'rdf:model:synced',
    payload: string // Turtle content
}

// ENDPOINT_UPDATED event
{
    event: 'endpoint:updated',
    payload: {
        endpoints: Array<string>,      // Array of endpoint URLs
        activeEndpoint: string         // Currently active endpoint URL
    }
}

// SPARQL_QUERY_COMPLETED event
{
    event: 'sparql:query:completed', 
    payload: {
        results: Object,              // SPARQL results
        query: string,                // Original query
        endpoint: string              // Endpoint used
    }
}
```

## Integration Patterns

### Pattern 1: Single Component Integration

Use individual components in isolation:

```javascript
import { TurtleEditor } from 'atuin/core/TurtleEditor';
import { LoggerService } from 'atuin/services';
import 'atuin/css/editor';

// Minimal integration
const logger = new LoggerService('messages');
const editor = new TurtleEditor('my-editor', logger);

// Manual event handling
editor.addChangeCallback((content) => {
    // Handle content changes in your application
    myApp.handleRDFUpdate(content);
});
```

### Pattern 2: Multi-Component with Event Bus

Coordinate multiple components using the event bus:

```javascript
import { TurtleEditor, GraphVisualizer } from 'atuin/core';
import { LoggerService } from 'atuin/services';
import { eventBus, EVENTS } from 'evb';
import 'atuin/css/main';

class MyRDFApp {
    constructor() {
        this.logger = new LoggerService('app-messages');
        this.editor = new TurtleEditor('editor', this.logger);
        this.graph = new GraphVisualizer('graph', this.logger);
        
        this.setupEventHandlers();
    }
    
    setupEventHandlers() {
        // Listen for RDF changes
        eventBus.on(EVENTS.MODEL_SYNCED, (content) => {
            this.onRDFChanged(content);
        });
        
        // Custom business logic
        eventBus.on('myapp:data:saved', (data) => {
            this.logger.success('Data saved successfully');
        });
    }
    
    onRDFChanged(content) {
        // Your custom logic when RDF content changes
        this.validateContent(content);
        this.saveToBackend(content);
    }
    
    loadContent(turtleContent) {
        this.editor.setValue(turtleContent);
        // Graph automatically updates via MODEL_SYNCED event
    }
}

const app = new MyRDFApp();
```

### Pattern 3: Full Integration with UI Manager

Use the complete Atuin interface:

```javascript
import { UIManager } from 'atuin/ui';
import 'atuin/css/main';

const config = {
    containerId: 'atuin-container',
    showSparqlEditor: true,
    showGraph: true,
    showSettings: true,
    sparqlEndpoints: [
        'https://dbpedia.org/sparql',
        'https://query.wikidata.org/sparql'
    ],
    initialContent: '@prefix ex: <http://example.org/> .\nex:subject ex:predicate ex:object .'
};

const uiManager = new UIManager(config);

// Access individual components
const editor = uiManager.turtleEditor;
const graph = uiManager.graphVisualizer;
const sparqlEditor = uiManager.sparqlEditor;
```

### Pattern 4: Custom Event Integration

Integrate Atuin events with your application's event system:

```javascript
import { eventBus, EVENTS } from 'evb';

class MyAppEventBridge {
    constructor(myAppEventSystem) {
        this.myApp = myAppEventSystem;
        this.setupBridge();
    }
    
    setupBridge() {
        // Bridge Atuin events to your app
        eventBus.on(EVENTS.MODEL_SYNCED, (content) => {
            this.myApp.trigger('rdf:changed', { content });
        });
        
        eventBus.on(EVENTS.ERROR_OCCURRED, (error) => {
            this.myApp.trigger('app:error', { error, source: 'atuin' });
        });
        
        // Bridge your app events to Atuin
        this.myApp.on('data:loaded', (data) => {
            if (data.type === 'rdf') {
                eventBus.emit(EVENTS.MODEL_SYNCED, data.content);
            }
        });
    }
}
```

## CSS and Styling

### Required Stylesheets

```html
<!-- Base styles -->
<link rel="stylesheet" href="node_modules/atuin/dist/css/main.css">

<!-- Editor styles (if using TurtleEditor or SPARQLEditor) -->
<link rel="stylesheet" href="node_modules/atuin/dist/css/editor.css">

<!-- Graph styles (if using GraphVisualizer) -->
<link rel="stylesheet" href="node_modules/atuin/dist/css/graph.css">
```

### CSS Custom Properties

Atuin uses CSS custom properties for easy theming:

```css
:root {
    /* Editor colors */
    --atuin-editor-bg: #ffffff;
    --atuin-editor-text: #333333;
    --atuin-editor-selection: #b3d4fc;
    
    /* Graph colors */
    --atuin-graph-bg: #ffffff;
    --atuin-graph-node-fill: #97c2fc;
    --atuin-graph-node-border: #2b7ce9;
    --atuin-graph-edge-color: #848484;
    
    /* UI colors */
    --atuin-primary-color: #007acc;
    --atuin-secondary-color: #6c757d;
    --atuin-success-color: #28a745;
    --atuin-warning-color: #ffc107;
    --atuin-error-color: #dc3545;
}
```

### Custom Styling Example

```css
/* Custom theme */
.my-atuin-theme {
    --atuin-editor-bg: #1e1e1e;
    --atuin-editor-text: #d4d4d4;
    --atuin-graph-bg: #2d2d30;
    --atuin-graph-node-fill: #0e639c;
}

/* Custom graph styling */
#my-graph-container {
    border: 2px solid var(--atuin-primary-color);
    border-radius: 8px;
    height: 400px;
}

/* Custom editor styling */
#my-turtle-editor {
    font-family: 'Fira Code', 'Consolas', monospace;
    font-size: 14px;
    border: 1px solid #ccc;
    border-radius: 4px;
}
```

### Required HTML Structure

```html
<!-- Message queue for logger -->
<div id="message-queue" class="atuin-messages"></div>

<!-- Editor containers -->
<textarea id="turtle-editor" placeholder="Enter Turtle RDF here..."></textarea>
<textarea id="sparql-editor" placeholder="Enter SPARQL query here..."></textarea>

<!-- Graph container -->
<div id="graph-container" style="height: 500px;"></div>

<!-- Settings container (optional) -->
<div id="settings-container"></div>
```

## Advanced Features

### SPARQL Endpoint Integration

```javascript
import { SparqlService } from 'atuin/services';
import { eventBus, EVENTS } from 'evb';

const sparqlService = new SparqlService(logger);

// Execute SPARQL query
sparqlService.executeQuery(
    'SELECT * WHERE { ?s ?p ?o } LIMIT 10',
    'https://dbpedia.org/sparql'
).then(results => {
    console.log('Query results:', results);
});

// Listen for query completion
eventBus.on(EVENTS.SPARQL_QUERY_COMPLETED, (data) => {
    const { results, query, endpoint } = data;
    // Handle results
});

// Execute CONSTRUCT query to get RDF
sparqlService.executeConstruct(
    'CONSTRUCT { ?s ?p ?o } WHERE { ?s ?p ?o } LIMIT 100',
    'https://dbpedia.org/sparql'
).then(rdfContent => {
    // rdfContent is Turtle-formatted RDF
    eventBus.emit(EVENTS.MODEL_SYNCED, rdfContent);
});
```

### Real-time Validation

```javascript
import { RDFValidator } from 'atuin/utils';

const validator = new RDFValidator();

// Validate Turtle content
const validationResult = validator.validate(turtleContent);
if (validationResult.isValid) {
    console.log('Valid RDF');
} else {
    console.error('Validation errors:', validationResult.errors);
}

// Real-time validation with debouncing
let validationTimer;
eventBus.on(EVENTS.MODEL_SYNCED, (content) => {
    clearTimeout(validationTimer);
    validationTimer = setTimeout(() => {
        const result = validator.validate(content);
        if (!result.isValid) {
            logger.error(`Validation failed: ${result.errors.join(', ')}`);
        }
    }, 500); // 500ms debounce
});
```

### Graph Customization

```javascript
const graph = new GraphVisualizer('graph-container', logger);

// Custom vis-network options
const options = {
    nodes: {
        shape: 'dot',
        size: 16,
        font: {
            size: 12,
            color: '#000000'
        },
        borderWidth: 2
    },
    edges: {
        width: 2,
        color: { inherit: 'from' },
        smooth: {
            type: 'continuous'
        }
    },
    physics: {
        stabilization: { iterations: 100 },
        barnesHut: {
            gravitationalConstant: -4000,
            springConstant: 0.001,
            springLength: 200
        }
    },
    interaction: {
        hover: true,
        selectConnectedEdges: false
    }
};

graph.setOptions(options);

// Custom node click handling
graph.network.on('selectNode', (params) => {
    const nodeId = params.nodes[0];
    console.log('Selected node:', nodeId);
    
    // Highlight corresponding text in editor
    graph.highlightNode(nodeId);
    
    // Custom business logic
    myApp.handleNodeSelection(nodeId);
});
```

### Prefix Management

```javascript
import { PrefixManager } from 'atuin/utils';

const prefixManager = new PrefixManager();

// Add common prefixes
prefixManager.addPrefix('foaf', 'http://xmlns.com/foaf/0.1/');
prefixManager.addPrefix('rdfs', 'http://www.w3.org/2000/01/rdf-schema#');
prefixManager.addPrefix('owl', 'http://www.w3.org/2002/07/owl#');

// Expand prefixed URIs
const fullURI = prefixManager.expand('foaf:Person');
// Returns: 'http://xmlns.com/foaf/0.1/Person'

// Get prefixes for editor autocompletion
const prefixes = prefixManager.getPrefixes();
// Returns: { foaf: 'http://xmlns.com/foaf/0.1/', ... }

// Integration with editor
const editor = new TurtleEditor('turtle-editor', logger);
editor.setPrefixes(prefixes); // Enable autocompletion
```

### Performance Optimization

```javascript
// Large dataset handling
const graph = new GraphVisualizer('graph-container', logger);

// Configure for large graphs
const options = {
    physics: {
        enabled: false  // Disable physics for large graphs
    },
    interaction: {
        hideEdgesOnDrag: true,
        hideNodesOnDrag: true
    }
};

graph.setOptions(options);

// Clustering for performance
const clusterOptions = {
    joinCondition: (childOptions) => {
        return childOptions.group === 'cluster';
    },
    clusterNodeProperties: {
        id: 'cluster',
        borderWidth: 3,
        shape: 'database',
        color: '#ff0000'
    }
};

graph.network.cluster(clusterOptions);

// Streaming updates for large datasets
let updateBatch = [];
const BATCH_SIZE = 100;

eventBus.on(EVENTS.MODEL_SYNCED, (content) => {
    updateBatch.push(content);
    
    if (updateBatch.length >= BATCH_SIZE) {
        processBatch();
    } else {
        // Process after delay if batch not full
        setTimeout(processBatch, 1000);
    }
});

function processBatch() {
    if (updateBatch.length === 0) return;
    
    const combinedContent = updateBatch.join('\n');
    graph.updateGraph(combinedContent);
    updateBatch = [];
}
```

## Troubleshooting

### Common Issues

#### 1. Module Import Errors

**Error:** `Cannot resolve module 'atuin/core'`

**Solution:** Ensure you're using ES modules and have correct import paths:

```javascript
// Correct
import { TurtleEditor } from 'atuin/core/TurtleEditor';

// Incorrect
import { TurtleEditor } from 'atuin/core';  // May not work in all setups
```

#### 2. CSS Not Loading

**Error:** Components render without styling

**Solution:** Import CSS files and ensure correct paths:

```javascript
// In your main application file
import 'atuin/css/main';
import 'atuin/css/editor';
import 'atuin/css/graph';
```

#### 3. Event Bus Not Working

**Error:** Components not synchronizing

**Solution:** Ensure evb is properly installed and imported:

```bash
npm install evb
```

```javascript
// Check evb is working
import { eventBus, EVENTS } from 'evb';
console.log('Event bus loaded:', !!eventBus);
console.log('Events available:', Object.keys(EVENTS));
```

#### 4. Graph Not Rendering

**Error:** Empty graph container

**Solution:** Ensure container has dimensions and vis-network can initialize:

```css
#graph-container {
    width: 100%;
    height: 400px;  /* Must have explicit height */
}
```

```javascript
// Check if container exists
const container = document.getElementById('graph-container');
console.log('Container found:', !!container);
console.log('Container dimensions:', container.offsetWidth, container.offsetHeight);
```

#### 5. Memory Leaks

**Error:** Performance degrades over time

**Solution:** Clean up event listeners:

```javascript
class MyComponent {
    constructor() {
        this.boundHandlers = {
            modelSync: this.handleModelSync.bind(this)
        };
        
        eventBus.on(EVENTS.MODEL_SYNCED, this.boundHandlers.modelSync);
    }
    
    destroy() {
        eventBus.off(EVENTS.MODEL_SYNCED, this.boundHandlers.modelSync);
        // Clean up other resources
    }
    
    handleModelSync(content) {
        // Handle event
    }
}
```

### Performance Best Practices

1. **Debounce rapid updates:**

```javascript
let updateTimer;
eventBus.on(EVENTS.MODEL_SYNCED, (content) => {
    clearTimeout(updateTimer);
    updateTimer = setTimeout(() => {
        processUpdate(content);
    }, 300);
});
```

2. **Use clustering for large graphs:**

```javascript
if (nodeCount > 500) {
    graph.network.setOptions({ physics: false });
    graph.network.cluster(clusterOptions);
}
```

3. **Lazy load components:**

```javascript
async function loadEditor() {
    const { TurtleEditor } = await import('atuin/core/TurtleEditor');
    return new TurtleEditor('editor', logger);
}
```

### Browser Compatibility

- **Modern browsers only** (ES2020+ features)
- **Chrome 80+**, **Firefox 72+**, **Safari 13.1+**, **Edge 80+**
- **No Internet Explorer support**

### Testing Integration

```javascript
// Test setup with vitest
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { eventBus, EVENTS } from 'evb';
import { TurtleEditor } from 'atuin/core/TurtleEditor';

describe('My Integration', () => {
    beforeEach(() => {
        // Clean up event bus
        eventBus.removeAllListeners();
        
        // Setup DOM
        document.body.innerHTML = `
            <div id="messages"></div>
            <textarea id="editor"></textarea>
        `;
    });
    
    it('should handle RDF content changes', () => {
        const logger = { info: vi.fn(), error: vi.fn() };
        const editor = new TurtleEditor('editor', logger);
        
        const spy = vi.fn();
        eventBus.on(EVENTS.MODEL_SYNCED, spy);
        
        editor.setValue('@prefix ex: <http://example.org/> .');
        
        expect(spy).toHaveBeenCalledWith('@prefix ex: <http://example.org/> .');
    });
});
```

---

This integration guide provides all the essential information for successfully integrating Atuin into third-party applications. For additional examples and updates, visit the [Atuin GitHub repository](https://github.com/danja/atuin).