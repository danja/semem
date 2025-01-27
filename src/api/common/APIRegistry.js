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
        this.metrics = new Map()
    }

    /**
     * Register a new API implementation
     */
    async register(name, apiClass, config = {}) {
        // Validate registration
        if (this.apis.has(name)) {
            throw new Error(`API ${name} already registered`)
        }

        if (!(apiClass.prototype instanceof BaseAPI)) {
            throw new Error('API must extend BaseAPI')
        }

        // Create instance but don't store until fully initialized
        const api = new apiClass(config)
        try {
            await api.initialize()
            this.apis.set(name, api)

            // Set up metrics after successful initialization
            api.on('metric', (metric) => {
                this.metrics.set(`${name}.${metric.name}`, {
                    value: metric.value,
                    timestamp: metric.timestamp
                })
            })

            return api
        } catch (error) {
            // Clean up on initialization failure
            api.removeAllListeners()
            throw error // Preserve original error
        }
    }

    /**
     * Get an API instance by name
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
     */
    async unregister(name) {
        const api = this.apis.get(name)
        if (api) {
            try {
                await api.shutdown()
            } finally {
                api.removeAllListeners()
                this.apis.delete(name)
                // Clean up metrics
                for (const key of this.metrics.keys()) {
                    if (key.startsWith(`${name}.`)) {
                        this.metrics.delete(key)
                    }
                }
            }
        }
    }

    /**
     * Get all registered API instances
     */
    getAll() {
        return new Map(this.apis)
    }

    /**
     * Get collected metrics
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
        const shutdowns = Array.from(this.apis.keys()).map(name =>
            this.unregister(name).catch(error => {
                logger.error(`Error shutting down ${name}:`, error)
            })
        )
        await Promise.all(shutdowns)
    }
}