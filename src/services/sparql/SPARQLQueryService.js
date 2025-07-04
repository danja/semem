import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import QueryCache from './QueryCache.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class SPARQLQueryService {
    constructor(options = {}) {
        this.queryPath = options.queryPath || path.join(__dirname, '../../../sparql/queries');
        this.templatePath = options.templatePath || path.join(__dirname, '../../../sparql/templates');
        this.configPath = options.configPath || path.join(__dirname, '../../../sparql/config');
        this.cache = new QueryCache(options.cacheOptions || {});
        this.prefixes = null;
        this.queryMappings = null;
    }

    async loadPrefixes() {
        if (this.prefixes) {
            return this.prefixes;
        }

        try {
            const prefixesPath = path.join(this.templatePath, 'prefixes.sparql');
            this.prefixes = await fs.readFile(prefixesPath, 'utf8');
            return this.prefixes;
        } catch (error) {
            console.warn('No prefixes file found, using default prefixes');
            this.prefixes = this.getDefaultPrefixes();
            return this.prefixes;
        }
    }

    getDefaultPrefixes() {
        return `PREFIX ragno: <http://purl.org/stuff/ragno/>
PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
PREFIX dcterms: <http://purl.org/dc/terms/>
PREFIX prov: <http://www.w3.org/ns/prov#>
PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
PREFIX owl: <http://www.w3.org/2002/07/owl#>

`;
    }

    async loadQueryMappings() {
        if (this.queryMappings) {
            return this.queryMappings;
        }

        try {
            const mappingsPath = path.join(this.configPath, 'query-mappings.json');
            const mappingsContent = await fs.readFile(mappingsPath, 'utf8');
            this.queryMappings = JSON.parse(mappingsContent);
            return this.queryMappings;
        } catch (error) {
            console.warn('No query mappings file found, using default mappings');
            this.queryMappings = this.getDefaultMappings();
            return this.queryMappings;
        }
    }

    getDefaultMappings() {
        return {
            'questions-with-relationships': 'retrieval/questions-with-relationships.sparql',
            'entity-content-retrieval': 'retrieval/entity-content-retrieval.sparql',
            'navigation-questions': 'retrieval/navigation-questions.sparql',
            'corpus-loading': 'retrieval/corpus-loading.sparql',
            'processed-questions': 'retrieval/processed-questions.sparql',
            'insert-data': 'management/insert-data.sparql',
            'clear-graph': 'management/clear-graph.sparql',
            'relationship-creation': 'management/relationship-creation.sparql',
            'semantic-search': 'search/semantic-search.sparql',
            'ppr-concepts': 'search/ppr-concepts.sparql',
            'importance-rankings': 'search/importance-rankings.sparql',
            'knowledge-graph-construct': 'visualization/knowledge-graph-construct.sparql'
        };
    }

    async loadQuery(queryName) {
        const mappings = await this.loadQueryMappings();
        const queryFile = mappings[queryName];
        
        if (!queryFile) {
            throw new Error(`Unknown query: ${queryName}`);
        }

        const queryPath = path.join(this.queryPath, queryFile);
        
        // Check cache first
        const cachedQuery = await this.cache.get(queryName, queryPath);
        if (cachedQuery) {
            return cachedQuery;
        }
        
        try {
            const queryContent = await fs.readFile(queryPath, 'utf8');
            await this.cache.set(queryName, queryContent, queryPath);
            return queryContent;
        } catch (error) {
            throw new Error(`Failed to load query ${queryName} from ${queryPath}: ${error.message}`);
        }
    }

    async getQuery(queryName, parameters = {}) {
        const [prefixes, queryTemplate] = await Promise.all([
            this.loadPrefixes(),
            this.loadQuery(queryName)
        ]);

        let query = prefixes + queryTemplate;
        
        // Replace template parameters
        for (const [key, value] of Object.entries(parameters)) {
            const placeholder = `\${${key}}`;
            query = query.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), value);
        }

        return query;
    }

    async clearCache() {
        this.cache.clear();
        this.prefixes = null;
        this.queryMappings = null;
    }

    async reloadQuery(queryName) {
        this.cache.delete(queryName);
        return await this.loadQuery(queryName);
    }

    getCacheStats() {
        return this.cache.getStats();
    }

    cleanup() {
        this.cache.cleanup();
    }

    formatEntityList(entityURIs) {
        return entityURIs.map(uri => `<${uri}>`).join(', ');
    }

    formatLimit(limit) {
        return limit ? `LIMIT ${limit}` : '';
    }

    formatFilter(conditions) {
        if (!conditions || conditions.length === 0) {
            return '';
        }
        return `FILTER(${conditions.join(' && ')})`;
    }

    formatOptional(clauses) {
        if (!clauses || clauses.length === 0) {
            return '';
        }
        return clauses.map(clause => `OPTIONAL { ${clause} }`).join('\n        ');
    }

    formatUnion(clauses) {
        if (!clauses || clauses.length === 0) {
            return '';
        }
        return clauses.map(clause => `{ ${clause} }`).join(' UNION ');
    }

    formatTimestamp(date = new Date()) {
        return date.toISOString();
    }

    formatXSDDateTime(date = new Date()) {
        return `"${date.toISOString()}"^^xsd:dateTime`;
    }

    async listAvailableQueries() {
        const mappings = await this.loadQueryMappings();
        return Object.keys(mappings);
    }

    async getQueryStats() {
        const mappings = await this.loadQueryMappings();
        const stats = {
            totalQueries: Object.keys(mappings).length,
            cachedQueries: this.cache.size,
            categories: {}
        };

        for (const [name, file] of Object.entries(mappings)) {
            const category = file.split('/')[0];
            stats.categories[category] = (stats.categories[category] || 0) + 1;
        }

        return stats;
    }
}

export default SPARQLQueryService;