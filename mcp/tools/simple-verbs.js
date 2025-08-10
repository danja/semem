/**
 * Simple MCP Verbs Interface
 * Implements the 5 basic verbs (tell, ask, augment, zoom, pan, tilt) that simplify
 * the complex MCP tooling into an intuitive interface with persistent ZPT state.
 */

import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { mcpDebugger } from '../lib/debug-utils.js';
import { initializeServices, getMemoryManager } from '../lib/initialization.js';
import { SafeOperations } from '../lib/safe-operations.js';

// Import existing complex tools to wrap
import { ZPTNavigationService } from './zpt-tools.js';

// Simple Verb Tool Names
export const SimpleVerbToolNames = {
  TELL: 'tell',
  ASK: 'ask',
  AUGMENT: 'augment', 
  ZOOM: 'zoom',
  PAN: 'pan',
  TILT: 'tilt'
};

// Input Schemas for Simple Verbs
const TellSchema = z.object({
  content: z.string().min(1, "Content cannot be empty"),
  type: z.enum(['interaction', 'document', 'concept']).optional().default('interaction'),
  metadata: z.object({}).optional().default({})
});

const AskSchema = z.object({
  question: z.string().min(1, "Question cannot be empty"),
  mode: z.enum(['basic', 'standard', 'comprehensive']).optional().default('standard'),
  useContext: z.boolean().optional().default(true)
});

const AugmentSchema = z.object({
  target: z.string().min(1, "Target content/context cannot be empty"),
  operation: z.enum(['concepts', 'attributes', 'relationships', 'auto']).optional().default('auto'),
  options: z.object({}).optional().default({})
});

const ZoomSchema = z.object({
  level: z.enum(['entity', 'unit', 'text', 'community', 'corpus', 'micro']).optional().default('entity'),
  query: z.string().optional()
});

const PanSchema = z.object({
  domain: z.string().optional(),
  domains: z.array(z.string()).optional(),
  temporal: z.object({
    start: z.string().optional(),
    end: z.string().optional()
  }).optional(),
  keywords: z.array(z.string()).optional(),
  entities: z.array(z.string()).optional()
});

const TiltSchema = z.object({
  style: z.enum(['keywords', 'embedding', 'graph', 'temporal']).optional().default('keywords'),
  query: z.string().optional()
});

/**
 * ZPT State Manager - Handles persistent zoom, pan, tilt context
 */
class ZPTStateManager {
  constructor(memoryManager) {
    this.memoryManager = memoryManager;
    this.state = {
      zoom: 'entity',
      pan: {},
      tilt: 'keywords',
      lastQuery: '',
      sessionId: this.generateSessionId(),
      timestamp: new Date().toISOString()
    };
    
    // Track state changes for persistence
    this.stateHistory = [];
    this.maxHistorySize = 10;
  }

  generateSessionId() {
    return `session_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  }

  /**
   * Update zoom level and persist state
   */
  async setZoom(level, query = null) {
    const previousState = { ...this.state };
    
    this.state.zoom = level;
    if (query) {
      this.state.lastQuery = query;
    }
    this.state.timestamp = new Date().toISOString();
    
    await this.persistState(previousState);
    mcpDebugger.debug('ZPT State - Zoom updated', { zoom: level, query });
    
    return this.state;
  }

  /**
   * Update pan filters and persist state
   */
  async setPan(panParams) {
    const previousState = { ...this.state };
    
    // Merge new pan parameters with existing ones
    this.state.pan = {
      ...this.state.pan,
      ...panParams
    };
    this.state.timestamp = new Date().toISOString();
    
    await this.persistState(previousState);
    mcpDebugger.debug('ZPT State - Pan updated', { pan: this.state.pan });
    
    return this.state;
  }

  /**
   * Update tilt style and persist state
   */
  async setTilt(style, query = null) {
    const previousState = { ...this.state };
    
    this.state.tilt = style;
    if (query) {
      this.state.lastQuery = query;
    }
    this.state.timestamp = new Date().toISOString();
    
    await this.persistState(previousState);
    mcpDebugger.debug('ZPT State - Tilt updated', { tilt: style, query });
    
    return this.state;
  }

  /**
   * Get current ZPT state
   */
  getState() {
    return { ...this.state };
  }

  /**
   * Reset state to defaults
   */
  async resetState() {
    const previousState = { ...this.state };
    
    this.state = {
      zoom: 'entity',
      pan: {},
      tilt: 'keywords',
      lastQuery: '',
      sessionId: this.generateSessionId(),
      timestamp: new Date().toISOString()
    };
    
    await this.persistState(previousState);
    mcpDebugger.info('ZPT State reset to defaults');
    
    return this.state;
  }

  /**
   * Persist state changes to memory
   */
  async persistState(previousState) {
    try {
      // Add to state history
      this.stateHistory.push({
        previous: previousState,
        current: { ...this.state },
        timestamp: new Date().toISOString()
      });

      // Trim history if too large
      if (this.stateHistory.length > this.maxHistorySize) {
        this.stateHistory = this.stateHistory.slice(-this.maxHistorySize);
      }

      // Store in memory as interaction if available
      if (this.memoryManager && typeof this.memoryManager.addInteraction === 'function') {
        const safeOps = new SafeOperations(this.memoryManager);
        
        await safeOps.storeInteraction(
          `ZPT State Change: ${this.state.sessionId}`,
          JSON.stringify(this.state),
          {
            type: 'zpt_state',
            sessionId: this.state.sessionId,
            stateChange: true,
            previousState: previousState
          }
        );
      }
    } catch (error) {
      mcpDebugger.warn('Failed to persist ZPT state', error);
      // Don't throw - state management should not break operations
    }
  }

  /**
   * Create navigation parameters from current state
   */
  getNavigationParams(query = null) {
    return {
      query: query || this.state.lastQuery || '',
      zoom: this.state.zoom,
      pan: this.state.pan,
      tilt: this.state.tilt
    };
  }
}

/**
 * Simple Verbs Service - Implements the 5 basic verbs
 */
class SimpleVerbsService {
  constructor() {
    this.memoryManager = null;
    this.safeOps = null;
    this.zptService = null;
    this.stateManager = null;
  }

  /**
   * Initialize service with required dependencies
   */
  async initialize() {
    if (!this.memoryManager) {
      await initializeServices();
      this.memoryManager = getMemoryManager();
      this.safeOps = new SafeOperations(this.memoryManager);
      this.zptService = new ZPTNavigationService(this.memoryManager, this.safeOps);
      this.stateManager = new ZPTStateManager(this.memoryManager);
      
      mcpDebugger.info('SimpleVerbsService initialized with ZPT state management');
    }
  }

  /**
   * TELL - Add resources to the system with minimal processing
   */
  async tell({ content, type = 'interaction', metadata = {} }) {
    await this.initialize();
    
    try {
      mcpDebugger.debug('Simple Verb: tell', { type, contentLength: content.length });
      
      let result;
      
      switch (type) {
        case 'interaction':
          // Store as semantic memory interaction
          const embedding = await this.safeOps.generateEmbedding(content);
          const concepts = await this.safeOps.extractConcepts(content);
          
          result = await this.safeOps.storeInteraction(
            `User input: ${content.substring(0, 100)}...`,
            content,
            { ...metadata, type: 'tell_interaction', concepts }
          );
          break;
          
        case 'document':
          // Store as document-style content
          result = await this.safeOps.storeInteraction(
            `Document: ${metadata.title || 'Untitled'}`,
            content,
            { ...metadata, type: 'tell_document' }
          );
          break;
          
        case 'concept':
          // Store as concept definition
          const conceptEmbedding = await this.safeOps.generateEmbedding(content);
          result = await this.safeOps.storeInteraction(
            `Concept: ${metadata.name || 'Unnamed'}`,
            content,
            { ...metadata, type: 'tell_concept', embedding: conceptEmbedding }
          );
          break;
          
        default:
          throw new Error(`Unknown tell type: ${type}`);
      }
      
      return {
        success: true,
        verb: 'tell',
        type,
        stored: true,
        contentLength: content.length,
        metadata: { ...metadata },
        zptState: this.stateManager.getState(),
        message: `Successfully stored ${type} content`
      };
      
    } catch (error) {
      mcpDebugger.error('Tell verb failed', error);
      return {
        success: false,
        verb: 'tell',
        error: error.message,
        zptState: this.stateManager.getState()
      };
    }
  }

  /**
   * ASK - Query the system using current ZPT context
   */
  async ask({ question, mode = 'standard', useContext = true }) {
    await this.initialize();
    
    try {
      mcpDebugger.debug('Simple Verb: ask', { question, mode, useContext });
      
      let result;
      
      if (useContext && this.stateManager.state.lastQuery) {
        // Use ZPT navigation with current context
        const navParams = this.stateManager.getNavigationParams(question);
        const navResult = await this.zptService.navigate(navParams);
        
        // Generate contextual answer using navigation results
        if (navResult.success && navResult.content?.data?.length > 0) {
          const context = navResult.content.data
            .map(item => item.content || item.label || '')
            .join('\n');
            
          result = await this.safeOps.generateResponse(question, context);
        } else {
          // Fallback to basic answer if navigation fails
          result = await this.safeOps.generateResponse(question);
        }
        
        return {
          success: true,
          verb: 'ask',
          question,
          answer: result,
          usedContext: true,
          contextItems: navResult.content?.data?.length || 0,
          zptState: this.stateManager.getState(),
          navigation: navResult
        };
        
      } else {
        // Direct semantic memory search and response
        const queryEmbedding = await this.safeOps.generateEmbedding(question);
        const memories = await this.safeOps.searchSimilar(queryEmbedding, 3, 0.7);
        
        const context = memories
          .map(memory => `${memory.prompt}: ${memory.response}`)
          .join('\n');
          
        result = await this.safeOps.generateResponse(question, context);
        
        // Update state with this query
        this.stateManager.state.lastQuery = question;
        
        return {
          success: true,
          verb: 'ask',
          question,
          answer: result,
          usedContext: false,
          memories: memories.length,
          zptState: this.stateManager.getState()
        };
      }
      
    } catch (error) {
      mcpDebugger.error('Ask verb failed', error);
      return {
        success: false,
        verb: 'ask',
        question,
        error: error.message,
        zptState: this.stateManager.getState()
      };
    }
  }

  /**
   * AUGMENT - Run operations on relevant knowledgebase parts
   */
  async augment({ target, operation = 'auto', options = {} }) {
    await this.initialize();
    
    try {
      mcpDebugger.debug('Simple Verb: augment', { target, operation });
      
      let result;
      
      switch (operation) {
        case 'concepts':
          // Extract concepts from target content
          result = await this.safeOps.extractConcepts(target);
          break;
          
        case 'attributes':
          // Use Ragno to augment with attributes
          try {
            const { augmentWithAttributes } = await import('../../src/ragno/augmentWithAttributes.js');
            result = await augmentWithAttributes([{ content: target }], this.memoryManager.llmHandler, options);
          } catch (importError) {
            // Fallback to concept extraction if Ragno is not available
            result = await this.safeOps.extractConcepts(target);
          }
          break;
          
        case 'relationships':
          // Generate relationships using current context
          const navParams = this.stateManager.getNavigationParams(target);
          const navResult = await this.zptService.navigate(navParams);
          
          if (navResult.success) {
            result = {
              relationships: navResult.content?.data || [],
              context: navParams
            };
          } else {
            result = { relationships: [], error: 'No relationships found' };
          }
          break;
          
        case 'auto':
        default:
          // Automatic augmentation - extract concepts and use ZPT context
          const concepts = await this.safeOps.extractConcepts(target);
          const embedding = await this.safeOps.generateEmbedding(target);
          
          result = {
            concepts,
            embedding: {
              dimension: embedding.length,
              preview: embedding.slice(0, 5).map(x => parseFloat(x.toFixed(4)))
            },
            augmentationType: 'auto'
          };
          break;
      }
      
      return {
        success: true,
        verb: 'augment',
        target: target.substring(0, 100) + (target.length > 100 ? '...' : ''),
        operation,
        result,
        zptState: this.stateManager.getState()
      };
      
    } catch (error) {
      mcpDebugger.error('Augment verb failed', error);
      return {
        success: false,
        verb: 'augment',
        target: target.substring(0, 100) + (target.length > 100 ? '...' : ''),
        operation,
        error: error.message,
        zptState: this.stateManager.getState()
      };
    }
  }

  /**
   * ZOOM - Set abstraction level and navigate if query provided
   */
  async zoom({ level = 'entity', query }) {
    await this.initialize();
    
    try {
      mcpDebugger.debug('Simple Verb: zoom', { level, query });
      
      // Update state
      await this.stateManager.setZoom(level, query);
      
      let result = {
        success: true,
        verb: 'zoom',
        level,
        previousLevel: this.stateManager.stateHistory.length > 0 
          ? this.stateManager.stateHistory[this.stateManager.stateHistory.length - 1].previous?.zoom 
          : null,
        zptState: this.stateManager.getState()
      };
      
      // If query provided, perform navigation with new zoom level
      if (query) {
        const navParams = this.stateManager.getNavigationParams(query);
        const navResult = await this.zptService.navigate(navParams);
        
        result.navigation = navResult;
        result.query = query;
      }
      
      return result;
      
    } catch (error) {
      mcpDebugger.error('Zoom verb failed', error);
      return {
        success: false,
        verb: 'zoom',
        level,
        error: error.message,
        zptState: this.stateManager.getState()
      };
    }
  }

  /**
   * PAN - Set domain/filtering and navigate if context available
   */
  async pan(panParams) {
    await this.initialize();
    
    try {
      mcpDebugger.debug('Simple Verb: pan', panParams);
      
      // Update state with pan parameters
      await this.stateManager.setPan(panParams);
      
      let result = {
        success: true,
        verb: 'pan',
        panParams,
        zptState: this.stateManager.getState()
      };
      
      // If we have a last query, re-navigate with new pan settings
      if (this.stateManager.state.lastQuery) {
        const navParams = this.stateManager.getNavigationParams();
        const navResult = await this.zptService.navigate(navParams);
        
        result.navigation = navResult;
        result.reNavigated = true;
      }
      
      return result;
      
    } catch (error) {
      mcpDebugger.error('Pan verb failed', error);
      return {
        success: false,
        verb: 'pan',
        panParams,
        error: error.message,
        zptState: this.stateManager.getState()
      };
    }
  }

  /**
   * TILT - Set view filter and navigate if query provided
   */
  async tilt({ style = 'keywords', query }) {
    await this.initialize();
    
    try {
      mcpDebugger.debug('Simple Verb: tilt', { style, query });
      
      // Update state
      await this.stateManager.setTilt(style, query);
      
      let result = {
        success: true,
        verb: 'tilt',
        style,
        previousStyle: this.stateManager.stateHistory.length > 0 
          ? this.stateManager.stateHistory[this.stateManager.stateHistory.length - 1].previous?.tilt 
          : null,
        zptState: this.stateManager.getState()
      };
      
      // If query provided or we have a last query, perform navigation with new tilt
      const navigationQuery = query || this.stateManager.state.lastQuery;
      if (navigationQuery) {
        const navParams = this.stateManager.getNavigationParams(navigationQuery);
        const navResult = await this.zptService.navigate(navParams);
        
        result.navigation = navResult;
        result.query = navigationQuery;
      }
      
      return result;
      
    } catch (error) {
      mcpDebugger.error('Tilt verb failed', error);
      return {
        success: false,
        verb: 'tilt',
        style,
        error: error.message,
        zptState: this.stateManager.getState()
      };
    }
  }
}

// Create shared service instance
const simpleVerbsService = new SimpleVerbsService();

/**
 * Register Simple Verbs with MCP Server
 */
export function registerSimpleVerbs(server) {
  mcpDebugger.info('Simple MCP Verbs service initialized for centralized handler');
  // Simple Verbs are now handled by the centralized tool call handler in index.js
  // This function now just initializes the service - tool registration happens centrally
}

// Export function to get the Simple Verbs service instance for centralized handler
export function getSimpleVerbsService() {
  return simpleVerbsService;
}

// Export Simple Verbs tool definitions for centralized handler
export function getSimpleVerbsToolDefinitions() {
  return [
    {
      name: SimpleVerbToolNames.TELL,
      description: "Add resources to the system with minimal processing. Supports interaction, document, and concept types.",
      inputSchema: zodToJsonSchema(TellSchema)
    },
    {
      name: SimpleVerbToolNames.ASK,
      description: "Query the system using current ZPT context for enhanced answers.",
      inputSchema: zodToJsonSchema(AskSchema)
    },
    {
      name: SimpleVerbToolNames.AUGMENT,
      description: "Run operations like concept extraction on relevant knowledgebase parts.",
      inputSchema: zodToJsonSchema(AugmentSchema)
    },
    {
      name: SimpleVerbToolNames.ZOOM,
      description: "Set the abstraction level for navigation (entity, unit, text, community, corpus).",
      inputSchema: zodToJsonSchema(ZoomSchema)
    },
    {
      name: SimpleVerbToolNames.PAN,
      description: "Set subject domain filters (temporal, keywords, entities, domains).",
      inputSchema: zodToJsonSchema(PanSchema)
    },
    {
      name: SimpleVerbToolNames.TILT,
      description: "Set the view filter/representation style (keywords, embedding, graph, temporal).",
      inputSchema: zodToJsonSchema(TiltSchema)
    }
  ];
}

export { SimpleVerbsService, ZPTStateManager };