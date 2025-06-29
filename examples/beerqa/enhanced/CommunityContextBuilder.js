#!/usr/bin/env node

/**
 * CommunityContextBuilder.js - Community-Aware Context Assembly for BeerQA
 * 
 * This script enhances the context building process by organizing retrieved content
 * into communities and creating hierarchical context structures. It groups related
 * corpuscles by their community membership and builds context that flows from
 * high-level community summaries down to specific content, maximizing information
 * density while respecting token limits.
 * 
 * Key Features:
 * - Groups retrieved corpuscles by community membership
 * - Creates hierarchical context structure: community summaries → specific content
 * - Respects GetResult.js token limits while maximizing information density
 * - Maintains backward compatibility with existing context building
 * - Provides community-aware content prioritization
 * - Generates structured context suitable for LLM processing
 */

import path from 'path';
import logger from 'loglevel';
import chalk from 'chalk';
import Config from '../../../src/Config.js';
import SPARQLHelper from '../SPARQLHelper.js';

// Configure logging
logger.setLevel('info');

/**
 * Display header
 */
function displayHeader() {
    console.log('');
    console.log(chalk.bold.blue('╔══════════════════════════════════════════════════════════════╗'));
    console.log(chalk.bold.blue('║') + chalk.bold.white('              🏗️  COMMUNITY CONTEXT BUILDER                ') + chalk.bold.blue('║'));
    console.log(chalk.bold.blue('║') + chalk.gray('    Hierarchical context assembly with community grouping    ') + chalk.bold.blue('║'));
    console.log(chalk.bold.blue('╚══════════════════════════════════════════════════════════════╝'));
    console.log('');
}

/**
 * CommunityContextBuilder class for community-aware context assembly
 */
class CommunityContextBuilder {
    constructor(options = {}) {
        this.options = {
            sparqlEndpoint: options.sparqlEndpoint || 'https://fuseki.hyperdata.it/hyperdata.it/update',
            sparqlAuth: options.sparqlAuth || { user: 'admin', password: 'admin123' },
            beerqaGraphURI: options.beerqaGraphURI || 'http://purl.org/stuff/beerqa/test',
            wikipediaGraphURI: options.wikipediaGraphURI || 'http://purl.org/stuff/wikipedia/test',
            timeout: options.timeout || 30000,
            
            // Context building options (maintain GetResult.js compatibility)
            maxTokens: options.maxTokens || 4000,
            maxCharacters: options.maxCharacters || 2000,
            contextWindow: options.contextWindow || 5,
            
            // Community-aware enhancements
            prioritizeCommunitySummaries: options.prioritizeCommunitySummaries !== false,
            maxCommunitiesPerQuestion: options.maxCommunitiesPerQuestion || 3,
            communityContextRatio: options.communityContextRatio || 0.3, // 30% for summaries, 70% for content
            
            // Hierarchical context options
            includeIntroduction: options.includeIntroduction !== false,
            includeCommunityHeaders: options.includeCommunityHeaders !== false,
            includeSourceMetadata: options.includeSourceMetadata !== false,
            
            // Content selection options
            prioritizeImportantCorpuscles: options.prioritizeImportantCorpuscles !== false,
            diversityBonus: options.diversityBonus || 0.1,
            
            ...options
        };

        this.sparqlHelper = new SPARQLHelper(this.options.sparqlEndpoint, {
            auth: this.options.sparqlAuth,
            timeout: this.options.timeout
        });

        this.stats = {
            questionsProcessed: 0,
            corpusclesAnalyzed: 0,
            communitiesIdentified: 0,
            hierarchicalContextsBuilt: 0,
            tokensSaved: 0,
            charactersGenerated: 0,
            processingTime: 0,
            errors: []
        };
    }

    /**
     * Build community-aware context for BeerQA questions
     * @param {Array} questionIds - Optional array of specific question IDs to process
     * @returns {Object} Community context building results
     */
    async buildCommunityContext(questionIds = null) {
        const startTime = Date.now();
        console.log(chalk.bold.white('🔄 Starting community-aware context building...'));

        try {
            // Phase 1: Extract questions and their navigation results
            console.log(chalk.white('📝 Extracting questions and navigation results...'));
            const questionData = await this.extractQuestionNavigationData(questionIds);

            if (questionData.length === 0) {
                console.log(chalk.yellow('⚠️  No questions with navigation data found'));
                return { success: false, message: 'No questions with navigation data found' };
            }

            // Phase 2: Load community data and corpuscle content
            console.log(chalk.white('🏘️  Loading community memberships and content...'));
            const communityData = await this.loadCommunityData();

            // Phase 3: Build hierarchical community contexts
            console.log(chalk.white('🏗️  Building hierarchical community contexts...'));
            const contextResults = await this.buildHierarchicalContexts(questionData, communityData);

            // Phase 4: Export structured contexts (optional)
            if (contextResults.length > 0) {
                console.log(chalk.white('💾 Exporting structured contexts...'));
                await this.exportStructuredContexts(contextResults);
            }

            // Calculate final statistics
            this.stats.processingTime = Date.now() - startTime;
            
            console.log(chalk.green('✅ Community context building completed successfully'));
            this.displayResults(contextResults);

            return {
                success: true,
                communityContexts: contextResults,
                statistics: { ...this.stats }
            };

        } catch (error) {
            this.stats.errors.push(`Community context building failed: ${error.message}`);
            console.log(chalk.red('❌ Community context building failed:', error.message));
            throw error;
        }
    }

    /**
     * Extract questions and their navigation results from ZPT views
     * @param {Array} questionIds - Optional specific question IDs
     * @returns {Array} Question data with navigation results
     */
    async extractQuestionNavigationData(questionIds = null) {
        console.log(chalk.gray('   Extracting questions and their ZPT navigation corpuscles...'));
        
        let questionFilter = '';
        if (questionIds && questionIds.length > 0) {
            const idFilters = questionIds.map(id => `<${id}>`).join(' ');
            questionFilter = `FILTER(?question IN (${idFilters}))`;
        }

        // Query for questions with their ZPT navigation results
        const navigationQuery = `
PREFIX ragno: <http://purl.org/stuff/ragno/>
PREFIX zpt: <http://purl.org/stuff/zpt/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

SELECT ?question ?questionText ?view ?corpuscle ?corpuscleText ?distance ?score
WHERE {
    GRAPH <${this.options.beerqaGraphURI}> {
        ?question a ragno:Corpuscle ;
                 rdfs:label ?questionText ;
                 ragno:corpuscleType "test-question" .
        ${questionFilter}
    }
    
    GRAPH <${this.options.wikipediaGraphURI}> {
        ?view zpt:fromQuestion ?question ;
              zpt:includesCorpuscle ?corpuscle .
        
        ?corpuscle rdfs:label ?corpuscleText .
        
        # Get relationship data if available
        OPTIONAL {
            ?relationship ragno:hasSourceEntity ?question ;
                         ragno:hasTargetEntity ?corpuscle ;
                         ragno:weight ?score .
            OPTIONAL { ?relationship zpt:navigationDistance ?distance }
        }
    }
}
ORDER BY ?question ?distance ?score
`;

        const result = await this.sparqlHelper.executeSelect(navigationQuery);
        
        if (!result.success) {
            throw new Error(`Failed to extract question navigation data: ${result.error}`);
        }

        // Group corpuscles by question
        const questionMap = new Map();
        
        for (const binding of result.data.results.bindings) {
            const questionURI = binding.question.value;
            const questionText = binding.questionText.value;
            
            if (!questionMap.has(questionURI)) {
                questionMap.set(questionURI, {
                    questionURI: questionURI,
                    questionText: questionText,
                    corpuscles: []
                });
            }
            
            questionMap.get(questionURI).corpuscles.push({
                corpuscleURI: binding.corpuscle.value,
                corpuscleText: binding.corpuscleText.value,
                distance: binding.distance?.value ? parseInt(binding.distance.value) : 999,
                score: binding.score?.value ? parseFloat(binding.score.value) : 0.0
            });
        }

        const questionData = Array.from(questionMap.values());
        this.stats.questionsProcessed = questionData.length;
        this.stats.corpusclesAnalyzed = questionData.reduce((sum, q) => sum + q.corpuscles.length, 0);
        
        console.log(chalk.gray(`   ✓ Found ${questionData.length} questions with ${this.stats.corpusclesAnalyzed} total corpuscles`));
        
        return questionData;
    }

    /**
     * Load community data including memberships and summaries
     * @returns {Object} Community data structure
     */
    async loadCommunityData() {
        console.log(chalk.gray('   Loading community memberships and summaries...'));
        
        // Query for community memberships
        const membershipQuery = `
PREFIX ragno: <http://purl.org/stuff/ragno/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

SELECT ?corpuscle ?community ?communitySize ?summary
WHERE {
    GRAPH <${this.options.wikipediaGraphURI}> {
        ?corpuscle ragno:inCommunity ?community .
        ?community ragno:communitySize ?communitySize .
        
        OPTIONAL {
            ?communityElement ragno:content ?summary ;
                             ragno:describesCorpuscle ?community .
        }
    }
}
`;

        const membershipResult = await this.sparqlHelper.executeSelect(membershipQuery);
        
        const communityData = {
            memberships: new Map(), // corpuscleURI -> [community objects]
            communities: new Map(), // communityURI -> community info
            summaries: new Map()    // communityURI -> summary text
        };

        if (membershipResult.success) {
            for (const binding of membershipResult.data.results.bindings) {
                const corpuscleURI = binding.corpuscle.value;
                const communityURI = binding.community.value;
                const communitySize = parseInt(binding.communitySize.value);
                const summary = binding.summary?.value || null;

                // Store membership
                if (!communityData.memberships.has(corpuscleURI)) {
                    communityData.memberships.set(corpuscleURI, []);
                }
                communityData.memberships.get(corpuscleURI).push({
                    communityURI: communityURI,
                    communitySize: communitySize
                });

                // Store community info
                if (!communityData.communities.has(communityURI)) {
                    communityData.communities.set(communityURI, {
                        communityURI: communityURI,
                        size: communitySize,
                        members: new Set()
                    });
                }
                communityData.communities.get(communityURI).members.add(corpuscleURI);

                // Store summary if available
                if (summary && !communityData.summaries.has(communityURI)) {
                    communityData.summaries.set(communityURI, summary);
                }
            }
        }

        this.stats.communitiesIdentified = communityData.communities.size;
        console.log(chalk.gray(`   ✓ Loaded ${communityData.memberships.size} corpuscle memberships across ${this.stats.communitiesIdentified} communities`));
        
        return communityData;
    }

    /**
     * Build hierarchical community contexts for questions
     * @param {Array} questionData - Question data with corpuscles
     * @param {Object} communityData - Community membership data
     * @returns {Array} Hierarchical context results
     */
    async buildHierarchicalContexts(questionData, communityData) {
        console.log(chalk.gray('   Building hierarchical community contexts...'));
        
        const contextResults = [];

        for (let i = 0; i < questionData.length; i++) {
            const question = questionData[i];
            
            try {
                // Group corpuscles by communities
                const communityGroups = this.groupCorpusclesByCommunity(question.corpuscles, communityData);
                
                // Build hierarchical context structure
                const hierarchicalContext = this.buildHierarchicalStructure(
                    question,
                    communityGroups,
                    communityData
                );

                // Apply token and character limits
                const optimizedContext = this.optimizeContextForLimits(hierarchicalContext);

                contextResults.push({
                    questionURI: question.questionURI,
                    questionText: question.questionText,
                    originalCorpuscles: question.corpuscles.length,
                    communityGroups: Object.keys(communityGroups).length,
                    hierarchicalContext: hierarchicalContext,
                    optimizedContext: optimizedContext,
                    contextMetadata: {
                        characterCount: optimizedContext.markdown.length,
                        estimatedTokens: Math.ceil(optimizedContext.markdown.length / 4), // Rough estimate
                        communityCount: Object.keys(communityGroups).length,
                        corpuscleCount: optimizedContext.corpuscleCount
                    }
                });

                this.stats.hierarchicalContextsBuilt++;
                this.stats.charactersGenerated += optimizedContext.markdown.length;
                
                console.log(chalk.gray(`   ✓ Question ${i + 1}/${questionData.length}: ${Object.keys(communityGroups).length} communities, ${optimizedContext.markdown.length} chars`));

            } catch (error) {
                console.log(chalk.yellow(`   ⚠️  Context building failed for question ${i + 1}: ${error.message}`));
                this.stats.errors.push(`Context building failed for question ${question.questionURI}: ${error.message}`);
            }
        }

        console.log(chalk.gray(`   ✓ Built ${contextResults.length} hierarchical contexts`));
        return contextResults;
    }

    /**
     * Group corpuscles by their community memberships
     * @param {Array} corpuscles - Corpuscle data
     * @param {Object} communityData - Community data
     * @returns {Object} Community groups
     */
    groupCorpusclesByCommunity(corpuscles, communityData) {
        const communityGroups = {
            'no-community': [] // For corpuscles without community membership
        };

        for (const corpuscle of corpuscles) {
            let assigned = false;
            
            if (communityData.memberships.has(corpuscle.corpuscleURI)) {
                const memberships = communityData.memberships.get(corpuscle.corpuscleURI);
                
                // Assign to largest community (most specific grouping)
                const largestCommunity = memberships.reduce((largest, current) => 
                    current.communitySize > largest.communitySize ? current : largest
                );
                
                const communityKey = largestCommunity.communityURI;
                if (!communityGroups[communityKey]) {
                    communityGroups[communityKey] = [];
                }
                communityGroups[communityKey].push(corpuscle);
                assigned = true;
            }
            
            if (!assigned) {
                communityGroups['no-community'].push(corpuscle);
            }
        }

        // Remove empty groups
        Object.keys(communityGroups).forEach(key => {
            if (communityGroups[key].length === 0) {
                delete communityGroups[key];
            }
        });

        return communityGroups;
    }

    /**
     * Build hierarchical context structure
     * @param {Object} question - Question data
     * @param {Object} communityGroups - Grouped corpuscles
     * @param {Object} communityData - Community data
     * @returns {Object} Hierarchical context structure
     */
    buildHierarchicalStructure(question, communityGroups, communityData) {
        const structure = {
            introduction: '',
            communities: [],
            ungroupedContent: [],
            metadata: {
                totalCommunities: Object.keys(communityGroups).length,
                totalCorpuscles: Object.values(communityGroups).flat().length
            }
        };

        // Create introduction if enabled
        if (this.options.includeIntroduction) {
            structure.introduction = `Context for: "${question.questionText}"\n\nThe following information is organized by related topic areas:\n`;
        }

        // Process each community group
        for (const [communityURI, corpuscles] of Object.entries(communityGroups)) {
            if (communityURI === 'no-community') {
                structure.ungroupedContent = corpuscles;
                continue;
            }

            const communityInfo = communityData.communities.get(communityURI);
            const summary = communityData.summaries.get(communityURI);

            structure.communities.push({
                communityURI: communityURI,
                communitySize: communityInfo?.size || corpuscles.length,
                summary: summary || `Group of ${corpuscles.length} related items`,
                corpuscles: corpuscles.sort((a, b) => (a.distance || 999) - (b.distance || 999)) // Sort by navigation distance
            });
        }

        // Sort communities by size (largest first for most important content)
        structure.communities.sort((a, b) => b.communitySize - a.communitySize);

        return structure;
    }

    /**
     * Optimize context structure for token and character limits
     * @param {Object} hierarchicalContext - Hierarchical context structure
     * @returns {Object} Optimized context
     */
    optimizeContextForLimits(hierarchicalContext) {
        const targetChars = this.options.maxCharacters;
        const communityRatio = this.options.communityContextRatio;
        
        let markdown = '';
        let corpuscleCount = 0;
        let charCount = 0;

        // Add introduction
        if (hierarchicalContext.introduction) {
            markdown += hierarchicalContext.introduction + '\n\n';
            charCount += markdown.length;
        }

        // Calculate space allocation
        const availableChars = targetChars - charCount;
        const communityChars = Math.floor(availableChars * communityRatio);
        const contentChars = availableChars - communityChars;

        // Add community summaries (if they fit)
        let usedCommunityChars = 0;
        const includedCommunities = [];

        for (const community of hierarchicalContext.communities.slice(0, this.options.maxCommunitiesPerQuestion)) {
            if (community.summary) {
                const headerText = this.options.includeCommunityHeaders 
                    ? `## Related Topic Area (${community.corpuscles.length} items)\n`
                    : '';
                const summaryText = `${community.summary}\n\n`;
                const sectionLength = headerText.length + summaryText.length;

                if (usedCommunityChars + sectionLength <= communityChars) {
                    markdown += headerText + summaryText;
                    usedCommunityChars += sectionLength;
                    includedCommunities.push(community);
                }
            } else {
                includedCommunities.push(community);
            }
        }

        // Add detailed content (prioritize by community membership and importance)
        let usedContentChars = 0;
        const remainingChars = targetChars - markdown.length;

        // Process included communities first
        for (const community of includedCommunities) {
            for (const corpuscle of community.corpuscles) {
                const contentText = `- ${corpuscle.corpuscleText}\n`;
                
                if (usedContentChars + contentText.length <= remainingChars) {
                    markdown += contentText;
                    usedContentChars += contentText.length;
                    corpuscleCount++;
                } else {
                    break;
                }
            }
            
            if (usedContentChars >= remainingChars) break;
        }

        // Add ungrouped content if space remains
        for (const corpuscle of hierarchicalContext.ungroupedContent) {
            const contentText = `- ${corpuscle.corpuscleText}\n`;
            
            if (markdown.length + contentText.length <= targetChars) {
                markdown += contentText;
                corpuscleCount++;
            } else {
                break;
            }
        }

        return {
            markdown: markdown.substring(0, targetChars), // Ensure hard limit
            corpuscleCount: corpuscleCount,
            communitiesIncluded: includedCommunities.length,
            charactersUsed: Math.min(markdown.length, targetChars),
            tokensSaved: this.stats.corpusclesAnalyzed - corpuscleCount // Rough estimate
        };
    }

    /**
     * Export structured contexts to SPARQL store
     * @param {Array} contextResults - Context results
     */
    async exportStructuredContexts(contextResults) {
        console.log(chalk.gray(`   Exporting ${contextResults.length} structured contexts...`));
        
        const timestamp = new Date().toISOString();
        let exported = 0;

        try {
            for (const context of contextResults) {
                const triples = [];
                const contextURI = `${context.questionURI}_community_context_${Date.now()}`;
                
                // Create context node
                triples.push(`<${contextURI}> rdf:type ragno:Attribute .`);
                triples.push(`<${contextURI}> rdfs:label "community-context" .`);
                triples.push(`<${contextURI}> ragno:attributeType "community-context" .`);
                triples.push(`<${contextURI}> ragno:content "${context.optimizedContext.markdown.replace(/"/g, '\\"').replace(/\n/g, '\\n')}" .`);
                triples.push(`<${contextURI}> ragno:characterCount "${context.contextMetadata.characterCount}"^^xsd:integer .`);
                triples.push(`<${contextURI}> ragno:corpuscleCount "${context.contextMetadata.corpuscleCount}"^^xsd:integer .`);
                triples.push(`<${contextURI}> ragno:communityCount "${context.contextMetadata.communityCount}"^^xsd:integer .`);
                triples.push(`<${contextURI}> dcterms:created "${timestamp}"^^xsd:dateTime .`);
                triples.push(`<${contextURI}> prov:wasGeneratedBy "community-context-builder" .`);
                
                // Link to question
                triples.push(`<${context.questionURI}> ragno:hasAttribute <${contextURI}> .`);
                triples.push(`<${contextURI}> ragno:describesCorpuscle <${context.questionURI}> .`);

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
                    console.log(chalk.gray(`   ✓ Exported context ${exported}/${contextResults.length}`));
                } else {
                    this.stats.errors.push(`Failed to export context ${context.questionURI}: ${result.error}`);
                    console.log(chalk.red(`   ❌ Failed to export context: ${result.error}`));
                }

                await new Promise(resolve => setTimeout(resolve, 100));
            }

            console.log(chalk.gray(`   ✅ Successfully exported ${exported} structured contexts`));

        } catch (error) {
            this.stats.errors.push(`Context export failed: ${error.message}`);
            console.log(chalk.red(`   ❌ Context export failed: ${error.message}`));
            throw error;
        }
    }

    /**
     * Display community context building results
     * @param {Array} contextResults - Context results
     */
    displayResults(contextResults) {
        console.log('');
        console.log(chalk.bold.white('📊 Community Context Building Results:'));
        console.log(`   ${chalk.cyan('Questions Processed:')} ${chalk.white(this.stats.questionsProcessed)}`);
        console.log(`   ${chalk.cyan('Corpuscles Analyzed:')} ${chalk.white(this.stats.corpusclesAnalyzed)}`);
        console.log(`   ${chalk.cyan('Communities Identified:')} ${chalk.white(this.stats.communitiesIdentified)}`);
        console.log(`   ${chalk.cyan('Hierarchical Contexts Built:')} ${chalk.white(this.stats.hierarchicalContextsBuilt)}`);
        console.log(`   ${chalk.cyan('Characters Generated:')} ${chalk.white(this.stats.charactersGenerated)}`);
        console.log(`   ${chalk.cyan('Processing Time:')} ${chalk.white((this.stats.processingTime / 1000).toFixed(2))}s`);
        
        if (this.stats.errors.length > 0) {
            console.log(`   ${chalk.cyan('Errors:')} ${chalk.red(this.stats.errors.length)}`);
            this.stats.errors.forEach(error => {
                console.log(`     ${chalk.red('•')} ${error}`);
            });
        }
        
        console.log('');
        
        // Display sample contexts
        if (contextResults.length > 0) {
            console.log(chalk.bold.white('🏗️  Sample Community Contexts:'));
            
            for (let i = 0; i < Math.min(contextResults.length, 3); i++) {
                const context = contextResults[i];
                const shortQuestion = context.questionText.length > 60 
                    ? context.questionText.substring(0, 60) + '...'
                    : context.questionText;
                    
                console.log(`   ${chalk.bold.cyan(`${i + 1}.`)} ${chalk.white(shortQuestion)}`);
                console.log(`      ${chalk.gray('Communities:')} ${chalk.white(context.contextMetadata.communityCount)} ${chalk.gray('Corpuscles:')} ${chalk.white(context.contextMetadata.corpuscleCount)} ${chalk.gray('Characters:')} ${chalk.white(context.contextMetadata.characterCount)}`);
                
                // Show a snippet of the context
                const snippet = context.optimizedContext.markdown.length > 100 
                    ? context.optimizedContext.markdown.substring(0, 100) + '...'
                    : context.optimizedContext.markdown;
                const lines = snippet.split('\n').slice(0, 3);
                lines.forEach((line, idx) => {
                    if (line.trim()) {
                        console.log(`        ${chalk.gray(line.trim())}`);
                    }
                });
            }
        }
        
        console.log('');
    }
}

/**
 * Main function for command-line usage
 */
async function buildCommunityContext() {
    displayHeader();
    
    try {
        const config = {
            sparqlEndpoint: 'https://fuseki.hyperdata.it/hyperdata.it/update',
            sparqlAuth: { user: 'admin', password: 'admin123' },
            beerqaGraphURI: 'http://purl.org/stuff/beerqa/test',
            wikipediaGraphURI: 'http://purl.org/stuff/wikipedia/test',
            timeout: 30000,
            
            // Context building configuration
            maxTokens: 4000,
            maxCharacters: 2000,
            contextWindow: 5,
            
            // Community-aware configuration
            prioritizeCommunitySummaries: true,
            maxCommunitiesPerQuestion: 3,
            communityContextRatio: 0.3,
            
            // Hierarchical context configuration
            includeIntroduction: true,
            includeCommunityHeaders: true,
            includeSourceMetadata: false
        };

        console.log(chalk.bold.yellow('🔧 Configuration:'));
        console.log(`   ${chalk.cyan('SPARQL Endpoint:')} ${chalk.white(config.sparqlEndpoint)}`);
        console.log(`   ${chalk.cyan('Max Characters:')} ${chalk.white(config.maxCharacters)}`);
        console.log(`   ${chalk.cyan('Max Communities:')} ${chalk.white(config.maxCommunitiesPerQuestion)}`);
        console.log(`   ${chalk.cyan('Community Context Ratio:')} ${chalk.white(config.communityContextRatio)}`);
        console.log(`   ${chalk.cyan('Include Introduction:')} ${chalk.white(config.includeIntroduction ? 'Yes' : 'No')}`);
        console.log(`   ${chalk.cyan('Include Community Headers:')} ${chalk.white(config.includeCommunityHeaders ? 'Yes' : 'No')}`);
        console.log('');

        const builder = new CommunityContextBuilder(config);
        const result = await builder.buildCommunityContext();

        if (result.success) {
            console.log(chalk.green('🎉 Community context building completed successfully!'));
            console.log(chalk.white('Hierarchical contexts have been generated and exported.'));
        } else {
            console.log(chalk.yellow('⚠️  Community context building completed with issues:', result.message));
        }
        
        return result;

    } catch (error) {
        console.log(chalk.red('❌ Community context building failed:', error.message));
        throw error;
    }
}

// Export for module usage
export { CommunityContextBuilder };

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    buildCommunityContext().catch(error => {
        console.error(chalk.red('Fatal error:', error.message));
        process.exit(1);
    });
}