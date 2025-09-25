import { SPARQL_CONFIG } from '../../../config/preferences.js'
import { createUnifiedLogger } from '../../utils/LoggingConfig.js'
import { VectorOperations } from '../../core/Vectors.js'

// Use unified STDIO-aware logger
const logger = createUnifiedLogger('search');

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
    async findSimilarElements(queryEmbedding, limit = SPARQL_CONFIG.SIMILARITY.DEFAULT_LIMIT, threshold = SPARQL_CONFIG.SIMILARITY.DEFAULT_THRESHOLD, filters = {}) {
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
            logger.info(`🔍 Search DEBUG: Found ${bindingsToProcess.length} total bindings, threshold: ${threshold}`)

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
                        logger.info(`🔍 RAGNO format embedding found, length: ${embeddingStr.length}`)
                        // Add protection against extremely large JSON strings that could cause segfaults
                        if (embeddingStr.length > SPARQL_CONFIG.SIMILARITY.MAX_EMBEDDING_STRING_LENGTH) {
                            logger.warn(`Skipping embedding parsing - string too large: ${embeddingStr.length} chars`)
                            continue
                        }
                        embedding = JSON.parse(embeddingStr)
                    } else if (binding.embedding?.value && binding.embedding.value !== 'undefined' && binding.embedding.type === 'literal') {
                        // Semem format: embedding value is the JSON array string
                        const embeddingStr = binding.embedding.value.trim()
                        logger.info(`🔍 SEMEM format embedding found, type: ${binding.embedding.type}, length: ${embeddingStr.length}`)
                        // Add protection against extremely large JSON strings that could cause segfaults
                        if (embeddingStr.length > SPARQL_CONFIG.SIMILARITY.MAX_EMBEDDING_STRING_LENGTH) {
                            logger.warn(`Skipping embedding parsing - string too large: ${embeddingStr.length} chars`)
                            continue
                        }
                        embedding = JSON.parse(embeddingStr)
                    } else {
                        logger.info(`🔍 SKIPPING binding - embedding format not recognized:`, {
                            hasEmbeddingVector: !!binding.embeddingVector?.value,
                            embeddingVectorValue: binding.embeddingVector?.value === 'undefined' ? 'undefined' : (binding.embeddingVector?.value ? 'present' : 'missing'),
                            hasEmbedding: !!binding.embedding?.value,
                            embeddingValue: binding.embedding?.value === 'undefined' ? 'undefined' : (binding.embedding?.value ? 'present' : 'missing'),
                            embeddingType: binding.embedding?.type,
                            bindingKeys: Object.keys(binding)
                        })
                    }

                    if (embedding.length > 0) {
                        // Calculate similarity using core vector operations
                        const similarity = VectorOperations.cosineSimilarity(queryEmbedding, embedding)
                        logger.info(`🔍 Calculated similarity: ${similarity.toFixed(4)}, threshold: ${threshold}, passes: ${similarity >= threshold}`)

                        if (similarity >= threshold) {
                            const element = {
                                id: binding.uri?.value || binding.entity?.value,
                                content: binding.content?.value || binding.label?.value,
                                similarity: similarity,
                                metadata: {
                                    type: binding.type?.value,
                                    timestamp: binding.timestamp?.value
                                }
                            }
                            logger.info(`🔍 ADDED to results: ${element.content?.substring(0, 50)}... (similarity: ${similarity.toFixed(4)})`)
                            similarElements.push(element)
                        }
                    } else {
                        logger.info(`🔍 SKIPPED - no embedding data, length: ${embedding.length}`)
                    }
                } catch (embeddingParseError) {
                    logger.warn('Failed to parse embedding from SPARQL result:', embeddingParseError.message)
                    continue
                }
            }

            // Sort by similarity (highest first)
            similarElements.sort((a, b) => b.similarity - a.similarity)
            logger.info(`🔍 Search FINAL: Returning ${similarElements.length} results from ${bindingsToProcess.length} bindings`)

            return similarElements.slice(0, maxLimit)
        } catch (error) {
            logger.error('Error in findSimilarElements:', error.message)
            throw error
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
        return VectorOperations.isValidEmbedding(embedding);
    }

    /**
     * Dispose of search resources
     */
    dispose() {
        logger.info('Search module disposed');
    }
}

export default Search