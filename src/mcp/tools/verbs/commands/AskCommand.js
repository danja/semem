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
import ContextWindowManager from '../../../../ContextWindowManager.js';

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
      const contextConfig = this.getContextConfig();
      // Prepare ZPT state for context retrieval
      const baseState = this.stateManager.getState();
      const zptState = {
        ...baseState,
        focusQuery: question,
        pan: {
          ...baseState.pan,
          domains: Array.isArray(baseState.pan?.domains) ? baseState.pan.domains : []
        },
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

      if (!this.zptService) {
        throw new Error('ZPT service unavailable for context retrieval');
      }

      const navResult = await this.zptService.navigate({
        query: question,
        zoom: zptState.zoom,
        pan: zptState.pan,
        tilt: zptState.tilt
      });

      if (!navResult?.success || !Array.isArray(navResult.content?.data)) {
        throw new Error('ZPT navigation failed to return context data');
      }

      const searchResults = navResult.content.data
        .map(item => ({
          ...item,
          content: item.content || item.label || item.description || item.text || ''
        }))
        .filter(item => item.content);

      const limitedResults = this.limitContextResults(searchResults, contextConfig);

      verbsLogger.info('Context retrieved successfully', {
        resultsCount: limitedResults.length
      });

      // Generate response with available context
      const answer = await this.generateContextualResponse(
        question,
        limitedResults,
        enhancementResults,
        zptState.tilt,
        contextConfig
      );

      return {
        success: true,
        answer,
        contextItems: limitedResults.length + (enhancementResults ? 1 : 0),
        sessionResults: limitedResults.length,
        persistentResults: limitedResults.length,
        memories: limitedResults.length,
        localContextResults: limitedResults,
        enhancementResults: enhancementResults ? [enhancementResults] : [],
        enhancementUsed: !!enhancementResults,
        localContextUsed: limitedResults.length > 0,
        selectedStrategy: limitedResults.length > 0 || enhancementResults ? 'hybrid_enhanced' : 'no_context',
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
      const contextConfig = this.getContextConfig();
      let externalContext = this.applyContextWindow(
        enhancementResults.context.combinedPrompt,
        contextConfig
      );
      externalContext = await this.fitContextToPromptBudget('ask-with-external-context', {
        externalContext,
        question
      }, 'externalContext', contextConfig);
      // Use enhancement results even without local context
      const prompt = await this.templateLoader.loadAndInterpolate('mcp', 'ask-with-external-context', {
        externalContext,
        question: question
      });
      this.enforcePromptLimit(prompt, contextConfig);

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
  async generateContextualResponse(question, searchResults, enhancementResults, tilt, contextConfig) {
    const hasLocalContext = searchResults.length > 0;
    const hasEnhancementContext = enhancementResults?.context?.combinedPrompt;
    const recentContext = this.buildRecentContext(contextConfig);

    if (!hasLocalContext && !hasEnhancementContext && !recentContext) {
      return `I don't have any relevant information to answer: ${question}`;
    }

    const promptParts = [];

    if (recentContext) {
      promptParts.push(`Recent session context:\n${recentContext}`);
    }

    // Add local context if available
    if (hasLocalContext) {
      const contextText = this.formatLocalContextForTilt(searchResults, tilt);
      promptParts.push(`Personal knowledge context:\n${contextText}`);
    }

    // Add enhancement context if available
    if (hasEnhancementContext) {
      promptParts.push(`External knowledge context:\n${enhancementResults.context.combinedPrompt}`);
    }

    let fullContext = this.applyContextWindow(promptParts.join('\n\n---\n\n'), contextConfig);
    fullContext = await this.fitContextToPromptBudget('ask-with-hybrid-context', {
      fullContext,
      question
    }, 'fullContext', contextConfig);
    const prompt = await this.templateLoader.loadAndInterpolate('mcp', 'ask-with-hybrid-context', {
      fullContext: fullContext,
      question: question
    });
    this.enforcePromptLimit(prompt, contextConfig);

    try {
      return await this.safeOps.generateResponse(prompt);
    } catch (llmError) {
      verbsLogger.error('LLM generation error:', llmError);
      return `I found relevant information but could not generate a response: ${llmError.message}`;
    }
  }

  formatLocalContextForTilt(searchResults, tilt) {
    if (!tilt) {
      throw new Error('Tilt representation required for context formatting');
    }

    switch (tilt) {
      case 'keywords':
        return this.formatKeywordContext(searchResults);
      case 'embedding':
        return this.formatEmbeddingContext(searchResults);
      case 'graph':
        return this.formatGraphContext(searchResults);
      case 'temporal':
        return this.formatTemporalContext(searchResults);
      default:
        throw new Error(`Unsupported tilt representation: ${tilt}`);
    }
  }

  formatKeywordContext(searchResults) {
    return searchResults.map(result => {
      const keywords = this.extractKeywordList(result);
      const label = result.label || result.id || 'item';
      const content = result.content || result.output || result.prompt || result.response || result.description || result.text || '';
      const keywordText = keywords.length > 0 ? `keywords: ${keywords.join(', ')}` : 'keywords: none';
      const contentText = content ? `content: ${content}` : 'content: none';
      return `- ${label}\n  ${keywordText}\n  ${contentText}`;
    }).join('\n');
  }

  formatEmbeddingContext(searchResults) {
    return searchResults.map(result => {
      const label = result.label || result.id || 'item';
      const embedding = result.embedding || result.metadata?.embedding || result.metadata?.vector;
      const similarity = result.similarity ?? result.metadata?.similarity;
      const dimension = embedding?.dimension || embedding?.length || result.metadata?.dimension;
      const model = embedding?.model || result.metadata?.model;
      const content = result.content || result.output || result.prompt || result.response || result.description || result.text || '';

      const embeddingParts = [
        similarity !== undefined ? `similarity: ${similarity}` : null,
        dimension ? `dimension: ${dimension}` : null,
        model ? `model: ${model}` : null
      ].filter(Boolean).join(', ');

      const embeddingText = embeddingParts ? `embedding: ${embeddingParts}` : 'embedding: unavailable';
      const contentText = content ? `content: ${content}` : 'content: none';
      return `- ${label}\n  ${embeddingText}\n  ${contentText}`;
    }).join('\n');
  }

  formatGraphContext(searchResults) {
    return searchResults.map(result => {
      const label = result.label || result.id || 'item';
      const nodes = result.nodes || result.graph?.nodes || result.metadata?.nodes;
      const edges = result.edges || result.graph?.edges || result.metadata?.edges;
      const relationships = result.relationships || result.conceptualRelations || result.relations;
      const nodeCount = Array.isArray(nodes) ? nodes.length : (nodes?.count || 0);
      const edgeCount = Array.isArray(edges) ? edges.length : (edges?.count || 0);
      const relationCount = Array.isArray(relationships) ? relationships.length : (relationships?.count || 0);

      const graphSummary = [
        nodeCount ? `nodes: ${nodeCount}` : null,
        edgeCount ? `edges: ${edgeCount}` : null,
        relationCount ? `relations: ${relationCount}` : null
      ].filter(Boolean).join(', ') || 'graph: unavailable';

      return `- ${label}\n  ${graphSummary}`;
    }).join('\n');
  }

  formatTemporalContext(searchResults) {
    const temporalItems = searchResults
      .map(result => {
        const label = result.label || result.id || 'item';
        const timestamp = result.timestamp || result.date || result.created || result.metadata?.timestamp || result.metadata?.date;
        const content = result.content || result.output || result.prompt || result.response || result.description || result.text || '';
        return { label, timestamp, content };
      })
      .sort((a, b) => {
        const aTime = a.timestamp ? new Date(a.timestamp).getTime() : 0;
        const bTime = b.timestamp ? new Date(b.timestamp).getTime() : 0;
        return aTime - bTime;
      });

    return temporalItems.map(item => {
      const timeText = item.timestamp ? `timestamp: ${item.timestamp}` : 'timestamp: unknown';
      const contentText = item.content ? `content: ${item.content}` : 'content: none';
      return `- ${item.label}\n  ${timeText}\n  ${contentText}`;
    }).join('\n');
  }

  getContextConfig() {
    if (!this.config || typeof this.config.get !== 'function') {
      throw new Error('Config instance required for context configuration');
    }
    const contextConfig = this.config.get('context');
    if (!contextConfig || typeof contextConfig !== 'object') {
      throw new Error('Context configuration missing');
    }
    const { maxTokens, maxContextSize, truncationLimit, recentInteractionsCount, recentInteractionsTruncationLimit } = contextConfig;
    if (typeof maxTokens !== 'number' || Number.isNaN(maxTokens)) {
      throw new Error('Context configuration missing maxTokens');
    }
    if (typeof maxContextSize !== 'number' || Number.isNaN(maxContextSize)) {
      throw new Error('Context configuration missing maxContextSize');
    }
    if (typeof truncationLimit !== 'number' || Number.isNaN(truncationLimit)) {
      throw new Error('Context configuration missing truncationLimit');
    }
    if (typeof recentInteractionsCount !== 'number' || Number.isNaN(recentInteractionsCount)) {
      throw new Error('Context configuration missing recentInteractionsCount');
    }
    if (typeof recentInteractionsTruncationLimit !== 'number' || Number.isNaN(recentInteractionsTruncationLimit)) {
      throw new Error('Context configuration missing recentInteractionsTruncationLimit');
    }
    return { maxTokens, maxContextSize, truncationLimit, recentInteractionsCount, recentInteractionsTruncationLimit };
  }

  limitContextResults(results, contextConfig) {
    const limited = results.slice(0, contextConfig.maxContextSize);
    return limited.map(result => {
      const content = result.content || '';
      if (content.length <= contextConfig.truncationLimit) {
        return result;
      }
      return {
        ...result,
        content: `${content.slice(0, contextConfig.truncationLimit)}...`
      };
    });
  }

  applyContextWindow(contextText, contextConfig) {
    const windowManager = new ContextWindowManager({
      maxWindowSize: contextConfig.maxTokens,
      minWindowSize: Math.floor(contextConfig.maxTokens / 4)
    });
    if (windowManager.estimateTokens(contextText) <= contextConfig.maxTokens) {
      return contextText;
    }
    const windows = windowManager.processContext(contextText);
    return windowManager.mergeOverlappingContent(windows);
  }

  async fitContextToPromptBudget(templateName, templateData, contextKey, contextConfig) {
    const baseData = { ...templateData, [contextKey]: '' };
    const basePrompt = await this.templateLoader.loadAndInterpolate('mcp', templateName, baseData);
    const windowManager = new ContextWindowManager({
      maxWindowSize: contextConfig.maxTokens,
      minWindowSize: Math.floor(contextConfig.maxTokens / 4)
    });
    const baseTokens = windowManager.estimateTokens(basePrompt);
    const availableTokens = contextConfig.maxTokens - baseTokens;

    if (availableTokens <= 0) {
      throw new Error(`Context budget exceeded before adding ${contextKey}`);
    }

    const contextText = String(templateData[contextKey] || '');
    if (windowManager.estimateTokens(contextText) <= availableTokens) {
      return contextText;
    }

    const scopedWindowManager = new ContextWindowManager({
      maxWindowSize: availableTokens,
      minWindowSize: Math.max(1, Math.floor(availableTokens / 4))
    });
    const windows = scopedWindowManager.processContext(contextText);
    return scopedWindowManager.mergeOverlappingContent(windows);
  }

  buildRecentContext(contextConfig) {
    if (!this.stateManager?.getRecentInteractions) {
      throw new Error('State manager missing recent interaction support');
    }

    const interactions = this.stateManager.getRecentInteractions(contextConfig.recentInteractionsCount);
    if (!interactions.length) {
      return '';
    }

    return interactions.map(interaction => {
      const prompt = interaction.prompt || '';
      const response = interaction.response || '';
      const trimmedResponse = response.length > contextConfig.recentInteractionsTruncationLimit
        ? `${response.slice(0, contextConfig.recentInteractionsTruncationLimit)}...`
        : response;
      return `- Q: ${prompt}\n  A: ${trimmedResponse}`;
    }).join('\n');
  }

  enforcePromptLimit(prompt, contextConfig) {
    const windowManager = new ContextWindowManager({
      maxWindowSize: contextConfig.maxTokens,
      minWindowSize: Math.floor(contextConfig.maxTokens / 4)
    });
    const estimatedTokens = windowManager.estimateTokens(prompt);
    if (estimatedTokens > contextConfig.maxTokens) {
      throw new Error(`Prompt exceeds max token budget (${estimatedTokens}/${contextConfig.maxTokens})`);
    }
  }

  extractKeywordList(result) {
    const keywords = result.keywords || result.metadata?.keywords || result.tags || result.concepts || [];
    if (Array.isArray(keywords)) {
      return keywords.map(keyword => String(keyword)).filter(Boolean);
    }

    if (typeof keywords === 'string') {
      return keywords.split(',').map(keyword => keyword.trim()).filter(Boolean);
    }

    return [];
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
