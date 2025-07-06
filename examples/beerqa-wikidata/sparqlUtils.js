/**
 * sparqlUtils.js - Shared SPARQL utilities for BeerQA-Wikidata examples
 */

import path from 'path';
import { fileURLToPath } from 'url';
import { createQueryService } from '../../src/services/sparql/index.js';
import SPARQLHelper from '../../src/services/sparql/SPARQLHelper.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Create configured SPARQL query service for BeerQA-Wikidata examples
 */
export function createBeerQAQueryService() {
    return createQueryService({
        queryPath: path.join(__dirname, 'sparql/queries'),
        templatePath: path.join(__dirname, 'sparql/templates'),
        configPath: path.join(__dirname, 'sparql/config'),
        cacheOptions: {
            maxSize: 50,
            ttl: 1800000, // 30 minutes
            enableFileWatch: true
        }
    });
}

/**
 * Standard graph URIs used across BeerQA-Wikidata examples
 */
export const GRAPH_URIS = {
    beerqa: 'http://purl.org/stuff/beerqa/test',
    wikipedia: 'http://purl.org/stuff/wikipedia/research',
    wikidata: 'http://purl.org/stuff/wikidata/research',
    navigation: 'http://purl.org/stuff/navigation/enhanced'
};

/**
 * Create SPARQL Helper with standard configuration
 */
export function createSPARQLHelper(config) {
    const storageOptions = config.get('storage.options');
    
    return new SPARQLHelper(storageOptions.update, {
        auth: {
            user: storageOptions.user || 'admin',
            password: storageOptions.password || 'admin123'
        },
        timeout: 30000
    });
}

/**
 * Format question filter for SPARQL queries
 */
export function formatQuestionFilter(questionText) {
    if (!questionText) {
        return '';
    }
    
    const escapedQuestion = SPARQLHelper.escapeString(questionText.toLowerCase());
    return `FILTER(LCASE(?questionText) = "${escapedQuestion}" || CONTAINS(LCASE(?questionText), "${escapedQuestion}"))`;
}

/**
 * Format entity list for SPARQL IN clause
 */
export function formatEntityList(entityURIs) {
    if (!entityURIs || entityURIs.length === 0) {
        return '';
    }
    
    return entityURIs.map(uri => `<${uri}>`).join(', ');
}

/**
 * Format limit clause for SPARQL queries
 */
export function formatLimit(limit) {
    return limit ? `LIMIT ${limit}` : '';
}

/**
 * Format search filter for text matching
 */
export function formatSearchFilter(searchTerm, field = '?label') {
    if (!searchTerm) {
        return '';
    }
    
    const escapedTerm = SPARQLHelper.escapeString(searchTerm.toLowerCase());
    return `FILTER(CONTAINS(LCASE(${field}), "${escapedTerm}"))`;
}

/**
 * Format XSD DateTime for SPARQL
 */
export function formatTimestamp(date = new Date()) {
    return date.toISOString();
}

/**
 * Create batch triples for INSERT operations
 */
export function formatTriplesBatch(triples) {
    if (Array.isArray(triples)) {
        return triples.join('\n        ');
    }
    return triples;
}

/**
 * Standard entity types used in queries
 */
export const ENTITY_TYPES = {
    corpuscle: 'ragno:Corpuscle',
    entity: 'ragno:Entity',
    relationship: 'ragno:Relationship'
};

/**
 * Generate relationship URI
 */
export function generateRelationshipURI(sourceURI, targetURI, relationshipType) {
    const sourceHash = sourceURI.split('/').pop();
    const targetHash = targetURI.split('/').pop();
    return `http://purl.org/stuff/navigation/enhanced/rel_${sourceHash}_${targetHash}_${relationshipType}`;
}

/**
 * Helper for executing queries with error handling
 */
export async function executeQueryWithErrorHandling(queryService, queryName, params, sparqlHelper) {
    try {
        const query = await queryService.getQuery(queryName, params);
        
        // Determine if it's a SELECT or UPDATE query by looking at the actual query content
        const trimmedQuery = query.trim().toUpperCase();
        const isSelect = trimmedQuery.startsWith('SELECT') || 
                        trimmedQuery.startsWith('ASK') || 
                        trimmedQuery.startsWith('CONSTRUCT') || 
                        trimmedQuery.startsWith('DESCRIBE');
        
        if (isSelect) {
            return await sparqlHelper.executeSelect(query);
        } else {
            return await sparqlHelper.executeUpdate(query);
        }
    } catch (error) {
        return {
            success: false,
            error: error.message,
            queryName,
            params
        };
    }
}

/**
 * Helper for executing SELECT queries specifically
 */
export async function executeSelectQuery(queryService, queryName, params, sparqlHelper) {
    try {
        const query = await queryService.getQuery(queryName, params);
        return await sparqlHelper.executeSelect(query);
    } catch (error) {
        return {
            success: false,
            error: error.message,
            queryName,
            params
        };
    }
}

/**
 * Helper for executing UPDATE queries specifically
 */
export async function executeUpdateQuery(queryService, queryName, params, sparqlHelper) {
    try {
        const query = await queryService.getQuery(queryName, params);
        return await sparqlHelper.executeUpdate(query);
    } catch (error) {
        return {
            success: false,
            error: error.message,
            queryName,
            params
        };
    }
}