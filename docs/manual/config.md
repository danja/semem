# Semem Configuration Guide

**Complete setup guide for config.json and .env configuration**

See also [provider-config.md](provider-config.md) 

## Table of Contents

1. [Overview](#overview)
2. [Quick Setup](#quick-setup)
3. [Config.js Architecture](#configjs-architecture)
4. [Configuration Files](#configuration-files)
5. [Server Configuration](#server-configuration)
6. [Storage Backends](#storage-backends)
7. [LLM and Embedding Providers](#llm-and-embedding-providers)
8. [SPARQL Store Configuration](#sparql-store-configuration)
9. [Environment Variables](#environment-variables)
10. [Configuration Examples](#configuration-examples)
11. [Troubleshooting](#troubleshooting)

---

## Overview

Semem uses a layered configuration system that combines:

- **config.json**: Main configuration file with structured settings
- **.env**: Environment variables for API keys and secrets
- **Config.js**: Configuration management class with validation and transformation
- **Environment overrides**: Runtime configuration via environment variables

### Configuration Priority Order

1. **Environment variables** (highest priority)
2. **Config file** (config.json)
3. **Default values** (lowest priority)

---

## Quick Setup

### 1. Copy Example Files

```bash
# Copy environment template
cp example.env .env

# Edit with your API keys and settings
nano .env
```

### 2. Configure Your Setup

Choose your deployment scenario:

**Local Development (Ollama + JSON storage):**
```bash
# In .env - minimal setup
OLLAMA_API_KEY=NO_KEY_REQUIRED
OLLAMA_HOST=http://localhost:11434
```

**Production (Cloud LLMs + SPARQL):**
```bash
# In .env - cloud setup
MISTRAL_API_KEY=your_mistral_key
CLAUDE_API_KEY=your_claude_key
NOMIC_API_KEY=your_nomic_key
```

### 3. Start Services

```bash
# Direct SDK usage
npm start

# HTTP API server
npm run api-server

# MCP server
npm run mcp-server

# UI server
npm run ui-server
```

---

## Config.js Architecture

The `Config.js` class provides intelligent configuration management with these key features:

### Core Functionality

**Configuration Loading:**
- Searches multiple paths for config.json
- Validates configuration structure
- Merges defaults with user settings
- Transforms different config formats

**Environment Integration:**
- Replaces `${VAR_NAME}` placeholders with environment variables
- Supports `SEMEM_` prefixed environment overrides
- Handles API key substitution

**Validation:**
- Ensures required sections exist
- Validates storage backend configurations
- Checks model provider settings
- Verifies SPARQL endpoint configurations

### Usage Patterns

```javascript
// Initialize with config file
const config = new Config('/path/to/config.json');
await config.init();

// Get configuration values
const storageType = config.get('storage.type');
const chatModel = config.get('models.chat.model');

// Set runtime values
config.set('servers.api', 4200);
```

---

## Configuration Files

### config.json Structure

The main configuration file follows this structure:

```json
{
  "storage": {
    "type": "sparql",
    "options": {
      "query": "https://your-sparql-endpoint.com/query",
      "update": "https://your-sparql-endpoint.com/update",
      "graphName": "http://example.org/semem",
      "user": "admin",
      "password": "admin123"
    }
  },
  "servers": {
    "api": 4100,
    "ui": 4120,
    "redirect": 4110,
    "redirectTarget": 4120
  },
  "templatesPath": "prompts/templates",
  "llmProviders": [
    {
      "type": "mistral",
      "implementation": "hyperdata-clients",
      "apiKey": "${MISTRAL_API_KEY}",
      "chatModel": "mistral-small-latest",
      "priority": 1,
      "capabilities": ["chat"]
    }
  ],
  "sparqlEndpoints": [
    {
      "label": "Production Fuseki",
      "user": "admin",
      "password": "admin123",
      "urlBase": "https://your-fuseki.com",
      "dataset": "semem",
      "query": "/semem/query",
      "update": "/semem/update"
    }
  ]
}
```

### Configuration Sections

#### Storage Configuration
```json
{
  "storage": {
    "type": "sparql",
    "options": {
      "query": "https://endpoint.com/query",
      "update": "https://endpoint.com/update",
      "graphName": "http://example.org/graph",
      "user": "username",
      "password": "password"
    }
  }
}
```

#### Server Ports
```json
{
  "servers": {
    "api": 4100,      // HTTP API server
    "ui": 4120,       // UI server
    "redirect": 4110, // Redirect server
    "redirectTarget": 4120
  }
}
```

#### Prompt Templates Configuration
```json
{
  "templatesPath": "prompts/templates"
}
```

**Configuration Options:**

- **templatesPath**: Path to prompt templates directory (relative to project root or absolute path)
  - Default: `"prompts/templates"`
  - Example: `"custom/templates"` or `"/absolute/path/to/templates"`
  - Used by the unified prompt management system to load external template files

#### LLM Providers Array
```json
{
  "llmProviders": [
    {
      "type": "mistral",
      "implementation": "hyperdata-clients",
      "apiKey": "${MISTRAL_API_KEY}",
      "chatModel": "mistral-small-latest",
      "priority": 1,
      "capabilities": ["chat"],
      "description": "Primary chat provider"
    },
    {
      "type": "ollama",
      "baseUrl": "http://localhost:11434",
      "chatModel": "qwen2:1.5b",
      "embeddingModel": "nomic-embed-text",
      "priority": 2,
      "capabilities": ["embedding", "chat"],
      "description": "Local fallback"
    }
  ]
}
```

---

## Server Configuration

### Server Types and Purposes

**Direct SDK Usage:**
- Direct library integration
- No server required
- Best for custom applications

**HTTP API Server (Port 4100):**
- RESTful API endpoints
- Full programmatic access
- 43 available endpoints
- Swagger/OpenAPI documentation

**MCP Server (stdio):**
- Model Context Protocol integration
- Works with Claude Code, Claude Desktop
- 35+ tools and 15 resources
- Interactive AI workflows

**UI Server (Port 4120):**
- Web-based interface
- VSOM visualization
- Interactive exploration
- Administrative tools

### Server Configuration

```json
{
  "servers": {
    "api": 4100,           // HTTP API port
    "ui": 4120,            // UI server port
    "redirect": 4110,      // Redirect service
    "redirectTarget": 4120 // Where redirects go
  },
  "port": 4120             // Default port fallback
}
```

### Server Startup Commands

```bash
# Start specific servers
npm run api-server      # HTTP API only
npm run ui-server       # UI server only
npm run mcp-server      # MCP server only

# Development
npm run dev             # All servers with hot reload
npm start               # Production mode
```

---

## Storage Backends

### Available Storage Types

#### 1. Memory Storage (Development)
```json
{
  "storage": {
    "type": "memory",
    "options": {}
  }
}
```
**Use Cases:** Testing, development, temporary sessions
**Limitations:** Data lost on restart

#### 2. JSON File Storage (Simple Persistence)
```json
{
  "storage": {
    "type": "json",
    "options": {
      "path": "data/memory.json"
    }
  }
}
```
**Use Cases:** Single-user applications, development
**Limitations:** No concurrent access, limited scalability

#### 3. SPARQL Storage (Recommended)
```json
{
  "storage": {
    "type": "sparql",
    "options": {
      "query": "https://fuseki.example.com/dataset/query",
      "update": "https://fuseki.example.com/dataset/update",
      "graphName": "http://example.org/semem",
      "user": "admin",
      "password": "your_password"
    }
  }
}
```
**Use Cases:** Production, multi-user, semantic web integration
**Benefits:** Scalable, standards-compliant, query-rich

#### 4. Cached SPARQL Storage (High Performance)
```json
{
  "storage": {
    "type": "cached-sparql",
    "options": {
      "query": "https://fuseki.example.com/dataset/query",
      "update": "https://fuseki.example.com/dataset/update",
      "graphName": "http://example.org/semem",
      "user": "admin",
      "password": "your_password",
      "cacheTimeout": 3600
    }
  }
}
```
**Use Cases:** High-performance production deployments
**Benefits:** Fast reads, eventual consistency

---

## LLM and Embedding Providers

### Provider Configuration

Semem supports multiple LLM providers with fallback capabilities:

#### Mistral (Recommended for Chat)
```json
{
  "type": "mistral",
  "implementation": "hyperdata-clients",
  "apiKey": "${MISTRAL_API_KEY}",
  "chatModel": "mistral-small-latest",
  "priority": 1,
  "capabilities": ["chat"],
  "description": "Primary chat provider"
}
```

#### Claude (High Quality)
```json
{
  "type": "claude",
  "implementation": "hyperdata-clients",
  "apiKey": "${CLAUDE_API_KEY}",
  "chatModel": "claude-3-opus-20240229",
  "priority": 2,
  "capabilities": ["chat"],
  "description": "High-quality analysis"
}
```

#### Nomic (Recommended for Embeddings)
```json
{
  "type": "nomic",
  "apiKey": "${NOMIC_API_KEY}",
  "embeddingModel": "nomic-embed-text-v1.5",
  "priority": 1,
  "capabilities": ["embedding"],
  "description": "Cloud embeddings"
}
```

#### Ollama (Local Fallback)
```json
{
  "type": "ollama",
  "baseUrl": "http://localhost:11434",
  "chatModel": "qwen2:1.5b",
  "embeddingModel": "nomic-embed-text",
  "priority": 3,
  "capabilities": ["embedding", "chat"],
  "description": "Local processing"
}
```

### Provider Priority System

Providers are selected based on:
1. **Priority number** (lower = higher priority)
2. **Capability match** (chat vs embedding)
3. **Availability** (API reachable and functional)

#### How Priority Selection Works

The system uses a **priority-based selection algorithm** that:

1. **Filters by capability**: Only considers providers that have the required capability (`chat` or `embedding`)
2. **Sorts by priority**: Orders providers by priority number (1 = highest, 2 = second, etc.)
3. **Attempts connection**: Tries providers in order until one succeeds
4. **Falls back gracefully**: Uses next available provider if higher priority fails

#### Priority Configuration Example

```json
{
  "llmProviders": [
    {
      "type": "mistral",
      "apiKey": "${MISTRAL_API_KEY}",
      "chatModel": "mistral-small-latest",
      "priority": 1,
      "capabilities": ["chat"]
    },
    {
      "type": "claude", 
      "apiKey": "${CLAUDE_API_KEY}",
      "chatModel": "claude-3-opus-20240229",
      "priority": 2,
      "capabilities": ["chat"]
    },
    {
      "type": "ollama",
      "baseUrl": "http://localhost:11434",
      "chatModel": "qwen2:1.5b",
      "priority": 3,
      "capabilities": ["chat", "embedding"]
    }
  ]
}
```

**Selection logic for chat requests:**
1. Try Mistral (priority 1) if `MISTRAL_API_KEY` is available
2. If Mistral fails, try Claude (priority 2) if `CLAUDE_API_KEY` is available  
3. If both fail, fall back to Ollama (priority 3) as local option

#### Model Selection from Providers

When a provider is selected, the system uses the provider's configured model:

```javascript
// Example: If Mistral is selected (priority 1)
const selectedProvider = sortedProviders[0]; // Mistral provider object
const modelToUse = selectedProvider.chatModel; // "mistral-small-latest"
```

This ensures that each provider uses its appropriate model name (e.g., `mistral-small-latest` for Mistral, not `qwen2:1.5b`).

#### API Key Requirements

**Cloud providers** (Mistral, Claude, Nomic) require valid API keys:
- Must be set in `.env` file: `MISTRAL_API_KEY=your_key_here`
- Config uses substitution: `"apiKey": "${MISTRAL_API_KEY}"`
- Provider is skipped if API key is missing or empty

**Local providers** (Ollama) don't require API keys:
- Only need service to be running: `ollama serve`
- Used as fallback when cloud providers unavailable

#### Debugging Priority Selection

To see which provider is selected, enable debug logging:

```bash
LOG_LEVEL=debug npm start
```

Look for log messages like:
```
LLM handler initialized successfully
Using provider: mistral with model: mistral-small-latest
```

#### Common Priority Patterns

**Production (Cloud Primary):**
```json
[
  {"type": "mistral", "priority": 1, "capabilities": ["chat"]},
  {"type": "claude", "priority": 2, "capabilities": ["chat"]}, 
  {"type": "ollama", "priority": 3, "capabilities": ["chat", "embedding"]}
]
```

**Development (Local Primary):**
```json
[
  {"type": "ollama", "priority": 1, "capabilities": ["chat", "embedding"]},
  {"type": "mistral", "priority": 2, "capabilities": ["chat"]}
]
```

**Research (Quality Primary):**
```json
[
  {"type": "claude", "priority": 1, "capabilities": ["chat"]},
  {"type": "mistral", "priority": 2, "capabilities": ["chat"]},
  {"type": "ollama", "priority": 3, "capabilities": ["embedding"]}
]
```

### Capability Types

- **`chat`**: Text generation, conversation, analysis
- **`embedding`**: Vector embeddings for semantic search
- **`both`**: Providers supporting both capabilities

---

## SPARQL Store Configuration

### SPARQL Endpoint Setup

#### Apache Jena Fuseki (Recommended)

**Installation:**
```bash
# Download Fuseki
wget https://downloads.apache.org/jena/binaries/apache-jena-fuseki-4.10.0.tar.gz
tar -xzf apache-jena-fuseki-4.10.0.tar.gz
cd apache-jena-fuseki-4.10.0

# Start with authentication
./fuseki-server --conf=config.ttl
```

**Configuration (config.ttl):**
```turtle
@prefix :        <#> .
@prefix fuseki:  <http://jena.apache.org/fuseki#> .
@prefix rdf:     <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .

[] rdf:type fuseki:Server ;
   fuseki:services (
     <#semem>
   ) .

<#semem> rdf:type fuseki:Service ;
    fuseki:name "semem" ;
    fuseki:serviceQuery "query" ;
    fuseki:serviceUpdate "update" ;
    fuseki:serviceUpload "upload" ;
    fuseki:serviceReadGraphStore "data" ;
    fuseki:serviceReadWriteGraphStore "data" ;
    fuseki:dataset <#dataset> .

<#dataset> rdf:type ja:RDFDataset ;
    ja:defaultGraph <#model> .

<#model> rdf:type ja:MemoryModel .
```

#### External SPARQL Services

**DBpedia (Read-Only):**
```json
{
  "label": "DBpedia",
  "urlBase": "https://dbpedia.org",
  "dataset": "sparql",
  "query": "/sparql",
  "user": null,
  "password": null
}
```

**Wikidata (Read-Only):**
```json
{
  "label": "Wikidata",
  "urlBase": "https://query.wikidata.org",
  "dataset": "sparql",
  "query": "/sparql",
  "user": null,
  "password": null
}
```

### SPARQL Endpoint Arrays

Configure multiple endpoints for fallback:

```json
{
  "sparqlEndpoints": [
    {
      "label": "Primary Production",
      "user": "admin",
      "password": "admin123",
      "urlBase": "https://fuseki.example.com",
      "dataset": "semem",
      "query": "/semem/query",
      "update": "/semem/update",
      "upload": "/semem/upload",
      "gspRead": "/semem/data",
      "gspWrite": "/semem/data"
    },
    {
      "label": "Local Development",
      "user": "admin",
      "password": "admin123",
      "urlBase": "http://localhost:3030",
      "dataset": "semem",
      "query": "/semem/query",
      "update": "/semem/update"
    }
  ]
}
```

### Security Configuration

**Authentication:**
```json
{
  "user": "your_username",
  "password": "secure_password"
}
```

**HTTPS/TLS:**
```json
{
  "urlBase": "https://secure-fuseki.example.com",
  "ssl": {
    "verify": true,
    "ca": "/path/to/ca.pem"
  }
}
```

---

## Environment Variables

### .env File Configuration

#### Essential Variables

```bash
# API Keys (required for cloud providers)
MISTRAL_API_KEY=your_mistral_api_key
CLAUDE_API_KEY=your_claude_api_key
NOMIC_API_KEY=your_nomic_api_key

# Local Services
OLLAMA_HOST=http://localhost:11434
```

#### Server Configuration

```bash
# Override default ports
SEMEM_SERVERS_API=4200
SEMEM_SERVERS_UI=4300

# Override storage backend
SEMEM_STORAGE_TYPE=sparql
```

#### SPARQL Configuration

```bash
# SPARQL endpoint settings
SPARQL_QUERY_ENDPOINT=https://your-endpoint.com/query
SPARQL_UPDATE_ENDPOINT=https://your-endpoint.com/update
SPARQL_GRAPH_NAME=http://example.org/graph
SPARQL_USER=username
SPARQL_PASSWORD=password
```

#### Development Settings

```bash
# Development mode
NODE_ENV=development
LOG_LEVEL=debug

# Test configuration
TEST_TIMEOUT=10000
ENABLE_WEBSOCKET=true
```

### Environment Variable Substitution

Config.json supports environment variable substitution using `${VAR_NAME}` syntax:

```json
{
  "llmProviders": [
    {
      "type": "mistral",
      "apiKey": "${MISTRAL_API_KEY}",
      "endpoint": "${MISTRAL_ENDPOINT}"
    }
  ],
  "storage": {
    "options": {
      "user": "${SPARQL_USER}",
      "password": "${SPARQL_PASSWORD}"
    }
  }
}
```

### SEMEM_ Prefix Overrides

Environment variables with `SEMEM_` prefix automatically override config values:

```bash
# Override storage type
SEMEM_STORAGE_TYPE=memory

# Override server ports
SEMEM_SERVERS_API=5000
SEMEM_SERVERS_UI=5001

# Override model selection
SEMEM_MODELS_CHAT_MODEL=claude-3-opus-20240229
```

---

## Configuration Examples

### Example 1: Local Development Setup

**config.json:**
```json
{
  "storage": {
    "type": "json",
    "options": {
      "path": "data/development.json"
    }
  },
  "servers": {
    "api": 4100,
    "ui": 4120
  },
  "llmProviders": [
    {
      "type": "ollama",
      "baseUrl": "http://localhost:11434",
      "chatModel": "qwen2:1.5b",
      "embeddingModel": "nomic-embed-text",
      "priority": 1,
      "capabilities": ["embedding", "chat"]
    }
  ]
}
```

**.env:**
```bash
NODE_ENV=development
OLLAMA_HOST=http://localhost:11434
LOG_LEVEL=debug
```

### Example 2: Production Cloud Setup

**config.json:**
```json
{
  "storage": {
    "type": "sparql",
    "options": {
      "query": "https://fuseki.production.com/semem/query",
      "update": "https://fuseki.production.com/semem/update",
      "graphName": "http://production.org/semem",
      "user": "${SPARQL_USER}",
      "password": "${SPARQL_PASSWORD}"
    }
  },
  "servers": {
    "api": 8080,
    "ui": 8081
  },
  "llmProviders": [
    {
      "type": "mistral",
      "apiKey": "${MISTRAL_API_KEY}",
      "chatModel": "mistral-small-latest",
      "priority": 1,
      "capabilities": ["chat"]
    },
    {
      "type": "nomic",
      "apiKey": "${NOMIC_API_KEY}",
      "embeddingModel": "nomic-embed-text-v1.5",
      "priority": 1,
      "capabilities": ["embedding"]
    }
  ]
}
```

**.env:**
```bash
NODE_ENV=production
MISTRAL_API_KEY=your_production_mistral_key
NOMIC_API_KEY=your_production_nomic_key
SPARQL_USER=production_user
SPARQL_PASSWORD=secure_production_password
```

### Example 3: Hybrid Setup (Cloud + Local Fallback)

**config.json:**
```json
{
  "storage": {
    "type": "cached-sparql",
    "options": {
      "query": "https://fuseki.example.com/semem/query",
      "update": "https://fuseki.example.com/semem/update",
      "graphName": "http://example.org/semem",
      "user": "${SPARQL_USER}",
      "password": "${SPARQL_PASSWORD}",
      "cacheTimeout": 3600
    }
  },
  "llmProviders": [
    {
      "type": "mistral",
      "apiKey": "${MISTRAL_API_KEY}",
      "chatModel": "mistral-small-latest",
      "priority": 1,
      "capabilities": ["chat"]
    },
    {
      "type": "nomic",
      "apiKey": "${NOMIC_API_KEY}",
      "embeddingModel": "nomic-embed-text-v1.5",
      "priority": 1,
      "capabilities": ["embedding"]
    },
    {
      "type": "ollama",
      "baseUrl": "http://localhost:11434",
      "chatModel": "qwen2:1.5b",
      "embeddingModel": "nomic-embed-text",
      "priority": 2,
      "capabilities": ["embedding", "chat"],
      "description": "Local fallback"
    }
  ]
}
```

### Example 4: Research/Academic Setup

**config.json:**
```json
{
  "storage": {
    "type": "sparql",
    "options": {
      "query": "http://localhost:3030/research/query",
      "update": "http://localhost:3030/research/update",
      "graphName": "http://research.university.edu/semem"
    }
  },
  "sparqlEndpoints": [
    {
      "label": "University Research",
      "urlBase": "http://localhost:3030",
      "dataset": "research",
      "query": "/research/query",
      "update": "/research/update"
    },
    {
      "label": "External DBpedia",
      "urlBase": "https://dbpedia.org",
      "dataset": "sparql",
      "query": "/sparql"
    }
  ],
  "llmProviders": [
    {
      "type": "claude",
      "apiKey": "${CLAUDE_API_KEY}",
      "chatModel": "claude-3-opus-20240229",
      "priority": 1,
      "capabilities": ["chat"],
      "description": "High-quality research analysis"
    },
    {
      "type": "ollama",
      "baseUrl": "http://localhost:11434",
      "embeddingModel": "nomic-embed-text",
      "priority": 1,
      "capabilities": ["embedding"]
    }
  ]
}
```

---

## Troubleshooting

### Common Configuration Issues

#### 1. Config File Not Found

**Symptoms:**
```
Config file not found in any of these locations
```

**Solutions:**
- Verify config.json exists in `/config/` directory
- Check file permissions (readable)
- Use absolute path if needed:
  ```javascript
  const config = new Config('/absolute/path/to/config.json');
  ```

#### 2. Environment Variable Substitution Failed

**Symptoms:**
```
API key is empty or contains ${VAR_NAME}
```

**Solutions:**
- Check .env file exists and is readable
- Verify environment variable names match exactly
- Use `printenv | grep MISTRAL` to check variables are set

#### 3. SPARQL Connection Errors

**Symptoms:**
```
SPARQL endpoint connection failed
Cannot connect to https://fuseki.example.com/query
```

**Solutions:**
- Test endpoint manually:
  ```bash
  curl -X POST https://fuseki.example.com/query \
    -H "Content-Type: application/sparql-query" \
    -d "SELECT * WHERE { ?s ?p ?o } LIMIT 1"
  ```
- Check authentication credentials
- Verify network connectivity and firewall settings
- Ensure SPARQL service is running

#### 4. LLM Provider Initialization Failed

**Symptoms:**
```
No suitable LLM provider found for capability: chat
Provider initialization failed: mistral
Failed to load provider configuration, defaulting to Ollama: Mistral API key is required
```

**Solutions:**
- Verify API keys are set in environment
- Check provider priority configuration
- Test API connectivity:
  ```bash
  curl -H "Authorization: Bearer $MISTRAL_API_KEY" \
    https://api.mistral.ai/v1/models
  ```
- Ensure Ollama is running for local providers:
  ```bash
  ollama list
  ```

#### 4a. Provider Priority Selection Issues

**Symptoms:**
```
Using wrong provider (expected Mistral, got Ollama)
Invalid model: qwen2:1.5b (when using Mistral)
API key is required (when key is set in .env)
```

**Common Causes & Solutions:**

**Missing API Key in Environment:**
```bash
# Check if API key is set
echo $MISTRAL_API_KEY

# If empty, verify .env file
cat .env | grep MISTRAL_API_KEY

# Ensure .env is loaded
source .env  # or restart your application
```

**Wrong Model Configuration:**
```javascript
// ❌ Wrong: Using Ollama model name for Mistral provider
{
  "type": "mistral",
  "chatModel": "qwen2:1.5b",  // This is an Ollama model!
  "apiKey": "${MISTRAL_API_KEY}"
}

// ✅ Correct: Using appropriate model for each provider
{
  "type": "mistral", 
  "chatModel": "mistral-small-latest",  // Mistral model
  "apiKey": "${MISTRAL_API_KEY}"
}
```

**Priority Configuration Issues:**
```javascript
// ❌ Wrong: Same priority numbers
[
  {"type": "mistral", "priority": 1},
  {"type": "claude", "priority": 1}  // Same priority!
]

// ✅ Correct: Unique priorities
[
  {"type": "mistral", "priority": 1},  // Highest priority
  {"type": "claude", "priority": 2},   // Second priority
  {"type": "ollama", "priority": 3}    // Fallback
]
```

**Debugging Provider Selection:**
```bash
# Enable debug logging to see provider selection
LOG_LEVEL=debug node your-script.js

# Look for these debug messages:
# "LLM handler initialized successfully"
# "Using provider: mistral with model: mistral-small-latest"
# "Failed to load provider configuration, defaulting to..."
```

**Test Provider Connectivity:**
```bash
# Test Mistral API
curl -X GET "https://api.mistral.ai/v1/models" \
  -H "Authorization: Bearer $MISTRAL_API_KEY"

# Test Claude API  
curl -X GET "https://api.anthropic.com/v1/messages" \
  -H "x-api-key: $CLAUDE_API_KEY" \
  -H "anthropic-version: 2023-06-01"

# Test Ollama (local)
curl -X GET "http://localhost:11434/api/tags"
```

#### 5. Port Conflicts

**Symptoms:**
```
Error: listen EADDRINUSE :::4100
```

**Solutions:**
- Check for running services: `lsof -i :4100`
- Change port in config.json or environment:
  ```bash
  SEMEM_SERVERS_API=4200
  ```
- Kill conflicting processes if safe to do so

#### 6. Permission Errors

**Symptoms:**
```
Error: EACCES: permission denied, open 'config/config.json'
```

**Solutions:**
- Fix file permissions:
  ```bash
  chmod 644 config/config.json
  chmod 755 config/
  ```
- Run with appropriate user privileges
- Check directory ownership

### Validation Errors

#### Storage Configuration
```javascript
// Required fields for SPARQL storage
{
  "storage": {
    "type": "sparql",
    "options": {
      "query": "https://...",    // Required
      "update": "https://...",   // Required
      "graphName": "http://..."  // Required
    }
  }
}
```

#### LLM Provider Configuration
```javascript
// Required fields per provider
{
  "type": "mistral",        // Required
  "apiKey": "${API_KEY}",   // Required for cloud providers
  "capabilities": ["chat"], // Required
  "priority": 1            // Required (lower = higher priority)
}
```

### Debug Configuration Loading

Enable debug logging to trace configuration loading:

```bash
# Set debug level
LOG_LEVEL=debug npm start

# Or use NODE_DEBUG
NODE_DEBUG=config npm start
```

Debug output will show:
- Config file search paths
- Environment variable substitution
- Validation results
- Final merged configuration

### Testing Configuration

Test your configuration without starting services:

```javascript
// test-config.js
import Config from './src/Config.js';

async function testConfig() {
  try {
    const config = new Config('./config/config.json');
    await config.init();
    console.log('✅ Configuration valid');
    console.log('Storage type:', config.get('storage.type'));
    console.log('Chat model:', config.get('models.chat.model'));
  } catch (error) {
    console.error('❌ Configuration error:', error.message);
  }
}

testConfig();
```

Run test:
```bash
node test-config.js
```

---

## Conclusion

Semem's configuration system provides flexible, secure, and scalable configuration management suitable for development through production deployments. Key success factors:

1. **Start Simple**: Begin with local development configuration
2. **Use Environment Variables**: Keep secrets out of config files
3. **Test Incrementally**: Validate each configuration change
4. **Monitor Health**: Use `/api/health` endpoint to verify configuration
5. **Plan for Scale**: Design configuration for future growth

For additional support, consult the [HTTP API endpoints documentation](./http-api-endpoints.md) and [MCP tools reference](./mcp-list.md).