/**
 * Relationship.js - RDF-based Relationship implementation for Ragno
 * 
 * This class represents ragno:Relationship as a first-class RDF resource,
 * following the ragno ontology specification where relationships are nodes
 * rather than simple properties between entities.
 * 
 * Key Features:
 * - First-class RDF resource following ragno:Relationship
 * - Source and target entity connections via ragno:hasSourceEntity/ragno:hasTargetEntity
 * - Content and weight properties for relationship description
 * - Full SKOS Concept compliance for semantic interoperability
 * - Provenance tracking and metadata management
 */

import rdf from 'rdf-ext'
import RDFElement from './models/RDFElement.js'
import { logger } from '../Utils.js'

export default class Relationship extends RDFElement {
    constructor(options = {}) {
        // Initialize with relationship type
        super({
            ...options,
            type: 'relationship'
        })
        
        // Add ragno:Relationship type
        this.addType(this.ns.classes.Relationship)
        
        // Set source entity if provided
        if (options.sourceEntity) {
            this.setSourceEntity(options.sourceEntity)
        }
        
        // Set target entity if provided
        if (options.targetEntity) {
            this.setTargetEntity(options.targetEntity)
        }
        
        // Set description/content if provided
        if (options.description) {
            this.setContent(options.description)
        }
        
        // Set weight if provided
        if (options.weight !== undefined) {
            this.setWeight(options.weight)
        }
        
        // Set relationship type if provided
        if (options.relationshipType) {
            this.setRelationshipType(options.relationshipType)
        }
        
        logger.debug(`Created ragno:Relationship: ${this.uri}`)
    }
    
    /**
     * Set the source entity for this relationship
     * @param {RDFElement|NamedNode|string} sourceEntity - Source entity
     */
    setSourceEntity(sourceEntity) {
        this.removeTriple(this.ns.properties.hasSourceEntity)
        
        const sourceNode = this._normalizeEntityReference(sourceEntity)
        this.addTriple(this.ns.properties.hasSourceEntity, sourceNode)
        
        logger.debug(`Set source entity: ${sourceNode.value} for relationship ${this.uri}`)
    }
    
    /**
     * Get the source entity for this relationship
     * @returns {NamedNode|null} Source entity node
     */
    getSourceEntity() {
        const quads = this.getTriplesWithPredicate(this.ns.properties.hasSourceEntity)
        return quads.length > 0 ? quads[0].object : null
    }
    
    /**
     * Set the target entity for this relationship
     * @param {RDFElement|NamedNode|string} targetEntity - Target entity
     */
    setTargetEntity(targetEntity) {
        this.removeTriple(this.ns.properties.hasTargetEntity)
        
        const targetNode = this._normalizeEntityReference(targetEntity)
        this.addTriple(this.ns.properties.hasTargetEntity, targetNode)
        
        logger.debug(`Set target entity: ${targetNode.value} for relationship ${this.uri}`)
    }
    
    /**
     * Get the target entity for this relationship
     * @returns {NamedNode|null} Target entity node
     */
    getTargetEntity() {
        const quads = this.getTriplesWithPredicate(this.ns.properties.hasTargetEntity)
        return quads.length > 0 ? quads[0].object : null
    }
    
    /**
     * Set the weight for this relationship
     * @param {number} weight - Relationship weight
     */
    setWeight(weight) {
        this.removeTriple(this.ns.properties.hasWeight)
        this.addTriple(this.ns.properties.hasWeight, rdf.literal(weight))
    }
    
    /**
     * Get the weight for this relationship
     * @returns {number|null} Relationship weight
     */
    getWeight() {
        const quads = this.getTriplesWithPredicate(this.ns.properties.hasWeight)
        return quads.length > 0 ? parseFloat(quads[0].object.value) : null
    }
    
    /**
     * Set the relationship type (semantic classification)
     * @param {string} relType - Relationship type (e.g., "causal", "temporal", "part-of")
     */
    setRelationshipType(relType) {
        this.setSubType(relType)
    }
    
    /**
     * Get the relationship type
     * @returns {string|null} Relationship type
     */
    getRelationshipType() {
        return this.getSubType()
    }
    
    /**
     * Create a bidirectional relationship (adds inverse)
     * @param {string} [inverseDescription] - Description for inverse relationship
     * @param {number} [inverseWeight] - Weight for inverse relationship
     * @returns {Relationship} Inverse relationship
     */
    createBidirectional(inverseDescription, inverseWeight) {
        const sourceEntity = this.getSourceEntity()
        const targetEntity = this.getTargetEntity()
        
        if (!sourceEntity || !targetEntity) {
            throw new Error('Cannot create bidirectional relationship without source and target entities')
        }
        
        const inverse = new Relationship({
            dataset: this.dataset,
            sourceEntity: targetEntity,
            targetEntity: sourceEntity,
            description: inverseDescription || this.getContent(),
            weight: inverseWeight || this.getWeight(),
            relationshipType: this.getRelationshipType()
        })
        
        // Link the relationships
        this.connectTo(inverse.node)
        inverse.connectTo(this.node)
        
        return inverse
    }
    
    /**
     * Check if this relationship connects two specific entities
     * @param {RDFElement|NamedNode|string} entity1 - First entity
     * @param {RDFElement|NamedNode|string} entity2 - Second entity
     * @returns {boolean} True if relationship connects these entities
     */
    connects(entity1, entity2) {
        const node1 = this._normalizeEntityReference(entity1)
        const node2 = this._normalizeEntityReference(entity2)
        
        const source = this.getSourceEntity()
        const target = this.getTargetEntity()
        
        return (source && target && (
            (source.equals(node1) && target.equals(node2)) ||
            (source.equals(node2) && target.equals(node1))
        ))
    }
    
    /**
     * Get the other entity in this relationship
     * @param {RDFElement|NamedNode|string} entity - Known entity
     * @returns {NamedNode|null} Other entity
     */
    getOtherEntity(entity) {
        const entityNode = this._normalizeEntityReference(entity)
        const source = this.getSourceEntity()
        const target = this.getTargetEntity()
        
        if (source && source.equals(entityNode)) {
            return target
        } else if (target && target.equals(entityNode)) {
            return source
        }
        
        return null
    }
    
    /**
     * Check if this relationship involves a specific entity
     * @param {RDFElement|NamedNode|string} entity - Entity to check
     * @returns {boolean} True if entity is source or target
     */
    involves(entity) {
        const entityNode = this._normalizeEntityReference(entity)
        const source = this.getSourceEntity()
        const target = this.getTargetEntity()
        
        return (source && source.equals(entityNode)) || (target && target.equals(entityNode))
    }
    
    /**
     * Add evidence or support for this relationship
     * @param {RDFElement|NamedNode|string} evidence - Evidence source (e.g., semantic unit)
     */
    addEvidence(evidence) {
        const evidenceNode = this._normalizeEntityReference(evidence)
        this.addTriple(this.ns.provProperties.used, evidenceNode)
    }
    
    /**
     * Get all evidence sources for this relationship
     * @returns {Array<NamedNode>} Evidence nodes
     */
    getEvidence() {
        return this.getTriplesWithPredicate(this.ns.provProperties.used)
            .map(quad => quad.object)
    }
    
    /**
     * Normalize different entity reference formats to NamedNode
     * @private
     * @param {RDFElement|NamedNode|string} entity - Entity reference
     * @returns {NamedNode} Normalized entity node
     */
    _normalizeEntityReference(entity) {
        if (typeof entity === 'string') {
            return rdf.namedNode(entity)
        } else if (entity && typeof entity === 'object' && entity.node) {
            // RDFElement instance
            return entity.node
        } else if (entity && entity.termType === 'NamedNode') {
            // Already a NamedNode
            return entity
        } else {
            throw new Error(`Invalid entity reference: ${entity}`)
        }
    }
    
    /**
     * Validate this relationship according to ragno ontology
     * @returns {Object} Validation result
     */
    validate() {
        const baseValidation = super.validate()
        const errors = [...baseValidation.errors]
        
        // Check ragno:Relationship type
        if (!this.hasType(this.ns.classes.Relationship)) {
            errors.push('Relationship must have ragno:Relationship type')
        }
        
        // Check required properties
        if (!this.getSourceEntity()) {
            errors.push('Relationship must have ragno:hasSourceEntity')
        }
        
        if (!this.getTargetEntity()) {
            errors.push('Relationship must have ragno:hasTargetEntity')
        }
        
        // Check that source and target are different
        const source = this.getSourceEntity()
        const target = this.getTargetEntity()
        if (source && target && source.equals(target)) {
            errors.push('Relationship source and target must be different')
        }
        
        return {
            valid: errors.length === 0,
            errors
        }
    }
    
    /**
     * Get relationship metadata
     * @returns {Object} Relationship metadata
     */
    getMetadata() {
        const baseMetadata = super.getMetadata()
        
        return {
            ...baseMetadata,
            sourceEntity: this.getSourceEntity()?.value,
            targetEntity: this.getTargetEntity()?.value,
            weight: this.getWeight(),
            relationshipType: this.getRelationshipType(),
            evidenceCount: this.getEvidence().length
        }
    }
    
    /**
     * Convert to simple object representation (for backwards compatibility)
     * @returns {Object} Simple object representation
     */
    toSimpleObject() {
        return {
            uri: this.uri,
            description: this.getContent(),
            source: this.getSourceEntity()?.value,
            target: this.getTargetEntity()?.value,
            weight: this.getWeight(),
            type: this.getRelationshipType()
        }
    }
    
    /**
     * Create relationship from simple object (migration helper)
     * @param {Object} obj - Simple object representation
     * @param {Object} [options] - Additional options
     * @returns {Relationship} RDF-based relationship
     */
    static fromSimpleObject(obj, options = {}) {
        return new Relationship({
            ...options,
            sourceEntity: obj.source,
            targetEntity: obj.target,
            description: obj.description,
            weight: obj.weight,
            relationshipType: obj.type
        })
    }
    
    /**
     * Create a relationship between two entities with automatic naming
     * @param {RDFElement|NamedNode|string} sourceEntity - Source entity
     * @param {RDFElement|NamedNode|string} targetEntity - Target entity
     * @param {string} [description] - Relationship description
     * @param {Object} [options] - Additional options
     * @returns {Relationship} Created relationship
     */
    static create(sourceEntity, targetEntity, description, options = {}) {
        return new Relationship({
            ...options,
            sourceEntity,
            targetEntity,
            description
        })
    }
    
    /**
     * Clone this relationship with optional modifications
     * @param {Object} [modifications] - Properties to modify in the clone
     * @returns {Relationship} Cloned relationship
     */
    clone(modifications = {}) {
        const cloned = new Relationship({
            dataset: rdf.dataset(), // New dataset for clone
            sourceEntity: modifications.sourceEntity || this.getSourceEntity(),
            targetEntity: modifications.targetEntity || this.getTargetEntity(),
            description: modifications.description || this.getContent(),
            weight: modifications.weight !== undefined ? modifications.weight : this.getWeight(),
            relationshipType: modifications.relationshipType || this.getRelationshipType()
        })
        
        // Copy additional properties
        for (const quad of this.getTriples()) {
            if (!quad.predicate.equals(this.ns.properties.hasSourceEntity) &&
                !quad.predicate.equals(this.ns.properties.hasTargetEntity) &&
                !quad.predicate.equals(this.ns.properties.content) &&
                !quad.predicate.equals(this.ns.properties.hasWeight) &&
                !quad.predicate.equals(this.ns.dcProperties.created)) {
                cloned.addTriple(quad.predicate, quad.object)
            }
        }
        
        return cloned
    }
}