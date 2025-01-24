import { v4 as uuidv4 } from 'uuid'
import MemoryStore from './stores/MemoryStore.js'
import InMemoryStore from './stores/InMemoryStore.js'
import ContextManager from './ContextManager.js'
import PromptTemplates from './PromptTemplates.js'
import { logger } from './Utils.js'

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

        // Initialize embedding cache
        this.embeddingCache = new Map()
        this.cacheTimestamps = new Map()

        try {
            this.store = new MemoryStore(this.dimension)
            this.storage = storage || new InMemoryStore()
            this.contextManager = new ContextManager(contextOptions)
        } catch (error) {
            logger.error('Failed to initialize MemoryManager:', error)
            throw new Error('Memory manager initialization failed: ' + error.message)
        }

        this.initialize()

        // Set up cache cleanup interval
        this.cleanupInterval = setInterval(() => {
            this.cleanupCache()
        }, cacheOptions.ttl / 2)
    }

    async initialize() {
        try {
            const [shortTerm, longTerm] = await this.storage.loadHistory()

            for (const interaction of shortTerm) {
                const embedding = this.standardizeEmbedding(interaction.embedding)
                interaction.embedding = embedding
                this.store.addInteraction(interaction)
            }

            this.store.longTermMemory.push(...longTerm)
            this.store.clusterInteractions()

            logger.info(`Memory initialized with ${shortTerm.length} short-term and ${longTerm.length} long-term memories`)
        } catch (error) {
            logger.error('Memory initialization failed:', error)
            throw error
        }
    }

    cleanupCache() {
        const now = Date.now()
        for (const [key, timestamp] of this.cacheTimestamps.entries()) {
            if (now - timestamp > this.cacheOptions.ttl) {
                this.embeddingCache.delete(key)
                this.cacheTimestamps.delete(key)
            }
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
            }
        }
    }

    getCacheKey(text) {
        return `${this.embeddingModel}:${text.slice(0, 100)}`
    }

    async generateEmbedding(text) {
        const cacheKey = this.getCacheKey(text)

        if (this.embeddingCache.has(cacheKey)) {
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
            logger.error('Error generating embedding:', error)
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

            this.store.addInteraction(interaction)
            await this.storage.saveMemoryToHistory(this.store)
        } catch (error) {
            logger.error('Failed to add interaction:', error)
            throw error
        }
    }

    async retrieveRelevantInteractions(query, similarityThreshold = 40, excludeLastN = 0) {
        try {
            const queryEmbedding = await this.generateEmbedding(query)
            const queryConcepts = await this.extractConcepts(query)
            return this.store.retrieve(queryEmbedding, queryConcepts, similarityThreshold, excludeLastN)
        } catch (error) {
            logger.error('Failed to retrieve relevant interactions:', error)
            throw error
        }
    }

    async extractConcepts(text) {
        logger.info('Extracting concepts...')
        try {
            const prompt = PromptTemplates.formatConceptPrompt(this.chatModel, text)
            const response = await this.llmProvider.generateCompletion(
                this.chatModel,
                prompt,
                { temperature: 0.2 }
            )

            const match = response.match(/\[.*\]/)
            if (match) {
                const concepts = JSON.parse(match[0])
                logger.info('Extracted concepts:', concepts)
                return concepts
            }

            logger.info('No concepts extracted, returning empty array')
            return []
        } catch (error) {
            logger.error('Error extracting concepts:', error)
            return []
        }
    }

    async generateResponse(prompt, lastInteractions = [], retrievals = [], contextWindow = 3) {
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
            logger.error('Error generating response:', error)
            throw error
        }
    }

    async dispose() {
        logger.info('Starting MemoryManager shutdown...')

        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval)
        }

        try {
            await this.storage.saveMemoryToHistory(this.store)
            logger.info('Final memory state saved')
        } catch (error) {
            logger.error('Error saving final memory state:', error)
        }

        this.embeddingCache.clear()
        this.cacheTimestamps.clear()

        if (this.storage && typeof this.storage.close === 'function') {
            await this.storage.close()
        }

        this.store = null
        this.llmProvider = null

        logger.info('MemoryManager shutdown complete')
    }
}