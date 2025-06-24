/**
 * Hyde.js - Hypothetical Document Embeddings for Ragno Knowledge Graphs
 * 
 * The HyDE (Hypothetical Document Embeddings) algorithm enhances retrieval for large 
 * language models (LLMs) by first using an LLM to generate a hypothetical answer or 
 * document in response to a user query. This synthetic document is then embedded into 
 * a vector space, and the resulting embedding is used to search for semantically similar 
 * real-world documents in a vector database.
 * 
 * This implementation integrates HyDE with the Ragno knowledge graph system by:
 * - Generating hypothetical answers using existing LLM facilities
 * - Adding these answers to the RDF graph with the ragno:maybe property
 * - Creating entity relationships based on the hypothetical content
 * - Supporting multiple input sources (queries, entities, semantic units)
 * 
 * Key Features:
 * - Query-to-hypothetical-answer generation
 * - RDF integration with ragno:maybe property annotation
 * - Vector embedding of hypothetical content
 * - Entity extraction from generated content
 * - Graph augmentation with uncertainty markers
 */

import rdf from 'rdf-ext'
import { logger } from '../../Utils.js'
import NamespaceManager from '../core/NamespaceManager.js'
import Entity from '../Entity.js'
import SemanticUnit from '../SemanticUnit.js'
import Relationship from '../Relationship.js'

export default class Hyde {
    constructor(options = {}) {
        this.options = {
            // LLM options for hypothesis generation
            maxTokens: options.maxTokens || 512,
            temperature: options.temperature || 0.7,
            model: options.model || 'default',
            
            // HyDE-specific options
            hypothesesPerQuery: options.hypothesesPerQuery || 3,
            includeOriginalQuery: options.includeOriginalQuery || true,
            confidenceThreshold: options.confidenceThreshold || 0.5,
            
            // Entity extraction options
            extractEntities: options.extractEntities !== false,
            maxEntitiesPerHypothesis: options.maxEntitiesPerHypothesis || 10,
            
            // RDF options
            uriBase: options.uriBase || 'http://example.org/ragno/',
            preserveProvenance: options.preserveProvenance !== false,
            
            ...options
        }
        
        this.namespaces = new NamespaceManager({ uriBase: this.options.uriBase })
        
        this.stats = {
            totalQueries: 0,
            totalHypotheses: 0,
            totalEntitiesExtracted: 0,
            totalExecutionTime: 0,
            lastRun: null
        }
        
        logger.debug('Hyde algorithm initialized')
    }
    
    /**
     * Generate hypothetical answers and augment RDF graph
     * @param {Array|string} inputs - Query strings or entity URIs to generate hypotheses for
     * @param {Object} llmHandler - LLM handler instance for generation
     * @param {Dataset} targetDataset - RDF dataset to augment
     * @param {Object} [options] - Generation options
     * @returns {Object} Results with generated hypotheses and RDF updates
     */
    async generateHypotheses(inputs, llmHandler, targetDataset, options = {}) {
        const startTime = Date.now()
        logger.info(`Starting HyDE generation for ${Array.isArray(inputs) ? inputs.length : 1} input(s)`)
        
        const opts = { ...this.options, ...options }
        const inputArray = Array.isArray(inputs) ? inputs : [inputs]
        
        const results = {
            timestamp: new Date(),
            queries: inputArray,
            hypotheses: [],
            entities: [],
            relationships: [],
            rdfTriples: 0,
            processingTime: 0
        }
        
        try {
            for (const input of inputArray) {
                const queryResults = await this.processQuery(input, llmHandler, targetDataset, opts)
                results.hypotheses.push(...queryResults.hypotheses)
                results.entities.push(...queryResults.entities)
                results.relationships.push(...queryResults.relationships)
                results.rdfTriples += queryResults.rdfTriples
            }
            
            const endTime = Date.now()
            results.processingTime = endTime - startTime
            
            // Update statistics
            this.stats.totalQueries += inputArray.length
            this.stats.totalHypotheses += results.hypotheses.length
            this.stats.totalEntitiesExtracted += results.entities.length
            this.stats.totalExecutionTime += results.processingTime
            this.stats.lastRun = new Date()
            
            logger.info(`HyDE generation completed in ${results.processingTime}ms`)
            logger.info(`Generated ${results.hypotheses.length} hypotheses, ${results.entities.length} entities`)
            
            return results
            
        } catch (error) {
            logger.error('Error during HyDE generation:', error)
            throw error
        }
    }
    
    /**
     * Process a single query or input to generate hypotheses
     * @param {string} input - Query string or entity URI
     * @param {Object} llmHandler - LLM handler instance
     * @param {Dataset} targetDataset - RDF dataset to augment
     * @param {Object} options - Processing options
     * @returns {Object} Processing results
     */
    async processQuery(input, llmHandler, targetDataset, options) {
        logger.debug(`Processing input: ${input.substring(0, 100)}...`)
        
        const results = {
            input,
            hypotheses: [],
            entities: [],
            relationships: [],
            rdfTriples: 0
        }
        
        // Generate multiple hypotheses for the input
        for (let i = 0; i < options.hypothesesPerQuery; i++) {
            try {
                const hypothesis = await this.generateSingleHypothesis(input, llmHandler, options, i)
                
                if (hypothesis && hypothesis.content) {
                    // Create hypothesis semantic unit
                    const hypothesisUnit = this.createHypothesisUnit(hypothesis, input, i)
                    results.hypotheses.push(hypothesisUnit)
                    
                    // Extract entities from hypothesis if enabled
                    if (options.extractEntities) {
                        const extractedEntities = await this.extractEntitiesFromHypothesis(
                            hypothesis, llmHandler, options
                        )
                        results.entities.push(...extractedEntities)
                        
                        // Create relationships between query and hypothesis entities
                        const relationships = this.createHypothesisRelationships(
                            input, hypothesisUnit, extractedEntities
                        )
                        results.relationships.push(...relationships)
                    }
                    
                    // Add to RDF dataset
                    const triplesAdded = this.addHypothesisToRDF(
                        hypothesisUnit, results.entities, results.relationships, targetDataset
                    )
                    results.rdfTriples += triplesAdded
                }
                
            } catch (error) {
                logger.warn(`Failed to generate hypothesis ${i + 1} for input: ${error.message}`)
            }
        }
        
        return results
    }
    
    /**
     * Generate a single hypothesis using the LLM
     * @param {string} input - Input query or entity URI
     * @param {Object} llmHandler - LLM handler instance
     * @param {Object} options - Generation options
     * @param {number} index - Hypothesis index for variation
     * @returns {Object} Generated hypothesis
     */
    async generateSingleHypothesis(input, llmHandler, options, index) {
        // Create varied prompts for different hypotheses
        const prompt = this.createHypothesisPrompt(input, index, options)
        
        const llmOptions = {
            model: options.model || 'qwen2:1.5b', // Ensure we have a default model
            maxTokens: options.maxTokens,
            temperature: (options.temperature || 0.7) + (index * 0.1) // Vary temperature for diversity
        }
        
        logger.debug(`Generating hypothesis ${index + 1} with prompt: ${prompt.substring(0, 100)}...`)
        logger.debug(`Using model: ${llmOptions.model}`)
        
        let response
        try {
            response = await llmHandler.generateResponse(prompt, '', llmOptions)
            logger.debug(`Raw LLM response type: ${typeof response}, length: ${response?.length || 'N/A'}`)
        } catch (error) {
            logger.error(`LLM generateResponse failed: ${error.message}`)
            throw error
        }
        
        if (!response || typeof response !== 'string') {
            logger.warn(`Invalid response from LLM: ${typeof response}, response: ${JSON.stringify(response)}`)
            throw new Error(`Invalid response from LLM: ${typeof response}`)
        }
        
        let confidence
        try {
            logger.debug(`About to calculate confidence for response type: ${typeof response}, input type: ${typeof input}`)
            confidence = this.estimateConfidence(response, input)
            logger.debug(`Confidence calculation successful: ${confidence}`)
        } catch (confError) {
            logger.error(`Confidence estimation failed: ${confError.message}`)
            logger.error(`Response: ${response}, Input: ${input}`)
            confidence = 0.1 // Fallback confidence
        }
        
        const hypothesis = {
            content: response,
            prompt,
            index,
            confidence: confidence,
            timestamp: new Date()
        }
        
        logger.debug(`Generated hypothesis with confidence: ${hypothesis.confidence}`)
        return hypothesis
    }
    
    /**
     * Create a prompt for hypothesis generation
     * @param {string} input - Input query or entity URI
     * @param {number} index - Hypothesis index for variation
     * @param {Object} options - Options for prompt creation
     * @returns {string} Generated prompt
     */
    createHypothesisPrompt(input, index, options) {
        const variations = [
            `Provide a comprehensive answer to the following question or topic: ${input}`,
            `Generate a detailed explanation or response about: ${input}`,
            `Create an informative document that addresses: ${input}`,
            `Write a knowledgeable response to: ${input}`,
            `Provide insights and information about: ${input}`
        ]
        
        const basePrompt = variations[index % variations.length]
        
        return `${basePrompt}

Please provide a well-structured, informative response that could serve as a hypothetical document for information retrieval. Focus on being comprehensive and accurate while maintaining clarity.`
    }
    
    /**
     * Estimate confidence score for a generated hypothesis
     * @param {string} hypothesis - Generated hypothesis text
     * @param {string} originalInput - Original input query
     * @returns {number} Confidence score between 0 and 1
     */
    estimateConfidence(hypothesis, originalInput) {
        // Handle undefined or invalid hypothesis
        if (!hypothesis || typeof hypothesis !== 'string') {
            logger.warn(`Invalid hypothesis for confidence estimation: ${typeof hypothesis}`)
            return 0.1 // Very low confidence for invalid content
        }
        
        // More nuanced confidence estimation with lower base and stricter criteria
        let confidence = 0.3 // Lower base confidence
        
        // Length-based factors (more discriminating)
        if (hypothesis.length > 200) confidence += 0.05
        if (hypothesis.length > 500) confidence += 0.05
        if (hypothesis.length > 1000) confidence += 0.05
        
        // Structure-based factors (more demanding)
        const sentences = hypothesis.split(/[.!?]+/).filter(s => s.trim().length > 10)
        if (sentences.length >= 3) confidence += 0.1 // Multiple sentences
        if (hypothesis.includes(':') && hypothesis.includes(';')) confidence += 0.05 // Complex punctuation
        
        // Word count and complexity
        const words = hypothesis.split(/\s+/)
        if (words.length > 100) confidence += 0.1
        if (words.length > 200) confidence += 0.05
        
        // Content relevance (keyword overlap with better weighting)
        const inputWords = originalInput.toLowerCase().split(/\s+/).filter(w => w.length > 3)
        const hypothesisWords = hypothesis.toLowerCase().split(/\s+/)
        const overlap = inputWords.filter(word => hypothesisWords.includes(word)).length
        const relevanceScore = inputWords.length > 0 ? overlap / inputWords.length : 0
        confidence += relevanceScore * 0.25 // Up to 0.25 for perfect relevance
        
        // Quality indicators
        if (hypothesis.includes('however') || hypothesis.includes('therefore') || hypothesis.includes('furthermore')) {
            confidence += 0.05 // Sophisticated connectors
        }
        
        // Penalize very short or generic responses
        if (hypothesis.length < 100) confidence -= 0.2
        if (words.length < 20) confidence -= 0.2
        
        // Add some randomness to prevent all hypotheses having identical confidence
        const variation = (Math.random() - 0.5) * 0.1 // ±0.05 random variation
        confidence += variation
        
        return Math.max(0.1, Math.min(confidence, 0.95)) // Cap between 0.1 and 0.95
    }
    
    /**
     * Create a SemanticUnit for a hypothesis
     * @param {Object} hypothesis - Generated hypothesis object
     * @param {string} originalInput - Original input query
     * @param {number} index - Hypothesis index
     * @returns {SemanticUnit} Hypothesis semantic unit
     */
    createHypothesisUnit(hypothesis, originalInput, index) {
        const unitId = `hypothesis-${Date.now()}-${index}`
        const uri = this.namespaces.ex(unitId)
        
        return new SemanticUnit({
            uri: uri.value,
            content: hypothesis.content,
            type: 'hypothesis',
            metadata: {
                originalQuery: originalInput,
                confidence: hypothesis.confidence,
                generationIndex: index,
                timestamp: hypothesis.timestamp,
                hypothetical: true
            },
            namespaces: this.namespaces
        })
    }
    
    /**
     * Extract entities from a generated hypothesis
     * @param {Object} hypothesis - Generated hypothesis object
     * @param {Object} llmHandler - LLM handler instance
     * @param {Object} options - Extraction options
     * @returns {Array} Extracted entities
     */
    async extractEntitiesFromHypothesis(hypothesis, llmHandler, options) {
        if (!options.extractEntities) return []
        
        try {
            const extractionPrompt = `Extract the main entities, concepts, and topics from the following text. Return them as a simple list, one per line:

${hypothesis.content}

Entities:`
            
            const response = await llmHandler.generateResponse(extractionPrompt, '', {
                model: options.model || 'qwen2:1.5b',
                maxTokens: 200,
                temperature: 0.3
            })
            
            const entityNames = response
                .split('\n')
                .filter(line => line.trim())
                .map(line => line.trim().replace(/^-\s*/, ''))
                .slice(0, options.maxEntitiesPerHypothesis)
            
            return entityNames.map((name, index) => {
                const entityId = `hypothesis-entity-${Date.now()}-${index}`
                const uri = this.namespaces.ex(entityId)
                
                return new Entity({
                    uri: uri.value,
                    name,
                    isEntryPoint: false,
                    subType: 'hypothetical-entity',
                    metadata: {
                        extractedFrom: 'hypothesis',
                        confidence: (hypothesis.confidence || 0.5) * 0.8, // Reduce confidence for extracted entities
                        hypothetical: true
                    },
                    namespaces: this.namespaces
                })
            })
            
        } catch (error) {
            logger.warn(`Failed to extract entities from hypothesis: ${error.message}`)
            return []
        }
    }
    
    /**
     * Create relationships between query, hypothesis, and extracted entities
     * @param {string} originalInput - Original input query
     * @param {SemanticUnit} hypothesisUnit - Hypothesis semantic unit
     * @param {Array} entities - Extracted entities
     * @returns {Array} Created relationships
     */
    createHypothesisRelationships(originalInput, hypothesisUnit, entities) {
        const relationships = []
        
        // Create relationship between query and hypothesis
        const queryHypothesisId = `query-hypothesis-${Date.now()}`
        const queryHypothesisUri = this.namespaces.ex(queryHypothesisId)
        
        relationships.push(new Relationship({
            uri: queryHypothesisUri.value,
            subject: originalInput,
            predicate: 'hypothetical-answer',
            object: hypothesisUnit.uri,
            metadata: {
                type: 'hypothesis-generation',
                confidence: hypothesisUnit.metadata?.confidence || 0.5,
                hypothetical: true
            },
            namespaces: this.namespaces
        }))
        
        // Create relationships between hypothesis and extracted entities
        entities.forEach((entity, index) => {
            const relationshipId = `hypothesis-entity-${Date.now()}-${index}`
            const relationshipUri = this.namespaces.ex(relationshipId)
            
            relationships.push(new Relationship({
                uri: relationshipUri.value,
                subject: hypothesisUnit.uri,
                predicate: 'mentions',
                object: entity.uri,
                metadata: {
                    type: 'entity-mention',
                    confidence: entity.metadata?.confidence || 0.5,
                    hypothetical: true
                },
                namespaces: this.namespaces
            }))
        })
        
        return relationships
    }
    
    /**
     * Add hypothesis and related data to RDF dataset with ragno:maybe property
     * @param {SemanticUnit} hypothesisUnit - Hypothesis semantic unit
     * @param {Array} entities - Extracted entities
     * @param {Array} relationships - Created relationships
     * @param {Dataset} targetDataset - Target RDF dataset
     * @returns {number} Number of triples added
     */
    addHypothesisToRDF(hypothesisUnit, entities, relationships, targetDataset) {
        let triplesAdded = 0
        
        logger.debug(`addHypothesisToRDF called with hypothesisUnit: ${hypothesisUnit ? 'defined' : 'undefined'}`)
        logger.debug(`targetDataset: ${targetDataset ? 'defined' : 'undefined'}`)
        
        // Export hypothesis unit to dataset
        hypothesisUnit.exportToDataset(targetDataset)
        triplesAdded += hypothesisUnit.getTriples().length || 0
        
        // Add ragno:maybe property to mark as hypothetical
        const hypothesisNode = rdf.namedNode(hypothesisUnit.uri)
        const maybeQuad = rdf.quad(
            hypothesisNode,
            this.namespaces.ragno('maybe'),
            rdf.literal('true', this.namespaces.xsd('boolean'))
        )
        targetDataset.add(maybeQuad)
        triplesAdded++
        
        // Add confidence score
        const confidence = hypothesisUnit.metadata?.confidence || 0.5
        const confidenceQuad = rdf.quad(
            hypothesisNode,
            this.namespaces.ragno('confidence'),
            rdf.literal(confidence.toString(), this.namespaces.xsd('decimal'))
        )
        targetDataset.add(confidenceQuad)
        triplesAdded++
        
        // Export entities
        entities.forEach(entity => {
            entity.exportToDataset(targetDataset)
            triplesAdded += entity.getTriples().length || 0
            
            // Mark entity as hypothetical
            const entityNode = rdf.namedNode(entity.uri)
            const entityMaybeQuad = rdf.quad(
                entityNode,
                this.namespaces.ragno('maybe'),
                rdf.literal('true', this.namespaces.xsd('boolean'))
            )
            targetDataset.add(entityMaybeQuad)
            triplesAdded++
        })
        
        // Export relationships
        relationships.forEach(relationship => {
            relationship.exportToDataset(targetDataset)
            triplesAdded += relationship.getTriples().length || 0
            
            // Mark relationship as hypothetical
            const relationshipNode = rdf.namedNode(relationship.uri)
            const relationshipMaybeQuad = rdf.quad(
                relationshipNode,
                this.namespaces.ragno('maybe'),
                rdf.literal('true', this.namespaces.xsd('boolean'))
            )
            targetDataset.add(relationshipMaybeQuad)
            triplesAdded++
        })
        
        return triplesAdded
    }
    
    /**
     * Query hypothetical content from RDF dataset
     * @param {Dataset} dataset - RDF dataset to query
     * @param {Object} [filters] - Query filters
     * @returns {Array} Hypothetical content matching filters
     */
    queryHypotheticalContent(dataset, filters = {}) {
        const results = []
        
        // Find all triples with ragno:maybe = true
        const maybeProperty = this.namespaces.ragno('maybe')
        const trueValue = rdf.literal('true', this.namespaces.xsd('boolean'))
        
        for (const quad of dataset.match(null, maybeProperty, trueValue)) {
            const subject = quad.subject
            
            // Get all properties of this hypothetical entity/unit
            const properties = {}
            for (const propQuad of dataset.match(subject, null, null)) {
                const predicate = propQuad.predicate.value
                const object = propQuad.object
                
                if (!properties[predicate]) {
                    properties[predicate] = []
                }
                properties[predicate].push(object.value)
            }
            
            // Apply filters if specified
            if (this.matchesFilters(properties, filters)) {
                results.push({
                    uri: subject.value,
                    properties,
                    hypothetical: true
                })
            }
        }
        
        return results
    }
    
    /**
     * Check if properties match specified filters
     * @param {Object} properties - Entity properties
     * @param {Object} filters - Filter criteria
     * @returns {boolean} Whether properties match filters
     */
    matchesFilters(properties, filters) {
        for (const [filterKey, filterValue] of Object.entries(filters)) {
            if (!properties[filterKey] || !properties[filterKey].includes(filterValue)) {
                return false
            }
        }
        return true
    }
    
    /**
     * Get algorithm statistics
     * @returns {Object} Algorithm statistics
     */
    getStatistics() {
        return {
            ...this.stats,
            averageExecutionTime: this.stats.totalQueries > 0 
                ? this.stats.totalExecutionTime / this.stats.totalQueries 
                : 0,
            averageHypothesesPerQuery: this.stats.totalQueries > 0
                ? this.stats.totalHypotheses / this.stats.totalQueries
                : 0,
            averageEntitiesPerQuery: this.stats.totalQueries > 0
                ? this.stats.totalEntitiesExtracted / this.stats.totalQueries
                : 0
        }
    }
    
    /**
     * Reset algorithm statistics
     */
    resetStatistics() {
        this.stats = {
            totalQueries: 0,
            totalHypotheses: 0,
            totalEntitiesExtracted: 0,
            totalExecutionTime: 0,
            lastRun: null
        }
        
        logger.info('Hyde algorithm statistics reset')
    }
}