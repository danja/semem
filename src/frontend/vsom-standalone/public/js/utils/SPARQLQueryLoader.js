/**
 * SPARQL Query Loader
 * Loads and processes SPARQL query templates from the sparql directory
 */

export default class SPARQLQueryLoader {
    constructor() {
        this.queryCache = new Map();
        this.baseUrl = '/sparql/queries';
    }

    /**
     * Load a SPARQL query template from file
     */
    async loadQuery(queryPath, variables = {}) {
        // Check cache first
        const cacheKey = `${queryPath}:${JSON.stringify(variables)}`;
        if (this.queryCache.has(cacheKey)) {
            return this.queryCache.get(cacheKey);
        }

        try {
            // Load the template
            const templateUrl = `${this.baseUrl}/${queryPath}`;
            const response = await fetch(templateUrl);

            if (!response.ok) {
                throw new Error(`Failed to load query template: ${templateUrl}`);
            }

            let queryTemplate = await response.text();

            // Process template variables
            queryTemplate = this.processTemplate(queryTemplate, variables);

            // Cache the processed query
            this.queryCache.set(cacheKey, queryTemplate);

            return queryTemplate;
        } catch (error) {
            console.error('Failed to load SPARQL query:', queryPath, error);
            throw error;
        }
    }

    /**
     * Process template variables in SPARQL query
     */
    processTemplate(template, variables = {}) {
        let processed = template;

        // Set default values
        const defaults = {
            limit: 100,
            offset: 0,
            threshold: 0.5
        };

        const allVars = { ...defaults, ...variables };

        // Replace template variables
        for (const [key, value] of Object.entries(allVars)) {
            const pattern = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
            processed = processed.replace(pattern, String(value));
        }

        return processed;
    }

    /**
     * Load VSOM visualization queries
     */
    async loadVSOMQueries(options = {}) {
        const { limit = 100 } = options;

        const queries = {
            entities: await this.loadQuery('visualization/vsom-entities.sparql', { limit }),
            memoryItems: await this.loadQuery('visualization/vsom-memory-items.sparql', { limit }),
            concepts: await this.loadQuery('visualization/vsom-concepts.sparql', { limit }),
            allData: await this.loadQuery('visualization/vsom-all-data.sparql', { limit })
        };

        return queries;
    }

    /**
     * Clear query cache
     */
    clearCache() {
        this.queryCache.clear();
    }

    /**
     * Get cache statistics
     */
    getCacheStats() {
        return {
            size: this.queryCache.size,
            keys: Array.from(this.queryCache.keys())
        };
    }
}