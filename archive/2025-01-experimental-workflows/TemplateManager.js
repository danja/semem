/**
 * TemplateManager - Manage SPARQL query templates with caching and parameterization
 * 
 * This component provides centralized management of SPARQL query templates with:
 * 1. Template loading and caching
 * 2. Parameter substitution and validation
 * 3. Common prefix management
 * 4. Query optimization
 * 
 * API: getQuery(templateName, parameters, options)
 */

import logger from 'loglevel';

export default class TemplateManager {
    constructor(options = {}) {
        this.options = {
            cacheTemplates: options.cacheTemplates !== false, // Default to true
            validateParameters: options.validateParameters !== false, // Default to true
            ...options
        };
        
        this.templateCache = new Map();
        this.prefixCache = new Map();
        
        // Initialize common prefixes
        this._initializePrefixes();
    }

    /**
     * Get a SPARQL query from template with parameter substitution
     * 
     * @param {string} templateName - Name of the template to use
     * @param {Object} parameters - Parameters for template substitution
     * @param {Object} options - Query generation options
     * @param {boolean} options.includePrefixes - Include prefix declarations (default: true)
     * @param {Array<string>} options.additionalPrefixes - Additional prefixes to include
     * @param {boolean} options.optimize - Optimize query structure (default: false)
     * @returns {Object} Generated query with metadata
     */
    async getQuery(templateName, parameters = {}, options = {}) {
        try {
            const queryOptions = {
                includePrefixes: options.includePrefixes !== false,
                additionalPrefixes: options.additionalPrefixes || [],
                optimize: options.optimize || false,
                ...options
            };

            // Get template
            const template = await this._getTemplate(templateName);
            if (!template) {
                throw new Error(`Template not found: ${templateName}`);
            }

            // Validate parameters if enabled
            if (this.options.validateParameters) {
                this._validateParameters(template, parameters);
            }

            // Substitute parameters
            let query = this._substituteParameters(template.query, parameters);

            // Add prefixes if requested
            if (queryOptions.includePrefixes) {
                const prefixes = this._buildPrefixes(template.prefixes, queryOptions.additionalPrefixes);
                query = prefixes + '\n\n' + query;
            }

            // Optimize query if requested
            if (queryOptions.optimize) {
                query = this._optimizeQuery(query);
            }

            return {
                success: true,
                query: query.trim(),
                metadata: {
                    templateName,
                    parametersUsed: Object.keys(parameters),
                    prefixesIncluded: queryOptions.includePrefixes,
                    queryLength: query.length,
                    timestamp: new Date().toISOString()
                }
            };

        } catch (error) {
            logger.error('Failed to generate query from template:', error.message);
            return {
                success: false,
                error: error.message,
                query: null,
                metadata: {
                    templateName,
                    errorOccurred: true,
                    timestamp: new Date().toISOString()
                }
            };
        }
    }

    /**
     * Register a new template
     * 
     * @param {string} name - Template name
     * @param {Object} template - Template definition
     * @param {string} template.query - Query template with placeholders
     * @param {Array<string>} template.prefixes - Required prefixes
     * @param {Array<string>} template.parameters - Required parameters
     * @param {string} template.description - Template description
     * @returns {boolean} Success status
     */
    registerTemplate(name, template) {
        try {
            // Validate template structure
            if (!template.query || typeof template.query !== 'string') {
                throw new Error('Template must have a query string');
            }

            const templateDef = {
                query: template.query,
                prefixes: template.prefixes || ['ragno', 'rdf', 'rdfs'],
                parameters: template.parameters || [],
                description: template.description || '',
                registeredAt: new Date().toISOString()
            };

            this.templateCache.set(name, templateDef);
            return true;

        } catch (error) {
            logger.error(`Failed to register template ${name}:`, error.message);
            return false;
        }
    }

    /**
     * List available templates
     * 
     * @returns {Array<Object>} List of available templates with metadata
     */
    listTemplates() {
        const templates = [];
        
        for (const [name, template] of this.templateCache.entries()) {
            templates.push({
                name,
                description: template.description,
                parameters: template.parameters,
                prefixes: template.prefixes,
                registeredAt: template.registeredAt
            });
        }

        return templates.sort((a, b) => a.name.localeCompare(b.name));
    }

    /**
     * Clear template cache
     */
    clearCache() {
        this.templateCache.clear();
        logger.debug('Template cache cleared');
    }

    /**
     * Get template from cache or load it
     * @private
     */
    async _getTemplate(templateName) {
        // Check cache first
        if (this.templateCache.has(templateName)) {
            return this.templateCache.get(templateName);
        }

        // Try to load built-in template
        const builtInTemplate = this._getBuiltInTemplate(templateName);
        if (builtInTemplate) {
            this.templateCache.set(templateName, builtInTemplate);
            return builtInTemplate;
        }

        return null;
    }

    /**
     * Get built-in template definitions
     * @private
     */
    _getBuiltInTemplate(templateName) {
        const builtInTemplates = {
            // INSERT operations
            'insert-data': {
                query: `INSERT DATA {
    GRAPH <\${graph}> {
        \${triples}
    }
}`,
                prefixes: ['ragno', 'rdf', 'rdfs', 'xsd', 'dcterms', 'prov'],
                parameters: ['graph', 'triples'],
                description: 'Insert RDF triples into a named graph'
            },

            'insert-corpuscle': {
                query: `INSERT DATA {
    GRAPH <\${graph}> {
        <\${uri}> a ragno:Corpuscle ;
                  rdfs:label "\${label}" ;
                  dcterms:created "\${timestamp}" .
        \${additionalTriples}
    }
}`,
                prefixes: ['ragno', 'rdfs', 'dcterms'],
                parameters: ['graph', 'uri', 'label', 'timestamp'],
                description: 'Insert a new ragno:Corpuscle with basic properties'
            },

            // SELECT operations
            'select-questions-with-relationships': {
                query: `SELECT ?question ?questionText ?relationship ?targetEntity ?relationshipType ?weight ?sourceCorpus
WHERE {
    GRAPH <\${graph}> {
        ?question a ragno:Corpuscle ;
                 rdfs:label ?questionText .
        
        ?relationship a ragno:Relationship ;
                     ragno:hasSourceEntity ?question ;
                     ragno:hasTargetEntity ?targetEntity ;
                     ragno:relationshipType ?relationshipType ;
                     ragno:weight ?weight .
        
        OPTIONAL { ?relationship ragno:sourceCorpus ?sourceCorpus }
        
        FILTER(?question != ?targetEntity)
        \${additionalFilters}
    }
}
ORDER BY ?question DESC(?weight)
\${limitClause}`,
                prefixes: ['ragno', 'rdfs'],
                parameters: ['graph'],
                description: 'Select questions with their relationships and target entities'
            },

            'select-entities-by-uris': {
                query: `SELECT ?entity ?content
WHERE {
    GRAPH <\${graph}> {
        ?entity a ragno:Corpuscle ;
               rdfs:label ?content .
        
        FILTER(?entity IN (\${entityList}))
        \${additionalFilters}
    }
}
\${orderClause}
\${limitClause}`,
                prefixes: ['ragno', 'rdfs'],
                parameters: ['graph', 'entityList'],
                description: 'Select entities by a list of URIs'
            },

            'select-navigable-questions': {
                query: `SELECT ?question ?questionText ?embedding ?conceptValue ?conceptType ?conceptConfidence
WHERE {
    GRAPH <\${graph}> {
        ?question a ragno:Corpuscle ;
                 rdfs:label ?questionText .
        
        # Must have embedding for similarity search
        ?question ragno:hasAttribute ?embeddingAttr .
        {
            ?embeddingAttr a ragno:VectorEmbedding ;
                          ragno:attributeValue ?embedding .
        } UNION {
            ?embeddingAttr ragno:attributeType "vector-embedding" ;
                          ragno:attributeValue ?embedding .
        }
        
        # Must have concepts for semantic navigation
        ?question ragno:hasAttribute ?attr .
        ?attr ragno:attributeType "concept" ;
              ragno:attributeValue ?conceptValue .
        
        OPTIONAL { ?attr ragno:attributeConfidence ?conceptConfidence }
        OPTIONAL { ?attr ragno:attributeSubType ?conceptType }
        
        \${additionalFilters}
    }
}
ORDER BY ?question
\${limitClause}`,
                prefixes: ['ragno', 'rdfs'],
                parameters: ['graph'],
                description: 'Select questions with embeddings and concepts for navigation'
            },

            'select-test-questions': {
                query: `SELECT ?corpuscle ?label ?source WHERE {
    GRAPH <\${graph}> {
        ?corpuscle a ragno:Corpuscle ;
                 rdfs:label ?label ;
                 dcterms:source ?source ;
                 ragno:corpuscleType "test-question" .
        \${additionalFilters}
    }
}
ORDER BY ?corpuscle
\${limitClause}`,
                prefixes: ['ragno', 'rdfs', 'dcterms'],
                parameters: ['graph'],
                description: 'Select test questions from the knowledge base'
            },

            // Graph management
            'clear-graph': {
                query: `CLEAR GRAPH <\${graph}>`,
                prefixes: [],
                parameters: ['graph'],
                description: 'Clear all triples from a named graph'
            },

            'drop-graph': {
                query: `DROP GRAPH <\${graph}>`,
                prefixes: [],
                parameters: ['graph'],
                description: 'Drop a named graph completely'
            }
        };

        return builtInTemplates[templateName] || null;
    }

    /**
     * Initialize common prefix definitions
     * @private
     */
    _initializePrefixes() {
        const commonPrefixes = {
            ragno: 'http://purl.org/stuff/ragno/',
            rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
            rdfs: 'http://www.w3.org/2000/01/rdf-schema#',
            xsd: 'http://www.w3.org/2001/XMLSchema#',
            dcterms: 'http://purl.org/dc/terms/',
            prov: 'http://www.w3.org/ns/prov#',
            owl: 'http://www.w3.org/2002/07/owl#',
            beerqa: 'http://purl.org/stuff/beerqa/',
            wikidata: 'http://www.wikidata.org/entity/',
            wd: 'http://www.wikidata.org/entity/',
            wdt: 'http://www.wikidata.org/prop/direct/',
            wikipedia: 'https://en.wikipedia.org/wiki/'
        };

        for (const [prefix, uri] of Object.entries(commonPrefixes)) {
            this.prefixCache.set(prefix, uri);
        }
    }

    /**
     * Build prefix declarations
     * @private
     */
    _buildPrefixes(requiredPrefixes, additionalPrefixes = []) {
        const allPrefixes = [...new Set([...requiredPrefixes, ...additionalPrefixes])];
        const prefixLines = [];

        for (const prefix of allPrefixes) {
            if (this.prefixCache.has(prefix)) {
                prefixLines.push(`PREFIX ${prefix}: <${this.prefixCache.get(prefix)}>`);
            } else {
                logger.warn(`Unknown prefix: ${prefix}`);
            }
        }

        return prefixLines.join('\n');
    }

    /**
     * Substitute parameters in template
     * @private
     */
    _substituteParameters(template, parameters) {
        let query = template;

        // Replace ${parameter} patterns
        for (const [key, value] of Object.entries(parameters)) {
            const pattern = new RegExp(`\\$\\{${key}\\}`, 'g');
            query = query.replace(pattern, value);
        }

        // Handle optional parameters (set empty if not provided)
        const optionalParams = [
            'additionalTriples', 'additionalFilters', 'orderClause', 
            'limitClause', 'whereClause', 'insertClause'
        ];

        for (const param of optionalParams) {
            const pattern = new RegExp(`\\$\\{${param}\\}`, 'g');
            if (!parameters[param]) {
                query = query.replace(pattern, '');
            }
        }

        return query;
    }

    /**
     * Validate template parameters
     * @private
     */
    _validateParameters(template, parameters) {
        const requiredParams = template.parameters || [];
        const missing = requiredParams.filter(param => !(param in parameters));
        
        if (missing.length > 0) {
            throw new Error(`Missing required parameters: ${missing.join(', ')}`);
        }
    }

    /**
     * Basic query optimization
     * @private
     */
    _optimizeQuery(query) {
        // Remove extra whitespace and empty lines
        return query
            .replace(/\n\s*\n/g, '\n')
            .replace(/^\s+/gm, '')
            .trim();
    }
}