/**
 * SPARQLDocumentIngester - Read content from SPARQL endpoints and pass to MCP tell method
 * 
 * This service provides flexible ingestion of RDF content from SPARQL endpoints,
 * transforming results into documents that can be processed by the semem system.
 */

import fetch from 'node-fetch';
import logger from 'loglevel';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default class SPARQLDocumentIngester {
    /**
     * @param {Object} options - Configuration options
     * @param {string} options.endpoint - SPARQL query endpoint URL
     * @param {Object} options.auth - Authentication {user, password}
     * @param {string} options.templateDir - Directory containing SPARQL templates
     * @param {Object} options.fieldMappings - How to extract fields from SPARQL results
     * @param {number} options.timeout - Request timeout in ms
     * @param {number} options.batchSize - Number of documents to process at once
     */
    constructor(options = {}) {
        this.endpoint = options.endpoint;
        this.auth = options.auth || null;
        this.templateDir = options.templateDir || join(__dirname, '../../../config/sparql-templates');
        this.fieldMappings = options.fieldMappings || this.getDefaultFieldMappings();
        this.timeout = options.timeout || 30000;
        this.batchSize = options.batchSize || 50;
        
        this.stats = {
            queriesExecuted: 0,
            documentsFound: 0,
            documentsIngested: 0,
            errors: 0,
            startTime: null,
            endTime: null
        };
    }

    /**
     * Default field mappings for extracting document data from SPARQL results
     */
    getDefaultFieldMappings() {
        return {
            // Required fields
            uri: 'uri',           // Document URI
            title: 'title',       // Document title
            content: 'content',   // Main content
            
            // Optional fields  
            created: 'created',         // Creation date
            modified: 'modified',       // Last modified date
            slug: 'slug',              // URL slug
            relative: 'relative',      // Relative path
            author: 'author',          // Author
            description: 'description', // Description
            tags: 'tags',              // Tags/categories
            
            // Custom metadata fields can be added dynamically
        };
    }

    /**
     * Load a SPARQL query template from file
     * @param {string} templateName - Name of template (without .sparql extension)
     * @returns {string} - SPARQL query string
     */
    loadTemplate(templateName) {
        const templatePath = join(this.templateDir, `${templateName}.sparql`);
        
        if (!existsSync(templatePath)) {
            throw new Error(`SPARQL template not found: ${templatePath}`);
        }
        
        try {
            return readFileSync(templatePath, 'utf8');
        } catch (error) {
            throw new Error(`Failed to read SPARQL template ${templateName}: ${error.message}`);
        }
    }

    /**
     * Execute SPARQL query against endpoint
     * @param {string} query - SPARQL query string
     * @param {Object} variables - Variables to substitute in query
     * @returns {Promise<Array>} - Array of result bindings
     */
    async executeSparqlQuery(query, variables = {}) {
        try {
            // Substitute variables in query
            let processedQuery = query;
            for (const [key, value] of Object.entries(variables)) {
                const placeholder = `{{${key}}}`;
                // Handle null/undefined values appropriately
                let substitution;
                if (value === null || value === undefined) {
                    // For limit specifically, remove the entire LIMIT clause if null/undefined
                    if (key === 'limit') {
                        // Remove LIMIT clause entirely - matches "LIMIT {{limit}}" patterns
                        // This handles variations like "LIMIT {{limit}}", "LIMIT  {{limit}}", etc.
                        const escapedPlaceholder = placeholder.replace(/[{}]/g, '\\$&');
                        const limitPattern = new RegExp(`\\s*LIMIT\\s+${escapedPlaceholder}\\s*`, 'gi');
                        processedQuery = processedQuery.replace(limitPattern, '\n');
                        continue;
                    }
                    substitution = '';
                } else {
                    substitution = String(value);
                }
                processedQuery = processedQuery.replace(new RegExp(placeholder, 'g'), substitution);
            }

            logger.debug('Executing SPARQL query:', { endpoint: this.endpoint, query: processedQuery.substring(0, 200) + '...' });

            const headers = {
                'Accept': 'application/sparql-results+json',
                'Content-Type': 'application/sparql-query'
            };

            // Add authentication if provided
            if (this.auth) {
                const auth = Buffer.from(`${this.auth.user}:${this.auth.password}`).toString('base64');
                headers['Authorization'] = `Basic ${auth}`;
            }

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), this.timeout);

            const response = await fetch(this.endpoint, {
                method: 'POST',
                headers,
                body: processedQuery,
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`SPARQL query failed: ${response.status} - ${errorText}`);
            }

            const data = await response.json();
            this.stats.queriesExecuted++;
            
            logger.info(`SPARQL query executed successfully: ${data.results?.bindings?.length || 0} results`);
            return data.results?.bindings || [];

        } catch (error) {
            this.stats.errors++;
            if (error.name === 'AbortError') {
                throw new Error(`SPARQL query timeout after ${this.timeout}ms`);
            }
            throw new Error(`SPARQL query execution failed: ${error.message}`);
        }
    }

    /**
     * Transform SPARQL result binding to document object
     * @param {Object} binding - SPARQL result binding
     * @returns {Object} - Document object ready for MCP tell method
     */
    transformToDocument(binding) {
        const document = {
            metadata: {}
        };

        // Extract required fields
        document.uri = binding[this.fieldMappings.uri]?.value;
        document.title = binding[this.fieldMappings.title]?.value || 'Untitled Document';
        document.content = binding[this.fieldMappings.content]?.value || '';

        if (!document.uri) {
            throw new Error('Document URI is required but not found in SPARQL result');
        }

        if (!document.content.trim()) {
            logger.warn(`Document has empty content: ${document.uri}`);
        }

        // Extract optional fields into metadata
        for (const [field, sparqlVar] of Object.entries(this.fieldMappings)) {
            if (['uri', 'title', 'content'].includes(field)) continue; // Skip required fields
            
            const value = binding[sparqlVar]?.value;
            if (value) {
                document.metadata[field] = value;
            }
        }

        // Add source information
        document.metadata.sourceEndpoint = this.endpoint;
        document.metadata.ingestionTime = new Date().toISOString();
        document.metadata.documentType = 'sparql_ingested';

        return document;
    }

    /**
     * Ingest documents using a SPARQL template
     * @param {string} templateName - Name of SPARQL template to use
     * @param {Object} options - Ingestion options
     * @param {Object} options.variables - Variables to substitute in template
     * @param {number} options.limit - Maximum number of documents to ingest
     * @param {boolean} options.lazy - Use lazy processing (no immediate embedding/concepts)
     * @param {Function} options.tellFunction - MCP tell function to use
     * @param {Function} options.progressCallback - Called for each processed document
     * @returns {Promise<Object>} - Ingestion results with statistics
     */
    async ingestFromTemplate(templateName, options = {}) {
        const {
            variables = {},
            limit = 100,
            lazy = false,
            tellFunction,
            progressCallback
        } = options;

        if (!tellFunction || typeof tellFunction !== 'function') {
            throw new Error('tellFunction is required and must be a function');
        }

        this.stats = {
            queriesExecuted: 0,
            documentsFound: 0,
            documentsIngested: 0,
            errors: 0,
            startTime: new Date(),
            endTime: null
        };

        try {
            logger.info(`Starting SPARQL ingestion from template: ${templateName}`);

            // Load and execute query
            const query = this.loadTemplate(templateName);
            const queryVariables = { limit, ...variables };
            const bindings = await this.executeSparqlQuery(query, queryVariables);

            this.stats.documentsFound = bindings.length;
            logger.info(`Found ${bindings.length} documents to ingest`);

            // Process documents in batches
            const results = [];
            const errors = [];

            for (let i = 0; i < bindings.length; i += this.batchSize) {
                const batch = bindings.slice(i, i + this.batchSize);
                logger.debug(`Processing batch ${Math.floor(i / this.batchSize) + 1}/${Math.ceil(bindings.length / this.batchSize)}`);

                for (const binding of batch) {
                    try {
                        // Transform SPARQL result to document
                        const document = this.transformToDocument(binding);

                        // Call MCP tell function
                        const tellResult = await tellFunction({
                            content: document.content,
                            type: 'document',
                            metadata: {
                                title: document.title,
                                uri: document.uri,
                                ...document.metadata
                            },
                            lazy
                        });

                        if (tellResult.success) {
                            this.stats.documentsIngested++;
                            results.push({
                                uri: document.uri,
                                title: document.title,
                                success: true,
                                tellResult
                            });
                        } else {
                            this.stats.errors++;
                            errors.push({
                                uri: document.uri,
                                title: document.title,
                                error: tellResult.error || 'Tell function returned failure'
                            });
                        }

                        // Call progress callback if provided
                        if (progressCallback) {
                            progressCallback({
                                processed: this.stats.documentsIngested + this.stats.errors,
                                total: this.stats.documentsFound,
                                current: document,
                                success: tellResult.success
                            });
                        }

                    } catch (error) {
                        this.stats.errors++;
                        const errorInfo = {
                            binding,
                            error: error.message
                        };
                        errors.push(errorInfo);
                        logger.error('Failed to process document:', errorInfo);
                    }
                }
            }

            this.stats.endTime = new Date();
            
            logger.info(`SPARQL ingestion completed:`, {
                template: templateName,
                documentsFound: this.stats.documentsFound,
                documentsIngested: this.stats.documentsIngested,
                errors: this.stats.errors,
                duration: this.stats.endTime - this.stats.startTime + 'ms'
            });

            return {
                success: true,
                template: templateName,
                statistics: { ...this.stats },
                results,
                errors,
                duration: this.stats.endTime - this.stats.startTime
            };

        } catch (error) {
            this.stats.endTime = new Date();
            this.stats.errors++;
            
            logger.error('SPARQL ingestion failed:', error);
            
            return {
                success: false,
                template: templateName,
                error: error.message,
                statistics: { ...this.stats },
                duration: this.stats.endTime - this.stats.startTime
            };
        }
    }

    /**
     * Dry run - execute query and show what would be ingested without calling tell
     * @param {string} templateName - Name of SPARQL template to use
     * @param {Object} options - Options (same as ingestFromTemplate but no tellFunction)
     * @returns {Promise<Object>} - Preview of documents that would be ingested
     */
    async dryRun(templateName, options = {}) {
        const {
            variables = {},
            limit = 10  // Smaller default for preview
        } = options;

        try {
            logger.info(`Dry run for SPARQL template: ${templateName}`);

            const query = this.loadTemplate(templateName);
            const queryVariables = { limit, ...variables };
            const bindings = await this.executeSparqlQuery(query, queryVariables);

            const documents = [];
            for (const binding of bindings.slice(0, 5)) { // Show only first 5 for preview
                try {
                    const document = this.transformToDocument(binding);
                    documents.push({
                        uri: document.uri,
                        title: document.title,
                        contentPreview: document.content.substring(0, 200) + '...',
                        metadata: document.metadata
                    });
                } catch (error) {
                    documents.push({
                        error: error.message,
                        binding
                    });
                }
            }

            return {
                success: true,
                template: templateName,
                query: query.substring(0, 500) + '...',
                variables: queryVariables,
                totalFound: bindings.length,
                preview: documents
            };

        } catch (error) {
            return {
                success: false,
                template: templateName,
                error: error.message
            };
        }
    }

    /**
     * Get ingestion statistics
     */
    getStatistics() {
        return { ...this.stats };
    }
}