import { ChatOpenAI } from '@langchain/openai';
import { ChatOllama } from '@langchain/community/chat_models/ollama';
import { OpenAIEmbeddings } from '@langchain/openai';
import ollama from 'ollama';
import { v4 as uuidv4 } from 'uuid';
import MemoryStore from './memoryStore.js';
import InMemoryStorage from './inMemoryStorage.js';
import { logger } from './utils.js';

export default class MemoryManager {
    constructor({
        apiKey,
        chatModel = 'ollama',
        chatModelName = 'llama2',
        embeddingModel = 'ollama',
        embeddingModelName = 'nomic-embed-text',
        storage = null
    }) {
        this.apiKey = apiKey;
        this.chatModelName = chatModelName;
        this.embeddingModelName = embeddingModelName;
        this.dimension = 1536;  // Default dimension

        this.initializeChatModel(chatModel, chatModelName);
        this.initializeEmbeddingModel(embeddingModel, embeddingModelName);

        this.memoryStore = new MemoryStore(this.dimension);
        this.storage = storage || new InMemoryStorage();
        
        this.initialize();
    }

    initializeChatModel(chatModel, modelName) {
        if (chatModel.toLowerCase() === 'openai') {
            this.llm = new ChatOpenAI({
                modelName: modelName,
                apiKey: this.apiKey
            });
        } else if (chatModel.toLowerCase() === 'ollama') {
            this.llm = new ChatOllama({
                model: modelName,
                temperature: 0
            });
        } else {
            throw new Error(`Unsupported chat model: ${chatModel}`);
        }
    }

    async initializeEmbeddingModel(embeddingModel, modelName) {
        if (embeddingModel.toLowerCase() === 'openai') {
            this.embeddings = new OpenAIEmbeddings({
                modelName,
                apiKey: this.apiKey
            });
            this.dimension = modelName === 'text-embedding-3-small' ? 1536 : 1024;
        } else if (embeddingModel.toLowerCase() === 'ollama') {
            this.embeddings = async (text) => {
                const response = await ollama.embeddings({
                    model: modelName,
                    prompt: text
                });
                return response.embedding;
            };
            this.dimension = 1024;  // Default for Ollama
        } else {
            throw new Error(`Unsupported embedding model: ${embeddingModel}`);
        }
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
        let embedding;
        
        try {
            if (typeof this.embeddings === 'function') {
                embedding = await this.embeddings(text);
            } else {
                embedding = await this.embeddings.embedQuery(text);
            }
            
            return this.standardizeEmbedding(embedding);
        } catch (error) {
            logger.error('Error generating embedding:', error);
            throw error;
        }
    }

    async extractConcepts(text) {
        logger.info('Extracting concepts...');
        
        const messages = [{
            role: 'system',
            content: 'Extract key concepts from the text. Return only an array of strings.'
        }, {
            role: 'user',
            content: text
        }];

        try {
            const response = await this.llm.call(messages);
            const concepts = JSON.parse(response.content);
            logger.info('Extracted concepts:', concepts);
            return concepts;
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
        const context = this.buildContext(lastInteractions, retrievals, contextWindow);
        
        const messages = [{
            role: 'system',
            content: "You're a helpful assistant with memory of past interactions."
        }, {
            role: 'user',
            content: `${context}\nCurrent prompt: ${prompt}`
        }];

        try {
            const response = await this.llm.call(messages);
            return response.content.trim();
        } catch (error) {
            logger.error('Error generating response:', error);
            throw error;
        }
    }

    buildContext(lastInteractions, retrievals, contextWindow) {
        