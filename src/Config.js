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
                options: {
                    baseUrl: 'http://localhost:11434'
                }
            },
            // Alternative embedding providers
            embeddingProviders: {
                ollama: {
                    model: 'nomic-embed-text',
                    options: {
                        baseUrl: 'http://localhost:11434'
                    }
                },
                nomic: {
                    model: 'nomic-embed-text-v1.5',
                    options: {
                        apiKey: '${NOMIC_API_KEY}'
                    }
                }
            }
        },
        memory: {
            dimension: 1536,
            similarityThreshold: 40,
            contextWindow: 3,
            decayRate: 0.0001
        },
        sparqlEndpoints: [{
            label: "Hyperdata Fuseki",
            user: "admin",
            password: "admin123",
            urlBase: "https://fuseki.hyperdata.it",
            dataset: "hyperdata.it",
            query: "/hyperdata.it/query",
            update: "/hyperdata.it/update",
            upload: "/hyperdata.it/upload",
            gspRead: "/hyperdata.it/data",
            gspWrite: "/hyperdata.it/data"
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
                console.log('Loaded config file')
                //, JSON.stringify(fileConfig, null, 2))

                // Transform config file format to internal format
                fileConfig = this.transformJsonConfig(fileConfig)
                console.log('Transformed config:', JSON.stringify(fileConfig, null, 2))
            } else {
                console.log('No config file path provided, using defaults')
            }

            console.log('Merging configs...')
            // Defaults:', JSON.stringify(Config.defaults, null, 2))

            // Merge in order: defaults -> file config -> user config
            this.config = this.mergeConfigs(Config.defaults, fileConfig, 0)

            //    console.log('After merging, config is:', JSON.stringify(this.config, null, 2))

            this.initialized = true
            this.applyEnvironmentOverrides()
            this.validateConfig()

            console.log('Final config after overrides and validation:', JSON.stringify(this.config, null, 2))
        } catch (error) {
            console.error('Config initialization error details:', error);
            console.error('Error stack:', error.stack);
            throw new Error(`Config initialization failed: ${error.message}`)
        }
    }

    loadConfigFile() {
        try {
            // If config file path was provided in constructor, use it directly
            if (this.configFilePath) {
                console.log('Checking provided config path:', this.configFilePath);
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
                // Local development path (when running from project root)
                join(process.cwd(), 'config', 'config.json'),
                // Path when running from src directory
                join(process.cwd(), '..', 'config', 'config.json'),
                // Path when running from src/mcp directory
                join(process.cwd(), '..', '..', 'config', 'config.json'),
                // Docker container path
                '/app/config/config.json',
                // Fallback to environment variable if set
                process.env.CONFIG_PATH,
                // Absolute path as a last resort
                '/home/danny/hyperdata/semem/config/config.json'
            ].filter(Boolean);

            console.log('Searching for config in these locations:', possiblePaths);

            for (const path of possiblePaths) {
                console.log('  Checking:', path);
                if (path && fs.existsSync(path)) {
                    console.log('✓ Config file found at:', path);
                    this.configFilePath = path;
                    const fileContent = fs.readFileSync(path, 'utf8');
                    console.log('Config file content:', fileContent);
                    return JSON.parse(fileContent);
                }
            }

            console.warn('❌ Config file not found in any of these locations:', possiblePaths);
            return {};

        } catch (error) {
            console.error('Error loading config file:', error);
            return {};
        }
    }

    transformJsonConfig(jsonConfig) {
        const transformed = { ...jsonConfig } // Start with a copy of the original config

        // Map server configs (preserve existing if none in jsonConfig)
        if (jsonConfig.servers) {
            transformed.servers = jsonConfig.servers
        }

        // Map SPARQL endpoints if they exist in the format we expect
        if (jsonConfig.sparqlEndpoints && jsonConfig.sparqlEndpoints.length > 0) {
            const endpoint = jsonConfig.sparqlEndpoints[0]

            // Handle old format with queryEndpoint
            if (endpoint.queryEndpoint) {
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
            // Handle new format with urlBase and query/update paths
            else if (endpoint.urlBase && endpoint.query && endpoint.update) {
                // Only update storage configuration if it uses a single endpoint string
                // and we can safely enhance it with proper query/update URLs
                if (jsonConfig.storage &&
                    jsonConfig.storage.type === 'sparql' &&
                    jsonConfig.storage.options &&
                    jsonConfig.storage.options.endpoint &&
                    typeof jsonConfig.storage.options.endpoint === 'string') {

                    transformed.storage = {
                        ...jsonConfig.storage,
                        options: {
                            ...jsonConfig.storage.options,
                            query: endpoint.urlBase + endpoint.query,
                            update: endpoint.urlBase + endpoint.update,
                            user: endpoint.user || jsonConfig.storage.options.user,
                            password: endpoint.password || jsonConfig.storage.options.password,
                            graphName: jsonConfig.storage.options.graphName || jsonConfig.graphName
                        }
                    }
                }
            }
        }

        // Preserve llmProviders array as-is
        if (jsonConfig.llmProviders && Array.isArray(jsonConfig.llmProviders)) {
            transformed.llmProviders = jsonConfig.llmProviders;

            // Still set default models based on provider capabilities
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

        // Map other top-level configs (only if they don't exist already)
        if (jsonConfig.chatModel && !transformed.models?.chat?.model) {
            transformed.models = transformed.models || {}
            transformed.models.chat = transformed.models.chat || {}
            transformed.models.chat.model = jsonConfig.chatModel
        }

        if (jsonConfig.embeddingModel && !transformed.models?.embedding?.model) {
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

        // If user value is an array, replace the default entirely
        if (Array.isArray(user)) {
            return [...user];
        }

        // If user is not an object, return it (overriding defaults)
        if (!user || typeof user !== 'object') {
            return user || defaults;
        }

        // If defaults is not an object, return user (overriding defaults)
        if (!defaults || typeof defaults !== 'object') {
            return { ...user };
        }

        // Create a new object to hold the merged result
        const merged = { ...defaults };

        // Merge each property
        for (const [key, value] of Object.entries(user)) {
            if (value && typeof value === 'object' && !Array.isArray(value) &&
                defaults[key] && typeof defaults[key] === 'object') {
                // Recursively merge objects
                merged[key] = this.mergeConfigs(defaults[key], value, depth + 1);
            } else {
                // Replace with user value (including arrays and primitives)
                merged[key] = value !== undefined ? value : defaults[key];
            }
        }

        return merged;
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
        const validStorageTypes = ['memory', 'json', 'sparql', 'cached-sparql']
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

        // Replace ${VAR_NAME} placeholders with environment variables
        const replaceEnvVars = (obj) => {
            if (typeof obj === 'string' && obj.includes('${')) {
                return obj.replace(/\$\{([^}]+)\}/g, (_, varName) => {
                    return process.env[varName] || '';
                });
            } else if (Array.isArray(obj)) {
                return obj.map(item => replaceEnvVars(item));
            } else if (obj && typeof obj === 'object') {
                const result = {};
                for (const [key, value] of Object.entries(obj)) {
                    result[key] = replaceEnvVars(value);
                }
                return result;
            }
            return obj;
        };

        // Apply environment variable substitution to the entire config
        this.config = replaceEnvVars(this.config);
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