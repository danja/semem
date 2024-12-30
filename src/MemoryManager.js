import { v4 as uuidv4 } from 'uuid';
import MemoryStore from './stores/MemoryStore.js';
import InMemoryStore from './stores/InMemoryStore.js';
import ContextManager from './ContextManager.js';
import PromptTemplates from './PromptTemplates.js';
import { logger } from './Utils.js';

export default class MemoryManager {
    constructor({
        llmProvider,
        chatModel = 'llama2',
        embeddingModel = 'nomic-embed-text',
        storage = null,
        dimension = 1536,
        contextOptions = {
            maxTokens: embeddingModel === 'nomic-embed-text' ? 8192 : 4096
        },
        cacheOptions = {
            maxSize: 1000,
            ttl: 3600000 // 1 hour in milliseconds
        }
    }) {
        if (!llmProvider) {
            throw new Error('LLM provider is required');
        }

        this.llmProvider = llmProvider;
        this.chatModel = chatModel;
        this.embeddingModel = embeddingModel;
        this.dimension = dimension;
        this.cacheOptions = cacheOptions;

        // Initialize embedding cache
        this.embeddingCache = new Map();
        this.cacheTimestamps = new Map();

        try {
            this.memoryStore = new MemoryStore(this.dimension);
            this.storage = storage || new InMemoryStore();
            this.contextManager = new ContextManager(contextOptions);
        } catch (error) {
            logger.error('Failed to initialize MemoryManager:', error);
            throw new Error('Memory manager initialization failed: ' + error.message);
        }

        this.initialize();

        // Set up cache cleanup interval
        this.cleanupInterval = setInterval(() => {
            this.cleanupCache();
        }, cacheOptions.ttl / 2);
    }

    async initialize() {
        try {
            const [shortTerm, longTerm] = await this.storage.loadHistory();

            for (const interaction of shortTerm) {
                const embedding = this.standardizeEmbedding(interaction.embedding);
                interaction.embedding = embedding;
                this.memoryStore.addInteraction(interaction);
            }

            this.memoryStore.longTermMemory.push(...longTerm);
            this.memoryStore.clusterInteractions();

            logger.info(`Memory initialized with ${shortTerm.length} short-term and ${longTerm.length} long-term memories`);
        } catch (error) {
            logger.error('Memory initialization failed:', error);
            throw error;
        }
    }

    cleanupCache() {
        const now = Date.now();
        for (const [key, timestamp] of this.cacheTimestamps.entries()) {
            if (now - timestamp > this.cacheOptions.ttl) {
                this.embeddingCache.delete(key);
                this.cacheTimestamps.delete(key);
            }
        }

        // If still over max size, remove oldest entries
        while (this.embeddingCache.size > this.cacheOptions.maxSize) {
            let oldestKey = null;
            let oldestTime = Infinity;

            for (const [key, timestamp] of this.cacheTimestamps.entries()) {
                if (timestamp < oldestTime) {
                    oldestTime = timestamp;
                    oldestKey = key;
                }
            }

            if (oldestKey) {
                this.embeddingCache.delete(oldestKey);
                this.cacheTimestamps.delete(oldestKey);
            }
        }
    }

    getCacheKey(text) {
        // Simple cache key generation - could be made more sophisticated
        return `${this.embeddingModel}:${text.slice(0, 100)}`;
    }

    async generateEmbedding(text) {
        const cacheKey = this.getCacheKey(text);

        // Check cache first
        if (this.embeddingCache.has(cacheKey)) {
            const cached = this.embeddingCache.get(cacheKey);
            // Update timestamp on cache hit
            this.cacheTimestamps.set(cacheKey, Date.now());
            return cached;
        }

        try {
            const embedding = await this.llmProvider.generateEmbedding(
                this.embeddingModel,
                text
            );

            // Cache the result
            this.embeddingCache.set(cacheKey, embedding);
            this.cacheTimestamps.set(cacheKey, Date.now());

            // Cleanup if needed
            if (this.embeddingCache.size > this.cacheOptions.maxSize) {
                this.cleanupCache();
            }

            return embedding;
        } catch (error) {
            logger.error('Error generating embedding:', error);
            throw error;
        }
    }

    validateEmbedding(embedding) {
        if (!Array.isArray(embedding)) {
            throw new TypeError('Embedding must be an array');
        }
        if (!embedding.every(x => typeof x === 'number' && !isNaN(x))) {
            throw new TypeError('Embedding must contain only valid numbers');
        }
    }

    standardizeEmbedding(embedding) {
        this.validateEmbedding(embedding);
        const current = embedding.length;
        if (current === this.dimension) return embedding;

        if (current < this.dimension) {
            return [...embedding, ...new Array(this.dimension - current).fill(0)];
        }
        return embedding.slice(0, this.dimension);
    }

    async addInteraction(prompt, output, embedding, concepts) {
        try {
            this.validateEmbedding(embedding);
            const standardizedEmbedding = this.standardizeEmbedding(embedding);

            const interaction = {
                id: uuidv4(),
                prompt,
                output,
                embedding: standardizedEmbedding,
                timestamp: Date.now(),
                accessCount: 1,
                concepts,
                decayFactor: 1.0
            };

            this.memoryStore.addInteraction(interaction);
            await this.storage.saveMemoryToHistory(this.memoryStore);
        } catch (error) {
            logger.error('Failed to add interaction:', error);
            throw error;
        }
    }

    async retrieveRelevantInteractions(query, similarityThreshold = 40, excludeLastN = 0) {
        try {
            const queryEmbedding = await this.generateEmbedding(query);
            const queryConcepts = await this.extractConcepts(query);
            return this.memoryStore.retrieve(queryEmbedding, queryConcepts, similarityThreshold, excludeLastN);
        } catch (error) {
            logger.error('Failed to retrieve relevant interactions:', error);
            throw error;
        }
    }

    async extractConcepts(text) {
        logger.info('Extracting concepts...');
        try {
            const prompt = PromptTemplates.formatConceptPrompt(this.chatModel, text);
            const response = await this.llmProvider.generateCompletion(
                this.chatModel,
                prompt,
                { temperature: 0.2 }
            );

            const match = response.match(/\[.*\]/);
            if (match) {
                const concepts = JSON.parse(match[0]);
                logger.info('Extracted concepts:', concepts);
                return concepts;
            }

            logger.info('No concepts extracted, returning empty array');
            return [];
        } catch (error) {
            logger.error('Error extracting concepts:', error);
            return [];
        }
    }

    async generateResponse(prompt, lastInteractions = [], retrievals = [], contextWindow = 3) {
        const context = this.contextManager.buildContext(
            prompt,
            retrievals,
            lastInteractions,
            { systemContext: "You're a helpful assistant with memory of past interactions." }
        );

        try {
            const messages = PromptTemplates.formatChatPrompt(
                this.chatModel,
                "You're a helpful assistant with memory of past interactions.",
                context,
                prompt
            );

            const response = await this.llmProvider.generateChat(
                this.chatModel,
                messages,
                { temperature: 0.7 }
            );

            return response.trim();
        } catch (error) {
            logger.error('Error generating response:', error);
            throw error;
        }
    }

    // Cleanup resources when no longer needed
    async dispose() {
        logger.info('Starting MemoryManager shutdown...');

        // Clear intervals
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }

        // Save final state
        try {
            await this.storage.saveMemoryToHistory(this.memoryStore);
            logger.info('Final memory state saved');
        } catch (error) {
            logger.error('Error saving final memory state:', error);
        }

        // Clear caches
        this.embeddingCache.clear();
        this.cacheTimestamps.clear();

        // Close storage connections
        if (this.storage && typeof this.storage.close === 'function') {
            await this.storage.close();
        }

        // Clear memory references
        this.memoryStore = null;
        this.llmProvider = null;

        logger.info('MemoryManager shutdown complete');
    }
}