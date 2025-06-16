#!/usr/bin/env node

/**
 * ZPT Basic Navigation Demonstration
 * 
 * This example showcases the fundamental concepts of ZPT (Zoom, Pan, Tilt) 
 * 3-dimensional knowledge graph navigation:
 * - Zoom: Controls abstraction level (entity → unit → text → community → corpus)
 * - Pan: Manages content filtering (topic, temporal, geographic, entity)
 * - Tilt: Adjusts representation style (keywords → embedding → graph → temporal)
 * 
 * Features extensive visual feedback, performance tracking, and educational explanations.
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import chalk from 'chalk';
import log from 'loglevel';

// Configure comprehensive logging
log.setLevel('DEBUG');

class ZPTBasicNavigationDemo {
  constructor() {
    this.client = null;
    this.transport = null;
    this.startTime = Date.now();
    this.operationCount = 0;
    this.navigationResults = [];
    this.performanceMetrics = {
      previews: [],
      navigations: [],
      validations: []
    };
  }

  // === ENHANCED LOGGING UTILITIES ===

  logBanner(title, subtitle = null) {
    const elapsed = ((Date.now() - this.startTime) / 1000).toFixed(1);
    console.log(chalk.blue.bold(`\n${'█'.repeat(70)}`));
    console.log(chalk.blue.bold(`██ ${title.padEnd(64)} ██`));
    if (subtitle) {
      console.log(chalk.blue(`██ ${subtitle.padEnd(64)} ██`));
    }
    console.log(chalk.blue.bold(`██ ${'Time: ' + elapsed + 's | Operation: ' + ++this.operationCount}`.padEnd(64) + ' ██'));
    console.log(chalk.blue.bold(`${'█'.repeat(70)}`));
  }

  logStep(step, description) {
    console.log(chalk.yellow.bold(`\n🔸 Step ${step}: ${description}`));
  }

  logConcept(concept, explanation) {
    console.log(chalk.cyan(`\n💡 ${chalk.bold(concept)}: ${explanation}`));
  }

  logSuccess(message, data = null) {
    console.log(chalk.green(`   ✅ ${message}`));
    if (data && typeof data === 'object') {
      console.log(chalk.gray(`   📊 ${JSON.stringify(data, null, 2).slice(0, 200)}...`));
    }
  }

  logWarning(message) {
    console.log(chalk.yellow(`   ⚠️  ${message}`));
  }

  logError(message, error = null) {
    console.log(chalk.red(`   ❌ ${message}`));
    if (error) {
      console.log(chalk.red(`   📝 ${error.message}`));
    }
  }

  logPerformance(operation, duration, details = {}) {
    const emoji = duration < 1000 ? '⚡' : duration < 3000 ? '🚀' : '🐌';
    console.log(chalk.magenta(`   ${emoji} ${operation}: ${duration}ms`));
    if (Object.keys(details).length > 0) {
      console.log(chalk.gray(`   📈 ${JSON.stringify(details)}`));
    }
  }

  // === ZPT CONCEPT EXPLANATIONS ===

  explainZPTConcepts() {
    this.logBanner('ZPT 3D Navigation Concepts', 'Understanding Zoom, Pan, and Tilt');
    
    this.logConcept('Zoom (Abstraction Level)', 
      'Controls how detailed or abstract your view is - like a camera zoom lens');
    console.log(chalk.white('   🔍 entity    → Focus on individual entities (most detailed)'));
    console.log(chalk.white('   📦 unit      → Semantic units with related entities'));
    console.log(chalk.white('   📄 text      → Text elements and detailed content'));
    console.log(chalk.white('   🏘️  community → Topic clusters and domain overviews'));
    console.log(chalk.white('   🌍 corpus    → Highest level patterns (most abstract)'));

    this.logConcept('Pan (Content Filtering)', 
      'Controls what content is included in your view - like panning a camera');
    console.log(chalk.white('   🎯 topic     → Focus on specific subject areas'));
    console.log(chalk.white('   ⏰ temporal  → Filter by time periods'));
    console.log(chalk.white('   🌐 geographic→ Filter by geographic regions'));
    console.log(chalk.white('   🏢 entity    → Focus on specific entities/organizations'));

    this.logConcept('Tilt (Representation Style)', 
      'Controls how content is represented - like tilting camera perspective');
    console.log(chalk.white('   🏷️  keywords  → Term-based representation (fastest)'));
    console.log(chalk.white('   🧮 embedding → Vector-based semantic similarity'));
    console.log(chalk.white('   🕸️  graph     → Relationship network representation'));
    console.log(chalk.white('   📅 temporal  → Time-based sequential representation'));
  }

  // === MCP CONNECTION MANAGEMENT ===

  async initializeConnection() {
    this.logBanner('MCP Connection Initialization', 'Connecting to Semem MCP Server');
    
    try {
      log.info('Creating stdio transport...');
      this.transport = new StdioClientTransport({
        command: 'node',
        args: ['mcp/index.js']
      });

      log.info('Creating MCP client...');
      this.client = new Client({
        name: 'zpt-basic-navigation-demo',
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
      this.logPerformance('Connection', connectionTime);

      // Test connection with a simple tool list
      const tools = await this.client.listTools();
      const zptTools = tools.tools.filter(tool => tool.name.startsWith('zpt_'));
      
      this.logSuccess(`Found ${zptTools.length} ZPT tools available`);
      zptTools.forEach(tool => {
        console.log(chalk.gray(`   📱 ${tool.name}: ${tool.description.slice(0, 80)}...`));
      });

    } catch (error) {
      this.logError('Failed to initialize MCP connection', error);
      throw error;
    }
  }

  // === ZPT TOOL DEMONSTRATIONS ===

  async demonstrateZPTSchema() {
    this.logBanner('ZPT Schema Exploration', 'Understanding ZPT Parameter Structure');
    
    try {
      this.logStep(1, 'Retrieving ZPT parameter schema');
      
      const startTime = Date.now();
      const result = await this.client.callTool({
        name: 'zpt_get_schema',
        arguments: {}
      });
      const duration = Date.now() - startTime;

      if (result.content && result.content[0]) {
        const schema = JSON.parse(result.content[0].text);
        this.logSuccess('Schema retrieved successfully');
        this.logPerformance('Schema retrieval', duration);

        if (schema.success && schema.schema) {
          console.log(chalk.white('\n📋 Available Parameters:'));
          Object.entries(schema.schema.parameters).forEach(([param, details]) => {
            console.log(chalk.cyan(`   • ${param}: ${details.description}`));
            if (details.enum) {
              console.log(chalk.gray(`     Options: ${details.enum.join(', ')}`));
            }
          });
        }
      }

    } catch (error) {
      this.logError('Failed to retrieve ZPT schema', error);
    }
  }

  async demonstrateNavigationPreview() {
    this.logBanner('Navigation Preview', 'Quick exploration before full navigation');
    
    const queries = [
      'artificial intelligence',
      'climate change',
      'quantum computing'
    ];

    for (const query of queries) {
      this.logStep(queries.indexOf(query) + 1, `Previewing navigation for: "${query}"`);
      
      try {
        const startTime = Date.now();
        const result = await this.client.callTool({
          name: 'zpt_preview',
          arguments: {
            query: query,
            zoom: 'entity'
          }
        });
        const duration = Date.now() - startTime;

        if (result.content && result.content[0]) {
          const preview = JSON.parse(result.content[0].text);
          this.logSuccess(`Preview completed for "${query}"`);
          this.logPerformance('Preview', duration);

          if (preview.success && preview.preview) {
            console.log(chalk.white(`   📊 Content counts by zoom level:`));
            Object.entries(preview.preview.contentCounts || {}).forEach(([zoom, count]) => {
              console.log(chalk.gray(`     ${zoom}: ${count} items`));
            });
            console.log(chalk.white(`   🎯 Estimated tokens: ${preview.preview.estimatedTokens || 'N/A'}`));
          }
        }

        this.performanceMetrics.previews.push({ query, duration });

      } catch (error) {
        this.logError(`Preview failed for "${query}"`, error);
      }
    }
  }

  async demonstrateBasicNavigation() {
    this.logBanner('Basic ZPT Navigation', 'Exploring different Zoom/Pan/Tilt combinations');
    
    const navigationExamples = [
      {
        title: 'Quick Entity Lookup',
        description: 'Fast factual information about AI entities',
        params: {
          query: 'artificial intelligence',
          zoom: 'entity',
          tilt: 'keywords',
          transform: { maxTokens: 1000, format: 'json' }
        }
      },
      {
        title: 'Relationship Exploration',
        description: 'Understanding connections between ML concepts',
        params: {
          query: 'machine learning algorithms',
          zoom: 'unit',
          tilt: 'graph',
          transform: { maxTokens: 2000, format: 'structured' }
        }
      },
      {
        title: 'Topic Overview',
        description: 'High-level view of climate research',
        params: {
          query: 'climate change research',
          zoom: 'community',
          tilt: 'keywords',
          transform: { maxTokens: 1500, format: 'json' }
        }
      }
    ];

    for (const example of navigationExamples) {
      this.logStep(navigationExamples.indexOf(example) + 1, `${example.title}: ${example.description}`);
      
      console.log(chalk.cyan('   🧭 Navigation parameters:'));
      console.log(chalk.white(`     Query: "${example.params.query}"`));
      console.log(chalk.white(`     Zoom: ${example.params.zoom} (${this.getZoomDescription(example.params.zoom)})`));
      console.log(chalk.white(`     Tilt: ${example.params.tilt} (${this.getTiltDescription(example.params.tilt)})`));
      console.log(chalk.white(`     Tokens: ${example.params.transform.maxTokens}`));

      try {
        const startTime = Date.now();
        const result = await this.client.callTool({
          name: 'zpt_navigate',
          arguments: example.params
        });
        const duration = Date.now() - startTime;

        if (result.content && result.content[0]) {
          const navigation = JSON.parse(result.content[0].text);
          this.logSuccess(`Navigation completed: ${example.title}`);
          this.logPerformance('Navigation', duration);

          if (navigation.success && navigation.content) {
            console.log(chalk.white('   📊 Navigation results:'));
            console.log(chalk.gray(`     Content items: ${navigation.content.results?.length || 0}`));
            console.log(chalk.gray(`     Token count: ${navigation.metadata?.tokenCount || 'N/A'}`));
            
            if (navigation.metadata?.pipeline) {
              console.log(chalk.gray(`     Selection time: ${navigation.metadata.pipeline.selectionTime}ms`));
              console.log(chalk.gray(`     Transformation time: ${navigation.metadata.pipeline.transformationTime}ms`));
            }

            // Show sample content
            if (navigation.content.results && navigation.content.results.length > 0) {
              const sampleItem = navigation.content.results[0];
              console.log(chalk.white(`   📄 Sample result:`));
              console.log(chalk.gray(`     ${sampleItem.title || 'Untitled'}`));
              console.log(chalk.gray(`     ${(sampleItem.content || '').slice(0, 100)}...`));
            }
          }
        }

        this.navigationResults.push({
          title: example.title,
          params: example.params,
          duration,
          success: true
        });
        this.performanceMetrics.navigations.push({ title: example.title, duration });

      } catch (error) {
        this.logError(`Navigation failed: ${example.title}`, error);
        this.navigationResults.push({
          title: example.title,
          params: example.params,
          duration: 0,
          success: false,
          error: error.message
        });
      }
    }
  }

  async demonstrateParameterValidation() {
    this.logBanner('Parameter Validation', 'Testing ZPT parameter validation and error handling');
    
    const validationTests = [
      {
        title: 'Valid Parameters',
        params: {
          query: 'valid query',
          zoom: 'entity',
          tilt: 'keywords'
        },
        shouldPass: true
      },
      {
        title: 'Empty Query',
        params: {
          query: '',
          zoom: 'entity',
          tilt: 'keywords'
        },
        shouldPass: false
      },
      {
        title: 'Invalid Zoom Level',
        params: {
          query: 'test query',
          zoom: 'invalid_zoom',
          tilt: 'keywords'
        },
        shouldPass: false
      },
      {
        title: 'Invalid Tilt Style',
        params: {
          query: 'test query',
          zoom: 'entity',
          tilt: 'nonexistent_tilt'
        },
        shouldPass: false
      }
    ];

    for (const test of validationTests) {
      this.logStep(validationTests.indexOf(test) + 1, `Testing: ${test.title}`);
      
      try {
        const startTime = Date.now();
        const result = await this.client.callTool({
          name: 'zpt_validate_params',
          arguments: { params: test.params }
        });
        const duration = Date.now() - startTime;

        if (result.content && result.content[0]) {
          const validation = JSON.parse(result.content[0].text);
          
          if (test.shouldPass) {
            if (validation.success && validation.validation.valid) {
              this.logSuccess('Parameters validated successfully');
            } else {
              this.logWarning('Expected valid parameters but validation failed');
            }
          } else {
            if (validation.success && !validation.validation.valid) {
              this.logSuccess('Invalid parameters correctly detected');
              if (validation.validation.errors) {
                validation.validation.errors.forEach(error => {
                  console.log(chalk.yellow(`     • ${error.field}: ${error.message}`));
                });
              }
            } else {
              this.logWarning('Expected invalid parameters but validation passed');
            }
          }
          
          this.logPerformance('Validation', duration);
        }

        this.performanceMetrics.validations.push({ title: test.title, duration });

      } catch (error) {
        this.logError(`Validation test failed: ${test.title}`, error);
      }
    }
  }

  async demonstrateCorpusOptions() {
    this.logBanner('Corpus Options Discovery', 'Exploring available navigation parameters');
    
    this.logStep(1, 'Retrieving available navigation options for current corpus');
    
    try {
      const startTime = Date.now();
      const result = await this.client.callTool({
        name: 'zpt_get_options',
        arguments: {
          context: 'current',
          query: 'artificial intelligence'
        }
      });
      const duration = Date.now() - startTime;

      if (result.content && result.content[0]) {
        const options = JSON.parse(result.content[0].text);
        this.logSuccess('Corpus options retrieved successfully');
        this.logPerformance('Options retrieval', duration);

        if (options.success && options.options) {
          console.log(chalk.white('\n📋 Available Navigation Options:'));
          
          if (options.options.zoom) {
            console.log(chalk.cyan('   🔍 Zoom Levels:'));
            options.options.zoom.levels?.forEach(level => {
              console.log(chalk.gray(`     • ${level}: ${options.options.zoom.recommendations?.[level] || 'Available'}`));
            });
          }

          if (options.options.pan) {
            console.log(chalk.cyan('\n   🎯 Pan Filters:'));
            if (options.options.pan.availableDomains) {
              console.log(chalk.gray(`     Domains: ${options.options.pan.availableDomains.join(', ')}`));
            }
            if (options.options.pan.temporalRange) {
              console.log(chalk.gray(`     Time range: ${options.options.pan.temporalRange.earliest} to ${options.options.pan.temporalRange.latest}`));
            }
          }

          if (options.options.tilt) {
            console.log(chalk.cyan('\n   🎨 Tilt Styles:'));
            options.options.tilt.styles?.forEach(style => {
              console.log(chalk.gray(`     • ${style}: ${options.options.tilt.recommendations?.[style] || 'Available'}`));
            });
          }
        }
      }

    } catch (error) {
      this.logError('Failed to retrieve corpus options', error);
    }
  }

  // === HELPER METHODS ===

  getZoomDescription(zoom) {
    const descriptions = {
      entity: 'individual entities and properties',
      unit: 'semantic units with related entities',
      text: 'detailed textual content',
      community: 'topic clusters and overviews',
      corpus: 'high-level patterns'
    };
    return descriptions[zoom] || 'unknown zoom level';
  }

  getTiltDescription(tilt) {
    const descriptions = {
      keywords: 'term-based representation',
      embedding: 'vector similarity representation',
      graph: 'relationship network representation',
      temporal: 'time-based sequential representation'
    };
    return descriptions[tilt] || 'unknown tilt style';
  }

  // === PERFORMANCE SUMMARY ===

  generatePerformanceSummary() {
    this.logBanner('Performance Summary', 'ZPT Navigation Demo Results');
    
    const totalDuration = Date.now() - this.startTime;
    const successfulNavigations = this.navigationResults.filter(r => r.success).length;
    const totalNavigations = this.navigationResults.length;

    console.log(chalk.white('\n📊 Overall Statistics:'));
    console.log(chalk.green(`   ✅ Total demo duration: ${(totalDuration / 1000).toFixed(1)}s`));
    console.log(chalk.green(`   ✅ Successful navigations: ${successfulNavigations}/${totalNavigations}`));
    console.log(chalk.green(`   ✅ Operations completed: ${this.operationCount}`));

    if (this.performanceMetrics.navigations.length > 0) {
      const navTimes = this.performanceMetrics.navigations.map(n => n.duration);
      const avgNavTime = navTimes.reduce((a, b) => a + b, 0) / navTimes.length;
      const minNavTime = Math.min(...navTimes);
      const maxNavTime = Math.max(...navTimes);

      console.log(chalk.white('\n⚡ Navigation Performance:'));
      console.log(chalk.cyan(`   Average: ${avgNavTime.toFixed(0)}ms`));
      console.log(chalk.cyan(`   Fastest: ${minNavTime}ms`));
      console.log(chalk.cyan(`   Slowest: ${maxNavTime}ms`));
    }

    console.log(chalk.white('\n🎯 Navigation Results:'));
    this.navigationResults.forEach(result => {
      const status = result.success ? chalk.green('✅') : chalk.red('❌');
      console.log(`   ${status} ${result.title}: ${result.duration}ms`);
    });

    console.log(chalk.blue.bold('\n🎉 ZPT Basic Navigation Demo Complete!'));
    console.log(chalk.white('   Next steps: Try ZPTAdvancedFiltering.js for complex navigation patterns'));
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
      console.log(chalk.rainbow('🌟 Welcome to the ZPT Basic Navigation Demo! 🌟'));
      console.log(chalk.white('This demo will teach you the fundamentals of 3D knowledge graph navigation.\\n'));

      // Educational overview
      this.explainZPTConcepts();
      
      // Initialize connection
      await this.initializeConnection();
      
      // Schema exploration
      await this.demonstrateZPTSchema();
      
      // Preview functionality
      await this.demonstrateNavigationPreview();
      
      // Basic navigation patterns
      await this.demonstrateBasicNavigation();
      
      // Parameter validation
      await this.demonstrateParameterValidation();
      
      // Corpus options
      await this.demonstrateCorpusOptions();
      
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
  const demo = new ZPTBasicNavigationDemo();
  demo.runFullDemo().catch(error => {
    console.error(chalk.red('Fatal error:'), error);
    process.exit(1);
  });
}

export default ZPTBasicNavigationDemo;