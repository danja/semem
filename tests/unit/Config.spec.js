import Config from '../../src/Config.js'

describe('Config', () => {
    let config
    const testConfig = {
        storage: {
            type: 'test',
            options: { path: 'test.json' }
        },
        models: {
            chat: { provider: 'test', model: 'test-model' },
            embedding: { provider: 'test', model: 'test-embed' }
        },
        sparqlEndpoints: [{ label: 'test' }]
    }

    beforeEach(() => {
        config = new Config(testConfig)
    })

    describe('initialization', () => {
        it('should initialize with default values when no config provided', () => {
            const defaultConfig = new Config()
            defaultConfig.init()
            expect(defaultConfig.get('models.chat.model')).toBe('qwen2:1.5b')
        })

        it('should merge user config with defaults', () => {
            config.init()
            expect(config.get('storage.type')).toBe('test')
            expect(config.get('models.chat.model')).toBe('test-model')
        })

        it('should validate required sections', () => {
            const invalidConfig = new Config({})
            expect(() => invalidConfig.init()).toThrowError(/Missing required config/)
        })
    })

    describe('get()', () => {
        beforeEach(() => {
            config.init()
        })

        it('should retrieve nested values', () => {
            expect(config.get('models.chat.model')).toBe('test-model')
            expect(config.get('storage.options.path')).toBe('test.json')
        })

        it('should return undefined for invalid paths', () => {
            expect(config.get('invalid.path')).toBeUndefined()
        })

        it('should auto-initialize if needed', () => {
            const newConfig = new Config(testConfig)
            expect(newConfig.get('models.chat.model')).toBe('test-model')
        })
    })

    describe('set()', () => {
        beforeEach(() => {
            config.init()
        })

        it('should set nested values', () => {
            config.set('models.chat.model', 'new-model')
            expect(config.get('models.chat.model')).toBe('new-model')
        })

        it('should create intermediate objects if needed', () => {
            config.set('new.nested.value', 'test')
            expect(config.get('new.nested.value')).toBe('test')
        })
    })

    describe('static create()', () => {
        it('should create and initialize config in one step', () => {
            const created = Config.create(testConfig)
            expect(created.initialized).toBeTrue()
            expect(created.get('models.chat.model')).toBe('test-model')
        })

        it('should throw on invalid config', () => {
            expect(() => Config.create({ invalid: true }))
                .toThrowError(/Missing required config/)
        })
    })
})