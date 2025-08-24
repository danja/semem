/**
 * Applies domain-specific filtering constraints based on pan parameters
 * Enhanced with memory domain hierarchy support for ChatGPT-style memory features
 */

import logger from 'loglevel';

export default class PanDomainFilter {
    constructor(options = {}) {
        this.config = {
            fuzzyMatchThreshold: options.fuzzyMatchThreshold || 0.7,
            temporalGracePeriod: options.temporalGracePeriod || 86400000, // 1 day in ms
            geographicPrecision: options.geographicPrecision || 6, // decimal places
            topicExpansion: options.topicExpansion !== false,
            entityResolution: options.entityResolution !== false,
            
            // Memory domain specific settings
            memoryRelevanceThreshold: options.memoryRelevanceThreshold || 0.1,
            domainFadeSupport: options.domainFadeSupport !== false,
            hierarchicalDomains: options.hierarchicalDomains !== false,
            crossDomainBoost: options.crossDomainBoost || 1.2,
            
            ...options
        };
        
        this.initializeFilterStrategies();
        this.initializeDomainPatterns();
        this.initializeMemoryDomains();
        
        this.logger = logger.getLogger('zpt:pan');
        this.domainHierarchy = new Map();
        this.memoryRelevanceEngine = options.memoryRelevanceEngine || null;
    }

    /**
     * Initialize filtering strategies for different pan dimensions
     */
    initializeFilterStrategies() {
        this.filterStrategies = {
            topic: {
                exact: this.createExactTopicFilter.bind(this),
                fuzzy: this.createFuzzyTopicFilter.bind(this),
                semantic: this.createSemanticTopicFilter.bind(this),
                hierarchical: this.createHierarchicalTopicFilter.bind(this)
            },
            entity: {
                direct: this.createDirectEntityFilter.bind(this),
                related: this.createRelatedEntityFilter.bind(this),
                transitive: this.createTransitiveEntityFilter.bind(this),
                typed: this.createTypedEntityFilter.bind(this)
            },
            temporal: {
                exact: this.createExactTemporalFilter.bind(this),
                range: this.createRangeTemporalFilter.bind(this),
                relative: this.createRelativeTemporalFilter.bind(this),
                periodic: this.createPeriodicTemporalFilter.bind(this)
            },
            geographic: {
                point: this.createPointGeographicFilter.bind(this),
                bbox: this.createBboxGeographicFilter.bind(this),
                polygon: this.createPolygonGeographicFilter.bind(this),
                administrative: this.createAdministrativeGeographicFilter.bind(this)
            }
        };
    }

    /**
     * Initialize domain-specific patterns and vocabularies
     */
    initializeDomainPatterns() {
        this.domainPatterns = {
            scientific: {
                topicPrefixes: ['bio:', 'chem:', 'phys:', 'med:'],
                entityTypes: ['Gene', 'Protein', 'Chemical', 'Disease'],
                temporalGranularity: 'day'
            },
            geographic: {
                topicPrefixes: ['geo:', 'place:', 'location:'],
                entityTypes: ['Location', 'Region', 'Country', 'City'],
                spatialUnits: ['degree', 'meter', 'kilometer']
            },
            temporal: {
                topicPrefixes: ['time:', 'event:', 'period:'],
                entityTypes: ['Event', 'Period', 'Era', 'Timeline'],
                temporalUnits: ['second', 'minute', 'hour', 'day', 'month', 'year']
            },
            social: {
                topicPrefixes: ['person:', 'org:', 'social:'],
                entityTypes: ['Person', 'Organization', 'Group', 'Institution'],
                relationshipTypes: ['knows', 'memberOf', 'worksFor']
            }
        };
    }

    /**
     * Initialize memory domain configurations for ChatGPT-style memory features
     */
    initializeMemoryDomains() {
        this.memoryDomainTypes = {
            user: {
                priority: 10,
                baseRelevance: 0.9,
                decayHalfLife: 31536000000, // 1 year
                fadingStrategy: 'gradual',
                inheritanceRules: ['session', 'project']
            },
            project: {
                priority: 8,
                baseRelevance: 0.8,
                decayHalfLife: 2592000000, // 30 days
                fadingStrategy: 'contextual',
                inheritanceRules: ['session'],
                hierarchicalSupport: true
            },
            session: {
                priority: 6,
                baseRelevance: 0.7,
                decayHalfLife: 3600000, // 1 hour
                fadingStrategy: 'temporal',
                inheritanceRules: []
            },
            instruction: {
                priority: 15,
                baseRelevance: 1.0,
                decayHalfLife: Infinity, // Never decay
                fadingStrategy: 'none',
                inheritanceRules: ['user', 'project', 'session'],
                alwaysVisible: true
            }
        };

        this.memoryFilters = {
            relevanceThreshold: this.createRelevanceThresholdFilter.bind(this),
            domainHierarchy: this.createDomainHierarchyFilter.bind(this),
            temporalFading: this.createTemporalFadingFilter.bind(this),
            crossDomainBoost: this.createCrossDomainBoostFilter.bind(this)
        };

        this.logger.debug('🧠 Memory domain patterns initialized:', {
            domainTypes: Object.keys(this.memoryDomainTypes),
            filtersCount: Object.keys(this.memoryFilters).length
        });
    }

    /**
     * Apply all pan filters to a selection query
     * @param {Object} panParams - Normalized pan parameters
     * @param {Object} queryContext - Query context and constraints
     * @returns {Object} Enhanced query with domain filters
     */
    applyFilters(panParams, queryContext = {}) {
        let enhancedQuery = { ...queryContext };
        const appliedFilters = [];

        // Apply memory domain filters first (if enabled)
        if (panParams.domains && this.config.hierarchicalDomains) {
            const memoryFilter = this.applyMemoryDomainFilter(panParams.domains, enhancedQuery);
            enhancedQuery = { ...enhancedQuery, ...memoryFilter.query };
            appliedFilters.push(memoryFilter.metadata);
            
            this.logger.debug('🧠 Applied memory domain filters:', {
                domains: panParams.domains,
                filterCount: appliedFilters.length
            });
        }

        // Apply topic filters
        if (panParams.topic) {
            const topicFilter = this.applyTopicFilter(panParams.topic, enhancedQuery);
            enhancedQuery = { ...enhancedQuery, ...topicFilter.query };
            appliedFilters.push(topicFilter.metadata);
        }

        // Apply entity filters
        if (panParams.entity) {
            const entityFilter = this.applyEntityFilter(panParams.entity, enhancedQuery);
            enhancedQuery = { ...enhancedQuery, ...entityFilter.query };
            appliedFilters.push(entityFilter.metadata);
        }

        // Apply temporal filters
        if (panParams.temporal) {
            const temporalFilter = this.applyTemporalFilter(panParams.temporal, enhancedQuery);
            enhancedQuery = { ...enhancedQuery, ...temporalFilter.query };
            appliedFilters.push(temporalFilter.metadata);
        }

        // Apply geographic filters
        if (panParams.geographic) {
            const geographicFilter = this.applyGeographicFilter(panParams.geographic, enhancedQuery);
            enhancedQuery = { ...enhancedQuery, ...geographicFilter.query };
            appliedFilters.push(geographicFilter.metadata);
        }

        return {
            query: enhancedQuery,
            appliedFilters,
            filterCount: appliedFilters.length,
            estimatedSelectivity: this.calculateSelectivity(appliedFilters),
            memoryDomainContext: this.buildMemoryDomainContext(panParams.domains)
        };
    }

    /**
     * Apply topic-based domain filtering
     */
    applyTopicFilter(topicFilter, queryContext) {
        const { value, pattern, namespace } = topicFilter;
        const domain = this.detectTopicDomain(value, namespace);
        
        let strategy = 'exact';
        if (pattern === 'wildcard') strategy = 'fuzzy';
        if (this.config.topicExpansion) strategy = 'semantic';
        if (domain) strategy = 'hierarchical';

        const filterFunction = this.filterStrategies.topic[strategy];
        const filter = filterFunction(topicFilter, domain, queryContext);

        return {
            query: filter,
            metadata: {
                type: 'topic',
                strategy,
                domain,
                selectivity: this.estimateTopicSelectivity(topicFilter, domain),
                expansions: filter.expansions || []
            }
        };
    }

    /**
     * Apply entity-based domain filtering
     */
    applyEntityFilter(entityFilter, queryContext) {
        const { values, type } = entityFilter;
        const domain = this.detectEntityDomain(values);
        
        let strategy = type === 'single' ? 'direct' : 'related';
        if (this.config.entityResolution) strategy = 'transitive';
        if (domain) strategy = 'typed';

        const filterFunction = this.filterStrategies.entity[strategy];
        const filter = filterFunction(entityFilter, domain, queryContext);

        return {
            query: filter,
            metadata: {
                type: 'entity',
                strategy,
                domain,
                entityCount: values.length,
                selectivity: this.estimateEntitySelectivity(entityFilter, domain),
                resolvedEntities: filter.resolvedEntities || values
            }
        };
    }

    /**
     * Apply temporal domain filtering
     */
    applyTemporalFilter(temporalFilter, queryContext) {
        const { start, end, duration, durationDays } = temporalFilter;
        const domain = this.detectTemporalDomain(temporalFilter);
        
        let strategy = 'exact';
        if (start && end) strategy = 'range';
        if (durationDays && durationDays > 365) strategy = 'relative';
        if (domain && domain.granularity) strategy = 'periodic';

        const filterFunction = this.filterStrategies.temporal[strategy];
        const filter = filterFunction(temporalFilter, domain, queryContext);

        return {
            query: filter,
            metadata: {
                type: 'temporal',
                strategy,
                domain,
                timespan: duration || 0,
                selectivity: this.estimateTemporalSelectivity(temporalFilter, domain),
                normalizedRange: filter.normalizedRange || { start, end }
            }
        };
    }

    /**
     * Apply geographic domain filtering
     */
    applyGeographicFilter(geographicFilter, queryContext) {
        const domain = this.detectGeographicDomain(geographicFilter);
        
        let strategy = 'point';
        if (geographicFilter.bbox) strategy = 'bbox';
        if (geographicFilter.polygon) strategy = 'polygon';
        if (domain && domain.administrative) strategy = 'administrative';

        const filterFunction = this.filterStrategies.geographic[strategy];
        const filter = filterFunction(geographicFilter, domain, queryContext);

        return {
            query: filter,
            metadata: {
                type: 'geographic',
                strategy,
                domain,
                area: this.calculateGeographicArea(geographicFilter),
                selectivity: this.estimateGeographicSelectivity(geographicFilter, domain),
                coordinates: filter.normalizedCoordinates || {}
            }
        };
    }

    /**
     * Topic filter implementations
     */
    createExactTopicFilter(topicFilter, domain, queryContext) {
        const { value } = topicFilter;
        return {
            sparqlClause: `
                FILTER (
                    CONTAINS(LCASE(STR(?label)), "${value.toLowerCase()}") ||
                    CONTAINS(LCASE(STR(?prefLabel)), "${value.toLowerCase()}") ||
                    CONTAINS(LCASE(STR(?description)), "${value.toLowerCase()}")
                )
            `,
            confidence: 0.9
        };
    }

    createFuzzyTopicFilter(topicFilter, domain, queryContext) {
        const { value } = topicFilter;
        const patterns = this.generateFuzzyPatterns(value);
        
        const regexPatterns = patterns.map(p => `REGEX(STR(?label), "${p}", "i")`).join(' || ');
        
        return {
            sparqlClause: `FILTER (${regexPatterns})`,
            confidence: 0.7,
            patterns
        };
    }

    createSemanticTopicFilter(topicFilter, domain, queryContext) {
        const { value } = topicFilter;
        const expansions = this.expandTopicSemantically(value, domain);
        
        const semanticTerms = [value, ...expansions].map(term => 
            `CONTAINS(LCASE(STR(?label)), "${term.toLowerCase()}")`
        ).join(' || ');
        
        return {
            sparqlClause: `FILTER (${semanticTerms})`,
            confidence: 0.8,
            expansions
        };
    }

    createHierarchicalTopicFilter(topicFilter, domain, queryContext) {
        const { value, namespace } = topicFilter;
        const hierarchy = this.buildTopicHierarchy(value, domain);
        
        const hierarchicalTerms = hierarchy.map(level => 
            level.map(term => `CONTAINS(LCASE(STR(?label)), "${term.toLowerCase()}")`).join(' || ')
        ).join(' || ');
        
        return {
            sparqlClause: `FILTER (${hierarchicalTerms})`,
            confidence: 0.85,
            hierarchy
        };
    }

    /**
     * Entity filter implementations
     */
    createDirectEntityFilter(entityFilter, domain, queryContext) {
        const { values } = entityFilter;
        const entityUris = values.map(v => `<${v}>`).join(', ');
        
        return {
            sparqlClause: `
                FILTER (
                    ?uri IN (${entityUris}) ||
                    ?entity IN (${entityUris}) ||
                    ?relatedEntity IN (${entityUris})
                )
            `,
            confidence: 1.0,
            resolvedEntities: values
        };
    }

    createRelatedEntityFilter(entityFilter, domain, queryContext) {
        const { values } = entityFilter;
        const relatedEntities = this.findRelatedEntities(values, domain);
        const allEntities = [...values, ...relatedEntities];
        const entityUris = allEntities.map(v => `<${v}>`).join(', ');
        
        return {
            sparqlClause: `
                {
                    ?uri ragno:relatedTo ?entity .
                    FILTER (?entity IN (${entityUris}))
                } UNION {
                    ?entity ragno:relatedTo ?uri .
                    FILTER (?entity IN (${entityUris}))
                }
            `,
            confidence: 0.8,
            resolvedEntities: allEntities
        };
    }

    createTransitiveEntityFilter(entityFilter, domain, queryContext) {
        const { values } = entityFilter;
        const transitiveEntities = this.findTransitiveEntities(values, domain);
        const allEntities = [...values, ...transitiveEntities];
        const entityUris = allEntities.map(v => `<${v}>`).join(', ');
        
        return {
            sparqlClause: `
                {
                    ?uri ragno:relatedTo+ ?entity .
                    FILTER (?entity IN (${entityUris}))
                } UNION {
                    ?entity ragno:relatedTo+ ?uri .
                    FILTER (?entity IN (${entityUris}))
                }
            `,
            confidence: 0.6,
            resolvedEntities: allEntities
        };
    }

    createTypedEntityFilter(entityFilter, domain, queryContext) {
        const { values } = entityFilter;
        const entityTypes = this.inferEntityTypes(values, domain);
        const typeFilters = entityTypes.map(type => 
            `?uri rdf:type ragno:${type}`
        ).join(' || ');
        
        return {
            sparqlClause: `
                FILTER (${typeFilters})
                FILTER (?uri IN (${values.map(v => `<${v}>`).join(', ')}))
            `,
            confidence: 0.9,
            inferredTypes: entityTypes
        };
    }

    /**
     * Temporal filter implementations
     */
    createExactTemporalFilter(temporalFilter, domain, queryContext) {
        const { start, end } = temporalFilter;
        let clause = '';
        
        if (start && end) {
            clause = `
                FILTER (?created >= "${start}"^^xsd:dateTime && 
                        ?created <= "${end}"^^xsd:dateTime)
            `;
        } else if (start) {
            clause = `FILTER (?created >= "${start}"^^xsd:dateTime)`;
        } else if (end) {
            clause = `FILTER (?created <= "${end}"^^xsd:dateTime)`;
        }
        
        return {
            sparqlClause: clause,
            confidence: 1.0,
            normalizedRange: { start, end }
        };
    }

    createRangeTemporalFilter(temporalFilter, domain, queryContext) {
        const { start, end } = temporalFilter;
        const gracePeriod = this.config.temporalGracePeriod;
        
        const expandedStart = new Date(new Date(start).getTime() - gracePeriod).toISOString();
        const expandedEnd = new Date(new Date(end).getTime() + gracePeriod).toISOString();
        
        return {
            sparqlClause: `
                FILTER (?created >= "${expandedStart}"^^xsd:dateTime && 
                        ?created <= "${expandedEnd}"^^xsd:dateTime)
            `,
            confidence: 0.9,
            normalizedRange: { start: expandedStart, end: expandedEnd },
            gracePeriod
        };
    }

    createRelativeTemporalFilter(temporalFilter, domain, queryContext) {
        const { durationDays } = temporalFilter;
        const now = new Date();
        const relativeStart = new Date(now.getTime() - (durationDays * 24 * 60 * 60 * 1000));
        
        return {
            sparqlClause: `
                FILTER (?created >= "${relativeStart.toISOString()}"^^xsd:dateTime)
            `,
            confidence: 0.8,
            normalizedRange: { start: relativeStart.toISOString(), end: now.toISOString() }
        };
    }

    createPeriodicTemporalFilter(temporalFilter, domain, queryContext) {
        const { start, end } = temporalFilter;
        const periods = this.generatePeriodicIntervals(start, end, domain);
        
        const periodClauses = periods.map(period => 
            `(?created >= "${period.start}"^^xsd:dateTime && ?created <= "${period.end}"^^xsd:dateTime)`
        ).join(' || ');
        
        return {
            sparqlClause: `FILTER (${periodClauses})`,
            confidence: 0.7,
            periods,
            normalizedRange: { start, end }
        };
    }

    /**
     * Geographic filter implementations
     */
    createPointGeographicFilter(geographicFilter, domain, queryContext) {
        const { center, radius } = geographicFilter;
        if (!center) return { sparqlClause: '', confidence: 0 };
        
        const { lat, lon } = center;
        const radiusKm = radius || 10; // Default 10km radius
        
        return {
            sparqlClause: `
                ?uri ragno:hasLocation ?location .
                ?location ragno:latitude ?lat ;
                         ragno:longitude ?lon .
                FILTER (
                    ABS(?lat - ${lat}) <= ${radiusKm / 111} &&
                    ABS(?lon - ${lon}) <= ${radiusKm / 111}
                )
            `,
            confidence: 0.8,
            normalizedCoordinates: { center, radius: radiusKm }
        };
    }

    createBboxGeographicFilter(geographicFilter, domain, queryContext) {
        const { bbox } = geographicFilter;
        if (!bbox) return { sparqlClause: '', confidence: 0 };
        
        const { minLon, minLat, maxLon, maxLat } = bbox;
        
        return {
            sparqlClause: `
                ?uri ragno:hasLocation ?location .
                ?location ragno:latitude ?lat ;
                         ragno:longitude ?lon .
                FILTER (
                    ?lat >= ${minLat} && ?lat <= ${maxLat} &&
                    ?lon >= ${minLon} && ?lon <= ${maxLon}
                )
            `,
            confidence: 1.0,
            normalizedCoordinates: { bbox }
        };
    }

    createPolygonGeographicFilter(geographicFilter, domain, queryContext) {
        // Simplified polygon filter - in practice would use spatial functions
        const { polygon } = geographicFilter;
        if (!polygon) return { sparqlClause: '', confidence: 0 };
        
        const bounds = this.calculatePolygonBounds(polygon);
        
        return {
            sparqlClause: `
                ?uri ragno:hasLocation ?location .
                ?location ragno:latitude ?lat ;
                         ragno:longitude ?lon .
                FILTER (
                    ?lat >= ${bounds.minLat} && ?lat <= ${bounds.maxLat} &&
                    ?lon >= ${bounds.minLon} && ?lon <= ${bounds.maxLon}
                )
            `,
            confidence: 0.7,
            normalizedCoordinates: { polygon, bounds }
        };
    }

    createAdministrativeGeographicFilter(geographicFilter, domain, queryContext) {
        const administrativeUnits = this.resolveAdministrativeUnits(geographicFilter, domain);
        
        const unitFilters = administrativeUnits.map(unit =>
            `?location ragno:administrativeUnit <${unit}>`
        ).join(' || ');
        
        return {
            sparqlClause: `
                ?uri ragno:hasLocation ?location .
                FILTER (${unitFilters})
            `,
            confidence: 0.9,
            administrativeUnits
        };
    }

    /**
     * Memory domain filtering methods
     */
    applyMemoryDomainFilter(domains, queryContext) {
        const domainArray = Array.isArray(domains) ? domains : [domains];
        const activeMemoryDomains = this.resolveActiveMemoryDomains(domainArray);
        
        // Build memory domain specific filters
        const memoryFilters = [];
        
        if (this.config.memoryRelevanceThreshold) {
            memoryFilters.push(this.memoryFilters.relevanceThreshold(activeMemoryDomains, queryContext));
        }
        
        if (this.config.hierarchicalDomains) {
            memoryFilters.push(this.memoryFilters.domainHierarchy(activeMemoryDomains, queryContext));
        }
        
        if (this.config.domainFadeSupport) {
            memoryFilters.push(this.memoryFilters.temporalFading(activeMemoryDomains, queryContext));
        }
        
        if (this.config.crossDomainBoost > 1.0) {
            memoryFilters.push(this.memoryFilters.crossDomainBoost(activeMemoryDomains, queryContext));
        }

        // Combine all memory filters
        const combinedFilter = this.combineMemoryFilters(memoryFilters);
        
        return {
            query: combinedFilter.query,
            metadata: {
                type: 'memory_domain',
                domains: activeMemoryDomains,
                filterStrategies: memoryFilters.map(f => f.strategy),
                selectivity: this.estimateMemorySelectivity(activeMemoryDomains),
                relevanceThreshold: this.config.memoryRelevanceThreshold
            }
        };
    }

    createRelevanceThresholdFilter(domains, queryContext) {
        const threshold = this.config.memoryRelevanceThreshold;
        
        return {
            strategy: 'relevance_threshold',
            query: {
                sparqlClause: `
                    ?memory zpt:relevanceScore ?relevance .
                    FILTER (?relevance >= ${threshold})
                `,
                confidence: 0.9
            }
        };
    }

    createDomainHierarchyFilter(domains, queryContext) {
        const hierarchyClause = this.buildDomainHierarchyClause(domains);
        
        return {
            strategy: 'domain_hierarchy',
            query: {
                sparqlClause: hierarchyClause,
                confidence: 0.8
            }
        };
    }

    createTemporalFadingFilter(domains, queryContext) {
        const now = Date.now();
        const fadeClause = domains.map(domain => {
            const domainType = this.extractDomainType(domain);
            const config = this.memoryDomainTypes[domainType];
            if (!config || config.fadingStrategy === 'none') return '';
            
            const halfLife = config.decayHalfLife;
            if (halfLife === Infinity) return '';
            
            return `
                {
                    ?memory zpt:belongsToDomain <${domain}> ;
                           dcterms:created ?created .
                    BIND (${now} - ?created AS ?age)
                    BIND (EXP(-?age / ${halfLife}) AS ?decayFactor)
                    FILTER (?decayFactor > 0.01)
                }
            `;
        }).filter(clause => clause).join(' UNION ');
        
        return {
            strategy: 'temporal_fading',
            query: {
                sparqlClause: fadeClause || '',
                confidence: 0.7
            }
        };
    }

    createCrossDomainBoostFilter(domains, queryContext) {
        const boostFactor = this.config.crossDomainBoost;
        const crossDomainClause = `
            {
                ?memory zpt:belongsToDomain ?domain1 ;
                       zpt:belongsToDomain ?domain2 .
                FILTER (?domain1 != ?domain2)
                BIND (${boostFactor} AS ?crossDomainBoost)
            }
        `;
        
        return {
            strategy: 'cross_domain_boost',
            query: {
                sparqlClause: crossDomainClause,
                confidence: 0.6
            }
        };
    }

    resolveActiveMemoryDomains(domains) {
        return domains.map(domain => {
            if (typeof domain === 'string' && domain.includes(':')) {
                return domain; // Already properly formatted
            }
            return `http://purl.org/stuff/domains/${domain}`;
        });
    }

    extractDomainType(domainURI) {
        const parts = domainURI.split('/');
        const lastPart = parts[parts.length - 1];
        return lastPart.split(':')[0];
    }

    buildDomainHierarchyClause(domains) {
        const hierarchyClauses = domains.map(domain => {
            const domainType = this.extractDomainType(domain);
            const config = this.memoryDomainTypes[domainType];
            
            if (!config || !config.inheritanceRules.length) {
                return `?memory zpt:belongsToDomain <${domain}> .`;
            }
            
            const inheritanceClauses = config.inheritanceRules.map(inheritedType => 
                `?memory zpt:belongsToDomain ?${inheritedType}Domain .
                 ?${inheritedType}Domain zpt:inheritsFrom <${domain}> .`
            ).join('\n                 ');
            
            return `
                {
                    ?memory zpt:belongsToDomain <${domain}> .
                } UNION {
                    ${inheritanceClauses}
                }
            `;
        }).join(' UNION ');
        
        return hierarchyClauses;
    }

    combineMemoryFilters(memoryFilters) {
        const nonEmptyFilters = memoryFilters.filter(f => f.query.sparqlClause.trim());
        
        if (nonEmptyFilters.length === 0) {
            return { query: { sparqlClause: '', confidence: 1.0 } };
        }
        
        const combinedClause = nonEmptyFilters.map(f => `{ ${f.query.sparqlClause} }`).join(' ');
        const avgConfidence = nonEmptyFilters.reduce((sum, f) => sum + f.query.confidence, 0) / nonEmptyFilters.length;
        
        return {
            query: {
                sparqlClause: combinedClause,
                confidence: avgConfidence
            }
        };
    }

    buildMemoryDomainContext(domains) {
        if (!domains) return null;
        
        const domainArray = Array.isArray(domains) ? domains : [domains];
        const context = {};
        
        domainArray.forEach(domain => {
            const domainType = this.extractDomainType(domain);
            const config = this.memoryDomainTypes[domainType];
            
            if (config) {
                context[domainType] = {
                    priority: config.priority,
                    baseRelevance: config.baseRelevance,
                    fadingStrategy: config.fadingStrategy,
                    alwaysVisible: config.alwaysVisible || false
                };
            }
        });
        
        return context;
    }

    estimateMemorySelectivity(domains) {
        // Base selectivity on domain types and priorities
        let selectivity = 0.5;
        
        domains.forEach(domain => {
            const domainType = this.extractDomainType(domain);
            const config = this.memoryDomainTypes[domainType];
            
            if (config) {
                // Higher priority domains are more selective
                const priorityFactor = config.priority / 15; // Normalize to 0-1
                selectivity *= (1 - priorityFactor * 0.3);
            }
        });
        
        return Math.max(0.1, selectivity);
    }

    /**
     * Domain detection methods
     */
    detectTopicDomain(value, namespace) {
        for (const [domain, patterns] of Object.entries(this.domainPatterns)) {
            if (patterns.topicPrefixes.some(prefix => value.startsWith(prefix))) {
                return domain;
            }
            if (namespace && patterns.topicPrefixes.some(prefix => namespace.includes(prefix))) {
                return domain;
            }
        }
        return null;
    }

    detectEntityDomain(values) {
        // Simple heuristic - could be enhanced with entity type analysis
        const sampleValue = values[0] || '';
        if (sampleValue.includes('person') || sampleValue.includes('people')) return 'social';
        if (sampleValue.includes('place') || sampleValue.includes('location')) return 'geographic';
        if (sampleValue.includes('gene') || sampleValue.includes('protein')) return 'scientific';
        return null;
    }

    detectTemporalDomain(temporalFilter) {
        const { durationDays } = temporalFilter;
        if (durationDays > 365) return { granularity: 'year' };
        if (durationDays > 30) return { granularity: 'month' };
        if (durationDays > 1) return { granularity: 'day' };
        return { granularity: 'hour' };
    }

    detectGeographicDomain(geographicFilter) {
        if (geographicFilter.administrativeUnit) return { administrative: true };
        if (geographicFilter.bbox && this.calculateGeographicArea(geographicFilter) > 10000) {
            return { scale: 'country' };
        }
        return { scale: 'local' };
    }

    /**
     * Helper methods for pattern generation and expansion
     */
    generateFuzzyPatterns(value) {
        const patterns = [value];
        
        // Add common variations
        patterns.push(value.replace(/s$/, '')); // Remove plural
        patterns.push(value + 's'); // Add plural
        patterns.push(value.replace(/y$/, 'ies')); // y to ies
        patterns.push(value.replace(/ies$/, 'y')); // ies to y
        
        return patterns;
    }

    expandTopicSemantically(value, domain) {
        // Simple semantic expansion - could use word embeddings
        const expansions = [];
        
        if (domain === 'scientific') {
            if (value.includes('gene')) expansions.push('protein', 'DNA', 'sequence');
            if (value.includes('cell')) expansions.push('tissue', 'organ', 'biology');
        }
        
        if (domain === 'geographic') {
            if (value.includes('city')) expansions.push('urban', 'municipality', 'town');
            if (value.includes('country')) expansions.push('nation', 'state', 'territory');
        }
        
        return expansions;
    }

    buildTopicHierarchy(value, domain) {
        // Build hierarchical topic structure
        const hierarchy = [[value]]; // Start with the original term
        
        if (domain) {
            const patterns = this.domainPatterns[domain];
            if (patterns && patterns.entityTypes) {
                hierarchy.push(patterns.entityTypes);
            }
        }
        
        return hierarchy;
    }

    findRelatedEntities(values, domain) {
        // Placeholder for entity relationship resolution
        // In practice, would query the knowledge graph
        return [];
    }

    findTransitiveEntities(values, domain) {
        // Placeholder for transitive entity resolution
        return [];
    }

    inferEntityTypes(values, domain) {
        // Infer entity types from domain and values
        if (domain && this.domainPatterns[domain]) {
            return this.domainPatterns[domain].entityTypes;
        }
        return ['Entity']; // Default type
    }

    generatePeriodicIntervals(start, end, domain) {
        // Generate periodic intervals based on domain granularity
        const intervals = [];
        const startDate = new Date(start);
        const endDate = new Date(end);
        const granularity = domain?.granularity || 'day';
        
        let current = new Date(startDate);
        while (current < endDate) {
            const next = new Date(current);
            
            switch (granularity) {
                case 'year':
                    next.setFullYear(current.getFullYear() + 1);
                    break;
                case 'month':
                    next.setMonth(current.getMonth() + 1);
                    break;
                case 'day':
                default:
                    next.setDate(current.getDate() + 1);
                    break;
            }
            
            intervals.push({
                start: current.toISOString(),
                end: Math.min(next.getTime(), endDate.getTime()) === next.getTime() ? 
                    next.toISOString() : endDate.toISOString()
            });
            
            current = next;
        }
        
        return intervals;
    }

    calculatePolygonBounds(polygon) {
        // Calculate bounding box for polygon
        const lats = polygon.map(p => p.lat);
        const lons = polygon.map(p => p.lon);
        
        return {
            minLat: Math.min(...lats),
            maxLat: Math.max(...lats),
            minLon: Math.min(...lons),
            maxLon: Math.max(...lons)
        };
    }

    calculateGeographicArea(geographicFilter) {
        if (geographicFilter.bbox) {
            const { minLon, minLat, maxLon, maxLat } = geographicFilter.bbox;
            return (maxLon - minLon) * (maxLat - minLat);
        }
        
        if (geographicFilter.radius) {
            return Math.PI * geographicFilter.radius * geographicFilter.radius;
        }
        
        return 0;
    }

    resolveAdministrativeUnits(geographicFilter, domain) {
        // Placeholder for administrative unit resolution
        return [];
    }

    /**
     * Selectivity estimation methods
     */
    estimateTopicSelectivity(topicFilter, domain) {
        const baseSelectivity = 0.3;
        if (topicFilter.pattern === 'wildcard') return baseSelectivity * 1.5;
        if (domain) return baseSelectivity * 0.7;
        return baseSelectivity;
    }

    estimateEntitySelectivity(entityFilter, domain) {
        const baseSelectivity = 0.2;
        return baseSelectivity / Math.log(entityFilter.values.length + 1);
    }

    estimateTemporalSelectivity(temporalFilter, domain) {
        const { durationDays } = temporalFilter;
        if (!durationDays) return 0.5;
        
        // Assume corpus spans 5 years
        const corpusSpanDays = 5 * 365;
        return Math.min(1.0, durationDays / corpusSpanDays);
    }

    estimateGeographicSelectivity(geographicFilter, domain) {
        const area = this.calculateGeographicArea(geographicFilter);
        // Normalize against world area (approximation)
        const worldArea = 360 * 180; // degrees
        return Math.min(1.0, area / worldArea);
    }

    calculateSelectivity(appliedFilters) {
        // Calculate combined selectivity of all filters
        return appliedFilters.reduce((product, filter) => {
            return product * (filter.selectivity || 0.5);
        }, 1.0);
    }

    /**
     * Get filter configuration for documentation
     */
    getFilterDocumentation() {
        return {
            strategies: Object.keys(this.filterStrategies),
            domains: Object.keys(this.domainPatterns),
            config: this.config,
            estimatedSelectivity: {
                topic: 0.3,
                entity: 0.2,
                temporal: 0.4,
                geographic: 0.3
            }
        };
    }
}