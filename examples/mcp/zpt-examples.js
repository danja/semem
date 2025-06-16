/**
 * ZPT MCP Usage Examples and Demonstration Prompts
 * Comprehensive examples showing ZPT 3D navigation capabilities
 */

// ZPT Navigation Examples with expected results
export const ZPT_NAVIGATION_EXAMPLES = [
  {
    title: "Quick Entity Lookup",
    description: "Fast exploration of specific entities with keyword representation",
    prompt: `Use zpt_navigate to explore 'artificial intelligence' at entity level with keyword representation`,
    mcpCall: {
      tool: "zpt_navigate",
      args: {
        query: "artificial intelligence",
        zoom: "entity",
        tilt: "keywords",
        transform: {
          maxTokens: 1000,
          format: "json"
        }
      }
    },
    expectedOutput: {
      responseTime: "< 300ms",
      contentType: "entity keywords",
      tokenCount: "~500",
      useCase: "Quick factual lookup about AI entities"
    }
  },
  
  {
    title: "Contextual Relationship Exploration",
    description: "Understanding connections between concepts using graph representation",
    prompt: `Navigate 'machine learning algorithms' with unit zoom and graph tilt to explore algorithmic relationships`,
    mcpCall: {
      tool: "zpt_navigate", 
      args: {
        query: "machine learning algorithms",
        zoom: "unit",
        tilt: "graph",
        transform: {
          maxTokens: 4000,
          format: "structured",
          chunkStrategy: "semantic"
        }
      }
    },
    expectedOutput: {
      responseTime: "< 1500ms",
      contentType: "semantic units with graph connections",
      tokenCount: "~3000",
      useCase: "Understanding ML algorithm relationships and dependencies"
    }
  },
  
  {
    title: "Temporal Analysis with Filtering",
    description: "Time-based exploration with specific date range filtering",
    prompt: `Explore 'climate change research' with temporal filtering from 2020-2024 using temporal tilt`,
    mcpCall: {
      tool: "zpt_navigate",
      args: {
        query: "climate change research",
        zoom: "unit",
        pan: {
          temporal: {
            start: "2020-01-01",
            end: "2024-12-31"
          },
          topic: "mitigation strategies"
        },
        tilt: "temporal",
        transform: {
          maxTokens: 5000,
          format: "conversational"
        }
      }
    },
    expectedOutput: {
      responseTime: "< 2000ms",
      contentType: "chronologically ordered research",
      tokenCount: "~4000",
      useCase: "Recent climate research timeline analysis"
    }
  },
  
  {
    title: "Multi-Entity Focus Navigation",
    description: "Navigation focused on specific entities with embedding similarity",
    prompt: `Navigate 'renewable energy solutions' focusing on Tesla, SolarCity, and First Solar using embedding tilt`,
    mcpCall: {
      tool: "zpt_navigate",
      args: {
        query: "renewable energy solutions",
        zoom: "unit", 
        pan: {
          entity: ["Tesla", "SolarCity", "First Solar"],
          topic: "solar power"
        },
        tilt: "embedding",
        transform: {
          maxTokens: 6000,
          format: "markdown",
          includeMetadata: true
        }
      }
    },
    expectedOutput: {
      responseTime: "< 1800ms",
      contentType: "semantically grouped solar energy content",
      tokenCount: "~5000",
      useCase: "Company-focused renewable energy analysis"
    }
  },
  
  {
    title: "High-Level Overview Navigation",
    description: "Corpus-level overview for broad understanding",
    prompt: `Get a high-level overview of 'biotechnology trends' using corpus zoom with keyword tilt`,
    mcpCall: {
      tool: "zpt_navigate",
      args: {
        query: "biotechnology trends",
        zoom: "corpus",
        tilt: "keywords",
        transform: {
          maxTokens: 2000,
          format: "structured"
        }
      }
    },
    expectedOutput: {
      responseTime: "< 500ms",
      contentType: "high-level biotech patterns",
      tokenCount: "~800",
      useCase: "Quick domain overview and trend identification"
    }
  }
];

// ZPT Preview and Validation Examples
export const ZPT_UTILITY_EXAMPLES = [
  {
    title: "Navigation Preview",
    description: "Preview available content before full navigation",
    prompt: `Preview navigation options for 'quantum computing' to understand scope`,
    mcpCall: {
      tool: "zpt_preview",
      args: {
        query: "quantum computing",
        zoom: "entity"
      }
    },
    expectedOutput: {
      responseTime: "< 200ms",
      contentType: "navigation preview with content counts",
      useCase: "Quick scope assessment before detailed navigation"
    }
  },
  
  {
    title: "Parameter Validation",
    description: "Validate navigation parameters before execution",
    prompt: `Validate navigation parameters for complex query to catch errors early`,
    mcpCall: {
      tool: "zpt_validate_params",
      args: {
        params: {
          query: "neural network architectures",
          zoom: "unit",
          pan: {
            temporal: { start: "2023-01-01", end: "2024-12-31" },
            topic: "transformer models"
          },
          tilt: "graph",
          transform: { maxTokens: 8000, format: "conversational" }
        }
      }
    },
    expectedOutput: {
      responseTime: "< 100ms",
      contentType: "validation result with suggestions",
      useCase: "Error prevention and parameter optimization"
    }
  },
  
  {
    title: "Navigation Options Discovery",
    description: "Discover available navigation options for corpus",
    prompt: `Get available navigation options for 'artificial intelligence' to understand corpus capabilities`,
    mcpCall: {
      tool: "zpt_get_options",
      args: {
        context: "current",
        query: "artificial intelligence"
      }
    },
    expectedOutput: {
      responseTime: "< 300ms",
      contentType: "available domains, entities, and parameters",
      useCase: "Corpus exploration and navigation planning"
    }
  },
  
  {
    title: "Corpus Analysis",
    description: "Analyze corpus structure for navigation optimization",
    prompt: `Analyze corpus structure to understand navigation performance characteristics`,
    mcpCall: {
      tool: "zpt_analyze_corpus",
      args: {
        analysisType: "structure",
        includeStats: true
      }
    },
    expectedOutput: {
      responseTime: "< 500ms",
      contentType: "corpus statistics and recommendations",
      useCase: "Performance optimization and navigation strategy planning"
    }
  }
];

// Complex Multi-Step Workflow Examples
export const ZPT_WORKFLOW_EXAMPLES = [
  {
    title: "Research Discovery Workflow",
    description: "Complete research workflow from overview to detailed analysis",
    steps: [
      {
        step: 1,
        action: "Get corpus overview",
        prompt: "First, get a high-level overview of available AI research",
        mcpCall: {
          tool: "zpt_navigate",
          args: {
            query: "artificial intelligence research",
            zoom: "corpus",
            tilt: "keywords"
          }
        }
      },
      {
        step: 2,
        action: "Preview detailed exploration",
        prompt: "Preview entity-level navigation for specific AI topics",
        mcpCall: {
          tool: "zpt_preview",
          args: {
            query: "large language models",
            zoom: "entity"
          }
        }
      },
      {
        step: 3,
        action: "Navigate entity details",
        prompt: "Navigate LLM entities with graph connections",
        mcpCall: {
          tool: "zpt_navigate",
          args: {
            query: "large language models",
            zoom: "entity",
            tilt: "graph",
            transform: { maxTokens: 4000, format: "structured" }
          }
        }
      },
      {
        step: 4,
        action: "Explore relationships",
        prompt: "Understand LLM relationships at unit level",
        mcpCall: {
          tool: "zpt_navigate",
          args: {
            query: "large language models",
            zoom: "unit",
            tilt: "embedding",
            transform: { maxTokens: 6000, format: "conversational" }
          }
        }
      }
    ],
    expectedOutcome: "Complete understanding of LLM landscape from overview to detailed relationships"
  },
  
  {
    title: "Temporal Research Analysis",
    description: "Time-based research trend analysis workflow",
    steps: [
      {
        step: 1,
        action: "Analyze recent trends",
        prompt: "Analyze recent AI development trends from 2022-2024",
        mcpCall: {
          tool: "zpt_navigate",
          args: {
            query: "AI development trends",
            zoom: "community",
            pan: { temporal: { start: "2022-01-01", end: "2024-12-31" } },
            tilt: "temporal"
          }
        }
      },
      {
        step: 2,
        action: "Compare historical context",
        prompt: "Compare with historical AI developments 2010-2020",
        mcpCall: {
          tool: "zpt_navigate",
          args: {
            query: "AI development trends",
            zoom: "community",
            pan: { temporal: { start: "2010-01-01", end: "2020-12-31" } },
            tilt: "temporal"
          }
        }
      },
      {
        step: 3,
        action: "Entity timeline analysis",
        prompt: "Detailed timeline for specific AI companies",
        mcpCall: {
          tool: "zpt_navigate",
          args: {
            query: "AI development",
            zoom: "unit",
            pan: { entity: ["OpenAI", "DeepMind", "Anthropic"] },
            tilt: "temporal",
            transform: { maxTokens: 8000, format: "markdown" }
          }
        }
      }
    ],
    expectedOutcome: "Comprehensive temporal analysis of AI development evolution"
  }
];

// Integration Examples with Existing Semem Tools
export const ZPT_INTEGRATION_EXAMPLES = [
  {
    title: "ZPT + Memory Integration",
    description: "Combining ZPT navigation with memory storage and retrieval",
    workflow: [
      {
        action: "Navigate with ZPT",
        prompt: "Navigate AI ethics frameworks and automatically store results",
        mcpCall: {
          tool: "zpt_navigate",
          args: {
            query: "AI ethics frameworks",
            zoom: "unit",
            tilt: "graph",
            transform: { includeMetadata: true }
          }
        },
        note: "Results automatically stored in memory by ZPT"
      },
      {
        action: "Retrieve related memories",
        prompt: "Find related ethics discussions in memory",
        mcpCall: {
          tool: "semem_retrieve_memories",
          args: {
            query: "AI ethics frameworks",
            threshold: 0.8,
            limit: 5
          }
        }
      },
      {
        action: "Generate contextual response",
        prompt: "Generate response using navigation results and memory context",
        mcpCall: {
          tool: "semem_generate_response",
          args: {
            prompt: "Summarize current AI ethics frameworks and their relationships",
            useMemory: true
          }
        }
      }
    ]
  },
  
  {
    title: "ZPT + Ragno Knowledge Graph",
    description: "Combining ZPT intuitive navigation with detailed Ragno analysis",
    workflow: [
      {
        action: "ZPT exploration",
        prompt: "Use ZPT for intuitive neural network exploration",
        mcpCall: {
          tool: "zpt_navigate",
          args: {
            query: "neural network architectures",
            zoom: "entity",
            tilt: "keywords"
          }
        }
      },
      {
        action: "Detailed Ragno search",
        prompt: "Follow up with comprehensive Ragno dual search",
        mcpCall: {
          tool: "ragno_search_dual",
          args: {
            query: "neural network architectures",
            options: { combinedLimit: 20 }
          }
        }
      },
      {
        action: "Graph analysis",
        prompt: "Analyze neural network relationship graph",
        mcpCall: {
          tool: "ragno_analyze_graph",
          args: {
            analysisTypes: ["centrality", "communities"],
            options: { topK: 10 }
          }
        }
      },
      {
        action: "Export findings",
        prompt: "Export complete analysis as RDF",
        mcpCall: {
          tool: "ragno_export_rdf",
          args: {
            format: "turtle",
            includeStatistics: true
          }
        }
      }
    ]
  }
];

// Error Handling and Troubleshooting Examples
export const ZPT_ERROR_EXAMPLES = [
  {
    title: "Parameter Validation Error",
    description: "Handle invalid parameters gracefully",
    prompt: "Demonstrate parameter validation with invalid zoom level",
    mcpCall: {
      tool: "zpt_validate_params",
      args: {
        params: {
          query: "",  // Invalid: empty query
          zoom: "invalid_zoom",  // Invalid: non-existent zoom
          tilt: "nonexistent_tilt"  // Invalid: non-existent tilt
        }
      }
    },
    expectedError: {
      type: "validation_error",
      fields: ["query", "zoom", "tilt"],
      suggestions: "Use valid zoom levels (entity, unit, text, community, corpus) and tilt styles (keywords, embedding, graph, temporal)"
    }
  },
  
  {
    title: "Token Budget Management",
    description: "Handle token budget constraints intelligently",
    prompt: "Navigate with very low token budget to see adaptive behavior",
    mcpCall: {
      tool: "zpt_navigate",
      args: {
        query: "comprehensive artificial intelligence overview",
        zoom: "text",  // Large content
        transform: {
          maxTokens: 500  // Very low budget
        }
      }
    },
    expectedBehavior: "Intelligent content prioritization and summarization within token constraints"
  }
];

// Performance Optimization Examples
export const ZPT_PERFORMANCE_EXAMPLES = [
  {
    title: "Fast Exploration Pattern",
    description: "Optimized parameters for quick navigation",
    prompt: "Use optimal parameters for sub-second AI exploration",
    mcpCall: {
      tool: "zpt_navigate",
      args: {
        query: "AI",
        zoom: "entity",
        tilt: "keywords",
        transform: {
          maxTokens: 1000,
          format: "json",
          includeMetadata: false
        }
      }
    },
    performance: {
      expectedTime: "< 200ms",
      tokenCount: "~500",
      useCase: "Rapid exploration and iteration"
    }
  },
  
  {
    title: "Comprehensive Analysis Pattern",
    description: "Balanced parameters for detailed analysis",
    prompt: "Navigate machine learning with optimal detail/performance balance",
    mcpCall: {
      tool: "zpt_navigate",
      args: {
        query: "machine learning",
        zoom: "unit",
        tilt: "embedding",
        transform: {
          maxTokens: 4000,
          format: "structured",
          chunkStrategy: "semantic"
        }
      }
    },
    performance: {
      expectedTime: "< 1000ms", 
      tokenCount: "~3000",
      useCase: "Detailed analysis with reasonable performance"
    }
  }
];

// Demonstration Prompts for Testing
export const ZPT_DEMONSTRATION_PROMPTS = [
  // Basic ZPT Operations
  "Use zpt_navigate to explore 'artificial intelligence' at entity level with keyword representation",
  "Preview navigation options for 'quantum computing' to understand available content",
  "Validate parameters for complex machine learning navigation with temporal filtering",
  "Get available navigation options for 'climate change' in the current corpus",
  "Analyze corpus structure to understand navigation performance characteristics",
  
  // Multi-dimensional Navigation
  "Navigate 'renewable energy' with unit zoom, temporal filtering 2020-2024, and graph tilt",
  "Explore 'neural networks' at text level with embedding tilt and conversational format",
  "Get corpus overview of 'biotechnology trends' using keywords and structured format",
  
  // Advanced Filtering
  "Navigate 'urban development' with geographic filtering for San Francisco Bay Area",
  "Explore 'AI research' focusing on OpenAI, DeepMind, and Anthropic entities",
  "Analyze 'climate research' with topic filtering for 'mitigation strategies' and temporal range 2022-2024",
  
  // Performance Optimization
  "Quick navigation of 'blockchain' with minimal token budget for rapid overview",
  "Comprehensive analysis of 'gene therapy' with maximum detail and semantic chunking",
  "Preview 'space exploration' to estimate processing requirements before full navigation",
  
  // Integration Workflows
  "Navigate 'AI ethics' and store results, then retrieve related memories",
  "Use ZPT to explore 'machine learning algorithms' then follow with detailed Ragno analysis",
  "Combine ZPT navigation with context management for coherent exploration session",
  
  // Error Handling
  "Demonstrate parameter validation with intentionally invalid zoom and tilt values",
  "Handle navigation with extremely low token budget to show adaptive behavior",
  "Navigate non-existent topic to demonstrate graceful error handling"
];

// Complete Usage Guide
export const ZPT_USAGE_GUIDE = {
  introduction: `
# ZPT MCP Usage Guide

ZPT (Zoom, Pan, Tilt) provides intuitive 3-dimensional navigation of knowledge graphs using spatial metaphors borrowed from camera and mapping systems.

## Core Concepts

- **Zoom**: Controls abstraction level (entity → unit → text → community → corpus)
- **Pan**: Manages content filtering (topic, temporal, geographic, entity)
- **Tilt**: Adjusts representation style (keywords → embedding → graph → temporal)

## Quick Start Examples
`,
  
  basicUsage: `
## Basic Navigation

1. **Entity Exploration**: \`zpt_navigate\` with entity zoom and keywords tilt
2. **Relationship Understanding**: \`zpt_navigate\` with unit zoom and graph tilt  
3. **Content Discovery**: \`zpt_navigate\` with text zoom and embedding tilt
4. **Topic Overview**: \`zpt_navigate\` with community/corpus zoom and keywords tilt
`,
  
  advancedFeatures: `
## Advanced Features

1. **Preview First**: Use \`zpt_preview\` to understand scope before navigation
2. **Validate Parameters**: Use \`zpt_validate_params\` to catch errors early
3. **Explore Options**: Use \`zpt_get_options\` to discover available parameters
4. **Optimize Performance**: Use \`zpt_analyze_corpus\` for optimization recommendations
`,
  
  integrationPatterns: `
## Integration with Semem

1. **Memory Integration**: Navigation results automatically stored as memories
2. **Ragno Integration**: Use ZPT for intuitive exploration, Ragno for detailed analysis
3. **Context Management**: ZPT-aware context optimization and management
4. **Workflow Composition**: Combine ZPT with existing Semem tools for complete workflows
`,
  
  bestPractices: `
## Best Practices

1. **Start Simple**: Begin with entity zoom and keywords tilt for quick exploration
2. **Preview First**: Use preview to estimate scope and performance before full navigation
3. **Filter Early**: Apply pan filters to reduce processing scope and improve performance
4. **Iterate Gradually**: Adjust one dimension at a time for optimal results
5. **Monitor Performance**: Use analysis tools to optimize navigation patterns
`
};

// Export all examples for use in documentation and testing
export default {
  ZPT_NAVIGATION_EXAMPLES,
  ZPT_UTILITY_EXAMPLES,
  ZPT_WORKFLOW_EXAMPLES,
  ZPT_INTEGRATION_EXAMPLES,
  ZPT_ERROR_EXAMPLES,
  ZPT_PERFORMANCE_EXAMPLES,
  ZPT_DEMONSTRATION_PROMPTS,
  ZPT_USAGE_GUIDE
};