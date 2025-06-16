# Semem MCP Examples

Comprehensive examples and demonstrations for the Semem Model Context Protocol (MCP) server, showcasing all 32 tools and 15 resources across semantic memory management, knowledge graph operations, and 3D navigation.

## 🚀 Quick Start

### Prerequisites
```bash
# Install dependencies
npm install

# Ensure MCP server is running
npm run mcp:start
```

### Run Your First Demo
```bash
# Basic semantic memory operations
node examples/mcp/SememCoreDemo.js

# Or try ZPT 3D navigation
node examples/mcp/ZPTBasicNavigation.js
```

## 📚 Complete Tool & Resource Coverage

### 32 MCP Tools Available

#### 🧠 Core Memory Management (5 tools)
- `semem_store_interaction` - Store interactions with embedding generation
- `semem_retrieve_memories` - Semantic memory search and retrieval
- `semem_generate_embedding` - Generate vector embeddings for text
- `semem_generate_response` - LLM response generation with memory context
- `semem_extract_concepts` - Extract semantic concepts from text

#### 💾 Storage Backend Management (6 tools)
- `semem_switch_storage_backend` - Switch between storage backends
- `semem_backup_memory` - Backup memory to JSON/RDF formats
- `semem_load_memory` - Load memory from backup files
- `semem_storage_stats` - Get storage statistics and health
- `semem_migrate_storage` - Migrate data between storage backends
- `semem_clear_storage` - Clear storage with confirmation

#### 🎯 Context Management (4 tools)
- `semem_get_context` - Retrieve current context window information
- `semem_update_context_config` - Update context window settings
- `semem_prune_context` - Prune context based on relevance and age
- `semem_summarize_context` - Generate summaries of current context

#### ⚙️ System Configuration & Monitoring (4 tools)
- `semem_get_config` - Get current system configuration
- `semem_update_config` - Update system configuration settings
- `semem_get_metrics` - Get detailed system metrics and performance
- `semem_health_check` - Comprehensive health check of all components

#### 🕸️ Ragno Knowledge Graph (8 tools)
- `ragno_decompose_corpus` - Transform text corpus into RDF knowledge graph
- `ragno_search_dual` - Combined exact + vector + PersonalizedPageRank search
- `ragno_get_entities` - Retrieve entities from knowledge graph with filtering
- `ragno_vector_search` - HNSW-based vector similarity search
- `ragno_export_rdf` - Export knowledge graph in multiple RDF formats
- `ragno_query_sparql` - Execute SPARQL queries against the graph
- `ragno_analyze_graph` - Graph analysis (centrality, communities, connectivity)
- `ragno_get_graph_stats` - Basic and detailed knowledge graph statistics

#### 🧭 ZPT 3D Navigation (6 tools)
- `zpt_navigate` - 3-dimensional knowledge graph navigation using spatial metaphors
- `zpt_preview` - Preview ZPT navigation options without full processing
- `zpt_get_schema` - Get complete ZPT parameter schema and documentation
- `zpt_validate_params` - Validate ZPT parameters with error reporting
- `zpt_get_options` - Get available parameter values for current corpus state
- `zpt_analyze_corpus` - Analyze corpus structure for ZPT optimization

### 15 MCP Resources Available

#### 📊 System Resources
- `semem://status` - System status and service health
- `semem://docs/api` - Complete API documentation
- `semem://graph/schema` - RDF graph schema and ontology
- `semem://config/current` - Current system configuration
- `semem://storage/backends` - Storage backend information
- `semem://metrics/dashboard` - System metrics and performance data
- `semem://examples/workflows` - Common workflow examples

#### 🕸️ Ragno Knowledge Graph Resources
- `semem://ragno/ontology` - Complete Ragno ontology in Turtle format
- `semem://ragno/pipeline` - Complete Ragno knowledge graph pipeline guide
- `semem://ragno/examples` - Knowledge graph construction examples
- `semem://ragno/sparql/queries` - Pre-built SPARQL query templates

#### 🧭 ZPT Navigation Resources
- `semem://zpt/schema` - Complete JSON schema for ZPT navigation parameters
- `semem://zpt/examples` - Comprehensive ZPT navigation examples
- `semem://zpt/guide` - ZPT concepts and spatial metaphors guide
- `semem://zpt/performance` - ZPT performance optimization strategies

## 🎯 Demo Categories

### Core Memory & System Demos
| Demo File | Description | Tools Demonstrated | Difficulty |
|-----------|-------------|-------------------|------------|
| `SememCoreDemo.js` | Basic semantic memory operations | Core memory + system tools | ⭐ Beginner |

### ZPT 3D Navigation Demos ✅ COMPLETE
| Demo File | Description | Tools Demonstrated | Difficulty |
|-----------|-------------|-------------------|------------|
| `ZPTBasicNavigation.js` | Zoom/Pan/Tilt navigation fundamentals | `zpt_navigate`, `zpt_preview`, `zpt_get_schema` | ⭐ Beginner |
| `ZPTAdvancedFiltering.js` | Complex multi-dimensional filtering | `zpt_navigate` with temporal/geographic/entity filters | ⭐⭐ Intermediate |
| `ZPTUtilityTools.js` | Schema, validation, and analysis tools | `zpt_get_schema`, `zpt_validate_params`, `zpt_get_options` | ⭐⭐ Intermediate |
| `ZPTPerformanceOptimization.js` | Performance benchmarking and optimization | All ZPT tools with comprehensive metrics analysis | ⭐⭐⭐ Advanced |
| `ZPTIntegrationWorkflows.js` | Integration with Memory and Ragno systems | Cross-system workflows (Semem + Ragno + ZPT) | ⭐⭐⭐ Advanced |

### Ragno Knowledge Graph Demos
| Demo File | Description | Tools Demonstrated | Difficulty |
|-----------|-------------|-------------------|------------|
| `RagnoCorpusDecomposition.js` | Text-to-RDF transformation | `ragno_decompose_corpus`, entity extraction | ⭐⭐ Intermediate |

### Integration & Workflow Demos
| Demo File | Description | Tools Demonstrated | Difficulty |
|-----------|-------------|-------------------|------------|
| `GraphRAGDemo.js` | GraphRAG-compatible operations | GraphRAG standard tool equivalents | ⭐⭐ Intermediate |
| `IntegratedWorkflowDemo.js` | End-to-end complex workflows | All tool categories combined | ⭐⭐⭐⭐ Expert |

## 🎨 Demo Features

All demos include:
- **🌈 Rich Visual Output** - Colored console output with progress indicators
- **📊 Performance Metrics** - Timing, success rates, and resource usage
- **🔍 Detailed Logging** - Debug information and step-by-step progress
- **⚡ Error Handling** - Graceful error recovery with helpful messages
- **📈 Progress Tracking** - Visual progress bars and completion status

## 🏃‍♂️ Running Demos

### Individual Demos
```bash
# Core memory and system functionality
node examples/mcp/SememCoreDemo.js

# ZPT 3D navigation (Complete Suite)
node examples/mcp/ZPTBasicNavigation.js
node examples/mcp/ZPTAdvancedFiltering.js
node examples/mcp/ZPTUtilityTools.js
node examples/mcp/ZPTPerformanceOptimization.js
node examples/mcp/ZPTIntegrationWorkflows.js

# Ragno knowledge graph operations
node examples/mcp/RagnoCorpusDecomposition.js

# Integration workflows
node examples/mcp/IntegratedWorkflowDemo.js
```

### Debug Mode
```bash
# Run with detailed debug logging
DEBUG=* node examples/mcp/[DemoName].js

# Or set log level in the demo
# (Each demo supports DEBUG log level for detailed output)
```

## 📖 Learning Path

### 1. **Start Here: Basic Memory** ⭐
Run `SememCoreDemo.js` to understand core semantic memory concepts

### 2. **Explore Knowledge Graphs** ⭐⭐
Try `RagnoCorpusDecomposition.js` to see text-to-RDF transformation

### 3. **Learn 3D Navigation** ⭐⭐
Experience `ZPTBasicNavigation.js` for intuitive graph exploration

### 4. **Master Advanced ZPT** ⭐⭐⭐
Progress through the complete ZPT suite:
- `ZPTAdvancedFiltering.js` for complex filtering patterns
- `ZPTUtilityTools.js` for validation and optimization
- `ZPTPerformanceOptimization.js` for performance tuning
- `ZPTIntegrationWorkflows.js` for cross-system integration

### 5. **Expert Integration** ⭐⭐⭐⭐
Combine everything with `IntegratedWorkflowDemo.js`

## 🔧 Configuration

### MCP Server Configuration
```javascript
// Default configuration for examples
const defaultConfig = {
  serverPath: 'node mcp/index.js',
  serverArgs: [],
  timeout: 30000,
  retries: 3
};
```

### Logging Configuration
```javascript
// Available log levels: TRACE, DEBUG, INFO, WARN, ERROR, SILENT
import log from 'loglevel';
log.setLevel('DEBUG'); // Set in each demo file
```

## 🛠️ Customization

### Creating Your Own Demo
```javascript
#!/usr/bin/env node
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import chalk from 'chalk';
import log from 'loglevel';

class MyCustomDemo {
  constructor() {
    this.client = null;
    this.transport = null;
    this.startTime = Date.now();
  }

  logBanner(title, subtitle = null) {
    const elapsed = ((Date.now() - this.startTime) / 1000).toFixed(1);
    console.log(chalk.blue.bold(`\\n${'█'.repeat(70)}`));
    console.log(chalk.blue.bold(`██ ${title.padEnd(64)} ██`));
    if (subtitle) {
      console.log(chalk.blue(`██ ${subtitle.padEnd(64)} ██`));
    }
    console.log(chalk.blue.bold(`██ Time: ${elapsed}s`.padEnd(66) + ' ██'));
    console.log(chalk.blue.bold(`${'█'.repeat(70)}`));
  }

  // Your demo implementation here...
}
```

## 📋 Complete Reference

### Quick Command Reference
```bash
# Memory operations
semem_store_interaction       # Store new memory with embeddings
semem_retrieve_memories       # Search and retrieve memories
semem_generate_embedding      # Create embeddings
semem_generate_response       # Generate LLM responses

# Knowledge graph operations  
ragno_decompose_corpus        # Text to RDF transformation
ragno_search_dual            # Multi-modal search
ragno_export_rdf             # Export graph data

# 3D navigation
zpt_navigate                 # Navigate with Zoom/Pan/Tilt
zpt_preview                  # Preview navigation options
zpt_validate_params          # Validate parameters
```

### Resource Access
```bash
# Read any resource
semem://[resource-path]

# Examples:
semem://status               # System status
semem://ragno/ontology      # Ragno ontology
semem://zpt/guide           # ZPT navigation guide
```

## 🆘 Troubleshooting

### Common Issues

#### MCP Server Not Running
```bash
# Start the MCP server
npm run mcp:start

# Or manually
node mcp/index.js
```

#### Connection Timeout
```bash
# Check server status
curl http://localhost:3000/health

# Increase timeout in demo files
const client = new Client({ timeout: 60000 });
```

#### Missing Dependencies
```bash
# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

### Debug Information
Each demo provides detailed debug information when run with DEBUG log level. Look for:
- Connection status messages
- Tool execution timing
- Parameter validation details
- Error context and suggestions

## 🤝 Contributing

### Adding New Demos
1. Follow the established class-based structure
2. Use chalk for colored output and visual formatting
3. Include comprehensive error handling
4. Add performance metrics and timing
5. Update this README with your new demo

### Code Style
- Use ES6 modules and async/await
- Include detailed JSDoc comments
- Follow the existing visual formatting patterns
- Add progress indicators for long operations

---

## 📞 Support

- **Documentation**: See `example-prompts.md` for complete tool reference
- **Issues**: Report problems with specific demo files and error messages
- **Examples**: Each demo file includes inline documentation and examples

**Happy exploring! 🚀**