// tests/integration/llms/LLMHandler.integration.spec.js
import LLMHandler from '../../../src/handlers/LLMHandler.js'
import OllamaConnector from '../../../src/connectors/OllamaConnector.js'
import PromptTemplates from '../../../src/PromptTemplates.js'

describe('LLMHandler Integration', () => {
    let handler
    let llmProvider
    const chatModel = 'qwen2:1.5b'
    const timeout = 30000 // 30s timeout for LLM operations

    beforeAll(async () => {
        llmProvider = new OllamaConnector('http://localhost:11434')
        handler = new LLMHandler(llmProvider, chatModel)

        // Verify Ollama availability
        try {
            await fetch('http://localhost:11434/api/tags')
        } catch (e) {
            pending('Ollama server not available - skipping integration tests')
        }
    })

    describe('Chat Response Generation', () => {
        it('should generate coherent responses', async () => {
            const prompt = 'What is semantic memory?'
            const response = await handler.generateResponse(prompt)

            expect(response).toBeTruthy()
            expect(typeof response).toBe('string')
            expect(response.length).toBeGreaterThan(50)
        }, timeout)

        it('should incorporate context in responses', async () => {
            const context = 'Previous discussion was about neural networks.'
            const prompt = 'How does this relate to deep learning?'

            const response = await handler.generateResponse(prompt, context)

            expect(response).toBeTruthy()
            expect(response.toLowerCase()).toContain('neural')
        }, timeout)

        it('should respect temperature settings', async () => {
            handler.setTemperature(0.1) // More deterministic
            const prompt = 'Count from 1 to 5.'

            const response1 = await handler.generateResponse(prompt)
            const response2 = await handler.generateResponse(prompt)

            expect(response1).toBeTruthy()
            expect(response2).toBeTruthy()
            expect(response1).toEqual(response2)
        }, timeout)
    })

    describe('Concept Extraction', () => {
        it('should extract relevant concepts', async () => {
            const text = 'Neural networks are computational systems inspired by biological brains.'
            const concepts = await handler.extractConcepts(text)

            expect(Array.isArray(concepts)).toBeTrue()
            expect(concepts.length).toBeGreaterThan(0)
            expect(concepts).toContain(jasmine.stringMatching(/neural|network|brain/i))
        }, timeout)

        it('should handle empty or simple input', async () => {
            const concepts1 = await handler.extractConcepts('')
            expect(Array.isArray(concepts1)).toBeTrue()
            expect(concepts1.length).toBe(0)

            const concepts2 = await handler.extractConcepts('Simple test.')
            expect(Array.isArray(concepts2)).toBeTrue()
            expect(concepts2.length).toBeGreaterThan(0)
        }, timeout)

        it('should deduplicate similar concepts', async () => {
            const text = 'AI and artificial intelligence are the same thing'
            const concepts = await handler.extractConcepts(text)

            const aiRelated = concepts.filter(c =>
                /\b(ai|artificial intelligence)\b/i.test(c)
            )
            expect(aiRelated.length).toBe(1)
        }, timeout)
    })

    describe('Error Handling', () => {
        it('should handle network errors gracefully', async () => {
            const badProvider = new OllamaConnector('http://invalid-url:11434')
            const badHandler = new LLMHandler(badProvider, chatModel)

            await expectAsync(
                badHandler.generateResponse('test')
            ).toBeRejectedWithError(/network|connection/i)
        })

        it('should handle malformed responses', async () => {
            const mockProvider = {
                generateChat: () => Promise.resolve(null),
                generateCompletion: () => Promise.resolve('invalid json')
            }
            const mockHandler = new LLMHandler(mockProvider, chatModel)

            const concepts = await mockHandler.extractConcepts('test')
            expect(Array.isArray(concepts)).toBeTrue()
            expect(concepts.length).toBe(0)
        })

        it('should respect timeout limits', async () => {
            handler.setTimeout(100) // Very short timeout

            await expectAsync(
                handler.generateResponse('Write a very long essay.')
            ).toBeRejectedWithError(/timeout/i)
        })
    })

    describe('Template Handling', () => {
        it('should use correct templates for model', async () => {
            const prompt = 'test prompt'
            const context = 'test context'

            const messages = PromptTemplates.formatChatPrompt(
                chatModel,
                'system prompt',
                context,
                prompt
            )

            const response = await handler.generateResponse(prompt, context)
            expect(response).toBeTruthy()
        }, timeout)

        it('should format system prompts correctly', async () => {
            const systemPrompt = 'You are a helpful AI assistant.'
            const prompt = 'Who are you?'

            const response = await handler.generateResponse(
                prompt,
                null,
                systemPrompt
            )

            expect(response.toLowerCase()).toContain('help')
        }, timeout)
    })
})