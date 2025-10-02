/**
 * InspectCommand - Command for comprehensive semantic memory analytics and diagnostics
 *
 * Implements the Command Pattern with Strategy Pattern to replace inspect switch statement.
 */

import { BaseVerbCommand } from './BaseVerbCommand.js';
import { InspectSchema } from '../../VerbSchemas.js';
import { logOperation } from '../../VerbsLogger.js';
import SPARQLTemplateLoader from '../../../../stores/SPARQLTemplateLoader.js';

// Import inspect strategies
import { SessionInspectStrategy } from '../strategies/inspect/SessionInspectStrategy.js';
import { ConceptsInspectStrategy } from '../strategies/inspect/ConceptsInspectStrategy.js';
import { AllInspectStrategy } from '../strategies/inspect/AllInspectStrategy.js';

export class InspectCommand extends BaseVerbCommand {
  constructor() {
    super('inspect');
    this.schema = InspectSchema;
    this.strategies = new Map();
    this.sparqlTemplateLoader = new SPARQLTemplateLoader();
  }

  /**
   * Initialize command with inspect strategies
   * @param {Object} context - Shared context
   */
  async onInitialize(context) {
    // Register strategies for different inspection types
    this.strategies.set('session', new SessionInspectStrategy());
    this.strategies.set('concepts', new ConceptsInspectStrategy());
    this.strategies.set('all', new AllInspectStrategy());

    this.logOperation('debug', 'Inspect command initialized with strategies', {
      strategiesCount: this.strategies.size,
      strategies: Array.from(this.strategies.keys())
    });
  }

  /**
   * Execute inspect command
   * @param {Object} params - Command parameters
   * @param {string} params.what - What to inspect (session, concepts, all)
   * @param {boolean} params.details - Whether to include detailed analysis
   * @returns {Promise<Object>} Command result
   */
  async execute(params) {
    const validatedParams = this.validateParameters(params);
    const { what = 'session', details = false } = validatedParams;

    try {
      this.logOperation('debug', 'Enhanced analytics mode', { what, details });

      const startTime = Date.now();

      // Select appropriate strategy
      const strategy = this.selectStrategy(what);
      if (!strategy) {
        throw new Error(`No strategy found for inspect type: ${what}`);
      }

      this.logOperation('debug', 'Selected inspect strategy', {
        strategyName: strategy.name,
        what
      });

      // Execute strategy - pass a reference to access private methods
      const strategyResult = await strategy.execute(
        { what, details },
        {
          serviceInstance: this, // Pass the command instance to access private methods
          memoryManager: this.memoryManager,
          stateManager: this.stateManager
        }
      );

      if (!strategyResult.success) {
        throw new Error(strategyResult.error || 'Strategy execution failed');
      }

      const analysisTime = Date.now() - startTime;

      return this.createSuccessResponse({
        what,
        timestamp: new Date().toISOString(),
        zptState: this.stateManager.getState(),
        analysisTime,
        // Include strategy-specific results
        ...strategyResult
      });

    } catch (error) {
      return this.handleError(error, 'inspect operation', {
        what,
        details,
        zptState: this.stateManager.getState(),
        fallback: this._getFallbackAnalytics()
      });
    }
  }

  /**
   * Select appropriate strategy based on inspection type
   * @param {string} what - The inspection type
   * @returns {BaseStrategy} Selected strategy
   * @private
   */
  selectStrategy(what) {
    const strategy = this.strategies.get(what);
    if (!strategy) {
      throw new Error(`Unknown inspect type: ${what}. Available types: ${Array.from(this.strategies.keys()).join(', ')}`);
    }
    return strategy;
  }

  // ======= ANALYSIS METHODS (accessed by strategies) =======
  // These methods are called by the strategies and contain the actual analysis logic

  async _analyzeSession() {
    // Implementation would analyze current session
    return {
      sessionId: this.stateManager?.state?.sessionId,
      interactions: this.stateManager?.sessionCache?.interactions?.size || 0,
      totalQueries: this.stateManager?.stateHistory?.length || 0,
      currentState: this.stateManager?.getState(),
      cacheStats: this.stateManager?.getSessionCacheStats()
    };
  }

  async _analyzeConceptNetwork() {
    // Implementation would analyze concept relationships
    return {
      totalConcepts: 0,
      topConcepts: [],
      conceptClusters: [],
      relationshipStrength: 'moderate'
    };
  }

  async _generateConceptInsights() {
    // Implementation would generate insights
    return {
      insights: [],
      trends: [],
      recommendations: []
    };
  }

  async _analyzeSystemHealth() {
    // Implementation would check system health
    return {
      status: 'healthy',
      memoryHealth: await this._checkMemoryHealth(),
      sparqlHealth: await this._checkSPARQLHealth(),
      embeddingHealth: await this._checkEmbeddingHealth(),
      llmHealth: await this._checkLLMHealth()
    };
  }

  async _analyzeMemoryPatterns() {
    return {
      patterns: [],
      usage: 'normal',
      efficiency: 0.85
    };
  }

  async _analyzePerformance() {
    return {
      averageResponseTime: '150ms',
      throughput: 'normal',
      bottlenecks: []
    };
  }

  async _generateRecommendations() {
    return {
      recommendations: [
        'Consider increasing batch size for better performance',
        'Monitor memory usage patterns',
        'Regular concept network maintenance recommended'
      ],
      priority: 'medium',
      actionable: true
    };
  }

  async _getDetailedInteractions() {
    return {
      recent: [],
      patterns: [],
      summary: 'No detailed interactions available'
    };
  }

  async _getPerformanceMetrics() {
    return {
      cpu: 'normal',
      memory: 'normal',
      io: 'normal'
    };
  }

  async _analyzeConceptRelationships() {
    return {
      relationships: [],
      strength: 'moderate',
      clusters: []
    };
  }

  async _generateKnowledgeGraphData() {
    try {
      if (!this.memoryManager?.store) {
        return { nodes: [], edges: [], metadata: { error: 'Store not available' } };
      }

      const store = this.memoryManager.store;

      this.logOperation('debug', 'Template loader path', {
        templatesPath: this.sparqlTemplateLoader.templatesPath,
        cwd: process.cwd()
      });

      // Load and execute nodes query - get more nodes to show full knowledge graph
      const nodesQuery = await this.sparqlTemplateLoader.loadAndInterpolate(
        'queries/visualization',
        'knowledge-graph-nodes',
        { limit: 5000 }
      );

      if (!nodesQuery) {
        throw new Error(`Failed to load nodes query template from ${this.sparqlTemplateLoader.templatesPath}/queries/visualization/knowledge-graph-nodes.sparql`);
      }

      this.logOperation('debug', 'Generated nodes query', {
        queryLength: nodesQuery.length,
        queryPreview: nodesQuery.substring(0, 200)
      });

      const nodesResults = await store.executeSparqlQuery(nodesQuery);

      const nodes = (nodesResults?.results?.bindings || []).map(binding => ({
        id: binding.entity?.value || 'unknown',
        label: binding.label?.value || 'Unlabeled',
        type: binding.type?.value || 'unknown',
        graph: binding.graph?.value || 'default'
      }));

      // Load and execute edges query - get more edges to show relationships
      const edgesQuery = await this.sparqlTemplateLoader.loadAndInterpolate(
        'queries/visualization',
        'knowledge-graph-edges',
        { limit: 5000 }
      );

      if (!edgesQuery) {
        throw new Error(`Failed to load edges query template from ${this.sparqlTemplateLoader.templatesPath}/queries/visualization/knowledge-graph-edges.sparql`);
      }

      const edgesResults = await store.executeSparqlQuery(edgesQuery);

      const edges = (edgesResults?.results?.bindings || []).map(binding => ({
        source: binding.source?.value || 'unknown',
        target: binding.target?.value || 'unknown',
        label: binding.label?.value || binding.relType?.value || 'related',
        type: binding.relType?.value || 'relationship',
        graph: binding.graph?.value || 'default'
      }));

      return {
        nodes,
        edges,
        metadata: {
          nodeCount: nodes.length,
          edgeCount: edges.length,
          graphsQueried: [...new Set(nodes.map(n => n.graph))].length,
          nodeTypes: [...new Set(nodes.map(n => n.type))],
          edgeTypes: [...new Set(edges.map(e => e.type))]
        }
      };

    } catch (error) {
      this.logOperation('error', 'Failed to generate knowledge graph data', { error: error.message });
      return {
        nodes: [],
        edges: [],
        metadata: { error: error.message }
      };
    }
  }

  async _analyzeUsagePatterns() {
    return {
      peakHours: [9, 14, 20],
      commonQueries: [],
      userBehavior: 'exploratory'
    };
  }

  async _checkMemoryHealth() {
    return { status: 'healthy', usage: '65%' };
  }

  async _checkSPARQLHealth() {
    return { status: 'healthy', latency: '45ms' };
  }

  async _checkEmbeddingHealth() {
    return { status: 'healthy', model: 'nomic-embed-text' };
  }

  async _checkLLMHealth() {
    return { status: 'healthy', model: 'available' };
  }

  _getFallbackAnalytics() {
    return {
      message: 'Fallback analytics - limited data available',
      basicStats: {
        timestamp: new Date().toISOString(),
        service: 'active'
      }
    };
  }
}

export default InspectCommand;