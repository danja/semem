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
        sparqlEndpoints: [
            {
                label: "test-mem",
                user: "admin",
                password: "admin123",
                urlBase: "http://localhost:4030",
                query: "/test-mem",
                update: "/test-mem",
                upload: "/test-mem/upload",
                gspRead: "/test-mem/data",
                gspWrite: "/test-mem/data"
            }
        ]
    };

    constructor(userConfig = {}) {
        this.initialized = false
        this.config = {}
    }

    async init() {
        if (this.initialized) return

        try {
            // Load environment variables if needed
            // await this.loadEnv();

            // Deep merge defaults with user config
            this.config = this.mergeConfigs(Config.defaults, this.userConfig)

            // Validate configuration
            this.validateConfig()

            this.initialized = true
        } catch (error) {
            throw new Error(`Config initialization failed: ${error.message}`)
        }
    }

    mergeConfigs(defaults, user) {
        const merged = { ...defaults }
        for (const [key, value] of Object.entries(user)) {
            if (value && typeof value === 'object') {
                merged[key] = this.mergeConfigs(defaults[key] || {}, value)
            } else {
                merged[key] = value
            }
        }
        return merged
    }

    validateConfig() {
        const required = ['storage', 'models', 'sparqlEndpoints']
        for (const key of required) {
            if (!this.config[key]) {
                throw new Error(`Missing required config section: ${key}`)
            }
        }
    }

    async get(path) {
        if (!this.initialized) {
            await this.init()
        }
        return path.split('.').reduce((obj, key) => obj && obj[key], this.config)
    }

    async set(path, value) {
        if (!this.initialized) {
            await this.init()
        }
        const keys = path.split('.')
        const last = keys.pop()
        const target = keys.reduce((obj, key) => obj[key] = obj[key] || {}, this.config)
        target[last] = value
    }

    static async create(userConfig = {}) {
        const config = new Config(userConfig)
        await config.init()
        return config
    }
}