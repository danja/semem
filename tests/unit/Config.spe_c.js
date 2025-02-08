import { BaseTest } from '../helpers/BaseTest.js'
import Config from '../../src/Config.js'

class ConfigTest extends BaseTest {
    beforeEach() {
        super.beforeEach()
        this.originalEnv = { ...process.env }

        // Valid config matching Config.defaults exactly
        this.validConfig = {
            storage: {
                type: 'memory',
                options: {
                    path: 'interaction_history.json',
                    endpoint: 'http://localhost:8080',
                    apiKey: '',
                    timeout: 5000
                }
            },
            models: {
                chat: {
                    provider: 'ollama',
                    model: 'qwen2:1.5b',
                    options: {}
                },
                embedding: {
                    provider: 'ollama',
                    model: 'nomic-embed-text',
                    options: {}
                }
            },
            memory: {
                dimension: 1536,
                similarityThreshold: 40,
                contextWindow: 3,
                decayRate: 0.0001
            },
            sparqlEndpoints: [{
                label: "test-mem",
                user: "admin",
                password: "admin123",
                urlBase: "http://localhost:4030",
                dataset: "test-mem",
                query: "/test-mem",
                update: "/test-mem",
                upload: "/test-mem/upload",
                gspRead: "/test-mem/data",
                gspWrite: "/test-mem/data"
            }]
        }
    }

    afterEach() {
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
            await config.init()
            expect(config.get('storage.type')).toBe('memory')
            expect(config.get('models.chat.model')).toBe('qwen2:1.5b')
        })

        it('should merge user config with defaults', async () => {
            const config = new Config({
                storage: {
                    type: 'sparql',
                    options: { graphName: 'test' }
                },
                //    models: test.validConfig.models,
                //  sparqlEndpoints: test.validConfig.sparqlEndpoints
            })
            await config.init()
            expect(config.get('storage.type')).toBe('sparql')
            expect(config.get('storage.options.graphName')).toBe('test')
            expect(config.get('models.chat.model')).toBe('qwen2:1.5b')
        })

        /*
        it('should reject with missing required sections', async () => {
            const config = new Config({
                storage: test.validConfig.storage // Missing models and sparqlEndpoints
            })
            await expectAsync(config.init())
                .toBeRejectedWithError(/Missing required config section/)
        })*/
    })

    describe('Configuration Access', () => {
        it('should retrieve nested values', async () => {
            const config = new Config(test.validConfig)
            await config.init()
            expect(config.get('models.chat.provider')).toBe('ollama')
            expect(config.get('sparqlEndpoints.0.label')).toBe('test-mem')
        })

        it('should handle missing paths', async () => {
            const config = new Config(test.validConfig)
            await config.init()
            expect(config.get('invalid.path')).toBeUndefined()
            expect(config.get('storage.invalid')).toBeUndefined()
        })

        it('should handle environment overrides', async () => {
            process.env.SEMEM_STORAGE_TYPE = 'json'
            const config = new Config(test.validConfig)
            await config.init()
            expect(config.get('storage.type')).toBe('json')
        })
    })

    describe('Static Factory', () => {
        it('should create and initialize in one step', async () => {
            const config = Config.create(test.validConfig)
            expect(config.initialized).toBeTrue()
            expect(config.get('storage.type')).toBe('memory')
        })

        it('should validate during creation', () => {
            const invalidConfig = {
                storage: { type: 'invalid' },
                models: test.validConfig.models,
                sparqlEndpoints: test.validConfig.sparqlEndpoints
            }
            expect(() => Config.create(invalidConfig))
                .toThrowError(/Invalid storage type/)
        })
    })

    describe('Schema Validation', () => {
        it('should validate storage configuration', async () => {
            const config = new Config({
                storage: { type: 'invalid' },
                models: test.validConfig.models,
                sparqlEndpoints: test.validConfig.sparqlEndpoints
            })
            await expectAsync(config.init())
                .toBeRejectedWithError(/Invalid storage type/)
        })

        it('should validate model configuration', async () => {
            const config = new Config({
                storage: test.validConfig.storage,
                models: { chat: {} }, // Missing required model fields
                sparqlEndpoints: test.validConfig.sparqlEndpoints
            })
            await expectAsync(config.init())
                .toBeRejectedWithError(/Invalid model configuration/)
        })

        it('should validate SPARQL endpoints', async () => {
            const config = new Config({
                storage: test.validConfig.storage,
                models: test.validConfig.models,
                sparqlEndpoints: [{ label: 'test' }] // Missing required endpoint fields
            })
            await expectAsync(config.init())
                .toBeRejectedWithError(/Invalid SPARQL endpoint configuration/)
        })
    })

    describe('Security Handling', () => {
        it('should preserve credentials in memory', async () => {
            const config = new Config(test.validConfig)
            await config.init()
            expect(config.get('sparqlEndpoints.0.password')).toBe('admin123')
        })
    })
})