# ZPT Navigation with MCP: Workflow Guide

**A comprehensive guide to 3-dimensional knowledge graph navigation using MCP tools**

## Table of Contents

1. [Introduction](#introduction)
2. [Understanding ZPT Navigation](#understanding-zpt-navigation)
3. [MCP Tools for ZPT](#mcp-tools-for-zpt)
4. [Basic Navigation Workflows](#basic-navigation-workflows)
5. [Advanced Multi-Dimensional Workflows](#advanced-multi-dimensional-workflows)
6. [Integration with Memory and Knowledge Graphs](#integration-with-memory-and-knowledge-graphs)
7. [Real-World Navigation Scenarios](#real-world-navigation-scenarios)
8. [Performance and Optimization Workflows](#performance-and-optimization-workflows)
9. [Troubleshooting Navigation Issues](#troubleshooting-navigation-issues)

---

## Introduction

ZPT (Zoom, Pan, Tilt) provides a revolutionary approach to knowledge graph navigation by treating information as a 3-dimensional space that can be explored using intuitive camera-like controls. Unlike traditional search interfaces, ZPT allows you to cinematically navigate through knowledge, adjusting your level of detail, filtering scope, and representation style in real-time.

### What Makes ZPT Unique

- **Spatial Metaphors**: Navigate knowledge like exploring a landscape with a camera
- **Multi-Dimensional Control**: Simultaneous control over detail level, scope, and style
- **Intelligent Content Selection**: Multiple AI strategies for finding relevant information
- **Token-Aware Processing**: Optimized for LLM consumption with adaptive chunking
- **Seamless Integration**: Works with Semem's memory and knowledge graph systems

### Key Benefits

- **Intuitive Exploration**: Natural navigation using familiar camera concepts
- **Adaptive Detail**: Automatically adjusts information density to your needs
- **Context Preservation**: Maintains coherent perspective throughout navigation
- **Efficient Discovery**: Quickly find relevant information in large knowledge bases
- **Flexible Output**: Choose representation style that fits your use case

---

## Understanding ZPT Navigation

### The Three Dimensions

#### Zoom: Level of Abstraction
Controls how detailed or abstract your view is:

- **Micro**: Fine-grained micro-level elements
- **Entity**: Focus on individual entities and their properties
- **Text**: Text-level content and structure
- **Unit**: Balanced view of semantic units with related entities
- **Community**: Topic-level clusters and domain overviews
- **Corpus**: Highest level patterns across entire knowledge base

#### Pan: Content Filtering
Controls what content is included in your view:

- **Domains**: Filter by domain strings
- **Keywords**: Filter by keyword arrays
- **Entities**: Focus on specific entities
- **Corpuscle**: Filter by corpuscle identifiers
- **Temporal**: Filter by time bounds (start/end dates)

#### Tilt: Representation Style
Controls how content is represented and presented:

- **Keywords**: Term-based representation (default, fastest)
- **Embedding**: Vector-based semantic similarity representation
- **Graph**: Relationship-based network representation
- **Temporal**: Time-based sequential representation
- **Concept**: Concept-focused structured representation

### Navigation Philosophy

ZPT treats knowledge exploration as a journey through information space where you can:

- **Zoom in** for detailed analysis of specific entities
- **Zoom out** for broader thematic understanding
- **Pan** to shift focus to different domains or time periods
- **Tilt** to change perspective from technical to conversational
- **Combine dimensions** for sophisticated multi-faceted exploration

---

## MCP Tools for ZPT

### Core Navigation Verbs

#### `semem-zoom`
**Set abstraction level for navigation**

Controls granularity from micro-level elements to entire corpus. Levels: micro, entity, text, unit, community, corpus (default: entity).

#### `semem-pan`
**Apply multi-dimensional filters**

Filter content by domains, keywords, entities, corpuscles, and temporal bounds. All parameters are optional arrays/objects.

#### `semem-tilt`
**Choose representation style**

Control how content is presented. Styles: keywords (default), embedding, graph, temporal, concept.

#### `semem-inspect`
**Examine system state and navigation context**

Inspect session state, concepts, or complete system overview. Parameters: what (session/concepts/all), details (boolean).

### Supporting MCP Resources

#### `semem://zpt/schema`
**Complete JSON schema for ZPT navigation parameters**

Access detailed parameter specifications, validation rules, and examples for all navigation dimensions.

#### `semem://zpt/guide`
**Comprehensive guide to ZPT concepts and spatial metaphors**

Understanding the theoretical foundation of 3-dimensional knowledge navigation and spatial reasoning principles.

#### `semem://zpt/examples`
**Practical navigation patterns and use cases**

Ready-to-use navigation examples for common exploration scenarios and advanced multi-dimensional techniques.

#### `semem://zpt/performance`
**Performance optimization strategies and best practices**

Guidelines for optimizing navigation performance, caching strategies, and monitoring techniques.

---

## Basic Navigation Workflows

### Workflow 1: Entity-Focused Exploration

**Use Case**: Understanding a specific concept or entity in detail

**Navigation Strategy**:
1. **Preview Scope**: Use `zpt_preview` to understand available content
2. **Entity Zoom**: Navigate with entity-level zoom for detailed focus
3. **Keyword Tilt**: Use keywords tilt for fastest processing
4. **Iterative Refinement**: Adjust pan filters based on initial results

**Example Navigation**:
```
Navigate "artificial intelligence" with:
- Zoom: entity (detailed focus)
- Pan: domains=["technology", "research"]
- Tilt: keywords (fast processing)
- Token limit: 2000
```

**Expected Results**:
- Detailed entity properties and attributes
- Related concepts and relationships
- Key definitional information
- Fast response with structured output

### Workflow 2: Thematic Discovery

**Use Case**: Exploring broad themes and discovering connections

**Navigation Strategy**:
1. **Corpus Analysis**: Use `zpt_analyze_corpus` to understand structure
2. **Community Zoom**: Navigate at community level for theme identification
3. **Embedding Tilt**: Use embedding-based representation for semantic connections
4. **Progressive Drilling**: Move from overview to detail as needed

**Example Navigation**:
```
Navigate "sustainable energy solutions" with:
- Zoom: community (thematic view)
- Pan: temporal=2020-2024, domains=["energy", "environment"]
- Tilt: embedding (semantic connections)
- Token limit: 4000
```

**Expected Results**:
- Thematic clusters and topic groupings
- Semantic relationships between concepts
- Temporal trends and evolution
- Rich contextual understanding

### Workflow 3: Relationship Mapping

**Use Case**: Understanding connections and relationships between entities

**Navigation Strategy**:
1. **Graph Tilt**: Use graph representation for relationship visualization
2. **Unit Zoom**: Focus on semantic units that contain relationships
3. **Entity Pan**: Filter to specific entities of interest
4. **Structured Output**: Request structured format for clear relationship mapping

**Example Navigation**:
```
Navigate "machine learning applications" with:
- Zoom: unit (relationship context)
- Pan: entities=["healthcare", "finance", "transportation"]
- Tilt: graph (relationship focus)
- Format: structured
```

**Expected Results**:
- Clear relationship mappings
- Entity interaction patterns
- Structured relationship data
- Connection strength indicators

---

## Advanced Multi-Dimensional Workflows

### Workflow 4: Temporal Analysis and Evolution

**Use Case**: Understanding how topics evolve over time

**Navigation Strategy**:
1. **Temporal Tilt**: Use temporal representation for chronological view
2. **Multiple Time Ranges**: Navigate different periods for comparison
3. **Community Zoom**: Focus on high-level trends
4. **Progressive Filtering**: Refine temporal filters iteratively

**Step-by-Step Process**:
```
Step 1: Recent Trends
Navigate "climate change research" with:
- Zoom: community
- Pan: temporal=2020-2024
- Tilt: temporal

Step 2: Historical Context  
Navigate "climate change research" with:
- Zoom: community
- Pan: temporal=2010-2020
- Tilt: temporal

Step 3: Evolution Analysis
Compare results to identify trends and changes
```

**Benefits**:
- Understand topic evolution
- Identify emerging trends
- Compare different time periods
- Track concept development

### Workflow 5: Multi-Domain Integration

**Use Case**: Exploring topics that span multiple domains

**Navigation Strategy**:
1. **Broad Pan**: Include multiple domains in filtering
2. **Context Zoom**: Use context level for cross-domain perspective
3. **Embedding Tilt**: Leverage semantic connections across domains
4. **Iterative Refinement**: Adjust domain filters based on discoveries

**Example Multi-Domain Navigation**:
```
Navigate "artificial intelligence in healthcare" with:
- Zoom: context (cross-domain view)
- Pan: domains=["technology", "healthcare", "ethics", "regulation"]
- Tilt: embedding (semantic integration)
- Token limit: 6000
```

**Advanced Filtering**:
```
Navigate "blockchain applications" with:
- Zoom: unit
- Pan: {
    domains: ["finance", "supply-chain", "healthcare"],
    entities: ["bitcoin", "ethereum", "smart-contracts"],
    temporal: {start: "2018-01-01"}
  }
- Tilt: graph
```

### Workflow 6: Comparative Analysis

**Use Case**: Comparing different concepts or approaches

**Navigation Strategy**:
1. **Parallel Navigation**: Navigate multiple related topics
2. **Consistent Parameters**: Use same zoom/tilt for fair comparison
3. **Structured Output**: Request structured format for comparison
4. **Synthesis**: Combine results for comparative analysis

**Comparative Navigation Process**:
```
Compare renewable energy technologies:

Navigation 1: "solar energy technology"
- Zoom: unit, Tilt: analytical

Navigation 2: "wind energy technology"  
- Zoom: unit, Tilt: analytical

Navigation 3: "hydroelectric power"
- Zoom: unit, Tilt: analytical

Then synthesize results for comparison
```

---

## Integration with Memory and Knowledge Graphs

### Memory-Enhanced Navigation

**Workflow**: Memory Context → ZPT Exploration → Enhanced Understanding

**Integration Steps**:
1. **Store Navigation Context**: Use `semem_store_interaction` to save navigation goals
2. **Memory-Informed Navigation**: Use stored context to guide ZPT parameters
3. **Enhanced Discovery**: Combine memory similarity with spatial navigation
4. **Context Building**: Build rich context through iterative memory-navigation cycles

**Example Integration**:
```
Step 1: Store Context
"I'm researching sustainable urban development for a policy proposal"

Step 2: Memory-Guided Navigation
Navigate "urban sustainability" with parameters informed by stored context
- Pan: policy-relevant domains
- Tilt: analytical (policy focus)

Step 3: Build on Results
Store navigation results and use for next exploration phase
```

### Knowledge Graph + ZPT Workflows

**Workflow**: Graph Construction → Spatial Navigation → Deep Analysis

**Integration Process**:
1. **Build Graph**: Use `ragno_decompose_corpus` to create knowledge graph
2. **Analyze Structure**: Use `ragno_analyze_graph` for graph understanding
3. **Navigate Spatially**: Use ZPT to explore graph content spatially
4. **Synthesize Insights**: Combine structural and spatial perspectives

**Complete Integration Example**:
```
Research Domain: "quantum computing applications"

Step 1: Graph Construction
- Decompose corpus of quantum computing papers
- Extract entities and relationships

Step 2: Graph Analysis  
- Identify key entities and communities
- Understand structural patterns

Step 3: Spatial Navigation
Navigate with ZPT:
- Zoom: entity (focus on key concepts)
- Pan: entities from graph analysis
- Tilt: embedding (semantic connections)

Step 4: Synthesis
- Combine graph structure with spatial insights
- Generate comprehensive understanding
```

---

## Real-World Navigation Scenarios

### Scenario 1: Academic Research Exploration

**Context**: Researcher exploring a new field for literature review

**Navigation Journey**:
1. **Field Overview**: Start with corpus-level zoom for broad understanding
2. **Community Discovery**: Use community zoom to identify research clusters
3. **Key Entity Focus**: Zoom to entity level for important concepts
4. **Relationship Analysis**: Use graph tilt to understand connections
5. **Temporal Trends**: Apply temporal tilt to understand field evolution

**Navigation Sequence**:
```
Phase 1: Field Landscape
Navigate "computational biology" with:
- Zoom: corpus (broad overview)
- Tilt: keywords (fast survey)

Phase 2: Research Areas
Navigate "computational biology" with:  
- Zoom: community (research clusters)
- Tilt: embedding (semantic groupings)

Phase 3: Key Concepts
Navigate specific concepts discovered in Phase 2 with:
- Zoom: entity (detailed understanding)
- Tilt: analytical (structured analysis)

Phase 4: Evolution
Navigate field with:
- Zoom: community
- Tilt: temporal
- Pan: temporal progression over decades
```

### Scenario 2: Business Intelligence and Market Analysis

**Context**: Business analyst researching competitive landscape

**Navigation Strategy**:
1. **Market Overview**: Corpus-level zoom for industry landscape
2. **Competitor Analysis**: Entity-focused navigation on key companies
3. **Trend Analysis**: Temporal navigation for market evolution
4. **Opportunity Discovery**: Cross-domain navigation for new possibilities

**Business Navigation Example**:
```
Market Research: "electric vehicle market"

Step 1: Industry Landscape
Navigate "electric vehicle industry" with:
- Zoom: corpus (market overview)
- Pan: domains=["automotive", "energy", "policy"]
- Tilt: analytical

Step 2: Key Players
Navigate "Tesla Model S competitors" with:
- Zoom: entity (detailed company analysis)
- Pan: entities=["Tesla", "BMW", "Mercedes", "Audi"]
- Tilt: graph (competitive relationships)

Step 3: Market Evolution
Navigate "electric vehicle adoption" with:
- Zoom: community (market trends)
- Pan: temporal=2015-2024
- Tilt: temporal (evolution analysis)
```

### Scenario 3: Educational Content Development

**Context**: Educator designing curriculum and learning paths

**Navigation Approach**:
1. **Prerequisite Mapping**: Use relationship navigation to understand dependencies
2. **Concept Progression**: Temporal navigation for learning sequence
3. **Difficulty Analysis**: Zoom levels to match learning complexity
4. **Connection Discovery**: Embedding navigation for concept relationships

**Educational Navigation**:
```
Curriculum: "machine learning fundamentals"

Step 1: Prerequisites
Navigate "mathematical foundations" with:
- Zoom: unit (concept relationships)
- Pan: domains=["mathematics", "statistics", "programming"]
- Tilt: graph (dependency mapping)

Step 2: Concept Progression
Navigate learning sequence with:
- Zoom: entity → unit → text (increasing complexity)
- Tilt: analytical (structured learning)

Step 3: Connection Building
Navigate between concepts with:
- Tilt: embedding (semantic connections)
- Pan: progressive concept inclusion
```

### Scenario 4: Legal Research and Case Analysis

**Context**: Legal researcher analyzing case law and precedents

**Navigation Method**:
1. **Case Landscape**: Community zoom for legal domain overview
2. **Precedent Chains**: Graph navigation for citation relationships
3. **Temporal Evolution**: Temporal tilt for legal principle evolution
4. **Jurisdictional Analysis**: Geographic pan for jurisdiction-specific law

**Legal Navigation Example**:
```
Research: "privacy rights in digital age"

Step 1: Legal Landscape
Navigate "digital privacy law" with:
- Zoom: community (legal domains)
- Pan: domains=["privacy", "technology", "constitutional-law"]
- Tilt: analytical

Step 2: Case Precedents
Navigate "landmark privacy cases" with:
- Zoom: entity (specific cases)
- Tilt: graph (citation relationships)
- Pan: entities=[specific case names]

Step 3: Evolution Analysis
Navigate "privacy law evolution" with:
- Zoom: community (legal principles)
- Tilt: temporal (legal development)
- Pan: temporal=1970-2024
```

---

## Performance and Optimization Workflows

### Performance Assessment Workflow

**Goal**: Understand and optimize navigation performance

**Assessment Process**:
1. **Corpus Analysis**: Use `zpt_analyze_corpus` to understand structure
2. **Performance Baseline**: Test basic navigation with different parameters
3. **Optimization Tuning**: Adjust parameters based on performance metrics
4. **Monitoring Setup**: Establish ongoing performance monitoring

**Performance Testing**:
```
Test 1: Speed Benchmark
Navigate "test query" with:
- Zoom: entity, Tilt: keywords (fastest combination)
- Measure: response time < 200ms

Test 2: Complexity Benchmark  
Navigate "complex query" with:
- Zoom: unit, Tilt: embedding (medium complexity)
- Measure: response time < 800ms

Test 3: Comprehensive Benchmark
Navigate "comprehensive query" with:
- Zoom: corpus, Tilt: graph (most complex)
- Measure: response time < 2000ms
```

### Optimization Strategy Workflow

**Optimization Dimensions**:
1. **Parameter Tuning**: Optimize zoom/pan/tilt combinations
2. **Token Management**: Balance information density with performance
3. **Caching Strategy**: Leverage preview and validation for efficiency
4. **Progressive Loading**: Use preview-then-navigate pattern

**Optimization Process**:
```
Step 1: Preview First
Use zpt_preview to understand scope and complexity

Step 2: Parameter Validation
Use zpt_validate_params to ensure optimal parameters

Step 3: Optimized Navigation
Navigate with optimized parameters based on preview

Step 4: Result Caching
Store successful navigation patterns for reuse
```

### Resource Management Workflow

**Resource Optimization**:
1. **Token Budget Planning**: Allocate tokens based on navigation goals
2. **Parallel Navigation**: Use multiple navigation strategies
3. **Result Synthesis**: Combine multiple navigation results efficiently
4. **Memory Integration**: Cache and reuse navigation results

**Resource-Aware Navigation**:
```
High-Performance Navigation Strategy:

Phase 1: Quick Survey (500 tokens)
- Zoom: corpus
- Tilt: keywords
- Goal: rapid overview

Phase 2: Focused Analysis (2000 tokens)
- Zoom: entity/unit (based on Phase 1 results)
- Tilt: analytical
- Goal: detailed understanding

Phase 3: Comprehensive Synthesis (1500 tokens)
- Combine results from Phases 1-2
- Generate integrated insights
```

---

## Troubleshooting Navigation Issues

### Common Navigation Problems

#### Empty or Irrelevant Results

**Symptoms**: Navigation returns no results or irrelevant content

**Troubleshooting Steps**:
1. **Check Corpus**: Use `zpt_analyze_corpus` to verify content availability
2. **Broaden Scope**: Try higher-level zoom (community/corpus)
3. **Relax Filters**: Reduce pan filtering constraints
4. **Alternative Tilt**: Try different representation styles
5. **Parameter Validation**: Use `zpt_validate_params` to check settings

**Resolution Workflow**:
```
Step 1: Verify Content
Use zpt_analyze_corpus to confirm relevant content exists

Step 2: Broaden Search
Navigate with:
- Zoom: corpus (broadest view)
- Pan: minimal filtering
- Tilt: keywords (fastest)

Step 3: Progressive Refinement
Gradually add filters and increase zoom detail
```

#### Performance Issues

**Symptoms**: Slow response times or timeouts

**Performance Troubleshooting**:
1. **Reduce Complexity**: Lower zoom level or simpler tilt
2. **Limit Scope**: Add pan filters to reduce content scope
3. **Token Management**: Reduce token limits
4. **Preview First**: Use preview to estimate complexity

**Performance Optimization**:
```
Quick Navigation Strategy:
- Zoom: entity (limited scope)
- Tilt: keywords (fastest processing)
- Pan: specific filters
- Tokens: 1000-2000 (manageable size)

Progressive Enhancement:
Start fast, then enhance based on results
```

#### Parameter Validation Errors

**Symptoms**: Invalid parameter errors or unexpected behavior

**Validation Workflow**:
1. **Schema Check**: Use `zpt_get_schema` to understand valid parameters
2. **Parameter Test**: Use `zpt_validate_params` before navigation
3. **Option Discovery**: Use `zpt_get_options` to see available choices
4. **Incremental Building**: Build complex parameters incrementally

#### Integration Issues

**Symptoms**: Problems combining ZPT with memory or knowledge graphs

**Integration Troubleshooting**:
1. **Service Health**: Check system status and service availability
2. **Data Consistency**: Verify knowledge graph and memory content
3. **Parameter Alignment**: Ensure consistent parameters across tools
4. **Sequential Processing**: Process integration steps sequentially

**Integration Verification**:
```
Step 1: Component Check
- Verify memory system is operational
- Confirm knowledge graph is populated
- Test ZPT system independently

Step 2: Simple Integration
- Start with basic memory + ZPT combination
- Verify results before complex integration

Step 3: Progressive Integration
- Add knowledge graph integration
- Test each integration point
```

---

## Advanced Navigation Techniques

### Multi-Perspective Analysis

**Technique**: Navigate the same query with different perspectives

**Multi-Perspective Process**:
```
Query: "sustainable transportation"

Perspective 1: Technical
- Zoom: entity
- Tilt: analytical
- Pan: domains=["engineering", "technology"]

Perspective 2: Policy
- Zoom: community  
- Tilt: analytical
- Pan: domains=["policy", "regulation", "economics"]

Perspective 3: Environmental
- Zoom: unit
- Tilt: embedding
- Pan: domains=["environment", "climate", "sustainability"]

Synthesis: Combine all perspectives for comprehensive view
```

### Navigation Cascading

**Technique**: Use results from one navigation to inform the next

**Cascading Navigation**:
```
Level 1: Discovery
Navigate broad topic → identify key entities

Level 2: Focus
Navigate key entities → discover relationships

Level 3: Deep Dive
Navigate specific relationships → detailed analysis

Level 4: Integration
Synthesize all levels for complete understanding
```

### Adaptive Navigation

**Technique**: Adjust navigation parameters based on results

**Adaptive Process**:
1. **Initial Navigation**: Start with standard parameters
2. **Result Analysis**: Evaluate result quality and relevance
3. **Parameter Adjustment**: Modify zoom/pan/tilt based on results
4. **Iterative Refinement**: Continue until optimal results achieved

---

## Conclusion

ZPT navigation with MCP tools provides an unprecedented approach to knowledge exploration that combines intuitive spatial metaphors with powerful AI-driven content selection. By mastering the three dimensions of navigation—zoom, pan, and tilt—you can efficiently explore and understand complex knowledge structures with camera-like precision.

### Key Success Patterns

1. **Start with Preview**: Always preview before full navigation
2. **Validate Parameters**: Use validation tools to ensure optimal settings
3. **Progressive Refinement**: Start broad, then focus based on discoveries
4. **Combine Perspectives**: Use multiple navigation approaches for comprehensive understanding
5. **Integrate Systems**: Leverage memory and knowledge graph integration for enhanced results

### Navigation Mastery

- **Understand Your Corpus**: Use analysis tools to understand available content
- **Match Parameters to Goals**: Choose zoom/pan/tilt combinations that fit your objectives
- **Optimize for Performance**: Balance information density with response time
- **Build Navigation Patterns**: Develop reusable navigation strategies for common scenarios
- **Monitor and Adjust**: Continuously refine your navigation techniques

ZPT transforms knowledge exploration from linear searching to spatial discovery, enabling more intuitive and effective interaction with complex information landscapes. Through thoughtful navigation strategy and proper tool utilization, ZPT becomes a powerful platform for intelligent knowledge discovery and analysis.

---

*For detailed tool specifications and API reference, see [MCP Tools Documentation](./mcp-list.md) and [Semem HTTP API](./http-api-endpoints.md).*