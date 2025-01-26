// tests/integration/ContextManager.integration.spec.js
import ContextManager from '../../src/ContextManager.js'
import LLMHandler from '../../src/handlers/LLMHandler.js'
import OllamaConnector from '../../src/connectors/OllamaConnector.js'

describe('ContextManager Integration', () => {
    let manager
    let llmHandler
    const TEST_TIMEOUT = 30000

    beforeAll(async () => {
        llmHandler = new LLMHandler(
            new OllamaConnector('http://localhost:11434'),
            'qwen2:1.5b'
        )

        manager = new ContextManager({
            maxTokens: 8192,
            maxTimeWindow: 3600000,
            relevanceThreshold: 0.7,
            maxContextSize: 5
        })

        try {
            await fetch('http://localhost:11434/api/tags')
        } catch (e) {
            pending('Ollama server not available - skipping integration tests')
        }
    })

    describe('Context Building', () => {
        it('should build context with recent interactions', async () => {
            const recentInteractions = [{
                prompt: 'What is machine learning?',
                output: 'Machine learning is a subset of AI that enables systems to learn from data.',
                timestamp: Date.now(),
                concepts: ['machine learning', 'AI', 'data']
            }]

            const currentPrompt = 'How does deep learning relate to this?'
            const context = manager.buildContext(currentPrompt, [], recentInteractions)

            expect(context).toContain('machine learning')
            expect(context).toContain('AI')
        }, TEST_TIMEOUT)

        it('should integrate retrieved context with relevance scores', async () => {
            const retrievals = [{
                similarity: 0.9,
                interaction: {
                    prompt: 'Explain neural networks',
                    output: 'Neural networks are computational models inspired by biological neurons.',
                    concepts: ['neural networks', 'computation', 'biology']
                }
            }]

            const context = manager.buildContext('How do neural networks learn?', retrievals)
            expect(context).toContain('neural networks')
            expect(context).toContain('computational models')
        }, TEST_TIMEOUT)

        it('should handle system context integration', async () => {
            const systemContext = "You're a helpful AI assistant specializing in machine learning."
            const context = manager.buildContext(
                'What is backpropagation?',
                [],
                [],
                { systemContext }
            )

            expect(context).toContain('AI assistant')
            expect(context).toContain('machine learning')
        }, TEST_TIMEOUT)
    })

    describe('Context Management', () => {
        it('should prune old and irrelevant context', async () => {
            const oldTimestamp = Date.now() - 5000000
            manager.addToContext({
                prompt: 'Old question',
                output: 'Old answer',
                timestamp: oldTimestamp,
                concepts: ['old']
            }, 0.5)

            manager.addToContext({
                prompt: 'Recent question',
                output: 'Recent answer',
                timestamp: Date.now(),
                concepts: ['recent']
            }, 0.9)

            manager.pruneContext()
            const context = manager.buildContext('Current prompt')

            expect(context).not.toContain('Old question')
            expect(context).toContain('Recent question')
        })

        it('should maintain context size limits', async () => {
            for (let i = 0; i < 10; i++) {
                manager.addToContext({
                    prompt: `Question ${i}`,
                    output: `Answer ${i}`,
                    timestamp: Date.now(),
                    concepts: [`concept${i}`]
                }, 0.8)
            }

            const context = manager.buildContext('Test prompt')
            const contextParts = context.split('Q:').length - 1
            expect(contextParts).toBeLessThanOrEqual(manager.maxContextSize)
        })
    })

    describe('Context Summarization', () => {
        it('should group related interactions by concept', async () => {
            const mlInteractions = [
                {
                    prompt: 'What is ML?',
                    output: 'Machine learning basics...',
                    concepts: ['machine learning']
                },
                {
                    prompt: 'Explain training data',
                    output: 'Training data is used...',
                    concepts: ['machine learning', 'data']
                }
            ]

            const summary = manager.summarizeContext(mlInteractions)
            expect(summary).toContain('machine learning')
            expect(summary.split('Topic:').length).toBe(2) // One for ML, one for data
        })

        it('should handle single interaction summaries', async () => {
            const interaction = {
                prompt: 'What is gradient descent?',
                output: 'Gradient descent is an optimization algorithm...',
                concepts: ['optimization']
            }

            const summary = manager.summarizeContext([interaction])
            expect(summary).toContain('Q:')
            expect(summary).toContain('A:')
            expect(summary).toContain('gradient descent')
        })

        it('should truncate long outputs in summaries', async () => {
            const longInteraction = {
                prompt: 'Explain transformers',
                output: 'A'.repeat(1000),
                concepts: ['transformers']
            }

            const summary = manager.formatGroupSummary('transformers', [longInteraction])
            expect(summary.length).toBeLessThan(200)
            expect(summary).toContain('...')
        })
    })

    describe('LLM Integration', () => {
        it('should generate responses with context', async () => {
            manager.addToContext({
                prompt: 'What are tensors?',
                output: 'Tensors are multi-dimensional arrays...',
                concepts: ['tensors', 'mathematics']
            }, 0.9)

            const context = manager.buildContext('How are tensors used in deep learning?')
            const response = await llmHandler.generateResponse(
                'How are tensors used in deep learning?',
                context
            )

            expect(response).toBeTruthy()
            expect(response.toLowerCase()).toContain('tensor')
        }, TEST_TIMEOUT)

        it('should handle context window limits', async () => {
            const largeContext = 'A'.repeat(10000)
            const processedContext = manager.buildContext('test', [], [], {
                systemContext: largeContext
            })

            const response = await llmHandler.generateResponse('test', processedContext)
            expect(response).toBeTruthy()
        }, TEST_TIMEOUT)
    })
})