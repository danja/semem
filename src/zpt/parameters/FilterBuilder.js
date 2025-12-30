/**
 * Builds SPARQL queries and filters from normalized ZPT parameters
 */
import fs from 'fs';
import path from 'path';
import SPARQLTemplateLoader from '../../stores/SPARQLTemplateLoader.js';
import { createUnifiedLogger } from '../../utils/LoggingConfig.js';

export default class FilterBuilder {
    constructor(options = {}) {
        this.logger = createUnifiedLogger('FilterBuilder');
        this.graphName = options.graphName;
        this.templateCache = new Map(); // Cache for loaded templates
        this.templateLoader = new SPARQLTemplateLoader();
        this.templates = {}; // Initialize templates object for concept queries
        this.initializeNamespaces();
        this.loadConceptQueries();
    }

    /**
     * Initialize namespace prefixes for SPARQL queries
     */
    initializeNamespaces() {
        this.prefixes = `
            PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
            PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
            PREFIX owl: <http://www.w3.org/2002/07/owl#>
            PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
            PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
            PREFIX prov: <http://www.w3.org/ns/prov#>
            PREFIX dcterms: <http://purl.org/dc/terms/>
            PREFIX ragno: <http://purl.org/stuff/ragno/>
            PREFIX semem: <http://purl.org/stuff/semem/>
        `;
    }

    /**
     * Get SPARQL query template for the specified zoom level
     * @param {string} zoomLevel - The zoom level (entity, unit, text, community, corpus)
     * @returns {Promise<string>} The template content
     */
    async getQueryTemplate(zoomLevel) {
        try {
            const template = await this.templateLoader.loadAndInterpolate('zpt', `filter-${zoomLevel}`, {
                graphName: this.graphName
            });

            if (!template) {
                throw new Error(`Missing SPARQL template: filter-${zoomLevel}`);
            }

            return template;
        } catch (error) {
            this.logger.error('Failed to load ZPT filter template', {
                zoomLevel,
                error: error.message
            });
            throw new Error(`Failed to load ZPT filter template for ${zoomLevel}: ${error.message}`);
        }
    }

    /**
     * Load concept-specific SPARQL query templates from external files
     */
    loadConceptQueries() {
        try {
            const templateDir = path.join(process.cwd(), 'sparql', 'queries', 'zpt');

            // Load concept extraction template
            const conceptExtractionPath = path.join(templateDir, 'concept-extraction.sparql');
            if (!fs.existsSync(conceptExtractionPath)) {
                throw new Error(`Missing template file: ${conceptExtractionPath}`);
            }
            this.templates.conceptExtraction = fs.readFileSync(conceptExtractionPath, 'utf8');
            this.templateCache.set('concept-extraction', this.templates.conceptExtraction);

            // Load concept navigation template  
            const conceptNavigationPath = path.join(templateDir, 'concept-navigation.sparql');
            if (!fs.existsSync(conceptNavigationPath)) {
                throw new Error(`Missing template file: ${conceptNavigationPath}`);
            }
            this.templates.conceptNavigation = fs.readFileSync(conceptNavigationPath, 'utf8');
            this.templateCache.set('concept-navigation', this.templates.conceptNavigation);

            // Load concept relationships template
            const conceptRelationshipsPath = path.join(templateDir, 'concept-relationships.sparql');
            if (!fs.existsSync(conceptRelationshipsPath)) {
                throw new Error(`Missing template file: ${conceptRelationshipsPath}`);
            }
            this.templates.conceptRelationships = fs.readFileSync(conceptRelationshipsPath, 'utf8');
            this.templateCache.set('concept-relationships', this.templates.conceptRelationships);

        } catch (error) {
            this.logger.error('Failed to load concept query templates', { error: error.message });
            throw new Error(`Failed to load concept query templates: ${error.message}`);
        }
    }

    /**
     * Build complete SPARQL query from normalized parameters
     * @param {Object} normalizedParams - Normalized ZPT parameters
     * @returns {Promise<Object>} Query configuration
     */
    async buildQuery(normalizedParams) {
        const zoomLevel = normalizedParams.zoom.level;
        const template = await this.getQueryTemplate(zoomLevel);

        if (!template) {
            throw new Error(`Unsupported zoom level: ${zoomLevel}`);
        }

        // Build filter clauses
        const filters = this.buildFilters(normalizedParams.pan);
        const orderBy = this.buildOrderBy(normalizedParams.tilt);
        const limit = this.buildLimit(normalizedParams.transform);

        // Substitute placeholders - use consistent naming with templates
        const query = this.prefixes + template
            .replace('{{filters}}', filters)
            .replace('{{orderBy}}', orderBy)
            .replace('{{limit}}', limit);

        return {
            query,
            zoomLevel,
            filters: normalizedParams.pan,
            tilt: normalizedParams.tilt,
            metadata: {
                complexity: normalizedParams._metadata.complexity,
                estimatedResults: this.estimateResults(normalizedParams),
                cacheKey: this.buildCacheKey(normalizedParams)
            }
        };
    }

    /**
     * Build filter clauses from pan parameters
     */
    buildFilters(panParams) {
        const filterClauses = [];

        // Domain filter
        if (panParams.domains) {
            filterClauses.push(this.buildDomainFilter(panParams.domains));
        }

        // Keyword filter
        if (panParams.keywords) {
            filterClauses.push(this.buildKeywordFilter(panParams.keywords));
        }

        // Entity filter
        if (panParams.entities) {
            filterClauses.push(this.buildEntityFilter(panParams.entities));
        }

        // Corpuscle filter
        if (panParams.corpuscle) {
            filterClauses.push(this.buildCorpuscleFilter(panParams.corpuscle));
        }

        // Temporal filter
        if (panParams.temporal) {
            filterClauses.push(this.buildTemporalFilter(panParams.temporal));
        }

        // Geographic filter
        if (panParams.geographic) {
            filterClauses.push(this.buildGeographicFilter(panParams.geographic));
        }

        return filterClauses.length > 0 ? filterClauses.join(' ') : '';
    }

    /**
     * Build concept-based query using external templates
     */
    buildConceptQuery(normalizedParams) {
        const template = this.templates.conceptExtraction || this.templates.conceptNavigation;

        if (!template) {
            throw new Error('Concept templates not loaded');
        }

        // Build concept-specific filters
        const conceptFilters = this.buildConceptFilters(normalizedParams.pan);
        const panFilters = this.buildFilters(normalizedParams.pan);
        const similarityFilters = this.buildSimilarityFilters(normalizedParams);

        // Substitute placeholders in template
        const query = this.prefixes + template
            .replace(/\${graphName}/g, this.graphName)
            .replace('{{CONCEPT_FILTERS}}', conceptFilters)
            .replace('{{PAN_FILTERS}}', panFilters)
            .replace('{{SIMILARITY_FILTERS}}', similarityFilters)
            .replace(/\${maxResults}/g, normalizedParams.transform?.limit || 100);

        return {
            query,
            zoomLevel: 'unit',
            filters: normalizedParams.pan,
            tilt: normalizedParams.tilt,
            metadata: {
                complexity: 'concept-based',
                type: 'concept-extraction',
                cacheKey: this.buildCacheKey(normalizedParams, 'unit')
            }
        };
    }

    /**
     * Build domain filter clause
     */
    buildDomainFilter(domainFilter) {
        const values = domainFilter.values || [];
        if (values.length === 0) return '';

        const clauses = values.map(value => `
            (CONTAINS(LCASE(STR(?label)), "${value.toLowerCase()}") || 
             CONTAINS(LCASE(STR(?prefLabel)), "${value.toLowerCase()}"))
        `);

        return `FILTER (${clauses.join(' || ')})`;
    }

    /**
     * Build keyword filter clause
     */
    buildKeywordFilter(keywordFilter) {
        const values = keywordFilter.values || [];
        if (values.length === 0) return '';

        const clauses = values.map(value => `
            (CONTAINS(LCASE(STR(?label)), "${value.toLowerCase()}") || 
             CONTAINS(LCASE(STR(?prefLabel)), "${value.toLowerCase()}"))
        `);

        return `FILTER (${clauses.join(' || ')})`;
    }

    /**
     * Build entity filter clause
     */
    buildEntityFilter(entityFilter) {
        const { values, type } = entityFilter;

        if (type === 'single') {
            return `FILTER (?uri = <${values[0]}> || ?entity = <${values[0]}>)`;
        } else {
            const uriList = values.map(v => `<${v}>`).join(', ');
            return `FILTER (?uri IN (${uriList}) || ?entity IN (${uriList}))`;
        }
    }

    /**
     * Build corpuscle filter clause
     */
    buildCorpuscleFilter(corpuscleFilter) {
        const { values, type } = corpuscleFilter;

        if (type === 'single') {
            return `?uri ragno:inCorpuscle <${values[0]}> .`;
        }

        const uriList = values.map(v => `<${v}>`).join(', ');
        return `?uri ragno:inCorpuscle ?corpuscle . FILTER (?corpuscle IN (${uriList}))`;
    }

    /**
     * Build temporal filter clause
     */
    buildTemporalFilter(temporalFilter) {
        const filterClauses = [];

        if (temporalFilter.start) {
            filterClauses.push(`?uri dcterms:created ?created`);
            filterClauses.push(`FILTER (?created >= "${temporalFilter.start}"^^xsd:dateTime)`);
        }

        if (temporalFilter.end) {
            if (!temporalFilter.start) {
                filterClauses.push(`?uri dcterms:created ?created`);
            }
            filterClauses.push(`FILTER (?created <= "${temporalFilter.end}"^^xsd:dateTime)`);
        }

        return filterClauses.join(' . ');
    }

    /**
     * Build geographic filter clause
     */
    buildGeographicFilter(geographicFilter) {
        const filterClauses = [];

        // Add geographic properties to query
        filterClauses.push(`
            OPTIONAL { 
                ?uri ragno:hasLocation ?location .
                ?location ragno:latitude ?lat ;
                         ragno:longitude ?lon 
            }
        `);

        if (geographicFilter.bbox) {
            const { minLon, minLat, maxLon, maxLat } = geographicFilter.bbox;
            filterClauses.push(`
                FILTER (?lat >= ${minLat} && ?lat <= ${maxLat} && 
                        ?lon >= ${minLon} && ?lon <= ${maxLon})
            `);
        }

        if (geographicFilter.center && geographicFilter.radius) {
            const { lat, lon } = geographicFilter.center;
            const radius = geographicFilter.radius;
            // Approximate distance filter (not precise, but sufficient for basic filtering)
            filterClauses.push(`
                FILTER (ABS(?lat - ${lat}) <= ${radius / 111} && 
                        ABS(?lon - ${lon}) <= ${radius / 111})
            `);
        }

        return filterClauses.join(' ');
    }

    /**
     * Build concept filter clause
     */
    buildConceptFilter(conceptFilter) {
        const { concepts, mode = 'any' } = conceptFilter;

        if (!concepts || concepts.length === 0) {
            return '';
        }

        const conceptUris = concepts.map(c => typeof c === 'string' ? c : c.uri);
        const filterClauses = [];

        if (mode === 'any') {
            // Entity must be related to at least one of the specified concepts
            filterClauses.push(`
                ?uri ragno:hasConceptualRelation ?concept .
                ?concept rdfs:label ?conceptLabel .
                FILTER (?concept IN (${conceptUris.map(c => `<${c}>`).join(', ')}) ||
                        ?conceptLabel IN (${concepts.map(c => `"${typeof c === 'string' ? c : c.label}"`).join(', ')}))
            `);
        } else if (mode === 'all') {
            // Entity must be related to all specified concepts (more restrictive)
            concepts.forEach((concept, index) => {
                const conceptVar = `?concept${index}`;
                filterClauses.push(`
                    ?uri ragno:hasConceptualRelation ${conceptVar} .
                    ${conceptVar} rdfs:label "${typeof concept === 'string' ? concept : concept.label}" .
                `);
            });
        }

        return filterClauses.join(' ');
    }

    /**
     * Build concept-specific filters for concept extraction queries
     */
    buildConceptFilters(panParams) {
        const filterClauses = [];

        if (panParams.conceptCategory) {
            filterClauses.push(`FILTER (?type = ragno:${panParams.conceptCategory})`);
        }

        if (panParams.minConfidence) {
            filterClauses.push(`FILTER (?confidence >= ${panParams.minConfidence})`);
        }

        if (panParams.conceptDomains) {
            const domains = panParams.conceptDomains.map(d => `"${d}"`).join(', ');
            filterClauses.push(`
                ?concept ragno:belongsToDomain ?domain .
                FILTER (?domain IN (${domains}))
            `);
        }

        return filterClauses.join(' ');
    }

    /**
     * Build similarity filters for concept matching
     */
    buildSimilarityFilters(normalizedParams) {
        const filterClauses = [];
        const threshold = normalizedParams.similarity?.threshold;

        if (threshold && normalizedParams.tilt?.representation === 'embedding') {
            filterClauses.push(`
                OPTIONAL { 
                    ?concept ragno:hasEmbedding ?embeddingResource .
                    ?embeddingResource ragno:similarityScore ?simScore 
                }
                FILTER (!BOUND(?simScore) || ?simScore >= ${threshold})
            `);
        }

        return filterClauses.join(' ');
    }

    /**
     * Build ORDER BY clause based on tilt representation
     */
    buildOrderBy(tiltParams) {
        const { representation } = tiltParams;

        switch (representation) {
            case 'temporal':
                return 'ORDER BY DESC(?created)';
            case 'embedding':
                return 'ORDER BY ?uri'; // Will be overridden by similarity search
            case 'keywords':
                return 'ORDER BY ?label';
            case 'graph':
                return 'ORDER BY DESC(?uri)'; // Graph structure ordering
            default:
                return 'ORDER BY ?uri';
        }
    }

    /**
     * Build LIMIT clause based on transform parameters
     */
    buildLimit(transformParams) {
        // Estimate results based on token budget
        const tokenBudget = transformParams.tokenBudget.content;
        const estimatedTokensPerItem = 50; // Conservative estimate
        const maxResults = Math.min(
            Math.floor(tokenBudget / estimatedTokensPerItem),
            1000 // Hard limit
        );

        return `LIMIT ${maxResults}`;
    }

    /**
     * Build similarity search query for embedding-based tilt
     */
    async buildSimilarityQuery(normalizedParams, queryEmbedding) {
        if (normalizedParams.tilt.representation !== 'embedding') {
            throw new Error('Similarity query only supported for embedding tilt');
        }

        const baseQuery = await this.buildQuery(normalizedParams);

        // Add similarity computation
        const similarityQuery = `
            ${this.prefixes}
            SELECT ?uri ?label ?similarity ?embedding ?metadata
            WHERE {
                {
                    ${baseQuery.query.replace(this.prefixes, '').replace(/SELECT.*WHERE/, 'SELECT DISTINCT ?uri ?label ?embedding ?metadata WHERE')}
                }
                BIND(semem:cosineSimilarity(?embedding, "${queryEmbedding}") AS ?similarity)
                FILTER(?similarity > 0.1)
            }
            ORDER BY DESC(?similarity)
            LIMIT ${this.extractLimit(baseQuery.query)}
        `;

        return {
            ...baseQuery,
            query: similarityQuery,
            similarity: true,
            threshold: 0.1
        };
    }

    /**
     * Build aggregation query for community-level zoom
     */
    async buildAggregationQuery(normalizedParams) {
        if (normalizedParams.zoom.level !== 'community') {
            return await this.buildQuery(normalizedParams);
        }

        const aggregationQuery = `
            ${this.prefixes}
            SELECT ?community ?label ?memberCount ?avgSimilarity
            WHERE {
                GRAPH <${this.graphName}> {
                    ?community a ragno:Community ;
                               rdfs:label ?label .
                    {
                        SELECT ?community (COUNT(?member) AS ?memberCount) 
                               (AVG(?similarity) AS ?avgSimilarity)
                        WHERE {
                            ?community ragno:hasMember ?member .
                            OPTIONAL { ?member semem:similarity ?similarity }
                            ${this.buildFilters(normalizedParams.pan)}
                        }
                        GROUP BY ?community
                    }
                }
            }
            ORDER BY DESC(?memberCount)
            ${this.buildLimit(normalizedParams.transform)}
        `;

        return {
            query: aggregationQuery,
            zoomLevel: 'community',
            aggregated: true,
            filters: normalizedParams.pan
        };
    }

    /**
     * Extract LIMIT value from query string
     */
    extractLimit(query) {
        const limitMatch = query.match(/LIMIT\s+(\d+)/i);
        return limitMatch ? limitMatch[1] : '100';
    }

    /**
     * Estimate number of results based on complexity
     */
    estimateResults(normalizedParams) {
        const complexity = normalizedParams._metadata.complexity;
        const baseEstimate = 1000;

        // Reduce estimate based on filters
        const filterReduction = Object.keys(normalizedParams.pan).length * 0.3;
        return Math.floor(baseEstimate * (1 - filterReduction));
    }

    /**
     * Build cache key for query results
     */
    buildCacheKey(normalizedParams) {
        const keyData = {
            zoom: normalizedParams.zoom.level,
            pan: normalizedParams.pan,
            tilt: normalizedParams.tilt.representation,
            tokenBudget: normalizedParams.transform.maxTokens
        };

        return this.hashObject(keyData);
    }

    /**
     * Simple hash function for cache keys
     */
    hashObject(obj) {
        const str = JSON.stringify(obj, Object.keys(obj).sort());
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash).toString(36);
    }

    /**
     * Validate that query can be executed
     */
    validateQuery(queryConfig) {
        if (!queryConfig.query || typeof queryConfig.query !== 'string') {
            throw new Error('Invalid query configuration: missing query string');
        }

        if (!queryConfig.zoomLevel) {
            throw new Error('Invalid query configuration: missing zoom level');
        }

        // Basic SPARQL syntax validation
        if (!queryConfig.query.includes('SELECT') || !queryConfig.query.includes('WHERE')) {
            throw new Error('Invalid SPARQL query: missing SELECT or WHERE clause');
        }

        return true;
    }

    /**
     * Get query statistics for optimization
     */
    getQueryStats(queryConfig) {
        const query = queryConfig.query;

        return {
            hasFilters: Object.keys(queryConfig.filters || {}).length > 0,
            hasOptionals: (query.match(/OPTIONAL/g) || []).length,
            hasRegex: query.includes('REGEX'),
            estimatedComplexity: queryConfig.metadata?.complexity || 1,
            estimatedResults: queryConfig.metadata?.estimatedResults || 100
        };
    }
}
