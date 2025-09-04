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
      console.log('🔥 CONSOLE: SafeOperations.retrieveMemories - invalid query, returning empty array');
      return []; // Return empty array for invalid queries
    }
    
    console.log('🔥 CONSOLE: SafeOperations.retrieveMemories called', { query, threshold, excludeLastN });
    
    const results = await this.memoryManager.retrieveRelevantInteractions(query.trim(), threshold, excludeLastN);
    
    console.log('🔥 CONSOLE: SafeOperations.retrieveMemories received from MemoryManager', { 
      resultsCount: results?.length || 0, 
      hasResults: !!results && results.length > 0,
      firstResult: results?.[0] ? { similarity: results[0].similarity, prompt: results[0].prompt?.substring(0, 50) } : null
    });
    
    return results;
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
      const error = new Error('Both prompt and response are required');
      mcpDebugger.error('SafeOperations.storeInteraction - Invalid parameters', {
        promptProvided: !!prompt,
        responseProvided: !!response,
        metadata
      });
      throw error;
    }
    
    mcpDebugger.debug('SafeOperations.storeInteraction - Starting storage operation', {
      promptLength: prompt.length,
      responseLength: response.length,
      metadata
    });
    
    try {
      const result = await this.memoryManager.storeInteraction(prompt, response, metadata);
      mcpDebugger.info('SafeOperations.storeInteraction - Storage completed successfully', {
        success: true,
        resultKeys: result ? Object.keys(result) : null
      });
      return result;
    } catch (error) {
      mcpDebugger.error('SafeOperations.storeInteraction - Storage failed', {
        error: error.message,
        stack: error.stack,
        promptLength: prompt.length,
        responseLength: response.length
      });
      throw error;
    }
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
      mcpDebugger.warn('SafeOperations.searchSimilar - Invalid query parameters', {
        queryText: queryText,
        queryType: typeof queryText,
        isEmpty: !queryText?.trim()
      });
      return []; // Return empty array for invalid queries
    }
    
    mcpDebugger.info('SafeOperations.searchSimilar - Starting similarity search', {
      queryPreview: queryText.substring(0, 100),
      fullQueryLength: queryText.length,
      limit,
      threshold
    });
    
    const startTime = Date.now();
    const similarityThreshold = Math.round(threshold * 100);
    mcpDebugger.debug('🔍 Searching for similar content', { 
      queryLength: queryText.trim().length, 
      limit, 
      threshold,
      similarityThreshold 
    });
    
    try {
      // Search both interactions and chunks for comprehensive results
      let allResults = [];
      
      // 1. Search interactions using MemoryManager (proven method)
      // Convert threshold from 0-1 scale to percentage (0-100 scale)
      mcpDebugger.debug('SafeOperations.searchSimilar - Calling MemoryManager for interactions', {
        similarityThreshold,
        limit,
        queryLength: queryText.trim().length
      });
      const interactions = await this.memoryManager.retrieveRelevantInteractions(queryText.trim(), similarityThreshold, 0, limit);
      mcpDebugger.debug('SafeOperations.searchSimilar - MemoryManager results received', {
        interactionsCount: interactions?.length || 0,
        hasValidResults: interactions && Array.isArray(interactions) && interactions.length > 0
      });
      allResults.push(...interactions);
      
      // 2. REMOVED: Duplicate store search that was causing result interference
      // MemoryManager.retrieveRelevantInteractions already handles SPARQL store search
      mcpDebugger.debug('SafeOperations.searchSimilar - Using MemoryManager only (duplicate search removed)');
      
      // Normalize similarity scores before combining (fix scale mismatch)
      // First, separate results by source type to normalize separately
      const memoryManagerResults = allResults.filter(r => r.similarity > 1);
      const sparqlResults = allResults.filter(r => r.similarity <= 1);
      
      // Find max for memory manager results for proper scaling
      const maxMemoryScore = memoryManagerResults.length > 0 ? 
        Math.max(...memoryManagerResults.map(r => r.similarity)) : 0;
      
      console.log('🔥 CONSOLE: Normalizing scores separately', {
        memoryManagerCount: memoryManagerResults.length,
        sparqlCount: sparqlResults.length,
        maxMemoryScore,
        memoryRange: memoryManagerResults.length > 0 ? [
          Math.min(...memoryManagerResults.map(r => r.similarity)),
          maxMemoryScore
        ] : 'none',
        sparqlRange: sparqlResults.length > 0 ? [
          Math.min(...sparqlResults.map(r => r.similarity)),
          Math.max(...sparqlResults.map(r => r.similarity))
        ] : 'none'
      });
      
      const normalizedResults = allResults.map(result => {
        let normalizedSimilarity = result.similarity || 0;
        
        if (normalizedSimilarity > 1) {
          // Memory Manager results: normalize by max score to 0-1 range
          normalizedSimilarity = maxMemoryScore > 0 ? normalizedSimilarity / maxMemoryScore : 0;
        }
        // SPARQL results are already in 0-1 range, keep as-is
        
        return {
          ...result,
          similarity: normalizedSimilarity,
          originalSimilarity: result.similarity
        };
      });
      
      console.log('🔥 CONSOLE: SafeOperations similarity normalization sample', {
        originalFirst: allResults[0] ? allResults[0].similarity : 'none',
        normalizedFirst: normalizedResults[0] ? normalizedResults[0].similarity : 'none',
        originalADHD: allResults.find(r => r.prompt?.includes('ADHD'))?.similarity || 'not found',
        normalizedADHD: normalizedResults.find(r => r.prompt?.includes('ADHD'))?.similarity || 'not found'
      });
      
      // Filter out ZPT State Changes and other system metadata before sorting
      const filteredResults = normalizedResults.filter(result => {
        // Filter out ZPT State Changes - these are system metadata, not user content
        if (result.prompt && result.prompt.includes('ZPT State Change:')) {
          console.log('🔥 CONSOLE: Filtering out ZPT State Change', { 
            prompt: result.prompt.substring(0, 50),
            similarity: result.similarity 
          });
          return false;
        }
        
        // Filter out other system-generated content if needed
        if (result.prompt && result.prompt.includes('System:')) {
          return false;
        }
        
        return true;
      });
      
      console.log('🔥 CONSOLE: Content filtering results', {
        originalCount: normalizedResults.length,
        filteredCount: filteredResults.length,
        removedItems: normalizedResults.length - filteredResults.length
      });
      
      // Remove duplicates and sort by normalized similarity
      const uniqueResults = Array.from(
        new Map(filteredResults.map(r => [`${r.prompt}_${r.response}`, r])).values()
      ).sort((a, b) => (b.similarity || 0) - (a.similarity || 0));
      
      // Limit to requested number
      const results = uniqueResults.slice(0, limit);
      
      mcpDebugger.info('SafeOperations.searchSimilar - Search completed', { 
        allResultsCount: allResults.length, 
        uniqueResultsCount: uniqueResults.length, 
        finalResultsCount: results.length,
        hasResults: results.length > 0,
        duration: Date.now() - startTime + 'ms',
        firstResult: results[0] ? { 
          similarity: results[0].similarity, 
          prompt: results[0].prompt?.substring(0, 50),
          hasOutput: !!results[0].output,
          hasResponse: !!results[0].response,
          hasContent: !!results[0].content,
          keys: Object.keys(results[0])
        } : 'no results'
      });
      
      const duration = Date.now() - startTime;
      
      mcpDebugger.debug('✅ Similar content search completed', { 
        duration: duration + 'ms',
        interactionsFound: interactions.length,
        chunksFound: allResults.length - interactions.length,
        totalUnique: results.length,
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