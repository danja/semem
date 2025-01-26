import BaseAPI from '../common/BaseAPI.js'
import APIRegistry from '../common/APIRegistry.js'
import { logger } from '../../Utils.js'

export default class PassiveHandler extends BaseAPI {
    constructor(config = {}) {
        super(config)
        this.registry = new APIRegistry()
        this.llmProvider = config.llmProvider
        this.sparqlEndpoint = config.sparqlEndpoint
    }

    async executeOperation(operation, params) {
        switch (operation) {
            case 'chat':
                return this.handleChat(params)
            case 'query':
                return this.handleQuery(params)
            case 'store':
                return this.handleStore(params)
            default:
                throw new Error(`Unknown operation: ${operation}`)
        }
    }

    async handleChat({ prompt, model = 'qwen2:1.5b', options = {} }) {
        try {
            const response = await this.llmProvider.generateChat(model, [{
                role: 'user',
                content: prompt
            }], options)

            this._emitMetric('chat.requests', 1)
            return response
        } catch (error) {
            this._emitMetric('chat.errors', 1)
            throw error
        }
    }

    async handleQuery({ sparql, format = 'json' }) {
        try {
            const storage = this.registry.get('storage')
            const results = await storage.executeOperation('query', {
                sparql,
                format
            })

            this._emitMetric('query.requests', 1)
            return results
        } catch (error) {
            this._emitMetric('query.errors', 1)
            throw error
        }
    }

    async handleStore({ content, format = 'text' }) {
        try {
            const storage = this.registry.get('storage')
            await storage.storeInteraction({
                content,
                format,
                timestamp: Date.now()
            })

            this._emitMetric('store.requests', 1)
            return { success: true }
        } catch (error) {
            this._emitMetric('store.errors', 1)
            throw error
        }
    }

    async getMetrics() {
        const baseMetrics = await super.getMetrics()
        return {
            ...baseMetrics,
            operations: {
                chat: await this._getOperationMetrics('chat'),
                query: await this._getOperationMetrics('query'),
                store: await this._getOperationMetrics('store')
            }
        }
    }

    async _getOperationMetrics(operation) {
        return {
            requests: await this._getMetricValue(`${operation}.requests`),
            errors: await this._getMetricValue(`${operation}.errors`),
            latency: await this._getMetricValue(`${operation}.latency`)
        }
    }
}
