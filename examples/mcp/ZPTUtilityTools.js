#!/usr/bin/env node

/**
 * ZPT Utility Tools Demonstration
 * 
 * This example showcases ZPT utility and support tools:
 * - Schema exploration and documentation (zpt_get_schema)
 * - Parameter validation and error handling (zpt_validate_params)
 * - Navigation options discovery (zpt_get_options)
 * - Corpus analysis and optimization (zpt_analyze_corpus)
 * 
 * Features comprehensive tool exploration, validation patterns, and optimization guidance.
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import chalk from 'chalk';
import log from 'loglevel';

// Configure comprehensive logging
log.setLevel('DEBUG');

class ZPTUtilityToolsDemo {
  constructor() {
    this.client = null;
    this.transport = null;
    this.startTime = Date.now();
    this.operationCount = 0;
    this.validationResults = [];
    this.schemaAnalysis = {};
    this.corpusAnalysis = {};
    this.performanceMetrics = {
      validations: [],
      schemaAccess: [],
      optionsQueries: [],
      corpusAnalyses: []
    };
  }

  // === ENHANCED LOGGING UTILITIES ===

  logBanner(title, subtitle = null) {
    const elapsed = ((Date.now() - this.startTime) / 1000).toFixed(1);
    console.log(chalk.blue(`\n${'▣'.repeat(75)}`));
    console.log(chalk.blue(`▣▣ ${title.padEnd(69)} ▣▣`));
    if (subtitle) {
      console.log(chalk.blue(`▣▣ ${subtitle.padEnd(69)} ▣▣`));
    }
    console.log(chalk.blue(`▣▣ ${'Time: ' + elapsed + 's | Operation: ' + ++this.operationCount}`.padEnd(69) + ' ▣▣'));
    console.log(chalk.blue(`${'▣'.repeat(75)}`));
  }

  logUtilityStep(step, title, description) {
    console.log(chalk.cyan(`\n🔧 UTILITY ${step}: ${title}`));
    console.log(chalk.cyan(`   📋 ${description}`));
  }

  logSchemaElement(element, details) {
    console.log(chalk.yellow(`   📊 ${element}:`));
    if (typeof details === 'object') {
      Object.entries(details).forEach(([key, value]) => {
        if (typeof value === 'object' && value !== null) {
          console.log(chalk.gray(`     ${key}: ${JSON.stringify(value)}`));
        } else {
          console.log(chalk.gray(`     ${key}: ${value}`));
        }
      });
    } else {
      console.log(chalk.gray(`     ${details}`));
    }
  }

  logValidationTest(test, result) {
    const status = result.valid ? '✅' : '❌';
    const status_color = result.valid ? chalk.green : chalk.red;

    console.log(status_color(`   ${status} ${test}`));

    if (!result.valid && result.errors) {
      result.errors.forEach(error => {
        console.log(chalk.red(`     🚫 ${error.field}: ${error.message}`));
      });
    }

    if (result.warnings) {
      result.warnings.forEach(warning => {
        console.log(chalk.yellow(`     ⚠️  ${warning.field}: ${warning.message}`));
      });
    }
  }

  logPerformance(operation, duration, details = {}) {
    const emoji = duration < 200 ? '⚡' : duration < 1000 ? '🚀' : '⏱️';
    console.log(chalk.magenta(`   ${emoji} ${operation}: ${duration}ms`));

    Object.entries(details).forEach(([key, value]) => {
      console.log(chalk.gray(`   📊 ${key}: ${value}`));
    });
  }

  logSuccess(message, data = null) {
    console.log(chalk.green(`   ✅ ${message}`));
    if (data && typeof data === 'object') {
      const preview = JSON.stringify(data, null, 2).slice(0, 150);
      console.log(chalk.gray(`   📊 ${preview}${preview.length >= 150 ? '...' : ''}`));
    }
  }

  logError(message, error = null) {
    console.log(chalk.red(`   ❌ ${message}`));
    if (error) {
      console.log(chalk.red(`   📝 ${error.message}`));
    }
  }

  // === UTILITY TOOLS CONCEPT EXPLANATIONS ===

  explainUtilityTools() {
    this.logBanner('ZPT Utility Tools Overview', 'Supporting tools for effective ZPT navigation');

    console.log(chalk.cyan('\n🔧 ZPT Utility Tool Categories:'));
    console.log(chalk.white('   ZPT includes support tools for validation, discovery, and optimization\\n'));

    console.log(chalk.yellow('📋 Schema and Documentation Tools:'));
    console.log(chalk.white('   🗂️  zpt_get_schema: Complete parameter schema with validation rules'));
    console.log(chalk.white('   📖 JSON Schema format with examples and error codes'));
    console.log(chalk.white('   🔍 Interactive schema exploration and documentation\\n'));

    console.log(chalk.yellow('✅ Validation and Error Handling:'));
    console.log(chalk.white('   🛡️  zpt_validate_params: Pre-flight parameter validation'));
    console.log(chalk.white('   🚨 Detailed error reporting with field-specific messages'));
    console.log(chalk.white('   💡 Validation suggestions and parameter recommendations\\n'));

    console.log(chalk.yellow('🔍 Discovery and Options:'));
    console.log(chalk.white('   🎯 zpt_get_options: Available parameters for current corpus'));
    console.log(chalk.white('   📊 Dynamic option discovery based on content'));
    console.log(chalk.white('   🗺️  Context-aware parameter suggestions\\n'));

    console.log(chalk.yellow('📈 Analysis and Optimization:'));
    console.log(chalk.white('   🔬 zpt_analyze_corpus: Structure analysis for optimization'));
    console.log(chalk.white('   ⚡ Performance recommendations and bottleneck identification'));
    console.log(chalk.white('   📊 Usage patterns and optimization strategies'));
  }

  // === MCP CONNECTION MANAGEMENT ===

  async initializeConnection() {
    this.logBanner('MCP Connection Initialization', 'Connecting for ZPT utility tool exploration');

    try {
      log.info('Creating stdio transport...');
      this.transport = new StdioClientTransport({
        command: 'node',
        args: ['mcp/index.js']
      });

      log.info('Creating MCP client...');
      this.client = new Client({
        name: 'zpt-utility-tools-demo',
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

      // Verify utility tools availability
      const tools = await this.client.listTools();
      const utilityTools = tools.tools.filter(tool =>
        ['zpt_get_schema', 'zpt_validate_params', 'zpt_get_options', 'zpt_analyze_corpus'].includes(tool.name)
      );

      this.logSuccess(`Found ${utilityTools.length}/4 ZPT utility tools available`);
      utilityTools.forEach(tool => {
        console.log(chalk.gray(`   🔧 ${tool.name}: ${tool.description.slice(0, 80)}...`));
      });

    } catch (error) {
      this.logError('Failed to initialize MCP connection', error);
      throw error;
    }
  }

  // === SCHEMA EXPLORATION DEMONSTRATIONS ===

  async demonstrateSchemaExploration() {
    this.logBanner('ZPT Schema Exploration', 'Understanding parameter structure and validation rules');

    this.logUtilityStep(1, 'Schema Retrieval', 'Getting complete ZPT parameter schema with validation rules');

    try {
      const startTime = Date.now();
      const result = await this.client.callTool({
        name: 'zpt_get_schema',
        arguments: {}
      });
      const duration = Date.now() - startTime;

      if (result.content && result.content[0]) {
        const schemaData = JSON.parse(result.content[0].text);
        this.logSuccess('ZPT schema retrieved successfully');
        this.logPerformance('Schema retrieval', duration);

        if (schemaData.success && schemaData.schema) {
          this.schemaAnalysis = schemaData.schema;

          console.log(chalk.white('\n📋 Parameter Schema Overview:'));

          // Core parameters
          if (schemaData.schema.parameters) {
            console.log(chalk.cyan('\n   🎯 Core Parameters:'));
            Object.entries(schemaData.schema.parameters).forEach(([param, details]) => {
              this.logSchemaElement(param, {
                type: details.type,
                required: details.required || false,
                description: details.description?.slice(0, 80) + (details.description?.length > 80 ? '...' : '')
              });
            });
          }

          // Zoom levels
          if (schemaData.schema.zoom) {
            console.log(chalk.cyan('\n   🔍 Available Zoom Levels:'));
            schemaData.schema.zoom.levels?.forEach(level => {
              this.logSchemaElement(level, schemaData.schema.zoom.descriptions?.[level] || 'Zoom level option');
            });
          }

          // Pan filter types
          if (schemaData.schema.pan) {
            console.log(chalk.cyan('\n   🎯 Pan Filter Categories:'));
            Object.entries(schemaData.schema.pan.filters || {}).forEach(([category, details]) => {
              this.logSchemaElement(category, details.description || 'Filter category');
            });
          }

          // Tilt styles
          if (schemaData.schema.tilt) {
            console.log(chalk.cyan('\n   🎨 Tilt Representation Styles:'));
            schemaData.schema.tilt.styles?.forEach(style => {
              this.logSchemaElement(style, schemaData.schema.tilt.descriptions?.[style] || 'Representation style');
            });
          }

          // Validation rules
          if (schemaData.schema.validation) {
            console.log(chalk.cyan('\n   ✅ Validation Rules:'));
            Object.entries(schemaData.schema.validation.rules || {}).forEach(([rule, description]) => {
              this.logSchemaElement(rule, description);
            });
          }

          // Error codes
          if (schemaData.schema.errors) {
            console.log(chalk.cyan('\n   🚨 Error Code Reference:'));
            Object.entries(schemaData.schema.errors.codes || {}).forEach(([code, details]) => {
              this.logSchemaElement(code, details.message || details);
            });
          }
        }
      }

      this.performanceMetrics.schemaAccess.push({ duration });

    } catch (error) {
      this.logError('Schema exploration failed', error);
    }
  }

  // === PARAMETER VALIDATION DEMONSTRATIONS ===

  async demonstrateParameterValidation() {
    this.logBanner('Parameter Validation', 'Testing validation rules with various parameter combinations');

    const validationTests = [
      {
        title: 'Valid Basic Parameters',
        params: {
          query: 'artificial intelligence',
          zoom: 'entity',
          tilt: 'keywords'
        },
        shouldPass: true
      },
      {
        title: 'Valid Complex Parameters',
        params: {
          query: 'machine learning research',
          zoom: 'unit',
          pan: {
            temporal: {
              start: '2023-01-01',
              end: '2024-01-01'
            },
            geographic: {
              regions: ['United States', 'United Kingdom']
            }
          },
          tilt: 'graph',
          transform: {
            maxTokens: 2000,
            format: 'structured'
          }
        },
        shouldPass: true
      },
      {
        title: 'Empty Query (Invalid)',
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
          query: 'valid query',
          zoom: 'invalid_zoom_level',
          tilt: 'keywords'
        },
        shouldPass: false
      },
      {
        title: 'Invalid Tilt Style',
        params: {
          query: 'valid query',
          zoom: 'entity',
          tilt: 'nonexistent_tilt'
        },
        shouldPass: false
      },
      {
        title: 'Invalid Date Format',
        params: {
          query: 'temporal query',
          zoom: 'community',
          pan: {
            temporal: {
              start: 'invalid-date-format',
              end: '2024-01-01'
            }
          },
          tilt: 'temporal'
        },
        shouldPass: false
      },
      {
        title: 'Invalid Geographic Bounding Box',
        params: {
          query: 'geographic query',
          zoom: 'unit',
          pan: {
            geographic: {
              bbox: [-200, 37.2, -121.9] // Invalid: missing coordinate and out of range
            }
          },
          tilt: 'keywords'
        },
        shouldPass: false
      },
      {
        title: 'Excessive Token Limit',
        params: {
          query: 'large query',
          zoom: 'corpus',
          tilt: 'embedding',
          transform: {
            maxTokens: 50000 // Likely exceeds limits
          }
        },
        shouldPass: false
      }
    ];

    for (const test of validationTests) {
      this.logUtilityStep(validationTests.indexOf(test) + 1, test.title, `Testing ${test.shouldPass ? 'valid' : 'invalid'} parameter set`);

      console.log(chalk.gray('\\n   🔍 Parameters to validate:'));
      console.log(chalk.gray(`   ${JSON.stringify(test.params, null, 2)}`));

      try {
        const startTime = Date.now();
        const result = await this.client.callTool({
          name: 'zpt_validate_params',
          arguments: {
            params: test.params
          }
        });
        const duration = Date.now() - startTime;

        if (result.content && result.content[0]) {
          const validation = JSON.parse(result.content[0].text);

          if (validation.success && validation.validation) {
            const isValid = validation.validation.valid;
            const testResult = {
              test: test.title,
              params: test.params,
              valid: isValid,
              errors: validation.validation.errors || [],
              warnings: validation.validation.warnings || [],
              duration
            };

            this.validationResults.push(testResult);
            this.logValidationTest(test.title, testResult);

            // Check if result matches expectation
            if (isValid === test.shouldPass) {
              this.logSuccess(`Validation result matches expectation`);
            } else {
              console.log(chalk.yellow(`   ⚠️  Unexpected validation result: expected ${test.shouldPass}, got ${isValid}`));
            }

            this.logPerformance('Validation', duration, {
              errors: testResult.errors.length,
              warnings: testResult.warnings.length
            });
          }
        }

        this.performanceMetrics.validations.push({ title: test.title, duration, expected: test.shouldPass });

      } catch (error) {
        this.logError(`Validation test failed: ${test.title}`, error);
      }
    }

    // Validation summary
    const passedTests = this.validationResults.filter(r => r.valid).length;
    const failedTests = this.validationResults.filter(r => !r.valid).length;

    console.log(chalk.cyan(`\\n📊 Validation Summary:`));
    console.log(chalk.green(`   ✅ Passed: ${passedTests} tests`));
    console.log(chalk.red(`   ❌ Failed: ${failedTests} tests`));
    console.log(chalk.white(`   📈 Total: ${this.validationResults.length} validation tests`));
  }

  // === OPTIONS DISCOVERY DEMONSTRATIONS ===

  async demonstrateOptionsDiscovery() {
    this.logBanner('Options Discovery', 'Exploring available parameters for corpus content');

    const optionQueries = [
      {
        title: 'General Options Discovery',
        description: 'Available options for current corpus state',
        query: null,
        context: 'current'
      },
      {
        title: 'AI Research Context',
        description: 'Options specific to AI research queries',
        query: 'artificial intelligence research',
        context: 'query-specific'
      },
      {
        title: 'Climate Science Context',
        description: 'Options for climate and environmental content',
        query: 'climate change renewable energy',
        context: 'domain-specific'
      },
      {
        title: 'Technology Companies',
        description: 'Options for technology company analysis',
        query: 'technology companies startups',
        context: 'entity-focused'
      }
    ];

    for (const optionQuery of optionQueries) {
      this.logUtilityStep(optionQueries.indexOf(optionQuery) + 1, optionQuery.title, optionQuery.description);

      try {
        const startTime = Date.now();
        const result = await this.client.callTool({
          name: 'zpt_get_options',
          arguments: {
            query: optionQuery.query,
            context: optionQuery.context
          }
        });
        const duration = Date.now() - startTime;

        if (result.content && result.content[0]) {
          const options = JSON.parse(result.content[0].text);
          this.logSuccess(`Options retrieved for: ${optionQuery.title}`);
          this.logPerformance('Options discovery', duration);

          if (options.success && options.options) {
            // Zoom level options
            if (options.options.zoom) {
              console.log(chalk.cyan('\\n   🔍 Available Zoom Levels:'));
              options.options.zoom.levels?.forEach(level => {
                const recommendation = options.options.zoom.recommendations?.[level];
                const itemCount = options.options.zoom.itemCounts?.[level] || 'N/A';
                console.log(chalk.white(`     • ${level}: ${itemCount} items ${recommendation ? '(' + recommendation + ')' : ''}`));
              });
            }

            // Pan filter options
            if (options.options.pan) {
              console.log(chalk.cyan('\\n   🎯 Available Pan Filters:'));

              if (options.options.pan.temporal) {
                console.log(chalk.white('     ⏰ Temporal:'));
                if (options.options.pan.temporal.availableRange) {
                  console.log(chalk.gray(`       Range: ${options.options.pan.temporal.availableRange.start} to ${options.options.pan.temporal.availableRange.end}`));
                }
                if (options.options.pan.temporal.granularities) {
                  console.log(chalk.gray(`       Granularities: ${options.options.pan.temporal.granularities.join(', ')}`));
                }
              }

              if (options.options.pan.geographic) {
                console.log(chalk.white('     🌍 Geographic:'));
                if (options.options.pan.geographic.availableRegions) {
                  console.log(chalk.gray(`       Regions: ${options.options.pan.geographic.availableRegions.slice(0, 5).join(', ')}${options.options.pan.geographic.availableRegions.length > 5 ? '...' : ''}`));
                }
                if (options.options.pan.geographic.coverage) {
                  console.log(chalk.gray(`       Geographic coverage: ${options.options.pan.geographic.coverage}%`));
                }
              }

              if (options.options.pan.entity) {
                console.log(chalk.white('     🏢 Entity:'));
                if (options.options.pan.entity.availableTypes) {
                  console.log(chalk.gray(`       Types: ${options.options.pan.entity.availableTypes.join(', ')}`));
                }
                if (options.options.pan.entity.topEntities) {
                  console.log(chalk.gray(`       Top entities: ${options.options.pan.entity.topEntities.slice(0, 3).join(', ')}`));
                }
              }

              if (options.options.pan.topic) {
                console.log(chalk.white('     📚 Topic:'));
                if (options.options.pan.topic.availableDomains) {
                  console.log(chalk.gray(`       Domains: ${options.options.pan.topic.availableDomains.join(', ')}`));
                }
                if (options.options.pan.topic.topKeywords) {
                  console.log(chalk.gray(`       Keywords: ${options.options.pan.topic.topKeywords.slice(0, 5).join(', ')}`));
                }
              }
            }

            // Tilt style options
            if (options.options.tilt) {
              console.log(chalk.cyan('\\n   🎨 Available Tilt Styles:'));
              options.options.tilt.styles?.forEach(style => {
                const recommendation = options.options.tilt.recommendations?.[style];
                const performance = options.options.tilt.performance?.[style] || 'N/A';
                console.log(chalk.white(`     • ${style}: ${performance} performance ${recommendation ? '(' + recommendation + ')' : ''}`));
              });
            }

            // Optimization recommendations
            if (options.options.recommendations) {
              console.log(chalk.cyan('\\n   💡 Optimization Recommendations:'));
              options.options.recommendations.forEach(rec => {
                console.log(chalk.yellow(`     💡 ${rec}`));
              });
            }
          }
        }

        this.performanceMetrics.optionsQueries.push({
          title: optionQuery.title,
          duration,
          context: optionQuery.context
        });

      } catch (error) {
        this.logError(`Options discovery failed: ${optionQuery.title}`, error);
      }
    }
  }

  // === CORPUS ANALYSIS DEMONSTRATIONS ===

  async demonstrateCorpusAnalysis() {
    this.logBanner('Corpus Analysis', 'Deep analysis of corpus structure for ZPT optimization');

    this.logUtilityStep(1, 'Comprehensive Corpus Analysis', 'Analyzing corpus structure, performance, and optimization opportunities');

    try {
      const startTime = Date.now();
      const result = await this.client.callTool({
        name: 'zpt_analyze_corpus',
        arguments: {
          analysisDepth: 'comprehensive',
          includeRecommendations: true,
          performanceAnalysis: true
        }
      });
      const duration = Date.now() - startTime;

      if (result.content && result.content[0]) {
        const analysis = JSON.parse(result.content[0].text);
        this.logSuccess('Corpus analysis completed');
        this.logPerformance('Corpus analysis', duration);

        if (analysis.success && analysis.analysis) {
          this.corpusAnalysis = analysis.analysis;

          // Basic corpus statistics
          if (analysis.analysis.statistics) {
            console.log(chalk.cyan('\\n📊 Corpus Statistics:'));
            Object.entries(analysis.analysis.statistics).forEach(([metric, value]) => {
              console.log(chalk.white(`   ${metric}: ${value}`));
            });
          }

          // Content distribution
          if (analysis.analysis.contentDistribution) {
            console.log(chalk.cyan('\\n📈 Content Distribution:'));

            if (analysis.analysis.contentDistribution.byZoomLevel) {
              console.log(chalk.white('   🔍 By Zoom Level:'));
              Object.entries(analysis.analysis.contentDistribution.byZoomLevel).forEach(([level, count]) => {
                console.log(chalk.gray(`     ${level}: ${count} items`));
              });
            }

            if (analysis.analysis.contentDistribution.byDomain) {
              console.log(chalk.white('   🎯 By Domain:'));
              Object.entries(analysis.analysis.contentDistribution.byDomain).forEach(([domain, percentage]) => {
                console.log(chalk.gray(`     ${domain}: ${percentage}%`));
              });
            }

            if (analysis.analysis.contentDistribution.temporal) {
              console.log(chalk.white('   ⏰ Temporal Distribution:'));
              Object.entries(analysis.analysis.contentDistribution.temporal).forEach(([period, count]) => {
                console.log(chalk.gray(`     ${period}: ${count} items`));
              });
            }
          }

          // Performance characteristics
          if (analysis.analysis.performance) {
            console.log(chalk.cyan('\\n⚡ Performance Characteristics:'));

            if (analysis.analysis.performance.indexing) {
              console.log(chalk.white('   📇 Indexing:'));
              Object.entries(analysis.analysis.performance.indexing).forEach(([index, status]) => {
                const emoji = status === 'optimal' ? '✅' : status === 'good' ? '⚠️' : '❌';
                console.log(chalk.gray(`     ${emoji} ${index}: ${status}`));
              });
            }

            if (analysis.analysis.performance.queryPatterns) {
              console.log(chalk.white('   🔍 Common Query Patterns:'));
              analysis.analysis.performance.queryPatterns.forEach(pattern => {
                console.log(chalk.gray(`     • ${pattern.pattern}: ${pattern.frequency}% of queries`));
              });
            }

            if (analysis.analysis.performance.bottlenecks) {
              console.log(chalk.white('   🚫 Performance Bottlenecks:'));
              analysis.analysis.performance.bottlenecks.forEach(bottleneck => {
                console.log(chalk.yellow(`     ⚠️  ${bottleneck.area}: ${bottleneck.description}`));
              });
            }
          }

          // Optimization recommendations
          if (analysis.analysis.recommendations) {
            console.log(chalk.cyan('\\n💡 Optimization Recommendations:'));

            if (analysis.analysis.recommendations.immediate) {
              console.log(chalk.white('   🚀 Immediate Optimizations:'));
              analysis.analysis.recommendations.immediate.forEach(rec => {
                console.log(chalk.green(`     ✅ ${rec}`));
              });
            }

            if (analysis.analysis.recommendations.performance) {
              console.log(chalk.white('   ⚡ Performance Improvements:'));
              analysis.analysis.recommendations.performance.forEach(rec => {
                console.log(chalk.yellow(`     💡 ${rec}`));
              });
            }

            if (analysis.analysis.recommendations.longTerm) {
              console.log(chalk.white('   📈 Long-term Optimizations:'));
              analysis.analysis.recommendations.longTerm.forEach(rec => {
                console.log(chalk.blue(`     🎯 ${rec}`));
              });
            }
          }

          // Navigation patterns
          if (analysis.analysis.navigationPatterns) {
            console.log(chalk.cyan('\\n🧭 Navigation Pattern Analysis:'));

            if (analysis.analysis.navigationPatterns.mostEffective) {
              console.log(chalk.white('   🎯 Most Effective Patterns:'));
              analysis.analysis.navigationPatterns.mostEffective.forEach(pattern => {
                console.log(chalk.green(`     ✅ ${pattern.description}: ${pattern.efficiency}% efficiency`));
              });
            }

            if (analysis.analysis.navigationPatterns.leastEffective) {
              console.log(chalk.white('   ⚠️  Least Effective Patterns:'));
              analysis.analysis.navigationPatterns.leastEffective.forEach(pattern => {
                console.log(chalk.red(`     ❌ ${pattern.description}: ${pattern.efficiency}% efficiency`));
              });
            }
          }
        }
      }

      this.performanceMetrics.corpusAnalyses.push({ duration });

    } catch (error) {
      this.logError('Corpus analysis failed', error);
    }
  }

  // === UTILITY TOOLS PERFORMANCE SUMMARY ===

  generateUtilityToolsSummary() {
    this.logBanner('Utility Tools Performance Summary', 'Comprehensive analysis of ZPT utility tool usage');

    const totalDuration = Date.now() - this.startTime;
    const successfulValidations = this.validationResults.filter(r => r.valid).length;
    const totalValidations = this.validationResults.length;

    console.log(chalk.white('\\n📊 Overall Statistics:'));
    console.log(chalk.green(`   ✅ Total demo duration: ${(totalDuration / 1000).toFixed(1)}s`));
    console.log(chalk.green(`   ✅ Validation tests: ${successfulValidations}/${totalValidations} passed`));
    console.log(chalk.green(`   ✅ Operations completed: ${this.operationCount}`));

    // Performance by tool type
    const toolPerformance = {
      schema: this.performanceMetrics.schemaAccess,
      validation: this.performanceMetrics.validations,
      options: this.performanceMetrics.optionsQueries,
      analysis: this.performanceMetrics.corpusAnalyses
    };

    console.log(chalk.white('\\n⚡ Tool Performance Analysis:'));
    Object.entries(toolPerformance).forEach(([tool, metrics]) => {
      if (metrics.length > 0) {
        const avgDuration = metrics.reduce((sum, m) => sum + m.duration, 0) / metrics.length;
        const minDuration = Math.min(...metrics.map(m => m.duration));
        const maxDuration = Math.max(...metrics.map(m => m.duration));

        console.log(chalk.cyan(`   ${tool}:`));
        console.log(chalk.gray(`     Average: ${avgDuration.toFixed(0)}ms`));
        console.log(chalk.gray(`     Range: ${minDuration}ms - ${maxDuration}ms`));
        console.log(chalk.gray(`     Tests: ${metrics.length}`));
      }
    });

    // Validation analysis
    if (this.validationResults.length > 0) {
      console.log(chalk.white('\\n✅ Validation Analysis:'));
      const errorTypes = {};
      this.validationResults.forEach(result => {
        result.errors.forEach(error => {
          errorTypes[error.field] = (errorTypes[error.field] || 0) + 1;
        });
      });

      console.log(chalk.cyan(`   Common validation errors:`));
      Object.entries(errorTypes).forEach(([field, count]) => {
        console.log(chalk.gray(`     ${field}: ${count} occurrences`));
      });
    }

    // Best practices and recommendations
    console.log(chalk.white('\\n💡 Best Practices for ZPT Utility Tools:'));
    console.log(chalk.yellow('   🔍 Always validate parameters before navigation for better performance'));
    console.log(chalk.yellow('   📊 Use options discovery to understand corpus capabilities'));
    console.log(chalk.yellow('   📈 Run corpus analysis periodically for optimization opportunities'));
    console.log(chalk.yellow('   🛡️  Implement robust error handling based on validation patterns'));
    console.log(chalk.yellow('   ⚡ Cache schema and options data for frequently used queries'));

    console.log(chalk.blue('\\n🎉 ZPT Utility Tools Demo Complete!'));
    console.log(chalk.white('   Next steps: Try ZPTPerformanceOptimization.js for advanced performance patterns'));
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
      console.log(chalk.green('🔧 Welcome to the ZPT Utility Tools Demo! 🔧'));
      console.log(chalk.white('This demo explores validation, discovery, and analysis tools.\\n'));

      // Educational overview
      this.explainUtilityTools();

      // Initialize connection
      await this.initializeConnection();

      // Schema exploration
      await this.demonstrateSchemaExploration();

      // Parameter validation
      await this.demonstrateParameterValidation();

      // Options discovery
      await this.demonstrateOptionsDiscovery();

      // Corpus analysis
      await this.demonstrateCorpusAnalysis();

      // Performance summary
      this.generateUtilityToolsSummary();

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
  const demo = new ZPTUtilityToolsDemo();
  demo.runFullDemo().catch(error => {
    console.error(chalk.red('Fatal error:'), error);
    process.exit(1);
  });
}

export default ZPTUtilityToolsDemo;