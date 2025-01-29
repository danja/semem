// tests/unit/Config.spec.js
import { BaseTest } from '../helpers/BaseTest.js'
import Config from '../../src/Config.js'

class ConfigTest extends BaseTest {
    beforeEach() {
        super.beforeEach()
        this.validConfig = {
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
                label: "test",
                urlBase: "http://localhost:4030",
                query: "/test-mem",
                update: "/test-mem",
                user: "admin",
                password: "admin123"
            }]
        }
        this.originalEnv = process.env
        process.env = { ...this.originalEnv }
    }

    afterEach() {
        super.afterEach()
        process.env = this.originalEnv
    }
}

describe('Config', () => {
    let test

    beforeEach(() => {
        test = new ConfigTest()
    })

    describe('Initialization', () => {
        it('should initialize with defaults when no config provided', async () => {
            const config = new Config()
            await test.expectSuccess(config.init())

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
            await test.expectSuccess(config.init())

            expect(config.get('storage.type')).toBe('sparql')
            expect(config.get('storage.options.graphName')).toBe('test')
            expect(config.get('models.chat.model')).toBe('qwen2:1.5b')
        })

        it('should reject with missing required sections', async () => {
            const config = new Config({})
            await test.expectFailure(config.init(), Error)
        })
    })

    describe('Configuration Access', () => {
        it('should retrieve nested values', async () => {
            const config = new Config(test.validConfig)
            await config.init()

            expect(config.get('models.chat.provider')).toBe('ollama')
            expect(config.get('sparqlEndpoints.0.label')).toBe('test')
        })

        it('should handle missing paths', async () => {
            const config = new Config(test.validConfig)
            await config.init()

            expect(config.get('invalid.path')).toBeUndefined()
            expect(config.get('storage.invalid')).toBeUndefined()
        })

        it('should handle environment overrides', async () => {
            process.env.SEMEM_STORAGE_TYPE = 'memory'
            const config = new Config(test.validConfig)
            await config.init()

            expect(config.get('storage.type')).toBe('memory')
        })
    })

    describe('Configuration Updates', () => {
        it('should set nested values', async () => {
            const config = new Config(test.validConfig)
            await config.init()

            config.set('models.chat.model', 'new-model')
            expect(config.get('models.chat.model')).toBe('new-model')
        })

        it('should create intermediate objects', async () => {
            const config = new Config(test.validConfig)
            await config.init()

            config.set('new.nested.value', 'test')
            expect(config.get('new.nested.value')).toBe('test')
        })

        it('should handle array updates', async () => {
            const config = new Config(test.validConfig)
            await config.init()

            config.set('sparqlEndpoints.0.user', 'newuser')
            expect(config.get('sparqlEndpoints.0.user')).toBe('newuser')
        })
    })

    describe('Static Factory', () => {
        it('should create and initialize in one step', () => {
            const config = Config.create(test.validConfig)
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
                ...test.validConfig,
                storage: { type: 'invalid' }
            })
            await test.expectFailure(config.init(), Error)
        })

        it('should validate model configuration', async () => {
            const config = new Config({
                ...test.validConfig,
                models: { chat: {} }
            })
            await test.expectFailure(config.init(), Error)
        })

        it('should validate SPARQL endpoints', async () => {
            const config = new Config({
                ...test.validConfig,
                sparqlEndpoints: [{ label: 'test' }]
            })
            await test.expectFailure(config.init(), Error)
        })
    })

    describe('Security Handling', () => {
        it('should handle sensitive data', async () => {
            const config = new Config(test.validConfig)
            await config.init()

            const json = JSON.stringify(config)
            expect(json).not.toContain('admin123')
        })

        it('should preserve credentials in memory', async () => {
            const config = new Config(test.validConfig)
            await config.init()

            expect(config.get('sparqlEndpoints.0.password')).toBe('admin123')
        })
    })
})