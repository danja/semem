// tests/unit/api/CLIHandler.spec.js
import CLIHandler from '../../../src/api/cli/CLIHandler.js'
import APIRegistry from '../../../src/api/common/APIRegistry.js'

describe('CLIHandler', () => {
    let handler
    let mockRegistry
    let mockChatAPI
    let mockStorageAPI
    let originalConsole
    let consoleOutput

    beforeEach(() => {
        // Mock APIs
        mockChatAPI = {
            executeOperation: jasmine.createSpy('executeOperation')
                .and.resolveTo('Test response'),
            initialized: true
        }

        mockStorageAPI = {
            storeInteraction: jasmine.createSpy('storeInteraction')
                .and.resolveTo({ success: true }),
            retrieveInteractions: jasmine.createSpy('retrieveInteractions')
                .and.resolveTo([{ data: 'test' }]),
            initialized: true
        }

        // Mock registry
        mockRegistry = new APIRegistry()
        spyOn(mockRegistry, 'get').and.callFake(name => {
            if (name === 'chat') return mockChatAPI
            if (name === 'storage') return mockStorageAPI
            return null
        })

        // Capture console output
        consoleOutput = {
            log: [],
            error: []
        }
        originalConsole = {
            log: console.log,
            error: console.error
        }
        console.log = (...args) => consoleOutput.log.push(args.join(' '))
        console.error = (...args) => consoleOutput.error.push(args.join(' '))

        handler = new CLIHandler({ test: 'config' })
        handler.registry = mockRegistry
    })

    afterEach(() => {
        console.log = originalConsole.log
        console.error = originalConsole.error
    })

    describe('Command Setup', () => {
        it('should register all commands', () => {
            const commands = handler.yargs.getCommandInstance().getCommands()
            expect(commands).toContain('chat')
            expect(commands).toContain('store')
            expect(commands).toContain('query')
            expect(commands).toContain('metrics')
        })

        it('should set command options', () => {
            const options = handler.yargs.getOptions()
            expect(options.key.color).toBeDefined()
            expect(options.key.verbose).toBeDefined()
        })
    })

    describe('Chat Operations', () => {
        it('should handle chat command', async () => {
            await handler.executeOperation('chat', {
                prompt: 'Hello',
                model: 'test-model'
            })

            expect(mockChatAPI.executeOperation).toHaveBeenCalledWith(
                'chat',
                jasmine.objectContaining({
                    prompt: 'Hello',
                    model: 'test-model'
                })
            )
            expect(consoleOutput.log[0]).toContain('Test response')
        })

        it('should handle chat errors', async () => {
            mockChatAPI.executeOperation.and.rejectWith(new Error('Chat failed'))

            await handler.executeOperation('chat', {
                prompt: 'Hello'
            })

            expect(consoleOutput.error[0]).toContain('Chat failed')
        })
    })

    describe('Storage Operations', () => {
        it('should handle store command', async () => {
            await handler.executeOperation('store', {
                data: 'test content',
                format: 'text'
            })

            expect(mockStorageAPI.storeInteraction).toHaveBeenCalledWith(
                jasmine.objectContaining({
                    content: 'test content',
                    format: 'text'
                })
            )
        })

        it('should handle query command', async () => {
            await handler.executeOperation('query', {
                query: 'test',
                limit: 5
            })

            expect(mockStorageAPI.retrieveInteractions).toHaveBeenCalledWith(
                jasmine.objectContaining({
                    text: 'test',
                    limit: 5
                })
            )
        })
    })

    describe('Output Formatting', () => {
        it('should format success output', () => {
            handler.formatOutput({
                success: true,
                data: 'test result'
            })

            expect(consoleOutput.log[0]).toContain('test result')
        })

        it('should format error output', () => {
            handler.formatOutput({
                success: false,
                error: 'test error'
            })

            expect(consoleOutput.error[0]).toContain('test error')
        })

        it('should format array results', () => {
            handler.formatOutput({
                success: true,
                data: [
                    { key: 'value1' },
                    { key: 'value2' }
                ]
            })

            expect(consoleOutput.log.length).toBe(4) // Header + 2 items + separator
            expect(consoleOutput.log.join('\n')).toContain('value1')
            expect(consoleOutput.log.join('\n')).toContain('value2')
        })

        it('should respect color option', () => {
            handler.formatOutput({
                success: true,
                data: 'test'
            }, { color: false })

            expect(consoleOutput.log[0]).toBe('test')
        })
    })

    describe('Metrics Handling', () => {
        it('should handle metrics command', async () => {
            await handler.executeOperation('metrics', {
                format: 'text'
            })

            const metrics = await handler.getMetrics()
            expect(consoleOutput.log.join('\n')).toContain(metrics.uptime)
        })

        it('should format metrics as JSON', async () => {
            await handler.executeOperation('metrics', {
                format: 'json'
            })

            const output = JSON.parse(consoleOutput.log[0])
            expect(output.success).toBeTrue()
            expect(output.data).toBeDefined()
        })
    })

    describe('Error Handling', () => {
        it('should handle unknown commands', async () => {
            await handler.executeOperation('unknown', {})
            expect(consoleOutput.error[0]).toContain('Unknown command')
        })

        it('should handle missing arguments', () => {
            expect(() => handler.yargs.parse(['chat']))
                .toThrow()
        })

        it('should validate required options', () => {
            const result = handler.yargs.parse(['chat', '--model', 'test'])
            expect(result.prompt).toBeUndefined()
        })
    })
})