/**
 * Memory Domain Manager
 * 
 * Manages memory domains (user, project, session, instructions) with ZPT-based visibility.
 * Implements ChatGPT-style memory features using navigation instead of deletion.
 * 
 * Core principle: Memories are never deleted, only moved in/out of navigation view.
 */

import { v4 as uuidv4 } from 'uuid';
import { SPARQL_CONFIG, MEMORY_CONFIG } from '../../../config/preferences.js';
import { createUnifiedLogger } from '../../utils/LoggingConfig.js';

export class MemoryDomainManager {
    constructor(sparqlStore, zptSessionManager, options = {}) {
        this.sparqlStore = sparqlStore;
        this.zptSessionManager = zptSessionManager;
        if (!SPARQL_CONFIG?.SIMILARITY?.DEFAULT_THRESHOLD) {
            throw new Error('defaultRelevanceThreshold must be provided from preferences.js SPARQL_CONFIG.SIMILARITY.DEFAULT_THRESHOLD');
        }
        if (!MEMORY_CONFIG?.VISIBILITY?.MAX_VISIBLE_MEMORIES) {
            throw new Error('maxVisibleMemories must be provided from preferences.js MEMORY_CONFIG.VISIBILITY.MAX_VISIBLE_MEMORIES');
        }
        if (!MEMORY_CONFIG?.DECAY?.TEMPORAL_DECAY_HALF_LIFE) {
            throw new Error('temporalDecayHalfLife must be provided from preferences.js MEMORY_CONFIG.DECAY.TEMPORAL_DECAY_HALF_LIFE');
        }
        if (!MEMORY_CONFIG?.VISIBILITY?.DOMAIN_GRAPH) {
            throw new Error('domainGraph must be provided from preferences.js MEMORY_CONFIG.VISIBILITY.DOMAIN_GRAPH');
        }

        this.config = {
            defaultRelevanceThreshold: SPARQL_CONFIG.SIMILARITY.DEFAULT_THRESHOLD,
            maxVisibleMemories: MEMORY_CONFIG.VISIBILITY.MAX_VISIBLE_MEMORIES,
            temporalDecayHalfLife: MEMORY_CONFIG.DECAY.TEMPORAL_DECAY_HALF_LIFE,
            domainGraph: MEMORY_CONFIG.VISIBILITY.DOMAIN_GRAPH,
            ...options
        };

        // Memory relevance weights
        this.relevanceWeights = {
            domainMatch: 0.35,      // How well memory matches current domains
            temporal: 0.20,         // Recency and temporal decay
            semantic: 0.30,         // Semantic similarity to current focus
            frequency: 0.15         // Access frequency and importance
        };

        // Domain hierarchy cache
        this.domainHierarchy = new Map();
        this.memoryCache = new Map();

        this.logger = createUnifiedLogger('MemoryDomainManager');
        this.logger.info('🧠 MemoryDomainManager initialized');
    }

    /**
     * Create a new memory domain (user, project, session, instruction)
     */
    async createDomain(type, id, metadata = {}) {
        const domainURI = this.generateDomainURI(type, id);

        const domainData = {
            uri: domainURI,
            type: type,
            id: id,
            created: Date.now(),
            metadata: {
                ...metadata,
                relevanceDecay: this.getDefaultDecayRate(type),
                priority: this.getDefaultPriority(type)
            }
        };

        this.logger.info(`🎯 Creating ${type} domain:`, { id, uri: domainURI });

        // Store domain in SPARQL with proper vocabulary
        const sparqlInsert = `
            PREFIX zpt: <http://purl.org/stuff/zpt/>
            PREFIX dcterms: <http://purl.org/dc/terms/>
            PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
            
            INSERT DATA {
                GRAPH <${this.config.domainGraph}> {
                    <${domainURI}> a zpt:${this.capitalize(type)}Domain ;
                        dcterms:identifier "${id}" ;
                        dcterms:created "${new Date().toISOString()}"^^xsd:dateTime ;
                        zpt:relevanceDecay "${domainData.metadata.relevanceDecay}"^^xsd:float ;
                        zpt:priority "${domainData.metadata.priority}"^^xsd:integer .
                    
                    ${metadata.description ? `<${domainURI}> dcterms:description "${metadata.description}" .` : ''}
                    ${metadata.parentDomain ? `<${domainURI}> zpt:hasParentDomain <${metadata.parentDomain}> .` : ''}
                    ${metadata.technologies ? metadata.technologies.map(tech =>
            `<${domainURI}> zpt:usesTechnology "${tech}" .`).join('\n                    ') : ''}
                }
            }
        `;

        await this.executeSPARQLUpdate(sparqlInsert);

        // Cache domain
        this.domainHierarchy.set(domainURI, domainData);

        this.logger.debug(`✅ Domain created successfully:`, { uri: domainURI, type, id });
        return domainData;
    }

    /**
     * Switch between domains with optional fade transition
     */
    async switchDomain(fromDomains, toDomains, options = {}) {
        const {
            fadeFactor = 0.1,
            transition = 'smooth',
            preserveInstructions = true
        } = options;

        this.logger.info('🔄 Switching domain context:', {
            from: fromDomains,
            to: toDomains,
            options
        });

        const fromArray = Array.isArray(fromDomains) ? fromDomains : [fromDomains];
        const toArray = Array.isArray(toDomains) ? toDomains : [toDomains];

        // Update ZPT state to reflect new domain context
        const panUpdate = {
            domains: toArray,
            fadeOut: fromArray,
            fadeFactor: fadeFactor,
            preserveInstructions: preserveInstructions
        };

        // Use existing ZPT session manager to update pan state
        if (this.zptSessionManager) {
            await this.zptSessionManager.updateNavigationState({
                pan: panUpdate,
                timestamp: Date.now(),
                transition: transition
            });
        }

        // Log domain switch for auditability
        await this.logDomainSwitch(fromArray, toArray, fadeFactor);

        this.logger.debug('✅ Domain switch completed');
        return { success: true, from: fromArray, to: toArray };
    }

    /**
     * Calculate multi-factor relevance score for a memory
     */
    calculateRelevance(memory, currentZPTState) {
        const factors = {
            domainMatch: this.computeDomainMatch(memory.domains || [], currentZPTState.panDomains || []),
            temporal: this.computeTemporalRelevance(memory.timestamp, memory.lastAccessed),
            semantic: this.computeSemanticRelevance(memory.embedding, currentZPTState.focusEmbedding),
            frequency: this.computeFrequencyRelevance(memory.accessCount, memory.metadata?.importance)
        };

        // Calculate weighted relevance score
        const relevance = Object.entries(factors).reduce((total, [factor, value]) => {
            return total + (value * this.relevanceWeights[factor]);
        }, 0);

        // Ensure minimum relevance (never zero - memories are never completely forgotten)
        const finalRelevance = Math.max(0.001, relevance);

        this.logger.debug('📊 Calculated memory relevance:', {
            memoryId: memory.id,
            factors,
            finalRelevance
        });

        return {
            score: finalRelevance,
            factors: factors,
            metadata: {
                isInstruction: memory.domain === 'instructions',
                isArchived: memory.domain?.includes('archived'),
                recencyBias: factors.temporal > 0.5
            }
        };
    }

    /**
     * Get visible memories based on current ZPT state and relevance
     */
    async getVisibleMemories(query, zptState) {
        this.logger.info('🔍 Retrieving visible memories:', {
            query: query?.substring(0, 100) + '...',
            threshold: zptState.relevanceThreshold || this.config.defaultRelevanceThreshold
        });

        // Fetch all memories from storage
        const allMemories = await this.fetchAllMemories(query);

        // Calculate relevance and filter
        const relevanceThreshold = zptState.relevanceThreshold || this.config.defaultRelevanceThreshold;
        this.logger.debug(`🎯 Relevance threshold: ${relevanceThreshold}`);

        const scoredMemories = allMemories
            .map(memory => {
                const relevanceResult = this.calculateRelevance(memory, zptState);
                this.logger.debug(`📊 Memory ${memory.id}: relevance=${relevanceResult.score}, hasEmbedding=${!!memory.embedding}, textContent="${(memory.content || memory.output || memory.prompt || '').substring(0, 50)}..."`);
                return {
                    ...memory,
                    relevance: relevanceResult.score,
                    relevanceFactors: relevanceResult.factors,
                    relevanceMetadata: relevanceResult.metadata
                };
            })
            .filter(m => {
                const passes = m.relevance > relevanceThreshold;
                if (!passes) {
                    this.logger.debug(`❌ Memory ${m.id} filtered out: relevance=${m.relevance} <= threshold=${relevanceThreshold}`);
                }
                return passes;
            })
            .sort((a, b) => b.relevance - a.relevance)
            .slice(0, zptState.maxMemories || this.config.maxVisibleMemories);

        this.logger.debug(`📋 Filtered memories: ${scoredMemories.length}/${allMemories.length} visible`);

        return scoredMemories;
    }

    /**
     * Fade memory context (reduce relevance without deletion)
     */
    async fadeContext(domain, fadeFactor = 0.1) {
        this.logger.info(`🌫️ Fading memory context for domain: ${domain} (factor: ${fadeFactor})`);

        // Update domain relevance weight in SPARQL
        const updateQuery = `
            PREFIX zpt: <http://purl.org/stuff/zpt/>
            PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
            
            DELETE {
                GRAPH <${this.config.domainGraph}> {
                    ?domain zpt:relevanceFactor ?oldFactor .
                }
            }
            INSERT {
                GRAPH <${this.config.domainGraph}> {
                    ?domain zpt:relevanceFactor "${fadeFactor}"^^xsd:float ;
                           zpt:fadeTimestamp "${new Date().toISOString()}"^^xsd:dateTime .
                }
            }
            WHERE {
                GRAPH <${this.config.domainGraph}> {
                    ?domain dcterms:identifier "${domain}" .
                    OPTIONAL { ?domain zpt:relevanceFactor ?oldFactor }
                }
            }
        `;

        await this.executeSPARQLUpdate(updateQuery);

        this.logger.debug(`✅ Context faded for domain: ${domain}`);
        return { success: true, domain, fadeFactor };
    }

    /**
     * Recover "forgotten" memories by adjusting navigation
     */
    async recoverMemories(searchCriteria) {
        this.logger.info('🔧 Initiating memory recovery:', { criteria: searchCriteria });

        // Store original ZPT state
        const originalState = this.zptSessionManager.getState();

        try {
            // Temporarily expand navigation view
            await this.zptSessionManager.updateNavigationState({
                zoom: 'corpus',  // Widest view
                pan: {
                    domains: ['*'],  // All domains
                    temporalScope: 'all_time',
                    relevanceThreshold: 0.0  // Show everything
                },
                tilt: 'temporal'  // Time-based organization
            });

            // Search with expanded context
            const recoveredMemories = await this.fetchAllMemories(searchCriteria);

            // Filter for previously low-relevance memories
            const previouslyHidden = recoveredMemories.filter(memory => {
                const oldRelevance = this.calculateRelevance(memory, originalState);
                return oldRelevance.score < (originalState.relevanceThreshold || this.config.defaultRelevanceThreshold);
            });

            this.logger.info(`🎯 Memory recovery complete: ${previouslyHidden.length} previously hidden memories found`);

            return {
                success: true,
                recoveredCount: previouslyHidden.length,
                memories: previouslyHidden.slice(0, 20), // Return top 20
                originalStateRestored: false  // Let caller decide whether to restore
            };

        } catch (error) {
            this.logger.error('❌ Memory recovery failed:', error);

            // Restore original state on error
            await this.zptSessionManager.updateNavigationState(originalState);

            throw error;
        }
    }

    // === PRIVATE HELPER METHODS ===

    generateDomainURI(type, id) {
        const baseURI = 'http://purl.org/stuff/domains';
        return `${baseURI}/${type}:${id}`;
    }

    capitalize(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }

    getDefaultDecayRate(type) {
        const rates = {
            'user': 0.95,           // Slow decay for user preferences
            'project': 0.85,        // Moderate decay for projects  
            'session': 0.5,         // Fast decay for sessions
            'instruction': 0.99     // Very slow decay for explicit instructions
        };
        return rates[type];
    }

    getDefaultPriority(type) {
        const priorities = {
            'instruction': 10,      // Highest priority
            'user': 8,              // High priority
            'project': 6,           // Medium priority
            'session': 4            // Lower priority
        };
        return priorities[type] || 5;
    }

    computeDomainMatch(memoryDomains, currentDomains) {
        if (!memoryDomains.length || !currentDomains.length) return 0;

        const intersection = memoryDomains.filter(d => currentDomains.includes(d));
        return intersection.length / Math.max(memoryDomains.length, currentDomains.length);
    }

    computeTemporalRelevance(created, lastAccessed) {
        const now = Date.now();
        const age = now - (lastAccessed || created);

        // Exponential decay based on half-life
        return Math.exp(-age / this.config.temporalDecayHalfLife);
    }

    computeSemanticRelevance(memoryEmbedding, focusEmbedding) {
        if (!memoryEmbedding || !focusEmbedding) return 0.5; // Neutral if no embeddings

        // Cosine similarity calculation
        const dotProduct = memoryEmbedding.reduce((sum, a, i) => sum + a * focusEmbedding[i], 0);
        const normA = Math.sqrt(memoryEmbedding.reduce((sum, a) => sum + a * a, 0));
        const normB = Math.sqrt(focusEmbedding.reduce((sum, b) => sum + b * b, 0));

        return normA && normB ? dotProduct / (normA * normB) : 0;
    }

    computeFrequencyRelevance(accessCount, importance) {
        const normalizedAccess = Math.log(1 + (accessCount || 0)) / 10; // Log scale
        const importanceScore = (importance);

        return Math.min(1, normalizedAccess + importanceScore);
    }

    async fetchAllMemories(query) {
        try {
            console.log('🔥 DEBUG: fetchAllMemories called with query:', query?.substring(0, 50));
            console.log('🔥 DEBUG: this.sparqlStore exists:', !!this.sparqlStore);
            console.log('🔥 DEBUG: this.sparqlStore.loadHistory exists:', !!this.sparqlStore?.loadHistory);

            // Use existing SPARQLStore loadHistory method to get all memories
            const result = await this.sparqlStore.loadHistory();
            console.log('🔥 DEBUG: loadHistory result type:', typeof result);
            console.log('🔥 DEBUG: loadHistory result:', Array.isArray(result) ? `Array[${result.length}]` : result);

            const [shortTermMemories, longTermMemories] = Array.isArray(result) ? result : [result || [], []];

            console.log('🔥 DEBUG: shortTermMemories length:', shortTermMemories?.length || 0);
            console.log('🔥 DEBUG: longTermMemories length:', longTermMemories?.length || 0);

            // Combine both short-term and long-term memories
            const allMemories = [...(shortTermMemories || []), ...(longTermMemories || [])];

            console.log('🔥 DEBUG: Total memories combined:', allMemories.length);
            if (allMemories.length > 0) {
                console.log('🔥 DEBUG: First memory sample:', {
                    id: allMemories[0]?.id,
                    content: allMemories[0]?.content?.substring(0, 50),
                    output: allMemories[0]?.output?.substring(0, 50)
                });
            }

            this.logger.debug(`📋 Fetched ${allMemories.length} memories from SPARQL store`);

            return allMemories;
        } catch (error) {
            console.log('🔥 DEBUG: fetchAllMemories error:', error.message);
            this.logger.error('Failed to fetch memories from SPARQL store:', error);
            return [];
        }
    }

    async executeSPARQLUpdate(updateQuery) {
        if (this.sparqlStore && this.sparqlStore.executeUpdate) {
            await this.sparqlStore.executeUpdate(updateQuery);
        } else {
            this.logger.warn('SPARQL store not available for update');
        }
    }

    async logDomainSwitch(fromDomains, toDomains, fadeFactor) {
        const logEntry = {
            timestamp: new Date().toISOString(),
            action: 'domain_switch',
            from: fromDomains,
            to: toDomains,
            fadeFactor: fadeFactor,
            sessionId: this.zptSessionManager?.currentSession?.id
        };

        this.logger.info('📝 Domain switch logged:', logEntry);

        // Could also persist to SPARQL for audit trail
    }
}

export default MemoryDomainManager;