import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

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

    constructor(configPath = null) {
        this.config = { ...Config.defaults };
        this.configFilePath = configPath || null;
        this.initialized = false;
    }

    async init() {
        if (this.initialized) return

        try {
            let fileConfig = {}
            
            // Load config file if requested
            if (this.configFilePath) {
                fileConfig = this.loadConfigFile()
            }
            
            // Merge in order: defaults -> file config -> user config
            this.config = this.mergeConfigs(Config.defaults, fileConfig, 0)
            
            this.applyEnvironmentOverrides()
            this.validateConfig()
            this.initialized = true
        } catch (error) {
            throw new Error(`Config initialization failed: ${error.message}`)
        }
    }

    loadConfigFile() {
        try {
            // If config file path was provided in constructor, use it directly
            if (this.configFilePath) {
                if (!fs.existsSync(this.configFilePath)) {
                    console.warn('Config file not found at provided path:', this.configFilePath);
                    return {};
                }
                console.log('Loading config from provided path:', this.configFilePath);
                const fileContent = fs.readFileSync(this.configFilePath, 'utf8');
                return JSON.parse(fileContent);
            }

            // Otherwise, try to find the config file in common locations
            const possiblePaths = [
                // Local development path
                join(process.cwd(), 'config', 'config.json'),
                // Path when running from project root
                join(process.cwd(), '..', 'config', 'config.json'),
                // Path when running from src directory
                join(process.cwd(), '..', '..', 'config', 'config.json'),
                // Docker container path
                '/app/config/config.json',
                // Fallback to environment variable if set
                process.env.CONFIG_PATH
            ].filter(Boolean);
            
            for (const path of possiblePaths) {
                if (path && fs.existsSync(path)) {
                    console.log('Loading config from:', path);
                    this.configFilePath = path;
                    const fileContent = fs.readFileSync(path, 'utf8');
                    return JSON.parse(fileContent);
                }
            }
            
            console.warn('Config file not found in any of these locations:', possiblePaths);
            return {};
            
        } catch (error) {
            console.error('Error loading config file:', error);
            return {};
        }
    }

    transformJsonConfig(jsonConfig) {
        const transformed = {}
        
        // Map server configs
        if (jsonConfig.servers) {
            transformed.servers = jsonConfig.servers
        }
        
        // Map SPARQL endpoints
        if (jsonConfig.sparqlEndpoints && jsonConfig.sparqlEndpoints.length > 0) {
            const endpoint = jsonConfig.sparqlEndpoints[0]
            transformed.sparqlEndpoints = [{
                label: "config-file",
                user: endpoint.auth?.user || "admin",
                password: endpoint.auth?.password || "admin",
                urlBase: endpoint.queryEndpoint.replace('/semem/query', ''),
                dataset: "semem",
                query: "/semem",
                update: "/semem",
                upload: "/semem/upload",
                gspRead: "/semem/data",
                gspWrite: "/semem/data"
            }]
        }
        
        // Map models from LLM providers
        if (jsonConfig.llmProviders && jsonConfig.llmProviders.length > 0) {
            const chatProvider = jsonConfig.llmProviders.find(p => p.capabilities?.includes('chat'))
            const embeddingProvider = jsonConfig.llmProviders.find(p => p.capabilities?.includes('embedding'))
            
            if (chatProvider) {
                transformed.models = transformed.models || {}
                transformed.models.chat = {
                    provider: chatProvider.type,
                    model: chatProvider.chatModel,
                    options: {}
                }
            }
            
            if (embeddingProvider) {
                transformed.models = transformed.models || {}
                transformed.models.embedding = {
                    provider: embeddingProvider.type,
                    model: embeddingProvider.embeddingModel,
                    options: {}
                }
            }
        }
        
        // Map other top-level configs
        if (jsonConfig.chatModel) {
            transformed.models = transformed.models || {}
            transformed.models.chat = transformed.models.chat || {}
            transformed.models.chat.model = jsonConfig.chatModel
        }
        
        if (jsonConfig.embeddingModel) {
            transformed.models = transformed.models || {}
            transformed.models.embedding = transformed.models.embedding || {}
            transformed.models.embedding.model = jsonConfig.embeddingModel
        }
        
        return transformed
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

    static create(userConfig = {}, loadFromFile = true) {
        const config = new Config(userConfig, loadFromFile)
        config.init()
        return config
    }

    static createFromFile(userConfig = {}) {
        return Config.create(userConfig, true)
    }

    static createWithoutFile(userConfig = {}) {
        return Config.create(userConfig, false)
    }

    toJSON() {
        const { password, ...safeConfig } = this.config
        return safeConfig
    }
}