#!/usr/bin/env node

/**
 * CommunityAnalysis.js - Detect Communities in BeerQA Knowledge Graph
 * 
 * This script performs community detection on the BeerQA corpuscle network to identify
 * groups of related corpuscles. It uses the Leiden algorithm for community detection
 * and creates ragno:CommunityElement summaries for each detected community.
 * 
 * Key Features:
 * - Uses the same graph structure as CorpuscleRanking.js
 * - Applies Leiden community detection algorithm
 * - Creates ragno:Community and ragno:CommunityElement structures
 * - Links questions to their most relevant communities
 * - Exports community data to SPARQL store
 */

import path from 'path';
import logger from 'loglevel';
import chalk from 'chalk';
import Config from '../../../src/Config.js';
import CommunityDetection from '../../../src/ragno/algorithms/CommunityDetection.js';
import LLMHandler from '../../../src/handlers/LLMHandler.js';
import OllamaConnector from '../../../src/connectors/OllamaConnector.js';
import ClaudeConnector from '../../../src/connectors/ClaudeConnector.js';
import MistralConnector from '../../../src/connectors/MistralConnector.js';
import { CorpuscleRanking } from './CorpuscleRanking.js';
import SPARQLHelper from '../SPARQLHelper.js';

// Configure logging
logger.setLevel('info');

/**
 * Display header
 */
function displayHeader() {
    console.log('');
    console.log(chalk.bold.blue('╔══════════════════════════════════════════════════════════════╗'));
    console.log(chalk.bold.blue('║') + chalk.bold.white('              🏘️  COMMUNITY ANALYSIS                       ') + chalk.bold.blue('║'));
    console.log(chalk.bold.blue('║') + chalk.gray('    Detect communities in BeerQA corpuscle knowledge graph   ') + chalk.bold.blue('║'));
    console.log(chalk.bold.blue('╚══════════════════════════════════════════════════════════════╝'));
    console.log('');
}

/**
 * CommunityAnalysis class for detecting and analyzing communities
 */
class CommunityAnalysis {
    constructor(config, options = {}) {
        // Use Config.js for SPARQL configuration
        const storageOptions = config.get('storage.options');
        
        this.options = {
            sparqlEndpoint: options.sparqlEndpoint || storageOptions.update,
            sparqlAuth: options.sparqlAuth || { 
                user: storageOptions.user, 
                password: storageOptions.password 
            },
            beerqaGraphURI: options.beerqaGraphURI || 'http://purl.org/stuff/beerqa/test',
            wikipediaGraphURI: options.wikipediaGraphURI || 'http://purl.org/stuff/wikipedia/research',
            timeout: options.timeout || 30000,
            
            // Community detection options
            algorithm: options.algorithm || 'leiden',
            resolution: options.resolution || 1.0,
            minCommunitySize: options.minCommunitySize || 3,
            maxCommunities: options.maxCommunities || 20,
            
            // LLM options for summary generation
            generateSummaries: options.generateSummaries !== false,
            maxSummaryLength: options.maxSummaryLength || 200,
            
            // Export options
            exportToSPARQL: options.exportToSPARQL !== false,
            
            ...options
        };

        // Initialize components
        this.corpuscleRanking = new CorpuscleRanking(config, this.options);
        this.communityDetection = new CommunityDetection({
            algorithm: this.options.algorithm,
            resolution: this.options.resolution,
            minCommunitySize: this.options.minCommunitySize,
            logProgress: false
        });

        this.sparqlHelper = new SPARQLHelper(this.options.sparqlEndpoint, {
            auth: this.options.sparqlAuth,
            timeout: this.options.timeout
        });

        this.llmHandler = null;

        this.stats = {
            corpusclesAnalyzed: 0,
            communitiesDetected: 0,
            communitySummariesGenerated: 0,
            communitiesExported: 0,
            questionLinksCreated: 0,
            processingTime: 0,
            errors: []
        };
    }

    /**
     * Create LLM connector based on configuration priority (from api-server.js pattern)
     */
    async createLLMConnector(config) {
        try {
            const llmProviders = config.get('llmProviders') || [];
            const sortedProviders = llmProviders
                .filter(p => p.capabilities?.includes('chat'))
                .sort((a, b) => (a.priority || 999) - (b.priority || 999));
            
            for (const provider of sortedProviders) {
                if (provider.type === 'mistral' && provider.apiKey) {
                    return new MistralConnector();
                } else if (provider.type === 'claude' && provider.apiKey) {
                    return new ClaudeConnector();
                } else if (provider.type === 'ollama') {
                    return new OllamaConnector();
                }
            }
            
            return new OllamaConnector();
            
        } catch (error) {
            console.log(chalk.yellow(`   ⚠️  Failed to load provider configuration, defaulting to Ollama: ${error.message}`));
            return new OllamaConnector();
        }
    }

    /**
     * Get model configuration (from api-server.js pattern)
     */
    async getModelConfig(config) {
        try {
            const llmProviders = config.get('llmProviders') || [];
            const chatProvider = llmProviders
                .filter(p => p.capabilities?.includes('chat'))
                .sort((a, b) => (a.priority || 999) - (b.priority || 999))[0];
            
            return {
                chatModel: chatProvider?.chatModel || 'qwen2:1.5b'
            };
        } catch (error) {
            return {
                chatModel: 'qwen2:1.5b'
            };
        }
    }

    /**
     * Initialize LLM handler for summary generation
     */
    async initializeLLMHandler() {
        try {
            const configPath = path.join(process.cwd(), 'config/config.json');
            const config = new Config(configPath);
            await config.init();

            const llmProvider = await this.createLLMConnector(config);
            const modelConfig = await this.getModelConfig(config);
            
            this.llmHandler = new LLMHandler(llmProvider, modelConfig.chatModel);
            
            console.log(chalk.gray('   ✓ LLM handler initialized for summary generation'));
        } catch (error) {
            console.log(chalk.yellow(`   ⚠️  Failed to initialize LLM handler: ${error.message}`));
            console.log(chalk.yellow('   ⚠️  Community summaries will not be generated'));
            this.options.generateSummaries = false;
        }
    }

    /**
     * Run complete community analysis
     * @returns {Object} Community analysis results
     */
    async runCommunityAnalysis() {
        const startTime = Date.now();
        console.log(chalk.bold.white('🔄 Starting community analysis...'));

        try {
            // Phase 1: Initialize LLM handler if needed
            if (this.options.generateSummaries) {
                console.log(chalk.white('🤖 Initializing LLM handler...'));
                await this.initializeLLMHandler();
            }

            // Phase 2: Build corpuscle graph (reuse from CorpuscleRanking)
            console.log(chalk.white('📊 Building corpuscle relationship graph...'));
            const graphData = await this.corpuscleRanking.buildCorpuscleGraph();
            
            if (graphData.nodeCount === 0) {
                console.log(chalk.yellow('⚠️  No corpuscles found - no communities to detect'));
                return { success: false, message: 'No corpuscles found' };
            }

            this.stats.corpusclesAnalyzed = graphData.nodeCount;

            // Phase 3: Detect communities
            console.log(chalk.white('🏘️  Detecting communities using Leiden algorithm...'));
            const communities = await this.detectCommunities(graphData.graph);

            // Phase 4: Generate community summaries
            if (this.options.generateSummaries && this.llmHandler && communities.length > 0) {
                console.log(chalk.white('📝 Generating community summaries...'));
                await this.generateCommunitySummaries(communities, graphData.graph);
            }

            // Phase 5: Link questions to communities
            console.log(chalk.white('🔗 Linking questions to relevant communities...'));
            await this.linkQuestionsToCommunities(communities);

            // Phase 6: Export to SPARQL store
            if (this.options.exportToSPARQL && communities.length > 0) {
                console.log(chalk.white('💾 Exporting communities to SPARQL store...'));
                await this.exportCommunitiesToSPARQL(communities);
            }

            // Calculate final statistics
            this.stats.processingTime = Date.now() - startTime;
            
            console.log(chalk.green('✅ Community analysis completed successfully'));
            this.displayResults(communities);

            return {
                success: true,
                communities: communities,
                statistics: { ...this.stats }
            };

        } catch (error) {
            this.stats.errors.push(`Community analysis failed: ${error.message}`);
            console.log(chalk.red('❌ Community analysis failed:', error.message));
            throw error;
        }
    }

    /**
     * Detect communities in the corpuscle graph
     * @param {Object} graph - Graph structure
     * @returns {Array} Array of detected communities
     */
    async detectCommunities(graph) {
        console.log(chalk.gray(`   Analyzing graph with ${graph.nodes.size} nodes and ${graph.edges.size} edges...`));
        
        if (graph.nodes.size < this.options.minCommunitySize) {
            console.log(chalk.yellow(`   ⚠️  Graph too small for community detection (min: ${this.options.minCommunitySize})`));
            return [];
        }

        try {
            // Run community detection using the algorithm
            const communityResults = this.communityDetection.detectCommunities(graph, {
                algorithm: this.options.algorithm,
                resolution: this.options.resolution,
                minCommunitySize: this.options.minCommunitySize
            });

            // Process results into community structures
            const communities = [];
            
            if (communityResults.communities) {
                for (const [communityId, members] of communityResults.communities) {
                    if (members.size >= this.options.minCommunitySize) {
                        communities.push({
                            id: `community_${communityId}`,
                            members: Array.from(members),
                            size: members.size,
                            uri: `${this.options.wikipediaGraphURI.replace('/test', '')}/community/${communityId}`,
                            summary: null,
                            summaryGenerated: false
                        });
                    }
                }
            }

            // Sort by size (largest first) and limit
            communities.sort((a, b) => b.size - a.size);
            const limitedCommunities = communities.slice(0, this.options.maxCommunities);

            this.stats.communitiesDetected = limitedCommunities.length;
            console.log(chalk.gray(`   ✓ Detected ${limitedCommunities.length} communities (${communities.length} total, filtered by size)`));

            return limitedCommunities;

        } catch (error) {
            console.log(chalk.yellow(`   ⚠️  Community detection failed: ${error.message}`));
            this.stats.errors.push(`Community detection failed: ${error.message}`);
            return [];
        }
    }

    /**
     * Generate summaries for communities using LLM
     * @param {Array} communities - Array of community objects
     * @param {Object} graph - Graph structure for content lookup
     */
    async generateCommunitySummaries(communities, graph) {
        console.log(chalk.gray(`   Generating summaries for ${communities.length} communities...`));
        
        for (let i = 0; i < communities.length; i++) {
            const community = communities[i];
            
            try {
                // Collect content from community members
                const memberContent = [];
                for (const memberUri of community.members) {
                    const node = graph.nodes.get(memberUri);
                    if (node && node.label) {
                        memberContent.push(node.label);
                    }
                }

                if (memberContent.length === 0) {
                    console.log(chalk.yellow(`   ⚠️  No content for community ${community.id}`));
                    continue;
                }

                // Generate summary using LLM
                const prompt = `Analyze the following related items and provide a brief summary of what they represent as a group. Focus on the common themes or topics. Keep the summary under ${this.options.maxSummaryLength} characters.

Items:
${memberContent.slice(0, 10).map((content, idx) => `${idx + 1}. ${content}`).join('\n')}

Summary:`;

                const summary = await this.llmHandler.generateResponse(
                    prompt,
                    '',
                    {
                        temperature: 0.7,
                        maxRetries: 2
                    }
                );

                // Clean up summary
                const cleanSummary = summary.trim().substring(0, this.options.maxSummaryLength);
                community.summary = cleanSummary;
                community.summaryGenerated = true;
                
                this.stats.communitySummariesGenerated++;
                console.log(chalk.gray(`   ✓ Generated summary for community ${i + 1}/${communities.length} (${community.size} members)`));

                // Small delay to be nice to the LLM service
                await new Promise(resolve => setTimeout(resolve, 200));

            } catch (error) {
                console.log(chalk.yellow(`   ⚠️  Failed to generate summary for community ${community.id}: ${error.message}`));
                this.stats.errors.push(`Summary generation failed for ${community.id}: ${error.message}`);
                community.summary = `Community of ${community.size} related items`;
                community.summaryGenerated = false;
            }
        }

        console.log(chalk.gray(`   ✓ Generated ${this.stats.communitySummariesGenerated} community summaries`));
    }

    /**
     * Link questions to their most relevant communities
     * @param {Array} communities - Array of community objects
     */
    async linkQuestionsToCommunities(communities) {
        console.log(chalk.gray('   Finding questions and linking to relevant communities...'));
        
        // Query for BeerQA questions
        const questionQuery = `
PREFIX ragno: <http://purl.org/stuff/ragno/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

SELECT ?question ?questionText
WHERE {
    GRAPH <${this.options.beerqaGraphURI}> {
        ?question a ragno:Corpuscle ;
                 rdfs:label ?questionText ;
                 ragno:corpuscleType "test-question" .
    }
}
ORDER BY ?question
`;

        const questionResult = await this.sparqlHelper.executeSelect(questionQuery);
        
        if (!questionResult.success) {
            console.log(chalk.yellow(`   ⚠️  Could not query questions: ${questionResult.error}`));
            return;
        }

        const questions = questionResult.data.results.bindings;
        console.log(chalk.gray(`   ✓ Found ${questions.length} questions to link`));

        // For now, create simple links based on keyword matching
        // In a more sophisticated version, this would use semantic similarity
        let linksCreated = 0;
        
        for (const questionBinding of questions) {
            const questionURI = questionBinding.question.value;
            const questionText = questionBinding.questionText.value.toLowerCase();
            
            // Find best matching community based on summary content
            let bestCommunity = null;
            let bestScore = 0;
            
            for (const community of communities) {
                if (community.summary) {
                    const summaryWords = community.summary.toLowerCase().split(/\s+/);
                    const questionWords = questionText.split(/\s+/);
                    
                    // Simple word overlap scoring
                    let score = 0;
                    for (const word of questionWords) {
                        if (word.length > 3 && summaryWords.some(sw => sw.includes(word) || word.includes(sw))) {
                            score++;
                        }
                    }
                    
                    if (score > bestScore) {
                        bestScore = score;
                        bestCommunity = community;
                    }
                }
            }
            
            // Create link if we found a reasonable match
            if (bestCommunity && bestScore > 0) {
                bestCommunity.linkedQuestions = bestCommunity.linkedQuestions || [];
                bestCommunity.linkedQuestions.push({
                    uri: questionURI,
                    text: questionBinding.questionText.value,
                    score: bestScore
                });
                linksCreated++;
            }
        }

        this.stats.questionLinksCreated = linksCreated;
        console.log(chalk.gray(`   ✓ Created ${linksCreated} question-community links`));
    }

    /**
     * Export communities to SPARQL store
     * @param {Array} communities - Array of community objects
     */
    async exportCommunitiesToSPARQL(communities) {
        console.log(chalk.gray(`   Exporting ${communities.length} communities to SPARQL store...`));
        
        const timestamp = new Date().toISOString();
        let exported = 0;

        try {
            for (const community of communities) {
                const triples = [];
                const communityURI = community.uri;
                const communityElementURI = `${communityURI}_element`;

                // Create ragno:Community
                triples.push(`<${communityURI}> rdf:type ragno:Community .`);
                triples.push(`<${communityURI}> rdfs:label "Community ${community.id}" .`);
                triples.push(`<${communityURI}> ragno:communitySize "${community.size}"^^xsd:integer .`);
                triples.push(`<${communityURI}> dcterms:created "${timestamp}"^^xsd:dateTime .`);
                triples.push(`<${communityURI}> prov:wasGeneratedBy "community-analysis" .`);

                // Create ragno:CommunityElement if summary exists
                if (community.summary) {
                    triples.push(`<${communityElementURI}> rdf:type ragno:CommunityElement .`);
                    triples.push(`<${communityElementURI}> rdfs:label "Summary for ${community.id}" .`);
                    triples.push(`<${communityElementURI}> ragno:content "${community.summary.replace(/"/g, '\\"')}" .`);
                    triples.push(`<${communityElementURI}> dcterms:created "${timestamp}"^^xsd:dateTime .`);
                    triples.push(`<${communityElementURI}> prov:wasGeneratedBy "llm-community-summarization" .`);
                    
                    // Link community to its element
                    triples.push(`<${communityURI}> ragno:hasCommunityElement <${communityElementURI}> .`);
                }

                // Add members to community
                for (const memberUri of community.members) {
                    triples.push(`<${memberUri}> ragno:inCommunity <${communityURI}> .`);
                }

                // Add question links if any
                if (community.linkedQuestions) {
                    for (const question of community.linkedQuestions) {
                        triples.push(`<${question.uri}> ragno:relatedToCommunity <${communityURI}> .`);
                    }
                }

                // Execute update
                const updateQuery = `
PREFIX ragno: <http://purl.org/stuff/ragno/>
PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
PREFIX dcterms: <http://purl.org/dc/terms/>
PREFIX prov: <http://www.w3.org/ns/prov#>

INSERT DATA {
    GRAPH <${this.options.wikipediaGraphURI}> {
        ${triples.join('\n        ')}
    }
}`;

                const result = await this.sparqlHelper.executeUpdate(updateQuery);
                
                if (result.success) {
                    exported++;
                    console.log(chalk.gray(`   ✓ Exported community ${exported}/${communities.length} (${community.size} members)`));
                } else {
                    this.stats.errors.push(`Failed to export community ${community.id}: ${result.error}`);
                    console.log(chalk.red(`   ❌ Failed to export community ${community.id}: ${result.error}`));
                }

                // Small delay between exports
                await new Promise(resolve => setTimeout(resolve, 100));
            }

            this.stats.communitiesExported = exported;
            console.log(chalk.gray(`   ✅ Successfully exported ${exported} communities`));

        } catch (error) {
            this.stats.errors.push(`Community export failed: ${error.message}`);
            console.log(chalk.red(`   ❌ Community export failed: ${error.message}`));
            throw error;
        }
    }

    /**
     * Display results
     * @param {Array} communities - Array of community objects
     */
    displayResults(communities) {
        console.log('');
        console.log(chalk.bold.white('📊 Community Analysis Results:'));
        console.log(`   ${chalk.cyan('Corpuscles Analyzed:')} ${chalk.white(this.stats.corpusclesAnalyzed)}`);
        console.log(`   ${chalk.cyan('Communities Detected:')} ${chalk.white(this.stats.communitiesDetected)}`);
        console.log(`   ${chalk.cyan('Community Summaries:')} ${chalk.white(this.stats.communitySummariesGenerated)}`);
        console.log(`   ${chalk.cyan('Question Links:')} ${chalk.white(this.stats.questionLinksCreated)}`);
        console.log(`   ${chalk.cyan('Communities Exported:')} ${chalk.white(this.stats.communitiesExported)}`);
        console.log(`   ${chalk.cyan('Processing Time:')} ${chalk.white((this.stats.processingTime / 1000).toFixed(2))}s`);
        
        if (this.stats.errors.length > 0) {
            console.log(`   ${chalk.cyan('Errors:')} ${chalk.red(this.stats.errors.length)}`);
            this.stats.errors.forEach(error => {
                console.log(`     ${chalk.red('•')} ${error}`);
            });
        }
        
        console.log('');
        
        // Display community details
        if (communities.length > 0) {
            console.log(chalk.bold.white('🏘️  Detected Communities:'));
            
            for (let i = 0; i < Math.min(communities.length, 10); i++) {
                const community = communities[i];
                console.log(`   ${chalk.bold.cyan(`${i + 1}.`)} ${chalk.white(community.id)} (${community.size} members)`);
                
                if (community.summary) {
                    const shortSummary = community.summary.length > 80 
                        ? community.summary.substring(0, 80) + '...'
                        : community.summary;
                    console.log(`      ${chalk.gray('Summary:')} ${chalk.white(shortSummary)}`);
                }
                
                if (community.linkedQuestions && community.linkedQuestions.length > 0) {
                    console.log(`      ${chalk.gray('Linked Questions:')} ${chalk.white(community.linkedQuestions.length)}`);
                }
            }
        }
        
        console.log('');
    }
}

/**
 * Main function for command-line usage
 */
async function analyzeCommunities() {
    displayHeader();
    
    try {
        // Initialize Config.js for proper configuration management
        const config = new Config('../../../config/config.json');
        await config.init();
        
        const options = {
            beerqaGraphURI: 'http://purl.org/stuff/beerqa/test',
            wikipediaGraphURI: 'http://purl.org/stuff/wikipedia/research',
            timeout: 30000,
            
            // Community detection configuration
            algorithm: 'leiden',
            resolution: 1.0,
            minCommunitySize: 3,
            maxCommunities: 15,
            
            // LLM configuration
            generateSummaries: true,
            maxSummaryLength: 200,
            
            // Export configuration
            exportToSPARQL: true
        };

        console.log(chalk.bold.yellow('🔧 Configuration:'));
        console.log(`   ${chalk.cyan('SPARQL Endpoint:')} ${chalk.white(config.get('storage.options.update'))}`);
        console.log(`   ${chalk.cyan('Algorithm:')} ${chalk.white(options.algorithm)}`);
        console.log(`   ${chalk.cyan('Min Community Size:')} ${chalk.white(options.minCommunitySize)}`);
        console.log(`   ${chalk.cyan('Max Communities:')} ${chalk.white(options.maxCommunities)}`);
        console.log(`   ${chalk.cyan('Generate Summaries:')} ${chalk.white(options.generateSummaries ? 'Yes' : 'No')}`);
        console.log(`   ${chalk.cyan('Export to SPARQL:')} ${chalk.white(options.exportToSPARQL ? 'Yes' : 'No')}`);
        console.log('');

        const analyzer = new CommunityAnalysis(config, options);
        const result = await analyzer.runCommunityAnalysis();

        if (result.success) {
            console.log(chalk.green('🎉 Community analysis completed successfully!'));
            console.log(chalk.white('Communities have been stored in the SPARQL store.'));
        } else {
            console.log(chalk.yellow('⚠️  Community analysis completed with issues:', result.message));
        }
        
        return result;

    } catch (error) {
        console.log(chalk.red('❌ Community analysis failed:', error.message));
        throw error;
    }
}

// Export for module usage
export { CommunityAnalysis };

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    analyzeCommunities().catch(error => {
        console.error(chalk.red('Fatal error:', error.message));
        process.exit(1);
    });
}