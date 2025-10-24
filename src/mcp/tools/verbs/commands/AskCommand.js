/**
 * AskCommand - Command for querying semantic memory with context and enhancements
 *
 * Implements the Command Pattern to replace the ask method.
 * Handles context retrieval, external enhancements, and response generation.
 */

import { BaseVerbCommand } from './BaseVerbCommand.js';
import { AskSchema } from '../../VerbSchemas.js';
import { logOperation, logPerformance, verbsLogger } from '../../VerbsLogger.js';
import { AskOperationTimer } from '../../../../utils/PerformanceTiming.js';
import { SPARQL_CONFIG } from '../../../../../config/preferences.js';

export class AskCommand extends BaseVerbCommand {
  constructor() {
    super('ask');
    this.schema = AskSchema;
  }

  /**
   * Execute ask command
   * @param {Object} params - Command parameters
   * @param {string} params.question - Question to ask
   * @param {string} params.mode - Query mode (standard, comprehensive)
   * @param {boolean} params.useContext - Whether to use local context
   * @param {boolean} params.useHyDE - Whether to use HyDE enhancement
   * @param {boolean} params.useWikipedia - Whether to use Wikipedia enhancement
   * @param {boolean} params.useWikidata - Whether to use Wikidata enhancement
   * @param {boolean} params.useWebSearch - Whether to use web search enhancement
   * @param {number} params.threshold - Similarity threshold for context retrieval
   * @returns {Promise<Object>} Command result
   */
  async execute(params) {
    const validatedParams = this.validateParameters(params);
    const {
      question,
      mode = 'standard',
      useContext = true,
      useHyDE = false,
      useWikipedia = false,
      useWikidata = false,
      useWebSearch = false,
      threshold
    } = validatedParams;

    const askTimer = new AskOperationTimer(question);
    askTimer.startPhase('initialization');
    const startTime = Date.now();

    try {
      this.logOperation('info', 'Ask operation started', {
        questionPreview: question.substring(0, 100) + (question.length > 100 ? '...' : ''),
        questionLength: question.length,
        mode,
        useContext,
        useHyDE,
        useWikipedia,
        useWikidata,
        useWebSearch
      });

      askTimer.endPhase('initialization');
      askTimer.startPhase('context_processing');

      // Phase 1: Enhancement processing
      const enhancementResults = await this.processEnhancements(question, {
        useHyDE,
        useWikipedia,
        useWikidata,
        useWebSearch
      }, askTimer);

      // Phase 2: Context processing and response generation
      const hybridResult = await this.processContextAndGenerate(question, {
        useContext,
        threshold,
        enhancementResults,
        startTime
      });

      // Phase 3: Finalize response
      return await this.finalizeResponse(question, mode, hybridResult, askTimer, startTime);

    } catch (error) {
      this.logOperation('error', 'Ask operation failed - throwing error instead of masking', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Process external enhancements if requested
   * @param {string} question - The question
   * @param {Object} enhancementOptions - Enhancement flags
   * @param {AskOperationTimer} askTimer - Performance timer
   * @returns {Promise<Object|null>} Enhancement results or null
   * @private
   */
  async processEnhancements(question, enhancementOptions, askTimer) {
    const { useHyDE, useWikipedia, useWikidata, useWebSearch } = enhancementOptions;

    if (!useHyDE && !useWikipedia && !useWikidata && !useWebSearch) {
      return null;
    }

    askTimer.startPhase('enhancement_processing');
    try {
      verbsLogger.info('🔍 Running query enhancement with EnhancementCoordinator', {
        useHyDE, useWikipedia, useWikidata, useWebSearch
      });

      const enhancementResults = await this.enhancementCoordinator.enhanceQuery(question, {
        useHyDE,
        useWikipedia,
        useWikidata,
        useWebSearch
      });

      verbsLogger.info('✅ Enhancement completed successfully', {
        hasResults: !!enhancementResults,
        contextLength: enhancementResults?.context?.combinedPrompt?.length || 0,
        enhancementKeys: enhancementResults ? Object.keys(enhancementResults) : [],
        hasCombinedContext: !!enhancementResults?.context?.combinedPrompt
      });

      return enhancementResults;

    } catch (enhancementError) {
      verbsLogger.error('❌ Enhancement failed:', enhancementError.message);
      // Continue without enhancement - don't fail the entire request
      return null;
    } finally {
      askTimer.endPhase('enhancement_processing');
    }
  }

  /**
   * Process context retrieval and generate response
   * @param {string} question - The question
   * @param {Object} options - Processing options
   * @returns {Promise<Object>} Hybrid result with answer and context info
   * @private
   */
  async processContextAndGenerate(question, options) {
    const { useContext, threshold, enhancementResults, startTime } = options;

    if (useContext && this.memoryDomainManager) {
      return await this.processWithLocalContext(question, threshold, enhancementResults, startTime);
    } else {
      return await this.processWithoutLocalContext(question, enhancementResults, startTime);
    }
  }

  /**
   * Process query with local context retrieval
   * @private
   */
  async processWithLocalContext(question, threshold, enhancementResults, startTime) {
    try {
      // Prepare ZPT state for context retrieval
      const zptState = {
        ...this.stateManager.getState(),
        focusQuery: question,
        panDomains: [],
        relevanceThreshold: threshold || SPARQL_CONFIG.SIMILARITY.DEFAULT_THRESHOLD,
        maxMemories: 10
      };

      // Generate embedding for semantic similarity
      try {
        const questionEmbedding = await this.embeddingHandler.generateEmbedding(question);
        zptState.focusEmbedding = questionEmbedding;
      } catch (error) {
        verbsLogger.warn(`Failed to generate question embedding: ${error.message}`);
        // Continue without embedding - will fallback to text similarity
      }

      // Retrieve memories using domain manager
      const searchResults = await this.memoryDomainManager.getVisibleMemories(question, zptState);

      verbsLogger.info('Context retrieved successfully', {
        resultsCount: searchResults.length
      });

      // Generate response with available context
      const answer = await this.generateContextualResponse(question, searchResults, enhancementResults);

      return {
        success: true,
        answer,
        contextItems: searchResults.length + (enhancementResults ? 1 : 0),
        sessionResults: searchResults.length,
        persistentResults: searchResults.length,
        memories: searchResults.length,
        localContextResults: searchResults,
        enhancementResults: enhancementResults ? [enhancementResults] : [],
        enhancementUsed: !!enhancementResults,
        localContextUsed: searchResults.length > 0,
        selectedStrategy: searchResults.length > 0 || enhancementResults ? 'hybrid_enhanced' : 'no_context',
        queryTime: Date.now() - startTime
      };

    } catch (error) {
      verbsLogger.error('Context retrieval error:', error);
      return {
        success: false,
        answer: `I encountered an error while searching for information: ${error.message}`,
        error: error.message,
        contextItems: 0,
        sessionResults: 0,
        persistentResults: 0,
        memories: 0,
        localContextResults: [],
        selectedStrategy: 'error',
        queryTime: Date.now() - startTime
      };
    }
  }

  /**
   * Process query without local context (enhancement only or no context)
   * @private
   */
  async processWithoutLocalContext(question, enhancementResults, startTime) {
    let answer = `I don't have any context information to answer: ${question}`;

    if (enhancementResults?.context?.combinedPrompt) {
      // Use enhancement results even without local context
      const prompt = await this.templateLoader.loadAndInterpolate('mcp', 'ask-with-external-context', {
        externalContext: enhancementResults.context.combinedPrompt,
        question: question
      });

      try {
        answer = await this.safeOps.generateResponse(prompt);
      } catch (llmError) {
        verbsLogger.error('LLM generation error with enhancement only:', llmError);
        answer = `I found external information but could not generate a response: ${llmError.message}`;
      }
    }

    return {
      success: true,
      answer,
      contextItems: enhancementResults ? 1 : 0,
      sessionResults: 0,
      persistentResults: 0,
      memories: 0,
      localContextResults: [],
      enhancementResults: enhancementResults ? [enhancementResults] : [],
      enhancementUsed: !!enhancementResults,
      localContextUsed: false,
      selectedStrategy: enhancementResults ? 'enhancement_only' : 'no_context',
      queryTime: Date.now() - startTime
    };
  }

  /**
   * Generate response using available context
   * @private
   */
  async generateContextualResponse(question, searchResults, enhancementResults) {
    const hasLocalContext = searchResults.length > 0;
    const hasEnhancementContext = enhancementResults?.context?.combinedPrompt;

    if (!hasLocalContext && !hasEnhancementContext) {
      return `I don't have any relevant information to answer: ${question}`;
    }

    const promptParts = [];

    // Add local context if available
    if (hasLocalContext) {
      const contextText = searchResults.map(result =>
        result.content || result.prompt || result.response
      ).join('\n\n');
      promptParts.push(`Personal knowledge context:\n${contextText}`);
    }

    // Add enhancement context if available
    if (hasEnhancementContext) {
      promptParts.push(`External knowledge context:\n${enhancementResults.context.combinedPrompt}`);
    }

    const fullContext = promptParts.join('\n\n---\n\n');
    const prompt = await this.templateLoader.loadAndInterpolate('mcp', 'ask-with-hybrid-context', {
      fullContext: fullContext,
      question: question
    });

    try {
      return await this.safeOps.generateResponse(prompt);
    } catch (llmError) {
      verbsLogger.error('LLM generation error:', llmError);
      return `I found relevant information but could not generate a response: ${llmError.message}`;
    }
  }

  /**
   * Finalize and format the response
   * @private
   */
  async finalizeResponse(question, mode, hybridResult, askTimer, startTime) {
    verbsLogger.info('Simple-verbs ask() received result', {
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
      }
    });

    // Update state with this query
    this.stateManager.state.lastQuery = question;

    const totalDuration = Date.now() - startTime;
    this.logOperation('info', '✅ Hybrid Ask operation complete', {
      totalDuration: totalDuration + 'ms',
      success: hybridResult.success,
      mergeStrategy: hybridResult.mergeStrategy,
      enhancementUsed: hybridResult.enhancementUsed,
      localContextUsed: hybridResult.localContextUsed
    });

    // Complete timing and log performance data
    const perfData = askTimer.complete();

    logPerformance('ask', {
      duration: perfData.totalDuration,
      phases: perfData.phases,
      success: true,
      questionLength: question.length,
      contextItems: (hybridResult.localContextResults?.length || 0) + (hybridResult.enhancementResults?.length || 0),
      mode
    });

    // Transform hybrid result to standard ask response format
    const llmInfo = this.safeOps.getLastLLMCallInfo?.() || null;

    return this.createSuccessResponse({
      content: hybridResult.answer,  // Include content for MCP protocol compatibility
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
      sessionCacheStats: this.stateManager.getSessionCacheStats(),
      performance: perfData
    }, llmInfo ? { llm: llmInfo } : {});
  }
}

export default AskCommand;
