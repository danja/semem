import { v4 as uuidv4 } from 'uuid'
import logger from 'loglevel'
import MemoryStore from './stores/MemoryStore.js'
import InMemoryStore from './stores/InMemoryStore.js'
import ContextManager from './ContextManager.js'
import PromptTemplates from './PromptTemplates.js'
import CacheManager from './handlers/CacheManager.js'
import EmbeddingHandler from './handlers/EmbeddingHandler.js'
import { MemoryConfig, Interaction } from './types/MemoryTypes.js'

export default class MemoryManager {
    constructor(config) {
        const memConfig = new MemoryConfig(config)

        if (!memConfig.llmProvider) {
            throw new Error('LLM provider is required')
        }

        this.config = memConfig
        this.cacheManager = new CacheManager(memConfig.cacheOptions)
        this.embeddingHandler = new EmbeddingHandler(
            memConfig.llmProvider,
            memConfig.embeddingModel,
            memConfig.dimension,
            this.cacheManager
        )

        this.memStore = new MemoryStore(memConfig.dimension)
        this.storage = memConfig.storage || new InMemoryStore()
        this.contextManager = new ContextManager(memConfig.contextOptions)

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
        } catch (error) {
            logger.error('Memory initialization failed:', error)
            throw error
        }
    }

    async addInteraction(prompt, output, embedding, concepts) {
        try {
            const interaction = new Interaction({
                id: uuidv4(),
                prompt,
                output,
                embedding: this.embeddingHandler.standardizeEmbedding(embedding),
                concepts,
            })

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
            const queryConcepts = await this.extractConcepts(query)
            return this.memStore.retrieve(queryEmbedding, queryConcepts, similarityThreshold, excludeLastN)
        } catch (error) {
            logger.error('Failed to retrieve interactions:', error)
            throw error
        }
    }

    async extractConcepts(text) {
        try {
            const prompt = PromptTemplates.formatConceptPrompt(this.config.chatModel, text)
            const response = await this.config.llmProvider.generateCompletion(
                this.config.chatModel,
                prompt,
                { temperature: 0.2 }
            )

            const match = response.match(/\[.*\]/)
            return match ? JSON.parse(match[0]) : []
        } catch (error) {
            logger.error('Error extracting concepts:', error)
            return []
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

            const messages = PromptTemplates.formatChatPrompt(
                this.config.chatModel,
                "You're a helpful assistant with memory of past interactions.",
                context,
                prompt
            )

            return await this.config.llmProvider.generateChat(
                this.config.chatModel,
                messages,
                { temperature: 0.7 }
            )
        } catch (error) {
            logger.error('Error generating response:', error)
            throw error
        }
    }

    async dispose() {
        try {
            await this.storage.saveMemoryToHistory(this.memStore)
            this.cacheManager.dispose()

            if (this.storage?.close) {
                await this.storage.close()
            }

            this.memStore = null
            this.config.llmProvider = null
        } catch (error) {
            logger.error('Error during shutdown:', error)
            throw error
        }
    }
}