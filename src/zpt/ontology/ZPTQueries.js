/**
 * ZPTQueries.js - SPARQL Query Builders for ZPT Ontology
 * 
 * This module provides SPARQL query builders and templates for working with
 * ZPT (Zoom-Pan-Tilt) navigation data integrated with Ragno corpus data.
 * 
 * Query Categories:
 * - Navigation view creation and retrieval
 * - Corpuscle selection with ZPT parameters  
 * - Navigation history and provenance tracking
 * - Optimization and analytics queries
 * - Cross-zoom and cross-session analysis
 */

import { getSPARQLPrefixes, ZPT_TERMS, RAGNO_TERMS, PROV_TERMS, XSD_TYPES } from './ZPTNamespaces.js';
import logger from 'loglevel';

/**
 * SPARQL query builder for ZPT navigation operations
 */
export class ZPTQueryBuilder {
    constructor(options = {}) {
        this.defaultGraph = options.defaultGraph || 'http://purl.org/stuff/navigation';
        this.ragnoGraph = options.ragnoGraph || 'http://purl.org/stuff/ragno';
        this.beerQAGraph = options.beerQAGraph || 'http://purl.org/stuff/beerqa';
        this.includePrefixes = options.includePrefixes !== false;
    }

    /**
     * Generate standard SPARQL prefixes for ZPT queries
     * @returns {string} SPARQL prefix declarations
     */
    getPrefixes() {
        if (!this.includePrefixes) return '';
        return getSPARQLPrefixes(['zpt', 'ragno', 'rdf', 'rdfs', 'xsd', 'prov', 'skos']);
    }

    /**
     * Create navigation view with complete state configuration
     * @param {Object} config - Navigation configuration
     * @param {string} config.viewURI - URI for the navigation view
     * @param {string} config.sessionURI - URI of parent session
     * @param {string} config.query - Natural language query
     * @param {string} config.zoomLevel - ZPT zoom level URI
     * @param {Array} config.panDomains - Array of pan domain URIs
     * @param {string} config.tiltProjection - ZPT tilt projection URI
     * @param {Array} config.selectedCorpuscles - Array of selected corpuscle URIs
     * @param {Object} config.temporalConstraint - Temporal filtering
     * @returns {string} SPARQL INSERT query
     */
    createNavigationView(config) {
        const prefixes = this.getPrefixes();
        const timestamp = new Date().toISOString();
        
        let insertData = `
INSERT DATA {
    GRAPH <${this.defaultGraph}> {
        <${config.viewURI}> a zpt:NavigationView ;
            zpt:answersQuery "${config.query}" ;
            zpt:navigationTimestamp "${timestamp}"^^xsd:dateTime `;

        // Link to session if provided
        if (config.sessionURI) {
            insertData += `;\n            zpt:partOfSession <${config.sessionURI}> `;
        }

        // Create zoom state
        const zoomStateURI = config.viewURI + '_zoom';
        insertData += `;\n            zpt:hasZoomState <${zoomStateURI}> `;
        insertData += `.\n        <${zoomStateURI}> a zpt:ZoomState ;
            zpt:atZoomLevel <${config.zoomLevel}> `;

        // Create pan state
        const panStateURI = config.viewURI + '_pan';
        insertData += `.\n        <${config.viewURI}> zpt:hasPanState <${panStateURI}> `;
        insertData += `.\n        <${panStateURI}> a zpt:PanState `;
        
        if (config.panDomains && config.panDomains.length > 0) {
            config.panDomains.forEach(domain => {
                insertData += `;\n            zpt:withPanDomain <${domain}> `;
            });
        }

        // Add temporal constraints if provided
        if (config.temporalConstraint) {
            const tempURI = config.viewURI + '_temporal';
            insertData += `;\n            zpt:hasTemporalConstraint <${tempURI}> `;
            insertData += `.\n        <${tempURI}> a zpt:TemporalConstraint `;
            
            if (config.temporalConstraint.start) {
                insertData += `;\n            zpt:temporalStart "${config.temporalConstraint.start}"^^xsd:dateTime `;
            }
            if (config.temporalConstraint.end) {
                insertData += `;\n            zpt:temporalEnd "${config.temporalConstraint.end}"^^xsd:dateTime `;
            }
        }

        // Create tilt state
        const tiltStateURI = config.viewURI + '_tilt';
        insertData += `.\n        <${config.viewURI}> zpt:hasTiltState <${tiltStateURI}> `;
        insertData += `.\n        <${tiltStateURI}> a zpt:TiltState ;
            zpt:withTiltProjection <${config.tiltProjection}> `;

        // Link to selected corpuscles
        if (config.selectedCorpuscles && config.selectedCorpuscles.length > 0) {
            config.selectedCorpuscles.forEach(corpuscle => {
                insertData += `.\n        <${config.viewURI}> zpt:selectedCorpuscle <${corpuscle}> `;
            });
        }

        insertData += `.\n    }\n}`;

        return prefixes + insertData;
    }

    /**
     * Query for corpuscles based on ZPT navigation parameters
     * @param {Object} params - Query parameters
     * @param {string} params.zoomLevel - ZPT zoom level URI
     * @param {Array} params.panDomains - Pan domain filters
     * @param {string} params.tiltProjection - Tilt projection method
     * @param {Object} params.temporalConstraint - Temporal filtering
     * @param {number} params.limit - Result limit
     * @returns {string} SPARQL SELECT query
     */
    selectCorpusclesByNavigation(params) {
        const prefixes = this.getPrefixes();
        const limit = params.limit || 100;
        
        let query = `
SELECT DISTINCT ?corpuscle ?content ?embedding 
    (COALESCE(?optScore, 0.0) AS ?optimizationScore)
    (COALESCE(?zoomRel, 0.0) AS ?zoomRelevance)
    (COALESCE(?panCov, 0.0) AS ?panCoverage)
    (COALESCE(?tiltEff, 0.0) AS ?tiltEffectiveness)
WHERE {`;

        // Query corpuscles from appropriate graph based on zoom level
        const corpusGraph = this.getCorpusGraphForZoom(params.zoomLevel);
        query += `
    GRAPH <${corpusGraph}> {
        ?corpuscle a ragno:Corpuscle ;
                   ragno:content ?content .
        OPTIONAL { ?corpuscle ragno:hasEmbedding ?embedding }
    }`;

        // Add optimization metadata if available
        query += `
    OPTIONAL {
        GRAPH <${this.defaultGraph}> {
            ?corpuscle zpt:optimizationScore ?optScore ;
                      zpt:zoomRelevance ?zoomRel ;
                      zpt:panCoverage ?panCov ;
                      zpt:tiltEffectiveness ?tiltEff .
        }
    }`;

        // Apply zoom level filtering
        if (params.zoomLevel) {
            query += this.getZoomLevelFilter(params.zoomLevel);
        }

        // Apply pan domain filtering
        if (params.panDomains && params.panDomains.length > 0) {
            query += this.getPanDomainFilter(params.panDomains);
        }

        // Apply temporal filtering
        if (params.temporalConstraint) {
            query += this.getTemporalFilter(params.temporalConstraint);
        }

        // Apply tilt projection filtering
        if (params.tiltProjection) {
            query += this.getTiltProjectionFilter(params.tiltProjection);
        }

        query += `
}
ORDER BY DESC(?optimizationScore) DESC(?zoomRelevance)
LIMIT ${limit}`;

        return prefixes + query;
    }

    /**
     * Query navigation views by parameters
     * @param {Object} filters - Filter parameters
     * @param {string} filters.zoomLevel - Filter by zoom level
     * @param {string} filters.sessionURI - Filter by session
     * @param {Date} filters.startTime - Filter by start time
     * @param {Date} filters.endTime - Filter by end time
     * @returns {string} SPARQL SELECT query
     */
    queryNavigationViews(filters = {}) {
        const prefixes = this.getPrefixes();
        
        let query = `
SELECT ?view ?query ?timestamp ?session ?zoomLevel ?tiltProjection
    (GROUP_CONCAT(DISTINCT ?panDomain; separator=",") AS ?panDomains)
    (COUNT(DISTINCT ?selectedCorpuscle) AS ?corpuscleCount)
WHERE {
    GRAPH <${this.defaultGraph}> {
        ?view a zpt:NavigationView ;
              zpt:answersQuery ?query ;
              zpt:navigationTimestamp ?timestamp .
              
        OPTIONAL { ?view zpt:partOfSession ?session }
        OPTIONAL { ?view zpt:selectedCorpuscle ?selectedCorpuscle }
        
        ?view zpt:hasZoomState [ zpt:atZoomLevel ?zoomLevel ] ;
              zpt:hasTiltState [ zpt:withTiltProjection ?tiltProjection ] .
              
        OPTIONAL {
            ?view zpt:hasPanState [ zpt:withPanDomain ?panDomain ]
        }`;

        // Apply filters
        if (filters.zoomLevel) {
            query += `
        FILTER(?zoomLevel = <${filters.zoomLevel}>)`;
        }

        if (filters.sessionURI) {
            query += `
        FILTER(?session = <${filters.sessionURI}>)`;
        }

        if (filters.startTime) {
            query += `
        FILTER(?timestamp >= "${filters.startTime.toISOString()}"^^xsd:dateTime)`;
        }

        if (filters.endTime) {
            query += `
        FILTER(?timestamp <= "${filters.endTime.toISOString()}"^^xsd:dateTime)`;
        }

        query += `
    }
}
GROUP BY ?view ?query ?timestamp ?session ?zoomLevel ?tiltProjection
ORDER BY DESC(?timestamp)`;

        return prefixes + query;
    }

    /**
     * Query navigation history and provenance
     * @param {Object} params - Query parameters
     * @param {string} params.sessionURI - Session to analyze
     * @param {string} params.agentURI - Agent to track
     * @returns {string} SPARQL SELECT query
     */
    queryNavigationHistory(params = {}) {
        const prefixes = this.getPrefixes();
        
        let query = `
SELECT ?view ?previousView ?query ?timestamp ?zoomLevel ?duration
WHERE {
    GRAPH <${this.defaultGraph}> {
        ?view a zpt:NavigationView ;
              zpt:answersQuery ?query ;
              zpt:navigationTimestamp ?timestamp ;
              zpt:hasZoomState [ zpt:atZoomLevel ?zoomLevel ] .
              
        OPTIONAL { ?view zpt:previousView ?previousView }`;

        if (params.sessionURI) {
            query += `
        ?view zpt:partOfSession <${params.sessionURI}> .`;
        }

        if (params.agentURI) {
            query += `
        ?view zpt:navigatedBy <${params.agentURI}> .`;
        }

        query += `
        
        # Calculate duration between views
        OPTIONAL {
            ?nextView zpt:previousView ?view ;
                     zpt:navigationTimestamp ?nextTimestamp .
            BIND(?nextTimestamp - ?timestamp AS ?duration)
        }
    }
}
ORDER BY ?timestamp`;

        return prefixes + query;
    }

    /**
     * Query for cross-zoom navigation patterns
     * @param {string} corpuscleURI - Corpuscle to analyze
     * @returns {string} SPARQL SELECT query
     */
    queryCrossZoomNavigation(corpuscleURI) {
        const prefixes = this.getPrefixes();
        
        return prefixes + `
SELECT ?view1 ?view2 ?zoom1 ?zoom2 ?query1 ?query2 ?timestamp1 ?timestamp2
WHERE {
    GRAPH <${this.defaultGraph}> {
        ?view1 a zpt:NavigationView ;
               zpt:selectedCorpuscle <${corpuscleURI}> ;
               zpt:answersQuery ?query1 ;
               zpt:navigationTimestamp ?timestamp1 ;
               zpt:hasZoomState [ zpt:atZoomLevel ?zoom1 ] .
               
        ?view2 a zpt:NavigationView ;
               zpt:selectedCorpuscle <${corpuscleURI}> ;
               zpt:answersQuery ?query2 ;
               zpt:navigationTimestamp ?timestamp2 ;
               zpt:hasZoomState [ zpt:atZoomLevel ?zoom2 ] .
               
        FILTER(?view1 != ?view2)
        FILTER(?zoom1 != ?zoom2)
    }
}
ORDER BY ?timestamp1 ?timestamp2`;
    }

    /**
     * Update optimization scores for corpuscles
     * @param {Array} scores - Array of score objects
     * @returns {string} SPARQL UPDATE query
     */
    updateOptimizationScores(scores) {
        const prefixes = this.getPrefixes();
        
        let deleteClause = 'DELETE {\n    GRAPH <' + this.defaultGraph + '> {\n';
        let insertClause = 'INSERT {\n    GRAPH <' + this.defaultGraph + '> {\n';
        let whereClause = 'WHERE {\n';

        scores.forEach((score, index) => {
            const corpuscleVar = `?corpuscle${index}`;
            
            // Delete existing scores
            deleteClause += `        ${corpuscleVar} zpt:optimizationScore ?oldOpt${index} ;
                      zpt:zoomRelevance ?oldZoom${index} ;
                      zpt:panCoverage ?oldPan${index} ;
                      zpt:tiltEffectiveness ?oldTilt${index} .\n`;
            
            // Insert new scores
            insertClause += `        <${score.corpuscleURI}> zpt:optimizationScore ${score.optimizationScore} ;
                      zpt:zoomRelevance ${score.zoomRelevance} ;
                      zpt:panCoverage ${score.panCoverage} ;
                      zpt:tiltEffectiveness ${score.tiltEffectiveness} .\n`;
            
            // Where conditions
            whereClause += `    OPTIONAL {
        GRAPH <${this.defaultGraph}> {
            <${score.corpuscleURI}> zpt:optimizationScore ?oldOpt${index} ;
                      zpt:zoomRelevance ?oldZoom${index} ;
                      zpt:panCoverage ?oldPan${index} ;
                      zpt:tiltEffectiveness ?oldTilt${index} .
        }
    }\n`;
        });

        deleteClause += '    }\n}\n';
        insertClause += '    }\n}\n';
        whereClause += '}';

        return prefixes + deleteClause + insertClause + whereClause;
    }

    /**
     * Query for navigation analytics and patterns
     * @param {Object} params - Analytics parameters
     * @returns {string} SPARQL SELECT query
     */
    queryNavigationAnalytics(params = {}) {
        const prefixes = this.getPrefixes();
        
        return prefixes + `
SELECT ?zoomLevel ?tiltProjection 
    (COUNT(?view) AS ?viewCount)
    (AVG(?corpuscleCount) AS ?avgCorpuscleCount)
    (MIN(?timestamp) AS ?firstUse)
    (MAX(?timestamp) AS ?lastUse)
WHERE {
    GRAPH <${this.defaultGraph}> {
        ?view a zpt:NavigationView ;
              zpt:navigationTimestamp ?timestamp ;
              zpt:hasZoomState [ zpt:atZoomLevel ?zoomLevel ] ;
              zpt:hasTiltState [ zpt:withTiltProjection ?tiltProjection ] .
              
        {
            SELECT ?view (COUNT(?corpuscle) AS ?corpuscleCount) WHERE {
                ?view zpt:selectedCorpuscle ?corpuscle .
            }
            GROUP BY ?view
        }
    }
}
GROUP BY ?zoomLevel ?tiltProjection
ORDER BY DESC(?viewCount)`;
    }

    /**
     * Helper: Get appropriate corpus graph for zoom level
     * @param {string} zoomLevelURI - ZPT zoom level URI
     * @returns {string} Graph URI for corpus data
     */
    getCorpusGraphForZoom(zoomLevelURI) {
        // Map zoom levels to appropriate data graphs
        if (zoomLevelURI.includes('MicroLevel') || zoomLevelURI.includes('EntityLevel') || zoomLevelURI.includes('UnitLevel')) {
            return this.beerQAGraph; // Prefer BeerQA for entity/unit level
        }
        return this.ragnoGraph; // Default to Ragno graph
    }

    /**
     * Helper: Generate zoom level filter
     * @param {string} zoomLevelURI - ZPT zoom level URI
     * @returns {string} SPARQL filter clause
     */
    getZoomLevelFilter(zoomLevelURI) {
        // This could be enhanced to filter based on zoom level semantics
        // For now, we rely on the corpus graph selection
        return '';
    }

    /**
     * Helper: Generate pan domain filter
     * @param {Array} panDomains - Array of pan domain URIs
     * @returns {string} SPARQL filter clause
     */
    getPanDomainFilter(panDomains) {
        if (!panDomains || panDomains.length === 0) return '';
        
        // Create content-based filtering for pan domains
        const domainFilters = panDomains.map(domain => {
            // Extract domain name for content filtering
            const domainName = domain.split('/').pop().toLowerCase();
            return `CONTAINS(LCASE(?content), "${domainName}")`;
        }).join(' || ');
        
        return `
    FILTER(${domainFilters})`;
    }

    /**
     * Helper: Generate temporal filter
     * @param {Object} temporalConstraint - Temporal constraints
     * @returns {string} SPARQL filter clause
     */
    getTemporalFilter(temporalConstraint) {
        let filter = '';
        
        if (temporalConstraint.start || temporalConstraint.end) {
            // This assumes corpuscles have temporal metadata
            filter += `
    OPTIONAL { ?corpuscle ragno:timestamp ?corpTimestamp }`;
            
            if (temporalConstraint.start) {
                filter += `
    FILTER(!BOUND(?corpTimestamp) || ?corpTimestamp >= "${temporalConstraint.start}"^^xsd:dateTime)`;
            }
            
            if (temporalConstraint.end) {
                filter += `
    FILTER(!BOUND(?corpTimestamp) || ?corpTimestamp <= "${temporalConstraint.end}"^^xsd:dateTime)`;
            }
        }
        
        return filter;
    }

    /**
     * Helper: Generate tilt projection filter
     * @param {string} tiltProjectionURI - ZPT tilt projection URI
     * @returns {string} SPARQL filter clause
     */
    getTiltProjectionFilter(tiltProjectionURI) {
        // Filter based on tilt projection requirements
        if (tiltProjectionURI.includes('EmbeddingProjection')) {
            return `
    FILTER(BOUND(?embedding))`;
        }
        
        // Keywords, Graph, and Temporal projections don't require special filtering here
        return '';
    }
}

/**
 * Pre-built query templates for common operations
 */
export const ZPTQueryTemplates = {
    /**
     * Find all navigation views for a specific query
     */
    VIEWS_BY_QUERY: `
SELECT ?view ?timestamp ?zoomLevel ?tiltProjection ?corpuscleCount WHERE {
    GRAPH <NAVIGATION_GRAPH> {
        ?view a zpt:NavigationView ;
              zpt:answersQuery "QUERY_TEXT" ;
              zpt:navigationTimestamp ?timestamp ;
              zpt:hasZoomState [ zpt:atZoomLevel ?zoomLevel ] ;
              zpt:hasTiltState [ zpt:withTiltProjection ?tiltProjection ] .
        
        {
            SELECT ?view (COUNT(?corpuscle) AS ?corpuscleCount) WHERE {
                ?view zpt:selectedCorpuscle ?corpuscle .
            }
            GROUP BY ?view
        }
    }
}
ORDER BY DESC(?timestamp)`,

    /**
     * Find corpuscles selected across multiple zoom levels
     */
    CROSS_ZOOM_CORPUSCLES: `
SELECT ?corpuscle (COUNT(DISTINCT ?zoomLevel) AS ?zoomCount) 
       (GROUP_CONCAT(DISTINCT ?zoomLevel; separator=",") AS ?zoomLevels) WHERE {
    GRAPH <NAVIGATION_GRAPH> {
        ?view zpt:selectedCorpuscle ?corpuscle ;
              zpt:hasZoomState [ zpt:atZoomLevel ?zoomLevel ] .
    }
}
GROUP BY ?corpuscle
HAVING(?zoomCount > 1)
ORDER BY DESC(?zoomCount)`,

    /**
     * Navigation session summary
     */
    SESSION_SUMMARY: `
SELECT ?session ?duration ?viewCount ?uniqueCorpuscles 
       (MIN(?timestamp) AS ?startTime)
       (MAX(?timestamp) AS ?endTime) WHERE {
    GRAPH <NAVIGATION_GRAPH> {
        ?session a zpt:NavigationSession .
        OPTIONAL { ?session zpt:sessionDuration ?duration }
        
        ?view zpt:partOfSession ?session ;
              zpt:navigationTimestamp ?timestamp .
              
        OPTIONAL { ?view zpt:selectedCorpuscle ?corpuscle }
    }
}
GROUP BY ?session ?duration`,

    /**
     * Most effective tilt projections by optimization score
     */
    TILT_EFFECTIVENESS: `
SELECT ?tiltProjection 
       (AVG(?optimizationScore) AS ?avgScore)
       (COUNT(?view) AS ?usage) WHERE {
    GRAPH <NAVIGATION_GRAPH> {
        ?view zpt:hasTiltState [ zpt:withTiltProjection ?tiltProjection ] ;
              zpt:selectedCorpuscle ?corpuscle .
        ?corpuscle zpt:optimizationScore ?optimizationScore .
    }
}
GROUP BY ?tiltProjection
ORDER BY DESC(?avgScore)`
};

/**
 * Utility functions for query building
 */
export const ZPTQueryUtils = {
    /**
     * Replace template placeholders with actual values
     * @param {string} template - Query template
     * @param {Object} params - Replacement parameters
     * @returns {string} Complete SPARQL query
     */
    buildFromTemplate(template, params = {}) {
        let query = getSPARQLPrefixes() + '\n' + template;
        
        // Replace common placeholders
        Object.entries(params).forEach(([key, value]) => {
            const placeholder = key.toUpperCase().replace(/([A-Z])/g, '_$1').substring(1);
            query = query.replace(new RegExp(placeholder, 'g'), value);
        });
        
        return query;
    },

    /**
     * Build INSERT query for bulk corpuscle optimization scores
     * @param {Array} corpuscleScores - Array of corpuscle score objects
     * @param {string} graph - Target graph URI
     * @returns {string} SPARQL INSERT query
     */
    buildBulkScoreInsert(corpuscleScores, graph) {
        const prefixes = getSPARQLPrefixes();
        
        let insertData = `INSERT DATA {\n    GRAPH <${graph}> {\n`;
        
        corpuscleScores.forEach(score => {
            insertData += `        <${score.corpuscleURI}> zpt:optimizationScore ${score.optimizationScore} ;\n`;
            insertData += `                                zpt:zoomRelevance ${score.zoomRelevance} ;\n`;
            insertData += `                                zpt:panCoverage ${score.panCoverage} ;\n`;
            insertData += `                                zpt:tiltEffectiveness ${score.tiltEffectiveness} .\n`;
        });
        
        insertData += `    }\n}`;
        
        return prefixes + insertData;
    },

    /**
     * Validate SPARQL query syntax (basic check)
     * @param {string} query - SPARQL query to validate
     * @returns {Object} Validation result
     */
    validateQuery(query) {
        const errors = [];
        const warnings = [];
        
        // Basic syntax checks
        if (!query.trim()) {
            errors.push('Query is empty');
        }
        
        // Check for required keywords
        const hasSelect = /SELECT/i.test(query);
        const hasInsert = /INSERT/i.test(query);
        const hasConstruct = /CONSTRUCT/i.test(query);
        const hasAsk = /ASK/i.test(query);
        
        if (!(hasSelect || hasInsert || hasConstruct || hasAsk)) {
            errors.push('Query must contain SELECT, INSERT, CONSTRUCT, or ASK');
        }
        
        // Check for unbalanced braces
        const openBraces = (query.match(/{/g) || []).length;
        const closeBraces = (query.match(/}/g) || []).length;
        if (openBraces !== closeBraces) {
            errors.push('Unbalanced braces in query');
        }
        
        // Check for ZPT namespace usage
        if (/zpt:/.test(query) && !/PREFIX zpt:/i.test(query)) {
            warnings.push('ZPT namespace used but not declared');
        }
        
        return {
            valid: errors.length === 0,
            errors,
            warnings
        };
    }
};

export default ZPTQueryBuilder;
