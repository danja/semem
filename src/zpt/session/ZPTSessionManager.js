/**
 * ZPT Session Manager - Maintains session continuity across ZPT navigation operations
 * 
 * Provides persistent session state management using SPARQL storage with proper
 * ragno.ttl and zpt.ttl vocabulary integration
 */

import { v4 as uuidv4 } from 'uuid';
import logger from 'loglevel';

export class ZPTSessionManager {
    constructor(sparqlStore, options = {}) {
        this.sparqlStore = sparqlStore;
        this.config = {
            sessionGraph: options.sessionGraph || 'http://tensegrity.it/semem',
            navigationGraph: options.navigationGraph || 'http://purl.org/stuff/navigation',
            contentGraph: options.contentGraph,
            sessionTimeout: options.sessionTimeout || 3600000, // 1 hour
            enablePersistence: options.enablePersistence !== false,
            ...options
        };

        // Current session state
        this.currentSession = null;
        this.sessionCache = new Map();

        this.prefixes = `
            PREFIX ragno: <http://purl.org/stuff/ragno/>
            PREFIX zpt: <http://purl.org/stuff/zpt/>
            PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
            PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
            PREFIX dcterms: <http://purl.org/dc/terms/>
            PREFIX prov: <http://www.w3.org/ns/prov#>
            PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
        `;
    }

    /**
     * Initialize or restore a ZPT navigation session
     */
    async initializeSession(sessionId = null, initialState = {}) {
        try {
            if (sessionId) {
                // Try to restore existing session
                const restoredSession = await this.restoreSession(sessionId);
                if (restoredSession) {
                    this.currentSession = restoredSession;
                    logger.info('🔄 Restored existing ZPT session:', sessionId);
                    return restoredSession;
                }
            }

            // Create new session
            const newSession = await this.createNewSession(initialState);
            this.currentSession = newSession;

            logger.info('🆕 Created new ZPT session:', newSession.sessionId);
            return newSession;

        } catch (error) {
            logger.error('❌ Failed to initialize ZPT session:', error);
            throw error;
        }
    }

    /**
     * Create a new ZPT session with initial state
     */
    async createNewSession(initialState = {}) {
        const sessionId = `session_${Date.now()}_${uuidv4().substring(0, 6)}`;
        const sessionURI = `http://purl.org/stuff/instance/${sessionId}`;

        const session = {
            sessionId: sessionId,
            sessionURI: sessionURI,
            created: new Date().toISOString(),
            lastActivity: new Date().toISOString(),
            state: {
                zoom: initialState.zoom || 'entity',
                pan: initialState.pan || {},
                tilt: initialState.tilt || 'keywords',
                query: initialState.query || '',
                results: [],
                interactions: 0,
                ...initialState
            },
            metadata: {
                agent: 'ZPT-Navigation-System',
                purpose: 'Interactive knowledge navigation',
                persistent: this.config.enablePersistence
            }
        };

        // Store session in SPARQL if persistence is enabled
        if (this.config.enablePersistence) {
            await this.persistSession(session);
        }

        // Cache session locally
        this.sessionCache.set(sessionId, session);

        return session;
    }

    /**
     * Update session state with new ZPT parameters
     */
    async updateSessionState(updates) {
        if (!this.currentSession) {
            throw new Error('No active session to update');
        }

        // Update session state
        this.currentSession.state = {
            ...this.currentSession.state,
            ...updates
        };

        this.currentSession.lastActivity = new Date().toISOString();
        this.currentSession.state.interactions++;

        // Persist updated state
        if (this.config.enablePersistence) {
            await this.persistSessionState(this.currentSession);
        }

        // Update cache
        this.sessionCache.set(this.currentSession.sessionId, this.currentSession);

        logger.debug('📝 Updated ZPT session state:', {
            sessionId: this.currentSession.sessionId,
            updates: updates
        });

        return this.currentSession;
    }

    /**
     * Add navigation result to session history
     */
    async addNavigationResult(zptParams, results, metadata = {}) {
        if (!this.currentSession) {
            throw new Error('No active session for navigation result');
        }

        const navigationEntry = {
            timestamp: new Date().toISOString(),
            zptParams: zptParams,
            resultCount: results?.length || 0,
            results: results,
            metadata: {
                responseTime: metadata.selectionTime,
                enhanced: metadata.enhanced || false,
                ...metadata
            }
        };

        // Add to session results
        this.currentSession.state.results.push(navigationEntry);

        // Keep only last 50 results to manage memory
        if (this.currentSession.state.results.length > 50) {
            this.currentSession.state.results = this.currentSession.state.results.slice(-50);
        }

        // Update session
        await this.updateSessionState({
            lastQuery: zptParams.query,
            lastZoom: zptParams.zoom,
            lastPan: zptParams.pan,
            lastTilt: zptParams.tilt
        });

        // Store navigation view in SPARQL
        if (this.config.enablePersistence) {
            await this.storeNavigationView(navigationEntry);
        }

        return navigationEntry;
    }

    /**
     * Get current session state
     */
    getCurrentSession() {
        return this.currentSession;
    }

    /**
     * Get session ZPT state
     */
    getZPTState() {
        if (!this.currentSession) return null;

        return {
            zoom: this.currentSession.state.zoom,
            pan: this.currentSession.state.pan,
            tilt: this.currentSession.state.tilt,
            lastQuery: this.currentSession.state.lastQuery,
            sessionId: this.currentSession.sessionId,
            timestamp: this.currentSession.lastActivity
        };
    }

    /**
     * Get session statistics
     */
    getSessionStats() {
        if (!this.currentSession) return null;

        return {
            sessionId: this.currentSession.sessionId,
            created: this.currentSession.created,
            lastActivity: this.currentSession.lastActivity,
            interactions: this.currentSession.state.interactions,
            totalResults: this.currentSession.state.results.length,
            currentZoom: this.currentSession.state.zoom,
            currentTilt: this.currentSession.state.tilt
        };
    }

    /**
     * Persist session data to SPARQL
     */
    async persistSession(session) {
        const sessionData = this.escapeSparqlString(JSON.stringify(session.state));
        const purpose = this.escapeSparqlString(session.metadata.purpose);
        const sessionQuery = `
            ${this.prefixes}
            
            INSERT DATA {
                GRAPH <${this.config.navigationGraph}> {
                    <${session.sessionURI}> a zpt:NavigationSession ;
                        dcterms:created "${session.created}"^^xsd:dateTime ;
                        dcterms:modified "${session.lastActivity}"^^xsd:dateTime ;
                        prov:wasAssociatedWith <http://purl.org/stuff/agent/zpt-navigation> ;
                        zpt:hasPurpose "${purpose}" ;
                        zpt:sessionId "${session.sessionId}" ;
                        zpt:currentZoom <http://purl.org/stuff/zpt/${session.state.zoom}> ;
                        zpt:currentTilt <http://purl.org/stuff/zpt/${session.state.tilt}> ;
                        zpt:interactionCount ${session.state.interactions} .
                }
                
                GRAPH <${this.config.sessionGraph}> {
                    <${session.sessionURI}> zpt:sessionData """${sessionData}""" .
                }
            }
        `;

        const result = await this.sparqlStore._executeSparqlUpdate(sessionQuery, this.sparqlStore.endpoint.update);

        if (!result.success) {
            logger.warn('⚠️  Failed to persist session:', result.error);
        }
    }

    /**
     * Persist session state updates
     */
    async persistSessionState(session) {
        const sessionData = this.escapeSparqlString(JSON.stringify(session.state));
        const updateQuery = `
            ${this.prefixes}
            
            DELETE {
                GRAPH <${this.config.navigationGraph}> {
                    <${session.sessionURI}> dcterms:modified ?oldModified ;
                                          zpt:currentZoom ?oldZoom ;
                                          zpt:currentTilt ?oldTilt ;
                                          zpt:interactionCount ?oldCount .
                }
                GRAPH <${this.config.sessionGraph}> {
                    <${session.sessionURI}> zpt:sessionData ?oldData .
                }
            }
            INSERT {
                GRAPH <${this.config.navigationGraph}> {
                    <${session.sessionURI}> dcterms:modified "${session.lastActivity}"^^xsd:dateTime ;
                                          zpt:currentZoom <http://purl.org/stuff/zpt/${session.state.zoom}> ;
                                          zpt:currentTilt <http://purl.org/stuff/zpt/${session.state.tilt}> ;
                                          zpt:interactionCount ${session.state.interactions} .
                }
                GRAPH <${this.config.sessionGraph}> {
                    <${session.sessionURI}> zpt:sessionData """${sessionData}""" .
                }
            }
            WHERE {
                OPTIONAL {
                    GRAPH <${this.config.navigationGraph}> {
                        <${session.sessionURI}> dcterms:modified ?oldModified ;
                                              zpt:currentZoom ?oldZoom ;
                                              zpt:currentTilt ?oldTilt ;
                                              zpt:interactionCount ?oldCount .
                    }
                }
                OPTIONAL {
                    GRAPH <${this.config.sessionGraph}> {
                        <${session.sessionURI}> zpt:sessionData ?oldData .
                    }
                }
            }
        `;

        const result = await this.sparqlStore._executeSparqlUpdate(updateQuery, this.sparqlStore.endpoint.update);

        if (!result.success) {
            logger.warn('⚠️  Failed to persist session state:', result.error);
        }
    }

    /**
     * Store navigation view in SPARQL
     */
    async storeNavigationView(navigationEntry) {
        if (!this.currentSession) return;

        const viewURI = `http://purl.org/stuff/instance/view-${Date.now()}`;
        const queryText = this.escapeSparqlString(navigationEntry.zptParams.query || 'Navigation query');

        const viewQuery = `
            ${this.prefixes}
            
            INSERT DATA {
                GRAPH <${this.config.navigationGraph}> {
                    <${viewURI}> a zpt:NavigationView ;
                        zpt:partOfSession <${this.currentSession.sessionURI}> ;
                        zpt:hasQuery "${queryText}" ;
                        zpt:hasZoom <http://purl.org/stuff/zpt/${navigationEntry.zptParams.zoom}> ;
                        zpt:hasTilt <http://purl.org/stuff/zpt/${navigationEntry.zptParams.tilt}> ;
                        zpt:resultCount ${navigationEntry.resultCount} ;
                        zpt:responseTime ${navigationEntry.metadata.responseTime || 0} ;
                        dcterms:created "${navigationEntry.timestamp}"^^xsd:dateTime .
                }
            }
        `;

        const result = await this.sparqlStore._executeSparqlUpdate(viewQuery, this.sparqlStore.endpoint.update);

        if (!result.success) {
            logger.warn('⚠️  Failed to store navigation view:', result.error);
        }
    }

    /**
     * Escape special characters for SPARQL string literals
     */
    escapeSparqlString(value) {
        if (typeof value !== 'string') {
            return String(value ?? '');
        }
        return value
            .replace(/\\/g, '\\\\')
            .replace(/"/g, '\\"')
            .replace(/\n/g, '\\n')
            .replace(/\r/g, '\\r')
            .replace(/\t/g, '\\t');
    }

    /**
     * Restore session from SPARQL storage
     */
    async restoreSession(sessionId) {
        const restoreQuery = `
            ${this.prefixes}
            
            SELECT ?sessionURI ?created ?modified ?purpose ?agent ?interactions ?sessionData WHERE {
                GRAPH <${this.config.navigationGraph}> {
                    ?sessionURI a zpt:NavigationSession ;
                                zpt:sessionId "${sessionId}" ;
                                dcterms:created ?created ;
                                dcterms:modified ?modified ;
                                zpt:hasPurpose ?purpose ;
                                prov:wasAssociatedWith ?agent ;
                                zpt:interactionCount ?interactions .
                }
                GRAPH <${this.config.sessionGraph}> {
                    ?sessionURI zpt:sessionData ?sessionData .
                }
            }
        `;

        const result = await this.sparqlStore._executeSparqlQuery(
            restoreQuery,
            this.sparqlStore.endpoint.query
        );

        if (!result.success || result.data.results.bindings.length === 0) {
            return null;
        }

        const binding = result.data.results.bindings[0];

        try {
            const sessionData = JSON.parse(binding.sessionData.value);

            const restoredSession = {
                sessionId: sessionId,
                sessionURI: binding.sessionURI.value,
                created: binding.created.value,
                lastActivity: binding.modified.value,
                state: sessionData,
                metadata: {
                    agent: binding.agent?.value || 'ZPT-Navigation-System',
                    purpose: binding.purpose?.value || 'Interactive knowledge navigation',
                    persistent: true
                }
            };

            // Cache restored session
            this.sessionCache.set(sessionId, restoredSession);

            return restoredSession;

        } catch (error) {
            logger.error('❌ Failed to parse restored session data:', error);
            return null;
        }
    }

    /**
     * Clear expired sessions
     */
    async clearExpiredSessions() {
        const cutoffTime = new Date(Date.now() - this.config.sessionTimeout).toISOString();

        const clearQuery = `
            ${this.prefixes}
            
            DELETE {
                GRAPH <${this.config.navigationGraph}> {
                    ?session ?p ?o .
                    ?view zpt:partOfSession ?session .
                    ?view ?vp ?vo .
                }
                GRAPH <${this.config.sessionGraph}> {
                    ?session ?sp ?so .
                }
            }
            WHERE {
                GRAPH <${this.config.navigationGraph}> {
                    ?session a zpt:NavigationSession ;
                             dcterms:modified ?modified .
                    FILTER(?modified < "${cutoffTime}"^^xsd:dateTime)
                    ?session ?p ?o .
                    
                    OPTIONAL {
                        ?view zpt:partOfSession ?session ;
                              ?vp ?vo .
                    }
                }
                OPTIONAL {
                    GRAPH <${this.config.sessionGraph}> {
                        ?session ?sp ?so .
                    }
                }
            }
        `;

        const result = await this.sparqlStore._executeSparqlUpdate(clearQuery, this.sparqlStore.endpoint.update);

        if (result.success) {
            logger.info('🧹 Cleared expired ZPT sessions');
        }
    }

    /**
     * Get active session count
     */
    async getActiveSessionCount() {
        const countQuery = `
            ${this.prefixes}
            
            SELECT (COUNT(?session) as ?count) WHERE {
                GRAPH <${this.config.navigationGraph}> {
                    ?session a zpt:NavigationSession .
                }
            }
        `;

        const result = await this.sparqlStore._executeSparqlQuery(
            countQuery,
            this.sparqlStore.endpoint.query
        );

        if (result.success && result.data.results.bindings.length > 0) {
            return parseInt(result.data.results.bindings[0].count.value);
        }

        return 0;
    }
}
