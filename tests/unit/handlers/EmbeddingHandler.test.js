// tests/unit/handlers/EmbeddingHandler.test.js
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import EmbeddingHandler from '../../../src/handlers/EmbeddingHandler.js';

// Mock the logger to prevent console output during tests
vi.mock('loglevel', () => ({
    default: {
        error: vi.fn(),
        info: vi.fn(),
        debug: vi.fn(),
        warn: vi.fn()
    }
}));

describe('EmbeddingHandler', () => {
    let handler;
    let mockProvider;
    let mockCache;
    const testDimension = 1536;
    const testModel = 'test-model';
    
    beforeEach(() => {
        mockProvider = {
            generateEmbedding: vi.fn().mockResolvedValue(new Array(testDimension).fill(0.1))
        };
        
        mockCache = {
            get: vi.fn(),
            set: vi.fn()
        };
        
        handler = new EmbeddingHandler(mockProvider, testModel, testDimension, mockCache);
    });
    
    afterEach(() => {
        vi.resetAllMocks();
    });
    
    describe('Initialization', () => {
        it('should initialize with valid configuration', () => {
            expect(handler.provider).toBe(mockProvider);
            expect(handler.model).toBe(testModel);
            expect(handler.dimension).toBe(testDimension);
            expect(handler.cacheManager).toBe(mockCache);
        });
        
        it('should throw error for invalid provider', () => {
            expect(() => new EmbeddingHandler(null, testModel, testDimension))
                .toThrow('Invalid embedding provider');
                
            expect(() => new EmbeddingHandler({}, testModel, testDimension))
                .toThrow('Invalid embedding provider');
        });
    });
    
    describe('Embedding Generation', () => {
        it('should generate embeddings', async () => {
            const text = 'test text';
            const result = await handler.generateEmbedding(text);
            
            expect(mockProvider.generateEmbedding).toHaveBeenCalledWith(testModel, text);
            expect(result).toHaveLength(testDimension);
            expect(result).toEqual(new Array(testDimension).fill(0.1));
        });
        
        it('should use cached embeddings when available', async () => {
            const text = 'cached text';
            const cachedEmbedding = new Array(testDimension).fill(0.5);
            mockCache.get.mockReturnValue(cachedEmbedding);
            
            const result = await handler.generateEmbedding(text);
            
            expect(mockCache.get).toHaveBeenCalled();
            expect(mockProvider.generateEmbedding).not.toHaveBeenCalled();
            expect(result).toBe(cachedEmbedding);
        });
        
        it('should cache generated embeddings', async () => {
            const text = 'test text';
            await handler.generateEmbedding(text);
            
            expect(mockCache.set).toHaveBeenCalled();
            expect(mockCache.set.mock.calls[0][0]).toContain(testModel);
            expect(mockCache.set.mock.calls[0][0]).toContain(text.slice(0, 100));
        });
        
        it('should validate input text', async () => {
            await expect(handler.generateEmbedding('')).rejects.toThrow('Invalid input text');
            await expect(handler.generateEmbedding(null)).rejects.toThrow('Invalid input text');
            await expect(handler.generateEmbedding(123)).rejects.toThrow('Invalid input text');
        });
        
        it('should handle provider errors', async () => {
            mockProvider.generateEmbedding.mockRejectedValue(new Error('Provider failed'));
            
            await expect(handler.generateEmbedding('test'))
                .rejects.toThrow('Provider error: Provider failed');
        });
        
        it('should validate provider response format', async () => {
            mockProvider.generateEmbedding.mockResolvedValue('not an array');
            
            await expect(handler.generateEmbedding('test'))
                .rejects.toThrow('Invalid embedding format from provider');
                
            mockProvider.generateEmbedding.mockResolvedValue(null);
            
            await expect(handler.generateEmbedding('test'))
                .rejects.toThrow('Invalid embedding format from provider');
        });
    });
    
    describe('Embedding Validation', () => {
        it('should validate array format', () => {
            expect(() => handler.validateEmbedding('not array')).toThrow('Embedding must be an array');
            expect(() => handler.validateEmbedding(null)).toThrow('Embedding must be an array');
            expect(() => handler.validateEmbedding({})).toThrow('Embedding must be an array');
        });
        
        it('should validate embedding dimension', () => {
            const tooShort = new Array(testDimension - 10).fill(0.1);
            const tooLong = new Array(testDimension + 10).fill(0.1);
            const correctSize = new Array(testDimension).fill(0.1);
            
            expect(() => handler.validateEmbedding(tooShort)).toThrow('Embedding dimension mismatch');
            expect(() => handler.validateEmbedding(tooLong)).toThrow('Embedding dimension mismatch');
            expect(handler.validateEmbedding(correctSize)).toBe(true);
        });
        
        it('should validate numeric values', () => {
            const hasNaN = new Array(testDimension).fill(0.1);
            hasNaN[5] = NaN;
            
            const hasString = new Array(testDimension).fill(0.1);
            hasString[10] = 'string';
            
            expect(() => handler.validateEmbedding(hasNaN))
                .toThrow('Embedding must contain only valid numbers');
                
            expect(() => handler.validateEmbedding(hasString))
                .toThrow('Embedding must contain only valid numbers');
        });
    });
    
    describe('Embedding Standardization', () => {
        it('should pass through correct dimension embeddings', () => {
            const correctEmbedding = new Array(testDimension).fill(0.2);
            const result = handler.standardizeEmbedding(correctEmbedding);
            
            expect(result).toBe(correctEmbedding); // Should be the same object
        });
        
        it('should pad shorter embeddings', () => {
            const shortEmbedding = new Array(testDimension - 100).fill(0.3);
            const result = handler.standardizeEmbedding(shortEmbedding);
            
            expect(result).toHaveLength(testDimension);
            expect(result.slice(0, shortEmbedding.length)).toEqual(shortEmbedding);
            expect(result.slice(shortEmbedding.length)).toEqual(new Array(100).fill(0));
        });
        
        it('should truncate longer embeddings', () => {
            const longEmbedding = new Array(testDimension + 100).fill(0.4);
            const result = handler.standardizeEmbedding(longEmbedding);
            
            expect(result).toHaveLength(testDimension);
            expect(result).toEqual(longEmbedding.slice(0, testDimension));
        });
        
        it('should validate input format', () => {
            expect(() => handler.standardizeEmbedding('not array'))
                .toThrow('Input must be an array');
        });
    });
});