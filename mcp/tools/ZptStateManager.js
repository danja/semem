/**
 * ZPT State Manager
 * Manages Zoom-Pan-Tilt navigation state and session cache for Simple Verbs
 */

import { SafeOperations } from '../lib/safe-operations.js';
import { logOperation } from './VerbsLogger.js';

/**
 * ZPT State Manager - Handles navigation state persistence and session caching
 */
export class ZPTStateManager {
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
    logOperation('debug', 'zoom', 'ZPT State - Zoom updated', { zoom: level, query });
    
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
    logOperation('debug', 'pan', 'ZPT State - Pan updated', { pan: this.state.pan });
    
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
    logOperation('debug', 'tilt', 'ZPT State - Tilt updated', { tilt: style, query });
    
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
    
    logOperation('debug', 'session_cache', 'Session cache updated', { 
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
    logOperation('info', 'zpt_state', 'ZPT State reset to defaults');
    
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
      logOperation('warn', 'zpt_state', 'Failed to persist ZPT state', { error: error.message });
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