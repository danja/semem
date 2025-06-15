/**
 * Status and documentation resources for MCP server using HTTP pattern
 */
import { 
  ListResourcesRequestSchema,
  ReadResourceRequestSchema 
} from '@modelcontextprotocol/sdk/types.js';
import { getMemoryManager, getConfig, isInitialized } from '../lib/initialization.js';
import { mcpDebugger } from '../lib/debug-utils.js';

/**
 * Register status and documentation resources using HTTP pattern
 */
export function registerStatusResourcesHttp(server) {
  mcpDebugger.info('Registering status resources using HTTP pattern...');

  // List resources handler
  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    return {
      resources: [
        {
          uri: "semem://status",
          name: "System Status",
          description: "Current system status and service health", 
          mimeType: "application/json"
        },
        {
          uri: "semem://docs/api",
          name: "API Documentation",
          description: "Complete API documentation for Semem MCP integration",
          mimeType: "application/json"
        },
        {
          uri: "semem://graph/schema",
          name: "RDF Graph Schema", 
          description: "Schema and ontology information for the Ragno knowledge graph",
          mimeType: "application/json"
        },
        // Phase 1 - New Resources
        {
          uri: "semem://config/current",
          name: "Current Configuration",
          description: "Current system configuration settings",
          mimeType: "application/json"
        },
        {
          uri: "semem://storage/backends",
          name: "Storage Backends",
          description: "Available storage backend information and capabilities",
          mimeType: "application/json"
        },
        {
          uri: "semem://ragno/ontology",
          name: "Ragno Ontology",
          description: "Complete Ragno ontology in Turtle format",
          mimeType: "text/turtle"
        },
        {
          uri: "semem://metrics/dashboard",
          name: "Metrics Dashboard",
          description: "System metrics and performance data",
          mimeType: "application/json"
        },
        {
          uri: "semem://examples/workflows",
          name: "Workflow Examples",
          description: "Common workflow examples and templates",
          mimeType: "application/json"
        }
      ]
    };
  });

  // Read resource handler
  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const { uri } = request.params;
    
    mcpDebugger.info(`Resource requested: ${uri}`);

    if (uri === "semem://status") {
      return {
        contents: [{
          uri: "semem://status",
          mimeType: "application/json",
          text: JSON.stringify({
            server: {
              name: "Semem Integration Server",
              version: "1.0.0",
              timestamp: new Date().toISOString(),
              transport: "stdio"
            },
            services: {
              memoryManagerInitialized: !!getMemoryManager(),
              configInitialized: !!getConfig(),
              servicesInitialized: isInitialized()
            },
            capabilities: {
              memory_management: true,
              concept_extraction: true,
              embedding_generation: true,
              ragno_knowledge_graph: true,
              zpt_navigation: true
            }
          }, null, 2)
        }]
      };
    }

    if (uri === "semem://docs/api") {
      return {
        contents: [{
          uri: "semem://docs/api",
          mimeType: "application/json",
          text: JSON.stringify({
            title: "Semem MCP Integration API",
            version: "1.0.0",
            description: "Provides access to Semem core, Ragno knowledge graph, and ZPT APIs for semantic memory management and knowledge processing",
            
            tools: {
              core_memory_api: [
                "semem_store_interaction - Store interactions with embedding generation",
                "semem_retrieve_memories - Semantic memory search and retrieval",
                "semem_generate_embedding - Vector embedding generation",
                "semem_generate_response - LLM response with memory context",
                "semem_extract_concepts - LLM concept extraction"
              ],
              storage_management_api: [
                "semem_switch_storage_backend - Switch between storage backends (InMemory/JSON/SPARQL/CachedSPARQL)",
                "semem_backup_memory - Backup memory to JSON/RDF formats",
                "semem_load_memory - Load memory from backup files",
                "semem_storage_stats - Get storage statistics and health",
                "semem_migrate_storage - Migrate data between storage backends",
                "semem_clear_storage - Clear storage with confirmation"
              ],
              context_management_api: [
                "semem_get_context - Retrieve current context window information",
                "semem_update_context_config - Update context window settings",
                "semem_prune_context - Manually prune context based on relevance",
                "semem_summarize_context - Generate context summaries"
              ],
              system_configuration_api: [
                "semem_get_config - Get current system configuration",
                "semem_update_config - Update configuration settings",
                "semem_get_metrics - Get detailed system metrics",
                "semem_health_check - Comprehensive health check"
              ],
              future_ragno_api: [
                "ragno_decompose_corpus - Text to RDF knowledge graph decomposition (Phase 2)", 
                "ragno_create_entity - Create RDF entities with ontology compliance (Phase 2)",
                "ragno_create_semantic_unit - Create semantic text units (Phase 2)",
                "ragno_export_rdf - Export knowledge graph to RDF formats (Phase 2)",
                "ragno_query_graph - SPARQL queries on knowledge graph (Phase 2)",
                "ragno_graph_analytics - Run graph analytics (Phase 2)",
                "ragno_vector_search - HNSW-based vector similarity search (Phase 2)"
              ],
              future_zpt_api: [
                "zpt_select_corpuscles - Multi-dimensional content selection (Phase 3)",
                "zpt_chunk_content - Intelligent content chunking (Phase 3)",
                "zpt_navigate_content - Navigate through content dimensions (Phase 3)",
                "zpt_transform_content - Apply content transformations (Phase 3)"
              ]
            },
            
            resources: [
              "semem://status - System status and service health",
              "semem://docs/api - This API documentation",
              "semem://graph/schema - RDF graph schema and ontology information",
              "semem://config/current - Current system configuration settings",
              "semem://storage/backends - Available storage backend information",
              "semem://ragno/ontology - Complete Ragno ontology in Turtle format",
              "semem://metrics/dashboard - System metrics and performance data",
              "semem://examples/workflows - Common workflow examples and templates"
            ],
            
            implementation_phases: {
              phase_1_completed: {
                description: "Core Storage & Context Management Tools",
                tools_count: 18,
                features: [
                  "Storage backend switching (InMemory/JSON/SPARQL/CachedSPARQL)",
                  "Memory backup and restoration",
                  "Context window management and optimization",
                  "System configuration and monitoring",
                  "Comprehensive health checks and metrics"
                ]
              },
              phase_2_planned: {
                description: "Ragno Knowledge Graph Operations",
                tools_count: 8,
                features: [
                  "Corpus decomposition to RDF knowledge graphs",
                  "Entity and relationship creation with ontology compliance",
                  "SPARQL querying and graph analytics",
                  "RDF export in multiple formats",
                  "HNSW-based vector similarity search"
                ]
              },
              phase_3_planned: {
                description: "ZPT Navigation & Advanced Features",
                tools_count: 6,
                features: [
                  "Multi-dimensional content navigation",
                  "Intelligent content chunking and transformation",
                  "Batch operations and advanced memory management",
                  "Production-ready monitoring and caching"
                ]
              }
            },
            
            graphrag_compatibility: {
              standard_tools: [
                "store_document", "list_documents", "create_relations", 
                "search_relations", "hybrid_search", "read_graph", 
                "get_knowledge_graph_stats", "search_documentation", "add_observations"
              ],
              semem_current_equivalents: [
                "semem_store_interaction → store_document",
                "semem_retrieve_memories → hybrid_search", 
                "semem_storage_stats → get_knowledge_graph_stats",
                "semem_health_check → comprehensive system monitoring"
              ],
              semem_enhancements: [
                "Multiple storage backends (JSON, SPARQL, Cached)",
                "Context window management and optimization",
                "Real-time system configuration updates",
                "RDF/SPARQL semantic web integration",
                "ZPT multi-dimensional navigation (Phase 3)",
                "Ragno knowledge graph construction (Phase 2)"
              ]
            }
          }, null, 2)
        }]
      };
    }

    if (uri === "semem://graph/schema") {
      return {
        contents: [{
          uri: "semem://graph/schema",
          mimeType: "application/json",
          text: JSON.stringify({
            title: "Ragno RDF Graph Schema",
            version: "1.0.0",
            namespace: "http://purl.org/stuff/ragno/",
            
            core_classes: {
              "ragno:Corpus": "A collection of related documents or texts",
              "ragno:Entity": "Named entities extracted from text (people, places, concepts)",
              "ragno:SemanticUnit": "Independent semantic units from corpus decomposition",
              "ragno:Relationship": "First-class relationship nodes between entities",
              "ragno:Element": "Generic element in the knowledge graph"
            },
            
            properties: {
              "ragno:content": "Text content of the entity or unit",
              "ragno:connectsTo": "General connection between graph elements",
              "ragno:mentions": "Entity mentioned in a text unit",
              "ragno:embedding": "Vector embedding representation",
              "ragno:confidence": "Confidence score for extracted information",
              "ragno:maybe": "Marks hypothetical or uncertain information"
            },
            
            compatibility: {
              "SKOS": "Uses skos:prefLabel for primary labels",
              "Dublin Core": "Uses dcterms:created for timestamps",
              "RDFS": "Uses rdfs:label for additional labeling"
            }
          }, null, 2)
        }]
      };
    }

    // Phase 1 - New Resources
    if (uri === "semem://config/current") {
      const memoryManager = getMemoryManager();
      const config = getConfig();
      
      return {
        contents: [{
          uri: "semem://config/current",
          mimeType: "application/json",
          text: JSON.stringify({
            title: "Current System Configuration",
            timestamp: new Date().toISOString(),
            config: {
              memoryManager: memoryManager ? {
                chatModel: memoryManager.chatModel,
                embeddingModel: memoryManager.embeddingModel,
                storageType: memoryManager.storage?.constructor.name,
                dimension: memoryManager.memStore?.dimension,
                contextConfig: {
                  maxTokens: memoryManager.contextManager?.maxTokens,
                  maxTimeWindow: memoryManager.contextManager?.maxTimeWindow,
                  relevanceThreshold: memoryManager.contextManager?.relevanceThreshold,
                  maxContextSize: memoryManager.contextManager?.maxContextSize
                }
              } : null,
              systemConfig: config || {}
            }
          }, null, 2)
        }]
      };
    }

    if (uri === "semem://storage/backends") {
      return {
        contents: [{
          uri: "semem://storage/backends",
          mimeType: "application/json",
          text: JSON.stringify({
            title: "Available Storage Backends",
            version: "1.0.0",
            backends: {
              "InMemoryStore": {
                description: "Transient in-memory storage for development and testing",
                persistent: false,
                scalability: "low",
                features: ["fast_access", "no_persistence"],
                config_required: false
              },
              "JSONStore": {
                description: "File-based JSON storage for local development",
                persistent: true,
                scalability: "medium",
                features: ["file_persistence", "human_readable"],
                config_required: {
                  filePath: "Path to JSON file (default: ./data/memory.json)"
                }
              },
              "SPARQLStore": {
                description: "RDF triple store with SPARQL endpoint support",
                persistent: true,
                scalability: "high",
                features: ["rdf_compliance", "sparql_queries", "semantic_web"],
                config_required: {
                  endpoint: "SPARQL endpoint URL",
                  user: "Authentication username (default: admin)",
                  password: "Authentication password (default: admin)",
                  graphName: "Named graph URI (default: http://example.org/mcp/memory)"
                }
              },
              "CachedSPARQLStore": {
                description: "SPARQL store with caching for improved performance",
                persistent: true,
                scalability: "high",
                features: ["rdf_compliance", "sparql_queries", "caching", "semantic_web"],
                config_required: {
                  endpoint: "SPARQL endpoint URL",
                  user: "Authentication username (default: admin)",
                  password: "Authentication password (default: admin)",
                  graphName: "Named graph URI",
                  cacheOptions: "Caching configuration options"
                }
              }
            },
            usage_examples: {
              switch_to_json: {
                tool: "semem_switch_storage_backend",
                params: {
                  backend: "JSON",
                  config: { filePath: "./my-memory.json" }
                }
              },
              switch_to_sparql: {
                tool: "semem_switch_storage_backend",
                params: {
                  backend: "SPARQL",
                  config: {
                    endpoint: "http://localhost:3030/semem",
                    user: "admin",
                    password: "secret"
                  }
                }
              }
            }
          }, null, 2)
        }]
      };
    }

    if (uri === "semem://ragno/ontology") {
      const ragnoOntology = `@prefix ragno: <http://purl.org/stuff/ragno/> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix owl: <http://www.w3.org/2002/07/owl#> .
@prefix skos: <http://www.w3.org/2004/02/skos/core#> .
@prefix dcterms: <http://purl.org/dc/terms/> .

# Ragno Core Ontology
# Version 1.0.0

ragno: a owl:Ontology ;
    rdfs:label "Ragno Knowledge Graph Ontology" ;
    rdfs:comment "Ontology for semantic decomposition and knowledge graph construction" ;
    owl:versionInfo "1.0.0" .

# Core Classes
ragno:Element a owl:Class ;
    rdfs:label "Element" ;
    rdfs:comment "Generic element in the knowledge graph" .

ragno:Corpus a owl:Class ;
    rdfs:subClassOf ragno:Element ;
    rdfs:label "Corpus" ;
    rdfs:comment "A collection of related documents or texts" .

ragno:Entity a owl:Class ;
    rdfs:subClassOf ragno:Element ;
    rdfs:label "Entity" ;
    rdfs:comment "Named entities extracted from text (people, places, concepts)" .

ragno:SemanticUnit a owl:Class ;
    rdfs:subClassOf ragno:Element ;
    rdfs:label "Semantic Unit" ;
    rdfs:comment "Independent semantic units from corpus decomposition" .

ragno:Relationship a owl:Class ;
    rdfs:subClassOf ragno:Element ;
    rdfs:label "Relationship" ;
    rdfs:comment "First-class relationship nodes between entities" .

# Core Properties
ragno:content a owl:DatatypeProperty ;
    rdfs:label "content" ;
    rdfs:comment "Text content of the entity or unit" ;
    rdfs:domain ragno:Element ;
    rdfs:range rdfs:Literal .

ragno:connectsTo a owl:ObjectProperty ;
    rdfs:label "connects to" ;
    rdfs:comment "General connection between graph elements" ;
    rdfs:domain ragno:Element ;
    rdfs:range ragno:Element .

ragno:mentions a owl:ObjectProperty ;
    rdfs:label "mentions" ;
    rdfs:comment "Entity mentioned in a text unit" ;
    rdfs:domain ragno:SemanticUnit ;
    rdfs:range ragno:Entity .

ragno:embedding a owl:DatatypeProperty ;
    rdfs:label "embedding" ;
    rdfs:comment "Vector embedding representation" ;
    rdfs:domain ragno:Element .

ragno:confidence a owl:DatatypeProperty ;
    rdfs:label "confidence" ;
    rdfs:comment "Confidence score for extracted information" ;
    rdfs:domain ragno:Element ;
    rdfs:range xsd:float .

ragno:maybe a owl:AnnotationProperty ;
    rdfs:label "maybe" ;
    rdfs:comment "Marks hypothetical or uncertain information" .
`;
      
      return {
        contents: [{
          uri: "semem://ragno/ontology",
          mimeType: "text/turtle",
          text: ragnoOntology
        }]
      };
    }

    if (uri === "semem://metrics/dashboard") {
      const memoryManager = getMemoryManager();
      
      return {
        contents: [{
          uri: "semem://metrics/dashboard",
          mimeType: "application/json",
          text: JSON.stringify({
            title: "System Metrics Dashboard",
            timestamp: new Date().toISOString(),
            system: {
              uptime: process.uptime(),
              memory_usage: process.memoryUsage(),
              node_version: process.version,
              platform: process.platform
            },
            semem_metrics: memoryManager ? {
              memory: {
                short_term_count: "Use semem_get_metrics for current data",
                long_term_count: "Use semem_get_metrics for current data",
                embeddings_count: memoryManager.memStore?.embeddings?.length || 0,
                concepts_count: memoryManager.memStore?.conceptsList?.length || 0
              },
              context: {
                buffer_size: memoryManager.contextManager?.contextBuffer?.length || 0,
                max_size: memoryManager.contextManager?.maxContextSize || 0
              },
              cache: {
                size: memoryManager.cacheManager?.cache?.size || 0,
                max_size: memoryManager.cacheManager?.maxSize || 0
              }
            } : { error: "Memory manager not initialized" },
            tools_usage: {
              total_tools: 18,
              new_phase1_tools: 13,
              original_tools: 5
            }
          }, null, 2)
        }]
      };
    }

    if (uri === "semem://examples/workflows") {
      return {
        contents: [{
          uri: "semem://examples/workflows",
          mimeType: "application/json",
          text: JSON.stringify({
            title: "Common Workflow Examples",
            version: "1.0.0",
            workflows: {
              "basic_memory_workflow": {
                description: "Store and retrieve memories with embeddings",
                steps: [
                  {
                    step: 1,
                    tool: "semem_store_interaction",
                    params: {
                      prompt: "What is semantic memory?",
                      response: "Semantic memory is a type of long-term memory involving the storage of factual information.",
                      metadata: { source: "example" }
                    }
                  },
                  {
                    step: 2,
                    tool: "semem_retrieve_memories",
                    params: {
                      query: "memory types",
                      threshold: 0.7,
                      limit: 5
                    }
                  }
                ]
              },
              "storage_management_workflow": {
                description: "Switch storage backends and manage data",
                steps: [
                  {
                    step: 1,
                    tool: "semem_storage_stats",
                    params: {}
                  },
                  {
                    step: 2,
                    tool: "semem_backup_memory",
                    params: {
                      format: "json",
                      includeEmbeddings: true
                    }
                  },
                  {
                    step: 3,
                    tool: "semem_switch_storage_backend",
                    params: {
                      backend: "SPARQL",
                      config: {
                        endpoint: "http://localhost:3030/semem"
                      }
                    }
                  }
                ]
              },
              "context_optimization_workflow": {
                description: "Optimize context window for better performance",
                steps: [
                  {
                    step: 1,
                    tool: "semem_get_context",
                    params: {}
                  },
                  {
                    step: 2,
                    tool: "semem_prune_context",
                    params: {
                      minRelevance: 0.6,
                      maxAge: 3600000
                    }
                  },
                  {
                    step: 3,
                    tool: "semem_update_context_config",
                    params: {
                      maxTokens: 16384,
                      relevanceThreshold: 0.8
                    }
                  }
                ]
              },
              "system_monitoring_workflow": {
                description: "Monitor system health and performance",
                steps: [
                  {
                    step: 1,
                    tool: "semem_health_check",
                    params: {}
                  },
                  {
                    step: 2,
                    tool: "semem_get_metrics",
                    params: {}
                  },
                  {
                    step: 3,
                    tool: "semem_get_config",
                    params: {}
                  }
                ]
              }
            },
            graphrag_compatibility: {
              description: "Examples showing GraphRAG-style operations",
              standard_patterns: [
                "store_document -> create_relations -> search_relations",
                "hybrid_search -> get_knowledge_graph_stats",
                "add_observations -> read_graph"
              ],
              semem_enhancements: [
                "Use semem_decompose_corpus for advanced text processing",
                "Use ZPT navigation for multi-dimensional content exploration",
                "Use SPARQL backend for semantic web integration"
              ]
            }
          }, null, 2)
        }]
      };
    }

    throw new Error(`Unknown resource: ${uri}`);
  });

  mcpDebugger.info('Status resources registered successfully using HTTP pattern');
}