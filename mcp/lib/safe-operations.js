/**
 * Safe operation wrappers for MCP tools
 * Handle edge cases without modifying core components
 */

import { mcpDebugger } from './debug-utils.js';

export class SafeOperations {
  constructor(memoryManager) {
    this.memoryManager = memoryManager;
  }

  /**
   * Safely retrieve memories with input validation
   */
  async retrieveMemories(query, threshold = 0.7, excludeLastN = 0) {
    if (!query || typeof query !== 'string' || !query.trim()) {
      return []; // Return empty array for invalid queries
    }
    
    return await this.memoryManager.retrieveRelevantInteractions(query.trim(), threshold, excludeLastN);
  }

  /**
   * Extract concepts with proper error handling
   */
  async extractConcepts(text) {
    if (!text || typeof text !== 'string' || !text.trim()) {
      throw new Error('Invalid text parameter: must be a non-empty string');
    }
    
    const concepts = await this.memoryManager.llmHandler.extractConcepts(text.trim());
    
    // Additional parsing for MCP - handle LLM responses with prefixes like "[JSON]"
    if (Array.isArray(concepts)) {
      return concepts;
    }
    
    // If not already parsed, try to extract JSON array from string response
    if (typeof concepts === 'string') {
      return this.extractJsonArrayFromResponse(concepts);
    }
    
    throw new Error(`Unexpected concepts response format: ${typeof concepts}`);
  }

  /**
   * Extract JSON array from LLM response with robust error handling
   */
  extractJsonArrayFromResponse(response) {
    // Input validation
    if (!response || typeof response !== 'string') {
      throw new Error(`Invalid response in extractJsonArrayFromResponse: expected string, got ${typeof response}`);
    }
    
    // Remove the [JSON] prefix if present
    let cleanResponse = response.replace(/^\[JSON\]\s*/, '');
    
    // Look for the first complete JSON array structure
    let bracketDepth = 0;
    let startIndex = -1;
    let inString = false;
    let escapeNext = false;
    
    for (let i = 0; i < cleanResponse.length; i++) {
      const char = cleanResponse[i];
      
      if (escapeNext) {
        escapeNext = false;
        continue;
      }
      
      if (char === '\\') {
        escapeNext = true;
        continue;
      }
      
      if (char === '"' && !escapeNext) {
        inString = !inString;
        continue;
      }
      
      if (inString) continue;
      
      if (char === '[') {
        if (bracketDepth === 0) {
          startIndex = i;
        }
        bracketDepth++;
      } else if (char === ']') {
        bracketDepth--;
        if (bracketDepth === 0 && startIndex !== -1) {
          const jsonCandidate = cleanResponse.substring(startIndex, i + 1);
          try {
            const parsed = JSON.parse(jsonCandidate);
            // If it's a nested array structure, flatten it
            if (Array.isArray(parsed) && parsed.length > 0 && Array.isArray(parsed[0])) {
              return parsed.flat();
            }
            return parsed;
          } catch (e) {
            // Continue searching for a valid JSON structure
            startIndex = -1;
            continue;
          }
        }
      }
    }
    
    throw new Error('No valid JSON array found in LLM response');
  }

  /**
   * Safely store interaction
   */
  async storeInteraction(prompt, response, metadata = {}) {
    if (!prompt || !response) {
      throw new Error('Both prompt and response are required');
    }
    return await this.memoryManager.storeInteraction(prompt, response, metadata);
  }

  /**
   * Safely generate embedding
   */
  async generateEmbedding(text) {
    if (!text || typeof text !== 'string') {
      throw new Error('Text is required for embedding generation');
    }
    
    const startTime = Date.now();
    mcpDebugger.debug('🧮 Generating embedding', { textLength: text.length });
    
    try {
      const embedding = await this.memoryManager.generateEmbedding(text);
      const duration = Date.now() - startTime;
      mcpDebugger.debug('✅ Embedding generated successfully', { 
        duration: duration + 'ms', 
        embeddingLength: embedding?.length || 0 
      });
      return embedding;
    } catch (error) {
      const duration = Date.now() - startTime;
      mcpDebugger.error('❌ Embedding generation failed', { 
        duration: duration + 'ms', 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Safely generate response
   */
  async generateResponse(prompt, context = [], options = {}) {
    if (!prompt || typeof prompt !== 'string') {
      throw new Error('Prompt is required for response generation');
    }
    
    const startTime = Date.now();
    const contextLength = typeof context === 'string' ? context.length : JSON.stringify(context).length;
    mcpDebugger.debug('🤖 Generating LLM response', { 
      promptLength: prompt.length, 
      contextLength,
      hasContext: !!context && contextLength > 0
    });
    
    try {
      const response = await this.memoryManager.llmHandler.generateResponse(prompt, context, options);
      const duration = Date.now() - startTime;
      mcpDebugger.debug('✅ LLM response generated successfully', { 
        duration: duration + 'ms',
        responseLength: response?.length || 0
      });
      return response;
    } catch (error) {
      const duration = Date.now() - startTime;
      mcpDebugger.error('❌ LLM response generation failed', { 
        duration: duration + 'ms', 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Search for similar content using text query (uses proven MemoryManager method)
   */
  async searchSimilar(queryText, limit = 10, threshold = 0.7) {
    if (!queryText || typeof queryText !== 'string' || !queryText.trim()) {
      return []; // Return empty array for invalid queries
    }
    
    const startTime = Date.now();
    const similarityThreshold = Math.round(threshold * 100);
    mcpDebugger.debug('🔍 Searching for similar content', { 
      queryLength: queryText.trim().length, 
      limit, 
      threshold,
      similarityThreshold 
    });
    
    try {
      // Use the MemoryManager's proven retrieveRelevantInteractions method
      // Convert threshold from 0-1 scale to percentage (0-100 scale) 
      const results = await this.memoryManager.retrieveRelevantInteractions(queryText.trim(), similarityThreshold, 0, limit);
      const duration = Date.now() - startTime;
      
      mcpDebugger.debug('✅ Similar content search completed', { 
        duration: duration + 'ms',
        resultsFound: results.length,
        topSimilarity: results[0]?.similarity || 0
      });
      
      return results;
    } catch (error) {
      const duration = Date.now() - startTime;
      mcpDebugger.error('❌ Similar content search failed', { 
        duration: duration + 'ms', 
        error: error.message 
      });
      throw error;
    }
  }
}