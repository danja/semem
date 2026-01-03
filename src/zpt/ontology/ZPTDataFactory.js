/**
 * ZPTDataFactory.js - RDF-Ext Dataset Management for ZPT Ontology
 * 
 * This module provides factory methods and utilities for creating, managing,
 * and manipulating RDF datasets using the ZPT (Zoom-Pan-Tilt) ontology.
 * 
 * Key responsibilities:
 * - Create RDF datasets with ZPT ontology terms
 * - Generate navigation views and their states
 * - Manage provenance and session tracking
 * - Provide utility methods for common ZPT RDF patterns
 */

import rdf from 'rdf-ext';
import { ZPT, RAGNO, PROV, XSD, RDF, RDFS } from './ZPTNamespaces.js';
import logger from 'loglevel';

/**
 * Factory for creating ZPT-related RDF data structures
 */
export class ZPTDataFactory {
    constructor(options = {}) {
        this.baseURI = options.baseURI || 'http://example.org/nav/';
        this.navigationGraph = options.navigationGraph || 'http://purl.org/stuff/navigation';
        this.datasetFactory = rdf;
        
        // Counter for generating unique IDs
        this.viewCounter = 0;
        this.sessionCounter = 0;
        this.stateCounter = 0;
    }

    /**
     * Create a new RDF dataset for ZPT navigation data
     * @returns {Dataset} Empty RDF dataset ready for ZPT data
     */
    createDataset() {
        return this.datasetFactory.dataset();
    }

    /**
     * Generate a unique URI for navigation entities
     * @param {string} type - Entity type (view, session, state)
     * @param {string} suffix - Optional suffix
     * @returns {NamedNode} RDF NamedNode with unique URI
     */
    generateURI(type, suffix = '') {
        let counter;
        switch (type) {
            case 'view':
                counter = ++this.viewCounter;
                break;
            case 'session':
                counter = ++this.sessionCounter;
                break;
            case 'state':
                counter = ++this.stateCounter;
                break;
            default:
                counter = Date.now();
        }
        
        const id = suffix ? `${type}_${counter}_${suffix}` : `${type}_${counter}`;
        return this.datasetFactory.namedNode(`${this.baseURI}${id}`);
    }

    /**
     * Create a navigation session with basic metadata
     * @param {Object} options - Session options
     * @param {string} options.agentURI - URI of the navigating agent
     * @param {Date} options.startTime - Session start time
     * @returns {Object} Session data with URI and quads
     */
    createNavigationSession(options = {}) {
        const sessionURI = this.generateURI('session');
        const startTime = options.startTime || new Date();
        const agentURI = options.agentURI ? this.datasetFactory.namedNode(options.agentURI) : null;
        const purpose = options.purpose || 'Navigation session';
        
        const quads = [];
        const graphNode = this.datasetFactory.namedNode(this.navigationGraph);

        // Basic session properties
        quads.push(this.datasetFactory.quad(
            sessionURI,
            RDF.type,
            ZPT.NavigationSession,
            graphNode
        ));

        // Store purpose as ZPT property
        quads.push(this.datasetFactory.quad(
            sessionURI,
            ZPT.hasPurpose,
            this.datasetFactory.literal(purpose),
            graphNode
        ));

        // Store timestamp as ZPT property
        quads.push(this.datasetFactory.quad(
            sessionURI,
            ZPT.navigationTimestamp,
            this.datasetFactory.literal(startTime.toISOString(), XSD.dateTime),
            graphNode
        ));

        // Also store PROV properties for compatibility
        quads.push(this.datasetFactory.quad(
            sessionURI,
            PROV.startedAtTime,
            this.datasetFactory.literal(startTime.toISOString(), XSD.dateTime),
            graphNode
        ));

        // Associate with agent if provided
        if (agentURI) {
            quads.push(this.datasetFactory.quad(
                sessionURI,
                PROV.wasAssociatedWith,
                agentURI,
                graphNode
            ));
        }

        return {
            uri: sessionURI,
            quads: quads,
            startTime: startTime,
            agentURI: agentURI,
            purpose: purpose
        };
    }

    /**
     * Create a zoom state with specified level
     * @param {string} zoomLevel - ZPT zoom level URI or string
     * @returns {Object} Zoom state data with URI and quads
     */
    createZoomState(zoomLevel) {
        const stateURI = this.generateURI('state', 'zoom');
        const zoomLevelNode = this.resolveZoomLevel(zoomLevel);
        
        const quads = [];
        const graphNode = this.datasetFactory.namedNode(this.navigationGraph);

        quads.push(this.datasetFactory.quad(
            stateURI,
            RDF.type,
            ZPT.ZoomState,
            graphNode
        ));

        quads.push(this.datasetFactory.quad(
            stateURI,
            ZPT.atZoomLevel,
            zoomLevelNode,
            graphNode
        ));

        return {
            uri: stateURI,
            quads: quads,
            zoomLevel: zoomLevelNode
        };
    }

    /**
     * Create a pan state with domain and filtering parameters
     * @param {Object} panConfig - Pan configuration
     * @param {string|Array} panConfig.domains - Domain URIs or strings
     * @param {Object} panConfig.temporal - Temporal constraints
     * @param {Array} panConfig.entities - Entity URIs
     * @returns {Object} Pan state data with URI and quads
     */
    createPanState(panConfig = {}) {
        const stateURI = this.generateURI('state', 'pan');
        const quads = [];
        const graphNode = this.datasetFactory.namedNode(this.navigationGraph);

        quads.push(this.datasetFactory.quad(
            stateURI,
            RDF.type,
            ZPT.PanState,
            graphNode
        ));

        // Handle domain constraints
        if (panConfig.domains) {
            const domains = Array.isArray(panConfig.domains) ? panConfig.domains : [panConfig.domains];
            domains.forEach(domain => {
                const domainNode = this.resolvePanDomain(domain);
                quads.push(this.datasetFactory.quad(
                    stateURI,
                    ZPT.withPanDomain,
                    domainNode,
                    graphNode
                ));
            });
        }

        // Handle temporal constraints
        if (panConfig.temporal) {
            const temporalNode = this.createTemporalConstraint(panConfig.temporal);
            if (temporalNode.quads.length > 0) {
                quads.push(...temporalNode.quads);
                quads.push(this.datasetFactory.quad(
                    stateURI,
                    ZPT.hasTemporalConstraint,
                    temporalNode.uri,
                    graphNode
                ));
            }
        }

        // Handle entity constraints
        if (panConfig.entities && Array.isArray(panConfig.entities)) {
            panConfig.entities.forEach(entityURI => {
                const entityNode = typeof entityURI === 'string' ? 
                    this.datasetFactory.namedNode(entityURI) : entityURI;
                quads.push(this.datasetFactory.quad(
                    stateURI,
                    ZPT.constrainedByEntity,
                    entityNode,
                    graphNode
                ));
            });
        }

        return {
            uri: stateURI,
            quads: quads,
            config: panConfig
        };
    }

    /**
     * Create a tilt state with projection method
     * @param {string} tiltProjection - ZPT tilt projection URI or string
     * @returns {Object} Tilt state data with URI and quads
     */
    createTiltState(tiltProjection) {
        const stateURI = this.generateURI('state', 'tilt');
        const projectionNode = this.resolveTiltProjection(tiltProjection);
        
        const quads = [];
        const graphNode = this.datasetFactory.namedNode(this.navigationGraph);

        quads.push(this.datasetFactory.quad(
            stateURI,
            RDF.type,
            ZPT.TiltState,
            graphNode
        ));

        quads.push(this.datasetFactory.quad(
            stateURI,
            ZPT.withTiltProjection,
            projectionNode,
            graphNode
        ));

        return {
            uri: stateURI,
            quads: quads,
            projection: projectionNode
        };
    }

    /**
     * Create a complete navigation view with all states
     * @param {Object} config - Navigation view configuration
     * @param {string} config.query - Natural language query
     * @param {string} config.zoom - Zoom level
     * @param {Object} config.pan - Pan configuration
     * @param {string} config.tilt - Tilt projection
     * @param {string} config.sessionURI - Parent session URI
     * @param {Array} config.selectedCorpuscles - Selected corpuscle URIs
     * @returns {Object} Complete navigation view with all quads
     */
    createNavigationView(config) {
        const viewURI = this.generateURI('view');
        const quads = [];
        const graphNode = this.datasetFactory.namedNode(this.navigationGraph);

        // Basic navigation view properties
        quads.push(this.datasetFactory.quad(
            viewURI,
            RDF.type,
            ZPT.NavigationView,
            graphNode
        ));

        quads.push(this.datasetFactory.quad(
            viewURI,
            ZPT.answersQuery,
            this.datasetFactory.literal(config.query),
            graphNode
        ));

        quads.push(this.datasetFactory.quad(
            viewURI,
            ZPT.navigationTimestamp,
            this.datasetFactory.literal(new Date().toISOString(), XSD.dateTime),
            graphNode
        ));

        // Link to session if provided
        if (config.sessionURI) {
            const sessionNode = typeof config.sessionURI === 'string' ?
                this.datasetFactory.namedNode(config.sessionURI) : config.sessionURI;
            quads.push(this.datasetFactory.quad(
                viewURI,
                ZPT.partOfSession,
                sessionNode,
                graphNode
            ));
        }

        // Create and link states
        const zoomState = this.createZoomState(config.zoom);
        quads.push(...zoomState.quads);
        quads.push(this.datasetFactory.quad(
            viewURI,
            ZPT.hasZoomState,
            zoomState.uri,
            graphNode
        ));

        const panState = this.createPanState(config.pan || {});
        quads.push(...panState.quads);
        quads.push(this.datasetFactory.quad(
            viewURI,
            ZPT.hasPanState,
            panState.uri,
            graphNode
        ));

        const tiltState = this.createTiltState(config.tilt);
        quads.push(...tiltState.quads);
        quads.push(this.datasetFactory.quad(
            viewURI,
            ZPT.hasTiltState,
            tiltState.uri,
            graphNode
        ));

        // Link to selected corpuscles
        if (config.selectedCorpuscles && Array.isArray(config.selectedCorpuscles)) {
            config.selectedCorpuscles.forEach(corpuscleURI => {
                const corpuscleNode = typeof corpuscleURI === 'string' ?
                    this.datasetFactory.namedNode(corpuscleURI) : corpuscleURI;
                quads.push(this.datasetFactory.quad(
                    viewURI,
                    ZPT.selectedCorpuscle,
                    corpuscleNode,
                    graphNode
                ));
            });
        }

        return {
            uri: viewURI,
            quads: quads,
            states: {
                zoom: zoomState,
                pan: panState,
                tilt: tiltState
            },
            config: config
        };
    }

    /**
     * Add optimization metadata to a corpuscle
     * @param {string|NamedNode} corpuscleURI - Corpuscle URI
     * @param {Object} scores - Optimization scores
     * @param {number} scores.optimizationScore - Overall score
     * @param {number} scores.zoomRelevance - Zoom relevance score
     * @param {number} scores.panCoverage - Pan coverage score
     * @param {number} scores.tiltEffectiveness - Tilt effectiveness score
     * @returns {Array} Array of quads with optimization metadata
     */
    addOptimizationMetadata(corpuscleURI, scores) {
        const corpuscleNode = typeof corpuscleURI === 'string' ?
            this.datasetFactory.namedNode(corpuscleURI) : corpuscleURI;
        const quads = [];
        const graphNode = this.datasetFactory.namedNode(this.navigationGraph);

        if (typeof scores.optimizationScore === 'number') {
            quads.push(this.datasetFactory.quad(
                corpuscleNode,
                ZPT.optimizationScore,
                this.datasetFactory.literal(scores.optimizationScore.toString(), XSD.float),
                graphNode
            ));
        }

        if (typeof scores.zoomRelevance === 'number') {
            quads.push(this.datasetFactory.quad(
                corpuscleNode,
                ZPT.zoomRelevance,
                this.datasetFactory.literal(scores.zoomRelevance.toString(), XSD.float),
                graphNode
            ));
        }

        if (typeof scores.panCoverage === 'number') {
            quads.push(this.datasetFactory.quad(
                corpuscleNode,
                ZPT.panCoverage,
                this.datasetFactory.literal(scores.panCoverage.toString(), XSD.float),
                graphNode
            ));
        }

        if (typeof scores.tiltEffectiveness === 'number') {
            quads.push(this.datasetFactory.quad(
                corpuscleNode,
                ZPT.tiltEffectiveness,
                this.datasetFactory.literal(scores.tiltEffectiveness.toString(), XSD.float),
                graphNode
            ));
        }

        return quads;
    }

    /**
     * Resolve zoom level string to ZPT ontology URI
     * @param {string} zoomLevel - Zoom level string or URI
     * @returns {NamedNode} ZPT zoom level URI
     */
    resolveZoomLevel(zoomLevel) {
        if (typeof zoomLevel !== 'string') {
            return zoomLevel; // Assume it's already a NamedNode
        }

        const zoomMap = {
            'micro': ZPT.MicroLevel,
            'entity': ZPT.EntityLevel,
            'unit': ZPT.UnitLevel,
            'text': ZPT.TextLevel,
            'community': ZPT.CommunityLevel,
            'corpus': ZPT.CorpusLevel
        };

        return zoomMap[zoomLevel] || this.datasetFactory.namedNode(zoomLevel);
    }

    /**
     * Resolve tilt projection string to ZPT ontology URI
     * @param {string} tiltProjection - Tilt projection string or URI
     * @returns {NamedNode} ZPT tilt projection URI
     */
    resolveTiltProjection(tiltProjection) {
        if (typeof tiltProjection !== 'string') {
            return tiltProjection; // Assume it's already a NamedNode
        }

        const tiltMap = {
            'keywords': ZPT.KeywordProjection,
            'embedding': ZPT.EmbeddingProjection,
            'graph': ZPT.GraphProjection,
            'temporal': ZPT.TemporalProjection,
            'concept': ZPT.ConceptProjection
        };

        return tiltMap[tiltProjection] || this.datasetFactory.namedNode(tiltProjection);
    }

    /**
     * Resolve pan domain string to ZPT ontology URI
     * @param {string} domain - Domain string or URI
     * @returns {NamedNode} ZPT pan domain URI
     */
    resolvePanDomain(domain) {
        if (typeof domain !== 'string') {
            return domain; // Assume it's already a NamedNode
        }

        const domainMap = {
            'topic': ZPT.TopicDomain,
            'entity': ZPT.EntityDomain,
            'temporal': ZPT.TemporalDomain,
            'geospatial': ZPT.GeospatialDomain
        };

        return domainMap[domain] || this.datasetFactory.namedNode(`${this.baseURI}domain/${domain}`);
    }

    /**
     * Create temporal constraint node with date range
     * @param {Object} temporal - Temporal configuration
     * @param {string} temporal.start - Start date
     * @param {string} temporal.end - End date
     * @returns {Object} Temporal constraint with URI and quads
     */
    createTemporalConstraint(temporal) {
        const constraintURI = this.generateURI('constraint', 'temporal');
        const quads = [];
        const graphNode = this.datasetFactory.namedNode(this.navigationGraph);

        if (temporal.start) {
            quads.push(this.datasetFactory.quad(
                constraintURI,
                ZPT.temporalStart,
                this.datasetFactory.literal(temporal.start, XSD.dateTime),
                graphNode
            ));
        }

        if (temporal.end) {
            quads.push(this.datasetFactory.quad(
                constraintURI,
                ZPT.temporalEnd,
                this.datasetFactory.literal(temporal.end, XSD.dateTime),
                graphNode
            ));
        }

        return {
            uri: constraintURI,
            quads: quads
        };
    }

    /**
     * Convert RDF dataset to N-Triples string for debugging
     * @param {Dataset} dataset - RDF dataset
     * @returns {string} N-Triples representation
     */
    datasetToNTriples(dataset) {
        const serializer = new (rdf.formats.serializers.get('application/n-triples'))();
        const stream = serializer.import(dataset.toStream());
        
        return new Promise((resolve, reject) => {
            let result = '';
            stream.on('data', chunk => {
                result += chunk;
            });
            stream.on('end', () => {
                resolve(result);
            });
            stream.on('error', reject);
        });
    }

    /**
     * Utility method to create a complete dataset with navigation view
     * @param {Object} config - Navigation configuration
     * @returns {Dataset} Complete RDF dataset
     */
    createNavigationDataset(config) {
        const dataset = this.createDataset();
        const view = this.createNavigationView(config);
        
        // Add all quads to dataset
        view.quads.forEach(quad => {
            dataset.add(quad);
        });

        return dataset;
    }
}

/**
 * Default factory instance for convenience
 */
export const zptDataFactory = new ZPTDataFactory();

/**
 * Utility functions for common operations
 */
export const ZPTUtils = {
    /**
     * Create a simple navigation view with minimal configuration
     * @param {string} query - Natural language query
     * @param {string} zoom - Zoom level
     * @param {string} tilt - Tilt projection
     * @returns {Object} Navigation view data
     */
    createSimpleView(query, zoom = 'entity', tilt = 'keywords') {
        return zptDataFactory.createNavigationView({
            query,
            zoom,
            tilt,
            pan: {}
        });
    },

    /**
     * Extract navigation parameters from RDF dataset
     * @param {Dataset} dataset - RDF dataset containing navigation view
     * @param {NamedNode} viewURI - Navigation view URI
     * @returns {Object} Extracted navigation parameters
     */
    extractNavigationParams(dataset, viewURI) {
        const params = {
            query: null,
            zoom: null,
            pan: {},
            tilt: null,
            timestamp: null
        };

        // Extract query
        for (const quad of dataset.match(viewURI, ZPT.answersQuery)) {
            params.query = quad.object.value;
            break;
        }

        // Extract timestamp
        for (const quad of dataset.match(viewURI, ZPT.navigationTimestamp)) {
            params.timestamp = new Date(quad.object.value);
            break;
        }

        // Extract zoom level
        for (const quad of dataset.match(viewURI, ZPT.hasZoomState)) {
            const zoomState = quad.object;
            for (const zoomQuad of dataset.match(zoomState, ZPT.atZoomLevel)) {
                params.zoom = zoomQuad.object.value;
                break;
            }
            break;
        }

        // Extract tilt projection
        for (const quad of dataset.match(viewURI, ZPT.hasTiltState)) {
            const tiltState = quad.object;
            for (const tiltQuad of dataset.match(tiltState, ZPT.withTiltProjection)) {
                params.tilt = tiltQuad.object.value;
                break;
            }
            break;
        }

        return params;
    }
};

export default ZPTDataFactory;
