import BaseAPI from '../common/BaseAPI.js'
import APIRegistry from '../common/APIRegistry.js'
import { logger } from '../../Utils.js'

export default class ActiveHandler extends BaseAPI {
    constructor(config = {}) {
        super(config)
        this.registry = new APIRegistry()
        this.contextWindow = config.contextWindow || 3
        this.similarityThreshold = config.similarityThreshold || 40
    }

    async executeOperation(operation, params) {
        switch (operation) {
            case 'interact':
                return this.handleInteraction(params)
            case 'search':
                return this.handleSearch(params)
            case 'analyze':
                return this.handleAnalysis(params)
            default:
                throw new Error(`Unknown operation: ${operation}`)
        }
    }

    async handleInteraction({ prompt, context = [], options = {} }) {
        try {
            const memoryManager = this.registry.get('memory')
            const passive = this.registry.get('passive')

            // Get relevant past interactions
            const retrievals = await memoryManager.retrieveRelevantInteractions(
                prompt,
                this.similarityThreshold
            )

            // Generate response using chat
            const response = await passive.executeOperation('chat', {
                prompt,
                context: this._buildContext(context, retrievals),
                ...options
            })

            // Store interaction
            const embedding = await memoryManager.generateEmbedding(
                `${prompt} ${response}`
            )
            const concepts = await memoryManager.extractConcepts(
                `${prompt} ${response}`
            )

            await memoryManager.addInteraction(prompt, response, embedding, concepts)

            this._emitMetric('interaction.count', 1)
            return { response, concepts, retrievals }
        } catch (error) {
            this._emitMetric('interaction.errors', 1)
            throw error
        }
    }

    async handleSearch({ query, type = 'semantic', limit = 10 }) {
        try {
            const memoryManager = this.registry.get('memory')
            const passive = this.registry.get('passive')

            let results
            if (type === 'semantic') {
                const embedding = await memoryManager.generateEmbedding(query)
                results = await memoryManager.retrieveRelevantInteractions(
                    query,
                    this.similarityThreshold,
                    0,
                    limit
                )
            } else {
                results = await passive.executeOperation('query', {
                    sparql: this._buildSearchQuery(query, limit)
                })
            }

            this._emitMetric('search.count', 1)
            return results
        } catch (error) {
            this._emitMetric('search.errors', 1)
            throw error
        }
    }

    async handleAnalysis({ content, type = 'concept' }) {
        try {
            const memoryManager = this.registry.get('memory')

            let results
            switch (type) {
                case 'concept':
                    results = await memoryManager.extractConcepts(content)
                    break
                case 'embedding':
                    results = await memoryManager.generateEmbedding(content)
                    break
                default:
                    throw new Error(`Unknown analysis type: ${type}`)
            }

            this._emitMetric('analysis.count', 1)
            return results
        } catch (error) {
            this._emitMetric('analysis.errors', 1)
            throw error
        }
    }

    _buildContext(context, retrievals) {
        return {
            previous: context.slice(-this.contextWindow),
            relevant: retrievals
                .slice(0, this.contextWindow)
                .map(r => ({
                    prompt: r.interaction.prompt,
                    response: r.interaction.output
                }))
        }
    }

    _buildSearchQuery(query, limit) {
        return `
            PREFIX mcp: <http://purl.org/stuff/mcp/>
            SELECT ?interaction ?prompt ?output ?timestamp
            WHERE {
                ?interaction a mcp:Interaction ;
                    mcp:prompt ?prompt ;
                    mcp:output ?output ;
                    mcp:timestamp ?timestamp .
                FILTER(CONTAINS(LCASE(?prompt), LCASE("${query}")) ||
                       CONTAINS(LCASE(?output), LCASE("${query}")))
            }
            ORDER BY DESC(?timestamp)
            LIMIT ${limit}
        `
    }

    async getMetrics() {
        const baseMetrics = await super.getMetrics()
        return {
            ...baseMetrics,
            operations: {
                interaction: await this._getOperationMetrics('interaction'),
                search: await this._getOperationMetrics('search'),
                analysis: await this._getOperationMetrics('analysis')
            }
        }
    }

    async _getOperationMetrics(operation) {
        return {
            count: await this._getMetricValue(`${operation}.count`),
            errors: await this._getMetricValue(`${operation}.errors`),
            latency: await this._getMetricValue(`${operation}.latency`)
        }
    }
}
