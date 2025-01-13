import log from 'loglevel';
import { EventEmitter } from 'events';

/**
 * Abstract base class for all Semem API implementations
 * @abstract
 */
export default class BaseAPI extends EventEmitter {
    constructor(config = {}) {
        super();
        this.config = config;
        this.logger = log.getLogger(this.constructor.name);
        this.initialized = false;
    }

    /**
     * Initialize the API instance
     * @abstract
     */
    async initialize() {
        if (this.initialized) {
            throw new Error('API already initialized');
        }
        this.initialized = true;
    }

    /**
     * Shutdown the API instance
     * @abstract
     */
    async shutdown() {
        if (!this.initialized) {
            throw new Error('API not initialized');
        }
        this.initialized = false;
    }

    /**
     * Execute a memory operation
     * @abstract
     * @param {string} operation - Operation name
     * @param {Object} params - Operation parameters
     */
    async executeOperation(operation, params) {
        throw new Error('executeOperation must be implemented');
    }

    /**
     * Store an interaction
     * @abstract
     * @param {Object} interaction - Interaction data
     */
    async storeInteraction(interaction) {
        throw new Error('storeInteraction must be implemented');
    }

    /**
     * Retrieve interactions
     * @abstract
     * @param {Object} query - Query parameters
     */
    async retrieveInteractions(query) {
        throw new Error('retrieveInteractions must be implemented');
    }

    /**
     * Get system metrics
     * @returns {Object} System metrics
     */
    async getMetrics() {
        return {
            timestamp: Date.now(),
            status: this.initialized ? 'active' : 'inactive',
            memoryUsage: process.memoryUsage(),
            uptime: process.uptime()
        };
    }

    /**
     * Validate operation parameters
     * @protected
     */
    _validateParams(params, schema) {
        // Basic validation - extend as needed
        if (!params || typeof params !== 'object') {
            throw new Error('Invalid parameters');
        }
    }
    
    /**
     * Emit a metric event
     * @protected
     */
    _emitMetric(name, value) {
        this.emit('metric', { name, value, timestamp: Date.now() });
    }
}