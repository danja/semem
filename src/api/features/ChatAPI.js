import BaseAPI from '../common/BaseAPI.js';
import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from 'events';

/**
 * Chat API handler for generating chat responses with memory context
 */
export default class ChatAPI extends BaseAPI {
    constructor(config = {}) {
        super(config);
        this.memoryManager = null;
        this.llmHandler = null;
        this.conversationCache = new Map();
        this.similarityThreshold = config.similarityThreshold || 0.7;
        this.contextWindow = config.contextWindow || 5;
    }

    async initialize() {
        await super.initialize();

        // Get dependencies from registry
        const registry = this.config.registry;
        if (!registry) {
            throw new Error('Registry is required for ChatAPI');
        }

        try {
            this.memoryManager = registry.get('memory');
            this.llmHandler = registry.get('llm');
            this.logger.info('ChatAPI initialized successfully');
        } catch (error) {
            this.logger.error('Failed to initialize ChatAPI:', error);
            throw error;
        }
    }

    /**
     * Execute a chat operation
     */
    async executeOperation(operation, params) {
        this._validateParams(params);

        const start = Date.now();

        try {
            let result;

            switch (operation) {
                case 'chat':
                    result = await this.generateChatResponse(params);
                    break;
                case 'stream':
                    result = await this.streamChatResponse(params);
                    break;
                case 'completion':
                    result = await this.generateCompletion(params);
                    break;
                default:
                    throw new Error(`Unknown operation: ${operation}`);
            }

            const duration = Date.now() - start;
            this._emitMetric(`chat.${operation}.duration`, duration);
            this._emitMetric(`chat.${operation}.count`, 1);

            return result;
        } catch (error) {
            this._emitMetric(`chat.${operation}.errors`, 1);
            throw error;
        }
    }

    /**
     * Generate a chat response with memory context
     */
    async generateChatResponse({ prompt, conversationId, useMemory = true, temperature = 0.7, model }) {
        if (!prompt) {
            throw new Error('Prompt is required');
        }

        try {
            // Get or create conversation
            const conversation = this._getConversation(conversationId);

            // Get relevant memories if needed
            let relevantMemories = [];
            if (useMemory) {
                relevantMemories = await this.memoryManager.retrieveRelevantInteractions(
                    prompt,
                    this.similarityThreshold
                );
            }

            // Create context from conversation history and relevant memories
            const context = this._buildContext(conversation, relevantMemories);

            // Generate response
            // Generate response with the specified model or use default
            const response = await this.llmHandler.generateResponse(
                prompt,
                context,
                { 
                    temperature,
                    model: model // Will fall back to LLMHandler's default if not provided
                }
            );
            
            this.logger.log(`Generated response using model: ${model || 'default'}`);

            // Update conversation history
            conversation.history.push({ role: 'user', content: prompt });
            conversation.history.push({ role: 'assistant', content: response });

            // Trim conversation if needed
            if (conversation.history.length > this.contextWindow * 2) {
                conversation.history = conversation.history.slice(-this.contextWindow * 2);
            }

            // Store in memory if enabled
            if (useMemory) {
                const embedding = await this.memoryManager.generateEmbedding(
                    `${prompt} ${response}`
                );
                const concepts = await this.memoryManager.extractConcepts(
                    `${prompt} ${response}`
                );

                await this.memoryManager.addInteraction(
                    prompt,
                    response,
                    embedding,
                    concepts,
                    {
                        conversationId: conversation.id,
                        timestamp: Date.now()
                    }
                );
            }

            this._emitMetric('chat.generate.count', 1);
            return {
                response,
                conversationId: conversation.id,
                memoryIds: relevantMemories.map(m => m.interaction.id || '')
                    .filter(id => id !== '')
            };
        } catch (error) {
            this._emitMetric('chat.generate.errors', 1);
            throw error;
        }
    }

    /**
     * Stream a chat response with memory context
     */
    async streamChatResponse({ prompt, conversationId, useMemory = true, temperature = 0.7 }) {
        if (!prompt) {
            throw new Error('Prompt is required');
        }

        try {
            // Create a stream
            const stream = new EventEmitter();

            // Process in background
            (async () => {
                try {
                    // Get or create conversation
                    const conversation = this._getConversation(conversationId);

                    // Get relevant memories if needed
                    let relevantMemories = [];
                    if (useMemory) {
                        relevantMemories = await this.memoryManager.retrieveRelevantInteractions(
                            prompt,
                            this.similarityThreshold
                        );
                    }

                    // Create context from conversation history and relevant memories
                    const context = this._buildContext(conversation, relevantMemories);

                    // Generate streaming response
                    let responseText = '';
                    const responseStream = await this.llmHandler.generateStreamingResponse(
                        prompt,
                        context,
                        { temperature }
                    );

                    responseStream.on('data', (chunk) => {
                        responseText += chunk;
                        stream.emit('data', { chunk });
                    });

                    responseStream.on('end', async () => {
                        // Update conversation history
                        conversation.history.push({ role: 'user', content: prompt });
                        conversation.history.push({ role: 'assistant', content: responseText });

                        // Trim conversation if needed
                        if (conversation.history.length > this.contextWindow * 2) {
                            conversation.history = conversation.history.slice(-this.contextWindow * 2);
                        }

                        // Store in memory if enabled
                        if (useMemory) {
                            const embedding = await this.memoryManager.generateEmbedding(
                                `${prompt} ${responseText}`
                            );
                            const concepts = await this.memoryManager.extractConcepts(
                                `${prompt} ${responseText}`
                            );

                            await this.memoryManager.addInteraction(
                                prompt,
                                responseText,
                                embedding,
                                concepts,
                                {
                                    conversationId: conversation.id,
                                    timestamp: Date.now()
                                }
                            );
                        }

                        // End stream
                        stream.emit('end');
                    });

                    responseStream.on('error', (error) => {
                        stream.emit('error', error);
                    });
                } catch (error) {
                    stream.emit('error', error);
                }
            })();

            this._emitMetric('chat.stream.count', 1);
            return stream;
        } catch (error) {
            this._emitMetric('chat.stream.errors', 1);
            throw error;
        }
    }

    /**
     * Generate a text completion with memory context
     */
    async generateCompletion({ prompt, max_tokens = 100, temperature = 0.7 }) {
        if (!prompt) {
            throw new Error('Prompt is required');
        }

        try {
            // Get relevant memories
            const relevantMemories = await this.memoryManager.retrieveRelevantInteractions(
                prompt,
                this.similarityThreshold
            );

            // Create context from relevant memories
            const context = relevantMemories.map(m =>
                `${m.interaction.prompt} ${m.interaction.output}`
            ).join('\n\n');

            // Generate completion
            const completion = await this.llmHandler.generateCompletion(
                prompt,
                context,
                { max_tokens, temperature }
            );

            this._emitMetric('chat.completion.count', 1);
            return {
                completion,
                memoryIds: relevantMemories.map(m => m.interaction.id || '')
                    .filter(id => id !== '')
            };
        } catch (error) {
            this._emitMetric('chat.completion.errors', 1);
            throw error;
        }
    }

    /**
     * Get or create a conversation
     */
    _getConversation(conversationId) {
        if (!conversationId) {
            return this._createConversation();
        }

        const conversation = this.conversationCache.get(conversationId);
        if (!conversation) {
            // Create a new conversation with the provided ID
            return this._createConversation(conversationId);
        }

        return conversation;
    }

    /**
     * Create a new conversation
     */
    _createConversation(id = null) {
        const conversationId = id || uuidv4();
        const conversation = {
            id: conversationId,
            created: Date.now(),
            lastAccessed: Date.now(),
            history: []
        };

        this.conversationCache.set(conversationId, conversation);
        return conversation;
    }

    /**
     * Build context for the LLM from conversation history and relevant memories
     */
    _buildContext(conversation, relevantMemories) {
        const context = {
            conversation: conversation.history,
            relevantMemories: relevantMemories.map(memory => ({
                prompt: memory.interaction.prompt,
                response: memory.interaction.output,
                similarity: memory.similarity
            }))
        };

        return context;
    }

    /**
     * Get chat API metrics
     */
    async getMetrics() {
        const baseMetrics = await super.getMetrics();

        return {
            ...baseMetrics,
            conversations: {
                count: this.conversationCache.size,
                active: this._getActiveConversationCount()
            },
            operations: {
                chat: {
                    count: await this._getMetricValue('chat.chat.count'),
                    errors: await this._getMetricValue('chat.chat.errors'),
                    duration: await this._getMetricValue('chat.chat.duration')
                },
                stream: {
                    count: await this._getMetricValue('chat.stream.count'),
                    errors: await this._getMetricValue('chat.stream.errors')
                },
                completion: {
                    count: await this._getMetricValue('chat.completion.count'),
                    errors: await this._getMetricValue('chat.completion.errors')
                }
            }
        };
    }

    _getActiveConversationCount() {
        const now = Date.now();
        const activeThreshold = 30 * 60 * 1000; // 30 minutes

        let count = 0;
        for (const conversation of this.conversationCache.values()) {
            if (now - conversation.lastAccessed < activeThreshold) {
                count++;
            }
        }

        return count;
    }

    async _getMetricValue(metricName) {
        // In a real implementation, this would fetch from a metrics store
        return 0;
    }
}