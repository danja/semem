/**
 * Builds SPARQL queries and filters from normalized ZPT parameters
 */
export default class FilterBuilder {
    constructor(options = {}) {
        this.graphName = options.graphName || 'http://hyperdata.it/content';
        this.initializeNamespaces();
        this.initializeQueryTemplates();
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
     * Initialize SPARQL query templates for different zoom levels
     */
    initializeQueryTemplates() {
        this.templates = {
            entity: `
                SELECT DISTINCT ?uri ?label ?type ?prefLabel ?embedding ?metadata
                WHERE {
                    GRAPH <${this.graphName}> {
                        {
                            ?uri a ragno:Entity ;
                                 rdfs:label ?label ;
                                 rdf:type ?type .
                            OPTIONAL { ?uri skos:prefLabel ?prefLabel }
                            OPTIONAL { ?uri semem:embedding ?embedding }
                            OPTIONAL { ?uri semem:metadata ?metadata }
                        }
                        UNION
                        {
                            ?uri a semem:Interaction ;
                                 semem:prompt ?label .
                            OPTIONAL { ?uri semem:output ?prefLabel }
                            OPTIONAL { ?uri semem:embedding ?embedding }
                            OPTIONAL { ?uri semem:metadata ?metadata }
                            BIND("interaction" AS ?type)
                        }
                        {{FILTERS}}
                    }
                }
                {{ORDER_BY}}
                {{LIMIT}}
            `,
            unit: `
                SELECT DISTINCT ?uri ?content ?entity ?unit ?embedding ?metadata
                WHERE {
                    GRAPH <${this.graphName}> {
                        {
                            ?uri a ragno:SemanticUnit ;
                                 ragno:hasContent ?content .
                            OPTIONAL { ?uri ragno:relatedTo ?entity }
                            OPTIONAL { ?uri ragno:partOf ?unit }
                            OPTIONAL { ?uri semem:embedding ?embedding }
                            OPTIONAL { ?uri semem:metadata ?metadata }
                        }
                        UNION
                        {
                            ?uri a semem:Interaction .
                            {
                                ?uri semem:prompt ?content .
                            } UNION {
                                ?uri semem:output ?content .
                            }
                            OPTIONAL { ?uri semem:embedding ?embedding }
                            OPTIONAL { ?uri semem:metadata ?metadata }
                            BIND("memory" AS ?entity)
                            BIND("interaction" AS ?unit)
                        }
                        {{FILTERS}}
                    }
                }
                {{ORDER_BY}}
                {{LIMIT}}
            `,
            text: `
                SELECT DISTINCT ?uri ?text ?source ?position ?embedding ?metadata
                WHERE {
                    GRAPH <${this.graphName}> {
                        {
                            ?uri a ragno:TextElement ;
                                 ragno:hasText ?text .
                            OPTIONAL { ?uri ragno:sourceDocument ?source }
                            OPTIONAL { ?uri ragno:position ?position }
                            OPTIONAL { ?uri semem:embedding ?embedding }
                            OPTIONAL { ?uri semem:metadata ?metadata }
                        }
                        UNION
                        {
                            ?uri a semem:Interaction .
                            {
                                ?uri semem:prompt ?text .
                            } UNION {
                                ?uri semem:output ?text .
                            }
                            OPTIONAL { ?uri semem:embedding ?embedding }
                            OPTIONAL { ?uri semem:metadata ?metadata }
                            BIND("memory" AS ?source)
                            BIND(0 AS ?position)
                        }
                        {{FILTERS}}
                    }
                }
                {{ORDER_BY}}
                {{LIMIT}}
            `,
            community: `
                SELECT DISTINCT ?uri ?label ?description ?members ?metadata
                WHERE {
                    GRAPH <${this.graphName}> {
                        ?uri a ragno:Community ;
                             rdfs:label ?label .
                        OPTIONAL { ?uri rdfs:comment ?description }
                        OPTIONAL { ?uri ragno:hasMember ?members }
                        OPTIONAL { ?uri semem:metadata ?metadata }
                        {{FILTERS}}
                    }
                }
                {{ORDER_BY}}
                {{LIMIT}}
            `,
            corpus: `
                SELECT DISTINCT ?uri ?label ?description ?created ?modified
                WHERE {
                    GRAPH <${this.graphName}> {
                        ?uri a ragno:Corpus ;
                             rdfs:label ?label .
                        OPTIONAL { ?uri rdfs:comment ?description }
                        OPTIONAL { ?uri dcterms:created ?created }
                        OPTIONAL { ?uri dcterms:modified ?modified }
                        {{FILTERS}}
                    }
                }
                {{ORDER_BY}}
                {{LIMIT}}
            `
        };
    }

    /**
     * Build complete SPARQL query from normalized parameters
     * @param {Object} normalizedParams - Normalized ZPT parameters
     * @returns {Object} Query configuration
     */
    buildQuery(normalizedParams) {
        const zoomLevel = normalizedParams.zoom.level;
        const template = this.templates[zoomLevel];
        
        if (!template) {
            throw new Error(`Unsupported zoom level: ${zoomLevel}`);
        }

        // Build filter clauses
        const filters = this.buildFilters(normalizedParams.pan);
        const orderBy = this.buildOrderBy(normalizedParams.tilt);
        const limit = this.buildLimit(normalizedParams.transform);

        // Substitute placeholders
        const query = this.prefixes + template
            .replace('{{FILTERS}}', filters)
            .replace('{{ORDER_BY}}', orderBy)
            .replace('{{LIMIT}}', limit);

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

        // Topic filter
        if (panParams.topic) {
            filterClauses.push(this.buildTopicFilter(panParams.topic));
        }

        // Entity filter
        if (panParams.entity) {
            filterClauses.push(this.buildEntityFilter(panParams.entity));
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
     * Build topic filter clause
     */
    buildTopicFilter(topicFilter) {
        const { value, pattern } = topicFilter;

        if (pattern === 'wildcard') {
            const regexPattern = value.replace(/\*/g, '.*');
            return `
                FILTER (REGEX(STR(?label), "${regexPattern}", "i") || 
                        REGEX(STR(?prefLabel), "${regexPattern}", "i"))
            `;
        } else {
            return `
                FILTER (CONTAINS(LCASE(STR(?label)), "${value}") || 
                        CONTAINS(LCASE(STR(?prefLabel)), "${value}"))
            `;
        }
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
                FILTER (ABS(?lat - ${lat}) <= ${radius/111} && 
                        ABS(?lon - ${lon}) <= ${radius/111})
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
    buildSimilarityQuery(normalizedParams, queryEmbedding) {
        if (normalizedParams.tilt.representation !== 'embedding') {
            throw new Error('Similarity query only supported for embedding tilt');
        }

        const baseQuery = this.buildQuery(normalizedParams);
        
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
    buildAggregationQuery(normalizedParams) {
        if (normalizedParams.zoom.level !== 'community') {
            return this.buildQuery(normalizedParams);
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