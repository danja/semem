/**
 * API Service for 7 Simple Verbs Operations
 * Handles all communication with the Semem MCP HTTP server
 */

export class ApiService {
    constructor(baseURL = window.location.origin) {
        this.baseURL = baseURL;
        this.timeout = 30000; // 30 seconds default timeout
    }

    /**
     * Make HTTP request with performance tracking
     * @param {string} endpoint - API endpoint
     * @param {object} options - Fetch options
     * @returns {Promise<object>} - Response data with performance metrics
     */
    async request(endpoint, options = {}) {
        const startTime = Date.now();
        
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), this.timeout);

            const response = await fetch(`${this.baseURL}${endpoint}`, {
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                },
                signal: controller.signal,
                ...options
            });

            clearTimeout(timeoutId);
            const duration = Date.now() - startTime;
            
            let data;
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                data = await response.json();
            } else {
                data = { message: await response.text() };
            }

            if (!response.ok) {
                const error = new Error(data.message || `HTTP ${response.status}: ${response.statusText}`);
                error.status = response.status;
                error._performance = { duration, timestamp: Date.now() };
                throw error;
            }

            // Add performance tracking
            data._performance = { duration, timestamp: Date.now() };
            
            return data;
        } catch (error) {
            const duration = Date.now() - startTime;
            
            if (error.name === 'AbortError') {
                error.message = `Request timeout after ${this.timeout}ms`;
            }
            
            error._performance = { duration, timestamp: Date.now() };
            throw error;
        }
    }

    /**
     * Set request timeout
     * @param {number} timeout - Timeout in milliseconds
     */
    setTimeout(timeout) {
        this.timeout = timeout;
    }

    /**
     * Tell operation - store content in semantic memory
     * @param {string} content - Content to store
     * @param {string} type - Content type (concept, interaction, document)
     * @param {object} metadata - Optional metadata
     * @returns {Promise<object>} - Operation result
     */
    async tell(content, type = 'concept', metadata = {}) {
        return this.request('/tell', {
            method: 'POST',
            body: JSON.stringify({ content, type, metadata })
        });
    }

    /**
     * Ask operation - query semantic memory
     * @param {string} question - Question to ask
     * @param {object} options - Query options
     * @returns {Promise<object>} - Query result with answer and context
     */
    async ask(question, options = {}) {
        return this.request('/ask', {
            method: 'POST',
            body: JSON.stringify({ question, ...options })
        });
    }

    /**
     * Augment operation - extract concepts or analyze text
     * @param {string} target - Text to analyze
     * @param {string} operation - Operation type (extract_concepts, analyze_text, generate_embedding)
     * @param {object} parameters - Optional operation parameters
     * @returns {Promise<object>} - Analysis result
     */
    async augment(target, operation = 'extract_concepts', parameters = {}) {
        return this.request('/augment', {
            method: 'POST',
            body: JSON.stringify({ target, operation, parameters })
        });
    }

    /**
     * Zoom operation - set abstraction level
     * @param {string} level - Zoom level (entity, unit, text, community, corpus, micro)
     * @param {string} query - Optional query for context
     * @returns {Promise<object>} - Zoom result
     */
    async zoom(level, query = '') {
        return this.request('/zoom', {
            method: 'POST',
            body: JSON.stringify({ level, query })
        });
    }

    /**
     * Pan operation - set domain filters
     * @param {Array<string>} domains - Domain filters
     * @param {Array<string>} keywords - Keyword filters  
     * @param {object} temporal - Temporal filtering parameters
     * @param {Array<string>} entities - Entity filters
     * @param {string} query - Optional query for context
     * @returns {Promise<object>} - Pan result
     */
    async pan(domains = [], keywords = [], temporal = {}, entities = [], query = '') {
        return this.request('/pan', {
            method: 'POST',
            body: JSON.stringify({ domains, keywords, temporal, entities, query })
        });
    }

    /**
     * Tilt operation - set view perspective
     * @param {string} style - View style (keywords, embedding, graph, temporal)
     * @param {string} query - Optional query for context
     * @returns {Promise<object>} - Tilt result
     */
    async tilt(style, query = '') {
        return this.request('/tilt', {
            method: 'POST',
            body: JSON.stringify({ style, query })
        });
    }

    /**
     * Get current ZPT state
     * @returns {Promise<object>} - Current navigation state
     */
    async getState() {
        return this.request('/state', { method: 'GET' });
    }

    /**
     * Inspect operation - debug session cache and system state
     * @param {string} what - What to inspect (session, concepts, embeddings, all)
     * @param {boolean} details - Include detailed information
     * @returns {Promise<object>} - Inspection result
     */
    async inspect(what = 'session', details = false) {
        // Note: Using MCP interface since REST endpoint may not be available
        // In production, this would be a proper REST endpoint
        try {
            return this.request('/inspect', {
                method: 'POST',
                body: JSON.stringify({ what, details })
            });
        } catch (error) {
            // Fallback response if endpoint not available
            return {
                success: false,
                verb: 'inspect',
                error: 'Inspect endpoint not available via REST API',
                message: 'Use MCP interface for inspect functionality',
                fallback: true
            };
        }
    }

    /**
     * Health check - verify server connectivity
     * @returns {Promise<object>} - Health status
     */
    async health() {
        try {
            return this.request('/health', { method: 'GET' });
        } catch (error) {
            return {
                success: false,
                status: 'unhealthy',
                error: error.message,
                timestamp: Date.now()
            };
        }
    }

    /**
     * Get server information
     * @returns {Promise<object>} - Server info
     */
    async getServerInfo() {
        try {
            const response = await this.request('/info', { method: 'GET' });
            return response;
        } catch (error) {
            return {
                success: false,
                error: error.message,
                fallback: {
                    name: 'Semem MCP Server',
                    version: 'unknown',
                    capabilities: ['tell', 'ask', 'augment', 'zoom', 'pan', 'tilt', 'state']
                }
            };
        }
    }

    /**
     * Batch operations - execute multiple operations in sequence
     * @param {Array<object>} operations - Array of operations
     * @returns {Promise<Array>} - Results of all operations
     */
    async batch(operations) {
        const results = [];
        const startTime = Date.now();

        for (const operation of operations) {
            try {
                let result;
                const { verb, ...params } = operation;

                switch (verb) {
                    case 'tell':
                        result = await this.tell(params.content, params.type, params.metadata);
                        break;
                    case 'ask':
                        result = await this.ask(params.question, params.options);
                        break;
                    case 'augment':
                        result = await this.augment(params.target, params.operation, params.parameters);
                        break;
                    case 'zoom':
                        result = await this.zoom(params.level, params.query);
                        break;
                    case 'pan':
                        result = await this.pan(params.domains, params.keywords, params.temporal, params.entities, params.query);
                        break;
                    case 'tilt':
                        result = await this.tilt(params.style, params.query);
                        break;
                    default:
                        throw new Error(`Unknown operation: ${verb}`);
                }

                results.push({ operation, result, success: true });
            } catch (error) {
                results.push({ operation, error: error.message, success: false });
            }
        }

        return {
            success: true,
            results,
            totalDuration: Date.now() - startTime,
            operationCount: operations.length
        };
    }

    /**
     * Test connection to server
     * @returns {Promise<object>} - Connection test result
     */
    async testConnection() {
        const startTime = Date.now();
        
        try {
            const health = await this.health();
            const duration = Date.now() - startTime;
            
            return {
                success: true,
                latency: duration,
                server: health,
                timestamp: Date.now()
            };
        } catch (error) {
            return {
                success: false,
                error: error.message,
                latency: Date.now() - startTime,
                timestamp: Date.now()
            };
        }
    }
}