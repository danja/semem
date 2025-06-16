        33 - ### Temporal Analysis
        33 + #### Educational Context
        34   ```
        35 - Explore 'climate change research' with temporal filtering from 2020-2024 using temporal tilt
        35 + Store an educational interaction about climate change with detailed explanation and examples for future reference
        36   ```
        37 
        38 - ### Multi-Entity Focus
        38 + ### `semem_retrieve_memories` - Semantic memory search and retrieval
        39 +  
        40 +  #### Basic Similarity Search
        41   ```
        42 - Navigate 'renewable energy solutions' focusing on Tesla, SolarCity, and First Solar using embedding tilt
        42 + Retrieve memories similar to "artificial intelligence" with threshold 0.7 and limit 10
        43   ```
        44 
        45 - ### High-Level Overview
        45 + #### High-Precision Search
        46   ```
        47 - Get a high-level overview of 'biotechnology trends' using corpus zoom with keyword tilt
        47 + Find memories about "quantum computing" with similarity threshold 0.9 to get only the most relevant results
        48   ```
        49 
        50 - ## Utility Tools Examples
        50 + #### Broad Exploration
        51 +  ```
        52 +  Search memories related to "technology trends" with threshold 0.5 and limit 20 for comprehensive exploration
        53 +  ```
        54 
        55 - ### Navigation Preview
        55 + ### `semem_generate_embedding` - Generate vector embeddings for text
        56 +  
        57 +  #### Single Text Embedding
        58   ```
        59 - Preview navigation options for 'quantum computing' to understand scope
        59 + Generate embedding for the text "Machine learning algorithms process data to find patterns"
        60   ```
        61 
        62 - ### Parameter Validation
        62 + #### Concept Embedding
        63   ```
        64 - Validate navigation parameters for complex query to catch errors early
        64 + Create vector embedding for the concept "sustainable energy solutions" for similarity comparisons
        65   ```
        66 
        67 - ### Options Discovery
        67 + #### Technical Documentation
        68   ```
        69 - Get available navigation options for 'artificial intelligence' to understand corpus capabilities
        69 + Generate embedding for this technical description: "LSTM networks use gating mechanisms to control information flow"
        70   ```
        71 
        72 - ### Corpus Analysis
        72 + ### `semem_generate_response` - LLM response generation with memory context
        73 +  
        74 +  #### Context-Aware Response
        75   ```
        76 - Analyze corpus structure to understand navigation performance characteristics
        76 + Generate response to "Explain neural networks" using memory context from previous AI discussions
        77   ```
        78 
        79 - ## Advanced Filtering Examples
        79 + #### Creative Writing with Memory
        80 +  ```
        81 +  Generate a creative story about space exploration using stored memories about astronomy and science fiction
        82 +  ```
        83 
        84 - ### Geographic Filtering
        84 + #### Technical Explanation
        85   ```
        86 - Navigate 'urban development projects' with geographic filtering for San Francisco Bay Area (bbox: [-122.5, 37.2, -121.9, 37.6])
        86 + Create a detailed explanation of blockchain technology incorporating relevant stored knowledge
        87   ```
        88 
        89 - ### Entity-Specific Exploration
        89 + ### `semem_extract_concepts` - Extract semantic concepts from text
        90 +  
        91 +  #### Academic Text Analysis
        92   ```
        93 - Explore 'AI research developments' focusing specifically on OpenAI, DeepMind, and Anthropic with temporal range 2022-2024
        93 + Extract key concepts from: "The quantum mechanical properties of superconductors enable zero electrical resistance"
        94   ```
        95 
        96 - ### Topic-Focused Analysis
        96 + #### Business Document Processing
        97   ```
        98 - Navigate 'renewable energy' with topic filtering for 'solar power' and unit zoom for contextual understanding
        98 + Analyze and extract concepts from a business proposal about renewable energy investments
        99   ```
       100 
       101 - ### Multi-Dimensional Filtering
       101 + #### Research Paper Summary
       102   ```
       103 - Analyze 'biomedical research' with topic filter 'gene therapy', temporal range 2020-2024, and graph tilt for relationship mapping
       103 + Extract semantic concepts from research abstract about artificial intelligence in healthcare
       104   ```
       105 
       106 - ## Performance Optimization Examples
       106 + ---
       107 
       108 - ### Fast Exploration
       108 + ## 💾 Storage Backend Management
       109 +  
       110 +  ### `semem_switch_storage_backend` - Switch between storage backends
       111 +  
       112 +  #### Switch to SPARQL Backend
       113   ```
       114 - Quick navigation of 'blockchain technology' with entity zoom, keywords tilt, and 1000 token limit for rapid overview
       114 + Switch storage backend to SPARQL with endpoint configuration for semantic web integration
       115   ```
       116 
       117 - ### Balanced Analysis
       117 + #### Development Mode Switch
       118   ```
       119 - Navigate 'machine learning' with unit zoom, embedding tilt, 4000 tokens, and semantic chunking for optimal detail/performance
       119 + Switch to InMemory backend for rapid development and testing without persistence
       120   ```
       121 
       122 - ### Comprehensive Study
       122 + #### Production Configuration
       123   ```
       124 - Detailed exploration of 'neural network architectures' with text zoom, graph tilt, 8000 tokens, and adaptive chunking
       124 + Switch to CachedSPARQL backend with optimized settings for production workloads
       125   ```
       126 
       127 - ### Preview-First Pattern
       127 + ### `semem_backup_memory` - Backup memory to JSON/RDF formats
       128 +  
       129 +  #### JSON Backup
       130   ```
       131 - First preview 'space exploration' to estimate requirements, then navigate with optimal parameters based on preview
       131 + Create backup of current memory in JSON format including embeddings for complete preservation
       132   ```
       133 
       134 - ## Integration Workflow Examples
       134 + #### RDF Backup for Semantic Web
       135 +  ```
       136 +  Backup memory as RDF/Turtle format for semantic web applications and interoperability
       137 +  ```
       138 
       139 - ### ZPT + Memory Integration
       139 + #### Lightweight Backup
       140   ```
       141 - 1. Navigate 'AI ethics frameworks' with ZPT and store results automatically
       142 -  2. Retrieve related ethics memories using semem_retrieve_memories
       143 -  3. Generate contextual response combining navigation and memory
       141 + Create backup in JSON format without embeddings for quick storage and transfer
       142   ```
       143 
       144 - ### ZPT + Ragno Knowledge Graph
       144 + ### `semem_load_memory` - Load memory from backup files
       145 +  
       146 +  #### Restore from Backup
       147   ```
       148 - 1. Use ZPT to explore 'neural network architectures' intuitively
       149 -  2. Follow with detailed ragno_search_dual for comprehensive analysis
       150 -  3. Perform ragno_analyze_graph for relationship insights
       151 -  4. Export findings with ragno_export_rdf
       148 + Load memory from backup file with merge option to preserve existing data
       149   ```
       150 
       151 - ### ZPT + Context Management
       151 + #### Fresh Start Load
       152   ```
       153 - 1. Navigate 'quantum computing' with ZPT
       154 -  2. Use semem_get_context to review navigation context
       155 -  3. Navigate related 'quantum algorithms' building on context
       156 -  4. Optimize context with semem_prune_context
       153 + Load memory from backup file with replace option for clean state restoration
       154   ```
       155 
       156 - ## Error Handling and Troubleshooting
       156 + #### Format-Specific Loading
       157 +  ```
       158 +  Load memory from RDF/Turtle backup file to restore semantic web format data
       159 +  ```
       160 
       161 - ### Parameter Validation
       161 + ### `semem_storage_stats` - Get storage statistics and health
       162 +  
       163 +  #### Basic Statistics
       164   ```
       165 - Validate intentionally invalid parameters to see error handling:
       166 -  - Empty query
       167 -  - Invalid zoom level 'invalid_zoom'  
       168 -  - Non-existent tilt 'fake_tilt'
       165 + Get current storage statistics including memory count, size, and performance metrics
       166   ```
       167 
       168 - ### Token Budget Management
       168 + #### Health Check
       169   ```
       170 - Navigate 'comprehensive AI overview' with very low token budget (500 tokens) to demonstrate adaptive behavior
       170 + Retrieve comprehensive storage health information with error rates and optimization recommendations
       171   ```
       172 
       173 - ### Graceful Degradation
       173 + #### Performance Analysis
       174   ```
       175 - Navigate non-existent topic 'completely_fictional_subject' to demonstrate error handling
       175 + Analyze storage performance with detailed timing, cache hit rates, and throughput metrics
       176   ```
       177 
       178 - ## Complex Multi-Step Workflows
       178 + ### `semem_migrate_storage` - Migrate data between storage backends
       179 
       180 - ### Research Discovery Workflow
       180 + #### Development to Production Migration
       181   ```
       182 - 1. Get corpus overview: Navigate 'artificial intelligence research' with corpus zoom
       183 -  2. Preview details: Preview 'large language models' at entity level  
       184 -  3. Explore entities: Navigate LLM entities with graph connections
       185 -  4. Understand relationships: Navigate LLMs at unit level with embedding tilt
       182 + Migrate data from InMemory to SPARQL backend for production deployment
       183   ```
       184 
       185 - ### Temporal Research Analysis
       185 + #### Backend Optimization
       186   ```
       187 - 1. Analyze recent trends: Navigate 'AI development trends' 2022-2024 with temporal tilt
       188 -  2. Historical context: Navigate same query 2010-2020 for comparison
       189 -  3. Entity timeline: Detailed timeline for OpenAI, DeepMind, Anthropic
       187 + Migrate from basic SPARQL to CachedSPARQL backend for improved performance
       188   ```
       189 
       190 - ### Domain Exploration Workflow
       190 + #### Cross-Platform Migration
       191   ```
       192 - 1. Domain overview: Navigate 'biotechnology' at corpus level
       193 -  2. Topic clusters: Navigate 'gene therapy' at community level
       194 -  3. Specific research: Navigate 'CRISPR applications' at unit level
       195 -  4. Source material: Navigate specific research at text level
       192 + Migrate memory data from JSON to SPARQL backend with configuration optimization
       193   ```
       194 
       195 - ## Performance Testing Prompts
       195 + ### `semem_clear_storage` - Clear storage with confirmation
       196 
       197 - ### Speed Benchmarks
       197 + #### Safe Clearing with Backup
       198   ```
       199 - Test fast navigation: 'AI' entity keywords (target: <200ms)
       200 -  Test medium navigation: 'machine learning' unit embedding (target: <800ms)  
       201 -  Test complex navigation: 'neural networks' unit graph (target: <2000ms)
       202 -  Test overview navigation: 'technology trends' corpus temporal (target: <500ms)
       199 + Clear storage with automatic backup creation for safe data removal
       200   ```
       201 
       202 - ### Token Efficiency Tests
       202 + #### Development Reset
       203   ```
       204 - Minimal tokens: Navigate 'blockchain' with 500 token limit
       205 -  Standard tokens: Navigate 'climate change' with 2000 token limit
       206 -  Comprehensive tokens: Navigate 'biotechnology' with 8000 token limit
       204 + Clear storage for development reset (confirm: true) without backup for clean slate
       205   ```
       206 
       207 - ### Caching Performance
       207 + #### Production Maintenance
       208   ```
       209 - 1. Navigate 'artificial intelligence' entity keywords (first run)
       210 -  2. Navigate same parameters again (should be faster due to caching)
       211 -  3. Navigate with slight variation to test cache miss/hit patterns
       209 + Clear storage with explicit confirmation and backup for production maintenance
       210   ```
       211 
       212 - ## Schema and Documentation Examples
       212 + ---
       213 
       214 - ### Get Complete Schema
       214 + ## 🎯 Context Management
       215 +  
       216 +  ### `semem_get_context` - Retrieve current context window information
       217 +  
       218 +  #### Context Overview
       219   ```
       220 - Use zpt_get_schema to retrieve complete parameter documentation and validation rules
       220 + Get current context window information including active memories and token usage
       221   ```
       222 
       223 - ### Access Resource Documentation
       223 + #### Detailed Context Analysis
       224   ```
       225 - Read semem://zpt/guide for complete ZPT navigation concepts
       226 -  Read semem://zpt/examples for comprehensive usage patterns
       227 -  Read semem://zpt/performance for optimization strategies
       228 -  Read semem://zpt/schema for detailed parameter documentation
       225 + Retrieve comprehensive context details with relevance scores and temporal data
       226   ```
       227 
       228 - ## Production Usage Patterns
       228 + #### Context Performance Check
       229 +  ```
       230 +  Analyze context window performance with memory distribution and efficiency metrics
       231 +  ```
       232 
       233 - ### Content Discovery
       233 + ### `semem_update_context_config` - Update context window settings
       234 +  
       235 +  #### Optimize for Performance
       236   ```
       237 - 1. Preview query scope with zpt_preview
       238 -  2. Validate parameters with zpt_validate_params  
       239 -  3. Navigate with optimal parameters
       240 -  4. Store results automatically in memory
       237 + Update context configuration: maxTokens 8000, relevanceThreshold 0.8, maxContextSize 15
       238   ```
       239 
       240 - ### Research Analysis
       240 + #### High-Precision Context
       241   ```
       242 - 1. Corpus analysis with zpt_analyze_corpus
       243 -  2. Get available options with zpt_get_options
       244 -  3. Multi-dimensional navigation with filtering
       245 -  4. Export and integrate with existing tools
       242 + Configure context for high precision: maxTokens 4000, relevanceThreshold 0.9, maxContextSize 10
       243   ```
       244 
       245 - ### Performance Monitoring
       245 + #### Large Context Window
       246   ```
       247 - 1. Analyze corpus performance characteristics
       248 -  2. Test navigation with various parameter combinations
       249 -  3. Monitor response times and token usage
       250 -  4. Optimize based on actual usage patterns
       247 + Set up large context window: maxTokens 16000, relevanceThreshold 0.6, maxContextSize 20
       248   ```
       249 
       250 - ## Custom Scenarios
       250 + ### `semem_prune_context` - Prune context based on relevance and age
       251 
       252 - Feel free to adapt these patterns for your specific use cases:
       252 + #### Relevance-Based Pruning
       253 +  ```
       254 +  Prune context keeping only items with relevance score above 0.7 for focused processing
       255 +  ```
       256 
       257 - - Replace topic terms with your domain of interest
       258 - - Adjust zoom levels based on desired detail level
       259 - - Modify tilt styles based on representation needs
       260 - - Customize token budgets based on performance requirements
       261 -  - Apply appropriate pan filters for your content scope
       257 + #### Time-Based Pruning
       258 + ```
       259 + Prune context removing items older than 24 hours (86400000ms) for fresh context
       260 + ```
       261 
       262 - ## Getting Started Recommendation
       262 + #### Combined Pruning Strategy
       263 +  ```
       264 +  Prune context with minimum relevance 0.6 and maximum age 1 hour for balanced optimization
       265 +  ```
       266 
       267 - 1. **Start Simple**: Begin with `zpt_navigate` using entity zoom and keywords tilt
       268 -  2. **Explore Options**: Use `zpt_get_options` to understand your corpus capabilities  
       269 -  3. **Preview First**: Use `zpt_preview` before complex navigation
       270 -  4. **Validate Parameters**: Use `zpt_validate_params` to catch errors early
       271 -  5. **Iterate and Optimize**: Gradually increase complexity and optimize based on results
       267 + ### `semem_summarize_context` - Generate summaries of current context
       268 
       269 - ## Advanced Integration
       269 + #### Context Summary
       270 +  ```
       271 +  Generate comprehensive summary of current context window for overview understanding
       272 +  ```
       273 
       274 - For advanced users, combine ZPT with:
       275 - - Memory management for persistent exploration
       276 - - Ragno tools for detailed graph analysis  
       277 - - Context management for coherent sessions
       278 -  - Configuration tools for system optimization
       274 + #### Key Points Extraction
       275 + ```
       276 + Create focused summary highlighting key themes and concepts from active context
       277 + ```
       278 
       279 +  #### Context Insights
       280 +  ```
       281 +  Generate analytical summary with insights about context patterns and relationships
       282 +  ```
       283 +  
       284   ---
       285 
       286 -  These prompts provide a comprehensive starting point for exploring ZPT's 3-dimensional knowledge graph navigation capabilities. Adjust parameters based on your specific 
     co
           - rpus content and performance requirements.
       286  \ No newline at end of file
       287 +  ## ⚙️ System Configuration & Monitoring
       288 +  
       289 +  ### `semem_get_config` - Get current system configuration
       290 +  
       291 +  #### Complete Configuration
       292 +  ```
       293 +  Get current system configuration across all components and modules
       294 +  ```
       295 +  
       296 +  #### Storage Configuration
       297 +  ```
       298 +  Retrieve storage-specific configuration settings and backend information
       299 +  ```
       300 +  
       301 +  #### LLM Provider Configuration
       302 +  ```
       303 +  Get LLM provider settings including model configurations and capabilities
       304 +  ```
       305 +  
       306 +  ### `semem_update_config` - Update system configuration settings
       307 +  
       308 +  #### Storage Configuration Update
       309 +  ```
       310 +  Update storage configuration: section "storage", updates {"timeout": 10000, "retries": 5}
       311 +  ```
       312 +  
       313 +  #### Memory Configuration
       314 +  ```
       315 +  Update memory settings: section "memory", updates {"similarityThreshold": 0.8, "contextWindow": 5}
       316 +  ```
       317 +  
       318 +  #### Model Configuration
       319 +  ```
       320 +  Update model configuration: section "models", updates {"temperature": 0.7, "maxTokens": 2000}
       321 +  ```
       322 +  
       323 +  ### `semem_get_metrics` - Get detailed system metrics and performance
       324 +  
       325 +  #### Performance Metrics
       326 +  ```
       327 +  Get comprehensive performance metrics including response times, cache rates, and throughput
       328 +  ```
       329 +  
       330 +  #### Memory Usage Analysis
       331 +  ```
       332 +  Retrieve detailed memory usage metrics with breakdown by component and operation type
       333 +  ```
       334 +  
       335 +  #### System Health Metrics
       336 +  ```
       337 +  Analyze system health with error rates, success rates, and resource utilization
       338 +  ```
       339 +  
       340 +  ### `semem_health_check` - Comprehensive health check
       341 +  
       342 +  #### Complete Health Check
       343 +  ```
       344 +  Perform comprehensive health check of all system components and dependencies
       345 +  ```
       346 +  
       347 +  #### Storage Health Validation
       348 +  ```
       349 +  Check storage backend health including connectivity, performance, and data integrity
       350 +  ```
       351 +  
       352 +  #### Service Dependencies Check
       353 +  ```
       354 +  Validate health of all service dependencies including LLM providers and external APIs
       355 +  ```
       356 +  
       357 +  ---
       358 +  
       359 +  ## 🕸️ Ragno Knowledge Graph
       360 +  
       361 +  ### `ragno_decompose_corpus` - Transform text corpus into RDF knowledge graph
       362 +  
       363 +  #### Basic Corpus Decomposition
       364 +  ```
       365 +  Decompose text corpus about artificial intelligence with entity extraction and relationship mapping
       366 +  ```
       367 +  
       368 +  #### Advanced Decomposition with Options
       369 +  ```
       370 +  Transform research papers into knowledge graph with extractRelationships: true, generateSummaries: true, maxEntitiesPerUnit: 25
       371 +  ```
       372 +  
       373 +  #### Domain-Specific Processing
       374 +  ```
       375 +  Decompose medical research corpus with high entity confidence (0.8) and detailed relationship extraction
       376 +  ```
       377 +  
       378 +  ### `ragno_search_dual` - Combined exact + vector + PersonalizedPageRank search
       379 +  
       380 +  #### Multi-Modal Search
       381 +  ```
       382 +  Search for "machine learning algorithms" using dual search with combined exact matching, vector similarity, and graph traversal
       383 +  ```
       384 +  
       385 +  #### High-Precision Discovery
       386 +  ```
       387 +  Find entities related to "quantum computing" with exactMatchThreshold 0.9 and vectorSimilarityThreshold 0.8
       388 +  ```
       389 +  
       390 +  #### Exploratory Graph Search
       391 +  ```
       392 +  Explore "climate change" with PersonalizedPageRank depth 4 and combined result limit 25
       393 +  ```
       394 +  
       395 +  ### `ragno_get_entities` - Retrieve entities from knowledge graph
       396 +  
       397 +  #### All Entities Overview
       398 +  ```
       399 +  Retrieve all entities from knowledge graph with metadata and frequency information
       400 +  ```
       401 +  
       402 +  #### Filtered Entity Search
       403 +  ```
       404 +  Get entities with minimum frequency 3, specific type "Person", and limit 50 for targeted analysis
       405 +  ```
       406 +  
       407 +  #### Entry Point Entities
       408 +  ```
       409 +  Find entry point entities only with high-frequency threshold for knowledge graph navigation
       410 +  ```
       411 +  
       412 +  ### `ragno_vector_search` - HNSW-based vector similarity search
       413 +  
       414 +  #### Semantic Similarity Search
       415 +  ```
       416 +  Find entities semantically similar to "artificial intelligence research" with threshold 0.7 and k=15
       417 +  ```
       418 +  
       419 +  #### Concept Clustering
       420 +  ```
       421 +  Search for concepts related to "sustainable energy" with similarity threshold 0.8 and metadata inclusion
       422 +  ```
       423 +  
       424 +  #### Technical Term Discovery
       425 +  ```
       426 +  Find entities similar to "quantum entanglement" with high precision (threshold 0.9) and k=10
       427 +  ```
       428 +  
       429 +  ### `ragno_export_rdf` - Export knowledge graph in multiple RDF formats
       430 +  
       431 +  #### Turtle Export with Statistics
       432 +  ```
       433 +  Export complete knowledge graph as Turtle format with statistics and embeddings included
       434 +  ```
       435 +  
       436 +  #### JSON-LD for Web Applications
       437 +  ```
       438 +  Export graph as JSON-LD format optimized for web applications and linked data consumption
       439 +  ```
       440 +  
       441 +  #### N-Triples for Processing
       442 +  ```
       443 +  Export as N-Triples format for data processing and analysis workflows
       444 +  ```
       445 +  
       446 +  ### `ragno_query_sparql` - Execute SPARQL queries against graph
       447 +  
       448 +  #### Entity Count Query
       449 +  ```
       450 +  Execute SPARQL: "SELECT (COUNT(?entity) AS ?count) WHERE { ?entity a ragno:Entity }" with limit 1000
       451 +  ```
       452 +  
       453 +  #### Relationship Discovery
       454 +  ```
       455 +  Query relationships: "SELECT ?subject ?predicate ?object WHERE { ?rel a ragno:Relationship; ragno:hasSubject ?subject }"
       456 +  ```
       457 +  
       458 +  #### Complex Graph Analysis
       459 +  ```
       460 +  Find entity types and frequencies with SPARQL aggregation and ordering for comprehensive analysis
       461 +  ```
       462 +  
       463 +  ### `ragno_analyze_graph` - Graph analysis (centrality, communities, connectivity)
       464 +  
       465 +  #### Complete Graph Analysis
       466 +  ```
       467 +  Perform comprehensive graph analysis including centrality, communities, statistics, and connectivity
       468 +  ```
       469 +  
       470 +  #### Community Detection
       471 +  ```
       472 +  Analyze graph communities with detailed results and top 15 communities for cluster understanding
       473 +  ```
       474 +  
       475 +  #### Centrality Analysis
       476 +  ```
       477 +  Calculate centrality metrics for all entities with top 20 most central nodes for importance ranking
       478 +  ```
       479 +  
       480 +  ### `ragno_get_graph_stats` - Basic and detailed knowledge graph statistics
       481 +  
       482 +  #### Basic Statistics
       483 +  ```
       484 +  Get basic knowledge graph statistics including node count, edge count, and connectivity metrics
       485 +  ```
       486 +  
       487 +  #### Detailed Analysis with Distributions
       488 +  ```
       489 +  Retrieve detailed statistics with entity type distributions, relationship patterns, and performance metrics
       490 +  ```
       491 +  
       492 +  #### Performance Statistics
       493 +  ```
       494 +  Analyze graph performance with query times, indexing efficiency, and optimization recommendations
       495 +  ```
       496 +  
       497 +  ---
       498 +  
       499 +  ## 🧭 ZPT 3D Navigation
       500 +  
       501 +  ### `zpt_navigate` - 3-dimensional knowledge graph navigation
       502 +  
       503 +  #### Basic Entity Navigation
       504 +  ```
       505 +  Navigate "artificial intelligence" with entity zoom, keywords tilt, and 2000 token limit for quick overview
       506 +  ```
       507 +  
       508 +  #### Relationship Exploration
       509 +  ```
       510 +  Explore "machine learning algorithms" with unit zoom, graph tilt, and structured format for relationship mapping
       511 +  ```
       512 +  
       513 +  #### Temporal Analysis Navigation
       514 +  ```
       515 +  Navigate "climate change research" with community zoom, temporal tilt, and date range 2020-2024
       516 +  ```
       517 +  
       518 +  #### Complex Multi-Dimensional Navigation
       519 +  ```
       520 +  Navigate "renewable energy" with unit zoom, embedding tilt, entity filter ["Tesla", "SolarCity"], temporal range 2022-2024
       521 +  ```
       522 +  
       523 +  #### Geographic Context Navigation
       524 +  ```
       525 +  Navigate "urban development" with text zoom, keywords tilt, geographic filter bbox [-122.5, 37.2, -121.9, 37.6]
       526 +  ```
       527 +  
       528 +  ### `zpt_preview` - Preview ZPT navigation options
       529 +  
       530 +  #### Quick Preview
       531 +  ```
       532 +  Preview navigation options for "quantum computing" at entity level to understand available content
       533 +  ```
       534 +  
       535 +  #### Comprehensive Preview
       536 +  ```
       537 +  Preview "biotechnology trends" with unit zoom and topic filtering for scope estimation
       538 +  ```
       539 +  
       540 +  #### Multi-Parameter Preview
       541 +  ```
       542 +  Preview "AI research" with entity filtering and temporal constraints to estimate processing requirements
       543 +  ```
       544 +  
       545 +  ### `zpt_get_schema` - Get complete ZPT parameter schema
       546 +  
       547 +  #### Complete Schema
       548 +  ```
       549 +  Get complete ZPT parameter schema with validation rules, examples, and error code documentation
       550 +  ```
       551 +  
       552 +  #### Parameter Documentation
       553 +  ```
       554 +  Retrieve ZPT schema for understanding available zoom levels, pan filters, and tilt styles
       555 +  ```
       556 +  
       557 +  #### Validation Reference
       558 +  ```
       559 +  Get schema documentation for parameter validation and error handling implementation
       560 +  ```
       561 +  
       562 +  ### `zpt_validate_params` - Validate ZPT parameters
       563 +  
       564 +  #### Valid Parameter Check
       565 +  ```
       566 +  Validate parameters: query "neural networks", zoom "unit", pan {"temporal": {"start": "2023-01-01"}}, tilt "graph"
       567 +  ```
       568 +  
       569 +  #### Error Detection
       570 +  ```
       571 +  Validate invalid parameters: query "", zoom "invalid_level", tilt "nonexistent_style" for error handling
       572 +  ```
       573 +  
       574 +  #### Complex Parameter Validation
       575 +  ```
       576 +  Validate complex navigation with geographic filters, entity constraints, and transformation options
       577 +  ```
       578 +  
       579 +  ### `zpt_get_options` - Get available parameter values for corpus
       580 +  
       581 +  #### Current Corpus Options
       582 +  ```
       583 +  Get available navigation options for current corpus context to understand exploration possibilities
       584 +  ```
       585 +  
       586 +  #### Query-Specific Options
       587 +  ```
       588 +  Get navigation options for "artificial intelligence" query to see relevant domains and entities
       589 +  ```
       590 +  
       591 +  #### Full Corpus Capabilities
       592 +  ```
       593 +  Retrieve complete navigation options with full context for comprehensive corpus understanding
       594 +  ```
       595 +  
       596 +  ### `zpt_analyze_corpus` - Analyze corpus structure for optimization
       597 +  
       598 +  #### Structure Analysis
       599 +  ```
       600 +  Analyze corpus structure for navigation optimization with detailed statistics and recommendations
       601 +  ```
       602 +  
       603 +  #### Performance Analysis
       604 +  ```
       605 +  Get corpus performance analysis with recommendations for optimal navigation parameters
       606 +  ```
       607 +  
       608 +  #### Navigation Recommendations
       609 +  ```
       610 +  Analyze corpus and get recommendations for effective navigation strategies and parameter tuning
       611 +  ```
       612 +  
       613 +  ---
       614 +  
       615 +  ## 📊 System Resources
       616 +  
       617 +  ### `semem://status` - System status and service health
       618 +  
       619 +  #### Access Example
       620 +  ```
       621 +  Read semem://status for current system health and service availability
       622 +  ```
       623 +  
       624 +  ### `semem://docs/api` - Complete API documentation
       625 +  
       626 +  #### Documentation Access
       627 +  ```
       628 +  Read semem://docs/api for comprehensive API documentation and usage examples
       629 +  ```
       630 +  
       631 +  ### `semem://graph/schema` - RDF graph schema and ontology
       632 +  
       633 +  #### Schema Information
       634 +  ```
       635 +  Read semem://graph/schema for RDF ontology structure and semantic relationships
       636 +  ```
       637 +  
       638 +  ### `semem://config/current` - Current system configuration
       639 +  
       640 +  #### Configuration Review
       641 +  ```
       642 +  Read semem://config/current for active system settings and component configurations
       643 +  ```
       644 +  
       645 +  ### `semem://storage/backends` - Storage backend capabilities
       646 +  
       647 +  #### Backend Information
       648 +  ```
       649 +  Read semem://storage/backends for available storage options and their capabilities
       650 +  ```
       651 +  
       652 +  ### `semem://metrics/dashboard` - System metrics and performance
       653 +  
       654 +  #### Performance Dashboard
       655 +  ```
       656 +  Read semem://metrics/dashboard for real-time system performance and usage statistics
       657 +  ```
       658 +  
       659 +  ### `semem://examples/workflows` - Common workflow examples
       660 +  
       661 +  #### Workflow Templates
       662 +  ```
       663 +  Read semem://examples/workflows for common usage patterns and integration examples
       664 +  ```
       665 +  
       666 +  ---
       667 +  
       668 +  ## 🕸️ Ragno Resources
       669 +  
       670 +  ### `semem://ragno/ontology` - Complete Ragno ontology in Turtle format
       671 +  
       672 +  #### Ontology Access
       673 +  ```
       674 +  Read semem://ragno/ontology for complete RDF ontology definition in Turtle format
       675 +  ```
       676 +  
       677 +  ### `semem://ragno/pipeline` - Complete Ragno knowledge graph pipeline guide
       678 +  
       679 +  #### Pipeline Documentation
       680 +  ```
       681 +  Read semem://ragno/pipeline for comprehensive guide to knowledge graph construction workflow
       682 +  ```
       683 +  
       684 +  ### `semem://ragno/examples` - Knowledge graph construction examples
       685 +  
       686 +  #### Example Workflows
       687 +  ```
       688 +  Read semem://ragno/examples for practical knowledge graph construction and analysis examples
       689 +  ```
       690 +  
       691 +  ### `semem://ragno/sparql/queries` - Pre-built SPARQL query templates
       692 +  
       693 +  #### Query Templates
       694 +  ```
       695 +  Read semem://ragno/sparql/queries for ready-to-use SPARQL queries for common graph operations
       696 +  ```
       697 +  
       698 +  ---
       699 +  
       700 +  ## 🧭 ZPT Resources
       701 +  
       702 +  ### `semem://zpt/schema` - Complete JSON schema for ZPT navigation
       703 +  
       704 +  #### Parameter Schema
       705 +  ```
       706 +  Read semem://zpt/schema for complete JSON schema of ZPT navigation parameters with validation rules
       707 +  ```
       708 +  
       709 +  ### `semem://zpt/examples` - Comprehensive ZPT navigation examples
       710 +  
       711 +  #### Navigation Examples
       712 +  ```
       713 +  Read semem://zpt/examples for comprehensive navigation patterns and usage examples
       714 +  ```
       715 +  
       716 +  ### `semem://zpt/guide` - ZPT concepts and spatial metaphors guide
       717 +  
       718 +  #### Conceptual Guide
       719 +  ```
       720 +  Read semem://zpt/guide for understanding ZPT 3D navigation concepts and spatial metaphors
       721 +  ```
       722 +  
       723 +  ### `semem://zpt/performance` - ZPT performance optimization strategies
       724 +  
       725 +  #### Performance Guide
       726 +  ```
       727 +  Read semem://zpt/performance for optimization strategies, caching patterns, and performance tuning
       728 +  ```
       729 +  
       730 +  ---
       731 +  
       732 +  ## 🚀 Common Usage Patterns
       733 +  
       734 +  ### Getting Started Workflow
       735 +  ```
       736 +  1. Check system status: semem://status
       737 +  2. Store initial interaction: semem_store_interaction
       738 +  3. Retrieve similar memories: semem_retrieve_memories
       739 +  4. Get system metrics: semem_get_metrics
       740 +  ```
       741 +  
       742 +  ### Knowledge Graph Construction
       743 +  ```
       744 +  1. Prepare text corpus for processing
       745 +  2. Decompose corpus: ragno_decompose_corpus
       746 +  3. Retrieve entities: ragno_get_entities
       747 +  4. Analyze graph: ragno_analyze_graph
       748 +  5. Export results: ragno_export_rdf
       749 +  ```
       750 +  
       751 +  ### 3D Navigation Exploration
       752 +  ```
       753 +  1. Preview navigation: zpt_preview
       754 +  2. Validate parameters: zpt_validate_params
       755 +  3. Navigate with ZPT: zpt_navigate
       756 +  4. Analyze corpus: zpt_analyze_corpus
       757 +  ```
       758 +  
       759 +  ### System Administration
       760 +  ```
       761 +  1. Health check: semem_health_check
       762 +  2. Get configuration: semem_get_config
       763 +  3. Storage statistics: semem_storage_stats
       764 +  4. Backup memory: semem_backup_memory
       765 +  ```
       766 +  
       767 +  ### Research Workflow
       768 +  ```
       769 +  1. Store research context: semem_store_interaction
       770 +  2. Build knowledge graph: ragno_decompose_corpus
       771 +  3. Navigate for insights: zpt_navigate
       772 +  4. Export findings: ragno_export_rdf
       773 +  ```
       774 +  
       775 +  ---
       776 +  
       777 +  ## 🔧 Advanced Integration Patterns
       778 +  
       779 +  ### Memory + Knowledge Graph Integration
       780 +  ```
       781 +  1. Store memories with semem_store_interaction
       782 +  2. Build knowledge graph with ragno_decompose_corpus
       783 +  3. Search with ragno_search_dual for enhanced retrieval
       784 +  4. Navigate with zpt_navigate for intuitive exploration
       785 +  ```
       786 +  
       787 +  ### Performance Optimization Workflow
       788 +  ```
       789 +  1. Analyze performance: semem_get_metrics
       790 +  2. Optimize storage: semem_switch_storage_backend
       791 +  3. Tune context: semem_update_context_config
       792 +  4. Monitor health: semem_health_check
       793 +  ```
       794 +  
       795 +  ### Research Data Pipeline
       796 +  ```
       797 +  1. Decompose research corpus: ragno_decompose_corpus
       798 +  2. Extract key entities: ragno_get_entities
       799 +  3. Navigate for insights: zpt_navigate
       800 +  4. Query with SPARQL: ragno_query_sparql
       801 +  5. Export for analysis: ragno_export_rdf
       802 +  ```
       803 +  
       804 +  ---
       805 +  
       806 +  ## 📝 Notes
       807 +  
       808 +  - **Parameter Validation**: Always validate complex parameters with appropriate validation tools
       809 +  - **Performance**: Use preview tools before full processing for resource estimation
       810 +  - **Error Handling**: Check tool responses for success status and error messages
       811 +  - **Resource Access**: Resources provide documentation and examples for tool usage
       812 +  - **Integration**: Combine tools for powerful workflows across memory, knowledge graphs, and navigation
       813 +  
       814 +  **Total Available**: 32 tools + 15 resources = 47 MCP capabilities for comprehensive semantic memory and knowledge graph operations.
       815  \ No newline at end of file


✻ Thinking…

  Now let me remove the old zpt-examples.js file since I've reorganized its content into the individual demo files and expanded documentation:


● Now let me remove the old zpt-examples.js file since I've reorganized its content into the new structure:


● Bash(rm examples/mcp/zpt-examples.js)
  ⎿  Waiting…

  ⎿  (No content)

============================================================================ Previous Conversation Compacted ===========================================================================
● Compact summary (ctrl+r to expand)
  ⎿  Read examples/mcp/example-prompts.md (813 lines)
  ⎿  Read examples/mcp/RagnoCorpusDecomposition.js (652 lines)
  ⎿  Read examples/mcp/ZPTBasicNavigation.js (600 lines)
  ⎿  Read examples/mcp/README.md (323 lines)
  ⎿  Read examples/mcp/IntegratedWorkflowDemo.js (100+ lines)
  ⎿  Todo list read (6 items)

✻ Thinking…

  Looking at the user request and the context from the conversation summary, I need to continue with the task of creating additional ZPT demos based on the request to "refactor 
  examples/mcp/zpt-examples.js into individual examples showcasing different parts of the ZPT functionality."

  From the conversation summary, I've completed:
  - ZPTBasicNavigation.js (basic navigation demo with educational content)
  - RagnoCorpusDecomposition.js (knowledge graph functionality)
  - Expanded example-prompts.md (all tools and resources)
  - Created comprehensive README.md

  However, the user specifically requested "individual examples showcasing different parts of the ZPT functionality," and I've only created the basic navigation demo so far. Looking at
   the README.md content, I can see that there are planned demos mentioned:

  - ZPTAdvancedFiltering.js - Complex multi-dimensional filtering 
  - ZPTUtilityTools.js - Schema, validation, and analysis tools
  - ZPTPerformanceOptimization.js - Performance benchmarking and optimization
  - ZPTIntegrationWorkflows.js - Integration with Memory and Ragno tools

  These are referenced in the README but don't exist yet. I should continue creating these additional ZPT demos to complete the reorganization work that was requested.

  Let me create the ZPTAdvancedFiltering.js demo next, focusing on complex filtering with temporal, geographic, and entity constraints as mentioned in the original plan.

● Based on the conversation context, I need to continue creating the remaining ZPT demo files mentioned in the README. Let me create the ZPTAdvancedFiltering.js demo that showcases
  complex multi-dimensional filtering capabilities.

● Write(examples/mcp/ZPTAdvancedFiltering.js)
  ⎿  Wrote 859 lines to examples/mcp/ZPTAdvancedFiltering.js
     #!/usr/bin/env node
     /**
      * ZPT Advanced Filtering Demonstration
      * 
      * This example showcases advanced ZPT filtering capabilities combining:
      * - Multi-dimensional pan filtering (temporal, geographic, entity, topic)
      * - Complex parameter combinations across zoom levels
      * - Dynamic filter composition and optimization
      * - Real-time filter performance analysis
     … +849 lines (ctrl+r to expand)

✻ Thinking…

  Now I'll create the ZPTUtilityTools.js demo that focuses on the schema, validation, options, and analysis utility tools of ZPT.

● Write(examples/mcp/ZPTUtilityTools.js)
  ⎿  Wrote 854 lines to examples/mcp/ZPTUtilityTools.js
     #!/usr/bin/env node
     /**
      * ZPT Utility Tools Demonstration
      * 
      * This example showcases ZPT utility and support tools:
      * - Schema exploration and documentation (zpt_get_schema)
      * - Parameter validation and error handling (zpt_validate_params)
      * - Navigation options discovery (zpt_get_options)
      * - Corpus analysis and optimization (zpt_analyze_corpus)
     … +844 lines (ctrl+r to expand)

✻ Thinking…

  Now I'll create the ZPTPerformanceOptimization.js demo that focuses on performance benchmarking and optimization patterns for ZPT operations.

● Write(examples/mcp/ZPTPerformanceOptimization.js)
  ⎿  Wrote 827 lines to examples/mcp/ZPTPerformanceOptimization.js
     #!/usr/bin/env node
     /**
      * ZPT Performance Optimization Demonstration
      * 
      * This example showcases performance optimization strategies for ZPT operations:
      * - Performance benchmarking across different parameter combinations
      * - Caching strategies and optimization patterns
      * - Resource usage analysis and optimization
      * - Best practices for high-performance ZPT navigation
     … +817 lines (ctrl+r to expand)
  ⎿  Claude usage limit reached. Your limit will reset at 1pm (Europe/Rome).

      • /upgrade to increase your usage limit.

╭───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────╮
│ >                                                                                                                                                                                         │
╰───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────╯
  ⏵⏵ auto-accept edits on (shift+tab to cycle)                                                                                                                         ⧉ In console-copy.md




