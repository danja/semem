/**
 * Enhancement Coordinator Service
 * 
 * Orchestrates multiple enhancement services (HyDE, Wikipedia, Wikidata) to provide
 * comprehensive query enhancement capabilities. Manages the integration and coordination
 * of enhancement results into unified, enriched responses.
 */

import logger from 'loglevel';
import HyDEService from './HyDEService.js';
import WikipediaService from './WikipediaService.js';
import WikidataService from './WikidataService.js';
import WebSearchService from './WebSearchService.js';

export class EnhancementCoordinator {
    constructor(options = {}) {
        this.llmHandler = options.llmHandler;
        this.embeddingHandler = options.embeddingHandler;
        this.sparqlHelper = options.sparqlHelper;
        this.config = options.config;
        
        // Default settings
        this.settings = {
            maxCombinedContextLength: options.maxCombinedContextLength || 8000,
            enableConcurrentProcessing: options.enableConcurrentProcessing !== false,
            contextWeights: {
                hyde: options.hydeWeight || 0.25,
                wikipedia: options.wikipediaWeight || 0.3,
                wikidata: options.wikidataWeight || 0.25,
                webSearch: options.webSearchWeight || 0.2
            },
            fallbackOnError: options.fallbackOnError !== false,
            ...options.settings
        };

        // Initialize enhancement services
        this.services = {};
        this.initializeServices(options);
        
        // Statistics tracking
        this.stats = {
            totalEnhancements: 0,
            successfulEnhancements: 0,
            failedEnhancements: 0,
            serviceUsage: {
                hyde: 0,
                wikipedia: 0,
                wikidata: 0,
                webSearch: 0
            },
            averageResponseTime: 0,
            lastEnhancementTime: null
        };
    }

    /**
     * Initialize enhancement services
     * 
     * @private
     * @param {Object} options - Service options
     */
    initializeServices(options) {
        try {
            // Initialize HyDE service
            this.services.hyde = new HyDEService({
                llmHandler: this.llmHandler,
                embeddingHandler: this.embeddingHandler,
                sparqlHelper: this.sparqlHelper,
                config: this.config,
                ...options.hydeOptions
            });

            // Initialize Wikipedia service
            this.services.wikipedia = new WikipediaService({
                embeddingHandler: this.embeddingHandler,
                sparqlHelper: this.sparqlHelper,
                config: this.config,
                ...options.wikipediaOptions
            });

            // Initialize Wikidata service
            this.services.wikidata = new WikidataService({
                sparqlHelper: this.sparqlHelper,
                config: this.config,
                ...options.wikidataOptions
            });

            // Initialize Web Search service
            this.services.webSearch = new WebSearchService({
                sparqlHelper: this.sparqlHelper,
                embeddingHandler: this.embeddingHandler,
                config: this.config,
                ...options.webSearchOptions
            });

            logger.info('✅ Enhancement services initialized successfully');

        } catch (error) {
            logger.error('❌ Failed to initialize enhancement services:', error.message);
            throw new Error(`Enhancement service initialization failed: ${error.message}`);
        }
    }

    /**
     * Enhance a query using selected enhancement services
     * 
     * @param {string} query - Original query
     * @param {Object} options - Enhancement options
     * @param {boolean} options.useHyDE - Enable HyDE enhancement
     * @param {boolean} options.useWikipedia - Enable Wikipedia enhancement
     * @param {boolean} options.useWikidata - Enable Wikidata enhancement
     * @param {boolean} options.useWebSearch - Enable web search enhancement
     * @returns {Object} Comprehensive enhancement result
     */
    async enhanceQuery(query, options = {}) {
        logger.info(`🔍 Coordinating query enhancement: "${query}"`);
        logger.info(`Enhancement options: HyDE(${!!options.useHyDE}), Wikipedia(${!!options.useWikipedia}), Wikidata(${!!options.useWikidata}), WebSearch(${!!options.useWebSearch})`);

        const startTime = Date.now();
        this.stats.totalEnhancements++;

        try {
            // Determine which services to use
            const servicesToUse = [];
            if (options.useHyDE && this.services.hyde) servicesToUse.push('hyde');
            if (options.useWikipedia && this.services.wikipedia) servicesToUse.push('wikipedia');
            if (options.useWikidata && this.services.wikidata) servicesToUse.push('wikidata');
            if (options.useWebSearch && this.services.webSearch) servicesToUse.push('webSearch');

            if (servicesToUse.length === 0) {
                logger.warn('No enhancement services requested');
                return {
                    success: true,
                    originalQuery: query,
                    enhancementType: 'none',
                    enhancedPrompt: query,
                    context: { original: query },
                    metadata: { servicesUsed: [], enhancementTime: 0 }
                };
            }

            // Execute enhancements
            let enhancementResults;
            if (this.settings.enableConcurrentProcessing && servicesToUse.length > 1) {
                enhancementResults = await this.executeConcurrentEnhancements(query, servicesToUse, options);
            } else {
                enhancementResults = await this.executeSequentialEnhancements(query, servicesToUse, options);
            }

            // Combine enhancement contexts
            const combinedContext = await this.combineEnhancedContext(
                query,
                enhancementResults,
                options
            );

            // Generate enhanced response
            const enhancedResponse = await this.generateEnhancedResponse(
                query,
                combinedContext,
                options
            );

            // Update statistics
            const enhancementTime = Date.now() - startTime;
            this.updateStats(servicesToUse, enhancementTime, true);

            const result = {
                success: true,
                originalQuery: query,
                enhancementType: 'combined',
                enhancedPrompt: enhancedResponse.enhancedPrompt,
                enhancedAnswer: enhancedResponse.answer,
                context: combinedContext,
                individualResults: enhancementResults,
                metadata: {
                    servicesUsed: servicesToUse,
                    enhancementTime,
                    contextLength: enhancedResponse.contextLength,
                    weights: this.settings.contextWeights,
                    coordinatorVersion: '1.0'
                },
                stats: {
                    totalServices: servicesToUse.length,
                    successfulServices: enhancementResults.successful.length,
                    failedServices: enhancementResults.failed.length
                }
            };

            logger.info(`✅ Query enhancement completed in ${enhancementTime}ms using ${servicesToUse.length} services`);
            return result;

        } catch (error) {
            const enhancementTime = Date.now() - startTime;
            this.updateStats([], enhancementTime, false);
            
            logger.error('❌ Query enhancement failed:', error.message);
            
            if (this.settings.fallbackOnError) {
                logger.info('🔄 Falling back to original query');
                return {
                    success: true,
                    originalQuery: query,
                    enhancementType: 'fallback',
                    enhancedPrompt: query,
                    context: { original: query, error: error.message },
                    metadata: { fallback: true, error: error.message }
                };
            } else {
                throw error;
            }
        }
    }

    /**
     * Execute enhancements concurrently for better performance
     * 
     * @private
     * @param {string} query - Original query
     * @param {Array} servicesToUse - Array of service names
     * @param {Object} options - Enhancement options
     * @returns {Object} Enhancement results from all services
     */
    async executeConcurrentEnhancements(query, servicesToUse, options) {
        logger.info(`⚡ Executing ${servicesToUse.length} enhancements concurrently`);

        const enhancementPromises = servicesToUse.map(async (serviceName) => {
            try {
                const result = await this.executeServiceEnhancement(serviceName, query, options);
                this.stats.serviceUsage[serviceName]++;
                return { serviceName, result, success: true };
            } catch (error) {
                logger.warn(`Service ${serviceName} failed:`, error.message);
                return { serviceName, error: error.message, success: false };
            }
        });

        const results = await Promise.allSettled(enhancementPromises);
        
        const successful = [];
        const failed = [];

        for (const result of results) {
            if (result.status === 'fulfilled' && result.value.success) {
                successful.push(result.value);
            } else {
                const failureInfo = result.status === 'fulfilled' 
                    ? result.value 
                    : { serviceName: 'unknown', error: result.reason.message, success: false };
                failed.push(failureInfo);
            }
        }

        logger.info(`✅ Concurrent enhancements completed: ${successful.length} successful, ${failed.length} failed`);
        
        return { successful, failed, executionMode: 'concurrent' };
    }

    /**
     * Execute enhancements sequentially
     * 
     * @private
     * @param {string} query - Original query
     * @param {Array} servicesToUse - Array of service names
     * @param {Object} options - Enhancement options
     * @returns {Object} Enhancement results from all services
     */
    async executeSequentialEnhancements(query, servicesToUse, options) {
        logger.info(`⏭️ Executing ${servicesToUse.length} enhancements sequentially`);

        const successful = [];
        const failed = [];

        for (const serviceName of servicesToUse) {
            try {
                const result = await this.executeServiceEnhancement(serviceName, query, options);
                this.stats.serviceUsage[serviceName]++;
                successful.push({ serviceName, result, success: true });
            } catch (error) {
                logger.warn(`Service ${serviceName} failed:`, error.message);
                failed.push({ serviceName, error: error.message, success: false });
            }
        }

        logger.info(`✅ Sequential enhancements completed: ${successful.length} successful, ${failed.length} failed`);
        
        return { successful, failed, executionMode: 'sequential' };
    }

    /**
     * Execute enhancement for a specific service
     * 
     * @private
     * @param {string} serviceName - Name of the service
     * @param {string} query - Original query
     * @param {Object} options - Enhancement options
     * @returns {Object} Service enhancement result
     */
    async executeServiceEnhancement(serviceName, query, options) {
        const service = this.services[serviceName];
        if (!service) {
            throw new Error(`Enhancement service not available: ${serviceName}`);
        }

        switch (serviceName) {
            case 'hyde':
                return await service.processQueryWithHyDE(query, options.hydeOptions || {});
            case 'wikipedia':
                return await service.processQueryWithWikipedia(query, options.wikipediaOptions || {});
            case 'wikidata':
                return await service.processQueryWithWikidata(query, options.wikidataOptions || {});
            default:
                throw new Error(`Unknown enhancement service: ${serviceName}`);
        }
    }

    /**
     * Combine contexts from multiple enhancement services
     * 
     * @private
     * @param {string} originalQuery - Original query
     * @param {Object} enhancementResults - Results from all services
     * @param {Object} options - Combination options
     * @returns {Object} Combined enhanced context
     */
    async combineEnhancedContext(originalQuery, enhancementResults, options = {}) {
        logger.info('🔗 Combining enhancement contexts');

        const combinedContext = {
            originalQuery,
            enhancements: {},
            combinedPrompt: '',
            metadata: {
                combinationMethod: 'weighted',
                weights: this.settings.contextWeights,
                servicesUsed: enhancementResults.successful.map(r => r.serviceName),
                totalLength: 0
            }
        };

        const contextSections = [`ORIGINAL QUESTION: ${originalQuery}\n`];

        // Process each successful enhancement
        for (const enhancement of enhancementResults.successful) {
            const serviceName = enhancement.serviceName;
            const result = enhancement.result;
            
            if (!result.success) continue;

            combinedContext.enhancements[serviceName] = result;

            // Add service-specific context
            switch (serviceName) {
                case 'hyde':
                    if (result.hypotheticalDoc) {
                        contextSections.push(`HyDE HYPOTHETICAL DOCUMENT:\n${result.hypotheticalDoc.content}\n`);
                        if (result.concepts && result.concepts.length > 0) {
                            const conceptList = result.concepts.slice(0, 8).map(c => `• ${c.value}`).join('\n');
                            contextSections.push(`HyDE CONCEPTS:\n${conceptList}\n`);
                        }
                    }
                    break;

                case 'wikipedia':
                    if (result.searchResults && result.searchResults.results) {
                        const articleSummaries = result.searchResults.results
                            .slice(0, 3)
                            .map((article, i) => `${i + 1}. ${article.title}: ${article.snippet || article.content || 'No content'}`)
                            .join('\n');
                        contextSections.push(`WIKIPEDIA CONTEXT:\n${articleSummaries}\n`);
                    }
                    break;

                case 'wikidata':
                    if (result.entitySearchResults && result.entitySearchResults.entities) {
                        const entitySummaries = result.entitySearchResults.entities
                            .slice(0, 3)
                            .map((entity, i) => `${i + 1}. ${entity.label} (${entity.wikidataId}): ${entity.description}`)
                            .join('\n');
                        contextSections.push(`WIKIDATA ENTITIES:\n${entitySummaries}\n`);
                        
                        if (result.entityDetails && result.entityDetails.relationships) {
                            const relationshipSummaries = result.entityDetails.relationships
                                .slice(0, 5)
                                .map(rel => `• ${rel.sourceEntityLabel} → ${rel.propertyLabel} → ${rel.targetEntityLabel}`)
                                .join('\n');
                            contextSections.push(`WIKIDATA RELATIONSHIPS:\n${relationshipSummaries}\n`);
                        }
                    }
                    break;
            }
        }

        // Combine sections and check length
        const fullContext = contextSections.join('\n');
        
        // Truncate if too long
        if (fullContext.length > this.settings.maxCombinedContextLength) {
            const truncatedContext = fullContext.substring(0, this.settings.maxCombinedContextLength) + '\n[Context truncated due to length...]';
            combinedContext.combinedPrompt = truncatedContext;
            combinedContext.metadata.truncated = true;
        } else {
            combinedContext.combinedPrompt = fullContext;
            combinedContext.metadata.truncated = false;
        }

        combinedContext.metadata.totalLength = combinedContext.combinedPrompt.length;
        
        logger.info(`✅ Combined context created (${combinedContext.metadata.totalLength} chars, ${enhancementResults.successful.length} services)`);
        
        return combinedContext;
    }

    /**
     * Generate enhanced response using combined context
     * 
     * @private
     * @param {string} originalQuery - Original query
     * @param {Object} combinedContext - Combined enhancement context
     * @param {Object} options - Generation options
     * @returns {Object} Enhanced response
     */
    async generateEnhancedResponse(originalQuery, combinedContext, options = {}) {
        logger.info('💭 Generating enhanced response');

        if (!this.llmHandler) {
            logger.warn('No LLM handler available for response generation');
            return {
                enhancedPrompt: combinedContext.combinedPrompt,
                answer: 'Enhanced context prepared, but no LLM handler available for response generation.',
                contextLength: combinedContext.metadata.totalLength
            };
        }

        try {
            const enhancedPrompt = this.buildComprehensivePrompt(originalQuery, combinedContext);
            
            const answer = await this.llmHandler.generateResponse(enhancedPrompt);

            return {
                enhancedPrompt,
                answer,
                contextLength: combinedContext.metadata.totalLength,
                generationSuccessful: true
            };

        } catch (error) {
            logger.error('❌ Enhanced response generation failed:', error.message);
            return {
                enhancedPrompt: combinedContext.combinedPrompt,
                answer: `Error generating enhanced response: ${error.message}`,
                contextLength: combinedContext.metadata.totalLength,
                generationSuccessful: false,
                error: error.message
            };
        }
    }

    /**
     * Build comprehensive prompt combining all enhancement contexts
     * 
     * @private
     * @param {string} originalQuery - Original query
     * @param {Object} combinedContext - Combined context
     * @returns {string} Comprehensive prompt
     */
    buildComprehensivePrompt(originalQuery, combinedContext) {
        const servicesUsed = combinedContext.metadata.servicesUsed.join(', ');
        
        return `You are answering a question using multiple knowledge enhancement sources: ${servicesUsed}. Provide a comprehensive, accurate response that synthesizes information from all available sources.

${combinedContext.combinedPrompt}

INSTRUCTIONS:
- Synthesize information from all enhancement sources (HyDE, Wikipedia, Wikidata as available)
- Provide specific facts and examples from the enhanced context
- Cite sources when referencing specific information (e.g., "According to Wikipedia..." or "Based on Wikidata...")
- If information from different sources conflicts, acknowledge this and explain the differences
- If the enhanced context is insufficient for a complete answer, clearly state what additional information would be helpful
- Prioritize accuracy and provide specific details when available

COMPREHENSIVE ANSWER:`;
    }

    /**
     * Update service statistics
     * 
     * @private
     * @param {Array} servicesUsed - Array of service names
     * @param {number} responseTime - Response time in milliseconds
     * @param {boolean} success - Whether the enhancement was successful
     */
    updateStats(servicesUsed, responseTime, success) {
        if (success) {
            this.stats.successfulEnhancements++;
        } else {
            this.stats.failedEnhancements++;
        }

        // Update average response time
        this.stats.averageResponseTime = 
            (this.stats.averageResponseTime * (this.stats.totalEnhancements - 1) + responseTime) / 
            this.stats.totalEnhancements;

        this.stats.lastEnhancementTime = new Date().toISOString();
    }

    /**
     * Get service health and statistics
     * 
     * @returns {Object} Service health information
     */
    getServiceHealth() {
        const serviceHealth = {};
        
        for (const [serviceName, service] of Object.entries(this.services)) {
            try {
                serviceHealth[serviceName] = service.getServiceStats();
            } catch (error) {
                serviceHealth[serviceName] = {
                    serviceName,
                    error: error.message,
                    healthy: false
                };
            }
        }

        return {
            coordinator: {
                serviceName: 'EnhancementCoordinator',
                settings: this.settings,
                handlers: {
                    llm: !!this.llmHandler,
                    embedding: !!this.embeddingHandler,
                    sparql: !!this.sparqlHelper
                },
                stats: this.stats,
                healthy: true
            },
            services: serviceHealth,
            overall: {
                totalServices: Object.keys(this.services).length,
                healthyServices: Object.values(serviceHealth).filter(s => s.healthy !== false).length,
                lastActivity: this.stats.lastEnhancementTime
            }
        };
    }

    /**
     * Reset service statistics
     */
    resetStats() {
        this.stats = {
            totalEnhancements: 0,
            successfulEnhancements: 0,
            failedEnhancements: 0,
            serviceUsage: {
                hyde: 0,
                wikipedia: 0,
                wikidata: 0
            },
            averageResponseTime: 0,
            lastEnhancementTime: null
        };
        logger.info('📊 Enhancement coordinator statistics reset');
    }

    /**
     * Clear all service caches
     */
    clearCaches() {
        for (const [serviceName, service] of Object.entries(this.services)) {
            if (typeof service.clearCache === 'function') {
                service.clearCache();
                logger.info(`🗑️ Cleared cache for ${serviceName} service`);
            }
        }
    }
}

export default EnhancementCoordinator;