/**
 * DualSearch.js - Combined Exact Match and Vector Similarity Search
 * 
 * This module implements the dual search system that combines SPARQL-based
 * exact matching with HNSW vector similarity search. It integrates with
 * Personalized PageRank for graph traversal and provides unified result
 * ranking across different search strategies.
 * 
 * Key Features:
 * - Query entity extraction using LLM
 * - Exact matching for entities and attributes via SPARQL
 * - Vector similarity search for retrievable content types
 * - PPR-based graph traversal and cross-type discovery
 * - Unified result ranking and assembly
 */

import rdf from 'rdf-ext'
import VectorIndex from './VectorIndex.js'
import { PersonalizedPageRank } from '../algorithms/index.js'
import SPARQLHelpers from '../../utils/SPARQLHelpers.js'
import { logger } from '../../Utils.js'

export default class DualSearch {
    constructor(options = {}) {
        this.options = {
            // Search configuration
            exactMatchTypes: options.exactMatchTypes || ['ragno:Entity', 'ragno:Attribute'],
            vectorSimilarityTypes: options.vectorSimilarityTypes || [
                'ragno:Unit', 
                'ragno:Attribute', 
                'ragno:CommunityElement',
                'ragno:TextElement'
            ],
            
            // Vector search parameters
            vectorSimilarityK: options.vectorSimilarityK || 10,
            similarityThreshold: options.similarityThreshold || 0.7,
            
            // PPR parameters
            pprAlpha: options.pprAlpha || 0.15,
            pprIterations: options.pprIterations || 2,
            topKPerType: options.topKPerType || 5,
            
            // Result ranking weights
            exactMatchWeight: options.exactMatchWeight || 1.0,
            vectorSimilarityWeight: options.vectorSimilarityWeight || 0.8,
            pprWeight: options.pprWeight || 0.6,
            
            // Query processing
            queryExpansion: options.queryExpansion || true,
            maxQueryEntities: options.maxQueryEntities || 5,
            
            ...options
        }
        
        // Initialize components
        this.vectorIndex = options.vectorIndex || null
        this.personalizedPageRank = new PersonalizedPageRank(this.options)
        this.sparqlEndpoint = options.sparqlEndpoint || null
        this.llmHandler = options.llmHandler || null
        this.embeddingHandler = options.embeddingHandler || null
        
        // Search statistics
        this.stats = {
            totalSearches: 0,
            exactMatches: 0,
            vectorMatches: 0,
            pprTraversals: 0,
            averageSearchTime: 0,
            lastSearch: null
        }
        
        logger.info('DualSearch system initialized')
    }
    
    /**
     * Main dual search interface
     * @param {string} query - Natural language search query
     * @param {Object} [options] - Search options
     * @returns {Object} Combined search results
     */
    async search(query, options = {}) {
        const startTime = Date.now()
        logger.info(`Dual search: "${query}"`)
        
        const searchOptions = { ...this.options, ...options }
        const searchId = `search_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        
        try {
            // Phase 1: Query processing and entity extraction
            const queryData = await this.processQuery(query, searchOptions)
            
            // Phase 2: Parallel search execution
            const [exactResults, vectorResults] = await Promise.all([
                this.performExactMatch(queryData, searchOptions),
                this.performVectorSimilarity(queryData, searchOptions)
            ])
            
            // Phase 3: PPR traversal for graph discovery
            let pprResults = null
            if (queryData.entities.length > 0) {
                pprResults = await this.performPPRTraversal(queryData.entities, searchOptions)
            }
            
            // Phase 4: Result combination and ranking
            const combinedResults = this.combineSearchResults({
                query: queryData,
                exact: exactResults,
                vector: vectorResults,
                ppr: pprResults
            }, searchOptions)
            
            // Update statistics
            const searchTime = Date.now() - startTime
            this.updateSearchStatistics(searchTime, exactResults, vectorResults, pprResults)
            
            logger.info(`Dual search completed in ${searchTime}ms: ${combinedResults.totalResults} results`)
            
            return {
                searchId,
                query: queryData.originalQuery,
                totalResults: combinedResults.totalResults,
                results: combinedResults.rankedResults,
                breakdown: {
                    exactMatches: exactResults.length,
                    vectorMatches: vectorResults.length,
                    pprNodes: pprResults?.rankedNodes?.length || 0
                },
                processingTime: searchTime,
                timestamp: new Date()
            }
            
        } catch (error) {
            logger.error(`Dual search failed for query "${query}":`, error)
            throw error
        }
    }
    
    /**
     * Process natural language query to extract entities and generate embeddings
     * @param {string} query - Original query string
     * @param {Object} options - Processing options
     * @returns {Object} Processed query data
     */
    async processQuery(query, options = {}) {
        logger.debug('Processing query for entity extraction...')
        
        const queryData = {
            originalQuery: query,
            entities: [],
            embedding: null,
            expandedTerms: [],
            confidence: 0.0
        }
        
        try {
            // Extract entities using LLM if available
            if (this.llmHandler) {
                const entityExtractionPrompt = this.buildEntityExtractionPrompt(query)
                const llmResponse = await this.llmHandler.generateCompletion(entityExtractionPrompt, {
                    max_tokens: 200,
                    temperature: 0.1
                })
                
                queryData.entities = this.parseEntityExtractionResponse(llmResponse)
                queryData.entities = queryData.entities.slice(0, options.maxQueryEntities || 5)
            }
            
            // Generate query embedding if embedding handler available
            if (this.embeddingHandler) {
                queryData.embedding = await this.embeddingHandler.generateEmbedding(query)
            }
            
            // Query expansion if enabled
            if (options.queryExpansion && queryData.entities.length > 0) {
                queryData.expandedTerms = await this.expandQueryTerms(queryData.entities)
            }
            
            queryData.confidence = this.calculateQueryConfidence(queryData)
            
            logger.debug(`Query processed: ${queryData.entities.length} entities, embedding: ${!!queryData.embedding}`)
            return queryData
            
        } catch (error) {
            logger.warn('Query processing failed, using fallback:', error.message)
            
            // Fallback: split query into potential entity terms
            queryData.entities = query.split(/\s+/)
                .filter(term => term.length > 2)
                .slice(0, options.maxQueryEntities || 5)
            
            return queryData
        }
    }
    
    /**
     * Perform exact matching via SPARQL
     * @param {Object} queryData - Processed query data
     * @param {Object} options - Search options
     * @returns {Array} Exact match results
     */
    async performExactMatch(queryData, options = {}) {
        if (!this.sparqlEndpoint || queryData.entities.length === 0) {
            return []
        }
        
        logger.debug('Performing exact match search...')
        
        try {
            const sparqlQuery = this.buildExactMatchQuery(queryData.entities, options.exactMatchTypes)
            const results = await SPARQLHelpers.executeSPARQLQuery(this.sparqlEndpoint, sparqlQuery)
            
            // Process SPARQL results
            const exactMatches = results.map(result => ({
                uri: result.uri?.value || result.uri,
                type: result.type?.value || result.type,
                label: result.label?.value || result.label,
                score: 1.0, // Exact matches get perfect score
                source: 'exact_match',
                content: result.content?.value || result.content,
                metadata: {
                    sparqlResult: result,
                    matchType: 'exact'
                }
            }))
            
            this.stats.exactMatches += exactMatches.length
            logger.debug(`Found ${exactMatches.length} exact matches`)
            
            return exactMatches
            
        } catch (error) {
            logger.error('Exact match search failed:', error)
            return []
        }
    }
    
    /**
     * Perform vector similarity search
     * @param {Object} queryData - Processed query data
     * @param {Object} options - Search options
     * @returns {Array} Vector similarity results
     */
    async performVectorSimilarity(queryData, options = {}) {
        if (!this.vectorIndex || !queryData.embedding) {
            return []
        }
        
        logger.debug('Performing vector similarity search...')
        
        try {
            // Search by specified types
            const vectorResults = this.vectorIndex.searchByTypes(
                queryData.embedding,
                options.vectorSimilarityTypes,
                options.vectorSimilarityK
            )
            
            // Flatten and filter results
            const allVectorMatches = []
            for (const [type, typeResults] of Object.entries(vectorResults)) {
                for (const result of typeResults) {
                    if (result.similarity >= options.similarityThreshold) {
                        allVectorMatches.push({
                            uri: result.uri,
                            type: result.type,
                            content: result.content,
                            score: result.similarity,
                            source: 'vector_similarity',
                            metadata: {
                                distance: result.distance,
                                vectorType: type,
                                matchType: 'similarity'
                            }
                        })
                    }
                }
            }
            
            // Sort by similarity score
            allVectorMatches.sort((a, b) => b.score - a.score)
            
            this.stats.vectorMatches += allVectorMatches.length
            logger.debug(`Found ${allVectorMatches.length} vector similarity matches`)
            
            return allVectorMatches
            
        } catch (error) {
            logger.error('Vector similarity search failed:', error)
            return []
        }
    }
    
    /**
     * Perform PPR traversal for graph-based discovery
     * @param {Array} queryEntities - Starting entity URIs
     * @param {Object} options - Traversal options
     * @returns {Object} PPR traversal results
     */
    async performPPRTraversal(queryEntities, options = {}) {
        if (!this.sparqlEndpoint || queryEntities.length === 0) {
            return null
        }
        
        logger.debug(`Performing PPR traversal from ${queryEntities.length} entities...`)
        
        try {
            // Build graph from SPARQL endpoint
            const graphQuery = this.buildGraphTraversalQuery(queryEntities)
            const graphTriples = await SPARQLHelpers.executeSPARQLQuery(this.sparqlEndpoint, graphQuery)
            
            if (graphTriples.length === 0) {
                logger.debug('No graph structure found for PPR traversal')
                return null
            }
            
            // Convert to RDF dataset for PPR
            const dataset = rdf.dataset()
            for (const triple of graphTriples) {
                const subject = rdf.namedNode(triple.subject?.value || triple.subject)
                const predicate = rdf.namedNode(triple.predicate?.value || triple.predicate)
                const object = triple.object?.type === 'uri' 
                    ? rdf.namedNode(triple.object.value)
                    : rdf.literal(triple.object?.value || triple.object)
                
                dataset.add(rdf.quad(subject, predicate, object))
            }
            
            // Run PPR traversal
            const pprResults = await this.personalizedPageRank.runSemanticSearch(
                dataset,
                queryEntities,
                {
                    alpha: options.pprAlpha,
                    maxIterations: options.pprIterations,
                    topKPerType: options.topKPerType
                }
            )
            
            this.stats.pprTraversals++
            logger.debug(`PPR traversal found ${pprResults.rankedNodes?.length || 0} related nodes`)
            
            return pprResults
            
        } catch (error) {
            logger.error('PPR traversal failed:', error)
            return null
        }
    }
    
    /**
     * Combine and rank results from all search strategies
     * @param {Object} searchResults - Results from all search phases
     * @param {Object} options - Ranking options
     * @returns {Object} Combined and ranked results
     */
    combineSearchResults(searchResults, options = {}) {
        logger.debug('Combining and ranking search results...')
        
        const { exact, vector, ppr } = searchResults
        const allResults = new Map() // URI -> result object
        
        // Add exact matches
        for (const result of exact || []) {
            allResults.set(result.uri, {
                ...result,
                combinedScore: result.score * options.exactMatchWeight,
                sources: new Set(['exact_match'])
            })
        }
        
        // Add vector similarity matches
        for (const result of vector || []) {
            if (allResults.has(result.uri)) {
                // Combine with existing result
                const existing = allResults.get(result.uri)
                existing.combinedScore += result.score * options.vectorSimilarityWeight
                existing.sources.add('vector_similarity')
                existing.metadata.vectorSimilarity = result.score
            } else {
                allResults.set(result.uri, {
                    ...result,
                    combinedScore: result.score * options.vectorSimilarityWeight,
                    sources: new Set(['vector_similarity'])
                })
            }
        }
        
        // Add PPR traversal results
        if (ppr?.rankedNodes) {
            for (const pprNode of ppr.rankedNodes) {
                const uri = pprNode.nodeUri
                if (allResults.has(uri)) {
                    // Enhance existing result with PPR score
                    const existing = allResults.get(uri)
                    existing.combinedScore += pprNode.score * options.pprWeight
                    existing.sources.add('ppr_traversal')
                    existing.metadata.pprScore = pprNode.score
                } else {
                    allResults.set(uri, {
                        uri: uri,
                        type: pprNode.metadata?.type || 'unknown',
                        content: pprNode.content || '',
                        score: pprNode.score,
                        combinedScore: pprNode.score * options.pprWeight,
                        source: 'ppr_traversal',
                        sources: new Set(['ppr_traversal']),
                        metadata: {
                            pprScore: pprNode.score,
                            matchType: 'traversal',
                            ...pprNode.metadata
                        }
                    })
                }
            }
        }
        
        // Convert to ranked array
        const rankedResults = Array.from(allResults.values())
            .map(result => ({
                ...result,
                sources: Array.from(result.sources),
                rank: 0 // Will be set below
            }))
            .sort((a, b) => b.combinedScore - a.combinedScore)
            .map((result, index) => ({ ...result, rank: index + 1 }))
        
        return {
            totalResults: rankedResults.length,
            rankedResults,
            searchBreakdown: {
                exactMatches: exact?.length || 0,
                vectorMatches: vector?.length || 0,
                pprNodes: ppr?.rankedNodes?.length || 0,
                uniqueResults: allResults.size
            }
        }
    }
    
    /**
     * Build entity extraction prompt for LLM
     * @param {string} query - User query
     * @returns {string} Prompt for entity extraction
     */
    buildEntityExtractionPrompt(query) {
        return `Extract the key entities from this search query. Return only the most important named entities, concepts, or topics as a JSON array of strings.

Query: "${query}"

Return format: ["entity1", "entity2", "entity3"]

Extracted entities:`
    }
    
    /**
     * Parse LLM response for extracted entities
     * @param {string} response - LLM response
     * @returns {Array} Extracted entity names
     */
    parseEntityExtractionResponse(response) {
        try {
            // Try to parse as JSON first
            const entities = JSON.parse(response.trim())
            return Array.isArray(entities) ? entities : []
        } catch {
            // Fallback: extract quoted strings or comma-separated values
            const matches = response.match(/"([^"]+)"/g)
            if (matches) {
                return matches.map(match => match.slice(1, -1))
            }
            
            // Final fallback: split by commas and clean
            return response.split(',')
                .map(entity => entity.trim().replace(/['"]/g, ''))
                .filter(entity => entity.length > 0)
                .slice(0, 5)
        }
    }
    
    /**
     * Build SPARQL query for exact matching
     * @param {Array} entities - Entity names to search for
     * @param {Array} types - RDF types to include
     * @returns {string} SPARQL query
     */
    buildExactMatchQuery(entities, types) {
        const typeFilter = types.map(type => `?type = <${type}>`).join(' || ')
        const entityFilter = entities.map(entity => 
            `(LCASE(STR(?label)) = LCASE("${entity}") || CONTAINS(LCASE(?label), LCASE("${entity}")))`
        ).join(' || ')
        
        return `
            PREFIX ragno: <http://purl.org/stuff/ragno/>
            PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
            PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
            
            SELECT DISTINCT ?uri ?type ?label ?content
            WHERE {
                ?uri a ?type .
                FILTER (${typeFilter})
                
                ?uri skos:prefLabel|rdfs:label ?label .
                FILTER (${entityFilter})
                
                OPTIONAL { ?uri ragno:content ?content }
            }
            ORDER BY ?type ?label
            LIMIT 50
        `
    }
    
    /**
     * Build SPARQL query for graph traversal
     * @param {Array} entityUris - Starting entity URIs
     * @returns {string} SPARQL query for building graph
     */
    buildGraphTraversalQuery(entityUris) {
        const entityUriList = entityUris.map(uri => `<${uri}>`).join(' ')
        
        return `
            PREFIX ragno: <http://purl.org/stuff/ragno/>
            
            SELECT ?subject ?predicate ?object
            WHERE {
                {
                    VALUES ?start { ${entityUriList} }
                    ?relationship a ragno:Relationship .
                    ?relationship ragno:hasSourceEntity ?start .
                    ?relationship ragno:hasTargetEntity ?target .
                    
                    ?subject ?predicate ?object .
                    FILTER (?subject = ?start || ?subject = ?target || ?object = ?start || ?object = ?target)
                }
                UNION
                {
                    VALUES ?start { ${entityUriList} }
                    ?start ?predicate ?object .
                    ?subject ?predicate ?object .
                }
            }
            LIMIT 1000
        `
    }
    
    /**
     * Expand query terms for enhanced matching
     * @param {Array} entities - Original entity terms
     * @returns {Array} Expanded terms
     */
    async expandQueryTerms(entities) {
        // Simple expansion: add plural/singular forms, synonyms
        const expanded = []
        
        for (const entity of entities) {
            expanded.push(entity)
            
            // Add simple pluralization
            if (!entity.endsWith('s')) {
                expanded.push(entity + 's')
            } else if (entity.endsWith('s') && entity.length > 3) {
                expanded.push(entity.slice(0, -1))
            }
        }
        
        return [...new Set(expanded)] // Remove duplicates
    }
    
    /**
     * Calculate confidence score for query processing
     * @param {Object} queryData - Processed query data
     * @returns {number} Confidence score 0-1
     */
    calculateQueryConfidence(queryData) {
        let confidence = 0.0
        
        // Entity extraction confidence
        if (queryData.entities.length > 0) {
            confidence += 0.4 * Math.min(queryData.entities.length / 3, 1.0)
        }
        
        // Embedding generation confidence
        if (queryData.embedding) {
            confidence += 0.3
        }
        
        // Query expansion confidence
        if (queryData.expandedTerms.length > queryData.entities.length) {
            confidence += 0.3
        }
        
        return Math.min(confidence, 1.0)
    }
    
    /**
     * Update search statistics
     * @param {number} searchTime - Time taken for search
     * @param {Array} exactResults - Exact match results
     * @param {Array} vectorResults - Vector similarity results
     * @param {Object} pprResults - PPR traversal results
     */
    updateSearchStatistics(searchTime, exactResults, vectorResults, pprResults) {
        this.stats.totalSearches++
        this.stats.averageSearchTime = (
            this.stats.averageSearchTime * (this.stats.totalSearches - 1) + searchTime
        ) / this.stats.totalSearches
        this.stats.lastSearch = new Date()
    }
    
    /**
     * Get search statistics
     * @returns {Object} Current statistics
     */
    getStatistics() {
        return {
            ...this.stats,
            vectorIndexStats: this.vectorIndex?.getStatistics() || null,
            pprStats: this.personalizedPageRank.getStatistics()
        }
    }
    
    /**
     * Set vector index for similarity search
     * @param {VectorIndex} vectorIndex - Vector index instance
     */
    setVectorIndex(vectorIndex) {
        this.vectorIndex = vectorIndex
        logger.info('Vector index configured for dual search')
    }
    
    /**
     * Set SPARQL endpoint for exact matching
     * @param {string} sparqlEndpoint - SPARQL endpoint URL
     */
    setSPARQLEndpoint(sparqlEndpoint) {
        this.sparqlEndpoint = sparqlEndpoint
        logger.info(`SPARQL endpoint configured: ${sparqlEndpoint}`)
    }
    
    /**
     * Set LLM handler for entity extraction
     * @param {Object} llmHandler - LLM handler instance
     */
    setLLMHandler(llmHandler) {
        this.llmHandler = llmHandler
        logger.info('LLM handler configured for entity extraction')
    }
    
    /**
     * Set embedding handler for vector generation
     * @param {Object} embeddingHandler - Embedding handler instance
     */
    setEmbeddingHandler(embeddingHandler) {
        this.embeddingHandler = embeddingHandler
        logger.info('Embedding handler configured for vector search')
    }
}