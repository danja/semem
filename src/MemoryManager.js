import { v4 as uuidv4 } from 'uuid'
import logger from 'loglevel'
import MemoryStore from './stores/MemoryStore.js'
import InMemoryStore from './stores/InMemoryStore.js'
import ContextManager from './ContextManager.js'
import EmbeddingHandler from './handlers/EmbeddingHandler.js'
import CacheManager from './handlers/CacheManager.js'
import LLMHandler from './handlers/LLMHandler.js'

/**
 * Manages semantic memory operations, embeddings, and LLM interactions
 */
export default class MemoryManager {
    constructor({
        llmProvider,
        chatModel = 'qwen2:1.5b',
        embeddingModel = 'nomic-embed-text',
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

        // Normalize model names
        this.chatModel = String(chatModel)
        this.embeddingModel = String(embeddingModel)

        // Initialize components
        this.cacheManager = new CacheManager(cacheOptions)
        this.embeddingHandler = new EmbeddingHandler(
            llmProvider,
            this.embeddingModel,
            dimension,
            this.cacheManager
        )

        this.llmHandler = new LLMHandler(llmProvider, this.chatModel)
        this.memStore = new MemoryStore(dimension)
        this.storage = storage || new InMemoryStore()
        this.contextManager = new ContextManager(contextOptions)

        this.initialize()
    }

    async initialize() {
        try {
            const [shortTerm, longTerm] = await this.storage.loadHistory()
            logger.info(`Loading memory history: ${shortTerm.length} short-term, ${longTerm.length} long-term items`)

            for (const interaction of shortTerm) {
                const embedding = this.embeddingHandler.standardizeEmbedding(interaction.embedding)
                interaction.embedding = embedding
                this.memStore.shortTermMemory.push(interaction)
                this.memStore.embeddings.push(embedding)
                this.memStore.timestamps.push(interaction.timestamp)
                this.memStore.accessCounts.push(interaction.accessCount)
                this.memStore.conceptsList.push(interaction.concepts)
            }

            this.memStore.longTermMemory.push(...longTerm)
            this.memStore.clusterInteractions()
            logger.info('Memory initialization complete')
        } catch (error) {
            logger.error('Memory initialization failed:', error)
            throw error
        }
    }

    async addInteraction(prompt, output, embedding, concepts) {
        try {
            const interaction = {
                id: uuidv4(),
                prompt,
                output,
                embedding: this.embeddingHandler.standardizeEmbedding(embedding),
                timestamp: Date.now(),
                accessCount: 1,
                concepts,
                decayFactor: 1.0
            }

            this.memStore.shortTermMemory.push(interaction)
            this.memStore.embeddings.push(interaction.embedding)
            this.memStore.timestamps.push(interaction.timestamp)
            this.memStore.accessCounts.push(interaction.accessCount)
            this.memStore.conceptsList.push(interaction.concepts)

            await this.storage.saveMemoryToHistory(this.memStore)
            logger.info('Interaction added successfully')
        } catch (error) {
            logger.error('Failed to add interaction:', error)
            throw error
        }
    }

    async retrieveRelevantInteractions(query, similarityThreshold = 40, excludeLastN = 0) {
        try {
            const queryEmbedding = await this.embeddingHandler.generateEmbedding(query)
            const queryConcepts = await this.llmHandler.extractConcepts(query)
            return this.memStore.retrieve(queryEmbedding, queryConcepts, similarityThreshold, excludeLastN)
        } catch (error) {
            logger.error('Failed to retrieve interactions:', error)
            throw error
        }
    }

    async generateResponse(prompt, lastInteractions = [], retrievals = [], contextWindow = 3) {
        try {
            const context = this.contextManager.buildContext(
                prompt,
                retrievals,
                lastInteractions,
                { systemContext: "You're a helpful assistant with memory of past interactions." }
            )

            return await this.llmHandler.generateResponse(prompt, context)
        } catch (error) {
            logger.error('Error generating response:', error)
            throw error
        }
    }

    async generateEmbedding(text) {
        return await this.embeddingHandler.generateEmbedding(text)
    }

    async extractConcepts(text) {
        return await this.llmHandler.extractConcepts(text)
    }

    async dispose() {
        let error = null
        try {
            // Save current state before disposal
            await this.storage.saveMemoryToHistory(this.memStore)
        } catch (e) {
            error = e
        }

        try {
            // Clean up resources
            this.cacheManager.dispose()
            if (this.storage?.close) {
                await this.storage.close()
            }
        } catch (e) {
            if (!error) error = e
        }

        // Clear references
        this.memStore = null

        // If there were any errors, throw after cleanup
        if (error) throw error
    }
}