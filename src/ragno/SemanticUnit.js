/**
 * SemanticUnit.js - RDF-based Semantic Unit implementation for Ragno
 * 
 * This class represents ragno:Unit as an RDF resource following the ragno ontology
 * specification. Semantic units are independent textual segments that represent
 * coherent events, facts, or concepts extracted from larger documents.
 * 
 * Key Features:
 * - First-class RDF resource following ragno:Unit
 * - SKOS Concept compliance for semantic interoperability
 * - Source document tracking and provenance
 * - Connection management with entities and other units
 * - Summary and full text content management
 * - Vector embedding integration for similarity search
 */

import rdf from 'rdf-ext'
import RDFElement from './models/RDFElement.js'
import { logger } from '../Utils.js'

export default class SemanticUnit extends RDFElement {
    constructor(options = {}) {
        // Initialize with unit type
        super({
            ...options,
            type: 'unit'
        })

        // Add ragno:Unit type
        this.addType(this.ns.classes.Unit)

        // Set text content if provided
        if (options.text || options.content) {
            const content = options.text || options.content
            this.setContent(content)
        }

        // Set summary if provided (as SKOS definition)
        if (options.summary) {
            this.setSummary(options.summary)
        }

        // Set source document if provided
        if (options.source || options.sourceDocument) {
            this.setSourceDocument(options.source || options.sourceDocument)
        }

        // Set sub-type if provided (e.g., "Fact", "Event", "Description")
        if (options.subType) {
            this.setSubType(options.subType)
        }

        // Units are typically not entry points (entities are)
        this.setEntryPoint(options.isEntryPoint !== undefined ? options.isEntryPoint : false)

        // Set position in source if provided
        if (options.position !== undefined) {
            this.setPosition(options.position)
        }

        // Set length if provided
        if (options.length !== undefined) {
            this.setLength(options.length)
        }

        // Set custom metadata if provided
        if (options.metadata && typeof options.metadata === 'object') {
            this.setAllMetadata(options.metadata)
        }

        logger.debug(`Created ragno:Unit: ${this.uri}`)
    }

    /**
     * Set the main text content for this unit
     * @param {string} text - Text content
     */
    setText(text) {
        this.setContent(text)
    }

    /**
     * Get the main text content of this unit
     * @returns {string|null} Text content
     */
    getText() {
        return this.getContent()
    }

    /**
     * Set summary for this unit (stored as SKOS definition)
     * @param {string} summary - Summary text
     * @param {string} [lang='en'] - Language tag
     */
    setSummary(summary, lang = 'en') {
        this.removeTriple(this.ns.skosProperties.definition)
        this.addTriple(this.ns.skosProperties.definition, rdf.literal(summary, lang))
    }

    /**
     * Get summary for this unit
     * @returns {string|null} Summary text
     */
    getSummary() {
        const quads = this.getTriplesWithPredicate(this.ns.skosProperties.definition)
        return quads.length > 0 ? quads[0].object.value : null
    }

    /**
     * Set source document for this unit
     * @param {string|NamedNode} source - Source document URI or node
     */
    setSourceDocument(source) {
        this.removeTriple(this.ns.properties.hasSourceDocument)
        const sourceNode = typeof source === 'string' ? rdf.namedNode(source) : source
        this.addTriple(this.ns.properties.hasSourceDocument, sourceNode)
    }

    /**
     * Get source document for this unit
     * @returns {NamedNode|null} Source document node
     */
    getSourceDocument() {
        const quads = this.getTriplesWithPredicate(this.ns.properties.hasSourceDocument)
        return quads.length > 0 ? quads[0].object : null
    }

    /**
     * Set position in source document
     * @param {number} position - Character position
     */
    setPosition(position) {
        this.removeTriple(this.ns.ex('position'))
        this.addTriple(this.ns.ex('position'), rdf.literal(position))
    }

    /**
     * Get position in source document
     * @returns {number|null} Character position
     */
    getPosition() {
        const quads = this.getTriplesWithPredicate(this.ns.ex('position'))
        return quads.length > 0 ? parseInt(quads[0].object.value) : null
    }

    /**
     * Set length of this unit in characters
     * @param {number} length - Character length
     */
    setLength(length) {
        this.removeTriple(this.ns.ex('length'))
        this.addTriple(this.ns.ex('length'), rdf.literal(length))
    }

    /**
     * Get length of this unit in characters
     * @returns {number|null} Character length
     */
    getLength() {
        const quads = this.getTriplesWithPredicate(this.ns.ex('length'))
        return quads.length > 0 ? parseInt(quads[0].object.value) : null
    }

    /**
     * Set vector embedding for this unit
     * @param {Array<number>} embedding - Vector embedding
     */
    setEmbedding(embedding) {
        this.removeTriple(this.ns.ex('embedding'))
        // Store embedding as JSON string for now
        const embeddingStr = JSON.stringify(embedding)
        this.addTriple(this.ns.ex('embedding'), rdf.literal(embeddingStr))
    }

    /**
     * Get vector embedding for this unit
     * @returns {Array<number>|null} Vector embedding
     */
    getEmbedding() {
        const quads = this.getTriplesWithPredicate(this.ns.ex('embedding'))
        if (quads.length > 0) {
            try {
                return JSON.parse(quads[0].object.value)
            } catch (error) {
                logger.warn(`Failed to parse embedding for unit ${this.uri}:`, error)
                return null
            }
        }
        return null
    }

    /**
     * Add a connection to an entity that this unit mentions
     * @param {Entity|NamedNode|string} entity - Entity reference
     * @param {number} [relevanceScore] - Relevance score (0-1)
     */
    addEntityConnection(entity, relevanceScore) {
        const entityNode = this._normalizeEntityReference(entity)
        this.connectTo(entityNode, relevanceScore)

        // Also add specific property for entity connections
        this.addTriple(this.ns.ex('mentionsEntity'), entityNode)

        if (relevanceScore !== undefined) {
            // Create reified statement for relevance score
            const connection = rdf.namedNode(`${this.uri}/entityConnection/${Date.now()}`)
            this.dataset.add(rdf.quad(connection, this.ns.rdf.subject, this.node))
            this.dataset.add(rdf.quad(connection, this.ns.rdf.predicate, this.ns.ex('mentionsEntity')))
            this.dataset.add(rdf.quad(connection, this.ns.rdf.object, entityNode))
            this.dataset.add(rdf.quad(connection, this.ns.ex('relevanceScore'), rdf.literal(relevanceScore)))
        }
    }

    /**
     * Get all entities mentioned by this unit
     * @returns {Array<NamedNode>} Entity nodes
     */
    getMentionedEntities() {
        return this.getTriplesWithPredicate(this.ns.ex('mentionsEntity'))
            .map(quad => quad.object)
    }

    /**
     * Add a connection to another semantic unit
     * @param {SemanticUnit|NamedNode|string} unit - Unit reference
     * @param {string} [relationType] - Type of relationship
     * @param {number} [weight] - Connection weight
     */
    addUnitConnection(unit, relationType, weight) {
        const unitNode = this._normalizeUnitReference(unit)
        this.connectTo(unitNode, weight)

        if (relationType) {
            // Add typed connection
            const connection = rdf.namedNode(`${this.uri}/unitConnection/${Date.now()}`)
            this.dataset.add(rdf.quad(connection, this.ns.rdf.subject, this.node))
            this.dataset.add(rdf.quad(connection, this.ns.rdf.predicate, this.ns.properties.connectsTo))
            this.dataset.add(rdf.quad(connection, this.ns.rdf.object, unitNode))
            this.dataset.add(rdf.quad(connection, this.ns.ex('relationType'), rdf.literal(relationType)))

            if (weight !== undefined) {
                this.dataset.add(rdf.quad(connection, this.ns.properties.hasWeight, rdf.literal(weight)))
            }
        }
    }

    /**
     * Get all connected semantic units
     * @returns {Array<Object>} Connected units with relationship info
     */
    getConnectedUnits() {
        const connections = this.getConnectedElements()

        // Filter for units and get relationship info
        const unitConnections = []
        for (const connection of connections) {
            // Check if this is a unit (would need broader dataset query in practice)
            unitConnections.push({
                unit: connection,
                type: 'connectsTo'
            })
        }

        return unitConnections
    }

    /**
     * Set corpus association for this unit
     * @param {string|NamedNode} corpus - Corpus URI or node
     */
    setCorpus(corpus) {
        this.removeTriple(this.ns.properties.inCorpus)
        const corpusNode = typeof corpus === 'string' ? rdf.namedNode(corpus) : corpus
        this.addTriple(this.ns.properties.inCorpus, corpusNode)
    }

    /**
     * Get corpus association for this unit
     * @returns {NamedNode|null} Corpus node
     */
    getCorpus() {
        const quads = this.getTriplesWithPredicate(this.ns.properties.inCorpus)
        return quads.length > 0 ? quads[0].object : null
    }

    /**
     * Set language for this unit
     * @param {string} language - Language code (e.g., 'en', 'es')
     */
    setLanguage(language) {
        this.removeTriple(this.ns.dcProperties.language)
        this.addTriple(this.ns.dcProperties.language, rdf.literal(language))
    }

    /**
     * Get language for this unit
     * @returns {string|null} Language code
     */
    getLanguage() {
        const quads = this.getTriplesWithPredicate(this.ns.dcProperties.language)
        return quads.length > 0 ? quads[0].object.value : null
    }

    /**
     * Add an entity mention to this semantic unit as an RDF triple
     * @param {string} entityURI - The URI of the mentioned entity
     * @param {number} [relevance=1.0] - Optional relevance/confidence score
     */
    addEntityMention(entityURI, relevance = 1.0) {
        // Add ragno:mention triple
        const mentionPredicate = this.ns.properties.mention || this.ns.ex('mention') || rdf.namedNode('http://hyperdata.it/ontologies/ragno#mention');
        this.addTriple(mentionPredicate, rdf.namedNode(entityURI));
        // Optionally, add a relevance/confidence triple (custom property)
        if (relevance !== undefined && !isNaN(relevance)) {
            const relPredicate = this.ns.properties.mentionRelevance || this.ns.ex('mentionRelevance') || rdf.namedNode('http://hyperdata.it/ontologies/ragno#mentionRelevance');
            this.addTriple(relPredicate, rdf.literal(relevance.toString(), this.ns.xsd.double));
        }
    }

    /**
     * Normalize different entity reference formats to NamedNode
     * @private
     * @param {Entity|NamedNode|string} entity - Entity reference
     * @returns {NamedNode} Normalized entity node
     */
    _normalizeEntityReference(entity) {
        if (typeof entity === 'string') {
            return rdf.namedNode(entity)
        } else if (entity && typeof entity === 'object' && entity.node) {
            // Entity instance
            return entity.node
        } else if (entity && entity.termType === 'NamedNode') {
            // Already a NamedNode
            return entity
        } else {
            throw new Error(`Invalid entity reference: ${entity}`)
        }
    }

    /**
     * Normalize different unit reference formats to NamedNode
     * @private
     * @param {SemanticUnit|NamedNode|string} unit - Unit reference
     * @returns {NamedNode} Normalized unit node
     */
    _normalizeUnitReference(unit) {
        if (typeof unit === 'string') {
            return rdf.namedNode(unit)
        } else if (unit && typeof unit === 'object' && unit.node) {
            // SemanticUnit instance
            return unit.node
        } else if (unit && unit.termType === 'NamedNode') {
            // Already a NamedNode
            return unit
        } else {
            throw new Error(`Invalid unit reference: ${unit}`)
        }
    }

    /**
     * Validate this unit according to ragno ontology
     * @returns {Object} Validation result
     */
    validate() {
        const baseValidation = super.validate()
        const errors = [...baseValidation.errors]

        // Check ragno:Unit type
        if (!this.hasType(this.ns.classes.Unit)) {
            errors.push('Unit must have ragno:Unit type')
        }

        // Check required content
        if (!this.getText()) {
            errors.push('Unit must have text content')
        }

        // Check text length is reasonable
        const text = this.getText()
        if (text && text.length < 10) {
            errors.push('Unit text content should be at least 10 characters')
        }

        return {
            valid: errors.length === 0,
            errors
        }
    }

    /**
     * Get unit metadata including ragno-specific properties
     * @returns {Object} Unit metadata
     */
    getMetadata() {
        const baseMetadata = super.getMetadata()

        return {
            ...baseMetadata,
            text: this.getText(),
            summary: this.getSummary(),
            sourceDocument: this.getSourceDocument()?.value,
            position: this.getPosition(),
            length: this.getLength(),
            language: this.getLanguage(),
            corpus: this.getCorpus()?.value,
            mentionedEntitiesCount: this.getMentionedEntities().length,
            connectedUnitsCount: this.getConnectedUnits().length,
            hasEmbedding: this.getEmbedding() !== null
        }
    }

    /**
     * Convert to simple object representation (for backward compatibility)
     * @returns {Object} Simple object representation
     */
    toSimpleObject() {
        return {
            uri: this.uri,
            text: this.getText(),
            summary: this.getSummary(),
            source: this.getSourceDocument()?.value,
            sourceDocument: this.getSourceDocument()?.value,
            position: this.getPosition(),
            length: this.getLength(),
            language: this.getLanguage(),
            subType: this.getSubType(),
            corpus: this.getCorpus()?.value,
            isEntryPoint: this.isEntryPoint()
        }
    }

    /**
     * Create unit from simple object (migration helper)
     * @param {Object} obj - Simple object representation
     * @param {Object} [options] - Additional options
     * @returns {SemanticUnit} RDF-based unit
     */
    static fromSimpleObject(obj, options = {}) {
        return new SemanticUnit({
            ...options,
            text: obj.text,
            summary: obj.summary,
            source: obj.source || obj.sourceDocument,
            position: obj.position,
            length: obj.length,
            language: obj.language,
            subType: obj.subType,
            corpus: obj.corpus,
            isEntryPoint: obj.isEntryPoint
        })
    }

    /**
     * Create a semantic unit with automatic URI generation
     * @param {string} text - Unit text content
     * @param {Object} [options] - Additional options
     * @returns {SemanticUnit} Created unit
     */
    static create(text, options = {}) {
        return new SemanticUnit({
            ...options,
            text
        })
    }

    /**
     * Clone this unit with optional modifications
     * @param {Object} [modifications] - Properties to modify in the clone
     * @returns {SemanticUnit} Cloned unit
     */
    clone(modifications = {}) {
        const cloned = new SemanticUnit({
            dataset: rdf.dataset(), // New dataset for clone
            text: modifications.text || this.getText(),
            summary: modifications.summary || this.getSummary(),
            source: modifications.source || this.getSourceDocument(),
            position: modifications.position !== undefined ? modifications.position : this.getPosition(),
            length: modifications.length !== undefined ? modifications.length : this.getLength(),
            language: modifications.language || this.getLanguage(),
            subType: modifications.subType || this.getSubType(),
            corpus: modifications.corpus || this.getCorpus(),
            isEntryPoint: modifications.isEntryPoint !== undefined ? modifications.isEntryPoint : this.isEntryPoint()
        })

        // Copy additional properties that aren't handled by constructor
        for (const quad of this.getTriples()) {
            // Skip properties that are handled by constructor
            if (!quad.predicate.equals(this.ns.properties.content) &&
                !quad.predicate.equals(this.ns.skosProperties.definition) &&
                !quad.predicate.equals(this.ns.properties.hasSourceDocument) &&
                !quad.predicate.equals(this.ns.ex('position')) &&
                !quad.predicate.equals(this.ns.ex('length')) &&
                !quad.predicate.equals(this.ns.dcProperties.language) &&
                !quad.predicate.equals(this.ns.properties.subType) &&
                !quad.predicate.equals(this.ns.properties.inCorpus) &&
                !quad.predicate.equals(this.ns.properties.isEntryPoint) &&
                !quad.predicate.equals(this.ns.dcProperties.created)) {
                cloned.addTriple(quad.predicate, quad.object)
            }
        }

        return cloned
    }
}