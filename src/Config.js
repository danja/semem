/**
 * Configuration management for Semem system
 */
export default class Config {
    static defaults = {
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
                //    provider: 'ollama',
                //  model: 'qwen2:1.5b',
                provider: 'mistral',
                model: 'open-codestral-mamba',
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
            label: "tbox Fuseki",
            user: "admin",
            password: "admin123",
            //    urlBase: "http://localhost:3030",
            urlBase: "http://localhost:4030",
            dataset: "semem",
            query: "/semem",
            update: "/semem",
            upload: "/semem/upload",
            gspRead: "/semem/data",
            gspWrite: "/semem/data"
        }
  /*
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
        }
            */]
    }

    constructor(userConfig = {}) {
        this.initialized = false
        this.config = {}
        this.userConfig = userConfig
    }

    async init() {
        if (this.initialized) return

        try {
            this.config = this.mergeConfigs(Config.defaults, this.userConfig, 0)
            this.applyEnvironmentOverrides()
            this.validateConfig()
            this.initialized = true
        } catch (error) {
            throw new Error(`Config initialization failed: ${error.message}`)
        }
    }

    // Added maxDepth parameter to prevent infinite recursion
    mergeConfigs(defaults, user, depth = 0) {
        if (depth > 10) { // Set reasonable recursion limit
            throw new Error('Config merge exceeded maximum depth')
        }

        if (!user || typeof user !== 'object' || Array.isArray(user)) {
            return defaults
        }

        const merged = { ...defaults }

        for (const [key, value] of Object.entries(user)) {
            if (value && typeof value === 'object' && !Array.isArray(value) &&
                defaults && typeof defaults === 'object' && defaults[key]) {
                merged[key] = this.mergeConfigs(defaults[key], value, depth + 1)
            } else {
                merged[key] = value
            }
        }
        return merged
    }

    validateConfig() {
        // Required sections
        const required = ['storage', 'models', 'sparqlEndpoints']
        for (const key of required) {
            if (!this.config[key]) {
                throw new Error(`Missing required config section: ${key}`)
            }
        }

        // Storage validation
        const validStorageTypes = ['memory', 'json', 'sparql']
        if (!validStorageTypes.includes(this.config.storage.type)) {
            throw new Error('Invalid storage type')
        }

        // Model validation
        const models = this.config.models
        if (!models.chat?.provider || !models.chat?.model ||
            !models.embedding?.provider || !models.embedding?.model) {
            throw new Error('Invalid model configuration')
        }

        // SPARQL endpoint validation
        const endpoint = this.config.sparqlEndpoints[0]
        if (!endpoint?.urlBase || !endpoint?.query || !endpoint?.update) {
            throw new Error('Invalid SPARQL endpoint configuration')
        }
    }

    applyEnvironmentOverrides() {
        // Handle environment variables with SEMEM_ prefix
        for (const [key, value] of Object.entries(process.env)) {
            if (key.startsWith('SEMEM_')) {
                const configPath = key.slice(6).toLowerCase().split('_')
                this.set(configPath.join('.'), value)
            }
        }
    }

    get(path) {
        if (!this.initialized) {
            throw new Error('Config not initialized')
        }

        return path.split('.').reduce((obj, key) => {
            return obj === undefined ? undefined : obj[key]
        }, this.config)
    }

    set(path, value) {
        if (!this.initialized) {
            throw new Error('Config not initialized')
        }

        const keys = path.split('.')
        const last = keys.pop()
        const target = keys.reduce((obj, key) => {
            if (!obj[key]) obj[key] = {}
            return obj[key]
        }, this.config)

        target[last] = value
    }

    static create(userConfig = {}) {
        const config = new Config(userConfig)
        config.init()
        return config
    }

    toJSON() {
        const { password, ...safeConfig } = this.config
        return safeConfig
    }
}