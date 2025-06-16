#!/usr/bin/env node

/**
 * ZPT Performance Optimization Demonstration
 * 
 * This example showcases performance optimization strategies for ZPT operations:
 * - Performance benchmarking across different parameter combinations
 * - Caching strategies and optimization patterns
 * - Resource usage analysis and optimization
 * - Best practices for high-performance ZPT navigation
 * 
 * Features comprehensive performance analysis, optimization recommendations, and benchmarking.
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import chalk from 'chalk';
import log from 'loglevel';

// Configure comprehensive logging
log.setLevel('DEBUG');

class ZPTPerformanceOptimizationDemo {
  constructor() {
    this.client = null;
    this.transport = null;
    this.startTime = Date.now();
    this.operationCount = 0;
    this.benchmarkResults = [];
    this.optimizationResults = [];
    this.resourceUsage = [];
    this.performanceMetrics = {
      baseline: [],
      optimized: [],
      cached: [],
      batch: []
    };
    this.cacheHitRates = {};
  }

  // === ADVANCED LOGGING AND PERFORMANCE UTILITIES ===

  logBanner(title, subtitle = null) {
    const elapsed = ((Date.now() - this.startTime) / 1000).toFixed(1);
    const memUsage = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1);
    
    console.log(chalk.red.bold(`\n${'⚡'.repeat(75)}`));
    console.log(chalk.red.bold(`⚡⚡ ${title.padEnd(69)} ⚡⚡`));
    if (subtitle) {
      console.log(chalk.red(`⚡⚡ ${subtitle.padEnd(69)} ⚡⚡`));
    }
    console.log(chalk.red.bold(`⚡⚡ ${'Time: ' + elapsed + 's | Memory: ' + memUsage + 'MB | Op: ' + ++this.operationCount}`.padEnd(69) + ' ⚡⚡'));
    console.log(chalk.red.bold(`${'⚡'.repeat(75)}`));
  }

  logPerformanceStep(step, title, description) {
    console.log(chalk.yellow.bold(`\n⚡ PERF ${step}: ${title}`));
    console.log(chalk.yellow(`   📊 ${description}`));
  }

  logBenchmark(operation, baselineMs, optimizedMs, improvement) {
    const improvementPercent = ((baselineMs - optimizedMs) / baselineMs * 100).toFixed(1);
    const emoji = improvement > 50 ? '🚀' : improvement > 20 ? '⚡' : improvement > 0 ? '📈' : '📉';
    
    console.log(chalk.magenta(`   ${emoji} ${operation}:`));
    console.log(chalk.white(`     Baseline: ${baselineMs}ms`));
    console.log(chalk.white(`     Optimized: ${optimizedMs}ms`));
    console.log(chalk.white(`     Improvement: ${improvementPercent}% (${Math.round(baselineMs - optimizedMs)}ms faster)`));
  }

  logResourceUsage(operation, resources) {
    console.log(chalk.cyan(`   📊 Resource Usage - ${operation}:`));
    Object.entries(resources).forEach(([resource, usage]) => {
      const emoji = resource === 'memory' ? '💾' : resource === 'cpu' ? '🖥️' : resource === 'network' ? '🌐' : '📊';
      console.log(chalk.gray(`     ${emoji} ${resource}: ${usage}`));
    });
  }

  logOptimizationStrategy(strategy, result) {
    const emoji = result.success ? '✅' : '❌';
    const impact = result.impact ? ` (${result.impact}% improvement)` : '';
    
    console.log(chalk.green(`   ${emoji} ${strategy}${impact}`));
    if (result.details) {
      console.log(chalk.gray(`     ${result.details}`));
    }
  }

  logCacheAnalysis(operation, hitRate, missRate) {
    const hitRatePercent = (hitRate * 100).toFixed(1);
    const missRatePercent = (missRate * 100).toFixed(1);
    const emoji = hitRate > 0.8 ? '🎯' : hitRate > 0.5 ? '⚡' : '❄️';
    
    console.log(chalk.blue(`   ${emoji} Cache Analysis - ${operation}:`));
    console.log(chalk.white(`     Hit rate: ${hitRatePercent}%`));
    console.log(chalk.white(`     Miss rate: ${missRatePercent}%`));
    console.log(chalk.white(`     Efficiency: ${hitRate > 0.5 ? 'Good' : 'Needs improvement'}`));
  }

  measureResourceUsage() {
    const usage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    return {
      memory: `${(usage.heapUsed / 1024 / 1024).toFixed(1)}MB`,
      heapTotal: `${(usage.heapTotal / 1024 / 1024).toFixed(1)}MB`,
      external: `${(usage.external / 1024 / 1024).toFixed(1)}MB`,
      cpu: `${((cpuUsage.user + cpuUsage.system) / 1000).toFixed(1)}ms`,
      arrayBuffers: `${(usage.arrayBuffers / 1024 / 1024).toFixed(1)}MB`
    };
  }

  // === PERFORMANCE OPTIMIZATION CONCEPTS ===

  explainPerformanceOptimization() {
    this.logBanner('ZPT Performance Optimization Concepts', 'Strategies for high-performance knowledge graph navigation');
    
    console.log(chalk.cyan('\n⚡ Performance Optimization Strategies:'));
    console.log(chalk.white('   ZPT performance depends on parameter selection, caching, and resource usage\\n'));

    console.log(chalk.yellow('🎯 Parameter Optimization:'));
    console.log(chalk.white('   📊 Choose appropriate zoom levels for content scope'));
    console.log(chalk.white('   🔍 Apply most selective filters first to reduce data volume'));
    console.log(chalk.white('   ⚡ Use preview mode for large result sets'));
    console.log(chalk.white('   📈 Optimize token limits for content requirements\\n'));

    console.log(chalk.yellow('💾 Caching Strategies:'));
    console.log(chalk.white('   🎯 Cache frequently accessed navigation patterns'));
    console.log(chalk.white('   📊 Implement progressive cache warming'));
    console.log(chalk.white('   ⏰ Use temporal locality for cache optimization'));
    console.log(chalk.white('   🔄 Cache validation and invalidation patterns\\n'));

    console.log(chalk.yellow('📊 Resource Management:'));
    console.log(chalk.white('   💾 Monitor memory usage for large corpus navigation'));
    console.log(chalk.white('   🖥️  CPU optimization through efficient parameter selection'));
    console.log(chalk.white('   🌐 Network optimization via batching and compression'));
    console.log(chalk.white('   ⚡ Parallel processing for independent operations\\n'));

    console.log(chalk.yellow('🔍 Query Optimization:'));
    console.log(chalk.white('   🎯 Index optimization for common access patterns'));
    console.log(chalk.white('   📈 Query planning and execution optimization'));
    console.log(chalk.white('   🔄 Result set optimization and streaming'));
    console.log(chalk.white('   ⚡ Materialized view strategies for complex queries'));
  }

  // === MCP CONNECTION MANAGEMENT ===

  async initializeConnection() {
    this.logBanner('High-Performance MCP Connection', 'Optimized connection for performance testing');
    
    try {
      log.info('Creating optimized stdio transport...');
      this.transport = new StdioClientTransport({
        command: 'node',
        args: ['mcp/index.js'],
        // Optimization: Larger buffer sizes for high-throughput operations
        options: {
          stdio: ['pipe', 'pipe', 'pipe'],
          timeout: 30000
        }
      });

      log.info('Creating performance-optimized MCP client...');
      this.client = new Client({
        name: 'zpt-performance-optimization-demo',
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

      console.log(chalk.green(`   ✅ Connection established in ${connectionTime}ms`));
      this.logResourceUsage('Connection', this.measureResourceUsage());

      // Verify ZPT tools availability and warm up connection
      const tools = await this.client.listTools();
      const zptTools = tools.tools.filter(tool => tool.name.startsWith('zpt_'));
      
      console.log(chalk.green(`   ✅ Found ${zptTools.length} ZPT tools available for performance testing`));

    } catch (error) {
      console.log(chalk.red(`   ❌ Failed to initialize optimized MCP connection: ${error.message}`));
      throw error;
    }
  }

  // === BASELINE PERFORMANCE MEASUREMENTS ===

  async measureBaselinePerformance() {
    this.logBanner('Baseline Performance Measurement', 'Establishing performance baselines for optimization comparison');
    
    const baselineTests = [
      {
        name: 'Simple Entity Query',
        params: {
          query: 'artificial intelligence',
          zoom: 'entity',
          tilt: 'keywords',
          transform: { maxTokens: 1000 }
        }
      },
      {
        name: 'Complex Unit Query',
        params: {
          query: 'machine learning research',
          zoom: 'unit',
          tilt: 'graph',
          transform: { maxTokens: 2000 }
        }
      },
      {
        name: 'Filtered Community Query',
        params: {
          query: 'climate change',
          zoom: 'community',
          pan: {
            temporal: { start: '2020-01-01', end: '2024-01-01' }
          },
          tilt: 'temporal',
          transform: { maxTokens: 1500 }
        }
      },
      {
        name: 'Multi-Dimensional Query',
        params: {
          query: 'renewable energy technology',
          zoom: 'unit',
          pan: {
            temporal: { start: '2022-01-01', end: '2024-01-01' },
            geographic: { regions: ['United States', 'Germany'] },
            entity: { entityTypes: ['Corporation', 'Research Institute'] }
          },
          tilt: 'embedding',
          transform: { maxTokens: 2500 }
        }
      }
    ];

    for (const test of baselineTests) {
      this.logPerformanceStep(baselineTests.indexOf(test) + 1, test.name, 'Measuring baseline performance');
      
      const iterations = 3; // Multiple runs for accuracy
      const durations = [];
      
      for (let i = 0; i < iterations; i++) {
        try {
          const resourcesBefore = this.measureResourceUsage();
          const startTime = Date.now();
          
          const result = await this.client.callTool({
            name: 'zpt_navigate',
            arguments: test.params
          });
          
          const duration = Date.now() - startTime;
          const resourcesAfter = this.measureResourceUsage();
          durations.push(duration);
          
          if (i === 0) { // Log resources for first run
            this.logResourceUsage(test.name, {
              'duration': `${duration}ms`,
              'memory_delta': `${(parseFloat(resourcesAfter.memory) - parseFloat(resourcesBefore.memory)).toFixed(1)}MB`
            });
          }

          if (result.content && result.content[0]) {
            const navigation = JSON.parse(result.content[0].text);
            if (navigation.success && i === 0) {
              const resultCount = navigation.content?.results?.length || 0;
              console.log(chalk.white(`   📊 Results: ${resultCount} items`));
            }
          }

        } catch (error) {
          console.log(chalk.red(`   ❌ Baseline test failed: ${error.message}`));
        }
      }

      if (durations.length > 0) {
        const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
        const minDuration = Math.min(...durations);
        const maxDuration = Math.max(...durations);
        
        this.benchmarkResults.push({
          name: test.name,
          type: 'baseline',
          avgDuration,
          minDuration,
          maxDuration,
          iterations,
          params: test.params
        });

        console.log(chalk.magenta(`   ⚡ Baseline: ${avgDuration.toFixed(0)}ms avg (${minDuration}-${maxDuration}ms range)`));
      }
    }
  }

  // === PARAMETER OPTIMIZATION STRATEGIES ===

  async demonstrateParameterOptimization() {
    this.logBanner('Parameter Optimization', 'Optimizing navigation parameters for better performance');
    
    const optimizationStrategies = [
      {
        name: 'Token Limit Optimization',
        baseline: {
          query: 'artificial intelligence research',
          zoom: 'unit',
          tilt: 'keywords',
          transform: { maxTokens: 5000 } // High token limit
        },
        optimized: {
          query: 'artificial intelligence research',
          zoom: 'unit',
          tilt: 'keywords',
          transform: { maxTokens: 1500 } // Optimized token limit
        }
      },
      {
        name: 'Zoom Level Optimization',
        baseline: {
          query: 'machine learning',
          zoom: 'corpus', // Broadest, potentially slowest
          tilt: 'graph'
        },
        optimized: {
          query: 'machine learning',
          zoom: 'entity', // More focused, faster
          tilt: 'graph'
        }
      },
      {
        name: 'Tilt Style Optimization',
        baseline: {
          query: 'climate change',
          zoom: 'community',
          tilt: 'embedding', // Computationally expensive
          transform: { maxTokens: 2000 }
        },
        optimized: {
          query: 'climate change',
          zoom: 'community',
          tilt: 'keywords', // More efficient
          transform: { maxTokens: 2000 }
        }
      },
      {
        name: 'Filter Ordering Optimization',
        baseline: {
          query: 'renewable energy',
          zoom: 'unit',
          pan: {
            topic: { domains: ['energy', 'environment'] }, // Broad filter first
            entity: { include: ['Tesla', 'SolarCity'] }, // Specific filter last
            temporal: { start: '2023-01-01', end: '2024-01-01' }
          },
          tilt: 'graph'
        },
        optimized: {
          query: 'renewable energy',
          zoom: 'unit',
          pan: {
            entity: { include: ['Tesla', 'SolarCity'] }, // Most selective first
            temporal: { start: '2023-01-01', end: '2024-01-01' },
            topic: { domains: ['energy', 'environment'] } // Broad filter last
          },
          tilt: 'graph'
        }
      }
    ];

    for (const strategy of optimizationStrategies) {
      this.logPerformanceStep(optimizationStrategies.indexOf(strategy) + 1, strategy.name, 'Comparing baseline vs optimized parameters');
      
      // Test baseline
      let baselineDuration = 0;
      try {
        const startTime = Date.now();
        await this.client.callTool({
          name: 'zpt_navigate',
          arguments: strategy.baseline
        });
        baselineDuration = Date.now() - startTime;
      } catch (error) {
        console.log(chalk.red(`   ❌ Baseline test failed: ${error.message}`));
        continue;
      }

      // Test optimized version
      let optimizedDuration = 0;
      try {
        const startTime = Date.now();
        await this.client.callTool({
          name: 'zpt_navigate',
          arguments: strategy.optimized
        });
        optimizedDuration = Date.now() - startTime;
      } catch (error) {
        console.log(chalk.red(`   ❌ Optimized test failed: ${error.message}`));
        continue;
      }

      const improvement = ((baselineDuration - optimizedDuration) / baselineDuration * 100);
      this.logBenchmark(strategy.name, baselineDuration, optimizedDuration, improvement);
      
      this.optimizationResults.push({
        strategy: strategy.name,
        baselineDuration,
        optimizedDuration,
        improvement
      });
    }
  }

  // === CACHING STRATEGY DEMONSTRATIONS ===

  async demonstrateCachingStrategies() {
    this.logBanner('Caching Strategy Analysis', 'Analyzing cache performance and optimization patterns');
    
    const cacheTestQueries = [
      'artificial intelligence',
      'machine learning',
      'artificial intelligence', // Repeat for cache hit
      'climate change',
      'machine learning', // Repeat for cache hit
      'quantum computing',
      'artificial intelligence', // Another repeat
    ];

    console.log(chalk.cyan('\n💾 Cache Performance Test:'));
    console.log(chalk.white('   Testing repeated queries to analyze cache behavior\\n'));

    let cacheHits = 0;
    let cacheMisses = 0;
    const queryTimes = {};

    for (const query of cacheTestQueries) {
      const isRepeat = queryTimes[query] !== undefined;
      
      try {
        const startTime = Date.now();
        const result = await this.client.callTool({
          name: 'zpt_navigate',
          arguments: {
            query: query,
            zoom: 'entity',
            tilt: 'keywords',
            transform: { maxTokens: 1000 }
          }
        });
        const duration = Date.now() - startTime;

        if (isRepeat) {
          const previousTime = queryTimes[query];
          const speedup = previousTime / duration;
          
          if (speedup > 1.5) { // Significant speedup indicates cache hit
            cacheHits++;
            console.log(chalk.green(`   🎯 Cache HIT: "${query}" (${duration}ms vs ${previousTime}ms, ${speedup.toFixed(1)}x faster)`));
          } else {
            cacheMisses++;
            console.log(chalk.yellow(`   ❄️  Cache MISS: "${query}" (${duration}ms vs ${previousTime}ms)`));
          }
        } else {
          cacheMisses++;
          console.log(chalk.blue(`   🔍 First query: "${query}" (${duration}ms)`));
        }

        queryTimes[query] = duration;

      } catch (error) {
        console.log(chalk.red(`   ❌ Cache test failed for "${query}": ${error.message}`));
      }
    }

    const totalQueries = cacheHits + cacheMisses;
    const hitRate = totalQueries > 0 ? cacheHits / totalQueries : 0;
    const missRate = totalQueries > 0 ? cacheMisses / totalQueries : 0;

    this.logCacheAnalysis('Query Cache', hitRate, missRate);
    this.cacheHitRates.queryCache = hitRate;
  }

  // === BATCH PROCESSING OPTIMIZATION ===

  async demonstrateBatchOptimization() {
    this.logBanner('Batch Processing Optimization', 'Comparing individual vs batch query performance');
    
    const queries = [
      'artificial intelligence',
      'machine learning',
      'climate change',
      'renewable energy',
      'quantum computing'
    ];

    // Individual queries
    this.logPerformanceStep(1, 'Individual Query Processing', 'Processing queries one by one');
    
    const individualTimes = [];
    let totalIndividualTime = 0;
    
    for (const query of queries) {
      try {
        const startTime = Date.now();
        await this.client.callTool({
          name: 'zpt_navigate',
          arguments: {
            query: query,
            zoom: 'entity',
            tilt: 'keywords',
            transform: { maxTokens: 500 }
          }
        });
        const duration = Date.now() - startTime;
        individualTimes.push(duration);
        totalIndividualTime += duration;
        
        console.log(chalk.white(`   📊 "${query}": ${duration}ms`));
        
      } catch (error) {
        console.log(chalk.red(`   ❌ Individual query failed: ${error.message}`));
      }
    }

    // Batch processing simulation (using preview for efficiency)
    this.logPerformanceStep(2, 'Batch Preview Processing', 'Using preview mode for efficient batch processing');
    
    const batchTimes = [];
    let totalBatchTime = 0;
    
    for (const query of queries) {
      try {
        const startTime = Date.now();
        await this.client.callTool({
          name: 'zpt_preview',
          arguments: {
            query: query,
            zoom: 'entity'
          }
        });
        const duration = Date.now() - startTime;
        batchTimes.push(duration);
        totalBatchTime += duration;
        
        console.log(chalk.white(`   📊 "${query}" (preview): ${duration}ms`));
        
      } catch (error) {
        console.log(chalk.red(`   ❌ Batch preview failed: ${error.message}`));
      }
    }

    // Performance comparison
    if (individualTimes.length > 0 && batchTimes.length > 0) {
      const avgIndividual = individualTimes.reduce((a, b) => a + b, 0) / individualTimes.length;
      const avgBatch = batchTimes.reduce((a, b) => a + b, 0) / batchTimes.length;
      const batchImprovement = ((avgIndividual - avgBatch) / avgIndividual * 100);
      
      this.logBenchmark('Batch vs Individual', avgIndividual, avgBatch, batchImprovement);
      
      console.log(chalk.cyan('\\n📈 Batch Processing Analysis:'));
      console.log(chalk.white(`   Total individual time: ${totalIndividualTime}ms`));
      console.log(chalk.white(`   Total batch time: ${totalBatchTime}ms`));
      console.log(chalk.white(`   Time savings: ${totalIndividualTime - totalBatchTime}ms (${((totalIndividualTime - totalBatchTime) / totalIndividualTime * 100).toFixed(1)}%)`));
    }
  }

  // === RESOURCE OPTIMIZATION ANALYSIS ===

  async demonstrateResourceOptimization() {
    this.logBanner('Resource Optimization Analysis', 'Monitoring and optimizing resource usage patterns');
    
    const resourceTests = [
      {
        name: 'Memory Efficient Query',
        params: {
          query: 'artificial intelligence',
          zoom: 'entity',
          tilt: 'keywords',
          transform: { maxTokens: 500 }
        }
      },
      {
        name: 'Memory Intensive Query',
        params: {
          query: 'artificial intelligence machine learning deep learning',
          zoom: 'corpus',
          tilt: 'embedding',
          transform: { maxTokens: 5000 }
        }
      },
      {
        name: 'CPU Efficient Query',
        params: {
          query: 'climate change',
          zoom: 'entity',
          tilt: 'keywords',
          transform: { maxTokens: 1000 }
        }
      },
      {
        name: 'CPU Intensive Query',
        params: {
          query: 'climate change renewable energy sustainability',
          zoom: 'community',
          pan: {
            temporal: { start: '2020-01-01', end: '2024-01-01' },
            geographic: { regions: ['United States', 'European Union', 'China'] },
            entity: { entityTypes: ['Corporation', 'Research Institute', 'Government'] }
          },
          tilt: 'graph',
          transform: { maxTokens: 3000 }
        }
      }
    ];

    for (const test of resourceTests) {
      this.logPerformanceStep(resourceTests.indexOf(test) + 1, test.name, 'Measuring resource usage patterns');
      
      const resourcesBefore = this.measureResourceUsage();
      const startTime = Date.now();
      
      try {
        const result = await this.client.callTool({
          name: 'zpt_navigate',
          arguments: test.params
        });
        
        const duration = Date.now() - startTime;
        const resourcesAfter = this.measureResourceUsage();
        
        const memoryDelta = parseFloat(resourcesAfter.memory) - parseFloat(resourcesBefore.memory);
        const cpuDelta = parseFloat(resourcesAfter.cpu) - parseFloat(resourcesBefore.cpu);
        
        this.logResourceUsage(test.name, {
          'duration': `${duration}ms`,
          'memory_usage': resourcesAfter.memory,
          'memory_delta': `${memoryDelta.toFixed(1)}MB`,
          'cpu_delta': `${cpuDelta.toFixed(1)}ms`,
          'heap_total': resourcesAfter.heapTotal
        });

        if (result.content && result.content[0]) {
          const navigation = JSON.parse(result.content[0].text);
          if (navigation.success) {
            const resultCount = navigation.content?.results?.length || 0;
            const efficiency = resultCount > 0 ? (resultCount / duration * 1000).toFixed(2) : '0';
            console.log(chalk.white(`   ⚡ Efficiency: ${efficiency} results/second`));
          }
        }

        this.resourceUsage.push({
          test: test.name,
          duration,
          memoryDelta,
          cpuDelta,
          resources: resourcesAfter
        });

      } catch (error) {
        console.log(chalk.red(`   ❌ Resource test failed: ${error.message}`));
      }
    }
  }

  // === COMPREHENSIVE PERFORMANCE SUMMARY ===

  generatePerformanceOptimizationSummary() {
    this.logBanner('Performance Optimization Summary', 'Comprehensive analysis and recommendations');
    
    const totalDuration = Date.now() - this.startTime;
    
    console.log(chalk.white('\\n📊 Overall Performance Analysis:'));
    console.log(chalk.green(`   ✅ Total demo duration: ${(totalDuration / 1000).toFixed(1)}s`));
    console.log(chalk.green(`   ✅ Benchmark tests completed: ${this.benchmarkResults.length}`));
    console.log(chalk.green(`   ✅ Optimization strategies tested: ${this.optimizationResults.length}`));
    console.log(chalk.green(`   ✅ Operations completed: ${this.operationCount}`));

    // Baseline performance summary
    if (this.benchmarkResults.length > 0) {
      console.log(chalk.white('\\n⚡ Baseline Performance Results:'));
      this.benchmarkResults.forEach(result => {
        console.log(chalk.cyan(`   ${result.name}: ${result.avgDuration.toFixed(0)}ms avg (${result.minDuration}-${result.maxDuration}ms range)`));
      });
    }

    // Optimization results summary
    if (this.optimizationResults.length > 0) {
      console.log(chalk.white('\\n🚀 Optimization Results:'));
      const totalImprovements = this.optimizationResults.filter(r => r.improvement > 0);
      const avgImprovement = totalImprovements.length > 0 ? 
        totalImprovements.reduce((sum, r) => sum + r.improvement, 0) / totalImprovements.length : 0;
      
      console.log(chalk.green(`   ✅ Successful optimizations: ${totalImprovements.length}/${this.optimizationResults.length}`));
      console.log(chalk.green(`   ✅ Average improvement: ${avgImprovement.toFixed(1)}%`));
      
      this.optimizationResults.forEach(result => {
        const emoji = result.improvement > 0 ? '✅' : '❌';
        console.log(chalk.white(`   ${emoji} ${result.strategy}: ${result.improvement.toFixed(1)}% improvement`));
      });
    }

    // Cache performance summary
    if (this.cacheHitRates.queryCache !== undefined) {
      console.log(chalk.white('\\n💾 Cache Performance:'));
      const hitRatePercent = (this.cacheHitRates.queryCache * 100).toFixed(1);
      const cacheEmoji = this.cacheHitRates.queryCache > 0.5 ? '🎯' : '❄️';
      console.log(chalk.cyan(`   ${cacheEmoji} Query cache hit rate: ${hitRatePercent}%`));
    }

    // Resource usage analysis
    if (this.resourceUsage.length > 0) {
      console.log(chalk.white('\\n📊 Resource Usage Analysis:'));
      const avgMemoryDelta = this.resourceUsage.reduce((sum, r) => sum + r.memoryDelta, 0) / this.resourceUsage.length;
      const avgDuration = this.resourceUsage.reduce((sum, r) => sum + r.duration, 0) / this.resourceUsage.length;
      
      console.log(chalk.cyan(`   💾 Average memory delta: ${avgMemoryDelta.toFixed(1)}MB`));
      console.log(chalk.cyan(`   ⏱️  Average query duration: ${avgDuration.toFixed(0)}ms`));
      
      const mostEfficient = this.resourceUsage.reduce((best, current) => 
        (current.duration < best.duration) ? current : best
      );
      console.log(chalk.green(`   🏆 Most efficient: ${mostEfficient.test} (${mostEfficient.duration}ms)`));
    }

    // Performance recommendations
    console.log(chalk.white('\\n💡 Performance Optimization Recommendations:'));
    
    console.log(chalk.yellow('   🎯 Parameter Optimization:'));
    console.log(chalk.white('     • Use entity or unit zoom for specific queries'));
    console.log(chalk.white('     • Apply most selective filters first'));
    console.log(chalk.white('     • Choose keywords tilt for fastest performance'));
    console.log(chalk.white('     • Optimize token limits based on content requirements'));
    
    console.log(chalk.yellow('\\n   💾 Caching Strategies:'));
    console.log(chalk.white('     • Implement query result caching for repeated patterns'));
    console.log(chalk.white('     • Use progressive cache warming for common queries'));
    console.log(chalk.white('     • Cache validation patterns for parameter checking'));
    console.log(chalk.white('     • Implement smart cache invalidation strategies'));
    
    console.log(chalk.yellow('\\n   📊 Resource Management:'));
    console.log(chalk.white('     • Monitor memory usage for large corpus operations'));
    console.log(chalk.white('     • Use preview mode for initial exploration'));
    console.log(chalk.white('     • Implement connection pooling for high-throughput scenarios'));
    console.log(chalk.white('     • Consider batch processing for multiple queries'));
    
    console.log(chalk.yellow('\\n   ⚡ Advanced Optimizations:'));
    console.log(chalk.white('     • Implement query plan optimization'));
    console.log(chalk.white('     • Use materialized views for complex filters'));
    console.log(chalk.white('     • Consider index optimization for frequent access patterns'));
    console.log(chalk.white('     • Implement result streaming for large datasets'));

    console.log(chalk.red.bold('\\n🎉 ZPT Performance Optimization Demo Complete!'));
    console.log(chalk.white('   Next steps: Try ZPTIntegrationWorkflows.js for integration patterns'));
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
      console.log(chalk.rainbow('⚡ Welcome to the ZPT Performance Optimization Demo! ⚡'));
      console.log(chalk.white('This demo analyzes and optimizes ZPT navigation performance.\\n'));

      // Educational overview
      this.explainPerformanceOptimization();
      
      // Initialize optimized connection
      await this.initializeConnection();
      
      // Baseline performance measurement
      await this.measureBaselinePerformance();
      
      // Parameter optimization
      await this.demonstrateParameterOptimization();
      
      // Caching strategies
      await this.demonstrateCachingStrategies();
      
      // Batch processing
      await this.demonstrateBatchOptimization();
      
      // Resource optimization
      await this.demonstrateResourceOptimization();
      
      // Comprehensive summary
      this.generatePerformanceOptimizationSummary();

    } catch (error) {
      console.log(chalk.red(`   ❌ Demo failed with critical error: ${error.message}`));
      process.exit(1);
    } finally {
      await this.cleanup();
    }
  }
}

// === SCRIPT EXECUTION ===

if (import.meta.url === `file://${process.argv[1]}`) {
  const demo = new ZPTPerformanceOptimizationDemo();
  demo.runFullDemo().catch(error => {
    console.error(chalk.red('Fatal error:'), error);
    process.exit(1);
  });
}

export default ZPTPerformanceOptimizationDemo;