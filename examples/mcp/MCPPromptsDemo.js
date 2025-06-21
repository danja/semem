#!/usr/bin/env node

/**
 * MCP Prompts Demonstration
 * 
 * This demo showcases the new MCP Prompts system that provides workflow orchestration
 * for complex multi-step operations. It demonstrates all 8 available prompt workflows
 * with detailed logging and explanations.
 * 
 * Features demonstrated:
 * - Prompt discovery and listing
 * - Memory workflow prompts (research analysis, Q&A, concept exploration)
 * - Knowledge graph construction prompts (corpus-to-graph, entity analysis)
 * - 3D navigation prompts (interactive exploration)
 * - Integrated workflow prompts (full pipeline, research workflow)
 * - Error handling and validation
 * - Execution tracking and results analysis
 * 
 * Usage:
 *   node examples/mcp/MCPPromptsDemo.js
 * 
 * Prerequisites:
 *   - Start MCP server: npm run mcp-server-new
 *   - Configure LLM provider (Ollama recommended)
 */

import chalk from 'chalk';
import logger from 'loglevel';
import path from 'path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { spawn } from 'child_process';

// Configure detailed logging
logger.setLevel('debug');

// Demo configuration
const DEMO_CONFIG = {
  serverScript: './mcp/index.js',
  timeoutMs: 30000,
  verbose: true,
  configFile: './config/demo-config.json'
};

// Sample data for demonstrations
const SAMPLE_DATA = {
  researchDocument: `
    Artificial intelligence has undergone remarkable evolution in recent years, particularly with the introduction of transformer architectures. These models have fundamentally changed natural language processing, enabling the development of large language models like GPT, BERT, and their successors.
    
    The transformer architecture, first introduced in "Attention Is All You Need" (Vaswani et al., 2017), replaced traditional recurrent neural networks with self-attention mechanisms. This innovation allows for parallel processing of sequences and better capture of long-range dependencies in text.
    
    Key advantages of transformers include:
    1. Parallelizable training leading to faster model development
    2. Better handling of long sequences through attention mechanisms
    3. Transfer learning capabilities enabling fine-tuning for specific tasks
    4. Scalability to massive parameter counts (billions to trillions)
    
    Recent developments have focused on efficiency improvements, including techniques like sparse attention, mixture of experts, and model compression. These advances aim to make large language models more accessible while maintaining their impressive capabilities.
  `,
  
  corpusChunks: [
    "Apple Inc. is a multinational technology company founded by Steve Jobs, Steve Wozniak, and Ronald Wayne in 1976.",
    "The iPhone, first released in 2007, revolutionized the smartphone industry with its touchscreen interface and app ecosystem.",
    "Tim Cook became CEO of Apple in 2011, succeeding Steve Jobs who passed away the same year.",
    "Apple's ecosystem includes Mac computers, iPad tablets, Apple Watch, and various services like iCloud and Apple Music.",
    "The company is known for its design philosophy emphasizing simplicity, user experience, and premium build quality."
  ],
  
  questions: [
    "What are the main advantages of transformer architectures over traditional RNNs?",
    "How has Apple's leadership evolved since its founding?",
    "What role do attention mechanisms play in modern AI models?"
  ]
};

class MCPPromptsDemo {
  constructor() {
    this.client = null;
    this.transport = null;
    this.serverProcess = null;
    this.isConnected = false;
  }

  /**
   * Print colored header with demo information
   */
  printHeader() {
    console.log(chalk.cyan('═'.repeat(80)));
    console.log(chalk.cyan.bold('🚀 MCP PROMPTS DEMONSTRATION'));
    console.log(chalk.cyan('═'.repeat(80)));
    console.log(chalk.yellow('Showcasing workflow orchestration with 8 pre-built prompt templates'));
    console.log(chalk.gray('This demo will walk through all major prompt categories and capabilities\n'));
  }

  /**
   * Print section separator
   */
  printSection(title, description = '') {
    console.log('\n' + chalk.blue('─'.repeat(60)));
    console.log(chalk.blue.bold(`📋 ${title}`));
    if (description) {
      console.log(chalk.gray(description));
    }
    console.log(chalk.blue('─'.repeat(60)));
  }

  /**
   * Print step information
   */
  printStep(step, action, details = '') {
    console.log(chalk.green(`\n${step}. ${chalk.bold(action)}`));
    if (details) {
      console.log(chalk.gray(`   ${details}`));
    }
  }

  /**
   * Print execution results
   */
  printResults(response, promptName) {
    try {
      const results = JSON.parse(response.content[0].text);
      
      if (results.success) {
        console.log(chalk.green(`✅ Prompt "${promptName}" executed successfully`));
        console.log(chalk.cyan(`   Execution ID: ${results.executionId || 'N/A'}`));
        console.log(chalk.cyan(`   Steps completed: ${results.steps || 0}`));
        console.log(chalk.cyan(`   Tools used: ${results.summary?.toolsUsed?.join(', ') || 'N/A'}`));
        console.log(chalk.cyan(`   Duration: ${results.summary?.executionTime || 0}ms`));
        
        if (results.results && results.results.length > 0) {
          console.log(chalk.gray('\n   📊 Step Results:'));
          results.results.forEach((step, index) => {
            console.log(chalk.gray(`     ${index + 1}. ${step.tool} - ${step.result ? '✅ Success' : '❌ Failed'}`));
          });
        }
      } else {
        console.log(chalk.red(`❌ Prompt "${promptName}" failed`));
        console.log(chalk.red(`   Error: ${results.error}`));
        if (results.partialCompletion) {
          console.log(chalk.yellow(`   ⚠️  Partial completion: ${results.steps || 0} steps completed`));
        }
      }
    } catch (parseError) {
      console.log(chalk.red(`❌ Failed to parse prompt result for "${promptName}"`));
      console.log(chalk.red(`   Parse error: ${parseError.message}`));
      console.log(chalk.gray(`   Raw response: ${JSON.stringify(response, null, 2)}`));
    }
  }


  /**
   * Connect to the MCP server
   */
  async connectToServer() {
    this.printStep('1', 'Connecting to MCP Server', 'Establishing client connection via stdio transport');
    
    try {
      this.transport = new StdioClientTransport({
        command: 'node',
        args: [DEMO_CONFIG.serverScript],
        env: {
          ...process.env,
          NODE_ENV: 'development',
          SEMEM_CONFIG_PATH: path.resolve(DEMO_CONFIG.configFile)
        }
      });

      this.client = new Client(
        {
          name: 'mcp-prompts-demo',
          version: '1.0.0'
        },
        {
          capabilities: {
            prompts: {},
            tools: {},
            resources: {}
          }
        }
      );

      await this.client.connect(this.transport);
      this.isConnected = true;
      
      console.log(chalk.green('   🔗 Successfully connected to MCP server'));
      logger.debug('MCP client connected and ready');
      
    } catch (error) {
      logger.error('Connection failed:', error);
      throw new Error(`Failed to connect to MCP server: ${error.message}`);
    }
  }

  /**
   * List all available prompts
   */
  async listPrompts() {
    this.printStep('2', 'Discovering Available Prompts', 'Querying server for all available workflow templates');
    
    try {
      const response = await this.client.request({
        method: 'tools/call',
        params: {
          name: 'prompt_list',
          arguments: {}
        }
      });

      const result = JSON.parse(response.content[0].text);
      console.log(chalk.green(`   📝 Found ${result.totalPrompts} available prompts:`));
      
      if (result.success && result.categories) {
        Object.entries(result.categories).forEach(([category, categoryPrompts]) => {
          console.log(chalk.blue(`\n   📂 ${category}:`));
          categoryPrompts.forEach(prompt => {
            console.log(chalk.cyan(`     • ${prompt.name}`));
            console.log(chalk.gray(`       ${prompt.description}`));
            console.log(chalk.gray(`       Arguments: ${prompt.arguments} (${prompt.requiredArgs} required)`));
          });
        });
      }

      return result.categories;
      
    } catch (error) {
      logger.error('Failed to list prompts:', error);
      console.log(chalk.red('   ❌ Failed to list prompts'));
      throw error;
    }
  }

  /**
   * Categorize prompt by name for display purposes
   */
  categorizePrompt(name) {
    if (name.startsWith('semem-')) return 'Memory Workflows';
    if (name.startsWith('ragno-')) return 'Knowledge Graph';
    if (name.startsWith('zpt-')) return '3D Navigation';
    return 'Integrated Workflows';
  }

  /**
   * Demonstrate memory workflow prompts
   */
  async demonstrateMemoryWorkflows() {
    this.printSection(
      'Memory Workflow Demonstrations', 
      'Testing semantic memory operations with context and retrieval'
    );

    // 1. Research Analysis Workflow
    this.printStep('3.1', 'Research Document Analysis', 'Analyzing document with semantic memory context');
    
    try {
      const analysisResult = await this.client.request({
        method: 'tools/call',
        params: {
          name: 'prompt_execute',
          arguments: {
            name: 'semem-research-analysis',
            arguments: {
              document_text: SAMPLE_DATA.researchDocument,
              analysis_depth: 'deep',
              context_threshold: 0.8
            }
          }
        }
      });

      this.printResults(analysisResult, 'semem-research-analysis');
      
    } catch (error) {
      console.log(chalk.red(`   ❌ Research analysis failed: ${error.message}`));
      logger.error('Research analysis error:', error);
    }

    // 2. Memory Q&A Workflow
    this.printStep('3.2', 'Memory-Based Q&A', 'Answering questions using semantic memory retrieval');
    
    for (const question of SAMPLE_DATA.questions.slice(0, 2)) {
      console.log(chalk.cyan(`   🤔 Question: "${question}"`));
      
      try {
        const qaResult = await this.client.request({
          method: 'tools/call',
          params: {
            name: 'prompt_execute',
            arguments: {
              name: 'semem-memory-qa',
              arguments: {
                question: question,
                context_limit: 8,
                similarity_threshold: 0.7
              }
            }
          }
        });

        this.printResults(qaResult, 'semem-memory-qa');
        
      } catch (error) {
        console.log(chalk.red(`   ❌ Q&A failed: ${error.message}`));
        logger.error('Q&A error:', error);
      }
    }

    // 3. Concept Exploration Workflow
    this.printStep('3.3', 'Concept Exploration', 'Deep exploration of concept relationships');
    
    try {
      const explorationResult = await this.client.request({
        method: 'prompts/execute',
        params: {
          name: 'semem-concept-exploration',
          arguments: {
            concept: 'transformer architecture',
            exploration_depth: 3,
            include_relationships: true
          }
        }
      });

      this.printResults(explorationResult, 'semem-concept-exploration');
      
    } catch (error) {
      console.log(chalk.red(`   ❌ Concept exploration failed: ${error.message}`));
      logger.error('Concept exploration error:', error);
    }
  }

  /**
   * Demonstrate knowledge graph construction prompts
   */
  async demonstrateKnowledgeGraphWorkflows() {
    this.printSection(
      'Knowledge Graph Construction Demonstrations',
      'Building and analyzing RDF knowledge graphs from text data'
    );

    // 1. Corpus to Graph Workflow
    this.printStep('4.1', 'Corpus to Knowledge Graph', 'Converting text corpus to structured RDF graph');
    
    try {
      const graphResult = await this.client.request({
        method: 'prompts/execute',
        params: {
          name: 'ragno-corpus-to-graph',
          arguments: {
            corpus_chunks: SAMPLE_DATA.corpusChunks,
            entity_confidence: 0.8,
            extract_relationships: true
          }
        }
      });

      this.printResults(graphResult, 'ragno-corpus-to-graph');
      
    } catch (error) {
      console.log(chalk.red(`   ❌ Corpus-to-graph failed: ${error.message}`));
      logger.error('Corpus-to-graph error:', error);
    }

    // 2. Entity Analysis Workflow
    this.printStep('4.2', 'Entity Analysis', 'Deep analysis of specific entities with context');
    
    try {
      const entityResult = await this.client.request({
        method: 'prompts/execute',
        params: {
          name: 'ragno-entity-analysis',
          arguments: {
            entity_name: 'Apple Inc',
            context_radius: 2,
            include_embeddings: false
          }
        }
      });

      this.printResults(entityResult, 'ragno-entity-analysis');
      
    } catch (error) {
      console.log(chalk.red(`   ❌ Entity analysis failed: ${error.message}`));
      logger.error('Entity analysis error:', error);
    }
  }

  /**
   * Demonstrate 3D navigation prompts
   */
  async demonstrate3DNavigationWorkflows() {
    this.printSection(
      '3D Navigation Demonstrations',
      'Interactive knowledge space navigation and spatial analysis'
    );

    this.printStep('5.1', 'ZPT Interactive Navigation', 'Exploring knowledge space with 3D navigation');
    
    try {
      const navigationResult = await this.client.request({
        method: 'prompts/execute',
        params: {
          name: 'zpt-navigate-explore',
          arguments: {
            query: 'artificial intelligence applications',
            zoom_level: 5,
            tilt_style: 'auto',
            filters: {
              type: 'concept',
              relevance: 0.7
            }
          }
        }
      });

      this.printResults(navigationResult, 'zpt-navigate-explore');
      
    } catch (error) {
      console.log(chalk.red(`   ❌ 3D navigation failed: ${error.message}`));
      logger.error('3D navigation error:', error);
    }
  }

  /**
   * Demonstrate integrated workflow prompts
   */
  async demonstrateIntegratedWorkflows() {
    this.printSection(
      'Integrated Workflow Demonstrations',
      'Complex workflows combining memory, graphs, and navigation'
    );

    // 1. Full Pipeline Workflow
    this.printStep('6.1', 'Complete Processing Pipeline', 'Memory → Graph → Navigation integration');
    
    try {
      const pipelineResult = await this.client.request({
        method: 'prompts/execute',
        params: {
          name: 'semem-full-pipeline',
          arguments: {
            input_data: "Machine learning is revolutionizing healthcare through predictive analytics, diagnostic assistance, and personalized treatment recommendations.",
            pipeline_stages: ['memory', 'graph', 'navigation'],
            output_formats: ['json', 'rdf', 'summary']
          }
        }
      });

      this.printResults(pipelineResult, 'semem-full-pipeline');
      
    } catch (error) {
      console.log(chalk.red(`   ❌ Full pipeline failed: ${error.message}`));
      logger.error('Full pipeline error:', error);
    }

    // 2. Research Workflow
    this.printStep('6.2', 'Academic Research Pipeline', 'Comprehensive research document processing');
    
    try {
      const researchResult = await this.client.request({
        method: 'prompts/execute',
        params: {
          name: 'research-workflow',
          arguments: {
            research_documents: [
              SAMPLE_DATA.researchDocument,
              "Recent advances in quantum computing show promise for solving complex optimization problems that are intractable for classical computers."
            ],
            domain_focus: 'artificial_intelligence',
            analysis_goals: ['concept_extraction', 'relationship_mapping', 'trend_analysis']
          }
        }
      });

      this.printResults(researchResult, 'research-workflow');
      
    } catch (error) {
      console.log(chalk.red(`   ❌ Research workflow failed: ${error.message}`));
      logger.error('Research workflow error:', error);
    }
  }

  /**
   * Demonstrate error handling and validation
   */
  async demonstrateErrorHandling() {
    this.printSection(
      'Error Handling Demonstrations',
      'Testing validation, error recovery, and edge cases'
    );

    // 1. Missing Required Arguments
    this.printStep('7.1', 'Missing Required Arguments', 'Testing argument validation');
    
    try {
      await this.client.request({
        method: 'prompts/execute',
        params: {
          name: 'semem-memory-qa',
          arguments: {
            context_limit: 5
            // Missing required 'question' argument
          }
        }
      });
    } catch (error) {
      console.log(chalk.yellow(`   ✅ Correctly caught validation error: ${error.message}`));
    }

    // 2. Invalid Prompt Name
    this.printStep('7.2', 'Invalid Prompt Name', 'Testing prompt existence validation');
    
    try {
      await this.client.request({
        method: 'prompts/execute',
        params: {
          name: 'nonexistent-prompt',
          arguments: {}
        }
      });
    } catch (error) {
      console.log(chalk.yellow(`   ✅ Correctly caught invalid prompt error: ${error.message}`));
    }

    // 3. Invalid Argument Types
    this.printStep('7.3', 'Invalid Argument Types', 'Testing type validation');
    
    try {
      await this.client.request({
        method: 'prompts/execute',
        params: {
          name: 'semem-memory-qa',
          arguments: {
            question: 'What is AI?',
            context_limit: 'invalid_number', // Should be number
            similarity_threshold: 'invalid_number' // Should be number
          }
        }
      });
    } catch (error) {
      console.log(chalk.yellow(`   ✅ Correctly caught type validation error: ${error.message}`));
    }
  }

  /**
   * Print demonstration summary
   */
  printSummary() {
    this.printSection(
      'Demonstration Summary',
      'Overview of MCP Prompts capabilities and benefits'
    );

    console.log(chalk.green('🎉 MCP Prompts Demonstration Complete!\n'));
    
    console.log(chalk.cyan('📊 What we demonstrated:'));
    console.log(chalk.white('   • 8 pre-built prompt workflows across 4 categories'));
    console.log(chalk.white('   • Multi-step workflow orchestration with tool coordination'));
    console.log(chalk.white('   • Dynamic argument validation and type checking'));
    console.log(chalk.white('   • Error handling and graceful failure recovery'));
    console.log(chalk.white('   • Execution tracking with detailed step results'));
    console.log(chalk.white('   • Integration across Memory + Ragno + ZPT systems'));

    console.log(chalk.cyan('\n🚀 Key Benefits:'));
    console.log(chalk.white('   • Simplified complex operations through guided workflows'));
    console.log(chalk.white('   • Consistent interface for multi-step processes'));
    console.log(chalk.white('   • Automatic tool coordination and context passing'));
    console.log(chalk.white('   • Built-in validation and error recovery'));
    console.log(chalk.white('   • Comprehensive execution tracking and debugging'));

    console.log(chalk.cyan('\n📚 Next Steps:'));
    console.log(chalk.white('   • Explore individual prompts in Claude Desktop or other MCP clients'));
    console.log(chalk.white('   • Try custom argument combinations to see different behaviors'));
    console.log(chalk.white('   • Read the complete guide: mcp/prompts/resources/prompt-guide.md'));
    console.log(chalk.white('   • Check out real-world examples: mcp/prompts/resources/examples.md'));
    console.log(chalk.white('   • Build custom workflows using the prompt system as inspiration'));
  }

  /**
   * Clean up resources
   */
  async cleanup() {
    logger.debug('Cleaning up demo resources...');
    
    if (this.client && this.isConnected) {
      try {
        await this.client.close();
        console.log(chalk.gray('\n🔌 Disconnected from MCP server'));
      } catch (error) {
        logger.error('Error closing client:', error);
      }
    }

    if (this.serverProcess && !this.serverProcess.killed) {
      this.serverProcess.kill('SIGTERM');
      console.log(chalk.gray('🛑 MCP server process terminated'));
    }
  }

  /**
   * Run the complete demonstration
   */
  async run() {
    try {
      this.printHeader();
      
      // Core setup - StdioClientTransport handles server spawning internally
      await this.connectToServer();
      
      // Prompt discovery
      await this.listPrompts();
      
      // Workflow demonstrations
      await this.demonstrateMemoryWorkflows();
      await this.demonstrateKnowledgeGraphWorkflows();
      await this.demonstrate3DNavigationWorkflows();
      await this.demonstrateIntegratedWorkflows();
      
      // Error handling
      await this.demonstrateErrorHandling();
      
      // Summary
      this.printSummary();
      
    } catch (error) {
      console.log(chalk.red(`\n❌ Demo failed: ${error.message}`));
      logger.error('Demo error:', error);
      process.exit(1);
    } finally {
      await this.cleanup();
    }
  }
}

/**
 * Main execution
 */
async function main() {
  const demo = new MCPPromptsDemo();
  
  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log(chalk.yellow('\n\n⚠️  Demo interrupted by user'));
    await demo.cleanup();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log(chalk.yellow('\n\n⚠️  Demo terminated'));
    await demo.cleanup();
    process.exit(0);
  });

  // Run the demonstration
  await demo.run();
}

// Execute if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(chalk.red('Fatal error:'), error);
    process.exit(1);
  });
}

export { MCPPromptsDemo };