#!/usr/bin/env node

/**
 * ZPT Integration Workflows Demonstration
 * 
 * This example showcases advanced integration patterns combining ZPT with:
 * - Semem core memory management for context-aware navigation
 * - Ragno knowledge graph operations for enriched exploration
 * - Multi-modal workflows combining all three systems
 * - End-to-end research and analysis pipelines
 * 
 * Features comprehensive workflow orchestration, cross-system optimization, and advanced integration patterns.
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import chalk from 'chalk';
import log from 'loglevel';

// Configure comprehensive logging
log.setLevel('DEBUG');

class ZPTIntegrationWorkflowsDemo {
  constructor() {
    this.client = null;
    this.transport = null;
    this.startTime = Date.now();
    this.operationCount = 0;
    this.workflowResults = [];
    this.integrationArtifacts = {
      memories: [],
      entities: [],
      relationships: [],
      navigationResults: [],
      insights: []
    };
    this.performanceMetrics = {
      workflows: [],
      integrations: [],
      crossSystem: []
    };
  }

  // === ADVANCED INTEGRATION LOGGING ===

  logBanner(title, subtitle = null) {
    const elapsed = ((Date.now() - this.startTime) / 1000).toFixed(1);
    const memUsage = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1);
    
    console.log(chalk.rainbow(`\n${'🌟'.repeat(75)}`));
    console.log(chalk.magenta.bold(`🌟🌟 ${title.padEnd(69)} 🌟🌟`));
    if (subtitle) {
      console.log(chalk.magenta(`🌟🌟 ${subtitle.padEnd(69)} 🌟🌟`));
    }
    console.log(chalk.magenta.bold(`🌟🌟 ${'Time: ' + elapsed + 's | Memory: ' + memUsage + 'MB | Op: ' + ++this.operationCount}`.padEnd(69) + ' 🌟🌟'));
    console.log(chalk.rainbow(`${'🌟'.repeat(75)}`));
  }

  logWorkflowStep(step, title, description, systems = []) {
    const systemEmojis = {
      semem: '🧠',
      ragno: '🕸️',
      zpt: '🧭'
    };
    const systemIndicators = systems.map(s => systemEmojis[s] || '⚙️').join(' ');
    
    console.log(chalk.cyan.bold(`\n🔄 WORKFLOW ${step}: ${title} ${systemIndicators}`));
    console.log(chalk.cyan(`   📋 ${description}`));
  }

  logIntegration(fromSystem, toSystem, dataType, count) {
    const systemEmojis = {
      semem: '🧠',
      ragno: '🕸️',
      zpt: '🧭'
    };
    
    console.log(chalk.yellow(`   🔄 Integration: ${systemEmojis[fromSystem]} ${fromSystem} → ${systemEmojis[toSystem]} ${toSystem}`));
    console.log(chalk.white(`     📊 Transferred: ${count} ${dataType}`));
  }

  logWorkflowInsight(insight, confidence = null) {
    const confidenceStr = confidence ? ` (${confidence}% confidence)` : '';
    console.log(chalk.magenta.bold(`   💡 INSIGHT: ${insight}${confidenceStr}`));
  }

  logCrossSystemPerformance(operation, systemTimes) {
    console.log(chalk.blue(`   ⚡ Cross-system performance - ${operation}:`));
    Object.entries(systemTimes).forEach(([system, time]) => {
      const emoji = system === 'semem' ? '🧠' : system === 'ragno' ? '🕸️' : '🧭';
      console.log(chalk.gray(`     ${emoji} ${system}: ${time}ms`));
    });
    const totalTime = Object.values(systemTimes).reduce((a, b) => a + b, 0);
    console.log(chalk.gray(`     🏁 Total: ${totalTime}ms`));
  }

  logArtifact(type, count, details = {}) {
    console.log(chalk.green(`   ✨ Created: ${count} ${type}`));
    Object.entries(details).forEach(([key, value]) => {
      console.log(chalk.gray(`     ${key}: ${value}`));
    });
  }

  // === INTEGRATION WORKFLOW CONCEPTS ===

  explainIntegrationWorkflows() {
    this.logBanner('ZPT Integration Workflow Concepts', 'Combining ZPT with Semem and Ragno for powerful workflows');
    
    console.log(chalk.cyan('\n🌟 Integration Architecture:'));
    console.log(chalk.white('   ZPT navigation combined with semantic memory and knowledge graphs'));
    console.log(chalk.white('   creates powerful multi-modal exploration and analysis workflows\\n'));

    console.log(chalk.yellow('🧠 Semem + ZPT Integration:'));
    console.log(chalk.white('   📚 Context-aware navigation using stored memories'));
    console.log(chalk.white('   🎯 Memory-guided parameter optimization'));
    console.log(chalk.white('   🔍 Semantic similarity for navigation refinement'));
    console.log(chalk.white('   💾 Navigation result storage for future reference\\n'));

    console.log(chalk.yellow('🕸️ Ragno + ZPT Integration:'));
    console.log(chalk.white('   🏗️  Knowledge graph construction from navigation results'));
    console.log(chalk.white('   🔗 Entity-relationship aware navigation'));
    console.log(chalk.white('   📊 Graph structure guiding navigation parameters'));
    console.log(chalk.white('   🎭 Multi-perspective corpus exploration\\n'));

    console.log(chalk.yellow('🌐 Triple Integration (Semem + Ragno + ZPT):'));
    console.log(chalk.white('   🧬 Memory-enriched knowledge graph navigation'));
    console.log(chalk.white('   🔄 Iterative refinement across all three systems'));
    console.log(chalk.white('   🎯 Context-aware, graph-guided exploration'));
    console.log(chalk.white('   📈 Comprehensive insight generation and validation\\n'));

    console.log(chalk.yellow('🚀 Workflow Patterns:'));
    console.log(chalk.white('   📋 Research pipeline: Memory → Graph → Navigation → Insights'));
    console.log(chalk.white('   🔍 Exploration workflow: Navigate → Extract → Store → Refine'));
    console.log(chalk.white('   💡 Discovery pattern: Graph → Memory → Navigate → Validate'));
    console.log(chalk.white('   🎯 Analysis cycle: Store → Build → Navigate → Analyze → Repeat'));
  }

  // === MCP CONNECTION MANAGEMENT ===

  async initializeConnection() {
    this.logBanner('Integrated MCP Connection', 'Connecting for cross-system workflow demonstration');
    
    try {
      log.info('Creating transport for integrated workflows...');
      this.transport = new StdioClientTransport({
        command: 'node',
        args: ['mcp/index.js']
      });

      log.info('Creating workflow-optimized MCP client...');
      this.client = new Client({
        name: 'zpt-integration-workflows-demo',
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

      // Verify all system tools availability
      const tools = await this.client.listTools();
      const sememTools = tools.tools.filter(tool => tool.name.startsWith('semem_'));
      const ragnoTools = tools.tools.filter(tool => tool.name.startsWith('ragno_'));
      const zptTools = tools.tools.filter(tool => tool.name.startsWith('zpt_'));
      
      console.log(chalk.green(`   🧠 Semem tools: ${sememTools.length}`));
      console.log(chalk.green(`   🕸️ Ragno tools: ${ragnoTools.length}`));
      console.log(chalk.green(`   🧭 ZPT tools: ${zptTools.length}`));
      console.log(chalk.green(`   🌟 Total integration capabilities: ${sememTools.length + ragnoTools.length + zptTools.length}`));

    } catch (error) {
      console.log(chalk.red(`   ❌ Failed to initialize integrated connection: ${error.message}`));
      throw error;
    }
  }

  // === MEMORY-GUIDED NAVIGATION WORKFLOW ===

  async demonstrateMemoryGuidedNavigation() {
    this.logBanner('Memory-Guided Navigation Workflow', 'Using stored memories to guide ZPT navigation');
    
    // Step 1: Store initial research context
    this.logWorkflowStep(1, 'Context Storage', 'Storing research context in semantic memory', ['semem']);
    
    const researchContext = {
      prompt: "I'm researching the intersection of artificial intelligence and climate change solutions",
      response: "AI applications in climate science include predictive modeling, renewable energy optimization, carbon capture technologies, and smart grid management. Key areas of focus are machine learning for weather prediction, AI-driven energy efficiency, and automated environmental monitoring systems.",
      metadata: {
        domain: "AI-Climate",
        research_phase: "initial_exploration",
        priority: "high"
      }
    };

    try {
      const startTime = Date.now();
      const memoryResult = await this.client.callTool({
        name: 'semem_store_interaction',
        arguments: researchContext
      });
      const memoryTime = Date.now() - startTime;

      if (memoryResult.content && memoryResult.content[0]) {
        const stored = JSON.parse(memoryResult.content[0].text);
        if (stored.success) {
          this.logArtifact('memories', 1, { 
            'storage_time': `${memoryTime}ms`,
            'concepts': stored.concepts?.length || 0
          });
        }
      }
    } catch (error) {
      console.log(chalk.red(`   ❌ Memory storage failed: ${error.message}`));
    }

    // Step 2: Retrieve related memories for navigation guidance
    this.logWorkflowStep(2, 'Memory Retrieval', 'Finding related memories to guide navigation', ['semem']);
    
    let relatedMemories = [];
    try {
      const startTime = Date.now();
      const retrievalResult = await this.client.callTool({
        name: 'semem_retrieve_memories',
        arguments: {
          query: "artificial intelligence climate change renewable energy",
          limit: 5,
          threshold: 0.6
        }
      });
      const retrievalTime = Date.now() - startTime;

      if (retrievalResult.content && retrievalResult.content[0]) {
        const memories = JSON.parse(retrievalResult.content[0].text);
        if (memories.success) {
          relatedMemories = memories.memories || [];
          this.logArtifact('retrieved_memories', relatedMemories.length, {
            'retrieval_time': `${retrievalTime}ms`,
            'avg_similarity': memories.averageSimilarity?.toFixed(3) || 'N/A'
          });
        }
      }
    } catch (error) {
      console.log(chalk.red(`   ❌ Memory retrieval failed: ${error.message}`));
    }

    // Step 3: Memory-guided ZPT navigation
    this.logWorkflowStep(3, 'Memory-Guided Navigation', 'Using memory insights for targeted ZPT exploration', ['semem', 'zpt']);
    
    const navigationQuery = relatedMemories.length > 0 ? 
      "AI climate solutions renewable energy optimization" : 
      "artificial intelligence climate change";

    try {
      const startTime = Date.now();
      const navigationResult = await this.client.callTool({
        name: 'zpt_navigate',
        arguments: {
          query: navigationQuery,
          zoom: 'unit',
          pan: {
            topic: {
              domains: ['artificial intelligence', 'climate science', 'renewable energy'],
              keywords: {
                include: ['AI', 'machine learning', 'climate', 'renewable', 'optimization'],
                exclude: ['fossil fuel', 'coal']
              }
            }
          },
          tilt: 'graph',
          transform: { maxTokens: 2000, format: 'structured' }
        }
      });
      const navigationTime = Date.now() - startTime;

      if (navigationResult.content && navigationResult.content[0]) {
        const navigation = JSON.parse(navigationResult.content[0].text);
        if (navigation.success) {
          const resultCount = navigation.content?.results?.length || 0;
          this.logArtifact('navigation_results', resultCount, {
            'navigation_time': `${navigationTime}ms`,
            'token_count': navigation.metadata?.tokenCount || 'N/A'
          });

          this.integrationArtifacts.navigationResults.push({
            query: navigationQuery,
            results: navigation.content?.results || [],
            metadata: navigation.metadata
          });
        }
      }
    } catch (error) {
      console.log(chalk.red(`   ❌ Memory-guided navigation failed: ${error.message}`));
    }

    this.logIntegration('semem', 'zpt', 'contextual guidance', relatedMemories.length);
  }

  // === GRAPH-ENHANCED NAVIGATION WORKFLOW ===

  async demonstrateGraphEnhancedNavigation() {
    this.logBanner('Graph-Enhanced Navigation Workflow', 'Using knowledge graphs to enrich ZPT navigation');
    
    // Step 1: Build knowledge graph from corpus
    this.logWorkflowStep(1, 'Knowledge Graph Construction', 'Building RDF graph for navigation enhancement', ['ragno']);
    
    const corpusChunks = [
      {
        content: `Artificial intelligence is revolutionizing climate science through advanced predictive modeling. 
                 Machine learning algorithms can analyze vast datasets to predict weather patterns, optimize renewable 
                 energy distribution, and improve carbon capture efficiency. Companies like Google and Microsoft are 
                 applying AI to reduce their carbon footprint and develop sustainable technologies.`,
        source: 'ai-climate-overview'
      },
      {
        content: `Renewable energy optimization using AI includes smart grid management, solar panel efficiency 
                 optimization, and wind farm placement algorithms. Tesla's energy division uses machine learning 
                 for battery management and energy storage optimization. The integration of AI with renewable 
                 energy systems is creating more efficient and reliable clean energy solutions.`,
        source: 'renewable-ai-integration'
      },
      {
        content: `Carbon capture and storage technologies are being enhanced with artificial intelligence. 
                 AI algorithms optimize the carbon capture process, predict optimal storage locations, and 
                 monitor long-term storage integrity. Research institutions like MIT and Stanford are 
                 developing AI-driven approaches to accelerate carbon capture deployment.`,
        source: 'ai-carbon-capture'
      }
    ];

    let knowledgeGraph = null;
    try {
      const startTime = Date.now();
      const graphResult = await this.client.callTool({
        name: 'ragno_decompose_corpus',
        arguments: {
          textChunks: corpusChunks,
          options: {
            extractRelationships: true,
            generateSummaries: true,
            maxEntitiesPerUnit: 15,
            minEntityConfidence: 0.6
          }
        }
      });
      const graphTime = Date.now() - startTime;

      if (graphResult.content && graphResult.content[0]) {
        const decomposition = JSON.parse(graphResult.content[0].text);
        if (decomposition.success) {
          knowledgeGraph = decomposition;
          this.logArtifact('knowledge_graph', 1, {
            'construction_time': `${graphTime}ms`,
            'entities': decomposition.entities?.length || 0,
            'relationships': decomposition.relationships?.length || 0,
            'semantic_units': decomposition.units?.length || 0
          });

          this.integrationArtifacts.entities = decomposition.entities || [];
          this.integrationArtifacts.relationships = decomposition.relationships || [];
        }
      }
    } catch (error) {
      console.log(chalk.red(`   ❌ Knowledge graph construction failed: ${error.message}`));
    }

    // Step 2: Extract key entities for navigation
    this.logWorkflowStep(2, 'Entity Extraction', 'Identifying key entities for targeted navigation', ['ragno']);
    
    let keyEntities = [];
    try {
      const startTime = Date.now();
      const entitiesResult = await this.client.callTool({
        name: 'ragno_get_entities',
        arguments: {
          filters: {
            limit: 10,
            minFrequency: 1,
            isEntryPoint: true
          }
        }
      });
      const entitiesTime = Date.now() - startTime;

      if (entitiesResult.content && entitiesResult.content[0]) {
        const entities = JSON.parse(entitiesResult.content[0].text);
        if (entities.success) {
          keyEntities = entities.entities || [];
          this.logArtifact('key_entities', keyEntities.length, {
            'extraction_time': `${entitiesTime}ms`,
            'entry_points': keyEntities.filter(e => e.isEntryPoint).length
          });
        }
      }
    } catch (error) {
      console.log(chalk.red(`   ❌ Entity extraction failed: ${error.message}`));
    }

    // Step 3: Graph-guided ZPT navigation
    this.logWorkflowStep(3, 'Graph-Guided Navigation', 'Using knowledge graph structure for navigation', ['ragno', 'zpt']);
    
    if (keyEntities.length > 0) {
      const entityNames = keyEntities.slice(0, 5).map(e => e.name || e.id).filter(name => name);
      
      try {
        const startTime = Date.now();
        const navigationResult = await this.client.callTool({
          name: 'zpt_navigate',
          arguments: {
            query: 'AI climate technology optimization',
            zoom: 'entity',
            pan: {
              entity: {
                include: entityNames,
                entityTypes: ['Corporation', 'Technology', 'Research'],
                relationshipDepth: 2
              },
              topic: {
                domains: ['artificial intelligence', 'climate technology']
              }
            },
            tilt: 'graph',
            transform: { maxTokens: 2500, format: 'structured' }
          }
        });
        const navigationTime = Date.now() - startTime;

        if (navigationResult.content && navigationResult.content[0]) {
          const navigation = JSON.parse(navigationResult.content[0].text);
          if (navigation.success) {
            const resultCount = navigation.content?.results?.length || 0;
            this.logArtifact('graph_navigation_results', resultCount, {
              'navigation_time': `${navigationTime}ms`,
              'entity_focus': entityNames.length,
              'graph_depth': 2
            });
          }
        }
      } catch (error) {
        console.log(chalk.red(`   ❌ Graph-guided navigation failed: ${error.message}`));
      }
    }

    this.logIntegration('ragno', 'zpt', 'entity guidance', keyEntities.length);
  }

  // === COMPREHENSIVE TRIPLE INTEGRATION WORKFLOW ===

  async demonstrateTripleIntegrationWorkflow() {
    this.logBanner('Triple Integration Workflow', 'Combining Semem + Ragno + ZPT for comprehensive analysis');
    
    // Step 1: Initialize research with memory context
    this.logWorkflowStep(1, 'Research Initialization', 'Setting up comprehensive research context', ['semem']);
    
    const researchQueries = [
      "How is AI being used in renewable energy optimization?",
      "What are the latest developments in AI-driven climate modeling?",
      "Which companies are leading AI applications in sustainability?"
    ];

    for (const query of researchQueries) {
      try {
        const response = await this.client.callTool({
          name: 'semem_generate_response',
          arguments: {
            prompt: query,
            useMemory: true,
            maxTokens: 500,
            temperature: 0.7
          }
        });

        if (response.content && response.content[0]) {
          const generatedResponse = JSON.parse(response.content[0].text);
          if (generatedResponse.success) {
            // Store the research interaction
            await this.client.callTool({
              name: 'semem_store_interaction',
              arguments: {
                prompt: query,
                response: generatedResponse.response,
                metadata: { workflow: 'triple_integration', type: 'research_query' }
              }
            });
          }
        }
      } catch (error) {
        console.log(chalk.red(`   ❌ Research query failed: ${error.message}`));
      }
    }

    this.logArtifact('research_interactions', researchQueries.length);

    // Step 2: Build comprehensive knowledge graph
    this.logWorkflowStep(2, 'Comprehensive Graph Building', 'Creating detailed knowledge graph from research', ['ragno']);
    
    const comprehensiveCorpus = [
      {
        content: `Google's DeepMind has developed AI systems for optimizing data center cooling, reducing energy 
                 consumption by 40%. Their WaveNet technology is also being applied to wind farm optimization, 
                 predicting wind patterns to maximize energy generation efficiency.`,
        source: 'google-ai-energy'
      },
      {
        content: `Microsoft's AI for Earth program supports over 400 projects worldwide using artificial intelligence 
                 for environmental challenges. Projects include AI-powered species monitoring, climate change 
                 impact prediction, and sustainable agriculture optimization.`,
        source: 'microsoft-ai-earth'
      },
      {
        content: `Tesla's AI systems manage energy storage and distribution across their Powerwall and Powerpack 
                 networks. Machine learning algorithms predict energy demand patterns and optimize charging 
                 schedules to maximize renewable energy utilization.`,
        source: 'tesla-energy-ai'
      },
      {
        content: `The Intergovernmental Panel on Climate Change (IPCC) uses AI-enhanced climate models for their 
                 assessment reports. Machine learning improves the accuracy of temperature projections and 
                 extreme weather event predictions.`,
        source: 'ipcc-ai-modeling'
      }
    ];

    try {
      const startTime = Date.now();
      const comprehensiveGraph = await this.client.callTool({
        name: 'ragno_decompose_corpus',
        arguments: {
          textChunks: comprehensiveCorpus,
          options: {
            extractRelationships: true,
            generateSummaries: true,
            maxEntitiesPerUnit: 25,
            minEntityConfidence: 0.5
          }
        }
      });
      const graphTime = Date.now() - startTime;

      if (comprehensiveGraph.content && comprehensiveGraph.content[0]) {
        const graph = JSON.parse(comprehensiveGraph.content[0].text);
        if (graph.success) {
          this.logArtifact('comprehensive_graph', 1, {
            'build_time': `${graphTime}ms`,
            'entities': graph.entities?.length || 0,
            'relationships': graph.relationships?.length || 0,
            'coverage': 'comprehensive'
          });
        }
      }
    } catch (error) {
      console.log(chalk.red(`   ❌ Comprehensive graph building failed: ${error.message}`));
    }

    // Step 3: Memory-informed, graph-guided navigation
    this.logWorkflowStep(3, 'Integrated Navigation', 'Memory + graph guided ZPT exploration', ['semem', 'ragno', 'zpt']);
    
    try {
      // First, get memory context
      const memoryContext = await this.client.callTool({
        name: 'semem_retrieve_memories',
        arguments: {
          query: "AI renewable energy optimization climate technology",
          limit: 3,
          threshold: 0.7
        }
      });

      // Then, get graph entities
      const graphEntities = await this.client.callTool({
        name: 'ragno_get_entities',
        arguments: {
          filters: { limit: 8, minFrequency: 1 }
        }
      });

      // Combine insights for navigation
      let entityNames = [];
      if (graphEntities.content && graphEntities.content[0]) {
        const entities = JSON.parse(graphEntities.content[0].text);
        if (entities.success) {
          entityNames = entities.entities?.slice(0, 5).map(e => e.name || e.id).filter(n => n) || [];
        }
      }

      const startTime = Date.now();
      const integratedNavigation = await this.client.callTool({
        name: 'zpt_navigate',
        arguments: {
          query: 'AI climate technology renewable energy optimization companies',
          zoom: 'unit',
          pan: {
            entity: {
              include: entityNames,
              entityTypes: ['Corporation', 'Organization', 'Technology']
            },
            topic: {
              domains: ['artificial intelligence', 'renewable energy', 'climate technology'],
              keywords: {
                include: ['AI', 'machine learning', 'optimization', 'renewable', 'energy'],
                exclude: ['fossil', 'coal', 'oil']
              }
            },
            temporal: {
              relativeTime: 'past_two_years'
            }
          },
          tilt: 'graph',
          transform: { maxTokens: 3000, format: 'structured' }
        }
      });
      const navigationTime = Date.now() - startTime;

      if (integratedNavigation.content && integratedNavigation.content[0]) {
        const navigation = JSON.parse(integratedNavigation.content[0].text);
        if (navigation.success) {
          const resultCount = navigation.content?.results?.length || 0;
          this.logArtifact('integrated_navigation', resultCount, {
            'navigation_time': `${navigationTime}ms`,
            'integration_depth': 'triple_system',
            'entity_guidance': entityNames.length
          });

          // Extract insights from integrated results
          const insights = this.extractWorkflowInsights(navigation.content?.results || []);
          insights.forEach(insight => {
            this.logWorkflowInsight(insight.description, insight.confidence);
          });
        }
      }

    } catch (error) {
      console.log(chalk.red(`   ❌ Integrated navigation failed: ${error.message}`));
    }

    // Step 4: Store insights back to memory
    this.logWorkflowStep(4, 'Insight Storage', 'Storing workflow insights for future reference', ['semem']);
    
    const workflowSummary = {
      prompt: "Triple integration workflow analysis results",
      response: `Completed comprehensive AI-climate research workflow integrating semantic memory, 
                knowledge graphs, and 3D navigation. Key findings include: 1) Major tech companies 
                (Google, Microsoft, Tesla) are leading AI applications in renewable energy, 
                2) AI optimization can reduce energy consumption by 40%, 3) Machine learning 
                improves climate prediction accuracy, 4) Integrated workflows provide deeper insights 
                than single-system approaches.`,
      metadata: {
        workflow_type: 'triple_integration',
        systems_used: ['semem', 'ragno', 'zpt'],
        completion_time: new Date().toISOString()
      }
    };

    try {
      await this.client.callTool({
        name: 'semem_store_interaction',
        arguments: workflowSummary
      });
      this.logArtifact('workflow_insights', 1, { type: 'comprehensive_summary' });
    } catch (error) {
      console.log(chalk.red(`   ❌ Insight storage failed: ${error.message}`));
    }

    this.logIntegration('zpt', 'semem', 'workflow insights', 1);
  }

  // === INSIGHT EXTRACTION HELPER ===

  extractWorkflowInsights(results) {
    const insights = [];
    
    if (results.length > 0) {
      insights.push({
        description: `Identified ${results.length} relevant entities in AI-climate intersection`,
        confidence: 85
      });
    }

    const companies = results.filter(r => 
      r.content?.toLowerCase().includes('company') || 
      r.content?.toLowerCase().includes('corporation')
    );
    if (companies.length > 0) {
      insights.push({
        description: `Found ${companies.length} companies actively working on AI-climate solutions`,
        confidence: 80
      });
    }

    const technologies = results.filter(r => 
      r.content?.toLowerCase().includes('algorithm') || 
      r.content?.toLowerCase().includes('optimization')
    );
    if (technologies.length > 0) {
      insights.push({
        description: `Discovered ${technologies.length} specific AI technologies for climate applications`,
        confidence: 75
      });
    }

    return insights;
  }

  // === INTEGRATION PERFORMANCE ANALYSIS ===

  generateIntegrationSummary() {
    this.logBanner('Integration Workflow Summary', 'Comprehensive analysis of cross-system performance');
    
    const totalDuration = Date.now() - this.startTime;
    
    console.log(chalk.white('\n🌟 Integration Workflow Results:'));
    console.log(chalk.green(`   ✅ Total workflow duration: ${(totalDuration / 1000).toFixed(1)}s`));
    console.log(chalk.green(`   ✅ Cross-system operations: ${this.operationCount}`));
    console.log(chalk.green(`   ✅ Workflow artifacts created: ${Object.values(this.integrationArtifacts).flat().length}`));

    // Artifact summary
    console.log(chalk.white('\n📊 Artifact Summary:'));
    Object.entries(this.integrationArtifacts).forEach(([type, artifacts]) => {
      if (artifacts.length > 0) {
        console.log(chalk.cyan(`   ${type}: ${artifacts.length} items`));
      }
    });

    // Integration patterns analysis
    console.log(chalk.white('\n🔄 Integration Patterns Demonstrated:'));
    console.log(chalk.green('   ✅ Memory-guided navigation (Semem → ZPT)'));
    console.log(chalk.green('   ✅ Graph-enhanced exploration (Ragno → ZPT)'));
    console.log(chalk.green('   ✅ Triple system integration (Semem + Ragno + ZPT)'));
    console.log(chalk.green('   ✅ Insight feedback loops (ZPT → Semem)'));

    // Best practices for integration
    console.log(chalk.white('\n💡 Integration Best Practices:'));
    
    console.log(chalk.yellow('   🧠 Memory Integration:'));
    console.log(chalk.white('     • Store context before navigation for guidance'));
    console.log(chalk.white('     • Use retrieved memories to refine navigation parameters'));
    console.log(chalk.white('     • Store navigation insights for future workflows'));
    console.log(chalk.white('     • Implement memory-based parameter optimization'));
    
    console.log(chalk.yellow('\n   🕸️ Knowledge Graph Integration:'));
    console.log(chalk.white('     • Build graphs from navigation results for enrichment'));
    console.log(chalk.white('     • Use entity relationships to guide navigation focus'));
    console.log(chalk.white('     • Leverage graph structure for multi-perspective exploration'));
    console.log(chalk.white('     • Export graphs for external analysis and visualization'));
    
    console.log(chalk.yellow('\n   🧭 Navigation Integration:'));
    console.log(chalk.white('     • Use memory context for query refinement'));
    console.log(chalk.white('     • Apply graph entities for targeted exploration'));
    console.log(chalk.white('     • Combine multiple filter dimensions for precision'));
    console.log(chalk.white('     • Store navigation patterns for workflow optimization'));
    
    console.log(chalk.yellow('\n   🌟 Workflow Optimization:'));
    console.log(chalk.white('     • Cache cross-system data transfers for efficiency'));
    console.log(chalk.white('     • Implement progressive refinement across iterations'));
    console.log(chalk.white('     • Use parallel processing for independent operations'));
    console.log(chalk.white('     • Monitor resource usage across integrated systems'));

    // Advanced integration patterns
    console.log(chalk.white('\n🚀 Advanced Integration Opportunities:'));
    console.log(chalk.blue('   🔄 Adaptive Workflows: Systems learn from each other over time'));
    console.log(chalk.blue('   🎯 Intelligent Routing: Automatic system selection based on query type'));
    console.log(chalk.blue('   📊 Cross-System Analytics: Performance optimization across integrations'));
    console.log(chalk.blue('   🧬 Semantic Consistency: Unified concept mapping across all systems'));

    console.log(chalk.magenta.bold('\n🎉 ZPT Integration Workflows Demo Complete!'));
    console.log(chalk.white('   You have explored the full potential of integrated semantic navigation!'));
    console.log(chalk.white('   Next steps: Apply these patterns to your own research and analysis workflows'));
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
      console.log(chalk.rainbow('🌟 Welcome to the ZPT Integration Workflows Demo! 🌟'));
      console.log(chalk.white('This demo showcases advanced integration patterns across all systems.\\n'));

      // Educational overview
      this.explainIntegrationWorkflows();
      
      // Initialize integrated connection
      await this.initializeConnection();
      
      // Memory-guided navigation workflow
      await this.demonstrateMemoryGuidedNavigation();
      
      // Graph-enhanced navigation workflow
      await this.demonstrateGraphEnhancedNavigation();
      
      // Triple integration workflow
      await this.demonstrateTripleIntegrationWorkflow();
      
      // Comprehensive integration summary
      this.generateIntegrationSummary();

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
  const demo = new ZPTIntegrationWorkflowsDemo();
  demo.runFullDemo().catch(error => {
    console.error(chalk.red('Fatal error:'), error);
    process.exit(1);
  });
}

export default ZPTIntegrationWorkflowsDemo;