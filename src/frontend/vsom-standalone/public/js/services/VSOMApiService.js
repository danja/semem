/**
 * VSOM API Service
 * Handles communication with the MCP HTTP server for VSOM-specific operations
 * Follows patterns from workbench ApiService.js
 */

export default class VSOMApiService {
    constructor(baseUrl = '/api') {
        this.baseUrl = baseUrl;
        this.sessionId = null;
        
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
        
        const config = {
            headers: { ...headers, ...options.headers },
            ...options
        };
        
        try {
            const response = await fetch(url, config);
            
            // Extract and store session ID from response
            const responseSessionId = response.headers.get('mcp-session-id');
            if (responseSessionId && responseSessionId !== this.sessionId) {
                console.log(`🔗 [VSOM] Session ID updated: ${this.sessionId} → ${responseSessionId}`);
                this.sessionId = responseSessionId;
            }
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
            }
            
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                return await response.json();
            }
            
            return await response.text();
        } catch (error) {
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
     * Get current ZPT navigation state
     */
    async getZPTState() {
        return this.makeRequest('/state', {
            method: 'GET'
        });
    }
    
    /**
     * Get current session data including interactions
     */
    async getSessionData() {
        return this.makeRequest('/inspect', {
            method: 'POST',
            body: JSON.stringify({ what: 'session', details: true })
        });
    }
    
    /**
     * Get concepts data
     */
    async getConceptsData() {
        return this.makeRequest('/inspect', {
            method: 'POST',
            body: JSON.stringify({ what: 'concepts', details: true })
        });
    }
    
    /**
     * Get all system data
     */
    async getAllData() {
        return this.makeRequest('/inspect', {
            method: 'POST',
            body: JSON.stringify({ what: 'all', details: true })
        });
    }
    
    /**
     * Set zoom level
     */
    async setZoom(level, query) {
        return this.makeRequest('/zoom', {
            method: 'POST',
            body: JSON.stringify({ level, query })
        });
    }
    
    /**
     * Set pan filters
     */
    async setPan(panParams, query) {
        const panData = {};
        if (panParams.domains) {
            panData.domains = Array.isArray(panParams.domains) ? 
                panParams.domains : 
                panParams.domains.split(',').map(s => s.trim()).filter(s => s);
        }
        if (panParams.keywords) {
            panData.keywords = Array.isArray(panParams.keywords) ? 
                panParams.keywords : 
                panParams.keywords.split(',').map(s => s.trim()).filter(s => s);
        }
        if (query) panData.query = query;
        
        return this.makeRequest('/pan', {
            method: 'POST',
            body: JSON.stringify(panData)
        });
    }
    
    /**
     * Set tilt style
     */
    async setTilt(style, query) {
        return this.makeRequest('/tilt', {
            method: 'POST',
            body: JSON.stringify({ style, query })
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
                what: 'session', 
                details: true,
                vsomConfig: config
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
    async trainVSOM(instanceId, options = {}) {
        // This would trigger actual VSOM training
        // For now, return mock training result
        return {
            success: true,
            instanceId,
            epochs: options.epochs || 100,
            finalError: Math.random() * 0.1,
            duration: Math.random() * 5000 + 1000,
            status: 'completed'
        };
    }
    
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
     * Perform VSOM clustering
     */
    async performVSOMClustering(instanceId, options = {}) {
        return {
            success: true,
            clusters: this.generateMockClusters(),
            statistics: {
                totalClusters: 3,
                averageClusterSize: 5,
                largestCluster: 8,
                smallestCluster: 2
            }
        };
    }
    
    /**
     * Navigate using ZPT parameters
     */
    async zptNavigate({ query, zoom = 'entity', pan = {}, tilt = 'keywords' }) {
        return this.makeRequest('/zpt/navigate', {
            method: 'POST',
            body: JSON.stringify({
                query,
                zoom,
                pan,
                tilt
            })
        });
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
     * Generate mock clusters for testing
     * @private
     */
    generateMockClusters() {
        return [
            {
                id: 'cluster1',
                centroid: [2, 3],
                entities: ['entity1', 'entity2', 'entity3'],
                size: 3,
                strength: 0.8
            },
            {
                id: 'cluster2',
                centroid: [6, 7],
                entities: ['entity4', 'entity5'],
                size: 2,
                strength: 0.6
            },
            {
                id: 'cluster3',
                centroid: [8, 2],
                entities: ['entity6', 'entity7', 'entity8', 'entity9'],
                size: 4,
                strength: 0.9
            }
        ];
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