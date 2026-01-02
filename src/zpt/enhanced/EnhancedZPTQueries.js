/**
 * Enhanced ZPT Query Engine with Live SPARQL Filtering
 * 
 * Implements sophisticated ZPT navigation using proper ragno.ttl vocabulary
 * with live SPARQL-based filtering for all zoom/pan/tilt combinations
 */

import logger from 'loglevel';

export class EnhancedZPTQueries {
    constructor(options = {}) {
        this.contentGraph = options.contentGraph;
        this.navigationGraph = options.navigationGraph || 'http://purl.org/stuff/navigation';
        this.sessionGraph = options.sessionGraph || 'http://tensegrity.it/semem';
        this.sparqlStore = options.sparqlStore;

        this.prefixes = `
            PREFIX ragno: <http://purl.org/stuff/ragno/>
            PREFIX zpt: <http://purl.org/stuff/zpt/>
            PREFIX semem: <http://purl.org/stuff/semem/>
            PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
            PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
            PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
            PREFIX dcterms: <http://purl.org/dc/terms/>
            PREFIX prov: <http://www.w3.org/ns/prov#>
            PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
        `;
    }

    /**
     * Execute enhanced ZPT navigation with full SPARQL filtering
     */
    async executeNavigation(params) {
        logger.info('🧭 Executing enhanced ZPT navigation with params:', params);

        try {
            // Step 1: Build zoom-level appropriate base query
            const baseQuery = this.buildZoomQuery(params.zoom);

            // Step 2: Apply pan filtering
            const filteredQuery = this.applyPanFiltering(baseQuery, params.pan);

            // Step 3: Apply tilt projection
            const projectedQuery = this.applyTiltProjection(filteredQuery, params.tilt);

            // Step 4: Execute query
            const results = await this.executeQuery(projectedQuery);

            // Step 5: Store navigation metadata
            await this.storeNavigationMetadata(params, results);

            return {
                success: true,
                results: results,
                queryParams: params,
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            logger.error('❌ Enhanced ZPT navigation failed:', error);
            throw error;
        }
    }

    /**
     * Build base query for specific zoom level using ragno vocabulary
     */
    buildZoomQuery(zoomLevel) {
        switch (zoomLevel.toLowerCase()) {
            case 'micro':
                return this.buildMicroZoomQuery();
            case 'entity':
                return this.buildEntityZoomQuery();
            case 'unit':
                return this.buildUnitZoomQuery();
            case 'text':
                return this.buildTextZoomQuery();
            case 'community':
                return this.buildCommunityZoomQuery();
            case 'corpus':
                return this.buildCorpusZoomQuery();
            default:
                throw new Error(`Unsupported zoom level: ${zoomLevel}`);
        }
    }

    /**
     * Micro-level zoom: Focus on ragno:Attribute instances
     */
    buildMicroZoomQuery() {
        return `
            SELECT DISTINCT ?item ?label ?content ?attributeType ?entity WHERE {
                GRAPH <${this.contentGraph}> {
                    ?item a ragno:Attribute .
                    
                    OPTIONAL { ?item rdfs:label ?label }
                    OPTIONAL { ?item ragno:content ?content }
                    OPTIONAL { ?item ragno:subType ?attributeType }
                    OPTIONAL { ?entity ragno:hasAttribute ?item }
                }
            }
            ORDER BY LCASE(STR(?label))
        `;
    }

    /**
     * Entity-level zoom: Focus on ragno:Entity instances and semem:Interaction data
     */
    buildEntityZoomQuery() {
        return `
            SELECT DISTINCT ?item ?label ?content ?type ?isEntryPoint ?frequency WHERE {
                GRAPH <${this.contentGraph}> {
                    {
                        ?item a ragno:Entity ;
                              rdfs:label ?label .
                        
                        OPTIONAL { ?item ragno:content ?content }
                        OPTIONAL { ?item ragno:subType ?type }
                        OPTIONAL { ?item ragno:isEntryPoint ?isEntryPoint }
                        OPTIONAL { ?item ragno:frequency ?frequency }
                    }
                    UNION
                    {
                        ?item a semem:Interaction ;
                              semem:prompt ?label ;
                              semem:output ?content .
                        
                        OPTIONAL { ?item semem:concepts ?concepts }
                        BIND("interaction" AS ?type)
                        BIND(false AS ?isEntryPoint)
                        BIND(1 AS ?frequency)
                    }
                }
            }
            ORDER BY DESC(?frequency) DESC(?isEntryPoint)
        `;
    }

    /**
     * Unit-level zoom: Focus on ragno:Unit instances and semem:Interaction data
     */
    buildUnitZoomQuery() {
        return `
            SELECT DISTINCT ?item ?content ?created ?hasEmbedding ?textElement WHERE {
                GRAPH <${this.contentGraph}> {
                    {
                        ?item a ragno:Unit ;
                              ragno:content ?content .
                        
                        OPTIONAL { ?item dcterms:created ?created }
                        OPTIONAL { ?item ragno:hasEmbedding ?hasEmbedding }
                        OPTIONAL { ?item ragno:hasTextElement ?textElement }
                    }
                    UNION
                    {
                        ?item a semem:Interaction .
                        {
                            ?item semem:prompt ?content .
                        } UNION {
                            ?item semem:output ?content .
                        }
                        
                        OPTIONAL { ?item semem:timestamp ?created }
                        OPTIONAL { ?item semem:embedding ?hasEmbedding }
                    }
                }
            }
            ORDER BY DESC(?created)
        `;
    }

    /**
     * Text-level zoom: Focus on ragno:TextElement instances and semem:Interaction data
     */
    buildTextZoomQuery() {
        return `
            SELECT DISTINCT ?item ?content ?created ?sourceDocument WHERE {
                GRAPH <${this.contentGraph}> {
                    {
                        ?item a ragno:TextElement ;
                              ragno:content ?content .
                        
                        OPTIONAL { ?item dcterms:created ?created }
                        OPTIONAL { ?item ragno:hasSourceDocument ?sourceDocument }
                    }
                    UNION
                    {
                        ?item a semem:Interaction .
                        {
                            ?item semem:prompt ?content .
                        } UNION {
                            ?item semem:output ?content .
                        }
                        
                        OPTIONAL { ?item semem:timestamp ?created }
                        BIND("memory" AS ?sourceDocument)
                    }
                }
            }
            ORDER BY DESC(?created)
        `;
    }

    /**
     * Community-level zoom: Focus on ragno:Community instances
     */
    buildCommunityZoomQuery() {
        return `
            SELECT DISTINCT ?item ?label ?memberCount ?communityElement WHERE {
                GRAPH <${this.contentGraph}> {
                    ?item a ragno:Community .
                    
                    OPTIONAL { ?item skos:prefLabel ?label }
                    OPTIONAL { ?item ragno:hasCommunityElement ?communityElement }
                    OPTIONAL { 
                        SELECT ?item (COUNT(?member) as ?memberCount) WHERE {
                            ?item skos:member ?member .
                        } GROUP BY ?item
                    }
                }
            }
            ORDER BY DESC(?memberCount)
        `;
    }

    /**
     * Corpus-level zoom: Focus on ragno:Corpus instances
     */
    buildCorpusZoomQuery() {
        return `
            SELECT DISTINCT ?item ?label ?description ?elementCount WHERE {
                GRAPH <${this.contentGraph}> {
                    ?item a ragno:Corpus .
                    
                    OPTIONAL { ?item skos:prefLabel ?label }
                    OPTIONAL { ?item dcterms:description ?description }
                    OPTIONAL { 
                        SELECT ?item (COUNT(?element) as ?elementCount) WHERE {
                            ?item ragno:hasElement ?element .
                        } GROUP BY ?item
                    }
                }
            }
            ORDER BY DESC(?elementCount)
        `;
    }

    /**
     * Apply pan filtering using sophisticated SPARQL filters
     */
    applyPanFiltering(baseQuery, panParams) {
        if (!panParams || Object.keys(panParams).length === 0) {
            return baseQuery;
        }

        let filteredQuery = baseQuery;
        const whereClauses = [];
        const filters = [];

        // Domain filtering
        if (panParams.domains && panParams.domains.length > 0) {
            const domainFilters = panParams.domains.map(domain => {
                return `CONTAINS(LCASE(STR(?content)), "${domain.toLowerCase()}")`;
            }).join(' || ');
            filters.push(`(${domainFilters})`);
        }

        // Keyword filtering
        if (panParams.keywords && panParams.keywords.length > 0) {
            const keywordFilters = panParams.keywords.map(keyword => {
                return `(CONTAINS(LCASE(STR(?content)), "${keyword.toLowerCase()}") || CONTAINS(LCASE(STR(?label)), "${keyword.toLowerCase()}"))`;
            }).join(' || ');
            filters.push(`(${keywordFilters})`);
        }

        // Entity filtering
        if (panParams.entities && panParams.entities.length > 0) {
            const entityClause = `
                ?item ragno:connectsTo ?relatedEntity .
                FILTER(?relatedEntity IN (${panParams.entities.map(e => `<${e}>`).join(', ')}))
            `;
            whereClauses.push(entityClause);
        }

        // Temporal filtering
        if (panParams.temporal) {
            if (panParams.temporal.start) {
                filters.push(`?created >= "${panParams.temporal.start}"^^xsd:dateTime`);
            }
            if (panParams.temporal.end) {
                filters.push(`?created <= "${panParams.temporal.end}"^^xsd:dateTime`);
            }
        }

        // Apply filters to query
        if (whereClauses.length > 0 || filters.length > 0) {
            // Insert additional WHERE clauses
            const whereMatch = filteredQuery.match(/WHERE\s*\{/);
            if (whereMatch) {
                const insertPoint = whereMatch.index + whereMatch[0].length;
                const additionalClauses = whereClauses.join('\n                ');
                const filterClauses = filters.length > 0 ? `\nFILTER(${filters.join(' && ')})` : '';

                filteredQuery = filteredQuery.slice(0, insertPoint) +
                    '\n                ' + additionalClauses + filterClauses +
                    filteredQuery.slice(insertPoint);
            }
        }

        return filteredQuery;
    }

    /**
     * Apply tilt projection for different analytical perspectives
     */
    applyTiltProjection(query, tiltStyle) {
        switch (tiltStyle?.toLowerCase()) {
            case 'embedding':
                return this.applyEmbeddingTilt(query);
            case 'graph':
                return this.applyGraphTilt(query);
            case 'temporal':
                return this.applyTemporalTilt(query);
            case 'keywords':
            default:
                return this.applyKeywordTilt(query);
        }
    }

    /**
     * Embedding tilt: Focus on vector similarity
     */
    applyEmbeddingTilt(query) {
        // Add embedding-related fields and ordering
        return query.replace(
            /SELECT DISTINCT (.*?) WHERE/,
            'SELECT DISTINCT $1 ?embedding ?embeddingModel ?dimension WHERE'
        ).replace(
            /GRAPH <[^>]+> \{/,
            `GRAPH <${this.contentGraph}> {
                ?item ragno:hasEmbedding ?embeddingElement .
                ?embeddingElement ragno:vectorContent ?embedding ;
                                 ragno:embeddingModel ?embeddingModel ;
                                 ragno:embeddingDimension ?dimension .`
        );
    }

    /**
     * Graph tilt: Focus on relationships and connectivity
     */
    applyGraphTilt(query) {
        // For graph tilt, we'll use a simpler approach without GROUP BY for now
        return query.replace(
            /ORDER BY[^}]+/,
            'ORDER BY DESC(?frequency) DESC(?isEntryPoint)'
        );
    }

    /**
     * Temporal tilt: Focus on time-based organization
     */
    applyTemporalTilt(query) {
        return query.replace(
            /ORDER BY[^}]+/,
            'ORDER BY DESC(?created) DESC(?modified)'
        );
    }

    /**
     * Keyword tilt: Focus on content analysis
     */
    applyKeywordTilt(query) {
        // Add text analysis fields
        return query.replace(
            /SELECT DISTINCT (.*?) WHERE/,
            'SELECT DISTINCT $1 (STRLEN(?content) as ?contentLength) WHERE'
        ).replace(
            /ORDER BY/,
            'ORDER BY DESC(?contentLength) DESC(?frequency)'
        );
    }

    /**
     * Execute SPARQL query against the store
     */
    async executeQuery(query) {
        const fullQuery = this.prefixes + query + ' LIMIT 50';

        logger.debug('🔍 Executing enhanced ZPT query:', fullQuery);

        const result = await this.sparqlStore._executeSparqlQuery(
            fullQuery,
            this.sparqlStore.endpoint.query
        );

        // Handle different response formats (resilience vs normal)
        if (result && result.results && result.results.bindings) {
            // Direct JSON response from resilience mode
            return result.results.bindings;
        } else if (result && result.success && result.data) {
            // Wrapped response format
            return result.data.results.bindings;
        } else if (result && !result.success) {
            throw new Error(`SPARQL query failed: ${result.error}`);
        } else {
            throw new Error(`SPARQL query failed: unexpected response format`);
        }
    }

    /**
     * Store navigation metadata in navigation graph
     */
    async storeNavigationMetadata(params, results) {
        const sessionURI = `http://purl.org/stuff/instance/session-${Date.now()}`;
        const viewURI = `http://purl.org/stuff/instance/view-${Date.now()}`;
        const queryText = this.escapeSparqlString(params.query || 'Enhanced navigation query');

        const metadataQuery = `
            ${this.prefixes}
            
            INSERT DATA {
                GRAPH <${this.navigationGraph}> {
                    <${sessionURI}> a zpt:NavigationSession ;
                        dcterms:created "${new Date().toISOString()}"^^xsd:dateTime ;
                        prov:wasAssociatedWith <http://example.org/agent/enhanced-zpt> ;
                        zpt:hasPurpose "Enhanced ZPT Navigation" .
                    
                    <${viewURI}> a zpt:NavigationView ;
                        zpt:partOfSession <${sessionURI}> ;
                        zpt:hasQuery "${queryText}" ;
                        zpt:atZoomLevel <http://purl.org/stuff/zpt/${params.zoom}> ;
                        zpt:withTiltProjection <http://purl.org/stuff/zpt/${params.tilt}> ;
                        zpt:resultCount ${results.length} ;
                        dcterms:created "${new Date().toISOString()}"^^xsd:dateTime .
                }
            }
        `;

        const result = await this.sparqlStore._executeSparqlUpdate(metadataQuery, this.sparqlStore.endpoint.update);

        if (!result.success) {
            logger.warn('⚠️  Failed to store navigation metadata:', result.error);
        } else {
            logger.debug('✅ Navigation metadata stored:', { sessionURI, viewURI });
        }
    }

    /**
     * Escape special characters for SPARQL string literals
     */
    escapeSparqlString(value) {
        if (typeof value !== 'string') {
            return String(value ?? '');
        }
        return value
            .replace(/\\/g, '\\\\')
            .replace(/"/g, '\\"')
            .replace(/\n/g, '\\n')
            .replace(/\r/g, '\\r')
            .replace(/\t/g, '\\t');
    }

    /**
     * Get available content statistics for zoom level
     */
    async getContentStats(zoomLevel) {
        const statsQuery = `
            ${this.prefixes}
            
            SELECT (COUNT(?item) as ?count) WHERE {
                GRAPH <${this.contentGraph}> {
                    ?item a ${this.getRagnoTypeForZoom(zoomLevel)} .
                }
            }
        `;

        const result = await this.executeQuery(statsQuery);
        return result[0]?.count?.value || 0;
    }

    /**
     * Map zoom level to ragno type
     */
    getRagnoTypeForZoom(zoomLevel) {
        const mapping = {
            'micro': 'ragno:Attribute',
            'entity': 'ragno:Entity',
            'unit': 'ragno:Unit',
            'text': 'ragno:TextElement',
            'community': 'ragno:Community',
            'corpus': 'ragno:Corpus'
        };
        return mapping[zoomLevel.toLowerCase()] || 'ragno:Element';
    }
}
