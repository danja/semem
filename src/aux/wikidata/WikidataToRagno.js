/**
 * WikidataToRagno.js - Convert Wikidata entities to Ragno RDF format
 * 
 * This class handles the conversion of Wikidata entities, properties, and
 * relationships into the Ragno vocabulary format for integration with
 * the semantic memory system.
 * 
 * Key Features:
 * - Entity conversion to ragno:Entity format
 * - Property mapping to ragno:Attribute instances
 * - Relationship creation between entities
 * - Provenance tracking for Wikidata sources
 * - Type mapping and vocabulary alignment
 */

import logger from 'loglevel';
import NamespaceManager from '../../ragno/core/NamespaceManager.js';

export default class WikidataToRagno {
    constructor(options = {}) {
        this.options = {
            baseURI: options.baseURI || 'http://purl.org/stuff/wikidata/',
            graphURI: options.graphURI || 'http://purl.org/stuff/wikidata/research',
            preserveOriginalURIs: true,
            createCrossReferences: true,
            maxPropertiesPerEntity: 50,
            ...options
        };

        // Initialize namespace manager with Wikidata extensions
        this.ns = new NamespaceManager(options);
        this.addWikidataNamespaces();

        // Property type mappings
        this.propertyTypeMappings = this.initializePropertyMappings();
        
        // Statistics
        this.stats = {
            entitiesConverted: 0,
            propertiesConverted: 0,
            relationshipsCreated: 0,
            crossReferencesCreated: 0,
            conversionErrors: []
        };
    }

    /**
     * Add Wikidata-specific namespaces
     * @private
     */
    addWikidataNamespaces() {
        this.ns.addNamespace('wd', 'http://www.wikidata.org/entity/');
        this.ns.addNamespace('wdt', 'http://www.wikidata.org/prop/direct/');
        this.ns.addNamespace('wikibase', 'http://wikiba.se/ontology#');
        this.ns.addNamespace('schema', 'https://schema.org/');
        this.ns.addNamespace('owl', 'http://www.w3.org/2002/07/owl#');
    }

    /**
     * Initialize property type mappings
     * @private
     */
    initializePropertyMappings() {
        return {
            // Common Wikidata properties to Ragno attribute types
            'P31': 'instance-of',           // instance of
            'P279': 'subclass-of',          // subclass of
            'P361': 'part-of',              // part of
            'P527': 'has-part',             // has part
            'P171': 'parent-taxon',         // parent taxon
            'P131': 'located-in',           // located in administrative territorial entity
            'P17': 'country',               // country
            'P625': 'coordinates',          // coordinate location
            'P18': 'image',                 // image
            'P569': 'birth-date',           // date of birth
            'P570': 'death-date',           // date of death
            'P580': 'start-time',           // start time
            'P582': 'end-time',             // end time
            'P159': 'headquarters',         // headquarters location
            'P36': 'capital',               // capital
            'P735': 'given-name',           // given name
            'P734': 'family-name',          // family name
            'P1476': 'title',               // title
            'P407': 'language',             // language of work or name
            'P50': 'author',                // author
            'P577': 'publication-date',     // publication date
            'P136': 'genre',                // genre
            'P495': 'origin-country',       // country of origin
        };
    }

    /**
     * Convert Wikidata entity to Ragno format
     * @param {Object} wikidataEntity - Wikidata entity data
     * @param {Object} options - Conversion options
     * @returns {Object} Ragno entity with triples
     */
    convertEntity(wikidataEntity, options = {}) {
        const conversionOptions = {
            includeProperties: true,
            includeRelationships: true,
            generateEmbeddings: false,
            ...options
        };

        try {
            // Generate Ragno entity URI
            const entityURI = this.generateEntityURI(wikidataEntity.id);
            const timestamp = new Date().toISOString();

            // Core entity triples
            const triples = [];
            
            // Basic entity structure
            triples.push(`<${entityURI}> rdf:type ragno:Entity .`);
            triples.push(`<${entityURI}> rdfs:label ${this.createLiteral(wikidataEntity.label || wikidataEntity.id)} .`);
            
            if (wikidataEntity.description) {
                triples.push(`<${entityURI}> rdfs:comment ${this.createLiteral(wikidataEntity.description)} .`);
            }

            // Provenance and source information
            triples.push(`<${entityURI}> dcterms:source <${wikidataEntity.uri}> .`);
            triples.push(`<${entityURI}> dcterms:created ${this.createLiteral(timestamp, 'xsd:dateTime')} .`);
            triples.push(`<${entityURI}> prov:wasGeneratedBy ${this.createLiteral('wikidata-conversion')} .`);
            
            // Original Wikidata identifier
            triples.push(`<${entityURI}> ragno:wikidataId ${this.createLiteral(wikidataEntity.id)} .`);
            
            // Cross-reference to original Wikidata entity
            if (conversionOptions.includeRelationships) {
                triples.push(`<${entityURI}> <http://www.w3.org/2002/07/owl#sameAs> <${wikidataEntity.uri}> .`);
            }

            // Entity type based on confidence or search type
            if (wikidataEntity.searchType) {
                triples.push(`<${entityURI}> ragno:searchType ${this.createLiteral(wikidataEntity.searchType)} .`);
            }

            if (wikidataEntity.confidence !== undefined) {
                triples.push(`<${entityURI}> ragno:confidence ${this.createLiteral(wikidataEntity.confidence.toString(), 'xsd:float')} .`);
            }

            // Convert properties if available
            let propertyTriples = [];
            if (conversionOptions.includeProperties && wikidataEntity.properties) {
                propertyTriples = this.convertEntityProperties(entityURI, wikidataEntity.properties, conversionOptions);
            }

            this.stats.entitiesConverted++;

            return {
                success: true,
                entityURI: entityURI,
                ragnoTriples: triples.concat(propertyTriples),
                originalEntity: wikidataEntity,
                propertyCount: propertyTriples.length,
                conversionType: 'wikidata-entity'
            };

        } catch (error) {
            this.stats.conversionErrors.push({
                entityId: wikidataEntity.id,
                error: error.message,
                timestamp: new Date().toISOString()
            });

            logger.error(`Failed to convert Wikidata entity ${wikidataEntity.id}:`, error.message);
            
            return {
                success: false,
                error: error.message,
                originalEntity: wikidataEntity
            };
        }
    }

    /**
     * Convert entity properties to Ragno attributes
     * @param {string} entityURI - Entity URI
     * @param {Array} properties - Wikidata properties array
     * @param {Object} options - Conversion options
     * @returns {Array} Property triples
     * @private
     */
    convertEntityProperties(entityURI, properties, options) {
        const triples = [];
        const processedProperties = properties.slice(0, this.options.maxPropertiesPerEntity);

        for (let i = 0; i < processedProperties.length; i++) {
            const property = processedProperties[i];
            const attributeResult = this.convertPropertyToAttribute(entityURI, property, i, options);
            
            if (attributeResult.success) {
                triples.push(...attributeResult.triples);
                this.stats.propertiesConverted++;
            }
        }

        return triples;
    }

    /**
     * Convert a single property to Ragno attribute
     * @param {string} entityURI - Entity URI
     * @param {Object} property - Property data
     * @param {number} index - Property index
     * @param {Object} options - Conversion options
     * @returns {Object} Conversion result
     * @private
     */
    convertPropertyToAttribute(entityURI, property, index, options) {
        try {
            const attributeURI = `${entityURI}/attribute/prop_${index}`;
            const triples = [];

            // Basic attribute structure
            triples.push(`<${attributeURI}> rdf:type ragno:Attribute .`);
            triples.push(`<${entityURI}> ragno:hasAttribute <${attributeURI}> .`);

            // Property identification
            const propertyId = this.extractPropertyId(property.property);
            const attributeType = this.mapPropertyType(propertyId) || 'wikidata-property';
            
            triples.push(`<${attributeURI}> ragno:attributeType ${this.createLiteral(attributeType)} .`);
            triples.push(`<${attributeURI}> ragno:wikidataProperty ${this.createLiteral(propertyId)} .`);
            
            if (property.propertyLabel) {
                triples.push(`<${attributeURI}> rdfs:label ${this.createLiteral(property.propertyLabel)} .`);
            }

            // Property value handling
            const valueResult = this.convertPropertyValue(property.value, property.valueLabel);
            if (valueResult.success) {
                triples.push(`<${attributeURI}> ragno:attributeValue ${valueResult.value} .`);
                
                if (valueResult.datatype) {
                    triples.push(`<${attributeURI}> ragno:valueType ${this.createLiteral(valueResult.datatype)} .`);
                }
            }

            // Provenance
            const timestamp = new Date().toISOString();
            triples.push(`<${attributeURI}> dcterms:created ${this.createLiteral(timestamp, 'xsd:dateTime')} .`);
            triples.push(`<${attributeURI}> prov:wasGeneratedBy ${this.createLiteral('wikidata-property-conversion')} .`);

            return {
                success: true,
                triples: triples,
                attributeURI: attributeURI
            };

        } catch (error) {
            logger.warn(`Failed to convert property ${property.property}:`, error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Convert property value to appropriate RDF format
     * @param {string} value - Property value
     * @param {string} valueLabel - Human-readable value label
     * @returns {Object} Converted value
     * @private
     */
    convertPropertyValue(value, valueLabel) {
        try {
            // Handle Wikidata entity references
            if (value.startsWith('http://www.wikidata.org/entity/')) {
                return {
                    success: true,
                    value: `<${value}>`,
                    datatype: 'entity-reference',
                    label: valueLabel
                };
            }

            // Handle URLs
            if (value.startsWith('http://') || value.startsWith('https://')) {
                return {
                    success: true,
                    value: `<${value}>`,
                    datatype: 'url'
                };
            }

            // Handle dates
            if (this.isDate(value)) {
                return {
                    success: true,
                    value: this.createLiteral(value, 'xsd:dateTime'),
                    datatype: 'datetime'
                };
            }

            // Handle numbers
            if (this.isNumber(value)) {
                const datatype = value.includes('.') ? 'xsd:decimal' : 'xsd:integer';
                return {
                    success: true,
                    value: this.createLiteral(value, datatype),
                    datatype: datatype.replace('xsd:', '')
                };
            }

            // Handle coordinates (special case)
            if (this.isCoordinate(value)) {
                return {
                    success: true,
                    value: this.createLiteral(value),
                    datatype: 'geo-coordinates'
                };
            }

            // Default to string literal
            const displayValue = valueLabel || value;
            return {
                success: true,
                value: this.createLiteral(displayValue),
                datatype: 'string'
            };

        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Create relationships between Wikidata and other entities
     * @param {string} wikidataEntityURI - Wikidata entity URI
     * @param {string} targetEntityURI - Target entity URI
     * @param {string} relationshipType - Type of relationship
     * @param {Object} options - Relationship options
     * @returns {Object} Relationship triples
     */
    createCrossReference(wikidataEntityURI, targetEntityURI, relationshipType = 'related-to', options = {}) {
        try {
            const relationshipURI = `${wikidataEntityURI}/relationship/${relationshipType}_${Date.now()}`;
            const triples = [];

            // Create formal relationship
            triples.push(`<${relationshipURI}> rdf:type ragno:Relationship .`);
            triples.push(`<${relationshipURI}> ragno:hasSourceEntity <${wikidataEntityURI}> .`);
            triples.push(`<${relationshipURI}> ragno:hasTargetEntity <${targetEntityURI}> .`);
            triples.push(`<${relationshipURI}> ragno:relationshipType ${this.createLiteral(relationshipType)} .`);
            
            // Weight and confidence
            const weight = options.weight || 0.8; // High weight for Wikidata relationships
            triples.push(`<${relationshipURI}> ragno:weight ${this.createLiteral(weight.toString(), 'xsd:float')} .`);
            
            // Description
            const description = options.description || `Wikidata cross-reference: ${relationshipType}`;
            triples.push(`<${relationshipURI}> ragno:description ${this.createLiteral(description)} .`);
            
            // Provenance
            const timestamp = new Date().toISOString();
            triples.push(`<${relationshipURI}> dcterms:created ${this.createLiteral(timestamp, 'xsd:dateTime')} .`);
            triples.push(`<${relationshipURI}> prov:wasGeneratedBy ${this.createLiteral('wikidata-cross-reference')} .`);

            this.stats.crossReferencesCreated++;

            return {
                success: true,
                relationshipURI: relationshipURI,
                triples: triples
            };

        } catch (error) {
            logger.error('Failed to create cross-reference:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Generate entity URI for Ragno system
     * @param {string} wikidataId - Wikidata entity ID (e.g., 'Q146')
     * @returns {string} Generated URI
     * @private
     */
    generateEntityURI(wikidataId) {
        return `${this.options.baseURI}entity/${wikidataId}`;
    }

    /**
     * Extract property ID from Wikidata property URI
     * @param {string} propertyURI - Property URI
     * @returns {string} Property ID
     * @private
     */
    extractPropertyId(propertyURI) {
        const match = propertyURI.match(/\/(P\d+)$/);
        return match ? match[1] : propertyURI;
    }

    /**
     * Map Wikidata property to Ragno attribute type
     * @param {string} propertyId - Wikidata property ID
     * @returns {string} Ragno attribute type
     * @private
     */
    mapPropertyType(propertyId) {
        return this.propertyTypeMappings[propertyId] || null;
    }

    /**
     * Create RDF literal with optional datatype
     * @param {string} value - Literal value
     * @param {string} datatype - Optional XSD datatype
     * @returns {string} RDF literal
     * @private
     */
    createLiteral(value, datatype = null) {
        const escapedValue = value.replace(/"/g, '\\"').replace(/\n/g, '\\n');
        return datatype ? `"${escapedValue}"^^${datatype}` : `"${escapedValue}"`;
    }

    /**
     * Check if value is a date
     * @private
     */
    isDate(value) {
        return /^\d{4}-\d{2}-\d{2}/.test(value) || /^\+\d{4}-\d{2}-\d{2}/.test(value);
    }

    /**
     * Check if value is a number
     * @private
     */
    isNumber(value) {
        return /^[-+]?\d*\.?\d+([eE][-+]?\d+)?$/.test(value);
    }

    /**
     * Check if value is coordinates
     * @private
     */
    isCoordinate(value) {
        return /^Point\(/.test(value) || (typeof value === 'string' && value.includes('latitude') && value.includes('longitude'));
    }

    /**
     * Get conversion statistics
     * @returns {Object} Conversion statistics
     */
    getStats() {
        return {
            ...this.stats,
            conversionRate: this.stats.entitiesConverted > 0 ? 
                ((this.stats.entitiesConverted - this.stats.conversionErrors.length) / this.stats.entitiesConverted * 100).toFixed(2) + '%' : '0%'
        };
    }

    /**
     * Reset statistics
     */
    resetStats() {
        this.stats = {
            entitiesConverted: 0,
            propertiesConverted: 0,
            relationshipsCreated: 0,
            crossReferencesCreated: 0,
            conversionErrors: []
        };
    }
}