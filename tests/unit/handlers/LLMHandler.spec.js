// tests/unit/handlers/LLMHandler.spec.js
import { BaseTest } from '../../helpers/BaseTest.js'
import LLMHandler from '../../../src/handlers/LLMHandler.js'

class LLMHandlerTest extends BaseTest {
    beforeEach() {
        super.beforeEach()
        this.mockProvider = {
            generateEmbedding: jasmine.createSpy('generateEmbedding')
                .and.resolveTo(new Array(1536).fill(0)),
            generateChat: jasmine.createSpy('generateChat')
                .and.resolveTo('test response'),
            generateCompletion: jasmine.createSpy('generateCompletion')
                .and.resolveTo('["test concept"]')
        }
        this.addMock(this.mockProvider)
        this.handler = new LLMHandler(this.mockProvider, 'test-model')
    }
}

describe('LLMHandler', () => {
    let test

    beforeEach(() => {
        test = new LLMHandlerTest()
    })

    describe('Response Generation', () => {
        it('should generate chat response', async (done) => {
            const response = await test.trackPromise(
                test.handler.generateResponse('test prompt', 'test context')
            )

            expect(response).toBe('test response')
            expect(test.mockProvider.generateChat).toHaveBeenCalledWith(
                'test-model',
                jasmine.any(Array),
                jasmine.any(Object)
            )
            done()
        })

        it('should handle chat errors', async (done) => {
            test.mockProvider.generateChat.and.rejectWith(new Error('API Error'))

            try {
                await test.trackPromise(
                    test.handler.generateResponse('test', 'context')
                )
                done.fail('Should have thrown error')
            } catch (error) {
                expect(error.message).toContain('API Error')
                done()
            }
        })
    })

    describe('Concept Extraction', () => {
        it('should extract concepts', async (done) => {
            const concepts = await test.trackPromise(
                test.handler.extractConcepts('test text')
            )
            expect(concepts).toEqual(['test concept'])
            done()
        })

        it('should handle invalid responses', async (done) => {
            test.mockProvider.generateCompletion.and.resolveTo('invalid json')

            const concepts = await test.trackPromise(
                test.handler.extractConcepts('test text')
            )
            expect(concepts).toEqual([])
            done()
        })
    })

    describe('Temperature Control', () => {
        it('should validate temperature range', () => {
            expect(() => test.handler.setTemperature(0.5)).not.toThrow()
            expect(() => test.handler.setTemperature(-0.1))
                .toThrow('Temperature must be between 0 and 1')
        })
    })
})