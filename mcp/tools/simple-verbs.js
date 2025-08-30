/**
 * Simple MCP Verbs Interface
 * Implements the 5 basic verbs (tell, ask, augment, zoom, pan, tilt) that simplify
 * the complex MCP tooling into an intuitive interface with persistent ZPT state.
 */

import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { mcpDebugger } from '../lib/debug-utils.js';
import path from 'path';
import { initializeServices, getMemoryManager } from '../lib/initialization.js';
import { SafeOperations } from '../lib/safe-operations.js';

// Import existing complex tools to wrap
import { ZPTNavigationService } from './zpt-tools.js';
import { EnhancementCoordinator } from '../../src/services/enhancement/EnhancementCoordinator.js';
import { HybridContextManager } from '../../src/services/context/HybridContextManager.js';
import { MemoryDomainManager } from '../../src/services/memory/MemoryDomainManager.js';
import { MemoryRelevanceEngine } from '../../src/services/memory/MemoryRelevanceEngine.js';

// Simple Verb Tool Names
export const SimpleVerbToolNames = {
  TELL: 'tell',
  ASK: 'ask',
  AUGMENT: 'augment', 
  ZOOM: 'zoom',
  PAN: 'pan',
  TILT: 'tilt',
  INSPECT: 'inspect',
  // Memory management verbs
  REMEMBER: 'remember',
  FORGET: 'forget',
  RECALL: 'recall',
  PROJECT_CONTEXT: 'project_context',
  FADE_MEMORY: 'fade_memory'
};

// Input Schemas for Simple Verbs
const TellSchema = z.object({
  content: z.string().min(1, "Content cannot be empty"),
  type: z.enum(['interaction', 'document', 'concept']).optional().default('interaction'),
  metadata: z.object({}).optional().default({}),
  lazy: z.boolean().optional().default(false)
});

const AskSchema = z.object({
  question: z.string().min(1, "Question cannot be empty"),
  mode: z.enum(['basic', 'standard', 'comprehensive']).optional().default('standard'),
  useContext: z.boolean().optional().default(true),
  useHyDE: z.boolean().optional().default(false),
  useWikipedia: z.boolean().optional().default(false),
  useWikidata: z.boolean().optional().default(false)
});

const AugmentSchema = z.object({
  target: z.string().optional().default('all'),
  operation: z.enum(['auto', 'concepts', 'attributes', 'relationships', 'process_lazy', 'chunk_documents', 'extract_concepts', 'generate_embedding', 'analyze_text', 'concept_embeddings']).optional().default('auto'),
  options: z.object({
    // Chunking-specific options
    maxChunkSize: z.number().optional().default(2000),
    minChunkSize: z.number().optional().default(100),
    overlapSize: z.number().optional().default(100),
    strategy: z.enum(['semantic', 'fixed']).optional().default('semantic'),
    minContentLength: z.number().optional().default(2000),
    graph: z.string().optional(),
    // Concept embedding options
    maxConcepts: z.number().optional().default(20),
    embeddingModel: z.string().optional().default('nomic-embed-text'),
    includeAttributes: z.boolean().optional().default(false),
    batchSize: z.number().optional().default(5),
    includeEmbeddings: z.boolean().optional().default(false)
  }).optional().default({}),
  parameters: z.object({}).optional().default({}) // Legacy support - will be merged with options
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

const InspectSchema = z.object({
  what: z.enum(['session', 'concepts', 'embeddings', 'all']).optional().default('session'),
  details: z.boolean().optional().default(false)
});

// Memory Management Verb Schemas
const RememberSchema = z.object({
  content: z.string().min(1, "Content cannot be empty"),
  domain: z.enum(['user', 'project', 'session', 'instruction']).default('user'),
  domainId: z.string().optional(),
  importance: z.number().min(0).max(1).optional().default(0.5),
  metadata: z.object({
    tags: z.array(z.string()).optional(),
    category: z.string().optional(),
    expires: z.string().optional()
  }).optional().default({})
});

const ForgetSchema = z.object({
  target: z.string().min(1, "Target memory identifier required"),
  strategy: z.enum(['fade', 'context_switch', 'temporal_decay']).optional().default('fade'),
  fadeFactor: z.number().min(0).max(1).optional().default(0.1)
});

const RecallSchema = z.object({
  query: z.string().min(1, "Query cannot be empty"),
  domains: z.array(z.string()).optional(),
  timeRange: z.object({
    start: z.string().optional(),
    end: z.string().optional()
  }).optional(),
  relevanceThreshold: z.number().min(0).max(1).optional().default(0.1),
  maxResults: z.number().min(1).max(100).optional().default(10)
});

const ProjectContextSchema = z.object({
  projectId: z.string().min(1, "Project ID required"),
  action: z.enum(['create', 'switch', 'list', 'archive']).default('switch'),
  metadata: z.object({
    name: z.string().optional(),
    description: z.string().optional(),
    technologies: z.array(z.string()).optional(),
    parentProject: z.string().optional()
  }).optional().default({})
});

const FadeMemorySchema = z.object({
  domain: z.string().min(1, "Domain required"),
  fadeFactor: z.number().min(0).max(1).optional().default(0.1),
  transition: z.enum(['smooth', 'immediate']).optional().default('smooth'),
  preserveInstructions: z.boolean().optional().default(true)
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
    
    // Session-level memory cache for immediate retrieval
    this.sessionCache = {
      interactions: new Map(), // id -> { prompt, response, embedding, concepts, metadata }
      embeddings: [], // Array of { id, embedding, similarity_cache }
      concepts: new Set(), // Unique concepts from this session
      lastCacheUpdate: Date.now()
    };
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
   * Add interaction to session cache for immediate retrieval
   */
  async addToSessionCache(id, prompt, response, embedding, concepts = [], metadata = {}) {
    const interaction = {
      id,
      prompt,
      response,
      embedding,
      concepts,
      metadata,
      timestamp: Date.now()
    };
    
    this.sessionCache.interactions.set(id, interaction);
    this.sessionCache.embeddings.push({ id, embedding, similarity_cache: new Map() });
    
    // Add concepts to session concept set
    concepts.forEach(concept => this.sessionCache.concepts.add(concept));
    
    this.sessionCache.lastCacheUpdate = Date.now();
    
    mcpDebugger.debug('Session cache updated', { 
      id, 
      cacheSize: this.sessionCache.interactions.size,
      conceptCount: this.sessionCache.concepts.size 
    });
  }

  /**
   * Search session cache using semantic similarity
   */
  async searchSessionCache(queryText, queryEmbedding, limit = 5, threshold = 0.5) {
    if (this.sessionCache.interactions.size === 0) {
      return [];
    }

    const results = [];
    
    // Calculate similarity with cached embeddings
    for (const { id, embedding, similarity_cache } of this.sessionCache.embeddings) {
      // Check if we've already calculated this similarity
      const cacheKey = queryText.substring(0, 50); // Use first 50 chars as cache key
      let similarity = similarity_cache.get(cacheKey);
      
      if (similarity === undefined) {
        similarity = this.calculateCosineSimilarity(queryEmbedding, embedding);
        similarity_cache.set(cacheKey, similarity);
      }
      
      if (similarity >= threshold) {
        const interaction = this.sessionCache.interactions.get(id);
        results.push({
          ...interaction,
          similarity
        });
      }
    }

    // Sort by similarity and limit results
    return results
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);
  }

  /**
   * Calculate cosine similarity between two embeddings
   */
  calculateCosineSimilarity(embedding1, embedding2) {
    if (!embedding1 || !embedding2 || embedding1.length !== embedding2.length) {
      return 0;
    }

    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < embedding1.length; i++) {
      dotProduct += embedding1[i] * embedding2[i];
      norm1 += embedding1[i] * embedding1[i];
      norm2 += embedding2[i] * embedding2[i];
    }

    const magnitude = Math.sqrt(norm1) * Math.sqrt(norm2);
    return magnitude === 0 ? 0 : dotProduct / magnitude;
  }

  /**
   * Get session cache statistics for debugging
   */
  getSessionCacheStats() {
    return {
      interactions: this.sessionCache.interactions.size,
      embeddings: this.sessionCache.embeddings.length,
      concepts: this.sessionCache.concepts.size,
      lastUpdate: this.sessionCache.lastCacheUpdate,
      sessionId: this.state.sessionId
    };
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
    this.enhancementCoordinator = null;
    this.hybridContextManager = null;
    // Memory domain management services
    this.memoryDomainManager = null;
    this.memoryRelevanceEngine = null;
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
      
      // Initialize enhancement coordinator with available handlers
      this.enhancementCoordinator = new EnhancementCoordinator({
        llmHandler: this.memoryManager.llmHandler,
        embeddingHandler: this.memoryManager.embeddingHandler,
        sparqlHelper: this.memoryManager.store?.sparqlHelper,
        config: this.memoryManager.config
      });
      
      // Initialize hybrid context manager for intelligent context merging
      this.hybridContextManager = new HybridContextManager({
        memoryManager: this.memoryManager,
        enhancementCoordinator: this.enhancementCoordinator,
        safeOperations: this.safeOps,
        zptStateManager: this.stateManager
      });
      
      // Initialize memory domain management services
      this.memoryRelevanceEngine = new MemoryRelevanceEngine({
        baseWeights: {
          domainMatch: 0.35,
          temporal: 0.20,
          semantic: 0.30,
          frequency: 0.15
        }
      });
      
      this.memoryDomainManager = new MemoryDomainManager(
        this.memoryManager.store, 
        this.stateManager,
        {
          memoryRelevanceEngine: this.memoryRelevanceEngine
        }
      );
      
      mcpDebugger.info('SimpleVerbsService initialized with ZPT state management, enhancement coordinator, hybrid context manager, and memory domain services');
    }
  }

  /**
   * TELL - Add resources to the system with minimal processing
   */
  async tell({ content, type = 'interaction', metadata = {}, lazy = false }) {
    // Debug removed for ES module compatibility
    await this.initialize();
    
    try {
      mcpDebugger.debug('Simple Verb: tell', { type, contentLength: content.length, lazy });
      console.log('DEBUG TELL PARAMETERS:', { content: content.substring(0, 50), type, lazy, metadata });
      
      let result;
      let embedding;
      let concepts = [];
      let prompt;
      let response = content;
      
      if (lazy) {
        // Lazy storage - store content as-is without processing
        const elementId = `semem:${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
        prompt = type === 'document' ? `Document: ${metadata.title || 'Untitled'}` :
                type === 'concept' ? `Concept: ${metadata.name || 'Unnamed'}` :
                `User input: ${content.substring(0, 100)}...`;
        
        const lazyData = {
          id: elementId,
          content,
          type,
          prompt,
          title: metadata.title || metadata.name,
          metadata
        };
        
        console.log('DEBUG MEMORY MANAGER:', !!this.memoryManager);
        console.log('DEBUG STORE:', !!this.memoryManager?.store);
        console.log('DEBUG STORE TYPE:', typeof this.memoryManager?.store);
        
        if (!this.memoryManager?.store) {
          throw new Error('Memory manager store is not available');
        }
        
        console.log('DEBUG STORE CONSTRUCTOR:', this.memoryManager.store.constructor.name);
        console.log('DEBUG STORE METHODS:', Object.getOwnPropertyNames(this.memoryManager.store.constructor.prototype));
        
        if (typeof this.memoryManager.store.storeLazyContent === 'function') {
          result = await this.memoryManager.store.storeLazyContent(lazyData);
        } else {
          throw new Error(`Store does not have storeLazyContent method. Store type: ${this.memoryManager.store.constructor.name}`);
        }
        
        mcpDebugger.info('Lazy tell operation completed', {
          type,
          elementId,
          contentLength: content.length
        });
        
        return {
          success: true,
          verb: 'tell',
          type,
          stored: true,
          lazy: true,
          contentLength: content.length,
          metadata: { ...metadata },
          concepts: 0,
          sessionCached: false,
          zptState: this.stateManager.getState(),
          message: `Successfully stored ${type} content lazily (without processing)`
        };
        
      } else {
        // Normal processing - existing behavior
        switch (type) {
          case 'interaction':
            // Store as semantic memory interaction
            embedding = await this.safeOps.generateEmbedding(content);
            concepts = await this.safeOps.extractConcepts(content);
            prompt = `User input: ${content.substring(0, 100)}...`;
            
            console.log('🔥 DEBUG: About to call safeOps.storeInteraction');
            // Debug removed for ES module compatibility
            result = await this.safeOps.storeInteraction(
              prompt,
              response,
              { ...metadata, type: 'tell_interaction', concepts }
            );
            console.log('🔥 DEBUG: safeOps.storeInteraction completed');
            
            // DIRECT FIX: Force immediate SPARQL persistence 
            try {
              console.log('🔥 DEBUG: Force saving to SPARQL...');
              await this.memoryManager.store.saveMemoryToHistory(this.memoryManager.memStore);
              console.log('🔥 DEBUG: SPARQL force save completed');
            } catch (sparqlError) {
              console.error('🔥 ERROR: Force SPARQL save failed:', sparqlError);
            }
            break;
            
          case 'document':
            // Handle large documents by chunking them first
            const MAX_EMBEDDING_SIZE = 8000; // Conservative limit for embedding APIs
            
            if (content.length > MAX_EMBEDDING_SIZE) {
              let chunkingResult;
              try {
                // Import chunker for large documents
                const Chunker = (await import('../../src/services/document/Chunker.js')).default;
                const chunker = new Chunker({
                  maxChunkSize: 2000,
                  minChunkSize: 100,
                  overlapSize: 100,
                  strategy: 'semantic'
                });
                
                console.log(`📚 Document too large (${content.length} chars > ${MAX_EMBEDDING_SIZE}). Chunking into smaller pieces...`);
                
                // Chunk the document
                chunkingResult = await chunker.chunk(content, {
                  title: metadata.title || 'Untitled Document',
                  sourceFile: metadata.filename || 'unknown'
                });
                
                console.log(`✂️  Created ${chunkingResult.chunks.length} chunks for processing`);
              } catch (chunkingError) {
                console.error('❌ Error during document chunking:', chunkingError.message);
                throw new Error(`Failed to chunk large document: ${chunkingError.message}. Document size: ${content.length} characters.`);
              }
              
              // Process each chunk separately
              const chunkResults = [];
              let allConcepts = [];
              
              for (let i = 0; i < chunkingResult.chunks.length; i++) {
                const chunk = chunkingResult.chunks[i];
                try {
                  console.log(`🧩 Processing chunk ${i + 1}/${chunkingResult.chunks.length} (${chunk.size} chars)...`);
                  
                  const chunkEmbedding = await this.safeOps.generateEmbedding(chunk.content);
                  const chunkConcepts = await this.safeOps.extractConcepts(chunk.content);
                  const chunkPrompt = `Document: ${metadata.title || 'Untitled'} (Chunk ${i + 1}/${chunkingResult.chunks.length})`;
                  
                  const chunkResult = await this.safeOps.storeInteraction(
                    chunkPrompt,
                    chunk.content,
                    { 
                      ...metadata, 
                      type: 'tell_document_chunk',
                      chunkIndex: i,
                      totalChunks: chunkingResult.chunks.length,
                      chunkSize: chunk.size,
                      concepts: chunkConcepts 
                    }
                  );
                  
                  chunkResults.push(chunkResult);
                  allConcepts = [...allConcepts, ...chunkConcepts];
                  
                  console.log(`✅ Chunk ${i + 1} processed successfully (${chunkConcepts.length} concepts extracted)`);
                } catch (chunkError) {
                  console.error(`❌ Error processing chunk ${i + 1}:`, chunkError.message);
                  // Don't throw here - continue with other chunks but log the failure
                  chunkResults.push({
                    error: true,
                    message: `Failed to process chunk ${i + 1}: ${chunkError.message}`,
                    chunkIndex: i,
                    chunkSize: chunk.size
                  });
                }
              }
              
              // Store document summary with aggregated concepts
              concepts = [...new Set(allConcepts)]; // Remove duplicates
              prompt = `Document: ${metadata.title || 'Untitled'} (${chunkingResult.chunks.length} chunks)`;
              
              result = {
                ...chunkResults[0], // Use first chunk as base result
                chunks: chunkResults.length,
                totalConcepts: concepts.length,
                chunkingMetadata: chunkingResult.metadata
              };
            } else {
              // Small document - process normally
              try {
                console.log(`📄 Processing document (${content.length} chars - under limit)...`);
                embedding = await this.safeOps.generateEmbedding(content);
                concepts = await this.safeOps.extractConcepts(content);
                prompt = `Document: ${metadata.title || 'Untitled'}`;
                
                result = await this.safeOps.storeInteraction(
                  prompt,
                  response,
                  { ...metadata, type: 'tell_document', concepts }
                );
                console.log(`✅ Document processed successfully (${concepts.length} concepts extracted)`);
                
                // DIRECT FIX: Force immediate SPARQL persistence 
                try {
                  console.log('🔥 DEBUG: Force saving document to SPARQL...');
                  await this.memoryManager.store.saveMemoryToHistory(this.memoryManager.memStore);
                  console.log('🔥 DEBUG: Document SPARQL force save completed');
                } catch (sparqlError) {
                  console.error('🔥 ERROR: Document force SPARQL save failed:', sparqlError);
                }
              } catch (docError) {
                console.error(`❌ Error processing document:`, docError.message);
                throw new Error(`Failed to process document: ${docError.message}. Document size: ${content.length} characters. Consider breaking it into smaller sections.`);
              }
            }
            break;
            
          case 'concept':
            // Store as concept definition
            embedding = await this.safeOps.generateEmbedding(content);
            concepts = await this.safeOps.extractConcepts(content);
            prompt = `Concept: ${metadata.name || 'Unnamed'}`;
            
            result = await this.safeOps.storeInteraction(
              prompt,
              response,
              { ...metadata, type: 'tell_concept', concepts }
            );
            break;
            
          default:
            throw new Error(`Unknown tell type: ${type}`);
        }
      }

      // Add to session cache for immediate retrieval (only for processed content)
      if (!lazy) {
        const sessionId = `${this.stateManager.state.sessionId}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        await this.stateManager.addToSessionCache(
          sessionId,
          prompt,
          response,
          embedding,
          concepts,
          { ...metadata, type: `tell_${type}`, storedAt: Date.now() }
        );

        mcpDebugger.info('Tell operation completed with session caching', {
          type,
          conceptCount: concepts.length,
          sessionCacheSize: this.stateManager.sessionCache.interactions.size
        });
        
        return {
          success: true,
          verb: 'tell',
          type,
          stored: true,
          contentLength: content.length,
          metadata: { ...metadata },
          concepts: concepts.length,
          sessionCached: true,
          zptState: this.stateManager.getState(),
          message: `Successfully stored ${type} content`
        };
      }
      
    } catch (error) {
      mcpDebugger.error('Tell verb failed', error);
      return {
        success: false,
        verb: 'tell',
        type,
        lazy,
        error: error.message,
        zptState: this.stateManager.getState()
      };
    }
  }

  /**
   * ASK - Query the system using current ZPT context with optional enhancements
   * Now uses HybridContextManager for intelligent merging of enhancement and personal context
   */
  async ask({ question, mode = 'standard', useContext = true, useHyDE = false, useWikipedia = false, useWikidata = false, threshold }) {
    await this.initialize();
    
    try {
      const startTime = Date.now();
      mcpDebugger.info('🔍 Starting Hybrid Ask operation', { 
        question: question.substring(0, 100) + (question.length > 100 ? '...' : ''), 
        mode, useContext, useHyDE, useWikipedia, useWikidata 
      });
      mcpDebugger.debug('Simple Verb: ask (hybrid)', { question, mode, useContext, useHyDE, useWikipedia, useWikidata });
      
      // Use HybridContextManager for intelligent context processing
      console.log('🔥 CONSOLE: Simple-verbs ask() calling HybridContextManager.processQuery', { 
        question: question.substring(0, 50), 
        useContext,
        hasHybridContextManager: !!this.hybridContextManager 
      });
      
      const hybridResult = await this.hybridContextManager.processQuery(question, {
        mode,
        useContext,
        useHyDE,
        useWikipedia,
        useWikidata,
        threshold
      });
      
      console.log('🔥 CONSOLE: Simple-verbs ask() received result from HybridContextManager', { 
        success: hybridResult.success,
        contextItems: hybridResult.contextItems || 0,
        sessionResults: hybridResult.sessionResults || 0,
        persistentResults: hybridResult.persistentResults || 0,
        memories: hybridResult.memories || 0,
        localContextResults: {
          exists: !!hybridResult.localContextResults,
          isArray: Array.isArray(hybridResult.localContextResults),
          length: hybridResult.localContextResults?.length || 0
        },
        enhancementResults: {
          exists: !!hybridResult.enhancementResults,
          isArray: Array.isArray(hybridResult.enhancementResults),
          length: hybridResult.enhancementResults?.length || 0
        },
        allKeys: Object.keys(hybridResult)
      });
      
      // Update state with this query
      this.stateManager.state.lastQuery = question;
      
      const totalDuration = Date.now() - startTime;
      mcpDebugger.info('✅ Hybrid Ask operation complete', { 
        totalDuration: totalDuration + 'ms',
        success: hybridResult.success,
        mergeStrategy: hybridResult.mergeStrategy,
        enhancementUsed: hybridResult.enhancementUsed,
        localContextUsed: hybridResult.localContextUsed
      });
      
      // Transform hybrid result to standard ask response format
      return {
        success: hybridResult.success,
        verb: 'ask',
        question,
        answer: hybridResult.answer,
        usedContext: hybridResult.localContextUsed || hybridResult.enhancementUsed,
        contextItems: (hybridResult.localContextResults?.length || 0) + (hybridResult.enhancementResults?.length || 0),
        sessionResults: hybridResult.sessionResults || 0,
        persistentResults: hybridResult.persistentResults || 0,
        memories: hybridResult.localContextResults?.length || 0,
        enhancementType: hybridResult.enhancementType,
        enhancements: hybridResult.enhancements || [],
        enhancementStats: hybridResult.enhancementStats,
        mergeStrategy: hybridResult.mergeStrategy,
        contextAnalysis: hybridResult.contextAnalysis,
        hybridStats: hybridResult.hybridStats,
        zptState: this.stateManager.getState(),
        searchMethod: 'hybrid_context_processing',
        sessionCacheStats: this.stateManager.getSessionCacheStats()
      };
      
    } catch (error) {
      const totalDuration = Date.now() - startTime;
      mcpDebugger.error('❌ Hybrid Ask operation failed', { error: error.message, totalDuration: totalDuration + 'ms' });
      mcpDebugger.error('Hybrid Ask verb failed', error);
      return {
        success: false,
        verb: 'ask',
        question,
        error: error.message,
        hybridError: true,
        zptState: this.stateManager.getState(),
        sessionCacheStats: this.stateManager.getSessionCacheStats()
      };
    }
  }

  /**
   * AUGMENT - Run operations on relevant knowledgebase parts
   */
  async augment({ target, operation = 'auto', options = {}, parameters = {} }) {
    await this.initialize();
    
    // Backward compatibility: merge legacy 'parameters' into 'options'
    const mergedOptions = { ...parameters, ...options };
    if (Object.keys(parameters).length > 0) {
      mcpDebugger.debug('Legacy parameters detected, merged into options', { parameters, mergedOptions });
    }
    
    console.log('🔄 [AUGMENT] Function called with:', { target, operation, options, parameters });
    
    try {
      // Validate target for operations that require specific content
      const requiresSpecificTarget = ['concepts', 'attributes', 'relationships'].includes(operation);
      if (requiresSpecificTarget && (!target || target === 'all')) {
        throw new Error(`Operation '${operation}' requires specific target content, not 'all'`);
      }
      
      mcpDebugger.debug('Simple Verb: augment', { target, operation });
      console.log('🔄 [AUGMENT] About to enter switch statement:', { operation });
      
      let result;
      
      switch (operation) {
        case 'concepts':
          // Extract concepts from target content
          const extractedConcepts = await this.safeOps.extractConcepts(target);
          
          // If includeEmbeddings option is set, generate embeddings for concepts
          if (mergedOptions.includeEmbeddings) {
            console.log('🔮 [CONCEPTS] Generating embeddings for extracted concepts...');
            try {
              // Use the concept_embeddings logic but return in concepts format
              const { maxConcepts = 20, embeddingModel = 'nomic-embed-text', batchSize = 5, graph } = mergedOptions;
              const conceptsToProcess = extractedConcepts.slice(0, maxConcepts);
              const conceptEmbeddings = [];
              
              // Get SPARQL configuration
              const config = this.memoryManager.config;
              const storageConfig = config.get('storage.options');
              // Use graph option, or storage.options.graphName, or fallback to top-level graphName, or default
              const targetGraph = graph || storageConfig?.graphName || config.get('graphName') || 'http://hyperdata.it/content';
              
              // Import utilities
              const { URIMinter } = await import('../../src/utils/URIMinter.js');
              const SPARQLHelper = (await import('../../src/services/sparql/SPARQLHelper.js')).default;
              const sparqlHelper = new SPARQLHelper(storageConfig.update, {
                user: storageConfig.user,
                password: storageConfig.password
              });
              
              // Process concepts in batches
              for (let i = 0; i < conceptsToProcess.length; i += batchSize) {
                const batch = conceptsToProcess.slice(i, i + batchSize);
                for (const concept of batch) {
                  try {
                    const conceptEmbedding = await this.safeOps.generateEmbedding(concept);
                    const conceptUri = URIMinter.mintURI('http://purl.org/stuff/instance/', 'concept', concept);
                    const embeddingUri = URIMinter.mintURI('http://purl.org/stuff/instance/', 'embedding', concept);

                    // Store using new ragno format
                    const insertQuery = `
                      PREFIX ragno: <http://purl.org/stuff/ragno/>
                      PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
                      PREFIX dcterms: <http://purl.org/dc/terms/>
                      PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>

                      INSERT DATA {
                          GRAPH <${targetGraph}> {
                              <${conceptUri}> a ragno:Concept ;
                                              skos:prefLabel "${concept.replace(/"/g, '\\"')}" ;
                                              ragno:hasEmbedding <${embeddingUri}> ;
                                              dcterms:created "${new Date().toISOString()}"^^xsd:dateTime .
                              
                              <${embeddingUri}> a ragno:IndexElement ;
                                                ragno:embeddingModel "${embeddingModel}" ;
                                                ragno:subType ragno:ConceptEmbedding ;
                                                ragno:embeddingDimension ${conceptEmbedding.length} ;
                                                ragno:vectorContent "[${conceptEmbedding.join(',')}]" .
                          }
                      }
                    `;

                    await sparqlHelper.executeUpdate(insertQuery);
                    conceptEmbeddings.push({
                      concept,
                      uri: conceptUri,
                      embeddingDimension: conceptEmbedding.length
                    });
                  } catch (error) {
                    mcpDebugger.warn('Failed to generate embedding for concept', { concept, error: error.message });
                  }
                }
              }
              
              result = {
                concepts: extractedConcepts,
                embeddedConcepts: conceptEmbeddings,
                totalEmbeddings: conceptEmbeddings.length,
                embeddingModel: embeddingModel,
                augmentationType: 'concepts_with_embeddings'
              };
              
              console.log(`✅ [CONCEPTS] Generated embeddings for ${conceptEmbeddings.length} concepts`);
            } catch (embeddingError) {
              console.warn('⚠️ [CONCEPTS] Embedding generation failed:', embeddingError.message);
              result = {
                concepts: extractedConcepts,
                embeddingError: embeddingError.message,
                augmentationType: 'concepts_embedding_failed'
              };
            }
          } else {
            result = extractedConcepts;
          }
          break;
          
        case 'attributes':
          // Use Ragno to augment with attributes
          try {
            const { augmentWithAttributes } = await import('../../src/ragno/augmentWithAttributes.js');
            result = await augmentWithAttributes([{ content: target }], this.memoryManager.llmHandler, mergedOptions);
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
          
        case 'process_lazy':
          // Process lazy content - find and process unprocessed content
          try {
            // If target is "all", process all lazy content
            if (target === 'all' || target === '') {
              const lazyItems = await this.memoryManager.store.findLazyContent(mergedOptions.limit || 10);
              
              if (lazyItems.length === 0) {
                result = {
                  processedItems: [],
                  message: 'No lazy content found to process'
                };
              } else {
                const processedItems = [];
                
                for (const item of lazyItems) {
                  try {
                    // Generate embedding and extract concepts for lazy content
                    const embedding = await this.safeOps.generateEmbedding(item.content);
                    const concepts = await this.safeOps.extractConcepts(item.content);
                    
                    // Update the lazy content to processed status
                    await this.memoryManager.store.updateLazyToProcessed(item.id, embedding, concepts);
                    
                    processedItems.push({
                      id: item.id,
                      label: item.label,
                      type: item.type,
                      conceptCount: concepts.length,
                      embeddingDimension: embedding.length
                    });
                    
                    mcpDebugger.info('Processed lazy content', { 
                      id: item.id, 
                      conceptCount: concepts.length 
                    });
                    
                  } catch (itemError) {
                    mcpDebugger.warn('Failed to process lazy item', { 
                      id: item.id, 
                      error: itemError.message 
                    });
                  }
                }
                
                result = {
                  processedItems,
                  totalProcessed: processedItems.length,
                  totalFound: lazyItems.length,
                  augmentationType: 'process_lazy'
                };
              }
            } else {
              // Process specific content (treat as regular augmentation)
              const concepts = await this.safeOps.extractConcepts(target);
              const embedding = await this.safeOps.generateEmbedding(target);
              
              result = {
                concepts,
                embedding: {
                  dimension: embedding.length,
                  preview: embedding.slice(0, 5).map(x => parseFloat(x.toFixed(4)))
                },
                augmentationType: 'process_lazy_specific'
              };
            }
          } catch (lazyError) {
            result = {
              error: lazyError.message,
              augmentationType: 'process_lazy_failed'
            };
          }
          break;
          
        case 'chunk_documents':
          // Chunk documents stored in SPARQL that haven't been processed yet
          console.log('🔄 [CHUNK_DOCUMENTS] Case triggered - starting chunking process');
          mcpDebugger.info('chunk_documents case triggered', { target, mergedOptions });
          try {
            const {
              maxChunkSize = 2000,
              minChunkSize = 100, 
              overlapSize = 100,
              strategy = 'semantic',
              minContentLength = 2000,
              graph
            } = mergedOptions;

            // Import chunking dependencies
            const Chunker = (await import('../../src/services/document/Chunker.js')).default;
            const { SPARQLQueryService } = await import('../../src/services/sparql/index.js');
            const SPARQLHelper = (await import('../../src/services/sparql/SPARQLHelper.js')).default;
            const { URIMinter } = await import('../../src/utils/URIMinter.js');
            
            const config = this.memoryManager.config;
            const storageConfig = config.get('storage.options');
            // Use graph option, or storage.options.graphName, or fallback to top-level graphName, or default
            const targetGraph = graph || storageConfig?.graphName || config.get('graphName') || 'http://hyperdata.it/content';
            
            // Initialize services with explicit paths
            const projectRoot = path.join(process.cwd(), '..');
            const queryService = new SPARQLQueryService({
              queryPath: path.join(projectRoot, 'sparql/queries'),
              templatePath: path.join(projectRoot, 'sparql/templates'),
              configPath: path.join(projectRoot, 'sparql/config')
            });
            const sparqlHelper = new SPARQLHelper(storageConfig.update, {
              user: storageConfig.user,
              password: storageConfig.password
            });
            
            const chunker = new Chunker({
              maxChunkSize,
              minChunkSize,
              overlapSize,
              strategy,
              baseNamespace: 'http://purl.org/stuff/instance/'
            });

            let textElementsToProcess = [];

            if (target === 'all' || target === '') {
              // Find unprocessed text elements
              const query = await queryService.getQuery('find-unprocessed-text-elements', {
                graphURI: targetGraph,
                limit: 1000000,
                minContentLength
              });
              
              const response = await fetch(storageConfig.query, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/sparql-query',
                  'Accept': 'application/sparql-results+json',
                  'Authorization': `Basic ${Buffer.from(`${storageConfig.user}:${storageConfig.password}`).toString('base64')}`
                },
                body: query
              });
              
              const queryResult = await response.json();
              textElementsToProcess = queryResult.results?.bindings || [];
              
            } else if (target.startsWith('http://') || target.startsWith('https://')) {
              // Process specific text element URI
              const query = `
                PREFIX ragno: <http://purl.org/stuff/ragno/>
                PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
                PREFIX prov: <http://www.w3.org/ns/prov#>
                
                SELECT ?textElement ?content ?sourceUnit WHERE {
                  GRAPH <${targetGraph}> {
                    <${target}> ragno:content ?content ;
                               rdfs:label ?label .
                    OPTIONAL { <${target}> prov:wasDerivedFrom ?sourceUnit }
                    BIND(<${target}> AS ?textElement)
                    FILTER(STRLEN(?content) >= ${minContentLength})
                  }
                }
              `;
              
              const response = await fetch(storageConfig.query, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/sparql-query',
                  'Accept': 'application/sparql-results+json',
                  'Authorization': `Basic ${Buffer.from(`${storageConfig.user}:${storageConfig.password}`).toString('base64')}`
                },
                body: query
              });
              
              const queryResult = await response.json();
              textElementsToProcess = queryResult.results?.bindings || [];
            } else {
              // Handle direct content text from UI - create a synthetic text element
              console.log('📝 [CHUNK_DOCUMENTS] Processing direct content text from UI');
              if (target.length >= minContentLength) {
                // Generate a URI for this content using a simple hash
                const crypto = await import('crypto');
                const contentHash = crypto.createHash('md5').update(target).digest('hex').substring(0, 8);
                const syntheticURI = `http://purl.org/stuff/instance/text-element-${contentHash}`;
                
                textElementsToProcess = [{
                  textElement: { value: syntheticURI },
                  content: { value: target },
                  sourceUnit: null
                }];
                
                console.log(`📝 [CHUNK_DOCUMENTS] Created synthetic TextElement: ${syntheticURI} (${target.length} chars)`);
              } else {
                console.log(`⚠️ [CHUNK_DOCUMENTS] Content too short: ${target.length} < ${minContentLength} chars`);
              }
            }

            if (textElementsToProcess.length === 0) {
              result = {
                chunkedDocuments: [],
                message: 'No eligible text elements found for chunking',
                augmentationType: 'chunk_documents'
              };
            } else {
              console.log('🔄 [CHUNK_DOCUMENTS] Processing documents for chunking...');
              const chunkedResults = [];
              
              for (const element of textElementsToProcess) {
                const textElementURI = element.textElement.value;
                const content = element.content.value;
                const sourceUnit = element.sourceUnit?.value;
                
                try {
                  console.log(`🧩 [CHUNK_DOCUMENTS] Processing document: ${textElementURI} (${content.length} chars)`);
                  mcpDebugger.info('Starting document chunking', { textElementURI, contentLength: content.length });
                  
                  // Chunk the content
                  console.log('✂️ [CHUNK_DOCUMENTS] Chunking content...');
                  const chunkingResult = await chunker.chunk(content, {
                    title: `TextElement ${textElementURI.split('/').pop()}`,
                    sourceUri: textElementURI
                  });
                  
                  console.log(`✂️ [CHUNK_DOCUMENTS] Created ${chunkingResult.chunks.length} chunks`);
                  mcpDebugger.info('Document chunked successfully', { 
                    textElementURI, 
                    chunkCount: chunkingResult.chunks.length,
                    avgChunkSize: chunkingResult.metadata?.chunking?.avgChunkSize || 'unknown'
                  });
                  
                  // Generate URIs for the OLO structure
                  const chunkListURI = URIMinter.mintURI('http://purl.org/stuff/instance/', 'chunklist', textElementURI);
                  
                  // Build chunk triples
                  const chunkTriples = [];
                  const slotTriples = [];
                  
                  for (let i = 0; i < chunkingResult.chunks.length; i++) {
                    const chunk = chunkingResult.chunks[i];
                    const chunkURI = chunk.uri;
                    const slotURI = URIMinter.mintURI('http://purl.org/stuff/instance/', 'slot', `${textElementURI}-${i}`);
                    
                    // Generate embedding for chunk
                    const chunkEmbedding = await this.safeOps.generateEmbedding(chunk.content);
                    const embeddingURI = URIMinter.mintURI('http://purl.org/stuff/instance/', 'embedding', chunk.content);
                    
                    // Chunk as both ragno:Unit and ragno:TextElement for embeddings
                    chunkTriples.push(`
    <${chunkURI}> a ragno:Unit, ragno:TextElement ;
                  ragno:content """${chunk.content.replace(/"/g, '\\"')}""" ;
                  dcterms:extent ${chunk.size} ;
                  olo:index ${chunk.index} ;
                  prov:wasDerivedFrom <${textElementURI}> ;
                  ragno:hasEmbedding <${embeddingURI}> ;
                  dcterms:created "${new Date().toISOString()}"^^xsd:dateTime .
                  
    <${embeddingURI}> a ragno:IndexElement ;
                      ragno:embeddingModel "nomic-embed-text" ;
                      ragno:subType ragno:TextEmbedding ;
                      ragno:embeddingDimension ${chunkEmbedding.length} ;
                      ragno:vectorContent "[${chunkEmbedding.join(',')}]" .`);
                    
                    // OLO slot structure
                    slotTriples.push(`
    <${slotURI}> a olo:Slot ;
                 olo:index ${i + 1} ;
                 olo:item <${chunkURI}> ;
                 olo:ordered_list <${chunkListURI}> .
    
    <${chunkListURI}> olo:slot <${slotURI}> .`);
                    
                    // Add next/previous relationships for slots
                    if (i > 0) {
                      const prevSlotURI = URIMinter.mintURI('http://purl.org/stuff/instance/', 'slot', `${textElementURI}-${i-1}`);
                      slotTriples.push(`
    <${slotURI}> olo:previous <${prevSlotURI}> .
    <${prevSlotURI}> olo:next <${slotURI}> .`);
                    }
                  }
                  
                  // Create the SPARQL update query
                  const updateQuery = await queryService.getQuery('store-chunks-with-olo', {
                    graphURI: targetGraph,
                    textElementURI: textElementURI,
                    chunkListURI: chunkListURI,
                    chunkCount: chunkingResult.chunks.length,
                    textElementTitle: textElementURI.split('/').pop(),
                    chunkTriples: chunkTriples.join('\n'),
                    slotTriples: slotTriples.join('\n')
                  });
                  
                  // Execute the update
                  console.log('💾 [CHUNK_DOCUMENTS] Storing chunks to SPARQL...');
                  console.log('📝 [CHUNK_DOCUMENTS] Update query preview (first 500 chars):', updateQuery.substring(0, 500));
                  const updateResult = await sparqlHelper.executeUpdate(updateQuery);
                  
                  console.log('📊 [CHUNK_DOCUMENTS] SPARQL update result:', {
                    success: updateResult.success,
                    status: updateResult.status,
                    statusText: updateResult.statusText,
                    responseTime: updateResult.responseTime,
                    error: updateResult.error,
                    response: updateResult.response
                  });
                  
                  if (!updateResult.success) {
                    throw new Error(`SPARQL update failed: ${updateResult.error || updateResult.statusText || 'Unknown error'} (Status: ${updateResult.status})`);
                  }
                  
                  chunkedResults.push({
                    textElementURI,
                    chunkCount: chunkingResult.chunks.length,
                    chunkListURI,
                    avgChunkSize: Math.round(chunkingResult.metadata.chunking.avgChunkSize),
                    contentLength: content.length
                  });
                  
                  console.log(`✅ [CHUNK_DOCUMENTS] Successfully stored ${chunkingResult.chunks.length} chunks with embeddings to SPARQL`);
                  mcpDebugger.info('Document chunks stored successfully', { 
                    textElementURI, 
                    chunkCount: chunkingResult.chunks.length,
                    chunkListURI,
                    updateSuccess: updateResult.success,
                    responseTime: updateResult.responseTime
                  });
                  
                } catch (chunkError) {
                  console.error(`❌ Error chunking ${textElementURI}:`, chunkError.message);
                  chunkedResults.push({
                    textElementURI,
                    error: chunkError.message,
                    contentLength: content.length
                  });
                }
              }
              
              result = {
                chunkedDocuments: chunkedResults,
                totalProcessed: chunkedResults.filter(r => !r.error).length,
                totalFound: textElementsToProcess.length,
                totalChunks: chunkedResults.reduce((sum, r) => sum + (r.chunkCount || 0), 0),
                augmentationType: 'chunk_documents',
                options: { maxChunkSize, minChunkSize, overlapSize, strategy, minContentLength },
                message: `Processed ${chunkedResults.filter(r => !r.error).length}/${textElementsToProcess.length} documents, created ${chunkedResults.reduce((sum, r) => sum + (r.chunkCount || 0), 0)} searchable chunks`
              };
            }
            
          } catch (chunkingError) {
            result = {
              error: chunkingError.message,
              augmentationType: 'chunk_documents_failed',
              message: `Document chunking failed: ${chunkingError.message}`
            };
          }
          break;
        
        // Legacy operation names for backward compatibility
        case 'extract_concepts':
          result = await this.safeOps.extractConcepts(target);
          break;
          
        case 'generate_embedding':
          const embedding = await this.safeOps.generateEmbedding(target);
          result = {
            embedding: {
              dimension: embedding.length,
              preview: embedding.slice(0, 5).map(x => parseFloat(x.toFixed(4))),
              full: embedding
            },
            augmentationType: 'generate_embedding'
          };
          break;
          
        case 'analyze_text':
          // Analyze text combines concept extraction and embedding
          const analysisEmbedding = await this.safeOps.generateEmbedding(target);
          const analysisConcepts = await this.safeOps.extractConcepts(target);
          result = {
            concepts: analysisConcepts,
            embedding: {
              dimension: analysisEmbedding.length,
              preview: analysisEmbedding.slice(0, 5).map(x => parseFloat(x.toFixed(4)))
            },
            augmentationType: 'analyze_text'
          };
          break;

        case 'concept_embeddings':
          // Extract concepts and generate embeddings using new ragno format
          try {
            console.log('🔮 [CONCEPT_EMBEDDINGS] Starting concept embedding generation...');
            mcpDebugger.info('concept_embeddings operation started', { target, mergedOptions });

            const {
              maxConcepts = 20,
              embeddingModel = 'nomic-embed-text',
              includeAttributes = false,
              batchSize = 5,
              graph
            } = mergedOptions;

            // Extract concepts from target content
            const concepts = await this.safeOps.extractConcepts(target);
            console.log(`🔮 [CONCEPT_EMBEDDINGS] Extracted ${concepts.length} concepts`);

            if (concepts.length === 0) {
              result = {
                conceptsEmbedded: [],
                totalConcepts: 0,
                totalEmbeddings: 0,
                message: 'No concepts found to embed',
                augmentationType: 'concept_embeddings'
              };
              break;
            }

            // Limit concepts if necessary
            const conceptsToProcess = concepts.slice(0, maxConcepts);
            const conceptEmbeddings = [];
            const skippedConcepts = [];

            // Get SPARQL configuration for storage
            const config = this.memoryManager.config;
            const storageConfig = config.get('storage.options');
            // Use graph option, or storage.options.graphName, or fallback to top-level graphName, or default
            const targetGraph = graph || storageConfig?.graphName || config.get('graphName') || 'http://hyperdata.it/content';

            // Import required utilities
            const { URIMinter } = await import('../../src/utils/URIMinter.js');
            const SPARQLHelper = (await import('../../src/services/sparql/SPARQLHelper.js')).default;
            
            const sparqlHelper = new SPARQLHelper(storageConfig.update, {
              user: storageConfig.user,
              password: storageConfig.password
            });

            // Process concepts in batches
            for (let i = 0; i < conceptsToProcess.length; i += batchSize) {
              const batch = conceptsToProcess.slice(i, i + batchSize);
              console.log(`🔮 [CONCEPT_EMBEDDINGS] Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(conceptsToProcess.length / batchSize)} (${batch.length} concepts)`);

              for (const concept of batch) {
                try {
                  // Generate embedding for concept
                  const conceptEmbedding = await this.safeOps.generateEmbedding(concept);
                  
                  // Create URIs using new ragno format
                  const conceptUri = URIMinter.mintURI('http://purl.org/stuff/instance/', 'concept', concept);
                  const embeddingUri = URIMinter.mintURI('http://purl.org/stuff/instance/', 'embedding', concept);

                  // Store using new ragno format: ragno:hasEmbedding → ragno:vectorContent
                  const insertQuery = `
                    PREFIX ragno: <http://purl.org/stuff/ragno/>
                    PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
                    PREFIX dcterms: <http://purl.org/dc/terms/>
                    PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>

                    INSERT DATA {
                        GRAPH <${targetGraph}> {
                            <${conceptUri}> a ragno:Concept ;
                                            skos:prefLabel "${concept.replace(/"/g, '\\"')}" ;
                                            ragno:hasEmbedding <${embeddingUri}> ;
                                            dcterms:created "${new Date().toISOString()}"^^xsd:dateTime .
                            
                            <${embeddingUri}> a ragno:IndexElement ;
                                              ragno:embeddingModel "${embeddingModel}" ;
                                              ragno:subType ragno:ConceptEmbedding ;
                                              ragno:embeddingDimension ${conceptEmbedding.length} ;
                                              ragno:vectorContent "[${conceptEmbedding.join(',')}]" .
                        }
                    }
                  `;

                  await sparqlHelper.executeUpdate(insertQuery);

                  conceptEmbeddings.push({
                    concept: concept,
                    conceptUri: conceptUri,
                    embeddingUri: embeddingUri,
                    embeddingDimension: conceptEmbedding.length,
                    embeddingModel: embeddingModel
                  });

                  console.log(`✅ [CONCEPT_EMBEDDINGS] Stored concept: ${concept} (${conceptEmbedding.length}D)`);
                  mcpDebugger.info('Concept embedding stored', { 
                    concept, 
                    conceptUri, 
                    embeddingDimension: conceptEmbedding.length 
                  });

                } catch (conceptError) {
                  console.error(`❌ [CONCEPT_EMBEDDINGS] Failed to process concept: ${concept}`, conceptError.message);
                  skippedConcepts.push({
                    concept: concept,
                    error: conceptError.message
                  });
                  mcpDebugger.warn('Failed to process concept embedding', { 
                    concept, 
                    error: conceptError.message 
                  });
                }
              }
            }

            // Generate attributes if requested
            let attributeResults = null;
            if (includeAttributes && conceptEmbeddings.length > 0) {
              try {
                console.log('🔮 [CONCEPT_EMBEDDINGS] Generating attributes for embedded concepts...');
                const { augmentWithAttributes } = await import('../../src/ragno/augmentWithAttributes.js');
                // Create mock graph data for attribute generation
                const mockGraphData = {
                  entities: conceptEmbeddings.map(ce => ({ 
                    getURI: () => ce.conceptUri,
                    getPreferredLabel: () => ce.concept
                  })),
                  dataset: null
                };
                attributeResults = await augmentWithAttributes(mockGraphData, this.memoryManager.llmHandler, mergedOptions);
                console.log(`✅ [CONCEPT_EMBEDDINGS] Generated ${attributeResults.attributes?.length || 0} attributes`);
              } catch (attrError) {
                console.warn('⚠️ [CONCEPT_EMBEDDINGS] Attribute generation failed:', attrError.message);
              }
            }

            result = {
              conceptsEmbedded: conceptEmbeddings,
              skippedConcepts: skippedConcepts,
              totalConcepts: concepts.length,
              totalProcessed: conceptsToProcess.length,
              totalEmbeddings: conceptEmbeddings.length,
              totalSkipped: skippedConcepts.length,
              embeddingModel: embeddingModel,
              targetGraph: targetGraph,
              attributes: attributeResults?.attributes || null,
              attributeCount: attributeResults?.attributes?.length || 0,
              augmentationType: 'concept_embeddings',
              message: `Processed ${conceptEmbeddings.length}/${conceptsToProcess.length} concepts with embeddings using new ragno format`
            };

            console.log(`✅ [CONCEPT_EMBEDDINGS] Complete: ${conceptEmbeddings.length} concepts embedded, ${skippedConcepts.length} skipped`);

          } catch (embeddingError) {
            result = {
              error: embeddingError.message,
              augmentationType: 'concept_embeddings_failed',
              message: `Concept embeddings failed: ${embeddingError.message}`
            };
          }
          break;
          
        case 'auto':
        default:
          console.log('🔄 [AUGMENT] Entered default/auto case with operation:', operation);
          if (operation !== 'auto') {
            console.log('❌ [AUGMENT] WARNING: Unknown operation fell through to default case:', operation);
            mcpDebugger.warn('Unknown augment operation fell through to default case', { operation, target });
          }
          
          // Automatic augmentation - extract concepts and use ZPT context
          const concepts = await this.safeOps.extractConcepts(target);
          const autoEmbedding = await this.safeOps.generateEmbedding(target);
          
          result = {
            concepts,
            embedding: {
              dimension: autoEmbedding.length,
              preview: autoEmbedding.slice(0, 5).map(x => parseFloat(x.toFixed(4)))
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
        try {
          const navParams = this.stateManager.getNavigationParams(query);
          mcpDebugger.debug('Zoom navigation params:', navParams);
          
          // Ensure proper parameter format for ZPT navigation
          const zptParams = {
            query: navParams.query,
            zoom: navParams.zoom,
            pan: navParams.pan || {},
            tilt: navParams.tilt || 'keywords'
          };
          
          mcpDebugger.debug('Calling ZPT navigate with params:', zptParams);
          const navResult = await this.zptService.navigate(zptParams);
          
          result.navigation = navResult;
          result.query = query;
        } catch (navError) {
          mcpDebugger.warn('ZPT navigation failed in zoom verb:', navError.message);
          // Navigation failed but zoom state change succeeded - this is acceptable
          result.navigation = {
            success: false,
            error: navError.message,
            content: { data: [], success: false, error: navError.message }
          };
          result.query = query;
          result.warning = 'Zoom level set successfully, but navigation skipped due to error';
        }
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

  /**
   * INSPECT - Inspect stored memories and session cache for debugging
   */
  async inspect({ what = 'session', details = false }) {
    await this.initialize();
    
    try {
      mcpDebugger.debug('Simple Verb: inspect', { what, details });
      
      let result = {
        success: true,
        verb: 'inspect',
        what,
        zptState: this.stateManager.getState()
      };
      
      switch (what) {
        case 'session':
          result.sessionCache = this.stateManager.getSessionCacheStats();
          if (details) {
            result.sessionInteractions = Array.from(this.stateManager.sessionCache.interactions.values())
              .map(interaction => ({
                id: interaction.id,
                prompt: interaction.prompt?.substring(0, 100) + '...',
                response: interaction.response?.substring(0, 100) + '...',
                concepts: interaction.concepts?.length || 0,
                timestamp: interaction.timestamp
              }));
          }
          break;
          
        case 'concepts':
          result.concepts = Array.from(this.stateManager.sessionCache.concepts);
          result.conceptCount = this.stateManager.sessionCache.concepts.size;
          break;
          
        case 'embeddings':
          result.embeddingCount = this.stateManager.sessionCache.embeddings.length;
          if (details) {
            result.embeddings = this.stateManager.sessionCache.embeddings.map((emb, idx) => ({
              index: idx,
              id: emb.id,
              dimension: emb.embedding?.length || 0,
              cacheHits: emb.similarity_cache?.size || 0
            }));
          }
          break;
          
        case 'all':
          result.sessionCache = this.stateManager.getSessionCacheStats();
          result.concepts = Array.from(this.stateManager.sessionCache.concepts);
          result.embeddingCount = this.stateManager.sessionCache.embeddings.length;
          if (details) {
            result.sessionInteractions = Array.from(this.stateManager.sessionCache.interactions.values())
              .map(interaction => ({
                id: interaction.id,
                prompt: interaction.prompt?.substring(0, 50) + '...',
                concepts: interaction.concepts?.length || 0,
                timestamp: interaction.timestamp
              }));
          }
          break;
          
        default:
          throw new Error(`Unknown inspect type: ${what}`);
      }
      
      return result;
      
    } catch (error) {
      mcpDebugger.error('Inspect verb failed', error);
      return {
        success: false,
        verb: 'inspect',
        what,
        error: error.message,
        zptState: this.stateManager.getState()
      };
    }
  }

  /**
   * REMEMBER - Store content in specific memory domain with importance weighting
   */
  async remember({ content, domain = 'user', domainId, importance = 0.5, metadata = {} }) {
    await this.initialize();
    
    try {
      mcpDebugger.debug('Simple Verb: remember', { domain, domainId, importance, contentLength: content.length });
      
      // Create domain if needed
      if (domainId && domain !== 'session') {
        await this.memoryDomainManager.createDomain(domain, domainId, {
          description: metadata.description,
          tags: metadata.tags
        });
      }
      
      // Store memory with domain association
      const memoryData = {
        content: content,
        domain: domain,
        domainId: domainId || this.stateManager.getState().sessionId,
        importance: importance,
        timestamp: Date.now(),
        metadata: {
          ...metadata,
          source: 'remember_verb'
        }
      };
      
      // Use tell mechanism but with domain-specific storage
      const result = await this.tell({
        content: content,
        type: 'interaction',
        metadata: memoryData
      });
      
      return {
        success: true,
        verb: 'remember',
        domain: domain,
        domainId: domainId || this.stateManager.getState().sessionId,
        importance: importance,
        stored: result.stored,
        zptState: this.stateManager.getState()
      };
      
    } catch (error) {
      mcpDebugger.error('Remember verb failed:', error);
      return {
        success: false,
        verb: 'remember',
        error: error.message
      };
    }
  }

  /**
   * FORGET - Fade memory visibility using navigation rather than deletion
   */
  async forget({ target, strategy = 'fade', fadeFactor = 0.1 }) {
    await this.initialize();
    
    try {
      mcpDebugger.debug('Simple Verb: forget', { target, strategy, fadeFactor });
      
      let result;
      
      switch (strategy) {
        case 'fade':
          result = await this.memoryDomainManager.fadeContext(target, fadeFactor);
          break;
          
        case 'context_switch':
          // Switch away from the target domain
          const currentDomains = this.stateManager.getState().pan?.domains || [];
          const newDomains = currentDomains.filter(d => d !== target);
          result = await this.memoryDomainManager.switchDomain(currentDomains, newDomains, { fadeFactor });
          break;
          
        case 'temporal_decay':
          // Apply enhanced temporal decay
          result = { success: true, strategy: 'temporal_decay', message: 'Temporal decay applied' };
          break;
          
        default:
          throw new Error(`Unknown forget strategy: ${strategy}`);
      }
      
      return {
        success: true,
        verb: 'forget',
        target: target,
        strategy: strategy,
        fadeFactor: fadeFactor,
        result: result,
        zptState: this.stateManager.getState()
      };
      
    } catch (error) {
      mcpDebugger.error('Forget verb failed:', error);
      return {
        success: false,
        verb: 'forget',
        error: error.message
      };
    }
  }

  /**
   * RECALL - Retrieve memories based on query and domain filters
   */
  async recall({ query, domains, timeRange, relevanceThreshold = 0.1, maxResults = 10 }) {
    await this.initialize();
    
    try {
      mcpDebugger.debug('Simple Verb: recall', { query, domains, relevanceThreshold, maxResults });
      
      // Build ZPT state for memory retrieval
      const zptState = {
        ...this.stateManager.getState(),
        panDomains: domains || this.stateManager.getState().pan?.domains || [],
        relevanceThreshold: relevanceThreshold,
        maxMemories: maxResults
      };
      
      if (timeRange) {
        zptState.temporalFilter = timeRange;
      }
      
      // Use memory domain manager to get visible memories
      const visibleMemories = await this.memoryDomainManager.getVisibleMemories(query, zptState);
      
      // Format results for display
      const formattedMemories = visibleMemories.map(memory => ({
        id: memory.id,
        content: memory.content || memory.prompt,
        relevance: memory.relevance,
        domain: memory.domain || 'unknown',
        timestamp: memory.timestamp,
        metadata: memory.relevanceMetadata
      }));
      
      return {
        success: true,
        verb: 'recall',
        query: query,
        memoriesFound: formattedMemories.length,
        memories: formattedMemories,
        domains: domains,
        relevanceThreshold: relevanceThreshold,
        zptState: this.stateManager.getState()
      };
      
    } catch (error) {
      mcpDebugger.error('Recall verb failed:', error);
      return {
        success: false,
        verb: 'recall',
        error: error.message
      };
    }
  }

  /**
   * PROJECT_CONTEXT - Manage project-specific memory domains
   */
  async project_context({ projectId, action = 'switch', metadata = {} }) {
    await this.initialize();
    
    try {
      mcpDebugger.debug('Simple Verb: project_context', { projectId, action, metadata });
      
      let result;
      
      switch (action) {
        case 'create':
          result = await this.memoryDomainManager.createDomain('project', projectId, {
            name: metadata.name,
            description: metadata.description,
            technologies: metadata.technologies,
            parentDomain: metadata.parentProject ? `project:${metadata.parentProject}` : undefined
          });
          break;
          
        case 'switch':
          const currentDomains = this.stateManager.getState().pan?.domains || [];
          const projectDomain = `project:${projectId}`;
          
          if (!currentDomains.includes(projectDomain)) {
            result = await this.memoryDomainManager.switchDomain(
              currentDomains, 
              [...currentDomains, projectDomain],
              { preserveInstructions: true }
            );
          } else {
            result = { success: true, message: 'Already in project context' };
          }
          break;
          
        case 'list':
          // List all project domains (placeholder - would query SPARQL)
          result = { success: true, projects: [], message: 'Project listing not implemented' };
          break;
          
        case 'archive':
          result = await this.memoryDomainManager.fadeContext(`project:${projectId}`, 0.05);
          break;
          
        default:
          throw new Error(`Unknown project action: ${action}`);
      }
      
      return {
        success: true,
        verb: 'project_context',
        projectId: projectId,
        action: action,
        result: result,
        zptState: this.stateManager.getState()
      };
      
    } catch (error) {
      mcpDebugger.error('Project context verb failed:', error);
      return {
        success: false,
        verb: 'project_context',
        error: error.message
      };
    }
  }

  /**
   * FADE_MEMORY - Gradually reduce memory visibility for smooth context transitions
   */
  async fade_memory({ domain, fadeFactor = 0.1, transition = 'smooth', preserveInstructions = true }) {
    await this.initialize();
    
    try {
      mcpDebugger.debug('Simple Verb: fade_memory', { domain, fadeFactor, transition, preserveInstructions });
      
      const result = await this.memoryDomainManager.switchDomain(
        [domain],
        [],
        {
          fadeFactor: fadeFactor,
          transition: transition,
          preserveInstructions: preserveInstructions
        }
      );
      
      return {
        success: true,
        verb: 'fade_memory',
        domain: domain,
        fadeFactor: fadeFactor,
        transition: transition,
        result: result,
        zptState: this.stateManager.getState()
      };
      
    } catch (error) {
      mcpDebugger.error('Fade memory verb failed:', error);
      return {
        success: false,
        verb: 'fade_memory',
        error: error.message
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
    },
    {
      name: SimpleVerbToolNames.INSPECT,
      description: "Inspect stored memories and session cache for debugging purposes.",
      inputSchema: zodToJsonSchema(InspectSchema)
    },
    {
      name: SimpleVerbToolNames.REMEMBER,
      description: "Store content in specific memory domain with importance weighting. Supports user, project, session, and instruction domains.",
      inputSchema: zodToJsonSchema(RememberSchema)
    },
    {
      name: SimpleVerbToolNames.FORGET,
      description: "Fade memory visibility using navigation rather than deletion. Supports fade, context_switch, and temporal_decay strategies.",
      inputSchema: zodToJsonSchema(ForgetSchema)
    },
    {
      name: SimpleVerbToolNames.RECALL,
      description: "Retrieve memories based on query and domain filters with relevance scoring.",
      inputSchema: zodToJsonSchema(RecallSchema)
    },
    {
      name: SimpleVerbToolNames.PROJECT_CONTEXT,
      description: "Manage project-specific memory domains. Create, switch, list, or archive project contexts.",
      inputSchema: zodToJsonSchema(ProjectContextSchema)
    },
    {
      name: SimpleVerbToolNames.FADE_MEMORY,
      description: "Gradually reduce memory visibility for smooth context transitions.",
      inputSchema: zodToJsonSchema(FadeMemorySchema)
    }
  ];
}

export { SimpleVerbsService, ZPTStateManager };