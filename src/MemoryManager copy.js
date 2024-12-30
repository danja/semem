// src/MemoryManager.js
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
        }
    }) {
        this.llmProvider = llmProvider;
        this.chatModel = chatModel;
        this.embeddingModel = embeddingModel;
        this.dimension = dimension;

        // Initialize components
        this.memoryStore = new MemoryStore(this.dimension);
        this.storage = storage || new InMemoryStore();
        this.contextManager = new ContextManager(contextOptions);

        this.initialize();
    }

    async initialize() {
        const [shortTerm, longTerm] = await this.storage.loadHistory();

        for (const interaction of shortTerm) {
            const embedding = this.standardizeEmbedding(interaction.embedding);
            interaction.embedding = embedding;
            this.memoryStore.addInteraction(interaction);
        }

        this.memoryStore.longTermMemory.push(...longTerm);
        this.memoryStore.clusterInteractions();

        logger.info(`Memory initialized with ${shortTerm.length} short-term and ${longTerm.length} long-term memories`);
    }

    standardizeEmbedding(embedding) {
        const current = embedding.length;
        if (current === this.dimension) return embedding;

        if (current < this.dimension) {
            return [...embedding, ...new Array(this.dimension - current).fill(0)];
        }
        return embedding.slice(0, this.dimension);
    }

    async getEmbedding(text) {
        logger.info('Generating embedding...');
        try {
            const embedding = await this.llmProvider.generateEmbedding(
                this.embeddingModel,
                text
            );
            return this.standardizeEmbedding(embedding);
        } catch (error) {
            logger.error('Error generating embedding:', error);
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

    async addInteraction(prompt, output, embedding, concepts) {
        const interaction = {
            id: uuidv4(),
            prompt,
            output,
            embedding,
            timestamp: Date.now(),
            accessCount: 1,
            concepts,
            decayFactor: 1.0
        };

        this.memoryStore.addInteraction(interaction);
        await this.storage.saveMemoryToHistory(this.memoryStore);
    }

    async retrieveRelevantInteractions(query, similarityThreshold = 40, excludeLastN = 0) {
        const queryEmbedding = await this.getEmbedding(query);
        const queryConcepts = await this.extractConcepts(query);
        return this.memoryStore.retrieve(queryEmbedding, queryConcepts, similarityThreshold, excludeLastN);
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
}
