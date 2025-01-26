// tests/unit/handlers/EmbeddingHandler.spec.js
import EmbeddingHandler from '../../../src/handlers/EmbeddingHandler.js'
import CacheManager from '../../../src/handlers/CacheManager.js'

describe('EmbeddingHandler', () => {
    let handler
    let mockLLMProvider
    let mockCache
    const dimension = 1536
    const model = 'test-model'

    beforeEach(() => {
        mockLLMProvider = {
            generateEmbedding: jasmine.createSpy('generateEmbedding')
                .and.resolveTo(new Array(dimension).fill(0.1))
        }

        mockCache = new CacheManager({
            maxSize: 100,
            ttl: 1000
        })

        handler = new EmbeddingHandler(
            mockLLMProvider,
            model,
            dimension,
            mockCache
        )
    })

    afterEach(() => {
        mockCache.dispose()
    })

    describe('Embedding Generation', () => {
        it('should generate and cache embeddings', async () => {
            const text = 'test input'
            const embedding = await handler.generateEmbedding(text)

            expect(embedding.length).toBe(dimension)
            expect(mockLLMProvider.generateEmbedding)
                .toHaveBeenCalledWith(model, text)

            // Verify caching
            mockLLMProvider.generateEmbedding.calls.reset()
            const cachedEmbedding = await handler.generateEmbedding(text)
            expect(mockLLMProvider.generateEmbedding).not.toHaveBeenCalled()
            expect(cachedEmbedding).toEqual(embedding)
        })

        it('should handle API errors', async () => {
            mockLLMProvider.generateEmbedding
                .and.rejectWith(new Error('API Error'))

            await expectAsync(handler.generateEmbedding('test'))
                .toBeRejectedWithError('API Error')
        })

        it('should retry on certain errors', async () => {
            mockLLMProvider.generateEmbedding
                .and.rejectWith(new Error('Network Error'))
                .and.resolveTo(new Array(dimension).fill(0.1))

            const embedding = await handler.generateEmbedding('test')
            expect(embedding.length).toBe(dimension)
            expect(mockLLMProvider.generateEmbedding).toHaveBeenCalledTimes(2)
        })
    })

    describe('Embedding Validation', () => {
        it('should validate embedding arrays', () => {
            const validEmbedding = new Array(dimension).fill(0.1)
            expect(() => handler.validateEmbedding(validEmbedding))
                .not.toThrow()

            const nonArray = 'not an array'
            expect(() => handler.validateEmbedding(nonArray))
                .toThrowError('Embedding must be an array')
        })

        it('should validate numeric values', () => {
            const invalidValues = new Array(dimension).fill('not a number')
            expect(() => handler.validateEmbedding(invalidValues))
                .toThrowError('Embedding must contain only valid numbers')
        })

        it('should handle undefined values', () => {
            const hasUndefined = new Array(dimension).fill(0.1)
            hasUndefined[5] = undefined

            expect(() => handler.validateEmbedding(hasUndefined))
                .toThrowError('Embedding must contain only valid numbers')
        })
    })

    describe('Dimension Standardization', () => {
        it('should pad short embeddings', () => {
            const shortEmbedding = new Array(1000).fill(0.1)
            const standardized = handler.standardizeEmbedding(shortEmbedding)

            expect(standardized.length).toBe(dimension)
            expect(standardized.slice(0, 1000)).toEqual(shortEmbedding)
            expect(standardized.slice(1000)).toEqual(new Array(536).fill(0))
        })

        it('should truncate long embeddings', () => {
            const longEmbedding = new Array(2000).fill(0.1)
            const standardized = handler.standardizeEmbedding(longEmbedding)

            expect(standardized.length).toBe(dimension)
            expect(standardized).toEqual(longEmbedding.slice(0, dimension))
        })

        it('should preserve exact dimension', () => {
            const correctEmbedding = new Array(dimension).fill(0.1)
            const standardized = handler.standardizeEmbedding(correctEmbedding)

            expect(standardized).toBe(correctEmbedding)
        })
    })

    describe('Cache Management', () => {
        it('should handle cache misses', async () => {
            const text = 'test input'
            await handler.generateEmbedding(text)
            mockCache.clear()

            await handler.generateEmbedding(text)
            expect(mockLLMProvider.generateEmbedding).toHaveBeenCalledTimes(2)
        })

        it('should use cache key based on model and text', async () => {
            const text = 'test input'
            await handler.generateEmbedding(text)

            // Different model should bypass cache
            const handler2 = new EmbeddingHandler(
                mockLLMProvider,
                'different-model',
                dimension,
                mockCache
            )
            await handler2.generateEmbedding(text)

            expect(mockLLMProvider.generateEmbedding).toHaveBeenCalledTimes(2)
        })

        it('should handle concurrent requests', async () => {
            const text = 'test input'
            const promises = Array(5).fill().map(() =>
                handler.generateEmbedding(text)
            )

            const results = await Promise.all(promises)
            expect(mockLLMProvider.generateEmbedding).toHaveBeenCalledTimes(1)
            expect(results.every(r => r.length === dimension)).toBeTrue()
        })
    })
})