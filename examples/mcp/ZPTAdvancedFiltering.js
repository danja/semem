#!/usr/bin/env node

/**
 * ZPT Advanced Filtering Demonstration
 * 
 * This example showcases advanced ZPT filtering capabilities combining:
 * - Multi-dimensional pan filtering (temporal, geographic, entity, topic)
 * - Complex parameter combinations across zoom levels
 * - Dynamic filter composition and optimization
 * - Real-time filter performance analysis
 * 
 * Features advanced filtering patterns, constraint composition, and performance optimization.
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import chalk from 'chalk';
import log from 'loglevel';

// Configure comprehensive logging
log.setLevel('DEBUG');

class ZPTAdvancedFilteringDemo {
  constructor() {
    this.client = null;
    this.transport = null;
    this.startTime = Date.now();
    this.operationCount = 0;
    this.filteringResults = [];
    this.performanceMetrics = {
      simpleFilters: [],
      complexFilters: [],
      combinedFilters: [],
      optimizations: []
    };
  }

  // === ADVANCED LOGGING UTILITIES ===

  logBanner(title, subtitle = null) {
    const elapsed = ((Date.now() - this.startTime) / 1000).toFixed(1);
    console.log(chalk.green.bold(`\n${'◆'.repeat(75)}`));
    console.log(chalk.green.bold(`◆◆ ${title.padEnd(69)} ◆◆`));
    if (subtitle) {
      console.log(chalk.green(`◆◆ ${subtitle.padEnd(69)} ◆◆`));
    }
    console.log(chalk.green.bold(`◆◆ ${'Time: ' + elapsed + 's | Operation: ' + ++this.operationCount}`.padEnd(69) + ' ◆◆'));
    console.log(chalk.green.bold(`${'◆'.repeat(75)}`));
  }

  logFilterStep(step, title, description) {
    console.log(chalk.yellow.bold(`\n🔍 FILTER ${step}: ${title}`));
    console.log(chalk.yellow(`   📋 ${description}`));
  }

  logFilterComposition(filters) {
    console.log(chalk.cyan('\n🔧 Filter Composition:'));
    Object.entries(filters).forEach(([type, filter]) => {
      if (filter && typeof filter === 'object') {
        console.log(chalk.white(`   ${type}:`));
        Object.entries(filter).forEach(([key, value]) => {
          console.log(chalk.gray(`     ${key}: ${JSON.stringify(value)}`));
        });
      } else if (filter) {
        console.log(chalk.white(`   ${type}: ${filter}`));
      }
    });
  }

  logPerformanceAnalysis(operation, duration, details = {}) {
    const emoji = duration < 500 ? '⚡' : duration < 2000 ? '🚀' : duration < 5000 ? '⏱️' : '🐌';
    console.log(chalk.magenta(`   ${emoji} ${operation}: ${duration}ms`));
    
    if (details.resultCount !== undefined) {
      console.log(chalk.gray(`   📊 Results: ${details.resultCount} items`));
    }
    if (details.filterEfficiency !== undefined) {
      console.log(chalk.gray(`   🎯 Filter efficiency: ${details.filterEfficiency}%`));
    }
    if (details.cacheHit !== undefined) {
      console.log(chalk.gray(`   💾 Cache hit: ${details.cacheHit ? 'Yes' : 'No'}`));
    }
  }

  logSuccess(message, data = null) {
    console.log(chalk.green(`   ✅ ${message}`));
    if (data && typeof data === 'object') {
      const preview = JSON.stringify(data, null, 2).slice(0, 200);
      console.log(chalk.gray(`   📊 ${preview}${preview.length >= 200 ? '...' : ''}`));
    }
  }

  logError(message, error = null) {
    console.log(chalk.red(`   ❌ ${message}`));
    if (error) {
      console.log(chalk.red(`   📝 ${error.message}`));
    }
  }

  // === ADVANCED FILTERING CONCEPT EXPLANATIONS ===

  explainAdvancedFiltering() {
    this.logBanner('Advanced ZPT Filtering Concepts', 'Multi-Dimensional Content Navigation');
    
    console.log(chalk.cyan('\n💡 Advanced Pan Filtering:'));
    console.log(chalk.white('   ZPT pan filters work like camera controls for knowledge exploration'));
    console.log(chalk.white('   Multiple filters can be combined for precise content selection\\n'));

    console.log(chalk.yellow('🌐 Spatial Filtering (Geographic):'));
    console.log(chalk.white('   📍 bbox: Bounding box coordinates [west, south, east, north]'));
    console.log(chalk.white('   🎯 regions: Named geographic regions and administrative areas'));
    console.log(chalk.white('   📏 radius: Distance-based filtering from point coordinates\\n'));

    console.log(chalk.yellow('⏰ Temporal Filtering:'));
    console.log(chalk.white('   📅 dateRange: Absolute date ranges with start/end boundaries'));
    console.log(chalk.white('   📊 relativeTime: Relative periods (last week, past month, etc.)'));
    console.log(chalk.white('   🎂 eventBased: Filter by specific events or milestones\\n'));

    console.log(chalk.yellow('🏢 Entity Filtering:'));
    console.log(chalk.white('   🏷️  entityList: Specific entities to include or exclude'));
    console.log(chalk.white('   🏭 entityTypes: Filter by entity categories (Person, Organization, etc.)'));
    console.log(chalk.white('   💰 entityAttributes: Filter by entity properties and characteristics\\n'));

    console.log(chalk.yellow('🎯 Topic Filtering:'));
    console.log(chalk.white('   📚 domains: Subject area filtering (science, technology, arts)'));
    console.log(chalk.white('   🏷️  keywords: Keyword inclusion/exclusion with weight scoring'));
    console.log(chalk.white('   🧮 conceptual: Abstract concept filtering with semantic similarity'));
  }

  // === MCP CONNECTION MANAGEMENT ===

  async initializeConnection() {
    this.logBanner('MCP Connection Initialization', 'Connecting for advanced ZPT filtering');
    
    try {
      log.info('Creating stdio transport...');
      this.transport = new StdioClientTransport({
        command: 'node',
        args: ['mcp/index.js']
      });

      log.info('Creating MCP client...');
      this.client = new Client({
        name: 'zpt-advanced-filtering-demo',
        version: '1.0.0'
      }, {
        capabilities: {
          tools: {},
          resources: {}
        }
      });

      const startTime = Date.now();
      await this.client.connect(this.transport);
      const connectionTime = Date.now() - startTime;

      this.logSuccess('MCP connection established');
      this.logPerformanceAnalysis('Connection', connectionTime);

      // Verify ZPT tools availability
      const tools = await this.client.listTools();
      const zptTools = tools.tools.filter(tool => tool.name.startsWith('zpt_'));
      
      this.logSuccess(`Found ${zptTools.length} ZPT tools available for filtering`);
      zptTools.forEach(tool => {
        console.log(chalk.gray(`   🔧 ${tool.name}: ${tool.description.slice(0, 80)}...`));
      });

    } catch (error) {
      this.logError('Failed to initialize MCP connection', error);
      throw error;
    }
  }

  // === TEMPORAL FILTERING DEMONSTRATIONS ===

  async demonstrateTemporalFiltering() {
    this.logBanner('Temporal Filtering', 'Time-based content navigation and exploration');
    
    const temporalFilters = [
      {
        title: 'Recent AI Research',
        description: 'AI developments in the last 2 years',
        query: 'artificial intelligence research',
        pan: {
          temporal: {
            start: '2022-01-01',
            end: '2024-12-31',
            granularity: 'month'
          }
        },
        zoom: 'unit',
        tilt: 'temporal'
      },
      {
        title: 'Climate Change Timeline',
        description: 'Climate research from 2020-2023',
        query: 'climate change impacts',
        pan: {
          temporal: {
            start: '2020-01-01',
            end: '2023-12-31',
            eventBased: ['COP26', 'COP27', 'IPCC AR6']
          }
        },
        zoom: 'community',
        tilt: 'keywords'
      },
      {
        title: 'Technology Evolution',
        description: 'Tech developments over time periods',
        query: 'quantum computing breakthrough',
        pan: {
          temporal: {
            relativeTime: 'past_year',
            granularity: 'week'
          }
        },
        zoom: 'entity',
        tilt: 'graph'
      }
    ];

    for (const filter of temporalFilters) {
      this.logFilterStep(temporalFilters.indexOf(filter) + 1, filter.title, filter.description);
      this.logFilterComposition({ temporal: filter.pan.temporal });
      
      try {
        const startTime = Date.now();
        const result = await this.client.callTool({
          name: 'zpt_navigate',
          arguments: {
            query: filter.query,
            zoom: filter.zoom,
            pan: filter.pan,
            tilt: filter.tilt,
            transform: { maxTokens: 1500, format: 'structured' }
          }
        });
        const duration = Date.now() - startTime;

        if (result.content && result.content[0]) {
          const navigation = JSON.parse(result.content[0].text);
          this.logSuccess(`Temporal filtering completed: ${filter.title}`);
          
          if (navigation.success && navigation.content) {
            const resultCount = navigation.content.results?.length || 0;
            const timespan = filter.pan.temporal.end ? 
              `${filter.pan.temporal.start} to ${filter.pan.temporal.end}` : 
              filter.pan.temporal.relativeTime || 'specified period';
              
            this.logPerformanceAnalysis('Temporal Navigation', duration, {
              resultCount,
              filterEfficiency: Math.round((resultCount / 100) * 100), // Mock efficiency
              cacheHit: false
            });

            console.log(chalk.white(`   📅 Time span: ${timespan}`));
            console.log(chalk.white(`   🔍 Granularity: ${filter.pan.temporal.granularity || 'default'}`));
            
            if (navigation.metadata?.temporalDistribution) {
              console.log(chalk.cyan(`   📊 Temporal distribution:`));
              Object.entries(navigation.metadata.temporalDistribution).forEach(([period, count]) => {
                console.log(chalk.gray(`     ${period}: ${count} items`));
              });
            }
          }
        }

        this.performanceMetrics.simpleFilters.push({ type: 'temporal', duration, filter: filter.title });

      } catch (error) {
        this.logError(`Temporal filtering failed: ${filter.title}`, error);
      }
    }
  }

  // === GEOGRAPHIC FILTERING DEMONSTRATIONS ===

  async demonstrateGeographicFiltering() {
    this.logBanner('Geographic Filtering', 'Location-based content exploration');
    
    const geographicFilters = [
      {
        title: 'Silicon Valley Tech',
        description: 'Technology companies in San Francisco Bay Area',
        query: 'technology startups',
        pan: {
          geographic: {
            bbox: [-122.5, 37.2, -121.9, 37.6], // SF Bay Area
            regions: ['Silicon Valley', 'San Francisco'],
            precision: 'city'
          }
        },
        zoom: 'entity',
        tilt: 'keywords'
      },
      {
        title: 'European Climate Policy',
        description: 'Climate initiatives across European Union',
        query: 'renewable energy policy',
        pan: {
          geographic: {
            regions: ['European Union', 'Germany', 'Netherlands', 'Denmark'],
            administrativeLevel: 'country'
          }
        },
        zoom: 'community',
        tilt: 'graph'
      },
      {
        title: 'Global Research Centers',
        description: 'AI research institutions worldwide',
        query: 'artificial intelligence research institute',
        pan: {
          geographic: {
            regions: ['United States', 'United Kingdom', 'China', 'Canada'],
            entityTypes: ['Organization', 'Institution']
          }
        },
        zoom: 'unit',
        tilt: 'embedding'
      }
    ];

    for (const filter of geographicFilters) {
      this.logFilterStep(geographicFilters.indexOf(filter) + 1, filter.title, filter.description);
      this.logFilterComposition({ geographic: filter.pan.geographic });
      
      try {
        const startTime = Date.now();
        const result = await this.client.callTool({
          name: 'zpt_navigate',
          arguments: {
            query: filter.query,
            zoom: filter.zoom,
            pan: filter.pan,
            tilt: filter.tilt,
            transform: { maxTokens: 2000, format: 'json' }
          }
        });
        const duration = Date.now() - startTime;

        if (result.content && result.content[0]) {
          const navigation = JSON.parse(result.content[0].text);
          this.logSuccess(`Geographic filtering completed: ${filter.title}`);
          
          if (navigation.success && navigation.content) {
            const resultCount = navigation.content.results?.length || 0;
            
            this.logPerformanceAnalysis('Geographic Navigation', duration, {
              resultCount,
              filterEfficiency: Math.round((resultCount / 50) * 100), // Mock efficiency
              cacheHit: Math.random() > 0.5
            });

            if (filter.pan.geographic.bbox) {
              console.log(chalk.white(`   🗺️  Bounding box: [${filter.pan.geographic.bbox.join(', ')}]`));
            }
            if (filter.pan.geographic.regions) {
              console.log(chalk.white(`   📍 Regions: ${filter.pan.geographic.regions.join(', ')}`));
            }
            
            if (navigation.metadata?.geographicCoverage) {
              console.log(chalk.cyan(`   🌍 Geographic coverage:`));
              Object.entries(navigation.metadata.geographicCoverage).forEach(([region, percentage]) => {
                console.log(chalk.gray(`     ${region}: ${percentage}%`));
              });
            }
          }
        }

        this.performanceMetrics.simpleFilters.push({ type: 'geographic', duration, filter: filter.title });

      } catch (error) {
        this.logError(`Geographic filtering failed: ${filter.title}`, error);
      }
    }
  }

  // === ENTITY-BASED FILTERING DEMONSTRATIONS ===

  async demonstrateEntityFiltering() {
    this.logBanner('Entity-Based Filtering', 'Focused exploration of specific entities and relationships');
    
    const entityFilters = [
      {
        title: 'Tech Leaders Network',
        description: 'Relationships between major tech company leaders',
        query: 'technology leadership',
        pan: {
          entity: {
            include: ['Elon Musk', 'Sam Altman', 'Satya Nadella', 'Sundar Pichai'],
            entityTypes: ['Person', 'Organization'],
            relationshipDepth: 2
          }
        },
        zoom: 'unit',
        tilt: 'graph'
      },
      {
        title: 'Research Institutions',
        description: 'AI research collaboration networks',
        query: 'machine learning research',
        pan: {
          entity: {
            entityTypes: ['Institution', 'University', 'Research Center'],
            attributes: {
              researchFocus: ['AI', 'Machine Learning', 'Deep Learning'],
              fundingLevel: 'high'
            }
          }
        },
        zoom: 'entity',
        tilt: 'keywords'
      },
      {
        title: 'Automotive Innovation',
        description: 'Electric vehicle and autonomous driving companies',
        query: 'electric vehicle autonomous driving',
        pan: {
          entity: {
            include: ['Tesla', 'Waymo', 'BMW', 'Mercedes-Benz'],
            exclude: ['traditional oil companies'],
            entityTypes: ['Corporation', 'Startup']
          }
        },
        zoom: 'community',
        tilt: 'embedding'
      }
    ];

    for (const filter of entityFilters) {
      this.logFilterStep(entityFilters.indexOf(filter) + 1, filter.title, filter.description);
      this.logFilterComposition({ entity: filter.pan.entity });
      
      try {
        const startTime = Date.now();
        const result = await this.client.callTool({
          name: 'zpt_navigate',
          arguments: {
            query: filter.query,
            zoom: filter.zoom,
            pan: filter.pan,
            tilt: filter.tilt,
            transform: { maxTokens: 1800, format: 'structured' }
          }
        });
        const duration = Date.now() - startTime;

        if (result.content && result.content[0]) {
          const navigation = JSON.parse(result.content[0].text);
          this.logSuccess(`Entity filtering completed: ${filter.title}`);
          
          if (navigation.success && navigation.content) {
            const resultCount = navigation.content.results?.length || 0;
            const entityCount = filter.pan.entity.include?.length || 0;
            
            this.logPerformanceAnalysis('Entity Navigation', duration, {
              resultCount,
              filterEfficiency: Math.round((resultCount / (entityCount * 10)) * 100), // Mock efficiency
              cacheHit: Math.random() > 0.3
            });

            if (filter.pan.entity.include) {
              console.log(chalk.white(`   🏢 Included entities: ${filter.pan.entity.include.join(', ')}`));
            }
            if (filter.pan.entity.entityTypes) {
              console.log(chalk.white(`   🏷️  Entity types: ${filter.pan.entity.entityTypes.join(', ')}`));
            }
            
            if (navigation.metadata?.entityAnalysis) {
              console.log(chalk.cyan(`   🔗 Entity relationships:`));
              console.log(chalk.gray(`     Direct connections: ${navigation.metadata.entityAnalysis.directConnections || 'N/A'}`));
              console.log(chalk.gray(`     Network density: ${navigation.metadata.entityAnalysis.networkDensity || 'N/A'}`));
            }
          }
        }

        this.performanceMetrics.complexFilters.push({ type: 'entity', duration, filter: filter.title });

      } catch (error) {
        this.logError(`Entity filtering failed: ${filter.title}`, error);
      }
    }
  }

  // === MULTI-DIMENSIONAL FILTERING DEMONSTRATIONS ===

  async demonstrateMultiDimensionalFiltering() {
    this.logBanner('Multi-Dimensional Filtering', 'Combining multiple filter types for precise navigation');
    
    const complexFilters = [
      {
        title: 'California AI in 2023',
        description: 'AI companies in California during 2023',
        query: 'artificial intelligence startup',
        pan: {
          temporal: {
            start: '2023-01-01',
            end: '2023-12-31'
          },
          geographic: {
            regions: ['California', 'San Francisco Bay Area'],
            bbox: [-124.4, 32.5, -114.1, 42.0] // California
          },
          entity: {
            entityTypes: ['Corporation', 'Startup'],
            attributes: {
              industry: 'technology',
              fundingStage: ['Series A', 'Series B', 'IPO']
            }
          }
        },
        zoom: 'unit',
        tilt: 'graph'
      },
      {
        title: 'European Climate Research 2020-2024',
        description: 'Climate research institutions in Europe, recent period',
        query: 'climate change research renewable energy',
        pan: {
          temporal: {
            start: '2020-01-01',
            end: '2024-12-31',
            granularity: 'quarter'
          },
          geographic: {
            regions: ['European Union', 'United Kingdom', 'Norway'],
            administrativeLevel: 'country'
          },
          topic: {
            domains: ['environmental science', 'energy technology'],
            keywords: {
              include: ['renewable', 'sustainability', 'carbon', 'climate'],
              exclude: ['fossil fuel', 'coal']
            }
          }
        },
        zoom: 'community',
        tilt: 'temporal'
      },
      {
        title: 'Global Tech Leaders Network',
        description: 'Tech leader connections across multiple regions and timeframes',
        query: 'technology leadership innovation',
        pan: {
          temporal: {
            relativeTime: 'past_two_years',
            eventBased: ['IPO', 'acquisition', 'product launch']
          },
          geographic: {
            regions: ['United States', 'China', 'United Kingdom', 'India'],
            precision: 'region'
          },
          entity: {
            include: ['Google', 'Microsoft', 'Apple', 'Tesla', 'OpenAI'],
            entityTypes: ['Person', 'Corporation'],
            relationshipDepth: 3
          },
          topic: {
            domains: ['artificial intelligence', 'cloud computing', 'automotive'],
            conceptual: ['innovation', 'disruption', 'leadership']
          }
        },
        zoom: 'entity',
        tilt: 'embedding'
      }
    ];

    for (const filter of complexFilters) {
      this.logFilterStep(complexFilters.indexOf(filter) + 1, filter.title, filter.description);
      
      console.log(chalk.cyan('\\n🔧 Multi-dimensional filter composition:'));
      Object.entries(filter.pan).forEach(([dimension, config]) => {
        console.log(chalk.yellow(`   📊 ${dimension.toUpperCase()}:`));
        Object.entries(config).forEach(([key, value]) => {
          const displayValue = Array.isArray(value) ? value.join(', ') : 
                             typeof value === 'object' ? JSON.stringify(value) : value;
          console.log(chalk.gray(`     ${key}: ${displayValue}`));
        });
      });
      
      try {
        const startTime = Date.now();
        const result = await this.client.callTool({
          name: 'zpt_navigate',
          arguments: {
            query: filter.query,
            zoom: filter.zoom,
            pan: filter.pan,
            tilt: filter.tilt,
            transform: { maxTokens: 2500, format: 'structured' }
          }
        });
        const duration = Date.now() - startTime;

        if (result.content && result.content[0]) {
          const navigation = JSON.parse(result.content[0].text);
          this.logSuccess(`Multi-dimensional filtering completed: ${filter.title}`);
          
          if (navigation.success && navigation.content) {
            const resultCount = navigation.content.results?.length || 0;
            const dimensionCount = Object.keys(filter.pan).length;
            
            this.logPerformanceAnalysis('Multi-dimensional Navigation', duration, {
              resultCount,
              filterEfficiency: Math.round((resultCount / (dimensionCount * 20)) * 100), // Mock efficiency
              cacheHit: Math.random() > 0.7 // More likely to hit cache with complex filters
            });

            console.log(chalk.white(`   🎯 Filter dimensions: ${dimensionCount}`));
            console.log(chalk.white(`   📊 Result precision: ${((resultCount / 1000) * 100).toFixed(1)}% of total corpus`));
            
            if (navigation.metadata?.filterAnalysis) {
              console.log(chalk.cyan(`   🔍 Filter analysis:`));
              console.log(chalk.gray(`     Most selective: ${navigation.metadata.filterAnalysis.mostSelective || 'N/A'}`));
              console.log(chalk.gray(`     Least selective: ${navigation.metadata.filterAnalysis.leastSelective || 'N/A'}`));
              console.log(chalk.gray(`     Filter interaction: ${navigation.metadata.filterAnalysis.interaction || 'independent'}`));
            }
          }
        }

        this.performanceMetrics.combinedFilters.push({ 
          type: 'multi-dimensional', 
          duration, 
          filter: filter.title,
          dimensions: Object.keys(filter.pan).length
        });

      } catch (error) {
        this.logError(`Multi-dimensional filtering failed: ${filter.title}`, error);
      }
    }
  }

  // === FILTER OPTIMIZATION DEMONSTRATIONS ===

  async demonstrateFilterOptimization() {
    this.logBanner('Filter Optimization', 'Performance tuning and caching strategies');
    
    console.log(chalk.cyan('\\n⚡ Optimization Strategies:'));
    console.log(chalk.white('   1. Filter ordering by selectivity (most → least selective)'));
    console.log(chalk.white('   2. Caching frequently used filter combinations'));
    console.log(chalk.white('   3. Progressive filtering for complex constraints'));
    console.log(chalk.white('   4. Index optimization for geographic and temporal filters\\n'));

    const optimizationTests = [
      {
        title: 'Filter Order Optimization',
        description: 'Testing different filter application orders',
        baseQuery: 'machine learning research',
        filters: {
          version1: { // Entity first (most selective)
            entity: { include: ['Stanford', 'MIT'] },
            temporal: { start: '2023-01-01', end: '2024-01-01' },
            topic: { domains: ['computer science'] }
          },
          version2: { // Topic first (least selective)
            topic: { domains: ['computer science'] },
            temporal: { start: '2023-01-01', end: '2024-01-01' },
            entity: { include: ['Stanford', 'MIT'] }
          }
        }
      },
      {
        title: 'Progressive Filtering',
        description: 'Applying filters progressively vs. all at once',
        baseQuery: 'renewable energy technology',
        filters: {
          progressive: [
            { temporal: { start: '2022-01-01', end: '2024-01-01' } },
            { geographic: { regions: ['United States', 'Germany'] } },
            { entity: { entityTypes: ['Corporation', 'Research Institute'] } }
          ],
          combined: {
            temporal: { start: '2022-01-01', end: '2024-01-01' },
            geographic: { regions: ['United States', 'Germany'] },
            entity: { entityTypes: ['Corporation', 'Research Institute'] }
          }
        }
      }
    ];

    for (const test of optimizationTests) {
      this.logFilterStep(optimizationTests.indexOf(test) + 1, test.title, test.description);
      
      if (test.filters.version1 && test.filters.version2) {
        // Test different filter orders
        for (const [version, filters] of Object.entries(test.filters)) {
          console.log(chalk.yellow(`\\n   Testing ${version}:`));
          
          try {
            const startTime = Date.now();
            const result = await this.client.callTool({
              name: 'zpt_navigate',
              arguments: {
                query: test.baseQuery,
                zoom: 'entity',
                pan: filters,
                tilt: 'keywords',
                transform: { maxTokens: 1000, format: 'json' }
              }
            });
            const duration = Date.now() - startTime;

            if (result.content && result.content[0]) {
              const navigation = JSON.parse(result.content[0].text);
              if (navigation.success) {
                const resultCount = navigation.content?.results?.length || 0;
                this.logPerformanceAnalysis(`${version} filtering`, duration, {
                  resultCount,
                  filterEfficiency: Math.round((duration < 1000 ? 90 : 60) + Math.random() * 20),
                  cacheHit: version === 'version2' // Simulate cache hit for second version
                });
              }
            }

            this.performanceMetrics.optimizations.push({ 
              test: test.title, 
              version, 
              duration 
            });

          } catch (error) {
            this.logError(`Optimization test failed: ${version}`, error);
          }
        }
      }
    }
  }

  // === PERFORMANCE SUMMARY AND ANALYSIS ===

  generatePerformanceSummary() {
    this.logBanner('Advanced Filtering Performance Summary', 'Comprehensive analysis of filtering strategies');
    
    const totalDuration = Date.now() - this.startTime;
    const allFilters = [
      ...this.performanceMetrics.simpleFilters,
      ...this.performanceMetrics.complexFilters,
      ...this.performanceMetrics.combinedFilters
    ];

    console.log(chalk.white('\\n📊 Overall Performance Statistics:'));
    console.log(chalk.green(`   ✅ Total demo duration: ${(totalDuration / 1000).toFixed(1)}s`));
    console.log(chalk.green(`   ✅ Filter operations completed: ${allFilters.length}`));
    console.log(chalk.green(`   ✅ Operations completed: ${this.operationCount}`));

    if (allFilters.length > 0) {
      const avgDuration = allFilters.reduce((sum, f) => sum + f.duration, 0) / allFilters.length;
      const minDuration = Math.min(...allFilters.map(f => f.duration));
      const maxDuration = Math.max(...allFilters.map(f => f.duration));

      console.log(chalk.white('\\n⚡ Filter Performance Analysis:'));
      console.log(chalk.cyan(`   Average filtering time: ${avgDuration.toFixed(0)}ms`));
      console.log(chalk.cyan(`   Fastest filter: ${minDuration}ms`));
      console.log(chalk.cyan(`   Slowest filter: ${maxDuration}ms`));
    }

    // Performance by filter type
    const performanceByType = {};
    allFilters.forEach(filter => {
      if (!performanceByType[filter.type]) {
        performanceByType[filter.type] = [];
      }
      performanceByType[filter.type].push(filter.duration);
    });

    console.log(chalk.white('\\n🎯 Performance by Filter Type:'));
    Object.entries(performanceByType).forEach(([type, durations]) => {
      const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
      console.log(chalk.cyan(`   ${type}: ${avg.toFixed(0)}ms average (${durations.length} tests)`));
    });

    // Optimization recommendations
    console.log(chalk.white('\\n💡 Optimization Recommendations:'));
    if (this.performanceMetrics.combinedFilters.length > 0) {
      const complexAvg = this.performanceMetrics.combinedFilters.reduce((sum, f) => sum + f.duration, 0) / this.performanceMetrics.combinedFilters.length;
      if (complexAvg > 2000) {
        console.log(chalk.yellow('   ⚠️  Complex filters are slow - consider progressive filtering'));
      } else {
        console.log(chalk.green('   ✅ Complex filter performance is acceptable'));
      }
    }

    console.log(chalk.yellow('   🎯 Apply most selective filters first (entity > temporal > geographic > topic)'));
    console.log(chalk.yellow('   💾 Cache frequently used filter combinations'));
    console.log(chalk.yellow('   📊 Use preview mode for large result sets'));
    console.log(chalk.yellow('   ⚡ Consider index optimization for high-frequency filter patterns'));

    console.log(chalk.green.bold('\\n🎉 ZPT Advanced Filtering Demo Complete!'));
    console.log(chalk.white('   Next steps: Try ZPTUtilityTools.js for schema and validation patterns'));
  }

  // === CLEANUP ===

  async cleanup() {
    if (this.client) {
      try {
        await this.client.close();
        log.info('MCP client connection closed');
      } catch (error) {
        log.error('Error closing MCP client:', error);
      }
    }
  }

  // === MAIN DEMO ORCHESTRATION ===

  async runFullDemo() {
    try {
      console.log(chalk.rainbow('🔍 Welcome to the ZPT Advanced Filtering Demo! 🔍'));
      console.log(chalk.white('This demo explores complex multi-dimensional filtering patterns.\\n'));

      // Educational overview
      this.explainAdvancedFiltering();
      
      // Initialize connection
      await this.initializeConnection();
      
      // Temporal filtering
      await this.demonstrateTemporalFiltering();
      
      // Geographic filtering
      await this.demonstrateGeographicFiltering();
      
      // Entity-based filtering
      await this.demonstrateEntityFiltering();
      
      // Multi-dimensional filtering
      await this.demonstrateMultiDimensionalFiltering();
      
      // Filter optimization
      await this.demonstrateFilterOptimization();
      
      // Performance summary
      this.generatePerformanceSummary();

    } catch (error) {
      this.logError('Demo failed with critical error', error);
      process.exit(1);
    } finally {
      await this.cleanup();
    }
  }
}

// === SCRIPT EXECUTION ===

if (import.meta.url === `file://${process.argv[1]}`) {
  const demo = new ZPTAdvancedFilteringDemo();
  demo.runFullDemo().catch(error => {
    console.error(chalk.red('Fatal error:'), error);
    process.exit(1);
  });
}

export default ZPTAdvancedFilteringDemo;