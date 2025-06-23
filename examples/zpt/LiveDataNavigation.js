/**
 * ZPT Live Data Navigation Example
 * Demonstrates real ZPT navigation using live SPARQL data and ragno vocabulary
 */
import { getMemoryManager } from '../../mcp/lib/initialization.js';
import { ZPTNavigationService } from '../../mcp/tools/zpt-tools.js';
import { SafeOperations } from '../../mcp/lib/safe-operations.js';

async function demonstrateLiveNavigation() {
  console.log('🚀 ZPT Live Data Navigation Demo\n');

  try {
    // Initialize services with real data sources
    console.log('📡 Initializing memory manager and SPARQL store...');
    const memoryManager = await getMemoryManager();
    
    if (!memoryManager || !memoryManager.store) {
      console.log('⚠️  No SPARQL store available, would fallback to simulation');
      return;
    }

    const safeOps = new SafeOperations(memoryManager);
    const zptService = new ZPTNavigationService(memoryManager, safeOps);

    // Check corpus health before navigation
    console.log('🔍 Checking corpus health...');
    const analysis = await zptService.analyzeCorpus('structure', true);
    
    if (analysis.success) {
      const stats = analysis.analysis.structure;
      console.log(`📊 Corpus Statistics:
  - Entities: ${stats.totalEntities || 0}
  - Semantic Units: ${stats.totalUnits || 0}  
  - Relationships: ${stats.totalRelationships || 0}
  - Communities: ${stats.totalCommunities || 0}
  - Embedding Coverage: ${((stats.embeddingCoverage || 0) * 100).toFixed(1)}%
  - Connectivity: ${(stats.connectivity || 0).toFixed(2)}
  - Health: ${stats.healthy ? '✅ Healthy' : '⚠️ Needs attention'}
`);
    }

    // Demonstrate different navigation patterns
    const navigationExamples = [
      {
        name: 'Entity-Level Navigation',
        query: 'artificial intelligence research',
        zoom: 'entity',
        pan: {
          topic: 'technology',
          temporal: {
            start: '2020-01-01',
            end: '2024-12-31'
          }
        },
        tilt: 'keywords',
        transform: {
          maxTokens: 2000,
          format: 'json',
          includeMetadata: true
        }
      },
      {
        name: 'Semantic Unit Navigation',
        query: 'machine learning algorithms',
        zoom: 'unit',
        pan: {
          topic: 'algorithms'
        },
        tilt: 'embedding',
        transform: {
          maxTokens: 3000,
          format: 'structured'
        }
      },
      {
        name: 'Community-Level Analysis', 
        query: 'research communities',
        zoom: 'community',
        pan: {},
        tilt: 'graph',
        transform: {
          maxTokens: 1500,
          format: 'markdown'
        }
      }
    ];

    for (const example of navigationExamples) {
      console.log(`\n🧭 ${example.name}`);
      console.log(`   Query: "${example.query}"`);
      console.log(`   Zoom: ${example.zoom}, Tilt: ${example.tilt}`);
      
      const startTime = Date.now();
      
      try {
        const result = await zptService.navigate(
          example.query,
          example.zoom,
          example.pan,
          example.tilt,
          example.transform
        );

        const duration = Date.now() - startTime;

        if (result.success) {
          const metadata = result.metadata;
          console.log(`   ✅ Success (${duration}ms)`);
          console.log(`   📊 Pipeline: ${metadata.pipeline.mode}`);
          console.log(`   🔢 Corpuscles: ${metadata.corpuscleCount}`);
          console.log(`   📝 Tokens: ${metadata.tokenCount || 'N/A'}`);
          
          if (metadata.performance) {
            console.log(`   🎯 Cache hits: ${metadata.performance.cacheHits || 0}`);
            console.log(`   🔄 SPARQL queries: ${metadata.performance.sparqlQueries || 0}`);
          }

          // Show sample results
          if (result.content.results && result.content.results.length > 0) {
            console.log(`   📋 Sample results:`);
            result.content.results.slice(0, 2).forEach((item, index) => {
              console.log(`      ${index + 1}. ${item.title || item.label || item.id}`);
            });
          }
        } else {
          console.log(`   ❌ Failed: ${result.error || 'Unknown error'}`);
        }
      } catch (error) {
        console.log(`   💥 Error: ${error.message}`);
      }
    }

    // Demonstrate preview functionality
    console.log(`\n👁️  Preview Demo`);
    try {
      const preview = await zptService.preview(
        'neural networks deep learning',
        'entity',
        { topic: 'neural networks' }
      );

      if (preview.success) {
        const data = preview.preview;
        console.log(`   Data Source: ${data.dataSource}`);
        console.log(`   Available Zooms: ${data.availableZooms.join(', ')}`);
        console.log(`   Content Counts:`, data.contentCounts);
        console.log(`   Estimated Tokens: ${data.estimatedTokens}`);
        
        if (data.corpusHealth) {
          console.log(`   Corpus Health: ${data.corpusHealth.healthy ? '✅' : '⚠️'}`);
        }
      }
    } catch (error) {
      console.log(`   💥 Preview error: ${error.message}`);
    }

    // Performance recommendations
    console.log(`\n📈 Performance Analysis`);
    try {
      const perfAnalysis = await zptService.analyzeCorpus('performance', true);
      
      if (perfAnalysis.success && perfAnalysis.analysis.performance) {
        const perf = perfAnalysis.analysis.performance;
        console.log(`   Average Selection Time: ${perf.averageSelectionTime}ms`);
        console.log(`   Cache Hit Rate: ${(parseFloat(perf.cacheHitRate) * 100).toFixed(1)}%`);
        console.log(`   Total Selections: ${perf.totalSelections || 0}`);
      }
    } catch (error) {
      console.log(`   💥 Performance analysis error: ${error.message}`);
    }

    // Show recommendations
    console.log(`\n💡 Recommendations`);
    try {
      const recommendations = await zptService.analyzeCorpus('recommendations', true);
      
      if (recommendations.success && recommendations.analysis.recommendations) {
        recommendations.analysis.recommendations.forEach((rec, index) => {
          console.log(`   ${index + 1}. [${rec.category}] ${rec.suggestion} (${rec.impact} impact)`);
          if (rec.metric) {
            console.log(`      📊 ${rec.metric}`);
          }
        });
      }
    } catch (error) {
      console.log(`   💥 Recommendations error: ${error.message}`);
    }

  } catch (error) {
    console.error('💥 Demo failed:', error);
  }
}

// Configuration examples
function showConfigurationExamples() {
  console.log('\n⚙️  ZPT Configuration Examples\n');

  const examples = {
    'Research Focus': {
      zoom: 'entity',
      pan: {
        topic: 'research',
        temporal: { start: '2020-01-01' },
        entity: ['research-institution', 'academic-paper']
      },
      tilt: 'analytical',
      transform: {
        maxTokens: 4000,
        format: 'structured',
        chunkStrategy: 'semantic'
      }
    },
    'Quick Overview': {
      zoom: 'corpus',
      pan: {},
      tilt: 'summary',
      transform: {
        maxTokens: 1000,
        format: 'conversational',
        chunkStrategy: 'fixed'
      }
    },
    'Detailed Analysis': {
      zoom: 'unit',
      pan: {
        keywords: ['analysis', 'detailed', 'comprehensive'],
        temporal: { start: '2023-01-01', end: '2024-12-31' }
      },
      tilt: 'technical',
      transform: {
        maxTokens: 8000,
        format: 'markdown',
        chunkStrategy: 'adaptive',
        includeMetadata: true
      }
    },
    'Community Discovery': {
      zoom: 'community',
      pan: {
        domains: ['social', 'network', 'collaboration'],
        entity: ['research-group', 'collaboration']
      },
      tilt: 'graph',
      transform: {
        maxTokens: 3000,
        format: 'json',
        chunkStrategy: 'semantic'
      }
    }
  };

  Object.entries(examples).forEach(([name, config]) => {
    console.log(`📋 ${name}:`);
    console.log(`   ${JSON.stringify(config, null, 4).replace(/^/gm, '   ')}`);
    console.log();
  });
}

// Performance tips
function showPerformanceTips() {
  console.log('🚀 ZPT Performance Tips\n');

  const tips = [
    {
      category: 'Zoom Selection',
      tips: [
        'Use "entity" zoom for specific information lookup',
        'Use "unit" zoom for contextual understanding',
        'Use "community" zoom for topic-level insights',
        'Use "corpus" zoom for high-level overviews'
      ]
    },
    {
      category: 'Pan Filtering',
      tips: [
        'Use temporal filters to focus on recent content',
        'Use domain filters to narrow topic scope', 
        'Use entity filters for relationship-based queries',
        'Combine filters for precise targeting'
      ]
    },
    {
      category: 'Tilt Optimization',
      tips: [
        'Use "embedding" tilt for semantic similarity',
        'Use "keywords" tilt for exact term matching',
        'Use "graph" tilt for relationship analysis',
        'Use "temporal" tilt for time-series analysis'
      ]
    },
    {
      category: 'Transform Efficiency',
      tips: [
        'Set appropriate maxTokens for your use case',
        'Use "semantic" chunking for coherent content',
        'Use "structured" format for data processing',
        'Enable metadata only when needed'
      ]
    }
  ];

  tips.forEach(section => {
    console.log(`📊 ${section.category}:`);
    section.tips.forEach(tip => {
      console.log(`   • ${tip}`);
    });
    console.log();
  });
}

// Main execution
async function main() {
  await demonstrateLiveNavigation();
  showConfigurationExamples();
  showPerformanceTips();
  
  console.log('🎉 ZPT Live Data Navigation Demo Complete!\n');
}

// Export for use as module
export {
  demonstrateLiveNavigation,
  showConfigurationExamples,
  showPerformanceTips
};

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}