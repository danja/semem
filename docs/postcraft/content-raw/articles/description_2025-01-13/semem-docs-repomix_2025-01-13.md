
File: api-index.md
================
# Semem API Access Modes

Semem provides multiple ways to interact with its semantic memory system:

1. **Command Line Interface (CLI)**
   - Traditional command-line tool for script integration and automation
   - Colorized output and intuitive commands
   - Ideal for system administration and batch processing

2. **REPL Environment**
   - Interactive shell for direct system interaction
   - Supports both chat and RDF query modes
   - Perfect for development and testing

3. **HTTP JSON API**
   - RESTful API with JSON payloads
   - OpenAPI specification available
   - Suitable for integration with web services

4. **HTTP Forms Interface**
   - Browser-based user interface
   - Simple HTML/CSS/JS implementation
   - Designed for human interaction

5. **RDF Turtle DSL**
   - Domain-specific language for semantic operations
   - Native SPARQL integration
   - Optimized for RDF/semantic web applications

Each access mode is designed for specific use cases while maintaining consistent functionality across the system. Choose the mode that best fits your integration needs and development workflow.

================
File: cli-docs.md
================
# Semem Command Line Interface

## Overview
The Semem CLI provides command-line access to the semantic memory system with colorized output and intuitive commands. It's built using yargs for command parsing and chalk for output formatting.

## Quick Start
```bash
# Install globally
npm install -g semem

# Basic chat interaction
semem chat --prompt "What is semantic memory?"

# Store data
semem store --data "Important information" --format text

# Query stored data
semem query --text "information" --limit 10

# View system metrics
semem metrics --format json
```

## Features

### Chat Operations
```bash
# Basic chat
semem chat -p "Hello" -m qwen2:1.5b

# With specific model
semem chat --prompt "Complex query" --model llama2
```

### Storage Operations
```bash
# Store text
semem store -d "Data to store" -f text

# Store RDF
semem store --data "@prefix ex: <http://example.org/> ." --format turtle

# Batch storage
semem store --file data.jsonl
```

### Query Operations
```bash
# Text search
semem query -q "search term" -l 5

# Semantic search
semem query --semantic "concept" --similarity 0.7

# SPARQL query
semem query --sparql "SELECT * WHERE { ?s ?p ?o }"
```

### Monitoring
```bash
# Basic metrics
semem metrics

# Detailed JSON output
semem metrics --format json --detail high

# Watch mode
semem metrics --watch --interval 5000
```

### Global Options
- `--color`: Enable/disable colored output
- `--verbose`: Enable detailed logging
- `--config`: Specify config file location
- `--output`: Control output format (text/json)

## Configuration
The CLI can be configured via:
- Command line arguments
- Environment variables
- Configuration file (~/.sememrc)

Example configuration:
```json
{
  "storage": {
    "type": "sparql",
    "endpoint": "http://localhost:3030/semem"
  },
  "models": {
    "default": "qwen2:1.5b"
  }
}
```

================
File: deployment-configs.md
================
# Semem Deployment Configurations

## Development Environment
```javascript
// config/development.js
export default {
  storage: {
    type: 'memory',
    options: { persist: false }
  },
  server: {
    port: 3000,
    cors: true
  },
  models: {
    provider: 'ollama',
    endpoint: 'http://localhost:11434'
  },
  logging: {
    level: 'debug',
    format: 'detailed'
  }
}
```

## Production Environment
```javascript
// config/production.js
export default {
  storage: {
    type: 'sparql',
    endpoint: process.env.SPARQL_ENDPOINT,
    credentials: {
      user: process.env.SPARQL_USER,
      password: process.env.SPARQL_PASS
    }
  },
  server: {
    port: 80,
    ssl: {
      cert: '/etc/ssl/cert.pem',
      key: '/etc/ssl/key.pem'
    },
    rateLimit: {
      windowMs: 15 * 60 * 1000,
      max: 100
    }
  },
  cache: {
    type: 'redis',
    url: process.env.REDIS_URL
  }
}
```

## Docker Deployment
```yaml
# docker-compose.yml
version: '3.8'
services:
  semem:
    build: .
    environment:
      - NODE_ENV=production
      - SPARQL_ENDPOINT=http://fuseki:3030
    ports:
      - "3000:3000"
    depends_on:
      - fuseki
      - redis

  fuseki:
    image: stain/jena-fuseki
    environment:
      - ADMIN_PASSWORD=admin123
    volumes:
      - fuseki-data:/fuseki

  redis:
    image: redis:alpine
    volumes:
      - redis-data:/data

volumes:
  fuseki-data:
  redis-data:
```

## Kubernetes Deployment
```yaml
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: semem-api
spec:
  replicas: 3
  template:
    spec:
      containers:
      - name: semem
        image: semem:latest
        env:
        - name: NODE_ENV
          value: production
        - name: SPARQL_ENDPOINT
          valueFrom:
            configMapKeyRef:
              name: semem-config
              key: sparql-endpoint
        resources:
          limits:
            memory: "1Gi"
            cpu: "500m"
```

## Cloud Functions
```javascript
// serverless.js
export async function handleRequest(req, context) {
  const config = {
    storage: {
      type: 'cloud-store',
      projectId: process.env.CLOUD_PROJECT
    },
    timeoutMs: 300000,
    maxRetries: 3
  };

  const semem = new SememServer(config);
  return await semem.handleRequest(req);
}
```

================
File: http-forms-docs.md
================
# Semem HTTP Forms Interface

## Overview
Browser-based user interface providing form-based access to Semem functionality. Built with vanilla HTML, CSS, and JavaScript for maximum compatibility.

## Quick Start
Access the interface at `http://localhost:3000/` after starting the Semem server:
```bash
semem server --port 3000 --forms
```

## Features

### Chat Interface
```html
<!-- Basic chat form -->
<form id="chatForm" action="/api/chat" method="POST">
  <textarea name="prompt" required></textarea>
  <select name="model">
    <option value="qwen2:1.5b">Qwen 1.5B</option>
    <option value="llama2">Llama 2</option>
  </select>
  <button type="submit">Send</button>
</form>

<script>
document.getElementById('chatForm').onsubmit = async (e) => {
  e.preventDefault();
  const formData = new FormData(e.target);
  const response = await fetch('/api/chat', {
    method: 'POST',
    body: formData
  });
  const data = await response.json();
  console.log(data.response);
};
</script>
```

### Storage Interface
```html
<!-- Data storage form -->
<form id="storeForm" action="/api/store" method="POST">
  <input type="text" name="content" required>
  <select name="format">
    <option value="text">Text</option>
    <option value="turtle">Turtle</option>
  </select>
  <button type="submit">Store</button>
</form>
```

### Query Interface
```html
<!-- Search form -->
<form id="searchForm" action="/api/query" method="GET">
  <input type="text" name="text" placeholder="Search...">
  <input type="number" name="limit" value="10">
  <button type="submit">Search</button>
</form>

<!-- SPARQL query form -->
<form id="sparqlForm" action="/api/query" method="POST">
  <textarea name="sparql" required></textarea>
  <button type="submit">Execute</button>
</form>
```

### Real-time Updates
```html
<!-- Streaming chat interface -->
<div id="chat">
  <div id="messages"></div>
  <form id="streamForm">
    <input type="text" id="prompt">
    <button type="submit">Send</button>
  </form>
</div>

<script>
const streamChat = async (prompt) => {
  const response = await fetch('/api/chat/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt })
  });

  const reader = response.body.getReader();
  while (true) {
    const {value, done} = await reader.read();
    if (done) break;
    const text = new TextDecoder().decode(value);
    document.getElementById('messages').textContent += text;
  }
};
</script>
```

### Metrics Dashboard
```html
<!-- Metrics display -->
<div id="metrics">
  <div id="storage"></div>
  <div id="performance"></div>
  <div id="errors"></div>
</div>

<script>
const updateMetrics = async () => {
  const response = await fetch('/api/metrics');
  const data = await response.json();
  document.getElementById('storage').textContent =
    `Storage: ${data.storage.size} bytes`;
  // Update other metrics...
};
setInterval(updateMetrics, 5000);
</script>
```

## Styling
The interface uses minimal CSS for responsiveness:
```css
/* Basic responsive layout */
.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 1rem;
}

/* Form styling */
form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  max-width: 600px;
}

/* Mobile responsiveness */
@media (max-width: 768px) {
  .container {
    padding: 0.5rem;
  }

  textarea {
    height: 100px;
  }
}
```

## Configuration
Forms interface can be customized through:
- URL parameters
- Local storage settings
- Server-side configuration

Example configuration:
```javascript
{
  "forms": {
    "theme": "light",
    "autoSave": true,
    "refreshInterval": 5000
  }
}
```

================
File: http-json-docs.md
================
# Semem HTTP JSON API

## Overview
RESTful API providing JSON-based access to Semem's functionality. Features include chat completion, memory storage/retrieval, and system monitoring.

## Quick Start
```javascript
// Initialize client
const client = new SememClient({
  baseUrl: 'http://localhost:3000/api',
  apiKey: 'your-api-key'
});

// Basic chat
const response = await client.chat({
  prompt: "What is semantic memory?",
  model: "qwen2:1.5b"
});
```

## Endpoints

### Chat Operations
```http
POST /api/chat
Content-Type: application/json
Authorization: Bearer <token>

{
  "prompt": "Hello, how are you?",
  "model": "qwen2:1.5b",
  "options": {
    "temperature": 0.7
  }
}
```

### Storage Operations
```http
POST /api/store
Content-Type: application/json
Authorization: Bearer <token>

{
  "content": "Information to store",
  "format": "text",
  "metadata": {
    "timestamp": "2025-01-13T19:39:38.327Z",
    "tags": ["example", "documentation"]
  }
}
```

### Query Operations
```http
GET /api/query?text=search+term&limit=10
Authorization: Bearer <token>

POST /api/query
Content-Type: application/json
Authorization: Bearer <token>

{
  "sparql": "SELECT * WHERE { ?s ?p ?o } LIMIT 5"
}
```

### Metrics Endpoint
```http
GET /api/metrics
Authorization: Bearer <token>

GET /api/metrics?format=json&detail=high
Authorization: Bearer <token>
```

## Authentication
The API uses Bearer token authentication:
```http
Authorization: Bearer your-api-key-here
```

## Error Handling
Errors follow standard HTTP status codes with JSON responses:
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input parameter",
    "details": {
      "field": "prompt",
      "issue": "required"
    }
  }
}
```

## Rate Limiting
- 100 requests per minute per API key
- Headers include rate limit information:
  ```http
  X-RateLimit-Limit: 100
  X-RateLimit-Remaining: 95
  X-RateLimit-Reset: 1673647423
  ```

## Streaming
Supports Server-Sent Events for real-time updates:
```javascript
const eventSource = new EventSource('/api/chat/stream?token=api-key');
eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log(data.response);
};
```

## Client Libraries
JavaScript client example:
```javascript
import { SememClient } from 'semem';

const client = new SememClient({
  baseUrl: 'http://localhost:3000/api',
  apiKey: process.env.SEMEM_API_KEY
});

// Chat completion
const response = await client.chat({
  prompt: "What is semantic memory?",
  model: "qwen2:1.5b"
});

// Store data
await client.store({
  content: "Important information",
  format: "text"
});

// Query data
const results = await client.query({
  text: "search term",
  limit: 10
});
```

================
File: integration-examples.md
================
# Semem Access Mode Integration Examples

## CLI with HTTP API
```javascript
// Script combining CLI and HTTP access
import { CLIHandler } from 'semem/cli';
import { SememClient } from 'semem/client';

const cli = new CLIHandler();
const httpClient = new SememClient({
  baseUrl: 'http://localhost:3000/api'
});

// Use CLI for local operations, HTTP for remote
async function hybridOperation() {
  // Local processing via CLI
  const localData = await cli.executeOperation('query', {
    text: 'local search'
  });

  // Remote processing via HTTP
  const remoteData = await httpClient.query({
    text: 'remote search'
  });

  // Combine results
  return [...localData, ...remoteData];
}
```

## REPL with Forms
```javascript
// REPL command that generates web form
semem> /export-form "SELECT * WHERE { ?s ?p ?o }"

// Generates HTML
<form action="/api/query" method="POST">
  <input type="hidden" name="query"
    value="SELECT * WHERE { ?s ?p ?o }">
  <button type="submit">Execute Query</button>
</form>
```

## RDF DSL with HTTP API
```turtle
# DSL script using HTTP endpoint
@endpoint <http://localhost:3000/api>

query --remote {
  SELECT ?s ?p ?o
  WHERE { ?s ?p ?o }
}

store --endpoint <http://remote/store> {
  _:m1 a mcp:Memory ;
    mcp:data "Test data" .
}
```

## Cross-Mode Data Flow
```javascript
// Combined workflow
async function integratedWorkflow() {
  // 1. CLI stores data
  await cli.store('input.ttl');

  // 2. HTTP API processes
  const processed = await httpClient.process({
    graphUri: 'http://example.org/data'
  });

  // 3. RDF DSL queries
  const dslResult = await rdfClient.query(`
    SELECT ?result
    WHERE { ?s mcp:status "processed" }
  `);

  // 4. Update Forms UI
  await formsClient.updateView(dslResult);
}
```

================
File: rdf-dsl-docs.md
================
# Semem RDF Turtle DSL

## Overview
Domain-specific language for semantic operations in Semem, providing direct integration with RDF and SPARQL while maintaining a concise, Turtle-like syntax.

## Quick Start
```turtle
# Define prefixes
@prefix mcp: <http://purl.org/stuff/mcp/> .
@prefix sem: <http://example.org/semem#> .

# Store memory interaction
store {
  _:memory1 a mcp:Interaction ;
    mcp:prompt "What is RDF?" ;
    mcp:timestamp "2025-01-13T20:00:00Z" .
}

# Query memories
query SELECT ?p ?o
WHERE { sem:memory1 ?p ?o }
```

## Features

### Memory Storage
```turtle
# Basic storage
store {
  _:m1 a mcp:Interaction ;
    mcp:prompt "Query text" ;
    mcp:response "Response text" ;
    mcp:embedding [1.2, 3.4, 5.6] ;
    mcp:concepts ("rdf" "storage") .
}

# With metadata
store --graph <http://example.org/memories> {
  _:m2 a mcp:Interaction ;
    mcp:timestamp "2025-01-13T20:00:00Z" ;
    mcp:accessCount 1 ;
    mcp:decayFactor 1.0 .
}
```

### Querying
```turtle
# Simple query
query "semantic memory"

# SPARQL query
query SELECT ?m ?p
WHERE {
  ?m a mcp:Interaction ;
     mcp:prompt ?p .
  FILTER(contains(?p, "rdf"))
}

# With parameters
query --limit 5 --format json
  SELECT * WHERE { ?s ?p ?o }
```

### Updates
```turtle
# Update interaction
update DELETE { ?m mcp:accessCount ?c }
INSERT { ?m mcp:accessCount ?newCount }
WHERE {
  ?m mcp:id "memory-1" ;
     mcp:accessCount ?c .
  BIND(?c + 1 AS ?newCount)
}

# Batch update
update --graph <http://example.org/memories> {
  DELETE { ?m mcp:decayFactor ?old }
  INSERT { ?m mcp:decayFactor ?new }
  WHERE {
    ?m mcp:decayFactor ?old .
    BIND(?old * 0.9 AS ?new)
  }
}
```

### Data Definition
```turtle
# Define prefixes
define qb: <http://purl.org/linked-data/cube#>
define skos: <http://www.w3.org/2004/02/skos/core#>

# Define shapes
shape InteractionShape {
  targetClass: mcp:Interaction
  properties: [
    { path: mcp:prompt, minCount: 1 }
    { path: mcp:response, minCount: 1 }
    { path: mcp:embedding, datatype: xsd:string }
  ]
}
```

### Advanced Features

#### Federated Queries
```turtle
# Query across endpoints
query SELECT ?m ?p
FROM <http://endpoint1/graph1>
FROM <http://endpoint2/graph2>
WHERE {
  ?m mcp:prompt ?p
}

# Service-based federation
query SELECT *
WHERE {
  SERVICE <http://endpoint1/sparql> {
    ?s ?p ?o
  }
}
```

#### Transactions
```turtle
# Begin transaction
begin

# Multiple operations
store { ... }
update { ... }
query { ... }

# Commit or rollback
commit
# or
rollback
```

#### Graph Operations
```turtle
# Create graph
create graph <http://example.org/memories>

# Copy graph
copy <http://source/graph> to <http://target/graph>

# Drop graph
drop graph <http://example.org/memories>
```

## Command Options
- `--format`: Output format (json, turtle, xml)
- `--graph`: Target graph URI
- `--inference`: Enable/disable inference
- `--validate`: Enable shape validation
- `--timeout`: Query timeout in seconds

## Error Handling
```turtle
# Try-catch block
try {
  store { ... }
  update { ... }
} catch {
  rollback
}

# Validation
store --validate InteractionShape {
  _:m1 a mcp:Interaction ;
    mcp:prompt "Test" .
}
```

================
File: repl-docs.md
================
# Semem REPL Environment

## Overview
The Semem REPL provides an interactive shell environment with support for both natural language chat and RDF query modes. It offers command history, auto-completion, and integrated help.

## Quick Start
```bash
# Start REPL
semem repl

# Basic commands
help           # Show available commands
mode chat      # Switch to chat mode
mode rdf       # Switch to RDF mode
clear          # Clear screen
exit           # Exit REPL
```

## Features

### Chat Mode
```javascript
// Default chat mode
semem> Hello, how do you work?

// Switch models
semem> /model llama2

// View context
semem> /context

// Clear conversation
semem> /clear
```

### RDF Mode
```sparql
// Basic SPARQL query
semem> SELECT * WHERE { ?s ?p ?o } LIMIT 5

// Store triple
semem> INSERT DATA {
  <http://example.org/subject> <http://example.org/predicate> "object"
}

// Define prefix
semem> @prefix ex: <http://example.org/>
```

### Command History
- Up/Down arrows for history navigation
- `history` command to view recent commands
- History persistence between sessions
- `!n` to repeat nth command

### Auto-completion
- Tab completion for commands
- Prefix completion for SPARQL keywords
- URI completion for known namespaces
- Command parameter hints

### Help System
```bash
# General help
semem> help

# Command-specific help
semem> help mode
semem> help query

# Examples
semem> examples chat
semem> examples sparql
```

### Context Management
```bash
# View current context
semem> /context

# Clear context
semem> /context clear

# Save context
semem> /context save workspace1

# Load context
semem> /context load workspace1
```

## Keyboard Shortcuts
- `Ctrl+C`: Cancel current input
- `Ctrl+D`: Exit REPL
- `Ctrl+L`: Clear screen
- `Ctrl+R`: Reverse history search
- `Ctrl+U`: Clear current line

## Configuration
The REPL can be customized through:
- `.sememrc` configuration file
- Environment variables
- Runtime commands

Example configuration:
```json
{
  "repl": {
    "prompt": "semem λ",
    "historySize": 1000,
    "mode": "chat",
    "autoSave": true
  }
}
```
