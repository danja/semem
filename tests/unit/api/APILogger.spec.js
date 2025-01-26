// tests/unit/api/APILogger.spec.js
import APILogger from '../../../src/api/APILogger.js'

describe('APILogger', () => {
    let logger
    let originalConsole
    let consoleOutput

    beforeEach(() => {
        // Capture console output
        consoleOutput = {
            log: [],
            debug: [],
            info: [],
            warn: [],
            error: []
        }

        originalConsole = {
            log: console.log,
            debug: console.debug,
            info: console.info,
            warn: console.warn,
            error: console.error
        }

        Object.keys(consoleOutput).forEach(method => {
            console[method] = (...args) => consoleOutput[method].push(args.join(' '))
        })

        logger = new APILogger({
            name: 'TestLogger',
            level: 'debug',
            maxEntries: 100
        })
    })

    afterEach(() => {
        Object.assign(console, originalConsole)
        logger.dispose()
    })

    describe('Log Level Management', () => {
        it('should respect log levels', () => {
            logger.setLevel('warn')

            logger.debug('debug message')
            logger.info('info message')
            logger.warn('warn message')
            logger.error('error message')

            expect(consoleOutput.debug).toEqual([])
            expect(consoleOutput.info).toEqual([])
            expect(consoleOutput.warn.length).toBe(1)
            expect(consoleOutput.error.length).toBe(1)
        })

        it('should handle level changes', () => {
            logger.setLevel('error')
            logger.info('should not log')
            expect(consoleOutput.info).toEqual([])

            logger.setLevel('info')
            logger.info('should log')
            expect(consoleOutput.info.length).toBe(1)
        })

        it('should get current level', () => {
            logger.setLevel('warn')
            expect(logger.getLevel()).toBe('warn')
        })
    })

    describe('Log Entry Management', () => {
        it('should create formatted log entries', () => {
            const entry = logger.info('test message', { data: 'test' })

            expect(entry.timestamp).toBeDefined()
            expect(entry.level).toBe('info')
            expect(entry.message).toContain('test message')
            expect(entry.message).toContain('{"data":"test"}')
        })

        it('should handle error objects', () => {
            const error = new Error('Test error')
            const entry = logger.error('Error occurred', error)

            expect(entry.error).toBeDefined()
            expect(entry.error.name).toBe('Error')
            expect(entry.error.message).toBe('Test error')
            expect(entry.error.stack).toBeDefined()
        })

        it('should enforce max entries limit', () => {
            logger = new APILogger({ maxEntries: 2 })

            logger.info('first')
            logger.info('second')
            logger.info('third')

            const entries = logger.getEntries()
            expect(entries.length).toBe(2)
            expect(entries[0].message).toBe('second')
            expect(entries[1].message).toBe('third')
        })
    })

    describe('Entry Retrieval', () => {
        beforeEach(() => {
            logger.info('info message')
            logger.warn('warn message')
            logger.error('error message')
        })

        it('should filter by level', () => {
            const errorEntries = logger.getEntries({ level: 'error' })
            expect(errorEntries.length).toBe(1)
            expect(errorEntries[0].level).toBe('error')
        })

        it('should filter by time range', () => {
            const now = new Date()
            const past = new Date(now - 1000)
            const future = new Date(now + 1000)

            const entries = logger.getEntries({
                since: past,
                until: future
            })
            expect(entries.length).toBe(3)
        })

        it('should limit results', () => {
            for (let i = 0; i < 10; i++) {
                logger.info(`message ${i}`)
            }

            const entries = logger.getEntries({ limit: 5 })
            expect(entries.length).toBe(5)
        })
    })

    describe('Child Loggers', () => {
        it('should create child loggers', () => {
            const child = logger.createChild('Child')
            expect(child.name).toBe('TestLogger:Child')
            expect(child.getLevel()).toBe(logger.getLevel())
        })

        it('should inherit parent options', () => {
            const child = logger.createChild('Child', { level: 'warn' })
            expect(child.getLevel()).toBe('warn')
            expect(child.maxEntries).toBe(logger.maxEntries)
        })
    })

    describe('Event Emission', () => {
        it('should emit log events', (done) => {
            logger.once('log', (entry) => {
                expect(entry.level).toBe('info')
                expect(entry.message).toBe('test message')
                done()
            })

            logger.info('test message')
        })

        it('should include metadata in events', (done) => {
            logger.once('log', (entry) => {
                expect(entry.metadata.pid).toBeDefined()
                expect(entry.metadata.hostname).toBeDefined()
                done()
            })

            logger.info('test message')
        })
    })

    describe('Resource Management', () => {
        it('should clear entries', () => {
            logger.info('test message')
            expect(logger.getEntries().length).toBe(1)

            logger.clearEntries()
            expect(logger.getEntries().length).toBe(0)
        })

        it('should cleanup on dispose', () => {
            const listener = jasmine.createSpy('logListener')
            logger.on('log', listener)

            logger.dispose()
            logger.info('test message')

            expect(listener).not.toHaveBeenCalled()
            expect(logger.getEntries().length).toBe(0)
        })
    })
})