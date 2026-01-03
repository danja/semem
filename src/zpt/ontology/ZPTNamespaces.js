/**
 * ZPTNamespaces.js - Namespace Definitions for ZPT Ontology Integration
 * 
 * This module provides namespace constants and utilities for working with
 * the ZPT (Zoom-Pan-Tilt) ontology and related vocabularies using RDF-Ext.
 * 
 * Provides:
 * - ZPT ontology namespace and term definitions
 * - Related vocabularies (Ragno, PROV-O, SKOS, etc.)
 * - Utility functions for namespace resolution
 * - Mapping between string literals and RDF URIs
 */

import rdf from 'rdf-ext';

/**
 * Create namespace factory function
 * @param {string} baseURI - Base URI for the namespace
 * @returns {Function} Namespace factory function
 */
function createNamespace(baseURI) {
    return function(localName = '') {
        return rdf.namedNode(baseURI + localName);
    };
}

/**
 * Create object proxy for namespace with property access
 * @param {string} baseURI - Base URI for the namespace
 * @returns {Proxy} Namespace proxy object
 */
function createNamespaceObject(baseURI) {
    const ns = createNamespace(baseURI);
    
    return new Proxy(ns, {
        get(target, property) {
            if (typeof property === 'string') {
                return target(property);
            }
            return target[property];
        }
    });
}

// Core Namespaces
export const ZPT_NS = 'http://purl.org/stuff/zpt/';
export const RAGNO_NS = 'http://purl.org/stuff/ragno/';
export const RDF_NS = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#';
export const RDFS_NS = 'http://www.w3.org/2000/01/rdf-schema#';
export const OWL_NS = 'http://www.w3.org/2002/07/owl#';
export const XSD_NS = 'http://www.w3.org/2001/XMLSchema#';
export const SKOS_NS = 'http://www.w3.org/2004/02/skos/core#';
export const PROV_NS = 'http://www.w3.org/ns/prov#';
export const DCTERMS_NS = 'http://purl.org/dc/terms/';

// Namespace Objects
export const ZPT = createNamespaceObject(ZPT_NS);
export const RAGNO = createNamespaceObject(RAGNO_NS);
export const RDF = createNamespaceObject(RDF_NS);
export const RDFS = createNamespaceObject(RDFS_NS);
export const OWL = createNamespaceObject(OWL_NS);
export const XSD = createNamespaceObject(XSD_NS);
export const SKOS = createNamespaceObject(SKOS_NS);
export const PROV = createNamespaceObject(PROV_NS);
export const DCTERMS = createNamespaceObject(DCTERMS_NS);

// ZPT Ontology Terms - Core Classes
export const ZPT_TERMS = {
    // Core Navigation Classes
    NavigationView: ZPT.NavigationView,
    NavigationSession: ZPT.NavigationSession,
    NavigationAgent: ZPT.NavigationAgent,
    NavigationDimension: ZPT.NavigationDimension,
    
    // State Classes
    ZoomState: ZPT.ZoomState,
    PanState: ZPT.PanState,
    TiltState: ZPT.TiltState,
    
    // Dimension Classes
    ZoomLevel: ZPT.ZoomLevel,
    PanDomain: ZPT.PanDomain,
    TiltProjection: ZPT.TiltProjection,
    
    // Ragno Integration Classes
    NavigableCorpuscle: ZPT.NavigableCorpuscle,
    NavigableElement: ZPT.NavigableElement,
    
    // Predefined Zoom Levels
    MicroLevel: ZPT.MicroLevel,
    EntityLevel: ZPT.EntityLevel,
    UnitLevel: ZPT.UnitLevel,
    TextLevel: ZPT.TextLevel,
    CommunityLevel: ZPT.CommunityLevel,
    CorpusLevel: ZPT.CorpusLevel,
    
    // Tilt Projections
    EmbeddingProjection: ZPT.EmbeddingProjection,
    KeywordProjection: ZPT.KeywordProjection,
    GraphProjection: ZPT.GraphProjection,
    TemporalProjection: ZPT.TemporalProjection,
    ConceptProjection: ZPT.ConceptProjection,
    
    // Pan Domains
    TopicDomain: ZPT.TopicDomain,
    EntityDomain: ZPT.EntityDomain,
    TemporalDomain: ZPT.TemporalDomain,
    GeospatialDomain: ZPT.GeospatialDomain,
    
    // Navigation State Properties
    hasZoomState: ZPT.hasZoomState,
    hasPanState: ZPT.hasPanState,
    hasTiltState: ZPT.hasTiltState,
    
    // State Configuration Properties
    atZoomLevel: ZPT.atZoomLevel,
    withPanDomain: ZPT.withPanDomain,
    withTiltProjection: ZPT.withTiltProjection,
    
    // Selection Properties
    selectedCorpuscle: ZPT.selectedCorpuscle,
    candidateCorpuscle: ZPT.candidateCorpuscle,
    
    // Optimization Properties
    optimizationScore: ZPT.optimizationScore,
    zoomRelevance: ZPT.zoomRelevance,
    panCoverage: ZPT.panCoverage,
    tiltEffectiveness: ZPT.tiltEffectiveness,
    
    // Abstraction Properties
    abstractionOrder: ZPT.abstractionOrder,
    correspondsToRagno: ZPT.correspondsToRagno,
    
    // Process Properties
    navigatedBy: ZPT.navigatedBy,
    partOfSession: ZPT.partOfSession,
    previousView: ZPT.previousView,
    hasPurpose: ZPT.hasPurpose,
    
    // Query Integration Properties
    answersQuery: ZPT.answersQuery,
    queryComplexity: ZPT.queryComplexity,
    
    // Temporal Properties
    navigationTimestamp: ZPT.navigationTimestamp,
    sessionDuration: ZPT.sessionDuration,
    
    // Extended Properties (for temporal constraints, etc.)
    temporalStart: ZPT.temporalStart,
    temporalEnd: ZPT.temporalEnd,
    constrainedByEntity: ZPT.constrainedByEntity,
    hasTemporalConstraint: ZPT.hasTemporalConstraint
};

// Ragno Ontology Terms
export const RAGNO_TERMS = {
    // Core Classes
    Corpuscle: RAGNO.Corpuscle,
    Element: RAGNO.Element,
    Entity: RAGNO.Entity,
    Unit: RAGNO.Unit,
    TextElement: RAGNO.TextElement,
    CommunityElement: RAGNO.CommunityElement,
    Corpus: RAGNO.Corpus,
    
    // Properties
    content: RAGNO.content,
    hasEmbedding: RAGNO.hasEmbedding,
    hasEntity: RAGNO.hasEntity,
    hasUnit: RAGNO.hasUnit,
    hasRelationship: RAGNO.hasRelationship,
    corpuscleType: RAGNO.corpuscleType,
    
    // Relationship types
    Relationship: RAGNO.Relationship,
    relationType: RAGNO.relationType,
    relationSource: RAGNO.relationSource,
    relationTarget: RAGNO.relationTarget
};

// Common XSD Types
export const XSD_TYPES = {
    string: XSD.string,
    integer: XSD.integer,
    float: XSD.float,
    double: XSD.double,
    boolean: XSD.boolean,
    dateTime: XSD.dateTime,
    date: XSD.date,
    time: XSD.time,
    duration: XSD.duration
};

// Common RDF Types
export const RDF_TYPES = {
    type: RDF.type,
    Property: RDF.Property,
    Statement: RDF.Statement,
    subject: RDF.subject,
    predicate: RDF.predicate,
    object: RDF.object
};

// Common RDFS Types
export const RDFS_TYPES = {
    Class: RDFS.Class,
    Resource: RDFS.Resource,
    Literal: RDFS.Literal,
    label: RDFS.label,
    comment: RDFS.comment,
    subClassOf: RDFS.subClassOf,
    subPropertyOf: RDFS.subPropertyOf,
    domain: RDFS.domain,
    range: RDFS.range
};

// SKOS Terms
export const SKOS_TERMS = {
    Concept: SKOS.Concept,
    ConceptScheme: SKOS.ConceptScheme,
    Collection: SKOS.Collection,
    prefLabel: SKOS.prefLabel,
    altLabel: SKOS.altLabel,
    definition: SKOS.definition,
    broader: SKOS.broader,
    narrower: SKOS.narrower,
    related: SKOS.related,
    inScheme: SKOS.inScheme,
    topConceptOf: SKOS.topConceptOf,
    hasTopConcept: SKOS.hasTopConcept
};

// PROV-O Terms
export const PROV_TERMS = {
    Entity: PROV.Entity,
    Activity: PROV.Activity,
    Agent: PROV.Agent,
    wasGeneratedBy: PROV.wasGeneratedBy,
    wasAssociatedWith: PROV.wasAssociatedWith,
    wasDerivedFrom: PROV.wasDerivedFrom,
    startedAtTime: PROV.startedAtTime,
    endedAtTime: PROV.endedAtTime,
    wasInformedBy: PROV.wasInformedBy
};

/**
 * String to URI mapping for ZPT navigation parameters
 */
export const ZPT_STRING_MAPPINGS = {
    // Zoom levels
    zoom: {
        'micro': ZPT_TERMS.MicroLevel,
        'entity': ZPT_TERMS.EntityLevel,
        'unit': ZPT_TERMS.UnitLevel,
        'text': ZPT_TERMS.TextLevel,
        'community': ZPT_TERMS.CommunityLevel,
        'corpus': ZPT_TERMS.CorpusLevel
    },
    
    // Tilt projections
    tilt: {
        'keywords': ZPT_TERMS.KeywordProjection,
        'embedding': ZPT_TERMS.EmbeddingProjection,
        'graph': ZPT_TERMS.GraphProjection,
        'temporal': ZPT_TERMS.TemporalProjection,
        'concept': ZPT_TERMS.ConceptProjection
    },
    
    // Pan domains
    pan: {
        'topic': ZPT_TERMS.TopicDomain,
        'entity': ZPT_TERMS.EntityDomain,
        'temporal': ZPT_TERMS.TemporalDomain,
        'geospatial': ZPT_TERMS.GeospatialDomain
    }
};

/**
 * URI to string mapping for reverse lookups
 */
export const ZPT_URI_MAPPINGS = {
    // Zoom levels
    [ZPT_TERMS.MicroLevel.value]: 'micro',
    [ZPT_TERMS.EntityLevel.value]: 'entity',
    [ZPT_TERMS.UnitLevel.value]: 'unit',
    [ZPT_TERMS.TextLevel.value]: 'text',
    [ZPT_TERMS.CommunityLevel.value]: 'community',
    [ZPT_TERMS.CorpusLevel.value]: 'corpus',
    
    // Tilt projections
    [ZPT_TERMS.KeywordProjection.value]: 'keywords',
    [ZPT_TERMS.EmbeddingProjection.value]: 'embedding',
    [ZPT_TERMS.GraphProjection.value]: 'graph',
    [ZPT_TERMS.TemporalProjection.value]: 'temporal',
    [ZPT_TERMS.ConceptProjection.value]: 'concept',
    
    // Pan domains
    [ZPT_TERMS.TopicDomain.value]: 'topic',
    [ZPT_TERMS.EntityDomain.value]: 'entity',
    [ZPT_TERMS.TemporalDomain.value]: 'temporal',
    [ZPT_TERMS.GeospatialDomain.value]: 'geospatial'
};

/**
 * Utility Functions for Namespace Management
 */
export const NamespaceUtils = {
    /**
     * Resolve a string parameter to ZPT URI
     * @param {string} type - Parameter type (zoom, tilt, pan)
     * @param {string} value - String value to resolve
     * @returns {NamedNode|null} ZPT URI or null if not found
     */
    resolveStringToURI(type, value) {
        return ZPT_STRING_MAPPINGS[type]?.[value] || null;
    },
    
    /**
     * Resolve a ZPT URI to string parameter
     * @param {NamedNode|string} uri - ZPT URI to resolve
     * @returns {string|null} String value or null if not found
     */
    resolveURIToString(uri) {
        const uriValue = typeof uri === 'string' ? uri : uri.value;
        return ZPT_URI_MAPPINGS[uriValue] || null;
    },
    
    /**
     * Check if a URI belongs to ZPT namespace
     * @param {NamedNode|string} uri - URI to check
     * @returns {boolean} True if URI is in ZPT namespace
     */
    isZPTURI(uri) {
        const uriValue = typeof uri === 'string' ? uri : uri.value;
        return uriValue.startsWith(ZPT_NS);
    },
    
    /**
     * Check if a URI belongs to Ragno namespace
     * @param {NamedNode|string} uri - URI to check
     * @returns {boolean} True if URI is in Ragno namespace
     */
    isRagnoURI(uri) {
        const uriValue = typeof uri === 'string' ? uri : uri.value;
        return uriValue.startsWith(RAGNO_NS);
    },
    
    /**
     * Extract local name from URI
     * @param {NamedNode|string} uri - URI to extract from
     * @returns {string} Local name part of URI
     */
    getLocalName(uri) {
        const uriValue = typeof uri === 'string' ? uri : uri.value;
        return uriValue.split('/').pop().split('#').pop();
    },
    
    /**
     * Create a prefixed name for debugging/display
     * @param {NamedNode|string} uri - URI to create prefixed name for
     * @returns {string} Prefixed name (e.g., "zpt:EntityLevel")
     */
    toPrefixedName(uri) {
        const uriValue = typeof uri === 'string' ? uri : uri.value;
        
        if (uriValue.startsWith(ZPT_NS)) {
            return 'zpt:' + uriValue.substring(ZPT_NS.length);
        } else if (uriValue.startsWith(RAGNO_NS)) {
            return 'ragno:' + uriValue.substring(RAGNO_NS.length);
        } else if (uriValue.startsWith(RDF_NS)) {
            return 'rdf:' + uriValue.substring(RDF_NS.length);
        } else if (uriValue.startsWith(RDFS_NS)) {
            return 'rdfs:' + uriValue.substring(RDFS_NS.length);
        } else if (uriValue.startsWith(SKOS_NS)) {
            return 'skos:' + uriValue.substring(SKOS_NS.length);
        } else if (uriValue.startsWith(PROV_NS)) {
            return 'prov:' + uriValue.substring(PROV_NS.length);
        } else if (uriValue.startsWith(XSD_NS)) {
            return 'xsd:' + uriValue.substring(XSD_NS.length);
        }
        
        return uriValue; // Return full URI if no known prefix
    },
    
    /**
     * Get all defined zoom levels
     * @returns {Array} Array of zoom level URIs
     */
    getAllZoomLevels() {
        return [
            ZPT_TERMS.MicroLevel,
            ZPT_TERMS.EntityLevel,
            ZPT_TERMS.UnitLevel,
            ZPT_TERMS.TextLevel,
            ZPT_TERMS.CommunityLevel,
            ZPT_TERMS.CorpusLevel
        ];
    },
    
    /**
     * Get all defined tilt projections
     * @returns {Array} Array of tilt projection URIs
     */
    getAllTiltProjections() {
        return [
            ZPT_TERMS.KeywordProjection,
            ZPT_TERMS.EmbeddingProjection,
            ZPT_TERMS.GraphProjection,
            ZPT_TERMS.TemporalProjection,
            ZPT_TERMS.ConceptProjection
        ];
    },
    
    /**
     * Get all defined pan domains
     * @returns {Array} Array of pan domain URIs
     */
    getAllPanDomains() {
        return [
            ZPT_TERMS.TopicDomain,
            ZPT_TERMS.EntityDomain,
            ZPT_TERMS.TemporalDomain,
            ZPT_TERMS.GeospatialDomain
        ];
    },
    
    /**
     * Validate navigation parameters against ZPT ontology
     * @param {Object} params - Navigation parameters
     * @returns {Object} Validation result with errors and warnings
     */
    validateNavigationParams(params) {
        const errors = [];
        const warnings = [];
        
        // Validate zoom level
        if (params.zoom) {
            const zoomURI = typeof params.zoom === 'string' ? 
                this.resolveStringToURI('zoom', params.zoom) : params.zoom;
            if (!zoomURI || !this.getAllZoomLevels().some(level => level.equals(zoomURI))) {
                errors.push(`Invalid zoom level: ${params.zoom}`);
            }
        }
        
        // Validate tilt projection
        if (params.tilt) {
            const tiltURI = typeof params.tilt === 'string' ? 
                this.resolveStringToURI('tilt', params.tilt) : params.tilt;
            if (!tiltURI || !this.getAllTiltProjections().some(proj => proj.equals(tiltURI))) {
                errors.push(`Invalid tilt projection: ${params.tilt}`);
            }
        }
        
        // Validate pan domains
        if (params.pan && params.pan.domains) {
            const domains = Array.isArray(params.pan.domains) ? params.pan.domains : [params.pan.domains];
            domains.forEach(domain => {
                const domainURI = typeof domain === 'string' ? 
                    this.resolveStringToURI('pan', domain) : domain;
                if (!domainURI || !this.getAllPanDomains().some(d => d.equals(domainURI))) {
                    warnings.push(`Unknown pan domain: ${domain}`);
                }
            });
        }
        
        return {
            valid: errors.length === 0,
            errors,
            warnings
        };
    },
    
    /**
     * Get namespace mappings for API responses
     * @returns {Object} Namespace prefix to URI mappings
     */
    getNamespaces() {
        return SPARQL_PREFIXES;
    },
    
    /**
     * Get zoom levels with descriptions for API responses
     * @returns {Array} Array of zoom level objects with string, uri, and description
     */
    getZoomLevels() {
        return [
            {
                string: 'micro',
                uri: ZPT_TERMS.MicroLevel,
                description: 'Sub-entity attributes and fine-grained components'
            },
            {
                string: 'entity',
                uri: ZPT_TERMS.EntityLevel,
                description: 'Named entities and concrete elements'
            },
            {
                string: 'text',
                uri: ZPT_TERMS.TextLevel,
                description: 'Raw text elements and fragments'
            },
            {
                string: 'unit',
                uri: ZPT_TERMS.UnitLevel,
                description: 'Semantic units and local summaries'
            },
            {
                string: 'community',
                uri: ZPT_TERMS.CommunityLevel,
                description: 'Topic clusters and concept groups'
            },
            {
                string: 'corpus',
                uri: ZPT_TERMS.CorpusLevel,
                description: 'Entire corpus view'
            }
        ];
    },
    
    /**
     * Get tilt projections with descriptions for API responses
     * @returns {Array} Array of tilt projection objects with string, uri, and description
     */
    getTiltProjections() {
        return [
            {
                string: 'keywords',
                uri: ZPT_TERMS.KeywordProjection,
                description: 'Keyword-based analysis and matching'
            },
            {
                string: 'embedding',
                uri: ZPT_TERMS.EmbeddingProjection,
                description: 'Vector similarity using embeddings'
            },
            {
                string: 'graph',
                uri: ZPT_TERMS.GraphProjection,
                description: 'Graph structure and connectivity analysis'
            },
            {
                string: 'temporal',
                uri: ZPT_TERMS.TemporalProjection,
                description: 'Time-based organization and sequencing'
            },
            {
                string: 'concept',
                uri: ZPT_TERMS.ConceptProjection,
                description: 'Concept extraction and relationship analysis'
            }
        ];
    },
    
    /**
     * Get pan domains with descriptions for API responses
     * @returns {Array} Array of pan domain objects with string, uri, and description
     */
    getPanDomains() {
        return [
            {
                string: 'topic',
                uri: ZPT_TERMS.TopicDomain,
                description: 'Subject/topic constraints'
            },
            {
                string: 'entity',
                uri: ZPT_TERMS.EntityDomain,
                description: 'Entity-based filtering'
            },
            {
                string: 'temporal',
                uri: ZPT_TERMS.TemporalDomain,
                description: 'Time period constraints'
            },
            {
                string: 'geographic',
                uri: ZPT_TERMS.GeospatialDomain,
                description: 'Location-based filtering'
            }
        ];
    }
};

/**
 * Prefix map for SPARQL queries
 */
export const SPARQL_PREFIXES = {
    zpt: ZPT_NS,
    ragno: RAGNO_NS,
    rdf: RDF_NS,
    rdfs: RDFS_NS,
    owl: OWL_NS,
    xsd: XSD_NS,
    skos: SKOS_NS,
    prov: PROV_NS,
    dcterms: DCTERMS_NS
};

/**
 * Generate SPARQL prefix string
 * @param {Array<string>} prefixes - Array of prefix names to include
 * @returns {string} SPARQL prefix declarations
 */
export function getSPARQLPrefixes(prefixes = Object.keys(SPARQL_PREFIXES)) {
    return prefixes
        .map(prefix => `PREFIX ${prefix}: <${SPARQL_PREFIXES[prefix]}>`)
        .join('\n') + '\n';
}

export default {
    ZPT,
    RAGNO,
    RDF,
    RDFS,
    OWL,
    XSD,
    SKOS,
    PROV,
    DCTERMS,
    ZPT_TERMS,
    RAGNO_TERMS,
    ZPT_STRING_MAPPINGS,
    ZPT_URI_MAPPINGS,
    NamespaceUtils,
    SPARQL_PREFIXES,
    getSPARQLPrefixes
};
