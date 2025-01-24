import LLMHandler from '../../../src/handlers/LLMHandler'
import type { LLMProvider } from '../../../src/types/MemoryTypes'

describe('LLMHandler', () => {
    let handler: LLMHandler
    let mockProvider: jest.Mocked<LLMProvider>

    beforeEach(() => {
        mockProvider = {
            generateEmbedding: jest.fn(),
            generateChat: jest.fn(),
            generateCompletion: jest.fn()
        }
        handler = new LLMHandler(mockProvider, 'test-model')
    })

    describe('generateResponse', () => {
        it('should generate chat response with correct parameters', async () => {
            const expectedResponse = 'Test response'
            mockProvider.generateChat.mockResolvedValue(expectedResponse)

            const response = await handler.generateResponse(
                'test prompt',
                'test context'
            )

            expect(response).toBe(expectedResponse)
            expect(mockProvider.generateChat).toHaveBeenCalledWith(
                'test-model',
                expect.arrayContaining([
                    expect.objectContaining({ role: 'system' }),
                    expect.objectContaining({ role: 'user' })
                ]),
                expect.objectContaining({ temperature: 0.7 })
            )
        })

        it('should handle chat generation errors', async () => {
            mockProvider.generateChat.mockRejectedValue(new Error('API Error'))

            await expectAsync(
                handler.generateResponse('test prompt', 'test context')
            ).toBeRejectedWithError('API Error')
        })
    })

    describe('extractConcepts', () => {
        it('should extract concepts from LLM response', async () => {
            const concepts = ['concept1', 'concept2']
            mockProvider.generateCompletion.mockResolvedValue(
                `Some text ["${concepts.join('", "')}"] more text`
            )

            const result = await handler.extractConcepts('test text')

            expect(result).toEqual(concepts)
            expect(mockProvider.generateCompletion).toHaveBeenCalledWith(
                'test-model',
                expect.any(String),
                expect.objectContaining({ temperature: 0.2 })
            )
        })

        it('should return empty array when no concepts found', async () => {
            mockProvider.generateCompletion.mockResolvedValue('Invalid response')

            const result = await handler.extractConcepts('test text')

            expect(result).toEqual([])
        })

        it('should handle invalid JSON in concept extraction', async () => {
            mockProvider.generateCompletion.mockResolvedValue('[invalid json]')

            const result = await handler.extractConcepts('test text')

            expect(result).toEqual([])
        })
    })

    describe('generateEmbedding', () => {
        it('should generate embeddings successfully', async () => {
            const expectedEmbedding = [0.1, 0.2, 0.3]
            mockProvider.generateEmbedding.mockResolvedValue(expectedEmbedding)

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
                .mockRejectedValueOnce(new Error('Retry 1'))
                .mockRejectedValueOnce(new Error('Retry 2'))
                .mockResolvedValueOnce([0.1, 0.2, 0.3])

            const embedding = await handler.generateEmbedding(
                'test text',
                'embedding-model'
            )

            expect(embedding).toEqual([0.1, 0.2, 0.3])
            expect(mockProvider.generateEmbedding).toHaveBeenCalledTimes(3)
        })

        it('should fail after max retries', async () => {
            mockProvider.generateEmbedding.mockRejectedValue(new Error('API Error'))

            await expectAsync(
                handler.generateEmbedding('test text', 'embedding-model')
            ).toBeRejectedWithError(/Failed to generate embedding after 3 attempts/)

            expect(mockProvider.generateEmbedding).toHaveBeenCalledTimes(3)
        })
    })

    describe('temperature management', () => {
        it('should set valid temperature', () => {
            handler.setTemperature(0.5)
            expect(() => handler.setTemperature(0.5)).not.toThrow()
        })

        it('should reject invalid temperatures', () => {
            expect(() => handler.setTemperature(-0.1)).toThrow()
            expect(() => handler.setTemperature(1.1)).toThrow()
        })
    })

    describe('model validation', () => {
        it('should validate model names', () => {
            expect(handler.validateModel('valid-model')).toBeTrue()
            expect(handler.validateModel('')).toBeFalse()
            expect(handler.validateModel('' as any)).toBeFalse()
        })
    })
})