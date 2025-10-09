/**
 * VSOM API Service
 * Handles communication with the MCP HTTP server for VSOM-specific operations
 * Follows patterns from workbench ApiService.js
 */

import SPARQLQueryLoader from '../utils/SPARQLQueryLoader.js';

export default class VSOMApiService {
    constructor(baseUrl = '/api') {
        this.baseUrl = baseUrl;
        this.sessionId = null;
        this.queryLoader = new SPARQLQueryLoader();

        this.defaultHeaders = {
            'Content-Type': 'application/json'
        };
    }

    /**
     * Make HTTP request with error handling and session management
     */
    async makeRequest(endpoint, options = {}) {
        const url = `${this.baseUrl}${endpoint}`;

        // Include session ID in headers if available
        const headers = { ...this.defaultHeaders };
        if (this.sessionId) {
            headers['mcp-session-id'] = this.sessionId;
        }

        // Set timeout for training operations (2 minutes)
        const timeout = endpoint === '/train-vsom' ? 120000 : 30000;

        const config = {
            headers: { ...headers, ...options.headers },
            ...options
        };

        try {
            // Create abort controller for timeout
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeout);

            const response = await fetch(url, {
                ...config,
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            // Extract and store session ID from response
            const responseSessionId = typeof response.headers?.get === 'function'
                ? response.headers.get('mcp-session-id')
                : null;
            if (responseSessionId && responseSessionId !== this.sessionId) {
                console.log(`🔗 [VSOM] Session ID updated: ${this.sessionId} → ${responseSessionId}`);
                this.sessionId = responseSessionId;
            }

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
            }

            const contentTypeHeader = typeof response.headers?.get === 'function'
                ? response.headers.get('content-type')
                : response.headers?.['content-type'] || response.headers?.['Content-Type'] || '';

            if (contentTypeHeader && contentTypeHeader.includes('application/json')) {
                return await response.json();
            }

            if (typeof response.json === 'function' && !contentTypeHeader) {
                return await response.json();
            }

            if (typeof response.text === 'function') {
                return await response.text();
            }

            return null;
        } catch (error) {
            if (error.name === 'AbortError') {
                console.error(`Request timeout [${endpoint}] after ${timeout}ms`);
                throw new Error(`Request timed out after ${timeout/1000} seconds`);
            }
            console.error(`API Error [${endpoint}]:`, error);
            throw error;
        }
    }

    /**
     * Test connection to API server
     */
    async testConnection() {
        try {
            await this.getHealth();
            return true;
        } catch (error) {
            console.warn('API connection test failed:', error.message);
            return false;
        }
    }

    /**
     * Get server health status
     */
    async getHealth() {
        return this.makeRequest('/health', {
            method: 'GET'
        });
    }

    /**
     * Get current ZPT navigation state using state endpoint
     */
    async getZPTState() {
        return this.makeRequest('/state', {
            method: 'GET'
        });
    }

    /**
     * Get contextual data that would be used for prompt synthesis at current ZPT state
     * This returns the same scope of data that would be included in an ask operation
     */
    async getContextualScope(options = {}) {
        try {
            // Use ask endpoint with a minimal question to get context metadata
            const response = await this.makeRequest('/ask', {
                method: 'POST',
                body: JSON.stringify({
                    question: options.query || 'What information is available in the current context?',
                    mode: 'comprehensive',
                    useContext: true,
                    useHyDE: false
                })
            });

            if (response.success) {
                // Extract contextual scope information from ask response
                return {
                    success: true,
                    contextual: {
                        items: response.contextItems || 0,
                        memories: response.memories || 0,
                        sessionResults: response.sessionResults || 0,
                        persistentResults: response.persistentResults || 0,
                        analysis: response.contextAnalysis || {},
                        zptState: response.zptState || {},
                        searchMethod: response.searchMethod || 'unknown',
                        sessionCacheStats: response.sessionCacheStats || {}
                    },
                    scope: 'contextual_prompt_synthesis'
                };
            } else {
                throw new Error(response.error || 'Failed to get contextual scope');
            }
        } catch (error) {
            console.warn('Failed to get contextual scope:', error.message);
            return { success: false, error: error.message, contextual: { items: 0, memories: 0 } };
        }
    }

    /**
     * Get current session data including interactions
     */
    async getSessionData() {
        return this.makeRequest('/inspect', {
            method: 'POST',
            body: JSON.stringify({
                what: 'session',
                details: false
            })
        });
    }

    /**
     * Get concepts data
     */
    async getConceptsData() {
        return this.makeRequest('/inspect', {
            method: 'POST',
            body: JSON.stringify({
                what: 'concepts',
                details: false
            })
        });
    }

    /**
     * Get all system data including knowledge graph
     */
    async getAllData() {
        return this.makeRequest('/inspect', {
            method: 'POST',
            body: JSON.stringify({
                what: 'all',
                details: true
            })
        });
    }

    /**
     * Get knowledge graph data (nodes and edges)
     */
    async getKnowledgeGraph() {
        const data = await this.makeRequest('/inspect', {
            method: 'POST',
            body: JSON.stringify({
                what: 'all',
                details: true
            })
        });

        const kg = data.knowledgeGraph || { nodes: [], edges: [], metadata: {} };

        // Add top-level counts for convenience (they're in metadata)
        kg.nodeCount = kg.metadata?.nodeCount || kg.nodes?.length || 0;
        kg.edgeCount = kg.metadata?.edgeCount || kg.edges?.length || 0;

        return kg;
    }

    /**
     * Query SPARQL store directly for memory data
     */
    async getSPARQLData(query = null, variables = {}) {
        let sparqlQuery;

        if (query) {
            sparqlQuery = query;
        } else {
            // Load default query from template
            sparqlQuery = await this.queryLoader.loadQuery('visualization/vsom-all-data.sparql', variables);
        }

        try {
            // Query Fuseki directly
            const encodedQuery = encodeURIComponent(sparqlQuery);
            const response = await fetch(`http://localhost:3030/semem/query?query=${encodedQuery}`, {
                method: 'GET',
                headers: {
                    'Accept': 'application/sparql-results+json'
                }
            });

            if (!response.ok) {
                throw new Error(`SPARQL query failed: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.warn('SPARQL query failed, falling back to memory manager:', error);
            // Fallback to direct ask endpoint
            return this.makeRequest('/ask', {
                method: 'POST',
                body: JSON.stringify({
                    question: 'What content is available?',
                    mode: 'standard',
                    useContext: true
                })
            });
        }
    }

    /**
     * Train VSOM on knowledge graph data
     * @param {Object} options - Training options
     * @param {number} options.epochs - Number of training epochs (default: 100)
     * @param {number} options.learningRate - Initial learning rate (default: 0.1)
     * @param {number} options.gridSize - Grid size (default: 20)
     * @returns {Promise<Object>} Training result with grid and mappings
     */
    async trainVSOM(options = {}) {
        const {
            epochs = 100,
            learningRate = 0.1,
            gridSize = 20
        } = options;

        console.log(`🧠 [VSOM] Training with epochs=${epochs}, learningRate=${learningRate}, gridSize=${gridSize}`);

        try {
            const result = await this.makeRequest('/train-vsom', {
                method: 'POST',
                body: JSON.stringify({
                    epochs,
                    learningRate,
                    gridSize
                })
            });

            console.log(`✅ [VSOM] Training API response:`, result);
            console.log(`✅ [VSOM] Training summary:`, {
                success: result.success,
                epochs: result.epochs,
                finalError: result.finalError,
                nodes: result.metadata?.entitiesCount || 0,
                hasMappings: !!result.mappings,
                mappingsCount: result.mappings?.length || 0
            });

            return result;
        } catch (error) {
            console.error('❌ [VSOM] Training failed:', error);
            throw error;
        }
    }

    /**
     * Get entities from SPARQL store
     */
    async getEntities(variables = {}) {
        const entitiesQuery = await this.queryLoader.loadQuery('visualization/vsom-entities.sparql', variables);
        return this.getSPARQLData(entitiesQuery);
    }

    /**
     * Get memory items from SPARQL store
     */
    async getMemoryItems(variables = {}) {
        const memoryQuery = await this.queryLoader.loadQuery('visualization/vsom-memory-items.sparql', variables);
        return this.getSPARQLData(memoryQuery);
    }

    /**
     * Get concepts from SPARQL store
     */
    async getSPARQLConcepts(variables = {}) {
        const conceptsQuery = await this.queryLoader.loadQuery('visualization/vsom-concepts.sparql', variables);
        return this.getSPARQLData(conceptsQuery);
    }

    /**
     * Set zoom level
     */
    async setZoom(level, query) {
        // Use ZPT navigate endpoint with zoom parameter
        return this.makeRequest('/zpt/navigate', {
            method: 'POST',
            body: JSON.stringify({
                zoom: level,
                query: query
            })
        });
    }

    /**
     * Set pan filters
     */
    async setPan(panParams, query) {
        const panData = {
            direction: panParams.direction || 'semantic',
            maxResults: panParams.maxResults || 50,
            threshold: panParams.threshold || 0.5
        };

        if (panParams.domains) {
            panData.domain = Array.isArray(panParams.domains) ?
                panParams.domains.join(',') :
                panParams.domains;
        }
        if (panParams.keywords) {
            panData.conceptFilter = Array.isArray(panParams.keywords) ?
                panParams.keywords :
                panParams.keywords.split(',').map(s => s.trim()).filter(s => s);
        }
        if (panParams.timeRange) {
            panData.timeRange = panParams.timeRange;
        }

        // Use ZPT navigate endpoint with pan parameter
        return this.makeRequest('/zpt/navigate', {
            method: 'POST',
            body: JSON.stringify({
                pan: panData,
                query: query
            })
        });
    }

    /**
     * Set tilt style
     */
    async setTilt(style, query) {
        // Use ZPT navigate endpoint with tilt parameter
        return this.makeRequest('/zpt/navigate', {
            method: 'POST',
            body: JSON.stringify({
                tilt: style,
                query: query
            })
        });
    }

    /**
     * Create VSOM instance
     */
    async createVSOMInstance(config = {}) {
        // This would connect to VSOMService endpoints
        // For now, we'll simulate this with inspect data
        return this.makeRequest('/inspect', {
            method: 'POST',
            body: JSON.stringify({
                type: 'system',
                includeRecommendations: true
            })
        });
    }

    /**
     * Load data into VSOM
     */
    async loadVSOMData(entities) {
        // This would use the actual VSOM service
        // For now, we'll process the data locally
        return {
            success: true,
            entitiesLoaded: entities.length,
            message: 'Data loaded for VSOM processing'
        };
    }

    /**
     * Train VSOM instance
     */
    // REMOVED: Old mock trainVSOM method - use the real one at line 240

    /**
     * Get VSOM grid state
     */
    async getVSOMGridState(instanceId, options = {}) {
        // This would get actual grid state from VSOMService
        // For now, return mock grid state
        return {
            success: true,
            grid: this.generateMockGrid(),
            mappings: {},
            metadata: {
                mapSize: [10, 10],
                entitiesCount: 0,
                trained: false
            }
        };
    }

    /**
     * Get VSOM feature maps
     */
    async getVSOMFeatureMaps(instanceId, options = {}) {
        return {
            success: true,
            featureMap: this.generateMockFeatureMap(),
            mapType: options.mapType || 'umatrix',
            statistics: {
                min: 0.1,
                max: 0.9,
                mean: 0.5
            }
        };
    }

    /**
     * Perform VSOM clustering on live semantic data
     */
    async performVSOMClustering(instanceId, options = {}) {
        try {
            // Get semantic data from SPARQL store for clustering
            const sparqlData = await this.getSPARQLData();
            const entitiesData = await this.getEntities();

            // Perform actual semantic clustering based on concept similarity
            const clusters = await this.performSemanticClustering(sparqlData, entitiesData, options);

            return {
                success: true,
                clusters: clusters.clusters,
                statistics: clusters.statistics
            };
        } catch (error) {
            console.error('VSOM clustering failed:', error);
            return {
                success: false,
                error: error.message,
                clusters: [],
                statistics: {
                    totalClusters: 0,
                    averageClusterSize: 0,
                    largestCluster: 0,
                    smallestCluster: 0
                }
            };
        }
    }

    /**
     * Perform actual semantic clustering based on concept similarity
     */
    async performSemanticClustering(sparqlData, entitiesData, options = {}) {
        const concepts = [];
        const entities = [];

        // Extract concepts and entities from SPARQL data
        if (sparqlData.success && sparqlData.data) {
            concepts.push(...(sparqlData.data.concepts || []));
            entities.push(...(sparqlData.data.entities || []));
        }

        // Extract from entities data
        if (entitiesData.success && entitiesData.entities) {
            entities.push(...entitiesData.entities);
        }

        // Group entities by shared concepts for clustering
        const clusters = this.clusterBySharedConcepts(entities, concepts, options);

        return {
            clusters: clusters,
            statistics: {
                totalClusters: clusters.length,
                averageClusterSize: clusters.length > 0 ? clusters.reduce((sum, c) => sum + c.entities.length, 0) / clusters.length : 0,
                largestCluster: clusters.length > 0 ? Math.max(...clusters.map(c => c.entities.length)) : 0,
                smallestCluster: clusters.length > 0 ? Math.min(...clusters.map(c => c.entities.length)) : 0
            }
        };
    }

    /**
     * Cluster entities based on shared concepts
     */
    clusterBySharedConcepts(entities, concepts, options = {}) {
        const clusters = new Map();
        const minSharedConcepts = options.minSharedConcepts || 1;

        // Group entities that share concepts
        for (const entity of entities) {
            const entityConcepts = Array.isArray(entity.concepts) ? entity.concepts : [];

            if (entityConcepts.length === 0) continue;

            // Find or create cluster based on primary concepts
            const primaryConcepts = entityConcepts.slice(0, 2).sort(); // Use first 2 concepts as cluster key
            const clusterKey = primaryConcepts.join('_') || 'miscellaneous';

            if (!clusters.has(clusterKey)) {
                clusters.set(clusterKey, {
                    id: `cluster_${clusterKey}`,
                    primaryConcepts: primaryConcepts,
                    entities: [],
                    concepts: new Set(),
                    centroid: null // Will be calculated based on actual semantic positions if available
                });
            }

            const cluster = clusters.get(clusterKey);
            cluster.entities.push(entity.id || entity.uri || entity);

            // Add all concepts to cluster
            entityConcepts.forEach(concept => cluster.concepts.add(concept));
        }

        // Convert to array and calculate final cluster properties
        return Array.from(clusters.values()).map((cluster, index) => ({
            id: cluster.id,
            primaryConcepts: cluster.primaryConcepts,
            entities: cluster.entities,
            concepts: Array.from(cluster.concepts),
            size: cluster.entities.length,
            strength: this.calculateClusterStrength(cluster),
            centroid: this.calculateSemanticCentroid(cluster, index)
        })).filter(cluster => cluster.size >= minSharedConcepts);
    }

    /**
     * Calculate cluster strength based on concept overlap
     */
    calculateClusterStrength(cluster) {
        if (cluster.entities.length <= 1) return 1.0;

        // Strength based on concept density and entity count
        const conceptDensity = cluster.concepts.size / cluster.entities.length;
        const sizeFactor = Math.min(cluster.entities.length / 10, 1); // Normalize size

        return Math.min(conceptDensity * sizeFactor, 1.0);
    }

    /**
     * Calculate semantic centroid for cluster positioning
     */
    calculateSemanticCentroid(cluster, clusterIndex) {
        // Use cluster index and concept hash for consistent positioning
        // In a full VSOM implementation, this would use actual embedding vectors
        const conceptHash = cluster.primaryConcepts.join('').split('').reduce((hash, char) =>
            ((hash << 5) - hash) + char.charCodeAt(0), 0);

        const x = (Math.abs(conceptHash) % 10) + (clusterIndex % 3) * 4;
        const y = Math.floor(clusterIndex / 3) * 3 + (Math.abs(conceptHash) % 3);

        return [x, y];
    }

    /**
     * Navigate using ZPT parameters
     */
    async zptNavigate({ query, zoom = 'entity', pan = {}, tilt = 'keywords' }) {
        // Perform ZPT navigation using individual verbs
        const results = {};

        // Set zoom level
        if (zoom) {
            results.zoom = await this.setZoom(zoom, query);
        }

        // Set pan filters
        if (pan && Object.keys(pan).length > 0) {
            results.pan = await this.setPan(pan, query);
        }

        // Set tilt style
        if (tilt) {
            results.tilt = await this.setTilt(tilt, query);
        }

        // Get final state after navigation
        results.finalState = await this.getZPTState();

        return {
            success: true,
            results: results,
            message: 'ZPT navigation completed'
        };
    }

    /**
     * Get interaction history with embeddings
     */
    async getInteractionHistory(limit = 100) {
        try {
            const sessionData = await this.getSessionData();

            // Extract interactions from session data
            let interactions = [];

            if (sessionData.sessionCache?.interactions) {
                interactions = sessionData.sessionCache.interactions;
            } else if (sessionData.interactions) {
                interactions = sessionData.interactions;
            } else if (sessionData.zptState?.interactions) {
                interactions = sessionData.zptState.interactions;
            }

            // Ensure we have an array and limit results
            if (!Array.isArray(interactions)) {
                interactions = [];
            }

            return {
                success: true,
                interactions: interactions.slice(-limit),
                total: interactions.length
            };
        } catch (error) {
            console.warn('Failed to get interaction history:', error);
            return {
                success: false,
                interactions: [],
                total: 0,
                error: error.message
            };
        }
    }

    /**
     * Generate mock grid for testing
     * @private
     */
    generateMockGrid() {
        const grid = [];
        for (let y = 0; y < 10; y++) {
            const row = [];
            for (let x = 0; x < 10; x++) {
                row.push({
                    x,
                    y,
                    entities: [],
                    weights: Array(1536).fill(0).map(() => Math.random() - 0.5),
                    activation: Math.random()
                });
            }
            grid.push(row);
        }
        return grid;
    }

    /**
     * Generate mock feature map for testing
     * @private
     */
    generateMockFeatureMap() {
        const map = [];
        for (let y = 0; y < 10; y++) {
            const row = [];
            for (let x = 0; x < 10; x++) {
                row.push(Math.random());
            }
            map.push(row);
        }
        return map;
    }


    /**
     * Get formatted error message
     */
    getErrorMessage(error) {
        if (error.message) {
            if (error.message.includes('fetch')) {
                return 'Unable to connect to server. Please check if the service is running.';
            }
            if (error.message.includes('404')) {
                return 'API endpoint not found. Please check server configuration.';
            }
            if (error.message.includes('500')) {
                return 'Server error occurred. Please try again or check server logs.';
            }
            return error.message;
        }
        return 'Unknown error occurred';
    }
}
