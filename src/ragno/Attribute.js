/**
 * Attribute.js - RDF-based Attribute implementation for Ragno
 * 
 * This class represents ragno:Attribute as an RDF resource following the ragno ontology
 * specification. Attributes describe properties or characteristics of entities,
 * providing detailed information that enhances entity understanding.
 * 
 * Key Features:
 * - First-class RDF resource following ragno:Attribute
 * - SKOS Concept compliance for semantic interoperability
 * - Entity association via ragno:hasAttribute relationship
 * - Sub-type classification (Overview, Technical, Historical, etc.)
 * - Provenance tracking for source information
 * - Summary and detailed content management
 */

import rdf from 'rdf-ext'
import RDFElement from './models/RDFElement.js'
import { logger } from '../Utils.js'

export default class Attribute extends RDFElement {
    constructor(options = {}) {
        // Initialize with attribute type
        super({
            ...options,
            type: 'attribute'
        })
        
        // Add ragno:Attribute type
        this.addType(this.ns.classes.Attribute)
        
        // Set text content if provided
        if (options.text || options.content) {
            const content = options.text || options.content
            this.setContent(content)
        }
        
        // Set summary if provided (as SKOS definition)
        if (options.summary) {
            this.setSummary(options.summary)
        }
        
        // Set entity association if provided
        if (options.entity) {
            this.setEntity(options.entity)
        }
        
        // Set sub-type if provided (e.g., "Overview", "Technical", "Historical")
        if (options.subType) {
            this.setSubType(options.subType)
        }
        
        // Set provenance information if provided
        if (options.provenance) {
            this.setProvenance(options.provenance)
        }
        
        // Attributes are typically not entry points (entities are)
        this.setEntryPoint(options.isEntryPoint !== undefined ? options.isEntryPoint : false)
        
        // Set confidence score if provided
        if (options.confidence !== undefined) {
            this.setConfidence(options.confidence)
        }
        
        logger.debug(`Created ragno:Attribute: ${this.uri}`)
    }
    
    /**
     * Set the main text content for this attribute
     * @param {string} text - Text content
     */
    setText(text) {
        this.setContent(text)
    }
    
    /**
     * Get the main text content of this attribute
     * @returns {string|null} Text content
     */
    getText() {
        return this.getContent()
    }
    
    /**
     * Set summary for this attribute (stored as SKOS definition)
     * @param {string} summary - Summary text
     * @param {string} [lang='en'] - Language tag
     */
    setSummary(summary, lang = 'en') {
        this.removeTriple(this.ns.skosProperties.definition)
        this.addTriple(this.ns.skosProperties.definition, rdf.literal(summary, lang))
    }
    
    /**
     * Get summary for this attribute
     * @returns {string|null} Summary text
     */
    getSummary() {
        const quads = this.getTriplesWithPredicate(this.ns.skosProperties.definition)
        return quads.length > 0 ? quads[0].object.value : null
    }
    
    /**
     * Set the entity this attribute describes
     * @param {Entity|NamedNode|string} entity - Entity reference
     */
    setEntity(entity) {
        this.removeTriple(this.ns.ex('describesEntity'))
        const entityNode = this._normalizeEntityReference(entity)
        this.addTriple(this.ns.ex('describesEntity'), entityNode)
    }
    
    /**
     * Get the entity this attribute describes
     * @returns {NamedNode|null} Entity node
     */
    getEntity() {
        const quads = this.getTriplesWithPredicate(this.ns.ex('describesEntity'))
        return quads.length > 0 ? quads[0].object : null
    }
    
    /**
     * Set provenance information for this attribute
     * @param {string|NamedNode} provenance - Provenance source URI or node
     */
    setProvenance(provenance) {
        const provenanceNode = typeof provenance === 'string' ? rdf.namedNode(provenance) : provenance
        this.addProvenance(provenanceNode.value)
    }
    
    /**
     * Get provenance information for this attribute
     * @returns {Array<NamedNode>} Provenance nodes
     */
    getProvenance() {
        return this.getTriplesWithPredicate(this.ns.provProperties.wasDerivedFrom)
            .map(quad => quad.object)
    }
    
    /**
     * Set confidence score for this attribute
     * @param {number} confidence - Confidence score (0-1)
     */
    setConfidence(confidence) {
        this.removeTriple(this.ns.ex('confidence'))
        this.addTriple(this.ns.ex('confidence'), rdf.literal(confidence))
    }
    
    /**
     * Get confidence score for this attribute
     * @returns {number|null} Confidence score
     */
    getConfidence() {
        const quads = this.getTriplesWithPredicate(this.ns.ex('confidence'))
        return quads.length > 0 ? parseFloat(quads[0].object.value) : null
    }
    
    /**
     * Set the attribute category/type (more specific than subType)
     * @param {string} category - Attribute category
     */
    setCategory(category) {
        this.removeTriple(this.ns.ex('category'))
        this.addTriple(this.ns.ex('category'), rdf.literal(category))
    }
    
    /**
     * Get the attribute category/type
     * @returns {string|null} Attribute category
     */
    getCategory() {
        const quads = this.getTriplesWithPredicate(this.ns.ex('category'))
        return quads.length > 0 ? quads[0].object.value : null
    }
    
    /**
     * Set temporal information for this attribute (when it was true/relevant)
     * @param {Date|string} timestamp - Temporal information
     */
    setTemporal(timestamp) {
        this.removeTriple(this.ns.ex('temporal'))
        const date = timestamp instanceof Date ? timestamp : new Date(timestamp)
        this.addTriple(
            this.ns.ex('temporal'),
            rdf.literal(date.toISOString(), this.ns.xsd.dateTime)
        )
    }
    
    /**
     * Get temporal information for this attribute
     * @returns {Date|null} Temporal information
     */
    getTemporal() {
        const quads = this.getTriplesWithPredicate(this.ns.ex('temporal'))
        return quads.length > 0 ? new Date(quads[0].object.value) : null
    }
    
    /**
     * Set corpus association for this attribute
     * @param {string|NamedNode} corpus - Corpus URI or node
     */
    setCorpus(corpus) {
        this.removeTriple(this.ns.properties.inCorpus)
        const corpusNode = typeof corpus === 'string' ? rdf.namedNode(corpus) : corpus
        this.addTriple(this.ns.properties.inCorpus, corpusNode)
    }
    
    /**
     * Get corpus association for this attribute
     * @returns {NamedNode|null} Corpus node
     */
    getCorpus() {
        const quads = this.getTriplesWithPredicate(this.ns.properties.inCorpus)
        return quads.length > 0 ? quads[0].object : null
    }
    
    /**
     * Add supporting evidence for this attribute
     * @param {SemanticUnit|NamedNode|string} evidence - Evidence source (e.g., semantic unit)
     */
    addEvidence(evidence) {
        const evidenceNode = this._normalizeUnitReference(evidence)
        this.addTriple(this.ns.provProperties.used, evidenceNode)
    }
    
    /**
     * Get all evidence sources for this attribute
     * @returns {Array<NamedNode>} Evidence nodes
     */
    getEvidence() {
        return this.getTriplesWithPredicate(this.ns.provProperties.used)
            .map(quad => quad.object)
    }
    
    /**
     * Set language for this attribute
     * @param {string} language - Language code (e.g., 'en', 'es')
     */
    setLanguage(language) {
        this.removeTriple(this.ns.dcProperties.language)
        this.addTriple(this.ns.dcProperties.language, rdf.literal(language))
    }
    
    /**
     * Get language for this attribute
     * @returns {string|null} Language code
     */
    getLanguage() {
        const quads = this.getTriplesWithPredicate(this.ns.dcProperties.language)
        return quads.length > 0 ? quads[0].object.value : null
    }
    
    /**
     * Add a keyword/tag to this attribute
     * @param {string} keyword - Keyword or tag
     */
    addKeyword(keyword) {
        this.addTriple(this.ns.ex('keyword'), rdf.literal(keyword))
    }
    
    /**
     * Get all keywords/tags for this attribute
     * @returns {Array<string>} Keywords
     */
    getKeywords() {
        return this.getTriplesWithPredicate(this.ns.ex('keyword'))
            .map(quad => quad.object.value)
    }
    
    /**
     * Check if this attribute is relevant to a specific time period
     * @param {Date} date - Date to check
     * @returns {boolean} True if attribute is relevant at the given date
     */
    isRelevantAt(date) {
        const temporal = this.getTemporal()
        if (!temporal) {
            return true // No temporal constraint means always relevant
        }
        // Simple check - could be enhanced with time ranges
        return temporal <= date
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
     * Validate this attribute according to ragno ontology
     * @returns {Object} Validation result
     */
    validate() {
        const baseValidation = super.validate()
        const errors = [...baseValidation.errors]
        
        // Check ragno:Attribute type
        if (!this.hasType(this.ns.classes.Attribute)) {
            errors.push('Attribute must have ragno:Attribute type')
        }
        
        // Check required content
        if (!this.getText()) {
            errors.push('Attribute must have text content')
        }
        
        // Check entity association (attributes should describe an entity)
        if (!this.getEntity()) {
            errors.push('Attribute should be associated with an entity')
        }
        
        // Check confidence score is valid range
        const confidence = this.getConfidence()
        if (confidence !== null && (confidence < 0 || confidence > 1)) {
            errors.push('Attribute confidence score must be between 0 and 1')
        }
        
        return {
            valid: errors.length === 0,
            errors
        }
    }
    
    /**
     * Get attribute metadata including ragno-specific properties
     * @returns {Object} Attribute metadata
     */
    getMetadata() {
        const baseMetadata = super.getMetadata()
        
        return {
            ...baseMetadata,
            text: this.getText(),
            summary: this.getSummary(),
            entity: this.getEntity()?.value,
            category: this.getCategory(),
            confidence: this.getConfidence(),
            temporal: this.getTemporal(),
            language: this.getLanguage(),
            corpus: this.getCorpus()?.value,
            provenanceCount: this.getProvenance().length,
            evidenceCount: this.getEvidence().length,
            keywordCount: this.getKeywords().length
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
            entity: this.getEntity()?.value,
            category: this.getCategory(),
            subType: this.getSubType(),
            confidence: this.getConfidence(),
            temporal: this.getTemporal()?.toISOString(),
            language: this.getLanguage(),
            corpus: this.getCorpus()?.value,
            provenance: this.getProvenance().map(p => p.value),
            keywords: this.getKeywords(),
            isEntryPoint: this.isEntryPoint()
        }
    }
    
    /**
     * Create attribute from simple object (migration helper)
     * @param {Object} obj - Simple object representation
     * @param {Object} [options] - Additional options
     * @returns {Attribute} RDF-based attribute
     */
    static fromSimpleObject(obj, options = {}) {
        const attribute = new Attribute({
            ...options,
            text: obj.text,
            summary: obj.summary,
            entity: obj.entity,
            category: obj.category,
            subType: obj.subType,
            confidence: obj.confidence,
            temporal: obj.temporal,
            language: obj.language,
            corpus: obj.corpus,
            isEntryPoint: obj.isEntryPoint
        })
        
        // Add provenance if provided
        if (obj.provenance) {
            if (Array.isArray(obj.provenance)) {
                obj.provenance.forEach(p => attribute.setProvenance(p))
            } else {
                attribute.setProvenance(obj.provenance)
            }
        }
        
        // Add keywords if provided
        if (obj.keywords && Array.isArray(obj.keywords)) {
            obj.keywords.forEach(keyword => attribute.addKeyword(keyword))
        }
        
        return attribute
    }
    
    /**
     * Create an attribute with automatic URI generation
     * @param {string} text - Attribute text content
     * @param {Entity|NamedNode|string} entity - Associated entity
     * @param {Object} [options] - Additional options
     * @returns {Attribute} Created attribute
     */
    static create(text, entity, options = {}) {
        return new Attribute({
            ...options,
            text,
            entity
        })
    }
    
    /**
     * Create an overview attribute for an entity (common pattern)
     * @param {Entity|NamedNode|string} entity - Associated entity
     * @param {string} text - Overview text
     * @param {Object} [options] - Additional options
     * @returns {Attribute} Created overview attribute
     */
    static createOverview(entity, text, options = {}) {
        return new Attribute({
            ...options,
            text,
            entity,
            subType: 'Overview',
            category: 'Description'
        })
    }
    
    /**
     * Clone this attribute with optional modifications
     * @param {Object} [modifications] - Properties to modify in the clone
     * @returns {Attribute} Cloned attribute
     */
    clone(modifications = {}) {
        const cloned = new Attribute({
            dataset: rdf.dataset(), // New dataset for clone
            text: modifications.text || this.getText(),
            summary: modifications.summary || this.getSummary(),
            entity: modifications.entity || this.getEntity(),
            category: modifications.category || this.getCategory(),
            subType: modifications.subType || this.getSubType(),
            confidence: modifications.confidence !== undefined ? modifications.confidence : this.getConfidence(),
            temporal: modifications.temporal || this.getTemporal(),
            language: modifications.language || this.getLanguage(),
            corpus: modifications.corpus || this.getCorpus(),
            isEntryPoint: modifications.isEntryPoint !== undefined ? modifications.isEntryPoint : this.isEntryPoint()
        })
        
        // Copy additional properties that aren't handled by constructor
        for (const quad of this.getTriples()) {
            // Skip properties that are handled by constructor
            if (!quad.predicate.equals(this.ns.properties.content) &&
                !quad.predicate.equals(this.ns.skosProperties.definition) &&
                !quad.predicate.equals(this.ns.ex('describesEntity')) &&
                !quad.predicate.equals(this.ns.ex('category')) &&
                !quad.predicate.equals(this.ns.properties.subType) &&
                !quad.predicate.equals(this.ns.ex('confidence')) &&
                !quad.predicate.equals(this.ns.ex('temporal')) &&
                !quad.predicate.equals(this.ns.dcProperties.language) &&
                !quad.predicate.equals(this.ns.properties.inCorpus) &&
                !quad.predicate.equals(this.ns.properties.isEntryPoint) &&
                !quad.predicate.equals(this.ns.dcProperties.created)) {
                cloned.addTriple(quad.predicate, quad.object)
            }
        }
        
        return cloned
    }
}