/**
 * QueryTemplateManager.js - Manager for SPARQL query templates
 * 
 * This class provides template management for Wikidata SPARQL queries,
 * including parameter substitution, query validation, and template loading.
 * 
 * Key Features:
 * - Template parameter substitution
 * - Query validation and syntax checking
 * - Default parameter management
 * - Query composition and modification
 */

import fs from 'fs/promises';
import path from 'path';
import logger from 'loglevel';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default class QueryTemplateManager {
    constructor(options = {}) {
        this.options = {
            templateDir: options.templateDir || path.join(__dirname, 'queries'),
            defaultLanguage: options.defaultLanguage || 'en',
            defaultLimit: options.defaultLimit || 10,
            ...options
        };

        // Template cache
        this.templateCache = new Map();
        
        // Default parameter values
        this.defaultParams = {
            LANGUAGE: this.options.defaultLanguage,
            LIMIT: this.options.defaultLimit,
            MAX_DEPTH: 3,
            MIN_SHARED_PROPERTIES: 2,
            RADIUS_KM: 50
        };

        // Available template files
        this.availableTemplates = [
            'entitySearch',
            'entityProperties',
            'wikipediaMapping',
            'hierarchyRelations',
            'entityRelationships',
            'conceptDiscovery',
            'semanticSimilarity',
            'temporalEntities',
            'geospatialEntities'
        ];
    }

    /**
     * Load and process a query template
     * @param {string} templateName - Name of template file (without .sparql extension)
     * @param {Object} parameters - Parameter values for substitution
     * @returns {Promise<string>} Processed SPARQL query
     */
    async getQuery(templateName, parameters = {}) {
        try {
            // Load template if not cached
            if (!this.templateCache.has(templateName)) {
                await this.loadTemplate(templateName);
            }

            const template = this.templateCache.get(templateName);
            if (!template) {
                throw new Error(`Template not found: ${templateName}`);
            }

            // Merge with default parameters
            const mergedParams = {
                ...this.defaultParams,
                ...parameters
            };

            // Perform parameter substitution
            const processedQuery = this.substituteParameters(template, mergedParams);

            // Validate the resulting query
            this.validateQuery(processedQuery);

            return processedQuery;

        } catch (error) {
            logger.error(`Failed to process template ${templateName}:`, error.message);
            throw error;
        }
    }

    /**
     * Load template from file system
     * @param {string} templateName - Template name
     * @private
     */
    async loadTemplate(templateName) {
        try {
            const templatePath = path.join(this.options.templateDir, `${templateName}.sparql`);
            const templateContent = await fs.readFile(templatePath, 'utf-8');
            
            // Remove comments and clean whitespace
            const cleanedTemplate = this.cleanTemplate(templateContent);
            
            this.templateCache.set(templateName, cleanedTemplate);
            logger.debug(`Loaded template: ${templateName}`);

        } catch (error) {
            throw new Error(`Failed to load template ${templateName}: ${error.message}`);
        }
    }

    /**
     * Clean template by removing comments and normalizing whitespace
     * @param {string} template - Raw template content
     * @returns {string} Cleaned template
     * @private
     */
    cleanTemplate(template) {
        return template
            .split('\n')
            .filter(line => !line.trim().startsWith('#'))  // Remove comment lines
            .join('\n')
            .replace(/\s+/g, ' ')  // Normalize whitespace
            .trim();
    }

    /**
     * Substitute parameters in template
     * @param {string} template - Template string
     * @param {Object} parameters - Parameter values
     * @returns {string} Template with substituted parameters
     * @private
     */
    substituteParameters(template, parameters) {
        let result = template;

        // Replace parameter placeholders
        for (const [key, value] of Object.entries(parameters)) {
            const placeholder = `{${key}}`;
            const escapedValue = this.escapeParameterValue(value, key);
            result = result.replace(new RegExp(placeholder, 'g'), escapedValue);
        }

        // Check for remaining unsubstituted parameters
        const remainingParams = result.match(/{[A-Z_]+}/g);
        if (remainingParams) {
            logger.warn(`Unsubstituted parameters found: ${remainingParams.join(', ')}`);
        }

        return result;
    }

    /**
     * Escape parameter values for SPARQL safety
     * @param {*} value - Parameter value
     * @param {string} paramName - Parameter name for context
     * @returns {string} Escaped value
     * @private
     */
    escapeParameterValue(value, paramName) {
        if (value === null || value === undefined) {
            return '';
        }

        const stringValue = String(value);

        // Handle numeric parameters
        if (['LIMIT', 'MAX_DEPTH', 'MIN_SHARED_PROPERTIES', 'RADIUS_KM'].includes(paramName)) {
            return stringValue;
        }

        // Handle entity IDs (should not have quotes)
        if (paramName === 'ENTITY_ID') {
            return stringValue.replace(/[^A-Za-z0-9]/g, ''); // Clean entity ID
        }

        // Handle search terms and text (escape quotes)
        return stringValue.replace(/"/g, '\\"').replace(/\\/g, '\\\\');
    }

    /**
     * Basic SPARQL query validation
     * @param {string} query - SPARQL query to validate
     * @private
     */
    validateQuery(query) {
        // Basic syntax checks
        const requiredKeywords = ['SELECT', 'WHERE'];
        const hasRequiredKeywords = requiredKeywords.every(keyword => 
            query.toUpperCase().includes(keyword)
        );

        if (!hasRequiredKeywords) {
            throw new Error('Query missing required SPARQL keywords (SELECT, WHERE)');
        }

        // Check for balanced braces
        const openBraces = (query.match(/{/g) || []).length;
        const closeBraces = (query.match(/}/g) || []).length;

        if (openBraces !== closeBraces) {
            throw new Error('Unbalanced braces in SPARQL query');
        }
    }

    /**
     * Get available template names
     * @returns {Array<string>} List of available template names
     */
    getAvailableTemplates() {
        return [...this.availableTemplates];
    }

    /**
     * Get template metadata (parameters, description)
     * @param {string} templateName - Template name
     * @returns {Promise<Object>} Template metadata
     */
    async getTemplateMetadata(templateName) {
        try {
            if (!this.templateCache.has(templateName)) {
                await this.loadTemplate(templateName);
            }

            const template = this.templateCache.get(templateName);
            const parameters = this.extractParameters(template);

            return {
                name: templateName,
                parameters: parameters,
                description: this.getTemplateDescription(templateName),
                category: this.getTemplateCategory(templateName)
            };

        } catch (error) {
            throw new Error(`Failed to get metadata for template ${templateName}: ${error.message}`);
        }
    }

    /**
     * Extract parameter placeholders from template
     * @param {string} template - Template content
     * @returns {Array<string>} Parameter names
     * @private
     */
    extractParameters(template) {
        const paramMatches = template.match(/{[A-Z_]+}/g) || [];
        return [...new Set(paramMatches.map(match => match.slice(1, -1)))];
    }

    /**
     * Get template description
     * @param {string} templateName - Template name
     * @returns {string} Template description
     * @private
     */
    getTemplateDescription(templateName) {
        const descriptions = {
            entitySearch: 'Search for Wikidata entities by text with scoring',
            entityProperties: 'Retrieve properties and values for a specific entity',
            wikipediaMapping: 'Map Wikipedia article titles to Wikidata entities',
            hierarchyRelations: 'Explore instance-of and subclass-of relationships',
            entityRelationships: 'Discover all direct relationships for an entity',
            conceptDiscovery: 'Find entities related to concept terms',
            semanticSimilarity: 'Find semantically similar entities through shared properties',
            temporalEntities: 'Find entities with temporal constraints and dates',
            geospatialEntities: 'Find entities with geographic coordinates and locations'
        };

        return descriptions[templateName] || 'No description available';
    }

    /**
     * Get template category for organization
     * @param {string} templateName - Template name
     * @returns {string} Template category
     * @private
     */
    getTemplateCategory(templateName) {
        const categories = {
            entitySearch: 'search',
            entityProperties: 'entity',
            wikipediaMapping: 'mapping',
            hierarchyRelations: 'relationships',
            entityRelationships: 'relationships',
            conceptDiscovery: 'search',
            semanticSimilarity: 'similarity',
            temporalEntities: 'temporal',
            geospatialEntities: 'geospatial'
        };

        return categories[templateName] || 'general';
    }

    /**
     * Clear template cache
     */
    clearCache() {
        this.templateCache.clear();
        logger.debug('Template cache cleared');
    }

    /**
     * Preload all available templates
     * @returns {Promise<void>}
     */
    async preloadTemplates() {
        const loadPromises = this.availableTemplates.map(templateName => 
            this.loadTemplate(templateName).catch(error => {
                logger.warn(`Failed to preload template ${templateName}:`, error.message);
            })
        );

        await Promise.all(loadPromises);
        logger.info(`Preloaded ${this.templateCache.size} templates`);
    }
}