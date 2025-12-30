import { mcpDebugger } from '../../../../lib/debug-utils.js';

class AnalysisHandler {
  constructor(context) {
    this.context = context;
  }

  async analyzeCorpus(analysisType, includeStats) {
    try {
      if (!this.context.corpuscleSelector && this.context.config.enableRealData) {
        await this.context.ensureComponents();
      }

      let analysis;

      if (this.context.corpuscleSelector && this.context.config.enableRealData) {
        analysis = await this.analyzeCorpusWithRealData(analysisType, includeStats);
      } else {
        analysis = await this.analyzeCorpusWithSimulation(analysisType, includeStats);
      }

      return {
        success: true,
        analysis,
        includeStats,
        generatedAt: new Date().toISOString()
      };
    } catch (error) {
      mcpDebugger.error('ZPT AnalyzeCorpus failed', error);

      if (this.context.config.fallbackToSimulation && this.context.corpuscleSelector) {
        mcpDebugger.warn('Real corpus analysis failed, falling back to simulation');
        const analysis = await this.analyzeCorpusWithSimulation(analysisType, includeStats);
        return {
          success: true,
          analysis,
          includeStats,
          generatedAt: new Date().toISOString(),
          fallbackMode: true
        };
      }

      throw error;
    }
  }

  async analyzeCorpusWithRealData(analysisType, includeStats) {
    const analysis = {
      analysisType,
      timestamp: new Date().toISOString(),
      dataSource: 'real-corpus',
      structure: {},
      performance: {},
      recommendations: []
    };

    try {
      const corpusHealth = await this.context.corpuscleSelector.sparqlStore.validateCorpus();
      const stats = corpusHealth.stats;

      if (analysisType === 'structure' || analysisType === 'all') {
        analysis.structure = {
          totalEntities: stats.entityCount || 0,
          totalUnits: stats.unitCount || 0,
          totalRelationships: stats.relationshipCount || 0,
          totalCommunities: stats.communityCount || 0,
          embeddingCoverage: corpusHealth.embeddingCoverage || 0,
          connectivity: corpusHealth.connectivity || 0,
          healthy: corpusHealth.healthy,
          recommendations: corpusHealth.recommendations || []
        };

        if (this.context.corpuscleSelector.metrics) {
          analysis.structure.performance = {
            totalSelections: this.context.corpuscleSelector.metrics.totalSelections,
            avgSelectionTime: this.context.corpuscleSelector.metrics.avgSelectionTime,
            cacheHitRate: this.context.corpuscleSelector.metrics.cacheHits /
              (this.context.corpuscleSelector.metrics.cacheHits + this.context.corpuscleSelector.metrics.cacheMisses) || 0
          };
        }
      }

      if (analysisType === 'performance' || analysisType === 'all') {
        const metrics = this.context.corpuscleSelector.metrics || {};

        analysis.performance = {
          averageSelectionTime: Math.round(metrics.avgSelectionTime) || 0,
          totalSelections: metrics.totalSelections || 0,
          cacheHitRate: (metrics.cacheHits / (metrics.cacheHits + metrics.cacheMisses) || 0).toFixed(3),
          cacheMisses: metrics.cacheMisses || 0,
          cacheHits: metrics.cacheHits || 0,
          optimalTokenRange: '2000-6000',
          corpusHealthScore: corpusHealth.healthy ? 0.9 : 0.5
        };
      }

      if (analysisType === 'recommendations' || analysisType === 'all') {
        const recommendations = [];

        if (corpusHealth.embeddingCoverage < 0.5) {
          recommendations.push({
            category: 'Data Quality',
            suggestion: 'Low embedding coverage detected. Consider regenerating embeddings for better similarity search.',
            impact: 'high',
            metric: `Coverage: ${(corpusHealth.embeddingCoverage * 100).toFixed(1)}%`
          });
        }

        if (corpusHealth.connectivity < 0.1) {
          recommendations.push({
            category: 'Graph Structure',
            suggestion: 'Low graph connectivity. Consider adding more relationships between entities.',
            impact: 'medium',
            metric: `Connectivity: ${corpusHealth.connectivity.toFixed(3)}`
          });
        }

        if (stats.communityCount === 0) {
          recommendations.push({
            category: 'Analysis',
            suggestion: 'No communities detected. Run community detection for better navigation.',
            impact: 'medium'
          });
        }

        const cacheHitRate = analysis.performance?.cacheHitRate || 0;
        if (cacheHitRate < 0.6) {
          recommendations.push({
            category: 'Performance',
            suggestion: 'Low cache hit rate. Consider increasing cache size or TTL.',
            impact: 'medium',
            metric: `Hit rate: ${(cacheHitRate * 100).toFixed(1)}%`
          });
        }

        recommendations.push({
          category: 'Navigation',
          suggestion: 'Use entity zoom for specific information, unit zoom for contextual understanding',
          impact: 'medium'
        });

        analysis.recommendations = recommendations;
      }

      return analysis;
    } catch (error) {
      mcpDebugger.warn('Real corpus analysis failed, using partial data', error);

      const fallbackAnalysis = await this.analyzeCorpusWithSimulation(analysisType, includeStats);
      fallbackAnalysis.dataSource = 'partial-real-with-simulation';
      fallbackAnalysis.analysisError = error.message;

      return fallbackAnalysis;
    }
  }

  async analyzeCorpusWithSimulation(analysisType, includeStats) {
    const analysis = {
      analysisType,
      timestamp: new Date().toISOString(),
      dataSource: 'simulated',
      structure: {},
      performance: {},
      recommendations: []
    };

    if (analysisType === 'structure' || analysisType === 'all') {
      analysis.structure = {
        totalEntities: Math.floor(Math.random() * 10000) + 1000,
        totalUnits: Math.floor(Math.random() * 5000) + 500,
        totalRelationships: Math.floor(Math.random() * 15000) + 2000,
        entityTypes: ['Person', 'Organization', 'Location', 'Concept', 'Event'],
        averageConnectivity: (Math.random() * 10 + 2).toFixed(2),
        clusteringCoefficient: (Math.random() * 0.5 + 0.3).toFixed(3)
      };
    }

    if (analysisType === 'performance' || analysisType === 'all') {
      analysis.performance = {
        averageSelectionTime: Math.floor(Math.random() * 200) + 100,
        averageTransformationTime: Math.floor(Math.random() * 300) + 150,
        cacheHitRate: (Math.random() * 0.4 + 0.6).toFixed(3),
        recommendedConcurrency: Math.floor(Math.random() * 4) + 2,
        optimalTokenRange: '2000-6000'
      };
    }

    if (analysisType === 'recommendations' || analysisType === 'all') {
      analysis.recommendations = [
        {
          category: 'Navigation',
          suggestion: 'Use entity zoom for specific information, unit zoom for contextual understanding',
          impact: 'medium'
        },
        {
          category: 'Performance',
          suggestion: 'Enable caching for repeated navigation patterns',
          impact: 'high'
        },
        {
          category: 'Content Quality',
          suggestion: 'Use semantic chunking for better content coherence',
          impact: 'medium'
        }
      ];
    }

    return analysis;
  }
}

export { AnalysisHandler };
