// tests/unit/handlers/LLMHandler.spec.js
import LLMHandler from '../../../src/handlers/LLMHandler.js'

describe('LLMHandler', () => {
    let handler
    let mockProvider

    beforeEach(() => {
        mockProvider = {
            generateEmbedding: jasmine.createSpy('generateEmbedding'),
            generateChat: jasmine.createSpy('generateChat'),
            generateCompletion: jasmine.createSpy('generateCompletion')
        }
        handler = new LLMHandler(mockProvider, 'test-model')
    })

    describe('generateResponse', () => {
        it('should generate chat response with correct parameters', async () => {
            const expectedResponse = 'Test response'
            mockProvider.generateChat.and.resolveTo(expectedResponse)

            const response = await handler.generateResponse(
                'test prompt',
                'test context'
            )

            expect(response).toBe(expectedResponse)
            expect(mockProvider.generateChat).toHaveBeenCalledWith(
                'test-model',
                jasmine.arrayContaining([
                    jasmine.objectContaining({ role: 'system' }),
                    jasmine.objectContaining({ role: 'user' })
                ]),
                jasmine.objectContaining({ temperature: 0.7 })
            )
        })

        it('should handle chat generation errors', async () => {
            mockProvider.generateChat.and.rejectWith(new Error('API Error'))

            await expectAsync(
                handler.generateResponse('test prompt', 'test context')
            ).toBeRejectedWithError('API Error')
        })
    })

    describe('extractConcepts', () => {
        it('should extract concepts from LLM response', async () => {
            const concepts = ['concept1', 'concept2']
            mockProvider.generateCompletion.and.resolveTo(
                `Some text ["${concepts.join('", "')}"] more text`
            )

            const result = await handler.extractConcepts('test text')

            expect(result).toEqual(concepts)
            expect(mockProvider.generateCompletion).toHaveBeenCalledWith(
                'test-model',
                jasmine.any(String),
                jasmine.objectContaining({ temperature: 0.2 })
            )
        })

        it('should return empty array when no concepts found', async () => {
            mockProvider.generateCompletion.and.resolveTo('Invalid response')

            const result = await handler.extractConcepts('test text')

            expect(result).toEqual([])
        })

        it('should handle invalid JSON in concept extraction', async () => {
            mockProvider.generateCompletion.and.resolveTo('[invalid json]')

            const result = await handler.extractConcepts('test text')

            expect(result).toEqual([])
        })
    })

    describe('generateEmbedding', () => {
        it('should generate embeddings successfully', async () => {
            const expectedEmbedding = [0.1, 0.2, 0.3]
            mockProvider.generateEmbedding.and.resolveTo(expectedEmbedding)

            const embedding = await handler.generateEmbedding(
                'test text',
                'embedding-model'
            )

            expect(embedding).toEqual(expectedEmbedding)
            expect(mockProvider.generateEmbedding).toHaveBeenCalledWith(
                'embedding-model',
                'test text'
            )
        })

        it('should retry failed embedding generations', async () => {
            mockProvider.generateEmbedding
                .and.rejectWith(new Error('Retry 1'))
                .and.rejectWith(new Error('Retry 2'))
                .and.resolveTo([0.1, 0.2, 0.3])

            const embedding = await handler.generateEmbedding(
                'test text',
                'embedding-model'
            )

            expect(embedding).toEqual([0.1, 0.2, 0.3])
            expect(mockProvider.generateEmbedding).toHaveBeenCalledTimes(3)
        })

        it('should fail after max retries', async () => {
            mockProvider.generateEmbedding.and.rejectWith(new Error('API Error'))

            await expectAsync(
                handler.generateEmbedding('test text', 'embedding-model')
            ).toBeRejectedWithError(/Failed to generate embedding after 3 attempts/)

            expect(mockProvider.generateEmbedding).toHaveBeenCalledTimes(3)
        })
    })

    describe('setTemperature', () => {
        it('should set valid temperature', () => {
            expect(() => handler.setTemperature(0.5)).not.toThrow()
        })

        it('should reject invalid temperatures', () => {
            expect(() => handler.setTemperature(-0.1)).toThrow()
            expect(() => handler.setTemperature(1.1)).toThrow()
        })
    })

    describe('model validation', () => {
        it('should validate model names', () => {
            expect(handler.validateModel('valid-model')).toBe(true)
            expect(handler.validateModel('')).toBe(false)
            expect(handler.validateModel(undefined)).toBe(false)
        })
    })
})