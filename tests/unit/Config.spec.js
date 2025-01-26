// tests/unit/Config.spec.js
import Config from '../../src/Config.js'

describe('Config', () => {
    const validConfig = {
        storage: {
            type: 'sparql',
            options: {
                graphName: 'http://example.org/test'
            }
        },
        models: {
            chat: {
                provider: 'ollama',
                model: 'qwen2:1.5b'
            },
            embedding: {
                provider: 'ollama',
                model: 'nomic-embed-text'
            }
        },
        sparqlEndpoints: [{
            label: 'test',
            urlBase: 'http://localhost:4030',
            query: '/test-mem',
            update: '/test-mem',
            user: 'admin',
            password: 'admin123'
        }]
    }

    describe('Initialization', () => {
        it('should initialize with defaults when no config provided', async () => {
            const config = new Config()
            await config.init()

            expect(config.get('models.chat.model')).toBe('qwen2:1.5b')
            expect(config.get('models.embedding.model')).toBe('nomic-embed-text')
            expect(config.get('storage.type')).toBe('memory')
        })

        it('should merge user config with defaults', async () => {
            const config = new Config({
                storage: {
                    type: 'sparql',
                    options: { graphName: 'test' }
                }
            })
            await config.init()

            expect(config.get('storage.type')).toBe('sparql')
            expect(config.get('storage.options.graphName')).toBe('test')
            expect(config.get('models.chat.model')).toBe('qwen2:1.5b')
        })

        it('should validate required sections', async () => {
            const config = new Config({})
            await expectAsync(config.init())
                .toBeRejectedWithError(/Missing required config section/)
        })
    })

    describe('Configuration Access', () => {
        let config

        beforeEach(async () => {
            config = new Config(validConfig)
            await config.init()
        })

        it('should retrieve nested values', () => {
            expect(config.get('models.chat.provider')).toBe('ollama')
            expect(config.get('sparqlEndpoints.0.label')).toBe('test')
        })

        it('should handle missing paths', () => {
            expect(config.get('invalid.path')).toBeUndefined()
            expect(config.get('storage.invalid')).toBeUndefined()
        })

        it('should auto-initialize on first access', () => {
            const newConfig = new Config(validConfig)
            expect(newConfig.get('models.chat.provider')).toBe('ollama')
            expect(newConfig.initialized).toBeTrue()
        })
    })

    describe('Configuration Updates', () => {
        let config

        beforeEach(async () => {
            config = new Config(validConfig)
            await config.init()
        })

        it('should set nested values', () => {
            config.set('models.chat.model', 'new-model')
            expect(config.get('models.chat.model')).toBe('new-model')
        })

        it('should create intermediate objects', () => {
            config.set('new.nested.value', 'test')
            expect(config.get('new.nested.value')).toBe('test')
        })

        it('should handle array updates', () => {
            config.set('sparqlEndpoints.0.user', 'newuser')
            expect(config.get('sparqlEndpoints.0.user')).toBe('newuser')
        })
    })

    describe('Static Factory', () => {
        it('should create and initialize in one step', () => {
            const config = Config.create(validConfig)
            expect(config.initialized).toBeTrue()
            expect(config.get('storage.type')).toBe('sparql')
        })

        it('should validate during creation', () => {
            expect(() => Config.create({ invalid: true }))
                .toThrowError(/Missing required config/)
        })
    })

    describe('Schema Validation', () => {
        it('should validate storage configuration', async () => {
            const config = new Config({
                ...validConfig,
                storage: { type: 'invalid' }
            })
            await expectAsync(config.init())
                .toBeRejectedWithError(/Invalid storage type/)
        })

        it('should validate model configuration', async () => {
            const config = new Config({
                ...validConfig,
                models: { chat: {} }
            })
            await expectAsync(config.init())
                .toBeRejectedWithError(/Invalid model configuration/)
        })

        it('should validate SPARQL endpoints', async () => {
            const config = new Config({
                ...validConfig,
                sparqlEndpoints: [{ label: 'test' }]
            })
            await expectAsync(config.init())
                .toBeRejectedWithError(/Invalid SPARQL endpoint configuration/)
        })
    })

    describe('Environment Handling', () => {
        const originalEnv = process.env

        beforeEach(() => {
            process.env = { ...originalEnv }
        })

        afterEach(() => {
            process.env = originalEnv
        })

        it('should override config with environment variables', async () => {
            process.env.SEMEM_STORAGE_TYPE = 'memory'
            const config = new Config(validConfig)
            await config.init()

            expect(config.get('storage.type')).toBe('memory')
        })

        it('should handle sensitive data', async () => {
            process.env.SEMEM_SPARQL_PASSWORD = 'secret'
            const config = new Config(validConfig)
            await config.init()

            expect(config.get('sparqlEndpoints.0.password')).toBe('secret')
            expect(JSON.stringify(config)).not.toContain('secret')
        })
    })
})