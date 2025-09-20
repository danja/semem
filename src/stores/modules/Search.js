import logger from 'loglevel'
import { SPARQL_CONFIG } from '../../../config/preferences.js'

/**
 * Search module handles search functionality for SPARQL stores
 * Responsible for similarity search, filtering, and result processing
 */
export class Search {
    constructor(sparqlExecute, vectors, graphName) {
        this.sparqlExecute = sparqlExecute
        this.vectors = vectors
        this.graphName = graphName
    }

    /**
     * Find similar elements using vector similarity search
     * @param {Array<number>} queryEmbedding - Query embedding vector
     * @param {number} limit - Maximum number of results
     * @param {number} threshold - Similarity threshold
     * @param {Object} filters - Search filters
     * @returns {Array} Similar elements
     */
    async findSimilarElements(queryEmbedding, limit = SPARQL_CONFIG.SIMILARITY.DEFAULT_LIMIT, threshold = SPARQL_CONFIG.SIMILARITY.FINDALL_THRESHOLD, filters = {}) {
        // Add protective limits to prevent segfaults using configuration
        const maxLimit = Math.min(limit, SPARQL_CONFIG.SIMILARITY.MAX_QUERY_LIMIT)
        const maxResultsToProcess = Math.min(limit * 2, SPARQL_CONFIG.SIMILARITY.MAX_RESULTS_TO_PROCESS)

        const embeddingStr = JSON.stringify(queryEmbedding)
        const filterClauses = this.buildFilterClauses(filters)

        // Build semantic search query directly since we need to use existing patterns
        const query = `
            PREFIX ragno: <http://purl.org/stuff/ragno/>
            PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
            PREFIX dcterms: <http://purl.org/dc/terms/>
            PREFIX semem: <http://purl.org/stuff/semem/>

            SELECT ?uri ?content ?embedding ?embeddingVector ?label ?type ?timestamp
            FROM <${this.graphName}>
            WHERE {
                {
                    # Search in ragno:Element objects (old format)
                    ?uri a ragno:Element ;
                        skos:prefLabel ?label ;
                        ragno:content ?content ;
                        ragno:embedding ?embedding .
                    OPTIONAL { ?uri ragno:timestamp ?timestamp }
                    OPTIONAL { ?uri ragno:type ?type }
                } UNION {
                    # Search in ragno:Unit chunks (new format)
                    ?uri a ragno:Unit ;
                        ragno:content ?content .
                    ?uri ragno:hasEmbedding ?embeddingUri .
                    ?embeddingUri ragno:vectorContent ?embeddingVector .
                    OPTIONAL { ?uri dcterms:created ?timestamp }
                    BIND("Chunk" AS ?type)
                    BIND(?content AS ?label)
                } UNION {
                    # Search in ragno:Concept embeddings (new format)
                    ?uri a ragno:Concept ;
                        skos:prefLabel ?label .
                    ?uri ragno:hasEmbedding ?embeddingUri .
                    ?embeddingUri ragno:vectorContent ?embeddingVector .
                    OPTIONAL { ?uri dcterms:created ?timestamp }
                    BIND("Concept" AS ?type)
                    BIND(?label AS ?content)
                } UNION {
                    # Search in semem:Interaction objects (memory interactions)
                    ?uri a semem:Interaction ;
                        semem:prompt ?label ;
                        semem:output ?content ;
                        semem:embedding ?embedding .
                    OPTIONAL { ?uri semem:timestamp ?timestamp }
                    BIND("Interaction" AS ?type)
                }
                ${filterClauses}
            }
            LIMIT ${maxResultsToProcess}
        `

        try {
            // Add timeout to prevent hanging queries using configuration
            const queryPromise = this.sparqlExecute.executeSparqlQuery(query)
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Query timeout')), SPARQL_CONFIG.SIMILARITY.QUERY_TIMEOUT_MS)
            )

            const result = await Promise.race([queryPromise, timeoutPromise])
            const similarElements = []
            let processedCount = 0

            // Limit processing to prevent memory exhaustion using configuration
            const bindingsToProcess = result.results.bindings.slice(0, maxResultsToProcess)

            for (const binding of bindingsToProcess) {
                // Add progress check to prevent hanging loops using configuration
                if (processedCount++ > SPARQL_CONFIG.SIMILARITY.MAX_PROCESSING_ITERATIONS) {
                    logger.warn(`Limiting similarity search processing to ${SPARQL_CONFIG.SIMILARITY.MAX_PROCESSING_ITERATIONS} results to prevent memory issues`)
                    break
                }

                try {
                    let embedding = []

                    // Handle two embedding formats:
                    // 1. semem vocabulary: embedding value is JSON array string
                    // 2. ragno vocabulary: embedding is URI, embeddingVector has the actual vector
                    if (binding.embeddingVector?.value && binding.embeddingVector.value !== 'undefined') {
                        // Ragno format: embedding stored as URI reference with vector data
                        const embeddingStr = binding.embeddingVector.value.trim()
                        // Add protection against extremely large JSON strings that could cause segfaults
                        if (embeddingStr.length > SPARQL_CONFIG.SIMILARITY.MAX_EMBEDDING_STRING_LENGTH) {
                            logger.warn(`Skipping embedding parsing - string too large: ${embeddingStr.length} chars`)
                            continue
                        }
                        embedding = JSON.parse(embeddingStr)
                    } else if (binding.embedding?.value && binding.embedding.value !== 'undefined' && binding.embedding.type === 'literal') {
                        // Semem format: embedding value is the JSON array string
                        const embeddingStr = binding.embedding.value.trim()
                        // Add protection against extremely large JSON strings that could cause segfaults
                        if (embeddingStr.length > SPARQL_CONFIG.SIMILARITY.MAX_EMBEDDING_STRING_LENGTH) {
                            logger.warn(`Skipping embedding parsing - string too large: ${embeddingStr.length} chars`)
                            continue
                        }
                        embedding = JSON.parse(embeddingStr)
                    }

                    if (embedding.length > 0) {
                        // Calculate similarity using vectors module
                        const similarity = this.vectors.calculateCosineSimilarity(queryEmbedding, embedding)

                        if (similarity >= threshold) {
                            similarElements.push({
                                id: binding.uri?.value || binding.entity?.value,
                                content: binding.content?.value || binding.label?.value,
                                similarity: similarity,
                                metadata: {
                                    type: binding.type?.value,
                                    timestamp: binding.timestamp?.value
                                }
                            })
                        }
                    }
                } catch (embeddingParseError) {
                    logger.warn('Failed to parse embedding from SPARQL result:', embeddingParseError.message)
                    continue
                }
            }

            // Sort by similarity (highest first)
            similarElements.sort((a, b) => b.similarity - a.similarity)

            return similarElements.slice(0, maxLimit)
        } catch (error) {
            logger.error('Error in findSimilarElements:', error.message)
            throw error
        }
    }

    /**
     * Search for content using SPARQL with similarity scoring
     * @param {Array<number>} queryEmbedding - Query embedding vector
     * @param {number} limit - Maximum number of results
     * @param {number} threshold - Similarity threshold
     * @returns {Array} Search results
     */
    async search(queryEmbedding, limit = SPARQL_CONFIG.SIMILARITY.DEFAULT_LIMIT, threshold = SPARQL_CONFIG.SIMILARITY.DEFAULT_THRESHOLD) {
        logger.info(`🔍 Search called with embedding length: ${queryEmbedding.length}, limit: ${limit}, threshold: ${threshold}`)

        const searchQuery = `
            PREFIX ragno: <http://purl.org/stuff/ragno/>
            PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
            PREFIX dcterms: <http://purl.org/dc/terms/>
            PREFIX semem: <http://purl.org/stuff/semem/>

            SELECT ?entity ?prompt ?content ?embedding ?timestamp ?type ?format ?response
            FROM <${this.graphName}>
            WHERE {
                {
                    # Search in regular ragno:Element objects (old format) - DEPRECATED
                    ?entity a ragno:Element ;
                        skos:prefLabel ?prompt ;
                        ragno:content ?content ;
                        ragno:embedding ?embedding ;
                        ragno:timestamp ?timestamp .
                    OPTIONAL { ?entity ragno:type ?type }
                    BIND("old" AS ?format)
                    BIND(?content AS ?response)
                } UNION {
                    # Search in ragno:Unit chunks (new format)
                    ?entity a ragno:Unit ;
                        ragno:content ?content .
                    ?entity ragno:hasEmbedding ?embeddingUri .
                    ?embeddingUri ragno:vectorContent ?embedding .
                    OPTIONAL { ?entity dcterms:created ?timestamp }
                    BIND("Chunk" AS ?type)
                    BIND("new" AS ?format)
                    BIND(CONCAT("Document chunk: ", SUBSTR(?content, 1, 50), "...") AS ?prompt)
                    BIND(?content AS ?response)
                } UNION {
                    # Search in ragno:Concept embeddings (new format)
                    ?entity a ragno:Concept ;
                        skos:prefLabel ?prompt .
                    ?entity ragno:hasEmbedding ?embeddingUri .
                    ?embeddingUri ragno:vectorContent ?embedding .
                    OPTIONAL { ?entity dcterms:created ?timestamp }
                    BIND("Concept" AS ?type)
                    BIND("new" AS ?format)
                    BIND(?prompt AS ?content)
                    BIND(?prompt AS ?response)
                } UNION {
                    # Search in semem:Interaction objects (memory interactions)
                    ?entity a semem:Interaction ;
                        semem:prompt ?prompt ;
                        semem:output ?response ;
                        semem:embedding ?embedding ;
                        semem:timestamp ?timestamp .
                    BIND("Interaction" AS ?type)
                    BIND("memory" AS ?format)
                    BIND(CONCAT(?prompt, " ", ?response) AS ?content)
                }
            }
            LIMIT ${limit * 2}
        `

        try {
            const result = await this.sparqlExecute.executeSparqlQuery(searchQuery)
            const searchResults = []

            for (const binding of result.results.bindings) {
                try {
                    let embedding = []
                    if (binding.embedding?.value && binding.embedding.value !== 'undefined') {
                        try {
                            const embeddingStr = binding.embedding.value.trim()
                            // Handle both formats: direct JSON array or vector content with brackets
                            if (embeddingStr.startsWith('[') && embeddingStr.endsWith(']')) {
                                embedding = JSON.parse(embeddingStr)
                            } else {
                                // Try to parse as simple comma-separated values wrapped in brackets
                                const cleaned = embeddingStr.replace(/^\[|\]$/g, '')
                                embedding = cleaned.split(',').map(x => parseFloat(x.trim())).filter(x => !isNaN(x))
                            }
                        } catch (embeddingError) {
                            logger.debug('Invalid embedding format in search (using default):', embeddingError.message)
                        }
                    }

                    // Enhanced similarity calculation (cosine similarity)
                    let similarity = SPARQL_CONFIG.HEALTH.FAILED_SIMILARITY_SCORE
                    logger.info(`📐 Processing embedding: queryLen=${queryEmbedding.length}, storedLen=${embedding.length}, entity=${binding.entity.value}`)

                    if (embedding.length > 0 && queryEmbedding.length > 0) {
                        if (embedding.length === queryEmbedding.length) {
                            // Exact length match - use full cosine similarity
                            similarity = this.vectors.calculateCosineSimilarity(queryEmbedding, embedding)
                            logger.info(`✅ Exact length match similarity: ${similarity}`)
                        } else {
                            // Length mismatch - try to salvage by truncating/padding to match
                            logger.info(`⚠️ Embedding length mismatch: query=${queryEmbedding.length}, stored=${embedding.length}, attempting repair`)
                            const adjustedEmbedding = this.vectors.adjustEmbeddingLength(embedding, queryEmbedding.length)
                            similarity = this.vectors.calculateCosineSimilarity(queryEmbedding, adjustedEmbedding)
                            logger.info(`🔧 Adjusted length similarity: ${similarity}`)
                        }
                    } else {
                        logger.info(`❌ Empty embeddings: queryLen=${queryEmbedding.length}, storedLen=${embedding.length}`)
                    }

                    logger.info(`🎯 Final similarity: ${similarity}, threshold: ${threshold}, passes: ${similarity >= threshold}`)

                    if (similarity >= threshold) {
                        const format = binding.format?.value || 'unknown'

                        // Log deprecation warning for old format
                        if (format === 'old') {
                            logger.warn('DEPRECATED: Found result using old ragno:embedding format. Consider migrating to ragno:hasEmbedding → ragno:vectorContent pattern.', {
                                entity: binding.entity.value,
                                type: binding.type?.value
                            })
                        }

                        searchResults.push({
                            id: binding.entity.value,
                            prompt: binding.prompt.value,
                            response: binding.response?.value || binding.content.value,
                            similarity: similarity,
                            timestamp: binding.timestamp.value,
                            metadata: {
                                type: binding.type?.value || 'unknown',
                                format: format
                            }
                        })
                    }
                } catch (parseError) {
                    logger.error('Failed to parse search result:', parseError, binding)
                }
            }

            // Sort by format (new format first) then by similarity (highest first)
            searchResults.sort((a, b) => {
                // Prioritize new format over old format
                const formatPriorityA = a.metadata.format === 'new' ? 1 : 0
                const formatPriorityB = b.metadata.format === 'new' ? 1 : 0

                if (formatPriorityA !== formatPriorityB) {
                    return formatPriorityB - formatPriorityA // New format first
                }

                // If same format, sort by similarity
                return b.similarity - a.similarity
            })

            logger.info(`Found ${searchResults.length} similar items`)
            return searchResults.slice(0, limit)
        } catch (error) {
            logger.error('Error searching:', error)
            return []
        }
    }

    /**
     * Build SPARQL filter clauses from filter object
     * @param {Object} filters - Filter configuration
     * @returns {string} SPARQL filter clauses
     */
    buildFilterClauses(filters) {
        const clauses = []

        // Domain filtering
        if (filters.domains && filters.domains.length > 0) {
            const domainPattern = filters.domains.map(d => `"${this.escapeSparqlString(d)}"`).join('|')
            clauses.push(`FILTER(REGEX(?label, "${domainPattern}", "i"))`)
        }

        // Keyword filtering
        if (filters.keywords && filters.keywords.length > 0) {
            const keywordPattern = filters.keywords.map(k => `"${this.escapeSparqlString(k)}"`).join('|')
            clauses.push(`FILTER(REGEX(?content, "${keywordPattern}", "i") || REGEX(?label, "${keywordPattern}", "i"))`)
        }

        // Entity filtering
        if (filters.entities && filters.entities.length > 0) {
            const entityValues = filters.entities.map(e => `<${e}>`).join(' ')
            clauses.push(`VALUES ?relatedEntity { ${entityValues} }`)
            clauses.push(`?uri ragno:connectsTo ?relatedEntity`)
        }

        // Temporal filtering
        if (filters.temporal && (filters.temporal.start || filters.temporal.end)) {
            if (filters.temporal.start) {
                clauses.push(`FILTER(?timestamp >= "${filters.temporal.start}"^^xsd:dateTime)`)
            }
            if (filters.temporal.end) {
                clauses.push(`FILTER(?timestamp <= "${filters.temporal.end}"^^xsd:dateTime)`)
            }
        }

        // Geographic filtering (if coordinates provided)
        if (filters.geographic && filters.geographic.boundingBox) {
            const { north, south, east, west } = filters.geographic.boundingBox
            clauses.push(`
                ?uri geo:lat ?lat ; geo:long ?long .
                FILTER(?lat >= ${south} && ?lat <= ${north})
                FILTER(?long >= ${west} && ?long <= ${east})
            `)
        }

        // Similarity threshold filtering
        if (filters.similarityThreshold) {
            clauses.push(`FILTER(?similarity >= ${filters.similarityThreshold})`)
        }

        return clauses.join('\n                ')
    }

    /**
     * Escape SPARQL string literals
     * @param {string} str - String to escape
     * @returns {string} Escaped string
     */
    escapeSparqlString(str) {
        if (typeof str !== 'string') {
            return String(str)
        }

        // Limit string length to prevent SPARQL query explosion
        const MAX_SPARQL_STRING_LENGTH = 1000
        if (str.length > MAX_SPARQL_STRING_LENGTH) {
            str = str.substring(0, MAX_SPARQL_STRING_LENGTH)
        }

        return str
            .replace(/\\/g, '\\\\')     // Escape backslashes
            .replace(/"/g, '\\"')       // Escape quotes
            .replace(/\n/g, '\\n')      // Escape newlines
            .replace(/\r/g, '\\r')      // Escape carriage returns
            .replace(/\t/g, '\\t')      // Escape tabs
    }

    /**
     * Set graph name for searches
     * @param {string} graphName - Graph name
     */
    setGraphName(graphName) {
        this.graphName = graphName
    }

    /**
     * Get current graph name
     * @returns {string}
     */
    getGraphName() {
        return this.graphName
    }

    /**
     * Validate query embedding format and dimensions
     * @param {Array} embedding - Embedding to validate
     * @returns {boolean} True if valid
     */
    validateQueryEmbedding(embedding) {
        return Array.isArray(embedding) &&
               embedding.length > 0 && // Valid dimension from config
               embedding.every(val => typeof val === 'number' && !isNaN(val));
    }

    /**
     * Dispose of search resources
     */
    dispose() {
        logger.info('Search module disposed');
    }
}

export default Search