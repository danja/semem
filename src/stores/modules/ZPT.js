import dotenv from 'dotenv';
import Config from "../../Config.js";
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createUnifiedLogger } from '../../utils/LoggingConfig.js';

// Use unified STDIO-aware logger
const logger = createUnifiedLogger('zpt');

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * ZPT (Zoom-Pan-Tilt) module handles multi-scale RDF data visualization queries
 * This module provides functionality for querying RDF data at different zoom levels
 * and building dynamic filter clauses for ZPT navigation
 */
export class ZPT {
    constructor(sparqlExecute, graphName) {
        this.config = new Config();
        this.sparqlExecute = sparqlExecute;
        this.graphName = graphName;

        // Load ZPT query templates from files
        this.zptTemplates = this._loadZPTQueryTemplates();

        logger.info('ZPT module initialized');
    }

    /**
     * Load ZPT Query Templates from files
     * @returns {Object} Templates indexed by zoom level
     */
    _loadZPTQueryTemplates() {
        const templatesDir = join(__dirname, '../../../sparql/templates/zpt');
        const templateNames = ['micro', 'entity', 'relationship', 'community', 'corpus'];
        const templates = {};

        for (const name of templateNames) {
            try {
                const templatePath = join(templatesDir, `${name}.sparql`);
                templates[name] = readFileSync(templatePath, 'utf-8');
                logger.debug(`Loaded ZPT template: ${name}`);
            } catch (error) {
                logger.error(`Failed to load ZPT template ${name}:`, error);
                throw new Error(`Could not load ZPT template: ${name}`);
            }
        }

        return templates;
    }

    /**
     * Execute ZPT query by zoom level with filters
     * @param {Object} queryConfig - Configuration with zoomLevel, filters, limit
     * @returns {Promise<Array>} Query results formatted as corpuscles
     */
    async queryByZoomLevel(queryConfig) {
        const { zoomLevel, filters = {}, limit = 25 } = queryConfig;

        const template = this.zptTemplates[zoomLevel];
        if (!template) {
            throw new Error(`Unknown zoom level: ${zoomLevel}`);
        }

        // Build filter clauses
        const filterClauses = this.buildFilterClauses(filters);

        // Replace template variables
        const query = template
            .replace(/\{\{graphName\}\}/g, this.graphName)
            .replace(/\{\{filters\}\}/g, filterClauses)
            .replace(/\{\{limit\}\}/g, limit);

        logger.debug(`Executing ZPT query for zoom level: ${zoomLevel}`);
        const result = await this.sparqlExecute.executeSparqlQuery(query);

        return this._parseQueryResults(result, zoomLevel);
    }

    /**
     * Build SPARQL filter clauses from ZPT pan parameters
     * @param {Object} filters - Filter configuration (domains, keywords, temporal, etc.)
     * @returns {string} SPARQL filter clauses
     */
    buildFilterClauses(filters) {
        const clauses = [];

        // Domain filtering
        if (filters.domains && filters.domains.length > 0) {
            const domainPattern = filters.domains.map(d => `"${this._escapeSparqlString(d)}"`).join('|');
            clauses.push(`FILTER(REGEX(?label, "${domainPattern}", "i"))`);
        }

        // Keyword filtering
        if (filters.keywords && filters.keywords.length > 0) {
            const keywordPattern = filters.keywords.map(k => `"${this._escapeSparqlString(k)}"`).join('|');
            clauses.push(`FILTER(REGEX(?content, "${keywordPattern}", "i") || REGEX(?label, "${keywordPattern}", "i"))`);
        }

        // Entity filtering
        if (filters.entities && filters.entities.length > 0) {
            const entityValues = filters.entities.map(e => `<${e}>`).join(' ');
            clauses.push(`VALUES ?relatedEntity { ${entityValues} }`);
            clauses.push(`?uri ragno:connectsTo ?relatedEntity`);
        }

        // Temporal filtering
        if (filters.temporal && (filters.temporal.start || filters.temporal.end)) {
            if (filters.temporal.start) {
                clauses.push(`FILTER(?timestamp >= "${filters.temporal.start}"^^xsd:dateTime)`);
            }
            if (filters.temporal.end) {
                clauses.push(`FILTER(?timestamp <= "${filters.temporal.end}"^^xsd:dateTime)`);
            }
        }

        // Geographic filtering (if coordinates provided)
        if (filters.geographic && filters.geographic.boundingBox) {
            const { north, south, east, west } = filters.geographic.boundingBox;
            clauses.push(`
                ?uri geo:lat ?lat ; geo:long ?long .
                FILTER(?lat >= ${south} && ?lat <= ${north})
                FILTER(?long >= ${west} && ?long <= ${east})
            `);
        }

        // Similarity threshold filtering
        if (filters.similarityThreshold) {
            clauses.push(`FILTER(?similarity >= ${filters.similarityThreshold})`);
        }

        // Frequency filtering for entities
        if (filters.minFrequency) {
            clauses.push(`FILTER(?frequency >= ${filters.minFrequency})`);
        }

        // Centrality filtering for entities
        if (filters.minCentrality) {
            clauses.push(`FILTER(?centrality >= ${filters.minCentrality})`);
        }

        // Weight filtering for relationships
        if (filters.minWeight) {
            clauses.push(`FILTER(?weight >= ${filters.minWeight})`);
        }

        // Community size filtering
        if (filters.minCommunitySize) {
            clauses.push(`FILTER(?memberCount >= ${filters.minCommunitySize})`);
        }

        // Cohesion filtering for communities
        if (filters.minCohesion) {
            clauses.push(`FILTER(?cohesion >= ${filters.minCohesion})`);
        }

        // Entity type filtering
        if (filters.entityTypes && filters.entityTypes.length > 0) {
            const typeValues = filters.entityTypes.map(t => `"${this._escapeSparqlString(t)}"`).join(' ');
            clauses.push(`VALUES ?type { ${typeValues} }`);
        }

        // Relationship type filtering
        if (filters.relationshipTypes && filters.relationshipTypes.length > 0) {
            const relTypeValues = filters.relationshipTypes.map(t => `ragno:${t}`).join(' ');
            clauses.push(`VALUES ?relType { ${relTypeValues} }`);
            clauses.push(`?uri rdf:type ?relType`);
        }

        return clauses.join('\n                ');
    }

    /**
     * Parse SPARQL query results into ZPT corpuscle format
     * @param {Object} result - SPARQL query result
     * @param {string} zoomLevel - The zoom level for result interpretation
     * @returns {Array<Object>} Parsed corpuscles
     */
    _parseQueryResults(result, zoomLevel) {
        const corpuscles = [];

        for (const binding of result.results.bindings) {
            try {
                const corpuscle = {
                    id: binding.uri.value,
                    type: zoomLevel,
                    timestamp: binding.timestamp?.value || new Date().toISOString()
                };

                // Add type-specific properties based on zoom level
                switch (zoomLevel) {
                    case 'micro':
                        corpuscle.content = binding.content?.value || '';
                        corpuscle.metadata = this._parseJsonValue(binding.metadata?.value);
                        corpuscle.similarity = parseFloat(binding.similarity?.value) || 0;
                        corpuscle.prompt = binding.prompt?.value || '';
                        corpuscle.response = binding.response?.value || '';
                        corpuscle.accessCount = parseInt(binding.accessCount?.value) || 0;
                        corpuscle.decayFactor = parseFloat(binding.decayFactor?.value) || 1.0;
                        break;

                    case 'entity':
                        corpuscle.label = binding.label?.value || '';
                        corpuscle.entityType = binding.type?.value || '';
                        corpuscle.prefLabel = binding.prefLabel?.value || '';
                        corpuscle.frequency = parseInt(binding.frequency?.value) || 0;
                        corpuscle.centrality = parseFloat(binding.centrality?.value) || 0;
                        corpuscle.isEntryPoint = binding.isEntryPoint?.value === 'true';
                        corpuscle.description = binding.description?.value || '';
                        break;

                    case 'relationship':
                        corpuscle.label = binding.label?.value || '';
                        corpuscle.source = binding.source?.value || '';
                        corpuscle.target = binding.target?.value || '';
                        corpuscle.relationshipType = binding.type?.value || '';
                        corpuscle.weight = parseFloat(binding.weight?.value) || 0;
                        corpuscle.confidence = parseFloat(binding.confidence?.value) || 0;
                        corpuscle.bidirectional = binding.bidirectional?.value === 'true';
                        break;

                    case 'community':
                        corpuscle.label = binding.label?.value || '';
                        corpuscle.memberCount = parseInt(binding.memberCount?.value) || 0;
                        corpuscle.avgSimilarity = parseFloat(binding.avgSimilarity?.value) || 0;
                        corpuscle.cohesion = parseFloat(binding.cohesion?.value) || 0;
                        corpuscle.size = parseInt(binding.size?.value) || 0;
                        corpuscle.description = binding.description?.value || '';
                        break;

                    case 'corpus':
                        corpuscle.label = binding.label?.value || '';
                        corpuscle.entityCount = parseInt(binding.entityCount?.value) || 0;
                        corpuscle.unitCount = parseInt(binding.unitCount?.value) || 0;
                        corpuscle.relationshipCount = parseInt(binding.relationshipCount?.value) || 0;
                        corpuscle.avgConnectivity = parseFloat(binding.avgConnectivity?.value) || 0;
                        corpuscle.totalTriples = parseInt(binding.totalTriples?.value) || 0;
                        corpuscle.vocabulary = binding.vocabulary?.value || '';
                        break;
                }

                // Add common optional properties
                if (binding.created) {
                    corpuscle.created = binding.created.value;
                }
                if (binding.modified) {
                    corpuscle.modified = binding.modified.value;
                }
                if (binding.importance) {
                    corpuscle.importance = parseFloat(binding.importance.value);
                }

                corpuscles.push(corpuscle);
            } catch (parseError) {
                logger.error('Failed to parse corpuscle:', parseError, binding);
            }
        }

        logger.info(`Parsed ${corpuscles.length} corpuscles for zoom level: ${zoomLevel}`);
        return corpuscles;
    }

    /**
     * Get available zoom levels
     * @returns {Array<string>} Available zoom levels
     */
    getAvailableZoomLevels() {
        return Object.keys(this.zptTemplates);
    }

    /**
     * Validate zoom level
     * @param {string} zoomLevel - Zoom level to validate
     * @returns {boolean} True if valid
     */
    isValidZoomLevel(zoomLevel) {
        return this.zptTemplates.hasOwnProperty(zoomLevel);
    }

    /**
     * Get zoom level hierarchy (from most detailed to least detailed)
     * @returns {Array<string>} Zoom levels in hierarchical order
     */
    getZoomLevelHierarchy() {
        return ['micro', 'entity', 'relationship', 'community', 'corpus'];
    }

    /**
     * Create drill-down query from higher to lower zoom level
     * @param {string} fromZoomLevel - Current zoom level
     * @param {string} entityId - Entity ID to drill down from
     * @returns {Object} Query configuration for drill-down
     */
    createDrillDownQuery(fromZoomLevel, entityId) {
        const hierarchy = this.getZoomLevelHierarchy();
        const currentIndex = hierarchy.indexOf(fromZoomLevel);

        if (currentIndex === -1 || currentIndex === 0) {
            throw new Error(`Cannot drill down from zoom level: ${fromZoomLevel}`);
        }

        const targetZoomLevel = hierarchy[currentIndex - 1];

        // Build filters based on the entity being drilled down from
        const filters = {};

        switch (fromZoomLevel) {
            case 'corpus':
                // When drilling down from corpus, show communities
                filters.entities = [entityId];
                break;
            case 'community':
                // When drilling down from community, show relationships within community
                filters.entities = [entityId];
                break;
            case 'relationship':
                // When drilling down from relationship, show entities involved
                filters.entities = [entityId];
                break;
            case 'entity':
                // When drilling down from entity, show micro-level content
                filters.entities = [entityId];
                break;
        }

        return {
            zoomLevel: targetZoomLevel,
            filters: filters,
            limit: 50 // Increased limit for drill-down
        };
    }

    /**
     * Create zoom-out query from lower to higher zoom level
     * @param {string} fromZoomLevel - Current zoom level
     * @param {Array<string>} entityIds - Entity IDs to zoom out from
     * @returns {Object} Query configuration for zoom-out
     */
    createZoomOutQuery(fromZoomLevel, entityIds = []) {
        const hierarchy = this.getZoomLevelHierarchy();
        const currentIndex = hierarchy.indexOf(fromZoomLevel);

        if (currentIndex === -1 || currentIndex === hierarchy.length - 1) {
            throw new Error(`Cannot zoom out from zoom level: ${fromZoomLevel}`);
        }

        const targetZoomLevel = hierarchy[currentIndex + 1];

        // Build filters to maintain context when zooming out
        const filters = {};
        if (entityIds.length > 0) {
            filters.entities = entityIds;
        }

        return {
            zoomLevel: targetZoomLevel,
            filters: filters,
            limit: 25 // Standard limit for zoom-out
        };
    }

    /**
     * Parse JSON value with error handling
     * @param {string} jsonStr - JSON string to parse
     * @returns {Object} Parsed object or empty object on error
     */
    _parseJsonValue(jsonStr) {
        if (!jsonStr || jsonStr === 'undefined') return {};
        try {
            return JSON.parse(jsonStr.trim());
        } catch (error) {
            logger.debug('Failed to parse JSON value:', error);
            return {};
        }
    }

    /**
     * Escape special characters in SPARQL strings
     * @param {string} str - String to escape
     * @returns {string} Escaped string
     */
    _escapeSparqlString(str) {
        if (typeof str !== 'string') {
            return String(str);
        }
        return str
            .replace(/\\/g, '\\\\')
            .replace(/"/g, '\\"')
            .replace(/\n/g, '\\n')
            .replace(/\r/g, '\\r')
            .replace(/\t/g, '\\t');
    }

    /**
     * Get template content for a specific zoom level
     * @param {string} zoomLevel - Zoom level
     * @returns {string} Template content
     */
    getTemplate(zoomLevel) {
        return this.zptTemplates[zoomLevel] || null;
    }

    /**
     * Dispose of ZPT resources
     */
    dispose() {
        logger.info('ZPT module disposed');
    }
}