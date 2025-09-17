import BaseAPI from '../common/BaseAPI.js';
import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from 'events';
import { WorkflowLogger, workflowLoggerRegistry } from '../../utils/WorkflowLogger.js';

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
        this.workflowLogger = new WorkflowLogger('ChatAPI');
        workflowLoggerRegistry.register('ChatAPI', this.workflowLogger);
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

        // Start workflow tracking
        const operationId = this.workflowLogger.startOperation(
            null,
            'chat',
            'Processing chat request',
            { 
                prompt: prompt.substring(0, 100) + (prompt.length > 100 ? '...' : ''),
                useMemory,
                temperature,
                model: model || 'default'
            }
        );

        const opLogger = this.workflowLogger.createOperationLogger(operationId);

        try {
            // Step 1: Get or create conversation
            opLogger.step(
                'get_conversation',
                '📝 Setting up conversation context',
                `[ChatAPI] _getConversation(${conversationId || 'new'})`
            );
            const conversation = this._getConversation(conversationId);

            // Step 2: Get relevant memories if needed
            let relevantMemories = [];
            if (useMemory) {
                opLogger.step(
                    'retrieve_memories',
                    '🧠 Searching for relevant memories',
                    `[ChatAPI] memoryManager.retrieveRelevantInteractions() - threshold: ${this.similarityThreshold}`
                );
                
                relevantMemories = await this.memoryManager.retrieveRelevantInteractions(
                    prompt,
                    this.similarityThreshold
                );

                opLogger.step(
                    'memories_found',
                    `📥 Found ${relevantMemories.length} relevant memories`,
                    `[ChatAPI] Retrieved ${relevantMemories.length} memories with similarities: ${relevantMemories.map(m => m.similarity?.toFixed(3)).join(', ')}`,
                    { memoryCount: relevantMemories.length, similarities: relevantMemories.map(m => m.similarity) }
                );
            } else {
                opLogger.step(
                    'skip_memories',
                    '⚡ Skipping memory retrieval',
                    '[ChatAPI] useMemory=false, proceeding without memory context'
                );
            }

            // Step 3: Build context
            opLogger.step(
                'build_context',
                '🏗️ Building conversation context',
                `[ChatAPI] _buildContext() - conversation history: ${conversation.history.length} messages, memories: ${relevantMemories.length}`
            );
            const context = this._buildContext(conversation, relevantMemories);

            // Step 4: Generate response using LLM
            opLogger.step(
                'generate_response',
                `🤖 Generating response with ${model || 'default'} model`,
                `[ChatAPI] llmHandler.generateResponse() - model: ${model || 'default'}, temperature: ${temperature}`
            );
            
            const response = await this.llmHandler.generateResponse(
                prompt,
                context,
                { 
                    temperature,
                    model: model // Will fall back to LLMHandler's default if not provided
                }
            );
            
            opLogger.step(
                'response_generated',
                `✅ Generated ${response.length} character response`,
                `[ChatAPI] LLM response generated - length: ${response.length}, model: ${model || 'default'}`,
                { responseLength: response.length, model: model || 'default' }
            );

            // Step 5: Update conversation history
            conversation.history.push({ role: 'user', content: prompt });
            conversation.history.push({ role: 'assistant', content: response });

            // Trim conversation if needed
            if (conversation.history.length > this.contextWindow * 2) {
                conversation.history = conversation.history.slice(-this.contextWindow * 2);
            }

            // Step 6: Store in memory if enabled
            if (useMemory) {
                opLogger.step(
                    'generate_embeddings',
                    '🎯 Generating embeddings for storage',
                    '[ChatAPI] memoryManager.generateEmbedding() - creating vector representation'
                );
                
                const embedding = await this.memoryManager.generateEmbedding(
                    `${prompt} ${response}`
                );

                opLogger.step(
                    'extract_concepts',
                    '💡 Extracting semantic concepts',
                    '[ChatAPI] memoryManager.extractConcepts() - identifying key concepts'
                );
                
                const concepts = await this.memoryManager.extractConcepts(
                    `${prompt} ${response}`
                );

                opLogger.step(
                    'store_interaction',
                    '💾 Storing interaction in knowledge graph',
                    `[ChatAPI] memoryManager.addInteraction() - embedding dims: ${embedding.length}, concepts: ${concepts.length}`,
                    { embeddingDimensions: embedding.length, conceptCount: concepts.length }
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

            // Complete operation successfully
            const result = {
                response,
                conversationId: conversation.id,
                memoryIds: relevantMemories.map(m => m.interaction?.id || m.id || '')
                    .filter(id => id !== '')
            };

            opLogger.complete(
                'Chat response generated successfully',
                { 
                    conversationId: conversation.id,
                    memoryIdsCount: result.memoryIds.length,
                    responseLength: response.length
                }
            );

            this._emitMetric('chat.generate.count', 1);
            return result;
            
        } catch (error) {
            // Fail operation with detailed error info
            opLogger.fail(error, {
                prompt: prompt.substring(0, 100),
                useMemory,
                temperature,
                model: model || 'default'
            });

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
                `${m.interaction?.prompt || m.prompt} ${m.interaction?.output || m.response}`
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
                memoryIds: relevantMemories.map(m => m.interaction?.id || m.id || '')
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
                // MIGRATION: Enhanced SPARQLStore now provides unified memory structure
                prompt: memory.interaction?.prompt || memory.prompt,
                response: memory.interaction?.output || memory.response,
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