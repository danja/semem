/**
 * RDFGraphManager.js - Core RDF-Ext integration for Ragno
 * 
 * This class provides the foundation for RDF-based graph operations in Ragno,
 * replacing the simple object-oriented approach with proper RDF semantics
 * following the ragno ontology specification.
 * 
 * Key Features:
 * - RDF-Ext dataset management
 * - Namespace resolution for ragno ontology
 * - SPARQL integration with existing SPARQLStore
 * - Graph serialization/deserialization
 * - URI generation for graph elements
 */

import rdf from 'rdf-ext'
import namespace from '@rdfjs/namespace'
import { logger } from '../../Utils.js'

export default class RDFGraphManager {
    constructor(options = {}) {
        this.dataset = rdf.dataset()
        this.uriBase = options.uriBase || 'http://example.org/ragno/'
        this.counters = new Map() // For URI generation
        
        // Initialize namespaces following ragno ontology
        this.ns = {
            rdf: namespace('http://www.w3.org/1999/02/22-rdf-syntax-ns#'),
            rdfs: namespace('http://www.w3.org/2000/01/rdf-schema#'),
            owl: namespace('http://www.w3.org/2002/07/owl#'),
            xsd: namespace('http://www.w3.org/2001/XMLSchema#'),
            skos: namespace('http://www.w3.org/2004/02/skos/core#'),
            prov: namespace('http://www.w3.org/ns/prov#'),
            dcterms: namespace('http://purl.org/dc/terms/'),
            ragno: namespace('http://purl.org/stuff/ragno/'),
            ex: namespace(this.uriBase)
        }
        
        logger.info('RDFGraphManager initialized with RDF-Ext dataset')
    }

    /**
     * Generate a unique URI for a given resource type
     * @param {string} type - Resource type (entity, unit, relationship, etc.)
     * @returns {string} Generated URI
     */
    generateURI(type) {
        const count = this.counters.get(type) || 0
        this.counters.set(type, count + 1)
        return `${this.uriBase}${type}/${count + 1}`
    }

    /**
     * Create a new named node with generated URI
     * @param {string} type - Resource type
     * @returns {NamedNode} RDF named node
     */
    createNamedNode(type) {
        const uri = this.generateURI(type)
        return rdf.namedNode(uri)
    }

    /**
     * Add a triple to the dataset
     * @param {NamedNode} subject - Subject node
     * @param {NamedNode} predicate - Predicate node  
     * @param {NamedNode|Literal} object - Object node or literal
     * @param {NamedNode} [graph] - Optional graph context
     */
    addTriple(subject, predicate, object, graph) {
        const quad = graph 
            ? rdf.quad(subject, predicate, object, graph)
            : rdf.quad(subject, predicate, object)
        this.dataset.add(quad)
    }

    /**
     * Add type declaration for a resource
     * @param {NamedNode} subject - Resource to type
     * @param {NamedNode} type - RDF type (e.g., ragno:Entity)
     */
    addType(subject, type) {
        this.addTriple(subject, this.ns.rdf.type, type)
    }

    /**
     * Add content property to a resource
     * @param {NamedNode} subject - Resource
     * @param {string} content - Text content
     */
    addContent(subject, content) {
        this.addTriple(subject, this.ns.ragno.content, rdf.literal(content))
    }

    /**
     * Add SKOS preferred label
     * @param {NamedNode} subject - Resource
     * @param {string} label - Label text
     * @param {string} [lang='en'] - Language tag
     */
    addLabel(subject, label, lang = 'en') {
        this.addTriple(subject, this.ns.skos.prefLabel, rdf.literal(label, lang))
    }

    /**
     * Create a ragno:Entity with proper RDF structure
     * @param {string} name - Entity name
     * @param {boolean} [isEntryPoint=true] - Whether entity is an entry point
     * @returns {NamedNode} Created entity node
     */
    createEntity(name, isEntryPoint = true) {
        const entity = this.createNamedNode('entity')
        
        // Add required RDF properties
        this.addType(entity, this.ns.ragno.Entity)
        this.addLabel(entity, name)
        this.addTriple(entity, this.ns.ragno.isEntryPoint, rdf.literal(isEntryPoint))
        
        logger.debug(`Created ragno:Entity: ${entity.value} with name "${name}"`)
        return entity
    }

    /**
     * Create a ragno:Unit with proper RDF structure
     * @param {string} content - Unit content
     * @param {string} [source] - Source document reference
     * @returns {NamedNode} Created unit node
     */
    createUnit(content, source) {
        const unit = this.createNamedNode('unit')
        
        // Add required RDF properties
        this.addType(unit, this.ns.ragno.Unit)
        this.addContent(unit, content)
        
        if (source) {
            this.addTriple(unit, this.ns.ragno.hasSourceDocument, rdf.namedNode(source))
        }
        
        logger.debug(`Created ragno:Unit: ${unit.value}`)
        return unit
    }

    /**
     * Create a ragno:Relationship as first-class RDF resource
     * @param {NamedNode} sourceEntity - Source entity
     * @param {NamedNode} targetEntity - Target entity
     * @param {string} description - Relationship description
     * @param {number} [weight=1.0] - Relationship weight
     * @returns {NamedNode} Created relationship node
     */
    createRelationship(sourceEntity, targetEntity, description, weight = 1.0) {
        const relationship = this.createNamedNode('relationship')
        
        // Add required RDF properties following ragno ontology
        this.addType(relationship, this.ns.ragno.Relationship)
        this.addTriple(relationship, this.ns.ragno.hasSourceEntity, sourceEntity)
        this.addTriple(relationship, this.ns.ragno.hasTargetEntity, targetEntity)
        this.addContent(relationship, description)
        this.addTriple(relationship, this.ns.ragno.hasWeight, rdf.literal(weight))
        
        logger.debug(`Created ragno:Relationship: ${relationship.value} between ${sourceEntity.value} and ${targetEntity.value}`)
        return relationship
    }

    /**
     * Create a ragno:Attribute with entity connection
     * @param {NamedNode} entity - Entity this attribute describes
     * @param {string} content - Attribute content
     * @param {string} [subType] - Attribute subtype (e.g., "Overview")
     * @returns {NamedNode} Created attribute node
     */
    createAttribute(entity, content, subType) {
        const attribute = this.createNamedNode('attribute')
        
        // Add required RDF properties
        this.addType(attribute, this.ns.ragno.Attribute)
        this.addContent(attribute, content)
        
        if (subType) {
            this.addTriple(attribute, this.ns.ragno.subType, this.ns.ex(subType))
        }
        
        // Link to entity
        this.addTriple(entity, this.ns.ragno.hasAttribute, attribute)
        
        logger.debug(`Created ragno:Attribute: ${attribute.value} for entity ${entity.value}`)
        return attribute
    }

    /**
     * Connect two elements with ragno:connectsTo
     * @param {NamedNode} source - Source element
     * @param {NamedNode} target - Target element
     * @param {number} [weight] - Optional connection weight
     */
    connectElements(source, target, weight) {
        this.addTriple(source, this.ns.ragno.connectsTo, target)
        
        if (weight !== undefined) {
            // Create a reified statement for the weight
            const connection = this.createNamedNode('connection')
            this.addTriple(connection, this.ns.rdf.subject, source)
            this.addTriple(connection, this.ns.rdf.predicate, this.ns.ragno.connectsTo)
            this.addTriple(connection, this.ns.rdf.object, target)
            this.addTriple(connection, this.ns.ragno.hasWeight, rdf.literal(weight))
        }
    }

    /**
     * Query the dataset using SPARQL-like patterns
     * @param {NamedNode} [subject] - Subject pattern (null for any)
     * @param {NamedNode} [predicate] - Predicate pattern (null for any)
     * @param {NamedNode|Literal} [object] - Object pattern (null for any)
     * @returns {Array} Array of matching quads
     */
    query(subject = null, predicate = null, object = null) {
        return [...this.dataset.match(subject, predicate, object)]
    }

    /**
     * Get all entities in the dataset
     * @returns {Array<NamedNode>} Array of entity nodes
     */
    getEntities() {
        return this.query(null, this.ns.rdf.type, this.ns.ragno.Entity)
            .map(quad => quad.subject)
    }

    /**
     * Get all relationships in the dataset
     * @returns {Array<NamedNode>} Array of relationship nodes
     */
    getRelationships() {
        return this.query(null, this.ns.rdf.type, this.ns.ragno.Relationship)
            .map(quad => quad.subject)
    }

    /**
     * Get all units in the dataset
     * @returns {Array<NamedNode>} Array of unit nodes
     */
    getUnits() {
        return this.query(null, this.ns.rdf.type, this.ns.ragno.Unit)
            .map(quad => quad.subject)
    }

    /**
     * Export dataset to N-Triples format
     * @returns {string} N-Triples serialization
     */
    toNTriples() {
        return [...this.dataset].map(quad => {
            const subject = quad.subject.value
            const predicate = quad.predicate.value
            const object = quad.object.termType === 'Literal' 
                ? `"${quad.object.value}"` 
                : quad.object.value
            return `<${subject}> <${predicate}> <${object}> .`
        }).join('\n')
    }

    /**
     * Get dataset statistics
     * @returns {Object} Statistics about the graph
     */
    getStats() {
        const entities = this.getEntities().length
        const relationships = this.getRelationships().length
        const units = this.getUnits().length
        const totalTriples = this.dataset.size
        
        return {
            entities,
            relationships,
            units,
            totalTriples,
            types: {
                'ragno:Entity': entities,
                'ragno:Relationship': relationships,
                'ragno:Unit': units
            }
        }
    }

    /**
     * Clear the dataset
     */
    clear() {
        this.dataset = rdf.dataset()
        this.counters.clear()
        logger.info('RDF dataset cleared')
    }

    /**
     * Clone the current dataset
     * @returns {RDFGraphManager} New instance with cloned data
     */
    clone() {
        const cloned = new RDFGraphManager({ uriBase: this.uriBase })
        for (const quad of this.dataset) {
            cloned.dataset.add(quad)
        }
        cloned.counters = new Map(this.counters)
        return cloned
    }
}