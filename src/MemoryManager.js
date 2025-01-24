import logger from 'loglevel'
import { v4 as uuidv4 } from 'uuid'
import MemoryStore from './stores/MemoryStore.js'
import InMemoryStore from './stores/InMemoryStore.js'
import ContextManager from './ContextManager.js'
import PromptTemplates from './PromptTemplates.js'
import log from 'loglevel'

export default class MemoryManager {
    constructor({
        llmProvider,
        chatModel = 'claude-3-opus-20240229',
        embeddingModel = 'claude-3-opus-20240229',
        storage = null,
        dimension = 1536,
        contextOptions = {
            maxTokens: 8192
        },
        cacheOptions = {
            maxSize: 1000,
            ttl: 3600000
        }
    }) {
        if (!llmProvider) {
            throw new Error('LLM provider is required')
        }

        this.llmProvider = llmProvider
        this.chatModel = chatModel
        this.embeddingModel = embeddingModel
        this.dimension = dimension
        this.cacheOptions = cacheOptions
        this.logger = log.getLogger('MemoryManager')
        this.logger.setLevel('debug')

        // Initialize embedding cache
        this.embeddingCache = new Map()
        this.cacheTimestamps = new Map()
        this.memStore = new MemoryStore(this.dimension)
        this.storage = storage || new InMemoryStore()
        this.contextManager = new ContextManager(contextOptions)

        this.initialize()

        // Set up cache cleanup interval
        this.cleanupInterval = setInterval(() => {
            this.cleanupCache()
        }, cacheOptions.ttl / 2)
    }

    async initialize() {
        try {
            const [shortTerm, longTerm] = await this.storage.loadHistory()
            this.logger.info(`Loading memory history: ${shortTerm.length} short-term, ${longTerm.length} long-term items`)

            for (const interaction of shortTerm) {
                const embedding = this.standardizeEmbedding(interaction.embedding)
                interaction.embedding = embedding
                this.memStore.shortTermMemory.push(interaction)
                this.memStore.embeddings.push(embedding)
                this.memStore.timestamps.push(interaction.timestamp)
                this.memStore.accessCounts.push(interaction.accessCount)
                this.memStore.conceptsList.push(interaction.concepts)
            }

            this.memStore.longTermMemory.push(...longTerm)
            this.memStore.clusterInteractions()

            this.logger.info('Memory initialization complete')
        } catch (error) {
            this.logger.error('Memory initialization failed:', error)
            throw error
        }
    }

    cleanupCache() {
        const now = Date.now()
        let removed = 0

        for (const [key, timestamp] of this.cacheTimestamps.entries()) {
            if (now - timestamp > this.cacheOptions.ttl) {
                this.embeddingCache.delete(key)
                this.cacheTimestamps.delete(key)
                removed++
            }
        }

        if (removed > 0) {
            this.logger.debug(`Cache cleanup: removed ${removed} expired entries`)
        }

        while (this.embeddingCache.size > this.cacheOptions.maxSize) {
            let oldestKey = null
            let oldestTime = Infinity

            for (const [key, timestamp] of this.cacheTimestamps.entries()) {
                if (timestamp < oldestTime) {
                    oldestTime = timestamp
                    oldestKey = key
                }
            }

            if (oldestKey) {
                this.embeddingCache.delete(oldestKey)
                this.cacheTimestamps.delete(oldestKey)
                this.logger.debug('Cache cleanup: removed oldest entry to maintain size limit')
            }
        }
    }

    getCacheKey(text) {
        return `${this.embeddingModel}:${text.slice(0, 100)}`
    }

    async generateEmbedding(text) {
        const cacheKey = this.getCacheKey(text)
        this.logger.debug(`Generating embedding for text: ${text.slice(0, 50)}...`)

        if (this.embeddingCache.has(cacheKey)) {
            this.logger.debug('Using cached embedding')
            const cached = this.embeddingCache.get(cacheKey)
            this.cacheTimestamps.set(cacheKey, Date.now())
            return cached
        }

        try {
            const embedding = await this.llmProvider.generateEmbedding(
                this.embeddingModel,
                text
            )

            this.embeddingCache.set(cacheKey, embedding)
            this.cacheTimestamps.set(cacheKey, Date.now())

            if (this.embeddingCache.size > this.cacheOptions.maxSize) {
                this.cleanupCache()
            }

            return embedding
        } catch (error) {
            this.logger.error('Error generating embedding:', error)
            throw error
        }
    }

    validateEmbedding(embedding) {
        if (!Array.isArray(embedding)) {
            throw new TypeError('Embedding must be an array')
        }
        if (!embedding.every(x => typeof x === 'number' && !isNaN(x))) {
            throw new TypeError('Embedding must contain only valid numbers')
        }
    }

    standardizeEmbedding(embedding) {
        this.validateEmbedding(embedding)
        const current = embedding.length
        if (current === this.dimension) return embedding

        if (current < this.dimension) {
            return [...embedding, ...new Array(this.dimension - current).fill(0)]
        }
        return embedding.slice(0, this.dimension)
    }

    async addInteraction(prompt, output, embedding, concepts) {
        this.logger.debug(`Adding interaction: ${prompt.slice(0, 50)}...`)

        try {
            this.validateEmbedding(embedding)
            const standardizedEmbedding = this.standardizeEmbedding(embedding)

            const interaction = {
                id: uuidv4(),
                prompt,
                output,
                embedding: standardizedEmbedding,
                timestamp: Date.now(),
                accessCount: 1,
                concepts,
                decayFactor: 1.0
            }

            this.memStore.shortTermMemory.push(interaction)
            this.memStore.embeddings.push(standardizedEmbedding)
            this.memStore.timestamps.push(interaction.timestamp)
            this.memStore.accessCounts.push(interaction.accessCount)
            this.memStore.conceptsList.push(interaction.concepts)

            await this.storage.saveMemoryToHistory(this.memStore)
            this.logger.info('Interaction added successfully')

        } catch (error) {
            this.logger.error('Failed to add interaction:', error)
            throw error
        }
    }

    async retrieveRelevantInteractions(query, similarityThreshold = 40, excludeLastN = 0) {
        this.logger.debug(`Retrieving relevant interactions for: ${query.slice(0, 50)}...`)

        try {
            const queryEmbedding = await this.generateEmbedding(query)
            const queryConcepts = await this.extractConcepts(query)
            return this.memStore.retrieve(queryEmbedding, queryConcepts, similarityThreshold, excludeLastN)
        } catch (error) {
            this.logger.error('Failed to retrieve relevant interactions:', error)
            throw error
        }
    }

    async extractConcepts(text) {
        logger.setLevel('debug')
        this.logger.log('Extracting concepts...')
        try {
            logger.log(`Extracting concepts from ${text}`)
            this.chatModel = await Promise.resolve(this.chatModel)
            logger.log(`this.chatModel =  ${this.chatModel}`)
            const prompt = PromptTemplates.formatConceptPrompt(this.chatModel, text)
            const response = await this.llmProvider.generateCompletion(
                this.chatModel,
                prompt,
                { temperature: 0.2 }
            )

            const match = response.match(/\[.*\]/)
            if (match) {
                const concepts = JSON.parse(match[0])
                this.logger.info('Extracted concepts:', concepts)
                return concepts
            }

            this.logger.info('No concepts extracted, returning empty array')
            return []
        } catch (error) {
            this.logger.error('Error extracting concepts:', error)
            return []
        }
    }

    async generateResponse(prompt, lastInteractions = [], retrievals = [], contextWindow = 3) {
        this.logger.debug(`Generating response for: ${prompt.slice(0, 50)}...`)

        const context = this.contextManager.buildContext(
            prompt,
            retrievals,
            lastInteractions,
            { systemContext: "You're a helpful assistant with memory of past interactions." }
        )

        try {
            const messages = PromptTemplates.formatChatPrompt(
                this.chatModel,
                "You're a helpful assistant with memory of past interactions.",
                context,
                prompt
            )

            const response = await this.llmProvider.generateChat(
                this.chatModel,
                messages,
                { temperature: 0.7 }
            )

            return response.trim()
        } catch (error) {
            this.logger.error('Error generating response:', error)
            throw error
        }
    }

    async dispose() {
        this.logger.info('Starting MemoryManager shutdown...')

        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval)
        }

        try {
            await this.storage.saveMemoryToHistory(this.memStore)
            this.logger.info('Final memory state saved')
        } catch (error) {
            this.logger.error('Error saving final memory state:', error)
        }

        this.embeddingCache.clear()
        this.cacheTimestamps.clear()

        if (this.storage && typeof this.storage.close === 'function') {
            await this.storage.close()
        }

        this.memStore = null
        this.llmProvider = null

        this.logger.info('MemoryManager shutdown complete')
    }
}