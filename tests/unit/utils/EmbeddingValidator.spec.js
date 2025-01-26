// tests/unit/utils/EmbeddingValidator.spec.js
import { EmbeddingValidator } from '../../../src/utils/EmbeddingValidator.js'

describe('EmbeddingValidator', () => {
    let validator

    beforeEach(() => {
        validator = new EmbeddingValidator({
            dimensions: {
                'nomic-embed-text': 768,
                'qwen2:1.5b': 1536,
                'llama2': 4096,
                'default': 1536
            }
        })
    })

    describe('Dimension Management', () => {
        it('should get correct dimensions for models', () => {
            expect(validator.getDimension('nomic-embed-text')).toBe(768)
            expect(validator.getDimension('qwen2:1.5b')).toBe(1536)
            expect(validator.getDimension('llama2')).toBe(4096)
        })

        it('should use default dimension for unknown models', () => {
            expect(validator.getDimension('unknown-model')).toBe(1536)
        })

        it('should handle model name variations', () => {
            expect(validator.getDimension('NOMIC-embed-text')).toBe(768)
            expect(validator.getDimension('qwen2:1.5B')).toBe(1536)
        })
    })

    describe('Embedding Validation', () => {
        it('should validate correct embeddings', () => {
            const embedding = new Array(768).fill(0.1)
            expect(() => validator.validateEmbedding(embedding, 768)).not.toThrow()
        })

        it('should reject non-array inputs', () => {
            expect(() => validator.validateEmbedding('not an array', 768))
                .toThrowError('Embedding must be an array')
        })

        it('should reject invalid numeric values', () => {
            const invalidEmbedding = new Array(768).fill('not a number')
            expect(() => validator.validateEmbedding(invalidEmbedding, 768))
                .toThrowError('Embedding must contain only valid numbers')
        })

        it('should reject wrong dimensions', () => {
            const wrongSize = new Array(512).fill(0.1)
            expect(() => validator.validateEmbedding(wrongSize, 768))
                .toThrowError(/dimension mismatch/)
        })

        it('should handle edge cases', () => {
            // Empty array
            expect(() => validator.validateEmbedding([], 768))
                .toThrowError(/dimension mismatch/)

            // NaN values
            const nanEmbedding = [NaN, 0.1, 0.2]
            expect(() => validator.validateEmbedding(nanEmbedding, 3))
                .toThrowError('Embedding must contain only valid numbers')

            // Infinity values
            const infEmbedding = [Infinity, 0.1, 0.2]
            expect(() => validator.validateEmbedding(infEmbedding, 3))
                .toThrowError('Embedding must contain only valid numbers')
        })
    })

    describe('Dimension Standardization', () => {
        it('should pad short embeddings', () => {
            const shortEmbedding = new Array(500).fill(0.1)
            const standardized = validator.standardizeEmbedding(shortEmbedding, 768)

            expect(standardized.length).toBe(768)
            expect(standardized.slice(0, 500)).toEqual(shortEmbedding)
            expect(standardized.slice(500)).toEqual(new Array(268).fill(0))
        })

        it('should truncate long embeddings', () => {
            const longEmbedding = new Array(1000).fill(0.1)
            const standardized = validator.standardizeEmbedding(longEmbedding, 768)

            expect(standardized.length).toBe(768)
            expect(standardized).toEqual(longEmbedding.slice(0, 768))
        })

        it('should return original if dimension matches', () => {
            const correctEmbedding = new Array(768).fill(0.1)
            const standardized = validator.standardizeEmbedding(correctEmbedding, 768)

            expect(standardized).toBe(correctEmbedding)
        })

        it('should handle zero-length embeddings', () => {
            const standardized = validator.standardizeEmbedding([], 768)
            expect(standardized.length).toBe(768)
            expect(standardized).toEqual(new Array(768).fill(0))
        })
    })

    describe('Loss Detection', () => {
        it('should detect information loss', () => {
            const embedding = new Array(1000).fill(0.1)
            embedding[999] = 1.0 // Significant value that would be lost

            expect(validator.wouldBeLossy(embedding, 768)).toBeTrue()
        })

        it('should handle negligible values', () => {
            const embedding = new Array(1000).fill(1e-8)
            expect(validator.wouldBeLossy(embedding, 768)).toBeFalse()
        })

        it('should handle short embeddings', () => {
            const embedding = new Array(500).fill(0.1)
            expect(validator.wouldBeLossy(embedding, 768)).toBeFalse()
        })
    })

    describe('Model Compatibility', () => {
        it('should validate across model transitions', () => {
            // Create embedding for one model
            const nomicEmbedding = new Array(768).fill(0.1)
            expect(() => validator.validateEmbedding(nomicEmbedding,
                validator.getDimension('nomic-embed-text'))).not.toThrow()

            // Standardize for another model
            const standardized = validator.standardizeEmbedding(nomicEmbedding,
                validator.getDimension('qwen2:1.5b'))
            expect(standardized.length).toBe(1536)
        })

        it('should track dimension changes', () => {
            const embedding = new Array(768).fill(0.1)
            const transitions = [
                'nomic-embed-text',  // 768
                'qwen2:1.5b',        // 1536
                'llama2'             // 4096
            ]

            let current = embedding
            transitions.forEach(model => {
                const targetDim = validator.getDimension(model)
                current = validator.standardizeEmbedding(current, targetDim)
                expect(current.length).toBe(targetDim)
                expect(() => validator.validateEmbedding(current, targetDim))
                    .not.toThrow()
            })
        })
    })
})