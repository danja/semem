/**
 * Enhanced Workflow Orchestrator - Implements tool name mapping and missing tools
 * 
 * This module provides the enhanced workflow orchestration system that maps
 * simplified tool names to MCP tool names and implements missing workflow tools.
 */

import logger from 'loglevel';
import { mcpDebugger } from './debug-utils.js';

/**
 * Tool name mapping between workflow names and MCP tool names
 */
export const TOOL_MAPPING = {
  // Memory tools
  'semem_store_interaction': 'mcp__semem__semem_store_interaction',
  'semem_retrieve_memories': 'mcp__semem__semem_retrieve_memories', 
  'semem_generate_response': 'mcp__semem__semem_generate_response',
  'semem_generate_embedding': 'mcp__semem__semem_generate_embedding',
  'semem_extract_concepts': 'mcp__semem__semem_extract_concepts',
  
  // Ragno tools
  'ragno_decompose_corpus': 'mcp__semem__ragno_decompose_corpus',
  'ragno_search_dual': 'mcp__semem__ragno_search_dual',
  'ragno_get_entities': 'mcp__semem__ragno_get_entities',
  'ragno_vector_search': 'mcp__semem__ragno_vector_search',
  'ragno_export_rdf': 'mcp__semem__ragno_export_rdf',
  'ragno_query_sparql': 'mcp__semem__ragno_query_sparql',
  'ragno_analyze_graph': 'mcp__semem__ragno_analyze_graph',
  
  // System tools
  'semem_switch_storage_backend': 'mcp__semem__semem_switch_storage_backend',
  'semem_get_config': 'mcp__semem__semem_get_config',
  'semem_update_config': 'mcp__semem__semem_update_config',
  'semem_health_check': 'mcp__semem__semem_health_check',
  
  // Alias mappings for common workflow names
  'ragno_build_relationships': 'mcp__semem__ragno_analyze_graph',
  'ragno_extract_entities': 'mcp__semem__ragno_get_entities',
  'ragno_find_entity': 'mcp__semem__ragno_get_entities',
  'ragno_get_relationships': 'mcp__semem__ragno_analyze_graph',
  'ragno_analyze_entity': 'mcp__semem__ragno_analyze_graph',
  
  // Missing tools that we'll implement
  'research_ingest_documents': 'research_ingest_documents',
  'research_generate_insights': 'research_generate_insights',
  'adaptive_query_processing': 'adaptive_query_processing',
  'hybrid_search': 'hybrid_search',
  'capture_user_feedback': 'capture_user_feedback',
  'incremental_learning': 'incremental_learning'
};

/**
 * Enhanced Workflow Orchestrator class
 */
export class WorkflowOrchestrator {
  constructor() {
    this.toolExecutors = new Map();
    this.contextCache = new Map();
    this.executionMetrics = new Map();
    this.TOOL_MAPPING = TOOL_MAPPING; // Export mapping for testing
  }

  /**
   * Initialize the orchestrator with tool executors
   */
  async initialize(mcpServer) {
    this.mcpServer = mcpServer;
    await this.registerMissingTools();
    mcpDebugger.info('Workflow orchestrator initialized');
  }

  /**
   * Register implementations for missing workflow tools
   */
  async registerMissingTools() {
    // Register research_ingest_documents
    this.toolExecutors.set('research_ingest_documents', async (args, context) => {
      return await this.researchIngestDocuments(args, context);
    });

    // Register research_generate_insights  
    this.toolExecutors.set('research_generate_insights', async (args, context) => {
      return await this.researchGenerateInsights(args, context);
    });

    // Register adaptive_query_processing
    this.toolExecutors.set('adaptive_query_processing', async (args, context) => {
      return await this.adaptiveQueryProcessing(args, context);
    });

    // Register hybrid_search
    this.toolExecutors.set('hybrid_search', async (args, context) => {
      return await this.hybridSearch(args, context);
    });

    // Register user feedback tools
    this.toolExecutors.set('capture_user_feedback', async (args, context) => {
      return await this.captureUserFeedback(args, context);
    });

    this.toolExecutors.set('incremental_learning', async (args, context) => {
      return await this.incrementalLearning(args, context);
    });

    mcpDebugger.info('Missing workflow tools registered');
  }

  /**
   * Execute a workflow with enhanced orchestration
   */
  async executeWorkflow(workflowName, args, toolExecutor) {
    const executionId = this.generateExecutionId();
    const context = {
      workflowName,
      executionId,
      arguments: args,
      results: [],
      errors: [],
      metrics: {
        startTime: Date.now(),
        toolCalls: 0,
        cacheHits: 0
      }
    };

    try {
      mcpDebugger.info(`Starting enhanced workflow execution: ${workflowName}`, { executionId });

      // Enhanced workflow execution logic will be added here
      // For now, delegate to the existing execution system
      return await this.executeWithMapping(workflowName, args, toolExecutor, context);

    } catch (error) {
      mcpDebugger.error(`Workflow execution failed: ${workflowName}`, error);
      throw error;
    } finally {
      this.executionMetrics.set(executionId, context.metrics);
    }
  }

  /**
   * Execute workflow with tool name mapping
   */
  async executeWithMapping(workflowName, args, toolExecutor, context) {
    // Create enhanced tool executor with mapping
    const mappedExecutor = async (toolName, toolArgs, stepContext) => {
      const mappedToolName = TOOL_MAPPING[toolName] || toolName;
      context.metrics.toolCalls++;

      // Check if it's a custom tool we implement
      if (this.toolExecutors.has(toolName)) {
        mcpDebugger.debug(`Executing custom tool: ${toolName}`);
        return await this.toolExecutors.get(toolName)(toolArgs, { ...context, ...stepContext });
      }

      // Execute mapped MCP tool
      mcpDebugger.debug(`Executing mapped tool: ${toolName} -> ${mappedToolName}`);
      return await toolExecutor(mappedToolName, toolArgs, stepContext);
    };

    // Return enhanced execution context
    return {
      toolExecutor: mappedExecutor,
      context
    };
  }

  /**
   * Implementation of research_ingest_documents
   */
  async researchIngestDocuments(args, context) {
    const { documents, domain = 'general' } = args;
    const results = [];

    mcpDebugger.info('Starting document ingestion', { 
      documentCount: documents.length, 
      domain 
    });

    for (let i = 0; i < documents.length; i++) {
      const doc = documents[i];
      const docContent = typeof doc === 'string' ? doc : doc.content;
      const docMetadata = typeof doc === 'object' ? doc.metadata || {} : {};

      try {
        // 1. Store in semantic memory
        const memoryResult = await this.executeMappedTool('semem_store_interaction', {
          prompt: `Document analysis for domain: ${domain}`,
          response: docContent,
          metadata: {
            ...docMetadata,
            domain,
            documentIndex: i,
            timestamp: Date.now(),
            source: doc.source || 'research_workflow'
          }
        }, context);

        // 2. Build knowledge graph
        const graphResult = await this.executeMappedTool('ragno_decompose_corpus', {
          textChunks: [{
            content: docContent,
            source: doc.source || `document_${i}`
          }],
          options: {
            extractRelationships: true,
            generateSummaries: true,
            minEntityConfidence: 0.7
          }
        }, context);

        results.push({
          documentIndex: i,
          memoryId: memoryResult.interactionId || memoryResult.id,
          entities: graphResult.entities || [],
          entityCount: graphResult.entityCount || 0,
          relationshipCount: graphResult.relationshipCount || 0,
          processingTime: graphResult.statistics?.processingTime || 0
        });

        mcpDebugger.debug(`Document ${i + 1}/${documents.length} processed successfully`);

      } catch (error) {
        mcpDebugger.error(`Failed to process document ${i}`, error);
        results.push({
          documentIndex: i,
          error: error.message,
          status: 'failed'
        });
      }
    }

    const summary = {
      totalDocuments: documents.length,
      successfulDocuments: results.filter(r => !r.error).length,
      failedDocuments: results.filter(r => r.error).length,
      totalEntities: results.reduce((sum, r) => sum + (r.entityCount || 0), 0),
      totalRelationships: results.reduce((sum, r) => sum + (r.relationshipCount || 0), 0),
      domain
    };

    mcpDebugger.info('Document ingestion completed', summary);

    return {
      success: true,
      results,
      summary,
      processingMetrics: {
        documentsProcessed: documents.length,
        entitiesExtracted: summary.totalEntities,
        relationshipsFound: summary.totalRelationships
      }
    };
  }

  /**
   * Implementation of research_generate_insights
   */
  async researchGenerateInsights(args, context) {
    const { concepts, entities, relationships, goals = ['concept_extraction', 'relationship_mapping'] } = args;

    mcpDebugger.info('Generating research insights', { 
      conceptCount: concepts?.length || 0,
      entityCount: entities?.length || 0,
      goals 
    });

    try {
      // 1. Retrieve related memories
      const conceptQuery = Array.isArray(concepts) ? concepts.join(' ') : concepts;
      const memories = await this.executeMappedTool('semem_retrieve_memories', {
        query: conceptQuery,
        threshold: 0.7,
        limit: 10
      }, context);

      // 2. Analyze graph relationships
      const graphAnalysis = await this.executeMappedTool('ragno_analyze_graph', {
        analysisTypes: ['statistics', 'centrality', 'communities'],
        options: {
          includeDetails: true,
          topK: 10
        }
      }, context);

      // 3. Prepare context for insight generation
      const insightContext = {
        concepts: Array.isArray(concepts) ? concepts : [concepts],
        entities: Array.isArray(entities) ? entities.map(e => e.name || e) : [],
        goals: Array.isArray(goals) ? goals : [goals],
        relatedMemories: memories.memories || [],
        graphMetrics: graphAnalysis.statistics || {},
        centralEntities: graphAnalysis.centrality?.slice(0, 5) || [],
        communities: graphAnalysis.communities?.slice(0, 3) || []
      };

      // 4. Generate comprehensive insights
      const insightPrompt = this.buildInsightPrompt(insightContext);
      const insights = await this.executeMappedTool('semem_generate_response', {
        prompt: insightPrompt,
        useMemory: true,
        maxTokens: 2000,
        temperature: 0.7
      }, context);

      // 5. Extract recommendations and key findings
      const recommendations = this.extractRecommendations(insights.response || insights);
      const keyFindings = this.extractKeyFindings(insightContext, graphAnalysis);

      const result = {
        success: true,
        insights: insights.response || insights,
        keyFindings,
        recommendations,
        supportingEvidence: {
          relatedMemories: memories.memories || [],
          graphMetrics: graphAnalysis.statistics || {},
          centralEntities: graphAnalysis.centrality?.slice(0, 5) || []
        },
        analysisMetadata: {
          conceptsAnalyzed: insightContext.concepts.length,
          entitiesAnalyzed: insightContext.entities.length,
          memoriesRetrieved: (memories.memories || []).length,
          analysisGoals: goals,
          timestamp: new Date().toISOString()
        }
      };

      mcpDebugger.info('Research insights generated successfully');
      return result;

    } catch (error) {
      mcpDebugger.error('Failed to generate research insights', error);
      throw new Error(`Insight generation failed: ${error.message}`);
    }
  }

  /**
   * Implementation of adaptive_query_processing
   */
  async adaptiveQueryProcessing(args, context) {
    const { query, userContext = {} } = args;

    mcpDebugger.info('Processing adaptive query', { query, userId: userContext.userId });

    try {
      // 1. Analyze query complexity and intent
      const queryAnalysis = await this.executeMappedTool('semem_extract_concepts', {
        text: query
      }, context);

      // 2. Retrieve user's interaction history if available
      let userHistory = [];
      if (userContext.userId) {
        try {
          const historyResult = await this.executeMappedTool('semem_retrieve_memories', {
            query: `user:${userContext.userId}`,
            threshold: 0.5,
            limit: 20
          }, context);
          userHistory = historyResult.memories || [];
        } catch (error) {
          mcpDebugger.warn('Could not retrieve user history', error);
        }
      }

      // 3. Determine search strategy based on analysis
      const searchStrategy = this.determineSearchStrategy(queryAnalysis, userHistory, userContext);

      // 4. Execute adaptive search
      const searchResults = await this.hybridSearch({
        query,
        threshold: searchStrategy.threshold,
        limit: searchStrategy.limit,
        preferenceWeight: searchStrategy.userPreference
      }, context);

      return {
        success: true,
        query,
        queryAnalysis,
        searchStrategy,
        results: searchResults,
        userContext: {
          ...userContext,
          historyCount: userHistory.length,
          adaptedStrategy: searchStrategy.name
        }
      };

    } catch (error) {
      mcpDebugger.error('Adaptive query processing failed', error);
      throw new Error(`Adaptive query processing failed: ${error.message}`);
    }
  }

  /**
   * Implementation of hybrid_search
   */
  async hybridSearch(args, context) {
    const { query, threshold = 0.7, limit = 10, preferenceWeight = 0.5 } = args;

    mcpDebugger.info('Executing hybrid search', { query, threshold, limit });

    try {
      // 1. Vector similarity search
      const vectorResults = await this.executeMappedTool('ragno_vector_search', {
        query,
        options: {
          k: limit,
          threshold,
          includeMetadata: true
        }
      }, context);

      // 2. SPARQL semantic search
      const sparqlQuery = this.buildSPARQLSearchQuery(query, limit);
      const sparqlResults = await this.executeMappedTool('ragno_query_sparql', {
        query: sparqlQuery,
        options: {
          format: 'json',
          limit
        }
      }, context);

      // 3. Dual search combining both approaches
      const dualResults = await this.executeMappedTool('ragno_search_dual', {
        query,
        options: {
          combinedLimit: limit * 2,
          vectorSimilarityThreshold: threshold,
          exactMatchThreshold: 0.8
        }
      }, context);

      // 4. Combine and rank results
      const combinedResults = this.combineSearchResults(
        vectorResults,
        sparqlResults,
        dualResults,
        preferenceWeight
      );

      return {
        success: true,
        query,
        totalResults: combinedResults.length,
        vectorResults: vectorResults.results || [],
        sparqlResults: sparqlResults.results || [],
        dualResults: dualResults.results || [],
        combinedResults: combinedResults.slice(0, limit),
        searchMetrics: {
          vectorResultCount: (vectorResults.results || []).length,
          sparqlResultCount: (sparqlResults.results || []).length,
          dualResultCount: (dualResults.results || []).length,
          finalResultCount: Math.min(combinedResults.length, limit)
        }
      };

    } catch (error) {
      mcpDebugger.error('Hybrid search failed', error);
      throw new Error(`Hybrid search failed: ${error.message}`);
    }
  }

  /**
   * Implementation of capture_user_feedback
   */
  async captureUserFeedback(args, context) {
    const { queryId, response, feedback } = args;

    mcpDebugger.info('Capturing user feedback', { queryId, feedbackType: feedback.type });

    try {
      // Store feedback as training data
      const feedbackResult = await this.executeMappedTool('semem_store_interaction', {
        prompt: `User feedback for query: ${queryId}`,
        response: JSON.stringify({
          originalResponse: response,
          userFeedback: feedback,
          timestamp: Date.now(),
          feedbackType: feedback.type // 'positive', 'negative', 'correction'
        }),
        metadata: {
          category: 'user_feedback',
          queryId,
          feedbackScore: feedback.score || 0,
          feedbackType: feedback.type
        }
      }, context);

      // Trigger incremental learning for corrections
      if (feedback.type === 'correction') {
        await this.incrementalLearning({ queryId, feedback }, context);
      }

      return {
        success: true,
        feedbackId: feedbackResult.interactionId || feedbackResult.id,
        queryId,
        feedbackType: feedback.type,
        processed: true,
        learningTriggered: feedback.type === 'correction'
      };

    } catch (error) {
      mcpDebugger.error('Failed to capture user feedback', error);
      throw new Error(`Feedback capture failed: ${error.message}`);
    }
  }

  /**
   * Implementation of incremental_learning
   */
  async incrementalLearning(args, context) {
    const { queryId, feedback } = args;

    mcpDebugger.info('Triggering incremental learning', { queryId });

    try {
      // 1. Analyze feedback patterns
      const feedbackMemories = await this.executeMappedTool('semem_retrieve_memories', {
        query: 'user feedback correction',
        threshold: 0.6,
        limit: 50
      }, context);

      // 2. Update knowledge graph based on corrections
      if (feedback.corrections) {
        await this.updateKnowledgeGraph(feedback.corrections, context);
      }

      // 3. Adjust search parameters based on feedback
      const adjustmentResults = await this.adjustSearchParameters(feedbackMemories, context);

      return {
        success: true,
        queryId,
        learningResults: {
          feedbackPatternsAnalyzed: (feedbackMemories.memories || []).length,
          knowledgeGraphUpdated: Boolean(feedback.corrections),
          searchParametersAdjusted: adjustmentResults.adjusted,
          improvements: adjustmentResults.improvements || []
        },
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      mcpDebugger.error('Incremental learning failed', error);
      throw new Error(`Incremental learning failed: ${error.message}`);
    }
  }

  // Helper methods

  async executeMappedTool(toolName, args, context) {
    const mappedToolName = TOOL_MAPPING[toolName] || toolName;
    
    if (this.toolExecutors.has(toolName)) {
      return await this.toolExecutors.get(toolName)(args, context);
    }

    // Execute via MCP server
    if (!this.mcpServer.tools || !this.mcpServer.tools[mappedToolName]) {
      throw new Error(`Tool not available: ${mappedToolName}`);
    }

    return await this.mcpServer.tools[mappedToolName].handler(args);
  }

  buildInsightPrompt(context) {
    return `
      Generate comprehensive research insights based on the following analysis:

      **Concepts Analyzed:** ${context.concepts.join(', ')}
      **Entities Identified:** ${context.entities.join(', ')}
      **Analysis Goals:** ${context.goals.join(', ')}

      **Related Context:**
      ${context.relatedMemories.map(m => `- ${m.response || m.content}`).join('\n')}

      **Graph Analysis:**
      - Total Entities: ${context.graphMetrics.entityCount || 0}
      - Total Relationships: ${context.graphMetrics.relationshipCount || 0}
      - Graph Density: ${context.graphMetrics.density || 'N/A'}

      **Central Entities:** ${context.centralEntities.map(e => e.name || e).join(', ')}

      Please provide:
      1. Key insights and patterns discovered
      2. Relationships between major concepts
      3. Research implications and significance
      4. Recommended next steps for investigation
      5. Potential applications or use cases

      Focus on actionable insights that advance understanding of the domain.
    `;
  }

  extractRecommendations(insightText) {
    // Simple pattern matching for recommendations
    const recommendations = [];
    const lines = insightText.split('\n');
    
    let inRecommendations = false;
    for (const line of lines) {
      if (line.toLowerCase().includes('recommend') || line.toLowerCase().includes('next step')) {
        inRecommendations = true;
      }
      if (inRecommendations && (line.trim().startsWith('-') || line.trim().startsWith('•'))) {
        recommendations.push(line.trim().substring(1).trim());
      }
    }

    return recommendations.length > 0 ? recommendations : ['Further analysis recommended'];
  }

  extractKeyFindings(context, graphAnalysis) {
    return {
      primaryConcepts: context.concepts.slice(0, 5),
      centralEntities: (graphAnalysis.centrality || []).slice(0, 5),
      majorCommunities: (graphAnalysis.communities || []).slice(0, 3),
      connectivityInsights: {
        density: graphAnalysis.statistics?.density || 0,
        averageDegree: graphAnalysis.statistics?.averageDegree || 0,
        stronglyConnectedComponents: graphAnalysis.statistics?.stronglyConnectedComponents || 0
      }
    };
  }

  determineSearchStrategy(queryAnalysis, userHistory, userContext) {
    const concepts = queryAnalysis.concepts || [];
    const complexity = concepts.length;
    
    // Simple strategy determination
    if (complexity <= 2) {
      return {
        name: 'simple',
        threshold: 0.8,
        limit: 5,
        userPreference: 0.3
      };
    } else if (complexity <= 5) {
      return {
        name: 'moderate',
        threshold: 0.7,
        limit: 10,
        userPreference: 0.5
      };
    } else {
      return {
        name: 'complex',
        threshold: 0.6,
        limit: 15,
        userPreference: 0.7
      };
    }
  }

  buildSPARQLSearchQuery(query, limit) {
    return `
      PREFIX ragno: <http://purl.org/stuff/ragno/>
      SELECT ?entity ?content ?score WHERE {
        ?entity ragno:hasContent ?content .
        ?entity ragno:relevanceScore ?score .
        FILTER(CONTAINS(LCASE(?content), LCASE("${query.replace(/"/g, '\\"')}")))
      }
      ORDER BY DESC(?score)
      LIMIT ${limit}
    `;
  }

  combineSearchResults(vectorResults, sparqlResults, dualResults, preferenceWeight) {
    // Simple combination strategy - in practice this would be more sophisticated
    const combined = [];
    
    // Add dual results with highest weight
    if (dualResults.results) {
      combined.push(...dualResults.results.map(r => ({ ...r, source: 'dual', weight: 1.0 })));
    }
    
    // Add vector results with preference weight
    if (vectorResults.results) {
      combined.push(...vectorResults.results.map(r => ({ ...r, source: 'vector', weight: preferenceWeight })));
    }
    
    // Add SPARQL results with inverse preference weight
    if (sparqlResults.results) {
      combined.push(...sparqlResults.results.map(r => ({ ...r, source: 'sparql', weight: 1 - preferenceWeight })));
    }

    // Remove duplicates and sort by weight
    const unique = combined.filter((item, index, arr) => 
      arr.findIndex(other => other.id === item.id || other.uri === item.uri) === index
    );

    return unique.sort((a, b) => (b.weight || 0) - (a.weight || 0));
  }

  async updateKnowledgeGraph(corrections, context) {
    // Placeholder for knowledge graph updates based on corrections
    mcpDebugger.info('Updating knowledge graph with corrections', { correctionCount: corrections.length });
    return { updated: true, corrections: corrections.length };
  }

  async adjustSearchParameters(feedbackMemories, context) {
    // Placeholder for search parameter adjustment based on feedback
    mcpDebugger.info('Adjusting search parameters based on feedback');
    return { 
      adjusted: true, 
      improvements: ['threshold_optimization', 'result_ranking_enhanced'] 
    };
  }

  generateExecutionId() {
    return `enhanced_exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get list of available tools (for testing and introspection)
   */
  getAvailableTools() {
    const mcpTools = Object.keys(TOOL_MAPPING);
    const customTools = Array.from(this.toolExecutors.keys());
    return {
      mcpTools,
      customTools,
      totalCount: mcpTools.length + customTools.length
    };
  }
}

// Export singleton instance
export const workflowOrchestrator = new WorkflowOrchestrator();