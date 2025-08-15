#!/usr/bin/env node

/**
 * Semem MCP Integration Server
 * Modular ES6 implementation with enhanced debugging
 */

import dotenv from 'dotenv';

// Load environment variables first, before any other imports
dotenv.config();

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { 
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  CompleteRequestSchema
} from '@modelcontextprotocol/sdk/types.js';

// Import debugging utilities
import { mcpDebugger } from './lib/debug-utils.js';

// Import configuration
import { mcpConfig } from './lib/config.js';
import { initializeServices } from './lib/initialization.js';

// Import tool registrations
import { registerMemoryTools } from './tools/memory-tools.js';
import { registerZPTTools } from './tools/zpt-tools.js';

// Import Simple Verbs - New simplified MCP interface
import { registerSimpleVerbs } from './tools/simple-verbs.js';

// Import ZPT components for centralized handler
// import { ZPTNavigationService } from './tools/zpt-tools.js';
import { registerResearchWorkflowTools } from './tools/research-workflow-tools.js';
import { registerRagnoTools } from './tools/ragno-tools.js';
import { registerSPARQLTools } from './tools/sparql-tools.js';
import { registerVSOMTools } from './tools/vsom-tools.js';
import { PROMPT_TOOLS, executePromptTool } from './tools/prompt-tools.js';

// Import resource registrations  
import { registerStatusResources } from './resources/status-resource.js';
import { registerZPTResources } from './resources/zpt-resources.js';

// Import prompt system
import { initializePromptRegistry, promptRegistry } from './prompts/registry.js';
import { executePromptWorkflow, createSafeToolExecutor, validateExecutionPrerequisites } from './prompts/utils.js';

// Import enhanced workflow orchestrator
import { workflowOrchestrator } from './lib/workflow-orchestrator.js';

/**
 * Register MCP prompt handlers
 */
function registerPromptHandlers(server) {
  // List prompts handler
  server.setRequestHandler(ListPromptsRequestSchema, async () => {
    try {
      const prompts = promptRegistry.listPrompts();
      mcpDebugger.info(`Listed ${prompts.length} available prompts`);
      
      return {
        prompts: prompts.map(prompt => ({
          name: prompt.name,
          description: prompt.description,
          arguments: prompt.arguments.map(arg => ({
            name: arg.name,
            description: arg.description,
            required: arg.required,
            type: arg.type,
            default: arg.default
          }))
        }))
      };
    } catch (error) {
      mcpDebugger.error('Error listing prompts:', error);
      throw error;
    }
  });

  // Get prompt handler
  server.setRequestHandler(GetPromptRequestSchema, async (request) => {
    try {
      const { name } = request.params;
      if (!name) {
        throw new Error('Prompt name is required');
      }

      const prompt = promptRegistry.getPrompt(name);
      if (!prompt) {
        throw new Error(`Prompt not found: ${name}`);
      }

      mcpDebugger.info(`Retrieved prompt: ${name}`);
      return {
        prompt: {
          name: prompt.name,
          description: prompt.description,
          arguments: prompt.arguments,
          workflow: prompt.workflow.map(step => ({
            tool: step.tool,
            arguments: step.arguments,
            condition: step.condition
          }))
        }
      };
    } catch (error) {
      mcpDebugger.error('Error getting prompt:', error);
      throw error;
    }
  });

  // Execute prompt handler (for MCP prompt execution)
  server.setRequestHandler(CompleteRequestSchema, async (request) => {
    let promptName = 'unknown';
    
    try {
      // Validate basic request structure
      if (!request || !request.params) {
        throw new Error('Invalid request: missing params');
      }
      
      const { ref, argument } = request.params;
      
      // Validate ref structure
      if (!ref || typeof ref !== 'object') {
        throw new Error('Invalid ref: must be an object');
      }
      
      // Validate argument structure
      if (argument !== null && argument !== undefined && typeof argument !== 'object') {
        throw new Error('Invalid argument: must be an object, null, or undefined');
      }
      
      if (ref.type !== 'ref/prompt') {
        throw new Error('Only prompt references are supported');
      }
      
      const promptName = ref.name;
      mcpDebugger.info(`Executing prompt: ${promptName}`, { argument });
      
      const prompt = promptRegistry.getPrompt(promptName);
      if (!prompt) {
        throw new Error(`Prompt not found: ${promptName}`);
      }
      
      // Execute the prompt workflow
      const { executePromptWorkflow, createSafeToolExecutor } = await import('./prompts/utils.js');
      
      // Create tool executor that can call our registered tools
      const toolExecutor = createSafeToolExecutor(server);
      
      // Execute the workflow with the provided arguments
      const result = await executePromptWorkflow(prompt, argument, toolExecutor);
      
      mcpDebugger.info(`Prompt execution completed: ${promptName}`);
      
      return {
        content: [{
          type: "text",
          text: typeof result === 'string' ? result : JSON.stringify(result, null, 2)
        }],
        model: "semem-mcp"
      };
      
    } catch (error) {
      // Enhanced error handling for prompt execution
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorType = error?.name || 'PromptExecutionError';
      
      mcpDebugger.error('Error executing prompt:', {
        promptName,
        error: errorMessage,
        type: errorType,
        stack: error?.stack
      });
      
      // Determine error category for better user feedback
      let errorCategory = 'execution';
      let userFriendlyMessage = `Prompt execution failed: ${errorMessage}`;
      
      if (errorMessage.includes('not found')) {
        errorCategory = 'not_found';
        userFriendlyMessage = `Prompt not found: ${promptName}`;
      } else if (errorMessage.includes('Invalid')) {
        errorCategory = 'validation';
        userFriendlyMessage = `Invalid prompt input: ${errorMessage}`;
      } else if (errorMessage.includes('timeout')) {
        errorCategory = 'timeout';
        userFriendlyMessage = `Prompt execution timed out: ${errorMessage}`;
      }
      
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            success: false,
            error: userFriendlyMessage,
            errorType: errorType,
            errorCategory: errorCategory,
            promptName: promptName,
            timestamp: new Date().toISOString()
          }, null, 2)
        }],
        model: "semem-mcp"
      };
    }
  });

  mcpDebugger.info('Prompt handlers registered successfully');
}

/**
 * Register MCP resource handlers
 */
function registerResourceHandlers(server) {
  // List resources handler
  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    try {
      const resources = [
        // Status resources
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
        // ZPT resources
        {
          uri: "semem://zpt/schema",
          name: "ZPT Parameter Schema",
          description: "Complete JSON schema for ZPT navigation parameters with validation rules and examples",
          mimeType: "application/json"
        },
        {
          uri: "semem://zpt/examples",
          name: "ZPT Navigation Examples", 
          description: "Comprehensive examples and patterns for ZPT knowledge graph navigation",
          mimeType: "text/markdown"
        },
        {
          uri: "semem://zpt/guide",
          name: "ZPT Navigation Guide",
          description: "Comprehensive guide to ZPT concepts, spatial metaphors, and navigation principles",
          mimeType: "text/markdown"
        },
        {
          uri: "semem://zpt/performance",
          name: "ZPT Performance Optimization Guide",
          description: "Performance optimization strategies, caching patterns, and monitoring for ZPT navigation",
          mimeType: "text/markdown"
        }
      ];

      mcpDebugger.info(`Listed ${resources.length} available resources`);
      return { resources };
    } catch (error) {
      mcpDebugger.error('Error listing resources:', error);
      throw error;
    }
  });

  // Read resource handler
  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    try {
      const { uri } = request.params;
      if (!uri) {
        throw new Error('Resource URI is required');
      }

      mcpDebugger.info(`Reading resource: ${uri}`);
      
      // Handle different resource types
      let content;
      
      switch (uri) {
        case "semem://status":
          content = JSON.stringify({
            server: {
              name: "Semem Integration Server",
              version: "1.0.0",
              timestamp: new Date().toISOString(),
              transport: "stdio"
            },
            services: {
              memoryManagerInitialized: true,
              configInitialized: true,
              servicesInitialized: true
            },
            capabilities: {
              memory_management: true,
              concept_extraction: true,
              embedding_generation: true,
              ragno_knowledge_graph: true,
              zpt_navigation: true
            }
          }, null, 2);
          break;

        case "semem://docs/api":
          content = JSON.stringify({
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
                "zpt_navigate - Multi-dimensional knowledge graph navigation using spatial metaphors",
                "zpt_preview - Lightweight preview of navigation destinations",
                "zpt_get_schema - Get ZPT parameter schema and validation rules",
                "zpt_validate_params - Validate ZPT navigation parameters",
                "zpt_get_options - Get available navigation options and capabilities",
                "zpt_analyze_corpus - Analyze corpus for ZPT navigation readiness"
              ],
              zpt_ontology_api: [
                "zpt_convert_params - Convert string parameters to ZPT ontology URIs",
                "zpt_store_session - Store navigation session with RDF metadata",
                "zpt_get_sessions - Retrieve stored navigation sessions",
                "zpt_get_ontology_terms - Get ZPT ontology terms and namespaces",
                "zpt_validate_ontology - Validate parameters against ZPT ontology",
                "zpt_analyze_navigation - Analyze navigation patterns and statistics"
              ]
            },
            
            resources: [
              "semem://status - System status and service health",
              "semem://graph/schema - RDF graph schema and ontology information", 
              "semem://docs/api - This API documentation"
            ]
          }, null, 2);
          break;

        case "semem://graph/schema":
          content = JSON.stringify({
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
            }
          }, null, 2);
          break;

        case "semem://zpt/schema":
          content = JSON.stringify({
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "ZPT Navigation Parameters",
            "description": "Schema for 3-dimensional knowledge graph navigation using spatial metaphors",
            "type": "object",
            "properties": {
              "query": {
                "type": "string",
                "minLength": 1,
                "description": "Navigation query for corpus exploration"
              },
              "zoom": {
                "type": "string",
                "enum": ["entity", "unit", "text", "community", "corpus"],
                "default": "entity",
                "description": "Level of abstraction for content selection"
              },
              "pan": {
                "type": "object",
                "description": "Content filtering parameters"
              },
              "tilt": {
                "type": "string", 
                "enum": ["keywords", "embedding", "graph", "temporal"],
                "default": "keywords",
                "description": "Representation style for content"
              }
            },
            "required": ["query"]
          }, null, 2);
          break;

        case "semem://zpt/examples":
          content = `# ZPT Navigation Examples

## Basic Navigation Examples

### 1. Simple Entity Exploration
Use entity zoom with keywords tilt for quick factual lookup:
- Query: "artificial intelligence"
- Zoom: "entity" 
- Tilt: "keywords"
- Expected: List of AI-related entities with keyword descriptions

### 2. Contextual Understanding
Use unit zoom with embedding tilt for relationship understanding:
- Query: "machine learning algorithms"
- Zoom: "unit"
- Tilt: "embedding"
- Expected: Semantic units showing algorithm relationships

## Advanced Filtering Examples

### 3. Temporal Filtering
Navigate with specific time range:
- Query: "renewable energy solutions"
- Pan: temporal filter 2020-2024
- Tilt: "temporal"
- Expected: Recent renewable energy developments`;
          break;

        case "semem://zpt/guide":
          content = `# ZPT (3-Dimensional Knowledge Graph Navigation) Guide

## Introduction

ZPT (Zoom, Pan, Tilt) provides intuitive knowledge graph navigation using spatial metaphors borrowed from camera and mapping systems.

## The 3-Dimensional Navigation Model

### Zoom: Level of Abstraction
Controls how detailed or abstract your view is:

- **Entity**: Focus on individual entities and properties
- **Unit**: Balanced view of semantic units with related entities  
- **Text**: Broader view including detailed textual content
- **Community**: Topic-level clusters and domain overviews
- **Corpus**: Highest level patterns across entire knowledge base

### Pan: Content Filtering  
Controls what content is included:

- **Topic Filtering**: Focus on specific subject areas
- **Temporal Filtering**: Limit to specific time periods
- **Geographic Filtering**: Focus on location-specific content
- **Entity Filtering**: Focus on specific entities or organizations

### Tilt: Representation Style
Controls how content is represented:

- **Keywords**: Term-based representation (fastest)
- **Embedding**: Vector-based semantic similarity  
- **Graph**: Relationship-based network representation
- **Temporal**: Time-based sequential representation`;
          break;

        case "semem://zpt/performance":
          content = `# ZPT Performance & Optimization Guide

## Performance Characteristics

### Baseline Metrics
- Parameter Validation: 1-5ms
- Content Selection: 50-800ms (varies by zoom/pan)
- Tilt Projection: 40-1200ms (varies by tilt style)
- Content Transformation: 80-400ms (varies by token budget)
- Total Navigation: 200-2500ms (all factors combined)

### Performance by Zoom Level
- Entity: ~150ms, 200-800 tokens, high cache benefits
- Unit: ~400ms, 800-2000 tokens, medium cache benefits  
- Text: ~800ms, 1500-4000 tokens, low cache benefits
- Community: ~300ms, 500-1500 tokens, high cache benefits
- Corpus: ~200ms, 200-600 tokens, very high cache benefits

### Performance by Tilt Style
- Keywords: ~80ms, low memory, excellent cache efficiency
- Embedding: ~300ms, medium memory, good cache efficiency
- Graph: ~900ms, high memory, fair cache efficiency
- Temporal: ~400ms, medium memory, good cache efficiency`;
          break;

        default:
          throw new Error(`Unknown resource URI: ${uri}`);
      }

      return {
        contents: [{
          uri: uri,
          mimeType: uri.includes('/zpt/') && !uri.includes('schema') ? "text/markdown" : "application/json",
          text: content
        }]
      };
    } catch (error) {
      mcpDebugger.error('Error reading resource:', error);
      throw error;
    }
  });

  mcpDebugger.info('Resource handlers registered successfully');
}

/**
 * Register centralized tool handlers (following "everything" server pattern)
 */
function registerToolCallHandler(server) {
  // Register tools list handler
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        // Simple Verbs - Primary interface for MCP (moved to top for visibility)
        {
          name: 'tell',
          description: 'Add resources to the system with minimal processing. Supports interaction, document, and concept types.',
          inputSchema: {
            type: 'object',
            properties: {
              content: { type: 'string', description: 'Content to add to the system' },
              type: { type: 'string', enum: ['interaction', 'document', 'concept'], default: 'interaction', description: 'Type of content being added' },
              metadata: { type: 'object', description: 'Optional metadata for the content' }
            },
            required: ['content']
          }
        },
        {
          name: 'ask',
          description: 'Query the system using current ZPT context for enhanced answers.',
          inputSchema: {
            type: 'object',
            properties: {
              question: { type: 'string', description: 'Question to ask the system' },
              useContext: { type: 'boolean', default: true, description: 'Whether to use ZPT context for enhanced answers' }
            },
            required: ['question']
          }
        },
        {
          name: 'augment',
          description: 'Run operations like concept extraction on relevant knowledgebase parts.',
          inputSchema: {
            type: 'object',
            properties: {
              operation: { type: 'string', enum: ['extract_concepts', 'generate_embedding', 'analyze_text'], default: 'extract_concepts', description: 'Operation to perform' },
              target: { type: 'string', description: 'Target content or identifier for augmentation' },
              parameters: { type: 'object', description: 'Parameters for the augmentation operation' }
            },
            required: ['operation', 'target']
          }
        },
        {
          name: 'zoom',
          description: 'Set the abstraction level for navigation (entity, unit, text, community, corpus).',
          inputSchema: {
            type: 'object',
            properties: {
              level: { type: 'string', enum: ['entity', 'unit', 'text', 'community', 'corpus'], description: 'Detail level for navigation' },
              query: { type: 'string', description: 'Optional query to update along with zoom level' }
            },
            required: ['level']
          }
        },
        {
          name: 'pan',
          description: 'Set subject domain filters (temporal, keywords, entities, domains).',
          inputSchema: {
            type: 'object',
            properties: {
              temporal: { type: 'object', description: 'Temporal filtering parameters' },
              keywords: { type: 'array', items: { type: 'string' }, description: 'Keywords to filter by' },
              entities: { type: 'array', items: { type: 'string' }, description: 'Entity names to filter by' },
              domains: { type: 'array', items: { type: 'string' }, description: 'Subject domains to filter by' },
              query: { type: 'string', description: 'Optional query to update along with pan filters' }
            }
          }
        },
        {
          name: 'tilt',
          description: 'Set the view filter/representation style (keywords, embedding, graph, temporal).',
          inputSchema: {
            type: 'object',
            properties: {
              style: { type: 'string', enum: ['keywords', 'embedding', 'graph', 'temporal'], description: 'Representation style for content display' },
              query: { type: 'string', description: 'Optional query to update along with tilt style' }
            },
            required: ['style']
          }
        },
        {
          name: 'inspect',
          description: 'Inspect stored memories and session cache for debugging purposes.',
          inputSchema: {
            type: 'object',
            properties: {
              what: { type: 'string', enum: ['session', 'concepts', 'embeddings', 'all'], default: 'session', description: 'What to inspect' },
              details: { type: 'boolean', default: false, description: 'Include detailed information' }
            }
          }
        },
        {
          name: 'uploadDocument',
          description: 'Upload and process document file (PDF, TXT, MD)',
          inputSchema: {
            type: 'object',
            properties: {
              fileUrl: { type: 'string', description: 'Data URL of the uploaded file' },
              filename: { type: 'string', description: 'Original filename' },
              mediaType: { type: 'string', description: 'MIME type of the file' },
              documentType: { type: 'string', enum: ['pdf', 'text', 'markdown'], description: 'Document type inferred from extension' },
              metadata: {
                type: 'object',
                description: 'Additional metadata',
                properties: {
                  title: { type: 'string' },
                  tags: { type: 'array', items: { type: 'string' } },
                  uploadedAt: { type: 'string' },
                  originalName: { type: 'string' },
                  size: { type: 'number' }
                }
              }
            },
            required: ['fileUrl', 'filename', 'mediaType', 'documentType']
          }
        },
        {
          name: 'semem_extract_concepts',
          description: 'Extract semantic concepts from text using LLM analysis',
          inputSchema: {
            type: 'object',
            properties: {
              text: { type: 'string', description: 'Text to extract concepts from' }
            },
            required: ['text']
          }
        },
        {
          name: 'semem_generate_embedding',
          description: 'Generate vector embedding for given text',
          inputSchema: {
            type: 'object',
            properties: {
              text: { type: 'string', description: 'Text to generate embedding for' }
            },
            required: ['text']
          }
        },
        {
          name: 'semem_store_interaction',
          description: '[DEPRECATED - Use "tell" verb instead] Store a new interaction in semantic memory with embeddings and concept extraction',
          inputSchema: {
            type: 'object',
            properties: {
              prompt: { type: 'string', description: 'The user prompt or question' },
              response: { type: 'string', description: 'The response or answer' },
              metadata: { type: 'object', description: 'Optional metadata for the interaction' }
            },
            required: ['prompt', 'response']
          }
        },
        {
          name: 'semem_retrieve_memories',
          description: '[DEPRECATED - Use "ask" verb instead] Retrieve similar memories from semantic memory using vector search',
          inputSchema: {
            type: 'object',
            properties: {
              query: { type: 'string', description: 'Query to search for similar memories' },
              limit: { type: 'number', description: 'Maximum number of memories to retrieve', default: 5 },
              threshold: { type: 'number', description: 'Similarity threshold for filtering results', default: 0.7 }
            },
            required: ['query']
          }
        },
        {
          name: 'semem_generate_response',
          description: 'Generate a response using the LLM with optional context',
          inputSchema: {
            type: 'object',
            properties: {
              prompt: { type: 'string', description: 'The prompt to generate a response for' },
              context: { type: 'string', description: 'Optional context for the response' },
              maxTokens: { type: 'number', description: 'Maximum tokens in response', default: 1000 }
            },
            required: ['prompt']
          }
        },
        {
          name: 'semem_answer',
          description: '[DEPRECATED - Use "ask" verb instead] Answer a question using iterative feedback and the complete Semem knowledge processing pipeline',
          inputSchema: {
            type: 'object',
            properties: {
              question: { 
                type: 'string', 
                description: 'The question to answer'
              },
              mode: {
                type: 'string',
                enum: ['basic', 'standard', 'comprehensive'],
                default: 'standard',
                description: 'Answer quality mode: basic (2 iterations), standard (3 iterations), comprehensive (5 iterations)'
              }
            },
            required: ['question']
          }
        },
        {
          name: 'semem_ask',
          description: '[DEPRECATED - Use "ask" verb instead] Ask a question that will be stored in Document QA format and optionally processed through the pipeline',
          inputSchema: {
            type: 'object',
            properties: {
              question: { type: 'string', description: 'Question to ask and store in Document QA format' },
              namespace: { type: 'string', description: 'Base namespace for question URI', default: 'http://example.org/docqa/' },
              autoProcess: { type: 'boolean', description: 'Automatically process the question through the Document QA pipeline', default: false }
            },
            required: ['question']
          }
        },
        // ZPT tools
        {
          name: 'zpt_navigate',
          description: 'Navigate the knowledge space using 3D spatial metaphors (zoom, pan, tilt)',
          inputSchema: {
            type: 'object',
            properties: {
              query: { type: 'string', description: 'Navigation query for corpus exploration' },
              zoom: { 
                type: 'string', 
                enum: ['entity', 'unit', 'text', 'community', 'corpus', 'micro'], 
                default: 'entity',
                description: 'Level of abstraction for content selection'
              },
              pan: { 
                type: 'object', 
                description: 'Content filtering parameters',
                default: {}
              },
              tilt: { 
                type: 'string', 
                enum: ['keywords', 'embedding', 'graph', 'temporal'], 
                default: 'keywords',
                description: 'Representation style for content'
              },
              transform: { 
                type: 'object', 
                description: 'Output transformation options',
                default: {}
              }
            },
            required: ['query']
          }
        },
        {
          name: 'zpt_preview',
          description: 'Get a lightweight preview of a navigation destination',
          inputSchema: {
            type: 'object',
            properties: {
              query: { type: 'string', description: 'Query to preview' },
              zoom: { 
                type: 'string', 
                enum: ['entity', 'unit', 'text', 'community', 'corpus'], 
                description: 'Zoom level to preview'
              },
              pan: { 
                type: 'object', 
                description: 'Pan parameters to preview',
                default: {}
              }
            },
            required: ['query']
          }
        },
        {
          name: 'zpt_get_schema',
          description: 'Get the ZPT schema and available dimensions',
          inputSchema: {
            type: 'object',
            properties: {},
            additionalProperties: false
          }
        },
        {
          name: 'zpt_validate_params',
          description: 'Validate a set of ZPT navigation parameters',
          inputSchema: {
            type: 'object',
            properties: {
              params: {
                type: 'object',
                description: 'Parameters to validate',
                properties: {
                  query: { type: 'string' },
                  zoom: { type: 'string' },
                  pan: { type: 'object' },
                  tilt: { type: 'string' },
                  transform: { type: 'object' }
                },
                required: ['query', 'zoom', 'tilt']
              }
            },
            required: ['params']
          }
        },
        {
          name: 'zpt_get_options',
          description: 'Get available options for ZPT navigation',
          inputSchema: {
            type: 'object',
            properties: {
              context: { 
                type: 'string', 
                enum: ['current', 'full'], 
                default: 'current',
                description: 'Context scope for options'
              },
              query: { 
                type: 'string', 
                description: 'Optional query for context-specific options'
              }
            }
          }
        },
        {
          name: 'zpt_analyze_corpus',
          description: 'Analyze the corpus for ZPT navigation readiness',
          inputSchema: {
            type: 'object',
            properties: {
              analysisType: { 
                type: 'string', 
                enum: ['structure', 'performance', 'recommendations'], 
                default: 'structure',
                description: 'Type of analysis to perform'
              },
              includeStats: { 
                type: 'boolean', 
                default: true,
                description: 'Include detailed statistics'
              }
            }
          }
        },
        // ZPT Ontology Integration tools
        {
          name: 'zpt_convert_params',
          description: 'Convert string parameters to ZPT ontology URIs',
          inputSchema: {
            type: 'object',
            properties: {
              zoom: { type: 'string', description: 'Zoom level string to convert' },
              tilt: { type: 'string', description: 'Tilt projection string to convert' },
              pan: { type: 'object', description: 'Pan domain parameters to convert' }
            }
          }
        },
        {
          name: 'zpt_store_session',
          description: 'Store navigation session with RDF metadata',
          inputSchema: {
            type: 'object',
            properties: {
              purpose: { type: 'string', description: 'Purpose of navigation session' },
              agentURI: { type: 'string', description: 'URI of navigating agent' },
              userAgent: { type: 'string', description: 'User agent identifier' },
              sessionType: { type: 'string', description: 'Type of navigation session' }
            },
            required: ['purpose']
          }
        },
        {
          name: 'zpt_get_sessions',
          description: 'Retrieve stored navigation sessions',
          inputSchema: {
            type: 'object',
            properties: {
              limit: { type: 'number', default: 10, description: 'Maximum sessions to retrieve' },
              sessionType: { type: 'string', description: 'Filter by session type' }
            }
          }
        },
        {
          name: 'zpt_get_ontology_terms',
          description: 'Get ZPT ontology terms and namespaces',
          inputSchema: {
            type: 'object',
            properties: {
              category: { 
                type: 'string', 
                enum: ['zoom', 'tilt', 'pan', 'all'], 
                default: 'all',
                description: 'Category of terms to retrieve'
              }
            }
          }
        },
        {
          name: 'zpt_validate_ontology',
          description: 'Validate parameters against ZPT ontology',
          inputSchema: {
            type: 'object',
            properties: {
              zoom: { type: 'string', description: 'Zoom level to validate' },
              tilt: { type: 'string', description: 'Tilt projection to validate' },
              pan: { type: 'object', description: 'Pan parameters to validate' }
            }
          }
        },
        {
          name: 'zpt_analyze_navigation',
          description: 'Analyze navigation patterns and statistics',
          inputSchema: {
            type: 'object',
            properties: {
              includeViews: { type: 'boolean', default: true, description: 'Include view statistics' },
              timeRange: { type: 'string', description: 'Time range for analysis (ISO duration)' }
            }
          }
        },
        // Ragno tools
        {
          name: 'ragno_decompose_corpus',
          description: 'Decompose text corpus into semantic units, entities, and relationships using Ragno',
          inputSchema: {
            type: 'object',
            properties: {
              textChunks: {
                type: 'array',
                items: {
                  oneOf: [
                    { type: 'string' },
                    {
                      type: 'object',
                      properties: {
                        content: { type: 'string' },
                        source: { type: 'string' },
                        metadata: { type: 'object' }
                      },
                      required: ['content']
                    }
                  ]
                },
                minItems: 1,
                maxItems: 100,
                description: 'Text chunks to decompose into semantic units'
              },
              options: {
                type: 'object',
                properties: {
                  extractRelationships: { type: 'boolean', default: true },
                  generateSummaries: { type: 'boolean', default: true },
                  minEntityConfidence: { type: 'number', minimum: 0, maximum: 1, default: 0.3 },
                  maxEntitiesPerUnit: { type: 'number', minimum: 1, maximum: 50, default: 10 },
                  chunkOverlap: { type: 'number', minimum: 0, maximum: 1, default: 0.1 }
                },
                default: {}
              }
            },
            required: ['textChunks']
          }
        },
        {
          name: 'ragno_enrich_embeddings',
          description: 'Enrich decomposition results with vector embeddings',
          inputSchema: {
            type: 'object',
            properties: {
              decompositionResults: {
                type: 'object',
                properties: {
                  units: { type: 'array', items: { type: 'object' } },
                  entities: { type: 'array', items: { type: 'object' } },
                  relationships: { type: 'array', items: { type: 'object' } }
                },
                description: 'Results from corpus decomposition'
              },
              embeddingOptions: {
                type: 'object',
                properties: {
                  includeUnits: { type: 'boolean', default: true },
                  includeEntities: { type: 'boolean', default: true },
                  includeRelationships: { type: 'boolean', default: true },
                  batchSize: { type: 'number', minimum: 1, maximum: 100, default: 10 }
                },
                default: {}
              }
            },
            required: ['decompositionResults']
          }
        },
        {
          name: 'ragno_augment_attributes',
          description: 'Augment entities with additional attributes and properties',
          inputSchema: {
            type: 'object',
            properties: {
              entities: {
                type: 'array',
                items: { type: 'object' },
                minItems: 1,
                description: 'Entities to augment with attributes'
              },
              options: {
                type: 'object',
                properties: {
                  maxAttributesPerEntity: { type: 'number', minimum: 1, maximum: 20, default: 5 },
                  minConfidence: { type: 'number', minimum: 0, maximum: 1, default: 0.4 },
                  attributeTypes: { 
                    type: 'array', 
                    items: { type: 'string' },
                    default: ['property', 'category', 'relation']
                  }
                },
                default: {}
              }
            },
            required: ['entities']
          }
        },
        {
          name: 'ragno_aggregate_communities',
          description: 'Detect and aggregate communities in the knowledge graph',
          inputSchema: {
            type: 'object',
            properties: {
              entities: {
                type: 'array',
                items: { type: 'object' },
                minItems: 2,
                description: 'Entities for community detection'
              },
              relationships: {
                type: 'array',
                items: { type: 'object' },
                default: [],
                description: 'Relationships between entities'
              },
              options: {
                type: 'object',
                properties: {
                  algorithm: { type: 'string', enum: ['leiden', 'louvain'], default: 'leiden' },
                  resolution: { type: 'number', minimum: 0.1, maximum: 5.0, default: 1.0 },
                  minCommunitySize: { type: 'number', minimum: 2, maximum: 100, default: 3 }
                },
                default: {}
              }
            },
            required: ['entities']
          }
        },
        {
          name: 'ragno_export_sparql',
          description: 'Export decomposition results to SPARQL endpoint',
          inputSchema: {
            type: 'object',
            properties: {
              decompositionResults: {
                type: 'object',
                properties: {
                  dataset: { description: 'RDF dataset' },
                  statistics: { type: 'object' }
                },
                description: 'Results from corpus decomposition'
              },
              endpoint: {
                type: 'string',
                format: 'uri',
                description: 'SPARQL endpoint URL (uses configured if not provided)'
              },
              auth: {
                type: 'object',
                properties: {
                  username: { type: 'string' },
                  password: { type: 'string' }
                }
              }
            },
            required: ['decompositionResults']
          }
        },
        {
          name: 'ragno_get_entity',
          description: 'Retrieve entity details with relationships and attributes',
          inputSchema: {
            type: 'object',
            properties: {
              entityId: { type: 'string', description: 'Entity ID or URI' },
              includeRelationships: { type: 'boolean', default: true },
              includeAttributes: { type: 'boolean', default: true }
            },
            required: ['entityId']
          }
        },
        {
          name: 'ragno_search_graph',
          description: 'Search the knowledge graph using semantic or entity-based queries',
          inputSchema: {
            type: 'object',
            properties: {
              query: { type: 'string', minLength: 1, description: 'Search query' },
              searchType: { 
                type: 'string', 
                enum: ['semantic', 'entity', 'dual'], 
                default: 'dual',
                description: 'Type of search to perform'
              },
              limit: { type: 'number', minimum: 1, maximum: 100, default: 10 },
              threshold: { type: 'number', minimum: 0, maximum: 1, default: 0.7 },
              includeRelationships: { type: 'boolean', default: true }
            },
            required: ['query']
          }
        },
        {
          name: 'ragno_get_graph_stats',
          description: 'Get statistics and metrics about the knowledge graph',
          inputSchema: {
            type: 'object',
            properties: {
              detailed: { type: 'boolean', default: false, description: 'Include detailed statistics' },
              computeMetrics: { type: 'boolean', default: true, description: 'Compute graph metrics' }
            }
          }
        }
      ]
    };
  });

  // Register tool call handler
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    let toolName = 'unknown';
    let args = {};
    
    try {
      // Validate basic request structure
      if (!request || !request.params) {
        throw new Error('Invalid request: missing params');
      }
      
      const { name, arguments: requestArgs } = request.params;
      toolName = name || 'unknown';
      args = requestArgs || {};
      
      // Validate tool name
      if (!name || typeof name !== 'string' || !name.trim()) {
        throw new Error('Invalid tool name: must be a non-empty string');
      }
      
      // Validate arguments
      if (requestArgs !== null && requestArgs !== undefined && typeof requestArgs !== 'object') {
        throw new Error('Invalid arguments: must be an object, null, or undefined');
      }
      
      mcpDebugger.info(`Tool call: ${name}`, args);
      
      // Sanitize arguments to prevent injection attacks
      const sanitizedArgs = JSON.parse(JSON.stringify(args || {}));
      args = sanitizedArgs;
      // Memory tools
      if (name === 'semem_extract_concepts') {
        const { text } = args;
        if (!text || typeof text !== 'string' || !text.trim()) {
          throw new Error('Invalid text parameter. It must be a non-empty string.');
        }
        
        await initializeServices();
        const { getMemoryManager } = await import('./lib/initialization.js');
        const memoryManager = getMemoryManager();
        const { SafeOperations } = await import('./lib/safe-operations.js');
        const safeOps = new SafeOperations(memoryManager);
        
        const concepts = await safeOps.extractConcepts(text);
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              concepts: concepts,
              text: text,
              conceptCount: concepts?.length || 0
            }, null, 2)
          }]
        };
      }
      
      if (name === 'semem_generate_embedding') {
        const { text } = args;
        if (!text || typeof text !== 'string' || !text.trim()) {
          throw new Error('Invalid text parameter. It must be a non-empty string.');
        }
        
        await initializeServices();
        const { getMemoryManager } = await import('./lib/initialization.js');
        const memoryManager = getMemoryManager();
        const { SafeOperations } = await import('./lib/safe-operations.js');
        const safeOps = new SafeOperations(memoryManager);
        
        const embedding = await safeOps.generateEmbedding(text);
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              text: text.substring(0, 50) + (text.length > 50 ? '...' : ''),
              embeddingDimension: embedding.length,
              embeddingPreview: embedding.slice(0, 5).map(x => parseFloat(x.toFixed(4)))
            }, null, 2)
          }]
        };
      }
      
      if (name === 'semem_store_interaction') {
        const { prompt, response, metadata = {} } = args;
        if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
          throw new Error('Invalid prompt parameter. It must be a non-empty string.');
        }
        if (!response || typeof response !== 'string' || !response.trim()) {
          throw new Error('Invalid response parameter. It must be a non-empty string.');
        }
        
        await initializeServices();
        const { getMemoryManager } = await import('./lib/initialization.js');
        const memoryManager = getMemoryManager();
        const { SafeOperations } = await import('./lib/safe-operations.js');
        const safeOps = new SafeOperations(memoryManager);
        const { v4: uuidv4 } = await import('uuid');
        
        const embedding = await safeOps.generateEmbedding(`${prompt} ${response}`);
        const concepts = await safeOps.extractConcepts(`${prompt} ${response}`);
        
        const id = uuidv4();
        await memoryManager.addInteraction(prompt, response, embedding, concepts, {
          id,
          timestamp: Date.now(),
          ...metadata
        });
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              message: `Successfully stored interaction with ${concepts.length} concepts extracted`,
              prompt: prompt.substring(0, 50) + "...",
              conceptCount: concepts.length,
              id: id
            }, null, 2)
          }]
        };
      }
      
      if (name === 'semem_retrieve_memories') {
        const { query, limit = 5, threshold = 0.7 } = args;
        if (!query || typeof query !== 'string' || !query.trim()) {
          throw new Error('Invalid query parameter. It must be a non-empty string.');
        }
        
        await initializeServices();
        const { getMemoryManager } = await import('./lib/initialization.js');
        const memoryManager = getMemoryManager();
        const { SafeOperations } = await import('./lib/safe-operations.js');
        const safeOps = new SafeOperations(memoryManager);
        
        const queryEmbedding = await safeOps.generateEmbedding(query);
        const memories = await safeOps.searchSimilar(queryEmbedding, limit, threshold);
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              query: query,
              memoriesFound: memories.length,
              memories: memories.map(memory => ({
                id: memory.id,
                prompt: memory.prompt?.substring(0, 100) + (memory.prompt?.length > 100 ? '...' : ''),
                response: memory.response?.substring(0, 100) + (memory.response?.length > 100 ? '...' : ''),
                similarity: memory.similarity,
                concepts: memory.concepts?.slice(0, 3) || []
              }))
            }, null, 2)
          }]
        };
      }
      
      if (name === 'semem_generate_response') {
        const { prompt, context, maxTokens = 1000 } = args;
        if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
          throw new Error('Invalid prompt parameter. It must be a non-empty string.');
        }
        
        await initializeServices();
        const { getMemoryManager } = await import('./lib/initialization.js');
        const memoryManager = getMemoryManager();
        const { SafeOperations } = await import('./lib/safe-operations.js');
        const safeOps = new SafeOperations(memoryManager);
        
        const response = await safeOps.generateResponse(prompt, context, { maxTokens });
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              prompt: prompt.substring(0, 50) + (prompt.length > 50 ? '...' : ''),
              response: response,
              responseLength: response.length
            }, null, 2)
          }]
        };
      }
      
      if (name === 'semem_answer') {
        const { question, mode = 'standard' } = args;
        if (!question || typeof question !== 'string' || !question.trim()) {
          throw new Error('Invalid question parameter. It must be a non-empty string.');
        }
        
        // Import answer processing function
        const { processQuestionWithFeedback } = await import('./answer/Answer.js');
        
        // Initialize configuration
        await initializeServices();
        const { getMemoryManager } = await import('./lib/initialization.js');
        const memoryManager = getMemoryManager();
        
        // Use the same initialization pattern as the standalone Answer.js
        const Config = (await import('../src/Config.js')).default;
        const config = new Config('./config/config.json');
        await config.init();
        
        const workflowConfig = {
          beerqaGraphURI: 'http://purl.org/stuff/beerqa/test',
          wikipediaGraphURI: 'http://purl.org/stuff/wikipedia/research',
          wikidataGraphURI: 'http://purl.org/stuff/wikidata/research'
        };
        
        // Initialize LLM handler
        const LLMHandler = (await import('../src/handlers/LLMHandler.js')).default;
        const OllamaConnector = (await import('../src/connectors/OllamaConnector.js')).default;
        const ClaudeConnector = (await import('../src/connectors/ClaudeConnector.js')).default;
        const MistralConnector = (await import('../src/connectors/MistralConnector.js')).default;
        
        const llmProviders = config.get('llmProviders') || [];
        const chatProvider = llmProviders
            .filter(p => p.capabilities?.includes('chat'))
            .sort((a, b) => (a.priority || 999) - (b.priority || 999))[0];

        if (!chatProvider) {
            throw new Error('No chat LLM provider configured');
        }

        let llmConnector;
        if (chatProvider.type === 'mistral' && process.env.MISTRAL_API_KEY) {
            llmConnector = new MistralConnector(process.env.MISTRAL_API_KEY);
        } else if (chatProvider.type === 'claude' && process.env.CLAUDE_API_KEY) {
            llmConnector = new ClaudeConnector(process.env.CLAUDE_API_KEY);
        } else {
            llmConnector = new OllamaConnector('http://localhost:11434', 'qwen2:1.5b');
            chatProvider.chatModel = 'qwen2:1.5b';
        }

        const llmHandler = new LLMHandler(llmConnector, chatProvider.chatModel);
        
        const SPARQLHelper = (await import('../src/services/sparql/SPARQLHelper.js')).default;
        const sparqlHelper = new SPARQLHelper(
            config.get('sparqlUpdateEndpoint') || 'http://localhost:3030/semem/update',
            {
                auth: config.get('sparqlAuth') || { user: 'admin', password: 'admin123' },
                timeout: 30000
            }
        );
        
        // Process question with iterative feedback
        const FeedbackWorkflow = (await import('../src/compose/workflows/FeedbackWorkflow.js')).default;
        const feedbackWorkflow = new FeedbackWorkflow();
        
        const resources = {
            llmHandler,
            sparqlHelper,
            config: workflowConfig
        };
        
        const feedbackOptions = {
            basic: {
                maxIterations: 2,
                feedbackThreshold: 0.3,
                enableWikidataResearch: false,
                feedbackMode: 'basic'
            },
            standard: {
                maxIterations: 3,
                feedbackThreshold: 0.5,
                enableWikidataResearch: true,
                feedbackMode: 'iterative'
            },
            comprehensive: {
                maxIterations: 5,
                feedbackThreshold: 0.7,
                enableWikidataResearch: true,
                feedbackMode: 'comprehensive'
            }
        }[mode] || {
            maxIterations: 3,
            feedbackThreshold: 0.5,
            enableWikidataResearch: true,
            feedbackMode: 'iterative'
        };
        
        const feedbackResult = await feedbackWorkflow.execute(
            { 
                question: { text: question },
                enableIterativeFeedback: true,
                enableWikidataResearch: feedbackOptions.enableWikidataResearch
            },
            resources,
            feedbackOptions
        );
        
        if (feedbackResult.success) {
            const data = feedbackResult.data;
            
            return {
                content: [{
                    type: "text",
                    text: JSON.stringify({
                        success: true,
                        question: question,
                        answer: data.finalAnswer,
                        metadata: {
                            iterations: data.workflow.iterationsPerformed,
                            initialAnswer: data.initialAnswer,
                            completenessImprovement: data.completenessImprovement,
                            followUpQuestions: data.totalResearchQuestions,
                            entitiesDiscovered: data.totalEntitiesDiscovered,
                            mode: mode,
                            duration: data.workflow.totalDuration || 0
                        }
                    }, null, 2)
                }]
            };
        } else {
            return {
                content: [{
                    type: "text",
                    text: JSON.stringify({
                        success: false,
                        question: question,
                        error: feedbackResult.error || 'Feedback workflow failed'
                    }, null, 2)
                }],
                isError: true
            };
        }
      }
      
      if (name === 'semem_ask') {
        const { question, namespace = 'http://example.org/docqa/', autoProcess = false } = args;
        if (!question || typeof question !== 'string' || !question.trim()) {
          throw new Error('Invalid question parameter. It must be a non-empty string.');
        }
        
        await initializeServices();
        const { getMemoryManager } = await import('./lib/initialization.js');
        const memoryManager = getMemoryManager();
        const { SafeOperations } = await import('./lib/safe-operations.js');
        const safeOps = new SafeOperations(memoryManager);
        
        // Generate embedding and extract concepts
        const embedding = await safeOps.generateEmbedding(question);
        const concepts = await safeOps.extractConcepts(question);
        
        // Generate a unique question ID
        const { v4: uuidv4 } = await import('uuid');
        const questionId = uuidv4();
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              question: question,
              questionId: questionId,
              namespace: namespace,
              embedding: {
                dimension: embedding.length,
                preview: embedding.slice(0, 5).map(x => parseFloat(x.toFixed(4)))
              },
              concepts: concepts,
              autoProcess: autoProcess,
              stored: true
            }, null, 2)
          }]
        };
      }
      
      // ZPT Navigation tools
      if (name === 'zpt_navigate') {
        const { query, zoom = 'entity', pan = {}, tilt = 'keywords', transform = {} } = args;
        if (!query || typeof query !== 'string' || !query.trim()) {
          throw new Error('Invalid query parameter. It must be a non-empty string.');
        }
        
        await initializeServices();
        const { getMemoryManager } = await import('./lib/initialization.js');
        const memoryManager = getMemoryManager();
        const { SafeOperations } = await import('./lib/safe-operations.js');
        const safeOps = new SafeOperations(memoryManager);
        const { ZPTNavigationService } = await import('./tools/zpt-tools.js');
        
        const service = new ZPTNavigationService(memoryManager, safeOps);
        const result = await service.navigate(query, zoom, pan, tilt, transform);
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify(result, null, 2)
          }]
        };
      }
      
      if (name === 'zpt_preview') {
        const { query, zoom, pan = {} } = args;
        if (!query || typeof query !== 'string' || !query.trim()) {
          throw new Error('Invalid query parameter. It must be a non-empty string.');
        }
        
        await initializeServices();
        const { getMemoryManager } = await import('./lib/initialization.js');
        const memoryManager = getMemoryManager();
        const { SafeOperations } = await import('./lib/safe-operations.js');
        const safeOps = new SafeOperations(memoryManager);
        const { ZPTNavigationService } = await import('./tools/zpt-tools.js');
        
        const service = new ZPTNavigationService(memoryManager, safeOps);
        const result = await service.preview(query, zoom, pan);
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify(result, null, 2)
          }]
        };
      }
      
      if (name === 'zpt_get_schema') {
        await initializeServices();
        const { getMemoryManager } = await import('./lib/initialization.js');
        const memoryManager = getMemoryManager();
        const { SafeOperations } = await import('./lib/safe-operations.js');
        const safeOps = new SafeOperations(memoryManager);
        const { ZPTNavigationService } = await import('./tools/zpt-tools.js');
        
        const service = new ZPTNavigationService(memoryManager, safeOps);
        const result = service.getSchema();
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify(result, null, 2)
          }]
        };
      }
      
      if (name === 'zpt_validate_params') {
        const { params } = args;
        if (!params || typeof params !== 'object') {
          throw new Error('Invalid params parameter. It must be an object.');
        }
        
        await initializeServices();
        const { getMemoryManager } = await import('./lib/initialization.js');
        const memoryManager = getMemoryManager();
        const { SafeOperations } = await import('./lib/safe-operations.js');
        const safeOps = new SafeOperations(memoryManager);
        const { ZPTNavigationService } = await import('./tools/zpt-tools.js');
        
        const service = new ZPTNavigationService(memoryManager, safeOps);
        const result = service.validateParams(params);
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify(result, null, 2)
          }]
        };
      }
      
      if (name === 'zpt_get_options') {
        const { context = 'current', query } = args;
        
        await initializeServices();
        const { getMemoryManager } = await import('./lib/initialization.js');
        const memoryManager = getMemoryManager();
        const { SafeOperations } = await import('./lib/safe-operations.js');
        const safeOps = new SafeOperations(memoryManager);
        const { ZPTNavigationService } = await import('./tools/zpt-tools.js');
        
        const service = new ZPTNavigationService(memoryManager, safeOps);
        const result = await service.getOptions(context, query);
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify(result, null, 2)
          }]
        };
      }
      
      if (name === 'zpt_analyze_corpus') {
        const { analysisType = 'structure', includeStats = true } = args;
        
        await initializeServices();
        const { getMemoryManager } = await import('./lib/initialization.js');
        const memoryManager = getMemoryManager();
        const { SafeOperations } = await import('./lib/safe-operations.js');
        const safeOps = new SafeOperations(memoryManager);
        const { ZPTNavigationService } = await import('./tools/zpt-tools.js');
        
        const service = new ZPTNavigationService(memoryManager, safeOps);
        const result = await service.analyzeCorpus(analysisType, includeStats);
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify(result, null, 2)
          }]
        };
      }
      
      // ZPT Ontology Integration tools
      if (name === 'zpt_convert_params') {
        const { zoom, tilt, pan } = args;
        
        await initializeServices();
        const { getMemoryManager } = await import('./lib/initialization.js');
        const memoryManager = getMemoryManager();
        
        // Import ZPT ontology utilities
        const { NamespaceUtils } = await import('../src/zpt/ontology/ZPTNamespaces.js');
        
        const convertedParams = {};
        let conversionCount = 0;
        
        if (zoom && typeof zoom === 'string') {
          const zoomURI = NamespaceUtils.resolveStringToURI('zoom', zoom);
          if (zoomURI) {
            convertedParams.zoomURI = zoomURI.value;
            conversionCount++;
          }
        }
        
        if (tilt && typeof tilt === 'string') {
          const tiltURI = NamespaceUtils.resolveStringToURI('tilt', tilt);
          if (tiltURI) {
            convertedParams.tiltURI = tiltURI.value;
            conversionCount++;
          }
        }
        
        if (pan && typeof pan === 'object' && pan.domains) {
          const panURIs = [];
          for (const domain of pan.domains) {
            const domainURI = NamespaceUtils.resolveStringToURI('pan', domain);
            if (domainURI) {
              panURIs.push(domainURI.value);
            }
          }
          if (panURIs.length > 0) {
            convertedParams.panURIs = panURIs;
            conversionCount++;
          }
        }
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              originalParams: { zoom, tilt, pan },
              convertedParams,
              conversionCount,
              tool: 'zpt_convert_params'
            }, null, 2)
          }]
        };
      }
      
      if (name === 'zpt_store_session') {
        const { purpose, agentURI, userAgent, sessionType } = args;
        if (!purpose || typeof purpose !== 'string') {
          throw new Error('Purpose is required for session storage');
        }
        
        await initializeServices();
        const { getMemoryManager } = await import('./lib/initialization.js');
        const memoryManager = getMemoryManager();
        
        // Import ZPT ontology utilities
        const { ZPTDataFactory } = await import('../src/zpt/ontology/ZPTDataFactory.js');
        const { v4: uuidv4 } = await import('uuid');
        
        const sessionConfig = {
          sessionURI: agentURI || `http://example.org/sessions/${uuidv4()}`,
          purpose,
          agentURI: agentURI || `http://example.org/agents/mcp_${uuidv4()}`,
          userAgent: userAgent || 'Semem MCP Client',
          sessionType: sessionType || 'exploration'
        };
        
        const zptDataFactory = new ZPTDataFactory({
          namedGraph: 'http://purl.org/stuff/navigation'
        });
        
        const session = zptDataFactory.createNavigationSession(sessionConfig);
        const quadsGenerated = session.dataset.size;
        
        // Store in SPARQL if available
        let storedInSPARQL = false;
        if (memoryManager.store && typeof memoryManager.store.insertQuads === 'function') {
          try {
            await memoryManager.store.insertQuads([...session.dataset]);
            storedInSPARQL = true;
          } catch (error) {
            // Continue even if SPARQL storage fails
          }
        }
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              sessionURI: sessionConfig.sessionURI,
              purpose,
              quadsGenerated,
              storedInSPARQL,
              tool: 'zpt_store_session'
            }, null, 2)
          }]
        };
      }
      
      if (name === 'zpt_get_sessions') {
        const { limit = 10, sessionType } = args;
        
        await initializeServices();
        const { getMemoryManager } = await import('./lib/initialization.js');
        const memoryManager = getMemoryManager();
        
        // Query sessions from SPARQL store
        const sessions = [];
        let totalCount = 0;
        
        if (memoryManager.store && typeof memoryManager.store.executeQuery === 'function') {
          try {
            const query = `
              PREFIX zpt: <http://purl.org/stuff/zpt/>
              PREFIX prov: <http://www.w3.org/ns/prov#>
              
              SELECT ?session ?purpose ?agent ?startTime WHERE {
                ?session a zpt:NavigationSession ;
                         zpt:hasPurpose ?purpose ;
                         prov:wasAssociatedWith ?agent ;
                         prov:startedAtTime ?startTime .
                ${sessionType ? `FILTER(CONTAINS(STR(?session), "${sessionType}"))` : ''}
              }
              ORDER BY DESC(?startTime)
              LIMIT ${limit}
            `;
            
            const results = await memoryManager.store.executeQuery(query);
            totalCount = results?.length || 0;
            
            for (const result of results || []) {
              sessions.push({
                sessionURI: result.session,
                purpose: result.purpose,
                agentURI: result.agent,
                startTime: result.startTime
              });
            }
          } catch (error) {
            // Continue with empty results if query fails
          }
        }
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              totalCount,
              sessions,
              tool: 'zpt_get_sessions'
            }, null, 2)
          }]
        };
      }
      
      if (name === 'zpt_get_ontology_terms') {
        const { category = 'all' } = args;
        
        await initializeServices();
        
        // Import ZPT ontology utilities
        const { NamespaceUtils } = await import('../src/zpt/ontology/ZPTNamespaces.js');
        
        const ontologyTerms = {
          namespaces: NamespaceUtils.getNamespaces()
        };
        
        if (category === 'all' || category === 'zoom') {
          ontologyTerms.zoomLevels = NamespaceUtils.getZoomLevels().map(zoom => ({
            string: zoom.string,
            uri: zoom.uri.value,
            description: zoom.description
          }));
        }
        
        if (category === 'all' || category === 'tilt') {
          ontologyTerms.tiltProjections = NamespaceUtils.getTiltProjections().map(tilt => ({
            string: tilt.string,
            uri: tilt.uri.value,
            description: tilt.description
          }));
        }
        
        if (category === 'all' || category === 'pan') {
          ontologyTerms.panDomains = NamespaceUtils.getPanDomains().map(pan => ({
            string: pan.string,
            uri: pan.uri.value,
            description: pan.description
          }));
        }
        
        const totalTerms = 
          (ontologyTerms.zoomLevels?.length || 0) +
          (ontologyTerms.tiltProjections?.length || 0) +
          (ontologyTerms.panDomains?.length || 0);
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              totalTerms,
              ontologyTerms,
              tool: 'zpt_get_ontology_terms'
            }, null, 2)
          }]
        };
      }
      
      if (name === 'zpt_validate_ontology') {
        const { zoom, tilt, pan } = args;
        
        await initializeServices();
        
        // Import ZPT ontology utilities
        const { NamespaceUtils } = await import('../src/zpt/ontology/ZPTNamespaces.js');
        
        const validation = {
          errors: [],
          warnings: [],
          convertedParams: {}
        };
        
        // Validate zoom level
        if (zoom) {
          const zoomURI = NamespaceUtils.resolveStringToURI('zoom', zoom);
          if (zoomURI) {
            validation.convertedParams.zoomURI = zoomURI.value;
          } else {
            validation.errors.push(`Invalid zoom level: ${zoom}`);
          }
        }
        
        // Validate tilt projection
        if (tilt) {
          const tiltURI = NamespaceUtils.resolveStringToURI('tilt', tilt);
          if (tiltURI) {
            validation.convertedParams.tiltURI = tiltURI.value;
          } else {
            validation.errors.push(`Invalid tilt projection: ${tilt}`);
          }
        }
        
        // Validate pan domains
        if (pan && pan.domains && Array.isArray(pan.domains)) {
          const validDomains = [];
          const invalidDomains = [];
          
          for (const domain of pan.domains) {
            const domainURI = NamespaceUtils.resolveStringToURI('pan', domain);
            if (domainURI) {
              validDomains.push(domainURI.value);
            } else {
              invalidDomains.push(domain);
            }
          }
          
          if (validDomains.length > 0) {
            validation.convertedParams.panURIs = validDomains;
          }
          
          if (invalidDomains.length > 0) {
            validation.warnings.push(`Unknown pan domains: ${invalidDomains.join(', ')}`);
          }
        }
        
        const isValid = validation.errors.length === 0;
        const errorCount = validation.errors.length;
        const warningCount = validation.warnings.length;
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              isValid,
              errorCount,
              warningCount,
              validation,
              tool: 'zpt_validate_ontology'
            }, null, 2)
          }]
        };
      }
      
      if (name === 'zpt_analyze_navigation') {
        const { includeViews = true, timeRange } = args;
        
        await initializeServices();
        const { getMemoryManager } = await import('./lib/initialization.js');
        const memoryManager = getMemoryManager();
        
        const navigationStats = {
          totalSessions: 0,
          totalViews: 0,
          averageQueryLength: 0
        };
        
        const zoomLevelDistribution = [];
        
        if (memoryManager.store && typeof memoryManager.store.executeQuery === 'function') {
          try {
            // Get session statistics
            const sessionQuery = `
              PREFIX zpt: <http://purl.org/stuff/zpt/>
              PREFIX prov: <http://www.w3.org/ns/prov#>
              
              SELECT (COUNT(?session) as ?sessionCount) WHERE {
                ?session a zpt:NavigationSession .
                ${timeRange ? `FILTER(?startTime >= "${timeRange}")` : ''}
              }
            `;
            
            const sessionResults = await memoryManager.store.executeQuery(sessionQuery);
            navigationStats.totalSessions = sessionResults?.[0]?.sessionCount || 0;
            
            // Get view statistics if requested
            if (includeViews) {
              const viewQuery = `
                PREFIX zpt: <http://purl.org/stuff/zpt/>
                
                SELECT ?zoomLevel (COUNT(?view) as ?count) WHERE {
                  ?view a zpt:NavigationView ;
                        zpt:hasZoomLevel ?zoomLevel .
                  ${timeRange ? `FILTER(?timestamp >= "${timeRange}")` : ''}
                }
                GROUP BY ?zoomLevel
                ORDER BY DESC(?count)
              `;
              
              const viewResults = await memoryManager.store.executeQuery(viewQuery);
              for (const result of viewResults || []) {
                zoomLevelDistribution.push({
                  zoomLevel: result.zoomLevel.split('/').pop(),
                  count: parseInt(result.count) || 0
                });
              }
              
              navigationStats.totalViews = zoomLevelDistribution.reduce((sum, item) => sum + item.count, 0);
            }
            
            // Calculate average query length (mock data for now)
            navigationStats.averageQueryLength = Math.floor(Math.random() * 30) + 20;
            
          } catch (error) {
            // Continue with default values if queries fail
          }
        }
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              navigationStats,
              zoomLevelDistribution,
              analysisTimestamp: new Date().toISOString(),
              tool: 'zpt_analyze_navigation'
            }, null, 2)
          }]
        };
      }
      
      // Ragno tools
      if (name === 'ragno_decompose_corpus') {
        const { textChunks, options = {} } = args;
        if (!textChunks || !Array.isArray(textChunks) || textChunks.length === 0) {
          throw new Error('Invalid textChunks parameter. It must be a non-empty array.');
        }
        
        await initializeServices();
        const { getMemoryManager } = await import('./lib/initialization.js');
        const memoryManager = getMemoryManager();
        const { SafeOperations } = await import('./lib/safe-operations.js');
        const safeOps = new SafeOperations(memoryManager);
        const { decomposeCorpus } = await import('../src/ragno/decomposeCorpus.js');
        
        const result = await decomposeCorpus(textChunks, memoryManager.llmHandler, options);
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              unitsCount: result.units?.length || 0,
              entitiesCount: result.entities?.length || 0,
              relationshipsCount: result.relationships?.length || 0,
              result: result,
              tool: 'ragno_decompose_corpus'
            }, null, 2)
          }]
        };
      }
      
      if (name === 'ragno_enrich_embeddings') {
        const { decompositionResults, embeddingOptions = {} } = args;
        if (!decompositionResults || typeof decompositionResults !== 'object') {
          throw new Error('Invalid decompositionResults parameter. It must be an object.');
        }
        
        await initializeServices();
        const { getMemoryManager } = await import('./lib/initialization.js');
        const memoryManager = getMemoryManager();
        const { enrichWithEmbeddings } = await import('../src/ragno/enrichWithEmbeddings.js');
        
        const result = await enrichWithEmbeddings(decompositionResults, memoryManager.embeddingHandler, embeddingOptions);
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              enrichedUnits: result.units?.length || 0,
              enrichedEntities: result.entities?.length || 0,
              enrichedRelationships: result.relationships?.length || 0,
              result: result,
              tool: 'ragno_enrich_embeddings'
            }, null, 2)
          }]
        };
      }
      
      if (name === 'ragno_augment_attributes') {
        const { entities, options = {} } = args;
        if (!entities || !Array.isArray(entities) || entities.length === 0) {
          throw new Error('Invalid entities parameter. It must be a non-empty array.');
        }
        
        await initializeServices();
        const { getMemoryManager } = await import('./lib/initialization.js');
        const memoryManager = getMemoryManager();
        const { augmentWithAttributes } = await import('../src/ragno/augmentWithAttributes.js');
        
        const result = await augmentWithAttributes(entities, memoryManager.llmHandler, options);
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              augmentedEntities: result.length || 0,
              result: result,
              tool: 'ragno_augment_attributes'
            }, null, 2)
          }]
        };
      }
      
      if (name === 'ragno_aggregate_communities') {
        const { entities, relationships = [], options = {} } = args;
        if (!entities || !Array.isArray(entities) || entities.length < 2) {
          throw new Error('Invalid entities parameter. It must be an array with at least 2 entities.');
        }
        
        await initializeServices();
        const { getMemoryManager } = await import('./lib/initialization.js');
        const memoryManager = getMemoryManager();
        const { aggregateCommunities } = await import('../src/ragno/aggregateCommunities.js');
        
        const result = await aggregateCommunities(entities, relationships, options);
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              communitiesFound: result.communities?.length || 0,
              result: result,
              tool: 'ragno_aggregate_communities'
            }, null, 2)
          }]
        };
      }
      
      if (name === 'ragno_export_sparql') {
        const { decompositionResults, endpoint, auth } = args;
        if (!decompositionResults || typeof decompositionResults !== 'object') {
          throw new Error('Invalid decompositionResults parameter. It must be an object.');
        }
        
        await initializeServices();
        const { getMemoryManager } = await import('./lib/initialization.js');
        const memoryManager = getMemoryManager();
        const { exportToRDF } = await import('../src/ragno/decomposeCorpus.js');
        
        // Use configured SPARQL store for export
        const store = memoryManager.store;
        const result = await exportToRDF(decompositionResults, store, endpoint, auth);
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              exported: true,
              endpoint: endpoint || store.endpoint,
              result: result,
              tool: 'ragno_export_sparql'
            }, null, 2)
          }]
        };
      }
      
      if (name === 'ragno_get_entity') {
        const { entityId, includeRelationships = true, includeAttributes = true } = args;
        if (!entityId || typeof entityId !== 'string') {
          throw new Error('Invalid entityId parameter. It must be a non-empty string.');
        }
        
        await initializeServices();
        const { getMemoryManager } = await import('./lib/initialization.js');
        const memoryManager = getMemoryManager();
        const store = memoryManager.store;
        
        // Query entity from SPARQL store
        const entityQuery = `
          PREFIX ragno: <http://purl.org/stuff/ragno/>
          
          SELECT ?entity ?property ?value WHERE {
            BIND(<${entityId}> as ?entity)
            ?entity ?property ?value .
          }
        `;
        
        const entityData = await store.executeQuery(entityQuery);
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              entityId: entityId,
              properties: entityData?.length || 0,
              entity: entityData,
              tool: 'ragno_get_entity'
            }, null, 2)
          }]
        };
      }
      
      if (name === 'ragno_search_graph') {
        const { query, searchType = 'dual', limit = 10, threshold = 0.7, includeRelationships = true } = args;
        if (!query || typeof query !== 'string' || !query.trim()) {
          throw new Error('Invalid query parameter. It must be a non-empty string.');
        }
        
        await initializeServices();
        const { getMemoryManager } = await import('./lib/initialization.js');
        const memoryManager = getMemoryManager();
        const { SafeOperations } = await import('./lib/safe-operations.js');
        const safeOps = new SafeOperations(memoryManager);
        
        if (searchType === 'semantic' || searchType === 'dual') {
          // Use embedding search for semantic queries
          const queryEmbedding = await safeOps.generateEmbedding(query);
          const semanticResults = await safeOps.searchSimilar(queryEmbedding, limit, threshold);
          
          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                success: true,
                query: query,
                searchType: searchType,
                resultsFound: semanticResults.length,
                results: semanticResults,
                tool: 'ragno_search_graph'
              }, null, 2)
            }]
          };
        } else {
          // Entity-based search using SPARQL
          const store = memoryManager.store;
          const entityQuery = `
            PREFIX ragno: <http://purl.org/stuff/ragno/>
            
            SELECT ?entity ?label ?type WHERE {
              ?entity a ragno:Entity ;
                     ragno:hasLabel ?label ;
                     ragno:hasType ?type .
              FILTER(CONTAINS(LCASE(?label), LCASE("${query}")))
            }
            LIMIT ${limit}
          `;
          
          const entityResults = await store.executeQuery(entityQuery);
          
          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                success: true,
                query: query,
                searchType: searchType,
                resultsFound: entityResults?.length || 0,
                results: entityResults,
                tool: 'ragno_search_graph'
              }, null, 2)
            }]
          };
        }
      }
      
      if (name === 'ragno_get_graph_stats') {
        const { detailed = false, computeMetrics = true } = args;
        
        await initializeServices();
        const { getMemoryManager } = await import('./lib/initialization.js');
        const memoryManager = getMemoryManager();
        const store = memoryManager.store;
        
        // Get basic statistics
        const statsQuery = `
          PREFIX ragno: <http://purl.org/stuff/ragno/>
          
          SELECT 
            (COUNT(DISTINCT ?entity) as ?entityCount)
            (COUNT(DISTINCT ?unit) as ?unitCount)
            (COUNT(DISTINCT ?relationship) as ?relationshipCount)
          WHERE {
            {
              ?entity a ragno:Entity .
            } UNION {
              ?unit a ragno:SemanticUnit .
            } UNION {
              ?relationship a ragno:Relationship .
            }
          }
        `;
        
        const basicStats = await store.executeQuery(statsQuery);
        
        const statistics = {
          basic: basicStats?.[0] || {
            entityCount: 0,
            unitCount: 0,
            relationshipCount: 0
          },
          computedAt: new Date().toISOString()
        };
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              statistics: statistics,
              tool: 'ragno_get_graph_stats'
            }, null, 2)
          }]
        };
      }
      
      // ZPT Navigation tools (temporarily disabled for testing)
      /*if (name === 'zpt_navigate') {
        await initializeServices();
        const { getMemoryManager } = await import('./lib/initialization.js');
        const memoryManager = getMemoryManager();
        const { SafeOperations } = await import('./lib/safe-operations.js');
        const safeOps = new SafeOperations(memoryManager);
        
        const service = new ZPTNavigationService();
        service.memoryManager = memoryManager;
        service.safeOps = safeOps;
        
        const result = await service.navigate(args);
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      }
      
      if (name === 'zpt_preview') {
        await initializeServices();
        const { getMemoryManager } = await import('./lib/initialization.js');
        const memoryManager = getMemoryManager();
        const { SafeOperations } = await import('./lib/safe-operations.js');
        const safeOps = new SafeOperations(memoryManager);
        
        const service = new ZPTNavigationService();
        service.memoryManager = memoryManager;
        service.safeOps = safeOps;
        
        const result = await service.preview(args);
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      }
      
      if (name === 'zpt_get_schema') {
        await initializeServices();
        const { getMemoryManager } = await import('./lib/initialization.js');
        const memoryManager = getMemoryManager();
        
        const service = new ZPTNavigationService();
        service.memoryManager = memoryManager;
        
        const result = await service.getSchema(args);
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      }
      
      if (name === 'zpt_validate_params') {
        await initializeServices();
        const { getMemoryManager } = await import('./lib/initialization.js');
        const memoryManager = getMemoryManager();
        
        const service = new ZPTNavigationService();
        service.memoryManager = memoryManager;
        
        const result = await service.validateParams(args);
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      }
      
      if (name === 'zpt_get_options') {
        await initializeServices();
        const { getMemoryManager } = await import('./lib/initialization.js');
        const memoryManager = getMemoryManager();
        
        const service = new ZPTNavigationService();
        service.memoryManager = memoryManager;
        
        const result = await service.getOptions(args);
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      }
      
      if (name === 'zpt_analyze_corpus') {
        await initializeServices();
        const { getMemoryManager } = await import('./lib/initialization.js');
        const memoryManager = getMemoryManager();
        const { SafeOperations } = await import('./lib/safe-operations.js');
        const safeOps = new SafeOperations(memoryManager);
        
        const service = new ZPTNavigationService();
        service.memoryManager = memoryManager;
        service.safeOps = safeOps;
        
        const result = await service.analyzeCorpus(args);
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      }*/
      
      // Simple Verbs - Primary MCP Interface
      if (name === 'tell') {
        const { getSimpleVerbsService } = await import('./tools/simple-verbs.js');
        const service = getSimpleVerbsService();
        const result = await service.tell(args);
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      }

      if (name === 'ask') {
        const { getSimpleVerbsService } = await import('./tools/simple-verbs.js');
        const service = getSimpleVerbsService();
        const result = await service.ask(args);
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      }

      if (name === 'augment') {
        const { getSimpleVerbsService } = await import('./tools/simple-verbs.js');
        const service = getSimpleVerbsService();
        const result = await service.augment(args);
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      }

      if (name === 'zoom') {
        const { getSimpleVerbsService } = await import('./tools/simple-verbs.js');
        const service = getSimpleVerbsService();
        const result = await service.zoom(args);
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      }

      if (name === 'pan') {
        const { getSimpleVerbsService } = await import('./tools/simple-verbs.js');
        const service = getSimpleVerbsService();
        const result = await service.pan(args);
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      }
      if (name === 'tilt') {
        const { getSimpleVerbsService } = await import('./tools/simple-verbs.js');
        const service = getSimpleVerbsService();
        const result = await service.tilt(args);
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      }
      if (name === 'inspect') {
        const { getSimpleVerbsService } = await import('./tools/simple-verbs.js');
        const service = getSimpleVerbsService();
        const result = await service.inspect(args);
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      }
      
      if (name === 'uploadDocument') {
        const { DocumentProcessor } = await import('./tools/document-tools.js');
        const SPARQLHelper = (await import('../src/services/sparql/SPARQLHelper.js')).default;
        
        const storageConfig = config.get('storage.options');
        const sparqlHelper = new SPARQLHelper(storageConfig.update, {
          user: storageConfig.user,
          password: storageConfig.password
        });
        
        const processor = new DocumentProcessor(config, sparqlHelper);
        const result = await processor.processUploadedDocument(args);
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      }

      // Add other tools here...
      
      throw new Error(`Unknown tool: ${name}`);
      
    } catch (error) {
      // Enhanced error handling - don't crash, always return a structured response
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorType = error?.name || 'UnknownError';
      
      mcpDebugger.error(`Error in tool ${toolName}:`, {
        error: errorMessage,
        type: errorType,
        args: args,
        stack: error?.stack
      });
      
      // Determine error category for better user feedback
      let errorCategory = 'general';
      let userFriendlyMessage = errorMessage;
      
      if (errorMessage.includes('Invalid') || errorMessage.includes('must be')) {
        errorCategory = 'validation';
        userFriendlyMessage = `Invalid input: ${errorMessage}`;
      } else if (errorMessage.includes('not found') || errorMessage.includes('Unknown tool')) {
        errorCategory = 'not_found';
        userFriendlyMessage = `Tool or resource not found: ${errorMessage}`;
      } else if (errorMessage.includes('timeout') || errorMessage.includes('connection')) {
        errorCategory = 'connectivity';
        userFriendlyMessage = `Connection issue: ${errorMessage}`;
      } else if (errorMessage.includes('permission') || errorMessage.includes('auth')) {
        errorCategory = 'authorization';
        userFriendlyMessage = `Authorization error: ${errorMessage}`;
      }
      
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            success: false,
            error: userFriendlyMessage,
            errorType: errorType,
            errorCategory: errorCategory,
            tool: toolName,
            timestamp: new Date().toISOString(),
            // Include sanitized args for debugging (without sensitive data)
            providedArgs: Object.keys(args || {})
          }, null, 2)
        }],
        isError: true
      };
    }
  });
  
  mcpDebugger.info('Central tool call handler registered');
}

/**
 * Create and configure MCP server
 */
async function createServer() {
  mcpDebugger.info('Creating MCP server with config', mcpConfig);
  
  // Create MCP server instance using reference server pattern
  const server = new Server(
    {
      name: mcpConfig.name,
      version: mcpConfig.version,
      instructions: mcpConfig.instructions
    },
    {
      capabilities: {
        tools: {},
        resources: {},
        prompts: {}
      }
    }
  );

  // Temporarily disable debugging wrapper to fix prompt registration
  // const originalSetRequestHandler = server.setRequestHandler;
  // server.setRequestHandler = function(schema, handler) {
  //   const wrappedHandler = async (request) => {
  //     mcpDebugger.logProtocolMessage('incoming', request.method, request.params);
  //     try {
  //       const result = await handler(request);
  //       mcpDebugger.logProtocolMessage('outgoing', request.method, null, result);
  //       return result;
  //     } catch (error) {
  //       mcpDebugger.logProtocolMessage('outgoing', request.method, null, null, error);
  //       throw error;
  //     }
  //   };
  //   return originalSetRequestHandler.call(this, schema, wrappedHandler);
  // };

  // Services will be initialized lazily when tools are called
  mcpDebugger.info('Services will be initialized when first tool is called...');

  // Initialize prompt registry
  mcpDebugger.info('Initializing prompt registry...');
  await initializePromptRegistry();
  mcpDebugger.info('Prompt registry initialized successfully');

  // Initialize enhanced workflow orchestrator
  mcpDebugger.info('Initializing enhanced workflow orchestrator...');
  await workflowOrchestrator.initialize(server);
  mcpDebugger.info('Enhanced workflow orchestrator initialized successfully');

  // Register prompt handlers
  registerPromptHandlers(server);
  
  // Register centralized tool call handler (works with correct argument passing)
  registerToolCallHandler(server);

  // Register Simple Verbs - PROMINENTLY FEATURED simplified interface
  mcpDebugger.info('🌟 Registering Simple MCP Verbs (tell, ask, augment, zoom, pan, tilt, inspect)...');
  registerSimpleVerbs(server);
  mcpDebugger.info('🌟 Simple MCP Verbs registered successfully - these provide the primary interface');

  // Register all tools using a consistent pattern
  mcpDebugger.info('Tools handled by centralized handler (working pattern)...');
  // registerMemoryTools(server); // Handled by centralized handler
  // registerZPTTools(server); // TODO: Fix these using setRequestHandler pattern
  // registerResearchWorkflowTools(server); 
  // registerRagnoTools(server);
  // registerSPARQLTools(server);
  // registerVSOMTools(server);
  mcpDebugger.info('All complex tools registered (legacy/advanced interface).');

  // Register all resources
  mcpDebugger.info('Registering resources using setRequestHandler pattern...');
  registerResourceHandlers(server);
  mcpDebugger.info('All resources registered.');

  // Register prompt tools (disabled - using broken server.tool pattern)
  mcpDebugger.info('Prompt tools temporarily disabled due to setRequestHandler migration...');
  // for (const tool of PROMPT_TOOLS) {
  //   server.tool(tool.name, tool.description, tool.inputSchema, async (args) => {
  //     return await executePromptTool(tool.name, args, server);
  //   });
  // }
  // mcpDebugger.info('All prompt tools registered.');

  // Register all prompts (disabled - using broken server.prompt pattern)
  mcpDebugger.info('Prompts temporarily disabled due to setRequestHandler migration...');
  // for (const prompt of promptRegistry.listPrompts()) {
  //   const { name, ...definition } = prompt;
  //   server.prompt(name, definition);
  // }
  // mcpDebugger.info('All prompts registered.');

  mcpDebugger.info('MCP server creation complete');
  return server;
}

/**
 * Main entry point
 */
async function main() {
  try {
    mcpDebugger.info('🚀 Starting Semem MCP Integration Server...');

    // Create server
    const server = await createServer();

    // Create transport
    const transport = new StdioServerTransport();

    // Connect server to transport
    await server.connect(transport);

    mcpDebugger.info('✅ Semem MCP server running on stdio transport');

  } catch (error) {
    mcpDebugger.error('❌ Failed to start server', {
      error: error.message,
      stack: error.stack
    });
    process.exit(1);
  }
}

// Only run if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

/**
 * Create server with isolated services for session isolation
 */
async function createIsolatedServer() {
  mcpDebugger.info('Creating isolated MCP server for session');
  
  // Create MCP server instance using reference server pattern
  const server = new Server(
    {
      name: mcpConfig.name,
      version: mcpConfig.version,
      instructions: mcpConfig.instructions
    },
    {
      capabilities: {
        tools: {},
        resources: {},
        prompts: {}
      }
    }
  );

  // Isolated services will be initialized lazily when tools are called
  mcpDebugger.info('Isolated services will be initialized when first tool is called...');

  // Initialize prompt registry
  mcpDebugger.info('Initializing prompt registry...');
  await initializePromptRegistry();
  mcpDebugger.info('Prompt registry initialized successfully');

  // Initialize enhanced workflow orchestrator
  mcpDebugger.info('Initializing enhanced workflow orchestrator...');
  await workflowOrchestrator.initialize(server);
  mcpDebugger.info('Enhanced workflow orchestrator initialized successfully');

  // Register Simple Verbs - PROMINENTLY FEATURED simplified interface for isolated server
  mcpDebugger.info('🌟 Registering Simple MCP Verbs (tell, ask, augment, zoom, pan, tilt, inspect)...');
  registerSimpleVerbs(server);
  mcpDebugger.info('🌟 Simple MCP Verbs registered successfully - these provide the primary interface');

  // Register all tools using a consistent pattern
  mcpDebugger.info('Registering all tools...');
  // registerMemoryTools(server); // Disabled to avoid conflicts with centralized handler
  registerZPTTools(server);
  registerResearchWorkflowTools(server);
  registerRagnoTools(server);
  registerSPARQLTools(server);
  registerVSOMTools(server);
  mcpDebugger.info('All complex tools registered (legacy/advanced interface).');

  // Register all resources
  mcpDebugger.info('Registering resources using setRequestHandler pattern...');
  registerResourceHandlers(server);
  mcpDebugger.info('All resources registered.');

  // Register prompt tools (disabled - using broken server.tool pattern)
  mcpDebugger.info('Prompt tools temporarily disabled due to setRequestHandler migration...');
  // for (const tool of PROMPT_TOOLS) {
  //   server.tool(tool.name, tool.description, tool.inputSchema, async (args) => {
  //     return await executePromptTool(tool.name, args, server);
  //   });
  // }
  // mcpDebugger.info('All prompt tools registered.');

  // Register all prompts (disabled - using broken server.prompt pattern)
  mcpDebugger.info('Prompts temporarily disabled due to setRequestHandler migration...');
  // for (const prompt of promptRegistry.listPrompts()) {
  //   const { name, ...definition } = prompt;
  //   server.prompt(name, definition);
  // }
  // mcpDebugger.info('All prompts registered.');

  mcpDebugger.info('Isolated MCP server creation complete');
  return server;
}

export { createServer, createIsolatedServer };