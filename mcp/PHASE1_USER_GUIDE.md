# Semem MCP Phase 1 Tools - User Guide

## Quick Start

The enhanced Semem MCP server now provides **18 comprehensive tools** and **8 detailed resources** for complete semantic memory management.

### Start the MCP Server
```bash
# Standard MCP server
npm run mcp

# With HTTP tools (recommended)
MCP_USE_HTTP_TOOLS=true npm run mcp
```

## Tool Categories & Usage

### 🗄️ Storage Management Tools

#### Switch Storage Backends
```json
{
  "tool": "semem_switch_storage_backend",
  "params": {
    "backend": "SPARQL",
    "config": {
      "endpoint": "http://localhost:3030/semem",
      "user": "admin",
      "password": "admin"
    }
  }
}
```

#### Backup Memory
```json
{
  "tool": "semem_backup_memory",
  "params": {
    "format": "json",
    "includeEmbeddings": true
  }
}
```

#### Get Storage Statistics
```json
{
  "tool": "semem_storage_stats",
  "params": {}
}
```

### 🧠 Context Management Tools

#### Get Current Context
```json
{
  "tool": "semem_get_context",
  "params": {}
}
```

#### Update Context Configuration
```json
{
  "tool": "semem_update_context_config",
  "params": {
    "maxTokens": 16384,
    "relevanceThreshold": 0.8,
    "maxContextSize": 10
  }
}
```

#### Prune Context
```json
{
  "tool": "semem_prune_context",
  "params": {
    "minRelevance": 0.6,
    "maxAge": 3600000
  }
}
```

### ⚙️ Configuration & Status Tools

#### Get System Configuration
```json
{
  "tool": "semem_get_config",
  "params": {}
}
```

#### Update Configuration
```json
{
  "tool": "semem_update_config",
  "params": {
    "section": "context",
    "updates": {
      "maxTokens": 12288,
      "relevanceThreshold": 0.75
    }
  }
}
```

#### Get System Metrics
```json
{
  "tool": "semem_get_metrics",
  "params": {}
}
```

#### Health Check
```json
{
  "tool": "semem_health_check",
  "params": {}
}
```

## Resource Access

### Configuration Information
```
Resource: semem://config/current
Returns: Current system configuration across all components
```

### Storage Backend Information
```
Resource: semem://storage/backends
Returns: Available backends with usage examples
```

### Ragno Ontology
```
Resource: semem://ragno/ontology
Returns: Complete RDF ontology in Turtle format
```

### System Metrics Dashboard
```
Resource: semem://metrics/dashboard
Returns: Real-time system performance metrics
```

### Workflow Examples
```
Resource: semem://examples/workflows
Returns: Common usage patterns and workflow templates
```

## Common Workflows

### 1. Production Setup Workflow
```bash
# 1. Check system health
semem_health_check

# 2. Configure for production
semem_update_context_config:
  maxTokens: 16384
  relevanceThreshold: 0.8

# 3. Switch to persistent storage
semem_switch_storage_backend:
  backend: "SPARQL"
  config: { endpoint: "your-sparql-endpoint" }

# 4. Verify configuration
semem_get_config
```

### 2. Performance Optimization Workflow
```bash
# 1. Check current metrics
semem_get_metrics

# 2. Inspect context usage
semem_get_context

# 3. Prune old context items
semem_prune_context:
  minRelevance: 0.7
  maxAge: 1800000  # 30 minutes

# 4. Optimize context settings
semem_update_context_config:
  maxContextSize: 8
  relevanceThreshold: 0.75
```

### 3. Data Management Workflow
```bash
# 1. Check storage stats
semem_storage_stats

# 2. Create backup
semem_backup_memory:
  format: "json"
  includeEmbeddings: true

# 3. Migrate to better storage
semem_migrate_storage:
  fromBackend: "InMemory"
  toBackend: "JSON"
  config: { filePath: "./production-memory.json" }
```

### 4. Development & Testing Workflow
```bash
# 1. Start with clean state
semem_clear_storage:
  confirm: true
  backup: true

# 2. Load test data
semem_load_memory:
  source: "./test-data.json"
  format: "json"
  merge: false

# 3. Run tests and monitor
semem_get_metrics
semem_health_check
```

## Error Handling

All tools provide comprehensive error reporting:

```json
{
  "success": false,
  "error": "Detailed error message",
  "tool": "tool_name",
  "context": "Additional context information"
}
```

## Best Practices

### Storage Selection
- **InMemory**: Development and testing
- **JSON**: Local development with persistence
- **SPARQL**: Production with semantic queries
- **CachedSPARQL**: High-performance production

### Context Management
- Monitor context size with `semem_get_context`
- Prune regularly in high-traffic applications
- Adjust relevance threshold based on use case
- Use context summaries for optimization

### System Monitoring
- Run `semem_health_check` regularly
- Monitor metrics during peak usage
- Backup before major configuration changes
- Use storage stats to track growth

### Configuration Updates
- Update context settings gradually
- Test changes in development first
- Backup configuration before updates
- Monitor performance after changes

## Integration with GraphRAG

Semem tools provide enhanced versions of standard GraphRAG operations:

| GraphRAG Tool | Semem Equivalent | Enhancement |
|---------------|------------------|-------------|
| `store_document` | `semem_store_interaction` | + concept extraction |
| `hybrid_search` | `semem_retrieve_memories` | + configurable similarity |
| `get_knowledge_graph_stats` | `semem_storage_stats` | + comprehensive metrics |
| System monitoring | `semem_health_check` | + component-level health |

## Future Phase Preview

### Phase 2 (Ragno Knowledge Graph) - Coming Soon
- RDF knowledge graph construction
- SPARQL querying capabilities
- Graph analytics and communities
- Entity and relationship management

### Phase 3 (ZPT Navigation) - Planned
- Multi-dimensional content navigation
- Intelligent content transformation
- Batch operations
- Advanced similarity search

**Current Status: Phase 1 Complete - Production Ready! 🚀**