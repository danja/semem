/**
 * MCP Prompt Registry - Central management system for Semem MCP prompts
 * 
 * This registry manages all available prompt templates, handles prompt execution,
 * and coordinates multi-step workflows across Semem's memory, Ragno, and ZPT systems.
 */

import path from 'path';
import { fileURLToPath } from 'url';
import logger from 'loglevel';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Central registry for all MCP prompts
 */
class PromptRegistry {
  constructor() {
    this.prompts = new Map();
    this.categories = new Map();
    this.initialized = false;
  }

  /**
   * Initialize the prompt registry by loading all prompt templates
   */
  async initialize() {
    if (this.initialized) {
      return;
    }

    try {
      await this.loadPromptTemplates();
      this.initialized = true;
      logger.info(`Prompt registry initialized with ${this.prompts.size} prompts`);
    } catch (error) {
      logger.error('Failed to initialize prompt registry:', error);
      throw error;
    }
  }

  /**
   * Load all prompt templates from the templates directory
   */
  async loadPromptTemplates() {
    const categories = ['memory', 'ragno', 'zpt', 'integrated'];
    
    for (const category of categories) {
      const categoryPrompts = [];
      const categoryPath = path.join(__dirname, 'templates', category);
      
      try {
        // For now, we'll register the prompts programmatically
        // In the future, we can scan directories for .js files
        const prompts = await this.loadCategoryPrompts(category);
        
        for (const prompt of prompts) {
          this.registerPrompt(prompt);
          categoryPrompts.push(prompt.name);
        }
        
        this.categories.set(category, categoryPrompts);
        logger.debug(`Loaded ${prompts.length} prompts for category: ${category}`);
      } catch (error) {
        logger.warn(`Failed to load prompts for category ${category}:`, error);
      }
    }
  }

  /**
   * Load prompts for a specific category
   */
  async loadCategoryPrompts(category) {
    switch (category) {
      case 'memory':
        return this.getMemoryPrompts();
      case 'ragno':
        return this.getRagnoPrompts();
      case 'zpt':
        return this.getZptPrompts();
      case 'integrated':
        return this.getIntegratedPrompts();
      default:
        return [];
    }
  }

  /**
   * Register a prompt template
   */
  registerPrompt(promptTemplate) {
    if (!this.validatePromptTemplate(promptTemplate)) {
      throw new Error(`Invalid prompt template: ${promptTemplate.name}`);
    }

    this.prompts.set(promptTemplate.name, promptTemplate);
    logger.debug(`Registered prompt: ${promptTemplate.name}`);
  }

  /**
   * Get a registered prompt by name
   */
  getPrompt(name) {
    return this.prompts.get(name);
  }

  /**
   * Get all prompts for a category
   */
  getPromptsForCategory(category) {
    const promptNames = this.categories.get(category) || [];
    return promptNames.map(name => this.prompts.get(name)).filter(Boolean);
  }

  /**
   * List all available prompts
   */
  listPrompts() {
    return Array.from(this.prompts.values());
  }

  /**
   * Get prompts grouped by category
   */
  getPromptsByCategory() {
    const result = {};
    for (const [category, promptNames] of this.categories) {
      result[category] = promptNames.map(name => this.prompts.get(name)).filter(Boolean);
    }
    return result;
  }

  /**
   * Validate a prompt template structure
   */
  validatePromptTemplate(prompt) {
    if (!prompt || typeof prompt !== 'object') {
      return false;
    }

    // Required fields
    const required = ['name', 'description', 'arguments', 'workflow'];
    for (const field of required) {
      if (!(field in prompt)) {
        logger.error(`Prompt missing required field: ${field}`);
        return false;
      }
    }

    // Validate arguments
    if (!Array.isArray(prompt.arguments)) {
      logger.error('Prompt arguments must be an array');
      return false;
    }

    for (const arg of prompt.arguments) {
      if (!arg.name || !arg.description || typeof arg.required !== 'boolean') {
        logger.error('Invalid argument structure:', arg);
        return false;
      }
    }

    // Validate workflow
    if (!Array.isArray(prompt.workflow)) {
      logger.error('Prompt workflow must be an array');
      return false;
    }

    for (const step of prompt.workflow) {
      if (!step.tool || !step.arguments) {
        logger.error('Invalid workflow step:', step);
        return false;
      }
    }

    return true;
  }

  /**
   * Get memory-focused prompt templates
   */
  getMemoryPrompts() {
    return [
      {
        name: 'semem-research-analysis',
        description: 'Research document analysis with semantic memory context',
        arguments: [
          {
            name: 'document_text',
            description: 'Text content to analyze',
            required: true,
            type: 'string'
          },
          {
            name: 'analysis_depth',
            description: 'Depth of analysis (shallow, medium, deep)',
            required: false,
            type: 'string',
            default: 'medium'
          },
          {
            name: 'context_threshold',
            description: 'Similarity threshold for context retrieval',
            required: false,
            type: 'number',
            default: 0.7
          }
        ],
        workflow: [
          {
            tool: 'semem_store_interaction',
            arguments: {
              prompt: 'Research document analysis',
              response: '${document_text}',
              metadata: {
                type: 'research_document',
                analysis_depth: '${analysis_depth}'
              }
            }
          },
          {
            tool: 'semem_extract_concepts',
            arguments: {
              text: '${document_text}'
            }
          },
          {
            tool: 'semem_retrieve_memories',
            arguments: {
              query: 'extracted concepts',
              limit: 10,
              similarity_threshold: '${context_threshold}'
            }
          },
          {
            tool: 'semem_generate_insights',
            arguments: {
              context: 'retrieved memories and concepts',
              focus: 'research analysis'
            }
          }
        ]
      },
      {
        name: 'semem-memory-qa',
        description: 'Q&A with semantic memory retrieval',
        arguments: [
          {
            name: 'question',
            description: 'Question to answer using memory',
            required: true,
            type: 'string'
          },
          {
            name: 'context_limit',
            description: 'Maximum number of context memories to retrieve',
            required: false,
            type: 'number',
            default: 5
          },
          {
            name: 'similarity_threshold',
            description: 'Minimum similarity for memory inclusion',
            required: false,
            type: 'number',
            default: 0.6
          }
        ],
        workflow: [
          {
            tool: 'semem_generate_embedding',
            arguments: {
              text: '${question}'
            }
          },
          {
            tool: 'semem_retrieve_memories',
            arguments: {
              query: '${question}',
              limit: '${context_limit}',
              similarity_threshold: '${similarity_threshold}'
            }
          },
          {
            tool: 'semem_generate_response',
            arguments: {
              prompt: '${question}',
              context: 'retrieved memories',
              options: {
                temperature: 0.7,
                max_tokens: 500
              }
            }
          }
        ]
      },
      {
        name: 'semem-ask',
        description: 'Ask a question that will be stored in Document QA format and optionally processed through the pipeline',
        arguments: [
          {
            name: 'question',
            description: 'Question to ask and store in Document QA format',
            required: true,
            type: 'string'
          },
          {
            name: 'namespace',
            description: 'Base namespace for question URI',
            required: false,
            type: 'string',
            default: 'http://example.org/docqa/'
          },
          {
            name: 'autoProcess',
            description: 'Automatically process the question through the Document QA pipeline',
            required: false,
            type: 'boolean',
            default: false
          }
        ],
        workflow: [
          {
            tool: 'semem_ask',
            arguments: {
              question: '${question}',
              namespace: '${namespace}',
              autoProcess: '${autoProcess}'
            }
          }
        ]
      },
      {
        name: 'semem-concept-exploration',
        description: 'Deep concept exploration using stored knowledge',
        arguments: [
          {
            name: 'concept',
            description: 'Concept to explore',
            required: true,
            type: 'string'
          },
          {
            name: 'exploration_depth',
            description: 'How deep to explore related concepts',
            required: false,
            type: 'number',
            default: 3
          },
          {
            name: 'include_relationships',
            description: 'Whether to include concept relationships',
            required: false,
            type: 'boolean',
            default: true
          }
        ],
        workflow: [
          {
            tool: 'semem_extract_concepts',
            arguments: {
              text: '${concept}'
            }
          },
          {
            tool: 'semem_retrieve_memories',
            arguments: {
              query: '${concept}',
              limit: 20,
              similarity_threshold: 0.5
            }
          },
          {
            tool: 'semem_analyze_concepts',
            arguments: {
              concepts: 'extracted and retrieved concepts',
              depth: '${exploration_depth}',
              include_relationships: '${include_relationships}'
            }
          }
        ]
      }
    ];
  }

  /**
   * Get Ragno knowledge graph prompt templates
   */
  getRagnoPrompts() {
    return [
      {
        name: 'ragno-corpus-to-graph',
        description: 'Transform text corpus to RDF knowledge graph',
        arguments: [
          {
            name: 'corpus_chunks',
            description: 'Array of text chunks to process',
            required: true,
            type: 'array'
          },
          {
            name: 'entity_confidence',
            description: 'Minimum confidence for entity extraction',
            required: false,
            type: 'number',
            default: 0.7
          },
          {
            name: 'extract_relationships',
            description: 'Whether to extract entity relationships',
            required: false,
            type: 'boolean',
            default: true
          }
        ],
        workflow: [
          {
            tool: 'ragno_decompose_corpus',
            arguments: {
              chunks: '${corpus_chunks}',
              options: {
                entity_confidence: '${entity_confidence}',
                extract_relationships: '${extract_relationships}'
              }
            }
          },
          {
            tool: 'ragno_extract_entities',
            arguments: {
              semantic_units: 'decomposed corpus units'
            }
          },
          {
            tool: 'ragno_build_relationships',
            arguments: {
              entities: 'extracted entities',
              extract_relationships: '${extract_relationships}'
            }
          },
          {
            tool: 'ragno_export_rdf',
            arguments: {
              entities: 'all entities',
              relationships: 'all relationships',
              format: 'turtle'
            }
          }
        ]
      },
      {
        name: 'ragno-entity-analysis',
        description: 'Analyze and enrich entities with context',
        arguments: [
          {
            name: 'entity_name',
            description: 'Name of entity to analyze',
            required: true,
            type: 'string'
          },
          {
            name: 'context_radius',
            description: 'How many relationship hops to include',
            required: false,
            type: 'number',
            default: 2
          },
          {
            name: 'include_embeddings',
            description: 'Whether to include entity embeddings',
            required: false,
            type: 'boolean',
            default: false
          }
        ],
        workflow: [
          {
            tool: 'ragno_find_entity',
            arguments: {
              name: '${entity_name}'
            }
          },
          {
            tool: 'ragno_get_relationships',
            arguments: {
              entity: 'found entity',
              radius: '${context_radius}'
            }
          },
          {
            tool: 'ragno_analyze_entity',
            arguments: {
              entity: 'found entity',
              relationships: 'entity relationships',
              include_embeddings: '${include_embeddings}'
            }
          }
        ]
      }
    ];
  }

  /**
   * Get ZPT navigation prompt templates
   */
  getZptPrompts() {
    return [
      {
        name: 'zpt-navigate-explore',
        description: 'Interactive 3D knowledge navigation',
        arguments: [
          {
            name: 'query',
            description: 'Navigation query or target',
            required: true,
            type: 'string'
          },
          {
            name: 'zoom_level',
            description: 'Initial zoom level (1-10)',
            required: false,
            type: 'number',
            default: 5
          },
          {
            name: 'tilt_style',
            description: 'Camera tilt style preference',
            required: false,
            type: 'string',
            default: 'auto'
          },
          {
            name: 'filters',
            description: 'Content filters to apply',
            required: false,
            type: 'object',
            default: {}
          }
        ],
        workflow: [
          {
            tool: 'zpt_validate_params',
            arguments: {
              query: '${query}',
              zoom: '${zoom_level}',
              tilt: '${tilt_style}',
              filters: '${filters}'
            }
          },
          {
            tool: 'zpt_navigate',
            arguments: {
              query: '${query}',
              zoom: '${zoom_level}',
              tilt: '${tilt_style}',
              filters: '${filters}'
            }
          },
          {
            tool: 'zpt_get_content',
            arguments: {
              area: 'current navigation area'
            }
          },
          {
            tool: 'zpt_analyze_spatial',
            arguments: {
              content: 'retrieved content',
              context: 'navigation context'
            }
          }
        ]
      }
    ];
  }

  /**
   * Get integrated workflow prompt templates
   */
  getIntegratedPrompts() {
    // Import enhanced workflows
    let enhancedWorkflows = [];
    try {
      // Dynamic import would be used here in production
      // For now, we'll add them programmatically
      enhancedWorkflows = this.getEnhancedWorkflows();
    } catch (error) {
      logger.warn('Enhanced workflows not available, using standard workflows');
    }

    return [
      ...enhancedWorkflows,
      {
        name: 'semem-full-pipeline',
        description: 'Complete memory → graph → navigation workflow',
        arguments: [
          {
            name: 'input_data',
            description: 'Input data to process',
            required: true,
            type: 'string'
          },
          {
            name: 'pipeline_stages',
            description: 'Which stages to include (memory, graph, navigation)',
            required: false,
            type: 'array',
            default: ['memory', 'graph', 'navigation']
          },
          {
            name: 'output_formats',
            description: 'Desired output formats',
            required: false,
            type: 'array',
            default: ['json', 'rdf']
          }
        ],
        workflow: [
          {
            tool: 'semem_store_interaction',
            arguments: {
              prompt: 'Full pipeline processing',
              response: '${input_data}'
            },
            condition: 'memory in pipeline_stages'
          },
          {
            tool: 'semem_extract_concepts',
            arguments: {
              text: '${input_data}'
            },
            condition: 'memory in pipeline_stages'
          },
          {
            tool: 'ragno_decompose_corpus',
            arguments: {
              chunks: ['${input_data}']
            },
            condition: 'graph in pipeline_stages'
          },
          {
            tool: 'ragno_extract_entities',
            arguments: {
              semantic_units: 'decomposed units'
            },
            condition: 'graph in pipeline_stages'
          },
          {
            tool: 'zpt_navigate',
            arguments: {
              query: 'extracted concepts and entities'
            },
            condition: 'navigation in pipeline_stages'
          },
          {
            tool: 'pipeline_integrate_results',
            arguments: {
              memory_results: 'memory processing results',
              graph_results: 'graph construction results',
              navigation_results: 'navigation results',
              output_formats: '${output_formats}'
            }
          }
        ]
      },
      {
        name: 'research-workflow',
        description: 'Academic research processing pipeline',
        arguments: [
          {
            name: 'research_documents',
            description: 'Array of research documents to process',
            required: true,
            type: 'array'
          },
          {
            name: 'domain_focus',
            description: 'Research domain focus area',
            required: false,
            type: 'string',
            default: 'general'
          },
          {
            name: 'analysis_goals',
            description: 'Specific analysis objectives',
            required: false,
            type: 'array',
            default: ['concept_extraction', 'relationship_mapping']
          }
        ],
        workflow: [
          {
            tool: 'research_ingest_documents',
            arguments: {
              documents: '${research_documents}',
              domain: '${domain_focus}'
            }
          },
          {
            tool: 'semem_extract_concepts',
            arguments: {
              text: 'combined document text'
            }
          },
          {
            tool: 'ragno_decompose_corpus',
            arguments: {
              chunks: 'document chunks'
            }
          },
          {
            tool: 'ragno_build_relationships',
            arguments: {
              entities: 'extracted entities'
            }
          },
          {
            tool: 'research_generate_insights',
            arguments: {
              concepts: 'extracted concepts',
              entities: 'graph entities',
              relationships: 'entity relationships',
              goals: '${analysis_goals}'
            }
          }
        ]
      }
    ];
  }

  /**
   * Get enhanced workflow templates (Phase 2 implementation)
   */
  getEnhancedWorkflows() {
    return [
      {
        name: 'enhanced-research-workflow',
        description: 'Intelligent document processing with SPARQL storage and learning',
        version: '2.0',
        category: 'integrated',
        arguments: [
          {
            name: 'research_documents',
            description: 'Array of research documents to process',
            required: true,
            type: 'array'
          },
          {
            name: 'domain_focus',
            description: 'Research domain focus area',
            required: false,
            type: 'string',
            default: 'general'
          },
          {
            name: 'analysis_goals',
            description: 'Specific analysis objectives',
            required: false,
            type: 'array',
            default: ['concept_extraction', 'relationship_mapping', 'insight_generation']
          },
          {
            name: 'user_context',
            description: 'User interaction context for personalization',
            required: false,
            type: 'object',
            default: {}
          }
        ],
        workflow: [
          {
            tool: 'semem_switch_storage_backend',
            arguments: {
              backend: 'CachedSPARQL',
              config: {
                endpoint: 'http://localhost:3030/semem/query',
                enableEmbeddings: true,
                cacheSize: 10000
              }
            },
            description: 'Initialize enhanced SPARQL storage'
          },
          {
            tool: 'research_ingest_documents',
            arguments: {
              documents: '${research_documents}',
              domain: '${domain_focus}'
            },
            description: 'Enhanced document ingestion with dual storage'
          },
          {
            tool: 'semem_extract_concepts',
            arguments: {
              text: 'combined document text',
              options: { domainFocus: '${domain_focus}' }
            },
            description: 'Extract domain-focused concepts'
          },
          {
            tool: 'ragno_decompose_corpus',
            arguments: {
              textChunks: 'document chunks',
              options: {
                extractRelationships: true,
                enableEmbeddings: true,
                minEntityConfidence: 0.7
              }
            },
            description: 'Build enhanced knowledge graph'
          },
          {
            tool: 'ragno_analyze_graph',
            arguments: {
              analysisTypes: ['statistics', 'centrality', 'communities'],
              options: { includeDetails: true }
            },
            description: 'Comprehensive graph analysis'
          },
          {
            tool: 'research_generate_insights',
            arguments: {
              concepts: 'extracted concepts',
              entities: 'graph entities',
              relationships: 'graph relationships',
              goals: '${analysis_goals}',
              userContext: '${user_context}'
            },
            description: 'Generate comprehensive research insights'
          },
          {
            tool: 'hybrid_search',
            arguments: {
              query: '${domain_focus} research insights',
              threshold: 0.7,
              limit: 20
            },
            description: 'Setup hybrid search capabilities'
          }
        ],
        features: {
          adaptiveLearning: true,
          hybridSearch: true,
          sparqlIntegration: true,
          embeddingSupport: true,
          userPersonalization: true
        }
      },
      {
        name: 'intelligent-qa-workflow',
        description: 'Answer questions using hybrid search and incremental learning',
        version: '2.0',
        category: 'integrated',
        arguments: [
          {
            name: 'question',
            description: 'User question to answer using intelligent search',
            required: true,
            type: 'string'
          },
          {
            name: 'user_context',
            description: 'User interaction context for personalization',
            required: false,
            type: 'object',
            default: {}
          },
          {
            name: 'search_config',
            description: 'Advanced search configuration',
            required: false,
            type: 'object',
            default: {
              searchDepth: 'comprehensive',
              confidenceThreshold: 0.7
            }
          }
        ],
        workflow: [
          {
            tool: 'semem_extract_concepts',
            arguments: {
              text: '${question}',
              options: { extractIntent: true }
            },
            description: 'Analyze question intent and concepts'
          },
          {
            tool: 'adaptive_query_processing',
            arguments: {
              query: '${question}',
              userContext: '${user_context}'
            },
            description: 'Process query adaptively'
          },
          {
            tool: 'hybrid_search',
            arguments: {
              query: '${question}',
              threshold: '${adaptive_strategy.threshold}',
              limit: '${adaptive_strategy.limit}'
            },
            description: 'Execute comprehensive hybrid search'
          },
          {
            tool: 'semem_generate_response',
            arguments: {
              prompt: '${enhanced_question_prompt}',
              useMemory: true,
              contextLimit: 15,
              options: {
                structuredResponse: true,
                includeConfidence: true
              }
            },
            description: 'Generate intelligent, context-aware answer'
          },
          {
            tool: 'semem_store_interaction',
            arguments: {
              prompt: '${question}',
              response: '${intelligent_answer}',
              metadata: {
                userContext: '${user_context}',
                confidence: '${answer_confidence}',
                workflowVersion: '2.0'
              }
            },
            description: 'Store Q&A interaction for learning'
          },
          {
            tool: 'capture_user_feedback',
            arguments: {
              queryId: '${execution_id}',
              response: '${intelligent_answer}',
              feedback: {
                type: 'qa_response',
                context: '${user_context}'
              }
            },
            description: 'Setup feedback capture for learning'
          }
        ],
        features: {
          adaptiveSearch: true,
          contextualLearning: true,
          confidenceAssessment: true,
          userPersonalization: true,
          continuousImprovement: true
        }
      }
    ];
  }
}

// Global registry instance
export const promptRegistry = new PromptRegistry();

/**
 * Initialize the prompt registry
 */
export async function initializePromptRegistry() {
  await promptRegistry.initialize();
}

/**
 * Get a prompt by name
 */
export function getPrompt(name) {
  return promptRegistry.getPrompt(name);
}

/**
 * List all available prompts
 */
export function listPrompts() {
  return promptRegistry.listPrompts();
}

/**
 * Get prompts by category
 */
export function getPromptsByCategory() {
  return promptRegistry.getPromptsByCategory();
}

export default promptRegistry;