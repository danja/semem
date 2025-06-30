/**
 * NamespaceManager.js - Ragno Ontology Namespace Management
 * 
 * This class provides centralized namespace management for the ragno ontology
 * and related vocabularies, ensuring consistent URI handling throughout the
 * Ragno knowledge graph system.
 * 
 * Key Features:
 * - Complete ragno ontology namespace definitions
 * - SKOS, PROV-O, and Dublin Core integration
 * - URI validation and generation
 * - Prefix management for serialization
 * - Namespace resolution utilities
 */

import namespace from '@rdfjs/namespace'

export default class NamespaceManager {
    constructor(options = {}) {
        this.uriBase = options.uriBase || 'http://example.org/ragno/'
        
        // Core RDF/OWL namespaces
        this.rdf = namespace('http://www.w3.org/1999/02/22-rdf-syntax-ns#')
        this.rdfs = namespace('http://www.w3.org/2000/01/rdf-schema#')
        this.owl = namespace('http://www.w3.org/2002/07/owl#')
        this.xsd = namespace('http://www.w3.org/2001/XMLSchema#')
        
        // Semantic Web vocabularies
        this.skos = namespace('http://www.w3.org/2004/02/skos/core#')
        this.prov = namespace('http://www.w3.org/ns/prov#')
        this.dcterms = namespace('http://purl.org/dc/terms/')
        this.foaf = namespace('http://xmlns.com/foaf/0.1/')
        
        // Ragno ontology
        this.ragno = namespace('http://purl.org/stuff/ragno/')
        
        // Local instance namespace
        this.ex = namespace(this.uriBase)
        
        // Initialize prefix mappings
        this.prefixes = new Map([
            ['rdf', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#'],
            ['rdfs', 'http://www.w3.org/2000/01/rdf-schema#'],
            ['owl', 'http://www.w3.org/2002/07/owl#'],
            ['xsd', 'http://www.w3.org/2001/XMLSchema#'],
            ['skos', 'http://www.w3.org/2004/02/skos/core#'],
            ['prov', 'http://www.w3.org/ns/prov#'],
            ['dcterms', 'http://purl.org/dc/terms/'],
            ['foaf', 'http://xmlns.com/foaf/0.1/'],
            ['ragno', 'http://purl.org/stuff/ragno/'],
            ['ex', this.uriBase]
        ])
        
        // Ragno class definitions
        this.classes = {
            // Base classes
            Element: this.ragno.Element,
            
            // Node type classes
            Entity: this.ragno.Entity,
            Relationship: this.ragno.Relationship,
            Unit: this.ragno.Unit,
            Attribute: this.ragno.Attribute,
            CommunityElement: this.ragno.CommunityElement,
            TextElement: this.ragno.TextElement,
            IndexElement: this.ragno.IndexElement,
            VectorEmbedding: this.ragno.VectorEmbedding,
            
            // Collection classes
            Corpus: this.ragno.Corpus,
            Corpuscle: this.ragno.Corpuscle,
            Community: this.ragno.Community
        }
        
        // Ragno property definitions
        this.properties = {
            // Content properties
            content: this.ragno.content,
            subType: this.ragno.subType,
            hasSourceDocument: this.ragno.hasSourceDocument,
            
            // Entry properties
            isEntryPoint: this.ragno.isEntryPoint,
            
            // Relationship properties
            hasSourceEntity: this.ragno.hasSourceEntity,
            hasTargetEntity: this.ragno.hasTargetEntity,
            hasUnit: this.ragno.hasUnit,
            hasAttribute: this.ragno.hasAttribute,
            hasCommunityElement: this.ragno.hasCommunityElement,
            hasTextElement: this.ragno.hasTextElement,
            
            // Graph structure properties
            inCommunity: this.ragno.inCommunity,
            connectsTo: this.ragno.connectsTo,
            hasWeight: this.ragno.hasWeight,
            
            // Algorithm properties
            hasPPRScore: this.ragno.hasPPRScore,
            hasSimilarityScore: this.ragno.hasSimilarityScore,
            
            // Collection properties
            hasElement: this.ragno.hasElement,
            inCorpus: this.ragno.inCorpus,
            inCorpuscle: this.ragno.inCorpuscle
        }
        
        // SKOS properties commonly used in ragno
        this.skosProperties = {
            prefLabel: this.skos.prefLabel,
            altLabel: this.skos.altLabel,
            definition: this.skos.definition,
            note: this.skos.note,
            broader: this.skos.broader,
            narrower: this.skos.narrower,
            related: this.skos.related,
            inScheme: this.skos.inScheme,
            member: this.skos.member,
            semanticRelation: this.skos.semanticRelation
        }
        
        // PROV-O properties for provenance
        this.provProperties = {
            wasDerivedFrom: this.prov.wasDerivedFrom,
            wasGeneratedBy: this.prov.wasGeneratedBy,
            used: this.prov.used,
            wasAttributedTo: this.prov.wasAttributedTo,
            startedAtTime: this.prov.startedAtTime,
            endedAtTime: this.prov.endedAtTime
        }
        
        // Dublin Core properties
        this.dcProperties = {
            title: this.dcterms.title,
            description: this.dcterms.description,
            creator: this.dcterms.creator,
            created: this.dcterms.created,
            modified: this.dcterms.modified,
            subject: this.dcterms.subject,
            language: this.dcterms.language
        }
    }
    
    /**
     * Get all namespace objects
     * @returns {Object} All namespaces
     */
    getAllNamespaces() {
        return {
            rdf: this.rdf,
            rdfs: this.rdfs,
            owl: this.owl,
            xsd: this.xsd,
            skos: this.skos,
            prov: this.prov,
            dcterms: this.dcterms,
            foaf: this.foaf,
            ragno: this.ragno,
            ex: this.ex
        }
    }
    
    /**
     * Get prefix mapping for serialization
     * @returns {Map} Prefix to namespace URI mapping
     */
    getPrefixes() {
        return new Map(this.prefixes)
    }
    
    /**
     * Get prefixes as object for JSON-LD context
     * @returns {Object} Prefix mapping object
     */
    getPrefixesAsObject() {
        return Object.fromEntries(this.prefixes)
    }
    
    /**
     * Resolve a prefixed name to full URI
     * @param {string} prefixedName - Name like "ragno:Entity"
     * @returns {string} Full URI
     */
    resolve(prefixedName) {
        const [prefix, localName] = prefixedName.split(':')
        const namespaceURI = this.prefixes.get(prefix)
        
        if (!namespaceURI) {
            throw new Error(`Unknown prefix: ${prefix}`)
        }
        
        return namespaceURI + localName
    }
    
    /**
     * Create a prefixed name from full URI
     * @param {string} uri - Full URI
     * @returns {string} Prefixed name or original URI if no prefix found
     */
    compress(uri) {
        for (const [prefix, namespaceURI] of this.prefixes) {
            if (uri.startsWith(namespaceURI)) {
                const localName = uri.substring(namespaceURI.length)
                return `${prefix}:${localName}`
            }
        }
        return uri
    }
    
    /**
     * Check if a URI belongs to the ragno namespace
     * @param {string} uri - URI to check
     * @returns {boolean} True if ragno namespace
     */
    isRagnoURI(uri) {
        return uri.startsWith('http://purl.org/stuff/ragno/')
    }
    
    /**
     * Check if a URI is a ragno class
     * @param {string} uri - URI to check
     * @returns {boolean} True if ragno class
     */
    isRagnoClass(uri) {
        return Object.values(this.classes).some(cls => cls.value === uri)
    }
    
    /**
     * Check if a URI is a ragno property
     * @param {string} uri - URI to check
     * @returns {boolean} True if ragno property
     */
    isRagnoProperty(uri) {
        return Object.values(this.properties).some(prop => prop.value === uri)
    }
    
    /**
     * Get the local name from a ragno URI
     * @param {string} uri - Full ragno URI
     * @returns {string} Local name
     */
    getRagnoLocalName(uri) {
        if (this.isRagnoURI(uri)) {
            return uri.substring('http://purl.org/stuff/ragno/'.length)
        }
        throw new Error(`Not a ragno URI: ${uri}`)
    }
    
    /**
     * Validate that a URI follows ragno ontology patterns
     * @param {string} uri - URI to validate
     * @param {string} expectedType - Expected type (class, property, individual)
     * @returns {boolean} True if valid
     */
    validateRagnoURI(uri, expectedType) {
        if (!this.isRagnoURI(uri)) {
            return false
        }
        
        const localName = this.getRagnoLocalName(uri)
        
        switch (expectedType) {
            case 'class':
                // Classes start with uppercase
                return /^[A-Z][a-zA-Z]*$/.test(localName)
            case 'property':
                // Properties start with lowercase
                return /^[a-z][a-zA-Z]*$/.test(localName)
            case 'individual':
                // Individuals can have various patterns
                return localName.length > 0
            default:
                return true
        }
    }
    
    /**
     * Generate Turtle prefixes string
     * @returns {string} Turtle prefix declarations
     */
    getTurtlePrefixes() {
        const prefixLines = []
        for (const [prefix, namespaceURI] of this.prefixes) {
            prefixLines.push(`@prefix ${prefix}: <${namespaceURI}> .`)
        }
        return prefixLines.join('\n')
    }
    
    /**
     * Generate SPARQL prefixes string
     * @returns {string} SPARQL prefix declarations
     */
    getSPARQLPrefixes() {
        const prefixLines = []
        for (const [prefix, namespaceURI] of this.prefixes) {
            prefixLines.push(`PREFIX ${prefix}: <${namespaceURI}>`)
        }
        return prefixLines.join('\n')
    }
    
    /**
     * Create a JSON-LD context object
     * @returns {Object} JSON-LD context
     */
    getJSONLDContext() {
        const context = this.getPrefixesAsObject()
        
        // Add common property mappings
        context.label = { '@id': 'skos:prefLabel', '@language': 'en' }
        context.content = 'ragno:content'
        context.type = '@type'
        context.id = '@id'
        
        return { '@context': context }
    }
    
    /**
     * Get specific namespace by prefix
     * @param {string} prefix - Namespace prefix
     * @returns {Function} Namespace function
     */
    getNamespace(prefix) {
        const namespaces = this.getAllNamespaces()
        if (!(prefix in namespaces)) {
            throw new Error(`Unknown namespace prefix: ${prefix}`)
        }
        return namespaces[prefix]
    }
    
    /**
     * Add a custom namespace
     * @param {string} prefix - Namespace prefix
     * @param {string} namespaceURI - Namespace URI
     */
    addNamespace(prefix, namespaceURI) {
        this.prefixes.set(prefix, namespaceURI)
        this[prefix] = namespace(namespaceURI)
    }
    
    /**
     * Remove a namespace
     * @param {string} prefix - Namespace prefix to remove
     */
    removeNamespace(prefix) {
        this.prefixes.delete(prefix)
        delete this[prefix]
    }
    
    /**
     * Get ontology metadata
     * @returns {Object} Ontology information
     */
    getOntologyInfo() {
        return {
            ontologyURI: 'http://purl.org/stuff/ragno/',
            version: '0.3.0',
            title: 'Ragno Ontology',
            description: 'A SKOS-based ontology for describing knowledge bases and graph-based retrieval',
            creator: 'Danny Ayers',
            imports: [
                'http://www.w3.org/2004/02/skos/core',
                'http://www.w3.org/ns/prov-o#'
            ],
            classes: Object.keys(this.classes).length,
            properties: Object.keys(this.properties).length
        }
    }
}