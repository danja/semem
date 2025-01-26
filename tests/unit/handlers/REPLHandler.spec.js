// tests/unit/api/REPLHandler.spec.js
import REPLHandler from '../../../src/api/repl/REPLHandler.js'
import { APIRegistry } from '../../../src/api/common/APIRegistry.js'
import { EventEmitter } from 'events'

describe('REPLHandler', () => {
    let handler
    let mockRegistry
    let mockReadline
    let mockChatAPI
    let mockStorageAPI

    beforeEach(() => {
        // Mock readline interface
        mockReadline = new EventEmitter()
        mockReadline.setPrompt = jasmine.createSpy('setPrompt')
        mockReadline.prompt = jasmine.createSpy('prompt')
        mockReadline.close = jasmine.createSpy('close')

        // Mock APIs
        mockChatAPI = {
            executeOperation: jasmine.createSpy('executeOperation')
                .and.resolveTo('Test response'),
            initialized: true
        }

        mockStorageAPI = {
            storeInteraction: jasmine.createSpy('storeInteraction')
                .and.resolveTo({ success: true }),
            initialized: true
        }

        // Mock registry
        mockRegistry = new APIRegistry()
        spyOn(mockRegistry, 'get').and.callFake(name => {
            if (name === 'chat') return mockChatAPI
            if (name === 'storage') return mockStorageAPI
            return null
        })

        handler = new REPLHandler({ test: 'config' })
        handler.registry = mockRegistry
        handler.rl = mockReadline
    })

    describe('Command Processing', () => {
        beforeEach(async () => {
            await handler.initialize()
        })

        it('should handle help command', async () => {
            spyOn(console, 'log')
            await handler.processInput('help')
            expect(console.log).toHaveBeenCalledWith(
                jasmine.stringMatching(/Available Commands/)
            )
        })

        it('should switch modes', async () => {
            await handler.processInput('mode chat')
            expect(handler.mode).toBe('chat')
            expect(mockReadline.setPrompt).toHaveBeenCalledWith(
                jasmine.stringMatching(/chat/)
            )
        })

        it('should reject invalid modes', async () => {
            spyOn(console, 'log')
            await handler.processInput('mode invalid')
            expect(console.log).toHaveBeenCalledWith(
                jasmine.stringMatching(/Invalid mode/)
            )
        })

        it('should show command history', async () => {
            spyOn(console, 'log')
            handler.history.push('test command')
            await handler.processInput('history')
            expect(console.log).toHaveBeenCalledWith(
                jasmine.stringMatching(/test command/)
            )
        })
    })

    describe('Chat Mode', () => {
        beforeEach(async () => {
            await handler.initialize()
            handler.mode = 'chat'
        })

        it('should process chat input', async () => {
            await handler.processInput('Hello')

            expect(mockChatAPI.executeOperation).toHaveBeenCalledWith(
                'chat',
                jasmine.objectContaining({
                    prompt: 'Hello',
                    mode: 'chat'
                })
            )
        })

        it('should store chat interactions', async () => {
            await handler.processInput('Hello')

            expect(mockStorageAPI.storeInteraction).toHaveBeenCalledWith(
                jasmine.objectContaining({
                    prompt: 'Hello',
                    output: 'Test response'
                })
            )
        })

        it('should handle chat errors', async () => {
            spyOn(console, 'error')
            mockChatAPI.executeOperation.and.rejectWith(new Error('Chat error'))

            await handler.processInput('Hello')
            expect(console.error).toHaveBeenCalledWith(
                jasmine.stringMatching(/Chat error/)
            )
        })
    })

    describe('RDF Mode', () => {
        beforeEach(async () => {
            await handler.initialize()
            handler.mode = 'rdf'
        })

        it('should process SPARQL queries', async () => {
            const query = 'SELECT * WHERE { ?s ?p ?o }'
            await handler.processInput(query)

            expect(mockStorageAPI.executeOperation).toHaveBeenCalledWith(
                'query',
                jasmine.objectContaining({ sparql: query })
            )
        })

        it('should handle update operations', async () => {
            const update = 'INSERT DATA { <s> <p> <o> }'
            await handler.processInput(update)

            expect(mockStorageAPI.executeOperation).toHaveBeenCalledWith(
                'update',
                jasmine.objectContaining({ sparql: update })
            )
        })

        it('should handle RDF errors', async () => {
            spyOn(console, 'error')
            mockStorageAPI.executeOperation.and.rejectWith(new Error('RDF error'))

            await handler.processInput('SELECT * WHERE { ?s ?p ?o }')
            expect(console.error).toHaveBeenCalledWith(
                jasmine.stringMatching(/RDF error/)
            )
        })
    })

    describe('History Management', () => {
        beforeEach(async () => {
            await handler.initialize()
        })

        it('should record command history', async () => {
            await handler.processInput('test command')
            expect(handler.history).toContain('test command')
        })

        it('should limit history size', async () => {
            for (let i = 0; i < 200; i++) {
                await handler.processInput(`command ${i}`)
            }
            expect(handler.history.length).toBeLessThanOrEqual(100)
        })

        it('should ignore empty commands', async () => {
            const initialLength = handler.history.length
            await handler.processInput('   ')
            expect(handler.history.length).toBe(initialLength)
        })
    })

    describe('Lifecycle Management', () => {
        it('should handle shutdown', async () => {
            spyOn(process, 'exit')
            await handler.shutdown()
            expect(mockReadline.close).toHaveBeenCalled()
            expect(process.exit).toHaveBeenCalledWith(0)
        })

        it('should handle SIGINT', () => {
            spyOn(handler, 'shutdown')
            mockReadline.emit('SIGINT')
            expect(handler.shutdown).toHaveBeenCalled()
        })
    })
})