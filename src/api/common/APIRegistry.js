import logger from 'loglevel'
import BaseAPI from './BaseAPI.js'

/**
 * Registry for managing API instances
 * @singleton
 */
export default class APIRegistry {
    constructor() {
        if (APIRegistry.instance) {
            return APIRegistry.instance
        }
        APIRegistry.instance = this

        this.apis = new Map()
        this.logger = logger.getLogger('APIRegistry')
        this.metrics = new Map()
    }

    /**
     * Register a new API implementation
     * @param {string} name - Unique identifier for the API
     * @param {typeof BaseAPI} apiClass - API implementation class
     * @param {Object} config - Configuration for the API
     */
    async register(name, apiClass, config = {}) {
        logger.log(`APIRegistry.register,
        name = ${name}
        apiClass = ${apiClass}
        config = ${config}`)

        if (this.apis.has(name)) {
            throw new Error(`API ${name} already registered`)
        }

        if (!(apiClass.prototype instanceof BaseAPI)) {
            throw new Error('API must extend BaseAPI')
        }

        try {
            const api = new apiClass(config)
            await api.initialize()

            // Set up metric collection
            api.on('metric', (metric) => {
                this.metrics.set(`${name}.${metric.name}`, {
                    value: metric.value,
                    timestamp: metric.timestamp
                })
            })

            this.apis.set(name, api)
            this.logger.info(`Registered API: ${name}`)

            return api
        } catch (error) {
            this.logger.error(`Failed to register API ${name}:`, error)
            throw error
        }
    }

    /**
     * Get an API instance by name
     * @param {string} name - API identifier
     * @returns {BaseAPI} API instance
     */
    get(name) {
        const api = this.apis.get(name)
        if (!api) {
            throw new Error(`API ${name} not found`)
        }
        return api
    }

    /**
     * Remove an API instance
     * @param {string} name - API identifier
     */
    async unregister(name) {
        const api = this.apis.get(name)
        if (api) {
            await api.shutdown()
            this.apis.delete(name)
            this.logger.info(`Unregistered API: ${name}`)
        }
    }

    /**
     * Get all registered API instances
     * @returns {Map<string, BaseAPI>}
     */
    getAll() {
        return new Map(this.apis)
    }

    /**
     * Get collected metrics
     * @returns {Object} Metrics data
     */
    getMetrics() {
        return {
            timestamp: Date.now(),
            apiCount: this.apis.size,
            apis: Object.fromEntries(
                Array.from(this.apis.entries()).map(([name, api]) => [
                    name,
                    {
                        status: api.initialized ? 'active' : 'inactive',
                        metrics: Object.fromEntries(
                            Array.from(this.metrics.entries())
                                .filter(([key]) => key.startsWith(name))
                                .map(([key, value]) => [
                                    key.split('.')[1],
                                    value
                                ])
                        )
                    }
                ])
            )
        }
    }

    /**
     * Shutdown all registered APIs
     */
    async shutdownAll() {
        const shutdowns = Array.from(this.apis.entries()).map(
            async ([name, api]) => {
                try {
                    await this.unregister(name)
                } catch (error) {
                    this.logger.error(`Error shutting down ${name}:`, error)
                }
            }
        )
        await Promise.all(shutdowns)
    }
}