# Semem MCP Phase 1 User Guide

## 🚀 Quick Start

The Semem MCP integration provides 18 comprehensive tools for semantic memory management. Here's how to use them effectively.

## 📋 Core Memory Operations (Original 5 Tools)

### Basic Memory Storage and Retrieval
```javascript
// Store an interaction
await callTool("semem_store_interaction", {
  prompt: "What is machine learning?",
  response: "Machine learning is a subset of AI that enables computers to learn without explicit programming.",
  metadata: { source: "educational", confidence: 0.9 }
});

// Retrieve similar memories
await callTool("semem_retrieve_memories", {
  query: "artificial intelligence learning",
  threshold: 0.7,
  limit: 5
});

// Generate embeddings
await callTool("semem_generate_embedding", {
  text: "Neural networks and deep learning"
});

// Generate responses with memory context
await callTool("semem_generate_response", {
  prompt: "Explain neural networks",
  useMemory: true,
  temperature: 0.7,
  maxTokens: 500
});

// Extract concepts from text
await callTool("semem_extract_concepts", {
  text: "The transformer architecture revolutionized natural language processing"
});
```

## 🗄️ Storage Management (6 New Tools)

### Switch Storage Backends
```javascript
// Switch to JSON file storage
await callTool("semem_switch_storage_backend", {
  backend: "JSON",
  config: { filePath: "./my-project-memory.json" }
});

// Switch to SPARQL triple store
await callTool("semem_switch_storage_backend", {
  backend: "SPARQL", 
  config: {
    endpoint: "http://localhost:3030/my-dataset",
    user: "admin",
    password: "secret123"
  }
});

// Switch to cached SPARQL for better performance
await callTool("semem_switch_storage_backend", {
  backend: "CachedSPARQL",
  config: {
    endpoint: "http://localhost:3030/my-dataset",
    cacheOptions: { maxSize: 1000, ttl: 300000 }
  }
});
```

### Backup and Restore Operations
```javascript
// Create comprehensive backup
await callTool("semem_backup_memory", {
  format: "json",
  includeEmbeddings: true
});

// Create lightweight backup (no embeddings)
await callTool("semem_backup_memory", {
  format: "json", 
  includeEmbeddings: false
});

// Load from backup (merge with existing)
await callTool("semem_load_memory", {
  source: "./backup-2024-01-15.json",
  format: "json",
  merge: true
});

// Load from backup (replace existing)
await callTool("semem_load_memory", {
  source: "./backup-2024-01-15.json",
  format: "json", 
  merge: false
});
```

### Storage Monitoring and Management
```javascript
// Get storage statistics
await callTool("semem_storage_stats", {});

// Migrate from one backend to another
await callTool("semem_migrate_storage", {
  fromBackend: "InMemory",
  toBackend: "JSON",
  config: { filePath: "./migrated-memory.json" }
});

// Clear storage (with backup)
await callTool("semem_clear_storage", {
  confirm: true,
  backup: true
});
```

## 🧠 Context Management (4 New Tools)

### Context Window Operations
```javascript
// Get current context information
await callTool("semem_get_context", {});

// Update context configuration
await callTool("semem_update_context_config", {
  maxTokens: 16384,
  maxTimeWindow: 7200000, // 2 hours in milliseconds
  relevanceThreshold: 0.8,
  maxContextSize: 15
});

// Prune context based on criteria
await callTool("semem_prune_context", {
  minRelevance: 0.6,
  maxAge: 3600000 // 1 hour in milliseconds
});

// Generate context summary
await callTool("semem_summarize_context", {});
```

## ⚙️ System Configuration (3 New Tools)

### Configuration Management
```javascript
// Get current system configuration
await callTool("semem_get_config", {});

// Update context-related settings
await callTool("semem_update_config", {
  section: "context",
  updates: {
    maxTokens: 20000,
    relevanceThreshold: 0.85
  }
});

// Update cache settings
await callTool("semem_update_config", {
  section: "cache",
  updates: {
    maxSize: 2000,
    ttl: 600000
  }
});
```

### System Monitoring
```javascript
// Get detailed system metrics
await callTool("semem_get_metrics", {});

// Comprehensive health check
await callTool("semem_health_check", {});
```

## 📚 Resources and Documentation

### Access System Resources
```javascript
// Get system status
await readResource("semem://status");

// Read complete API documentation
await readResource("semem://docs/api");

// Get current configuration
await readResource("semem://config/current");

// View available storage backends
await readResource("semem://storage/backends");

// Access Ragno ontology
await readResource("semem://ragno/ontology");

// View system metrics dashboard
await readResource("semem://metrics/dashboard");

// Get workflow examples
await readResource("semem://examples/workflows");
```

## 🔄 Common Workflows

### Development Workflow
1. Start with InMemory storage for rapid development
2. Use JSON storage for persistence during development
3. Extract concepts and store interactions as you work
4. Monitor context and prune when needed

### Production Deployment Workflow
1. Configure SPARQL or CachedSPARQL storage for scalability
2. Set up regular backup schedules
3. Configure context optimization for your use case
4. Set up health monitoring and metrics collection

### Migration Workflow
1. Backup current data: `semem_backup_memory`
2. Switch to new backend: `semem_switch_storage_backend`
3. Migrate data: `semem_migrate_storage`
4. Verify with: `semem_storage_stats` and `semem_health_check`

## 🔧 Configuration Examples

### High-Performance Configuration
```javascript
// Optimize for performance
await callTool("semem_update_context_config", {
  maxTokens: 32000,
  relevanceThreshold: 0.9,
  maxContextSize: 20
});

await callTool("semem_update_config", {
  section: "cache",
  updates: {
    maxSize: 5000,
    ttl: 900000 // 15 minutes
  }
});
```

### Memory-Efficient Configuration
```javascript
// Optimize for memory usage
await callTool("semem_update_context_config", {
  maxTokens: 8000,
  relevanceThreshold: 0.8,
  maxContextSize: 5
});

await callTool("semem_update_config", {
  section: "cache", 
  updates: {
    maxSize: 500,
    ttl: 300000 // 5 minutes
  }
});
```

## 🚨 Error Handling

All tools return standardized error responses with `success: false` and detailed error messages. Always check the `success` field in responses:

```javascript
const result = await callTool("semem_store_interaction", {
  prompt: "test",
  response: "test response"
});

if (result.success) {
  console.log("Stored successfully:", result.id);
} else {
  console.error("Storage failed:", result.error);
}
```

## 📈 GraphRAG Compatibility

Semem tools provide equivalents to GraphRAG standard tools:

- `semem_store_interaction` ≈ `store_document`
- `semem_retrieve_memories` ≈ `hybrid_search`
- `semem_storage_stats` ≈ `get_knowledge_graph_stats`
- `semem_health_check` ≈ comprehensive system monitoring

Plus semantic web enhancements:
- Multiple storage backends (JSON, SPARQL, Cached)
- Context window management
- Real-time configuration updates
- RDF/SPARQL integration

---

**Need Help?** Check the comprehensive API documentation at `semem://docs/api` or explore workflow examples at `semem://examples/workflows`.