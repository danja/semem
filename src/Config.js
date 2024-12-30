export default class Config {
    static defaults = {
        storage: {
            type: 'memory',  // 'memory', 'json', or 'remote'
            options: {
                path: 'interaction_history.json',
                // Remote storage options
                endpoint: 'http://localhost:8080',
                apiKey: '',
                timeout: 5000
            }
        },
        models: {
            chat: {
                provider: 'ollama',
                model: 'llama2',
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
        }
    };

    constructor(userConfig = {}) {
        this.config = this.mergeConfigs(Config.defaults, userConfig);
    }

    mergeConfigs(defaults, user) {
        const merged = { ...defaults };
        for (const [key, value] of Object.entries(user)) {
            if (value && typeof value === 'object') {
                merged[key] = this.mergeConfigs(defaults[key] || {}, value);
            } else {
                merged[key] = value;
            }
        }
        return merged;
    }

    get(path) {
        return path.split('.').reduce((obj, key) => obj && obj[key], this.config);
    }

    set(path, value) {
        const keys = path.split('.');
        const last = keys.pop();
        const target = keys.reduce((obj, key) => obj[key] = obj[key] || {}, this.config);
        target[last] = value;
    }
}
