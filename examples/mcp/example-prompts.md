# ZPT MCP Example Prompts

This document provides ready-to-use prompts for testing and demonstrating ZPT (3-dimensional knowledge graph navigation) capabilities.

## Basic Navigation Examples

### Quick Entity Exploration
```
Use zpt_navigate to explore 'artificial intelligence' at entity level with keyword representation
```

### Contextual Relationship Understanding  
```
Navigate 'machine learning algorithms' with unit zoom and graph tilt to explore algorithmic relationships
```

### Temporal Analysis
```
Explore 'climate change research' with temporal filtering from 2020-2024 using temporal tilt
```

### Multi-Entity Focus
```
Navigate 'renewable energy solutions' focusing on Tesla, SolarCity, and First Solar using embedding tilt
```

### High-Level Overview
```
Get a high-level overview of 'biotechnology trends' using corpus zoom with keyword tilt
```

## Utility Tools Examples

### Navigation Preview
```
Preview navigation options for 'quantum computing' to understand scope
```

### Parameter Validation
```
Validate navigation parameters for complex query to catch errors early
```

### Options Discovery
```
Get available navigation options for 'artificial intelligence' to understand corpus capabilities
```

### Corpus Analysis
```
Analyze corpus structure to understand navigation performance characteristics
```

## Advanced Filtering Examples

### Geographic Filtering
```
Navigate 'urban development projects' with geographic filtering for San Francisco Bay Area (bbox: [-122.5, 37.2, -121.9, 37.6])
```

### Entity-Specific Exploration
```
Explore 'AI research developments' focusing specifically on OpenAI, DeepMind, and Anthropic with temporal range 2022-2024
```

### Topic-Focused Analysis
```
Navigate 'renewable energy' with topic filtering for 'solar power' and unit zoom for contextual understanding
```

### Multi-Dimensional Filtering
```
Analyze 'biomedical research' with topic filter 'gene therapy', temporal range 2020-2024, and graph tilt for relationship mapping
```

## Performance Optimization Examples

### Fast Exploration
```
Quick navigation of 'blockchain technology' with entity zoom, keywords tilt, and 1000 token limit for rapid overview
```

### Balanced Analysis
```
Navigate 'machine learning' with unit zoom, embedding tilt, 4000 tokens, and semantic chunking for optimal detail/performance
```

### Comprehensive Study
```
Detailed exploration of 'neural network architectures' with text zoom, graph tilt, 8000 tokens, and adaptive chunking
```

### Preview-First Pattern
```
First preview 'space exploration' to estimate requirements, then navigate with optimal parameters based on preview
```

## Integration Workflow Examples

### ZPT + Memory Integration
```
1. Navigate 'AI ethics frameworks' with ZPT and store results automatically
2. Retrieve related ethics memories using semem_retrieve_memories
3. Generate contextual response combining navigation and memory
```

### ZPT + Ragno Knowledge Graph
```
1. Use ZPT to explore 'neural network architectures' intuitively
2. Follow with detailed ragno_search_dual for comprehensive analysis
3. Perform ragno_analyze_graph for relationship insights
4. Export findings with ragno_export_rdf
```

### ZPT + Context Management
```
1. Navigate 'quantum computing' with ZPT
2. Use semem_get_context to review navigation context
3. Navigate related 'quantum algorithms' building on context
4. Optimize context with semem_prune_context
```

## Error Handling and Troubleshooting

### Parameter Validation
```
Validate intentionally invalid parameters to see error handling:
- Empty query
- Invalid zoom level 'invalid_zoom'  
- Non-existent tilt 'fake_tilt'
```

### Token Budget Management
```
Navigate 'comprehensive AI overview' with very low token budget (500 tokens) to demonstrate adaptive behavior
```

### Graceful Degradation
```
Navigate non-existent topic 'completely_fictional_subject' to demonstrate error handling
```

## Complex Multi-Step Workflows

### Research Discovery Workflow
```
1. Get corpus overview: Navigate 'artificial intelligence research' with corpus zoom
2. Preview details: Preview 'large language models' at entity level  
3. Explore entities: Navigate LLM entities with graph connections
4. Understand relationships: Navigate LLMs at unit level with embedding tilt
```

### Temporal Research Analysis
```
1. Analyze recent trends: Navigate 'AI development trends' 2022-2024 with temporal tilt
2. Historical context: Navigate same query 2010-2020 for comparison
3. Entity timeline: Detailed timeline for OpenAI, DeepMind, Anthropic
```

### Domain Exploration Workflow
```
1. Domain overview: Navigate 'biotechnology' at corpus level
2. Topic clusters: Navigate 'gene therapy' at community level
3. Specific research: Navigate 'CRISPR applications' at unit level
4. Source material: Navigate specific research at text level
```

## Performance Testing Prompts

### Speed Benchmarks
```
Test fast navigation: 'AI' entity keywords (target: <200ms)
Test medium navigation: 'machine learning' unit embedding (target: <800ms)  
Test complex navigation: 'neural networks' unit graph (target: <2000ms)
Test overview navigation: 'technology trends' corpus temporal (target: <500ms)
```

### Token Efficiency Tests
```
Minimal tokens: Navigate 'blockchain' with 500 token limit
Standard tokens: Navigate 'climate change' with 2000 token limit
Comprehensive tokens: Navigate 'biotechnology' with 8000 token limit
```

### Caching Performance
```
1. Navigate 'artificial intelligence' entity keywords (first run)
2. Navigate same parameters again (should be faster due to caching)
3. Navigate with slight variation to test cache miss/hit patterns
```

## Schema and Documentation Examples

### Get Complete Schema
```
Use zpt_get_schema to retrieve complete parameter documentation and validation rules
```

### Access Resource Documentation
```
Read semem://zpt/guide for complete ZPT navigation concepts
Read semem://zpt/examples for comprehensive usage patterns
Read semem://zpt/performance for optimization strategies
Read semem://zpt/schema for detailed parameter documentation
```

## Production Usage Patterns

### Content Discovery
```
1. Preview query scope with zpt_preview
2. Validate parameters with zpt_validate_params  
3. Navigate with optimal parameters
4. Store results automatically in memory
```

### Research Analysis
```
1. Corpus analysis with zpt_analyze_corpus
2. Get available options with zpt_get_options
3. Multi-dimensional navigation with filtering
4. Export and integrate with existing tools
```

### Performance Monitoring
```
1. Analyze corpus performance characteristics
2. Test navigation with various parameter combinations
3. Monitor response times and token usage
4. Optimize based on actual usage patterns
```

## Custom Scenarios

Feel free to adapt these patterns for your specific use cases:

- Replace topic terms with your domain of interest
- Adjust zoom levels based on desired detail level
- Modify tilt styles based on representation needs
- Customize token budgets based on performance requirements
- Apply appropriate pan filters for your content scope

## Getting Started Recommendation

1. **Start Simple**: Begin with `zpt_navigate` using entity zoom and keywords tilt
2. **Explore Options**: Use `zpt_get_options` to understand your corpus capabilities  
3. **Preview First**: Use `zpt_preview` before complex navigation
4. **Validate Parameters**: Use `zpt_validate_params` to catch errors early
5. **Iterate and Optimize**: Gradually increase complexity and optimize based on results

## Advanced Integration

For advanced users, combine ZPT with:
- Memory management for persistent exploration
- Ragno tools for detailed graph analysis  
- Context management for coherent sessions
- Configuration tools for system optimization

---

These prompts provide a comprehensive starting point for exploring ZPT's 3-dimensional knowledge graph navigation capabilities. Adjust parameters based on your specific corpus content and performance requirements.