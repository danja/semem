/**
 * RDFElement.js - Base class for all Ragno RDF elements
 * 
 * This abstract base class provides common functionality for all ragno:Element
 * instances, including RDF triple management, SKOS properties, and provenance
 * tracking following the ragno ontology specification.
 * 
 * Key Features:
 * - RDF-Ext integration for triple management
 * - SKOS Concept compliance
 * - Provenance tracking with PROV-O
 * - URI management and validation
 * - Common ragno properties implementation
 */

import rdf from 'rdf-ext'
import NamespaceManager from '../core/NamespaceManager.js'
import { logger } from '../../Utils.js'

export default class RDFElement {
    /**
     * Get the URI of this element
     * @returns {string} The URI string
     */
    getURI() {
        return this.uri;
    }
    constructor(options = {}) {
        // Initialize namespace manager
        this.ns = new NamespaceManager(options)
        
        // Create or use provided dataset
        this.dataset = options.dataset || rdf.dataset()
        
        // Generate or use provided URI
        this.uri = options.uri || this.generateURI(options.type || 'element')
        this.node = rdf.namedNode(this.uri)
        
        // Track creation metadata
        this.created = new Date()
        this.modified = new Date()
        
        // Initialize as ragno:Element and skos:Concept
        this.addType(this.ns.classes.Element)
        this.addType(this.ns.skos.Concept)
        
        // Add creation timestamp
        this.addTriple(
            this.ns.dcProperties.created, 
            rdf.literal(this.created.toISOString(), this.ns.xsd.dateTime)
        )
        
        logger.debug(`Created RDFElement: ${this.uri}`)
    }
    
    /**
     * Generate a unique URI for this element
     * @param {string} type - Element type
     * @returns {string} Generated URI
     */
    generateURI(type) {
        const timestamp = Date.now()
        const random = Math.random().toString(36).substring(2, 8)
        return `${this.ns.uriBase}${type}/${timestamp}-${random}`
    }
    
    /**
     * Add a triple to the dataset with this element as subject
     * @param {NamedNode} predicate - Predicate
     * @param {NamedNode|Literal} object - Object
     * @param {NamedNode} [graph] - Optional graph context
     */
    addTriple(predicate, object, graph) {
        const quad = graph 
            ? rdf.quad(this.node, predicate, object, graph)
            : rdf.quad(this.node, predicate, object)
        this.dataset.add(quad)
        this.updateModified()
    }
    
    /**
     * Remove a triple from the dataset
     * @param {NamedNode} predicate - Predicate
     * @param {NamedNode|Literal} [object] - Object (optional for removing all)
     */
    removeTriple(predicate, object = null) {
        const toRemove = [...this.dataset.match(this.node, predicate, object)]
        for (const quad of toRemove) {
            this.dataset.delete(quad)
        }
        this.updateModified()
    }
    
    /**
     * Add RDF type to this element
     * @param {NamedNode} type - RDF type
     */
    addType(type) {
        this.addTriple(this.ns.rdf.type, type)
    }
    
    /**
     * Set content for this element
     * @param {string} content - Text content
     */
    setContent(content) {
        this.removeTriple(this.ns.properties.content)
        this.addTriple(this.ns.properties.content, rdf.literal(content))
    }
    
    /**
     * Get content of this element
     * @returns {string|null} Content text
     */
    getContent() {
        const quads = [...this.dataset.match(this.node, this.ns.properties.content)]
        return quads.length > 0 ? quads[0].object.value : null
    }
    
    /**
     * Set SKOS preferred label
     * @param {string} label - Label text
     * @param {string} [lang='en'] - Language tag
     */
    setPrefLabel(label, lang = 'en') {
        this.removeTriple(this.ns.skosProperties.prefLabel)
        this.addTriple(this.ns.skosProperties.prefLabel, rdf.literal(label, lang))
    }
    
    /**
     * Get SKOS preferred label
     * @returns {string|null} Label text
     */
    getPrefLabel() {
        const quads = [...this.dataset.match(this.node, this.ns.skosProperties.prefLabel)]
        return quads.length > 0 ? quads[0].object.value : null
    }
    
    /**
     * Add SKOS alternative label
     * @param {string} label - Alternative label
     * @param {string} [lang='en'] - Language tag
     */
    addAltLabel(label, lang = 'en') {
        this.addTriple(this.ns.skosProperties.altLabel, rdf.literal(label, lang))
    }
    
    /**
     * Set whether this element is an entry point
     * @param {boolean} isEntryPoint - Entry point status
     */
    setEntryPoint(isEntryPoint) {
        this.removeTriple(this.ns.properties.isEntryPoint)
        this.addTriple(this.ns.properties.isEntryPoint, rdf.literal(isEntryPoint))
    }
    
    /**
     * Check if this element is an entry point
     * @returns {boolean} Entry point status
     */
    isEntryPoint() {
        const quads = [...this.dataset.match(this.node, this.ns.properties.isEntryPoint)]
        if (quads.length > 0) {
            return quads[0].object.value === 'true'
        }
        return false
    }
    
    /**
     * Set sub-type for this element
     * @param {string} subType - Sub-type identifier
     */
    setSubType(subType) {
        this.removeTriple(this.ns.properties.subType)
        this.addTriple(this.ns.properties.subType, this.ns.ex(subType))
    }
    
    /**
     * Get sub-type of this element
     * @returns {string|null} Sub-type identifier
     */
    getSubType() {
        const quads = [...this.dataset.match(this.node, this.ns.properties.subType)]
        if (quads.length > 0) {
            const uri = quads[0].object.value
            return uri.substring(this.ns.uriBase.length)
        }
        return null
    }
    
    /**
     * Connect this element to another element
     * @param {RDFElement|NamedNode} target - Target element
     * @param {number} [weight] - Optional weight
     */
    connectTo(target, weight) {
        const targetNode = target instanceof RDFElement ? target.node : target
        this.addTriple(this.ns.properties.connectsTo, targetNode)
        
        if (weight !== undefined) {
            // Create reified statement for weight
            const connection = rdf.namedNode(this.generateURI('connection'))
            this.dataset.add(rdf.quad(connection, this.ns.rdf.subject, this.node))
            this.dataset.add(rdf.quad(connection, this.ns.rdf.predicate, this.ns.properties.connectsTo))
            this.dataset.add(rdf.quad(connection, this.ns.rdf.object, targetNode))
            this.dataset.add(rdf.quad(connection, this.ns.properties.hasWeight, rdf.literal(weight)))
        }
    }
    
    /**
     * Add provenance information
     * @param {string} sourceURI - Source document/entity URI
     */
    addProvenance(sourceURI) {
        this.addTriple(this.ns.provProperties.wasDerivedFrom, rdf.namedNode(sourceURI))
    }
    
    /**
     * Set PPR score for this element
     * @param {number} score - PPR score
     */
    setPPRScore(score) {
        this.removeTriple(this.ns.properties.hasPPRScore)
        this.addTriple(this.ns.properties.hasPPRScore, rdf.literal(score))
    }
    
    /**
     * Get PPR score for this element
     * @returns {number|null} PPR score
     */
    getPPRScore() {
        const quads = [...this.dataset.match(this.node, this.ns.properties.hasPPRScore)]
        return quads.length > 0 ? parseFloat(quads[0].object.value) : null
    }
    
    /**
     * Set similarity score for this element
     * @param {number} score - Similarity score
     */
    setSimilarityScore(score) {
        this.removeTriple(this.ns.properties.hasSimilarityScore)
        this.addTriple(this.ns.properties.hasSimilarityScore, rdf.literal(score))
    }
    
    /**
     * Get similarity score for this element
     * @returns {number|null} Similarity score
     */
    getSimilarityScore() {
        const quads = [...this.dataset.match(this.node, this.ns.properties.hasSimilarityScore)]
        return quads.length > 0 ? parseFloat(quads[0].object.value) : null
    }
    
    /**
     * Get all triples where this element is the subject
     * @returns {Array} Array of quads
     */
    getTriples() {
        return [...this.dataset.match(this.node)]
    }
    
    /**
     * Get all triples with specific predicate
     * @param {NamedNode} predicate - Predicate to match
     * @returns {Array} Array of matching quads
     */
    getTriplesWithPredicate(predicate) {
        return [...this.dataset.match(this.node, predicate)]
    }
    
    /**
     * Get all connected elements
     * @returns {Array<NamedNode>} Array of connected element URIs
     */
    getConnectedElements() {
        return this.getTriplesWithPredicate(this.ns.properties.connectsTo)
            .map(quad => quad.object)
    }
    
    /**
     * Check if this element has a specific type
     * @param {NamedNode} type - RDF type to check
     * @returns {boolean} True if element has this type
     */
    hasType(type) {
        return this.getTriplesWithPredicate(this.ns.rdf.type)
            .some(quad => quad.object.equals(type))
    }
    
    /**
     * Get all types of this element
     * @returns {Array<NamedNode>} Array of RDF types
     */
    getTypes() {
        return this.getTriplesWithPredicate(this.ns.rdf.type)
            .map(quad => quad.object)
    }
    
    /**
     * Update the modified timestamp
     */
    updateModified() {
        this.modified = new Date()
        
        // Remove existing modified triples without triggering updateModified recursion
        const toRemove = [...this.dataset.match(this.node, this.ns.dcProperties.modified)]
        for (const quad of toRemove) {
            this.dataset.delete(quad)
        }
        
        // Add new modified timestamp
        const quad = rdf.quad(
            this.node, 
            this.ns.dcProperties.modified, 
            rdf.literal(this.modified.toISOString(), this.ns.xsd.dateTime)
        )
        this.dataset.add(quad)
    }
    
    /**
     * Validate this element against ragno ontology constraints
     * @returns {Object} Validation result with errors array
     */
    validate() {
        const errors = []
        
        // Check required types
        if (!this.hasType(this.ns.classes.Element)) {
            errors.push('Element must have ragno:Element type')
        }
        
        if (!this.hasType(this.ns.skos.Concept)) {
            errors.push('Element must have skos:Concept type')
        }
        
        // Check URI format
        if (!this.ns.validateRagnoURI || !this.ns.validateRagnoURI(this.uri, 'individual')) {
            errors.push('Invalid URI format for ragno element')
        }
        
        return {
            valid: errors.length === 0,
            errors
        }
    }
    
    /**
     * Export this element as N-Triples
     * @returns {string} N-Triples representation
     */
    toNTriples() {
        return this.getTriples().map(quad => {
            const subject = `<${quad.subject.value}>`
            const predicate = `<${quad.predicate.value}>`
            const object = quad.object.termType === 'Literal' 
                ? `"${quad.object.value}"${quad.object.language ? `@${quad.object.language}` : ''}${quad.object.datatype ? `^^<${quad.object.datatype.value}>` : ''}`
                : `<${quad.object.value}>`
            return `${subject} ${predicate} ${object} .`
        }).join('\n')
    }
    
    /**
     * Export this element as Turtle (simplified)
     * @returns {string} Turtle representation
     */
    toTurtle() {
        const prefixes = this.ns.getTurtlePrefixes()
        const compressedURI = this.ns.compress(this.uri)
        
        const triples = this.getTriples().map(quad => {
            const predicate = this.ns.compress(quad.predicate.value)
            const object = quad.object.termType === 'Literal' 
                ? `"${quad.object.value}"${quad.object.language ? `@${quad.object.language}` : ''}${quad.object.datatype ? `^^${this.ns.compress(quad.object.datatype.value)}` : ''}`
                : this.ns.compress(quad.object.value)
            return `    ${predicate} ${object}`
        }).join(' ;\n')
        
        return `${prefixes}\n\n${compressedURI}\n${triples} .`
    }
    
    /**
     * Get element metadata
     * @returns {Object} Element metadata
     */
    getMetadata() {
        return {
            uri: this.uri,
            types: this.getTypes().map(type => this.ns.compress(type.value)),
            prefLabel: this.getPrefLabel(),
            content: this.getContent(),
            isEntryPoint: this.isEntryPoint(),
            subType: this.getSubType(),
            created: this.created,
            modified: this.modified,
            tripleCount: this.getTriples().length,
            connections: this.getConnectedElements().length
        }
    }
    
    /**
     * Clone this element with a new URI
     * @param {Object} [options] - Options for the cloned element
     * @returns {RDFElement} Cloned element
     */
    clone(options = {}) {
        const cloned = new RDFElement({
            ...options,
            type: options.type || 'element'
        })
        
        // Copy all triples except URI-specific ones
        for (const quad of this.getTriples()) {
            if (!quad.predicate.equals(this.ns.dcProperties.created)) {
                cloned.addTriple(quad.predicate, quad.object)
            }
        }
        
        return cloned
    }
    /**
     * Export all triples of this element to a target dataset
     * @param {Dataset} targetDataset - The RDF-Ext dataset to export to
     */
    exportToDataset(targetDataset) {
        for (const quad of this.getTriples()) {
            targetDataset.add(quad)
        }
    }
}