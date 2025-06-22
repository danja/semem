import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Config from '../../../src/Config.js';
import MemoryManager from '../../../src/MemoryManager.js';

describe('OllamaExample Integration', () => {
    let config;
    let mockOllama;
    let mockStorage;
    let memoryManager;

    beforeEach(() => {
        mockOllama = {
            generateEmbedding: vi.fn().mockResolvedValue(new Array(1536).fill(0)),
            generateChat: vi.fn().mockResolvedValue('test response'),
            generateCompletion: vi.fn().mockResolvedValue('["concept"]')
        };

        mockStorage = {
            loadHistory: vi.fn().mockResolvedValue([[], []]),
            saveMemoryToHistory: vi.fn(),
            close: vi.fn()
        };

        config = Config.create({
            storage: {
                type: 'json',
                options: { path: 'test.json' }
            },
            models: {
                chat: {
                    provider: 'ollama',
                    model: 'test-chat'
                },
                embedding: {
                    provider: 'ollama',
                    model: 'test-embed'
                }
            }
        });
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('should initialize with config values', () => {
        memoryManager = new MemoryManager({
            llmProvider: mockOllama,
            chatModel: config.get('models.chat.model'),
            embeddingModel: config.get('models.embedding.model'),
            storage: mockStorage
        });

        expect(memoryManager.chatModel).toBe('test-chat');
        expect(memoryManager.embeddingModel).toBe('test-embed');
    });

    it('should handle full interaction flow', async () => {
        memoryManager = new MemoryManager({
            llmProvider: mockOllama,
            chatModel: config.get('models.chat.model'),
            embeddingModel: config.get('models.embedding.model'),
            storage: mockStorage
        });

        const prompt = 'test prompt';

        const relevantInteractions = await memoryManager.retrieveRelevantInteractions(prompt);
        expect(mockOllama.generateEmbedding).toHaveBeenCalled();

        const response = await memoryManager.generateResponse(prompt, [], relevantInteractions);
        expect(mockOllama.generateChat).toHaveBeenCalled();

        const embedding = await memoryManager.generateEmbedding(`${prompt} ${response}`);
        const concepts = await memoryManager.extractConcepts(`${prompt} ${response}`);

        await memoryManager.addInteraction(prompt, response, embedding, concepts);
        expect(mockStorage.saveMemoryToHistory).toHaveBeenCalled();
    });

    it('should handle errors during interaction flow', async () => {
        // Mock a failing generateEmbedding call
        mockOllama.generateEmbedding.mockRejectedValueOnce(new Error('Embedding failed'));
        
        memoryManager = new MemoryManager({
            llmProvider: mockOllama,
            chatModel: config.get('models.chat.model'),
            embeddingModel: config.get('models.embedding.model'),
            storage: mockStorage
        });

        await expect(memoryManager.retrieveRelevantInteractions('test'))
            .rejects
            .toThrow('Embedding failed');
    });

    afterEach(async () => {
        if (memoryManager) {
            await memoryManager.dispose();
        }
    });
});