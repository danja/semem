/**
 * Entity.js - RDF-based Entity implementation for Ragno
 * 
 * This class represents ragno:Entity as an RDF resource following the ragno ontology
 * specification. Entities are named concepts extracted from text that serve as
 * key nodes in the knowledge graph.
 * 
 * Key Features:
 * - First-class RDF resource following ragno:Entity
 * - SKOS Concept compliance for semantic interoperability
 * - Entry point classification for graph traversal
 * - Frequency tracking and provenance information
 * - Connection management with other entities via relationships
 * - Integration with enhanced SPARQLStore patterns
 */

import rdf from 'rdf-ext'
import RDFElement from './models/RDFElement.js'
import { logger } from '../Utils.js'

export default class Entity extends RDFElement {
    constructor(options = {}) {
        // Initialize with entity type
        super({
            ...options,
            type: 'entity'
        })

        // Add ragno:Entity type
        this.addType(this.ns.classes.Entity)

        // Set name/label if provided
        if (options.name || options.label) {
            const label = options.name || options.label
            this.setPrefLabel(label)
            this.setContent(label) // Also set as content for consistency
        }

        // Set entry point status (default true for entities)
        this.setEntryPoint(options.isEntryPoint !== undefined ? options.isEntryPoint : true)

        // Set sub-type if provided (e.g., "ExtractedConcept", "Person", "Organization")
        if (options.subType) {
            this.setSubType(options.subType)
        }

        // Set frequency if provided
        if (options.frequency !== undefined) {
            this.setFrequency(options.frequency)
        }

        // Set corpus association if provided
        if (options.corpus) {
            this.setCorpus(options.corpus)
        }

        logger.debug(`Created ragno:Entity: ${this.uri} with label "${this.getPrefLabel()}"`)
    }

    /**
     * Set the name/label for this entity
     * @param {string} name - Entity name
     * @param {string} [lang='en'] - Language tag
     */
    setName(name, lang = 'en') {
        this.setPrefLabel(name, lang)
        this.setContent(name) // Ensure content is also set
    }

    /**
     * Get the SKOS prefLabel for this entity (or empty string if not set)
     * @returns {string}
     */
    getPrefLabel() {
        const quads = [...this.dataset.match(this.node, this.ns.skosProperties.prefLabel)];
        return quads.length > 0 && quads[0].object.value ? quads[0].object.value : '';
    }

    /**
     * Get the name for this entity (or empty string if not set)
     * @returns {string}
     */
    getName() {
        return this.getPrefLabel();
    }

    /**
     * Set frequency for this entity (usage tracking)
     * @param {number} frequency - Frequency count
     */
    setFrequency(frequency) {
        this.removeTriple(this.ns.ex('frequency'))
        this.addTriple(this.ns.ex('frequency'), rdf.literal(frequency))
    }

    /**
     * Get frequency for this entity
     * @returns {number|null} Frequency count
     */
    getFrequency() {
        const quads = this.getTriplesWithPredicate(this.ns.ex('frequency'))
        return quads.length > 0 ? parseInt(quads[0].object.value) : null
    }

    /**
     * Increment frequency counter
     * @param {number} [increment=1] - Amount to increment
     */
    incrementFrequency(increment = 1) {
        const currentFreq = this.getFrequency() || 0
        this.setFrequency(currentFreq + increment)
    }

    /**
     * Set corpus association for this entity
     * @param {string|NamedNode} corpus - Corpus URI or node
     */
    setCorpus(corpus) {
        this.removeTriple(this.ns.properties.inCorpus)
        const corpusNode = typeof corpus === 'string' ? rdf.namedNode(corpus) : corpus
        this.addTriple(this.ns.properties.inCorpus, corpusNode)
    }

    /**
     * Get corpus association for this entity
     * @returns {NamedNode|null} Corpus node
     */
    getCorpus() {
        const quads = this.getTriplesWithPredicate(this.ns.properties.inCorpus)
        return quads.length > 0 ? quads[0].object : null
    }

    /**
     * Set first seen timestamp
     * @param {Date|string} timestamp - First seen date
     */
    setFirstSeen(timestamp) {
        this.removeTriple(this.ns.ex('firstSeen'))
        const date = timestamp instanceof Date ? timestamp : new Date(timestamp)
        this.addTriple(
            this.ns.ex('firstSeen'),
            rdf.literal(date.toISOString(), this.ns.xsd.dateTime)
        )
    }

    /**
     * Get first seen timestamp
     * @returns {Date|null} First seen date
     */
    getFirstSeen() {
        const quads = this.getTriplesWithPredicate(this.ns.ex('firstSeen'))
        return quads.length > 0 ? new Date(quads[0].object.value) : null
    }

    /**
     * Set last accessed timestamp
     * @param {Date|string} timestamp - Last accessed date
     */
    setLastAccessed(timestamp) {
        this.removeTriple(this.ns.ex('lastAccessed'))
        const date = timestamp instanceof Date ? timestamp : new Date(timestamp)
        this.addTriple(
            this.ns.ex('lastAccessed'),
            rdf.literal(date.toISOString(), this.ns.xsd.dateTime)
        )
    }

    /**
     * Get last accessed timestamp
     * @returns {Date|null} Last accessed date
     */
    getLastAccessed() {
        const quads = this.getTriplesWithPredicate(this.ns.ex('lastAccessed'))
        return quads.length > 0 ? new Date(quads[0].object.value) : null
    }

    /**
     * Update last accessed timestamp to now
     */
    touch() {
        this.setLastAccessed(new Date())
    }

    /**
     * Add an alternative label/name for this entity
     * @param {string} altName - Alternative name
     * @param {string} [lang='en'] - Language tag
     */
    addAlternativeName(altName, lang = 'en') {
        this.addAltLabel(altName, lang)
    }

    /**
     * Get all alternative names for this entity
     * @returns {Array<string>} Alternative names
     */
    getAlternativeNames() {
        return this.getTriplesWithPredicate(this.ns.skosProperties.altLabel)
            .map(quad => quad.object.value)
    }

    /**
     * Add a relationship to another entity
     * @param {Entity|NamedNode|string} targetEntity - Target entity
     * @param {string} description - Relationship description
     * @param {number} [weight=1.0] - Relationship weight
     * @param {string} [relationshipType] - Type of relationship
     * @returns {Object} Relationship information
     */
    addRelationshipTo(targetEntity, description, weight = 1.0, relationshipType) {
        // This creates a reference to a relationship but doesn't create the Relationship object
        // That should be done through the graph manager or relationship factory
        const targetNode = this._normalizeEntityReference(targetEntity)

        // Create a simple connection for now
        this.connectTo(targetNode, weight)

        return {
            source: this.node,
            target: targetNode,
            description,
            weight,
            type: relationshipType
        }
    }

    /**
     * Get all relationships involving this entity
     * @param {Object} [options] - Query options
     * @returns {Array} Relationship information
     */
    getRelationships(options = {}) {
        // This would typically query the broader dataset or graph manager
        // For now, return direct connections
        const connections = this.getConnectedElements()
        return connections.map(target => ({
            source: this.node,
            target,
            type: 'connectsTo'
        }))
    }

    /**
     * Check if this entity has a relationship with another entity
     * @param {Entity|NamedNode|string} otherEntity - Other entity to check
     * @returns {boolean} True if relationship exists
     */
    hasRelationshipWith(otherEntity) {
        const otherNode = this._normalizeEntityReference(otherEntity)
        return this.getConnectedElements().some(node => node.equals(otherNode))
    }

    /**
     * Add an attribute to this entity
     * @param {string} content - Attribute content
     * @param {string} [subType] - Attribute sub-type
     */
    addAttribute(content, subType) {
        // Create attribute reference
        const attributeURI = `${this.uri}/attribute/${Date.now()}`
        const attributeNode = rdf.namedNode(attributeURI)

        // Link to this entity
        this.addTriple(this.ns.properties.hasAttribute, attributeNode)

        return {
            uri: attributeURI,
            content,
            subType,
            entity: this.uri
        }
    }

    /**
     * Get all attributes for this entity
     * @returns {Array<NamedNode>} Attribute nodes
     */
    getAttributes() {
        return this.getTriplesWithPredicate(this.ns.properties.hasAttribute)
            .map(quad => quad.object)
    }

    /**
     * Add a source document to this entity as an RDF triple
     * @param {string} source - The source document URI or string
     */
    addSource(source) {
        const sourcePredicate = this.ns.properties.hasSourceDocument || this.ns.ex('hasSourceDocument') || rdf.namedNode('http://hyperdata.it/ontologies/ragno#hasSourceDocument');
        const sourceNode = typeof source === 'string' ? rdf.namedNode(source) : source;
        this.addTriple(sourcePredicate, sourceNode);
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
     * Validate this entity according to ragno ontology
     * @returns {Object} Validation result
     */
    validate() {
        const baseValidation = super.validate()
        const errors = [...baseValidation.errors]

        // Check ragno:Entity type
        if (!this.hasType(this.ns.classes.Entity)) {
            errors.push('Entity must have ragno:Entity type')
        }

        // Check required label
        if (!this.getPrefLabel()) {
            errors.push('Entity must have a preferred label')
        }

        // Check entry point status is boolean
        const entryPoint = this.isEntryPoint()
        if (typeof entryPoint !== 'boolean') {
            errors.push('Entity entry point status must be boolean')
        }

        return {
            valid: errors.length === 0,
            errors
        }
    }

    /**
     * Get entity metadata including ragno-specific properties
     * @returns {Object} Entity metadata
     */
    getMetadata() {
        const baseMetadata = super.getMetadata()

        return {
            ...baseMetadata,
            name: this.getName(),
            alternativeNames: this.getAlternativeNames(),
            frequency: this.getFrequency(),
            corpus: this.getCorpus()?.value,
            firstSeen: this.getFirstSeen(),
            lastAccessed: this.getLastAccessed(),
            relationshipCount: this.getConnectedElements().length,
            attributeCount: this.getAttributes().length
        }
    }

    /**
     * Convert to simple object representation (for enhanced SPARQLStore compatibility)
     * @returns {Object} Simple object representation
     */
    toSimpleObject() {
        return {
            uri: this.uri,
            label: this.getName(),
            name: this.getName(),
            frequency: this.getFrequency() || 1,
            isEntryPoint: this.isEntryPoint(),
            subType: this.getSubType(),
            corpus: this.getCorpus()?.value,
            firstSeen: this.getFirstSeen()?.toISOString(),
            lastAccessed: this.getLastAccessed()?.toISOString(),
            alternativeNames: this.getAlternativeNames()
        }
    }

    /**
     * Create entity from simple object (migration helper for enhanced SPARQLStore)
     * @param {Object} obj - Simple object representation
     * @param {Object} [options] - Additional options
     * @returns {Entity} RDF-based entity
     */
    static fromSimpleObject(obj, options = {}) {
        return new Entity({
            ...options,
            name: obj.label || obj.name,
            frequency: obj.frequency,
            isEntryPoint: obj.isEntryPoint,
            subType: obj.subType,
            corpus: obj.corpus
        })
    }

    /**
     * Create an entity with automatic URI generation
     * @param {string} name - Entity name/label
     * @param {Object} [options] - Additional options
     * @returns {Entity} Created entity
     */
    static create(name, options = {}) {
        return new Entity({
            ...options,
            name
        })
    }

    /**
     * Generate URI for entity based on name (useful for enhanced SPARQLStore integration)
     * @param {string} name - Entity name
     * @param {string} [baseURI] - Base URI
     * @returns {string} Generated URI
     */
    static generateURI(name, baseURI = 'http://example.org/ragno/') {
        // Create a stable URI based on the name (for consistency with enhanced SPARQLStore)
        const normalizedName = name.toLowerCase()
            .replace(/[^a-z0-9]/g, '_')
            .replace(/_+/g, '_')
            .replace(/^_|_$/g, '')

        return `${baseURI}entity/${normalizedName}`
    }

    /**
     * Clone this entity with optional modifications
     * @param {Object} [modifications] - Properties to modify in the clone
     * @returns {Entity} Cloned entity
     */
    clone(modifications = {}) {
        const cloned = new Entity({
            dataset: rdf.dataset(), // New dataset for clone
            name: modifications.name || this.getName(),
            frequency: modifications.frequency !== undefined ? modifications.frequency : this.getFrequency(),
            isEntryPoint: modifications.isEntryPoint !== undefined ? modifications.isEntryPoint : this.isEntryPoint(),
            subType: modifications.subType || this.getSubType(),
            corpus: modifications.corpus || this.getCorpus()
        })

        // Copy additional properties that aren't handled by constructor
        for (const quad of this.getTriples()) {
            // Skip properties that are handled by constructor
            if (!quad.predicate.equals(this.ns.skosProperties.prefLabel) &&
                !quad.predicate.equals(this.ns.properties.content) &&
                !quad.predicate.equals(this.ns.properties.isEntryPoint) &&
                !quad.predicate.equals(this.ns.properties.subType) &&
                !quad.predicate.equals(this.ns.ex('frequency')) &&
                !quad.predicate.equals(this.ns.properties.inCorpus) &&
                !quad.predicate.equals(this.ns.dcProperties.created)) {
                cloned.addTriple(quad.predicate, quad.object)
            }
        }

        return cloned
    }

    /**
     * Get the preferred label (SKOS prefLabel) for this entity
     * @returns {string} The preferred label, or empty string if not set
     */
    getPreferredLabel() {
        if (this.getPrefLabel) {
            const label = this.getPrefLabel();
            return label ? label : '';
        }
        return '';
    }
}