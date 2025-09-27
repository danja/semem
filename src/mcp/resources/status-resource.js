/**
 * Status and documentation resources for MCP server
 */
import { getMemoryManager, getConfig, isInitialized } from '../lib/initialization.js';

/**
 * Register status and documentation resources with the MCP server
 */
export function registerStatusResources(server) {
  // System status resource
  server.resource(
    "semem://status", 
    "System Status", 
    "Current system status and service health", 
    "application/json", 
    async () => {
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
  );

  // API documentation resource
  server.resource(
    "semem://docs/api",
    "API Documentation",
    "Complete API documentation for Semem MCP integration",
    "application/json",
    async () => {
      return {
        contents: [{
          uri: "semem://docs/api",
          mimeType: "application/json",
          text: JSON.stringify({
            title: "Semem MCP Integration API",
            version: "1.0.0",
            description: "Provides access to Semem core, Ragno knowledge graph, and ZPT APIs for semantic memory management and knowledge processing",
            
            tools: {
              memory_api: [
                "semem_store_interaction - Store interactions with embedding generation",
                "semem_retrieve_memories - Semantic memory search and retrieval",
                "semem_generate_embedding - Vector embedding generation",
                "semem_generate_response - LLM response with memory context",
                "semem_extract_concepts - LLM concept extraction"
              ],
              ragno_api: [
                "ragno_decompose_corpus - Text to RDF knowledge graph decomposition", 
                "ragno_create_entity - Create RDF entities with ontology compliance",
                "ragno_create_semantic_unit - Create semantic text units"
              ],
              zpt_api: [
                "zpt_select_corpuscles - Multi-dimensional content navigation",
                "zpt_chunk_content - Intelligent content chunking"
              ]
            },
            
            resources: [
              "semem://status - System status and service health",
              "semem://graph/schema - RDF graph schema and ontology information", 
              "semem://docs/api - This API documentation"
            ],
            
            graphrag_compatibility: {
              standard_tools: [
                "store_document", "list_documents", "create_relations", 
                "search_relations", "hybrid_search", "read_graph", 
                "get_knowledge_graph_stats", "search_documentation", "add_observations"
              ],
              semem_extensions: [
                "ZPT navigation", "Ragno RDF compliance", 
                "Semantic web integration", "Multi-tilt representations"
              ]
            }
          }, null, 2)
        }]
      };
    }
  );

  // Graph schema resource
  server.resource(
    "semem://graph/schema",
    "RDF Graph Schema",
    "Schema and ontology information for the Ragno knowledge graph",
    "application/json",
    async () => {
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
  );
}